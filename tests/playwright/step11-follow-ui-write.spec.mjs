import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

// DESTRUCTIVE-IN-THE-SENSE-OF-WRITING: only dedicated pre-release A/B fixtures.
// Follow/notification history can remain after cleanup. Do not run on production.
const API = "https://sonolii-api.g57cydy6ks.workers.dev";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function config() {
  const env = process.env;
  expect(env.CI === undefined || /^(0|false)$/i.test(env.CI), "CI writes prohibited").toBe(true);
  expect(env.SONOLII_TEST_PHASE, "Only before public launch").toBe("PRE_RELEASE");
  expect(env.SONOLII_TEST_WRITE_CONFIRM, "Explicit write approval").toBe("I_CONFIRM_TEST_WRITES");
  expect((env.SONOLII_TEST_API_URL ?? "").replace(/\/$/, "")).toBe(API);
  expect(env.SONOLII_TEST_ACTOR_EMAIL).toBeTruthy();
  expect(env.SONOLII_TEST_OWNER_EMAIL).toBeTruthy();
  expect(env.SONOLII_TEST_ACTOR_EMAIL).not.toBe(env.SONOLII_TEST_OWNER_EMAIL);
  expect(UUID.test(env.SONOLII_TEST_OWNER_ID ?? "")).toBe(true);
  return {
    actorEmail: env.SONOLII_TEST_ACTOR_EMAIL,
    ownerEmail: env.SONOLII_TEST_OWNER_EMAIL,
    ownerId: env.SONOLII_TEST_OWNER_ID,
  };
}

async function login(page, email) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Clerk?.loaded === true, null, { timeout: 20_000 });
  await clerk.signIn({ page, emailAddress: email });
  await page.waitForFunction(() => Boolean(window.Clerk?.session), null, { timeout: 20_000 });
}

async function get(page, path) {
  return page.evaluate(async ({ base, path }) => {
    const token = await window.Clerk.session?.getToken({ skipCache: true });
    if (!token) throw new Error("Missing Clerk token");
    const response = await fetch(base + path, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return { status: response.status, body: await response.json() };
  }, { base: API, path });
}

test("STEP11 dedicated accounts: request -> approve in notification -> accessible profile -> remove follow", async ({ browser }) => {
  test.setTimeout(180_000);
  const c = config(); // Must run before any browser/network operations.
  const ac = await browser.newContext();
  const bc = await browser.newContext();
  const actor = await ac.newPage();
  const owner = await bc.newPage();
  let created = false;
  const errors = [];

  try {
    await login(actor, c.actorEmail);
    await login(owner, c.ownerEmail);

    // Preflight is read-only. Never alter an existing follow or profile setting.
    const [actorSelf, ownerSelf, ownerProfile, baseline] = await Promise.all([
      get(actor, "/me/profile"),
      get(owner, "/me/profile"),
      get(owner, "/profiles/" + c.ownerId),
      get(actor, "/users/" + c.ownerId + "/follow"),
    ]);
    for (const item of [actorSelf, ownerSelf, ownerProfile, baseline]) {
      expect(item.status).toBe(200);
    }
    expect(UUID.test(actorSelf.body?.profile?.user_id ?? "")).toBe(true);
    expect(actorSelf.body.profile.user_id).not.toBe(c.ownerId);
    expect(ownerSelf.body?.profile?.user_id).toBe(c.ownerId);
    expect(ownerProfile.body?.profile?.visibility).toBe("followers");
    // A baseline null might also hide a rejected record. Only dedicated fixtures.
    expect(baseline.body?.status, "A must not already follow B").toBeNull();

    await actor.goto("/users/" + c.ownerId);
    await expect(actor.getByRole("button", { name: "フォローする" })).toBeVisible();
    await actor.getByRole("button", { name: "フォローする" }).click();
    // Mark created as soon as the write might have been submitted, so cleanup
    // still runs if the UI check fails after a successful request.
    created = true;
    await expect(actor.getByRole("button", { name: "申請を取り消す" })).toBeVisible();
    expect((await get(actor, "/users/" + c.ownerId + "/follow")).body.status).toBe("pending");

    await owner.goto("/notifications");
    await expect(owner.getByRole("heading", { name: "通知" })).toBeVisible();
    const request = owner.locator('[role="link"]').filter({ hasText: "フォロー申請" })
      .filter({ has: owner.getByRole("button", { name: "承認" }) }).first();
    await expect(request).toBeVisible({ timeout: 20_000 });
    await request.getByRole("button", { name: "承認" }).click();
    await expect(request.getByRole("button", { name: "承認" })).toHaveCount(0);
    await expect.poll(async () =>
      (await get(actor, "/users/" + c.ownerId + "/follow")).body.status
    ).toBe("accepted");

    await actor.reload();
    await expect(actor.getByRole("button", { name: "フォローを解除" })).toBeVisible();
    actor.once("dialog", dialog => dialog.accept());
    await actor.getByRole("button", { name: "フォローを解除" }).click();
    await expect(actor.getByRole("button", { name: "フォローする" })).toBeVisible();
    await expect.poll(async () =>
      (await get(actor, "/users/" + c.ownerId + "/follow")).body.status
    ).toBeNull();
  } catch (e) {
    errors.push(e);
  } finally {
    if (created) {
      try {
        // Cleanup is explicit, limited to A -> B, and never removes a preexisting
        // relationship: preflight required baseline status null.
        const status = await get(actor, "/users/" + c.ownerId + "/follow");
        if (["pending", "accepted"].includes(status.body?.status)) {
          const result = await actor.evaluate(async ({ base, ownerId }) => {
            const token = await window.Clerk.session?.getToken({ skipCache: true });
            if (!token) throw new Error("Missing cleanup token");
            const r = await fetch(base + "/users/" + ownerId + "/follow", {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
              signal: AbortSignal.timeout(15_000),
            });
            return r.status;
          }, { base: API, ownerId: c.ownerId });
          expect(result, "Cleanup A -> B follow").toBe(204);
        }
      } catch (e) {
        errors.push(e);
      }
    }
    await Promise.allSettled([ac.close(), bc.close()]);
  }
  if (errors.length) throw new AggregateError(errors, "STEP11 E2E / cleanup error; check fixture state");
});
