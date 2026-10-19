import { test, expect } from '@playwright/test';
const key = 'landos_world_my_apps_v1';
const cards = (page) => page.locator('#lando-launcher .clock_utility_card');
const toggle = (page, id) => page.locator(`[data-my-app-id="${id}"]`);
const recommended = (page) => page.getByRole('button', { name: 'Use Recommended Apps' });
async function open(page) {
  await page.goto('/#/settings');
  await expect(toggle(page, 'weather')).toBeVisible();
}
test('legacy, explicit recommended, reload, show all, empty recovery and routes', async ({ page }) => {
  await open(page);
  await expect(cards(page)).toHaveCount(8);
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
  await recommended(page).click();
  await expect(cards(page)).toHaveCount(3);
  expect(await cards(page).locator('button').evaluateAll((buttons) => buttons.map((b) => b.dataset.route))).toEqual(['digital-clock', 'weather', 'lee-lees-tracker']);
  await page.reload(); await expect(cards(page)).toHaveCount(3);
  await page.getByRole('button', { name: 'Show All Apps' }).click();
  await expect(cards(page)).toHaveCount(8);
  for (const input of await page.locator('[data-my-app-id]').all()) await input.uncheck();
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'No Apps Selected' })).toBeVisible();
  await page.getByRole('button', { name: 'Manage My Apps' }).click();
  await expect(page.locator('#my-apps-title')).toBeFocused();
  await page.goto('/#/digital-clock'); await expect(page.locator('#clock-view')).toBeVisible();
  await page.goto('/#/lee-lees-tracker'); await expect(page.locator('#lee-lees-tracker-view')).toBeVisible();
  await page.goBack(); await expect(page.locator('#clock-view')).toBeVisible();
  await page.goto('/#/settings'); await toggle(page, 'weather').focus(); await page.keyboard.press('Space');
  await expect(toggle(page, 'weather')).toBeChecked();
  await expect(toggle(page, 'weather')).toBeFocused();
});
test('saved ordering, no first-render incorrect cards, unrelated storage and cross-tab updates', async ({ page, context }) => {
  await page.addInitScript((k) => {
    if (!localStorage.getItem('launcher-test-seeded')) {
      localStorage.setItem(k, JSON.stringify({ schemaVersion: 1, visibleAppIds: ['weather', 'digital-clock'], appOrder: ['digital-clock', 'weather'] }));
      localStorage.setItem('launcher-test-seeded', 'untouched');
    }
    window.firstLauncherRoutes = [];
    new MutationObserver(() => {
      if (!window.firstLauncherRoutes.length) window.firstLauncherRoutes = [...document.querySelectorAll('#lando-launcher [data-route]')].map((el) => el.dataset.route);
    }).observe(document, { childList: true, subtree: true });
  }, key);
  await open(page);
  expect(await page.evaluate(() => window.firstLauncherRoutes)).toEqual(['digital-clock', 'weather']);
  const second = await context.newPage(); await open(second);
  await toggle(page, 'weather').uncheck();
  await expect(toggle(second, 'weather')).not.toBeChecked();
  await toggle(second, 'weather').check(); await expect(toggle(page, 'weather')).toBeChecked();
  expect(await cards(page).locator('button').evaluateAll((els) => els.map((el) => el.dataset.route))).toEqual(['digital-clock', 'weather']);
  expect(await page.evaluate(() => localStorage.getItem('launcher-test-seeded'))).toBe('untouched');
  await context.setOffline(true); await page.goto('/#/');
  await expect(cards(page)).toHaveCount(2);
});
test('malformed and future schema recovery, denied writes report session-only changes', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, '{'), key);
  await open(page); await expect(cards(page)).toHaveCount(8);
  await expect(page.locator('#my-apps-status')).toContainText('could not be read');
  await recommended(page).click(); await expect(cards(page)).toHaveCount(3);
  await page.evaluate((k) => { localStorage.setItem(k, '{"schemaVersion":2}'); window.dispatchEvent(new StorageEvent('storage', { key: k })); }, key);
  await expect(recommended(page)).toBeDisabled();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe('{"schemaVersion":2}');
  await page.evaluate((k) => {
    localStorage.removeItem(k); window.dispatchEvent(new StorageEvent('storage', { key: k }));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name, value) { if (name === k) throw Error('quota'); return original.call(this, name, value); };
  }, key);
  await recommended(page).click(); await expect(cards(page)).toHaveCount(3);
  await expect(page.locator('#my-apps-status')).toContainText('session only');
  await toggle(page, 'weather').uncheck(); await expect(cards(page)).toHaveCount(2);
});
for (const width of [320, 375, 430, 768, 1440]) {
  test(`responsive controls and home at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await open(page);
    await recommended(page).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await toggle(page, 'weather').evaluate((el) => !!el.labels.length)).toBe(true);
    await page.goto('/#/'); await expect(cards(page)).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('read-denied storage keeps management available and reports unsaved changes', async ({ page }) => {
  await page.addInitScript((k) => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function(name) { if (name === k) throw Error('denied'); return original.call(this, name); };
  }, key);
  await open(page);
  await expect(cards(page)).toHaveCount(8);
  await expect(page.locator('#my-apps-status')).toContainText('could not be read');
  await recommended(page).click();
  await expect(cards(page)).toHaveCount(3);
});

test('re-enabling rehydrates card summaries and changes only the launcher key', async ({ page }) => {
  // Background clock forecasts own their cache keys; isolate their asynchronous
  // writes so this assertion measures only the personalization actions.
  await page.route(/https:\/\/(?:api|geocoding-api)\.open-meteo\.com\//, (route) => route.abort());
  await open(page);
  // LLT initializes independently of the launcher; wait for its existing startup
  // storage markers before comparing synthetic browser storage around our actions.
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('lando-world:lee-lees-tracker:v1'))
    && Boolean(localStorage.getItem('lando-world:lee-lees-tracker:sync-metadata:v1'))
    && (!navigator.storage?.persist || localStorage.getItem('lando-world:lee-lees-tracker:v1:persistent-storage-requested') === 'true'))).toBe(true);
  const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await recommended(page).click();
  await page.getByRole('button', { name: 'Show All Apps' }).click();
  expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([name]) => name !== 'landos_world_my_apps_v1')))).toEqual(before);
  await page.goto('/#/');
  await expect(page.locator('[data-launcher-digital-clock-time]')).not.toBeEmpty();
  await expect(page.locator('[data-launcher-weather]')).not.toBeEmpty();
  await expect(page.locator('[data-launcher-checklist-progress]')).not.toBeEmpty();
  await expect(page.locator('[data-launcher-vfgt-summary]')).toContainText('Current Record');
});

const rows = (page) => page.locator('#my-apps-list > li');
const rowOrder = (page) => rows(page).evaluateAll((elements) => elements.map((row) => row.dataset.myAppRow));
const moveButton = (page, id, direction) => page.locator(`[data-my-app-for="${id}"][data-my-app-move="${direction}"]`);
const preference = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
async function trackPreferenceWrites(page) {
  await page.evaluate((k) => {
    window.orderWrites = 0;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name, value) {
      if (name === k) window.orderWrites += 1;
      return original.call(this, name, value);
    };
  }, key);
}
async function beginMouseDrag(page, id) {
  const handle = page.locator(`[data-my-app-drag="${id}"]`);
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  return box;
}

test('ordering: keyboard controls retain focus, announce positions and stop at boundaries', async ({ page }) => {
  await open(page); await trackPreferenceWrites(page);
  await expect(moveButton(page, 'weather', 'up')).toHaveAttribute('aria-disabled', 'true');
  await moveButton(page, 'weather', 'up').focus(); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.orderWrites)).toBe(0);
  const down = moveButton(page, 'weather', 'down');
  await down.focus(); await page.keyboard.press('Enter');
  await expect(down).toBeFocused();
  expect((await rowOrder(page)).slice(0, 2)).toEqual(['digital-clock', 'weather']);
  await expect(page.locator('#my-apps-order-status')).toContainText('position 2 of 8');
  const up = moveButton(page, 'weather', 'up'); await up.focus(); await page.keyboard.press('Space');
  await expect(up).toBeFocused(); await expect(up).toHaveAttribute('aria-disabled', 'true');
  await expect(up).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter'); expect(await page.evaluate(() => window.orderWrites)).toBe(2);
  expect(await rows(page).count()).toBe(8);
});

test('ordering: hidden positions, Show All, recommended order, reload and empty recovery', async ({ page }) => {
  await open(page); await recommended(page).click();
  await moveButton(page, 'death-on-notecards', 'up').click();
  const order = await rowOrder(page);
  expect(order[6]).toBe('death-on-notecards');
  expect((await preference(page)).visibleAppIds).toEqual(['digital-clock', 'weather', 'lee-lees-tracker']);
  await toggle(page, 'death-on-notecards').check();
  expect((await preference(page)).appOrder).toEqual(order);
  await toggle(page, 'weather').uncheck(); await toggle(page, 'weather').check();
  expect((await preference(page)).appOrder).toEqual(order);
  await page.getByRole('button', { name: 'Show All Apps' }).click();
  expect(await rowOrder(page)).toEqual(order); await expect(cards(page)).toHaveCount(8);
  await page.reload(); expect(await rowOrder(page)).toEqual(order);
  await recommended(page).click(); expect((await rowOrder(page)).slice(0, 3)).toEqual(['digital-clock', 'weather', 'lee-lees-tracker']);
  expect((await rowOrder(page)).slice(3)).toEqual(order.slice(3));
  for (const input of await page.locator('[data-my-app-id]').all()) await input.uncheck();
  await moveButton(page, 'weather', 'up').click();
  expect((await preference(page)).visibleAppIds).toEqual([]);
  await page.goto('/#/'); await expect(page.getByRole('heading', { name: 'No Apps Selected' })).toBeVisible();
  await page.getByRole('button', { name: 'Manage My Apps' }).click();
  await expect(page.locator('#my-apps-title')).toBeFocused(); await expect(rows(page)).toHaveCount(8);
  await page.goto('/#/violet-futbol-game-tracker'); await expect(page.locator('#violet-futbol-game-tracker-view')).toBeVisible();
  await page.goBack(); await expect(page.locator('#my-apps-title')).toBeVisible();
});

test('ordering: mouse handle drag previews without writes and commits once', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1400 }); await open(page); await trackPreferenceWrites(page);
  const original = await rowOrder(page); const box = await beginMouseDrag(page, 'weather');
  const target = await rows(page).nth(1).boundingBox();
  await page.mouse.move(box.x + box.width / 2, target.y + target.height - 5, { steps: 8 });
  await expect(page.locator('.my_apps_dragging')).toHaveCount(1);
  await expect(page.locator('.my_apps_drop_before, .my_apps_drop_after')).toHaveCount(1);
  expect(await rowOrder(page)).toEqual(original); expect(await page.evaluate(() => window.orderWrites)).toBe(0);
  await page.mouse.up(); expect((await rowOrder(page)).slice(0, 2)).toEqual(['digital-clock', 'weather']);
  expect(await page.evaluate(() => window.orderWrites)).toBe(1);
  expect((await preference(page)).visibleAppIds).toHaveLength(8);
  expect(await cards(page).locator('button').evaluateAll((buttons) => buttons.slice(0, 2).map((b) => b.dataset.route))).toEqual(['digital-clock', 'weather']);
  await page.reload(); expect((await rowOrder(page)).slice(0, 2)).toEqual(['digital-clock', 'weather']);
});

test('ordering: cancelled, unchanged and outside drops do not persist or toggle apps', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1400 }); await open(page); await trackPreferenceWrites(page);
  const original = await rowOrder(page);
  let box = await beginMouseDrag(page, 'weather'); await page.mouse.up();
  expect(await page.evaluate(() => window.orderWrites)).toBe(0);
  box = await beginMouseDrag(page, 'weather'); await page.mouse.move(box.x + 20, box.y + 100); await page.keyboard.press('Escape'); await page.mouse.up();
  box = await beginMouseDrag(page, 'weather'); await page.mouse.move(1, box.y + 100); await page.mouse.up();
  box = await beginMouseDrag(page, 'weather'); await page.mouse.move(box.x + 20, box.y + 100);
  await page.locator('[data-my-app-drag="weather"]').dispatchEvent('pointercancel', { pointerId: 1 }); await page.mouse.up();
  expect(await rowOrder(page)).toEqual(original); expect(await page.evaluate(() => window.orderWrites)).toBe(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull(); await expect(page.locator('.my_apps_dragging')).toHaveCount(0);
  await expect(toggle(page, 'weather')).toBeChecked();
});

test('ordering: external changes cancel drag and update both tabs without echo writes', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 1400 }); await open(page); await trackPreferenceWrites(page);
  const second = await context.newPage(); await open(second); await trackPreferenceWrites(second);
  await page.bringToFront(); const box = await beginMouseDrag(page, 'weather');
  await page.mouse.move(box.x + 20, box.y + 100);
  await second.evaluate(() => document.querySelector('[data-my-app-for="lee-lees-tracker"][data-my-app-move="up"]').click());
  await expect(page.locator('.my_apps_dragging')).toHaveCount(0); await page.mouse.up();
  await expect(page.locator('#my-apps-order-status')).toContainText('another tab');
  expect(await rowOrder(page)).toEqual(await rowOrder(second));
  expect(await page.evaluate(() => window.orderWrites)).toBe(0); expect(await second.evaluate(() => window.orderWrites)).toBe(1);
  await toggle(second, 'weather').uncheck(); await expect(toggle(page, 'weather')).not.toBeChecked();
  expect((await preference(page)).appOrder).toEqual(await rowOrder(page));
});

test('ordering: touch handle drag and natural row scrolling use separate gestures', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 850 }); await open(page); await trackPreferenceWrites(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const first = page.locator('[data-my-app-drag="weather"]'); await first.scrollIntoViewIfNeeded();
  const box = await first.boundingBox(); const target = await rows(page).nth(1).boundingBox();
  const x = box.x + 22; const y = box.y + 22; const end = target.y + target.height - 8;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: end }] });
  await expect(page.locator('.my_apps_dragging')).toHaveCount(1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect((await rowOrder(page)).slice(0, 2)).toEqual(['digital-clock', 'weather']);
  expect(await page.evaluate(() => window.orderWrites)).toBe(1);
  const before = await rowOrder(page); const scroll = await page.evaluate(() => window.scrollY);
  const label = await page.locator('.my_apps_identity').first().boundingBox();
  const sx = label.x + 45; const sy = Math.min(label.y + 20, 600);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx, y: sy - 100 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scroll);
  expect(await rowOrder(page)).toEqual(before); expect(await page.evaluate(() => window.orderWrites)).toBe(1);
  expect((await preference(page)).visibleAppIds).toHaveLength(8);
  await cdp.detach();
});

test('ordering: handle edge-scroll reaches later rows without saving until release', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 }); await open(page); await trackPreferenceWrites(page);
  const box = await beginMouseDrag(page, 'weather');
  await page.mouse.move(box.x + 22, 480, { steps: 6 });
  await expect.poll(() => page.locator('[data-my-app-row="road-bike-checklist"]').evaluate((row) => row.getBoundingClientRect().bottom)).toBeLessThan(450);
  expect(await page.evaluate(() => window.orderWrites)).toBe(0);
  const target = await page.locator('[data-my-app-row="road-bike-checklist"]').boundingBox();
  await page.mouse.move(box.x + 22, target.y + target.height - 5); await page.mouse.up();
  expect((await preference(page)).appOrder.indexOf('weather')).toBeGreaterThan(3);
  expect(await page.evaluate(() => window.orderWrites)).toBe(1);
});

test('ordering: failure feedback and newer schemas preserve data and keep safe access', async ({ page }) => {
  await page.addInitScript((k) => {
    localStorage.setItem(k, JSON.stringify({ schemaVersion: 1, visibleAppIds: ['weather'], appOrder: ['death-on-notecards', 'weather', 'weather', 'unknown'] }));
    const original = Storage.prototype.setItem;
    window.orderOriginalSetItem = original;
    Storage.prototype.setItem = function(name, value) { if (name === k) throw Error('quota'); return original.call(this, name, value); };
  }, key);
  await open(page); const raw = await page.evaluate((k) => localStorage.getItem(k), key);
  expect((await rowOrder(page)).slice(0, 2)).toEqual(['death-on-notecards', 'weather']);
  await moveButton(page, 'weather', 'up').click(); await expect(page.locator('#my-apps-status')).toContainText('session only');
  expect((await rowOrder(page))[0]).toBe('weather'); expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(raw);
  await page.evaluate((k) => {
    // Restore only our disposable context's patched setter, then deliver a newer-schema event.
    Storage.prototype.setItem = window.orderOriginalSetItem;
    localStorage.setItem(k, '{"schemaVersion":9}'); window.dispatchEvent(new StorageEvent('storage', { key: k }));
  }, key);
  await expect(moveButton(page, 'weather', 'down')).toBeDisabled();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe('{"schemaVersion":9}');
});

for (const width of [320, 375, 390, 430, 768, 1440]) {
  test(`ordering layout: named controls, targets and focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page);
    await expect(rows(page)).toHaveCount(8);
    await assertSingleRowLayout(page);
    for (const id of ['weather', 'death-on-notecards']) {
      const button = moveButton(page, id, id === 'weather' ? 'down' : 'up');
      await expect(button).toHaveAccessibleName(new RegExp(`Move .+ ${id === 'weather' ? 'down' : 'up'}`));
      const box = await button.boundingBox(); expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      // Start with keyboard focus and verify it remains on the moved control.
      await button.focus(); await button.click(); await expect(button).toBeFocused();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.my_apps_identity').evaluateAll((labels) => labels.every((el) => el.scrollWidth <= el.clientWidth + 1))).toBe(true);
  });
}

