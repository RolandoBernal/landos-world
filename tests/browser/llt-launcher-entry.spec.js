import { expect, test } from '@playwright/test';
import { createIPhoneDevServer } from '../../scripts/dev-iphone.mjs';

let server;
let baseURL;
test.beforeAll(async () => {
  server = createIPhoneDevServer({ bindAddress: { address: '127.0.0.1', netmask: '255.0.0.0' }, getMetadata: async () => ({ environment: 'local-device', appVersion: '1.0.0', branch: 'fix/llt-launcher-entry-nav', commit: 'test', commitFull: 'test', dirty: true, sourceId: 'launcher-entry-test' }) });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)); });


test('scrolled launcher entry resets LLT Today and preserves scroll direction behavior', async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
  await page.setViewportSize({ width: 393, height: 600 });
  await page.goto(`${baseURL}/#/`);
  const launcher = page.locator('#lando-launcher');
  const trackerCard = launcher.locator('[data-route="lee-lees-tracker"]');
  const nav = page.locator('.lee_lee_diabetes_nav_shell');
  const scrollY = () => page.evaluate(() => window.scrollY);

  await expect.poll(() => launcher.locator('[data-route]').evaluateAll(cards =>
    cards.findIndex(card => card.dataset.route === 'lee-lees-tracker'))).toBeGreaterThanOrEqual(2);
  await trackerCard.scrollIntoViewIfNeeded();
  expect(await scrollY()).toBeGreaterThan(0);

  await page.evaluate(() => {
    // Model a restored position after the route handler has shown Today.
    window.addEventListener('hashchange', () => {
      window.scrollTo(0, 100);
      window.dispatchEvent(new Event('scroll'));
      requestAnimationFrame(() => {
        const nav = document.querySelector('.lee_lee_diabetes_nav_shell');
        window.lltEntryFrame = {
          y: window.scrollY,
          anchor: nav?.dataset.scrollAnchor,
          hidden: nav?.classList.contains('is-scroll-hidden'),
        };
      });
    }, { once: true });
  });
  await trackerCard.click();
  await expect(nav.locator('[aria-label="Today"]')).toHaveClass(/is-active/);
  await expect.poll(() => page.evaluate(() => window.lltEntryFrame)).toEqual({ y: 0, anchor: '0', hidden: false });
  await expect(nav).toHaveAttribute('data-scroll-anchor', '0');
  await expect(nav).not.toHaveClass(/is-scroll-hidden/);

  await page.evaluate(() => window.scrollTo(0, 100));
  await expect(nav).toHaveClass(/is-scroll-hidden/);
  await page.evaluate(() => window.scrollTo(0, 60));
  await expect.poll(scrollY).toBe(60);
  await expect(nav).not.toHaveClass(/is-scroll-hidden/);

  await page.goto(`${baseURL}/#/`);
  const clock = launcher.locator('[data-route="digital-clock"]');
  await clock.click();
  await expect(page.locator('#clock-view')).toBeVisible();
  await expect.poll(scrollY).toBe(0);
  await expect(nav).toBeHidden();
});
