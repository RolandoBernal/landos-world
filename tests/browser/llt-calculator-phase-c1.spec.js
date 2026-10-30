import { expect, test } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';

let server;
let baseURL;
const key = 'lando-world:lee-lees-tracker:v1';
const timerKey = 'lando-world:lee-lees-tracker:pre-meal-timer:v1';
test.beforeAll(async () => {
  server = createIPhoneDevServer({ bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' }, getMetadata: async () => ({ environment: 'local-device', appVersion: '1.0.0', branch: 'feature/llt-shared-carb-calculator', commit: 'test', commitFull: 'test', dirty: true, sourceId: 'foods-switcher-test' }) });
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
  await page.waitForFunction(() => Boolean(window.LeeLeeTrackerStorage));
  return remote;
}



const root = page => page.locator('#lee-lee-diabetes-root');
const foodId = '11111111-1111-4111-8111-111111111111';
const mealName = 'Cub Meal w/chow mein noodles + orange chicken';
async function seed(page) {
  await open(page);
  await page.evaluate(({ foodId, mealName }) => window.LeeLeeTrackerStorage.updateTrackerData(current => ({ ...current,
    foodLibrary: [...current.foodLibrary,
      { id: foodId, name: 'Office snack', carbs: 10, servingLabel: '1 portion', sourceType: 'user', favorite: true, lastUsedAt: '2026-10-13T12:00:00Z' },
    ],
    savedMeals: [{ id: '22222222-2222-4222-8222-222222222222', name: mealName, favorite: true, totalCarbs: 999, components: [
      { componentType: 'food', foodId, nameSnapshot: 'Noodles', quantity: 2, carbsPerServing: 20, carbTotal: 40 },
      { componentType: 'manual', nameSnapshot: 'Chicken', carbTotal: 28 },
    ] }],
  })), { foodId, mealName });
}
async function enter(page, context) {
  if (context === 'standalone') {
    await root(page).getByRole('button', { name: 'Foods', exact: true }).click();
    await root(page).getByRole('button', { name: 'Carb Calc', exact: true }).click();
  } else {
    await root(page).getByRole('button', { name: 'Log Entry', exact: true }).click();
    await root(page).locator('[name="type"]').selectOption('Snacks');
    await root(page).locator('[name="notes"]').fill('Keep entry note');
    await root(page).locator('[data-action="open-carb-calculator"]').click();
  }
}
async function stored(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); }
async function manual(page, carbs, qty = '1') {
  await root(page).getByRole('button', { name: '+ Add Manual Amount...' }).click();
  await root(page).locator('[name="carbItemCarbs"]').fill(carbs);
  await root(page).locator('[name="carbItemQty"]').fill(qty);
  await root(page).getByRole('button', { name: 'Add Item', exact: true }).click();
}



async function mockKeyboard(page, height, offsetTop = 0) {
  await page.evaluate(({ height, offsetTop }) => {
    const listeners = window.__c1ViewportListeners ||= {};
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: {
      width: innerWidth, height, offsetTop, offsetLeft: 0, scale: 1,
      addEventListener(type, fn) { (listeners[type] ||= new Set()).add(fn); },
      removeEventListener(type, fn) { listeners[type]?.delete(fn); },
    } });
    dispatchEvent(new Event('resize'));
    listeners.resize?.forEach(fn => fn(new Event('resize')));
  }, { height, offsetTop });
}
for (const context of ['standalone', 'entry']) {
  test(`${context}: outside activation dismisses shortcuts on the first tap without losing the intended action`, async ({ page }, info) => {
    await seed(page); await enter(page, context);
    const calc = root(page).locator('[data-carb-calculator]');
    const query = calc.locator('[name="carbFoodSearch"]');
    const favorites = calc.getByRole('button', { name: 'Favorites', exact: true });
    const recent = calc.getByRole('button', { name: 'Recent', exact: true });
    await favorites.click(); await expect(favorites).toHaveAttribute('aria-expanded','true');
    await page.screenshot({ path: info.outputPath('favorites-open.png') });
    const original = await query.elementHandle();
    await query.click(); await expect(favorites).toHaveAttribute('aria-expanded','false');
    await expect(query).toBeFocused(); expect(await query.evaluate((n,o)=>n===o,original)).toBe(true);
    await page.screenshot({ path: info.outputPath('favorites-dismissed.png') });
    await query.fill('Office'); await calc.getByRole('button', { name: /^Add Office snack / }).click();
    await expect(calc.locator('[data-carb-calculator-total]')).toHaveText('10 g');
    await recent.click(); await page.screenshot({ path: info.outputPath('recent-open.png') });
    await calc.getByRole('heading', { name: 'Selected Items' }).click();
    await expect(recent).toHaveAttribute('aria-expanded','false');
    await page.screenshot({ path: info.outputPath('recent-dismissed.png') });
    await favorites.click(); await calc.locator('.lee_lee_diabetes_carb_intro h3').click();
    await expect(favorites).toHaveAttribute('aria-expanded','false');
    await recent.click(); await calc.getByRole('button', { name: '+ Add Manual Amount...' }).click();
    await expect(calc.locator('[data-carb-item-editor]')).toBeVisible();
    await calc.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(recent).toHaveAttribute('aria-expanded','false');
    await favorites.click(); await calc.getByRole('button', { name: 'Edit Office snack', exact: true }).click();
    await expect(calc.getByRole('heading', { name: 'Edit Food Item' })).toBeVisible();
    await calc.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(favorites).toHaveAttribute('aria-expanded','false');
    await favorites.click(); await calc.getByRole('button', { name: 'Remove Office snack', exact: true }).click();
    await expect(favorites).toHaveAttribute('aria-expanded','false');
    await expect(calc.locator('[data-carb-calculator-row]')).toHaveCount(0);
    expect((await stored(page)).records).toHaveLength(0);
    // A library creation form is an intermediate editor, not the result panel.
    await page.evaluate(()=>window.LeeLeeTrackerStorage.updateTrackerData(d=>({...d,foodLibrary:d.foodLibrary.map(f=>({...f,favorite:false})),savedMeals:d.savedMeals.map(m=>({...m,favorite:false}))})));
    await favorites.click();
    await calc.getByRole('button',{name:'+ Add New Food',exact:true}).click();
    const foodName=calc.getByLabel('Food Name',{exact:true});
    await foodName.fill('Unfinished library draft');
    await calc.getByRole('heading',{name:'Selected Items'}).click();
    await expect(foodName).toHaveValue('Unfinished library draft');
    await calc.locator('[data-action="cancel-carb-food-editor"]').click();
    expect((await stored(page)).foodLibrary.some(f=>f.name==='Unfinished library draft')).toBe(false);
  });

  test(`${context}: internal stars and scrolling preserve the panel, while selection adds only once`, async ({ page }) => {
    await seed(page);
    await page.evaluate(() => window.LeeLeeTrackerStorage.updateTrackerData(current => ({ ...current, foodLibrary: [...current.foodLibrary, ...Array.from({length:35},(_,i)=>({ id:`44444444-4444-4444-8444-${String(i).padStart(12,'0')}`,name:`Scrolling item ${i}`,carbs:1,favorite:true,lastUsedAt:'2026-10-15T12:00:00Z' }))] })));
    await enter(page, context); await page.setViewportSize({width:390,height:740});
    const calc = root(page).locator('[data-carb-calculator]');
    const favorites = calc.getByRole('button', { name: 'Favorites', exact: true });
    const recent = calc.getByRole('button', { name: 'Recent', exact: true });
    await favorites.click(); await favorites.click(); await expect(favorites).toHaveAttribute('aria-expanded','false');
    await recent.click(); await recent.click(); await expect(recent).toHaveAttribute('aria-expanded','false');
    await favorites.click(); await recent.click(); await expect(favorites).toHaveAttribute('aria-expanded','false');
    await favorites.click(); await expect(recent).toHaveAttribute('aria-expanded','false');
    const list=calc.locator('[data-carb-library-list]');
    await list.locator(`[data-id="${foodId}"][data-action="toggle-food-favorite"]`).click();
    await expect(favorites).toHaveAttribute('aria-expanded','true');
    await expect(calc.locator('[data-carb-calculator-row]')).toHaveCount(0);
    expect((await stored(page)).foodLibrary.find(f=>f.id===foodId).favorite).toBe(false);
    await list.evaluate(node => { node.scrollTop += 180; node.dispatchEvent(new Event('scroll')); });
    await expect.poll(()=>list.evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
    await expect(favorites).toHaveAttribute('aria-expanded','true');
    await list.dispatchEvent('pointerdown',{pointerId:88,clientX:80,clientY:300,pointerType:'touch'});
    await list.dispatchEvent('pointermove',{pointerId:88,clientX:80,clientY:200,pointerType:'touch'});
    await list.dispatchEvent('pointerup',{pointerId:88,clientX:80,clientY:200,pointerType:'touch'});
    const outside=calc.locator('.lee_lee_diabetes_carb_intro');
    await outside.evaluate(() => window.scrollBy(0,140));
    await expect(favorites).toHaveAttribute('aria-expanded','true');
    await outside.dispatchEvent('click',{detail:1});
    await expect(favorites).toHaveAttribute('aria-expanded','true');
    // A surrounding swipe also must not become an outside tap, even if a browser emits a trailing click.
    await outside.dispatchEvent('pointerdown',{pointerId:89,clientX:80,clientY:300,pointerType:'touch'});
    await outside.dispatchEvent('pointermove',{pointerId:89,clientX:80,clientY:240,pointerType:'touch'});
    await outside.dispatchEvent('pointerup',{pointerId:89,clientX:80,clientY:240,pointerType:'touch'});
    await outside.dispatchEvent('click',{detail:1});
    await expect(favorites).toHaveAttribute('aria-expanded','true');
    await recent.click(); await list.getByRole('button',{name:/Office snack 10 g carbs/}).click();
    await expect(recent).toHaveAttribute('aria-expanded','false');
    await expect(calc.locator('[data-carb-calculator-row]')).toHaveCount(1);
    await expect(calc.locator('[data-carb-calculator-total]')).toHaveText('10 g');
    await favorites.click();
    // Keyboard focus to search is supported without remounting it.
    await calc.locator('[name="carbFoodSearch"]').focus();
    await expect(favorites).toHaveAttribute('aria-expanded','false');
  });

  test(`${context}: shared spacing and container-specific centering survive short and keyboard viewports`, async ({page},info)=>{
    await seed(page); await enter(page,context);
    const calc=root(page).locator('[data-carb-calculator]');
    await calc.getByRole('button',{name:'+ Add Manual Amount...'}).click();
    const carbs=calc.locator('[name="carbItemCarbs"]'); const qty=calc.locator('[name="carbItemQty"]');
    await expect(qty).toHaveValue('1'); await carbs.fill('27.55'); await qty.fill('2');
    await expect(calc.locator('[data-carb-item-preview]')).toHaveText('55.1 g');
    for(const theme of ['light','dark']) {
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
    for(const width of [320,390,430,768,1280]) {
      await page.setViewportSize({width,height:900});
      const m=await calc.evaluate(n=>{
        const body=n.querySelector('[data-carb-item-editor-body]');const form=n.querySelector('[data-carb-item-editor]');const header=n.querySelector('.lee_lee_diabetes_carb_calculator_header');const actions=n.querySelector('.lee_lee_diabetes_carb_item_editor_actions');
        const b=body.getBoundingClientRect(),f=form.getBoundingClientRect(),h=header.getBoundingClientRect(),a=actions.getBoundingClientRect();
        return {bodyTop:b.top,bodyBottom:b.bottom,formTop:f.top,formBottom:f.bottom,headerBottom:h.bottom,headerRight:h.right,titleRight:header.querySelector('h2').getBoundingClientRect().right,actionsTop:a.top,padding:parseFloat(getComputedStyle(body).paddingTop),gap:parseFloat(getComputedStyle(form).gap),center:getComputedStyle(body).alignContent,overflow:document.documentElement.scrollWidth>innerWidth};
      });
      expect(m.padding).toBeCloseTo(m.gap,1); expect(m.padding).toBeGreaterThanOrEqual(12);
      expect(m.formTop-m.headerBottom).toBeGreaterThanOrEqual(m.padding-1);
      expect(m.formBottom).toBeLessThanOrEqual(m.actionsTop+1);expect(m.overflow).toBe(false);expect(m.titleRight).toBeLessThanOrEqual(m.headerRight+1);
      expect(m.center).toBe('start');expect(m.formTop-m.bodyTop).toBeCloseTo(m.padding,1);
    }
    }
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:info.outputPath('manual-keyboard-closed.png')});
    await page.setViewportSize({width:390,height:430});
    await qty.focus();
    await qty.scrollIntoViewIfNeeded();
    await expect(qty).toBeInViewport();
    await page.screenshot({path:info.outputPath('manual-keyboard-sized.png')});
    await page.setViewportSize({width:844,height:320});
    await expect(calc.locator('[data-carb-item-editor-body]')).toHaveCSS('overflow-y','visible');
    await qty.fill('0');await expect(calc.getByRole('button',{name:'Add Item',exact:true})).toBeDisabled();
    await qty.fill('2');await calc.getByRole('button',{name:'Add Item',exact:true}).click();
    await expect(calc.locator('[data-carb-calculator-total]')).toHaveText('55.1 g');
    expect((await stored(page)).records).toHaveLength(0);
    if(context==='entry') {await calc.locator('[data-action="use-carb-calculator-total"]').click();await expect(root(page).locator('[name="notes"]')).toHaveValue('Keep entry note');expect((await stored(page)).records).toHaveLength(0);}
  });
}
