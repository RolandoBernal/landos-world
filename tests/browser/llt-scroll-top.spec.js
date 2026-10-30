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
const nav = page => root(page).locator('.lee_lee_diabetes_bottom_nav');
async function seedLibrary(page) {
  await page.evaluate(() => window.LeeLeeTrackerStorage.updateTrackerData(current => ({ ...current,
    foodLibrary: [...current.foodLibrary, ...Array.from({ length: 47 }, (_, i) => ({
      id: `90000000-0000-4000-8000-${String(i).padStart(12, '0')}`, name: `Synthetic food ${String(i).padStart(2, '0')}`, carbs: 10 + i,
      sourceType: 'user', favorite: i === 0, lastUsedAt: i === 1 ? '2026-10-29T12:00:00Z' : null,
    }))],
    savedMeals: [{ id: '80000000-0000-4000-8000-000000000000', name: 'Synthetic meal', favorite: true, totalCarbs: 25, components: [{ componentType: 'manual', nameSnapshot: 'Meal carbs', carbTotal: 25 }] }],
  })));
}


async function top(page) {
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
  await expect(root(page).locator('.lee_lee_diabetes_nav_shell')).not.toHaveClass(/is-scroll-hidden/);
}
async function scroll(page) {
  await page.evaluate(()=>scrollTo(0,Math.min(450,document.documentElement.scrollHeight-innerHeight)));
  await page.waitForTimeout(40);
}
test('different tabs and Settings enter at top; same-screen typing and expansion retain position', async ({page})=>{
  await open(page);await seedLibrary(page);
  for(const theme of ['dark','light']) {
    await page.evaluate(theme=>window.LandosTheme.setPreference(theme),theme);
    await nav(page).getByRole('button',{name:'Foods',exact:true}).click();
    await root(page).getByRole('button',{name:'Browse All',exact:true}).click();
    await scroll(page);
    expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(100);
    // Keyboard activation of the existing nav also restores its scroll-hidden pill.
    await nav(page).getByRole('button',{name:'Reports',exact:true}).focus();
    await page.keyboard.press('Enter');await top(page);
    await scroll(page);
    await nav(page).getByRole('button',{name:'History',exact:true}).focus();await page.keyboard.press('Enter');await top(page);
    await nav(page).getByRole('button',{name:'Foods',exact:true}).click();
    await root(page).getByRole('button',{name:'Browse All',exact:true}).click();await scroll(page);
    await nav(page).getByRole('button',{name:'Carb Calc',exact:true}).focus();await page.keyboard.press('Enter');
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
    await scroll(page);
    await root(page).getByRole('button',{name:'Done',exact:true}).click();await top(page);
    await page.locator('#lee_lee_settings_toggle').click();await top(page);
    await root(page).locator('details[data-settings-accordion]').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
    await scroll(page);const settingsY=await page.evaluate(()=>scrollY);expect(settingsY).toBeGreaterThan(100);
    await root(page).locator('[name="patientName"]').evaluate(node=>{node.value='Synthetic';node.dispatchEvent(new Event('input',{bubbles:true}));});
    expect(await page.evaluate(()=>scrollY)).toBe(settingsY);
    await nav(page).getByRole('button',{name:'Today',exact:true}).focus();await page.keyboard.press('Enter');await top(page);
    await page.locator('#lee_lee_settings_toggle').click();await top(page);
    await nav(page).getByRole('button',{name:'Foods',exact:true}).click();await top(page);
    await root(page).getByRole('button',{name:'Browse All',exact:true}).click();await scroll(page);
    const before=await page.evaluate(()=>scrollY);
    await root(page).locator('[name="foodLibrarySearch"]').evaluate(node=>{node.value='food';node.dispatchEvent(new Event('input',{bubbles:true}));});
    expect(await page.evaluate(()=>scrollY)).toBe(before);
    await nav(page).getByRole('button',{name:'Today',exact:true}).focus();await page.keyboard.press('Enter');await top(page);
  }
});

test('History day, entry and internal food screens start at top without resetting modal interactions', async ({page})=>{
  const now=Date.now();
  const records=Array.from({length:16},(_,i)=>({id:`scroll-test-${i}`,eventType:'note',type:'Other',notes:`Synthetic ${i}`,timestamp:now-i*1000,recordTimestamp:new Date(now-i*1000).toISOString(),createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()}));
  await open(page,records);await seedLibrary(page);
  await scroll(page);
  await nav(page).getByRole('button',{name:'History',exact:true}).focus();await page.keyboard.press('Enter');await top(page);
  await root(page).locator('[data-action="history-date"]').first().click();await top(page);
  await scroll(page);
  await root(page).locator('[data-action="edit-record"]').last().click();
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
  await root(page).locator('[data-lee-lee-editor] [data-action="cancel"]').click();await top(page);
  await nav(page).getByRole('button',{name:'Foods',exact:true}).click();
  await root(page).getByRole('button',{name:'+ Add New Food',exact:true}).click();
  const fields=root(page).locator('[data-food-library-fields]');await expect(fields).toHaveJSProperty('scrollTop',0);
  await page.setViewportSize({width:390,height:430});
  await fields.evaluate(node=>node.scrollTop=node.scrollHeight);const before=await fields.evaluate(node=>node.scrollTop);
  await root(page).locator('[name="foodBrand"]').evaluate(node=>{node.value='Synthetic draft';node.dispatchEvent(new Event('input',{bubbles:true}));});
  // Native WebKit can round the resized scrollport by a couple of pixels.
  expect(Math.abs(await fields.evaluate(node=>node.scrollTop)-before)).toBeLessThanOrEqual(3);
  page.once('dialog',dialog=>dialog.accept());await root(page).getByRole('button',{name:'Cancel',exact:true}).click();
  await root(page).getByRole('button',{name:'+ Add New Food',exact:true}).click();await expect(fields).toHaveJSProperty('scrollTop',0);
});
