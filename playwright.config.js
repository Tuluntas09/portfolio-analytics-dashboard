import { defineConfig, devices } from "@playwright/test";

// The Vite dev server URL — matches npm run dev configuration.
const DEV_URL = "http://127.0.0.1:8502";

export default defineConfig({
  testDir: "./tests/e2e",

  // Each test gets up to 60 s. Generous timeout for Vite dev-server cold-start
  // and React mount latency, particularly in CI where the server starts fresh.
  timeout: 60_000,

  // Assertion timeout — generous to account for Vite dev-server and React mount latency.
  expect: { timeout: 15_000 },

  // Run tests sequentially to avoid port contention and reduce noise.
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  outputDir: "test-results",

  use: {
    baseURL: DEV_URL,
    headless: true,
    // Capture a screenshot only when a test fails for easier debugging.
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start the Vite dev server automatically if it is not already running.
  // reuseExistingServer: true — avoids a second server if the user already
  // has `npm run dev` running in another terminal.
  webServer: {
    command: "npm run dev",
    url: DEV_URL,
    reuseExistingServer: true,
    timeout: 30_000,
    stdout: "ignore",
    stderr: "ignore",
  },
});
