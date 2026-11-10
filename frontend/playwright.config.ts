import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.TEST_WEB_URL || "http://127.0.0.1:5173",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: "list",
  outputDir: process.env.TEST_ARTIFACT_DIR || "test-results",
});
