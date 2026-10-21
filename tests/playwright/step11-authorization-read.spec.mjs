import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

// Read-only authorization regression for dedicated A/B fixtures.
const API = "https://sonolii-api.g57cydy6ks.workers.dev";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

async function login(page, email) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Clerk?.loaded === true, null, { timeout: 20000 });
  await clerk.signIn({ page, emailAddress: email });
  await page.waitForFunction(() => Boolean(window.Clerk?.session), null, { timeout: 20000 });
}

async function read(page, path) {
  return page.evaluate(async ({ path, base }) => {
    const token = await window.Clerk.session?.getToken({ skipCache: true });
    if (!token) throw new Error("No Clerk JWT");
    const response = await fetch(base + path, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    return { status: response.status, body: await response.json() };
  }, { path, base: API });
}

test("non-follower cannot read followers-only post, while owner can", async ({ browser }) => {
  test.setTimeout(90000);
  const env = process.env;
  const ownerId = env.SONOLII_TEST_OWNER_ID;
  const postId = env.SONOLII_TEST_POST_ID;
  const actorEmail = env.SONOLII_TEST_ACTOR_EMAIL;
  const ownerEmail = env.SONOLII_TEST_OWNER_EMAIL;
  if (!ownerId || !postId || !actorEmail || !ownerEmail) {
    test.skip(true, "Set dedicated A/B emails, SONOLII_TEST_OWNER_ID and SONOLII_TEST_POST_ID");
  }
  // Match using the same native RegExp.test() as the WSL preflight check.
  // A valid UUID must not be rejected by the assertion layer.
  expect(UUID.test(ownerId), "SONOLII_TEST_OWNER_ID must be UUID").toBe(true);
  expect(UUID.test(postId), "SONOLII_TEST_POST_ID must be UUID").toBe(true);
  expect(actorEmail).not.toBe(ownerEmail);

  const ac = await browser.newContext();
  const bc = await browser.newContext();
  try {
    const actor = await ac.newPage();
    const owner = await bc.newPage();
    await Promise.all([login(actor, actorEmail), login(owner, ownerEmail)]);

    const [ownerSelf, ownerProfile, actorFollow, ownerPost] = await Promise.all([
      read(owner, "/me/profile"),
      read(owner, "/profiles/" + ownerId),
      read(actor, "/users/" + ownerId + "/follow"),
      read(owner, "/posts/" + postId),
    ]);
    expect(ownerSelf.status).toBe(200);
    expect(ownerSelf.body?.profile?.user_id).toBe(ownerId);
    expect(ownerProfile.status).toBe(200);
    expect(ownerProfile.body?.profile?.visibility).toBe("followers");
    expect(actorFollow.status).toBe(200);
    expect(actorFollow.body?.status, "A must not already be an accepted follower").not.toBe("accepted");
    expect(ownerPost.status).toBe(200);
    expect(ownerPost.body?.post?.user_id).toBe(ownerId);

    const restricted = await read(actor, "/posts/" + postId);
    expect(restricted.status, "Protected post should be indistinguishable from absent post").toBe(404);
    expect(restricted.body?.post).toBeUndefined();

    const actorProfile = await read(actor, "/profiles/" + ownerId);
    expect(actorProfile.status).toBe(200);
    expect(actorProfile.body?.profile?.display_name).toBe(ownerProfile.body?.profile?.display_name);
    expect(actorProfile.body?.profile?.restricted).toBe(true);
  } finally {
    await Promise.allSettled([ac.close(), bc.close()]);
  }
});
