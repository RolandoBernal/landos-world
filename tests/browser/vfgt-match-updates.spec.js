import { test, expect } from '@playwright/test';
const key = 'lando-world:violet-futbol-game-tracker:active-game:v1';
async function setup(page, phase = 'first_half', elapsed = 1500, clipboard = 'success', longNames = false) {
  await page.addInitScript(({ key, phase, elapsed, clipboard, longNames }) => {
    window.copiedTexts = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard === 'missing' ? undefined : { writeText: async (text) => { if (clipboard.startsWith('reject')) throw Error('Denied'); window.copiedTexts.push(text); } } });
    document.execCommand = () => { window.fallbackText = document.activeElement?.value; return clipboard !== 'reject'; };
    if (!sessionStorage.getItem('vfgt-test-seeded')) localStorage.setItem(key, JSON.stringify({ id: 'share-test', teamSide: 1, schemaVersion: 4, entryType: 'live', status: 'inProgress', phase, team1: longNames ? 'North School With A Very Long Name And Many Words' : 'North School', team2: longNames ? 'South School With A Very Long Name And Many Words' : 'South School', date: '2026-10-01', startTime: '19:00', firstHalfStartedAt: Date.now() - elapsed * 1000, secondHalfStartedAt: Date.now() - elapsed * 1000, firstHalfGoalsTeam1: 0, firstHalfGoalsTeam2: 0, secondHalfGoalsTeam1: 0, secondHalfGoalsTeam2: 0, halfDurationMinutes: 40 }));
    sessionStorage.setItem('vfgt-test-seeded', 'yes');
  }, { key, phase, elapsed, clipboard, longNames });
  await page.goto('/#/violet-futbol-game-tracker');
  await page.getByRole('button', { name: 'Resume Game' }).click();
  await page.waitForTimeout(400);
}
async function transition(page, name) {
  await page.waitForTimeout(400);
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name, exact: true }).click();
}
test('goal snapshots, corrections, confirmations, final persistence and isolated copy', async ({ page }) => {
  await setup(page);
  const update = page.getByRole('button', { name: 'Copy match update', exact: true });
  await expect(update).toHaveCount(0);
  await page.getByRole('button', { name: 'Add one goal to North School' }).click();
  const first = '⚽️ Goal North School!\nNorth School 1 - 0 South School\nFirst Half: Minute 26';
  await expect(update).toHaveAttribute('data-vfgt-copy', first);
  await expect(update.locator('.vfgt_match_update_text')).toHaveText(first);
  await page.waitForTimeout(1100);
  await update.focus();
  await page.waitForTimeout(1100);
  await expect(update).toBeFocused();
  await update.press('Enter');
  expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), key)).firstHalfGoalsTeam1).toBe(1);
  await expect(page.getByRole('status').filter({ hasText: 'Copied!' })).toBeVisible();
  expect(await page.evaluate(() => window.copiedTexts.at(-1))).toBe(first);
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Add one goal to South School' }).click();
  const opponent = '⚽️ Goal South School\nNorth School 1 - 1 South School\nFirst Half: Minute 26';
  await expect(update).toHaveAttribute('data-vfgt-copy', opponent);
  await expect(update.locator('.vfgt_match_update_text')).toHaveText(opponent);
  await update.click();
  expect(await page.evaluate(() => window.copiedTexts.at(-1))).toBe(opponent);
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Subtract one goal from South School' }).click();
  await expect(update).toHaveAttribute('data-vfgt-copy', opponent);
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'End First Half', exact: true }).click();
  await expect(update).toHaveAttribute('data-vfgt-copy', opponent);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(update).toHaveAttribute('data-vfgt-copy', opponent);
  await transition(page, 'End First Half');
  await expect(update).toHaveAttribute('data-vfgt-copy', 'End of First Half:\nNorth School 1 - 0 South School');
  await transition(page, 'End Halftime');
  await expect(update).toHaveAttribute('data-vfgt-copy', 'Second Half Starting Now...\nNorth School 1 - 0 South School');
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Add one goal to South School' }).click();
  await expect(update).toHaveAttribute('data-vfgt-copy', '⚽️ Goal South School\nNorth School 1 - 1 South School\nSecond Half: Minute 41');
  await transition(page, 'End Second Half');
  const final = 'Final Score:\nNorth School 1 - 1 South School';
  await expect(update).toHaveAttribute('data-vfgt-copy', final);
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Save Game', exact: true }).click();
  // Reload without re-seeding the active game; saved result remains authoritative.
  await page.reload();
  await page.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Past Games' }) }).evaluate((el) => { el.open = true; });
  const score = page.getByRole('button', { name: 'Copy final score', exact: true });
  await expect(score).toHaveAttribute('data-vfgt-copy', final);
  await score.focus();
  await score.press('Enter');
  expect(await page.evaluate(() => window.copiedTexts.at(-1))).toBe(final);
  await expect(page.getByRole('heading', { name: 'FINAL', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open summary for North School versus South School' }).first().click();
  await expect(page.getByRole('heading', { name: 'FINAL', exact: true })).toBeVisible();
});
for (const [phase, elapsed, minute] of [['first_half', 2460, '40+2'], ['second_half', 2460, '80+2']]) {
  test(`${phase} added time does not finish automatically`, async ({ page }) => {
    await setup(page, phase, elapsed);
    await expect(page.getByRole('button', { name: 'Copy match update' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Add one goal to North School' }).click();
    await expect(page.getByRole('button', { name: 'Copy match update' })).toHaveAttribute('data-vfgt-copy', `⚽️ Goal North School!\nNorth School 1 - 0 South School\n${phase === 'first_half' ? 'First Half' : 'Second Half'}: Minute ${minute}`);
    expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), key)).phase).toBe(phase);
  });
}
for (const mode of ['missing', 'reject', 'reject-fallback-success']) {
  test(`clipboard ${mode} gives honest fallback feedback`, async ({ page }) => {
    await setup(page, 'first_half', 0, mode);
    await page.getByRole('button', { name: 'Add one goal to North School' }).click();
    await page.getByRole('button', { name: 'Copy match update' }).click();
    await expect(page.locator('.vfgt_copy_status')).toHaveText(mode !== 'reject' ? 'Copied!' : 'Could not copy. Tap to retry.');
    expect(await page.evaluate(() => window.fallbackText)).toBe('⚽️ Goal North School!\nNorth School 1 - 0 South School\nFirst Half: Minute 1');
    await expect(page.locator('textarea[aria-hidden="true"]')).toHaveCount(0);
    await expect(page.locator('.vfgt_copy_status')).toHaveText('', { timeout: 4000 });
  });
}
for (const width of [320, 393, 768, 1280]) {
  test(`long names wrap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    await setup(page, 'first_half', 1500, 'success', true);
    await page.getByRole('button', { name: 'Add one goal to North School With A Very Long Name And Many Words' }).click();
    const update = page.getByRole('button', { name: 'Copy match update' });
    await expect(update).toContainText('North School With A Very Long Name And Many Words');
    const bounds = await update.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await update.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await transition(page, 'End First Half');
    await transition(page, 'End Halftime');
    await transition(page, 'End Second Half');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Save Game', exact: true }).click();
    const score = page.getByRole('button', { name: 'Copy final score', exact: true });
    await expect(score).toBeVisible();
    expect(await score.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
}

test('landscape update allows scrolling with the timer, score and finish control usable', async ({ page }) => {
  await page.setViewportSize({ width: 852, height: 393 });
  await setup(page);
  // Generate the first update while the existing timer-only landscape view is active.
  await page.locator('[data-vfgt-score="1"][data-delta="1"]').evaluate((el) => el.click());
  await expect(page.getByRole('button', { name: 'Copy match update' })).toBeVisible();
  const visual = page.locator('#violet-futbol-game-tracker-view .vfgt_seven_segment_visual');
  const clock = page.locator('#violet-futbol-game-tracker-view .vfgt_clock');
  const digitBounds = await visual.boundingBox();
  const clockBounds = await clock.boundingBox();
  expect(digitBounds.y).toBeGreaterThanOrEqual(clockBounds.y);
  expect(digitBounds.y + digitBounds.height).toBeLessThanOrEqual(clockBounds.y + clockBounds.height);
  await expect(page.getByRole('button', { name: 'Add one goal to North School' })).toBeVisible();
  const finishButton = page.getByRole('button', { name: 'End First Half', exact: true });
  await finishButton.scrollIntoViewIfNeeded();
  const finish = await finishButton.boundingBox();
  const update = await page.getByRole('button', { name: 'Copy match update' }).boundingBox();
  expect(finish.y - (update.y + update.height)).toBeGreaterThanOrEqual(20);
  expect(finish.y + finish.height).toBeLessThanOrEqual(393);
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true);
});

for (const [width, height] of [[320, 852], [393, 852], [768, 1024], [1280, 900], [852, 393], [667, 320]]) {
  test(`update and all phase dialogs remain contained at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await setup(page, 'first_half', 1500, 'success', true);
    const add = page.locator('[data-vfgt-score="1"][data-delta="1"]');
    // Initial timer-only landscape deliberately hides score controls.
    await add.evaluate((el) => el.click());
    const update = page.getByRole('button', { name: 'Copy match update', exact: true });
    for (const name of ['End First Half', 'End Halftime', 'End Second Half']) {
      const action = page.getByRole('button', { name, exact: true });
      await action.scrollIntoViewIfNeeded();
      const updateBounds = await update.boundingBox();
      const actionBounds = await action.boundingBox();
      expect(actionBounds.y - updateBounds.y - updateBounds.height).toBeGreaterThanOrEqual(20);
      expect(await update.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
      const before = await page.evaluate(() => ({ scrollY, updateY: document.querySelector('.vfgt_match_update').getBoundingClientRect().y, text: document.querySelector('[data-vfgt-copy]').dataset.vfgtCopy }));
      await page.waitForTimeout(400);
      await action.click();
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name, exact: true })).toHaveCSS('background-color', 'rgb(157, 29, 59)');
      const bounds = await dialog.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(20);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 20);
      expect(bounds.y).toBeGreaterThanOrEqual(20);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height - 20);
      expect(await page.locator('.vfgt_match_update').evaluate((el) => el.getBoundingClientRect().y)).toBeCloseTo(before.updateY, 0);
      for (const label of ['Cancel', name]) {
        const button = dialog.getByRole('button', { name: label, exact: true });
        const buttonBounds = await button.boundingBox();
        expect(buttonBounds.height).toBeGreaterThanOrEqual(52);
        expect(buttonBounds.x).toBeGreaterThanOrEqual(bounds.x);
        expect(buttonBounds.x + buttonBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width);
      }
      await page.waitForTimeout(1100); // Timer rerenders must not defeat cancel focus restoration.
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(action).toBeFocused();
      expect(await page.evaluate(() => scrollY)).toBeCloseTo(before.scrollY, 0);
      await expect(update).toHaveAttribute('data-vfgt-copy', before.text);
      await transition(page, name);
    }
  });
}
