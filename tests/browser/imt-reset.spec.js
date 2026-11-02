import { test, expect } from '@playwright/test';

const key = 'lando-world:maintenance-total:v1';
const preservedKeys = ['another-app:data', 'landos_world_appearance_preference_v1', 'landos_world_my_apps_v1'];
const empty = { version: 1, bikes: [], components: [], records: [] };
const existing = {
  version: 1,
  bikes: [{ id: 'bike', name: 'Existing bike', active: true }],
  components: [{ id: 'chain', assetId: 'bike', name: 'Chain' }],
  records: [{ id: 'clean', assetId: 'bike', componentId: 'chain', date: '2026-01-01' }],
};

test('reset requires confirmation, replaces only iMT data, and persists after reload', async ({ page }) => {
  await page.addInitScript(({ key, existing }) => {
    if (localStorage.getItem(key) !== null) return;
    localStorage.setItem(key, JSON.stringify(existing));
    localStorage.setItem('another-app:data', 'keep');
    localStorage.setItem('landos_world_appearance_preference_v1', 'dark');
    localStorage.setItem('landos_world_my_apps_v1', JSON.stringify({
      schemaVersion: 1,
      visibleAppIds: ['maintenance-total'],
      appOrder: ['maintenance-total'],
    }));
  }, { key, existing });
  await page.goto('/#/maintenance-total');
  const snapshot = () => page.evaluate(keys =>
    Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), [key, ...preservedKeys]);
  const before = await snapshot();
  await page.getByRole('button', { name: 'Garage', exact: true }).click();
  await page.locator('[data-bike="bike"]').click();
  await page.locator('#imt_settings_toggle').click();
  const reset = page.getByRole('button', { name: 'Reset iMT Data', exact: true });
  await expect(reset).toBeVisible();
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toMatch(/Permanently delete all iMT assets, components, and maintenance records.*this browser or installed PWA/);
    await dialog.dismiss();
  });
  await reset.click();
  expect(await snapshot()).toEqual(before);
  page.once('dialog', dialog => dialog.accept());
  await reset.click();
  await expect(page.locator('[data-reset-status]')).toHaveText('iMT data has been reset.');
  const after = { ...before, [key]: JSON.stringify(empty) };
  expect(await snapshot()).toEqual(after);
  await page.locator('#imt_settings_toggle').click();
  await page.reload();
  await page.getByRole('button', { name: 'Garage', exact: true }).click();
  await expect(page.locator('.imt_asset_card')).toHaveCount(0);
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.locator('.imt_record_card')).toHaveCount(0);
  expect(await snapshot()).toEqual(after);
});

test('reset protects unsupported data written while Settings is open', async ({ page }) => {
  await page.goto('/#/maintenance-total');
  await page.locator('#imt_settings_toggle').click();
  const raw = '{"version":2}';
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Reset iMT Data', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Editing is disabled');
  await expect(page.getByRole('button', { name: 'Reset iMT Data' })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
});

const backup = {
  ...existing,
  bikes: [{ ...existing.bikes[0], currentMileage: 432.5, brand: 'Example', notes: 'Keep me' }],
  components: [{ ...existing.components[0], intervalMiles: 500, estCost: 12.5 }],
  records: [{ ...existing.records[0], taskType: 'Clean', cost: 12.5, mileage: 400, serviceProvider: 'Bike shop' }],
};

async function selectBackup(page, raw) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Restore maintenance JSON' }).click();
  await (await chooser).setFiles({ name: 'maintenance.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
}

test('download, reset and restore preserve the backup across reload and isolate storage', async ({ page }) => {
  await page.goto('/#/maintenance-total');
  const otherOrigin = await page.context().newPage();
  await otherOrigin.route('http://imt-storage.test/', route => route.fulfill({ body: 'Separate origin' }));
  await otherOrigin.goto('http://imt-storage.test/');
  await otherOrigin.evaluate(key => localStorage.setItem(key, 'separate origin data'), key);
  await page.evaluate(({ key, backup }) => {
    localStorage.setItem(key, JSON.stringify(backup));
    localStorage.setItem('another-app:data', 'keep');
  }, { key, backup });
  await page.reload();
  await page.locator('#imt_settings_toggle').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download maintenance JSON' }).click();
  const chunks = [];
  for await (const chunk of await (await download).createReadStream()) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString();
  expect(JSON.parse(raw)).toEqual(backup);

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Reset iMT Data' }).click();
  await expect(page.locator('[data-reset-status]')).toHaveText('iMT data has been reset.');
  const cancelled = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.message()).toContain('replaces only this installation’s iMT assets, components, and maintenance records');
    await dialog.dismiss();
  });
  await selectBackup(page, raw);
  await cancelled;
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).toEqual(empty);

  page.once('dialog', dialog => dialog.accept());
  await selectBackup(page, raw);
  await expect(page.locator('[data-restore-status]')).toHaveText('iMT data has been restored.');
  await page.locator('#imt_settings_toggle').click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.locator('.imt_record_card')).toContainText('Bike shop');
  await expect(page.locator('.imt_record_card')).toContainText('$12.50');
  await page.reload();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
  expect(await page.evaluate(() => localStorage.getItem('another-app:data'))).toBe('keep');
  expect(await otherOrigin.evaluate(key => localStorage.getItem(key), key)).toBe('separate origin data');
});

test('restore rejects invalid files and protects existing unreadable or unsupported storage', async ({ page }) => {
  await page.goto('/#/maintenance-total');
  await page.evaluate(({ key, backup }) => localStorage.setItem(key, JSON.stringify(backup)), { key, backup });
  await page.reload();
  await page.locator('#imt_settings_toggle').click();
  const status = page.locator('[data-restore-status]');
  for (const [raw, message] of [
    ['{', 'Unable to read'],
    [JSON.stringify({ ...backup, version: 2 }), 'valid version 1'],
    [JSON.stringify({ ...backup, bikes: {} }), 'valid version 1'],
    [JSON.stringify({ ...backup, records: [{ ...backup.records[0], cost: {} }] }), 'valid version 1'],
  ]) {
    await selectBackup(page, raw);
    await expect(status).toContainText(message);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).toEqual(backup);
  }
  for (const raw of ['{', '{"version":2}']) {
    await page.evaluate(({ key, backup }) => localStorage.setItem(key, JSON.stringify(backup)), { key, backup });
    await page.reload();
    await page.locator('#imt_settings_toggle').click();
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
    await selectBackup(page, JSON.stringify(backup));
    await expect(page.getByRole('alert')).toContainText('Editing is disabled');
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
  }
});
