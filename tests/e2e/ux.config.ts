import { defineConfig } from "@playwright/test";

// Fixture-based UX regressions are separate from real SQL/security experiment evidence.
export default defineConfig({
  testDir: "./specs",
  testMatch: "ux-regressions.spec.ts",
  outputDir: "../../reports/ux/artifacts",
  workers: 1,
  timeout: 30_000,
  reporter: [["list"], ["html", { outputFolder: "../../reports/ux/html", open: "never" }], ["json", { outputFile: "../../reports/ux/results.json" }]],
  use: { baseURL: "http://127.0.0.1:5184", browserName: "chromium", hasTouch: true, locale: "vi-VN", screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "npm run dev:secure --workspace @bookguard/web -- --port 5184 --strictPort", cwd: "../..", url: "http://127.0.0.1:5184", reuseExistingServer: false, timeout: 60_000 }
});
