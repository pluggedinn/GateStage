import { defineConfig, devices } from "@playwright/test";

const webServer = [
  {
    command: "npm run mock:next",
    url: "http://127.0.0.1:9401/health",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  {
    command: "npm run mock:esphome",
    url: "http://127.0.0.1:9080/health",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  {
    command:
      "ESPHOME_MOCK_FLEET=1 GATESTAGE_GATE_TEST_DURATION_MS=250 GATESTAGE_CONFIG_PATH=./data/e2e-config.json npm run dev:server",
    url: "http://127.0.0.1:8080/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8080",
    trace: "on-first-retry",
  },
  webServer,
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      // Playwright's iPhone 14 Pro profile: 393×660 CSS viewport (Safari chrome
      // subtracted from the 393×852 screen). Chromium so the suite does not
      // need a separate WebKit install.
      name: "mobile",
      use: {
        ...devices["iPhone 14 Pro"],
        browserName: "chromium",
      },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
});
