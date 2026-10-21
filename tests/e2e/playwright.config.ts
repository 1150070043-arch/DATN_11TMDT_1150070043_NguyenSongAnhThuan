import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./specs",
  testIgnore: ["ux-regressions.spec.ts", "mobile-journey.spec.ts", "security-browser.spec.ts", "payment-ux.spec.ts", "ui-layout.spec.ts"],
  outputDir: "../../reports/playwright/artifacts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "../../reports/playwright/html", open: "never" }],
    ["json", { outputFile: "../../reports/generated/playwright-results.json" }]
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh"
  },
  projects: [
    {
      name: "secure-chromium",
      use: { browserName: "chromium", viewport: { width: 1440, height: 960 } }
    }
  ]
});
