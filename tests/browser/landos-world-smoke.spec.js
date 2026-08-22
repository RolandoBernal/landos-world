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
      { text: 'Add Past Game' },
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

test('appearance setting reflects the preference and applies immediately', async ({ page }) => {
  await page.goto('/#/settings');

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

async function openProtectedLeeLeeTracker(page) {
  await page.addInitScript(() => {
    window.LEE_LEE_TRACKER_SUPABASE_CONFIG = {
      url: 'https://example.supabase.co',
      publishableKey: 'publishable-key-for-browser-smoke-tests',
    };
    localStorage.setItem('lando-world:lee-lees-tracker:device-identity:v1', 'Rolando');
    window.supabase = {
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: { user: { id: 'browser-smoke-user' } } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        },
        channel: () => ({
          on() { return this; },
          subscribe: () => 'SUBSCRIBED',
        }),
        removeChannel: () => {},
        from: () => ({
          select() { return this; },
          eq() { return this; },
          order: async () => ({ data: [], error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
          insert() { return { select: () => ({ single: async () => ({ data: null, error: { message: 'offline test client' } }) }) }; },
        }),
        rpc: async () => ({ data: null, error: { message: 'offline test client' } }),
      }),
    };
  });
  await page.goto('/#/lee-lees-tracker');
  await expect(page.getByRole('heading', { name: /Lee-Lee.s Tracker/ })).toBeVisible();
}

test('Lee-Lee Bedtime context removes Meal Carbs and saves without stale carb data', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: '+ Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await expect(form.getByLabel('Context')).toHaveValue('Breakfast');
  await expect(form.getByRole('heading', { name: 'Meal Carbs' })).toBeVisible();
  await expect(form.getByLabel('Blood Sugar')).toBeVisible();

  await form.getByLabel('Blood Sugar').fill('198');
  await form.getByLabel('Food').fill('Pasta');
  await form.getByRole('spinbutton', { name: 'Total carbs' }).fill('46.5');
  await expect(form.getByText('Total carbs: 46.5 g carbs')).toBeVisible();

  await form.getByLabel('Context').selectOption('Bedtime');
  await expect(form.getByRole('heading', { name: 'Meal Carbs' })).toHaveCount(0);
  await expect(form.getByText('Total carbs:', { exact: false })).toHaveCount(0);
  await expect(form.getByLabel('Blood Sugar')).toBeVisible();
  await expect(form.getByText('Suggested dose')).toBeVisible();
  await expect(form.getByText('17 units')).toBeVisible();

  const focusableFoodControls = await form.locator('[name^="food"], [name="mealCarbs"], [data-action="add-food"], [data-action="remove-food"]').count();
  expect(focusableFoodControls).toBe(0);

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
  });
});

test('Lee-Lee context switching restores Meal Carbs for applicable contexts', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: '+ Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Bedtime');
  await expect(form.getByRole('heading', { name: 'Meal Carbs' })).toHaveCount(0);

  await form.getByLabel('Context').selectOption('Lunch');
  await expect(form.getByRole('heading', { name: 'Meal Carbs' })).toBeVisible();
  await expect(form.getByRole('button', { name: '+ Add Food' })).toBeVisible();

  await form.getByLabel('Context').selectOption('Correction');
  await expect(form.getByRole('heading', { name: 'Meal Carbs' })).toHaveCount(0);
  await expect(form.getByLabel('Blood Sugar')).toBeVisible();
});
