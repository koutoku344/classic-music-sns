import { test as setup } from "@playwright/test";
import { clerkSetup } from "@clerk/testing/playwright";

setup("Prepare Clerk testing", async () => {
  await clerkSetup();
});
