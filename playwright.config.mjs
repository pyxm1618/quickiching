import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR
  ?? join(tmpdir(), "iching-playwright-results");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.mjs",
  outputDir,
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["line"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
