import { defineConfig, devices } from '@playwright/test';

// Browser engine/device emulation, never physical phone or provider evidence.
export default defineConfig({
  testDir: './specs', testMatch: 'mobile-journey.spec.ts', workers: 1, timeout: 30_000,
  outputDir: '../../reports/mobile-ux/artifacts',
  reporter: [['list'], ['html', { outputFolder: '../../reports/mobile-ux/html', open: 'never' }], ['json', { outputFile: '../../reports/mobile-ux/results.json' }]],
  use: { baseURL: 'http://127.0.0.1:5184', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', reducedMotion: 'reduce', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium-small-320', use: { browserName: 'chromium', viewport: { width: 320, height: 740 }, hasTouch: true, isMobile: true } },
    { name: 'chromium-android-emulation', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'webkit-iphone-emulation', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'firefox-keyboard', use: { browserName: 'firefox', viewport: { width: 1280, height: 800 } } }
  ],
  webServer: { command: 'npm run dev:secure --workspace @bookguard/web -- --port 5184 --strictPort', cwd: '../..', url: 'http://127.0.0.1:5184', reuseExistingServer: false, timeout: 60_000 }
});
