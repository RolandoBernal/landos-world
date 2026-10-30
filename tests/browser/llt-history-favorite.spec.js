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


const root = page => page.locator('#lee-lee-diabetes-root');

test('History entry cards share Today scroll hiding and final Edit/Delete remain accessible', async ({ page }, testInfo) => {
  const now=Date.now();
  const records=Array.from({length:18},(_,i)=>({id:`synthetic-history-${i}`,eventType:'note',type:'Other',notes:`Synthetic history entry ${i}`,recordTimestamp:new Date(now-i*60000).toISOString(),timestamp:now-i*60000,createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()}));
  await open(page,records);
  await page.setViewportSize({width:390,height:844});
  for(const theme of ['dark','light']) {
    await page.evaluate(theme=>window.LandosTheme.setPreference(theme),theme);
    await root(page).getByRole('button',{name:'History',exact:true}).click();
    await root(page).locator('[data-action="history-date"]').first().click();
    await expect(root(page).locator('[data-action="edit-record"]')).toHaveCount(18);
    const shell=root(page).locator('.lee_lee_diabetes_nav_shell');
    await page.evaluate(()=>scrollTo(0,0));
    await expect(shell).not.toHaveClass(/is-scroll-hidden/);
    await page.evaluate(()=>scrollTo(0,250));
    await expect(shell).toHaveClass(/is-scroll-hidden/);
    await page.waitForTimeout(250);
    expect((await root(page).locator('.lee_lee_diabetes_floating_log').boundingBox()).y).toBeGreaterThan(844);
    await page.evaluate(()=>scrollTo(0,200));
    await expect(shell).not.toHaveClass(/is-scroll-hidden/);
    await page.waitForTimeout(250);
    await page.screenshot({path:testInfo.outputPath(`history-up-${theme}.png`)});
    await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
    await expect(shell).toHaveClass(/is-scroll-hidden/);
    await page.waitForTimeout(250);
    const last=root(page).locator('.lee_lee_diabetes_timeline_item').last();
    for(const action of ['Edit','Delete']) {
      const button=last.getByRole('button',{name:action,exact:true});
      expect(await button.evaluate(node=>{const r=node.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
    }
    await page.screenshot({path:testInfo.outputPath(`history-bottom-${theme}.png`)});
    await page.evaluate(()=>scrollTo(0,0));
    await expect(shell).not.toHaveClass(/is-scroll-hidden/);
  }
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).records.length,key)).toBe(18);
});

test('Favorite moves upward with a compact Brand gap and keeps bottom clearance with keyboard', async ({page},testInfo)=>{
  await open(page);
  await root(page).getByRole('button',{name:'Foods',exact:true}).click();
  for(const theme of ['dark','light']) {
    await page.evaluate(theme=>window.LandosTheme.setPreference(theme),theme);
    for(const width of [320,390]) {
      await page.setViewportSize({width,height:844});
      await root(page).getByRole('button',{name:'+ Add New Food',exact:true}).click();
      const panel=root(page).locator('[data-food-library-editor-dialog]');
      for(const keyboard of [false,true]) {
        if(keyboard) await page.evaluate(()=>{
          Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>330});
          Object.defineProperty(window.visualViewport,'offsetTop',{configurable:true,get:()=>40});
          window.visualViewport.dispatchEvent(new Event('resize'));
        });
        await page.waitForTimeout(50);
        await panel.locator('[data-food-library-fields]').evaluate(n=>n.scrollTop=n.scrollHeight);
        const metrics=await panel.evaluate(node=>{const row=node.querySelector('.lee_lee_diabetes_checkline'),r=row.getBoundingClientRect(),brand=node.querySelector('[name="foodBrand"]').getBoundingClientRect(),scroll=row.parentElement.getBoundingClientRect(),footer=node.querySelector('.lee_lee_diabetes_food_editor_actions').getBoundingClientRect();return {gap:r.top-brand.bottom,top:r.top,bottom:r.bottom,scrollTop:scroll.top,scrollBottom:scroll.bottom,footerTop:footer.top,padding:getComputedStyle(row.parentElement).paddingBottom};});
        expect(metrics.gap).toBeGreaterThanOrEqual(0);expect(metrics.gap).toBeLessThanOrEqual(5);
        expect(metrics.top).toBeGreaterThanOrEqual(metrics.scrollTop);
        expect(metrics.bottom).toBeLessThanOrEqual(metrics.scrollBottom);
        expect(metrics.bottom).toBeLessThanOrEqual(metrics.footerTop-5);
        expect(metrics.padding).toBe('16px');
        const checkbox=panel.locator('[name="foodFavorite"]');
        await checkbox.check();await expect(checkbox).toBeChecked();await checkbox.uncheck();
        if(width===390)await page.screenshot({path:testInfo.outputPath(`favorite-${theme}-${keyboard?'keyboard':'full'}.png`)});
        if(keyboard)await page.evaluate(()=>{delete window.visualViewport.height;delete window.visualViewport.offsetTop;window.visualViewport.dispatchEvent(new Event('resize'));});
      }
      await panel.getByRole('button',{name:'Cancel',exact:true}).click();
    }
  }
});
