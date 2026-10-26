import base from './playwright.config.js';
import {devices} from '@playwright/test';
export default {...base,testMatch:'lwvd*.spec.js',projects:[{name:'chromium',use:{...devices['Desktop Chrome']}},{name:'iphone-webkit',use:{...devices['iPhone 13']}}]};
