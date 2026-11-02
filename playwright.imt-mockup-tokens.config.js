import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  testMatch: ['imt-mockup-tokens.spec.js', 'imt-record-asset.spec.js', 'imt-phase-1a.spec.js'],
  // Earlier visual/nav snapshots intentionally assert pre-port labels and colors.
  grep: /tokens, navigation|protected storage and exact|general Add|component context|existing bicycle/,
  timeout: 30000, workers: 1, outputDir: 'test-results/imt-mockup-tokens',
  use: { baseURL: 'http://Rolandos-MacBook-Air.local:8000', serviceWorkers: 'block', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
  ],
});
