import { expect, test } from '@playwright/test';
import { createIPhoneDevServer, readAuthenticationPreviewConfig } from '../../scripts/dev-iphone.mjs';

let server;
let baseURL;
let authOrigin;

test.beforeAll(async () => {
  authOrigin = await readAuthenticationPreviewConfig();
  server = createIPhoneDevServer({
    bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' },
    authOrigin,
    getMetadata: async () => ({ environment: 'local-auth-preview', branch: 'fix/llt-authentication-boundary', commit: 'synthetic', sourceId: 'synthetic+dirty', dirty: true }),
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function prepare(page, { insecure = false } = {}) {
  const requests = [];
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route(`${authOrigin}/**`, async (route) => {
    const request = route.request();
    requests.push(new URL(request.url()).pathname);
    if (!new URL(request.url()).pathname.startsWith('/auth/v1/')) throw new Error('PRODUCTION DATA CANARY REACHED');
    const wrong = request.postDataJSON()?.password === 'wrong';
    await route.fulfill({ status: wrong ? 400 : 200, contentType: 'application/json', body: JSON.stringify(wrong ? { code: 'invalid_credentials', message: 'Invalid login credentials' } : { session: { user: { id: 'synthetic-preview-user' }, expires_at: Math.floor(Date.now() / 1000) + 3600 } }) });
  });
  await page.addInitScript(({ insecure }) => {
    if (insecure) Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    const sessionKey = 'synthetic-preview-auth-session';
    localStorage.setItem('lando-world:lee-lees-tracker:device-identity:v1', 'Rolando');
    window.__previewPwaCalls = [];
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {
      register() { window.__previewPwaCalls.push('register'); },
      getRegistrations() { window.__previewPwaCalls.push('cleanup'); return Promise.resolve([]); },
      addEventListener() {}, controller: null,
    } });
    window.supabase = { createClient(url, _key, options) {
      window.__previewOptions = options;
      let listener;
      const session = () => JSON.parse(localStorage.getItem(sessionKey) || 'null');
      const emit = (next) => { next ? localStorage.setItem(sessionKey, JSON.stringify(next)) : localStorage.removeItem(sessionKey); listener?.('AUTH_CHANGE', next); };
      window.__previewLoseAuth = () => emit(null);
      return {
        auth: {
          onAuthStateChange(callback) { listener = callback; return {}; },
          async getSession() { return { data: { session: session() } }; },
          async signInWithPassword(credentials) {
            const response = await options.global.fetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
            const result = await response.json();
            if (!response.ok) return { error: result };
            emit(result.session);
            return { data: result };
          },
          async signOut(options) {
            window.__previewSignOutScope = options.scope;
            await window.__previewOptions.global.fetch(`${url}/auth/v1/logout?scope=local`, { method: 'POST' });
            emit(null);
            return {};
          },
        },
        from() { throw new Error('DATA CANARY: from invoked'); },
        rpc() { throw new Error('DATA CANARY: rpc invoked'); },
        channel() { throw new Error('DATA CANARY: realtime invoked'); },
      };
    } };
  }, { insecure });
  return requests;
}

async function signIn(page) {
  await page.locator('[name="email"]').fill('synthetic@example.test');
  await page.locator('[name="password"]').fill('synthetic-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.LeeLeeTrackerAccess.getState())).toBe('production-authorized');
  await expect(page.getByRole('button', { name: 'Log Entry' }).last()).toBeVisible();
}

test('auth preview requires Auth, supports failure/retry/restoration and never starts data sync', async ({ page }) => {
  const requests = await prepare(page);
  await page.goto(`${baseURL}/#/lee-lees-tracker?auth-preview=false`);
  // Hash/query state does not control preview identity or authorize access.
  await page.goto(`${baseURL}/#/lee-lees-tracker`);
  await expect(page.locator('#lws-local-dev-badge')).toHaveText('AUTH PREVIEW');
  await expect(page.getByRole('heading', { name: 'Sign In', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.LeeLeeTrackerAccess.getState())).toBe('denied');
  await page.locator('[name="email"]').fill('synthetic@example.test');
  await page.locator('[name="password"]').fill('wrong');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.locator('.lee_lee_diabetes_error')).toContainText("wasn't accepted");
  expect(await page.evaluate(() => window.LeeLeeTrackerAccess.getState())).toBe('denied');
  await signIn(page);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.LeeLeeTrackerAccess.getState())).toBe('production-authorized');
  expect(await page.evaluate(() => window.LeeLeeTrackerDebug.getSyncStatus().productionDataDisabled)).toBe(true);
  expect(await page.evaluate(() => window.__previewPwaCalls)).toEqual([]);
  expect(requests).toEqual(['/auth/v1/token', '/auth/v1/token']);
  await page.locator('#lee_lee_settings_toggle').click();
  await page.locator('#lee-lee-app-information-title').click();
  await expect(page.locator('.lee_lee_diabetes_app_information')).toContainText('Authentication Preview');
});

test('auth preview sign-out and auth loss clear private UI without history resurrection', async ({ page }) => {
  const requests = await prepare(page);
  await page.goto(`${baseURL}/#/lee-lees-tracker`);
  await signIn(page);
  await page.locator('#lee_lee_settings_toggle').click();
  await page.getByRole('button', { name: 'Sign Out This Device' }).click();
  await expect(page).toHaveURL(/#\/$/);
  expect(await page.evaluate(() => window.__previewSignOutScope)).toBe('local');
  await page.goBack();
  await expect(page.locator('[data-editor-main], [data-authenticated-llt]')).toHaveCount(0);
  await page.goto(`${baseURL}/#/lee-lees-tracker`);
  await expect(page.getByRole('heading', { name: 'Sign In', exact: true })).toBeVisible();
  await signIn(page);
  await page.getByRole('button', { name: 'Log Entry' }).last().click();
  await page.getByRole('button', { name: /Carb Calculator/ }).click();
  await expect(page.getByRole('dialog', { name: 'Carb Calculator' })).toBeVisible();
  await page.evaluate(() => window.__previewLoseAuth());
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('dialog', { name: 'Carb Calculator' })).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.position)).not.toBe('fixed');
  expect(requests.every((path) => path.startsWith('/auth/v1/'))).toBe(true);
});

