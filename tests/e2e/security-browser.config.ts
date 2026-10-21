import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./specs", testMatch: "security-browser.spec.ts", workers: 1, fullyParallel: false,
  timeout: 30_000, expect: { timeout: 8_000 },
  outputDir: "../../reports/security-browser/artifacts",
  reporter: [["list"], ["json", { outputFile: "../../reports/generated/security-browser-results.json" }]],
  use: { browserName: "chromium", trace: "retain-on-failure", screenshot: "only-on-failure" }
});
