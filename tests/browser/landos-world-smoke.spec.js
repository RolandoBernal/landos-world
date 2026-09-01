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
      { text: 'New Game' },
      { text: 'Add Game' },
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

async function chooseLeeLeeSection(page, name) {
  const mobileNav = page.locator('.lee_lee_diabetes_mobile_nav_button');
  if (await mobileNav.isVisible()) {
    await mobileNav.click();
  }
  await page.getByLabel("Lee-Lee’s Tracker sections").getByRole('button', { name }).click();
}

async function seedLeeLeeRecords(page, records) {
  await page.evaluate((seedRecords) => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      records: seedRecords,
    }));
  }, records);
}

async function openSeededLeeLeeHistoryDay(page, dateKey = '2026-08-25') {
  await chooseLeeLeeSection(page, 'History');
  await page.locator(`[data-action="history-date"][data-date="${dateKey}"]`).click();
}

test('Lee-Lee settings gear toggles the settings page', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  const app = page.locator('#lee-lees-tracker-view');
  await expect(app.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-pressed', 'false');

  await app.getByRole('button', { name: 'Settings' }).click();
  await expect(app.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Close Settings' })).toHaveAttribute('aria-pressed', 'true');

  await app.getByRole('button', { name: 'Close Settings' }).click();
  await expect(app.getByRole('heading', { name: /Lee-Lee.s Tracker/ })).toBeVisible();
  await expect(app.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-pressed', 'false');
});

test('Lee-Lee Reports summarizes stored records and renders trend charts', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => {
    window.LeeLeeTrackerStorage.updateTrackerData((current) => ({
      ...current,
      records: [
        {
          id: 'reports-breakfast',
          type: 'Breakfast',
          eventType: 'check-insulin',
          bloodSugar: 160,
          mealCarbs: 42,
          administeredInsulinUnits: 6,
          suggestedTotalUnits: 5.5,
          recordTimestamp: '2026-08-25T12:30:00.000Z',
          createdAt: '2026-08-25T12:35:00.000Z',
          updatedAt: '2026-08-25T12:35:00.000Z',
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
          recordTimestamp: '2026-08-25T18:30:00.000Z',
          createdAt: '2026-08-25T18:35:00.000Z',
          updatedAt: '2026-08-25T18:35:00.000Z',
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
          recordTimestamp: '2026-08-18T18:30:00.000Z',
          createdAt: '2026-08-18T18:35:00.000Z',
          updatedAt: '2026-08-18T18:35:00.000Z',
          notes: '',
        },
      ],
    }));
  });

  await chooseLeeLeeSection(page, 'Reports');
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  const reportsFilters = page.locator('[data-reports-filters]');
  await expect(reportsFilters.getByLabel('Date Range')).toHaveValue('last7');
  await expect(page.getByText('2 records from')).toBeVisible();
  const summarySection = page.getByLabel('Summary');
  await expect(page.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
  await expect(summarySection.getByText('Total insulin given')).toBeVisible();
  await expect(summarySection.getByText('23 units')).toBeVisible();
  await expect(summarySection.getByText('Total carbs')).toBeVisible();
  expect(await summarySection.getByText('42 g carbs').count()).toBeGreaterThan(0);
  await page.getByRole('tab', { name: 'Trends' }).click();
  await expect(page.getByRole('img', { name: /Glucose Trend chart/ })).toBeVisible();
  await expect(page.getByText('Carbohydrate Trend')).toBeVisible();
  await expect(page.locator('.lee_lee_diabetes_chart_point')).toHaveCount(5);
  expect(await page.locator('.lee_lee_diabetes_report_control_stack').evaluate((node) => getComputedStyle(node).display)).toBe('grid');
  expect(await page.locator('.lee_lee_diabetes_report_control_stack').evaluate((node) => getComputedStyle(node).rowGap)).toBe(
    await page.locator('.lee_lee_diabetes_report_tabs').evaluate((node) => getComputedStyle(node).rowGap),
  );
  let previewText = await page.locator('.lee_lee_diabetes_report_preview').evaluate((node) => node.textContent || '');
  expect(previewText).toContain('23 units');
  expect(previewText).not.toContain('27 units');

  await reportsFilters.getByLabel('Date Range').selectOption('last14');
  await expect(page.getByText('3 records from')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Trends' })).toHaveAttribute('aria-selected', 'true');
  previewText = await page.locator('.lee_lee_diabetes_report_preview').evaluate((node) => node.textContent || '');
  expect(previewText).toContain('27 units');

  await reportsFilters.getByLabel('Date Range').selectOption('custom');
  await reportsFilters.getByLabel('Start Date').fill('2026-08-25');
  await reportsFilters.getByLabel('End Date').fill('2026-08-25');
  await expect(page.getByText('2 records from')).toBeVisible();
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
  await page.getByRole('button', { name: '+ Log Entry' }).click();

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
  await expect(form.getByText('17 units')).toBeVisible();
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
  await page.getByRole('button', { name: '+ Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Bedtime');
  await expect(form.getByRole('heading', { name: 'Meal Carbs' })).toHaveCount(0);

  await form.getByLabel('Context').selectOption('Lunch');
  await expect(form.getByRole('heading', { name: 'Meal Carbs' })).toBeVisible();
  await expect(form.getByRole('spinbutton', { name: 'Total Carbs' })).toBeVisible();
  await expect(form.getByRole('button', { name: 'Open Carb Calculator' })).toBeVisible();
  await expect(form.getByRole('button', { name: '+ Add Food' })).toHaveCount(0);

  await form.getByLabel('Context').selectOption('Correction');
  await expect(form.getByRole('heading', { name: 'Meal Carbs' })).toHaveCount(0);
  await expect(form.getByLabel('Blood Sugar')).toBeVisible();
});

test('Lee-Lee Carb Calc applies temporary receipt rows without saving food details', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: '+ Log Entry' }).click();

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
  await expect(calculator.locator('[name="carbCalcCarbs"]').first()).toBeFocused();
  await expect(calculator.locator('.lee_lee_diabetes_carb_calc_operator').first()).toHaveText('×');
  await expect(calculator.locator('[name="carbCalcQty"]').first()).toHaveClass(/lee_lee_diabetes_carb_calc_input/);
  await expect(calculator.locator('[name="carbCalcCarbs"]').first()).toHaveClass(/lee_lee_diabetes_carb_calc_input/);
  await expect(calculator.locator('[name="carbCalcCarbs"]').first()).toHaveCSS('text-align', 'left');
  await expect(calculator.locator('[name="carbCalcCarbs"]').first()).toHaveCSS('appearance', 'textfield');
  await expect(calculator.locator('[name="carbCalcQty"]').first()).toHaveCSS('appearance', 'textfield');
  expect(await calculator.locator('[name="carbCalcCarbs"]').first().evaluate((input) => input.getBoundingClientRect().width)).toBeLessThan(90);
  await expect(calculator.locator('[name="carbCalcQty"]')).toHaveCount(1);
  await expect(calculator.locator('[name="carbCalcQty"]').first()).toHaveValue('1');
  await expect(calculator.locator('[name="carbCalcCarbs"]').first()).toHaveValue('');
  await expect(calculator.getByText('Total Carbs')).toBeVisible();
  await expect(calculator.getByRole('button', { name: 'Use 0 grams' })).toBeDisabled();

  const firstCarbs = calculator.locator('[name="carbCalcCarbs"]').first();
  await firstCarbs.click();
  await firstCarbs.pressSequentially('25');
  await expect(firstCarbs).toHaveValue('25');
  await expect(firstCarbs).toBeFocused();
  await expect(calculator.locator('[name="carbCalcQty"]')).toHaveCount(2);
  const secondQty = calculator.locator('[name="carbCalcQty"]').nth(1);
  await secondQty.click();
  await secondQty.press('ControlOrMeta+A');
  await secondQty.pressSequentially('2');
  await expect(secondQty).toHaveValue('2');
  const secondCarbs = calculator.locator('[name="carbCalcCarbs"]').nth(1);
  await secondCarbs.click();
  await secondCarbs.pressSequentially('19');
  await expect(secondCarbs).toHaveValue('19');
  await expect(secondCarbs).toBeFocused();
  await expect(calculator.locator('[name="carbCalcQty"]')).toHaveCount(3);
  await expect(calculator.getByLabel('Meal Total')).toHaveText('63 g');

  const thirdQty = calculator.locator('[name="carbCalcQty"]').nth(2);
  await thirdQty.click();
  await thirdQty.press('ControlOrMeta+A');
  await thirdQty.pressSequentially('1.5');
  await expect(thirdQty).toHaveValue('1.5');
  await calculator.locator('[name="carbCalcCarbs"]').nth(2).click();
  await calculator.locator('[name="carbCalcCarbs"]').nth(2).pressSequentially('19');
  await expect(calculator.getByLabel('Meal Total')).toHaveText('91.5 g');
  const thirdRowId = await thirdQty.getAttribute('data-carb-row-id');
  await calculator.locator(`[data-carb-calculator-row][data-carb-row-id="${thirdRowId}"] [data-action="remove-carb-calculator-row"]`).click();
  await expect(calculator.getByLabel('Meal Total')).toHaveText('63 g');
  await calculator.getByRole('button', { name: 'Use 63 grams' }).click();

  await expect(page.locator('[data-carb-calculator]')).toHaveCount(0);
  await expect(form.getByRole('button', { name: 'Open Carb Calculator' })).toBeFocused();
  await expect(form.getByRole('spinbutton', { name: 'Total Carbs' })).toHaveValue('63');
  await expect(form.getByText('Carb coverage: 63 g carbs ÷ 20 = 3.15 → 3 units')).toBeVisible();
  await expect(form.getByLabel('Insulin Actually Given')).toHaveValue('5');

  await form.getByRole('spinbutton', { name: 'Total Carbs' }).fill('70');
  await expect(form.getByText('Carb coverage: 70 g carbs ÷ 20 = 3.5 → 3.5 units')).toBeVisible();
  await expect(form.getByLabel('Insulin Actually Given')).toHaveValue('5.5');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();
  await expect(page.locator('[data-carb-calculator]').getByLabel('Meal Total')).toHaveText('63 g');
  await page.locator('[data-carb-calculator]').getByRole('button', { name: 'Cancel Carb Calculator' }).click();
  await expect(form.getByRole('spinbutton', { name: 'Total Carbs' })).toHaveValue('70');
  await expect(form.getByRole('button', { name: 'Open Carb Calculator' })).toBeFocused();
  await expect(form.getByLabel('Insulin Actually Given')).toHaveValue('5.5');

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
    administeredInsulinUnits: 5.5,
    insulinUnits: 5.5,
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
          name: 'Footlong hot dog',
          carbs: 24,
          servingLabel: 'one',
          favorite: true,
          createdAt: '2026-08-31T12:00:00.000Z',
          updatedAt: '2026-08-31T12:00:00.000Z',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Ketchup',
          carbs: 4,
          servingLabel: 'packet',
          createdAt: '2026-08-31T12:00:00.000Z',
          updatedAt: '2026-08-31T12:00:00.000Z',
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Mustard',
          carbs: 0,
          favorite: true,
          createdAt: '2026-08-31T12:00:00.000Z',
          updatedAt: '2026-08-31T12:00:00.000Z',
        },
      ],
      savedMeals: [],
    }));
  });
  await page.getByRole('button', { name: '+ Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByLabel('Blood Sugar').fill('299');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  const libraryOptions = calculator.locator('.lee_lee_diabetes_carb_library_list .lee_lee_diabetes_carb_food_option');
  await expect(calculator.getByRole('tab', { name: 'Favorites' })).toHaveAttribute('aria-selected', 'true');
  await libraryOptions.filter({ hasText: 'Footlong hot dog' }).click();
  await calculator.getByRole('tab', { name: 'My Foods' }).click();
  const foodSearch = calculator.getByLabel('Search foods');
  await expect(foodSearch).toHaveAttribute('placeholder', 'Search foods...');
  await expect(calculator.getByRole('button', { name: 'Search' })).toHaveCount(0);
  await foodSearch.click();
  await foodSearch.pressSequentially('chicken nugget');
  await expect(foodSearch).toHaveValue('chicken nugget');
  await expect(foodSearch).toBeFocused();
  await expect(libraryOptions.filter({ hasText: 'Chicken Nuggets / Tenders' })).toBeVisible();
  await foodSearch.press('Enter');
  await expect(calculator).toBeVisible();
  await expect(foodSearch).toBeFocused();
  await foodSearch.fill(' no-food-found ');
  await expect(calculator.getByText('No foods found for “no-food-found”')).toBeVisible();
  await calculator.locator('.lee_lee_diabetes_carb_search_empty').getByRole('button', { name: '+ Add New Food' }).click();
  await expect(calculator.getByLabel('Food Name')).toBeVisible();
  await calculator.getByRole('button', { name: 'Cancel', exact: true }).click();
  await foodSearch.fill('');
  await foodSearch.click();
  await foodSearch.pressSequentially('ket');
  await expect(foodSearch).toHaveValue('ket');
  await expect(foodSearch).toBeFocused();
  await libraryOptions.filter({ hasText: 'Ketchup' }).click();
  await expect(foodSearch).toHaveValue('');
  await foodSearch.fill('');
  await foodSearch.click();
  await foodSearch.pressSequentially('must');
  await expect(foodSearch).toHaveValue('must');
  await expect(foodSearch).toBeFocused();
  await calculator.getByRole('button', { name: /^Mustard 0 g carbs/ }).click();

  await expect(calculator.getByLabel('Meal Total')).toHaveText('28 g');
  const ketchupRow = calculator.locator('[data-carb-calculator-row]').filter({ hasText: 'Ketchup' });
  await ketchupRow.getByRole('button', { name: /Increase Ketchup quantity/ }).click();
  await expect(calculator.getByLabel('Meal Total')).toHaveText('32 g');

  const manualCarbs = calculator.locator('[name="carbCalcCarbs"]').last();
  await manualCarbs.fill('3');
  await expect(calculator.getByLabel('Meal Total')).toHaveText('35 g');
  await calculator.getByRole('button', { name: 'Save as Meal' }).click();
  await calculator.getByLabel('Meal Name').fill('Hot Dog Meal');
  await calculator.getByRole('button', { name: 'Save Meal' }).click();
  await expect(calculator.getByRole('button', { name: /Hot Dog Meal/ })).toBeVisible();
  await calculator.getByRole('button', { name: 'Use 35 grams' }).click();

  await expect(form.getByRole('spinbutton', { name: 'Total Carbs' })).toHaveValue('35');
  await expect(form.getByText('Carb coverage: 35 g carbs ÷ 20 = 1.75 → 2 units')).toBeVisible();
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
  expect(savedState.record.mealCarbs).toBe(35);
  expect(savedState.record.mealComponents.map((item) => item.nameSnapshot)).toEqual([
    'Footlong hot dog',
    'Ketchup',
    'Mustard',
    'Manual amount',
  ]);
  expect(savedState.savedMeals[0].totalCarbs).toBe(35);
  expect(savedState.foodLibrary.find((food) => food.name === 'Ketchup').lastUsedAt).toBeTruthy();

  await chooseLeeLeeSection(page, 'History');
  await page.getByRole('button', { name: /1 entry/ }).click();
  await expect(page.getByText('Footlong hot dog · 2× Ketchup · Mustard · Manual amount')).toBeVisible();
});

