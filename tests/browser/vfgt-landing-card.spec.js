import { expect, test } from '@playwright/test';

const cardSelector = '.clock_utility_card--vfgt';
async function setGames(page, games) {
  return page.evaluate(games => {
    const api = window.VioletFutbolGameTracker;
    const settings = JSON.parse(localStorage.getItem(api.SETTINGS_KEY));
    const records = games.map(({ scheduled, ...values }) => ({
      ...api.createGame({ team1: 'Hume-Fogg', team2: 'Opponent', date: '2026-10-06', time: '18:00', gameType: 'districtTournament', teamSide: 1, teamId: settings.currentTeamId, seasonId: settings.currentSeasonId }),
      status: scheduled ? 'scheduled' : 'completed', phase: scheduled ? 'pregame' : 'final', ...values,
    }));
    localStorage.setItem(api.SAVED_GAMES_KEY, JSON.stringify(records));
    // Returning from the tracker must derive fresh data without a copied summary.
    location.hash = '/violet-futbol-game-tracker';
    return JSON.stringify(records);
  }, games);
}
async function returnHome(page) {
  await page.evaluate(() => { location.hash = '/'; });
  await expect(page.locator(cardSelector)).toBeVisible();
}

test('landing card lifecycle and updates use selected-season data without writes', async ({ page }) => {
  await page.goto('/');
  const card = page.locator(cardSelector);
  await expect(card.getByRole('heading', { name: 'Current Record' })).toBeVisible();
  await expect(card.getByRole('heading', { name: 'Last Game' })).toHaveCount(0);
  await setGames(page, [{ scheduled: true, team2: 'East Nashville' }]);
  await returnHome(page);
  await expect(card).toContainText('vs. East Nashville');
  await expect(card).toContainText('Current Record');
  const past = { id: 'past', date: '2026-10-01', team2: 'MLK', firstHalfGoalsTeam1: 2, firstHalfGoalsTeam2: 2, completionDecision: 'penalties', penaltyAttempts: [1, 1, 1, 1, 2, 2, 2].map(team => ({ team, scored: true })) };
  const future = { id: 'next', scheduled: true, date: '2026-10-06', team2: 'East Nashville' };
  const later = { id: 'later', scheduled: true, date: '2026-10-08', team2: 'RePublic' };
  const persisted = await setGames(page, [later, past, future]);
  await returnHome(page);
  await expect(card.locator('.vfgt_launcher_score')).toHaveText('Hume-Fogg 2 (4) – (3) 2 MLK');
  await expect(card).toContainText('vs. East Nashville');
  await expect(card).not.toContainText('Record');
  expect(await page.evaluate(() => localStorage.getItem(window.VioletFutbolGameTracker.SAVED_GAMES_KEY))).toBe(persisted);
  await setGames(page, [past, { ...future, date: '2026-10-10' }, later]);
  await returnHome(page);
  await expect(card).toContainText('vs. RePublic');
  await setGames(page, [past, future]);
  await returnHome(page);
  await expect(card).toContainText('vs. East Nashville');
  await setGames(page, [past, { ...future, scheduled: false, firstHalfGoalsTeam1: 3, firstHalfGoalsTeam2: 1 }]);
  await returnHome(page);
  await expect(card.locator('.vfgt_launcher_score')).toHaveText('Hume-Fogg 3 – 1 East Nashville');
  await expect(card).toContainText('Final Record');
  await expect(card).toContainText('2–0–0');
  await expect(card.getByRole('heading', { name: 'Next Game' })).toHaveCount(0);
  await setGames(page, [past]);
  await returnHome(page);
  await expect(card).toContainText('1–0–0');
  // A different season must not borrow this season's result.
  await page.evaluate(() => {
    const api = window.VioletFutbolGameTracker;
    const settings = JSON.parse(localStorage.getItem(api.SETTINGS_KEY));
    const seasons = JSON.parse(localStorage.getItem(api.SEASONS_KEY));
    seasons.push({ ...seasons[0], id: 'empty-season', name: 'Empty' });
    localStorage.setItem(api.SEASONS_KEY, JSON.stringify(seasons));
    localStorage.setItem(api.SETTINGS_KEY, JSON.stringify({ ...settings, currentSeasonId: 'empty-season' }));
    window.dispatchEvent(new StorageEvent('storage', { key: api.SETTINGS_KEY }));
  });
  await expect(card).toContainText('Current Record');
  await expect(card).toContainText('0–0–0');
  await expect(card.getByRole('heading', { name: 'Last Game' })).toHaveCount(0);
});

for (const width of [320, 393, 768, 1280]) {
  test(`landing PK score wraps clearly and opens VFGT at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await setGames(page, [{ team2: 'Martin Luther King Jr. Magnet', firstHalfGoalsTeam1: 2, firstHalfGoalsTeam2: 2, completionDecision: 'penalties', penaltyAttempts: [1, 1, 1, 1, 2, 2, 2].map(team => ({ team, scored: true })) }, { scheduled: true, team2: 'A Very Long Upcoming Opponent School Name' }]);
    await returnHome(page);
    const card = page.locator(cardSelector);
    await expect(card.locator('.vfgt_launcher_score_numbers')).toHaveText('2 (4) – (3) 2');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const geometry = await card.evaluate(element => {
      const card = element.getBoundingClientRect();
      return { height: card.height, inside: [...element.querySelectorAll('.vfgt_launcher_summary *, .clock_launch_btn')].every(child => { const box = child.getBoundingClientRect(); return box.left >= card.left && box.right <= card.right && box.top >= card.top && box.bottom <= card.bottom; }) };
    });
    expect(geometry.inside).toBe(true);
    expect(geometry.height).toBeLessThan(550);
    await page.screenshot({ path: `test-results/vfgt-landing-${width}.png`, fullPage: true });
    await card.getByRole('button', { name: 'Open Game Tracker' }).click();
    await expect(page).toHaveURL(/#\/violet-futbol-game-tracker$/);
  });
}

for (const width of [320, 393, 768, 1280]) {
  test(`all landing lifecycle groups center between header and CTA at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const past = { team2: 'RePublic', firstHalfGoalsTeam1: 3, firstHalfGoalsTeam2: 1 };
    const future = { scheduled: true, team2: 'East Nashville' };
    for (const games of [[], [future], [past, future], [past]]) {
      await setGames(page, games);
      await returnHome(page);
      const layout = await page.locator(cardSelector).evaluate(card => {
        const header = card.querySelector('.clock_utility_header').getBoundingClientRect();
        const cta = card.querySelector('.clock_launch_btn').getBoundingClientRect();
        const summary = card.querySelector('.vfgt_launcher_summary');
        const sections = [...summary.children].map(child => child.getBoundingClientRect());
        const top = Math.min(...sections.map(box => box.top));
        const bottom = Math.max(...sections.map(box => box.bottom));
        const region = summary.getBoundingClientRect();
        const score = card.querySelector('.vfgt_launcher_score');
        return { above: top - header.bottom, below: cta.top - bottom,
          horizontal: sections.every(box => Math.abs((box.left + box.right) / 2 - (region.left + region.right) / 2) < 1),
          scoreAlignment: score ? getComputedStyle(score).justifyContent : 'center',
          overflow: document.documentElement.scrollWidth > innerWidth };
      });
      expect(Math.abs(layout.above - layout.below)).toBeLessThan(2);
      expect(layout.horizontal).toBe(true);
      expect(layout.scoreAlignment).toBe('center');
      expect(layout.overflow).toBe(false);
    }
  });
}
