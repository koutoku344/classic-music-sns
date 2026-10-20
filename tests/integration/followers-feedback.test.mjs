import test from "node:test";
import assert from "node:assert/strict";

// Pre-release-only integration test. Current deployment may become production later.
// Refuses CI, requires an explicit manual opt-in and exact current API endpoint.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function settings() {
  const e = process.env;

  assert.notEqual(e.CI, "true", "Writing API test must not run in CI");
  assert.equal(
    e.SONOLII_TEST_PHASE,
    "PRE_RELEASE",
    "Set SONOLII_TEST_PHASE=PRE_RELEASE only before public release"
  );
  assert.equal(
    e.SONOLII_TEST_WRITE_CONFIRM,
    "I_CONFIRM_TEST_WRITES",
    "Explicit opt-in required: SONOLII_TEST_WRITE_CONFIRM=I_CONFIRM_TEST_WRITES"
  );

  const expectedUrl = "https://sonolii-api.g57cydy6ks.workers.dev";
  assert.equal(
    (e.SONOLII_TEST_API_URL ?? "").replace(/\/$/, ""),
    expectedUrl,
    "Only the current pre-release Sonolii API URL is supported"
  );
  assert.ok(e.SONOLII_TEST_ACTOR_TOKEN && e.SONOLII_TEST_OWNER_TOKEN);
  assert.notEqual(e.SONOLII_TEST_ACTOR_TOKEN, e.SONOLII_TEST_OWNER_TOKEN);
  assert.ok(UUID.test(e.SONOLII_TEST_OWNER_ID ?? ""), "Invalid owner UUID");
  assert.ok(UUID.test(e.SONOLII_TEST_POST_ID ?? ""), "Invalid test post UUID");

  return {
    base: expectedUrl,
    actor: e.SONOLII_TEST_ACTOR_TOKEN,
    owner: e.SONOLII_TEST_OWNER_TOKEN,
    ownerId: e.SONOLII_TEST_OWNER_ID,
    postId: e.SONOLII_TEST_POST_ID,
  };
}

async function api(c, token, method, path, data) {
  const headers = { Authorization: "Bearer " + token };
  if (data !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(c.base + path, {
    method, headers,
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function status(result, code, label) {
  assert.equal(result.status, code, label + " failed: " + JSON.stringify(result));
}

test("STEP11 accepted follower can post comments and likes", async () => {
  // Validate all test-only settings before making any network request.
  const c = settings();
  const A = c.actor, B = c.owner, uid = c.ownerId, pid = c.postId;
  const owner = await api(c, B, "GET", "/profiles/" + uid);
  status(owner, 200, "Owner profile");
  assert.equal(owner.body?.profile?.visibility, "followers");
  const post = await api(c, B, "GET", "/posts/" + pid);
  status(post, 200, "Fixture post");
  assert.equal(post.body?.post?.user_id, uid, "Test post must belong to B");
  assert.equal(post.body?.post?.comments_enabled, true);
  const prior = await api(c, A, "GET", "/users/" + uid + "/follow");
  status(prior, 200, "Follow status");
  assert.ok(prior.body?.status === null || prior.body?.status === "accepted",
    "Refuse to modify pending or unexpected existing follow state");

  let addedFollow = false;
  let commentId = null;
  let addedLike = false;
  let cleanupFailure = null;
  try {
    if (prior.body.status === null) {
      const request = await api(c, A, "PUT", "/users/" + uid + "/follow");
      status(request, 200, "Request follow");
      assert.equal(request.body?.follow?.status, "pending");
      // If the write succeeded but a later assertion fails, still undo this relation.
      addedFollow = true;
      const fid = request.body?.follow?.id;
      assert.ok(UUID.test(fid ?? ""));
      const accepted = await api(c, B, "POST", "/me/follow-requests/" + fid + "/accept");
      status(accepted, 200, "Approve follow");
      assert.equal(accepted.body?.follow?.status, "accepted");
    }
    const visible = await api(c, A, "GET", "/posts/" + pid);
    status(visible, 200, "Accepted follower post access");

    const likeBefore = await api(c, A, "GET", "/posts/" + pid + "/likes");
    status(likeBefore, 200, "Like baseline");
    assert.equal(typeof likeBefore.body?.likedByMe, "boolean");

    const comment = await api(c, A, "POST", "/posts/" + pid + "/comments",
      { body: "STEP11-T pre-release automatic test comment" });
    status(comment, 201, "Create comment");
    commentId = comment.body?.comment?.id;
    assert.ok(UUID.test(commentId ?? ""));
    const comments = await api(c, A, "GET", "/posts/" + pid + "/comments?limit=50");
    status(comments, 200, "List comments");
    assert.ok(JSON.stringify(comments.body).includes(commentId), "Comment not found in first page");

    if (!likeBefore.body.likedByMe) {
      const liked = await api(c, A, "PUT", "/posts/" + pid + "/like");
      status(liked, 204, "Add like");
      addedLike = true;
    }
    const likeAfter = await api(c, A, "GET", "/posts/" + pid + "/likes");
    status(likeAfter, 200, "Check like");
    assert.equal(likeAfter.body?.likedByMe, true);
  } finally {
    // Never touch existing comments, likes, or already-accepted follows.
    if (addedLike) {
      try { status(await api(c, A, "DELETE", "/posts/" + pid + "/like"), 204, "Undo like"); }
      catch (error) { cleanupFailure ??= error; }
    }
    if (commentId) {
      try {
        status(await api(c, A, "DELETE", "/posts/" + pid + "/comments/" + commentId),
          204, "Delete test comment");
      } catch (error) { cleanupFailure ??= error; }
    }
    if (addedFollow) {
      try {
        status(await api(c, A, "DELETE", "/users/" + uid + "/follow"),
          204, "Undo test follow");
      } catch (error) { cleanupFailure ??= error; }
    }
    if (cleanupFailure) throw cleanupFailure;
  }
});
