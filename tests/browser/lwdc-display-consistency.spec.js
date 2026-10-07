import { test, expect } from '@playwright/test';

const palette = locator => locator.evaluate(el => {
  const s = getComputedStyle(el);
  return { backgroundColor: s.backgroundColor, backgroundImage: s.backgroundImage };
});

for (const width of [320, 430, 768, 1280]) {
  test(`LWDC reuses launcher palette with crisp segments and preserved light mode at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => window.LandosTheme.setPreference('dark'));
    const reference = await palette(page.locator('.clock_utility_local_time'));
    const lit = await page.locator('.clock_utility_local_time .is-on').first().evaluate(e => getComputedStyle(e).backgroundColor);
    const unlit = await page.locator('.clock_utility_local_time .is-off').first().evaluate(e => getComputedStyle(e).backgroundColor);
    await page.goto('/#/digital-clock');
    const clocks = page.locator('#clock-view .digit_clock_time');
    await expect(clocks).toHaveCount(4);
    for (const clock of await clocks.all()) {
      expect(await palette(clock)).toEqual(reference);
      const result = await clock.evaluate((el, { lit, unlit }) => {
        const probe = document.createElement('span');
        probe.innerHTML = Array.from({ length: 10 }, (_, n) => renderSevenSegmentDigit(String(n))).join('');
        el.append(probe);
        const digits = [...probe.children].map(d => ({
          count: d.querySelectorAll('.is-on').length,
          palette: [...d.querySelectorAll('.vfgt_seven_segment')].every(s => getComputedStyle(s).backgroundColor === (s.classList.contains('is-on') ? lit : unlit)),
        }));
        const crisp = [...el.querySelectorAll('.vfgt_seven_segment, .vfgt_seven_segment_colon span')].every(e => {
          const s = getComputedStyle(e);
          return s.boxShadow === 'none' && s.textShadow === 'none' && s.filter === 'none' &&
            ['::before', '::after'].every(p => ['none', 'normal'].includes(getComputedStyle(e, p).content));
        });
        probe.remove();
        return { digits, crisp, parentFilter: getComputedStyle(el).filter, parentShadow: getComputedStyle(el).textShadow };
      }, { lit, unlit });
      expect(result.digits.map(d => d.count)).toEqual([6, 2, 5, 5, 4, 5, 6, 3, 7, 6]);
      expect(result.digits.every(d => d.palette)).toBe(true);
      expect(result.crisp).toBe(true);
      expect(result.parentFilter).toBe('none');
      expect(result.parentShadow).toBe('none');
    }
    await page.evaluate(() => window.LandosTheme.setPreference('light'));
    for (const clock of await clocks.all()) {
      await expect(clock).toHaveCSS('color', 'rgb(8, 122, 58)');
      expect(await clock.evaluate(el => getComputedStyle(el).getPropertyValue('--vfgt-segment-off').trim())).toBe('transparent');
    }
    await page.goto('/');
    await page.evaluate(() => window.LandosTheme.setPreference('dark'));
    expect(await palette(page.locator('.clock_utility_local_time'))).toEqual(reference);
  });
}

test('LWDC representative requested times preserve seven-segment mapping', async ({ page }) => {
  await page.goto('/#/digital-clock');
  const result = await page.locator('#clock-view .digit_clock_time').first().evaluate(el => {
    return ['01:11', '08:08', '10:07', '12:58'].map(value => {
      const probe = document.createElement('span');
      probe.innerHTML = value.replace(':', '').split('').map(renderSevenSegmentDigit).join('');
      el.append(probe);
      const counts = [...probe.children].map(d => d.querySelectorAll('.is-on').length);
      const crisp = [...probe.querySelectorAll('.is-on')].every(s => getComputedStyle(s).boxShadow === 'none');
      probe.remove();
      return { counts, crisp };
    });
  });
  expect(result.map(r => r.counts)).toEqual([[6, 2, 2, 2], [6, 7, 6, 7], [2, 6, 6, 3], [2, 5, 5, 7]]);
  expect(result.every(r => r.crisp)).toBe(true);
});
