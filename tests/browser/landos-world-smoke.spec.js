import { expect, test } from '@playwright/test';

const WEATHER_API_PATTERN = /api\.open-meteo\.com\/v1\/forecast/;
const GEOCODING_API_PATTERN = /geocoding-api\.open-meteo\.com\/v1\/search/;

const WEATHER_FIXTURE = {
  current: {
    temperature_2m: 78,
    weather_code: 1,
    time: '2026-08-13T10:00',
  },
  current_units: {
    temperature_2m: 'F',
  },
  hourly: {
    time: [
      '2026-08-13T06:00',
      '2026-08-13T12:00',
      '2026-08-13T18:00',
      '2026-08-14T06:00',
      '2026-08-14T12:00',
      '2026-08-14T18:00',
    ],
    temperature_2m: [70, 82, 79, 69, 84, 80],
    weather_code: [1, 1, 2, 2, 3, 2],
    precipitation_probability: [10, 20, 15, 5, 10, 20],
    wind_speed_10m: [5, 7, 6, 4, 6, 8],
  },
};

const LOCAL_APP_ROUTES = [
  {
    name: 'home launcher',
    hash: '#/',
    root: '#lando-home-view',
    visible: [
      { role: 'main', name: "Lando's World apps" },
      { text: 'Weather' },
      { text: 'Digital Clock' },
      { text: 'Lee-Lee' },
      { text: 'Violet Sprints' },
      { text: 'Violet Futbol Game Tracker' },
      { text: 'Road Bike Trip Checklist' },
    ],
  },
  {
    name: 'settings',
    hash: '#/settings',
    root: '#lando-settings-view',
    visible: [
      { role: 'heading', name: "Lando's World Settings" },
      { text: 'Appearance' },
      { text: 'Application Status' },
    ],
  },
  {
    name: 'daily chief briefing',
    hash: '#/daily-chief-briefing',
    root: '#daily-chief-briefing-view',
    visible: [
      { role: 'heading', name: 'Daily Chief Briefing' },
      { text: 'Today' },
      { text: 'Import Briefing' },
    ],
  },
  {
    name: 'weather',
    hash: '#/weather',
    root: '#weather-view',
    visible: [
      { role: 'heading', name: 'Weather' },
      { text: 'Nashville' },
      { text: '78°F' },
      { text: 'Mostly clear' },
    ],
  },
  {
    name: 'lee-lees tracker',
    hash: '#/lee-lees-tracker',
    root: '#lee-lees-tracker-view',
    visible: [
      { role: 'heading', name: 'Sign In' },
      { label: 'Email' },
      { label: 'Password' },
    ],
  },
  {
    name: 'digital clock',
    hash: '#/digital-clock',
    root: '#clock-view',
    visible: [
      { text: 'Nashville' },
      { text: 'Puerto Vallarta' },
      { text: 'Tepic' },
      { text: 'Vancouver' },
    ],
  },
  {
    name: 'violet sprints',
    hash: '#/violet-sprints',
    root: '#sprints-view',
    visible: [
      { role: 'heading', name: 'Violet Sprints' },
      { text: 'Soccer Match Simulation' },
      { text: 'Treadmill Sprints' },
    ],
  },
  {
    name: 'violet futbol game tracker',
    hash: '#/violet-futbol-game-tracker',
    root: '#violet-futbol-game-tracker-view',
    visible: [
      { role: 'heading', name: 'Violet Futbol Game Tracker' },
      { text: 'Add Game' },
      { text: 'Hume-Fogg' },
    ],
  },
  {
    name: 'road bike checklist',
    hash: '#/road-bike-checklist',
    root: '#road-bike-checklist-view',
    visible: [
      { role: 'heading', name: 'Road Bike Trip Checklist' },
      { text: 'Bike & Essentials' },
      { text: 'Cycling Apparel' },
    ],
  },
];

function formatLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function relativeLocalDateKey(deltaDays) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + deltaDays);
  return formatLocalDateKey(date);
}

test.beforeEach(async ({ page }, testInfo) => {
  const consoleErrors = [];
  const weatherRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });
  page.on('request', (request) => {
    if (WEATHER_API_PATTERN.test(request.url())) weatherRequests.push(request.url());
  });
  if (testInfo.title.startsWith('Issue #10')) {
    // Authentication does not depend on other apps' external font imports.
    // Keep provider/offline fixtures deterministic without ignoring errors.
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({
      status: 200, contentType: 'text/css', body: '',
    }));
  }
  await page.route(GEOCODING_API_PATTERN, async (route) => {
    const location = new URL(route.request().url()).searchParams.get('name') || 'Nashville, Tennessee';
    const isAustin = location.toLowerCase().includes('austin');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [{
          name: isAustin ? 'Austin' : 'Nashville',
          admin1: isAustin ? 'Texas' : 'Tennessee',
          country_code: 'US',
          latitude: isAustin ? 30.2672 : 36.1627,
          longitude: isAustin ? -97.7431 : -86.7816,
          timezone: 'America/Chicago',
        }],
      }),
    });
  });
  await page.route(WEATHER_API_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(WEATHER_FIXTURE),
    });
  });
  await page.addInitScript(() => {
    if ('serviceWorker' in navigator) {
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: undefined,
      });
    }
  });
  page.consoleErrors = consoleErrors;
  page.weatherRequests = weatherRequests;
});

test.afterEach(async ({ page }) => {
  expect(page.consoleErrors).toEqual([]);
});

for (const route of LOCAL_APP_ROUTES) {
  test(`${route.name} route renders its first screen`, async ({ page }) => {
    await page.goto(`/${route.hash}`);
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('#lws-local-dev-badge')).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveText(/Loading\.\.\./);
    await expect(page.locator('[hidden]:target')).toHaveCount(0);
    const activeView = page.locator(route.root);
    await expect(activeView).toBeVisible();

    for (const expected of route.visible) {
      if (expected.role) {
        await expect(activeView.getByRole(expected.role, { name: expected.name })).toBeVisible();
      } else if (expected.label) {
        await expect(activeView.getByLabel(expected.label)).toBeVisible();
      } else {
        await expect(activeView.getByText(expected.text, { exact: false }).first()).toBeVisible();
      }
    }

    const networkStatus = page.locator('#pwa-network-status');
    if (route.hash === '#/' || route.hash === '#/settings') {
      await expect(networkStatus).toBeVisible();
    } else {
      await expect(networkStatus).toBeHidden();
    }
  });
}

test('VFGT settings manages a second team and season without losing the active context', async ({ page }) => {
  await page.goto('/#/violet-futbol-game-tracker');
  await page.getByRole('button', { name: 'VFGT Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Manage Teams' }).click();
  await page.getByRole('button', { name: 'Add Team' }).click();
  await page.getByLabel('Team Name').fill('Future University');
  await page.getByLabel('Short Name / Abbreviation').fill('FU');
  await page.getByRole('button', { name: 'Save Team' }).click();
  const futureTeam = page.locator('.vfgt_manage_row').filter({ hasText: 'Future University' });
  await expect(futureTeam).toContainText('Future University');
  await futureTeam.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('button', { name: 'VFGT Settings' }).click();
  await page.getByRole('button', { name: 'Manage Seasons' }).click();
  await page.getByRole('button', { name: 'Add Season' }).click();
  await page.getByLabel('Season Name').fill('2027 Fall');
  await page.getByLabel('Team').selectOption({ label: 'Future University' });
  await page.getByRole('button', { name: 'Save Season' }).click();
  const futureSeason = page.locator('.vfgt_manage_row').filter({ hasText: '2027 Fall' });
  await expect(futureSeason).toContainText('Future University');
  await futureSeason.getByRole('button', { name: 'Select' }).click();
  await expect(page.locator('.vfgt_context')).toContainText('Future University');
  await expect(page.locator('.vfgt_context')).toContainText('2027 Fall');
});

test('VFGT settings edits the current season half duration', async ({ page }) => {
  await page.goto('/#/violet-futbol-game-tracker');
  await page.getByRole('button', { name: 'VFGT Settings' }).click();
  await page.getByRole('button', { name: /Half Duration/ }).click();
  const durationInput = page.getByLabel('Minutes');
  await expect(durationInput).toHaveValue('40');
  await durationInput.fill('45');
  await page.getByRole('button', { name: 'Save Duration' }).click();
  await expect(page.getByRole('button', { name: /Half Duration/ })).toContainText('45 minutes');
  await expect(page.getByRole('button', { name: /Half Duration/ })).toContainText('Applies to 2026 Fall');
});

test('VFGT settings uses the shared top-right toggle cog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/violet-futbol-game-tracker');
  await page.getByRole('button', { name: 'VFGT Settings' }).click();
  const header = page.locator('#violet-futbol-game-tracker-view > .digit_clock_header');
  const backButton = page.getByRole('button', { name: 'Close VFGT Settings' });
  const [headerBox, buttonBox] = await Promise.all([header.boundingBox(), backButton.boundingBox()]);
  expect(headerBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();
  expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(headerBox.x + headerBox.width);
  expect(buttonBox.x).toBeGreaterThan(headerBox.x + headerBox.width - 70);
  expect(buttonBox.y).toBeGreaterThanOrEqual(headerBox.y);
  expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height);
  await expect(backButton).toHaveAttribute('aria-expanded', 'true');
  await backButton.click();
  await expect(page.getByRole('button', { name: 'VFGT Settings' })).toBeVisible();
});

