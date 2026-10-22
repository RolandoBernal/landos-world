import { test } from '@playwright/test';
import assert from 'node:assert/strict';
test('LWVD Sprint 1 onboarding, navigation, persistence and responsive Home', async ({ page }) => {
await page.setViewportSize({width:390,height:844});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const url='/violet-dineros/index.html';
await page.goto(url); await page.getByLabel('What’s your first name?').fill('Max'); await page.getByRole('button',{name:'Continue'}).click();
await page.getByLabel('Your money ($)').fill('428.00'); await page.getByRole('button',{name:'Continue'}).click();
const payday=new Date();payday.setDate(payday.getDate()+8);const iso=`${payday.getFullYear()}-${String(payday.getMonth()+1).padStart(2,'0')}-${String(payday.getDate()).padStart(2,'0')}`;
await page.getByLabel('Next payday (optional)').fill(iso);await page.getByRole('button',{name:'Continue',exact:true}).click();
await page.getByRole('heading',{name:'You’re all set!'}).waitFor();
await page.getByRole('button',{name:'Go to My Dashboard'}).click();
await page.getByRole('heading',{name:'Hey, Max!'}).waitFor(); assert.match(await page.locator('.guide').innerText(),/53\.50/);
await page.reload();await page.getByRole('heading',{name:'Hey, Max!'}).waitFor();
for(const name of ['Activity','Goals','Insights','Home']){await page.getByRole('button',{name,exact:true}).click(); assert.equal(await page.locator('nav [aria-current]').innerText(),await page.getByRole('button',{name,exact:true}).innerText());}
await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('First name', {exact:true}).fill('Levi');await page.getByLabel('Pay frequency (optional)').selectOption('monthly');await page.getByRole('button',{name:'Save settings'}).click();await page.reload();await page.getByRole('heading',{name:'Hey, Levi!'}).waitFor();
for(const width of [320,375,390,430,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
await page.setViewportSize({width:390,height:844});
await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Next payday',{exact:true}).fill('');await page.getByRole('button',{name:'Save settings'}).click();assert.equal(await page.locator('.guide').count(),0);await page.getByRole('button',{name:'Set payday'}).waitFor();
assert.deepEqual(errors,[]);console.log('PASS: onboarding, arithmetic, reload, personalization, four tabs, settings, missing payday, 5 viewport widths; no JS errors');});
