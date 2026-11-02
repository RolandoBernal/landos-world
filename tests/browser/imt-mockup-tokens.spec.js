import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const KEY = 'lando-world:maintenance-total:v1';
for (const theme of ['light', 'dark']) {
  for (const width of [320, 390]) {
    test(`tokens, navigation and form clearance ${theme} ${width}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/#/maintenance-total');
      await page.evaluate(t => window.LandosTheme.setPreference(t), theme);
      const view = page.locator('#maintenance-total-view');
      const nav = page.locator('.imt_bottom_nav');
      const before = await page.evaluate(k => localStorage.getItem(k), KEY);
      expect((await view.evaluate(el => getComputedStyle(el).fontFamily)).replaceAll('"', '')).toBe('Outfit, system-ui, -apple-system, Segoe UI, sans-serif');
      await expect(nav).toHaveCSS('background-color', theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(23, 33, 29)');
      await expect(nav).toHaveCSS('border-radius', '36px');
      await expect(nav.locator('button:not(.is-active)').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(nav.locator('button')).toHaveText(['Today', 'Garage', 'Plan', 'History']);
      const n = await nav.boundingBox(), plus = await page.locator('.imt_add_button').boundingBox();
      expect(plus.width).toBe(56); expect(plus.height).toBe(56);
      expect(plus.x + plus.width).toBeCloseTo(n.x + n.width, 0);
      expect(plus.y + plus.height + 12).toBeCloseTo(n.y, 0);
      expect(n.y + n.height).toBeLessThanOrEqual(832);
      await expect(page.locator('.imt_status--attention').first()).toHaveCSS('background-color', 'rgb(251, 227, 219)');
      await page.screenshot({ path: info.outputPath(`${theme}-${width}-today.png`), fullPage: true });
      const floating = page.locator('.imt_floating_controls');
      await page.evaluate(() => scrollTo(0, 180));
      await expect(floating).toHaveClass(/is-scroll-hidden/);
      await page.evaluate(() => scrollBy(0, -50));
      await expect(floating).not.toHaveClass(/is-scroll-hidden/);
      await page.evaluate(() => scrollTo(0, 0));
      for (const [label, heading] of [['Garage', 'Garage'], ['Plan', 'Plan'], ['History', 'Maintenance History'], ['Today', 'Today']]) {
        await nav.getByRole('button', { name: label, exact: true }).click();
        await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
        await expect(nav.getByRole('button', { name: label })).toHaveAttribute('aria-current', 'page');
        if (label !== 'History') await expect(page.locator('[data-imt-temporary-route]')).toBeVisible();
      }
      await page.locator('#imt_settings_toggle').click();
      await expect(page.getByRole('heading', { name: 'Settings', exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Download maintenance JSON' })).toBeVisible();
      await expect(nav.locator('[aria-current]')).toHaveCount(0);
      await page.locator('#imt_settings_toggle').click();
      await page.locator('.imt_add_button').click();
      await expect(page.locator('.imt_add_button')).toHaveCount(0);
      await page.getByLabel('Cost', { exact: true }).fill('12.34');
      expect((await page.getByLabel('Cost', { exact: true }).evaluate(el => getComputedStyle(el).fontFamily)).replaceAll('"', '')).toBe('IBM Plex Mono, ui-monospace, monospace');
      await page.getByLabel('Notes', { exact: true }).focus();
      await expect(page.locator('.imt_floating_controls')).toHaveClass(/is-form-focused/);
      await page.setViewportSize({ width, height: 360 });
      for (const label of ['Save', 'Cancel']) {
        const button = page.getByRole('button', { name: label, exact: true });
        await button.focus();
        await expect.poll(async () => { const r = await button.boundingBox(); return r.y + r.height; }).toBeLessThanOrEqual(344);
        await expect(button).toHaveCSS('min-height', '56px');
      }
      await page.setViewportSize({ width, height: 844 });
      await page.screenshot({ path: info.outputPath(`${theme}-${width}-form.png`), fullPage: true });
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBe(before);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.evaluate(() => window.LandosTheme.setPreference('system'));
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'light' ? 'dark' : 'light');
    });
  }
}
for (const raw of ['{broken', '{"version":2}', '{"version":1,"bikes":{},"components":[],"records":[]}']) {
  test(`protected storage and exact raw JSON export ${raw}`, async ({ page }, info) => {
    await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key: KEY, raw });
    await page.goto('/#/maintenance-total');
    for (const label of ['Today', 'Garage', 'Plan', 'History']) {
      await page.locator('.imt_bottom_nav').getByRole('button', { name: label }).click();
      await expect(page.getByRole('alert')).toContainText('Editing is disabled');
      await expect(page.locator('form#imt-form')).toHaveCount(0);
      expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBe(raw);
    }
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download maintenance JSON' }).click();
    const download = await pending;
    const path = info.outputPath('maintenance.json');
    await download.saveAs(path);
    expect(await readFile(path, 'utf8')).toBe(raw);
  });
}