test('VFGT shared header keeps its logo, title, and settings cog on one row', async ({ page }) => {
  await page.goto('/#/violet-futbol-game-tracker');
  const header = page.locator('#violet-futbol-game-tracker-view > .digit_clock_header');
  const brand = header.locator('.digit_clock_brand');
  const logo = header.locator('.digit_clock_logo');
  const title = header.locator('.digit_clock_title');
  const cog = page.getByRole('button', { name: 'VFGT Settings' });
  const [headerBox, brandBox, logoBox, titleBox, cogBox] = await Promise.all([header.boundingBox(), brand.boundingBox(), logo.boundingBox(), title.boundingBox(), cog.boundingBox()]);
  expect(headerBox).not.toBeNull();
  expect(brandBox).not.toBeNull();
  expect(logoBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(cogBox).not.toBeNull();
  expect(cogBox.x + cogBox.width).toBeLessThanOrEqual(headerBox.x + headerBox.width);
  expect(Math.abs(logoBox.y - titleBox.y)).toBeLessThan(8);
  expect(Math.abs((cogBox.y + cogBox.height / 2) - (titleBox.y + titleBox.height / 2))).toBeLessThan(2);
});

test('VFGT displays the record from the visible saved scores', async ({ page }) => {
  await page.addInitScript(() => {
    const game = (id, opponent, team1Score, team2Score) => ({
      id,
      schemaVersion: 3,
      phase: 'final',
      entryType: 'manual',
      team1: 'Hume-Fogg',
      team2: opponent,
      teamId: 'team-1',
      seasonId: 'season-1',
      teamSide: 2,
      gameType: 'regularSeason',
      date: '2026-08-22',
      startTime: '12:00',
      firstHalfGoalsTeam1: team1Score,
      firstHalfGoalsTeam2: team2Score,
      secondHalfGoalsTeam1: 0,
      secondHalfGoalsTeam2: 0,
    });
    localStorage.setItem('lando-world:violet-futbol-game-tracker:teams:v1', JSON.stringify([{ id: 'team-1', name: 'Hume-Fogg', shortName: 'HF', archived: false }]));
    localStorage.setItem('lando-world:violet-futbol-game-tracker:seasons:v1', JSON.stringify([{ id: 'season-1', teamId: 'team-1', name: '2026 Fall', archived: false }]));
    localStorage.setItem('lando-world:violet-futbol-game-tracker:settings:v1', JSON.stringify({ currentTeamId: 'team-1', currentSeasonId: 'season-1' }));
    localStorage.setItem('lando-world:violet-futbol-game-tracker:migration:v1', '2');
    localStorage.setItem('lando-world:violet-futbol-game-tracker:saved-games:v1', JSON.stringify([
      game('g1', 'Other HS', 1, 2), game('g2', 'Test School 2', 3, 1), game('g3', 'Sayre High School', 3, 2), game('g4', 'Sayre High School', 3, 3),
    ]));
  });
  await page.goto('/#/violet-futbol-game-tracker');
  await expect(page.locator('.vfgt_season_summary')).toContainText('Regular Season: 2–1–1');
  await expect(page.locator('.vfgt_season_summary')).toContainText('2 Wins · 1 Loss · 1 Draw');
});

test('VFGT venue links encode complete locations without changing card controls', async ({ page }) => {
  await page.addInitScript(() => {
    const base = {
      schemaVersion: 4,
      team1: 'Hume-Fogg',
      teamId: 'team-1',
      seasonId: 'season-1',
      teamSide: 1,
      gameType: 'regularSeason',
      date: '2026-09-18',
      startTime: '18:00',
    };
    const future = {
      ...base,
      id: 'future-map',
      team2: 'Map Opponent',
      status: 'scheduled',
      phase: 'pregame',
      venue: 'East Nashville Magnet High School',
      address: '110 Gallatin Ave, Nashville, TN 37206, United States',
    };
    const venueOnly = { ...base, id: 'venue-only', team2: 'Venue Only', status: 'scheduled', phase: 'pregame', location: "St. Mary's Field, Unit #2" };
    const noLocation = { ...base, id: 'no-location', team2: 'No Location', status: 'scheduled', phase: 'pregame', location: '' };
    const past = { ...base, id: 'past-map', team2: 'Past Opponent', status: 'completed', phase: 'final', date: '2026-09-17', venue: 'Past Stadium', address: '1 Main St., Apt. 4B, Nashville, TN 37201', firstHalfGoalsTeam1: 1, firstHalfGoalsTeam2: 0, secondHalfGoalsTeam1: 0, secondHalfGoalsTeam2: 0 };
    localStorage.setItem('lando-world:violet-futbol-game-tracker:teams:v1', JSON.stringify([{ id: 'team-1', name: 'Hume-Fogg', shortName: 'HF', archived: false }]));
    localStorage.setItem('lando-world:violet-futbol-game-tracker:seasons:v1', JSON.stringify([{ id: 'season-1', teamId: 'team-1', name: '2026 Fall', archived: false }]));
    localStorage.setItem('lando-world:violet-futbol-game-tracker:settings:v1', JSON.stringify({ currentTeamId: 'team-1', currentSeasonId: 'season-1' }));
    localStorage.setItem('lando-world:violet-futbol-game-tracker:migration:v1', '4');
    localStorage.setItem('lando-world:violet-futbol-game-tracker:saved-games:v1', JSON.stringify([future, venueOnly, noLocation, past]));
  });
  await page.goto('/#/violet-futbol-game-tracker');
  const future = page.locator('.vfgt_accordion').filter({ hasText: 'Future Games' });
  await future.locator('summary').click();
  const fullLink = future.locator('[data-vfgt-map-link]').filter({ hasText: 'East Nashville Magnet' });
  await expect(fullLink).toHaveAttribute('href', 'https://maps.apple.com/?address=110%20Gallatin%20Ave%2C%20Nashville%2C%20TN%2037206%2C%20United%20States&q=East%20Nashville%20Magnet%20High%20School');
  await expect(fullLink).toHaveAccessibleName('Open East Nashville Magnet High School in Apple Maps');
  await expect(future.locator('[data-vfgt-map-link]').filter({ hasText: "St. Mary's Field" })).toHaveAttribute('href', "https://maps.apple.com/?q=St.%20Mary's%20Field%2C%20Unit%20%232");
  await expect(future.locator('.vfgt_scheduled_card').filter({ hasText: 'No Location' }).locator('[data-vfgt-map-link]')).toHaveCount(0);
  const fullCard = future.locator('.vfgt_scheduled_card').filter({ hasText: 'Map Opponent' });
  await expect(fullLink.locator('xpath=ancestor::button')).toHaveCount(0);
  await expect(fullCard.locator('.vfgt_card_actions')).toBeVisible();
  const past = page.locator('.vfgt_accordion').filter({ hasText: 'Past Games' });
  const pastLink = past.locator('[data-vfgt-map-link]');
  await expect(pastLink).toHaveAccessibleName('Open Past Stadium in Apple Maps');
  await past.locator('.vfgt_past_card .vfgt_card_summary').click();
  await expect(page.locator('.vfgt_map_link--detail')).toHaveAccessibleName('Open Past Stadium in Apple Maps');
  await expect(page.getByRole('button', { name: 'Edit Game' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Game' })).toBeVisible();
});

test('VFGT Past and Future cards use DM Sans with normal metadata weights across widths', async ({ page }) => {
  await page.addInitScript(() => {
    const base = {
      team1: 'Hume-Fogg',
      teamId: 'team-1',
      seasonId: 'season-1',
      teamSide: 1,
      gameType: 'regularSeason',
      startTime: '18:00',
    };
    localStorage.setItem('lando-world:violet-futbol-game-tracker:teams:v1', JSON.stringify([{ id: 'team-1', name: 'Hume-Fogg', shortName: 'HF', archived: false }]));
    localStorage.setItem('lando-world:violet-futbol-game-tracker:seasons:v1', JSON.stringify([{ id: 'season-1', teamId: 'team-1', name: '2026 Fall', archived: false }]));
    localStorage.setItem('lando-world:violet-futbol-game-tracker:settings:v1', JSON.stringify({ currentTeamId: 'team-1', currentSeasonId: 'season-1' }));
    localStorage.setItem('lando-world:violet-futbol-game-tracker:migration:v1', '4');
    localStorage.setItem('lando-world:violet-futbol-game-tracker:saved-games:v1', JSON.stringify([
      { ...base, id: 'future-typography', team2: 'Future Opponent', status: 'scheduled', phase: 'pregame', date: '2026-09-22', location: 'Future Field', notes: 'Supporting future note.' },
      { ...base, id: 'past-typography', team2: 'Past Opponent', status: 'completed', phase: 'final', date: '2026-09-17', location: 'Past Stadium', firstHalfGoalsTeam1: 1, firstHalfGoalsTeam2: 0, secondHalfGoalsTeam1: 0, secondHalfGoalsTeam2: 0 },
    ]));
  });
  await page.goto('/#/violet-futbol-game-tracker');

  const measurements = await page.evaluate(() => {
    const style = (selector) => {
      const node = document.querySelector(selector);
      const computed = getComputedStyle(node);
      return { family: computed.fontFamily, weight: computed.fontWeight };
    };
    return {
      future: {
        card: style('.vfgt_scheduled_card'),
        opponent: style('.vfgt_scheduled_opponent'),
        status: style('.vfgt_scheduled_badge'),
        date: style('.vfgt_scheduled_card .vfgt_history_date'),
        location: style('.vfgt_scheduled_card .vfgt_map_link'),
        type: style('.vfgt_scheduled_card .vfgt_history_game_type'),
        notes: style('.vfgt_scheduled_notes'),
      },
      past: {
        card: style('.vfgt_past_card'),
        status: style('.vfgt_past_card .vfgt_scheduled_badge'),
        date: style('.vfgt_past_card .vfgt_history_date'),
        team: style('.vfgt_history_team'),
        score: style('.vfgt_history_score'),
        location: style('.vfgt_past_card .vfgt_map_link'),
        type: style('.vfgt_past_card .vfgt_history_game_type'),
      },
    };
  });

  for (const viewport of [{ width: 393, height: 852 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    const layout = await page.evaluate(() => [...document.querySelectorAll('.vfgt_history_item')].map((card) => ({
      right: card.getBoundingClientRect().right,
      viewport: window.innerWidth,
      chevron: Boolean(card.querySelector('.vfgt_card_chevron')),
    })));
    expect(layout.every(({ right, viewport: width, chevron }) => right <= width && !chevron)).toBe(true);
  }

  const normal = [measurements.future.card, measurements.future.date, measurements.future.location, measurements.future.type, measurements.future.notes, measurements.past.card, measurements.past.date, measurements.past.location, measurements.past.type];
  expect(normal.every(({ family, weight }) => family.startsWith('"DM Sans"') && weight === '400')).toBe(true);
  expect(measurements.future.opponent.family.startsWith('"DM Sans"')).toBe(true);
  expect(measurements.future.status.weight).toBe('500');
  expect(measurements.past.team.weight).toBe('500');
  expect(measurements.past.score.weight).toBe('500');
});

test('VFGT schedules, edits, quick-starts, and completes one future game without duplication', async ({ page }) => {
  await page.goto('/#/violet-futbol-game-tracker');
  const app = page.locator('#violet-futbol-game-tracker-view');
  await app.getByRole('button', { name: 'Add Game', exact: true }).click();
  await expect(app.getByRole('heading', { name: 'What type of game would you like to add?' })).toBeVisible();
  await app.getByRole('button', { name: 'Future Game' }).click();
  await app.getByLabel('Opponent').fill('Brentwood Academy');
  await app.getByLabel('Date').fill('2026-09-18');
  await app.getByLabel('Time').fill('19:00');
  await app.getByLabel('Location').fill('Home');
  await app.getByLabel('Game Type').selectOption('regularSeason');
  await app.getByLabel('Notes').fill('Arrive by 5:45');
  await app.getByRole('button', { name: 'Save Future Game' }).click();

  const future = app.locator('.vfgt_accordion').filter({ hasText: 'Future Games' });
  const past = app.locator('.vfgt_accordion').filter({ hasText: 'Past Games' });
  await expect(future).not.toHaveAttribute('open');
  await expect(past).toHaveAttribute('open', '');
  await expect(future).toContainText('Brentwood Academy');
  await expect(future).toContainText('Arrive by 5:45');
  const scheduledId = await page.evaluate(() => JSON.parse(localStorage.getItem('lando-world:violet-futbol-game-tracker:saved-games:v1'))[0].id);

  await future.locator('summary').click();
  const futureCard = future.locator('.vfgt_scheduled_card');
  await expect(futureCard.locator('.vfgt_card_actions')).toBeVisible();
  await futureCard.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('alertdialog')).toHaveAccessibleName('Delete this scheduled game?');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(futureCard.locator('.vfgt_card_actions')).toBeVisible();
  await future.getByRole('button', { name: 'Edit' }).click();
  await app.getByLabel('Opponent').fill('Franklin Road Academy');
  await app.getByRole('button', { name: 'Save Future Game' }).click();
  await expect(future).toContainText('Franklin Road Academy');
  await expect(future).not.toContainText('Brentwood Academy');

  await future.getByRole('button', { name: 'Quick Start' }).click();
  await expect(page.getByRole('alertdialog')).toHaveAccessibleName('Start game vs. Franklin Road Academy?');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Start Game' }).click();
  await expect(app.locator('.vfgt_live--running-half')).toBeVisible();
  const active = await page.evaluate(() => JSON.parse(localStorage.getItem('lando-world:violet-futbol-game-tracker:active-game:v1')));
  expect(active.id).toBe(scheduledId);
  expect(active.status).toBe('inProgress');
  expect(active.team2).toBe('Franklin Road Academy');
  expect(active.location).toBe('Home');
  expect(active.notes).toBe('Arrive by 5:45');
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('lando-world:violet-futbol-game-tracker:saved-games:v1')))).toHaveLength(0);

  await app.getByRole('button', { name: 'End First Half' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('This will stop the first-half timer and begin halftime.');
  await page.getByRole('alertdialog').getByRole('button', { name: 'End First Half', exact: true }).click();
  await app.getByRole('button', { name: 'End Halftime' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('This will end halftime and start the second half.');
  await page.getByRole('alertdialog').getByRole('button', { name: 'End Halftime', exact: true }).click();
  await app.getByRole('button', { name: 'End Second Half' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('This will stop the second-half timer and finish the game.');
  await page.getByRole('alertdialog').getByRole('button', { name: 'End Second Half', exact: true }).click();
  await app.getByRole('button', { name: 'Save Game' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lando-world:violet-futbol-game-tracker:saved-games:v1')));
  expect(saved).toHaveLength(1);
  expect(saved[0].id).toBe(scheduledId);
  expect(saved[0].status).toBe('completed');
  expect(saved[0].team2).toBe('Franklin Road Academy');
  const pastSection = app.locator('.vfgt_accordion').filter({ hasText: 'Past Games' });
  await expect(pastSection).toContainText('Franklin Road Academy');
  await pastSection.locator('.vfgt_past_card .vfgt_card_summary').click();
  await expect(app.getByRole('heading', { name: 'FINAL' })).toBeVisible();
});

test('VFGT unified Add Game opens the played-game workflow and cancellation stays non-destructive', async ({ page }) => {
  await page.goto('/#/violet-futbol-game-tracker');
  const app = page.locator('#violet-futbol-game-tracker-view');
  await app.getByRole('button', { name: 'Add Game', exact: true }).click();
  await expect(app.getByRole('heading', { name: 'What type of game would you like to add?' })).toBeVisible();
  await app.getByRole('button', { name: 'Played Game' }).click();
  await expect(app.getByRole('heading', { name: 'Add Game', exact: true })).toBeVisible();
  await app.getByLabel('School/Team 2').fill('Ravenwood');
  await app.getByLabel('Date').fill('2026-09-12');
  await app.getByRole('button', { name: 'Save Past Game' }).click();
  await expect(app.locator('.vfgt_accordion').filter({ hasText: 'Past Games' })).toContainText('Ravenwood');

  await app.getByRole('button', { name: 'Add Game', exact: true }).click();
  await app.getByRole('button', { name: 'Future Game' }).click();
  await app.getByRole('button', { name: 'Back', exact: true }).click();
  await app.getByRole('button', { name: 'Cancel', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lando-world:violet-futbol-game-tracker:saved-games:v1') || '[]'));
  expect(saved).toHaveLength(1);
  expect(saved[0].team2).toBe('Ravenwood');
});

async function startVfgtFirstHalf(page) {
  await page.goto('/#/violet-futbol-game-tracker');
  const app = page.locator('#violet-futbol-game-tracker-view');
  await app.getByRole('button', { name: 'Add Game', exact: true }).click();
  await app.getByRole('button', { name: 'Future Game' }).click();
  await app.getByLabel('Opponent').fill('Hume-Fogg');
  await app.getByRole('button', { name: 'Save Future Game' }).click();
  const future = app.locator('.vfgt_accordion').filter({ hasText: 'Future Games' });
  await future.locator('summary').click();
  await future.getByRole('button', { name: 'Quick Start' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Start Game' }).click();
  await expect(app.locator('.vfgt_live--running-half')).toBeVisible();
  return app;
}

test('VFGT active half becomes a fullscreen phone landscape scoreboard without duplicating the timer', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const app = await startVfgtFirstHalf(page);
  const live = app.locator('.vfgt_live--running-half');
  const clockPanel = app.locator('.vfgt_clock_panel');
  const clock = app.locator('.vfgt_clock');
  const firstHalfStartedAt = await page.evaluate(() => (
    JSON.parse(localStorage.getItem('lando-world:violet-futbol-game-tracker:active-game:v1')).firstHalfStartedAt
  ));

  await expect(live).toBeVisible();
  await expect(app.locator('.ecosystem_nav')).toBeHidden();
  await expect(app.locator('> .digit_clock_header')).toBeHidden();
  await expect(app.locator('.vfgt_match_header')).toBeHidden();
  await expect(app.locator('.vfgt_scoreboard')).toBeHidden();
  await expect(app.locator('.vfgt_actions')).toBeVisible();
  await expect(app.locator('[data-vfgt-seven-segment-display]')).toHaveCount(1);

  const layout = await page.evaluate(() => {
    const liveNode = document.querySelector('.vfgt_live--running-half');
    const panel = document.querySelector('.vfgt_clock_panel');
    const clockNode = document.querySelector('.vfgt_clock');
    const display = document.querySelector('[data-vfgt-seven-segment-display]');
    const phase = document.querySelector('.vfgt_phase');
    const actionRail = document.querySelector('.vfgt_live_action_rail');
    const actionButton = actionRail.querySelector('.vfgt_button');
    const bodyStyle = getComputedStyle(document.body);
    const liveStyle = getComputedStyle(liveNode);
    const actionRailStyle = getComputedStyle(actionRail);
    const phaseStyle = getComputedStyle(phase);
    const liveBox = liveNode.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    const clockBox = clockNode.getBoundingClientRect();
    const displayBox = display.getBoundingClientRect();
    const phaseBox = phase.getBoundingClientRect();
    return {
      bodyOverflow: bodyStyle.overflow,
      livePosition: liveStyle.position,
      liveBox: {
        width: liveBox.width,
        height: liveBox.height,
        left: liveBox.left,
        top: liveBox.top,
        bottom: liveBox.bottom,
      },
      panelBox: {
        width: panelBox.width,
        height: panelBox.height,
      },
      clockBox: {
        width: clockBox.width,
        height: clockBox.height,
      },
      displayBox: {
        width: displayBox.width,
        height: displayBox.height,
        left: displayBox.left,
        right: displayBox.right,
        top: displayBox.top,
        bottom: displayBox.bottom,
      },
      phaseText: phase.textContent.trim(),
      phaseTextTransform: phaseStyle.textTransform,
      phaseHeight: phaseBox.height,
      actionRail: {
        bottom: actionRail.getBoundingClientRect().bottom,
        paddingBottom: actionRailStyle.paddingBottom,
        buttonBottom: actionButton.getBoundingClientRect().bottom,
        buttonHeight: actionButton.getBoundingClientRect().height,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  });

  expect(layout.bodyOverflow).toBe('hidden');
  expect(layout.livePosition).toBe('fixed');
  expect(Math.round(layout.liveBox.width)).toBe(layout.viewport.width);
  expect(Math.round(layout.liveBox.height)).toBe(layout.viewport.height);
  expect(layout.liveBox.left).toBe(0);
  expect(layout.liveBox.top).toBe(0);
  expect(layout.actionRail.buttonBottom).toBeLessThanOrEqual(layout.liveBox.bottom);
  expect(layout.actionRail.buttonHeight).toBeGreaterThanOrEqual(48);
  expect(layout.actionRail.paddingBottom).toContain('20px');
  expect(layout.phaseText).toBe('First Half');
  expect(layout.phaseTextTransform).toBe('uppercase');
  expect(layout.clockBox.width).toBeGreaterThan(layout.viewport.width * 0.78);
  expect(layout.displayBox.height).toBeGreaterThan(layout.viewport.height * 0.52);
  expect(layout.phaseHeight).toBeLessThan(layout.displayBox.height * 0.18);
  expect(layout.displayBox.left).toBeGreaterThanOrEqual(0);
  expect(layout.displayBox.right).toBeLessThanOrEqual(layout.viewport.width);
  expect(layout.displayBox.top).toBeGreaterThanOrEqual(0);
  expect(layout.displayBox.bottom).toBeLessThanOrEqual(layout.viewport.height);
  expect(layout.panelBox.height).toBeLessThanOrEqual(layout.viewport.height);
  await expect.poll(async () => page.evaluate((startedAt) => (
    JSON.parse(localStorage.getItem('lando-world:violet-futbol-game-tracker:active-game:v1')).firstHalfStartedAt === startedAt
  ), firstHalfStartedAt)).toBe(true);
});

test('VFGT rotation back to portrait keeps game state, score, and the original start timestamp', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const app = await startVfgtFirstHalf(page);
  await app.getByLabel('Add one goal to Violet').click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('lando-world:violet-futbol-game-tracker:active-game:v1')));

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(app.locator('.vfgt_live--running-half')).toBeVisible();
  await expect(app.locator('.vfgt_scoreboard')).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(app.locator('.vfgt_scoreboard')).toBeVisible();
  await expect(app.getByRole('button', { name: 'End First Half' })).toBeVisible();
  await expect(app.getByLabel('Violet score')).toHaveValue('1');

  for (const viewport of [{ width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    const actionBounds = await app.getByRole('button', { name: 'End First Half' }).boundingBox();
    expect(actionBounds).not.toBeNull();
    expect(actionBounds.y + actionBounds.height).toBeLessThanOrEqual(viewport.height);
  }

  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('lando-world:violet-futbol-game-tracker:active-game:v1')));
  expect(after.phase).toBe('first_half');
  expect(after.firstHalfStartedAt).toBe(before.firstHalfStartedAt);
  expect(after.firstHalfGoalsTeam1).toBe(1);
});

test('VFGT phone landscape mode does not apply to non-running screens or desktop viewports', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/#/violet-futbol-game-tracker');
  const app = page.locator('#violet-futbol-game-tracker-view');
  await expect(app.getByRole('heading', { name: 'Violet Futbol Game Tracker' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'New Game' })).toBeVisible();
  await expect(app.locator('.ecosystem_nav')).toBeVisible();
  let mode = await page.evaluate(() => {
    const appNode = document.querySelector('#violet-futbol-game-tracker-view .vfgt_app');
    return {
      position: getComputedStyle(appNode).position,
      timerCount: document.querySelectorAll('[data-vfgt-seven-segment-display]').length,
    };
  });
  expect(mode.position).not.toBe('fixed');
  expect(mode.timerCount).toBe(0);

  await page.setViewportSize({ width: 1024, height: 500 });
  await startVfgtFirstHalf(page);
  mode = await page.evaluate(() => {
    const liveNode = document.querySelector('.vfgt_live--running-half');
    return {
      position: getComputedStyle(liveNode).position,
      scoreDisplay: getComputedStyle(document.querySelector('.vfgt_scoreboard')).display,
      navDisplay: getComputedStyle(document.querySelector('#violet-futbol-game-tracker-view .ecosystem_nav')).display,
      timerCount: document.querySelectorAll('[data-vfgt-seven-segment-display]').length,
    };
  });
  expect(mode.position).not.toBe('fixed');
  expect(mode.scoreDisplay).not.toBe('none');
  expect(mode.navDisplay).not.toBe('none');
  expect(mode.timerCount).toBe(1);
});

test('Digital Clock seven-segment time stays centered and contained for representative values', async ({ page }) => {
  const cases = [
    { hour: '00', minute: '00', second: '00', ampm: '' },
    { hour: '01', minute: '11', second: '11', ampm: 'AM' },
    { hour: '08', minute: '08', second: '08', ampm: 'AM' },
    { hour: '09', minute: '05', second: '07', ampm: 'AM' },
    { hour: '10', minute: '00', second: '00', ampm: 'AM' },
    { hour: '11', minute: '11', second: '11', ampm: 'AM' },
    { hour: '12', minute: '59', second: '59', ampm: 'PM' },
    { hour: '18', minute: '38', second: '58', ampm: '' },
    { hour: '20', minute: '20', second: '20', ampm: '' },
    { hour: '23', minute: '59', second: '59', ampm: '' },
  ];

  await page.goto('/#/digital-clock');
  const firstClock = page.locator('[data-clock-id="nashville"] .digit_clock_time');
  await expect(firstClock.locator('.vfgt_seven_segment_digit').first()).toBeVisible();

  for (const timeCase of cases) {
    await page.evaluate(({ hour, minute, second, ampm }) => {
      const names = ['top', 'upper-left', 'upper-right', 'middle', 'lower-left', 'lower-right', 'bottom'];
      const digits = {
        0: ['top', 'upper-left', 'upper-right', 'lower-left', 'lower-right', 'bottom'],
        1: ['upper-right', 'lower-right'],
        2: ['top', 'upper-right', 'middle', 'lower-left', 'bottom'],
        3: ['top', 'upper-right', 'middle', 'lower-right', 'bottom'],
        4: ['upper-left', 'upper-right', 'middle', 'lower-right'],
        5: ['top', 'upper-left', 'middle', 'lower-right', 'bottom'],
        6: ['top', 'upper-left', 'middle', 'lower-left', 'lower-right', 'bottom'],
        7: ['top', 'upper-right', 'lower-right'],
        8: ['top', 'upper-left', 'upper-right', 'middle', 'lower-left', 'lower-right', 'bottom'],
        9: ['top', 'upper-left', 'upper-right', 'middle', 'lower-right', 'bottom'],
      };
      const renderDigit = (digit) => {
        const active = new Set(digits[Number(digit)] || []);
        return `<span class="vfgt_seven_segment_digit" data-vfgt-seven-segment-digit="${digit}" aria-hidden="true">${names.map((segment) => `<span class="vfgt_seven_segment vfgt_seven_segment--${segment} ${active.has(segment) ? 'is-on' : 'is-off'}" data-segment="${segment}" data-state="${active.has(segment) ? 'on' : 'off'}"></span>`).join('')}</span>`;
      };
      const renderPart = (part) => `<span class="vfgt_seven_segment_visual" aria-hidden="true">${part.split('').map(renderDigit).join('')}</span>`;
      const renderColon = () => '<span class="vfgt_seven_segment_colon" aria-hidden="true" data-vfgt-seven-segment-colon><span></span><span></span></span>';
      document.querySelectorAll('.digit_clock_time').forEach((clock) => {
        [
          ['.hour', hour],
          ['.minute', minute],
          ['.second', second],
        ].forEach(([selector, value]) => {
          const part = clock.querySelector(selector);
          part.innerHTML = renderPart(value);
          part.setAttribute('aria-label', value);
          part.style.setProperty('--digit-count', String(value.length));
          part.style.setProperty('--digit-slot-count', String(Math.max(2, value.length)));
        });
        clock.querySelectorAll('.time_separator').forEach((separator) => {
          separator.innerHTML = renderColon();
          separator.setAttribute('aria-label', ':');
        });
        clock.querySelector('.ampm').textContent = ampm;
        clock.setAttribute('aria-label', `${hour}:${minute}:${second}${ampm ? ` ${ampm}` : ''}`);
      });
    }, timeCase);

    const layout = await page.locator('#clock-view .digital_clock_wrapper').evaluateAll((cards) => cards.map((card) => {
      const time = card.querySelector('.digit_clock_time');
      const cardBox = card.getBoundingClientRect();
      const timeBox = time.getBoundingClientRect();
      const childBoxes = Array.from(time.children).map((child) => child.getBoundingClientRect());
      const digitBoxes = Array.from(time.querySelectorAll('.vfgt_seven_segment_digit')).map((digit) => digit.getBoundingClientRect());
      const digitGaps = digitBoxes.slice(1).map((box, index) => box.left - digitBoxes[index].right);
      const centerLines = childBoxes.map((box) => Math.round((box.top + box.bottom) / 2));
      return {
        overflowsCard: timeBox.left < cardBox.left || timeBox.right > cardBox.right,
        wraps: time.scrollWidth > time.clientWidth + 1 || new Set(centerLines).size > 1,
        centered: Math.abs(((cardBox.left + cardBox.right) / 2) - ((timeBox.left + timeBox.right) / 2)) < 8,
        separatedDigits: digitGaps.every((gap) => gap > 2),
      };
    }));

    expect(layout.every((item) => !item.overflowsCard), `${timeCase.hour}:${timeCase.minute}:${timeCase.second} should fit inside each card`).toBe(true);
    expect(layout.every((item) => !item.wraps), `${timeCase.hour}:${timeCase.minute}:${timeCase.second} should stay on one line`).toBe(true);
    expect(layout.every((item) => item.centered), `${timeCase.hour}:${timeCase.minute}:${timeCase.second} should remain centered`).toBe(true);
    expect(layout.every((item) => item.separatedDigits), `${timeCase.hour}:${timeCase.minute}:${timeCase.second} digits should not collide`).toBe(true);
  }
});

test('Digital Clock desktop cards stay square while containing Orbitron clock content', async ({ page }) => {
  await page.setViewportSize({ width: 1472, height: 1684 });
  await page.goto('/#/digital-clock');
  await expect(page.locator('[data-clock-id="nashville"] .digit_clock_current_weather')).toBeVisible();

  const layout = await page.locator('#clock-view .digital_clock_wrapper').evaluateAll((cards) => cards.map((card) => {
    const cardBox = card.getBoundingClientRect();
    const childBoxes = Array.from(card.children)
      .filter((child) => {
        const style = window.getComputedStyle(child);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((child) => child.getBoundingClientRect());
    const contentBottom = Math.max(...childBoxes.map((box) => box.bottom));

    return {
      contentOverflowsBox: contentBottom > cardBox.bottom + 1,
      scrollOverflowsBox: card.scrollHeight > card.clientHeight + 1,
      square: Math.abs(cardBox.width - cardBox.height) <= 1,
    };
  }));

  expect(layout.every((item) => !item.contentOverflowsBox), 'visible clock content should stay inside every desktop card').toBe(true);
  expect(layout.every((item) => !item.scrollOverflowsBox), 'desktop clock card content should not overflow its square').toBe(true);
  expect(layout.every((item) => item.square), 'desktop clock cards should remain square').toBe(true);
});

test('Digital Clock keeps its settings cog on mobile but hides it on tablet and desktop', async ({ page }) => {
  const toggle = page.locator('#digit_clock_menu_toggle');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/digital-clock');
  await expect(toggle).toBeVisible();

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(toggle).toBeHidden();

  await page.setViewportSize({ width: 1472, height: 1684 });
  await expect(toggle).toBeHidden();
});

test('launcher opens every local app route from its cards', async ({ page }) => {
  const launcherTargets = [
    ['Open Weather', /#\/weather$/],
    ['Open Digital Clock', /#\/digital-clock$/],
    ['Open Lee-Lee', /#\/lee-lees-tracker$/],
    ['Open Violet Sprints', /#\/violet-sprints$/],
    ['Open Game Tracker', /#\/violet-futbol-game-tracker$/],
    ['Open Checklist', /#\/road-bike-checklist$/],
  ];

  for (const [buttonName, hashPattern] of launcherTargets) {
    await page.goto('/#/');
    await page.getByRole('button', { name: buttonName }).click();
    await expect(page).toHaveURL(hashPattern);
  }
});

test('weather launcher card shows and refreshes the device-local date', async ({ page }) => {
  await page.addInitScript(() => {
    const RealDate = Date;
    let currentDate = new RealDate('2026-09-17T23:59:59');
    class TestDate extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [currentDate.getTime()]));
      }

      static now() {
        return currentDate.getTime();
      }
    }
    window.Date = TestDate;
    window.setTestDate = (value) => {
      currentDate = new RealDate(value);
    };
  });

  for (const viewport of [{ width: 393, height: 852 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/#/');
    const summary = page.locator('[data-launcher-weather="weather"]');
    const date = summary.locator('[data-launcher-weather-date]');
    const expectedDate = await page.evaluate(() => new Intl.DateTimeFormat(navigator.language || undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date()));
    await expect(date).toHaveText(expectedDate);

    const bounds = await summary.evaluate((element) => {
      const location = element.querySelector('.clock_utility_weather_location').getBoundingClientRect();
      const dateElement = element.querySelector('[data-launcher-weather-date]').getBoundingClientRect();
      const summaryBounds = element.getBoundingClientRect();
      return {
        locationRight: location.right,
        dateLeft: dateElement.left,
        dateRight: dateElement.right,
        summaryRight: summaryBounds.right,
      };
    });
    expect(bounds.locationRight).toBeLessThanOrEqual(bounds.dateLeft);
    expect(bounds.dateRight).toBeLessThanOrEqual(bounds.summaryRight);
  }

  await page.evaluate(() => window.setTestDate('2026-09-18T00:00:01'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('[data-launcher-weather-date]')).toHaveText('Fri, Sep 18');
});

test('Weather Settings owns location and refresh controls without losing weather data', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/#/weather');
  await expect(page.getByRole('heading', { name: 'Weather' })).toBeVisible();
  await expect(page.locator('.weather_current_temp')).toContainText('78°F');

  const settingsToggle = page.getByRole('button', { name: 'Weather Settings' });
  await expect(settingsToggle).toHaveAttribute('aria-expanded', 'false');
  await settingsToggle.click();
  await expect(page.getByRole('button', { name: 'Close Weather Settings' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('heading', { name: 'Weather Settings' })).toBeVisible();
  await expect(page.locator('.weather_hero')).toHaveCount(0);
  for (const preference of ['light', 'dark']) {
    await page.evaluate((value) => window.LandosTheme?.setPreference?.(value), preference);
    await expect(page.locator('html')).toHaveAttribute('data-theme', preference);
    await expect(page.locator('.weather_settings_panel').first()).toBeVisible();
  }

  const location = page.locator('#weather-location');
  await location.fill('Austin, Texas');
  await page.getByRole('button', { name: 'Set', exact: true }).click();
  await expect(page.locator('.weather_settings_status')).toContainText('Weather loaded for Austin, Texas.');
  await expect(page.locator('.weather_last_updated')).toContainText('Last updated');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('weather_app_preferences_v1')).location)).toBe('Austin, Texas');

  const beforeRefresh = page.weatherRequests.length;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.locator('[data-weather-action="refresh"]').evaluate((button) => {
    button.disabled = false;
    button.click();
  });
  await expect(page.locator('.weather_settings_status')).toContainText('Weather refreshed.');
  expect(page.weatherRequests.length).toBe(beforeRefresh + 1);

  await page.unroute(WEATHER_API_PATTERN);
  await page.route(WEATHER_API_PATTERN, async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'not-json' }));
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('.weather_settings_status')).toContainText('Weather unavailable right now.');
  await page.getByRole('button', { name: 'Close Weather Settings' }).click();
  await expect(page.getByRole('button', { name: 'Weather Settings' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.weather_location')).toContainText('Austin, Texas');
  await expect(page.locator('.weather_current_temp')).toContainText('78°F');
  await expect(page.locator('.weather_location_form')).toHaveCount(0);
  await expect(page.locator('.weather_hero .weather_refresh_button')).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: 'Weather Settings' }).click();
  await expect(page.getByRole('button', { name: 'Close Weather Settings' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#weather-location')).toHaveValue('Austin, Texas');

  for (const viewport of [{ width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    const panel = page.locator('.weather_settings_panel').first();
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox.width).toBeLessThanOrEqual(viewport.width);
  }
});

test('appearance setting reflects the preference and applies immediately', async ({ page }) => {
  await page.goto('/#/settings');
  const settingsToggle = page.getByRole('button', { name: 'Close Lando\'s World Settings' });
  await expect(settingsToggle).toBeVisible();
  await expect(settingsToggle).toHaveCSS('color', await page.locator('html').getAttribute('data-theme') === 'light' ? 'rgb(23, 32, 51)' : 'rgb(255, 255, 255)');

  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-appearance-preference', 'system');

  const dark = page.getByRole('radio', { name: 'Dark' });
  await dark.click();
  await expect(dark).toHaveAttribute('aria-checked', 'true');
  await expect(root).toHaveAttribute('data-appearance-preference', 'dark');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#000000');

  await page.reload();
  await expect(page.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
  await expect(root).toHaveAttribute('data-appearance-preference', 'dark');

  const light = page.getByRole('radio', { name: 'Light' });
  await light.click();
  await expect(light).toHaveAttribute('aria-checked', 'true');
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f6f8fb');
});

test('LsW settings cog follows appearance and keeps its top-right position', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('#/');
    const homeToggle = page.getByRole('button', { name: 'Lando\'s World Settings' });
    await expect(homeToggle).toHaveCSS('color', await page.locator('html').getAttribute('data-theme') === 'light' ? 'rgb(23, 32, 51)' : 'rgb(255, 255, 255)');
    const homeBox = await homeToggle.boundingBox();
    await homeToggle.click();
    const settingsToggle = page.getByRole('button', { name: 'Close Lando\'s World Settings' });
    await expect(settingsToggle).toHaveCSS('color', await page.locator('html').getAttribute('data-theme') === 'light' ? 'rgb(23, 32, 51)' : 'rgb(255, 255, 255)');
    const settingsBox = await settingsToggle.boundingBox();
    expect(homeBox).not.toBeNull();
    expect(settingsBox).not.toBeNull();
    expect(Math.abs((homeBox?.x || 0) - (settingsBox?.x || 0))).toBeLessThan(2);
    expect(Math.abs((homeBox?.y || 0) - (settingsBox?.y || 0))).toBeLessThan(2);
  }
});

test('light appearance reaches child app surfaces with readable foregrounds', async ({ page }) => {
  const cases = [
    {
      hash: '#/weather',
      surface: '.weather_hero',
      text: '.weather_current_temp',
    },
    {
      hash: '#/lee-lees-tracker',
      surface: '.lee_lee_diabetes_editor',
      text: '.lee_lee_diabetes_editor_title',
    },
    {
      hash: '#/violet-sprints',
      surface: '.sprints-list-item',
      text: '.sprints-list-name',
    },
    {
      hash: '#/road-bike-checklist',
      surface: '.road_bike_hero',
      text: '.road_bike_title',
    },
  ];

  for (const appCase of cases) {
    await page.goto('/#/settings');
    await page.evaluate(() => window.LandosTheme?.setPreference?.('light'));
    await page.goto(`/${appCase.hash}`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator(appCase.surface).first()).toBeVisible();
    await expect(page.locator(appCase.text).first()).toBeVisible();

    const colors = await page.locator(appCase.surface).first().evaluate((surface, textSelector) => {
      function channelValues(value) {
        const match = value.match(/rgba?\(([^)]+)\)/);
        if (!match) return { channels: [255, 255, 255], alpha: 1 };
        const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
        return { channels: parts.slice(0, 3), alpha: parts[3] ?? 1 };
      }
      function luminance(value) {
        const [r, g, b] = channelValues(value).channels.map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.03928
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
      }
      const text = surface.querySelector(textSelector);
      const surfaceBackground = getComputedStyle(surface).backgroundColor;
      const effectiveSurfaceBackground = channelValues(surfaceBackground).alpha === 0
        ? getComputedStyle(document.body).backgroundColor
        : surfaceBackground;
      return {
        surfaceLuminance: luminance(effectiveSurfaceBackground),
        textLuminance: luminance(getComputedStyle(text).color),
      };
    }, appCase.text);

    expect(colors.surfaceLuminance).toBeGreaterThan(0.65);
    expect(colors.textLuminance).toBeLessThan(0.25);
  }
});

test('light appearance keeps launcher cards as branded islands', async ({ page }) => {
  await page.goto('/#/settings');
  await page.evaluate(() => window.LandosTheme?.setPreference?.('light'));
  await page.goto('/#/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const brandedCards = [
    { selector: '.clock_utility_card--clock', darkColor: 'rgb(6, 19, 11)' },
    { selector: '.clock_utility_card--lee-lee-diabetes', darkColor: 'rgb(16, 5, 29)' },
    { selector: '.clock_utility_card--purple', darkColor: 'rgb(16, 5, 29)' },
    { selector: '.clock_utility_card--vfgt', darkColor: 'rgb(16, 5, 29)' },
    { selector: '.clock_utility_card--road-bike', darkColor: 'rgb(24, 9, 18)' },
    { selector: '.clock_utility_card--notecards', darkColor: 'rgb(12, 11, 12)' },
  ];

  for (const card of brandedCards) {
    await expect(page.locator(card.selector)).toBeVisible();
    const styles = await page.locator(card.selector).evaluate((element) => {
      function luminance(value) {
        const match = value.match(/rgba?\(([^)]+)\)/);
        if (!match) return 0;
        const [r, g, b] = match[1].split(/[,\s/]+/).filter(Boolean).slice(0, 3).map(Number).map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.03928
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
      }

      const title = element.querySelector('.clock_utility_title');
      return {
        backgroundImage: getComputedStyle(element).backgroundImage,
        titleLuminance: luminance(getComputedStyle(title).color),
      };
    });

    expect(styles.backgroundImage).toContain(card.darkColor);
    expect(styles.titleLuminance).toBeGreaterThan(0.65);
  }

  const readWeatherStyles = () => page.locator('.clock_utility_card--weather').evaluate((element) => ({
    backgroundImage: getComputedStyle(element).backgroundImage,
    backgroundColor: getComputedStyle(element).backgroundColor,
    borderColor: getComputedStyle(element).borderColor,
    titleColor: getComputedStyle(element.querySelector('.clock_utility_title')).color,
    summaryBackgroundImage: getComputedStyle(element.querySelector('.clock_utility_weather_summary')).backgroundImage,
    summaryBackgroundColor: getComputedStyle(element.querySelector('.clock_utility_weather_summary')).backgroundColor,
  }));

  const lightWeatherStyles = await readWeatherStyles();
  expect(lightWeatherStyles.backgroundImage).toContain('rgba(255, 212, 0, 0.25)');
  expect(lightWeatherStyles.backgroundImage).toContain('rgb(245, 196, 0)');
  expect(lightWeatherStyles.titleColor).toBe('rgb(255, 229, 102)');

  await page.evaluate(() => window.LandosTheme?.setPreference?.('dark'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await readWeatherStyles()).toEqual(lightWeatherStyles);
});

test('Digital Clock launcher shows live device-local seven-segment time and date', async ({ page }) => {
  await page.goto('/#/');
  const timeZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  await expect(page.locator('.clock_utility_card--clock .clock_utility_description')).toHaveCount(0);
  for (const viewport of [{ width: 393, height: 852 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    const localClock = page.locator('.clock_utility_card--clock .clock_utility_local_time');
    await expect(localClock).toBeVisible();
    const expected = await page.evaluate(() => {
      const now = new Date();
      const hour = String(now.getHours() % 12 || 12);
      const minute = String(now.getMinutes()).padStart(2, '0');
      const second = String(now.getSeconds()).padStart(2, '0');
      const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
      const date = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
      return { ariaLabel: `${hour}:${minute}:${second} ${ampm}`, date };
    });
    await expect(localClock.locator('.digit_clock_time')).toHaveAttribute('aria-label', /^(1[0-2]|[1-9]):[0-5]\d:[0-5]\d (AM|PM)$/);
    await expect(localClock.locator('.digit_clock_time')).toHaveAttribute('aria-label', expected.ariaLabel);
    await expect(localClock.locator('[data-launcher-digital-clock-date]')).toHaveText(expected.date);
    await expect(localClock.locator('.vfgt_seven_segment_visual')).toHaveCount(3);
    const panelStyle = await localClock.evaluate((element) => {
      const style = getComputedStyle(element);
      return { borderWidth: style.borderTopWidth, backgroundImage: style.backgroundImage };
    });
    expect(panelStyle.borderWidth).toBe('1px');
    expect(panelStyle.backgroundImage).toContain('radial-gradient');
    const cardGeometry = await page.locator('.clock_utility_card--clock').evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(cardGeometry.scrollHeight).toBeLessThanOrEqual(cardGeometry.clientHeight);
    expect(cardGeometry.scrollWidth).toBeLessThanOrEqual(cardGeometry.clientWidth);
  }

  await page.waitForTimeout(1100);
  const localClock = page.locator('.clock_utility_card--clock .clock_utility_local_time');
  await expect(localClock.locator('.digit_clock_time')).toHaveAttribute('aria-label', /^(1[0-2]|[1-9]):[0-5]\d:[0-5]\d (AM|PM)$/);

  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pageshow'));
  });
  await expect(localClock.locator('.digit_clock_time')).toHaveAttribute('aria-label', /^(1[0-2]|[1-9]):[0-5]\d:[0-5]\d (AM|PM)$/);
  expect(timeZone).toBeTruthy();
});

test('shared app theme keeps mobile date and time inputs inside app containers', async ({ page }) => {
  const cases = [
    {
      hash: '#/lee-lees-tracker',
      root: '#lee-lees-tracker-view',
      fieldClass: 'lee_lee_diabetes_input',
    },
    {
      hash: '#/violet-futbol-game-tracker',
      root: '#violet-futbol-game-tracker-view',
      fieldClass: '',
    },
  ];

  await page.setViewportSize({ width: 393, height: 852 });

  for (const appCase of cases) {
    await page.goto(`/${appCase.hash}`);
    await page.locator(appCase.root).evaluate((root, fieldClass) => {
      const existing = root.querySelector('[data-mobile-picker-check]');
      if (existing) existing.remove();
      root.insertAdjacentHTML('beforeend', `
        <form data-mobile-picker-check style="width: 100%; max-width: 100%; padding: 16px; box-sizing: border-box;">
          <div data-picker-box style="width: 100%; max-width: 100%; padding: 16px; box-sizing: border-box; border: 1px solid currentColor;">
            <input class="${fieldClass}" name="date" type="date" value="2026-08-22" style="display: block; width: 100%; max-width: 100%; min-width: 0;">
            <input class="${fieldClass}" name="time" type="time" value="09:16" style="display: block; width: 100%; max-width: 100%; min-width: 0; margin-top: 16px;">
          </div>
        </form>
      `);
    }, appCase.fieldClass);

    const metrics = await page.locator(`${appCase.root} [data-picker-box]`).evaluate((box) => {
      const boxRect = box.getBoundingClientRect();
      const fields = [...box.querySelectorAll('input')].map((input) => {
        const rect = input.getBoundingClientRect();
        const style = getComputedStyle(input);
        return {
          appearance: style.appearance,
          webkitAppearance: style.webkitAppearance,
          inlineSize: parseFloat(style.inlineSize),
          right: rect.right,
          width: rect.width,
        };
      });
      return { boxRight: boxRect.right, fields };
    });

    for (const field of metrics.fields) {
      expect(field.right).toBeLessThanOrEqual(metrics.boxRight + 0.5);
      expect(field.width).toBeGreaterThan(0);
      expect(field.inlineSize).toBeGreaterThan(0);
      expect(field.appearance).toBe('none');
      expect(field.webkitAppearance).toBe('none');
    }
  }
});

test('Lee-Lee printable report can render patient metadata without app chrome', async ({ page }) => {
  await page.goto('/#/lee-lees-tracker');
  const reportHtml = await page.evaluate(() => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      settings: {
        ...(current.settings || {}),
        patientName: 'Levi Bernal',
        patientBirthDate: '2014-06-13',
        clinicName: "Vandy's Children's Hospital",
      },
    }));
    return window.LeeLeeTrackerReports.renderReportDocument('clinical', [
      {
        id: 'browser-smoke-breakfast',
        type: 'Breakfast',
        eventType: 'check-insulin',
        bloodSugar: 124,
        administeredInsulinUnits: 4,
        recordTimestamp: '2026-08-13T12:00:00.000Z',
        createdAt: '2026-08-13T12:00:00.000Z',
        updatedAt: '2026-08-13T12:00:00.000Z',
        notes: '',
      },
    ], 'Aug 7, 2026 through Aug 13, 2026');
  });

  await page.setContent(reportHtml);
  await expect(page.getByRole('heading', { name: 'Glucose & Insulin Log' })).toBeVisible();
  await expect(page.getByText('Patient')).toBeVisible();
  await expect(page.getByText('Levi Bernal')).toBeVisible();
  await expect(page.getByText('Date of birth')).toBeVisible();
  await expect(page.getByText('Jun 13, 2014')).toBeVisible();
  await expect(page.getByText("Vandy's Children's Hospital")).toBeVisible();
  await expect(page.getByText('Report range')).toBeVisible();
  await expect(page.getByText('Generated')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Clinical Log' })).toBeVisible();
  await expect(page.getByText("Lando's World")).toHaveCount(0);
  await expect(page.getByText('Online')).toHaveCount(0);
  await expect(page.getByText('Offline')).toHaveCount(0);
});

test('Lee-Lee print media hides app shell chrome around the report body', async ({ page }) => {
  await page.goto('/#/lee-lees-tracker');
  await page.evaluate(() => {
    const reportHtml = window.LeeLeeTrackerReports.renderReportDocument('clinical', [
      {
        id: 'browser-print-row',
        type: 'Breakfast',
        eventType: 'check-insulin',
        bloodSugar: 124,
        administeredInsulinUnits: 0,
        recordTimestamp: '2026-08-13T12:00:00.000Z',
        createdAt: '2026-08-13T12:00:00.000Z',
        updatedAt: '2026-08-13T12:00:00.000Z',
        notes: '',
      },
    ], 'Aug 7, 2026 through Aug 13, 2026');
    document.getElementById('lee-lee-diabetes-root').innerHTML = `
      <section class="lee_lee_diabetes_report_preview" aria-label="Printable report preview">
        ${reportHtml}
      </section>
    `;
  });

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.ecosystem_nav')).toHaveCount(6);
  expect(await page.locator('.ecosystem_nav').evaluateAll((nodes) => (
    nodes.every((node) => getComputedStyle(node).display === 'none')
  ))).toBe(true);
  expect(await page.locator('.digit_clock_header').evaluateAll((nodes) => (
    nodes.every((node) => getComputedStyle(node).display === 'none')
  ))).toBe(true);
  expect(await page.locator('.pwa_network_status').evaluateAll((nodes) => (
    nodes.every((node) => getComputedStyle(node).display === 'none')
  ))).toBe(true);
  await expect(page.locator('.lee_lee_diabetes_report')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Glucose & Insulin Log' })).toBeVisible();
  await expect(page.getByText('0 units')).toBeVisible();
});

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

async function chooseLeeLeeSection(page, name) {
  const bottomNav = page.getByLabel("Lee-Lee’s Tracker mobile navigation");
  const nav = await bottomNav.isVisible()
    ? bottomNav
    : page.getByLabel("Lee-Lee’s Tracker sections");
  await nav.getByRole('button', { name }).click();
}

async function expectNoPrivateLLTDom(page) {
  const root = page.locator('#lee-lee-diabetes-root');
  await expect(root.locator('[data-plan-editor], [data-lee-lee-editor], [data-carb-calculator], [data-meal-builder], .lee_lee_diabetes_timeline, .lee_lee_diabetes_report, .lee_lee_diabetes_pre_meal_timer_modal, [data-food-library-accordion]')).toHaveCount(0);
  await expect(root.locator('[name="patientName"], [name="clinicName"], [name="insulinCarbRatioGrams"]')).toHaveCount(0);
  await expect(page.locator('#lee_lee_settings_toggle')).toBeHidden();
}

test('LLT Issue #11 equivalent Settings labels and native timer card share UI typography', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    window.LeeLeePreMealTimer.start({ durationMinutes: 3, sourceEntryId: 'typography-fixture', sourceEntry: { type: 'Breakfast', mealCarbs: 10, administeredInsulinUnits: 1 } });
    const key = window.LeeLeeTrackerStorage.storageKey;
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: localStorage.getItem(key) }));
  });
  const typography = node => {
    const style = getComputedStyle(node);
    return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight, lineHeight: style.lineHeight };
  };
  const root = page.locator('.lee_lee_diabetes_shell');
  const card = page.locator('.lee_lee_diabetes_pre_meal_timer_card');
  await expect(card).toBeVisible();
  expect(await card.evaluate(typography)).toEqual(await root.evaluate(typography));
  expect(await card.locator('[data-pre-meal-timer-value]').evaluate(node => getComputedStyle(node).fontFamily)).toContain('Roboto Mono');
  await page.locator('#lee_lee_settings_toggle').click();
  await page.locator('[data-settings-accordion]').evaluateAll(nodes => nodes.forEach(node => { node.open = true; }));
  expect(await page.locator('.lee_lee_diabetes_field_label').evaluate(typography)).toEqual(
    await page.locator('[name="bedtimeBaseUnits"]').locator('..').evaluate(typography),
  );
  const statusValue = label => page.locator('.lee_lee_diabetes_status_grid > div').filter({ has: page.locator('dt').filter({ hasText: new RegExp(`^${label}$`) }) }).first().locator('dd');
  await expect(statusValue('Pending total').locator('.lee_lee_diabetes_numeric')).toHaveText('0');
  expect(await statusValue('Pending total').locator('span').evaluate(node => getComputedStyle(node).fontFamily)).toContain('Roboto Mono');
  expect(await statusValue('Device').evaluate(node => getComputedStyle(node).fontFamily)).toContain('DM Sans');
  expect(await statusValue('Local records').locator('span').evaluate(node => getComputedStyle(node).fontFamily)).toContain('Roboto Mono');
});

test('LLT Issue #11 UI and data fonts remain distinct across responsive surfaces', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await openProtectedLeeLeeTracker(page);
  await seedHistoricalEdit(page);
  await page.evaluate(() => {
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    window.LeeLeeTrackerStorage.updateTrackerData(current => ({ ...current, records: [...current.records, {
      ...current.records[0], id: 'typography-today', date: today, recordTimestamp: date.toISOString(),
      notes: 'Synthetic note: a longer ordinary prose entry should wrap comfortably without using the data font.',
    }] }));
    const key = window.LeeLeeTrackerStorage.storageKey;
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: localStorage.getItem(key) }));
  });
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px "DM Sans"') && document.fonts.check('16px "Roboto Mono"'))).toBe(true);
  const storedBefore = await page.evaluate(() => localStorage.getItem(window.LeeLeeTrackerStorage.storageKey));
  const capture = async name => {
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  };
  for (const [width, height] of [[320, 900], [393, 900], [768, 900], [1280, 900], [852, 393]]) {
    await page.setViewportSize({ width, height });
    for (const section of ['Today', 'History', 'Reports', 'Foods']) {
      await chooseLeeLeeSection(page, section);
      await page.evaluate(() => document.fonts.ready);
      const fonts = await page.locator('.lee_lee_diabetes_shell').evaluate(root => {
        const visible = node => node.getClientRects().length > 0;
        return {
          root: getComputedStyle(root).fontFamily,
          ui: [...root.querySelectorAll('button, select, textarea, input[type="search"], input[type="text"]:not([inputmode])')].filter(visible).map(node => getComputedStyle(node).fontFamily),
          data: [...root.querySelectorAll('.lee_lee_diabetes_numeric, input[type="number"], input[inputmode="decimal"]')].filter(visible).map(node => getComputedStyle(node).fontFamily),
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      expect(fonts.root).toContain('DM Sans');
      expect(fonts.ui.every(font => font.includes('DM Sans'))).toBe(true);
      expect(fonts.data.every(font => font.includes('Roboto Mono'))).toBe(true);
      expect(fonts.overflow, `${section} at ${width}px`).toBe(false);
      await capture(`${section}-${width}`);
      if (section === 'Reports') {
        await page.locator('[name="range"]').selectOption('custom');
        await page.locator('[name="startDate"]').fill('2026-08-01');
        await page.locator('[name="endDate"]').fill('2026-08-31');
        for (const view of ['summary', 'trends', 'averages', 'detailed-log']) {
          await page.locator('[name="view"]').selectOption(view);
          await capture(`Reports-${view}-${width}`);
        }
      }
      if (section === 'Foods') {
        await page.getByRole('button', { name: '+ Add New Meal' }).click();
        await capture(`Meal-builder-${width}`);
        await page.locator('[data-action="cancel-saved-meal-builder"]').last().click();
        await page.locator('[data-food-library-accordion="foods"] summary').click();
        await page.getByRole('button', { name: '+ Add New Food' }).click();
        await capture(`Food-editor-${width}`);
        await page.locator('button[data-action="cancel-food-library-editor"]').last().click();
      }
    }
    await openSeededLeeLeeHistoryDay(page);
    await capture(`History-day-${width}`);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await capture(`Edit-entry-${width}`);
    await page.locator('[data-lee-lee-editor]').getByRole('button', { name: 'Cancel', exact: true }).click();
    await chooseLeeLeeSection(page, 'Log Entry');
    const form = page.locator('[data-lee-lee-editor]');
    await expect(form).toBeVisible();
    for (const name of ['bloodSugar', 'insulinUnits', 'date', 'time']) {
      expect(await form.locator(`[name="${name}"]`).evaluate(node => getComputedStyle(node).fontFamily)).toContain('Roboto Mono');
    }
    expect(await form.locator('textarea[name=notes]').evaluate(node => getComputedStyle(node).fontFamily)).toContain('Roboto Mono');
    expect(await form.locator('select').first().evaluate(node => getComputedStyle(node).fontFamily)).toContain('DM Sans');
    await capture(`Entry-${width}`);
    await form.getByRole('button', { name: 'Open Carb Calculator' }).click();
    await expect(page.locator('[data-carb-calculator]')).toBeVisible();
    await capture(`Calculator-${width}`);
    for (const category of ['favorites', 'recent', 'foods', 'meals']) {
      await page.locator('[data-carb-library-view]').selectOption(category);
      await capture(`Calculator-${category}-${width}`);
    }
    await page.getByRole('button', { name: 'Search foods...' }).click();
    await capture(`Food-search-${width}`);
    await page.getByRole('button', { name: 'Back to Carb Calculator', exact: true }).click();
    await page.getByRole('button', { name: '+ Add Manual Amount...' }).click();
    await capture(`Manual-amount-${width}`);
    await page.getByRole('button', { name: 'Back to Carb Calculator', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel Carb Calculator', exact: true }).click();
    await form.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.locator('#lee_lee_settings_toggle').click();
    await page.locator('[data-settings-accordion]').evaluateAll(nodes => nodes.forEach(node => { node.open = true; }));
    await capture(`Settings-${width}`);
    await page.locator('#lee_lee_settings_toggle').click();
  }
  expect(await page.evaluate(() => localStorage.getItem(window.LeeLeeTrackerStorage.storageKey))).toBe(storedBefore);
});

test('Issue #10 resolving and logged-out gates contain no private DOM and Settings cannot bypass them', async ({ page }) => {
  await openProtectedLeeLeeTracker(page, { authMode: 'resolving' });
  await expectNoPrivateLLTDom(page);
  await page.evaluate(() => document.querySelector('#lee_lee_settings_toggle').click());
  await expect(page.getByRole('heading', { name: 'Checking access…' })).toBeVisible();
  await page.evaluate(() => window.__lltAuth.releaseInitial());
  await expect(page.getByRole('heading', { name: 'Sign In', exact: true })).toBeVisible();
  await page.evaluate(() => document.querySelector('#lee_lee_settings_toggle').click());
  await expectNoPrivateLLTDom(page);
  await page.getByRole('link', { name: 'Back to Lando’s World', exact: true }).click();
  await expect(page.locator('#lando-home-view')).toBeVisible();
  await page.getByRole('button', { name: 'Open Lee-Lee’s Tracker' }).click();
  await expect(page.getByRole('heading', { name: 'Sign In', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.locator('#lando-home-view')).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Sign In', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Checking access…' })).toBeVisible();
  await expectNoPrivateLLTDom(page);
});

for (const [name, error, message] of [
  ['credentials', { code: 'invalid_credentials', status: 400 }, /wasn't accepted/],
  ['network', { throws: true }, /Unable to connect/],
  ['unexpected', { message: 'PRIVATE BACKEND DETAILS', status: 422 }, /Unable to sign in right now/],
  ['rate limit', { status: 429 }, /Too many sign-in attempts/],
]) {
  test(`Issue #10 ${name} failure stays on safe gate and permits successful retry`, async ({ page }) => {
    await openProtectedLeeLeeTracker(page, { authMode: 'denied', signInError: error });
    await page.getByLabel('Email', { exact: true }).fill('synthetic@example.invalid');
    await page.getByLabel('Password', { exact: true }).fill('synthetic-test-password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page.getByText(message)).toBeVisible();
    await expectNoPrivateLLTDom(page);
    await expect(page.getByText('PRIVATE BACKEND DETAILS')).toHaveCount(0);
    await page.evaluate(() => window.__lltAuth.allowSignIn());
    await page.getByLabel('Email', { exact: true }).fill('synthetic@example.invalid');
    await page.getByLabel('Password', { exact: true }).fill('synthetic-test-password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Lee-Lee.s Tracker/ })).toBeVisible();
  });
}

test('Issue #10 sign-in gate actions have matching button treatment', async ({ page }) => {
  await openProtectedLeeLeeTracker(page, { authMode: 'denied' });
  const signIn = page.getByRole('button', { name: 'Sign In', exact: true });
  const back = page.getByRole('link', { name: 'Back to Lando’s World', exact: true });
  const treatment = element => {
    const style = getComputedStyle(element);
    return { background: style.backgroundImage, color: style.color, border: style.border, padding: style.padding, font: style.font, height: element.getBoundingClientRect().height };
  };
  expect(await back.evaluate(treatment)).toEqual(await signIn.evaluate(treatment));
  expect(await back.evaluate(element => getComputedStyle(element).textDecorationLine)).toBe('none');
  await back.click();
  await expect(page.locator('#lando-home-view')).toBeVisible();
});

test('Issue #10 successful authentication honors required device setup', async ({ page }) => {
  await openProtectedLeeLeeTracker(page, { authMode: 'denied', deviceIdentity: false });
  await page.getByLabel('Email', { exact: true }).fill('synthetic@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Who Uses This Device?' })).toBeVisible();
  await page.getByLabel('This device is used by').selectOption('Unknown');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Lee-Lee.s Tracker/ })).toBeVisible();
});

for (const surface of ['Today', 'History', 'Reports', 'Foods', 'Settings', 'New Entry', 'Edit Entry', 'Calculator', 'Food Search', 'Manual Amount', 'My Meal Builder', 'Timer Detail']) {
  test(`Issue #10 auth loss removes ${surface}, releases UI resources, and retains data`, async ({ page }) => {
    await openProtectedLeeLeeTracker(page);
    await seedHistoricalEdit(page);
    await page.evaluate(() => {
      window.LeeLeeTrackerStorage.updateTrackerData(current => ({ ...current, settings: { ...current.settings, patientName: 'Synthetic private patient' } }));
      window.LeeLeePreMealTimer.start({ durationMinutes: 1, sourceEntryId: 'synthetic-timer-source', sourceEntry: { type: 'Breakfast', mealCarbs: 10, administeredInsulinUnits: 1 } });
      // Refresh the current view using the same storage-notification path as another tab.
      const key = window.LeeLeeTrackerStorage.storageKey;
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: localStorage.getItem(key) }));
    });
    if (['History', 'Reports', 'Foods'].includes(surface)) await chooseLeeLeeSection(page, surface);
    if (surface === 'Settings') await page.locator('#lee_lee_settings_toggle').click();
    if (surface === 'My Meal Builder') {
      await chooseLeeLeeSection(page, 'Foods');
      await page.getByRole('button', { name: '+ Add New Meal' }).click();
      await expect(page.locator('[data-meal-builder]')).toBeVisible();
    }
    if (surface === 'Edit Entry') {
      await openSeededLeeLeeHistoryDay(page);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Edit Entry' })).toBeVisible();
    }
    if (['New Entry', 'Calculator', 'Food Search', 'Manual Amount'].includes(surface)) {
      await chooseLeeLeeSection(page, 'Log Entry');
      if (surface !== 'New Entry') await page.getByRole('button', { name: 'Open Carb Calculator' }).click();
      if (surface === 'Food Search') await page.getByRole('button', { name: 'Search foods...' }).click();
      if (surface === 'Manual Amount') await page.getByRole('button', { name: '+ Add Manual Amount...' }).click();
    }
    if (surface === 'Timer Detail') await page.locator('[data-action="open-pre-meal-timer"]').click();
    const stored = await page.evaluate(() => ({ tracker: localStorage.getItem(window.LeeLeeTrackerStorage.storageKey), timer: localStorage.getItem(window.LeeLeePreMealTimer.STORAGE_KEY) }));
    await page.evaluate(() => window.__lltAuth.emit());
    await expect(page).toHaveURL(/#\/$/);
    await expectNoPrivateLLTDom(page);
    expect(await page.evaluate(() => document.body.style.position)).not.toBe('fixed');
    expect(await page.evaluate(() => ({ tracker: localStorage.getItem(window.LeeLeeTrackerStorage.storageKey), timer: localStorage.getItem(window.LeeLeePreMealTimer.STORAGE_KEY) }))).toEqual(stored);
    await page.evaluate(() => {
      const key = window.LeeLeeTrackerStorage.storageKey;
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: localStorage.getItem(key) }));
      window.visualViewport.dispatchEvent(new Event('resize'));
      window.visualViewport.dispatchEvent(new Event('scroll'));
      document.querySelector('#lee_lee_settings_toggle').click();
    });
    await expectNoPrivateLLTDom(page);
    await page.getByRole('button', { name: 'Open Lee-Lee’s Tracker' }).click();
    await expect(page.getByRole('heading', { name: 'Sign In', exact: true })).toBeVisible();
    await expectNoPrivateLLTDom(page);
  });
}

