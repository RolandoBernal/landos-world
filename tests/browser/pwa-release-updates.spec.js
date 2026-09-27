import { expect, test } from '@playwright/test';

const runningSha = 'a'.repeat(40);
const deployedSha = 'b'.repeat(40);

function contrastRatio(foreground, background) {
  const luminance = (color) => {
    const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test.beforeEach(async ({ page }) => {
  await page.route('**/.local/landos-world-build-metadata.js*', (route) => route.fulfill({
    contentType: 'text/javascript',
    body: `window.LandoWorldBuildMetadata = Object.freeze({ environment: 'production', appVersion: '2026-09-26-41', releaseVersion: '2026-09-26-41', commit: '${runningSha.slice(0, 7)}', commitFull: '${runningSha}', dirty: false });`,
  }));
  await page.route('**/deployment-version.json?*', (route) => route.fulfill({
    contentType: 'application/json',
    headers: { 'Cache-Control': 'no-store' },
    body: JSON.stringify({
      releaseVersion: '2026-09-26-42',
      commitFull: deployedSha,
      shortCommit: deployedSha.slice(0, 7),
      deploymentRun: '42',
      builtAt: '2026-09-26T20:46:11.000Z',
    }),
  }));
});

test('deployed release status, Later, foreground re-check, and safe update blocker', async ({ page }) => {
  await page.goto('/#/settings');
  const status = page.locator('#pwa-offline-settings');
  const notice = page.locator('#pwa-toast');

  await expect(notice).toContainText('Update Available');
  await expect(notice).toContainText('Lando’s World 2026-09-26-42 is ready.');
  await expect(notice).toContainText('You’re currently using 2026-09-26-41.');
  await expect(status).toContainText('Running Version');
  await expect(status).toContainText('Latest Version');
  await expect(status).toContainText('Update available');
  await expect(status).toContainText(runningSha.slice(0, 7));

  await notice.getByRole('button', { name: 'Later' }).click();
  await expect(notice).toBeHidden();
  await page.evaluate(() => window.LandosPWA.checkForUpdates({ resurface: true }));
  await expect(notice).toBeVisible();

  await page.evaluate(() => {
    const form = document.createElement('form');
    form.setAttribute('data-test-update-blocker', '');
    const field = document.createElement('input');
    field.name = 'unsaved';
    form.append(field);
    document.body.append(form);
    field.focus();
  });
  expect(await page.evaluate(() => window.LandosPWA.getState().updateBlocked)).toBe(false);
  await page.evaluate(() => {
    window.testUnregisterUpdateBlocker = window.LandosPWA.registerUpdateBlocker('test editor', () => 'Save the test editor first.');
  });
  await expect(notice).toContainText('Save the test editor first.');
  await notice.getByRole('button', { name: 'Update Now' }).click();
  await expect(notice).toContainText('Save the test editor first.');
  await expect(page).toHaveURL(/#\/settings$/);
});

test('update notice fits mobile and desktop viewports with clear actions in dark and light themes', async ({ page }) => {
  await page.goto('/#/settings');
  const notice = page.locator('#pwa-toast');
  await expect(notice).toContainText('Update Available');

  for (const { width, height, theme } of [
    { width: 390, height: 844, theme: 'dark' },
    { width: 390, height: 844, theme: 'light' },
    { width: 320, height: 640, theme: 'dark' },
    { width: 768, height: 1024, theme: 'dark' },
    { width: 1280, height: 900, theme: 'dark' },
    { width: 1280, height: 900, theme: 'light' },
  ]) {
    await page.setViewportSize({ width, height });
    await page.mouse.move(1, 1);
    await page.locator('html').evaluate((root, appearance) => root.setAttribute('data-theme', appearance), theme);

    const metrics = await notice.evaluate((element) => {
      const box = (node) => {
        const { x, y, width: itemWidth, height: itemHeight } = node.getBoundingClientRect();
        return { x, y, width: itemWidth, height: itemHeight };
      };
      const actionButtons = [...element.querySelectorAll('.pwa_update_actions button')];
      const version = element.querySelector('.pwa_version_token');
      const range = document.createRange();
      range.selectNodeContents(version);
      const styles = getComputedStyle(actionButtons[0]);
      return {
        notice: box(element),
        buttons: actionButtons.map(box),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        versionWhiteSpace: getComputedStyle(version).whiteSpace,
        versionLineCount: range.getClientRects().length,
        primaryColor: styles.color,
        primaryBackground: styles.backgroundColor,
        titleWeight: getComputedStyle(element.querySelector('.pwa_update_title')).fontWeight,
        primaryWeight: getComputedStyle(element.querySelector('.pwa_update_primary_message')).fontWeight,
        secondaryWeight: getComputedStyle(element.querySelector('.pwa_update_secondary_message')).fontWeight,
        fontFamily: getComputedStyle(element.querySelector('.pwa_update_primary_message')).fontFamily,
      };
    });

    expect(metrics.notice.x).toBeGreaterThanOrEqual(0);
    expect(metrics.notice.x).toBeGreaterThanOrEqual(12);
    expect(metrics.viewportWidth - metrics.notice.x - metrics.notice.width).toBeGreaterThanOrEqual(12);
    expect(metrics.notice.y).toBeGreaterThanOrEqual(0);
    expect(metrics.notice.y + metrics.notice.height).toBeLessThanOrEqual(metrics.viewportHeight);
    expect(metrics.viewportHeight - metrics.notice.y - metrics.notice.height).toBeGreaterThanOrEqual(12);
    expect(metrics.notice.width).toBeLessThanOrEqual(608);
    if (width === 390) expect(metrics.notice.width).toBeGreaterThan(width - 48);
    expect(metrics.versionWhiteSpace).toBe('nowrap');
    expect(metrics.versionLineCount).toBe(1);
    expect(metrics.buttons).toHaveLength(2);
    const actionsShareRow = Math.abs(metrics.buttons[0].y - metrics.buttons[1].y) <= 1;
    expect(actionsShareRow).toBe(width > 320);
    expect(metrics.buttons.every((button) => button.height >= 44)).toBe(true);
    expect(contrastRatio(metrics.primaryColor, metrics.primaryBackground), `${theme} primary action contrast`).toBeGreaterThanOrEqual(4.5);
    expect(metrics.titleWeight).toBe('800');
    expect(metrics.primaryWeight).toBe('500');
    expect(metrics.secondaryWeight).toBe('400');
    expect(metrics.fontFamily).toContain('Inter');
  }

  await notice.getByRole('button', { name: 'Update Now' }).focus();
  await expect(notice.getByRole('button', { name: 'Update Now' })).toBeFocused();
});