test('Lee-Lee Carb Calc preserves focused inputs and uses the total on first pointer action', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: '+ Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  const carbInputs = calculator.locator('[name="carbCalcCarbs"]');
  await expect(carbInputs.first()).toBeFocused();

  const firstNodeStableAfterInput = await carbInputs.first().evaluate((input) => {
    window.__leeLeeFirstCarbInput = input;
    input.value = '20';
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: '20',
      inputType: 'insertText',
    }));
    return window.__leeLeeFirstCarbInput === input && input.isConnected;
  });
  expect(firstNodeStableAfterInput).toBe(true);
  await expect(carbInputs.first()).toHaveValue('20');
  await expect(carbInputs).toHaveCount(2);

  const secondCarbs = carbInputs.nth(1);
  await carbInputs.first().focus();
  await secondCarbs.click();
  await expect(secondCarbs).toBeFocused();
  await secondCarbs.pressSequentially('15');
  await expect(secondCarbs).toHaveValue('15');
  await expect(calculator.getByLabel('Meal Total')).toHaveText('35 g');

  const nodesStableAfterSwitching = await carbInputs.first().evaluate((input) => (
    window.__leeLeeFirstCarbInput === input && input.isConnected
  ));
  expect(nodesStableAfterSwitching).toBe(true);

  await secondCarbs.focus();
  await calculator.getByRole('button', { name: 'Use 35 grams' }).click();

  await expect(page.locator('[data-carb-calculator]')).toHaveCount(0);
  await expect(form.getByRole('spinbutton', { name: 'Total Carbs' })).toHaveValue('35');
  await expect(form.getByRole('button', { name: 'Open Carb Calculator' })).toBeFocused();
});

