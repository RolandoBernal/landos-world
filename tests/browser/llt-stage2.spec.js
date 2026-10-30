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
async function foods(page) { await nav(page).getByRole('button', { name: 'Foods', exact: true }).click(); }
async function seedLibrary(page) {
  await page.evaluate(() => window.LeeLeeTrackerStorage.updateTrackerData(current => ({ ...current,
    foodLibrary: [...current.foodLibrary, ...Array.from({ length: 47 }, (_, i) => ({
      id: `90000000-0000-4000-8000-${String(i).padStart(12, '0')}`, name: `Synthetic food ${String(i).padStart(2, '0')}`, carbs: 10 + i,
      sourceType: 'user', favorite: i === 0, lastUsedAt: i === 1 ? '2026-10-29T12:00:00Z' : null,
    }))],
    savedMeals: [{ id: '80000000-0000-4000-8000-000000000000', name: 'Synthetic meal', favorite: true, totalCarbs: 25, components: [{ componentType: 'manual', nameSnapshot: 'Meal carbs', carbTotal: 25 }] }],
  })));
}

test('five destinations, center calculator, floating entry and scratch preservation', async ({ page }) => {
  await open(page);
  await expect(nav(page).getByRole('button')).toHaveText(['Today', 'History', 'Carb Calc', 'Reports', 'Foods']);
  await expect(root(page).locator('.lee_lee_diabetes_floating_log')).toBeVisible();
  const before = await page.evaluate(key => localStorage.getItem(key), key);
  await nav(page).getByRole('button', { name: 'Carb Calc', exact: true }).click();
  await expect(nav(page)).toHaveCount(0);
  await expect(root(page).locator('[data-foods-view-switcher]')).toHaveCount(0);
  await expect(root(page).locator('.lee_lee_diabetes_floating_log')).toHaveCount(0);
  await root(page).getByRole('button', { name: '+ Add Manual Amount...' }).click();
  await root(page).locator('[name="carbItemCarbs"]').fill('12.5');
  await root(page).getByRole('button', { name: 'Add Item', exact: true }).click();
  await root(page).getByRole('button', { name: 'Done', exact: true }).click();
  await foods(page);
  await nav(page).getByRole('button', { name: 'Carb Calc', exact: true }).click();
  await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('12.5 g');
  await root(page).getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(root(page).locator('[data-carb-calculator-row]')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(before);
});

test('Foods favorites first, unified complete search, pagination and existing editors', async ({ page }) => {
  await open(page); await seedLibrary(page); await foods(page);
  const sections = root(page).locator('.lee_lee_diabetes_library_section');
  await expect(sections.first()).toHaveAttribute('aria-label', 'Favorites');
  await expect(root(page).locator('[data-collection="favorites"]')).toHaveAttribute('aria-pressed', 'true');
  const touches = await sections.first().locator('button').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  touches.forEach(box => { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); });
  const search = root(page).getByRole('searchbox', { name: 'Search foods and meals' });
  await search.fill('Synthetic');
  await expect(root(page).locator('[role="status"]').last()).toContainText('20 of 48');
  await search.fill('Synthetic food 46');
  await expect(root(page).locator('.lee_lee_diabetes_food_item')).toHaveCount(1);
  await expect(root(page).locator('.lee_lee_diabetes_food_item')).toContainText('Synthetic food 46');
  await search.fill('Synthetic meal');
  await expect(root(page).locator('.lee_lee_diabetes_food_item')).toContainText('MEAL');
  await root(page).getByRole('button', { name: 'Browse All', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(root(page).locator('.lee_lee_diabetes_food_item')).toHaveCount(20);
  await root(page).getByRole('button', { name: 'Show More', exact: true }).click();
  await expect(root(page).locator('.lee_lee_diabetes_food_item')).toHaveCount(40);
  await expect(root(page).getByRole('button', { name: 'Back to Top ↑' })).toBeVisible();
  await root(page).getByRole('button', { name: 'My Meals', exact: true }).click();
  await root(page).getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(root(page).locator('[name="mealBuilderName"]')).toHaveValue('Synthetic meal');
});

test('Light Dark System, portrait landscape, touch targets and screenshots', async ({ page }, testInfo) => {
  await open(page); await seedLibrary(page);
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => window.LandosTheme.setPreference(theme), theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await nav(page).getByRole('button', { name: 'Today', exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath(`today-${theme}.png`) });
    await foods(page);
    await page.screenshot({ path: testInfo.outputPath(`foods-${theme}.png`) });
    await nav(page).getByRole('button', { name: 'Carb Calc', exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath(`carb-calc-${theme}.png`) });
    await root(page).getByRole('button', { name: 'Done', exact: true }).click();
    await root(page).getByRole('button', { name: 'Log Entry', exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath(`new-entry-${theme}.png`) });
    await root(page).locator('[data-lee-lee-editor] [data-action="cancel"]').click();
    for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 740 }]) {
      await page.setViewportSize(size);
      await foods(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const boxes = await nav(page).getByRole('button').evaluateAll(nodes => nodes.map(node => ({ w: node.getBoundingClientRect().width, h: node.getBoundingClientRect().height })));
      boxes.forEach(box => { expect(box.w).toBeGreaterThanOrEqual(44); expect(box.h).toBeGreaterThanOrEqual(44); });
      await nav(page).getByRole('button', { name: 'Carb Calc', exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await root(page).getByRole('button', { name: 'Done', exact: true }).click();
    }
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => window.LandosTheme.setPreference('system'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});


test('Foods create edit favorite and delete preserve records and treatment settings', async ({ page }) => {
  await open(page); await seedLibrary(page); await foods(page);
  const before = await page.evaluate(key => { const data = JSON.parse(localStorage.getItem(key)); return { records: data.records, settings: data.settings, insulinPlans: data.insulinPlans }; }, key);
  await root(page).getByRole('button', { name: '+ Add New Food', exact: true }).click();
  const editor = root(page).locator('[data-food-library-editor]');
  await editor.getByLabel('Food Name', { exact: true }).fill('Acceptance test food');
  await editor.getByLabel('Carbs', { exact: true }).fill('18');
  await editor.getByLabel('Serving Label', { exact: true }).fill('1 portion');
  await editor.getByRole('button', { name: 'Save Food', exact: true }).click();
  const search = root(page).getByRole('searchbox', { name: 'Search foods and meals' });
  await search.fill('Acceptance test food');
  await root(page).getByRole('button', { name: 'Edit', exact: true }).click();
  await editor.getByLabel('Carbs', { exact: true }).fill('19');
  await editor.getByRole('button', { name: 'Save Food', exact: true }).click();
  await expect(root(page).locator('.lee_lee_diabetes_food_item')).toContainText('19 g');
  await root(page).getByRole('button', { name: 'Mark favorite', exact: true }).click();
  await expect(root(page).getByRole('button', { name: 'Remove favorite', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await root(page).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(root(page).locator('.lee_lee_diabetes_food_item')).toHaveCount(0);
  await root(page).getByRole('button', { name: 'My Meals', exact: true }).click();
  await root(page).getByRole('button', { name: 'Edit', exact: true }).click();
  await root(page).locator('[name="mealBuilderName"]').fill('Renamed synthetic meal');
  await root(page).locator('[data-action="save-saved-meal-builder"]').click();
  await expect(root(page).locator('.lee_lee_diabetes_food_item')).toContainText('Renamed synthetic meal');
  await root(page).locator('[data-action="toggle-saved-meal-favorite"]').click();
  page.once('dialog', dialog => dialog.accept());
  await root(page).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(root(page).locator('.lee_lee_diabetes_food_item')).toHaveCount(0);
  expect(await page.evaluate(key => { const data = JSON.parse(localStorage.getItem(key)); return { records: data.records, settings: data.settings, insulinPlans: data.insulinPlans }; }, key)).toEqual(before);
});

test('Foods prioritizes Recent when Favorites are empty', async ({ page }) => {
  await open(page); await seedLibrary(page);
  await page.evaluate(() => window.LeeLeeTrackerStorage.updateTrackerData(data => ({ ...data,
    foodLibrary: data.foodLibrary.map(food => ({ ...food, favorite: false })), savedMeals: data.savedMeals.map(meal => ({ ...meal, favorite: false })),
  })));
  await foods(page);
  await expect(root(page).locator('.lee_lee_diabetes_library_section').first()).toHaveAttribute('aria-label', 'Recent');
});


test('desktop keeps the centered LWVD-sized mobile canvas on every LLT destination', async ({ page }, testInfo) => {
  await open(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => window.LandosTheme.setPreference(theme), theme);
    for (const destination of ['Today', 'History', 'Carb Calc', 'Reports', 'Foods']) {
      await nav(page).getByRole('button', { name: destination, exact: true }).click();
      const canvas = await page.locator('#lee-lees-tracker-view').boundingBox();
      expect(canvas.width).toBe(480);
      expect(canvas.x).toBe(480);
      for (const selector of ['.digit_clock_header', '#lee-lee-diabetes-root', ...(destination === 'Carb Calc' ? [] : ['.lee_lee_diabetes_nav_shell'])]) {
        const bounds = await page.locator(`#lee-lees-tracker-view ${selector}`).boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(canvas.x);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(canvas.x + canvas.width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (destination === 'Carb Calc') await root(page).getByRole('button', { name: 'Done', exact: true }).click();
      if (destination === 'Today') {
        expect(await root(page).locator('.llt_sensor_actions').evaluate(node => getComputedStyle(node).flexDirection)).toBe('column');
        await page.screenshot({ path: testInfo.outputPath(`desktop-mobile-canvas-${theme}.png`) });
      }
    }
    await page.locator('#lee_lee_settings_toggle').click();
    await expect(root(page).getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    expect((await root(page).boundingBox()).width).toBeLessThanOrEqual(480);
    await nav(page).getByRole('button', { name: 'Today', exact: true }).click();
  }
});

test('all native LLT dropdowns have readable opaque options in Dark and Light', async ({ page }) => {
  await open(page);
  async function check(theme) {
    const dropdowns = page.locator('#lee-lees-tracker-view select:visible, .llt_sensor_dialog select:visible');
    expect(await dropdowns.count()).toBeGreaterThan(0);
    for (const select of await dropdowns.all()) {
      expect(await select.evaluate(node => getComputedStyle(node).colorScheme)).toBe(theme);
      const options = await select.locator('option').evaluateAll(nodes => nodes.map(node => ({
        color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor, disabled: node.disabled,
      })));
      for (const option of options) {
        expect(option.background).toBe(theme === 'dark' ? 'rgb(28, 28, 30)' : 'rgb(255, 255, 255)');
        expect(option.color).toBe(option.disabled ? (theme === 'dark' ? 'rgb(161, 161, 166)' : 'rgb(99, 99, 102)') : (theme === 'dark' ? 'rgb(255, 255, 255)' : 'rgb(28, 28, 30)'));
      }
    }
  }
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => window.LandosTheme.setPreference(theme), theme);
    await root(page).getByRole('button', { name: 'Log Entry', exact: true }).click();
    await check(theme);
    await root(page).locator('[name="type"]').selectOption('Snacks');
    await expect(root(page).locator('[name="type"]')).toHaveValue('Snacks');
    await root(page).locator('[data-lee-lee-editor] [data-action="cancel"]').click();
    await page.locator('#lee_lee_settings_toggle').click();
    // Open each section so its native selectors are also checked.
    await root(page).locator('details').evaluateAll(nodes => nodes.forEach(node => node.open = true));
    await check(theme);
    await nav(page).getByRole('button', { name: 'Reports', exact: true }).click();
    await check(theme);
    await nav(page).getByRole('button', { name: 'History', exact: true }).click();
    await root(page).locator('[data-action="open-history-filters"]').click();
    await check(theme);
    await root(page).locator('button[data-action="cancel-history-filters"]').click();
    await nav(page).getByRole('button', { name: 'Today', exact: true }).click();
    await page.locator('[data-sensor-action="history"]').click();
    await check(theme);
    await page.locator('.llt_sensor_dialog [data-sensor-action="close"]').click();
  }
});

test('standalone Done restores each launching destination and retains scratch state', async ({ page }, testInfo) => {
  await open(page);
  for (const destination of ['Today', 'History', 'Reports', 'Foods']) {
    await nav(page).getByRole('button', { name: destination, exact: true }).click();
    await nav(page).getByRole('button', { name: 'Carb Calc', exact: true }).click();
    await expect(root(page).locator('.lee_lee_diabetes_nav_shell, .lee_lee_diabetes_floating_log')).toHaveCount(0);
    if (destination === 'Today') {
      await root(page).getByRole('button', { name: '+ Add Manual Amount...' }).click();
      await root(page).locator('[name="carbItemCarbs"]').fill('17.5');
      await root(page).getByRole('button', { name: 'Add Item', exact: true }).click();
    }
    await expect(root(page).locator('[data-carb-calculator-total]')).toHaveText('17.5 g');
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => window.LandosTheme.setPreference(theme), theme);
      await root(page).getByRole('button', { name: 'Done', exact: true }).scrollIntoViewIfNeeded();
      if (destination === 'Today') await page.screenshot({ path: testInfo.outputPath(`standalone-actions-${theme}.png`) });
    }
    await root(page).getByRole('button', { name: 'Done', exact: true }).click();
    await expect(nav(page).getByRole('button', { name: destination, exact: true })).toHaveAttribute('aria-current', 'page');
  }
});

test('entry bottom Cancel and Use preserve the draft with no floating controls', async ({ page }, testInfo) => {
  await open(page);
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => window.LandosTheme.setPreference(theme), theme);
    await root(page).getByRole('button', { name: 'Log Entry', exact: true }).click();
    await root(page).locator('[name="type"]').selectOption('Snacks');
    await root(page).locator('[name="mealCarbs"]').fill('23');
    await root(page).locator('[name="notes"]').fill('Physical iPhone draft');
    await root(page).locator('[data-action="open-carb-calculator"]').click();
    await expect(root(page).locator('.lee_lee_diabetes_top [data-action="close-carb-calculator"]')).toHaveCount(0);
    await expect(root(page).locator('.lee_lee_diabetes_nav_shell, .lee_lee_diabetes_floating_log')).toHaveCount(0);
    const actions = root(page).locator('[data-carb-calculator-selection] > .lee_lee_diabetes_actions');
    await expect(actions.getByRole('button')).toHaveText(['Cancel', 'Use 23 g']);
    await actions.getByRole('button', { name: 'Cancel Carb Calculator' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`entry-actions-${theme}.png`) });
    await actions.getByRole('button', { name: 'Cancel Carb Calculator' }).click();
    await expect(root(page).locator('[name="mealCarbs"]')).toHaveValue('23');
    await expect(root(page).locator('[name="notes"]')).toHaveValue('Physical iPhone draft');
    await root(page).locator('[data-action="open-carb-calculator"]').click();
    await root(page).locator('[data-action="use-carb-calculator-total"]').click();
    await expect(root(page).locator('[name="mealCarbs"]')).toHaveValue('23');
    await expect(root(page).locator('[name="notes"]')).toHaveValue('Physical iPhone draft');
    await root(page).locator('[data-lee-lee-editor] [data-action="cancel"]').click();
  }
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).records, key)).toEqual([]);
});

