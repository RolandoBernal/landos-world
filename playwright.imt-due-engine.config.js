import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',testMatch:['imt-due-engine.spec.js','imt-phase-1a.spec.js','imt-derived-status.spec.js','imt-record-asset.spec.js'],
  timeout:30000,workers:1,outputDir:'test-results/imt-due-engine',
  use:{baseURL:'http://Rolandos-MacBook-Air.local:8000',serviceWorkers:'block',trace:'retain-on-failure'},
  projects:[{name:'mobile-chromium',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}},{name:'iphone-webkit',use:{...devices['iPhone 13']}}],
});
