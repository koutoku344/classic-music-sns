import { test, expect } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

const API_URL =
  "https://sonolii-api.g57cydy6ks.workers.dev";

async function checkAuthentication(page, email) {
  await page.goto("/", {
    waitUntil: "domcontentloaded",
  });

  // ClerkProvider initializes asynchronously; do not attempt sign-in early.
  await page.waitForFunction(
    () => window.Clerk?.loaded === true,
    null,
    { timeout: 15_000 }
  );

  await clerk.signIn({
    page,
    emailAddress: email,
  });

  // Obtain the JWT from the browser's Clerk SDK, including the browser azp.
  const result = await page.evaluate(async (apiUrl) => {
    const token = await window.Clerk.session?.getToken({
      skipCache: true,
    });

    if (!token) {
      throw new Error("Clerk did not return an authenticated session token");
    }

    const response = await fetch(`${apiUrl}/auth-check`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = await response.json();

    return {
      status: response.status,
      authenticated: body.status === "authenticated",
      hasUserId: Boolean(body.clerkUserId),
    };
  }, API_URL);

  expect(result.status).toBe(200);
  expect(result.authenticated).toBe(true);
  expect(result.hasUserId).toBe(true);
}

test("Actor authentication", async ({ page }) => {
  const email = process.env.SONOLII_TEST_ACTOR_EMAIL;

  expect(email).toBeTruthy();
  await checkAuthentication(page, email);
});

test("Owner authentication", async ({ page }) => {
  const email = process.env.SONOLII_TEST_OWNER_EMAIL;

  expect(email).toBeTruthy();
  await checkAuthentication(page, email);
});
