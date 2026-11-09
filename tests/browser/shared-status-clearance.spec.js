import {test, expect} from '@playwright/test';
import {createIPhoneDevServer} from '../../scripts/dev-iphone.mjs';
let server, base;
test.beforeAll(async () => {
  server = createIPhoneDevServer({bindAddress: {address: '127.0.0.1', netmask: '255.0.0.0'}, getMetadata: async () => ({environment: 'local-device', branch: 'clearance-test', commit: 'test', commitFull: 'test', dirty: true, sourceId: 'clearance-test'})});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { await new Promise(resolve => server.close(resolve)); });

for (const theme of ['light', 'dark']) test(`installed shared headers move down eight pixels without changing the cover: ${theme}`, async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', {get: () => true});
    localStorage.setItem('lando-world:lwvd:v1', JSON.stringify({firstName: 'Test', balanceCents: 10000, payday: '', frequency: '', onboarded: true}));
  });
  for (const route of ['/', '/#/settings', '/#/weather', '/#/lee-lees-tracker', '/#/digital-clock', '/#/daily-chief-briefing', '/#/violet-sprints', '/#/violet-futbol-game-tracker', '/#/road-bike-checklist', '/#/maintenance-total', '/violet-dineros/index.html']) {
    await page.goto(base + route);
    await page.evaluate(theme => {
      window.LandosTheme.setPreference(theme);
      document.documentElement.style.setProperty('--status-inset', '47px');
      document.documentElement.style.setProperty('--status-content-inset', 'var(--status-inset)');
    }, theme);
    await expect.poll(() => page.evaluate(() => Boolean(document.documentElement.dataset.statusApp))).toBe(true);
    await page.locator('.ecosystem_nav_back:visible, .digit_clock_header:visible').first().waitFor();
    const snapshot = () => page.evaluate(() => {
      const visible = selector => [...document.querySelectorAll(selector)].find(e => e.getBoundingClientRect().width && e.getBoundingClientRect().height);
      const link = visible('.ecosystem_nav_back') || visible('.digit_clock_header');
      const cover = getComputedStyle(document.body, '::after');
      return {top: link.getBoundingClientRect().top, height: cover.height, color: cover.backgroundColor, blur: cover.backdropFilter || cover.webkitBackdropFilter, position: cover.position, pointer: cover.pointerEvents, overflow: document.documentElement.scrollWidth > innerWidth};
    });
    const before = await snapshot();
    await page.evaluate(() => document.documentElement.style.removeProperty('--status-content-inset'));
    const after = await snapshot();
    expect(after.top - before.top, route).toBeCloseTo(8, 1);
    expect(after.height, route).toBe('47px');
    expect({...after, top: before.top}, route).toEqual(before);
    expect(after.position).toBe('fixed');
    expect(after.pointer).toBe('none');
    expect(after.blur).toBe('none');
    expect(after.overflow).toBe(false);
  }
});

test('regular browser pages do not receive installed-only clearance', async ({page}) => {
  await page.goto(base + '/#/lee-lees-tracker');
  expect(await page.evaluate(() => document.documentElement.dataset.statusApp)).toBeUndefined();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--status-content-inset').trim())).toBe('');
});
