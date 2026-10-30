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
const seed = () => Array.from({length:24},(_,i)=>({id:`startup-${i}`,eventType:'note',type:'Other',notes:`Synthetic startup entry ${i}`,timestamp:Date.now()-i*1000,recordTimestamp:new Date(Date.now()-i*1000).toISOString(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}));
async function bottom(page) { await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await expect(root(page).locator('.lee_lee_diabetes_nav_shell')).toHaveClass(/is-scroll-hidden/); }
async function readyTop(page) {
  await expect(root(page).getByRole('heading',{name:'Lee-Lee’s Tracker',exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
  await expect(root(page).locator('.lee_lee_diabetes_nav_shell')).not.toHaveClass(/is-scroll-hidden/);
  await expect(root(page).getByRole('button',{name:'Log Entry',exact:true})).toBeInViewport();
}
test('reload after scrolling Today to bottom opens at top and then normal scroll hiding works',async({page})=>{
  await open(page,seed());
  for(const theme of ['dark','light']) {
    await page.evaluate(theme=>window.LandosTheme.setPreference(theme),theme);
    await bottom(page);
    await page.reload({waitUntil:'load'});
    await readyTop(page);
    await page.waitForTimeout(200);
    await readyTop(page);
    await bottom(page);
    await page.evaluate(()=>scrollBy(0,-60));
    await expect(root(page).locator('.lee_lee_diabetes_nav_shell')).not.toHaveClass(/is-scroll-hidden/);
    await page.evaluate(()=>scrollTo(0,0));
  }
});

test('late pageshow scroll restoration is reset after Today has rendered',async({page})=>{
  await open(page,seed());
  await bottom(page);
  // The shell requests manual restoration, but a page presentation can still
  // arrive after initial markup. Exercise the existing pageshow boundary.
  await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));scrollTo(0,document.documentElement.scrollHeight);});
  await readyTop(page);
});
