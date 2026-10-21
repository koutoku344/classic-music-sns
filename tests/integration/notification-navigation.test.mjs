import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const load = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("notification rows use a single action target per type", () => {
  const source = load("features/sonolii/screens/Notifications.tsx");
  assert.ok(source.includes("navigate('userProfile', { id: item.actorId, from: 'notifications' })"));
  assert.ok(source.includes("navigate('postDetail', { id: item.targetPostId, from: 'notifications' })"));
  assert.ok(!source.includes(">投稿を見る</button>"));
  assert.ok(!source.includes(">プロフィールを見る</button>"));
  assert.ok(source.includes("event.stopPropagation(); void markRead(item);"));
});

test("notification-origin return routes are preserved", () => {
  assert.ok(load("features/sonolii/screens/PostDetail.tsx").includes("fromNotifications ? 'notifications'"));
  assert.ok(load("features/sonolii/screens/UserProfile.tsx").includes("fromNotifications ? 'notifications'"));
  assert.ok(load("app/_components/RouteScreen.tsx").includes('params?.from === "notifications"'));
});

test("deleted comment does not suppress accessible post navigation", () => {
  const backend = load("backend/src/notifications.ts");
  assert.ok(backend.includes("THEN p.id ELSE NULL END AS target_post_id"));
  assert.ok(!backend.includes("comment.deleted_at IS NULL"));
  assert.ok(backend.includes("owner_pr.visibility = 'public'"));
  assert.ok(backend.includes("owner_pr.visibility = 'followers'"));
  assert.ok(backend.includes("p.user_id = ${userId}::uuid"));
});

test("unavailable notifications have no repetitive detail warning", () => {
  const ui = load("features/sonolii/screens/Notifications.tsx");
  assert.ok(!ui.includes("現在、この通知の詳細は閲覧できません"));
  assert.ok(ui.includes("actionable && <ChevronRight"));
});
