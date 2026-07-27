import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: process.env.P4_02_4B_R3_EVIDENCE === "1"
    ? "./artifacts/p4-02.4b-r3/playwright"
    : (process.env.P4_02_4B_R1_EVIDENCE === "1"
      ? "./artifacts/p4-02.4b-r1/playwright"
      : "./artifacts/p4-02.4b/playwright"),
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "p4b-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        video: { mode: "on", size: { width: 1440, height: 900 } },
      },
    },
    {
      name: "p4b-mobile",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        video: { mode: "on", size: { width: 390, height: 844 } },
      },
    },
  ],
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
