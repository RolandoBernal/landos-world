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

test('manual actions blend into page and Total Carbs border is inset in both calculator contexts', async ({ page }, testInfo) => {
  await open(page);
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => window.LandosTheme.setPreference(theme), theme);
    for (const context of ['standalone', 'entry']) {
      await page.setViewportSize({ width: 390, height: 844 });
      if (context === 'standalone') await root(page).getByRole('button', {name:'Carb Calc',exact:true}).click();
      else {
        await root(page).getByRole('button', {name:'Log Entry',exact:true}).click();
        await root(page).locator('[name="type"]').selectOption('Snacks');
        await root(page).locator('[data-action="open-carb-calculator"]').click();
      }
      await root(page).getByRole('button', {name:'+ Add Manual Amount...'}).click();
      const actions=root(page).locator('.lee_lee_diabetes_carb_item_editor_actions');
      await expect(actions).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
      await expect(actions.getByRole('button')).toHaveText(['Cancel','Add Item']);
      await root(page).locator('[name="carbItemCarbs"]').fill('12.5');
      await actions.scrollIntoViewIfNeeded();
      await page.screenshot({path:testInfo.outputPath(`manual-${context}-${theme}.png`)});
      await actions.getByRole('button',{name:'Add Item',exact:true}).click();
      const total=root(page).locator('[data-carb-calculator-selection] > .lee_lee_diabetes_carb_calc_sum');
      for (const width of [320,390]) {
        await page.setViewportSize({width,height:844});
        await total.scrollIntoViewIfNeeded();
        const inset=await total.evaluate(node=>{const r=node.getBoundingClientRect(),p=node.parentElement.getBoundingClientRect(),s=getComputedStyle(node);return {left:r.left-p.left,right:p.right-r.right,border:s.borderLeftWidth,radius:s.borderTopLeftRadius,overflow:document.documentElement.scrollWidth>innerWidth};});
        expect(inset.left).toBeGreaterThanOrEqual(5);
        expect(inset.right).toBeGreaterThanOrEqual(5);
        expect(inset.border).toBe('2px');expect(inset.radius).toBe('20px');expect(inset.overflow).toBe(false);
      }
      await page.screenshot({path:testInfo.outputPath(`total-${context}-${theme}.png`)});
      if(context==='standalone') await root(page).getByRole('button',{name:'Done',exact:true}).click();
      else {
        await root(page).getByRole('button',{name:'Cancel Carb Calculator',exact:true}).click();
        await root(page).locator('[data-lee-lee-editor] [data-action="cancel"]').click();
      }
    }
  }
});

test('Favorite checkbox and label fully clear the Food footer with and without keyboard', async ({page},testInfo)=>{
  await open(page);
  await root(page).getByRole('button',{name:'Foods',exact:true}).click();
  for(const theme of ['dark','light']) {
    await page.evaluate(theme=>window.LandosTheme.setPreference(theme),theme);
    for(const width of [320,390]) {
      await page.setViewportSize({width,height:844});
      await root(page).getByRole('button',{name:'+ Add New Food',exact:true}).click();
      const panel=root(page).locator('[data-food-library-editor-dialog]');
      const favorite=panel.locator('.lee_lee_diabetes_checkline');
      for(const keyboard of [false,true]) {
        if(keyboard) await page.evaluate(()=>{
          Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>330});
          Object.defineProperty(window.visualViewport,'offsetTop',{configurable:true,get:()=>40});
          window.visualViewport.dispatchEvent(new Event('resize'));
        });
        await page.waitForTimeout(50);
        await favorite.locator('input').focus();
        await panel.locator('[data-food-library-fields]').evaluate(node=>node.scrollTop=node.scrollHeight);
        const boxes=await favorite.evaluate(node=>{const r=node.getBoundingClientRect(),c=node.querySelector('input').getBoundingClientRect(),p=node.parentElement.getBoundingClientRect(),f=node.closest('[data-food-library-editor]').querySelector('.lee_lee_diabetes_food_editor_actions').getBoundingClientRect();return {top:r.top,bottom:r.bottom,checkboxBottom:c.bottom,scrollTop:p.top,scrollBottom:p.bottom,footerTop:f.top};});
        expect(boxes.top).toBeGreaterThanOrEqual(boxes.scrollTop);
        expect(boxes.bottom).toBeLessThanOrEqual(boxes.scrollBottom);
        expect(boxes.checkboxBottom).toBeLessThanOrEqual(boxes.footerTop-5);
        if(width===390) await page.screenshot({path:testInfo.outputPath(`favorite-${theme}-${keyboard?'keyboard':'full'}.png`)});
        if(keyboard) await page.evaluate(()=>{delete window.visualViewport.height;delete window.visualViewport.offsetTop;window.visualViewport.dispatchEvent(new Event('resize'));});
      }
      await panel.getByRole('button',{name:'Cancel',exact:true}).click();
    }
  }
});
