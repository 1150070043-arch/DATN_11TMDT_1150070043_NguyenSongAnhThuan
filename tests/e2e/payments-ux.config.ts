import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./specs", testMatch: "payment-ux.spec.ts",
  outputDir: "../../reports/payments/ux/artifacts", workers: 1, timeout: 30_000,
  reporter: [["list"], ["json", { outputFile: "../../reports/payments/ux-results.json" }]],
  use: { baseURL: "http://127.0.0.1:5184", browserName: "chromium", locale: "vi-VN", screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "npm run dev:secure --workspace @bookguard/web -- --port 5184 --strictPort", cwd: "../..", url: "http://127.0.0.1:5184", reuseExistingServer: false, timeout: 60_000 }
});
