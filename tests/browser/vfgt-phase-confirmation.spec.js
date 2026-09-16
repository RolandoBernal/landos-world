import { test, expect } from '@playwright/test';

const ACTIVE_GAME_KEY = 'lando-world:violet-futbol-game-tracker:active-game:v1';

async function seedActiveGame(page, phase = 'first_half') {
  await page.addInitScript(({ key, initialPhase }) => {
    localStorage.setItem(key, JSON.stringify({
      id: 'browser-confirmation-game',
      schemaVersion: 4,
      entryType: 'live',
      status: 'inProgress',
      phase: initialPhase,
      team1: 'Violet',
      team2: 'Hume-Fogg',
      date: '2026-09-15',
      startTime: '19:00',
      firstHalfStartedAt: Date.now(),
      halftimeStartedAt: initialPhase === 'halftime' ? Date.now() : null,
      secondHalfStartedAt: initialPhase === 'second_half' ? Date.now() : null,
      firstHalfGoalsTeam1: 0,
      firstHalfGoalsTeam2: 0,
      secondHalfGoalsTeam1: 0,
      secondHalfGoalsTeam2: 0,
      halfDurationMinutes: 40,
    }));
  }, { key: ACTIVE_GAME_KEY, initialPhase: phase });
  await page.goto('/#/violet-futbol-game-tracker');
  await page.getByRole('button', { name: 'Resume Game' }).click();
}

test('VFGT phase-ending controls require confirmation and preserve cancel state', async ({ page }) => {
  await seedActiveGame(page);
  const app = page.locator('#violet-futbol-game-tracker-view');

  await app.getByRole('button', { name: 'End First Half' }).click();
  await expect(page.getByRole('alertdialog')).toHaveAccessibleName('End First Half?');
  await expect(page.getByRole('alertdialog')).toContainText('This will stop the first-half timer and begin halftime.');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), ACTIVE_GAME_KEY)).phase).toBe('first_half');

  await page.waitForTimeout(400);
  await app.getByRole('button', { name: 'End First Half' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'End First Half' }).click();
  expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), ACTIVE_GAME_KEY)).phase).toBe('halftime');

  await app.getByRole('button', { name: 'End Halftime' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('This will end halftime and start the second half.');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), ACTIVE_GAME_KEY)).phase).toBe('halftime');
});

test('VFGT second-half confirmation is phase-specific and cancel is non-destructive', async ({ page }) => {
  await seedActiveGame(page, 'second_half');
  const app = page.locator('#violet-futbol-game-tracker-view');

  await app.getByRole('button', { name: 'End Second Half' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('This will stop the second-half timer and finish the game.');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), ACTIVE_GAME_KEY)).phase).toBe('second_half');
});