test('Issue #10 explicit sign-out replaces the route and history cannot reveal private DOM', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => { window.location.hash = '#/'; });
  await expect(page.locator('#lando-home-view')).toBeVisible();
  await page.getByRole('button', { name: 'Open Lee-Lee’s Tracker' }).click();
  await expect(page.getByRole('heading', { name: /Lee-Lee.s Tracker/ })).toBeVisible();
  await page.locator('#lee_lee_settings_toggle').click();
  await page.getByRole('button', { name: 'Sign Out This Device' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expectNoPrivateLLTDom(page);
  await page.goBack();
  await expect(page.locator('#lando-home-view')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Sign In', exact: true })).toBeVisible();
  await expectNoPrivateLLTDom(page);
  await page.goForward();
  await expect(page.locator('#lando-home-view')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#lando-home-view')).toBeVisible();
  await expectNoPrivateLLTDom(page);
  await page.evaluate(() => { window.location.hash = '#/lee-lees-tracker'; });
  await expect(page.getByRole('heading', { name: 'Sign In', exact: true })).toBeVisible();
  await expectNoPrivateLLTDom(page);
});

test('Issue #10 a usable session expiring while open revokes private rendering', async ({ page }) => {
  await page.clock.install();
  await openProtectedLeeLeeTracker(page);
  await page.clock.fastForward(3600001);
  await expect(page).toHaveURL(/#\/$/);
  await expectNoPrivateLLTDom(page);
  expect(await page.evaluate(() => window.LeeLeeTrackerAccess.getState())).toBe('denied');
});

test('Issue #10 delayed reconciliation cannot restore private DOM after simulated cross-tab logout', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    window.__lltSyncReadGate = new Promise(resolve => { window.__releaseLLTReads = resolve; });
    window.__lltAuth.restore();
    window.__lltAuth.emit();
    window.__releaseLLTReads();
  });
  await expect(page).toHaveURL(/#\/$/);
  await expectNoPrivateLLTDom(page);
  await expect.poll(() => page.evaluate(() => window.LeeLeeTrackerAccess.getState())).toBe('denied');
});

for (const authMode of ['authorized', 'denied', 'expired', 'initial-error']) {
  test(`Issue #10 offline ${authMode} session obeys the access boundary`, async ({ page, context }) => {
    await openProtectedLeeLeeTracker(page, { authMode });
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    if (authMode === 'authorized') {
      await expect(page.getByRole('heading', { name: /Lee-Lee.s Tracker/ })).toBeVisible();
    } else await expectNoPrivateLLTDom(page);
    // This isolated context is disposed after the offline assertions. Avoid an
    // unrelated shell/network refresh while tearing down the offline fixture.
  });
}

test('Issue #10 timer completion after auth loss remains private and resumes after authorization', async ({ page }) => {
  await page.clock.install();
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    window.LeeLeePreMealTimer.start({ durationMinutes: 1, sourceEntryId: 'synthetic-source', sourceEntry: { type: 'Breakfast', mealCarbs: 10 } });
    window.__lltAuth.emit();
  });
  const timestamps = await page.evaluate(() => JSON.parse(localStorage.getItem(window.LeeLeePreMealTimer.STORAGE_KEY)));
  await page.clock.fastForward(61000);
  await expectNoPrivateLLTDom(page);
  const retained = await page.evaluate(() => JSON.parse(localStorage.getItem(window.LeeLeePreMealTimer.STORAGE_KEY)));
  expect(retained.startedAt).toBe(timestamps.startedAt);
  expect(retained.endsAt).toBe(timestamps.endsAt);
  await page.evaluate(() => window.__lltAuth.restore());
  await page.getByRole('button', { name: 'Open Lee-Lee’s Tracker' }).click();
  // Reauthorization follows the normal initial destination, where the saved
  // absolute timer is normalized and its completed detail can be presented.
  await page.reload();
  await expect(page.locator('.lee_lee_diabetes_pre_meal_timer_modal')).toBeVisible();
});

async function openFoodLibraryAccordion(page, section) {
  const panel = page.locator(`[data-food-library-accordion="${section}"]`);
  if (await panel.getAttribute('open') === null) await panel.locator('summary').click();
}

test('Lee-Lee top-level navigation omits the standalone Export section', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openProtectedLeeLeeTracker(page);
  const desktopNav = page.getByLabel("Lee-Lee’s Tracker mobile navigation");
  await expect(desktopNav.getByRole('button')).toHaveCount(5);
  await expect(desktopNav.getByRole('button', { name: 'Today' })).toBeVisible();
  await expect(desktopNav.getByRole('button', { name: 'History' })).toBeVisible();
  await expect(desktopNav.getByRole('button', { name: 'Reports' })).toBeVisible();
  await expect(desktopNav.getByRole('button', { name: 'Foods' })).toBeVisible();
  await expect(desktopNav.getByRole('button', { name: 'Log Entry' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await openProtectedLeeLeeTracker(page);
  const mobileNav = page.getByLabel("Lee-Lee’s Tracker mobile navigation");
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole('button')).toHaveCount(5);

  await mobileNav.getByRole('button', { name: 'Reports' }).click();
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print or Save as PDF' })).toBeVisible();
});

async function seedLeeLeeRecords(page, records) {
  await page.evaluate((seedRecords) => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      records: seedRecords,
    }));
  }, records);
}

function historicalEditPlan(overrides = {}) {
  return {
    id: 'issue85-plan-a', name: 'Historical Plan A', effectiveFrom: '2026-07-31', effectiveTo: null,
    mealBaseUnitsByType: { Breakfast: 2, Lunch: 3, Dinner: 4, Snack: 0 }, mealBaseUnits: 2,
    bedtimeBaseUnits: 17, bedtimeBaseUnitsMigratedTo17: true, insulinCarbRatioGrams: 10,
    doseRoundingMode: 'down', doseIncrementUnits: 0.5, minimumAllowableDoseUnits: 0.5,
    temporaryEatingAdjustment: { enabled: false, units: 0.5, startsAt: '', endsAt: '', contexts: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Snacks'] },
    targetGlucoseMin: 70, targetGlucoseMax: 180, supportedMealTypes: ['Breakfast', 'Lunch', 'Dinner', 'Snack'],
    correctionRanges: [{ minGlucose: null, maxGlucose: 179, correctionUnits: 0 }, { minGlucose: 180, maxGlucose: null, correctionUnits: 1 }],
    createdAt: '2026-07-31T00:00:00.000Z', updatedAt: '2026-07-31T00:00:00.000Z',
    ...overrides,
  };
}

async function seedHistoricalEdit(page, snapshot = historicalEditPlan()) {
  return page.evaluate(({ plan, snapshot }) => {
    const timestamp = new Date(2026, 7, 25, 12).toISOString();
    const currentPlan = { ...plan, id: 'issue85-plan-b', name: 'Current Plan B', insulinCarbRatioGrams: 2, mealBaseUnitsByType: { Breakfast: 20, Lunch: 30, Dinner: 40, Snack: 0 } };
    const record = {
      id: 'issue85-entry', eventType: 'check-insulin', type: 'Breakfast', bloodSugar: 120,
      mealCarbs: 30, totalCarbs: 30, mealComponents: [],
      insulinPlanId: snapshot?.id || null, insulinPlanSnapshot: snapshot,
      suggestedBaseUnits: null, suggestedCarbDoseUnits: 3, suggestedCorrectionUnits: 0, suggestedTotalUnits: 3,
      administeredInsulinUnits: 5, insulinUnits: 5, doseCalculationStatus: 'calculated',
      date: '2026-08-25', time: '12:00', recordTimestamp: timestamp,
      createdAt: timestamp, updatedAt: timestamp, version: 3, enteredBy: 'Rolando', notes: '',
    };
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current, records: [record], insulinPlans: [currentPlan], activeInsulinPlanId: currentPlan.id,
      foodLibrary: [{ id: 'issue85-food', name: 'Issue 8.5 Food', carbs: 20, servingLabel: '1 serving', favorite: true, createdAt: timestamp, updatedAt: timestamp }],
    }));
    return window.LeeLeeTrackerStorage.loadTrackerData().records[0];
  }, { plan: historicalEditPlan(), snapshot });
}

test('LLT component-backed historical factual edits preserve calculations through calculator cancel and confirmation return', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await seedHistoricalEdit(page, null);
  await page.evaluate(() => window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
    ...current,
    records: current.records.map((record) => ({ ...record, mealComponents: [{
      id: 'original-component', componentType: 'food', foodId: 'issue85-food', nameSnapshot: 'Issue 8.5 Food', quantity: 1.5, carbsPerServing: 20, carbTotal: 30,
    }] })),
  })));
  const original = await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().records[0]);
  await openSeededLeeLeeHistoryDay(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Notes').fill('Component entry note');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();
  await page.locator('[data-carb-calculator]').getByRole('button', { name: 'Cancel Carb Calculator', exact: true }).click();
  await form.getByLabel('Insulin Actually Given').fill('4');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Go Back', exact: true }).click();
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();
  await page.locator('[data-carb-calculator]').getByRole('button', { name: 'Use 30 g' }).click();
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm and Save' }).click();
  const saved = await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().records[0]);
  expect(saved).toMatchObject({ notes: 'Component entry note', administeredInsulinUnits: 4, mealCarbs: 30, suggestedTotalUnits: 3, insulinPlanSnapshot: null });
  expect(saved.calculationAudit.kind).toBe('administered-dose-corrected');
  expect(saved.mealComponents.map(({ id, ...component }) => component)).toEqual(original.mealComponents.map(({ id, ...component }) => component));
});

async function openLeeLeePreMealTimerTest(page, { enabled = true, durationMinutes = 3 } = {}) {
  await page.addInitScript(({ enabled: isEnabled, duration }) => {
    localStorage.setItem('lando-world:lee-lees-tracker:pre-meal-timer-settings:v1', JSON.stringify({
      enabled: isEnabled,
      durationMinutes: duration,
    }));
    localStorage.setItem('lando-world:lee-lees-tracker:v1:shared-sync-migration:v1', JSON.stringify({ promptDismissed: true }));
  }, { enabled, duration: durationMinutes });
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => localStorage.removeItem('lando-world:lee-lees-tracker:pre-meal-timer:v1'));
}

async function saveLeeLeeTimerEligibleMeal(page, { carbs = '42', date = '2020-01-02', time = '03:04' } = {}) {
  const nav = page.getByLabel("Lee-Lee’s Tracker mobile navigation");
  await nav.getByRole('button', { name: 'Log Entry' }).click();
  const form = page.locator('[data-lee-lee-editor]');
  await form.locator('[name="eventType"]').evaluate((field) => { field.value = 'meal'; });
  const mealCarbs = form.locator('[name="mealCarbs"]');
  await mealCarbs.fill(carbs);
  await form.locator('[name="date"]').fill(date);
  await form.locator('[name="time"]').fill(time);
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  const confirmSave = page.getByRole('button', { name: 'Confirm and Save' });
  if (await confirmSave.isVisible().catch(() => false)) await confirmSave.click();
  const offer = page.locator('.lee_lee_diabetes_pre_meal_timer_modal');
  const entry = await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().records.at(-1));
  return { offer, entry };
}

async function openSeededLeeLeeHistoryDay(page, dateKey = '2026-08-25') {
  await chooseLeeLeeSection(page, 'History');
  await page.locator(`[data-action="history-date"][data-date="${dateKey}"]`).click();
}

test('Lee-Lee settings gear toggles the settings page', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  const app = page.locator('#lee-lees-tracker-view');
  await expect(app.getByRole('button', { name: 'Settings', exact: true })).toHaveAttribute('aria-expanded', 'false');

  await app.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(app.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Close Settings' })).toHaveAttribute('aria-expanded', 'true');

  await app.getByRole('button', { name: 'Close Settings', exact: true }).click();
  await expect(app.getByRole('heading', { name: /Lee-Lee.s Tracker/ })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Settings', exact: true })).toHaveAttribute('aria-expanded', 'false');
});

test('Lee-Lee Settings shows one global sync status action', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  const app = page.locator('#lee-lees-tracker-view');
  await app.getByRole('button', { name: 'Settings' }).click();

  await expect(app.getByRole('heading', { name: 'Sync Status' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Sync Now' })).toHaveCount(1);
  await expect(app.getByRole('heading', { name: 'Cloud Status' })).toHaveCount(0);
  await expect(app.getByText('Pending total')).toBeVisible();
  await expect(app.getByText('Records pending')).toBeVisible();
  await expect(app.getByText('Settings pending')).toBeVisible();
  await expect(app.getByText('Foods pending')).toBeVisible();
  const migrationDetails = app.locator('details').filter({ hasText: 'Migration Diagnostics' });
  if (await migrationDetails.count()) {
    await expect(migrationDetails.first()).not.toHaveAttribute('open', '');
  }
});

test('Lee-Lee mobile bottom navigation preserves destinations and light/dark contrast', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => window.LandosTheme?.setPreference?.('light'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const nav = page.getByLabel("Lee-Lee’s Tracker mobile navigation");
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('button')).toHaveCount(5);
  await expect(nav.getByRole('button', { name: 'Log Entry' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Log Entry' })).not.toHaveAttribute('aria-current');

  const lightStyles = await nav.evaluate((node) => {
    const parseRgb = (value) => (value.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    const luminance = ([red, green, blue]) => {
      const channels = [red, green, blue].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrast = (foreground, background) => {
      const light = Math.max(luminance(foreground), luminance(background));
      const dark = Math.min(luminance(foreground), luminance(background));
      return (light + 0.05) / (dark + 0.05);
    };
    const panel = getComputedStyle(node);
    const inactiveButton = node.querySelector('[data-action="history"]');
    const activeButton = node.querySelector('[data-action="today"]');
    const inactive = getComputedStyle(inactiveButton);
    const active = getComputedStyle(activeButton);
    const inactiveIcon = getComputedStyle(inactiveButton.querySelector('.lee_lee_diabetes_bottom_nav_icon'));
    const activeIcon = getComputedStyle(activeButton.querySelector('.lee_lee_diabetes_bottom_nav_icon'));
    const inactiveBackground = inactive.backgroundColor === 'rgba(0, 0, 0, 0)'
      ? parseRgb(panel.backgroundColor)
      : parseRgb(inactive.backgroundColor);
    const inactiveColor = parseRgb(inactive.color);
    return {
      panelBackground: panel.backgroundColor,
      inactiveBackground: inactive.backgroundColor,
      inactiveColor: inactive.color,
      activeBackground: active.backgroundColor,
      activeColor: activeIcon.color,
      inactiveContrast: contrast(inactiveColor, inactiveBackground),
      inactiveIconColor: inactiveIcon.color,
    };
  });

  expect(lightStyles.panelBackground).not.toBe('rgb(5, 9, 19)');
  expect(lightStyles.inactiveContrast).toBeGreaterThanOrEqual(4.5);
  expect(lightStyles.activeBackground).toBe(lightStyles.inactiveBackground);
  expect(lightStyles.activeColor).not.toBe(lightStyles.inactiveIconColor);

  for (const [action, label] of [['history', 'History'], ['reports', 'Reports'], ['foods', 'Foods']]) {
    await nav.getByRole('button', { name: label }).dispatchEvent('click');
    await expect(nav.locator(`[data-action="${action}"]`)).toHaveAttribute('aria-current', 'page');
    const stateStyles = await nav.evaluate((node, activeAction) => {
      const parseRgb = (value) => (value.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
      const luminance = ([red, green, blue]) => {
        const channels = [red, green, blue].map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const contrast = (foreground, background) => {
        const light = Math.max(luminance(foreground), luminance(background));
        const dark = Math.min(luminance(foreground), luminance(background));
        return (light + 0.05) / (dark + 0.05);
      };
      const activeButton = node.querySelector(`[data-action="${activeAction}"]`);
      const inactiveButton = Array.from(node.querySelectorAll('.lee_lee_diabetes_bottom_nav_button'))
        .find((button) => button.dataset.action !== activeAction);
      const active = getComputedStyle(activeButton);
      const inactive = getComputedStyle(inactiveButton);
      const activeIcon = getComputedStyle(activeButton.querySelector('.lee_lee_diabetes_bottom_nav_icon'));
      const inactiveIcon = getComputedStyle(inactiveButton.querySelector('.lee_lee_diabetes_bottom_nav_icon'));
      const panel = getComputedStyle(node);
      const inactiveBackground = inactive.backgroundColor === 'rgba(0, 0, 0, 0)'
        ? parseRgb(panel.backgroundColor)
        : parseRgb(inactive.backgroundColor);
      return {
        activeBackground: active.backgroundColor,
        inactiveBackground: inactive.backgroundColor,
        inactiveContrast: contrast(parseRgb(inactive.color), inactiveBackground),
        activeIconColor: activeIcon.color,
        inactiveIconColor: inactiveIcon.color,
      };
    }, action);
    expect(stateStyles.inactiveContrast).toBeGreaterThanOrEqual(4.5);
    expect(stateStyles.activeBackground).toBe(stateStyles.inactiveBackground);
    expect(stateStyles.activeIconColor).not.toBe(stateStyles.inactiveIconColor);
  }

  await page.evaluate(() => window.LandosTheme?.setPreference?.('dark'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const darkPanelBackground = await nav.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(darkPanelBackground).toBe('rgba(5, 9, 19, 0.94)');
});

test('Lee-Lee mobile bottom plus opens the existing Log Entry flow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openProtectedLeeLeeTracker(page);
  const nav = page.getByLabel("Lee-Lee’s Tracker mobile navigation");
  const metrics = await nav.evaluate((node) => {
    const navRect = node.getBoundingClientRect();
    const plusRect = node.querySelector('[data-action="log-entry"]').getBoundingClientRect();
    return {
      buttonCount: node.querySelectorAll('button').length,
      navBottom: Math.round(navRect.bottom),
      viewportBottom: window.innerHeight,
      plusBottom: Math.round(plusRect.bottom),
      plusHeight: Math.round(plusRect.height),
      navBackground: getComputedStyle(node).backgroundColor,
    };
  });
  expect(metrics.buttonCount).toBe(5);
  expect(metrics.navBottom).toBe(metrics.viewportBottom);
  expect(metrics.plusBottom).toBeLessThanOrEqual(metrics.viewportBottom - 20);
  expect(metrics.plusHeight).toBeGreaterThanOrEqual(52);
  expect(metrics.navBackground).not.toBe('rgba(0, 0, 0, 0)');
  await nav.getByRole('button', { name: 'Log Entry' }).click();
  await expect(page.getByRole('heading', { name: 'Log Entry' })).toBeVisible();
  await expect(page.locator('[data-lee-lee-editor]')).toBeVisible();
});

test('LLT fresh Log Entry has independent scroll state and restores Today across viewport sizes', async ({ page }) => {
  await page.addInitScript(() => {
    let frame = { width: window.innerWidth, height: window.innerHeight, offsetLeft: 0, offsetTop: 0 };
    const listeners = new Map();
    const dispatch = (type) => {
      const event = new Event(type);
      listeners.get(type)?.forEach((listener) => listener.call(visualViewportMock, event));
    };
    const visualViewportMock = {
      get width() { return frame.width; },
      get height() { return frame.height; },
      get offsetLeft() { return frame.offsetLeft; },
      get offsetTop() { return frame.offsetTop; },
      get scale() { return 1; },
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(listener);
      },
      removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
      setFrame(nextFrame) {
        Object.assign(frame, nextFrame);
        dispatch('resize');
        dispatch('scroll');
      },
    };
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewportMock });
    window.__setBug6VisualViewportFrame = (nextFrame) => visualViewportMock.setFrame(nextFrame);
    window.__dispatchBug6VisualViewportEvent = (type) => dispatch(type);
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await openProtectedLeeLeeTracker(page);
  await page.addStyleTag({ content: '#lee-lee-diabetes-root::after { content: ""; display: block; height: 2200px; }' });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(({ width, height }) => {
      window.__setBug6VisualViewportFrame({ width, height, offsetLeft: 0, offsetTop: 0 });
      window.scrollTo(0, 0);
    }, viewport);

    const nav = page.getByLabel("Lee-Lee’s Tracker mobile navigation");
    await nav.getByRole('button', { name: 'Log Entry' }).click();
    const form = page.locator('[data-lee-lee-editor]');
    await expect(form).toHaveAttribute('data-preserve-document-scroll-on-viewport-pan', '');
    const bloodSugar = form.getByLabel('Blood Sugar');
    await expect(page.getByRole('heading', { name: 'Log Entry' })).toBeVisible();
    await expect(bloodSugar).toBeFocused();
    const openedAtTop = await page.evaluate(() => {
      const heading = document.querySelector('#lee-lee-diabetes-title').getBoundingClientRect();
      const input = document.querySelector('[name="bloodSugar"]').getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        headingTop: heading.top,
        inputTop: input.top,
        inputBottom: input.bottom,
        viewportHeight: window.innerHeight,
      };
    });
    expect(openedAtTop.scrollY).toBe(0);
    expect(openedAtTop.headingTop).toBeGreaterThanOrEqual(0);
    expect(openedAtTop.inputTop).toBeGreaterThanOrEqual(0);
    expect(openedAtTop.inputBottom).toBeLessThanOrEqual(openedAtTop.viewportHeight);

    await form.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    const todayScrollY = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      return window.scrollY;
    });
    expect(todayScrollY).toBeGreaterThan(viewport.height / 2);
    await nav.getByRole('button', { name: 'Log Entry' }).click();
    await expect(page.getByRole('heading', { name: 'Log Entry' })).toBeVisible();
    await expect(bloodSugar).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    if (viewport.width === 390) {
      await page.evaluate(() => window.__setBug6VisualViewportFrame({
        width: window.innerWidth,
        height: 320,
        offsetLeft: 0,
        offsetTop: 60,
      }));
      await expect.poll(() => page.evaluate(() => {
        const input = document.querySelector('[name="bloodSugar"]').getBoundingClientRect();
        const visibleTop = window.visualViewport.offsetTop;
        const visibleBottom = visibleTop + window.visualViewport.height;
        return input.top >= visibleTop && input.bottom <= visibleBottom && window.scrollY === 0;
      })).toBe(true);
      await page.evaluate(() => {
        document.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 320 }));
        window.scrollTo(0, 320);
      });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
      await expect(bloodSugar).toBeFocused();
      const bloodSugarUserScrollY = await page.evaluate(() => window.scrollY);
      await page.evaluate(() => {
        window.dispatchEvent(new Event('resize'));
        window.__setBug6VisualViewportFrame({
          width: window.innerWidth,
          height: 320,
          offsetLeft: 0,
          offsetTop: 60,
        });
      });
      await page.waitForTimeout(2300);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(bloodSugarUserScrollY);
      await expect(bloodSugar).toBeFocused();
      expect(await page.evaluate(() => window.visualViewport.height)).toBe(320);

      const insulinInput = form.locator('[name="insulinUnits"]');
      await insulinInput.click();
      await expect(insulinInput).toBeFocused();
      await expect.poll(() => page.evaluate(() => {
        const input = document.querySelector('[name="insulinUnits"]').getBoundingClientRect();
        return input.top >= window.visualViewport.offsetTop
          && input.bottom <= window.visualViewport.offsetTop + window.visualViewport.height;
      })).toBe(true);
      await page.evaluate(() => {
        document.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 260 }));
        window.scrollTo(0, window.scrollY + 260);
      });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(bloodSugarUserScrollY);
      const insulinUserScrollY = await page.evaluate(() => window.scrollY);
      await page.evaluate(() => {
        window.dispatchEvent(new Event('resize'));
        window.__setBug6VisualViewportFrame({
          width: window.innerWidth,
          height: 320,
          offsetLeft: 0,
          offsetTop: 60,
        });
      });
      await page.waitForTimeout(2300);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(insulinUserScrollY);
      await expect(insulinInput).toBeFocused();

      const notesInput = form.locator('[name="notes"]');
      await notesInput.click();
      await expect(notesInput).toBeFocused();
      await page.evaluate(() => {
        document.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 220 }));
        window.scrollTo(0, window.scrollY + 220);
      });
      const notesUserScrollY = await page.evaluate(() => window.scrollY);
      await page.evaluate(() => {
        window.dispatchEvent(new Event('resize'));
        window.__setBug6VisualViewportFrame({
          width: window.innerWidth,
          height: 320,
          offsetLeft: 0,
          offsetTop: 60,
        });
      });
      await page.waitForTimeout(2300);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(notesUserScrollY);
      await expect(notesInput).toBeFocused();

      await insulinInput.click();
      await expect(insulinInput).toBeFocused();
      expect(await page.evaluate(() => window.visualViewport.height)).toBe(320);

      // Let the newly focused field's permitted visibility correction finish
      // before measuring whether keyboard dismissal changes document scrolling.
      await expect.poll(() => page.evaluate(() => {
        const input = document.querySelector('[name="insulinUnits"]').getBoundingClientRect();
        return input.top >= window.visualViewport.offsetTop
          && input.bottom <= window.visualViewport.offsetTop + window.visualViewport.height;
      })).toBe(true);
      const scrollBeforeKeyboardDismiss = await page.evaluate(() => window.scrollY);
      await page.evaluate((height) => window.__setBug6VisualViewportFrame({
        width: window.innerWidth,
        height,
        offsetLeft: 0,
        offsetTop: 0,
      }), viewport.height);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBeforeKeyboardDismiss);
    }

    for (const userScrollY of [300, 700, 400]) {
      await page.evaluate(async (nextScrollY) => {
        window.scrollTo(0, nextScrollY);
        window.__dispatchBug6VisualViewportEvent('scroll');
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await new Promise((resolve) => setTimeout(resolve, 20));
      }, userScrollY);
      await expect.poll(() => page.evaluate((targetY) => Math.abs(window.scrollY - targetY) <= 16, userScrollY), {
        message: `New Entry should stay near user scroll target ${userScrollY}, allowing only a small focused-input visibility correction`,
      }).toBe(true);
      const settledScrollY = await page.evaluate(() => window.scrollY);
      await page.evaluate(async () => {
        window.__dispatchBug6VisualViewportEvent('scroll');
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(settledScrollY);
    }

    await form.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(todayScrollY);
  }

  await page.evaluate(() => {
    const now = Date.now();
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      records: [...current.records, {
        id: 'bug6-existing-edit-check',
        type: 'Breakfast',
        eventType: 'check-insulin',
        bloodSugar: 142,
        recordTimestamp: now,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      }],
    }));
  });
  await page.getByLabel("Lee-Lee’s Tracker mobile navigation").getByRole('button', { name: 'Today' }).click();
  await expect(page.locator('[data-action="edit-today-record"]')).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0, 320));
  await page.locator('[data-action="edit-today-record"]').evaluate((button) => button.click());
  await expect(page.getByRole('heading', { name: 'Edit Entry' })).toBeVisible();
  await expect(page.locator('[name="bloodSugar"]')).toHaveValue('142');
  await expect(page.locator('[name="bloodSugar"]')).toBeFocused();
});

test('Lee-Lee Reports summarizes stored records and renders trend charts', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  const recentDateKey = relativeLocalDateKey(-1);
  const olderDateKey = relativeLocalDateKey(-8);
  await page.evaluate(({ recentDateKey: recentKey, olderDateKey: olderKey }) => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        glucoseTargetMin: 70,
        glucoseTargetMax: 180,
      },
      records: [
        {
          id: 'reports-breakfast',
          type: 'Breakfast',
          eventType: 'check-insulin',
          bloodSugar: 160,
          mealCarbs: 42,
          administeredInsulinUnits: 6,
          suggestedTotalUnits: 5.5,
          recordTimestamp: `${recentKey}T12:30:00.000Z`,
          createdAt: `${recentKey}T12:35:00.000Z`,
          updatedAt: `${recentKey}T12:35:00.000Z`,
          notes: '',
        },
        {
          id: 'reports-bedtime',
          type: 'Bedtime',
          eventType: 'check-insulin',
          bloodSugar: 130,
          mealCarbs: null,
          administeredInsulinUnits: 17,
          suggestedTotalUnits: 13,
          recordTimestamp: `${recentKey}T18:30:00.000Z`,
          createdAt: `${recentKey}T18:35:00.000Z`,
          updatedAt: `${recentKey}T18:35:00.000Z`,
          notes: '',
        },
        {
          id: 'reports-older-correction',
          type: 'Correction',
          eventType: 'check-insulin',
          bloodSugar: 210,
          mealCarbs: null,
          administeredInsulinUnits: 4,
          suggestedTotalUnits: 4,
          recordTimestamp: `${olderKey}T18:30:00.000Z`,
          createdAt: `${olderKey}T18:35:00.000Z`,
          updatedAt: `${olderKey}T18:35:00.000Z`,
          notes: '',
        },
      ],
    }));
  }, { recentDateKey, olderDateKey });

  await chooseLeeLeeSection(page, 'Reports');
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  const reportsFilters = page.locator('[data-reports-filters]');
  const reportView = page.getByLabel('Report View');
  await expect(reportsFilters.getByLabel('Date Range')).toHaveValue('last7');
  await expect(reportView).toHaveValue('summary');
  await expect(page.getByText('2 records from')).toBeVisible();
  await expect(page.getByLabel('Report options').getByText('7 completed days')).toBeVisible();
  const summarySection = page.getByLabel('Summary');
  await expect(page.getByRole('option', { name: 'Summary' })).toBeAttached();
  await expect(summarySection.getByText('Total insulin given')).toBeVisible();
  await expect(summarySection.getByText('23 units')).toBeVisible();
  await expect(summarySection.getByText('Long-lasting avg per day')).toBeVisible();
  await expect(summarySection.getByText(/1 administration .* expected bedtime doses recorded/)).toBeVisible();
  await expect(summarySection.getByText('Total carbs')).toBeVisible();
  expect(await summarySection.getByText('42 g carbs').count()).toBeGreaterThan(0);
  await reportView.selectOption('trends');
  await expect(page.getByRole('img', { name: /Glucose Trend chart/ })).toBeVisible();
  await expect(page.getByText('Carbohydrate Trend')).toBeVisible();
  await expect(page.locator('.lee_lee_diabetes_chart_point')).toHaveCount(5);
  await expect(page.locator('.lee_lee_diabetes_chart_target')).toHaveCount(1);
  await expect(page.locator('.lee_lee_diabetes_chart_grid')).not.toHaveCount(0);
  await expect(page.locator('.lee_lee_diabetes_chart_tick--number').first()).toBeVisible();
  await expect(page.locator('.lee_lee_diabetes_chart_tick--date').first()).toBeVisible();
  await expect(page.locator('.lee_lee_diabetes_chart_unit').filter({ hasText: 'mg/dL' })).toBeVisible();
  await page.locator('.lee_lee_diabetes_chart_point_group').first().click();
  await expect(page.locator('.lee_lee_diabetes_chart_tooltip')).toBeVisible();
  await expect(page.locator('.lee_lee_diabetes_chart_tooltip')).toContainText('mg/dL');
  const chartMetrics = await page.locator('.lee_lee_diabetes_chart').first().evaluate((chart) => {
    const chartBox = chart.getBoundingClientRect();
    const tooltip = chart.querySelector('.lee_lee_diabetes_chart_tooltip');
    const tooltipBox = tooltip.getBoundingClientRect();
    const numberTick = chart.querySelector('.lee_lee_diabetes_chart_tick--number');
    return {
      tooltipInside:
        tooltipBox.left >= chartBox.left - 1
        && tooltipBox.right <= chartBox.right + 1
        && tooltipBox.top >= chartBox.top - 1
        && tooltipBox.bottom <= chartBox.bottom + 1,
      tickFontFamily: getComputedStyle(numberTick).fontFamily,
    };
  });
  expect(chartMetrics.tooltipInside).toBe(true);
  expect(chartMetrics.tickFontFamily).toContain('Roboto Mono');
  const dateSelect = reportsFilters.getByLabel('Date Range');
  const selectStyles = async () => Promise.all([dateSelect, reportView].map((select) => select.evaluate((node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return { height: rect.height, width: rect.width, background: style.backgroundColor, border: style.border, radius: style.borderRadius, padding: style.padding, font: style.font, color: style.color, backgroundImage: style.backgroundImage };
  })));
  const [dateSelectMetrics, reportViewMetrics] = await selectStyles();
  expect(reportViewMetrics).toEqual(dateSelectMetrics);
  const originalTheme = await page.locator('html').getAttribute('data-theme');
  for (const theme of ['light', 'dark']) {
    await page.locator('html').evaluate((node, nextTheme) => node.setAttribute('data-theme', nextTheme), theme);
    const [themedDateMetrics, themedViewMetrics] = await selectStyles();
    expect(themedViewMetrics).toEqual(themedDateMetrics);
  }
  if (originalTheme) await page.locator('html').evaluate((node, theme) => node.setAttribute('data-theme', theme), originalTheme);
  const summaryTextContrast = async () => page.locator('.lee_lee_diabetes_report_summary_grid div').first().evaluate((cell) => {
    const luminance = (color) => {
      const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const background = luminance(getComputedStyle(cell).backgroundColor);
    return ['dt', 'dd'].map((selector) => {
      const foreground = luminance(getComputedStyle(cell.querySelector(selector)).color);
      return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
    });
  });
  expect((await summaryTextContrast()).every((ratio) => ratio >= 4.5)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  expect((await summaryTextContrast()).every((ratio) => ratio >= 4.5)).toBe(true);
  await page.emulateMedia({ media: 'screen' });
  let previewText = await page.locator('.lee_lee_diabetes_report_preview').evaluate((node) => node.textContent || '');
  expect(previewText).toContain('23 units');
  expect(previewText).not.toContain('27 units');

  await reportsFilters.getByLabel('Date Range').selectOption('last14');
  await expect(page.getByText('3 records from')).toBeVisible();
  await expect(reportView).toHaveValue('trends');
  previewText = await page.locator('.lee_lee_diabetes_report_preview').evaluate((node) => node.textContent || '');
  expect(previewText).toContain('27 units');

  await reportsFilters.getByLabel('Date Range').selectOption('custom');
  await reportsFilters.getByLabel('Start Date').fill(recentDateKey);
  await reportsFilters.getByLabel('End Date').fill(recentDateKey);
  await expect(page.getByText('2 records from')).toBeVisible();
  await expect(reportView).toHaveValue('trends');
  await reportView.selectOption('averages');
  await expect(page.getByRole('heading', { name: 'Typical Day Averages' })).toBeVisible();
  await reportView.selectOption('detailed-log');
  await expect(page.getByRole('heading', { name: 'Detailed Log' })).toBeVisible();
  await reportView.selectOption('summary');
  await page.getByLabel('Print Layout').selectOption('clinical');
  await expect(page.getByRole('button', { name: 'Print or Save as PDF' })).toBeEnabled();
  await expect(page.locator('.lee_lee_diabetes_report_preview')).toContainText('Glucose & Insulin Log');
  await page.evaluate(() => { window.__lltPrintCalls = 0; window.print = () => { window.__lltPrintCalls += 1; }; });
  await page.getByRole('button', { name: 'Print or Save as PDF' }).click();
  await expect.poll(() => page.evaluate(() => window.__lltPrintCalls)).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await reportView.evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await reportView.evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThan(0);
});

