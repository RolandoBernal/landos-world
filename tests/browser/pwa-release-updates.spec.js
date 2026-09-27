import { expect, test } from '@playwright/test';

const runningSha = 'a'.repeat(40);
const deployedSha = 'b'.repeat(40);

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

  await expect(notice).toContainText('Lando’s World 2026-09-26-42 is available');
  await expect(notice).toContainText('You’re using 2026-09-26-41');
  await expect(status).toContainText('Running Version');
  await expect(status).toContainText('Latest Deployed');
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
