# STEP11-3-5-4: Reply / comment-like notifications Playwright test

Status: test code committed; **not executed** against Neon or Workers.

## Tested behavior

- A creates a dedicated comment under B's test post.
- B replies to A's comment; A receives exactly one `comment_reply` notification.
- B likes A's comment; A receives exactly one `comment_like` notification.
- A likes A's own comment; no notification.
- B likes B's own reply; no notification.
- Reconcile new notification IDs and unread counters for both A/B.
- Undo only this test's likes and newly created follow. Soft-delete only test-created comments/reply. Notification records deliberately remain.

## Preconditions

- Current PRE-RELEASE Worker only; never run after launch.
- Dedicated test A and B, B-owned post with comments enabled and B profile `followers`.
- A/B are separate users, no concurrent account activity. Rejected follow status may appear as null: use clean fixtures.
- Authentication environment variables that passed previous Playwright tests: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `SONOLII_TEST_ACTOR_EMAIL`, `SONOLII_TEST_OWNER_EMAIL`.
- Existing writing-test guards: `SONOLII_TEST_PHASE=PRE_RELEASE`, `SONOLII_TEST_WRITE_CONFIRM=I_CONFIRM_TEST_WRITES`, `SONOLII_TEST_API_URL=https://sonolii-api.g57cydy6ks.workers.dev`.
- `SONOLII_TEST_OWNER_ID` and `SONOLII_TEST_POST_ID` as in prior tests. Never commit secrets or add them to shell history.

## Checkout and syntax check

```bash
cd ~/classic-music-sns
git switch feat/step11-follow-notifications
git pull origin feat/step11-follow-notifications
node --check tests/playwright/notifications-reply-likes.spec.mjs
```

## Run (WRITES to Neon)

```bash
npm run test:playwright:notifications-reply
```

Expect two successful Playwright tests: `clerk-setup` and `STEP11 reply, comment like, and self-action notification rules`. This outcome has **not been verified**. No new SQL migrations or Cloudflare deployments are needed: SQL022 and notification inbox API are already in the current pre-release environment.

## Data impact and cautions

The test creates a root comment and a reply (both soft-deleted afterward), three temporary comment likes, and up to one temporary follow relation. Two notifications for A from B's reply and like persist. Root-comment notification for B and follow-request/accepted notifications may also remain. A failed response, browser closure or timeout can leave partial test records; inspect dedicated fixtures rather than bulk-delete records.

Do not invoke `npx playwright test` without a filename: that may execute ALL write tests.
