import { test, expect } from '@playwright/test';
const key = 'lando-world:maintenance-total:v1';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(key => {
    if (localStorage.getItem(key) !== null) return;
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      bikes: ['madone', 'mandalorian', 'el-viento'].map(id => ({ id, name: id, active: true })),
      components: [{ id: 'madone-brakes', assetId: 'madone', name: 'Brakes' }],
      records: [],
    }));
  }, key);
});
test('general Add requires an asset and persists the chosen bike across reload and edit', async ({ page }) => {
  await page.goto('/#/maintenance-total');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const asset = page.getByLabel('Asset *', { exact: true });
  await expect(asset).toHaveValue('');
  await page.getByLabel('Record type *', { exact: true }).selectOption('Clean');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect(await asset.evaluate(el => el.validity.valueMissing)).toBe(true);
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).records, key)).toEqual([]);
  await asset.selectOption('mandalorian');
  await page.getByLabel('Record type *', { exact: true }).selectOption('Clean');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved successfully.')).toBeVisible();
  await expect.poll(() => page.evaluate(k => JSON.parse(localStorage.getItem(k)).records.at(-1).assetId, key)).toBe('mandalorian');
  await page.reload();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.locator('.imt_card').filter({ hasText: 'Clean ·' }).getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(asset).toHaveValue('mandalorian');
});
test('component context is visible and changing assets clears the old component', async ({ page }) => {
  await page.goto('/#/maintenance-total');
  await page.getByRole('button',{name:'Garage',exact:true}).click();

  await page.locator('[data-bike="madone"]').click();
  await page.locator('[data-component="madone-brakes"]').click();
  await page.getByRole('button', { name: '＋ Add Service Record' }).click();
  await expect(page.getByLabel('Asset *', { exact: true })).toHaveValue('madone');
  await expect(page.getByLabel('Task')).toHaveValue('madone-brakes');
  await page.getByLabel('Record type *', { exact: true }).selectOption('Inspect');
  await page.getByLabel('Notes').fill('Keep this draft');
  await page.getByLabel('Asset *', { exact: true }).selectOption('el-viento');
  await expect(page.getByLabel('Task')).toHaveValue('');
  await expect(page.getByLabel('Notes')).toHaveValue('Keep this draft');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).records.at(-1), key);
  expect(saved.assetId).toBe('el-viento');
  expect(saved.componentId).toBeUndefined();
});