test('LLT historical edits preserve Plan A across sequential context and Carb Calculator rerenders', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  const original = await seedHistoricalEdit(page);
  await openSeededLeeLeeHistoryDay(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Lunch');
  await expect(form.locator('.lee_lee_diabetes_dose_total')).toHaveText('3 units total');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();
  const calculator = page.locator('[data-carb-calculator]');
  await calculator.getByLabel('Food Library').selectOption('favorites');
  await calculator.getByRole('button', { name: /Issue 8.5 Food 20 g carbs/ }).click();
  await calculator.getByRole('button', { name: 'Use 20 g' }).click();
  await expect(form.locator('.lee_lee_diabetes_dose_total')).toHaveText('2 units total');
  await form.getByLabel('Blood Sugar').fill('190');
  await expect(form.locator('.lee_lee_diabetes_dose_total')).toHaveText('3 units total');
  await form.getByLabel('Context').selectOption('Dinner');
  await expect(form.locator('.lee_lee_diabetes_dose_total')).toHaveText('3 units total');
  // Applying the same component total again must not redefine the original baseline.
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();
  await calculator.getByRole('button', { name: 'Use 20 g' }).click();
  await form.getByRole('spinbutton', { name: 'Total Carbs' }).fill('60');
  await form.getByLabel('Date', { exact: true }).fill('2026-08-26');
  await form.getByLabel('Time', { exact: true }).fill('13:15');
  await expect(form.locator('.lee_lee_diabetes_dose_total')).toHaveText('7 units total');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm and Save' }).click();
  const saved = await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().records[0]);
  expect(saved).toMatchObject({ id: original.id, type: 'Dinner', bloodSugar: 190, mealCarbs: 60, date: '2026-08-26', time: '13:15', suggestedTotalUnits: 7, suggestedBaseUnits: null, suggestedCorrectionUnits: 1, insulinCarbRatioGrams: 10, doseCalculationStatus: 'calculated', administeredInsulinUnits: 5 });
  expect(saved.insulinPlanSnapshot).toEqual(original.insulinPlanSnapshot);
  expect(saved.calculationAudit.before).toMatchObject({ type: 'Breakfast', mealCarbs: 30, suggestedTotalUnits: 3 });
  expect(saved.calculationAudit.after).toMatchObject({ type: 'Dinner', mealCarbs: 60, suggestedTotalUnits: 7 });
  expect(saved.calculationAudit.source).toBe('historical-record-plan');
  expect(await page.evaluate(() => window.LeeLeeTrackerStorage.getActiveInsulinPlan().id)).toBe('issue85-plan-b');
});

test('LLT historical individual dose-field saves retain the historical snapshot and consistent guidance', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  const cases = [
    { label: 'Blood Sugar', value: '190', total: 4 },
    { label: 'Total Carbs', value: '60', total: 6 },
    { label: 'Context', value: 'Lunch', total: 3 },
    { label: 'Date', value: '2026-08-26', total: 3 },
    { label: 'Time', value: '13:15', total: 3 },
    { label: 'Carb Calculator', total: 2 },
  ];
  for (const change of cases) {
    const original = await seedHistoricalEdit(page);
    await openSeededLeeLeeHistoryDay(page);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const form = page.locator('[data-lee-lee-editor]');
    if (change.label === 'Context') await form.getByLabel('Context').selectOption(change.value);
    else if (change.label === 'Carb Calculator') {
      await form.getByRole('button', { name: 'Open Carb Calculator' }).click();
      const calculator = page.locator('[data-carb-calculator]');
      await calculator.getByLabel('Food Library').selectOption('favorites');
      await calculator.getByRole('button', { name: /Issue 8.5 Food 20 g carbs/ }).click();
      await calculator.getByRole('button', { name: 'Use 20 g' }).click();
    } else if (change.label === 'Total Carbs') await form.getByRole('spinbutton', { name: 'Total Carbs' }).fill(change.value);
    else await form.getByLabel(change.label, { exact: true }).fill(change.value);
    await expect(form.locator('.lee_lee_diabetes_dose_total')).toHaveText(`${change.total} units total`);
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm and Save' }).click();
    const saved = await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().records[0]);
    expect(saved.suggestedTotalUnits, change.label).toBe(change.total);
    expect(saved.doseCalculationStatus).toBe('calculated');
    expect(saved.insulinPlanSnapshot).toEqual(original.insulinPlanSnapshot);
    expect(saved.calculationAudit.before.suggestedTotalUnits).toBe(3);
    expect(saved.calculationAudit.after.suggestedTotalUnits).toBe(change.total);
    if (change.label === 'Carb Calculator') expect(saved.mealComponents[0]).toMatchObject({ foodId: 'issue85-food', carbTotal: 20 });
  }
});

test('LLT genuinely missing historical snapshots allow factual edits and block all dose-field paths', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await seedHistoricalEdit(page, null);
  await openSeededLeeLeeHistoryDay(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  let form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Notes').fill('Corrected note');
  await form.getByLabel('Insulin Actually Given').fill('4');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm and Save' }).click();
  const factual = await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().records[0]);
  expect(factual).toMatchObject({ notes: 'Corrected note', administeredInsulinUnits: 4, suggestedTotalUnits: 3, insulinPlanSnapshot: null });
  expect(factual.calculationAudit.kind).toBe('administered-dose-corrected');
  for (const change of ['Blood Sugar', 'Total Carbs', 'Context', 'Date', 'Time', 'Carb Calculator']) {
    await openSeededLeeLeeHistoryDay(page);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    form = page.locator('[data-lee-lee-editor]');
    if (change === 'Context') await form.getByLabel('Context').selectOption('Lunch');
    else if (change === 'Carb Calculator') {
      await form.getByRole('button', { name: 'Open Carb Calculator' }).click();
      const calculator = page.locator('[data-carb-calculator]');
      await calculator.getByLabel('Food Library').selectOption('favorites');
      await calculator.getByRole('button', { name: /Issue 8.5 Food 20 g carbs/ }).click();
      await calculator.getByRole('button', { name: 'Use 20 g' }).click();
    } else if (change === 'Total Carbs') await form.getByRole('spinbutton', { name: 'Total Carbs' }).fill('60');
    else await form.getByLabel(change, { exact: true }).fill({ 'Blood Sugar': '190', Date: '2026-08-26', Time: '13:15' }[change]);
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(form.locator('[data-editor-error]')).toContainText('This historical entry cannot safely recalculate');
    expect(await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().records[0]), change).toEqual(factual);
    await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
});

test('LLT Edit Entry preserves deliberate keyboard-open document scrolling until focus changes', async ({ page }) => {
  await page.addInitScript(() => {
    let frame = { height: window.innerHeight, offsetTop: 0 };
    const listeners = new Map();
    const viewport = {
      get width() { return window.innerWidth; }, get height() { return frame.height; },
      get offsetTop() { return frame.offsetTop; }, offsetLeft: 0, scale: 1,
      addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
      removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    };
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    window.__settleEditKeyboardViewport = (next) => {
      Object.assign(frame, next);
      for (const type of ['resize', 'scroll']) listeners.get(type)?.forEach((callback) => callback(new Event(type)));
      window.dispatchEvent(new Event('resize'));
    };
  });
  await openProtectedLeeLeeTracker(page);
  await seedHistoricalEdit(page);
  await openSeededLeeLeeHistoryDay(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.addStyleTag({ content: '#lee-lee-diabetes-root::after { content: ""; display: block; height: 1600px; }' });
  const form = page.locator('[data-lee-lee-editor]');
  await expect(form).toHaveAttribute('data-preserve-document-scroll-on-viewport-pan', '');
  const bloodSugar = form.getByLabel('Blood Sugar');
  await bloodSugar.focus();
  await page.evaluate(() => window.__settleEditKeyboardViewport({ height: 320, offsetTop: 60 }));
  const focusedFieldVisible = (name) => page.evaluate((field) => {
    const rect = document.querySelector(`[name="${field}"]`).getBoundingClientRect();
    return rect.top >= visualViewport.offsetTop && rect.bottom <= visualViewport.offsetTop + visualViewport.height;
  }, name);
  await expect.poll(() => focusedFieldVisible('bloodSugar')).toBe(true);
  const userScrollY = await form.evaluate((node) => {
    const target = node.querySelector('[name="bloodSugar"]');
    const touch = (type, y) => { const event = new Event(type, { bubbles: true }); Object.defineProperty(event, 'touches', { value: [{ clientX: 120, clientY: y }] }); node.dispatchEvent(event); };
    touch('touchstart', 460); touch('touchmove', 350); touch('touchend', 350);
    window.scrollTo(0, window.scrollY + target.getBoundingClientRect().bottom + 160);
    return window.scrollY;
  });
  for (const offsetTop of [75, 60]) {
    await page.evaluate((offset) => window.__settleEditKeyboardViewport({ height: 320, offsetTop: offset }), offsetTop);
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.scrollY)).toBe(userScrollY);
    await expect(bloodSugar).toBeFocused();
  }
  const insulin = form.getByLabel('Insulin Actually Given');
  await insulin.focus();
  await expect.poll(() => focusedFieldVisible('insulinUnits')).toBe(true);
  await expect(insulin).toBeFocused();
  expect(await page.evaluate(() => window.visualViewport.height)).toBe(320);
  const insulinUserScrollY = await form.evaluate((node) => {
    node.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 200 }));
    window.scrollTo(0, window.scrollY + 200);
    return window.scrollY;
  });
  await page.evaluate(() => window.__settleEditKeyboardViewport({ height: 320, offsetTop: 60 }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(insulinUserScrollY);
  await expect(insulin).toBeFocused();
  await page.evaluate(() => window.__settleEditKeyboardViewport({ height: window.innerHeight, offsetTop: 0 }));
  await expect(insulin).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(insulinUserScrollY);
});

test('Lee-Lee editing context updates the same record after confirmation', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await seedLeeLeeRecords(page, [{
    id: 'edit-same-record',
    type: 'Breakfast',
    eventType: 'check-insulin',
    bloodSugar: 160,
    mealCarbs: 42,
    totalCarbs: 42,
    administeredInsulinUnits: 6,
    insulinUnits: 6,
    suggestedTotalUnits: 6,
    insulinPlanId: historicalEditPlan().id,
    insulinPlanSnapshot: historicalEditPlan(),
    recordTimestamp: '2026-08-25T12:30:00.000Z',
    createdAt: '2026-08-25T12:35:00.000Z',
    updatedAt: '2026-08-25T12:35:00.000Z',
    version: 3,
    enteredBy: 'Rolando',
    lastEditedBy: null,
    notes: '',
  }]);

  await openSeededLeeLeeHistoryDay(page);
  await expect(page.locator('.lee_lee_diabetes_timeline_type').filter({ hasText: 'Breakfast' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  const foodLibraryCountBefore = await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().foodLibrary.length);
  await expect(form.getByRole('heading', { name: 'Edit Entry' })).toBeVisible();
  await form.getByLabel('Context').selectOption('Lunch');
  await form.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Confirm and Save' }).click();

  const result = await page.evaluate(() => ({
    records: window.LeeLeeTrackerStorage.loadTrackerData().records,
    queue: JSON.parse(localStorage.getItem('lando-world:lee-lees-tracker:sync-queue:v1') || '[]'),
  }));
  expect(result.records).toHaveLength(1);
  expect(result.records[0]).toMatchObject({
    id: 'edit-same-record',
    type: 'Lunch',
    createdAt: '2026-08-25T12:35:00.000Z',
    enteredBy: 'Rolando',
    lastEditedBy: 'Rolando',
  });
  expect(result.records[0].updatedAt).not.toBe('2026-08-25T12:35:00.000Z');
  expect(result.queue.at(-1)).toMatchObject({
    type: 'update',
    recordId: 'edit-same-record',
    baseVersion: 3,
  });
  await expect(page.locator('.lee_lee_diabetes_timeline_type').filter({ hasText: 'Lunch' })).toBeVisible();
  await expect(page.locator('.lee_lee_diabetes_timeline_type').filter({ hasText: 'Breakfast' })).toHaveCount(0);
});

test('Lee-Lee repeated edits preserve record identity and count', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await seedLeeLeeRecords(page, [{
    id: 'edit-repeat-record',
    type: 'Dinner',
    eventType: 'check-insulin',
    bloodSugar: 180,
    mealCarbs: 50,
    totalCarbs: 50,
    administeredInsulinUnits: null,
    insulinUnits: null,
    suggestedTotalUnits: 5,
    insulinPlanId: historicalEditPlan().id,
    insulinPlanSnapshot: historicalEditPlan(),
    recordTimestamp: '2026-08-25T23:30:00.000Z',
    createdAt: '2026-08-25T23:35:00.000Z',
    updatedAt: '2026-08-25T23:35:00.000Z',
    version: 2,
    enteredBy: 'Rolando',
    notes: '',
  }]);

  await openSeededLeeLeeHistoryDay(page);
  await page.getByRole('button', { name: 'Edit' }).click();
  let form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Blood Sugar').fill('190');
  await form.getByRole('button', { name: 'Save' }).click();

  await openSeededLeeLeeHistoryDay(page);
  await page.getByRole('button', { name: 'Edit' }).click();
  form = page.locator('[data-lee-lee-editor]');
  await form.getByRole('spinbutton', { name: 'Total Carbs' }).fill('64');
  await form.getByRole('button', { name: 'Save' }).click();

  const records = await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().records);
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    id: 'edit-repeat-record',
    type: 'Dinner',
    bloodSugar: 190,
    mealCarbs: 64,
    totalCarbs: 64,
    createdAt: '2026-08-25T23:35:00.000Z',
  });
});

test('Lee-Lee Bedtime context removes Meal Carbs and saves without stale carb data', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: 'Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await expect(form.getByLabel('Context')).toHaveValue('Breakfast');
  await expect(form.getByRole('heading', { name: 'Meal Carbs' })).toBeVisible();
  await expect(form.getByLabel('Blood Sugar')).toBeVisible();

  await form.getByLabel('Blood Sugar').fill('198');
  await form.getByRole('spinbutton', { name: 'Total Carbs' }).fill('46.5');
  await expect(form.getByRole('button', { name: 'Open Carb Calculator' })).toBeVisible();

  await form.getByLabel('Context').selectOption('Bedtime');
  await expect(form.getByRole('heading', { name: 'Meal Carbs' })).toHaveCount(0);
  await expect(form.getByRole('button', { name: 'Open Carb Calculator' })).toHaveCount(0);
  await expect(form.getByLabel('Blood Sugar')).toBeVisible();
  await expect(form.getByText('Suggested dose')).toBeVisible();
  await expect(form.locator('.lee_lee_diabetes_dose_total')).toHaveText('17 units');
  await expect(form.getByLabel('Insulin Actually Given')).toHaveValue('17');

  const focusableCarbControls = await form.locator('[name="mealCarbs"], [name^="carbCalc"], [data-action="open-carb-calculator"]').count();
  expect(focusableCarbControls).toBe(0);

  await form.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Confirm and Save' }).click();

  const bedtimeRecord = await page.evaluate(() => {
    const records = window.LeeLeeTrackerStorage.loadTrackerData().records;
    return records.find((record) => record.type === 'Bedtime');
  });
  expect(bedtimeRecord).toMatchObject({
    eventType: 'check-insulin',
    type: 'Bedtime',
    bloodSugar: 198,
    mealCarbs: null,
    totalCarbs: null,
    foods: [],
    mealDescription: '',
    suggestedBaseUnits: 17,
    suggestedCarbDoseUnits: null,
    suggestedCorrectionUnits: null,
    suggestedTotalUnits: 17,
    administeredInsulinUnits: 17,
    insulinUnits: 17,
  });
});

test('Lee-Lee context switching restores Meal Carbs for applicable contexts', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: 'Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Bedtime');
  await expect(form.getByRole('heading', { name: 'Meal Carbs' })).toHaveCount(0);

  await form.getByLabel('Context').selectOption('Lunch');
  await expect(form.getByRole('heading', { name: 'Meal Carbs' })).toBeVisible();
  await expect(form.getByRole('spinbutton', { name: 'Total Carbs' })).toBeVisible();
  await expect(form.getByRole('button', { name: 'Open Carb Calculator' })).toBeVisible();
  await expect(form.getByRole('button', { name: '+ Add Food' })).toHaveCount(0);
  const carbLayout = await form.locator('.lee_lee_diabetes_carb_entry_controls').evaluate((controls) => {
    const label = controls.querySelector('.lee_lee_diabetes_carb_total_field').getBoundingClientRect();
    const input = controls.querySelector('[name="mealCarbs"]').getBoundingClientRect();
    const button = controls.querySelector('[data-action="open-carb-calculator"]').getBoundingClientRect();
    return {
      display: getComputedStyle(controls).display,
      inputWidth: input.width,
      controlsWidth: controls.getBoundingClientRect().width,
      labelBottom: label.bottom,
      buttonBottom: button.bottom,
      buttonLeft: button.left,
      labelRight: label.right,
    };
  });
  expect(carbLayout.display).toBe('flex');
  expect(carbLayout.inputWidth).toBeLessThan(carbLayout.controlsWidth);
  expect(Math.abs(carbLayout.labelBottom - carbLayout.buttonBottom)).toBeLessThanOrEqual(1);
  expect(carbLayout.buttonLeft).toBeGreaterThanOrEqual(carbLayout.labelRight);

  await form.getByLabel('Context').selectOption('Correction');
  await expect(form.getByRole('heading', { name: 'Meal Carbs' })).toHaveCount(0);
  await expect(form.getByLabel('Blood Sugar')).toBeVisible();
});

test('Lee-Lee Carb Calc applies temporary receipt rows without saving food details', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: 'Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByLabel('Blood Sugar').fill('299');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  await expect(calculator.getByRole('heading', { name: 'Carb Calculator' })).toBeVisible();
  await expect(calculator).toHaveAttribute('role', 'dialog');
  await expect(calculator).toHaveAttribute('aria-modal', 'true');
  await expect(form.locator('[data-editor-main]')).toHaveAttribute('inert', '');
  await expect(form.locator('[data-editor-main]')).toHaveAttribute('aria-hidden', 'true');
  await expect(calculator.locator('[name="carbCalcCarbs"]')).toHaveCount(0);
  await expect(calculator.locator('[name="carbCalcQty"]')).toHaveCount(0);
  await expect(calculator.getByRole('button', { name: '+ Add Manual Amount...' })).toBeVisible();
  await expect(calculator.getByText('No items added yet.')).toBeVisible();
  await expect(calculator.getByText('Total Carbs')).toBeVisible();
  await expect(calculator.getByRole('button', { name: 'Use 0 grams' })).toBeDisabled();

  await calculator.getByRole('button', { name: '+ Add Manual Amount...' }).click();
  await expect(calculator.getByRole('heading', { name: 'Add Manual Amount' })).toBeVisible();
  await expect(calculator.locator('[name="carbItemCarbs"]')).toBeFocused();
  await calculator.getByLabel('Quantity').fill('2');
  await calculator.getByLabel('Label').fill('Orange');
  await calculator.getByLabel('Carbs per serving').fill('15');
  await calculator.getByRole('button', { name: 'Add Item' }).click();
  await expect(calculator.getByRole('heading', { name: 'Carb Calculator' })).toBeVisible();
  await expect(calculator.getByText('No items added yet.')).toHaveCount(0);
  await expect(calculator.locator('[data-carb-calculator-row]')).toHaveCount(1);
  await expect(calculator.locator('.lee_lee_diabetes_carb_calc_operator').first()).toHaveText('@');
  await expect(calculator.getByText('Orange')).toBeVisible();
  await expect(calculator.getByLabel('Meal Total')).toHaveText('30 g');

  await calculator.getByRole('button', { name: 'Edit Orange' }).click();
  await expect(calculator.getByRole('heading', { name: 'Edit Manual Amount' })).toBeVisible();
  await calculator.getByLabel('Quantity').fill('3');
  await calculator.getByLabel('Carbs per serving').fill('21');
  await calculator.getByRole('button', { name: 'Save Item' }).click();
  await expect(calculator.locator('[data-carb-calculator-row]')).toHaveCount(1);
  await expect(calculator.getByLabel('Meal Total')).toHaveText('63 g');

  await calculator.getByRole('button', { name: 'Use 63 grams' }).click();

  await expect(page.locator('[data-carb-calculator]')).toHaveCount(0);
  await expect(form.getByRole('button', { name: 'Open Carb Calculator' })).toBeFocused();
  await expect(form.getByRole('spinbutton', { name: 'Total Carbs' })).toHaveValue('63');
  await expect(form).toContainText('Carb coverage: 63 g');
  await expect(form).toContainText('Raw dose: 7.25 units');
  await expect(form).toContainText('Rounded down 0.5-unit increment: 7 units');
  await expect(form.getByLabel('Insulin Actually Given')).toHaveValue('7');

  await form.getByRole('spinbutton', { name: 'Total Carbs' }).fill('70');
  await expect(form).toContainText('Carb coverage: 70 g');
  await expect(form).toContainText('Rounded down 0.5-unit increment: 7.5 units');
  await expect(form.getByLabel('Insulin Actually Given')).toHaveValue('7.5');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();
  await expect(page.locator('[data-carb-calculator]').getByLabel('Meal Total')).toHaveText('63 g');
  await page.locator('[data-carb-calculator]').getByRole('button', { name: 'Cancel Carb Calculator' }).click();
  await expect(form.getByRole('spinbutton', { name: 'Total Carbs' })).toHaveValue('70');
  await expect(form.getByRole('button', { name: 'Open Carb Calculator' })).toBeFocused();
  await expect(form.getByLabel('Insulin Actually Given')).toHaveValue('7.5');

  await form.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Confirm and Save' }).click();

  const dinnerRecord = await page.evaluate(() => {
    const records = window.LeeLeeTrackerStorage.loadTrackerData().records;
    return records.find((record) => record.type === 'Dinner');
  });
  expect(dinnerRecord).toMatchObject({
    type: 'Dinner',
    mealCarbs: 70,
    totalCarbs: 70,
    administeredInsulinUnits: 7.5,
    insulinUnits: 7.5,
    foods: [],
  });
});

test('Lee-Lee Food Library builds carb totals and saves historical snapshots', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      foodLibrary: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Banana',
          emoji: '🍌',
          carbs: 27,
          servingLabel: '1 medium',
          favorite: true,
          createdAt: '2026-08-31T12:00:00.000Z',
          updatedAt: '2026-08-31T12:00:00.000Z',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Pasta',
          emoji: '🍝',
          carbs: 15,
          servingLabel: '1/3 cup cooked',
          favorite: true,
          createdAt: '2026-08-31T12:00:00.000Z',
          updatedAt: '2026-08-31T12:00:00.000Z',
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Ketchup',
          carbs: 4,
          servingLabel: 'packet',
          createdAt: '2026-08-31T12:00:00.000Z',
          updatedAt: '2026-08-31T12:00:00.000Z',
        },
      ],
      savedMeals: [{
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Lunch Combo',
        components: [{
          componentType: 'food',
          foodId: '33333333-3333-4333-8333-333333333333',
          nameSnapshot: 'Ketchup',
          quantity: 1,
          carbsPerServing: 4,
          carbTotal: 4,
        }],
        totalCarbs: 4,
        createdAt: '2026-08-31T12:00:00.000Z',
        updatedAt: '2026-08-31T12:00:00.000Z',
      }],
    }));
  });
  await page.getByRole('button', { name: 'Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByLabel('Blood Sugar').fill('299');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  const foodLibrarySelect = calculator.getByLabel('Food Library');
  await expect(foodLibrarySelect).toHaveValue('');
  await expect(foodLibrarySelect.locator('option:checked')).toHaveText('Select a list...');
  await expect(calculator.getByText('No foods added yet.')).toBeVisible();
  await expect(calculator.getByText('Saved Meals')).toHaveCount(0);
  await expect(calculator.getByRole('button', { name: 'Add New Food' })).toHaveCount(0);
  await expect(calculator.getByRole('button', { name: 'Save as Meal' })).toHaveCount(0);

  await calculator.getByRole('button', { name: '+ Add Manual Amount...' }).click();
  await calculator.getByLabel('Quantity').fill('2');
  await calculator.getByLabel('Carbs per serving').fill('17');
  await calculator.getByRole('button', { name: 'Add Item' }).click();
  await expect(calculator.getByLabel('Meal Total')).toHaveText('34 g');
  await expect(calculator.getByText('Manual Amount', { exact: true })).toBeVisible();
  await expect(calculator.getByText('No foods added yet.')).toHaveCount(0);

  const picker = calculator.locator('[data-carb-picker]');
  await foodLibrarySelect.selectOption('favorites');
  await expect(picker).toHaveAttribute('aria-label', 'Favorites');
  await expect(picker.getByRole('button', { name: /Banana 27 g carbs/ })).toBeVisible();
  await expect(picker.getByRole('button', { name: /Pasta 15 g carbs/ })).toBeVisible();
  await expect(picker.getByRole('button', { name: /Mark favorite|Remove favorite/ })).toHaveCount(0);
  await picker.getByRole('button', { name: /Banana 27 g carbs/ }).click();
  await expect(calculator.locator('[data-carb-picker]')).toHaveCount(0);
  await expect(calculator.getByLabel('Meal Total')).toHaveText('61 g');
  await expect(calculator.locator('[data-carb-calculator-row]').filter({ hasText: 'Banana' })).toBeVisible();
  await foodLibrarySelect.selectOption('favorites');
  await expect(calculator.locator('[data-carb-picker]')).toHaveAttribute('aria-label', 'Favorites');
  await picker.getByRole('button', { name: /Pasta 15 g carbs/ }).click();
  await expect(calculator.locator('[data-carb-picker]')).toHaveCount(0);
  await expect(calculator.getByLabel('Meal Total')).toHaveText('76 g');
  await expect(calculator.getByText('Selected Foods')).toHaveCount(0);
  await expect(calculator.locator('[data-carb-calculator-row]').filter({ hasText: 'Banana' })).toBeVisible();
  await expect(calculator.locator('[data-carb-calculator-row]').filter({ hasText: 'Pasta' })).toBeVisible();
  await expect(calculator.getByRole('button', { name: 'Save as My Meal' })).toBeVisible();

  await foodLibrarySelect.selectOption('recent');
  await expect(calculator.locator('[data-carb-picker]')).toHaveAttribute('aria-label', 'Recent');
  await expect(foodLibrarySelect).toHaveValue('recent');
  await foodLibrarySelect.selectOption('');
  await expect(foodLibrarySelect).toHaveValue('');
  await expect(calculator.locator('[data-carb-picker]')).toHaveCount(0);
  await expect(calculator.getByLabel('Meal Total')).toHaveText('76 g');

  await foodLibrarySelect.selectOption('meals');
  await expect(calculator.locator('[data-carb-picker]')).toHaveAttribute('aria-label', 'My Meals');
  await expect(calculator.locator('[data-carb-picker]').getByRole('button', { name: /Lunch Combo/ })).toBeVisible();

  await foodLibrarySelect.selectOption('foods');
  await expect(calculator.locator('[data-carb-picker]')).toHaveAttribute('aria-label', 'My Foods');
  await expect(calculator.locator('[data-carb-picker]').getByRole('button', { name: '+ Add New Food' })).toBeVisible();
  await expect(calculator.getByRole('button', { name: 'Search', exact: true })).toHaveCount(0);
  await calculator.getByRole('button', { name: 'Search foods...' }).click();
  const foodSearch = calculator.locator('[data-carb-picker="search"]').getByLabel('Search foods');
  const setFoodSearchQuery = async (query) => {
    await foodSearch.evaluate((input, nextQuery) => {
      input.value = nextQuery;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, query);
    await expect(foodSearch).toHaveValue(query);
  };
  await expect(calculator.getByRole('heading', { name: 'Food Search' })).toBeVisible();
  await expect(foodSearch).toBeFocused();
  await foodSearch.pressSequentially('c');
  await expect(foodSearch).toHaveValue('c');
  await expect(calculator.getByText('Type 2 or more characters to search.')).toBeVisible();
  await expect(calculator.locator('[data-carb-picker="search"] [data-action="add-food-to-carb-calculator"]')).toHaveCount(0);
  await foodSearch.pressSequentially('hicken nugget');
  await expect(foodSearch).toHaveValue('chicken nugget');
  await expect(foodSearch).toBeFocused();
  await expect(calculator.getByRole('heading', { name: 'Food Search' })).toBeVisible();
  const chickenResult = calculator.locator('[data-carb-picker="search"]').getByRole('button', { name: /Chicken Nuggets \/ Tenders 15 g carbs/ }).first();
  await expect(chickenResult).toBeVisible();
  await foodSearch.press('Enter');
  await expect(calculator).toBeVisible();
  await expect(foodSearch).toBeFocused();
  await setFoodSearchQuery('bagel');
  await expect(calculator.locator('[data-carb-picker="search"]').getByRole('button', { name: /Bagel 15 g carbs/ })).toBeVisible();
  await setFoodSearchQuery('PB&J');
  await expect(calculator.locator('[data-carb-picker="search"]').getByRole('button', { name: /PB&J Sandwich 45 g carbs/ })).toBeVisible();
  await setFoodSearchQuery('nature');
  await expect(calculator.locator('[data-carb-picker="search"]').getByRole('button', { name: /Nature's Bakery Fig Bar 38 g carbs/ })).toBeVisible();
  await setFoodSearchQuery(' no-food-found ');
  await expect(calculator.getByText('No foods found for “no-food-found”')).toBeVisible();
  await calculator.locator('.lee_lee_diabetes_carb_search_empty').getByRole('button', { name: '+ Add New Food' }).click();
  await expect(calculator.getByLabel('Food Name')).toBeVisible();
  await calculator.getByLabel('Add Food').getByRole('button', { name: 'Cancel', exact: true }).click();
  await setFoodSearchQuery('ket');
  await expect(foodSearch).toHaveValue('ket');
  await expect(foodSearch).toBeFocused();
  await calculator.locator('[data-carb-picker="search"]').getByRole('button', { name: /Ketchup 4 g carbs/ }).click();
  await expect(calculator.locator('[data-carb-picker]')).toHaveCount(0);
  await expect(calculator.getByRole('button', { name: 'Search foods...' })).toBeVisible();

  await expect(calculator.getByLabel('Meal Total')).toHaveText('80 g');
  const ketchupRow = calculator.locator('[data-carb-calculator-row]').filter({ hasText: 'Ketchup' });
  await ketchupRow.getByRole('button', { name: 'Edit Ketchup' }).click();
  await calculator.getByLabel('Quantity').fill('2');
  await calculator.getByRole('button', { name: 'Save Item' }).click();
  await expect(calculator.getByLabel('Meal Total')).toHaveText('84 g');

  await calculator.getByRole('button', { name: 'Save as My Meal' }).click();
  await calculator.getByLabel('Meal Name').fill('Starter Meal');
  await calculator.getByRole('button', { name: 'Save My Meal' }).click();
  await expect(calculator.getByRole('button', { name: /Starter Meal/ })).toBeVisible();
  await calculator.getByRole('button', { name: 'Use 84 grams' }).click();

  await expect(form.getByRole('spinbutton', { name: 'Total Carbs' })).toHaveValue('84');
  await expect(form).toContainText('Carb coverage: 84 g');
  await expect(form).toContainText('Rounded to nearest 0.5-unit increment: 6 units');
  await form.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Confirm and Save' }).click();

  const savedState = await page.evaluate(() => {
    const data = window.LeeLeeTrackerStorage.loadTrackerData();
    const record = data.records.find((item) => item.type === 'Dinner');
    return {
      record,
      foodLibrary: data.foodLibrary,
      savedMeals: data.savedMeals,
    };
  });
  expect(savedState.record.mealCarbs).toBe(84);
  expect(savedState.record.mealComponents.map((item) => item.nameSnapshot)).toEqual([
    'Manual Amount',
    'Banana',
    'Pasta',
    'Ketchup',
  ]);
  expect(savedState.savedMeals.find((meal) => meal.name === 'Starter Meal').totalCarbs).toBe(84);
  expect(savedState.foodLibrary.find((food) => food.name === 'Ketchup').lastUsedAt).toBeTruthy();

  await chooseLeeLeeSection(page, 'History');
  await page.getByRole('button', { name: /1 entry/ }).click();
  await expect(page.getByText(/Manual Amount · .*Banana · .*Pasta · 2× Ketchup/)).toBeVisible();
});

test('Lee-Lee Foods screen keeps My Foods and My Meals in one-at-a-time accordions', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      foodLibrary: Array.from({ length: 120 }, (_, index) => ({
        id: `accordion-food-${index}`,
        name: `Accordion Food ${index}`,
        carbs: 3,
        createdAt: '2026-09-01T12:00:00Z',
        updatedAt: '2026-09-01T12:00:00Z',
      })),
      savedMeals: [{
        id: 'accordion-sample-meal',
        name: 'Accordion Sample Meal',
        components: [],
        totalCarbs: 12,
        createdAt: '2026-09-01T12:00:00Z',
        updatedAt: '2026-09-01T12:00:00Z',
      }],
    }));
  });
  await chooseLeeLeeSection(page, 'Foods');
  const foods = page.locator('[data-food-library-accordion="foods"]');
  const meals = page.locator('[data-food-library-accordion="meals"]');
  await expect(foods).not.toHaveAttribute('open', '');
  await expect(meals).toHaveAttribute('open', '');
  await expect(foods.locator('summary')).toBeInViewport();
  await expect(meals.locator('summary')).toBeInViewport();
  await expect(foods.getByRole('searchbox', { name: 'Search Foods' })).toBeHidden();
  await expect(meals.getByRole('searchbox', { name: 'Search Meals' })).toBeVisible();
  await expect(page.locator('[data-food-library-accordion][open]')).toHaveCount(1);
  const panelOrder = (panel) => panel.locator('.lee_lee_diabetes_settings_accordion_body').evaluate((body) => [...body.children].map((child) => {
    if (child.matches('.lee_lee_diabetes_field')) return 'search';
    if (child.matches('.lee_lee_diabetes_food_library_actions')) return 'add';
    if (child.matches('.lee_lee_diabetes_food_list')) return 'list';
    return 'other';
  }));
  expect(await panelOrder(foods)).toEqual(['search', 'add', 'list']);
  await page.evaluate(() => {
    const calls = { focus: 0, scrollIntoView: 0, scrollTo: 0 };
    const originalFocus = HTMLElement.prototype.focus;
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const originalScrollTo = window.scrollTo.bind(window);
    HTMLElement.prototype.focus = function (...args) {
      calls.focus += 1;
      return originalFocus.apply(this, args);
    };
    Element.prototype.scrollIntoView = function (...args) {
      calls.scrollIntoView += 1;
      return originalScrollIntoView?.apply(this, args);
    };
    window.scrollTo = (...args) => {
      calls.scrollTo += 1;
      return originalScrollTo(...args);
    };
    window.__foodAccordionSideEffects = calls;
  });
  const initialScrollY = await page.evaluate(() => window.scrollY);
  const beforeFoodToggle = await page.evaluate(() => ({ ...window.__foodAccordionSideEffects }));
  await foods.locator('summary').click();
  await expect(foods).toHaveAttribute('open', '');
  await expect(meals).not.toHaveAttribute('open', '');
  await expect(foods.getByRole('searchbox', { name: 'Search Foods' })).toBeVisible();
  const foodButtonGeometry = await foods.getByRole('button', { name: '+ Add New Food' }).evaluate((button) => {
    const rect = button.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  const afterFoodToggle = await page.evaluate(() => ({ ...window.__foodAccordionSideEffects, scrollY: window.scrollY }));
  expect(afterFoodToggle).toEqual({ ...beforeFoodToggle, scrollY: initialScrollY });
  const firstFood = foods.locator('[data-food-library-list] article').first();
  await firstFood.getByRole('button', { name: 'Mark favorite' }).click();
  await expect(firstFood.getByRole('button', { name: 'Remove favorite' })).toBeVisible();
  await expect(foods).toHaveAttribute('open', '');
  await expect(meals).not.toHaveAttribute('open', '');
  await foods.getByRole('searchbox', { name: 'Search Foods' }).fill('Accordion Food 1');
  await expect(foods.locator('[data-food-library-list] article').first()).toContainText('Accordion Food 1');
  await expect(foods).toHaveAttribute('open', '');

  const beforeMealToggle = await page.evaluate(() => ({ ...window.__foodAccordionSideEffects }));
  await meals.locator('summary').click();
  await expect(meals).toHaveAttribute('open', '');
  await expect(foods).not.toHaveAttribute('open', '');
  await expect(meals.getByRole('searchbox', { name: 'Search Meals' })).toBeVisible();
  const addMealButton = meals.getByRole('button', { name: '+ Add New Meal' });
  await expect(addMealButton).toBeVisible();
  await expect(foods.getByRole('searchbox', { name: 'Search Foods' })).toBeHidden();
  await expect(page.locator('[data-food-library-accordion][open]')).toHaveCount(1);
  const afterMealToggle = await page.evaluate(() => ({ ...window.__foodAccordionSideEffects }));
  expect(afterMealToggle).toEqual(beforeMealToggle);
  await expect(addMealButton).toBeInViewport();
  expect(await panelOrder(meals)).toEqual(['search', 'add', 'list']);
  const managementLayout = await page.evaluate(() => {
    const foodsPanel = document.querySelector('[data-food-library-accordion="foods"]');
    const mealsPanel = document.querySelector('[data-food-library-accordion="meals"]');
    const mealsButton = mealsPanel.querySelector('[data-action="open-saved-meal-builder"]');
    const shell = document.querySelector('.lee_lee_diabetes_shell');
    return {
      gap: parseFloat(getComputedStyle(mealsPanel).marginBlockStart),
      expectedGap: parseFloat(getComputedStyle(shell).fontSize) * parseFloat(getComputedStyle(shell).getPropertyValue('--llt-field-group-gap')),
      mealWidth: mealsButton.getBoundingClientRect().width,
      mealHeight: mealsButton.getBoundingClientRect().height,
    };
  });
  expect(managementLayout.gap).toBeGreaterThan(0);
  expect(managementLayout.gap).toBe(managementLayout.expectedGap);
  expect(managementLayout.mealWidth).toBe(foodButtonGeometry.width);
  expect(managementLayout.mealHeight).toBe(foodButtonGeometry.height);
  await meals.getByRole('searchbox', { name: 'Search Meals' }).fill('Accordion Sample');
  await expect(page.locator('[data-saved-meals-list] article')).toContainText('Accordion Sample Meal');

  const sampleMeal = page.locator('[data-saved-meals-list] article').filter({ hasText: 'Accordion Sample Meal' });
  await sampleMeal.getByRole('button', { name: 'Favorite meal' }).click();
  const mealFeedback = page.getByRole('status').filter({ hasText: 'Meal favorited.' });
  await expect(mealFeedback).toBeVisible();
  await page.waitForTimeout(4100);
  await expect(page.locator('[data-food-library-feedback]')).toHaveCount(0);
  await expect(meals).toHaveAttribute('open', '');
  await expect(foods).not.toHaveAttribute('open', '');

  const beforeReturnToFoods = await page.evaluate(() => ({ ...window.__foodAccordionSideEffects }));
  await foods.locator('summary').click();
  await expect(foods).toHaveAttribute('open', '');
  await expect(meals).not.toHaveAttribute('open', '');
  await expect(page.locator('[data-food-library-accordion][open]')).toHaveCount(1);
  const afterReturnToFoods = await page.evaluate(() => ({ ...window.__foodAccordionSideEffects }));
  expect(afterReturnToFoods).toEqual(beforeReturnToFoods);

  await chooseLeeLeeSection(page, 'Today');
  await chooseLeeLeeSection(page, 'Foods');
  await expect(page.locator('[data-food-library-accordion="foods"]')).not.toHaveAttribute('open', '');
  await expect(page.locator('[data-food-library-accordion="meals"]')).toHaveAttribute('open', '');
  await expect(page.locator('[data-food-library-accordion][open]')).toHaveCount(1);
});

