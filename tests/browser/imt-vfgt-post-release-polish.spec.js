import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const shippedImtCss = execFileSync('git', ['show', '9da5e289a1c261c3686852140728664e8ebe70af:css/maintenance-total.css'], { encoding: 'utf8' });
const theme = async (page, value) => {
  await page.evaluate(value => window.LandosTheme.setPreference(value), value);
  await page.waitForTimeout(250);
};
const treatment = locator => locator.evaluate(el => {
  const s = getComputedStyle(el), r = el.getBoundingClientRect();
  return { color: s.color, background: s.backgroundColor, border: s.borderColor, width: r.width, height: r.height };
});

for (const width of [320, 768, 1280]) {
  test(`iMT cog preserves light surface and shipped dark states at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/css/maintenance-total.css*', route => route.fulfill({ body: shippedImtCss, contentType: 'text/css' }));
    await page.goto('/#/maintenance-total');
    await theme(page, 'dark');
    const cog = page.locator('#imt_settings_toggle');
    const darkHome = await treatment(cog);
    await page.locator('.imt_nav_button[data-imt-nav="more"]').click();
    await page.waitForTimeout(250);
    const darkMore = await treatment(cog);
    await page.unroute('**/css/maintenance-total.css*');
    await page.reload();
    await page.locator('.imt_nav_button[data-imt-nav="home"]').click();
    await theme(page, 'dark');
    expect(await treatment(cog)).toEqual(darkHome);
    await page.locator('.imt_nav_button[data-imt-nav="more"]').click();
    await page.waitForTimeout(250);
    expect(await treatment(cog)).toEqual(darkMore);
    await page.locator('.imt_nav_button[data-imt-nav="home"]').click();
    await theme(page, 'light');
    const lightHome = await treatment(cog);
    expect(lightHome.color).toBe('rgb(57, 69, 82)');
    await page.locator('.imt_nav_button[data-imt-nav="more"]').click();
    await page.waitForTimeout(250);
    expect(await treatment(cog)).toEqual(lightHome);
    await expect(page.locator('.imt_nav_button[data-imt-nav="more"]')).toHaveClass(/is-active/);
    await expect(page.locator('.imt_nav_button.is-active .imt_nav_icon')).toHaveCSS('color', 'rgb(100, 216, 203)');
  });

  test(`VFGT Start Game is green while Cancel and Delete retain semantics at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/violet-futbol-game-tracker');
    const saved = await page.evaluate(() => {
      const api = window.VioletFutbolGameTracker;
      const settings = JSON.parse(localStorage.getItem(api.SETTINGS_KEY));
      const game = { ...api.createGame({ team1: 'Violet', team2: 'Polish Fixture', date: '2027-01-01', time: '18:00', teamId: settings.currentTeamId, seasonId: settings.currentSeasonId }), status: 'scheduled', phase: 'pregame' };
      const value = JSON.stringify([game]);
      localStorage.setItem(api.SAVED_GAMES_KEY, value);
      return value;
    });
    await page.reload();
    await page.locator('.vfgt_accordion summary').filter({ hasText: 'Future Games' }).click();
    for (const mode of ['light', 'dark']) {
      await theme(page, mode);
      await page.getByRole('button', { name: 'Quick Start', exact: true }).click();
      const dialog = page.getByRole('alertdialog');
      const start = dialog.getByRole('button', { name: 'Start Game', exact: true });
      await expect(start).toHaveClass(/vfgt_button--success/);
      await expect(start).not.toHaveClass(/vfgt_button--danger/);
      await expect(start).toHaveCSS('background-color', 'rgb(20, 108, 67)');
      await expect(start).toHaveCSS('color', 'rgb(255, 255, 255)');
      const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
      await expect(cancel).toHaveClass('vfgt_button');
      const neutral = await treatment(cancel);
      await cancel.click();
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      const deletion = dialog.getByRole('button', { name: 'Delete Game', exact: true });
      await expect(deletion).toHaveClass(/vfgt_button--danger/);
      expect(await deletion.evaluate(el => { const c = getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number); return c[0] > c[1] && c[0] > c[2]; })).toBe(true);
      expect(await treatment(cancel)).toEqual(neutral);
      await cancel.click();
      expect(await page.evaluate(() => localStorage.getItem(window.VioletFutbolGameTracker.SAVED_GAMES_KEY))).toBe(saved);
    }
  });
}
