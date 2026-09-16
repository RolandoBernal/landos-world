import { test, expect } from '@playwright/test';

const SAVED_GAMES_KEY = 'lando-world:violet-futbol-game-tracker:saved-games:v1';
const MIGRATION_KEY = 'lando-world:violet-futbol-game-tracker:migration:v1';

test('VFGT recovery scans migrated future-game records and restores selected data after backup', async ({ page }) => {
  await page.goto('/#/violet-futbol-game-tracker');
  await page.evaluate(({ savedKey, migrationKey }) => {
    localStorage.setItem(migrationKey, '4');
    localStorage.setItem(savedKey, JSON.stringify([{
      id: 'recovery-browser-game',
      schemaVersion: 4,
      entryType: 'live',
      status: 'completed',
      phase: 'final',
      team1: 'Hume-Fogg',
      team2: 'Recovery Opponent',
      date: '2026-09-21',
      startTime: '19:00',
      location: 'Recovery Field',
      seasonId: '',
      gameType: 'regularSeason',
      completedAt: null,
      firstHalfDurationSeconds: null,
      secondHalfDurationSeconds: null,
      firstHalfGoalsTeam1: 0,
      firstHalfGoalsTeam2: 0,
      secondHalfGoalsTeam1: 0,
      secondHalfGoalsTeam2: 0,
      recoveryMarker: 'preserve-me',
    }]));
  }, { savedKey: SAVED_GAMES_KEY, migrationKey: MIGRATION_KEY });
  await page.reload();
  const app = page.locator('#violet-futbol-game-tracker-view');

  await app.getByRole('button', { name: 'VFGT Settings' }).click();
  await app.getByRole('button', { name: 'Open Future Game Recovery' }).click();
  await expect(app).toContainText('1 candidate game found');
  await expect(app).toContainText('Recovery Opponent');
  await app.locator('[data-vfgt-recovery-index="0"]').check();
  await app.getByRole('button', { name: 'Restore Selected' }).click();
  await expect(app).toContainText('Recovery complete: 1 game restored');

  const restored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVED_GAMES_KEY);
  expect(restored[0].status).toBe('scheduled');
  expect(restored[0].phase).toBe('pregame');
  expect(restored[0].recoveryMarker).toBe('preserve-me');
  expect(await page.evaluate((prefix) => Object.keys(localStorage).some((key) => key.startsWith(prefix)), 'lando-world:violet-futbol-game-tracker:recovery-backup:')).toBe(true);
});
