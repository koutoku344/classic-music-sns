import test from "node:test";
import assert from "node:assert/strict";
import { createClerkClient } from "@clerk/backend";

// Pre-release-only integration test. Current deployment may become production later.
// Refuses CI, requires an explicit manual opt-in and exact current API endpoint.
// Use dedicated test accounts/post, with no concurrent UI or test activity.
// GET follow hides rejected relations as null: verify the fixture has no rejected
// relation before running. Cleanup cannot restore that hidden prior state.
// Comment deletion is soft deletion; follow notifications may also remain.
// A lost write response can leave data behind: inspect fixtures after any failure.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function settings() {
  const e = process.env;

  assert.ok(
    !e.CI || /^(false|0)$/i.test(e.CI),
    "Writing API test must not run in CI"
  );
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
  assert.ok(e.CLERK_SECRET_KEY, "Set CLERK_SECRET_KEY locally; never commit it");
  assert.ok(
    /^sess_[A-Za-z0-9]+$/.test(e.SONOLII_TEST_ACTOR_SESSION_ID ?? ""),
    "Set SONOLII_TEST_ACTOR_SESSION_ID to the actor's active Clerk session ID"
  );
  assert.ok(
    /^sess_[A-Za-z0-9]+$/.test(e.SONOLII_TEST_OWNER_SESSION_ID ?? ""),
    "Set SONOLII_TEST_OWNER_SESSION_ID to the owner's active Clerk session ID"
  );
  assert.notEqual(
    e.SONOLII_TEST_ACTOR_SESSION_ID,
    e.SONOLII_TEST_OWNER_SESSION_ID,
    "Actor and owner must use different sessions"
  );
  assert.ok(UUID.test(e.SONOLII_TEST_OWNER_ID ?? ""), "Invalid owner UUID");
  assert.ok(UUID.test(e.SONOLII_TEST_POST_ID ?? ""), "Invalid test post UUID");

  return {
    base: expectedUrl,
    actorSessionId: e.SONOLII_TEST_ACTOR_SESSION_ID,
    ownerSessionId: e.SONOLII_TEST_OWNER_SESSION_ID,
    clerk: createClerkClient({ secretKey: e.CLERK_SECRET_KEY }),
    ownerId: e.SONOLII_TEST_OWNER_ID,
    postId: e.SONOLII_TEST_POST_ID,
  };
}

// Mint a new short-lived Clerk session JWT immediately before EVERY API call.
// Never log or persist Clerk secret keys, session tokens, or session IDs.
async function api(c, sessionId, method, path, data) {
  const session = await c.clerk.sessions.getSession(sessionId);
  assert.equal(session.status, "active", "Test Clerk session is not active");

  const sessionToken = await c.clerk.sessions.getToken(sessionId);
  const jwt = sessionToken.jwt;
  assert.ok(jwt, "Clerk did not return a session JWT");

  const headers = { Authorization: "Bearer " + jwt };
  if (data !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(c.base + path, {
    method,
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function status(result, code, label) {
  assert.equal(result.status, code, label + " failed (HTTP " + result.status + ")");
}

test("STEP11 accepted follower can post comments and likes", async () => {
  // Validate all test-only settings before making any network request.
  const c = settings();
  const A = c.actorSessionId, B = c.ownerSessionId, uid = c.ownerId, pid = c.postId;
  // Verify token identities through the authenticated endpoint, before writes.
  const actorSelf = await api(c, A, "GET", "/me/profile");
  status(actorSelf, 200, "Actor identity");
  const actorId = actorSelf.body?.profile?.user_id;
  assert.ok(UUID.test(actorId ?? ""), "Actor test profile required");
  assert.notEqual(actorId, uid, "Actor and owner must be different users");
  const ownerSelf = await api(c, B, "GET", "/me/profile");
  status(ownerSelf, 200, "Owner identity");
  assert.equal(ownerSelf.body?.profile?.user_id, uid, "Owner token/UUID mismatch");

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
  const failures = [];
  try {
    if (prior.body.status === null) {
      const request = await api(c, A, "PUT", "/users/" + uid + "/follow");
      status(request, 200, "Request follow");
      // Only undo a relation this request actually changed.
      addedFollow = request.body?.follow?.changed === true;
      assert.ok(addedFollow, "Fixture changed concurrently; inspect follow state");
      assert.equal(request.body?.follow?.status, "pending");
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
    // Capture a valid returned ID before assertions so cleanup can still run.
    if (UUID.test(comment.body?.comment?.id ?? "")) {
      commentId = comment.body.comment.id;
    }
    status(comment, 201, "Create comment");
    assert.ok(UUID.test(commentId ?? ""));
    const comments = await api(c, A, "GET", "/posts/" + pid + "/comments?limit=50");
    status(comments, 200, "List comments");
    assert.ok(
      comments.body?.comments?.some(row =>
        row.id === commentId && row.user_id === actorId && row.deleted_at === null
      ),
      "Test comment not found in first page"
    );

    if (!likeBefore.body.likedByMe) {
      const liked = await api(c, A, "PUT", "/posts/" + pid + "/like");
      status(liked, 204, "Add like");
      addedLike = true;
    }
    const likeAfter = await api(c, A, "GET", "/posts/" + pid + "/likes");
    status(likeAfter, 200, "Check like");
    assert.equal(likeAfter.body?.likedByMe, true);
  } catch (error) {
    failures.push(error);
  } finally {
    // Never touch existing comments, likes, or already-accepted follows.
    if (addedLike) {
      try { status(await api(c, A, "DELETE", "/posts/" + pid + "/like"), 204, "Undo like"); }
      catch (error) { failures.push(error); }
    }
    if (commentId) {
      try {
        status(await api(c, A, "DELETE", "/posts/" + pid + "/comments/" + commentId),
          204, "Delete test comment");
      } catch (error) { failures.push(error); }
    }
    if (addedFollow) {
      try {
        status(await api(c, A, "DELETE", "/users/" + uid + "/follow"),
          204, "Undo test follow");
      } catch (error) { failures.push(error); }
    }
    if (failures.length) {
      throw new AggregateError(failures, "Follow feedback test or cleanup failed; inspect test fixtures");
    }
  }
});
