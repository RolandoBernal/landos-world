import config from './playwright.config.js';
import { devices } from '@playwright/test';
export default { ...config, webServer: undefined, projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'webkit', use: { ...devices['iPhone 13'] } },
] };