test('History sheet fits portrait landscape and keyboard viewport with reachable actions', async ({ page }, testInfo) => {
  await open(page);
  await nav(page).getByRole('button', { name: 'History', exact: true }).click();
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => window.LandosTheme.setPreference(theme), theme);
    for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size);
      await root(page).locator('[data-action="open-history-filters"]').click();
      const sheet = root(page).locator('[data-history-filter-sheet]');
      await sheet.locator('[name="range"]').selectOption('custom');
      const bounds = await sheet.boundingBox();
      expect(bounds.y).toBeGreaterThanOrEqual(12);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height - 12);
      for (const action of ['cancel-history-filters', 'clear-history-filters', 'apply-history-filters']) {
        const box = await sheet.locator(`button[data-action="${action}"]`).boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(bounds.y);
        expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height);
      }
      await page.screenshot({ path: testInfo.outputPath(`history-${theme}-${size.width}.png`) });
      await page.evaluate(() => {
        Object.defineProperty(window.visualViewport, 'height', { configurable: true, get: () => 260 });
        Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, get: () => 45 });
        window.visualViewport.dispatchEvent(new Event('resize'));
      });
      const reduced = await sheet.boundingBox();
      expect(reduced.y).toBeGreaterThanOrEqual(57);
      expect(reduced.y + reduced.height).toBeLessThanOrEqual(293);
      expect(await sheet.locator('[data-history-filter-draft]').evaluate(node => getComputedStyle(node).overflowY)).toBe('auto');
      await sheet.locator('button[data-action="cancel-history-filters"]').click();
      await page.evaluate(() => { delete window.visualViewport.height; delete window.visualViewport.offsetTop; });
    }
  }
});

