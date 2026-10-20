import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: /llt-(issue-19-1|issues-18-19|calculator-phase-c1|settings-audit-validation)\.spec\.js/,
  // These existing wheel-input tests run separately in Chromium; mobile WebKit has no wheel API.
  grepInvert: /internal stars and scrolling/,
  timeout: 60000,
  use: { ...devices['iPhone 13'], browserName: 'webkit', baseURL: 'http://127.0.0.1:8765', trace: 'retain-on-failure' },
});
