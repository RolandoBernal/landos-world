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
    const outside=root(page).locator('#lee-lee-diabetes-title');
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

  test(`${context}: solid status cover stays fixed through keyboard open, field switches and close`, async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
    await seed(page); await enter(page, context);
    const calc = root(page).locator('[data-carb-calculator]');
    await calc.getByRole('button', { name: '+ Add Manual Amount...' }).click();
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.setProperty('--status-inset', '47px');
      }, theme);
      for (const [field, top, height] of [['carbItemCarbs', 80, 360], ['carbItemQty', 140, 360], ['carbItemLabel', 35, 360], ['carbItemLabel', 0, 844]]) {
        await calc.locator(`[name="${field}"]`).focus();
        await page.evaluate(({ top, height }) => {
          const viewport = window.visualViewport;
          Object.defineProperty(viewport, 'offsetTop', { configurable: true, value: top });
          Object.defineProperty(viewport, 'height', { configurable: true, value: height });
          viewport.dispatchEvent(new Event('resize'));
          viewport.dispatchEvent(new Event('scroll'));
        }, { top, height });
        await expect.poll(() => page.evaluate(() => getComputedStyle(document.body, '::after').top)).toBe('0px');
        const cover = await page.evaluate(() => {
          const style = getComputedStyle(document.body, '::after');
          return { height: style.height, position: style.position, background: style.backgroundImage, color: style.backgroundColor, pointer: style.pointerEvents, blur: style.backdropFilter || style.webkitBackdropFilter, padding: style.paddingBottom, overflow: getComputedStyle(document.querySelector('[data-carb-item-editor-body]')).overflowY };
        });
        expect(cover).toMatchObject({ height: '47px', position: 'fixed', background: 'none', pointer: 'none', blur: 'none', padding: '0px', overflow: 'visible' });
        expect(cover.color).toBe(theme === 'light' ? 'rgb(244, 243, 234)' : 'rgb(23, 25, 35)');
        await expect(calc.locator('[data-modal-scroll-container], [data-modal-visual-viewport]')).toHaveCount(0);
      }
    }
    await calc.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Carb Calculator', exact: true })).toBeVisible();
  });

  test(`${context}: manual amount preserves focused document scrolling like New Entry`, async ({ page }) => {
    await seed(page); await enter(page, context);
    const calc = root(page).locator('[data-carb-calculator]');
    await calc.getByRole('button', { name: '+ Add Manual Amount...' }).click();
    await expect(calc.locator('[data-carb-item-editor]')).toHaveAttribute('data-preserve-document-scroll-on-viewport-pan', '');
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => window.LandosTheme.setPreference(theme), theme);
      await page.setViewportSize({ width: 390, height: 430 });
      for (const name of ['carbItemCarbs', 'carbItemQty', 'carbItemLabel']) {
        await calc.locator(`[name="${name}"]`).focus();
        await page.waitForTimeout(50);
        const result = await page.evaluate(() => {
          const input = document.activeElement;
          const panel = input.closest('[data-carb-item-editor]');
          panel.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 140 }));
          window.scrollTo(0, document.documentElement.scrollHeight);
          const before = window.scrollY;
          visualViewport.dispatchEvent(new Event('scroll'));
          visualViewport.dispatchEvent(new Event('resize'));
          return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve({ before, after: window.scrollY, focused: input === document.activeElement }))));
        });
        expect(result.after).toBe(result.before);
        expect(result.focused).toBe(true);
      }
      await page.evaluate(() => document.activeElement.blur());
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await calc.locator('[name="carbItemCarbs"]').fill('12');
    await calc.locator('[name="carbItemQty"]').fill('2');
    await calc.getByRole('button', { name: 'Add Item', exact: true }).click();
    await expect(calc.locator('[data-carb-calculator-total]')).toHaveText('24 g');
    expect((await stored(page)).records).toHaveLength(0);
  });

  test(`${context}: full-page manual Back, Cancel and Add preserve calculator state`, async ({ page }) => {
    await seed(page); await enter(page, context);
    const calc = root(page).locator('[data-carb-calculator]');
    await manual(page, '10', '2');
    await calc.locator('[name="carbFoodSearch"]').fill('Office');
    for (const exit of ['Back to Carb Calculator', 'Cancel']) {
      await calc.getByRole('button', { name: '+ Add Manual Amount...' }).click();
      await expect(page.getByRole('heading', { name: 'Add Manual Amount', exact: true })).toBeVisible();
      await expect(calc.locator('[data-modal-visual-viewport], [data-modal-scroll-container]')).toHaveCount(0);
      await expect(calc).toHaveCSS('overflow-y', 'visible');
      await calc.locator('[name="carbItemCarbs"]').fill('99');
      await mockKeyboard(page, 360, 80);
      await page.setViewportSize({ width: 390, height: 430 });
      await calc.locator('[name="carbItemLabel"]').focus();
      await calc.locator('[name="carbItemLabel"]').scrollIntoViewIfNeeded();
      await expect(calc.locator('[name="carbItemLabel"]')).toBeInViewport();
      expect(await calc.locator('[data-carb-item-editor-body]').evaluate(n => ({ overflow: getComputedStyle(n).overflowY, scroll: n.scrollTop }))).toEqual({ overflow: 'visible', scroll: 0 });
      await mockKeyboard(page, 844);
      await page.setViewportSize({ width: 390, height: 844 });
      await calc.getByRole('button', { name: exit, exact: true }).click();
      await expect(calc.locator('[data-carb-calculator-total]')).toHaveText('20 g');
      await expect(calc.locator('[name="carbFoodSearch"]')).toHaveValue('Office');
    }
    await manual(page, '5', '3');
    await expect(calc.locator('[data-carb-calculator-total]')).toHaveText('35 g');
    expect((await stored(page)).records).toHaveLength(0);
    if (context === 'entry') {
      await calc.locator('[data-action="use-carb-calculator-total"]').click();
      await expect(root(page).locator('[name="notes"]')).toHaveValue('Keep entry note');
      await expect(root(page).locator('[name="type"]')).toHaveValue('Snacks');
    }
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
        return {bodyTop:b.top,bodyBottom:b.bottom,formTop:f.top,formBottom:f.bottom,headerBottom:h.bottom,headerRight:h.right,titleRight:document.querySelector('#lee-lee-diabetes-title').getBoundingClientRect().right,actionsTop:a.top,padding:parseFloat(getComputedStyle(body).paddingTop),gap:parseFloat(getComputedStyle(form).gap),center:getComputedStyle(body).alignContent,overflow:document.documentElement.scrollWidth>innerWidth};
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
    await expect(root(page).locator('dialog[data-carb-calculator-layer]')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Add Manual Amount', exact: true })).toBeVisible();
    await qty.fill('0');await expect(calc.getByRole('button',{name:'Add Item',exact:true})).toBeDisabled();
    await qty.fill('2');await calc.getByRole('button',{name:'Add Item',exact:true}).click();
    await expect(calc.locator('[data-carb-calculator-total]')).toHaveText('55.1 g');
    expect((await stored(page)).records).toHaveLength(0);
    if(context==='entry') {await calc.locator('[data-action="use-carb-calculator-total"]').click();await expect(root(page).locator('[name="notes"]')).toHaveValue('Keep entry note');expect((await stored(page)).records).toHaveLength(0);}
  });
}

