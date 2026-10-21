# STEP11 Playwright follow / comment / like API test

Last updated: 2026-10-21

## Summary

- For the current PRE-RELEASE Sonolii Worker and Neon test data only. Never execute against the post-launch production environment.
- The test signs in actor A and owner B through Clerk Playwright browser authentication, then obtains fresh JWTs using window.Clerk.session.getToken() for each API call.
- Backend, SQL, existing Neon data, and Worker deployment are unchanged by adding this test file.
- A and B use independent browser contexts.

## Obtain the latest code

```bash
cd ~/classic-music-sns
git switch feat/step11-follow-notifications
git pull origin feat/step11-follow-notifications
node --check tests/playwright/followers-feedback.spec.mjs
```

## Configuration

Set the same CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, SONOLII_TEST_ACTOR_EMAIL, SONOLII_TEST_OWNER_EMAIL as for the already successful Clerk authentication test. Keep secret values out of chats, GitHub, logs and shell history.

```bash
export SONOLII_TEST_PHASE=PRE_RELEASE
export SONOLII_TEST_WRITE_CONFIRM=I_CONFIRM_TEST_WRITES
export SONOLII_TEST_API_URL=https://sonolii-api.g57cydy6ks.workers.dev
export SONOLII_TEST_OWNER_ID='Owner B Sonolii UUID'
export SONOLII_TEST_POST_ID='Owner B test post UUID'
```

Account B must have visibility=followers and own a comments-enabled post. Account A and B must be different. Follow state must initially be null or accepted; rejected follow can appear as null. Use clean dedicated fixtures, and do not run concurrent UI operations on these accounts.

## Execution

Read-only authentication check:

```bash
npm run test:playwright:auth
```

Explicit API-writing test (follow request, approval, comment, like):

```bash
npm run test:playwright:follow
```

Tests refuse to run in CI or without explicit pre-release confirmation. The environment flags alone cannot detect an actual public launch; disable this test when releasing the existing Worker as production.

Only test-created follow/like/comment resources are cleaned up, and comment deletion is soft deletion. Notifications and tombstones may remain. Lost responses or interrupted runs can leave test records behind; inspect fixture data on failure. No bulk deletes.

## Cleanup shell secrets

```bash
unset SONOLII_TEST_PHASE SONOLII_TEST_WRITE_CONFIRM SONOLII_TEST_API_URL
unset SONOLII_TEST_OWNER_ID SONOLII_TEST_POST_ID
unset CLERK_SECRET_KEY CLERK_PUBLISHABLE_KEY
unset SONOLII_TEST_ACTOR_EMAIL SONOLII_TEST_OWNER_EMAIL
```

## Next

Once writing checks pass, finish STEP11-3-3 and proceed to notifications API.
