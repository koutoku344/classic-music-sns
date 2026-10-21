import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/playwright",
  fullyParallel: false,
  workers: 1,
  reporter: "list",

  use: {
    baseURL: "https://sonolii-web.g57cydy6ks.workers.dev",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "clerk-setup",
      testMatch: /clerk\.setup\.mjs/,
    },
    {
      name: "chromium",
      testMatch: /\.spec\.mjs$/,
      dependencies: ["clerk-setup"],
    },
  ],
});