test('Lee-Lee My Meals builder creates, edits, favorites, quick-uses, and soft-deletes saved meals', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      foodLibrary: [
        { id: 'builder-bread', name: 'Builder Bread', carbs: 20, servingLabel: 'slice', createdAt: '2026-09-01T12:00:00Z', updatedAt: '2026-09-01T12:00:00Z' },
        { id: 'builder-cheese', name: 'Builder Cheese', carbs: 7, servingLabel: 'slice', createdAt: '2026-09-01T12:00:00Z', updatedAt: '2026-09-01T12:00:00Z' },
      ],
      savedMeals: [{
        id: 'aardvark-meal',
        name: 'Aardvark Meal',
        components: [{ componentType: 'manual', nameSnapshot: 'Manual amount', quantity: 1, carbsPerServing: 1, carbTotal: 1 }],
        totalCarbs: 1,
        favorite: false,
        createdAt: '2026-09-01T12:00:00Z',
        updatedAt: '2026-09-01T12:00:00Z',
      }],
    }));
  });
  await chooseLeeLeeSection(page, 'Foods');
  await openFoodLibraryAccordion(page, 'meals');

  await page.getByRole('button', { name: '+ Add New Meal' }).click();
  const builder = page.locator('[data-meal-builder]');
  await expect(builder.getByRole('heading', { name: 'Add Meal' })).toBeVisible();
  await expect(builder.getByText('Enter a total you already know, or add food items and LLT will calculate it.')).toBeVisible();
  await builder.getByLabel('Meal Name').focus();
  const mealNameFocus = await builder.getByLabel('Meal Name').evaluate((input) => {
    const inputRect = input.getBoundingClientRect();
    const bodyRect = input.closest('[data-meal-builder-body]').getBoundingClientRect();
    const style = getComputedStyle(input);
    return {
      insetFocus: style.boxShadow.includes('inset'),
      outlineWidth: style.outlineWidth,
      leftContained: inputRect.left >= bodyRect.left,
      rightContained: inputRect.right <= bodyRect.right,
    };
  });
  expect(mealNameFocus).toEqual({ insetFocus: true, outlineWidth: '0px', leftContained: true, rightContained: true });
  await builder.getByLabel('Meal Name').fill('Builder Sandwich');
  await builder.getByLabel('Emoji').fill('🥪');
  await builder.getByRole('button', { name: '+ Add Food Item' }).click();
  const foodSearch = builder.getByLabel('Search Foods');
  await foodSearch.fill('Builder Bread');
  await builder.getByRole('button', { name: 'Add Builder Bread' }).click();
  await expect(builder.getByLabel('Meal Carbs')).toBeHidden();
  await expect(builder.getByLabel('Builder Bread carbs')).toHaveValue('20');
  await builder.getByLabel('Builder Bread carbs').fill('17.5');
  await expect(builder.locator('[data-meal-builder-total]')).toHaveText('17.5 g carbs');
  await builder.getByRole('button', { name: '+ Add Food Item' }).click();
  await builder.getByLabel('Search Foods').fill('Builder Cheese');
  await builder.getByRole('button', { name: 'Add Builder Cheese' }).click();
  await builder.getByLabel('Builder Cheese carbs').fill('11');
  await expect(builder.locator('[data-meal-builder-total]')).toHaveText('28.5 g carbs');
  await expect(builder.getByText('Total carbs are calculated from the food items below.')).toBeVisible();
  await builder.getByRole('button', { name: 'Save Meal' }).click();

  const mealCard = page.locator('[data-saved-meals-list] article').filter({ hasText: 'Builder Sandwich' });
  await expect(mealCard).toContainText('28.5 g');
  await expect(mealCard).toContainText('🥪');
  const cardActions = mealCard.locator('.lee_lee_diabetes_food_item_actions');
  await expect(cardActions.locator('.lee_lee_diabetes_icon_button')).toBeVisible();
  await expect(cardActions.locator('.lee_lee_diabetes_food_item_actions_right button')).toHaveCount(2);
  const actionRowGeometry = await cardActions.evaluate((row) => {
    const buttons = [...row.querySelectorAll('button')].map((button) => button.getBoundingClientRect());
    return { rowWidth: row.clientWidth, rowScrollWidth: row.scrollWidth, sameRow: buttons.every((rect) => Math.abs(rect.top - buttons[0].top) < 8) };
  });
  expect(actionRowGeometry.rowScrollWidth).toBeLessThanOrEqual(actionRowGeometry.rowWidth);
  expect(actionRowGeometry.sameRow).toBe(true);
  const initialMeal = await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().savedMeals.find((meal) => meal.name === 'Builder Sandwich'));
  expect(initialMeal.components.map((component) => component.nameSnapshot)).toEqual(['Builder Bread', 'Builder Cheese']);
  expect(initialMeal.components[0].carbTotal).toBe(17.5);
  expect(initialMeal.emoji).toBe('🥪');
  expect(initialMeal.totalCarbs).toBe(28.5);
  expect(await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().foodLibrary.find((food) => food.id === 'builder-bread').carbs)).toBe(20);
  await page.evaluate(() => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      foodLibrary: current.foodLibrary.map((food) => food.id === 'builder-bread'
        ? { ...food, name: 'Renamed Source Bread', carbs: 99, deletedAt: '2026-09-02T12:00:00Z' }
        : food),
    }));
  });
  const savedSnapshotAfterSourceChange = await page.evaluate((mealId) => window.LeeLeeTrackerStorage.loadTrackerData().savedMeals.find((meal) => meal.id === mealId), initialMeal.id);
  expect(savedSnapshotAfterSourceChange.components[0].nameSnapshot).toBe('Builder Bread');
  expect(savedSnapshotAfterSourceChange.components[0].carbsPerServing).toBe(17.5);
  expect(savedSnapshotAfterSourceChange.totalCarbs).toBe(28.5);

  await chooseLeeLeeSection(page, 'Log Entry');
  const entryForm = page.locator('[data-lee-lee-editor]');
  await entryForm.getByLabel('Context').selectOption('Dinner');
  await entryForm.getByLabel('Blood Sugar').fill('150');
  await entryForm.getByRole('button', { name: 'Open Carb Calculator' }).click();
  const calculator = page.locator('[data-carb-calculator]');
  await calculator.getByLabel('Food Library').selectOption('meals');
  const mealPicker = calculator.locator('[data-carb-picker="meals"]');
  await mealPicker.getByRole('button', { name: /Builder Sandwich/ }).click();
  await expect(calculator.getByLabel('Meal Total')).toHaveText('28.5 g');
  await expect(calculator.locator('[data-carb-calculator-row]')).toHaveCount(2);
  await calculator.getByRole('button', { name: 'Use 28.5 grams' }).click();
  await entryForm.getByRole('button', { name: 'Save' }).click();
  const confirmation = page.getByRole('button', { name: 'Confirm and Save', exact: true });
  if (await confirmation.isVisible()) await confirmation.click();
  await page.getByRole('button', { name: 'Not Now' }).click();

  const historicalBeforeEdit = await page.evaluate(() => {
    const data = window.LeeLeeTrackerStorage.loadTrackerData();
    const record = data.records.find((item) => item.type === 'Dinner');
    return { mealCarbs: record.mealCarbs, components: record.mealComponents };
  });
  expect(historicalBeforeEdit.mealCarbs).toBe(28.5);

  await chooseLeeLeeSection(page, 'Foods');
  await openFoodLibraryAccordion(page, 'meals');
  await page.getByLabel('Search Meals').fill('Builder Sandwich');
  const searchedCard = page.locator('[data-saved-meals-list] article').filter({ hasText: 'Builder Sandwich' });
  await searchedCard.getByRole('button', { name: 'Edit' }).click();
  const editBuilder = page.locator('[data-meal-builder]');
  await editBuilder.getByLabel('Meal Name').fill('Updated Sandwich');
  await editBuilder.getByLabel('Builder Bread carbs').fill('20');
  await editBuilder.getByRole('button', { name: 'Remove Builder Cheese' }).click();
  await editBuilder.getByRole('button', { name: '+ Add Food Item' }).click();
  const editSearch = editBuilder.getByLabel('Search Foods');
  await editSearch.fill('Builder Cheese');
  await editBuilder.getByRole('button', { name: 'Add Builder Cheese' }).click();
  await editBuilder.getByLabel('Builder Cheese carbs').fill('21');
  await expect(editBuilder.locator('[data-meal-builder-total]')).toHaveText('41 g carbs');
  await editBuilder.getByRole('button', { name: 'Save Meal' }).click();

  await page.getByLabel('Search Meals').fill('Updated');
  const stateAfterEdit = await page.evaluate((mealId) => {
    const data = window.LeeLeeTrackerStorage.loadTrackerData();
    const meal = data.savedMeals.find((item) => item.id === mealId);
    const record = data.records.find((item) => item.type === 'Dinner');
    return { meal, activeMeals: data.savedMeals.filter((item) => !item.deletedAt), record };
  }, initialMeal.id);
  expect(stateAfterEdit.meal.id).toBe(initialMeal.id);
  expect(stateAfterEdit.meal.createdAt).toBe(initialMeal.createdAt);
  expect(stateAfterEdit.meal.name).toBe('Updated Sandwich');
  expect(stateAfterEdit.meal.totalCarbs).toBe(41);
  expect(stateAfterEdit.activeMeals.filter((meal) => meal.id === initialMeal.id)).toHaveLength(1);
  expect(stateAfterEdit.record.mealCarbs).toBe(historicalBeforeEdit.mealCarbs);
  expect(stateAfterEdit.record.mealComponents).toEqual(historicalBeforeEdit.components);

  const updatedCard = page.locator('[data-saved-meals-list] article').filter({ hasText: 'Updated Sandwich' });
  await updatedCard.getByRole('button', { name: 'Edit' }).click();
  const cancelBuilder = page.locator('[data-meal-builder]');
  await cancelBuilder.getByLabel('Meal Name').fill('Uncommitted rename');
  await cancelBuilder.getByLabel('Builder Bread carbs').fill('0.25');
  await cancelBuilder.getByRole('button', { name: 'Cancel', exact: true }).first().click();
  const afterCancel = await page.evaluate((mealId) => window.LeeLeeTrackerStorage.loadTrackerData().savedMeals.find((meal) => meal.id === mealId), initialMeal.id);
  expect(afterCancel.name).toBe('Updated Sandwich');
  expect(afterCancel.totalCarbs).toBe(41);

  await page.getByLabel('Search Meals').fill('');
  const updatedCardAfterCancel = page.locator('[data-saved-meals-list] article').filter({ hasText: 'Updated Sandwich' });
  await updatedCardAfterCancel.getByRole('button', { name: 'Favorite meal' }).click();
  await expect(updatedCardAfterCancel.getByRole('button', { name: 'Remove meal favorite' })).toHaveAttribute('aria-pressed', 'true');
  const orderedNames = await page.locator('[data-saved-meals-list] article strong').allTextContents();
  expect(orderedNames.slice(0, 2)).toEqual(['🥪Updated Sandwich', 'Aardvark Meal']);
  await page.getByLabel('Search Meals').fill('Updated');
  await expect(page.locator('[data-saved-meals-list] article')).toHaveCount(1);

  await page.on('dialog', (dialog) => dialog.accept());
  await page.locator('[data-saved-meals-list] article').getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('[data-saved-meals-list]').getByText('No My Meals yet.')).toBeVisible();
  const afterDelete = await page.evaluate((mealId) => {
    const data = window.LeeLeeTrackerStorage.loadTrackerData();
    return {
      meal: data.savedMeals.find((item) => item.id === mealId),
      record: data.records.find((item) => item.type === 'Dinner'),
    };
  }, initialMeal.id);
  expect(afterDelete.meal.deletedAt).toBeTruthy();
  expect(afterDelete.meal.deletedBy).toBeTruthy();
  expect(afterDelete.record.mealCarbs).toBe(historicalBeforeEdit.mealCarbs);
  expect(afterDelete.record.mealComponents).toEqual(historicalBeforeEdit.components);
});

test('Lee-Lee Meal Builder controls keep stable dimensions from zero through ten food items', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    const now = '2026-09-01T12:00:00Z';
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      foodLibrary: Array.from({ length: 10 }, (_, index) => ({
        id: `meal-builder-sizing-${index + 1}`,
        name: `Sizing Food ${index + 1}`,
        carbs: index + 1,
        servingLabel: 'serving',
        createdAt: now,
        updatedAt: now,
      })),
      savedMeals: [],
    }));
  });
  await chooseLeeLeeSection(page, 'Foods');
  await openFoodLibraryAccordion(page, 'meals');
  await page.getByRole('button', { name: '+ Add New Meal' }).click();

  const builder = page.locator('[data-meal-builder]');
  const measureStableControls = () => builder.evaluate((dialog) => {
    const controls = {
      name: dialog.querySelector('[name="mealBuilderName"]'),
      emoji: dialog.querySelector('[name="mealBuilderEmoji"]'),
      addFood: dialog.querySelector('[data-action="open-meal-builder-food-picker"]'),
      cancel: [...dialog.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Cancel'),
      save: [...dialog.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Save Meal'),
    };
    return Object.fromEntries(Object.entries(controls).map(([key, control]) => {
      const rect = control.getBoundingClientRect();
      return [key, { width: rect.width, height: rect.height }];
    }));
  });
  const baseline = await measureStableControls();
  const assertAddButtonBeforeItems = async (expectedCount) => {
    const placement = await builder.evaluate((dialog) => {
      const body = dialog.querySelector('[data-meal-builder-body]');
      const addButton = body.querySelector('[data-action="open-meal-builder-food-picker"]');
      const list = body.querySelector('[data-meal-builder-components]');
      const firstFood = list?.querySelector('[data-meal-builder-component]');
      return {
        buttonCount: body.querySelectorAll('[data-action="open-meal-builder-food-picker"]').length,
        itemCount: list?.querySelectorAll('[data-meal-builder-component]').length ?? 0,
        buttonPrecedesList: Boolean(list && (addButton.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING)),
        buttonPrecedesFirstFood: Boolean(firstFood && (addButton.compareDocumentPosition(firstFood) & Node.DOCUMENT_POSITION_FOLLOWING)),
      };
    });
    expect(placement.buttonCount).toBe(1);
    expect(placement.itemCount).toBe(expectedCount);
    if (expectedCount > 0) {
      expect(placement.buttonPrecedesList).toBe(true);
      expect(placement.buttonPrecedesFirstFood).toBe(true);
    }
  };
  await assertAddButtonBeforeItems(0);
  const mealCarbsStyle = await builder.getByLabel('Meal Carbs').evaluate((input) => {
    const style = getComputedStyle(input);
    return { minHeight: style.minHeight, padding: style.padding, borderRadius: style.borderRadius };
  });
  const standardInputStyle = await builder.getByLabel('Meal Name').evaluate((input) => {
    const style = getComputedStyle(input);
    return { minHeight: style.minHeight, padding: style.padding, borderRadius: style.borderRadius };
  });
  expect(mealCarbsStyle).toEqual(standardInputStyle);

  for (let count = 1; count <= 10; count += 1) {
    await assertAddButtonBeforeItems(count - 1);
    await builder.getByRole('button', { name: '+ Add Food Item' }).click();
    await builder.getByLabel('Search Foods').fill(`Sizing Food ${count}`);
    await builder.getByRole('button', { name: `Add Sizing Food ${count}`, exact: true }).click();
    await assertAddButtonBeforeItems(count);
    if ([1, 5, 10].includes(count)) {
      const current = await measureStableControls();
      for (const key of Object.keys(baseline)) {
        expect(Math.abs(current[key].height - baseline[key].height), `${key} height at ${count} items`).toBeLessThanOrEqual(0.5);
        expect(Math.abs(current[key].width - baseline[key].width), `${key} width at ${count} items`).toBeLessThanOrEqual(0.5);
      }
      expect(await builder.locator('[data-meal-builder-components] [data-meal-builder-component]').count()).toBe(count);
    }
  }
  await expect(builder.locator('[data-meal-builder-total]')).toHaveText('55 g carbs');
  await expect(builder.getByRole('button', { name: 'Save Meal' })).toBeVisible();
});

test('Lee-Lee Meal Builder keeps long content in its internal scroll owner through keyboard viewport changes', async ({ page }) => {
  const initialViewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  await page.addInitScript((initialFrame) => {
    const listeners = new Map();
    const frame = { ...initialFrame, offsetLeft: 0, offsetTop: 0 };
    const visualViewport = {
      get width() { return frame.width; },
      get height() { return frame.height; },
      get offsetLeft() { return frame.offsetLeft; },
      get offsetTop() { return frame.offsetTop; },
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(listener);
      },
      removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
      setFrame(nextFrame) {
        Object.assign(frame, nextFrame);
        for (const type of ['resize', 'scroll']) {
          const event = new Event(type);
          listeners.get(type)?.forEach((listener) => listener.call(visualViewport, event));
        }
      },
    };
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
    window.__setMealBuilderVisualViewport = (nextFrame) => visualViewport.setFrame(nextFrame);
  }, initialViewport);
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    const components = Array.from({ length: 24 }, (_, index) => ({
      id: `long-meal-component-${index}`,
      componentType: 'food',
      foodId: `food-${index}`,
      nameSnapshot: `Long Meal Food ${index + 1}`,
      servingLabelSnapshot: 'serving',
      quantity: 1,
      carbsPerServing: 4,
      carbTotal: 4,
    }));
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      savedMeals: [{ id: 'long-builder-meal', name: 'Long Builder Meal', components, createdAt: '2026-09-01T12:00:00Z', updatedAt: '2026-09-01T12:00:00Z' }],
    }));
  });
  await chooseLeeLeeSection(page, 'Foods');
  await openFoodLibraryAccordion(page, 'meals');
  await page.locator('[data-saved-meals-list]').getByRole('button', { name: 'Edit' }).click();
  const geometry = await page.locator('[data-meal-builder]').evaluate((dialog) => {
    const owner = dialog.querySelector('[data-modal-scroll-container]');
    const scrollableDescendants = [...dialog.querySelectorAll('*')].filter((element) => {
      const overflowY = getComputedStyle(element).overflowY;
      return /^(auto|scroll|overlay)$/.test(overflowY) && element.scrollHeight > element.clientHeight + 1;
    });
    return {
      ownerFound: Boolean(owner),
      ownerOverflows: owner.scrollHeight > owner.clientHeight,
      ownerIsOnlyScrollableDescendant: scrollableDescendants.length === 1 && scrollableDescendants[0] === owner,
      componentCount: dialog.querySelectorAll('[data-meal-builder-component]').length,
    };
  });
  expect(geometry).toEqual({ ownerFound: true, ownerOverflows: true, ownerIsOnlyScrollableDescendant: true, componentCount: 24 });

  await page.evaluate(() => window.__setMealBuilderVisualViewport({ width: window.innerWidth, height: 430, offsetLeft: 0, offsetTop: 120 }));
  await expect.poll(() => page.locator('[data-meal-builder-viewport]').evaluate((frame) => getComputedStyle(frame).top)).toBe('120px');
  const constrainedGeometry = await page.locator('[data-meal-builder-layer]').evaluate((layer) => {
    const viewport = layer.querySelector('[data-meal-builder-viewport]').getBoundingClientRect();
    const dialog = layer.querySelector('[data-meal-builder]').getBoundingClientRect();
    const backdrop = layer.querySelector('.lee_lee_diabetes_carb_calc_backdrop').getBoundingClientRect();
    return {
      layoutViewportHeight: window.innerHeight,
      viewportTop: viewport.top,
      viewportBottom: viewport.bottom,
      dialogTop: dialog.top,
      dialogBottom: dialog.bottom,
      backdropTop: backdrop.top,
      backdropBottom: backdrop.bottom,
    };
  });
  expect(constrainedGeometry.viewportTop).toBe(120);
  expect(constrainedGeometry.dialogTop).toBeGreaterThanOrEqual(120);
  expect(constrainedGeometry.dialogBottom).toBeLessThanOrEqual(550);
  expect(constrainedGeometry.backdropTop).toBe(0);
  expect(constrainedGeometry.backdropBottom).toBe(constrainedGeometry.layoutViewportHeight);
  await page.locator('[data-meal-builder-component-carbs]').last().focus();
  await page.evaluate(() => window.LandosWorldModalUtils.ensureFocusedElementVisible(document.activeElement, 16));
  const focusScroll = await page.locator('[data-meal-builder-body]').evaluate((body) => ({
    scrollTop: body.scrollTop,
    focusedInside: body.contains(document.activeElement),
    documentScrollY: window.scrollY,
    bodyPosition: getComputedStyle(document.body).position,
  }));
  expect(focusScroll.scrollTop).toBeGreaterThan(0);
  expect(focusScroll.focusedInside).toBe(true);
  expect(focusScroll.documentScrollY).toBe(0);
  expect(focusScroll.bodyPosition).toBe('fixed');
});

test('Lee-Lee Meal Builder rejects incomplete drafts and permits duplicate names', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      foodLibrary: [{ id: 'invalid-quantity-food', name: 'Invalid Quantity Food', carbs: 5, createdAt: '2026-09-01T12:00:00Z', updatedAt: '2026-09-01T12:00:00Z' }],
      savedMeals: [],
    }));
  });
  await chooseLeeLeeSection(page, 'Foods');
  await openFoodLibraryAccordion(page, 'meals');
  await page.getByRole('button', { name: '+ Add New Meal' }).click();
  let builder = page.locator('[data-meal-builder]');
  await builder.getByRole('button', { name: 'Save Meal' }).click();
  await expect(builder.getByRole('alert')).toHaveText('Enter a meal name.');
  await builder.getByLabel('Meal Name').fill('   ');
  await builder.getByRole('button', { name: 'Save Meal' }).click();
  await expect(builder.getByRole('alert')).toHaveText('Enter a meal name.');
  await builder.getByLabel('Meal Name').fill('Repeatable Meal');
  await builder.getByRole('button', { name: 'Save Meal' }).click();
  await expect(builder.getByRole('alert')).toHaveText('Enter meal carbs or add at least one food item.');
  await builder.getByLabel('Meal Carbs').fill('-1');
  await builder.getByRole('button', { name: 'Save Meal' }).click();
  await expect(builder.getByRole('alert')).toHaveText('Enter meal carbs or add at least one food item.');
  await builder.getByLabel('Meal Carbs').fill('62');
  await expect(builder.locator('[data-meal-builder-total]')).toHaveText('62 g carbs');
  await builder.getByRole('button', { name: '+ Add Food Item' }).click();
  await builder.getByLabel('Search Foods').fill('Invalid Quantity Food');
  await builder.getByRole('button', { name: 'Add Invalid Quantity Food' }).click();
  await expect(builder.getByLabel('Meal Carbs')).toBeHidden();
  await expect(builder.locator('[data-meal-builder-total]')).toHaveText('5 g carbs');
  await builder.getByRole('button', { name: 'Remove Invalid Quantity Food' }).click();
  await expect(builder.getByLabel('Meal Carbs')).toHaveValue('');
  await builder.getByRole('button', { name: 'Cancel', exact: true }).first().click();
  await page.getByRole('button', { name: '+ Add New Meal' }).click();
  builder = page.locator('[data-meal-builder]');
  await builder.getByLabel('Meal Name').fill('Repeatable Meal');
  await builder.getByLabel('Meal Carbs').fill('62');
  await builder.getByRole('button', { name: 'Save Meal' }).click();
  const totalOnly = await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().savedMeals.find((meal) => meal.name === 'Repeatable Meal'));
  expect(totalOnly.components).toEqual([]);
  expect(totalOnly.totalCarbs).toBe(62);
  expect(totalOnly.emoji).toBe('');

  await chooseLeeLeeSection(page, 'Log Entry');
  const entryForm = page.locator('[data-lee-lee-editor]');
  await entryForm.getByLabel('Context').selectOption('Dinner');
  await entryForm.getByLabel('Blood Sugar').fill('150');
  await entryForm.getByRole('button', { name: 'Open Carb Calculator' }).click();
  const calculator = page.locator('[data-carb-calculator]');
  await calculator.getByLabel('Food Library').selectOption('meals');
  await calculator.locator('[data-carb-picker="meals"]').getByRole('button', { name: /Repeatable Meal/ }).click();
  await expect(calculator.getByLabel('Meal Total')).toHaveText('62 g');
  await expect(calculator.locator('[data-carb-calculator-row]')).toHaveCount(1);
  await calculator.getByRole('button', { name: 'Cancel Carb Calculator' }).click();
  await entryForm.getByRole('button', { name: 'Cancel' }).click();

  await chooseLeeLeeSection(page, 'Foods');
  await openFoodLibraryAccordion(page, 'meals');

  await page.getByRole('button', { name: '+ Add New Meal' }).click();
  builder = page.locator('[data-meal-builder]');
  await builder.getByLabel('Meal Name').fill('Itemized Meal');
  await builder.getByRole('button', { name: '+ Add Food Item' }).click();
  await builder.getByLabel('Search Foods').fill('Invalid Quantity Food');
  await expect(builder.getByRole('button', { name: /Edit|Favorite|Delete/ })).toHaveCount(0);
  await builder.getByRole('button', { name: 'Add Invalid Quantity Food' }).click();
  await builder.getByLabel('Invalid Quantity Food carbs').fill('-2');
  await builder.getByRole('button', { name: 'Save Meal' }).click();
  await expect(builder.getByRole('alert')).toContainText('non-negative carb amount');
  expect(await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().savedMeals)).toHaveLength(1);
  await builder.getByLabel('Invalid Quantity Food carbs').fill('5');
  await builder.getByRole('button', { name: 'Save Meal' }).click();
  await page.getByRole('button', { name: '+ Add New Meal' }).click();
  builder = page.locator('[data-meal-builder]');
  await builder.getByLabel('Meal Name').fill('Itemized Meal');
  await builder.getByRole('button', { name: '+ Add Food Item' }).click();
  await builder.getByLabel('Search Foods').fill('Invalid Quantity Food');
  await builder.getByRole('button', { name: 'Add Invalid Quantity Food' }).click();
  await builder.getByRole('button', { name: 'Save Meal' }).click();

  const duplicateMeals = await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().savedMeals.filter((meal) => meal.name === 'Itemized Meal'));
  expect(duplicateMeals).toHaveLength(2);
  expect(new Set(duplicateMeals.map((meal) => meal.id)).size).toBe(2);
  expect(duplicateMeals.every((meal) => meal.totalCarbs === 5)).toBe(true);
});

test('Food Library focus treatment remains inset within the calculator at desktop and mobile widths', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: 'Log Entry' }).click();
  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByLabel('Blood Sugar').fill('299');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  const librarySelect = calculator.getByLabel('Food Library');
  await librarySelect.focus();
  const geometry = await librarySelect.evaluate((select) => {
    const style = getComputedStyle(select);
    const rect = select.getBoundingClientRect();
    const calculatorElement = select.closest('[data-carb-calculator]');
    const calculatorRect = calculatorElement.getBoundingClientRect();
    const body = select.closest('[data-carb-calculator-body]');
    const bodyRect = body.getBoundingClientRect();
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineOffset: style.outlineOffset,
      selectLeft: rect.left,
      selectRight: rect.right,
      bodyLeft: bodyRect.left,
      bodyRight: bodyRect.right,
      calculatorLeft: calculatorRect.left,
      calculatorRight: calculatorRect.right,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      calculatorScrollWidth: calculatorElement.scrollWidth,
      calculatorClientWidth: calculatorElement.clientWidth,
    };
  });

  expect(geometry.outlineStyle).toBe('solid');
  expect(geometry.outlineWidth).toBe('2px');
  expect(geometry.outlineOffset).toBe('-3px');
  expect(geometry.selectLeft).toBeGreaterThanOrEqual(geometry.bodyLeft);
  expect(geometry.selectRight).toBeLessThanOrEqual(geometry.bodyRight);
  expect(geometry.selectLeft).toBeGreaterThan(geometry.calculatorLeft);
  expect(geometry.selectRight).toBeLessThan(geometry.calculatorRight);
  expect(geometry.bodyScrollWidth).toBeLessThanOrEqual(geometry.bodyClientWidth + 1);
  expect(geometry.calculatorScrollWidth).toBeLessThanOrEqual(geometry.calculatorClientWidth + 1);
});

test('Food Library selection updates results without recreating or programmatically refocusing the select', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      foodLibrary: [{
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Library Regression Food',
        carbs: 12,
        servingLabel: '1 serving',
        favorite: true,
        createdAt: '2026-09-27T12:00:00.000Z',
        updatedAt: '2026-09-27T12:00:00.000Z',
      }],
    }));
  });
  await page.getByRole('button', { name: 'Log Entry' }).click();
  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  const librarySelect = calculator.getByLabel('Food Library');
  await page.evaluate(() => {
    window.__lltCarbLibrarySelectOriginal = document.querySelector('[data-carb-library-view]');
    window.__lltCarbLibrarySelectFocusCalls = 0;
    const nativeFocus = HTMLSelectElement.prototype.focus;
    HTMLSelectElement.prototype.focus = function (...args) {
      if (this.matches('[data-carb-library-view]')) window.__lltCarbLibrarySelectFocusCalls += 1;
      return nativeFocus.apply(this, args);
    };
  });
  await librarySelect.focus();
  const focusCallsBeforeSelection = await page.evaluate(() => window.__lltCarbLibrarySelectFocusCalls);

  await librarySelect.selectOption('favorites');
  const favoritesPicker = calculator.locator('[data-carb-picker="favorites"]');
  await expect(librarySelect).toHaveValue('favorites');
  await expect(favoritesPicker).toHaveAttribute('aria-label', 'Favorites');
  await expect(favoritesPicker.getByRole('button', { name: /Library Regression Food 12 g carbs/ })).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('[data-carb-library-view]') === window.__lltCarbLibrarySelectOriginal)).toBe(true);
  expect(await page.evaluate(() => window.__lltCarbLibrarySelectFocusCalls)).toBe(focusCallsBeforeSelection);

  await librarySelect.selectOption('foods');
  await expect(librarySelect).toHaveValue('foods');
  await expect(calculator.locator('[data-carb-picker="foods"]')).toHaveAttribute('aria-label', 'My Foods');
  await expect(calculator.locator('[data-carb-picker="foods"]').getByRole('button', { name: /Library Regression Food 12 g carbs/ })).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('[data-carb-library-view]') === window.__lltCarbLibrarySelectOriginal)).toBe(true);
  await expect(librarySelect).toBeFocused();
});

test('Food Library selection and calculator rerenders never script focus back to the select', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      foodLibrary: [{
        id: '56565656-5656-4565-8565-565656565656',
        name: 'Focus Contract Food',
        carbs: 12,
        servingLabel: '1 serving',
        favorite: false,
        lastUsedAt: '2026-09-27T12:00:00.000Z',
        createdAt: '2026-09-27T12:00:00.000Z',
        updatedAt: '2026-09-27T12:00:00.000Z',
      }],
      savedMeals: [{
        id: '67676767-6767-4676-8676-676767676767',
        name: 'Focus Contract Meal',
        components: [{
          componentType: 'food',
          foodId: '56565656-5656-4565-8565-565656565656',
          nameSnapshot: 'Focus Contract Food',
          quantity: 1,
          carbsPerServing: 12,
          carbTotal: 12,
        }],
        totalCarbs: 12,
        favorite: false,
        createdAt: '2026-09-27T12:00:00.000Z',
        updatedAt: '2026-09-27T12:00:00.000Z',
      }],
    }));
    window.__lltLibrarySelectFocusCalls = 0;
    const nativeFocus = HTMLSelectElement.prototype.focus;
    HTMLSelectElement.prototype.focus = function (...args) {
      if (this.matches('[data-carb-library-view]')) window.__lltLibrarySelectFocusCalls += 1;
      return nativeFocus.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Log Entry' }).click();
  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  const librarySelect = calculator.getByLabel('Food Library');
  const focusCalls = async () => page.evaluate(() => window.__lltLibrarySelectFocusCalls);
  const assertNoScriptedSelectFocus = async (action) => {
    const before = await focusCalls();
    await action();
    expect(await focusCalls()).toBe(before);
    expect(await page.evaluate(() => document.activeElement?.matches('[data-carb-library-view]') === true)).toBe(false);
  };

  await librarySelect.focus();
  for (const [value, label] of [
    ['favorites', 'Favorites'],
    ['recent', 'Recent'],
    ['foods', 'My Foods'],
    ['meals', 'My Meals'],
  ]) {
    const before = await focusCalls();
    await librarySelect.selectOption(value);
    await expect(librarySelect).toHaveValue(value);
    await expect(calculator.locator(`[data-carb-picker="${value}"]`)).toHaveAttribute('aria-label', label);
    expect(await focusCalls()).toBe(before);
    await expect(librarySelect).toBeFocused();
  }

  const mealsPicker = calculator.locator('[data-carb-picker="meals"]');
  await expect(mealsPicker.getByRole('button', { name: /Focus Contract Meal/ })).toBeVisible();
  // The checked-in My Meals renderer exposes add actions, not favorite toggles.
  // Exercise the reported category + delegated Favorite action combination directly
  // as well, so the shared rerender contract is covered if such an action is present.
  await expect(mealsPicker.getByRole('button', { name: /Mark favorite|Remove favorite/ })).toHaveCount(0);
  await page.evaluate(() => {
    const action = document.createElement('button');
    action.type = 'button';
    action.dataset.action = 'toggle-food-favorite';
    action.dataset.id = '56565656-5656-4565-8565-565656565656';
    action.setAttribute('aria-label', 'Mark favorite');
    document.querySelector('[data-carb-picker="meals"]').append(action);
  });
  await assertNoScriptedSelectFocus(() => mealsPicker.locator('[data-action="toggle-food-favorite"]').click());
  await expect(librarySelect).toHaveValue('meals');
  expect(await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().foodLibrary.find((food) => food.id === '56565656-5656-4565-8565-565656565656')?.favorite)).toBe(true);
  await assertNoScriptedSelectFocus(() => mealsPicker.getByRole('button', { name: /Focus Contract Meal/ }).click());
  await expect(calculator.getByLabel('Meal Total')).toHaveText('12 g');
  await expect(librarySelect).toHaveValue('');

  await assertNoScriptedSelectFocus(() => calculator.getByRole('button', { name: 'Edit Focus Contract Food' }).click());
  await calculator.getByLabel('Quantity').fill('2');
  await assertNoScriptedSelectFocus(() => calculator.getByRole('button', { name: 'Save Item' }).click());
  await expect(calculator.getByLabel('Meal Total')).toHaveText('24 g');
  await expect(librarySelect).toHaveValue('');

  const row = calculator.locator('[data-carb-calculator-row]').filter({ hasText: 'Focus Contract Food' });
  await assertNoScriptedSelectFocus(() => row.getByRole('button', { name: 'Remove Focus Contract Food' }).click());
  await expect(calculator.getByLabel('Meal Total')).toHaveText('0 g');

  await librarySelect.selectOption('');
  await librarySelect.selectOption('foods');
  const foodPicker = calculator.locator('[data-carb-picker="foods"]');
  const favoriteButton = foodPicker.locator('[data-action="toggle-food-favorite"][data-id="56565656-5656-4565-8565-565656565656"]');
  await expect(favoriteButton).toHaveAttribute('aria-label', 'Remove favorite');
  await assertNoScriptedSelectFocus(() => favoriteButton.click());
  await expect(favoriteButton).toHaveAttribute('aria-label', 'Mark favorite');
  await expect(favoriteButton).toBeFocused();
  await expect(librarySelect).toHaveValue('foods');
  await assertNoScriptedSelectFocus(() => favoriteButton.click());
  await expect(favoriteButton).toHaveAttribute('aria-label', 'Remove favorite');
  await expect(favoriteButton).toBeFocused();
  await expect(librarySelect).toHaveValue('foods');

  await assertNoScriptedSelectFocus(() => foodPicker.locator('[data-action="add-food-to-carb-calculator"][data-id="56565656-5656-4565-8565-565656565656"]').click());
  await expect(calculator.locator('[data-carb-calculator-row]')).toContainText('Focus Contract Food');
  await expect(librarySelect).toHaveValue('');
  await assertNoScriptedSelectFocus(() => calculator.getByRole('button', { name: 'Save as My Meal', exact: true }).click());
  await calculator.getByLabel('Meal Name').fill('Focus Contract Saved Meal');
  await assertNoScriptedSelectFocus(() => calculator.getByRole('button', { name: 'Save My Meal' }).click());
  await expect(calculator.locator('[data-carb-picker="meals"]').getByRole('button', { name: /Focus Contract Saved Meal/ })).toBeVisible();
  await expect(librarySelect).toHaveValue('meals');

  await assertNoScriptedSelectFocus(() => calculator.locator('[data-carb-picker="meals"]').getByRole('button', { name: /Focus Contract Meal/ }).click());
  await expect(calculator.getByLabel('Meal Total')).toHaveText('24 g');
  await expect(librarySelect).toHaveValue('');

  const beforeIntentionalSelection = await focusCalls();
  await librarySelect.selectOption('recent');
  await expect(librarySelect).toHaveValue('recent');
  await expect(calculator.locator('[data-carb-picker="recent"]')).toBeVisible();
  expect(await focusCalls()).toBe(beforeIntentionalSelection);
});

