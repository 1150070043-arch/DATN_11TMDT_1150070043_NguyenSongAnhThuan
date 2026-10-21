import { defineConfig, devices } from '@playwright/test';

// Real SQL order lifecycle, restricted to the disposable audit databases.
export default defineConfig({
  testDir: './specs', testMatch: 'customer-order.spec.ts', workers: 1, timeout: 45_000,
  globalSetup: './mobile-commerce.setup.ts', outputDir: '../../reports/mobile-ux/commerce/artifacts',
  reporter: [['list'], ['json', { outputFile: '../../reports/mobile-ux/commerce/results.json' }]],
  use: { baseURL: 'http://localhost:5174', locale: 'vi-VN', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'audit-android-emulation', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'audit-iphone-emulation', use: { ...devices['iPhone 13'], browserName: 'webkit' } }
  ]
});
