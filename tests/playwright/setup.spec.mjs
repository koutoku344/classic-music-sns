import { test, expect } from "@playwright/test";

test("Playwrightのセットアップ確認", async ({ page }) => {
  await page.setContent(`
    <html>
      <body>
        <h1>Sonolii Playwright Test</h1>
      </body>
    </html>
  `);

  await expect(
    page.getByRole("heading", {
      name: "Sonolii Playwright Test",
    })
  ).toBeVisible();
});