test('Foods four filters stay on one row at narrow iPhone widths', async ({ page }, testInfo) => {
  await open(page); await seedLibrary(page); await foods(page);
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => window.LandosTheme.setPreference(theme), theme);
    for (const width of [320, 375, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const filters = root(page).locator('.lee_lee_diabetes_library_filters');
      await expect(filters.getByRole('button')).toHaveText(['Browse All', 'Favorites', 'Recent', 'My Meals']);
      const boxes = await filters.getByRole('button').evaluateAll(nodes => nodes.map(node => ({ top: node.getBoundingClientRect().top, height: node.getBoundingClientRect().height, fits: node.scrollWidth <= node.clientWidth })));
      boxes.forEach(box => { expect(box.top).toBe(boxes[0].top); expect(box.height).toBeGreaterThanOrEqual(44); expect(box.fits).toBe(true); });
      expect(await filters.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath(`foods-four-${theme}.png`) });
  }
});

test('floating pill and plus hide down, restore up, ignore jitter and respect reduced motion', async ({ page }) => {
  await open(page); await seedLibrary(page); await foods(page);
  await root(page).getByRole('button', { name: 'Browse All', exact: true }).click();
  const shell = root(page).locator('.lee_lee_diabetes_nav_shell');
  await page.evaluate(() => scrollTo(0, 0));
  await expect(shell).not.toHaveClass(/is-scroll-hidden/);
  await nav(page).getByRole('button', { name: 'Foods', exact: true }).focus();
  await page.evaluate(() => scrollTo(0, 180));
  await expect(shell).toHaveClass(/is-scroll-hidden/);
  await page.waitForTimeout(250);
  expect((await shell.boundingBox()).y).toBeGreaterThan(page.viewportSize().height);
  expect((await root(page).locator('.lee_lee_diabetes_floating_log').boundingBox()).y).toBeGreaterThan(page.viewportSize().height);
  await page.evaluate(() => scrollTo(0, 177));
  await expect(shell).toHaveClass(/is-scroll-hidden/);
  await page.evaluate(() => scrollTo(0, 140));
  await expect(shell).not.toHaveClass(/is-scroll-hidden/);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(shell).toHaveClass(/is-scroll-hidden/);
  const last = root(page).locator('.lee_lee_diabetes_food_item').last().getByRole('button', { name: 'Delete', exact: true });
  await last.scrollIntoViewIfNeeded();
  expect(await last.evaluate(node => { const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); })).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(shell).not.toHaveClass(/is-scroll-hidden/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(shell).toHaveCSS('transition-duration', '0s');
});

