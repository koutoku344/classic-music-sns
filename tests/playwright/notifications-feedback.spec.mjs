import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

// STEP11-3-5-3: writes to the existing PRE-RELEASE Neon database.
// Run ONLY this spec with explicit consent. Do not run after public launch.
// Notifications intentionally remain after test feedback has been removed.
const API_URL = "https://sonolii-api.g57cydy6ks.workers.dev";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function settings() {
  const env = process.env;
  expect(!env.CI || /^(false|0)$/i.test(env.CI), "Writes are forbidden in CI").toBeTruthy();
  expect(env.SONOLII_TEST_PHASE, "Pre-release flag required").toBe("PRE_RELEASE");
  expect(env.SONOLII_TEST_WRITE_CONFIRM, "Explicit writes approval required")
    .toBe("I_CONFIRM_TEST_WRITES");
  expect((env.SONOLII_TEST_API_URL ?? "").replace(/\/$/, "")).toBe(API_URL);
  expect(env.SONOLII_TEST_ACTOR_EMAIL, "Actor email required").toBeTruthy();
  expect(env.SONOLII_TEST_OWNER_EMAIL, "Owner email required").toBeTruthy();
  expect(env.SONOLII_TEST_ACTOR_EMAIL).not.toBe(env.SONOLII_TEST_OWNER_EMAIL);
  expect(UUID.test(env.SONOLII_TEST_OWNER_ID ?? ""), "Owner UUID required").toBe(true);
  expect(UUID.test(env.SONOLII_TEST_POST_ID ?? ""), "Post UUID required").toBe(true);
  return {
    actorEmail: env.SONOLII_TEST_ACTOR_EMAIL,
    ownerEmail: env.SONOLII_TEST_OWNER_EMAIL,
    ownerId: env.SONOLII_TEST_OWNER_ID,
    postId: env.SONOLII_TEST_POST_ID,
  };
}

async function signIn(page, email) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Clerk?.loaded === true, null, { timeout: 15_000 });
  await clerk.signIn({ page, emailAddress: email });
  await page.waitForFunction(() => Boolean(window.Clerk?.session), null, { timeout: 15_000 });
}

