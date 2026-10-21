import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

// Explicit pre-release API-writing test. Use dedicated fixtures; no parallel UI activity.
// Notifications are intentionally retained; comments are soft-deleted.
const API_URL = "https://sonolii-api.g57cydy6ks.workers.dev";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function config() {
  const e = process.env;
  expect(!e.CI || /^(0|false)$/i.test(e.CI), "Writing test cannot run in CI").toBe(true);
  expect(e.SONOLII_TEST_PHASE).toBe("PRE_RELEASE");
  expect(e.SONOLII_TEST_WRITE_CONFIRM).toBe("I_CONFIRM_TEST_WRITES");
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
  return page.evaluate(async ({ method, path, data, base }) => {
    const token = await window.Clerk.session?.getToken({ skipCache: true });
    if (!token) throw new Error("No Clerk session token");
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

function check(result, expected, label) {
  expect(result.status, `${label}: HTTP ${result.status}`).toBe(expected);
}

async function inbox(page) {
  const result = await api(page, "GET", "/me/notifications?limit=50");
  check(result, 200, "Notification list");
  expect(Array.isArray(result.body?.notifications)).toBe(true);
  return result.body.notifications;
}

async function count(page) {
  const result = await api(page, "GET", "/me/notifications/unread-count");
  check(result, 200, "Unread notification count");
  expect(Number.isInteger(result.body?.unreadCount)).toBe(true);
  return result.body.unreadCount;
}

function added(list, baseline) {
  return list.filter(row => !baseline.has(row.id));
}

test("STEP11 reply, comment like, and self-action notification rules", async ({ browser }) => {
  test.setTimeout(240_000);
  const c = config(); // Fail before any network activity when not explicitly opted in.
  const actorContext = await browser.newContext();
  const ownerContext = await browser.newContext();
  const actor = await actorContext.newPage();
  const owner = await ownerContext.newPage();

  let createdFollow = false;
  let rootCommentId = null;
  let replyId = null;
  let ownerLikedRoot = false;
  let actorLikedRoot = false;
  let ownerLikedReply = false;
  const failures = [];
  try {
    await login(actor, c.actorEmail);
    await login(owner, c.ownerEmail);

    const a = await api(actor, "GET", "/me/profile");
    const b = await api(owner, "GET", "/me/profile");
    check(a, 200, "Actor identity");
    check(b, 200, "Owner identity");
    expect(UUID.test(a.body?.profile?.user_id ?? "")).toBe(true);
    expect(a.body.profile.user_id).not.toBe(c.ownerId);
    expect(b.body?.profile?.user_id).toBe(c.ownerId);

    const profile = await api(owner, "GET", "/profiles/" + c.ownerId);
    const post = await api(owner, "GET", "/posts/" + c.postId);
    check(profile, 200, "Owner profile");
    check(post, 200, "Post fixture");
    expect(profile.body?.profile?.visibility).toBe("followers");
    expect(post.body?.post?.user_id).toBe(c.ownerId);
    expect(post.body?.post?.comments_enabled).toBe(true);

    const follow = await api(actor, "GET", "/users/" + c.ownerId + "/follow");
    check(follow, 200, "Follow baseline");
    expect([null, "accepted"]).toContain(follow.body?.status);
    // GET hides rejected status as null: only use test-only fixtures with no rejected relation.
    if (follow.body.status === null) {
      const request = await api(actor, "PUT", "/users/" + c.ownerId + "/follow");
      check(request, 200, "Request follow");
      createdFollow = request.body?.follow?.changed === true;
      expect(createdFollow, "Follow changed concurrently").toBe(true);
      expect(request.body?.follow?.status).toBe("pending");
      const id = request.body?.follow?.id;
      expect(UUID.test(id ?? "")).toBe(true);
      const accept = await api(owner, "POST", "/me/follow-requests/" + id + "/accept");
      check(accept, 200, "Accept follow");
      expect(accept.body?.follow?.status).toBe("accepted");
    }
    check(await api(actor, "GET", "/posts/" + c.postId), 200, "Follower post access");

    // Create a dedicated root comment. No existing user content is touched.
    const root = await api(actor, "POST", "/posts/" + c.postId + "/comments", {
      body: "STEP11 notification test: dedicated root comment",
    });
    if (UUID.test(root.body?.comment?.id ?? "")) rootCommentId = root.body.comment.id;
    check(root, 201, "Create root comment");
    expect(UUID.test(rootCommentId ?? "")).toBe(true);

    // Capture notification baselines after follow and root-comment notifications.
    const actorBefore = new Set((await inbox(actor)).map(n => n.id));
    const ownerBefore = new Set((await inbox(owner)).map(n => n.id));
    const actorUnreadBefore = await count(actor);
    const ownerUnreadBefore = await count(owner);

    // Owner B replies to A's comment: A gets one comment_reply; B gets nothing.
    const reply = await api(owner, "POST", "/posts/" + c.postId + "/comments", {
      body: "STEP11 notification test: response from post owner",
      replyToCommentId: rootCommentId,
    });
    if (UUID.test(reply.body?.comment?.id ?? "")) replyId = reply.body.comment.id;
    check(reply, 201, "Create reply");
    expect(UUID.test(replyId ?? "")).toBe(true);

    // Owner B likes A's root comment: A gets one comment_like.
    const rootLikePath = "/posts/" + c.postId + "/comments/" + rootCommentId;
    const bLikeBaseline = await api(owner, "GET", rootLikePath + "/likes");
    check(bLikeBaseline, 200, "Root comment like baseline");
    expect(bLikeBaseline.body?.likedByMe).toBe(false);
    const like = await api(owner, "PUT", rootLikePath + "/like");
    ownerLikedRoot = like.status === 204;
    check(like, 204, "Owner likes actor comment");

    const actorNew = added(await inbox(actor), actorBefore);
    expect(actorNew.filter(n => n.type === "comment_reply").length).toBe(1);
    expect(actorNew.filter(n => n.type === "comment_like").length).toBe(1);
    expect(actorNew.length, "Only two new notifications for actor A").toBe(2);
    expect(await count(actor)).toBe(actorUnreadBefore + 2);
    expect(added(await inbox(owner), ownerBefore).length,
      "Owner B must not receive notification for own reply").toBe(0);
    expect(await count(owner)).toBe(ownerUnreadBefore);

    // A likes their OWN root comment: must not generate a notification.
    const aLikeBaseline = await api(actor, "GET", rootLikePath + "/likes");
    check(aLikeBaseline, 200, "Own-comment like baseline");
    expect(aLikeBaseline.body?.likedByMe).toBe(false);
    const ownLike = await api(actor, "PUT", rootLikePath + "/like");
    actorLikedRoot = ownLike.status === 204;
    check(ownLike, 204, "Actor likes own comment");

    // B likes their OWN reply: also must not generate a notification.
    const replyLikePath = "/posts/" + c.postId + "/comments/" + replyId;
    const ownReplyLike = await api(owner, "PUT", replyLikePath + "/like");
    ownerLikedReply = ownReplyLike.status === 204;
    check(ownReplyLike, 204, "Owner likes own reply");

    expect(added(await inbox(actor), actorBefore).length).toBe(2);
    expect(await count(actor)).toBe(actorUnreadBefore + 2);
    expect(added(await inbox(owner), ownerBefore).length).toBe(0);
    expect(await count(owner)).toBe(ownerUnreadBefore);
  } catch (err) {
    failures.push(err);
  } finally {
    const base = "/posts/" + c.postId + "/comments/";
    if (ownerLikedReply && replyId) {
      try { check(await api(owner, "DELETE", base + replyId + "/like"), 204, "Undo own reply like"); }
      catch (err) { failures.push(err); }
    }
    if (actorLikedRoot && rootCommentId) {
      try { check(await api(actor, "DELETE", base + rootCommentId + "/like"), 204, "Undo self comment like"); }
      catch (err) { failures.push(err); }
    }
    if (ownerLikedRoot && rootCommentId) {
      try { check(await api(owner, "DELETE", base + rootCommentId + "/like"), 204, "Undo cross-user comment like"); }
      catch (err) { failures.push(err); }
    }
    if (replyId) {
      try { check(await api(owner, "DELETE", base + replyId), 204, "Soft-delete reply"); }
      catch (err) { failures.push(err); }
    }
    if (rootCommentId) {
      try { check(await api(actor, "DELETE", base + rootCommentId), 204, "Soft-delete root"); }
      catch (err) { failures.push(err); }
    }
    if (createdFollow) {
      try { check(await api(actor, "DELETE", "/users/" + c.ownerId + "/follow"), 204, "Undo new follow"); }
      catch (err) { failures.push(err); }
    }
    await Promise.allSettled([actorContext.close(), ownerContext.close()]);
  }
  if (failures.length) {
    throw new AggregateError(failures,
      "Reply/comment-like test or cleanup failed; inspect dedicated fixtures");
  }
});
