import base from './playwright.config.js';
import {devices} from '@playwright/test';
export default {...base,testMatch:'lwvd*.spec.js',outputDir:'test-results/lwvd-webkit',projects:[{name:'iphone-webkit',use:{...devices['iPhone 13']}}]};
