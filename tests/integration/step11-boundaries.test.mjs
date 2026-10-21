import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("daily notification cleanup is scheduled without an HTTP delete endpoint", () => {
  const config = read("backend/wrangler.jsonc");
  const worker = read("backend/src/index.ts");
  const notifications = read("backend/src/notifications.ts");
  assert.match(config, /"0 3 \* \* \*"/);
  assert.match(worker, /async scheduled\(/);
  assert.match(worker, /cleanupExpiredNotifications\(sql\)/);
  assert.match(notifications, /read_at < now\(\) - INTERVAL '30 days'/);
  assert.match(notifications, /FOR UPDATE SKIP LOCKED/);
  assert.match(notifications, /LIMIT \$\{BATCH_SIZE\}/);
  assert.doesNotMatch(notifications, /path === "\/cleanup"/);
});

test("only the notification recipient receives a live follow request action", () => {
  const source = read("backend/src/notifications.ts");
  assert.match(source, /n\.type = 'follow_request'/);
  assert.match(source, /f\.status = 'pending'/);
  assert.match(source, /f\.followee_id = \$\{userId\}::uuid/);
  assert.match(source, /f\.follower_id = n\.actor_user_id/);
});

test("post IDs remain withheld when the viewer cannot read the post", () => {
  const source = read("backend/src/notifications.ts");
  assert.match(source, /THEN p\.id ELSE NULL END AS target_post_id/);
  assert.match(source, /owner_pr\.visibility = 'followers'/);
  assert.match(source, /pf\.status = 'accepted'/);
  assert.match(source, /p\.user_id = \$\{userId\}::uuid/);
});

test("profile basics are public without granting access to protected posts", () => {
  const profile = read("backend/src/index.ts");
  assert.match(profile, /bio: row\.bio/);
  assert.match(profile, /instruments: row\.instruments/);
  assert.match(profile, /restricted: true/);
  const posts = read("features/sonolii/screens/UserProfile.tsx");
  assert.match(posts, /profile\.restricted/);
  assert.match(posts, /setPosts\(\[\]\)/);
});
