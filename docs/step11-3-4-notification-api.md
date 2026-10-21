# STEP11-3-4 Notification API — implementation and test plan

Status: GitHub code written; not deployed, not executed against Neon (2026-10-21).

## What changed

- backend/src/notifications.ts: new recipient-scoped notification inbox API.
- backend/src/index.ts: route /me/notifications endpoints through existing Clerk authentication and Neon user mapping.
- tests/playwright/notifications-read.spec.mjs: read-only smoke test using the already successful Clerk Playwright login.
- No SQL migration needed for these read/update endpoints. Uses notifications table created by migration 019.

## Endpoints

| Method | Path | Response |
| --- | --- | --- |
| GET | /me/notifications?limit=20&cursor=... | {notifications:[{id,type,createdAt,readAt}],nextCursor} |
| GET | /me/notifications/unread-count | {unreadCount:number} |
| POST | /me/notifications/:id/read | 204 (idempotent when recipient owns an existing notification) |
| POST | /me/notifications/read-all | 204 |

- All endpoints require verified Clerk JWT. DB queries only read or update the recipient's own notifications; IDs for other users are indistinguishable from nonexistent ones (404).
- The inbox returns minimal metadata to avoid disclosing post contents, restricted media, actor/profile information, linked IDs, and private comments. UI detail navigation requires a later visibility-aware design.
- List supports limit 1..50, newest first, (created_at,id) keyset cursor. Read notifications older than 30 days are excluded from the list, but physical deletion is **not yet implemented**.
- POST :id/read and read-all set read_at once. Future reads leave the original read_at unchanged, so retention duration does not reset.
- Current follow SQL (020) creates follow/follow_request/follow_accepted notifications. Notifications for comments and likes still require event-generation implementation in a subsequent step.

## Review and local checks (no DB writes)

```bash
cd ~/classic-music-sns
git switch feat/step11-follow-notifications
git pull origin feat/step11-follow-notifications
npx tsc --noEmit
node --check tests/playwright/notifications-read.spec.mjs
```

Review type-check results. If no errors, user may deploy the Backend with their established deployment workflow. Do not run SQL migrations for this notification inbox change.

After successful Backend deployment, run a read-only browser-auth smoke test:

```bash
npx playwright test notifications-read.spec.mjs
```

This uses existing CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, SONOLII_TEST_OWNER_EMAIL. Before deployment, the test is expected to fail with a 404 because the routes are not yet present.

## Manual write checks (ONLY after authorizing execution)

- Verify at least one existing own notification ID in GET /me/notifications.
- POST /me/notifications/:id/read with its own ID: 204, and unread-count should decrease by one if it was unread.
- Re-POST the same ID: 204, read_at unchanged.
- POST on another user's notification ID: 404 and must not change that row.
- POST /me/notifications/read-all: 204 and unread-count 0.
- Run pagination cases limit=1, invalid cursor, and unauthenticated access.

## Remaining work

1. Comment/like notification creation, deduplication, and privacy-aware event design.
2. Retention job: physical deletion 30 days from read_at (unread retained); review operations scheduling separately.
3. Notification UI and safe navigation targets, with fresh authorization checks for any referenced posts/comments.

Warning: Existing pre-release Worker becomes production on launch. Stop write tests against that Worker before release.