test('Food and Meal panels have inset rounded edges, one Cancel and keyboard-safe actions', async ({ page }, testInfo) => {
  await open(page); await foods(page);
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => window.LandosTheme.setPreference(theme), theme);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const buttons = root(page).locator('.lee_lee_diabetes_food_library_actions > button');
      const widths = await buttons.evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));
      expect(widths[0]).toBeCloseTo(widths[1], 1);
      expect(await buttons.evaluateAll(nodes=>nodes[0].getBoundingClientRect().top===nodes[1].getBoundingClientRect().top)).toBe(true);
      for (const kind of ['Food', 'Meal']) {
        await root(page).getByRole('button', { name: `+ Add New ${kind}`, exact: true }).click();
        const panel = root(page).locator(kind === 'Food' ? '[data-food-library-editor-dialog]' : '[data-meal-builder]');
        await expect(panel.getByRole('heading', { name: `Add New ${kind}`, exact: true })).toBeVisible();
        await expect(panel.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(1);
        const box = await panel.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(12);
        expect(box.x+box.width).toBeLessThanOrEqual(width-12);
        expect(box.y).toBeGreaterThanOrEqual(12);
        expect(box.y+box.height).toBeLessThanOrEqual(832);
        await expect(panel).toHaveCSS('border-top-left-radius', '18px');
        expect(await panel.evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
        await page.evaluate(() => {
          Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>330});
          Object.defineProperty(window.visualViewport,'offsetTop',{configurable:true,get:()=>40});
          window.visualViewport.dispatchEvent(new Event('resize'));
        });
        await page.waitForTimeout(50);
        const reduced = await panel.boundingBox();
        expect(reduced.y).toBeGreaterThanOrEqual(52);
        expect(reduced.y+reduced.height).toBeLessThanOrEqual(358);
        const cancel = panel.getByRole('button', {name:'Cancel',exact:true});
        const cancelBox = await cancel.boundingBox();
        expect(cancelBox.y+cancelBox.height).toBeLessThanOrEqual(reduced.y+reduced.height);
        await page.evaluate(() => { delete window.visualViewport.height;delete window.visualViewport.offsetTop;window.visualViewport.dispatchEvent(new Event('resize')); });
        await page.waitForTimeout(50);
        if(width===390) await page.screenshot({path:testInfo.outputPath(`add-new-${kind.toLowerCase()}-${theme}.png`)});
        await cancel.click();
      }
    }
  }
});

