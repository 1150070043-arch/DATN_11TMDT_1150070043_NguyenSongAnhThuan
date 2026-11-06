import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs', testMatch: 'security-business.spec.ts',
  workers: 1, fullyParallel: false, retries: 0,
  timeout: 30_000, expect: { timeout: 10_000 },
  outputDir: '../../reports/security-business/artifacts',
  reporter: [['list'], ['json', { outputFile: '../../reports/generated/security-business-results.json' }]],
  use: { browserName: 'chromium', locale: 'vi-VN', trace: 'off', screenshot: 'only-on-failure' },
  // Avoid raw credential-bearing response bodies in Playwright traces.
  webServer: {
    command: 'node ../../scripts/security-demo-server.mjs', url: 'http://localhost:5500',
    reuseExistingServer: !process.env.CI, timeout: 15_000
  }
});