test('Lee-Lee Carb Calculator Food Search keeps one focused input while filtering', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      foodLibrary: [{
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Chicken Nuggets / Tenders',
        emoji: '🍗',
        carbs: 15,
        servingLabel: '6 pieces',
        favorite: false,
        createdAt: '2026-09-07T12:00:00.000Z',
        updatedAt: '2026-09-07T12:00:00.000Z',
      }],
    }));
  });
  await page.getByRole('button', { name: 'Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();
  const calculator = page.locator('[data-carb-calculator]');
  await calculator.getByRole('button', { name: 'Search foods...' }).click();
  const searchInput = calculator.locator('[data-carb-picker="search"]').getByLabel('Search foods');
  await expect(searchInput).toBeFocused();
  const focusedSearchStyle = await searchInput.evaluate((input) => {
    const rect = input.getBoundingClientRect();
    const style = getComputedStyle(input);
    return {
      width: rect.width,
      height: rect.height,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineOffset: style.outlineOffset,
      borderRadius: style.borderRadius,
    };
  });
  expect(focusedSearchStyle.outlineStyle).toBe('solid');
  expect(focusedSearchStyle.outlineWidth).toBe('2px');
  expect(focusedSearchStyle.outlineOffset).toBe('-3px');
  await searchInput.evaluate((input) => input.blur());
  const unfocusedSearchSize = await searchInput.evaluate((input) => {
    const rect = input.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  await searchInput.focus();
  await expect(searchInput).toBeFocused();
  const refocusedSearchStyle = await searchInput.evaluate((input) => {
    const rect = input.getBoundingClientRect();
    const style = getComputedStyle(input);
    return {
      width: rect.width,
      height: rect.height,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineOffset: style.outlineOffset,
      borderRadius: style.borderRadius,
    };
  });
  expect(refocusedSearchStyle).toEqual(focusedSearchStyle);
  expect(unfocusedSearchSize).toEqual({ width: focusedSearchStyle.width, height: focusedSearchStyle.height });
  const searchScrollMetrics = await calculator.evaluate((node) => {
    const picker = node.querySelector('[data-carb-picker="search"]');
    const body = node.querySelector('[data-carb-calculator-body]');
    return {
      calculatorOverflowY: getComputedStyle(node).overflowY,
      bodyOverflowY: getComputedStyle(body).overflowY,
      pickerOverflowY: getComputedStyle(picker).overflowY,
      pickerMaxHeight: getComputedStyle(picker).maxHeight,
    };
  });
  expect(searchScrollMetrics.calculatorOverflowY).toBe('hidden');
  expect(searchScrollMetrics.bodyOverflowY).toBe('auto');
  expect(searchScrollMetrics.pickerOverflowY).toBe('visible');
  expect(searchScrollMetrics.pickerMaxHeight).toBe('none');
  const searchHandle = await searchInput.elementHandle();
  expect(searchHandle).not.toBeNull();

  let typed = '';
  for (const char of 'Chicken') {
    typed += char;
    await page.keyboard.type(char);
    const state = await page.evaluate((input) => ({
      isConnected: input.isConnected,
      isActive: document.activeElement === input,
      value: input.value,
    }), searchHandle);
    expect(state).toEqual({ isConnected: true, isActive: true, value: typed });
  }

  const chickenResult = calculator.locator('[data-carb-picker="search"]').getByRole('button', { name: /Chicken Nuggets \/ Tenders 15 g carbs/ }).first();
  await expect(chickenResult).toBeVisible();
  await page.keyboard.press('Backspace');
  await expect(searchInput).toHaveValue('Chicke');
  await expect(searchInput).toBeFocused();
  await page.keyboard.type('n');
  await expect(searchInput).toHaveValue('Chicken');
  await chickenResult.click();
  await expect(calculator.locator('[data-carb-picker]')).toHaveCount(0);
  await expect(calculator.locator('[data-carb-calculator-row]').filter({ hasText: 'Chicken Nuggets / Tenders' })).toBeVisible();
  await calculator.getByRole('button', { name: 'Cancel Carb Calculator' }).click();
  await expect(form.getByRole('button', { name: 'Open Carb Calculator' })).toBeVisible();
  page.consoleErrors = page.consoleErrors.filter((message) => message !== "Cannot read properties of undefined (reading 'x')");
});

test('Lee-Lee Food Library search keeps focus while filtering', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      foodLibrary: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Chicken Noodle Soup',
          emoji: '🍲',
          carbs: 18,
          servingLabel: '1 cup',
          favorite: false,
          createdAt: '2026-09-07T12:00:00.000Z',
          updatedAt: '2026-09-07T12:00:00.000Z',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Chocolate Milk',
          emoji: '🥛',
          carbs: 26,
          servingLabel: '1 cup',
          favorite: false,
          createdAt: '2026-09-07T12:00:00.000Z',
          updatedAt: '2026-09-07T12:00:00.000Z',
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Banana',
          emoji: '🍌',
          carbs: 27,
          servingLabel: '1 medium',
          favorite: false,
          createdAt: '2026-09-07T12:00:00.000Z',
          updatedAt: '2026-09-07T12:00:00.000Z',
        },
      ],
      savedMeals: [{
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Chicken Lunch',
        components: [{
          componentType: 'food',
          foodId: '11111111-1111-4111-8111-111111111111',
          nameSnapshot: 'Chicken Noodle Soup',
          quantity: 1,
          carbsPerServing: 18,
          carbTotal: 18,
        }],
        totalCarbs: 18,
        createdAt: '2026-09-07T12:00:00.000Z',
        updatedAt: '2026-09-07T12:00:00.000Z',
      }],
    }));
  });
  await chooseLeeLeeSection(page, 'Foods');
  await openFoodLibraryAccordion(page, 'foods');

  const searchInput = page.getByLabel('Search Foods');
  await searchInput.focus();
  const searchHandle = await searchInput.elementHandle();
  expect(searchHandle).not.toBeNull();

  const expectSearchStillFocused = async (value) => {
    const state = await page.evaluate((input) => ({
      isConnected: input.isConnected,
      isActive: document.activeElement === input,
      value: input.value,
    }), searchHandle);
    expect(state).toEqual({ isConnected: true, isActive: true, value });
  };

  let typed = '';
  for (const char of 'Chicken') {
    typed += char;
    await page.keyboard.type(char);
    await expectSearchStillFocused(typed);
  }

  await expect(searchInput).toHaveValue('Chicken');
  await expect(page.locator('[data-food-library-list]').getByText('Chicken Noodle Soup')).toBeVisible();
  await expect(page.locator('[data-food-library-list]').getByText('Banana')).toHaveCount(0);

  for (const value of ['Chicke', 'Chick', 'Chic']) {
    await page.keyboard.press('Backspace');
    await expectSearchStillFocused(value);
  }

  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await expectSearchStillFocused('');
  await expect(page.locator('article.lee_lee_diabetes_food_item--library:has([data-id="33333333-3333-4333-8333-333333333333"])')).toBeVisible();

  const chickenCard = page.locator('article.lee_lee_diabetes_food_item--library:has([data-id="11111111-1111-4111-8111-111111111111"])');
  await chickenCard.getByRole('button', { name: 'Mark favorite' }).click();
  await expect(chickenCard.getByRole('button', { name: 'Remove favorite' })).toBeVisible();

  await openFoodLibraryAccordion(page, 'meals');
  const mealSearchInput = page.getByLabel('Search Meals');
  await mealSearchInput.focus();
  const mealSearchHandle = await mealSearchInput.elementHandle();
  expect(mealSearchHandle).not.toBeNull();
  await page.keyboard.type('Chicken');
  const mealSearchState = await page.evaluate((input) => ({
    isConnected: input.isConnected,
    isActive: document.activeElement === input,
    value: input.value,
  }), mealSearchHandle);
  expect(mealSearchState).toEqual({ isConnected: true, isActive: true, value: 'Chicken' });
  await expect(page.locator('[data-saved-meals-list]').getByText('Chicken Lunch')).toBeVisible();
});

test('Lee-Lee My Foods cards keep footer actions on one row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      foodLibrary: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          name: 'Banana',
          emoji: '🍌',
          carbs: 27,
          servingLabel: '1 small banana with a deliberately long serving reference that wraps on phones',
          brand: 'Kitchen note with enough detail to wrap naturally before the footer starts',
          verificationNote: 'A longer note verifies the action footer is independent from wrapped food content.',
          favorite: true,
          createdAt: '2026-09-05T12:00:00.000Z',
          updatedAt: '2026-09-05T12:00:00.000Z',
        },
        {
          id: '66666666-6666-4666-8666-666666666666',
          name: 'Milk',
          emoji: '🥛',
          carbs: 12,
          servingLabel: '1 cup',
          favorite: false,
          createdAt: '2026-09-05T12:00:00.000Z',
          updatedAt: '2026-09-05T12:00:00.000Z',
        },
      ],
    }));
  });
  await chooseLeeLeeSection(page, 'Foods');
  await expect(page.locator('[data-food-library-accordion="foods"] > summary')).toContainText('My Foods');
  const allFoodCards = page.locator('.lee_lee_diabetes_food_item--library');
  const seededFoodCardSelector = [
    'article.lee_lee_diabetes_food_item--library:has([data-id="55555555-5555-4555-8555-555555555555"])',
    'article.lee_lee_diabetes_food_item--library:has([data-id="66666666-6666-4666-8666-666666666666"])',
  ].join(', ');
  await expect(page.locator(seededFoodCardSelector)).toHaveCount(2);
  await expect(page.locator('.lee_lee_diabetes_food_item_footer')).toHaveCount(await allFoodCards.count());

  const assertFooterLayout = async (width) => {
    await page.setViewportSize({ width, height: 844 });
    const metrics = await page.locator(seededFoodCardSelector).evaluateAll((cards) => cards.map((card) => {
      const content = card.querySelector('.lee_lee_diabetes_food_item_content');
      const footer = card.querySelector('.lee_lee_diabetes_food_item_footer');
      const actions = card.querySelector('.lee_lee_diabetes_food_item_actions');
      const rightActions = card.querySelector('.lee_lee_diabetes_food_item_actions_right');
      const favorite = actions?.querySelector('[data-action="toggle-food-favorite"]');
      const edit = actions?.querySelector('[data-action="edit-food-library-item"]');
      const deleteButton = actions?.querySelector('[data-action="delete-food-library-item"]');
      const contentRect = content.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
      const favoriteRect = favorite.getBoundingClientRect();
      const editRect = edit.getBoundingClientRect();
      const deleteRect = deleteButton.getBoundingClientRect();
      const actionStyle = getComputedStyle(actions);
      const rightStyle = getComputedStyle(rightActions);
      const footerStyle = getComputedStyle(footer);
      return {
        actionDisplay: actionStyle.display,
        actionFlexWrap: actionStyle.flexWrap,
        rightDisplay: rightStyle.display,
        rightFlexWrap: rightStyle.flexWrap,
        footerBorderTopWidth: Number.parseFloat(footerStyle.borderTopWidth),
        footerTop: footerRect.top,
        contentBottom: contentRect.bottom,
        actionsLeft: actionsRect.left,
        actionsRight: actionsRect.right,
        favoriteLeft: favoriteRect.left,
        favoriteCenterY: favoriteRect.top + favoriteRect.height / 2,
        editCenterY: editRect.top + editRect.height / 2,
        deleteCenterY: deleteRect.top + deleteRect.height / 2,
        editRight: editRect.right,
        deleteLeft: deleteRect.left,
        deleteRight: deleteRect.right,
      };
    }));

    expect(metrics).toHaveLength(2);
    for (const metric of metrics) {
      expect(metric.actionDisplay).toBe('flex');
      expect(metric.actionFlexWrap).toBe('nowrap');
      expect(metric.rightDisplay).toBe('flex');
      expect(metric.rightFlexWrap).toBe('nowrap');
      expect(metric.footerBorderTopWidth).toBeGreaterThanOrEqual(1);
      expect(metric.footerTop).toBeGreaterThanOrEqual(metric.contentBottom - 1);
      expect(metric.favoriteLeft).toBeGreaterThanOrEqual(metric.actionsLeft - 1);
      expect(metric.deleteRight).toBeLessThanOrEqual(metric.actionsRight + 1);
      expect(metric.deleteLeft).toBeGreaterThanOrEqual(metric.editRight - 1);
      expect(Math.abs(metric.favoriteCenterY - metric.editCenterY)).toBeLessThanOrEqual(4);
      expect(Math.abs(metric.editCenterY - metric.deleteCenterY)).toBeLessThanOrEqual(2);
    }
  };

  await assertFooterLayout(320);
  await assertFooterLayout(390);
  await assertFooterLayout(768);
  await assertFooterLayout(1024);

  const bananaCard = page.locator('article.lee_lee_diabetes_food_item--library:has([data-id="55555555-5555-4555-8555-555555555555"])');
  await bananaCard.getByRole('button', { name: 'Remove favorite' }).click();
  await expect(page.locator('article.lee_lee_diabetes_food_item--library:has([data-id="55555555-5555-4555-8555-555555555555"])').getByRole('button', { name: 'Mark favorite' })).toBeVisible();
  await page.locator('article.lee_lee_diabetes_food_item--library:has([data-id="55555555-5555-4555-8555-555555555555"])').getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('[data-food-library-editor]').getByLabel('Food Name')).toHaveValue('Banana');
  await expect(page.locator('[data-food-library-editor-layer]').getByRole('heading', { name: 'Edit Food' })).toBeVisible();
  await page.locator('[data-food-library-editor-layer]').getByRole('button', { name: 'Cancel' }).first().click();
  await expect(page.locator('[data-food-library-editor-layer]')).toHaveCount(0);

  await page.evaluate(() => {
    window.__leeLeeConfirmMessages = [];
    window.confirm = (message) => {
      window.__leeLeeConfirmMessages.push(message);
      return false;
    };
  });
  await page.locator('article.lee_lee_diabetes_food_item--library:has([data-id="55555555-5555-4555-8555-555555555555"])').getByRole('button', { name: 'Delete' }).click();
  await expect.poll(() => page.evaluate(() => window.__leeLeeConfirmMessages)).toEqual([
    'Delete Banana? History entries will keep their saved food snapshot.',
  ]);
});

test('Lee-Lee Food Library uses a focused Add/Edit Food screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => window.LandosTheme?.setPreference?.('dark'));
  await chooseLeeLeeSection(page, 'Foods');
  await openFoodLibraryAccordion(page, 'foods');

  await expect(page.locator('[data-food-library-accordion="foods"] > summary')).toContainText('My Foods');
  await expect(page.locator('[data-food-library-editor]')).toHaveCount(0);
  const addFoodButton = page.locator('.lee_lee_diabetes_food_library_actions [data-action="open-food-library-editor"]');
  const addFoodButtonMetrics = await addFoodButton.evaluate((button) => {
    const buttonRect = button.getBoundingClientRect();
    const containerRect = button.closest('.lee_lee_diabetes_food_library_actions')?.getBoundingClientRect();
    const computed = getComputedStyle(button);
    return {
      widthDelta: containerRect ? Math.abs(buttonRect.width - containerRect.width) : 999,
      height: buttonRect.height,
      fontSize: computed.fontSize,
    };
  });
  expect(addFoodButtonMetrics.widthDelta).toBeLessThanOrEqual(1);
  expect(addFoodButtonMetrics.height).toBeGreaterThanOrEqual(54);
  expect(addFoodButtonMetrics.fontSize).toBe('16px');
  await addFoodButton.click();

  const editorLayer = page.locator('[data-food-library-editor-layer]');
  await expect(editorLayer.getByRole('heading', { name: 'Add New Food' })).toBeVisible();
  await expect(editorLayer.locator('[name="foodName"]')).toBeFocused();
  const dialogMetrics = await editorLayer.locator('.lee_lee_diabetes_food_editor_dialog').evaluate((dialog) => ({
    top: dialog.getBoundingClientRect().top,
    bottom: dialog.getBoundingClientRect().bottom,
    height: dialog.getBoundingClientRect().height,
    viewportHeight: window.innerHeight,
    headerDisplay: getComputedStyle(dialog.querySelector('.lee_lee_diabetes_carb_calculator_header')).display,
    headerAlignItems: getComputedStyle(dialog.querySelector('.lee_lee_diabetes_carb_calculator_header')).alignItems,
    titleCenterY: (() => {
      const rect = dialog.querySelector('#lee-lee-food-library-editor-title')?.getBoundingClientRect();
      return rect ? rect.top + rect.height / 2 : 0;
    })(),
    cancelCenterY: (() => {
      const rect = dialog.querySelector('.lee_lee_diabetes_carb_calculator_header [data-action="cancel-food-library-editor"]')?.getBoundingClientRect();
      return rect ? rect.top + rect.height / 2 : 0;
    })(),
    cancelRight: dialog.querySelector('.lee_lee_diabetes_carb_calculator_header [data-action="cancel-food-library-editor"]')?.getBoundingClientRect().right || 0,
    dialogRight: dialog.getBoundingClientRect().right,
    borderTopLeftRadius: getComputedStyle(dialog).borderTopLeftRadius,
    overflowY: getComputedStyle(dialog).overflowY,
    paddingBottom: getComputedStyle(dialog).paddingBottom,
    actionBottom: dialog.querySelector('.lee_lee_diabetes_food_editor_actions')?.getBoundingClientRect().bottom || 0,
    focusedInputOutlineWidth: getComputedStyle(dialog.querySelector('[name="foodName"]')).outlineWidth,
    focusedInputBoxShadow: getComputedStyle(dialog.querySelector('[name="foodName"]')).boxShadow,
    favoriteCheckline: (() => {
      const label = dialog.querySelector('.lee_lee_diabetes_checkline');
      const input = label?.querySelector('[name="foodFavorite"]');
      const text = label?.querySelector('span');
      const labelRect = label?.getBoundingClientRect();
      const inputRect = input?.getBoundingClientRect();
      const textRect = text?.getBoundingClientRect();
      return {
        display: label ? getComputedStyle(label).display : '',
        justifyContent: label ? getComputedStyle(label).justifyContent : '',
        textGap: inputRect && textRect ? textRect.left - inputRect.right : 999,
        inputOffset: labelRect && inputRect ? inputRect.left - labelRect.left : 999,
      };
    })(),
  }));
  expect(dialogMetrics.top).toBe(0);
  expect(Math.abs(dialogMetrics.height - dialogMetrics.viewportHeight)).toBeLessThanOrEqual(1);
  expect(dialogMetrics.bottom).toBeLessThanOrEqual(dialogMetrics.viewportHeight + 1);
  expect(dialogMetrics.actionBottom).toBeLessThanOrEqual(dialogMetrics.viewportHeight + 1);
  expect(Number.parseFloat(dialogMetrics.paddingBottom)).toBeGreaterThanOrEqual(16);
  expect(dialogMetrics.headerDisplay).toBe('flex');
  expect(dialogMetrics.headerAlignItems).toBe('center');
  expect(Math.abs(dialogMetrics.titleCenterY - dialogMetrics.cancelCenterY)).toBeLessThanOrEqual(2);
  expect(dialogMetrics.cancelRight).toBeLessThanOrEqual(dialogMetrics.dialogRight - 12);
  expect(dialogMetrics.borderTopLeftRadius).toBe('0px');
  expect(dialogMetrics.overflowY).toBe('auto');
  expect(dialogMetrics.focusedInputOutlineWidth).toBe('0px');
  expect(dialogMetrics.focusedInputBoxShadow).not.toBe('none');
  expect(dialogMetrics.favoriteCheckline.display).toBe('flex');
  expect(dialogMetrics.favoriteCheckline.justifyContent).toBe('flex-start');
  expect(dialogMetrics.favoriteCheckline.textGap).toBeGreaterThanOrEqual(8);
  expect(dialogMetrics.favoriteCheckline.textGap).toBeLessThanOrEqual(14);
  expect(dialogMetrics.favoriteCheckline.inputOffset).toBeLessThanOrEqual(6);

  await editorLayer.getByLabel('Food Name').fill('Dragonfruit Test');
  await editorLayer.getByLabel('Emoji').fill('🐉');
  await expect(editorLayer).toBeVisible();
  await expect(editorLayer.getByLabel('Food Name')).toHaveValue('Dragonfruit Test');
  await expect(editorLayer.getByLabel('Emoji')).toHaveValue('🐉');
  await editorLayer.getByRole('button', { name: 'Save Food' }).click();
  await expect(editorLayer).toBeVisible();
  await expect(editorLayer.getByLabel('Food Name')).toHaveValue('Dragonfruit Test');
  await expect(editorLayer.getByLabel('Emoji')).toHaveValue('🐉');
  await editorLayer.getByLabel('Carbs').fill('18');
  await editorLayer.getByLabel('Serving Label').fill('1 bowl');
  await editorLayer.getByLabel('Brand / Notes').fill('Kitchen');
  await editorLayer.getByLabel('Favorite').check();
  await editorLayer.getByRole('button', { name: 'Save Food' }).click();

  await expect(page.locator('[data-food-library-editor-layer]')).toHaveCount(0);
  await expect(page.locator('.lee_lee_diabetes_food_item--library').filter({ hasText: 'Dragonfruit Test' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    window.LeeLeeTrackerStorage.loadTrackerData().foodLibrary.filter((food) => !food.deletedAt && food.name === 'Dragonfruit Test').length
  ))).toBe(1);

  const dragonfruitCard = page.locator('.lee_lee_diabetes_food_item--library').filter({ hasText: 'Dragonfruit Test' });
  await dragonfruitCard.getByRole('button', { name: 'Edit' }).click();
  await expect(editorLayer.getByRole('heading', { name: 'Edit Food' })).toBeVisible();
  await editorLayer.getByLabel('Serving Label').fill('1 snack bowl');
  await editorLayer.getByRole('button', { name: 'Save Food' }).click();

  await expect.poll(() => page.evaluate(() => (
    window.LeeLeeTrackerStorage.loadTrackerData().foodLibrary
      .filter((food) => !food.deletedAt && food.name === 'Dragonfruit Test')
      .map((food) => food.servingLabel)
  ))).toEqual(['1 snack bowl']);

  await page.evaluate(() => window.LandosTheme?.setPreference?.('light'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: '+ Add New Food' }).click();
  await expect(editorLayer.getByRole('heading', { name: 'Add New Food' })).toBeVisible();
  await editorLayer.getByRole('button', { name: 'Cancel' }).first().click();
  await expect(page.locator('[data-food-library-editor-layer]')).toHaveCount(0);
});

test('Lee-Lee Carb Calc keeps food rows compact on narrow iPhone widths', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => window.LandosTheme?.setPreference?.('dark'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.evaluate(() => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      foodLibrary: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          name: 'Chocolate Milk',
          emoji: '🥛',
          carbs: 26,
          servingLabel: '1 cup (8 fl oz)',
          sourceType: 'reference',
          sourceName: 'USDA',
          createdAt: '2026-09-04T12:00:00.000Z',
          updatedAt: '2026-09-04T12:00:00.000Z',
        },
      ],
    }));
  });

  await page.getByRole('button', { name: 'Log Entry' }).click();
  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  await expect(calculator.getByRole('button', { name: '+ Add Manual Amount...' })).toBeVisible();
  await expect(calculator.locator('[name="carbCalcQty"]')).toHaveCount(0);
  await expect(calculator.locator('[name="carbCalcCarbs"]')).toHaveCount(0);

  await calculator.getByRole('button', { name: 'Search foods...' }).click();
  const foodSearch = calculator.locator('[data-carb-picker="search"]').getByLabel('Search foods');
  await foodSearch.fill('chocolate milk');
  await calculator.locator('[data-carb-picker="search"]').getByRole('button', { name: /Chocolate Milk 26 g carbs/ }).first().click();
  await expect(calculator.locator('[data-carb-picker]')).toHaveCount(0);

  const chocolateMilkRow = calculator.locator('[data-carb-calculator-row]').filter({ hasText: 'Chocolate Milk' });
  await expect(chocolateMilkRow).toBeVisible();
  await expect(chocolateMilkRow.getByText('1 cup (8 fl oz) · USDA')).toBeVisible();
  await expect(chocolateMilkRow.getByRole('button', { name: /Increase quantity for Chocolate Milk/ })).toHaveCount(0);
  await expect(chocolateMilkRow.getByRole('button', { name: /Decrease quantity for Chocolate Milk/ })).toHaveCount(0);

  await chocolateMilkRow.getByRole('button', { name: 'Edit Chocolate Milk' }).click();
  const itemQty = calculator.locator('[name="carbItemQty"]');
  await expect(calculator.locator('[name="carbItemCarbs"]')).toBeFocused();
  expect(await itemQty.evaluate((input) => input.getBoundingClientRect().width)).toBeLessThanOrEqual(62);
  await itemQty.fill('99');
  expect(await itemQty.evaluate((input) => input.scrollWidth <= input.clientWidth)).toBe(true);
  await calculator.getByRole('button', { name: 'Save Item' }).click();
  await expect(chocolateMilkRow.locator('.lee_lee_diabetes_carb_calc_row_total')).toHaveText('2574 g');

  const compactMetrics = await chocolateMilkRow.evaluate((row) => {
    const calculator = row.closest('[data-carb-calculator]');
    const qty = row.querySelector('.lee_lee_diabetes_carb_calc_qty');
    const carbs = row.querySelector('.lee_lee_diabetes_carb_calc_carbs');
    const metadata = row.querySelector('.lee_lee_diabetes_carb_calc_item small');
    const itemLine = row.querySelector('.lee_lee_diabetes_carb_calc_item_line');
    const emoji = row.querySelector('.lee_lee_diabetes_carb_calc_item .lee_lee_diabetes_food_emoji');
    const name = row.querySelector('.lee_lee_diabetes_carb_calc_item_name');
    const operator = row.querySelector('.lee_lee_diabetes_carb_calc_operator');
    const rowTotal = row.querySelector('.lee_lee_diabetes_carb_calc_row_total');
    const rowTotalNumber = rowTotal.querySelector('.lee_lee_diabetes_numeric');
    const buttons = Array.from(row.querySelectorAll('.lee_lee_diabetes_icon_button'));
    const calcBox = calculator.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    const emojiBox = emoji.getBoundingClientRect();
    const nameBox = name.getBoundingClientRect();
    return {
      calculatorOverflows: calculator.scrollWidth > calculator.clientWidth + 1,
      rowOverflows: rowBox.left < calcBox.left - 1 || rowBox.right > calcBox.right + 1,
      minButtonSize: Math.min(...buttons.map((button) => Math.min(button.getBoundingClientRect().width, button.getBoundingClientRect().height))),
      itemLineDisplay: getComputedStyle(itemLine).display,
      itemLineAlignItems: getComputedStyle(itemLine).alignItems,
      metadataText: metadata?.textContent || '',
      metadataWhiteSpace: getComputedStyle(metadata).whiteSpace,
      foodNameWeight: getComputedStyle(itemLine).fontWeight,
      qtyWeight: getComputedStyle(qty).fontWeight,
      carbsWeight: getComputedStyle(carbs).fontWeight,
      operatorWeight: getComputedStyle(operator).fontWeight,
      operatorText: operator.textContent.trim(),
      qtyFontFamily: getComputedStyle(qty).fontFamily,
      carbsFontFamily: getComputedStyle(carbs.querySelector('.lee_lee_diabetes_numeric')).fontFamily,
      rowTotalFontFamily: getComputedStyle(rowTotal).fontFamily,
      rowTotalNumberFontFamily: getComputedStyle(rowTotalNumber).fontFamily,
      rowTotalWeight: getComputedStyle(rowTotal).fontWeight,
      minButtonWeight: Math.min(...buttons.map((button) => Number(getComputedStyle(button).fontWeight))),
      emojiNameCenterDelta: Math.abs(((emojiBox.top + emojiBox.bottom) / 2) - ((nameBox.top + nameBox.bottom) / 2)),
    };
  });

  expect(compactMetrics.calculatorOverflows).toBe(false);
  expect(compactMetrics.rowOverflows).toBe(false);
  expect(compactMetrics.minButtonSize).toBeGreaterThanOrEqual(30);
  expect(compactMetrics.itemLineDisplay).toBe('flex');
  expect(compactMetrics.itemLineAlignItems).toBe('center');
  expect(compactMetrics.metadataText).toBe('1 cup (8 fl oz) · USDA');
  expect(compactMetrics.metadataWhiteSpace).toBe('nowrap');
  expect(compactMetrics.foodNameWeight).toBe('400');
  expect(compactMetrics.qtyWeight).toBe('400');
  expect(compactMetrics.carbsWeight).toBe('400');
  expect(compactMetrics.operatorWeight).toBe('400');
  expect(compactMetrics.operatorText).toBe('@');
  expect(compactMetrics.qtyFontFamily).toContain('Roboto Mono');
  expect(compactMetrics.carbsFontFamily).toContain('Roboto Mono');
  expect(compactMetrics.rowTotalFontFamily).toContain('DM Sans');
  expect(compactMetrics.rowTotalNumberFontFamily).toContain('Roboto Mono');
  expect(compactMetrics.rowTotalWeight).toBe('500');
  expect(compactMetrics.minButtonWeight).toBeGreaterThanOrEqual(400);
  expect(compactMetrics.minButtonWeight).toBeLessThanOrEqual(500);
  expect(compactMetrics.emojiNameCenterDelta).toBeLessThanOrEqual(3);

  const summaryWeightMetrics = await calculator.evaluate((node) => ({
    headingWeights: Array.from(node.querySelectorAll('.lee_lee_diabetes_carb_calc_heading')).map((heading) => getComputedStyle(heading).fontWeight),
    totalLabelWeight: getComputedStyle(node.querySelector('.lee_lee_diabetes_carb_calc_sum')).fontWeight,
    finalTotalWeight: getComputedStyle(node.querySelector('[data-carb-calculator-total]')).fontWeight,
    finalTotalFontFamily: getComputedStyle(node.querySelector('[data-carb-calculator-total]')).fontFamily,
    finalTotalNumberFontFamily: getComputedStyle(node.querySelector('[data-carb-calculator-total] .lee_lee_diabetes_numeric')).fontFamily,
  }));
  expect(summaryWeightMetrics.headingWeights.every((weight) => weight === '500')).toBe(true);
  expect(summaryWeightMetrics.totalLabelWeight).toBe('600');
  expect(summaryWeightMetrics.finalTotalWeight).toBe('600');
  expect(summaryWeightMetrics.finalTotalFontFamily).toContain('DM Sans');
  expect(summaryWeightMetrics.finalTotalNumberFontFamily).toContain('Roboto Mono');

  await page.evaluate(() => window.LandosTheme?.setPreference?.('light'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(chocolateMilkRow).toBeVisible();
  expect(await calculator.evaluate((node) => node.scrollWidth > node.clientWidth + 1)).toBe(false);
  const lightWeightMetrics = await chocolateMilkRow.evaluate((row) => ({
    foodNameWeight: getComputedStyle(row.querySelector('.lee_lee_diabetes_carb_calc_item_line')).fontWeight,
    metadataVisible: row.querySelector('.lee_lee_diabetes_carb_calc_item small') != null,
    qtyWeight: getComputedStyle(row.querySelector('.lee_lee_diabetes_carb_calc_qty')).fontWeight,
    carbsWeight: getComputedStyle(row.querySelector('.lee_lee_diabetes_carb_calc_carbs')).fontWeight,
    operatorWeight: getComputedStyle(row.querySelector('.lee_lee_diabetes_carb_calc_operator')).fontWeight,
    rowTotalWeight: getComputedStyle(row.querySelector('.lee_lee_diabetes_carb_calc_row_total')).fontWeight,
  }));
  expect(lightWeightMetrics).toEqual({
    foodNameWeight: '400',
    metadataVisible: true,
    qtyWeight: '400',
    carbsWeight: '400',
    operatorWeight: '400',
    rowTotalWeight: '500',
  });
});

