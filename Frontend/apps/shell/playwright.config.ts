import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.artifacts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: "line",
  use: {
    baseURL: process.env.FUSION_E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
});
