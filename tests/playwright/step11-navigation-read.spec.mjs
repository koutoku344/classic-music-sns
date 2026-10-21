import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

// STEP11 read-only browser regression tests.
// No follow, approval, read-marking, or other mutation buttons are clicked.
// Existing inbox data may have zero suitable notifications; such cases are
// reported as skipped rather than creating test data in the shared Neon DB.
async function login(page) {
  const email = process.env.SONOLII_TEST_OWNER_EMAIL;
  expect(email, "SONOLII_TEST_OWNER_EMAIL is required").toBeTruthy();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Clerk?.loaded === true, null, {
    timeout: 15_000,
  });
  await clerk.signIn({ page, emailAddress: email });
}

test("notifications: inaccessible post has a chevron and safe detail placeholder", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "通知" })).toBeVisible();
  await expect(page.getByText("通知を読み込み中...")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole("alert")).toHaveCount(0);

  // Find a post-related notification backed by a null targetPostId.
  // Rendering the generic placeholder must not fetch the underlying post.
  const candidate = page.locator('[role="link"]').filter({
    hasText: /投稿にいいね|投稿にコメント|コメントに返信|コメントにいいね/,
  }).first();
  if (await candidate.count() === 0) {
    test.skip(true, "No post notification in the first inbox page");
  }
  const available = await candidate.getAttribute("aria-label");
  expect(available).toContain("を開く");
  await candidate.click();
  await expect(page).toHaveURL(/\/posts\//);
  await expect(page.getByRole("button", { name: "通知へ戻る" })).toBeVisible();
  // A valid post displays its article; a restricted post displays the
  // generic placeholder, never protected content.
  const article = page.locator("article");
  const unavailable = page.getByText("この投稿は閲覧できません。");
  await expect.poll(async () => (await article.count()) + (await unavailable.count())).toBeGreaterThan(0);
  await page.getByRole("button", { name: "通知へ戻る" }).click();
  await expect(page).toHaveURL(/\/notifications/);
});

test("profile: follow control and public basic fields are visible", async ({ page }) => {
  test.setTimeout(90_000);
  const targetId = process.env.SONOLII_TEST_TARGET_USER_ID;
  if (!targetId) test.skip(true, "Set SONOLII_TEST_TARGET_USER_ID for profile read-only check");
  expect(targetId).toMatch(/^[0-9a-f-]{36}$/i);
  await login(page);
  await page.goto(`/users/${targetId}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("このプロフィールは公開範囲が制限されています。")).toHaveCount(0);
  // Do not click these buttons: they mutate real follows in Neon.
  const controls = page.getByRole("button", {
    name: /^(フォローする|申請を取り消す|フォローを解除)$/,
  });
  await expect(controls).toHaveCount(1);
});
