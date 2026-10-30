import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  testMatch: /llt-(dose-quantity|startup-scroll|scroll-top|history-favorite|final-visual|stage2|shared-carb-calculator|calculator-unified-search|calculator-phase-c1|calculator-phase-c|foods-navigation|issue-20)\.spec\.js/,
  timeout: 45000,
  workers: 2,
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } },
  ],
});