test('Lee-Lee Carb Calc keeps the modal open across field taps and restores scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: '+ Log Entry' }).click();

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
  const carbInputs = calculator.locator('[name="carbCalcCarbs"]');
  const qtyInputs = calculator.locator('[name="carbCalcQty"]');
  const focusedCarbInputIndex = () => page.evaluate(() => (
    Array.from(document.querySelectorAll('[data-carb-calculator] [name="carbCalcCarbs"]')).indexOf(document.activeElement)
  ));
  const focusedQtyInputIndex = () => page.evaluate(() => (
    Array.from(document.querySelectorAll('[data-carb-calculator] [name="carbCalcQty"]')).indexOf(document.activeElement)
  ));
  await expect(calculator).toBeVisible();
  await expect(carbInputs.first()).toBeFocused();
  await expect.poll(() => calculator.evaluate((node) => getComputedStyle(node).maxHeight)).toBe('100%');
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeOpen);

  await page.evaluate(() => {
    window.__leeLeeEditorSubmitCount = 0;
    document.querySelector('[data-lee-lee-editor]')?.addEventListener('submit', () => {
      window.__leeLeeEditorSubmitCount += 1;
    });
  });

  await carbInputs.first().pressSequentially('20');
  await expect(calculator).toBeVisible();
  await expect(carbInputs.first()).toHaveValue('20');
  await expect(carbInputs).toHaveCount(2);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeOpen);

  await carbInputs.nth(1).click();
  await expect(calculator).toBeVisible();
  await expect.poll(focusedCarbInputIndex).toBe(1);
  await carbInputs.nth(1).pressSequentially('15');
  await expect(carbInputs).toHaveCount(3);

  await qtyInputs.nth(1).click();
  await expect(calculator).toBeVisible();
  await expect.poll(focusedQtyInputIndex).toBe(1);
  await qtyInputs.nth(1).press('ControlOrMeta+A');
  await qtyInputs.nth(1).pressSequentially('2');
  await expect(calculator.getByLabel('Meal Total')).toHaveText('50 g');

  await carbInputs.nth(2).click();
  await expect(calculator).toBeVisible();
  await expect.poll(focusedCarbInputIndex).toBe(2);
  await carbInputs.nth(2).pressSequentially('10');
  await expect(calculator.getByLabel('Meal Total')).toHaveText('60 g');
  expect(await page.evaluate(() => window.__leeLeeEditorSubmitCount)).toBe(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeOpen);

  await calculator.getByRole('button', { name: 'Use 60 grams' }).click();

  await expect(page.locator('[data-carb-calculator]')).toHaveCount(0);
  await expect(form.getByRole('spinbutton', { name: 'Total Carbs' })).toHaveValue('60');
  await page.waitForFunction((expected) => window.scrollY === expected, scrollBeforeOpen);
  expect(await page.evaluate(() => window.__leeLeeEditorSubmitCount)).toBe(0);
  expect(consoleErrorCount).toBe(0);
});

