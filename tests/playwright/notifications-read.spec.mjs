import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

// Read-only check for STEP11 notifications. No notifications are marked read.
const API_URL = "https://sonolii-api.g57cydy6ks.workers.dev";

async function signIn(page, email) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Clerk?.loaded === true, null, {
    timeout: 15_000,
  });
  await clerk.signIn({ page, emailAddress: email });
}

async function get(page, path) {
  return page.evaluate(async ({ path, base }) => {
    const token = await window.Clerk.session?.getToken({ skipCache: true });
    if (!token) throw new Error("Clerk session JWT is missing");
    const res = await fetch(base + path, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: res.status, body: await res.json() };
  }, { path, base: API_URL });
}

test("STEP11 notifications inbox and unread count (read only)", async ({ page }) => {
  test.setTimeout(60_000);
  const email = process.env.SONOLII_TEST_OWNER_EMAIL;
  expect(email, "Set SONOLII_TEST_OWNER_EMAIL").toBeTruthy();
  await signIn(page, email);

  const list = await get(page, "/me/notifications?limit=20");
  expect(list.status).toBe(200);
  expect(Array.isArray(list.body.notifications)).toBe(true);
  expect(
    list.body.nextCursor === null || typeof list.body.nextCursor === "string"
  ).toBe(true);

  const count = await get(page, "/me/notifications/unread-count");
  expect(count.status).toBe(200);
  expect(Number.isInteger(count.body.unreadCount)).toBe(true);
  expect(count.body.unreadCount).toBeGreaterThanOrEqual(0);

  for (const item of list.body.notifications) {
    expect(typeof item.id).toBe("string");
    expect(typeof item.type).toBe("string");
    expect(typeof item.createdAt).toBe("string");
    expect("postId" in item || "commentId" in item || "body" in item).toBe(false);
    // The enriched backend must expose the new nullable keys after deployment.
    expect("actorId" in item).toBe(true);
    expect("actorName" in item).toBe(true);
    expect("targetPostId" in item).toBe(true);
    // Optional navigation details must be absent or visible to this recipient.
    if (item.actorId !== undefined) {
      expect(item.actorId === null || typeof item.actorId === "string").toBe(true);
      expect(item.actorName === null || typeof item.actorName === "string").toBe(true);
      if (item.actorId !== null) {
        const profile = await get(page, "/profiles/" + item.actorId);
        expect(profile.status, "Actor profile link must resolve").toBe(200);
        expect(profile.body?.profile?.restricted, "Linked actor must be visible").toBe(false);
      }
    }
    if (item.targetPostId !== undefined) {
      expect(item.targetPostId === null || typeof item.targetPostId === "string").toBe(true);
      if (item.targetPostId !== null) {
        const post = await get(page, "/posts/" + item.targetPostId);
        expect(post.status, "Notification post link must resolve").toBe(200);
        expect(post.body?.post?.id).toBe(item.targetPostId);
      }
    }
  }
});
