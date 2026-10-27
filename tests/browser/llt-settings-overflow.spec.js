import { test, expect } from '@playwright/test';
async function openProtectedLeeLeeTracker(page, { authMode = 'authorized', deviceIdentity = true, signInError = null } = {}) {
  await page.addInitScript(({ authMode, deviceIdentity, signInError }) => {
    window.LEE_LEE_TRACKER_SUPABASE_CONFIG = {
      url: 'https://example.supabase.co',
      publishableKey: 'publishable-key-for-browser-smoke-tests',
    };
    if (deviceIdentity) localStorage.setItem('lando-world:lee-lees-tracker:device-identity:v1', 'Rolando');
    else localStorage.removeItem('lando-world:lee-lees-tracker:device-identity:v1');
    const usableSession = { user: { id: 'browser-smoke-user' }, expires_at: Math.floor(Date.now() / 1000) + 3600 };
    let session = authMode === 'authorized' ? usableSession : authMode === 'expired' ? { ...usableSession, expires_at: 1 } : null;
    let listener;
    let releaseInitial;
    const initialGate = authMode === 'resolving' ? new Promise(resolve => { releaseInitial = resolve; }) : Promise.resolve();
    window.__lltAuth = {
      emit(next = null) { session = next; listener?.(next ? 'TOKEN_REFRESHED' : 'SIGNED_OUT', next); },
      restore() { this.emit(usableSession); },
      releaseInitial() { releaseInitial?.(); },
      allowSignIn() { signInError = null; },
    };
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => {
            await initialGate;
            if (authMode === 'initial-error') throw new TypeError('Synthetic unavailable network');
            return { data: { session } };
          },
          onAuthStateChange: (callback) => { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; },
          signInWithPassword: async () => {
            if (signInError?.throws) throw new TypeError('Failed to fetch');
            if (signInError) return { error: signInError };
            window.__lltAuth.restore();
            return { data: { session } };
          },
          signOut: async () => { window.__lltAuth.emit(); return {}; },
        },
        channel: () => ({
          on() { return this; },
          subscribe: () => 'SUBSCRIBED',
        }),
        removeChannel: () => {},
        from: () => ({
          select() { return this; },
          eq() { return this; },
          order: async () => { await window.__lltSyncReadGate; return { data: [], error: null }; },
          maybeSingle: async () => ({ data: null, error: null }),
          insert() { return { select: () => ({ single: async () => ({ data: null, error: { message: 'offline test client' } }) }) }; },
          upsert() { return { select: () => ({ single: async () => ({ data: null, error: { code: '42501', message: 'permission denied for table lee_lee_foods' } }) }) }; },
        }),
        rpc: async () => ({ data: null, error: { message: 'offline test client' } }),
      }),
    };
  }, { authMode, deviceIdentity, signInError });
  await page.goto('/#/lee-lees-tracker');
  expect(await page.evaluate(() => window.LandoWorldBuildMetadata.environment)).not.toBe('local-device');
  await expect(page.getByRole('heading', { name: authMode === 'resolving' ? 'Checking access…' : authMode !== 'authorized' ? 'Sign In' : deviceIdentity ? /Lee-Lee.s Tracker/ : 'Who Uses This Device?' })).toBeVisible();
}

for (const width of [320, 390]) for (const theme of ['light', 'dark']) {
  test(`Settings and long conflict values stay contained at ${width}px ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.addInitScript(theme => {
      localStorage.setItem('lando-world:theme', theme);
      const record = { id: 'synthetic-overflow', type: 'Low Glucose', eventType: 'check', recordTimestamp: '2026-10-21T21:11:00.000Z', enteredBy: 'SyntheticUser'.repeat(15), notes: 'long-note-'.repeat(80), lowGlucoseEpisode: { version: 1, rechecks: [{ id: 'recheck-'.repeat(30), notes: 'machine-readable-value'.repeat(80) }], closure: null, pendingRecheck: null } };
      localStorage.setItem('lando-world:lee-lees-tracker:sync-conflicts:v1', JSON.stringify([{ recordId: record.id, localRecord: record, sharedRecord: { ...record, notes: 'different shared note' }, operation: { id: 'synthetic-operation', type: 'upsert', payload: record } }]));
    }, theme);
    await openProtectedLeeLeeTracker(page);
    expect(await (await page.request.get('/css/lee-lee-diabetes.css')).text()).toContain('Let nested review grids shrink to the card');
    const conflictBefore = await page.evaluate(() => localStorage.getItem('lando-world:lee-lees-tracker:sync-conflicts:v1'));
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    await page.locator('#lee_lee_settings_toggle').click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await page.locator('[data-settings-accordion]').evaluateAll(nodes => nodes.forEach(node => node.open = true));
    const overflow = async selector => page.locator(selector).evaluateAll(nodes => nodes.filter(node => {
      if (!node.getClientRects().length || getComputedStyle(node).overflowX === 'hidden' || getComputedStyle(node).clip !== 'auto' || getComputedStyle(node).opacity === '0') return false;
      const r = node.getBoundingClientRect();
      return r.left < -1 || r.right > innerWidth + 1 || node.scrollWidth > node.clientWidth + 1;
    }).map(node => ({ tag: node.tagName, cls: node.className, text: node.textContent.slice(0, 100), width: node.clientWidth, scroll: node.scrollWidth, right: node.getBoundingClientRect().right })));
    expect(await overflow('.lee_lee_diabetes_settings_section, .lee_lee_diabetes_settings_section *')).toEqual([]);
    await page.locator('[data-action="review-conflicts"]').click();
    await expect(page.getByRole('heading', { name: 'Records Needing Review' })).toBeVisible();
    await expect(page.locator('.lee_lee_diabetes_conflict_grid')).toContainText('machine-readable-value');
    expect(await overflow('[aria-label="Sync conflicts"], [aria-label="Sync conflicts"] *')).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Select All', exact: true }).click();
    await expect(page.locator('[data-conflict-select]')).toBeChecked();
    await expect(page.getByRole('button', { name: 'Keep Shared (1)', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Select None', exact: true }).click();
    await expect(page.locator('[data-conflict-select]')).not.toBeChecked();
    await page.locator('[data-conflict-select]').check();
    await expect(page.getByRole('button', { name: 'Use This Device (1)', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => localStorage.getItem('lando-world:lee-lees-tracker:sync-conflicts:v1'))).toBe(conflictBefore);
    await page.screenshot({ path: testInfo.outputPath('conflict-review.png') });
    await page.locator('.lee_lee_diabetes_conflict_grid dt').filter({ hasText: 'Episode / rechecks' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('episode-values.png') });
  });
}