test('Lee-Lee Carb Calc tracks the visual viewport and locks page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.addInitScript(() => {
    const listeners = new Map();
    const frame = {
      width: 390,
      height: 640,
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
  });
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: '+ Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByLabel('Blood Sugar').fill('188');
  await page.evaluate(() => window.scrollTo(0, 180));
  const scrollBeforeOpen = await page.evaluate(() => window.scrollY);

  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  const layer = page.locator('[data-carb-calculator-layer]');
  const carbInputs = calculator.locator('[name="carbCalcCarbs"]');
  await expect(calculator).toBeVisible();
  await expect(carbInputs.first()).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeOpen);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
  await expect.poll(() => calculator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return Math.round(rect.top + (rect.height / 2));
  })).toBe(320);

  await page.evaluate(() => window.scrollTo(0, 420));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollBeforeOpen);

  await page.evaluate(() => window.__setLeeLeeVisualViewportFrame({ height: 180, offsetTop: 18 }));
  await expect.poll(() => layer.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      height: Math.round(rect.height),
      overflow: getComputedStyle(node).overflow,
    };
  })).toEqual({
    top: 18,
    bottom: 198,
    height: 180,
    overflow: 'hidden',
  });
  await expect.poll(() => calculator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return Math.round(rect.top + (rect.height / 2));
  })).toBe(108);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeOpen);
  await expect(calculator).toBeVisible();
  await expect(carbInputs.first()).toBeFocused();

  const modalScrollMetrics = await calculator.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    return {
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      scrollTop: node.scrollTop,
    };
  });
  expect(modalScrollMetrics.scrollHeight).toBeGreaterThan(modalScrollMetrics.clientHeight);
  expect(modalScrollMetrics.scrollTop).toBeGreaterThan(0);

  await calculator.getByRole('button', { name: 'Cancel Carb Calculator' }).click();

  await expect(page.locator('[data-carb-calculator]')).toHaveCount(0);
  await expect(form.getByRole('spinbutton', { name: 'Total Carbs' })).toHaveValue('');
  await page.waitForFunction((expected) => window.scrollY === expected, scrollBeforeOpen);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
});

