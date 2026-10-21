import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs', testMatch: 'ui-layout.spec.ts', workers: 1, timeout: 30_000,
  outputDir: '../../reports/ui-layout/artifacts',
  reporter: [['list'], ['json', { outputFile: '../../reports/ui-layout/results.json' }]],
  use: { baseURL: 'http://127.0.0.1:5186', locale: 'vi-VN', reducedMotion: 'reduce', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: ['chromium', 'webkit', 'firefox'].map(browserName => ({ name: browserName, use: { browserName: browserName as 'chromium' | 'webkit' | 'firefox' } })),
  webServer: { command: 'npm run dev:secure --workspace @bookguard/web -- --port 5186 --strictPort', cwd: '../..', url: 'http://127.0.0.1:5186', reuseExistingServer: false, timeout: 60_000 }
});