async function assertSingleRowLayout(page, scaled = false) {
  const geometry = await rows(page).evaluateAll((elements) => elements.map((row) => {
    const box = (element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const label = row.querySelector('label');
    const input = label.querySelector('input');
    const name = label.querySelector('span');
    const icon = label.querySelector('img');
    const parts = [row.querySelector('.my_apps_drag_handle'), icon, name, input, ...row.querySelectorAll('[data-my-app-move]')].map(box);
    const checkbox = box(input); const style = getComputedStyle(input);
    const hit = { x: checkbox.x - parseFloat(style.marginLeft), right: checkbox.right + parseFloat(style.marginRight),
      y: checkbox.y - parseFloat(style.marginTop), bottom: checkbox.bottom + parseFloat(style.marginBottom) };
    const range = document.createRange(); range.selectNodeContents(name);
    return { id: row.dataset.myAppRow, row: box(row), label: box(label), parts, hit,
      text: name.textContent, fontSize: parseFloat(getComputedStyle(name).fontSize), lineHeight: parseFloat(getComputedStyle(name).lineHeight),
      textRects: [...range.getClientRects()].map((r) => ({ x: r.x, right: r.right, y: r.y, bottom: r.bottom })),
      iconReady: icon.complete && icon.naturalWidth > 0, labelOverflow: label.scrollWidth > label.clientWidth + 1 };
  }));
  expect(geometry).toHaveLength(8);
  for (const g of geometry) {
    expect(g.iconReady, g.text).toBe(true);
    expect(g.labelOverflow, g.text).toBe(false);
    expect(g.fontSize).toBeGreaterThanOrEqual(14);
    const center = g.row.y + g.row.height / 2;
    for (let i = 0; i < g.parts.length; i++) {
      const part = g.parts[i];
      expect(Math.abs(part.y + part.height / 2 - center), `${g.text}: element ${i} stays in the same horizontal band`).toBeLessThanOrEqual(1);
      if (i) expect(part.x, `${g.text}: left-to-right order`).toBeGreaterThanOrEqual(g.parts[i - 1].right - 0.5);
    }
    for (const part of [g.parts[0], g.parts[4], g.parts[5]]) {
      expect(part.width).toBeGreaterThanOrEqual(44); expect(part.height).toBeGreaterThanOrEqual(44);
    }
    expect(g.hit.right - g.hit.x).toBeGreaterThanOrEqual(44);
    expect(g.hit.bottom - g.hit.y).toBeGreaterThanOrEqual(44);
    expect(g.hit.x).toBeGreaterThanOrEqual(g.label.x - 0.5);
    expect(g.hit.right).toBeLessThanOrEqual(g.label.right + 0.5);
    expect(g.hit.y).toBeGreaterThanOrEqual(g.label.y - 0.5);
    expect(g.hit.bottom).toBeLessThanOrEqual(g.label.bottom + 0.5);
    expect(g.parts[4].x).toBeGreaterThanOrEqual(g.hit.right - 0.5);
    expect(g.parts[5].x).toBeGreaterThanOrEqual(g.parts[4].right);
    for (const r of g.textRects) {
      expect(r.x).toBeGreaterThanOrEqual(g.parts[2].x - 1); expect(r.right).toBeLessThanOrEqual(g.parts[2].right + 1);
      expect(r.y).toBeGreaterThanOrEqual(g.parts[2].y - 1); expect(r.bottom).toBeLessThanOrEqual(g.parts[2].bottom + 1);
    }
    if (!scaled) expect(g.row.height, `${g.text}: only wrapped names may grow the row`).toBeLessThanOrEqual(Math.max(44, g.lineHeight * 4) + 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('single-row layout retains all names and controls with 200 percent text and dark appearance', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 }); await open(page);
  await page.evaluate(() => { window.LandosTheme.setPreference('dark'); document.documentElement.style.fontSize = '200%'; });
  await assertSingleRowLayout(page, true);
  await page.evaluate(() => window.LandosTheme.setPreference('light'));
  await assertSingleRowLayout(page, true);
});

test('single-row neighboring touch areas isolate toggles, moves and drag handles', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 }); await open(page);
  const initial = await rowOrder(page);
  await toggle(page, 'weather').uncheck(); expect(await rowOrder(page)).toEqual(initial);
  await toggle(page, 'weather').check(); expect(await rowOrder(page)).toEqual(initial);
  const box = await toggle(page, 'weather').boundingBox();
  // The label extends the checkbox's native 24px box to a 44px touch area.
  await page.mouse.click(box.x - 8, box.y + 12); await expect(toggle(page, 'weather')).not.toBeChecked();
  expect(await rowOrder(page)).toEqual(initial);
  await moveButton(page, 'weather', 'down').click(); await expect(toggle(page, 'weather')).not.toBeChecked();
  await expect(moveButton(page, 'weather', 'down')).toBeFocused();
  await moveButton(page, 'weather', 'up').click(); await expect(toggle(page, 'weather')).not.toBeChecked();
  const handle = await beginMouseDrag(page, 'weather'); await page.mouse.up();
  expect(await rowOrder(page)).toEqual(initial); await expect(toggle(page, 'weather')).not.toBeChecked();
  expect(handle.width).toBeGreaterThanOrEqual(44);
});


