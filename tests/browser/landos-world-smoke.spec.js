import { expect, test } from '@playwright/test';

const WEATHER_API_PATTERN = /api\.open-meteo\.com\/v1\/forecast/;

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
      { text: 'Nashville, TN' },
      { text: 'Puerto Vallarta, MX' },
      { text: 'Tepic, MX' },
      { text: 'Vancouver, BC' },
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
      { text: 'New Game' },
      { text: 'Saved Games' },
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

test.beforeEach(async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
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
});

test.afterEach(async ({ page }) => {
  expect(page.consoleErrors).toEqual([]);
});

for (const route of LOCAL_APP_ROUTES) {
  test(`${route.name} route renders its first screen`, async ({ page }) => {
    await page.goto(`/${route.hash}`);
    await expect(page.locator('body')).toBeVisible();
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
  });
}

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
  await expect(page.locator('.ecosystem_nav')).toHaveCount(7);
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
