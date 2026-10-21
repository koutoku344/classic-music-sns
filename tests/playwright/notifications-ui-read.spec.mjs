import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

// Read-only smoke test. Does not mark notifications read or mutate the database.
// Run AFTER deploying both the enriched backend and the notification frontend.
test("STEP11 notification UI loads real inbox without sample people", async ({ page }) => {
  test.setTimeout(90_000);
  const email = process.env.SONOLII_TEST_OWNER_EMAIL;
  expect(email, "Set SONOLII_TEST_OWNER_EMAIL").toBeTruthy();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Clerk?.loaded === true, null, { timeout: 15_000 });
  await clerk.signIn({ page, emailAddress: email });
  await page.goto("/notifications", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "通知" })).toBeVisible();
  await expect(page.getByText(/^未読 \d+件$/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("通知を読み込み中...")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);

  // Only API-backed notifications should be rendered (never old demo sample names).
  // The account may have zero notifications, which is an acceptable empty state.
  await expect(page.getByText("山田 美咲")).toHaveCount(0);
  await expect(page.getByText("佐藤 健一")).toHaveCount(0);
  await expect(page.getByText("鈴木 由紀")).toHaveCount(0);
});
