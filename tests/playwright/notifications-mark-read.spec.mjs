import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

// Pre-release-only WRITE tests. Generated notifications are intentionally retained.
// Do not run as part of a general "playwright test" command after launch.
const API_URL = "https://sonolii-api.g57cydy6ks.workers.dev";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function config() {
  const e = process.env;
  expect(!e.CI || /^(false|0)$/i.test(e.CI), "No CI writes").toBe(true);
  expect(e.SONOLII_TEST_PHASE, "Pre-release only").toBe("PRE_RELEASE");
  expect(e.SONOLII_TEST_WRITE_CONFIRM, "Manual authorization required")
    .toBe("I_CONFIRM_TEST_WRITES");
  expect((e.SONOLII_TEST_API_URL ?? "").replace(/\/$/, "")).toBe(API_URL);
  expect(e.SONOLII_TEST_ACTOR_EMAIL).toBeTruthy();
  expect(e.SONOLII_TEST_OWNER_EMAIL).toBeTruthy();
  expect(e.SONOLII_TEST_ACTOR_EMAIL).not.toBe(e.SONOLII_TEST_OWNER_EMAIL);
  expect(UUID.test(e.SONOLII_TEST_OWNER_ID ?? "")).toBe(true);
  expect(UUID.test(e.SONOLII_TEST_POST_ID ?? "")).toBe(true);
  return {
    actorEmail: e.SONOLII_TEST_ACTOR_EMAIL,
    ownerEmail: e.SONOLII_TEST_OWNER_EMAIL,
    ownerId: e.SONOLII_TEST_OWNER_ID,
    postId: e.SONOLII_TEST_POST_ID,
  };
}

async function login(page, email) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Clerk?.loaded === true, null, { timeout: 15_000 });
  await clerk.signIn({ page, emailAddress: email });
  await page.waitForFunction(() => Boolean(window.Clerk?.session), null, { timeout: 15_000 });
}

async function api(page, method, path, data) {
  return page.evaluate(async ({ base, method, path, data }) => {
    const token = await window.Clerk.session?.getToken({ skipCache: true });
    if (!token) throw new Error("No Clerk browser JWT");
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
  }, { base: API_URL, method, path, data });
}

function check(result, code, description) {
  expect(result.status, `${description}: HTTP ${result.status}`).toBe(code);
}

async function inbox(page) {
  const res = await api(page, "GET", "/me/notifications?limit=50");
  check(res, 200, "Inbox");
  expect(Array.isArray(res.body?.notifications)).toBe(true);
  return res.body.notifications;
}

async function count(page) {
  const res = await api(page, "GET", "/me/notifications/unread-count");
  check(res, 200, "Unread count");
  expect(Number.isInteger(res.body?.unreadCount)).toBe(true);
  return res.body.unreadCount;
}

test("STEP11 mark only a new notification read and enforce recipient isolation", async ({ browser }) => {
  test.setTimeout(240_000);
  const c = config();
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  const a = await aContext.newPage();
  const b = await bContext.newPage();
  let createdFollow = false;
  let commentId = null;
  const errors = [];
  try {
    await login(a, c.actorEmail);
    await login(b, c.ownerEmail);
    const aProfile = await api(a, "GET", "/me/profile");
    const bProfile = await api(b, "GET", "/me/profile");
    check(aProfile, 200, "Actor");
    check(bProfile, 200, "Owner");
    expect(UUID.test(aProfile.body?.profile?.user_id ?? "")).toBe(true);
    expect(aProfile.body.profile.user_id).not.toBe(c.ownerId);
    expect(bProfile.body?.profile?.user_id).toBe(c.ownerId);
    const profile = await api(b, "GET", "/profiles/" + c.ownerId);
    const post = await api(b, "GET", "/posts/" + c.postId);
    check(profile, 200, "Visibility");
    check(post, 200, "Post");
    expect(profile.body?.profile?.visibility).toBe("followers");
    expect(post.body?.post?.user_id).toBe(c.ownerId);
    expect(post.body?.post?.comments_enabled).toBe(true);

    const follow = await api(a, "GET", "/users/" + c.ownerId + "/follow");
    check(follow, 200, "Follow baseline");
    expect([null, "accepted"]).toContain(follow.body?.status);
    // A rejected follow can appear as null: use clean dedicated fixtures only.
    if (follow.body.status === null) {
      const request = await api(a, "PUT", "/users/" + c.ownerId + "/follow");
      check(request, 200, "Request follow");
      createdFollow = request.body?.follow?.changed === true;
      expect(createdFollow).toBe(true);
      expect(request.body?.follow?.status).toBe("pending");
      const id = request.body?.follow?.id;
      expect(UUID.test(id ?? "")).toBe(true);
      check(await api(b, "POST", "/me/follow-requests/" + id + "/accept"),
        200, "Approve follow");
    }
    check(await api(a, "GET", "/posts/" + c.postId), 200, "Follower access");

    const before = await inbox(b);
    const beforeIds = new Set(before.map(n => n.id));
    const countBefore = await count(b);
    const comment = await api(a, "POST", "/posts/" + c.postId + "/comments", {
      body: "STEP11 notification read test (temporary comment)",
    });
    if (UUID.test(comment.body?.comment?.id ?? "")) commentId = comment.body.comment.id;
    check(comment, 201, "Create test comment");
    expect(UUID.test(commentId ?? "")).toBe(true);

    const newRows = (await inbox(b)).filter(n => !beforeIds.has(n.id));
    const matching = newRows.filter(n => n.type === "post_comment");
    expect(matching.length, "One new test notification").toBe(1);
    const note = matching[0];
    expect(note.readAt).toBeNull();
    expect(await count(b)).toBe(countBefore + 1);

    // Actor may not mark recipient B's notification read.
    check(await api(a, "POST", "/me/notifications/" + note.id + "/read"),
      404, "Foreign notification must not be writable");
    expect(await count(b)).toBe(countBefore + 1);

    // Owner marks their freshly generated notification as read.
    check(await api(b, "POST", "/me/notifications/" + note.id + "/read"),
      204, "Mark own new notification read");
    expect(await count(b)).toBe(countBefore);
    const firstRead = (await inbox(b)).find(n => n.id === note.id);
    expect(firstRead?.readAt).toBeTruthy();

    // Repeating the same request is idempotent: read_at does not change.
    check(await api(b, "POST", "/me/notifications/" + note.id + "/read"),
      204, "Idempotent mark-read");
    const secondRead = (await inbox(b)).find(n => n.id === note.id);
    expect(secondRead?.readAt).toBe(firstRead.readAt);
    expect(await count(b)).toBe(countBefore);
  } catch (err) {
    errors.push(err);
  } finally {
    if (commentId) {
      try {
        check(await api(a, "DELETE",
          "/posts/" + c.postId + "/comments/" + commentId), 204,
        "Soft-delete temporary comment");
      } catch (err) { errors.push(err); }
    }
    if (createdFollow) {
      try {
        check(await api(a, "DELETE", "/users/" + c.ownerId + "/follow"),
          204, "Undo temporary follow");
      } catch (err) { errors.push(err); }
    }
    await Promise.allSettled([aContext.close(), bContext.close()]);
  }
  if (errors.length) {
    throw new AggregateError(errors,
      "Notification read test or cleanup failed; inspect test fixtures");
  }
});

