import { expect, test } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';

let server;
let baseURL;

test.beforeAll(async () => {
  server = createIPhoneDevServer({
    bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' },
    getMetadata: async () => ({
      environment: 'local-device',
      appVersion: '1.0.0',
      branch: 'browser-test',
      commit: 'test',
      commitFull: 'test',
      dirty: true,
      sourceId: 'browser-test',
    }),
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  if (server?.listening) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test('local-device environment shows its badge, bypasses LLT sign-in locally, and makes no PWA or Supabase requests', async ({ page }) => {
  const remoteRequests = [];
  const registrationCalls = [];
  await page.addInitScript(() => {
    window.__iphoneDevServiceWorkerCalls = [];
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: (...args) => { window.__iphoneDevServiceWorkerCalls.push(args); },
        getRegistrations: async () => [],
      },
    });
  });
  page.on('request', (request) => {
    const url = request.url();
    if (/supabase\.co|deployment-version\.json/.test(url)) remoteRequests.push(url);
  });

  await page.goto(`${baseURL}/#/lee-lees-tracker`);
  await expect(page.locator('#lws-local-dev-badge')).toHaveText('LOCAL DEV');
  await expect(page.locator('#lee-lee-diabetes-root')).not.toContainText('Sign In');
  await page.getByRole('button', { name: 'Log Entry' }).last().click();
  await expect(page.getByRole('heading', { name: 'Log Entry' })).toBeVisible();
  await page.getByRole('button', { name: /Carb Calculator/ }).click();
  await expect(page.getByRole('dialog', { name: 'Carb Calculator' })).toBeVisible();

  registrationCalls.push(...await page.evaluate(() => window.__iphoneDevServiceWorkerCalls));
  expect(registrationCalls).toEqual([]);
  expect(remoteRequests).toEqual([]);
});
