import { test, expect } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';
let server, base;
test.beforeAll(async () => {
  server = createIPhoneDevServer({ bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' }, getMetadata: async () => ({ environment: 'local-device', branch: 'feature/ecosystem-ui-actions', commit: 'test', commitFull: 'test', dirty: true, sourceId: 'ui-consistency' }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { await new Promise(resolve => server.close(resolve)); });
async function open(page, route) {
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.goto('about:blank');
  await page.goto(base + route);
}
async function pair(group) {
  const buttons = group.locator(':scope > button');
  const boxes = await buttons.evaluateAll(items => items.filter(b => !b.hidden).map(b => {
    const r = b.getBoundingClientRect(), s = getComputedStyle(b);
    return { width: r.width, height: r.height, radius: parseFloat(s.borderRadius), position: s.position };
  }));
  expect(boxes.length).toBeGreaterThan(0);
  for (const [index, box] of boxes.entries()) {
    expect(box.width).toBeGreaterThan(0); expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.radius).toBeGreaterThanOrEqual(999); expect(['fixed', 'sticky']).not.toContain(box.position);
    if (boxes.length > 1) {
      expect(Math.abs(box.width - boxes[0].width)).toBeLessThan(1);
      expect(Math.abs(box.height - boxes[0].height)).toBeLessThan(1);
    }
  }
}
for (const theme of ['light', 'dark', 'system']) {
  test(`${theme}: Settings gears switch to SVG X and restore without resizing`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    for (const [route, selector, closeSelector] of [
      ['/', '[data-lando-settings-toggle]', '#lando-settings-view [data-lando-settings-toggle]'],
      ['/#/digital-clock', '#digit_clock_menu_toggle'],
      ['/#/weather', '.weather_settings_toggle'],
      ['/#/lee-lees-tracker', '#lee_lee_settings_toggle'],
      ['/#/violet-futbol-game-tracker', '#vfgt_settings_toggle'],
      ['/#/maintenance-total', '#imt_settings_toggle'],
      ['/#/daily-chief-briefing', '.daily_briefing_icon_button[data-briefing-action="open-settings"]'],
    ]) {
      await open(page, route);
      await page.evaluate(theme => window.LandosTheme.setPreference(theme), theme);
      const button = page.locator(selector).filter({ visible: true }).first();
      const before = await button.boundingBox();
      await expect(button.locator('.settings_close_icon')).toBeHidden();
      await button.click();
      const close = page.locator(closeSelector || selector).filter({ visible: true }).first();
      await expect(close).toHaveAttribute('aria-expanded', 'true');
      await expect(close.locator('.settings_close_icon')).toBeVisible();
      const after = await close.boundingBox();
      expect(after.width).toBe(before.width); expect(after.height).toBe(before.height);
      if (route.includes('daily-chief-briefing')) await page.locator('[data-briefing-action="close-dialog"]').filter({ visible: true }).click();
      else await close.click();
      await expect(page.locator(selector).filter({ visible: true }).first().locator('.settings_close_icon')).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
  });
  test(`${theme}: representative form actions in Briefing, Weather, Sprints, Checklist, iMT and VFGT`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await open(page, '/#/daily-chief-briefing');
    await page.evaluate(t => window.LandosTheme.setPreference(t), theme);
    await page.locator('.daily_briefing_icon_button[data-briefing-action="open-settings"]').click();
    await pair(page.locator('#daily-briefing-settings-dialog .daily_briefing_dialog_actions'));
    await open(page, '/#/weather'); await page.locator('.weather_settings_toggle').click();
    const set = page.locator('.weather_settings_location_row > button');
    await expect(set).toHaveCSS('border-radius', '9999px');
    await open(page, '/#/violet-sprints'); await page.locator('[data-action="create"]').click();
    await expect(page.locator('[data-action="save"]')).toHaveCSS('border-radius', '9999px');
    await open(page, '/#/road-bike-checklist'); await page.locator('[data-road-bike-action="reset"]').click();
    await pair(page.locator('.road_bike_confirm__actions'));
    await expect(page.locator('.road_bike_confirm__actions button').first()).toHaveText('Cancel');
    await open(page, '/#/maintenance-total');
    await page.locator('[data-imt-nav="assets"]').filter({ visible: true }).first().click();
    await page.locator('[data-action="add-bike"]').click();
    await pair(page.locator('#imt-form .imt_actions'));
    await expect(page.locator('#imt-form .imt_actions button').first()).toHaveText('Cancel');
    await open(page, '/#/violet-futbol-game-tracker'); await page.locator('#vfgt_settings_toggle').click();
    await page.getByRole('button', { name: 'Manage Teams', exact: true }).click();
    const addTeam = page.getByRole('button', { name: /Add Team/ }).first();
    await addTeam.click(); await pair(page.locator('.vfgt_form .vfgt_actions'));
  });
}
for (const theme of ['light', 'dark', 'system']) {
  test(`${theme}: LWVD complete action-flow inventory keeps pair ordering and mobile bounds`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await open(page, '/#/violet-dineros');
    await page.evaluate(theme => {
      window.LandosTheme.setPreference(theme);
      localStorage.setItem('lando-world:lwvd:v1', JSON.stringify({ firstName: 'Violet', balanceCents: 100000, payday: '', frequency: '', onboarded: true,
        transactions: [{ id: 'income', type: 'income', amountCents: 500, label: 'Gift', description: 'Test money', createdAt: '2026-10-25T12:00:00.000Z' }],
        goals: [{ id: 'bike', name: 'Bike', emoji: '🚲', targetCents: 10000, reservedCents: 1000, archived: false }] }));
    }, theme);
    await page.reload();
    // Phase 2: LWVD long forms and details render as pages in the tab
    // content; only the small confirmations still use the sheet dialog.
    // The presenting surface is the last visible transaction panel (an open
    // confirmation dialog sits after the page in the DOM).
    const surface = () => page.locator('.transaction-panel:visible').last();
    async function check(expectedFirst = 'Cancel') {
      await pair(surface().locator('.sheet-actions'));
      if ((await surface().locator('.sheet-actions').getAttribute('class')).includes('sheet-actions--stacked')) {
        await expect(surface().locator('.sheet-actions > button').first()).toHaveClass(/primary/);
        await expect(surface().locator('.sheet-actions > button').last()).toHaveText('Cancel');
      } else await expect(surface().locator('.sheet-actions > button').first()).toHaveText(expectedFirst);
      await expect(surface().locator('[data-sheet-close] svg')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    async function quick(name) { await page.evaluate(() => { scrollTo(0, 1); scrollTo(0, 0); }); await page.locator('#quick-actions-toggle').click(); await page.getByRole('button', { name, exact: true }).click(); }
    for (const name of ['Add Money', 'Add Expense']) {
      await quick(name); await check();
      await surface().locator('button[type="submit"]').click();
      await expect(surface().locator('.error')).not.toBeEmpty();
      await surface().locator('#transaction-cancel').click();
    }
    await quick('Can I Afford This?');
    await expect(page.locator('#afford-back svg')).toBeVisible();
    await expect(page.locator('#afford-buy')).toHaveCSS('border-radius', '9999px');
    await page.locator('#afford-back').click();
    await page.getByRole('button', { name: 'Goals', exact: true }).click();
    await page.getByRole('button', { name: 'Create Goal', exact: true }).click(); await check();
    await surface().locator('[data-cancel]').click();
    for (const id of ['goal-edit', 'goal-reserve', 'goal-release', 'goal-buy', 'goal-archive', 'goal-delete']) {
      await page.getByRole('button', { name: 'Manage Goal: Bike', exact: true }).click();
      await surface().locator('#' + id).click(); await check();
      // The close control abandons the whole flow (page or page + confirm).
      await surface().locator('[data-sheet-close]').click();
    }
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
    await page.locator('[data-transaction-id="income"]').click(); await check('Delete');
    await surface().locator('#transaction-edit').click(); await check(); await surface().locator('#transaction-cancel').click();
    await page.locator('[data-transaction-id="income"]').click(); await surface().locator('#transaction-delete').click(); await check();
    await surface().locator('[data-sheet-close]').click();
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.locator('#settings').click();
    await expect(page.locator('#settings[aria-expanded="true"] svg')).toBeVisible();
    await expect(page.locator('#settings-back')).toHaveCount(0); await pair(page.locator('.settings-actions'));
    await page.locator('#edit-starting-balance').click(); await pair(page.locator('.settings-panel .sheet-actions'));
    await expect(page.locator('.settings-panel .sheet-actions > button').first()).toHaveText('Cancel');
    await page.locator('#balance-cancel').click(); await page.locator('#settings').click();
    await expect(page.locator('#settings svg')).toBeVisible();
  });
}

test('Pre-Meal Timer retains its original navigation and purpose-built controls', async ({ page }) => {
  await open(page, '/#/lee-lees-tracker');
  await page.evaluate(() => window.LeeLeePreMealTimer.start({ durationMinutes: 15, sourceEntryId: 'test-meal' }));
  await page.locator('#lee-lee-diabetes-root [data-action="today"]').first().click();
  await page.locator('[data-action="open-pre-meal-timer"]').click();
  const modal = page.locator('.lee_lee_diabetes_pre_meal_timer_modal');
  await expect(modal.locator('.lee_lee_diabetes_pre_meal_timer_header button')).toHaveText('‹');
  await expect(modal.locator('.lee_lee_diabetes_back_link')).toHaveCount(0);
  expect(await modal.locator('.lee_lee_diabetes_pre_meal_timer_actions button').allTextContents()).toEqual(['-1 min', 'Stop', '+1 min', 'Back']);
  await modal.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(modal).toHaveCount(0);
});

for (const theme of ['light', 'dark', 'system']) test(`${theme}: iMT and LWVD Settings retain their header controls and full-width actions`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/#/maintenance-total');
  await page.evaluate(t => window.LandosTheme.setPreference(t), theme);
  const imt = page.locator('#imt_settings_toggle'); const imtBox = await imt.boundingBox();
  await imt.click(); await expect(page.locator('.imt_add_button')).toHaveCount(0);
  await expect(imt.locator('.settings_close_icon')).toBeVisible(); expect(await imt.boundingBox()).toEqual(imtBox);
  for (const action of ['export', 'restore', 'reset']) {
    const button = page.locator(`#maintenance-total-root [data-action="${action}"]`);
    expect(await button.evaluate(n => { const s = getComputedStyle(n.parentElement); return Math.abs(n.getBoundingClientRect().width - (n.parentElement.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight))); })).toBeLessThan(2);
  }
  await imt.click(); await expect(page.locator('.imt_add_button')).toHaveCount(1);
  await open(page, '/#/violet-dineros');
  await page.evaluate(t => { window.LandosTheme.setPreference(t); localStorage.setItem('lando-world:lwvd:v1', JSON.stringify({ firstName: 'Violet', balanceCents: 10000, payday: '', frequency: '', onboarded: true })); }, theme);
  await page.reload();
  const gear = page.locator('#settings'), before = await gear.boundingBox();
  await gear.click(); await expect(gear).toHaveAttribute('aria-label', 'Close Settings');
  await expect(page.locator('.app-heading .brand')).toBeVisible();
  await expect(page.locator('#settings-back')).toHaveCount(0);
  expect(await gear.boundingBox()).toEqual(before);
  await gear.click(); await expect(gear).toHaveAttribute('aria-label', 'Settings');
});