test("STEP11 read-all only when there are no pre-existing unread notifications", async ({ browser }) => {
  test.setTimeout(240_000);
  const c = config();
  const aContext = await browser.newContext();
  const bContext = await browser.newContext();
  const a = await aContext.newPage();
  const b = await bContext.newPage();
  let createdFollow = false;
  let commentId = null;
  let skipReason = null;
  const errors = [];
  try {
    await login(a, c.actorEmail);
    await login(b, c.ownerEmail);

    const aProfile = await api(a, "GET", "/me/profile");
    const bProfile = await api(b, "GET", "/me/profile");
    check(aProfile, 200, "Actor");
    check(bProfile, 200, "Owner");
    expect(aProfile.body?.profile?.user_id).toBeTruthy();
    expect(bProfile.body?.profile?.user_id).toBe(c.ownerId);
    const post = await api(b, "GET", "/posts/" + c.postId);
    check(post, 200, "Post fixture");
    expect(post.body?.post?.user_id).toBe(c.ownerId);
    expect(post.body?.post?.comments_enabled).toBe(true);
    const profile = await api(b, "GET", "/profiles/" + c.ownerId);
    check(profile, 200, "Profile");
    expect(profile.body?.profile?.visibility).toBe("followers");

    // Establish follow, then require an EMPTY inbox of unread notifications.
    const follow = await api(a, "GET", "/users/" + c.ownerId + "/follow");
    check(follow, 200, "Follow baseline");
    expect([null, "accepted"]).toContain(follow.body?.status);
    if (follow.body.status === null) {
      const request = await api(a, "PUT", "/users/" + c.ownerId + "/follow");
      check(request, 200, "Request follow");
      createdFollow = request.body?.follow?.changed === true;
      expect(createdFollow).toBe(true);
      const id = request.body?.follow?.id;
      expect(UUID.test(id ?? "")).toBe(true);
      check(await api(b, "POST", "/me/follow-requests/" + id + "/accept"),
        200, "Accept follow");
    }
    check(await api(a, "GET", "/posts/" + c.postId), 200, "Follower access");

    if (await count(b) !== 0) {
      skipReason = "Existing unread notifications must not be marked read by this test; use a clean dedicated recipient";
    } else {
      const comment = await api(a, "POST", "/posts/" + c.postId + "/comments", {
        body: "STEP11 read-all test (only when recipient unread baseline is zero)",
      });
      if (UUID.test(comment.body?.comment?.id ?? "")) commentId = comment.body.comment.id;
      check(comment, 201, "Create new comment");
      expect(UUID.test(commentId ?? "")).toBe(true);
      expect(await count(b)).toBe(1);
      check(await api(b, "POST", "/me/notifications/read-all"),
        204, "Read-all");
      expect(await count(b)).toBe(0);
    }
  } catch (err) {
    errors.push(err);
  } finally {
    if (commentId) {
      try {
        check(await api(a, "DELETE",
          "/posts/" + c.postId + "/comments/" + commentId), 204, "Soft-delete test comment");
      } catch (err) { errors.push(err); }
    }
    if (createdFollow) {
      try {
        check(await api(a, "DELETE", "/users/" + c.ownerId + "/follow"),
          204, "Undo test follow");
      } catch (err) { errors.push(err); }
    }
    await Promise.allSettled([aContext.close(), bContext.close()]);
  }
  if (errors.length) {
    throw new AggregateError(errors,
      "Read-all test/cleanup failed; inspect fixture");
  }
  if (skipReason) test.skip(true, skipReason);
});
