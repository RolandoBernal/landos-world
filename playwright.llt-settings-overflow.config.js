import config from './playwright.config.js';
import { devices } from '@playwright/test';
export default { ...config, testMatch: 'llt-settings-overflow.spec.js', projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'webkit', use: { ...devices['iPhone 13'] } },
] };
