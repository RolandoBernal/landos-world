import { expect, test } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';

let server;
let baseURL;
const key = 'lando-world:lee-lees-tracker:v1';
const timerKey = 'lando-world:lee-lees-tracker:pre-meal-timer:v1';
test.beforeAll(async () => {
  server = createIPhoneDevServer({ bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' }, getMetadata: async () => ({ environment: 'local-device', appVersion: '1.0.0', branch: 'feature/llt-low-glucose-episodes', commit: 'test', commitFull: 'test', dirty: true, sourceId: 'low-glucose-test' }) });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)); });

async function open(page, seed = []) {
  const remote = [];
  page.on('request', request => { if (/supabase\.co|deployment-version\.json/.test(request.url())) remote.push(request.url()); });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.addInitScript(({ key, seed }) => { localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, records: seed, settings: { glucoseTargetMin: 70, glucoseTargetMax: 180 }, insulinPlans: [], foodLibrary: [], savedMeals: [], metadata: {} })); }, { key, seed });
  await page.goto(`${baseURL}/#/lee-lees-tracker`);
  await expect(page.locator('#lws-local-dev-badge')).toHaveText('LOCAL DEV');
  return remote;
}


for (const theme of ['dark', 'light']) {
 test(`entry readability ${theme}`, async ({ page }, info) => {
  const now = new Date().toISOString();
  const seed = ['Breakfast','Snacks','Correction','Bedtime'].map((type,i) => ({ id: `synthetic-${i}`, eventType:'check-insulin', type, bloodSugar:124, mealCarbs:i < 2 ? 20 : null, rawCarbDose:i < 2 ? 20/12 : null, administeredInsulinUnits:i === 0 ? 0 : 3, suggestedCarbDoseUnits:i < 2 ? 1.5 : null, suggestedCorrectionUnits:i === 0 ? 2 : (i === 1 ? 0 : null), recordTimestamp:now, createdAt:now, updatedAt:now, notes:'Synthetic readability check' }));
  await open(page, seed);
  await page.setViewportSize({width:320,height:740});
  await page.evaluate(theme => window.LandosTheme.setPreference(theme),theme);
  const before = await page.evaluate(key => localStorage.getItem(key),key);
  for (const view of ['today','history']) {
   if(view === 'history') {
    await page.locator('[data-action="history"]').click();
    await page.locator('[data-action="history-date"]').first().click();
   }
   const cards=page.locator(`.lee_lee_diabetes_timeline_item--${view}`);
   await expect(cards).toHaveCount(4);
   for (const type of ['Breakfast','Snacks']) {
    const card=cards.filter({has:page.locator('.lee_lee_diabetes_timeline_type',{hasText:type})});
    const coverage=card.locator('.lee_lee_diabetes_timeline_notes').filter({hasText:'Suggested carb coverage:'});
    await expect(coverage).toHaveText('Suggested carb coverage: ≈ 1.67 units');
    expect(await coverage.evaluate(n=>n.previousElementSibling.textContent)).toBe('20 g carbs');
    expect(await coverage.evaluate(n=>n.previousElementSibling.getBoundingClientRect().bottom <= n.getBoundingClientRect().top)).toBe(true);
   }
   await expect(cards.locator('.lee_lee_diabetes_insulin_given')).toHaveCount(4);
   for(const given of await cards.locator('.lee_lee_diabetes_insulin_given').all()) {
    const style = await given.evaluate(n=>({weight:getComputedStyle(n).fontWeight,color:getComputedStyle(n).color,primary:getComputedStyle(n.closest('.lee_lee_diabetes_shell')).getPropertyValue('--lee-lee-text').trim()}));
    expect(style.weight).toBe('400');
    expect(style.color).toBe(theme === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(28, 28, 30)');
   }
   for(const type of ['Breakfast','Snacks']) {
    const card=cards.filter({has:page.locator('.lee_lee_diabetes_timeline_type',{hasText:type})});
    const breakdown=card.locator('.lee_lee_diabetes_timeline_notes').filter({hasText:'Dose breakdown:'});
    await expect(breakdown).toHaveText(`Dose breakdown: 1.5 units carbs + ${type === 'Breakfast' ? 2 : 0} units correction`);
    expect(await breakdown.evaluate(n=>getComputedStyle(n).color)).toBe(theme === 'dark' ? 'rgb(161, 161, 166)' : 'rgb(99, 99, 102)');
    expect(await breakdown.evaluate(n=>Boolean(n.previousElementSibling.querySelector('.lee_lee_diabetes_insulin_given')))).toBe(true);
   }
   for(const type of ['Correction','Bedtime']) await expect(cards.filter({has:page.locator('.lee_lee_diabetes_timeline_type',{hasText:type})})).not.toContainText('Dose breakdown:');
   expect(await cards.evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth))).toBe(true);
   await page.screenshot({path:info.outputPath(`${view}-${theme}.png`),fullPage:true});
  }
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(before);
 });
}

test('saved rounding and temporary adjustment are displayed without recalculation', async ({page}) => {
 const now=new Date().toISOString();
 await open(page,[{id:'saved-adjustment',eventType:'check-insulin',type:'Dinner',bloodSugar:120,mealCarbs:71,rawCarbDose:71/12,suggestedCarbDoseUnits:5.5,suggestedCorrectionUnits:2,administeredInsulinUnits:9,suggestedTotalUnits:8,doseCalculationStatus:'calculated',rawAggregateDose:7.92,roundedBaseDose:7.5,temporaryEatingAdjustmentApplied:true,temporaryEatingAdjustmentUnits:0.5,recordTimestamp:now,createdAt:now,updatedAt:now}]);
 for(const view of ['today','history']) {
  if(view==='history'){await page.locator('[data-action="history"]').click();await page.locator('[data-action="history-date"]').first().click();}
  const card=page.locator(`.lee_lee_diabetes_timeline_item--${view}`);
  await expect(card).toContainText('Dose breakdown: 5.5 units carbs + 2 units correction · Before rounding: 7.92 units → 7.5 units rounded · Temporary eating adjustment: +0.5 units');
  await expect(card).toContainText('Given: 9 units · Suggested: 8 units');
 }
});