test('auth preview SDK and CSP reject data transport canaries without network access or queue consumption', async ({ page }) => {
  const requests = await prepare(page);
  await page.goto(`${baseURL}/#/lee-lees-tracker`);
  await signIn(page);
  const result = await page.evaluate(async (authOrigin) => {
    const api = window.LeeLeeTrackerSync;
    const repo = api.createRepository({ getDocument: () => ({ records: [] }), saveDocument() { throw new Error('Document mutation canary'); } });
    const keys = [repo.keys.queue, repo.keys.sharedSettingsQueue, repo.keys.foodLibraryQueue];
    const before = keys.map((key) => { const value = JSON.stringify([{ id: 'pending-canary', state: 'pending' }]); localStorage.setItem(key, value); return value; });
    await repo.initialize();
    for (const method of ['syncNow', 'syncSharedSettings', 'syncFoodLibrary', 'syncSettingsAudit', 'processQueue', 'processSharedSettingsQueue', 'processFoodLibraryQueue']) await repo[method]();
    let denied = 0;
    for (const path of ['/rest/v1/canary', '/rest/v1/rpc/canary', '/storage/v1/object/canary', '/realtime/v1/websocket']) {
      try { await window.__previewOptions.global.fetch(`${authOrigin}${path}`); } catch { denied += 1; }
      try { await fetch(`${authOrigin}${path}`); } catch { denied += 1; }
    }
    await new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(`${authOrigin.replace('https:', 'wss:')}/realtime/v1/websocket`);
        socket.onerror = () => { denied += 1; resolve(); };
        socket.onopen = () => { socket.close(); reject(new Error('Realtime transport canary reached')); };
      } catch { denied += 1; resolve(); }
    });
    return { denied, before, after: keys.map((key) => localStorage.getItem(key)) };
  }, authOrigin);
  expect(result.denied).toBe(9);
  expect(result.after).toEqual(result.before);
  expect(requests).toEqual(['/auth/v1/token']);
});

test('insecure iPhone auth preview refuses credentials and SDK initialization', async ({ page }) => {
  const requests = await prepare(page, { insecure: true });
  await page.goto(`${baseURL}/#/lee-lees-tracker`);
  await expect(page.locator('#lee-lee-diabetes-root')).toContainText('HTTPS required before credential testing');
  await expect(page.locator('[name="password"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.LeeLeeTrackerAccess.getState())).toBe('denied');
  expect(await page.evaluate(() => window.__previewOptions)).toBeUndefined();
  expect(requests).toEqual([]);
});

test('URL and browser storage cannot activate auth preview or grant authorization on the ordinary preview server', async ({ page, baseURL: ordinaryURL }) => {
  await prepare(page);
  await page.addInitScript(() => {
    localStorage.setItem('local-auth-preview', 'true');
    localStorage.setItem('environment', 'local-device');
    sessionStorage.setItem('auth-preview', 'true');
  });
  await page.goto(`${ordinaryURL}/?auth-preview=1&local-device=1#/lee-lees-tracker`);
  await expect(page.getByRole('heading', { name: 'Sign In', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.LandoWorldBuildMetadata.environment)).not.toBe('local-auth-preview');
  expect(await page.evaluate(() => window.LeeLeeTrackerAccess.getState())).toBe('denied');
  await expect(page.locator('#lws-local-dev-badge')).toHaveCount(0);
});