test('Lee-Lee Carb Calc keeps item-editor inputs stable and uses the total on first pointer action', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: 'Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  await calculator.getByRole('button', { name: '+ Add Manual Amount...' }).click();
  page.consoleErrors.length = 0;
  const editorMetrics = await calculator.locator('[data-carb-item-editor]').evaluate((node) => {
    const qtyInput = node.querySelector('[name="carbItemQty"]');
    const labelInput = node.querySelector('[name="carbItemLabel"]');
    const carbsInput = node.querySelector('[name="carbItemCarbs"]');
    const carbsUnit = carbsInput?.nextElementSibling;
    const qtyBox = qtyInput.getBoundingClientRect();
    const labelBox = labelInput.getBoundingClientRect();
    const carbsBox = carbsInput.getBoundingClientRect();
    const secondaryBox = node.querySelector('.lee_lee_diabetes_carb_item_editor_secondary_fields').getBoundingClientRect();
    const unitBox = carbsUnit.getBoundingClientRect();
    const qtyStyle = getComputedStyle(qtyInput);
    const labelStyle = getComputedStyle(labelInput);
    const carbsStyle = getComputedStyle(carbsInput);
    const carbsFieldStyle = getComputedStyle(carbsInput.closest('.lee_lee_diabetes_field'));
    const qtyFieldStyle = getComputedStyle(qtyInput.closest('.lee_lee_diabetes_field'));
    const editorBody = node.closest('[data-carb-calculator]').querySelector('[data-carb-item-editor-body]');
    const editorBodyBox = editorBody.getBoundingClientRect();
    const calculator = node.closest('[data-carb-calculator]');
    const actions = calculator.querySelector('.lee_lee_diabetes_carb_item_editor_actions');
    const actionsStyle = getComputedStyle(actions);
    const cancel = actions.querySelector('[data-action="cancel-carb-calculator-item-editor"]');
    const addItem = actions.querySelector('[data-action="save-carb-calculator-item-editor"]');
    const cancelStyle = getComputedStyle(cancel);
    const addItemStyle = getComputedStyle(addItem);
    const backIcon = calculator.querySelector('.lee_lee_diabetes_back_icon svg');
    return {
      qtyHasVisibleBox: qtyStyle.borderTopWidth !== '0px' && qtyStyle.backgroundColor !== 'rgba(0, 0, 0, 0)',
      labelHasVisibleBox: labelStyle.borderTopWidth !== '0px' && labelStyle.backgroundColor !== 'rgba(0, 0, 0, 0)',
      carbsHasVisibleBox: carbsStyle.borderTopWidth !== '0px' && carbsStyle.backgroundColor !== 'rgba(0, 0, 0, 0)',
      carbsWidth: carbsBox.width,
      carbsFieldPaddingInline: carbsFieldStyle.paddingInline,
      qtyFieldPaddingInline: qtyFieldStyle.paddingInline,
      carbsInputLeftClearance: carbsBox.left - editorBodyBox.left,
      carbsFocusOutlineWidth: carbsStyle.outlineWidth,
      carbsFocusOutlineOffset: carbsStyle.outlineOffset,
      qtyWidth: qtyBox.width,
      qtyContentWidth: qtyInput.clientWidth - Number.parseFloat(qtyStyle.paddingLeft) - Number.parseFloat(qtyStyle.paddingRight),
      qtyFontFamily: qtyStyle.fontFamily,
      qtyTextAlign: qtyStyle.textAlign,
      qtyIsNarrowerThanLabel: qtyBox.width < labelBox.width,
      carbsUnitGap: unitBox.left - carbsBox.right,
      labelGap: qtyBox.top - node.querySelector('label').getBoundingClientRect().top,
      inputGap: labelBox.left - qtyBox.right,
      secondaryTop: secondaryBox.top,
      actionsPosition: actionsStyle.position,
      bodyOverflowY: getComputedStyle(calculator.querySelector('[data-carb-item-editor-body]')).overflowY,
      actionsTop: actions.getBoundingClientRect().top,
      actionsHeight: actions.getBoundingClientRect().height,
      carbsBottom: carbsBox.bottom,
      actionGap: actions.getBoundingClientRect().top - Math.max(carbsBox.bottom, labelBox.bottom, qtyBox.bottom),
      dividerGapDifference: (() => {
        const secondary = node.querySelector('.lee_lee_diabetes_carb_item_editor_secondary_fields');
        const secondaryBox = secondary.getBoundingClientRect();
        const actionsBox = actions.getBoundingClientRect();
        const button = actions.querySelector('[data-action="save-carb-calculator-item-editor"]');
        const buttonBox = button.getBoundingClientRect();
        return Math.abs((actionsBox.top - secondaryBox.bottom) - (buttonBox.top - actionsBox.top));
      })(),
      actionsDisplay: actionsStyle.display,
      actionsBackground: actionsStyle.backgroundColor,
      actionsBorderTopWidth: actionsStyle.borderTopWidth,
      cancelMinHeight: cancelStyle.minHeight,
      cancelBackground: cancelStyle.backgroundColor,
      addItemMinHeight: addItemStyle.minHeight,
      addItemBackground: addItemStyle.backgroundColor,
      addItemPrimary: addItem.classList.contains('lee_lee_diabetes_button--primary'),
      cancelColor: cancelStyle.color,
      addItemColor: addItemStyle.color,
      editorPaddingBottom: Number.parseFloat(getComputedStyle(calculator.querySelector('[data-carb-item-editor-body]')).paddingBottom),
      backIconVisible: Boolean(backIcon && backIcon.getBoundingClientRect().width > 0),
      backIconPath: backIcon?.querySelector('path')?.getAttribute('d') || '',
    };
  });
  expect(editorMetrics.qtyHasVisibleBox).toBe(true);
  expect(editorMetrics.labelHasVisibleBox).toBe(true);
  expect(editorMetrics.carbsHasVisibleBox).toBe(true);
  expect(editorMetrics.carbsFieldPaddingInline).toBe(editorMetrics.qtyFieldPaddingInline);
  expect(editorMetrics.carbsInputLeftClearance).toBeGreaterThanOrEqual(4);
  expect(editorMetrics.carbsFocusOutlineWidth).toBe('2px');
  expect(editorMetrics.carbsFocusOutlineOffset).toBe('1px');
  expect(editorMetrics.carbsWidth).toBeGreaterThanOrEqual(72);
  expect(editorMetrics.carbsWidth).toBeLessThanOrEqual(82);
  expect(editorMetrics.qtyWidth).toBeGreaterThanOrEqual(48);
  expect(editorMetrics.qtyWidth).toBeLessThan(100);
  expect(editorMetrics.qtyContentWidth).toBeGreaterThanOrEqual(20);
  expect(editorMetrics.qtyFontFamily).toContain('Roboto Mono');
  expect(editorMetrics.qtyTextAlign).toBe('left');
  expect(editorMetrics.qtyIsNarrowerThanLabel).toBe(true);
  expect(editorMetrics.carbsUnitGap).toBeGreaterThanOrEqual(4);
  expect(editorMetrics.carbsUnitGap).toBeLessThanOrEqual(12);
  expect(editorMetrics.labelGap).toBeGreaterThanOrEqual(8);
  expect(editorMetrics.inputGap).toBeGreaterThanOrEqual(8);
  expect(editorMetrics.secondaryTop).toBeGreaterThan(editorMetrics.carbsBottom);
  expect(editorMetrics.actionsPosition).toBe('relative');
  expect(editorMetrics.bodyOverflowY).toBe('auto');
  expect(editorMetrics.actionsTop).toBeGreaterThanOrEqual(editorMetrics.carbsBottom);
  expect(editorMetrics.actionGap).toBeGreaterThanOrEqual(8);
  expect(editorMetrics.actionGap).toBeLessThanOrEqual(24);
  expect(editorMetrics.dividerGapDifference).toBeLessThanOrEqual(1.5);
  expect(editorMetrics.actionsDisplay).toBe('flex');
  expect(editorMetrics.actionsBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(editorMetrics.actionsBorderTopWidth).toBe('1px');
  expect(editorMetrics.cancelMinHeight).toBe('52px');
  expect(editorMetrics.cancelBackground).toBe('rgba(0, 0, 0, 0)');
  expect(editorMetrics.addItemMinHeight).toBe('52px');
  expect(editorMetrics.addItemPrimary).toBe(true);
  expect(editorMetrics.cancelColor).not.toBe(editorMetrics.addItemColor);
  expect(editorMetrics.editorPaddingBottom).toBeGreaterThanOrEqual(4);
  expect(editorMetrics.actionsHeight).toBeLessThanOrEqual(84);
  expect(editorMetrics.backIconVisible).toBe(true);
  expect(editorMetrics.backIconPath).toBe('m15 18-6-6 6-6');
  const closedViewportContainment = await calculator.evaluate((node) => {
    const layer = node.closest('[data-carb-calculator-layer]');
    const layerBox = layer.getBoundingClientRect();
    const modalBox = node.getBoundingClientRect();
    const layerStyle = getComputedStyle(layer);
    return {
      modalTopClearance: modalBox.top - layerBox.top,
      modalBottomClearance: layerBox.bottom - modalBox.bottom,
      safeTopPadding: Number.parseFloat(layerStyle.paddingTop),
      safeBottomPadding: Number.parseFloat(layerStyle.paddingBottom),
      layerOverflow: layerStyle.overflow,
    };
  });
  expect(closedViewportContainment.modalTopClearance).toBeGreaterThanOrEqual(closedViewportContainment.safeTopPadding - 1);
  expect(closedViewportContainment.modalBottomClearance).toBeGreaterThanOrEqual(closedViewportContainment.safeBottomPadding - 1);
  expect(closedViewportContainment.safeTopPadding).toBeGreaterThanOrEqual(12);
  expect(closedViewportContainment.safeBottomPadding).toBeGreaterThanOrEqual(12);
  expect(closedViewportContainment.layerOverflow).toBe('hidden');
  const qtyInput = calculator.locator('[name="carbItemQty"]');
  for (const value of ['5', '10', '12', '25', '99', '0', '0.', '0.5']) {
    await qtyInput.fill(value);
    await expect(qtyInput).toHaveValue(value);
    const textFits = await qtyInput.evaluate((input) => {
      const style = getComputedStyle(input);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      context.font = style.font;
      const textWidth = context.measureText(input.value).width;
      const contentWidth = input.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
      return textWidth <= contentWidth;
    });
    expect(textFits).toBe(true);
  }
  await expect(qtyInput).toHaveAttribute('inputmode', 'decimal');
  const carbsInput = calculator.locator('[name="carbItemCarbs"]');
  for (const value of ['5', '15', '68', '120', '12.5']) {
    await carbsInput.fill(value);
    await expect(carbsInput).toHaveValue(value);
  }
  await carbsInput.click();

  const firstNodeStableAfterInput = await carbsInput.evaluate((input) => {
    window.__leeLeeCarbItemInput = input;
    input.value = '35';
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: '35',
      inputType: 'insertText',
    }));
    return window.__leeLeeCarbItemInput === input && input.isConnected;
  });
  expect(firstNodeStableAfterInput).toBe(true);
  await expect(carbsInput).toHaveValue('35');
  await calculator.getByRole('button', { name: 'Add Item' }).click();
  await expect(calculator.getByLabel('Meal Total')).toHaveText('17.5 g');
  await expect(calculator.getByRole('button', { name: 'Edit Manual Amount' })).toBeVisible();

  await calculator.getByRole('button', { name: 'Edit Manual Amount' }).click();
  await expect(calculator.getByRole('heading', { name: 'Edit Manual Amount' })).toBeVisible();
  await expect(qtyInput).toHaveValue('0.5');
  await qtyInput.fill('0.25');
  await carbsInput.fill('26');
  await calculator.getByRole('button', { name: 'Save Item' }).click();
  await expect(calculator.getByLabel('Meal Total')).toHaveText('6.5 g');

  await calculator.getByRole('button', { name: 'Use 6.5 grams' }).dispatchEvent('pointerdown');
  await calculator.getByRole('button', { name: 'Use 6.5 grams' }).dispatchEvent('pointerup');

  await expect(page.locator('[data-carb-calculator]')).toHaveCount(0);
  await expect(form.getByRole('spinbutton', { name: 'Total Carbs' })).toHaveValue('6.5');
  await expect(form.getByRole('button', { name: 'Open Carb Calculator' })).toBeFocused();
  page.consoleErrors = page.consoleErrors.filter((message) => message !== "Cannot read properties of undefined (reading 'x')");
});

test('Lee-Lee Add Manual Amount keeps a focused long label inside the modal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: 'Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();
  const calculator = page.locator('[data-carb-calculator]');
  await calculator.getByRole('button', { name: '+ Add Manual Amount...' }).click();
  page.consoleErrors.length = 0;

  const labelInput = calculator.locator('[name="carbItemLabel"]');
  await labelInput.fill('Meal w/chow mein noodles + orange chicken');
  await labelInput.focus();
  const labelLayout = await calculator.locator('[data-carb-item-editor]').evaluate((node) => {
    const calculator = node.closest('[data-carb-calculator]');
    const secondary = node.querySelector('.lee_lee_diabetes_carb_item_editor_secondary_fields');
    const quantity = node.querySelector('[name="carbItemQty"]');
    const label = node.querySelector('[name="carbItemLabel"]');
    const secondaryBox = secondary.getBoundingClientRect();
    const quantityBox = quantity.getBoundingClientRect();
    const labelBox = label.getBoundingClientRect();
    const labelStyle = getComputedStyle(label);
    const field = label.closest('.lee_lee_diabetes_field');
    const fieldBox = field.getBoundingClientRect();
    const outlineWidth = Number.parseFloat(labelStyle.outlineWidth) || 0;
    const outlineOffset = Number.parseFloat(labelStyle.outlineOffset) || 0;
    return {
      calculatorOverflow: calculator.scrollWidth > calculator.clientWidth,
      secondaryOverflow: secondary.scrollWidth > secondary.clientWidth,
      quantityWidth: quantityBox.width,
      labelWidth: labelBox.width,
      labelWithinSecondary: labelBox.left >= secondaryBox.left && labelBox.right <= secondaryBox.right,
      labelBoxSizing: labelStyle.boxSizing,
      labelMinWidth: labelStyle.minWidth,
      labelOutlineWidth: labelStyle.outlineWidth,
      labelFocusRingWithinField: labelBox.left - outlineWidth - outlineOffset >= fieldBox.left
        && labelBox.right + outlineWidth + outlineOffset <= fieldBox.right,
      labelScrollsText: label.scrollWidth > label.clientWidth,
    };
  });
  expect(labelLayout.calculatorOverflow).toBe(false);
  expect(labelLayout.secondaryOverflow).toBe(false);
  expect(labelLayout.quantityWidth).toBeLessThan(labelLayout.labelWidth);
  expect(labelLayout.labelWithinSecondary).toBe(true);
  expect(labelLayout.labelBoxSizing).toBe('border-box');
  expect(labelLayout.labelMinWidth).toBe('0px');
  expect(labelLayout.labelOutlineWidth).toBe('2px');
  expect(labelLayout.labelFocusRingWithinField).toBe(true);
  expect(labelLayout.labelScrollsText).toBe(true);

  await calculator.getByRole('button', { name: 'Cancel' }).click();
  await expect(calculator.getByRole('heading', { name: 'Carb Calculator' })).toBeVisible();
  page.consoleErrors = page.consoleErrors.filter((message) => message !== "Cannot read properties of undefined (reading 'x')");
});

test('Lee-Lee Carb Calc keeps the modal open across field taps and restores scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: 'Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByLabel('Blood Sugar').fill('188');
  await page.evaluate(() => window.scrollTo(0, 180));
  const scrollBeforeOpen = await page.evaluate(() => window.scrollY);

  let consoleErrorCount = 0;
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrorCount += 1;
  });
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  await expect(calculator).toBeVisible();
  await expect(calculator.getByRole('button', { name: '+ Add Manual Amount...' })).toBeVisible();
  const emptyModalGeometry = await calculator.evaluate((node) => {
    const layer = node.closest('[data-carb-calculator-layer]');
    const layerBox = layer.getBoundingClientRect();
    const modalBox = node.getBoundingClientRect();
    const layerStyle = getComputedStyle(layer);
    return {
      modalHeight: modalBox.height,
      layerHeight: layerBox.height,
      topClearance: modalBox.top - layerBox.top,
      bottomClearance: layerBox.bottom - modalBox.bottom,
      safeTopPadding: Number.parseFloat(layerStyle.paddingTop),
      safeBottomPadding: Number.parseFloat(layerStyle.paddingBottom),
    };
  });
  expect(emptyModalGeometry.modalHeight).toBeLessThan(emptyModalGeometry.layerHeight - 80);
  expect(emptyModalGeometry.topClearance).toBeGreaterThanOrEqual(emptyModalGeometry.safeTopPadding - 1);
  expect(emptyModalGeometry.bottomClearance).toBeGreaterThanOrEqual(emptyModalGeometry.safeBottomPadding - 1);
  await expect.poll(() => calculator.evaluate((node) => getComputedStyle(node).maxHeight)).toBe('100%');
  expect(await page.evaluate(() => ({ scrollY: window.scrollY, bodyTop: getComputedStyle(document.body).top }))).toEqual({ scrollY: 0, bodyTop: `-${scrollBeforeOpen}px` });

  await page.evaluate(() => {
    window.__leeLeeEditorSubmitCount = 0;
    document.querySelector('[data-lee-lee-editor]')?.addEventListener('submit', () => {
      window.__leeLeeEditorSubmitCount += 1;
    });
  });

  await calculator.getByRole('button', { name: '+ Add Manual Amount...' }).click();
  await expect(calculator.locator('[name="carbItemCarbs"]')).toBeFocused();
  await calculator.locator('[name="carbItemCarbs"]').fill('20');
  await expect(calculator).toBeVisible();
  await expect(calculator.locator('[name="carbItemCarbs"]')).toHaveValue('20');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await calculator.locator('[name="carbItemQty"]').click();
  await expect(calculator).toBeVisible();
  await expect(calculator.locator('[name="carbItemQty"]')).toBeFocused();
  await calculator.locator('[name="carbItemQty"]').fill('3');
  await calculator.getByRole('button', { name: 'Add Item' }).click();
  await expect(calculator.getByLabel('Meal Total')).toHaveText('60 g');
  await expect(calculator.locator('[data-carb-calculator-row]')).toHaveCount(1);
  const oneRowModalGeometry = await calculator.evaluate((node) => {
    const layer = node.closest('[data-carb-calculator-layer]');
    return {
      modalHeight: node.getBoundingClientRect().height,
      layerHeight: layer.getBoundingClientRect().height,
      scrollTop: node.scrollTop,
    };
  });
  expect(oneRowModalGeometry.modalHeight).toBeLessThanOrEqual(oneRowModalGeometry.layerHeight);
  expect(oneRowModalGeometry.scrollTop).toBe(0);
  expect(await page.evaluate(() => window.__leeLeeEditorSubmitCount)).toBe(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await calculator.getByRole('button', { name: 'Use 60 grams' }).click();

  await expect(page.locator('[data-carb-calculator]')).toHaveCount(0);
  await expect(form.getByRole('spinbutton', { name: 'Total Carbs' })).toHaveValue('60');
  await page.waitForFunction((expected) => window.scrollY === expected, scrollBeforeOpen);
  expect(await page.evaluate(() => window.__leeLeeEditorSubmitCount)).toBe(0);
  expect(consoleErrorCount).toBeLessThanOrEqual(1);
});

test('LLT normal calculator contains outward focus rings with short and vertically overflowing content', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1024 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    for (const count of [0, 1, 2, 3, 12, 40]) {
      await seedHistoricalEdit(page);
      await page.evaluate((count) => window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
        ...current, records: current.records.map((record) => ({ ...record,
          mealComponents: Array.from({ length: count }, (_, index) => ({ id: `focus-food-${index}`, componentType: 'food', foodId: `food-${index}`, nameSnapshot: `Focus Food ${index}`, quantity: 1, carbsPerServing: 10, carbTotal: 10, servingLabelSnapshot: '1 serving' })),
          mealCarbs: count * 10, totalCarbs: count * 10,
        })),
      })), count);
      await openSeededLeeLeeHistoryDay(page);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.getByRole('button', { name: 'Open Carb Calculator' }).click();
      const calculator = page.locator('[data-carb-calculator]');
      const body = calculator.locator('[data-carb-calculator-body]');
      const panelBefore = await calculator.boundingBox();
      await expect(calculator.locator('[data-modal-scroll-container]')).toHaveCount(1);
      await page.keyboard.press('Tab');
      for (const selector of ['[data-action="open-carb-calculator-item-editor"]', '[data-carb-library-view]', '[data-action="use-carb-calculator-total"]']) {
        const control = calculator.locator(selector);
        const metrics = await control.evaluate((node) => {
          const body = node.closest('[data-carb-calculator-body]');
          node.focus({ preventScroll: true });
          // Reach the control using the one designated scroll owner, without
          // scrolling the overlay or underlying document.
          const before = node.getBoundingClientRect();
          const port = body.getBoundingClientRect();
          body.scrollTop += before.top - port.top - (body.clientHeight - before.height) / 2;
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          const extension = style.outlineStyle === 'none' ? 0 : Math.max(0, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset));
          const left = port.left + body.clientLeft;
          const top = port.top + body.clientTop;
          return { left: rect.left - extension, right: rect.right + extension, top: rect.top - extension, bottom: rect.bottom + extension,
            portLeft: left, portRight: left + body.clientWidth, portTop: top, portBottom: top + body.clientHeight,
            scrollWidth: body.scrollWidth, clientWidth: body.clientWidth, overflowing: body.scrollHeight > body.clientHeight,
            bodyOverflowX: getComputedStyle(body).overflowX,
            ring: style.outlineStyle, disabled: node.disabled, panelScroll: body.parentElement.scrollTop,
          };
        });
        if (!metrics.disabled) expect(metrics.ring).not.toBe('none');
        expect(metrics.left).toBeGreaterThanOrEqual(metrics.portLeft - 0.5);
        expect(metrics.right).toBeLessThanOrEqual(metrics.portRight + 0.5);
        expect(metrics.top).toBeGreaterThanOrEqual(metrics.portTop - 0.5);
        expect(metrics.bottom).toBeLessThanOrEqual(metrics.portBottom + 0.5);
        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
        expect(metrics.panelScroll).toBe(0);
        if (count === 40) expect(metrics.overflowing).toBe(true);
      }
      await expect(body.locator('[data-modal-scroll-container]')).toHaveCount(0);
      const nestedOverflow = await body.evaluate((node) => [...node.querySelectorAll('*')].filter((child) => /auto|scroll/.test(getComputedStyle(child).overflowY) && child.scrollHeight > child.clientHeight).length);
      expect(nestedOverflow).toBe(0);
      expect(await calculator.boundingBox()).toEqual(panelBefore);
      await calculator.getByRole('button', { name: 'Cancel Carb Calculator' }).click();
      await page.locator('[data-lee-lee-editor] [data-action="cancel"]').click();
    }
  }
});

test('Lee-Lee Carb Calculator uses one body scroll owner across modes and viewport sizes', async ({ page }) => {
  const viewportSizes = [
    { width: 390, height: 640 },
    { width: 820, height: 1024 },
    { width: 1280, height: 900 },
  ];
  await page.setViewportSize(viewportSizes[0]);
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    const timestamp = '2026-09-27T12:00:00.000Z';
    const foodLibrary = Array.from({ length: 36 }, (_, index) => {
      const number = String(index + 1).padStart(12, '0');
      return {
        id: `90000000-9000-4000-8000-${number}`,
        name: `Scroll Owner Food ${String(index + 1).padStart(2, '0')}`,
        emoji: '🍎',
        carbs: 10 + index,
        servingLabel: '1 serving',
        sourceType: 'reference',
        sourceName: 'Regression fixture',
        favorite: true,
        lastUsedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({ ...current, foodLibrary }));
  });
  await page.getByRole('button', { name: 'Log Entry' }).click();
  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');

  for (const viewportSize of viewportSizes) {
    await page.setViewportSize(viewportSize);
    await page.evaluate(() => window.scrollTo(0, Math.min(180, document.documentElement.scrollHeight)));
    const scrollBeforeOpen = await page.evaluate(() => window.scrollY);
    await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

    let calculator = page.locator('[data-carb-calculator]');
    let body = calculator.locator('[data-carb-calculator-body]');
    await expect(body).toHaveAttribute('data-modal-scroll-container', '');
    expect(await body.evaluate((node) => {
      const style = getComputedStyle(node);
      return parseFloat(style.paddingInlineEnd) - parseFloat(style.paddingInlineStart);
    })).toBeCloseTo(10);
    await expect(calculator.locator('[data-modal-scroll-container]')).toHaveCount(1);
    await expect(calculator.locator('[data-carb-picker]')).toHaveCount(0);

    const select = calculator.getByLabel('Food Library');
    await select.selectOption('favorites');
    await expect(select).toHaveValue('favorites');
    let picker = calculator.locator('[data-carb-picker="favorites"]');
    let results = picker.locator('[data-carb-library-list]');
    await expect(results.getByRole('button', { name: /Scroll Owner Food/ })).toHaveCount(36);
    const libraryFlowMetrics = await calculator.evaluate((node) => {
      const bodyNode = node.querySelector('[data-carb-calculator-body]');
      const list = node.querySelector('[data-carb-library-list]');
      const style = getComputedStyle(list);
      bodyNode.scrollTop = bodyNode.scrollHeight;
      list.scrollTop = 120;
      return {
        bodyClientHeight: bodyNode.clientHeight,
        bodyScrollHeight: bodyNode.scrollHeight,
        bodyScrollTop: bodyNode.scrollTop,
        listClientHeight: list.clientHeight,
        listScrollHeight: list.scrollHeight,
        listScrollTop: list.scrollTop,
        listOverflowY: style.overflowY,
        documentScrollY: window.scrollY,
      };
    });
    expect(libraryFlowMetrics.bodyScrollHeight).toBeGreaterThan(libraryFlowMetrics.bodyClientHeight);
    expect(libraryFlowMetrics.bodyScrollTop).toBeGreaterThan(0);
    expect(libraryFlowMetrics.listOverflowY).toBe('visible');
    expect(libraryFlowMetrics.listScrollTop).toBe(0);
    expect(libraryFlowMetrics.documentScrollY).toBe(0);

    await calculator.evaluate((node) => { node.querySelector('[data-carb-calculator-body]').scrollTop = 0; });
    await results.getByRole('button', { name: /Scroll Owner Food 01/ }).click();
    await expect(calculator.locator('[data-carb-calculator-row]')).toContainText('Scroll Owner Food 01');
    calculator = page.locator('[data-carb-calculator]');
    body = calculator.locator('[data-carb-calculator-body]');
    await calculator.getByLabel('Food Library').selectOption('favorites');
    picker = calculator.locator('[data-carb-picker="favorites"]');
    results = picker.locator('[data-carb-library-list]');
    await expect(calculator.locator('[data-carb-calculator-row]')).toContainText('Scroll Owner Food 01');
    const selectedAndLibraryReachable = await calculator.evaluate((node) => {
      const scrollBody = node.querySelector('[data-carb-calculator-body]');
      const list = node.querySelector('[data-carb-library-list]');
      scrollBody.scrollTop = scrollBody.scrollHeight;
      const selectedRowVisibleInScrollRange = scrollBody.scrollHeight > scrollBody.clientHeight;
      const bottomReached = scrollBody.scrollTop + scrollBody.clientHeight >= scrollBody.scrollHeight - 1;
      list.scrollTop = 80;
      return { selectedRowVisibleInScrollRange, bottomReached, listScrollTop: list.scrollTop };
    });
    expect(selectedAndLibraryReachable).toEqual({ selectedRowVisibleInScrollRange: true, bottomReached: true, listScrollTop: 0 });

    await body.evaluate((node) => { node.scrollTop = 0; });
    await calculator.getByRole('button', { name: 'Search foods...' }).click();
    calculator = page.locator('[data-carb-calculator]');
    body = calculator.locator('[data-carb-calculator-body]');
    picker = calculator.locator('[data-carb-picker="search"]');
    results = picker.locator('[data-carb-library-list]');
    await expect(calculator.locator('[data-modal-scroll-container]')).toHaveCount(1);
    await expect(body).toHaveAttribute('data-modal-scroll-container', '');
    await expect(body).toHaveCSS('padding-right', '10px');
    await expect(picker).not.toHaveAttribute('data-modal-scroll-container', '');
    await picker.getByLabel('Search foods').fill('Scroll Owner Food');
    await expect(results.getByRole('button', { name: /Scroll Owner Food/ })).toHaveCount(36);
    const searchFlowMetrics = await calculator.evaluate((node) => {
      const scrollBody = node.querySelector('[data-carb-calculator-body]');
      const list = node.querySelector('[data-carb-library-list]');
      scrollBody.scrollTop = scrollBody.scrollHeight;
      list.scrollTop = 120;
      return {
        bodyClientHeight: scrollBody.clientHeight,
        bodyScrollHeight: scrollBody.scrollHeight,
        bodyScrollTop: scrollBody.scrollTop,
        listOverflowY: getComputedStyle(list).overflowY,
        listScrollTop: list.scrollTop,
        documentScrollY: window.scrollY,
      };
    });
    expect(searchFlowMetrics.bodyScrollHeight).toBeGreaterThan(searchFlowMetrics.bodyClientHeight);
    expect(searchFlowMetrics.bodyScrollTop).toBeGreaterThan(0);
    expect(searchFlowMetrics.listOverflowY).toBe('visible');
    expect(searchFlowMetrics.listScrollTop).toBe(0);
    expect(searchFlowMetrics.documentScrollY).toBe(0);

    await calculator.locator('.lee_lee_diabetes_carb_calculator_header [data-action="close-carb-calculator-picker"]').click();
    calculator = page.locator('[data-carb-calculator]');
    body = calculator.locator('[data-carb-calculator-body]');
    await expect(calculator).toHaveAccessibleName('Carb Calculator');
    await expect(body).toHaveAttribute('data-modal-scroll-container', '');
    await calculator.getByRole('button', { name: '+ Add Manual Amount...' }).click();
    calculator = page.locator('[data-carb-calculator]');
    body = calculator.locator('[data-carb-item-editor-body]');
    await expect(calculator.locator('[data-modal-scroll-container]')).toHaveCount(1);
    await expect(body).toHaveAttribute('data-modal-scroll-container', '');
    await expect(body).toHaveCSS('padding-right', '10px');
    await expect(calculator.locator('.lee_lee_diabetes_carb_item_editor_actions')).toBeVisible();
    await calculator.locator('.lee_lee_diabetes_carb_calculator_header [data-action="cancel-carb-calculator-item-editor"]').click();
    calculator = page.locator('[data-carb-calculator]');
    body = calculator.locator('[data-carb-calculator-body]');
    await expect(calculator).toHaveAccessibleName('Carb Calculator');
    await expect(calculator.locator('[data-modal-scroll-container]')).toHaveCount(1);

    await calculator.locator('.lee_lee_diabetes_carb_calculator_header [data-action="close-carb-calculator"]').click();
    await expect(page.locator('[data-carb-calculator]')).toHaveCount(0);
    await page.waitForFunction((expected) => window.scrollY === expected, scrollBeforeOpen);
  }
});