test('focus rings remain visible inside scrollports in both themes and food draft Cancel is preserved', async ({ page }) => {
  await open(page); await foods(page); await page.setViewportSize({width:320,height:740});
  async function ring(control) {
    await page.keyboard.press('Tab');
    await control.focus(); await control.scrollIntoViewIfNeeded();
    const style=await control.evaluate(node=>{const s=getComputedStyle(node);return {style:s.outlineStyle,width:s.outlineWidth,offset:s.outlineOffset};});
    expect(style.style).toBe('solid');expect(parseFloat(style.width)).toBeGreaterThanOrEqual(2);
    expect(await control.evaluate(node=>{const r=node.getBoundingClientRect();for(let p=node.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);if(/auto|scroll|hidden/.test(s.overflowY)){const b=p.getBoundingClientRect();if(r.top<b.top-1||r.bottom>b.bottom+1)return false;}if(/auto|scroll|hidden/.test(s.overflowX)){const b=p.getBoundingClientRect();if(r.left<b.left-1||r.right>b.right+1)return false;}}return true;})).toBe(true);
  }
  for(const theme of ['dark','light']) {
    await page.evaluate(theme=>window.LandosTheme.setPreference(theme),theme);
    await ring(root(page).locator('[name="foodLibrarySearch"]'));
    await ring(root(page).locator('[data-collection="favorites"]'));
    await root(page).getByRole('button',{name:'+ Add New Food',exact:true}).click();
    const panel=root(page).locator('[data-food-library-editor-dialog]');
    await ring(panel.locator('[name="foodName"]'));
    await ring(panel.locator('[name="foodCarbs"]'));
    await ring(panel.locator('[name="foodFavorite"]'));
    await ring(panel.getByRole('button',{name:'Save Food',exact:true}));
    await panel.locator('[name="foodName"]').fill('Unsaved synthetic draft');
    page.once('dialog',dialog=>dialog.dismiss());
    await panel.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(panel).toBeVisible();
    page.once('dialog',dialog=>dialog.accept());
    await panel.getByRole('button',{name:'Cancel',exact:true}).click();
    await root(page).getByRole('button',{name:'Log Entry',exact:true}).click();
    await ring(root(page).locator('[name="type"]'));
    await root(page).locator('[data-lee-lee-editor] [data-action="cancel"]').click();
    await foods(page);
  }
});
