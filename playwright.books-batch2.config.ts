import { defineConfig, devices } from "@playwright/test";

// Focused P4-04 Batch 2 evidence against the already-running local preview.
// This avoids a second Next.js process sharing the same development cache.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
