// Regression coverage for the Meal Builder scrolling interference
// (pre-merge correction for PR #232, finding 3).
//
// The shared focus-visibility watcher (js/landos-world-modal-utils.js)
// answers visualViewport pan/resize events — which iOS fires
// continuously while the user scrolls with the keyboard open — by
// scrolling the window back to the focused control. Page surfaces opt
// out with data-preserve-document-scroll-on-viewport-pan, the attribute
// the record editor and carb item editor already carry; the Meal
// Builder page did not, so any pan snapped the page back to the focused
// field, undoing the user's scroll (reproduced at 600px before the fix).
import { expect, test } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';

let server;
let baseURL;
test.beforeAll(async () => {
  server = createIPhoneDevServer({ bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' }, getMetadata: async () => ({ environment: 'local-device', appVersion: '1.0.0', branch: 'meal-builder-scroll-test', commit: 'test', commitFull: 'test', dirty: true, sourceId: 'meal-builder-scroll-test' }) });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { if (server?.listening) await new Promise((resolve) => server.close(resolve)); });

const meals = [
  { id: 'long', name: 'Long meal', totalCarbs: 90, favorite: false, components: Array.from({ length: 9 }, (_, i) => ({ id: `long-${i}`, componentType: 'food', foodId: `f-${i}`, nameSnapshot: `Component number ${i} with a reasonably long name`, emojiSnapshot: '🍎', carbsPerServing: 10, quantity: 1, carbTotal: 10 })) },
];

async function openBuilder(page) {
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(`${baseURL}/#/lee-lees-tracker`);
  await expect(page.locator('#lws-local-dev-badge')).toHaveText('LOCAL DEV');
  await page.waitForFunction(() => Boolean(window.LeeLeeTrackerStorage));
  await page.evaluate((savedMeals) => window.LeeLeeTrackerStorage.updateTrackerData((current) => ({ ...current, savedMeals })), meals);
  await page.getByLabel('Lee-Lee’s Tracker mobile navigation').getByRole('button', { name: 'Foods', exact: true }).click();
  await page.getByRole('button', { name: 'My Meals', exact: true }).click();
  await page.locator('[data-action="edit-saved-meal"][data-id="long"]').click();
  await expect(page.locator('[data-meal-builder]')).toBeVisible();
}

async function fireViewportPan(page) {
  await page.evaluate(() => {
    window.visualViewport?.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
  });
  await page.waitForTimeout(400);
}

test('scrolling in the Meal Builder is not undone by viewport-pan corrections', async ({ page }) => {
  await openBuilder(page);
  // The builder page carries the same opt-out as the other page editors.
  await expect(page.locator('[data-meal-builder]')).toHaveAttribute('data-preserve-document-scroll-on-viewport-pan', '');
  const name = page.locator('[data-meal-builder] [name="mealBuilderName"]');
  await name.click();
  const scrollY = () => page.evaluate(() => window.scrollY);
  await page.mouse.move(195, 400);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(150);
  const userPosition = await scrollY();
  expect(userPosition).toBeGreaterThan(400);
  await fireViewportPan(page);
  expect(await scrollY()).toBe(userPosition);
  // Same protection with a component carbs field focused mid-list.
  const componentCarbs = page.locator('[data-meal-builder-component-carbs]').nth(4);
  await componentCarbs.scrollIntoViewIfNeeded();
  await componentCarbs.click();
  await page.mouse.wheel(0, -350);
  await page.waitForTimeout(150);
  const componentPosition = await scrollY();
  await fireViewportPan(page);
  expect(await scrollY()).toBe(componentPosition);
  // Editing and saving still work end to end.
  await name.fill('Long meal edited');
  await page.locator('[data-meal-builder] [data-action="save-saved-meal-builder"]').click();
  await expect(page.locator('#lee-lee-foods-panel')).toContainText('Long meal edited');
});
