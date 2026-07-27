import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3112",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "pnpm exec next dev .tmp/p4-03-e2e-server --hostname 127.0.0.1 --port 3112",
    url: "http://127.0.0.1:3112",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