// JWT remains inside the browser, and is minted fresh for each API request.
async function api(page, method, path, data) {
  return page.evaluate(async ({ method, path, data, base }) => {
    const token = await window.Clerk.session?.getToken({ skipCache: true });
    if (!token) throw new Error("No browser Clerk session JWT");
    const headers = { Authorization: `Bearer ${token}` };
    if (data !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(base + path, {
      method,
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    const raw = await response.text();
    return { status: response.status, body: raw ? JSON.parse(raw) : null };
  }, { method, path, data, base: API_URL });
}

function status(result, expected, label) {
  expect(result.status, `${label}: HTTP ${result.status}`).toBe(expected);
}

async function notificationList(page) {
  const result = await api(page, "GET", "/me/notifications?limit=50");
  status(result, 200, "Notification inbox");
  expect(Array.isArray(result.body?.notifications)).toBe(true);
  return result.body.notifications;
}

async function unreadCount(page) {
  const result = await api(page, "GET", "/me/notifications/unread-count");
  status(result, 200, "Unread count");
  expect(Number.isInteger(result.body?.unreadCount)).toBe(true);
  return result.body.unreadCount;
}

test("STEP11 comment and post-like notifications (pre-release writes)", async ({ browser }) => {
  test.setTimeout(240_000);
  const c = settings(); // Fail closed before network access.
  const actorContext = await browser.newContext();
  const ownerContext = await browser.newContext();
  const actor = await actorContext.newPage();
  const owner = await ownerContext.newPage();

  let addedFollow = false;
  let commentId = null;
  let addedLike = false;
  const failures = [];

  try {
    await signIn(actor, c.actorEmail);
    await signIn(owner, c.ownerEmail);

    const a = await api(actor, "GET", "/me/profile");
    const b = await api(owner, "GET", "/me/profile");
    status(a, 200, "Actor identity");
    status(b, 200, "Owner identity");
    expect(UUID.test(a.body?.profile?.user_id ?? "")).toBe(true);
    expect(a.body.profile.user_id).not.toBe(c.ownerId);
    expect(b.body?.profile?.user_id).toBe(c.ownerId);

    const profile = await api(owner, "GET", "/profiles/" + c.ownerId);
    status(profile, 200, "Owner visibility");
    expect(profile.body?.profile?.visibility).toBe("followers");
    const post = await api(owner, "GET", "/posts/" + c.postId);
    status(post, 200, "Fixture post");
    expect(post.body?.post?.user_id).toBe(c.ownerId);
    expect(post.body?.post?.comments_enabled).toBe(true);

    const prior = await api(actor, "GET", "/users/" + c.ownerId + "/follow");
    status(prior, 200, "Follow baseline");
    expect([null, "accepted"]).toContain(prior.body?.status);
    // Rejected follows can appear as null; use a clean dedicated fixture.
    // Establish accepted follow before measuring the notification baseline.
    if (prior.body.status === null) {
      const request = await api(actor, "PUT", "/users/" + c.ownerId + "/follow");
      status(request, 200, "Request follow");
      addedFollow = request.body?.follow?.changed === true;
      expect(addedFollow, "Follow changed concurrently").toBe(true);
      expect(request.body?.follow?.status).toBe("pending");
      const followId = request.body?.follow?.id;
      expect(UUID.test(followId ?? "")).toBe(true);
      const accept = await api(owner, "POST",
        "/me/follow-requests/" + followId + "/accept");
      status(accept, 200, "Accept follow");
      expect(accept.body?.follow?.status).toBe("accepted");
    }

    const visible = await api(actor, "GET", "/posts/" + c.postId);
    status(visible, 200, "Accepted follower access");

    // Require a new like so that the test actually verifies an INSERT trigger.
    // Never remove a pre-existing like just to make the test pass.
    const likeBefore = await api(actor, "GET", "/posts/" + c.postId + "/likes");
    status(likeBefore, 200, "Post-like baseline");
    expect(likeBefore.body?.likedByMe, "Use a fixture not already liked by A").toBe(false);

    const before = await notificationList(owner);
    const beforeIds = new Set(before.map(n => n.id));
    const unreadBefore = await unreadCount(owner);

    const comment = await api(actor, "POST",
      "/posts/" + c.postId + "/comments",
      { body: "STEP11-3-5-3 automated notification verification" });
    if (UUID.test(comment.body?.comment?.id ?? "")) commentId = comment.body.comment.id;
    status(comment, 201, "Insert new comment");
    expect(UUID.test(commentId ?? "")).toBe(true);

    // Response lost after a write could leave a like; inspect test fixture if failed.
    const like = await api(actor, "PUT", "/posts/" + c.postId + "/like");
    addedLike = like.status === 204;
    status(like, 204, "Insert new like");

    const after = await notificationList(owner);
    const newlyVisible = after.filter(n => !beforeIds.has(n.id));
    const newComments = newlyVisible.filter(n => n.type === "post_comment");
    const newLikes = newlyVisible.filter(n => n.type === "post_like");
    expect(newComments.length, "Exactly one new post-comment notification").toBe(1);
    expect(newLikes.length, "Exactly one new post-like notification").toBe(1);
    expect(newComments[0].readAt).toBeNull();
    expect(newLikes[0].readAt).toBeNull();
    expect(await unreadCount(owner), "Two new unread notifications")
      .toBe(unreadBefore + 2);

    // Idempotent repeated PUT must not insert another row or another notification.
    status(await api(actor, "PUT", "/posts/" + c.postId + "/like"),
      204, "Idempotent like");
    const afterRetry = await notificationList(owner);
    const retryIds = new Set(afterRetry.map(n => n.id));
    expect(retryIds.has(newLikes[0].id)).toBe(true);
    expect(afterRetry.filter(n => !beforeIds.has(n.id) && n.type === "post_like").length)
      .toBe(1);
    expect(await unreadCount(owner)).toBe(unreadBefore + 2);
  } catch (error) {
    failures.push(error);
  } finally {
    // Never touch pre-existing likes, comments, or accepted follows.
    if (addedLike) {
      try {
        status(await api(actor, "DELETE", "/posts/" + c.postId + "/like"),
          204, "Delete newly added like");
      } catch (error) { failures.push(error); }
    }
    if (commentId) {
      try {
        status(await api(actor, "DELETE", "/posts/" + c.postId +
          "/comments/" + commentId), 204, "Soft-delete test comment");
      } catch (error) { failures.push(error); }
    }
    if (addedFollow) {
      try {
        status(await api(actor, "DELETE", "/users/" + c.ownerId + "/follow"),
          204, "Remove newly added follow");
      } catch (error) { failures.push(error); }
    }
    await Promise.allSettled([actorContext.close(), ownerContext.close()]);
  }
  if (failures.length) {
    throw new AggregateError(failures,
      "Notification write test or cleanup failed; inspect A/B fixtures");
  }
});
