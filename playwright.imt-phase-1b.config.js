import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',testMatch:'imt-phase-1*.spec.js',timeout:30000,workers:1,
  outputDir:'./test-results/imt-phase-1b',
  use:{baseURL:'http://127.0.0.1:8876',serviceWorkers:'block',trace:'retain-on-failure'},
  webServer:{command:'python3 -m http.server 8876 --bind 127.0.0.1',url:'http://127.0.0.1:8876',reuseExistingServer:false,stdout:'ignore',stderr:'ignore'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}},{name:'iphone-webkit',use:{...devices['iPhone 13']}}]
});