test('Lee-Lee entry inputs preserve typed digit order during live updates', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: '+ Log Entry' }).click();

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

  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();
  const calculator = page.locator('[data-carb-calculator]');
  const blankRowId = await calculator.locator('[name="carbCalcCarbs"]').first().getAttribute('data-carb-row-id');
  const blankCarbs = calculator.locator(`[name="carbCalcCarbs"][data-carb-row-id="${blankRowId}"]`);
  await blankCarbs.click();
  await blankCarbs.pressSequentially('47');
  await expect(blankCarbs).toHaveValue('47');
  await expect(blankCarbs).toBeFocused();
  await expect(calculator.locator('[name="carbCalcCarbs"]')).toHaveCount(2);
  await expect(calculator.getByLabel('Meal Total')).toHaveText('47 g');
  await calculator.getByRole('button', { name: 'Use 47 grams' }).click();
  await expect(form.getByLabel('Insulin Actually Given')).toHaveValue('1.5');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  await blankCarbs.press('ControlOrMeta+A');
  await blankCarbs.pressSequentially('19');
  await expect(blankCarbs).toHaveValue('19');
  await expect(blankCarbs).toBeFocused();
});

test('Lee-Lee Carb Calc tabs down the carb column while keeping qty editable', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  await page.getByRole('button', { name: '+ Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  const carbInputs = calculator.locator('[name="carbCalcCarbs"]');
  const qtyInputs = calculator.locator('[name="carbCalcQty"]');

  await carbInputs.first().click();
  await carbInputs.first().pressSequentially('23');
  await expect(carbInputs.first()).toHaveValue('23');
  await expect(carbInputs.first()).toBeFocused();
  await expect(carbInputs).toHaveCount(2);

  await carbInputs.first().focus();
  await page.keyboard.press('Tab');
  await expect(carbInputs.nth(1)).toBeFocused();
  await carbInputs.nth(1).fill('15');
  await expect(carbInputs.nth(1)).toHaveValue('15');
  await expect(carbInputs).toHaveCount(3);

  await page.keyboard.press('Tab');
  await expect(carbInputs.nth(2)).toBeFocused();
  await carbInputs.nth(2).fill('47');
  await expect(carbInputs.nth(2)).toHaveValue('47');
  await expect(carbInputs).toHaveCount(4);
  await expect(calculator.getByLabel('Meal Total')).toHaveText('85 g');

  await page.keyboard.press('Shift+Tab');
  await expect(carbInputs.nth(1)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(carbInputs.first()).toBeFocused();

  await qtyInputs.nth(1).click();
  await qtyInputs.nth(1).press('ControlOrMeta+A');
  await qtyInputs.nth(1).pressSequentially('2');
  await expect(qtyInputs.nth(1)).toHaveValue('2');
  await expect(calculator.getByLabel('Meal Total')).toHaveText('100 g');

  await qtyInputs.nth(2).click();
  await qtyInputs.nth(2).press('ControlOrMeta+A');
  await qtyInputs.nth(2).pressSequentially('1.5');
  await expect(qtyInputs.nth(2)).toHaveValue('1.5');
  await carbInputs.nth(2).click();
  await carbInputs.nth(2).press('ControlOrMeta+A');
  await carbInputs.nth(2).pressSequentially('19');
  await expect(carbInputs.nth(2)).toHaveValue('19');
  await expect(calculator.getByLabel('Meal Total')).toHaveText('81.5 g');

  expect(await calculator.locator('[tabindex]').count()).toBe(0);
});
