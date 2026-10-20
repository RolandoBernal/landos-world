import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
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
async function seed(page, records = []) {
  await open(page, records);
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
    await root(page).getByRole('tab', { name: 'Carb Calc', exact: true }).click();
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

for (const containingBlock of [false, true]) for (const mode of ['new', 'edit']) test(`${mode} ancestor=${containingBlock}: viewport geometry and exact restoration across repeated scrolled opens`, async ({ page }) => {
 const now=new Date().toISOString();
 await seed(page, mode==='edit' ? [{id:'synthetic-snack',version:1,type:'Snacks',eventType:'check-insulin',recordTimestamp:now,createdAt:now,updatedAt:now,mealCarbs:20,totalCarbs:20,notes:'saved'}] : []);
 if(mode==='new') { await root(page).getByRole('button',{name:'Log Entry',exact:true}).click(); await root(page).locator('[name="type"]').selectOption('Snacks'); }
 else { await root(page).locator('[data-action="history"]').first().click(); await root(page).locator('[data-action="history-date"]').first().click(); await root(page).locator('[data-action="edit-record"]').first().click(); }
 await root(page).locator('[name="notes"]').fill('Unsaved positioning test');
 const original=(await stored(page)).records;
 // An ancestor containing block must never displace a viewport modal.
 if (containingBlock) await root(page).evaluate(n=>{n.style.transform='translateZ(0)';});
 for(const [cycle, fraction] of [0,.5,1,.5,1].entries()) {
  await page.evaluate(async fraction=>{document.activeElement?.blur();window.scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*fraction);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},fraction);
  const before=await page.evaluate(()=>({y:scrollY,top:document.querySelector('[name="notes"]').getBoundingClientRect().top}));
  await root(page).locator('[data-action="open-carb-calculator"]').dispatchEvent('click');
  const calc=root(page).locator('[data-carb-calculator]');
  await expect.poll(()=>calc.evaluate(n=>Math.abs(n.getBoundingClientRect().top-(visualViewport?.offsetTop||0)))).toBeLessThan(1);
  await expect(calc.getByRole('button',{name:'Cancel Carb Calculator'})).toBeInViewport();
  expect(await calc.evaluate(n=>n.getBoundingClientRect().bottom <= (visualViewport?.offsetTop||0)+(visualViewport?.height||innerHeight)+1)).toBe(true);
  const background=await root(page).locator('[name="notes"]').evaluate(n=>n.getBoundingClientRect().top);
  expect(background).toBeCloseTo(before.top,0);
  await calc.locator('[name="carbFoodSearch"]').focus();
  await mockKeyboard(page,360,30);
  await expect.poll(()=>calc.evaluate(n=>Math.abs(n.getBoundingClientRect().top-30))).toBeLessThan(1);
  await mockKeyboard(page,700,0);
  await expect.poll(()=>calc.evaluate(n=>Math.abs(n.getBoundingClientRect().top))).toBeLessThan(1);
  expect(await root(page).locator('[name="notes"]').evaluate(n=>n.getBoundingClientRect().top)).toBeCloseTo(background,0);
  if(cycle===3) {
   await calc.locator('[name="carbFoodSearch"]').fill('Office');
   await calc.getByRole('button',{name:/^Add Office snack /}).click();
   for(let i=0;i<8;i++) await manual(page,'5');
   const body=calc.locator('[data-carb-calculator-body]');
   await body.evaluate(n=>{n.scrollTop=n.scrollHeight;});
   await expect(calc.locator('[data-action="use-carb-calculator-total"]')).toBeInViewport();
   await expect(calc.getByRole('button',{name:'Cancel Carb Calculator'})).toBeInViewport();
   expect(await calc.evaluate(n=>Math.abs(n.getBoundingClientRect().top))).toBeLessThan(1);
   await calc.locator('[data-action="use-carb-calculator-total"]').click();
  } else await calc.getByRole('button',{name:'Cancel Carb Calculator'}).click();
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeCloseTo(before.y,0);
  await expect(root(page).locator('[name="notes"]')).toHaveValue('Unsaved positioning test');
 }
 expect((await stored(page)).records).toEqual(original);
});
