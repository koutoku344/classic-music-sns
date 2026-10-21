import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

// API-writing test for the current PRE-RELEASE environment only.
// Run this SPECIFIC file explicitly. Never run against the released production system.
const API_URL = "https://sonolii-api.g57cydy6ks.workers.dev";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function settings() {
  const e = process.env;
  expect(!e.CI || /^(false|0)$/i.test(e.CI), "CI writes are forbidden").toBeTruthy();
  expect(e.SONOLII_TEST_PHASE, "Pre-release only").toBe("PRE_RELEASE");
  expect(e.SONOLII_TEST_WRITE_CONFIRM, "Explicit writes approval required")
    .toBe("I_CONFIRM_TEST_WRITES");
  expect((e.SONOLII_TEST_API_URL ?? "").replace(/\/$/, ""), "API URL guard")
    .toBe(API_URL);
  expect(e.SONOLII_TEST_ACTOR_EMAIL, "Actor email required").toBeTruthy();
  expect(e.SONOLII_TEST_OWNER_EMAIL, "Owner email required").toBeTruthy();
  expect(e.SONOLII_TEST_ACTOR_EMAIL).not.toBe(e.SONOLII_TEST_OWNER_EMAIL);
  expect(UUID.test(e.SONOLII_TEST_OWNER_ID ?? ""), "Owner UUID required").toBeTruthy();
  expect(UUID.test(e.SONOLII_TEST_POST_ID ?? ""), "Post UUID required").toBeTruthy();

  return {
    ownerId: e.SONOLII_TEST_OWNER_ID,
    postId: e.SONOLII_TEST_POST_ID,
    actorEmail: e.SONOLII_TEST_ACTOR_EMAIL,
    ownerEmail: e.SONOLII_TEST_OWNER_EMAIL,
  };
}

async function signIn(page, email) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Clerk?.loaded === true, null, {
    timeout: 15_000,
  });
  await clerk.signIn({ page, emailAddress: email });
  await page.waitForFunction(() => Boolean(window.Clerk?.session), null, {
    timeout: 15_000,
  });
}

// Use the real browser Clerk SDK for a fresh, origin-bound JWT each request.
// Do not return JWTs, cookies, or secret keys to the Node test process.
async function api(page, method, path, data) {
  return page.evaluate(async ({ apiUrl, method, path, data }) => {
    const token = await window.Clerk.session?.getToken({ skipCache: true });
    if (!token) throw new Error("Clerk session token not available");
    const headers = { Authorization: `Bearer ${token}` };
    if (data !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(apiUrl + path, {
      method,
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    const raw = await response.text();
    return { status: response.status, body: raw ? JSON.parse(raw) : null };
  }, { apiUrl: API_URL, method, path, data });
}

function status(result, expected, label) {
  expect(result.status, `${label}: HTTP ${result.status}`).toBe(expected);
}

test("STEP11 accepted follower can comment and like (pre-release writes)", async ({ browser }) => {
  test.setTimeout(180_000);
  const c = settings(); // Check guards BEFORE any network call.
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

    // Read-only fixture checks MUST finish before mutations.
    const actorSelf = await api(actor, "GET", "/me/profile");
    status(actorSelf, 200, "Actor identity");
    const actorId = actorSelf.body?.profile?.user_id;
    expect(UUID.test(actorId ?? ""), "Actor profile UUID required").toBeTruthy();
    expect(actorId, "Actor must differ from owner").not.toBe(c.ownerId);

    const ownerSelf = await api(owner, "GET", "/me/profile");
    status(ownerSelf, 200, "Owner identity");
    expect(ownerSelf.body?.profile?.user_id, "Owner identity mismatch")
      .toBe(c.ownerId);

    const ownerProfile = await api(owner, "GET", "/profiles/" + c.ownerId);
    status(ownerProfile, 200, "Owner profile");
    expect(ownerProfile.body?.profile?.visibility).toBe("followers");

    const post = await api(owner, "GET", "/posts/" + c.postId);
    status(post, 200, "Test post");
    expect(post.body?.post?.user_id).toBe(c.ownerId);
    expect(post.body?.post?.comments_enabled).toBe(true);

    const prior = await api(actor, "GET", "/users/" + c.ownerId + "/follow");
    status(prior, 200, "Follow baseline");
    expect([null, "accepted"]).toContain(prior.body?.status);
    // Caution: rejected follows can appear as null; use clean test fixtures.

    if (prior.body.status === null) {
      const request = await api(actor, "PUT", "/users/" + c.ownerId + "/follow");
      status(request, 200, "Follow request");
      addedFollow = request.body?.follow?.changed === true;
      expect(addedFollow, "Follow state was changed concurrently").toBe(true);
      expect(request.body?.follow?.status).toBe("pending");
      const followId = request.body?.follow?.id;
      expect(UUID.test(followId ?? "")).toBe(true);
      const accepted = await api(owner, "POST",
        "/me/follow-requests/" + followId + "/accept");
      status(accepted, 200, "Approve follow");
      expect(accepted.body?.follow?.status).toBe("accepted");
    }

    const visible = await api(actor, "GET", "/posts/" + c.postId);
    status(visible, 200, "Follower post visibility");

    const likeBefore = await api(actor, "GET",
      "/posts/" + c.postId + "/likes");
    status(likeBefore, 200, "Like baseline");
    expect(typeof likeBefore.body?.likedByMe).toBe("boolean");

    const comment = await api(actor, "POST",
      "/posts/" + c.postId + "/comments",
      { body: "STEP11 Playwright pre-release integration test comment" });
    if (UUID.test(comment.body?.comment?.id ?? "")) {
      commentId = comment.body.comment.id;
    }
    status(comment, 201, "Create comment");
    expect(UUID.test(commentId ?? "")).toBe(true);

    const comments = await api(actor, "GET",
      "/posts/" + c.postId + "/comments?limit=50");
    status(comments, 200, "List comments");
    expect(comments.body?.comments?.some(row =>
      row.id === commentId && row.user_id === actorId && row.deleted_at === null
    ), "New comment should be in first page").toBe(true);

    if (!likeBefore.body.likedByMe) {
      const liked = await api(actor, "PUT",
        "/posts/" + c.postId + "/like");
      addedLike = liked.status === 204;
      status(liked, 204, "Like post");
    }
    const likeAfter = await api(actor, "GET",
      "/posts/" + c.postId + "/likes");
    status(likeAfter, 200, "Verify like");
    expect(likeAfter.body?.likedByMe).toBe(true);
  } catch (error) {
    failures.push(error);
  } finally {
    // Clean up only entities created in this run, in reverse order.
    if (addedLike) {
      try {
        status(await api(actor, "DELETE",
          "/posts/" + c.postId + "/like"), 204, "Undo test like");
      } catch (error) { failures.push(error); }
    }
    if (commentId) {
      try {
        status(await api(actor, "DELETE",
          "/posts/" + c.postId + "/comments/" + commentId),
        204, "Soft-delete test comment");
      } catch (error) { failures.push(error); }
    }
    if (addedFollow) {
      try {
        status(await api(actor, "DELETE",
          "/users/" + c.ownerId + "/follow"), 204, "Undo test follow");
      } catch (error) { failures.push(error); }
    }
    await Promise.allSettled([actorContext.close(), ownerContext.close()]);
  }
  if (failures.length) {
    throw new AggregateError(failures,
      "STEP11 Playwright test/cleanup failed; inspect test fixture data");
  }
});