test('browser contexts keep independent preferences and every hidden local app remains routable', async ({ page, browser, baseURL }) => {
  await open(page);
  // Observe the deployed registry destination; do not navigate to the external app.
  await expect(page.locator('#lando-launcher a[href="https://rolandobernal.github.io/death-on-notecards/"]')).toHaveCount(1);
  for (const input of await page.locator('[data-my-app-id]').all()) await input.uncheck();
  const saved = await page.evaluate((k) => localStorage.getItem(k), key);
  for (const [route, selector] of [
    ['weather', '#weather-view'], ['digital-clock', '#clock-view'],
    ['lee-lees-tracker', '#lee-lees-tracker-view'], ['violet-sprints', '#sprints-view'],
    ['violet-futbol-game-tracker', '#violet-futbol-game-tracker-view'], ['road-bike-checklist', '#road-bike-checklist-view'],
    ['maintenance-total', '#maintenance-total-view'],
  ]) {
    await page.goto(`/#/${route}`);
    await expect(page.locator(selector)).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(saved);
  }
  const independent = await browser.newContext({ baseURL });
  try {
    const other = await independent.newPage(); await open(other);
    await expect(cards(other)).toHaveCount(8);
    expect(await other.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
  } finally { await independent.close(); }
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'No Apps Selected' })).toBeVisible();
});


test('Sprints launcher action survives preference renders and hidden direct navigation', async ({ page }) => {
  await open(page);
  await recommended(page).click();
  await page.getByRole('button', { name: 'Show All Apps' }).click();
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Open Violet Sprints', exact: true }).click();
  await expect(page.locator('#sprints-view')).toBeVisible();
  await expect(page.locator('.sprints-list-item').first()).toBeVisible();
  await page.goto('/#/settings'); await toggle(page, 'violet-sprints').uncheck();
  await page.goto('/#/violet-sprints');
  await expect(page.locator('.sprints-list-item').first()).toBeVisible();
  await page.reload();
  await expect(page.locator('.sprints-list-item').first()).toBeVisible();
  await page.goto('/#/');
  await expect(page.locator('#open-sprints')).toHaveCount(0);
});