for (const context of ['standalone', 'entry']) test(`${context}: cleaned calculator introduction and accessible search preserve manual navigation`, async ({ page }) => {
  await seed(page); await enter(page, context);
  const calc = root(page).locator('[data-carb-calculator]');
  await expect(root(page).getByText('Find foods or saved meals and calculate their total carbohydrates. Or choose Favorites, Recent, or My Meals.', { exact: true })).toBeVisible();
  await expect(root(page).getByText('What are you eating?', { exact: true })).toHaveCount(0);
  await expect(root(page).getByText('Calculate carbs without logging an entry.', { exact: true })).toHaveCount(0);
  const search = calc.getByRole('searchbox', { name: 'Search foods & meals', exact: true });
  await expect(search).toHaveAttribute('placeholder', 'Search foods & meals...');
  await expect(calc.locator('.lee_lee_diabetes_carb_search > svg')).toHaveCSS('pointer-events', 'none');
  expect(await calc.locator('[data-carb-search-shortcuts]').evaluate(n => n.nextElementSibling.dataset.action)).toBe('open-carb-calculator-item-editor');
  await search.fill('Office'); await expect(calc.locator('[data-carb-library-list]')).toContainText('Office snack');
  await search.fill(''); await calc.getByRole('button', { name: 'Favorites', exact: true }).click();
  await expect(calc.locator('[data-carb-library-list]')).toContainText('Office snack');
  await calc.getByRole('button', { name: '+ Add Manual Amount...', exact: true }).click();
  await expect(calc.locator('[data-carb-item-editor]')).toHaveAttribute('data-preserve-document-scroll-on-viewport-pan', '');
  await calc.getByRole('button', { name: 'Back to Carb Calculator', exact: true }).click();
  await expect(search).toBeVisible();
});