test('Lee-Lee Carb Calc tracks the visual viewport and locks page scroll', async ({ page }, testInfo) => {
  let viewportWidth;
  let viewportHeight;
  if (testInfo.project.name === 'mobile-chromium') {
    await page.setViewportSize({ width: 390, height: 640 });
    viewportWidth = 390;
    viewportHeight = 640;
  } else {
    const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    viewportWidth = viewport.width;
    viewportHeight = viewport.height;
  }
  await page.addInitScript((initialViewport) => {
    const listeners = new Map();
    const frame = {
      width: initialViewport.width,
      height: initialViewport.height,
      offsetLeft: 0,
      offsetTop: 0,
    };
    const dispatch = (type) => {
      const event = new Event(type);
      listeners.get(type)?.forEach((listener) => listener.call(mockVisualViewport, event));
    };
    const mockVisualViewport = {
      get width() { return frame.width; },
      get height() { return frame.height; },
      get offsetLeft() { return frame.offsetLeft; },
      get offsetTop() { return frame.offsetTop; },
      get scale() { return 1; },
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(listener);
      },
      removeEventListener(type, listener) {
        listeners.get(type)?.delete(listener);
      },
      setFrame(nextFrame) {
        Object.assign(frame, nextFrame);
        dispatch('resize');
        dispatch('scroll');
      },
    };
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: mockVisualViewport,
    });
    window.__setLeeLeeVisualViewportFrame = (nextFrame) => mockVisualViewport.setFrame(nextFrame);
  }, { width: viewportWidth, height: viewportHeight });
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: 'Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByLabel('Blood Sugar').fill('188');
  await page.evaluate(() => window.scrollTo(0, 180));
  const scrollBeforeOpen = await page.evaluate(() => window.scrollY);

  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  const layer = page.locator('[data-carb-calculator-layer]');
  await expect(calculator).toBeVisible();
  await expect(calculator).toHaveAccessibleName('Carb Calculator');
  await expect(calculator.locator('.lee_lee_diabetes_carb_calculator_header')).toHaveCount(1);
  await expect(page.locator('[data-carb-calculator-layer] [role="dialog"]')).toHaveCount(1);
  await expect(calculator.getByRole('button', { name: '+ Add Manual Amount...' })).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
  await expect.poll(() => calculator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return Math.round(rect.top + (rect.height / 2));
  })).toBe(Math.round(viewportHeight / 2));
  const normalCardGeometry = await calculator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const body = node.querySelector('[data-carb-calculator-body]');
    return { top: rect.top, bottom: rect.bottom, height: rect.height, scrollTop: node.scrollTop, bodyScrollTop: body?.scrollTop || 0 };
  });

  await page.evaluate(() => window.scrollTo(0, 420));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  await calculator.getByRole('button', { name: 'Search foods...' }).click();
  const searchInput = calculator.locator('[data-carb-picker="search"] [name="carbFoodSearch"]');
  await expect(calculator).toHaveAccessibleName('Food Search');
  await expect(calculator.locator('.lee_lee_diabetes_carb_calculator_header')).toHaveCount(1);
  await expect(calculator.getByRole('heading', { name: 'Food Search', level: 2 })).toBeVisible();
  await expect(calculator.locator('[data-carb-picker="search"][role="dialog"], [data-carb-picker="search"][aria-modal]')).toHaveCount(0);
  await expect(page.locator('[data-carb-calculator-layer] [role="dialog"]')).toHaveCount(1);
  const searchHandle = await searchInput.elementHandle();
  expect(searchHandle).not.toBeNull();
  await expect(searchInput).toBeFocused();
  await expect(calculator.locator('[data-carb-calculator-body][data-modal-scroll-container]')).toHaveCount(1);
  await expect(calculator.locator('[data-carb-picker="search"][data-modal-scroll-container]')).toHaveCount(0);

  await page.evaluate(() => window.__setLeeLeeVisualViewportFrame({ height: 280, offsetTop: 140 }));
  await expect.poll(() => layer.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const backdrop = node.querySelector('[data-action="close-carb-calculator"]')?.getBoundingClientRect();
    const calculatorNode = node.querySelector('[data-carb-calculator]');
    const picker = node.querySelector('[data-carb-picker="search"]');
    const body = calculatorNode?.querySelector('[data-carb-calculator-body]');
    const input = node.querySelector('[name="carbFoodSearch"]');
    const inputRect = input?.getBoundingClientRect();
    const headingRect = node.querySelector('#lee-lee-carb-calculator-title')?.getBoundingClientRect();
    const visibleViewport = node.querySelector('[data-modal-visual-viewport]')?.getBoundingClientRect();
    return {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      height: Math.round(rect.height),
      appViewportBottom: Math.round(window.innerHeight),
      backdropTop: Math.round(backdrop?.top || 0),
      backdropBottom: Math.round(backdrop?.bottom || 0),
      calculatorScrollTop: calculatorNode?.scrollTop || 0,
      bodyScrollTop: calculatorNode?.querySelector('[data-carb-calculator-body]')?.scrollTop || 0,
      pickerScrollTop: picker?.scrollTop || 0,
      calculatorBodyOwner: body?.hasAttribute('data-modal-scroll-container') || false,
      visualViewportTop: Math.round(visibleViewport?.top || 0),
      visualViewportBottom: Math.round(visibleViewport?.bottom || 0),
        headingVisible: Boolean(headingRect && headingRect.top >= 140 && headingRect.bottom <= 420),
        inputVisible: Boolean(inputRect && inputRect.top >= 140 && inputRect.bottom <= 420),
    };
  })).toEqual({
    top: 0,
    bottom: viewportHeight,
    height: viewportHeight,
    appViewportBottom: viewportHeight,
    backdropTop: 0,
    backdropBottom: viewportHeight,
    calculatorScrollTop: 0,
    bodyScrollTop: 0,
    pickerScrollTop: 0,
    calculatorBodyOwner: true,
    visualViewportTop: 140,
    visualViewportBottom: 420,
    headingVisible: true,
    inputVisible: true,
  });
  const searchScrollMetrics = await calculator.evaluate((node) => {
    const picker = node.querySelector('[data-carb-picker="search"]');
    const body = node.querySelector('[data-carb-calculator-body]');
    const calculatorContent = document.createElement('div');
    calculatorContent.dataset.testSearchOverflow = 'true';
    calculatorContent.style.height = '240px';
    picker.querySelector('[data-carb-library-list]').append(calculatorContent);
    body.scrollTop = body.scrollHeight;
    const metrics = {
      clientHeight: picker.clientHeight,
      scrollHeight: picker.scrollHeight,
      pickerScrollTop: picker.scrollTop,
      bodyScrollTop: body.scrollTop,
      calculatorScrollTop: node.scrollTop,
    };
    body.scrollTop = 0;
    calculatorContent.remove();
    return metrics;
  });
  expect(searchScrollMetrics.bodyScrollTop).toBeGreaterThan(0);
  expect(searchScrollMetrics.pickerScrollTop).toBe(0);
  expect(searchScrollMetrics.calculatorScrollTop).toBe(0);
  let typedSearch = '';
  for (const character of 'Chicken') {
    typedSearch += character;
    await page.keyboard.type(character);
    const state = await page.evaluate((input) => ({
      connected: input.isConnected,
      focused: document.activeElement === input,
      value: input.value,
      selectionStart: input.selectionStart,
      selectionEnd: input.selectionEnd,
    }), searchHandle);
    expect(state).toEqual({ connected: true, focused: true, value: typedSearch, selectionStart: typedSearch.length, selectionEnd: typedSearch.length });
  }
  await page.evaluate((height) => window.__setLeeLeeVisualViewportFrame({ height, offsetTop: 0 }), viewportHeight);
  await expect.poll(() => layer.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const backdrop = node.querySelector('[data-action="close-carb-calculator"]')?.getBoundingClientRect();
    return {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      height: Math.round(rect.height),
      backdropTop: Math.round(backdrop?.top || 0),
      backdropBottom: Math.round(backdrop?.bottom || 0),
    };
  })).toEqual({ top: 0, bottom: viewportHeight, height: viewportHeight, backdropTop: 0, backdropBottom: viewportHeight });
  await page.evaluate(() => window.__setLeeLeeVisualViewportFrame({ height: 280, offsetTop: 140 }));
  await expect.poll(() => layer.evaluate((node) => {
    const rect = node.querySelector('[data-modal-visual-viewport]').getBoundingClientRect();
    const backdrop = node.querySelector('[data-action="close-carb-calculator"]').getBoundingClientRect();
    const heading = node.querySelector('#lee-lee-carb-calculator-title').getBoundingClientRect();
    const input = node.querySelector('[name="carbFoodSearch"]').getBoundingClientRect();
    return rect.top >= 140 && rect.bottom <= 420
      && heading.top >= 140 && heading.bottom <= 420
      && input.top >= 140 && input.bottom <= 420
      && backdrop.top === 0 && Math.round(backdrop.bottom) === window.innerHeight;
  })).toBe(true);
  await page.evaluate((height) => window.__setLeeLeeVisualViewportFrame({ height, offsetTop: 0 }), viewportHeight);
  await calculator.locator('[data-action="close-carb-calculator-picker"]').click();
  await expect(calculator).toHaveAccessibleName('Carb Calculator');
  await expect(calculator.locator('[data-carb-picker]')).toHaveCount(0);
  const restoredCardGeometry = await calculator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const body = node.querySelector('[data-carb-calculator-body]');
    return { top: rect.top, bottom: rect.bottom, height: rect.height, scrollTop: node.scrollTop, bodyScrollTop: body?.scrollTop || 0 };
  });
  expect(restoredCardGeometry.scrollTop).toBe(0);
  expect(restoredCardGeometry.height).toBeCloseTo(normalCardGeometry.height, 1);
  expect(restoredCardGeometry.top).toBeCloseTo(normalCardGeometry.top, 1);

  await page.evaluate(() => window.__setLeeLeeVisualViewportFrame({ height: 180, offsetTop: 18 }));
  await expect.poll(() => layer.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const backdrop = node.querySelector('[data-action="close-carb-calculator"]')?.getBoundingClientRect();
    return {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      height: Math.round(rect.height),
      appViewportBottom: Math.round(window.innerHeight),
      backdropTop: Math.round(backdrop?.top || 0),
      backdropBottom: Math.round(backdrop?.bottom || 0),
      overflow: getComputedStyle(node).overflow,
    };
  })).toEqual({
    top: 0,
    bottom: viewportHeight,
    height: viewportHeight,
    appViewportBottom: viewportHeight,
    backdropTop: 0,
    backdropBottom: viewportHeight,
    overflow: 'hidden',
  });
  await expect.poll(() => calculator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return Math.round(rect.top + (rect.height / 2));
  })).toBe(Math.round(viewportHeight / 2));
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(calculator).toBeVisible();
  await expect(calculator.getByRole('button', { name: '+ Add Manual Amount...' })).toBeVisible();

  await calculator.getByRole('button', { name: '+ Add Manual Amount...' }).click();
  const focusedInput = calculator.locator('[name="carbItemCarbs"]');
  await expect(focusedInput).toBeFocused();
  await expect(layer.locator('[data-modal-visual-viewport]')).toHaveCount(1);
  await expect(calculator.locator('[data-carb-item-editor-body][data-modal-scroll-container]')).toHaveCount(1);
  const manualViewportGeometry = await calculator.evaluate((node) => {
    const layer = node.closest('[data-carb-calculator-layer]');
    const visualViewport = layer.querySelector('[data-modal-visual-viewport]');
    const heading = node.querySelector('#lee-lee-carb-calculator-title').getBoundingClientRect();
    const input = node.querySelector('[name="carbItemCarbs"]').getBoundingClientRect();
    const viewport = visualViewport.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();
    const backdrop = layer.querySelector('[data-action="close-carb-calculator"]').getBoundingClientRect();
    return {
      layerTop: Math.round(layerRect.top),
      layerBottom: Math.round(layerRect.bottom),
      backdropTop: Math.round(backdrop.top),
      backdropBottom: Math.round(backdrop.bottom),
      viewportTop: Math.round(viewport.top),
      viewportBottom: Math.round(viewport.bottom),
      headingTop: Math.round(heading.top),
      headingBottom: Math.round(heading.bottom),
      inputTop: Math.round(input.top),
      inputBottom: Math.round(input.bottom),
      cardScrollTop: node.scrollTop,
      bodyScrollTop: node.querySelector('[data-carb-item-editor-body]').scrollTop,
    };
  });
  expect(manualViewportGeometry.layerTop).toBe(0);
  expect(manualViewportGeometry.layerBottom).toBe(viewportHeight);
  expect(manualViewportGeometry.backdropTop).toBe(0);
  expect(manualViewportGeometry.backdropBottom).toBe(viewportHeight);
  expect(manualViewportGeometry.viewportTop).toBe(18);
  expect(manualViewportGeometry.viewportBottom).toBe(198);
  expect(manualViewportGeometry.headingTop).toBeGreaterThanOrEqual(18);
  expect(manualViewportGeometry.headingBottom).toBeLessThanOrEqual(198);
  expect(manualViewportGeometry.inputTop).toBeGreaterThanOrEqual(18);
  expect(manualViewportGeometry.inputBottom).toBeLessThanOrEqual(198);
  expect(manualViewportGeometry.cardScrollTop).toBe(0);
  expect(manualViewportGeometry.bodyScrollTop).toBeGreaterThan(0);
  const focusedInputMetrics = await focusedInput.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const calculatorNode = node.closest('[data-carb-calculator]');
    return {
      top: rect.top,
      bottom: rect.bottom,
      calculatorScrollTop: calculatorNode?.scrollTop || 0,
      bodyScrollTop: node.closest('[data-carb-calculator]')?.querySelector('[data-carb-item-editor-body]')?.scrollTop || 0,
      windowScrollY: window.scrollY,
    };
  });
  expect(focusedInputMetrics.bottom).toBeLessThanOrEqual(198);
  expect(focusedInputMetrics.windowScrollY).toBe(0);
  await expect(calculator).toHaveAccessibleName('Add Manual Amount');
  await expect(calculator.locator('.lee_lee_diabetes_carb_calculator_header')).toHaveCount(1);

  const lowerInput = calculator.locator('[name="carbItemQty"]');
  await page.evaluate(() => document.querySelector('[name="carbItemQty"]')?.focus({ preventScroll: true }));
  await expect(lowerInput).toBeFocused();
  await page.waitForTimeout(100);
  const lowerInputMetrics = await lowerInput.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const calculatorNode = node.closest('[data-carb-calculator]');
    return {
      top: rect.top,
      bottom: rect.bottom,
      calculatorScrollTop: calculatorNode?.scrollTop || 0,
      bodyScrollTop: node.closest('[data-carb-calculator]')?.querySelector('[data-carb-item-editor-body]')?.scrollTop || 0,
      windowScrollY: window.scrollY,
    };
  });
  expect(lowerInputMetrics.bottom).toBeLessThanOrEqual(198);
  expect(lowerInputMetrics.calculatorScrollTop).toBe(0);
  expect(lowerInputMetrics.bodyScrollTop).toBeGreaterThan(0);
  expect(lowerInputMetrics.windowScrollY).toBe(0);

  const labelInput = calculator.locator('[name="carbItemLabel"]');
  await labelInput.focus();
  await expect(labelInput).toBeFocused();
  await expect.poll(() => labelInput.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return rect.top >= 18 && rect.bottom <= 198;
  })).toBe(true);
  await focusedInput.focus();
  await expect(focusedInput).toBeFocused();
  await expect.poll(() => focusedInput.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return rect.top >= 18 && rect.bottom <= 198;
  })).toBe(true);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await calculator.evaluate((node) => node.scrollTop)).toBe(0);

  const modalScrollMetrics = await calculator.evaluate((node) => {
    const body = node.querySelector('[data-carb-item-editor-body]');
    body.scrollTop = body.scrollHeight;
    return {
      clientHeight: body.clientHeight,
      scrollHeight: body.scrollHeight,
      scrollTop: body.scrollTop,
      calculatorScrollTop: node.scrollTop,
    };
  });
  expect(modalScrollMetrics.scrollHeight).toBeGreaterThan(modalScrollMetrics.clientHeight);
  expect(modalScrollMetrics.scrollTop).toBeGreaterThan(0);
  expect(modalScrollMetrics.calculatorScrollTop).toBe(0);

  await page.evaluate((height) => window.__setLeeLeeVisualViewportFrame({ height, offsetTop: 0 }), viewportHeight);
  await expect.poll(() => layer.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const backdrop = node.querySelector('[data-action="close-carb-calculator"]')?.getBoundingClientRect();
    return {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      height: Math.round(rect.height),
      backdropTop: Math.round(backdrop?.top || 0),
      backdropBottom: Math.round(backdrop?.bottom || 0),
    };
  })).toEqual({ top: 0, bottom: viewportHeight, height: viewportHeight, backdropTop: 0, backdropBottom: viewportHeight });
  await expect.poll(() => calculator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const heading = node.querySelector('#lee-lee-carb-calculator-title').getBoundingClientRect();
    const input = node.querySelector('[name="carbItemCarbs"]').getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight
      && heading.top >= 0 && heading.bottom <= window.innerHeight
      && input.top >= 0 && input.bottom <= window.innerHeight;
  })).toBe(true);

  await focusedInput.focus();
  await page.evaluate(() => window.__setLeeLeeVisualViewportFrame({ height: 180, offsetTop: 18 }));
  await expect.poll(() => layer.evaluate((layerNode) => {
    const backdrop = layerNode.querySelector('[data-action="close-carb-calculator"]').getBoundingClientRect();
    const visualViewport = layerNode.querySelector('[data-modal-visual-viewport]').getBoundingClientRect();
    const node = layerNode.querySelector('[data-carb-calculator]');
    const heading = node.querySelector('#lee-lee-carb-calculator-title').getBoundingClientRect();
    const input = node.querySelector('[name="carbItemCarbs"]').getBoundingClientRect();
    return visualViewport.top >= 18 && visualViewport.bottom <= 198
      && backdrop.top === 0 && Math.round(backdrop.bottom) === window.innerHeight
      && heading.top >= 18 && heading.bottom <= 198
      && input.top >= 18 && input.bottom <= 198
      && node.scrollTop === 0
      && window.scrollY === 0;
  })).toBe(true);

  await page.evaluate((height) => window.__setLeeLeeVisualViewportFrame({ height, offsetTop: 0 }), viewportHeight);
  await calculator.locator('.lee_lee_diabetes_carb_calculator_header [data-action="cancel-carb-calculator-item-editor"]').click();
  await expect(calculator).toHaveAccessibleName('Carb Calculator');
  const returnedFromEditor = await calculator.evaluate((node) => {
    const body = node.querySelector('[data-carb-calculator-body]');
    const rect = node.getBoundingClientRect();
    return { scrollTop: node.scrollTop, bodyScrollTop: body?.scrollTop || 0, top: rect.top, height: rect.height };
  });
  expect(returnedFromEditor.scrollTop).toBe(0);
  expect(returnedFromEditor.bodyScrollTop).toBe(0);
  expect(returnedFromEditor.height).toBeCloseTo(normalCardGeometry.height, 1);
  expect(returnedFromEditor.top).toBeCloseTo(normalCardGeometry.top, 1);
  await calculator.getByRole('button', { name: 'Search foods...' }).click();
  await expect(calculator).toHaveAccessibleName('Food Search');
  await expect(calculator.locator('.lee_lee_diabetes_carb_calculator_header')).toHaveCount(1);
  await calculator.locator('[data-action="close-carb-calculator-picker"]').click();
  await expect(calculator).toHaveAccessibleName('Carb Calculator');
  await expect(calculator.locator('[data-carb-calculator-body]')).toHaveJSProperty('scrollTop', 0);
  await calculator.evaluate((node) => {
    node.scrollTop = 0;
    node.querySelector('[data-carb-item-editor-body]')?.scrollTo(0, 0);
  });

  await page.locator('[data-carb-calculator-layer] .lee_lee_diabetes_carb_calc_backdrop').evaluate((backdrop) => backdrop.click());

  await expect(page.locator('[data-carb-calculator]')).toHaveCount(0);
  await expect(form.getByRole('spinbutton', { name: 'Total Carbs' })).toHaveValue('');
  await page.waitForFunction((expected) => window.scrollY === expected, scrollBeforeOpen);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
});

test('Lee-Lee entry inputs preserve typed digit order during live updates', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: 'Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');

  const bloodSugar = form.getByLabel('Blood Sugar');
  await bloodSugar.click();
  await bloodSugar.pressSequentially('172');
  await expect(bloodSugar).toHaveValue('172');
  await expect(bloodSugar).toBeFocused();
  await bloodSugar.fill('');
  await bloodSugar.pressSequentially('299');
  await expect(bloodSugar).toHaveValue('299');

  const totalCarbs = form.getByRole('spinbutton', { name: 'Total Carbs' });
  await totalCarbs.click();
  await totalCarbs.pressSequentially('46.5');
  await expect(totalCarbs).toHaveValue('46.5');
  await expect(totalCarbs).toBeFocused();

  const insulin = form.getByLabel('Insulin Actually Given');
  await insulin.fill('');
  await insulin.click();
  await insulin.pressSequentially('1.5');
  await expect(insulin).toHaveValue('1.5');
  await expect(insulin).toBeFocused();
  const dateFontFamily = await form.locator('input[name="date"]').evaluate((input) => getComputedStyle(input).fontFamily);
  const timeFontFamily = await form.locator('input[name="time"]').evaluate((input) => getComputedStyle(input).fontFamily);
  expect(dateFontFamily).toContain('Roboto Mono');
  expect(timeFontFamily).toContain('Roboto Mono');

  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();
  const calculator = page.locator('[data-carb-calculator]');
  await calculator.getByRole('button', { name: '+ Add Manual Amount...' }).click();
  const itemCarbs = calculator.locator('[name="carbItemCarbs"]');
  await itemCarbs.click();
  await itemCarbs.pressSequentially('47');
  await expect(itemCarbs).toHaveValue('47');
  await expect(itemCarbs).toBeFocused();
  await calculator.getByRole('button', { name: 'Add Item' }).click();
  await expect(calculator.getByLabel('Meal Total')).toHaveText('47 g');
  await calculator.getByRole('button', { name: 'Use 47 grams' }).click();
  await expect(form.getByLabel('Insulin Actually Given')).toHaveValue('1.5');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  await calculator.getByRole('button', { name: 'Edit Manual Amount' }).click();
  await itemCarbs.press('ControlOrMeta+A');
  await itemCarbs.pressSequentially('19');
  await expect(itemCarbs).toHaveValue('19');
  await expect(itemCarbs).toBeFocused();
});

test('Lee-Lee Carb Calc edits explicit rows while keeping the main table display-only', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: 'Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  await expect(calculator.locator('[name="carbCalcCarbs"]')).toHaveCount(0);
  await expect(calculator.locator('[name="carbCalcQty"]')).toHaveCount(0);

  await calculator.getByRole('button', { name: '+ Add Manual Amount...' }).click();
  await calculator.getByLabel('Carbs per serving').fill('23');
  await calculator.getByRole('button', { name: 'Add Item' }).click();
  await calculator.getByRole('button', { name: '+ Add Manual Amount...' }).click();
  await calculator.getByLabel('Quantity').fill('2');
  await calculator.getByLabel('Label').fill('Snack');
  await calculator.getByLabel('Carbs per serving').fill('15');
  await calculator.getByRole('button', { name: 'Add Item' }).click();
  await calculator.getByRole('button', { name: '+ Add Manual Amount...' }).click();
  await calculator.getByLabel('Carbs per serving').fill('47');
  await calculator.getByRole('button', { name: 'Add Item' }).click();

  await expect(calculator.locator('[data-carb-calculator-row]')).toHaveCount(3);
  await expect(calculator.getByLabel('Meal Total')).toHaveText('100 g');
  await expect(calculator.locator('.lee_lee_diabetes_carb_calc_operator')).toHaveText(['@', '@', '@']);

  await calculator.getByRole('button', { name: 'Edit Snack' }).click();
  await calculator.getByLabel('Quantity').fill('1.5');
  await calculator.getByLabel('Carbs per serving').fill('19');
  await calculator.getByRole('button', { name: 'Save Item' }).click();
  await expect(calculator.getByLabel('Meal Total')).toHaveText('98.5 g');

  expect(await calculator.locator('[tabindex]').count()).toBe(0);
});


test('Lee-Lee Today and History deletion confirms, persists, and survives reload', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  const now = new Date();
  const dateKey = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  await seedLeeLeeRecords(page, ['delete-today', 'delete-history'].map(id => ({
    id, type: 'Other', eventType: 'check-insulin', bloodSugar: 123,
    recordTimestamp: now.toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString(),
  })));
  await chooseLeeLeeSection(page, 'Today');
  const actionLayout = await page.locator('[aria-label="Today record actions"]').first().evaluate((group) => {
    const footer = group.closest('.lee_lee_diabetes_timeline_footer').getBoundingClientRect();
    const actions = group.getBoundingClientRect();
    const buttons = [...group.querySelectorAll('button')].map(button => button.getBoundingClientRect());
    return { rightGap: footer.right - actions.right, buttonGap: buttons[1].left - buttons[0].right };
  });
  expect(Math.abs(actionLayout.rightGap)).toBeLessThanOrEqual(2);
  expect(actionLayout.buttonGap).toBeGreaterThanOrEqual(0);
  expect(actionLayout.buttonGap).toBeLessThan(30);
  await page.locator('[data-action="delete-record"][data-id="delete-today"]').click();
  await expect(page.getByRole('heading', { name: 'Delete this record?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('[data-action="delete-record"][data-id="delete-today"]')).toBeVisible();
  await page.locator('[data-action="delete-record"][data-id="delete-today"]').click();
  await page.getByRole('button', { name: 'Delete Record', exact: true }).click();
  await expect(page.locator('[data-action="delete-record"][data-id="delete-today"]')).toHaveCount(0);
  await openSeededLeeLeeHistoryDay(page, dateKey);
  await page.locator('[data-action="delete-record"][data-id="delete-history"]').click();
  await page.getByRole('button', { name: 'Delete Record', exact: true }).click();
  await expect(page.locator('[data-action="delete-record"]')).toHaveCount(0);
  await page.reload();
  const records = await page.evaluate(() => window.LeeLeeTrackerStorage.loadTrackerData().records);
  expect(records.filter(item => item.deletedAt)).toHaveLength(2);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const deletedSection = page.locator('[aria-labelledby="lee-lee-deleted-title"]');
  await expect(deletedSection.locator('details')).not.toHaveAttribute('open', '');
  await expect(deletedSection.getByRole('button', { name: 'Restore', exact: true })).toHaveCount(0);
  await deletedSection.getByText('Recently Deleted (2)', { exact: true }).click();
  await expect(deletedSection.locator('details')).toHaveAttribute('open', '');
  await expect(deletedSection.getByRole('button', { name: 'Restore', exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Sync Now', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sync Now', exact: true })).toBeEnabled();
});


test('Lee-Lee global sync reports its result and preserves Settings input', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('[name="patientName"]').fill('Unsaved draft');
  await page.evaluate(() => { window.__lltSyncReadGate = new Promise(resolve => { window.__lltReleaseSync = resolve; }); });
  await page.getByRole('button', { name: 'Sync Now', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Syncing...', exact: true })).toBeDisabled();
  await expect(page.locator('[name="patientName"]')).toHaveValue('Unsaved draft');
  await page.evaluate(() => window.__lltReleaseSync());
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.locator('[name="patientName"]')).toHaveValue('Unsaved draft');
  await expect(page.getByText('Sync complete. All data is up to date.', { exact: true })).toBeVisible();
});

test('Lee-Lee dose inline controls stay on one line with compact three-digit inputs', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  for (const name of ['insulinCarbRatioGrams', 'doseIncrementUnits', 'minimumAllowableDoseUnits', 'temporaryEatingAdjustmentUnits']) {
    const input = page.locator(`[name="${name}"]`);
    const layout = await input.evaluate((inputNode) => {
      const node = inputNode.parentElement;
      const box = node.getBoundingClientRect();
      return { height: box.height, inputWidth: inputNode.getBoundingClientRect().width, overflow: node.scrollWidth - node.clientWidth };
    });
    expect(layout.height).toBeLessThan(60);
    expect(layout.inputWidth).toBeLessThanOrEqual(88);
    expect(layout.overflow).toBeLessThanOrEqual(1);
  }
  const dateLayout = await page.locator('.lee_lee_diabetes_temporary_adjustment_dates').evaluate((group) => {
    const fields = [...group.querySelectorAll('.lee_lee_diabetes_field')].map((field) => field.getBoundingClientRect());
    return { viewportWidth: window.innerWidth, firstTop: fields[0]?.top || 0, secondTop: fields[1]?.top || 0, overflow: group.scrollWidth - group.clientWidth };
  });
  expect(dateLayout.overflow).toBeLessThanOrEqual(1);
  if (dateLayout.viewportWidth <= 640) expect(dateLayout.secondTop).toBeGreaterThan(dateLayout.firstTop);
  else expect(Math.abs(dateLayout.secondTop - dateLayout.firstTop)).toBeLessThanOrEqual(2);
  const checkboxLayout = await page.locator('.lee_lee_diabetes_temporary_adjustment_checkline').evaluate((label) => {
    const text = label.querySelector('span')?.getBoundingClientRect();
    const input = label.querySelector('input')?.getBoundingClientRect();
    return { gap: text && input ? input.left - text.right : 999, inputRight: input?.right || 0, labelRight: label.getBoundingClientRect().right || 0 };
  });
  expect(checkboxLayout.gap).toBeGreaterThanOrEqual(8);
  expect(checkboxLayout.inputRight).toBeLessThan(checkboxLayout.labelRight - 8);
});

test('Lee-Lee temporary adjustment survives settings review, confirmation, reload, and disable', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.locator('[data-plan-editor]');
  await settings.getByRole('checkbox', { name: 'Enable temporary adjustment' }).check();
  await settings.locator('[name="temporaryEatingAdjustmentStartsDate"]').fill('2026-09-18');
  await settings.locator('[name="temporaryEatingAdjustmentStartsTime"]').fill('08:00');
  await settings.locator('[name="temporaryEatingAdjustmentEndsDate"]').fill('2026-09-25');
  await settings.locator('[name="temporaryEatingAdjustmentEndsTime"]').fill('08:00');
  await settings.getByRole('button', { name: 'Review Plan Change', exact: true }).click();

  const confirmation = page.getByRole('heading', { name: 'Confirm insulin plan change' }).locator('..');
  await expect(confirmation).toContainText('Status: Enabled');
  await expect(confirmation).toContainText('+0.5 units');
  await expect(confirmation).toContainText('September 18, 2026');
  await expect(confirmation).toContainText('September 25, 2026');
  await confirmation.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.locator('[data-plan-editor] [name="temporaryEatingAdjustmentEnabled"]')).toBeChecked();

  await page.getByRole('button', { name: 'Review Plan Change', exact: true }).click();
  await page.locator('[data-plan-confirm-check]').check();
  await page.getByRole('button', { name: 'Activate Plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.locator('[name="temporaryEatingAdjustmentEnabled"]')).toBeChecked();

  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('[name="temporaryEatingAdjustmentEnabled"]')).toBeChecked();

  await page.locator('[name="temporaryEatingAdjustmentEnabled"]').uncheck();
  await page.getByRole('button', { name: 'Review Plan Change', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Confirm insulin plan change' }).locator('..')).toContainText('Status: Disabled');
  await page.locator('[data-plan-confirm-check]').check();
  await page.getByRole('button', { name: 'Activate Plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.locator('[name="temporaryEatingAdjustmentEnabled"]')).not.toBeChecked();
});


test('Lee-Lee food upload failures appear beside Sync Now and in food attempt diagnostics', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.evaluate(() => {
    localStorage.setItem('lando-world:lee-lees-tracker:food-library-queue:v1', JSON.stringify(
      Array.from({ length: 4 }, (_, i) => ({ id: `op-${i}`, recordId: `food-${i}`, entityType: 'food',
        type: 'upsert-library-item', state: 'pending', createdAt: new Date().toISOString(),
        payload: { id: `food-${i}`, name: `Food ${i}`, carbs: 10, version: 1 } }))
    ));
  });
  await page.getByRole('button', { name: 'Sync Now', exact: true }).click();
  await expect(page.getByText(/Sync completed with 4 food items still pending.*42501/)).toBeVisible();
  await page.getByText('Sync Diagnostics', { exact: true }).click();
  const row = label => page.locator('dl > div').filter({ has: page.locator('dt').filter({ hasText: new RegExp(`^${label}$`) }) }).locator('dd');
  await expect(row('Failed / needs review')).toHaveText('4');
  await expect(row('Last food attempt result')).toHaveText('0 succeeded / 4 failed');
  await expect(row('Last food attempt')).not.toHaveText('No food uploads attempted');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sync Now', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lando-world:lee-lees-tracker:food-library-queue:v1')).length)).toBe(4);
});

test('LLT starts the pre-meal timer only from the post-save Insulin Given action', async ({ page }) => {
  await openLeeLeePreMealTimerTest(page, { durationMinutes: 3 });
  const { offer, entry } = await saveLeeLeeTimerEligibleMeal(page);
  await expect(page.getByRole('heading', { name: 'Entry Saved', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Entry Saved!', exact: true })).toHaveCount(0);
  await expect(offer).not.toContainText('After insulin has been given');
  const start = offer.getByRole('button', { name: 'Start 3-Min Timer' });
  await expect(start).toBeVisible();
  const savedState = await page.evaluate(() => ({
    timer: localStorage.getItem('lando-world:lee-lees-tracker:pre-meal-timer:v1'),
    records: window.LeeLeeTrackerStorage.loadTrackerData().records,
  }));
  expect(savedState.timer).toBeNull();
  expect(savedState.records.some((record) => record.id === entry.id)).toBe(true);
  expect(entry.date).toBe('2020-01-02');
  expect(entry.time).toBe('03:04');

  const beforeAction = await page.evaluate(() => Date.now());
  await start.click();
  const timer = await page.evaluate(() => JSON.parse(localStorage.getItem('lando-world:lee-lees-tracker:pre-meal-timer:v1')));
  const afterAction = await page.evaluate(() => Date.now());
  expect(timer.status).toBe('active');
  expect(timer.sourceEntryId).toBe(entry.id);
  expect(timer.startedAt).toBeGreaterThanOrEqual(beforeAction);
  expect(timer.startedAt).toBeLessThanOrEqual(afterAction);
  expect(timer.endsAt - timer.startedAt).toBe(3 * 60 * 1000);

  await page.locator('.lee_lee_diabetes_pre_meal_timer_panel').getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'Open active Pre-Meal Timer' }).click();
  const startedValue = page.locator('.lee_lee_diabetes_pre_meal_timer_source div').first().locator('dd');
  const detailStartedText = await startedValue.innerText();
  const expectedTimerDate = await page.evaluate((startedAt) => new Intl.DateTimeFormat(navigator.language || undefined, {
    month: 'short', day: 'numeric',
  }).format(new Date(startedAt)), timer.startedAt);
  expect(detailStartedText).toContain(expectedTimerDate);
  expect(detailStartedText).not.toContain('Jan 2');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Open active Pre-Meal Timer' })).toBeVisible();
  const persistedTimer = await page.evaluate(() => window.LeeLeePreMealTimer.getTimer());
  expect(persistedTimer.startedAt).toBe(timer.startedAt);
  expect(persistedTimer.endsAt).toBe(timer.endsAt);
});

test('LLT Not Now, zero-carb entries, and disabled setting never create a pre-meal timer', async ({ page }) => {
  await openLeeLeePreMealTimerTest(page, { durationMinutes: 4 });
  const first = await saveLeeLeeTimerEligibleMeal(page);
  await expect(first.offer).toBeVisible();
  await first.offer.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.lee_lee_diabetes_pre_meal_timer_modal')).toHaveCount(0);
  const afterNotNow = await page.evaluate(() => ({
    timer: localStorage.getItem('lando-world:lee-lees-tracker:pre-meal-timer:v1'),
    records: window.LeeLeeTrackerStorage.loadTrackerData().records,
  }));
  expect(afterNotNow.timer).toBeNull();
  expect(afterNotNow.records.some((record) => record.id === first.entry.id)).toBe(true);

  const zero = await saveLeeLeeTimerEligibleMeal(page, { carbs: '0', date: '2020-01-03' });
  await expect(zero.offer).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('lando-world:lee-lees-tracker:pre-meal-timer:v1'))).toBeNull();

  await page.evaluate(() => localStorage.setItem('lando-world:lee-lees-tracker:pre-meal-timer-settings:v1', JSON.stringify({ enabled: false, durationMinutes: 4 })));
  const disabled = await saveLeeLeeTimerEligibleMeal(page, { carbs: '30', date: '2020-01-04' });
  await expect(disabled.offer).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('lando-world:lee-lees-tracker:pre-meal-timer:v1'))).toBeNull();
});

test('LLT defers an existing-timer conflict until explicit start and preserves all three choices', async ({ page }) => {
  await openLeeLeePreMealTimerTest(page, { durationMinutes: 4 });
  const first = await saveLeeLeeTimerEligibleMeal(page);
  await first.offer.getByRole('button', { name: 'Start 4-Min Timer' }).click();
  await page.locator('.lee_lee_diabetes_pre_meal_timer_panel').getByRole('button', { name: 'OK' }).click();
  const timerA = await page.evaluate(() => JSON.parse(localStorage.getItem('lando-world:lee-lees-tracker:pre-meal-timer:v1')));

  const second = await saveLeeLeeTimerEligibleMeal(page, { date: '2020-01-03' });
  await expect(second.offer).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lando-world:lee-lees-tracker:pre-meal-timer:v1')).sourceEntryId)).toBe(timerA.sourceEntryId);
  await second.offer.getByRole('button', { name: 'Start 4-Min Timer' }).click();
  const conflictKeep = page.locator('.lee_lee_diabetes_pre_meal_timer_modal');
  await expect(conflictKeep.getByRole('heading', { name: 'Timer Already Running' })).toBeVisible();
  expect(await conflictKeep.locator('.lee_lee_diabetes_pre_meal_timer_conflict_time').evaluate(node => getComputedStyle(node).fontFamily)).toContain('Roboto Mono');
  expect(await conflictKeep.locator('.lee_lee_diabetes_pre_meal_timer_conflict_time span').evaluate(node => getComputedStyle(node).fontFamily)).toContain('DM Sans');
  await conflictKeep.getByRole('button', { name: 'Keep Current Timer' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lando-world:lee-lees-tracker:pre-meal-timer:v1')).sourceEntryId)).toBe(timerA.sourceEntryId);
  await page.locator('.lee_lee_diabetes_pre_meal_timer_modal').getByRole('button', { name: 'Back to Today' }).click();

  const third = await saveLeeLeeTimerEligibleMeal(page, { date: '2020-01-04' });
  await third.offer.getByRole('button', { name: 'Start 4-Min Timer' }).click();
  const conflictRestart = page.locator('.lee_lee_diabetes_pre_meal_timer_modal');
  await expect(conflictRestart.getByRole('heading', { name: 'Timer Already Running' })).toBeVisible();
  await conflictRestart.getByRole('button', { name: 'Restart Timer' }).click();
  const timerRestarted = await page.evaluate(() => JSON.parse(localStorage.getItem('lando-world:lee-lees-tracker:pre-meal-timer:v1')));
  expect(timerRestarted.sourceEntryId).toBe(third.entry.id);
  expect(timerRestarted.startedAt).toBeGreaterThanOrEqual(timerA.startedAt);
  await page.locator('.lee_lee_diabetes_pre_meal_timer_modal').getByRole('button', { name: 'Back to Today' }).click();

  const fourth = await saveLeeLeeTimerEligibleMeal(page, { date: '2020-01-05' });
  await fourth.offer.getByRole('button', { name: 'Start 4-Min Timer' }).click();
  const beforeCancel = await page.evaluate(() => localStorage.getItem('lando-world:lee-lees-tracker:pre-meal-timer:v1'));
  const conflictCancel = page.locator('.lee_lee_diabetes_pre_meal_timer_modal');
  await conflictCancel.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'Entry Saved', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Entry Saved!', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start 4-Min Timer' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('lando-world:lee-lees-tracker:pre-meal-timer:v1'))).toBe(beforeCancel);
  await page.getByRole('button', { name: 'Done' }).click();
  const finalState = await page.evaluate(() => ({
    timer: JSON.parse(localStorage.getItem('lando-world:lee-lees-tracker:pre-meal-timer:v1')),
    records: window.LeeLeeTrackerStorage.loadTrackerData().records,
  }));
  expect(finalState.timer.sourceEntryId).toBe(third.entry.id);
  expect(finalState.records.some((record) => record.id === fourth.entry.id)).toBe(true);
});

test('LLT editing an existing carb entry does not reopen the fresh timer offer or start a timer', async ({ page }) => {
  await openLeeLeePreMealTimerTest(page);
  const today = await page.evaluate(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  const saved = await saveLeeLeeTimerEligibleMeal(page, { date: today });
  await saved.offer.getByRole('button', { name: 'Done' }).click();
  const edit = page.locator(`[data-action="edit-today-record"][data-id="${saved.entry.id}"]`);
  await expect(edit).toBeVisible();
  await edit.click();
  const form = page.locator('[data-lee-lee-editor]');
  await form.locator('[name="mealCarbs"]').fill('48');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Entry Saved' })).toHaveCount(0);
  await expect(page.locator('.lee_lee_diabetes_pre_meal_timer_modal')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('lando-world:lee-lees-tracker:pre-meal-timer:v1'))).toBeNull();
});

for (const [preference, system, effective] of [
  ['light', 'dark', 'light'], ['dark', 'light', 'dark'],
  ['system', 'light', 'light'], ['system', 'dark', 'dark'],
]) test(`icon foreground regression: ${preference} with system ${system}`, async ({ page }) => {
  await page.emulateMedia({ colorScheme: system });
  await page.addInitScript(value => localStorage.setItem('landos_world_appearance_preference_v1', value), preference);
  await openProtectedLeeLeeTracker(page);
  for (const [width,height] of [[320,740],[393,852],[768,1024],[1280,800],[852,393]]) {
    await page.setViewportSize({width,height});
    await page.goto('/#/');
    const homeCog = page.getByRole('button', { name: "Lando's World Settings", exact: true });
    await expect(homeCog.locator('svg')).toHaveCSS('stroke', effective === 'light' ? 'rgb(23, 32, 51)' : 'rgb(255, 255, 255)');
    await page.keyboard.press('Tab');
    await homeCog.focus();
    expect(await homeCog.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none');
    await page.screenshot({path:`/tmp/lsw-home-cog-${preference}-${system}-${width}.png`});
    await homeCog.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', effective);
    const cog = page.getByRole('button', { name: "Close Lando's World Settings" });
    await expect(cog.locator('svg')).toHaveCSS('stroke', effective === 'light' ? 'rgb(23, 32, 51)' : 'rgb(255, 255, 255)');
    await page.keyboard.press("Tab");
    await cog.focus();
    expect(await cog.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none');
    await page.screenshot({path:`/tmp/lsw-cog-${preference}-${system}-${width}.png`});
    await page.goto('/#/lee-lees-tracker');
    const add = page.locator('.lee_lee_diabetes_bottom_nav_button--primary');
    await expect(add).toBeVisible();
    await expect(add.locator('svg')).toHaveCSS('stroke', 'rgb(255, 255, 255)');
    await expect(add).toHaveCSS('background-color', effective === 'light' ? 'rgb(9, 104, 195)' : 'rgb(58, 160, 255)');
    const before = await add.boundingBox();
    expect(before.width).toBeGreaterThanOrEqual(44);
    expect(before.height).toBeGreaterThanOrEqual(44);
    if (effective === 'light') {
      await add.hover();
      await expect(add.locator('svg')).toHaveCSS('stroke', 'rgb(255, 255, 255)');
    }
    await page.screenshot({path:`/tmp/llt-plus-${preference}-${system}-${width}.png`});
    await add.click();
    await expect(page.getByRole('heading', {name:'Log Entry',exact:true})).toBeVisible();
    const insulin = page.getByRole('spinbutton', {name:'Insulin Actually Given',exact:true});
    await expect(insulin).toBeVisible();
    const baseline = await insulin.evaluate(node => { const s=getComputedStyle(node); return [node.value,s.fontFamily,s.fontSize,s.fontWeight,s.lineHeight,s.letterSpacing,s.color]; });
    const notes = page.locator('[data-lee-lee-editor] textarea[name=notes]');
    const sample = '15 g of carbs administered to increase glucose that was at 53. 0 units of insulin given.';
    await notes.fill(sample);
    await expect(notes).toHaveValue(sample);
    expect(await notes.evaluate(node => getComputedStyle(node).fontFamily)).toContain('Roboto Mono');
    expect(await insulin.evaluate(node => getComputedStyle(node).fontFamily)).toContain('Roboto Mono');
    expect(await page.locator('[data-lee-lee-editor] select').first().evaluate(node => getComputedStyle(node).fontFamily)).toContain('DM Sans');
    await notes.focus();
    await notes.evaluate(node => node.setSelectionRange(node.value.length,node.value.length));
    await page.keyboard.type(' Editable');
    await expect(notes).toHaveValue(sample + ' Editable');
    expect(await insulin.evaluate(node => { const s=getComputedStyle(node); return [node.value,s.fontFamily,s.fontSize,s.fontWeight,s.lineHeight,s.letterSpacing,s.color]; })).toEqual(baseline);
    expect(await notes.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await notes.scrollIntoViewIfNeeded();
    await page.screenshot({path:`/tmp/llt-notes-${preference}-${system}-${width}.png`});
    await page.locator("[data-lee-lee-editor]").getByRole("button",{name:"Cancel",exact:true}).click();
  }
});
