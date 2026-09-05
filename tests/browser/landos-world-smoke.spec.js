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

async function startVfgtFirstHalf(page) {
  await page.goto('/#/violet-futbol-game-tracker');
  const app = page.locator('#violet-futbol-game-tracker-view');
  await app.getByRole('button', { name: 'New Game' }).click();
  await app.getByLabel('School/Team 1').fill('Violet');
  await app.getByLabel('School/Team 2').fill('Hume-Fogg');
  await app.getByRole('button', { name: 'Start Game' }).click();
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
  await expect(app.locator('.vfgt_actions')).toBeHidden();
  await expect(app.locator('[data-vfgt-seven-segment-display]')).toHaveCount(1);

  const layout = await page.evaluate(() => {
    const liveNode = document.querySelector('.vfgt_live--running-half');
    const panel = document.querySelector('.vfgt_clock_panel');
    const clockNode = document.querySelector('.vfgt_clock');
    const display = document.querySelector('[data-vfgt-seven-segment-display]');
    const phase = document.querySelector('.vfgt_phase');
    const bodyStyle = getComputedStyle(document.body);
    const liveStyle = getComputedStyle(liveNode);
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

test('Lee-Lee top-level navigation omits the standalone Export section', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openProtectedLeeLeeTracker(page);
  const desktopNav = page.getByLabel("Lee-Lee’s Tracker sections");
  await expect(desktopNav.getByRole('button')).toHaveCount(4);
  await expect(desktopNav.getByRole('button', { name: 'Today' })).toBeVisible();
  await expect(desktopNav.getByRole('button', { name: 'History' })).toBeVisible();
  await expect(desktopNav.getByRole('button', { name: 'Reports' })).toBeVisible();
  await expect(desktopNav.getByRole('button', { name: 'Foods' })).toBeVisible();
  await expect(desktopNav.getByRole('button', { name: 'Export' })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await openProtectedLeeLeeTracker(page);
  const mobileNavButton = page.locator('.lee_lee_diabetes_mobile_nav_button');
  await expect(mobileNavButton).toBeVisible();
  await mobileNavButton.click();
  const mobileNav = page.getByLabel("Lee-Lee’s Tracker sections");
  await expect(mobileNav.getByRole('button')).toHaveCount(4);
  await expect(mobileNav.getByRole('button', { name: 'Export' })).toHaveCount(0);

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

test('Lee-Lee light mobile navigation menu uses readable light surfaces', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openProtectedLeeLeeTracker(page);
  await page.evaluate(() => window.LandosTheme?.setPreference?.('light'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const mobileNavButton = page.locator('.lee_lee_diabetes_mobile_nav_button');
  await expect(mobileNavButton).toBeVisible();
  await mobileNavButton.click();
  const nav = page.locator('#lee-lee-diabetes-nav');
  await expect(nav).toBeVisible();

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
    const inactiveBackground = parseRgb(inactive.backgroundColor);
    const inactiveColor = parseRgb(inactive.color);
    return {
      panelBackground: panel.backgroundColor,
      inactiveBackground: inactive.backgroundColor,
      inactiveColor: inactive.color,
      activeBackground: active.backgroundColor,
      activeColor: active.color,
      inactiveContrast: contrast(inactiveColor, inactiveBackground),
    };
  });

  expect(lightStyles.panelBackground).not.toBe('rgb(5, 9, 19)');
  expect(lightStyles.inactiveBackground).not.toBe('rgb(255, 255, 255)');
  expect(lightStyles.inactiveContrast).toBeGreaterThanOrEqual(4.5);
  expect(lightStyles.activeBackground).not.toBe(lightStyles.inactiveBackground);
  expect(lightStyles.activeColor).not.toBe(lightStyles.inactiveColor);

  await expect(nav.getByRole('button')).toHaveCount(4);
  await expect(nav.getByRole('button', { name: 'Export' })).toHaveCount(0);

  for (const [action, label] of [['history', 'History'], ['reports', 'Reports'], ['foods', 'Foods']]) {
    await nav.getByRole('button', { name: label }).click();
    await expect(mobileNavButton).toHaveText(new RegExp(label));
    await mobileNavButton.click();
    await expect(nav).toBeVisible();
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
      const inactiveButton = Array.from(node.querySelectorAll('.lee_lee_diabetes_nav_button'))
        .find((button) => button.dataset.action !== activeAction);
      const active = getComputedStyle(activeButton);
      const inactive = getComputedStyle(inactiveButton);
      return {
        activeBackground: active.backgroundColor,
        inactiveBackground: inactive.backgroundColor,
        inactiveContrast: contrast(parseRgb(inactive.color), parseRgb(inactive.backgroundColor)),
      };
    }, action);
    expect(stateStyles.inactiveContrast).toBeGreaterThanOrEqual(4.5);
    expect(stateStyles.activeBackground).not.toBe(stateStyles.inactiveBackground);
  }

  await page.evaluate(() => window.LandosTheme?.setPreference?.('dark'));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const darkPanelBackground = await nav.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(darkPanelBackground).toBe('rgba(5, 9, 19, 0.94)');
});

test('Lee-Lee Reports summarizes stored records and renders trend charts', async ({ page }) => {
  await openProtectedLeeLeeTracker(page);
  const recentDateKey = relativeLocalDateKey(-1);
  const olderDateKey = relativeLocalDateKey(-8);
  await page.evaluate(({ recentDateKey: recentKey, olderDateKey: olderKey }) => {
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
  await expect(reportsFilters.getByLabel('Date Range')).toHaveValue('last7');
  await expect(page.getByText('2 records from')).toBeVisible();
  await expect(page.getByLabel('Report options').getByText('7 completed days')).toBeVisible();
  const summarySection = page.getByLabel('Summary');
  await expect(page.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
  await expect(summarySection.getByText('Total insulin given')).toBeVisible();
  await expect(summarySection.getByText('23 units')).toBeVisible();
  await expect(summarySection.getByText('Long-lasting avg per day')).toBeVisible();
  await expect(summarySection.getByText(/1 administration .* expected bedtime doses recorded/)).toBeVisible();
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
  await reportsFilters.getByLabel('Start Date').fill(recentDateKey);
  await reportsFilters.getByLabel('End Date').fill(recentDateKey);
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
  await expect(calculator.locator('[name="carbCalcCarbs"]')).toHaveCount(0);
  await expect(calculator.locator('[name="carbCalcQty"]')).toHaveCount(0);
  await expect(calculator.getByRole('button', { name: '+ Add Food Item...' })).toBeFocused();
  await expect(calculator.getByText('No items added yet.')).toBeVisible();
  await expect(calculator.getByText('Total Carbs')).toBeVisible();
  await expect(calculator.getByRole('button', { name: 'Use 0 grams' })).toBeDisabled();

  await calculator.getByRole('button', { name: '+ Add Food Item...' }).click();
  await expect(calculator.getByRole('heading', { name: 'Add Food Item' })).toBeVisible();
  await expect(calculator.locator('[name="carbItemQty"]')).toBeFocused();
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
  await expect(calculator.getByRole('heading', { name: 'Edit Food Item' })).toBeVisible();
  await calculator.getByLabel('Quantity').fill('3');
  await calculator.getByLabel('Carbs per serving').fill('21');
  await calculator.getByRole('button', { name: 'Save Item' }).click();
  await expect(calculator.locator('[data-carb-calculator-row]')).toHaveCount(1);
  await expect(calculator.getByLabel('Meal Total')).toHaveText('63 g');

  await calculator.getByRole('button', { name: 'Use 63 grams' }).click();

  await expect(page.locator('[data-carb-calculator]')).toHaveCount(0);
  await expect(form.getByRole('button', { name: 'Open Carb Calculator' })).toBeFocused();
  await expect(form.getByRole('spinbutton', { name: 'Total Carbs' })).toHaveValue('63');
  await expect(form.getByText('Carb coverage: 63 g carbs ÷ 20 = 3.15 units')).toBeVisible();
  await expect(form.getByText('Raw dose: 5.15 units')).toBeVisible();
  await expect(form.getByText('Rounded to nearest 0.5-unit increment: 5 units')).toBeVisible();
  await expect(form.getByLabel('Insulin Actually Given')).toHaveValue('5');

  await form.getByRole('spinbutton', { name: 'Total Carbs' }).fill('70');
  await expect(form.getByText('Carb coverage: 70 g carbs ÷ 20 = 3.5 units')).toBeVisible();
  await expect(form.getByText('Rounded to nearest 0.5-unit increment: 5.5 units')).toBeVisible();
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
  await page.getByRole('button', { name: '+ Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByLabel('Blood Sugar').fill('299');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  await expect(calculator.getByText('No foods added yet.')).toBeVisible();
  await expect(calculator.locator('[data-carb-library-list]')).toHaveCount(0);
  const favoritesToggle = calculator.getByRole('button', { name: 'Favorites' });
  const recentToggle = calculator.getByRole('button', { name: 'Recent' });
  const myMealsToggle = calculator.getByRole('button', { name: 'My Meals' });
  await expect(favoritesToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(favoritesToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(favoritesToggle).toHaveAttribute('aria-controls', 'lee-lee-carb-picker-panel');
  await expect(myMealsToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(myMealsToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(calculator.getByText('Saved Meals')).toHaveCount(0);
  await expect(calculator.getByRole('button', { name: 'Add New Food' })).toHaveCount(0);
  await expect(calculator.getByRole('button', { name: 'Save as Meal' })).toHaveCount(0);

  await calculator.getByRole('button', { name: '+ Add Food Item...' }).click();
  await calculator.getByLabel('Quantity').fill('2');
  await calculator.getByLabel('Carbs per serving').fill('17');
  await calculator.getByRole('button', { name: 'Add Item' }).click();
  await expect(calculator.getByLabel('Meal Total')).toHaveText('34 g');
  await expect(calculator.getByText('Manual Amount')).toBeVisible();
  await expect(calculator.getByText('No foods added yet.')).toHaveCount(0);

  await favoritesToggle.click();
  const picker = calculator.locator('[data-carb-picker]');
  await expect(picker.getByRole('heading', { name: 'Favorites' })).toBeVisible();
  await expect(favoritesToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(favoritesToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(picker.getByRole('button', { name: /Banana 27 g carbs/ })).toBeVisible();
  await expect(picker.getByRole('button', { name: /Pasta 15 g carbs/ })).toBeVisible();
  await expect(picker.getByRole('button', { name: /Mark favorite|Remove favorite/ })).toHaveCount(0);
  await picker.getByRole('button', { name: /Banana 27 g carbs/ }).click();
  await expect(calculator.locator('[data-carb-picker]')).toHaveCount(0);
  await expect(calculator.getByLabel('Meal Total')).toHaveText('61 g');
  await expect(calculator.locator('[data-carb-calculator-row]').filter({ hasText: 'Banana' })).toBeVisible();
  await favoritesToggle.click();
  await expect(calculator.locator('[data-carb-picker]').getByRole('heading', { name: 'Favorites' })).toBeVisible();
  await picker.getByRole('button', { name: /Pasta 15 g carbs/ }).click();
  await expect(calculator.locator('[data-carb-picker]')).toHaveCount(0);
  await expect(calculator.getByLabel('Meal Total')).toHaveText('76 g');
  await expect(favoritesToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(favoritesToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(calculator.getByText('Selected Foods')).toHaveCount(0);
  await expect(calculator.locator('[data-carb-calculator-row]').filter({ hasText: 'Banana' })).toBeVisible();
  await expect(calculator.locator('[data-carb-calculator-row]').filter({ hasText: 'Pasta' })).toBeVisible();
  await expect(calculator.getByRole('button', { name: 'Save as My Meal' })).toBeVisible();

  await favoritesToggle.click();
  await expect(calculator.locator('[data-carb-picker]').getByRole('heading', { name: 'Favorites' })).toBeVisible();
  await recentToggle.click();
  await expect(calculator.locator('[data-carb-picker]').getByRole('heading', { name: 'Recent' })).toBeVisible();
  await expect(favoritesToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(recentToggle).toHaveAttribute('aria-expanded', 'true');
  await recentToggle.click();
  await expect(calculator.locator('[data-carb-picker]')).toHaveCount(0);
  await expect(recentToggle).toHaveAttribute('aria-expanded', 'false');

  await myMealsToggle.click();
  await expect(calculator.locator('[data-carb-picker]').getByRole('heading', { name: 'My Meals' })).toBeVisible();
  await expect(calculator.locator('[data-carb-picker]').getByRole('button', { name: /Lunch Combo/ })).toBeVisible();
  await myMealsToggle.click();
  await expect(calculator.locator('[data-carb-picker]')).toHaveCount(0);

  await calculator.getByRole('button', { name: 'My Foods' }).click();
  await expect(calculator.locator('[data-carb-picker]').getByRole('heading', { name: 'My Foods' })).toBeVisible();
  await expect(calculator.locator('[data-carb-picker]').getByRole('button', { name: '+ Add New Food' })).toBeVisible();
  await expect(calculator.getByRole('button', { name: 'Search', exact: true })).toHaveCount(0);
  await calculator.locator('[data-carb-picker]').getByRole('button', { name: 'Done' }).click();

  await calculator.getByRole('button', { name: 'Search foods...' }).click();
  const foodSearch = calculator.locator('[data-carb-picker="search"]').getByLabel('Search foods');
  const setFoodSearchQuery = async (query) => {
    await foodSearch.evaluate((input, nextQuery) => {
      input.value = nextQuery;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, query);
    await expect(foodSearch).toHaveValue(query);
  };
  await expect(calculator.locator('[data-carb-picker="search"]').getByRole('heading', { name: 'Food Search' })).toBeVisible();
  await expect(foodSearch).toBeFocused();
  await foodSearch.pressSequentially('c');
  await expect(foodSearch).toHaveValue('c');
  await expect(calculator.getByText('Type 2 or more characters to search.')).toBeVisible();
  await expect(calculator.locator('[data-carb-picker="search"] [data-action="add-food-to-carb-calculator"]')).toHaveCount(0);
  await foodSearch.pressSequentially('hicken nugget');
  await expect(foodSearch).toHaveValue('chicken nugget');
  await expect(foodSearch).toBeFocused();
  await expect(calculator.locator('[data-carb-picker="search"]').getByRole('heading', { name: 'Food Search' })).toBeVisible();
  await expect(calculator.locator('[data-carb-picker="search"]').getByRole('button', { name: /Chicken Nuggets \/ Tenders 15 g carbs/ })).toBeVisible();
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
  await expect(form.getByText('Carb coverage: 84 g carbs ÷ 20 = 4.2 units')).toBeVisible();
  await expect(form.getByText('Rounded to nearest 0.5-unit increment: 6 units')).toBeVisible();
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

  await page.getByRole('button', { name: '+ Log Entry' }).click();
  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  await expect(calculator.getByRole('button', { name: '+ Add Food Item...' })).toBeVisible();
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
  await expect(itemQty).toBeFocused();
  expect(await itemQty.evaluate((input) => input.getBoundingClientRect().width)).toBeLessThanOrEqual(46);
  await itemQty.fill('99');
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
  await page.getByRole('button', { name: '+ Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  await calculator.getByRole('button', { name: '+ Add Food Item...' }).click();
  const carbsInput = calculator.locator('[name="carbItemCarbs"]');
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
  await expect(calculator.getByLabel('Meal Total')).toHaveText('35 g');
  await expect(calculator.getByRole('button', { name: 'Edit Manual Amount' })).toBeFocused();

  await calculator.getByRole('button', { name: 'Use 35 grams' }).dispatchEvent('pointerdown');
  await calculator.getByRole('button', { name: 'Use 35 grams' }).dispatchEvent('pointerup');

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
  await expect(calculator).toBeVisible();
  await expect(calculator.getByRole('button', { name: '+ Add Food Item...' })).toBeFocused();
  await expect.poll(() => calculator.evaluate((node) => getComputedStyle(node).maxHeight)).toBe('100%');
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeOpen);

  await page.evaluate(() => {
    window.__leeLeeEditorSubmitCount = 0;
    document.querySelector('[data-lee-lee-editor]')?.addEventListener('submit', () => {
      window.__leeLeeEditorSubmitCount += 1;
    });
  });

  await calculator.getByRole('button', { name: '+ Add Food Item...' }).click();
  await expect(calculator.locator('[name="carbItemQty"]')).toBeFocused();
  await calculator.locator('[name="carbItemCarbs"]').fill('20');
  await expect(calculator).toBeVisible();
  await expect(calculator.locator('[name="carbItemCarbs"]')).toHaveValue('20');
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeOpen);

  await calculator.locator('[name="carbItemQty"]').click();
  await expect(calculator).toBeVisible();
  await expect(calculator.locator('[name="carbItemQty"]')).toBeFocused();
  await calculator.locator('[name="carbItemQty"]').fill('3');
  await calculator.getByRole('button', { name: 'Add Item' }).click();
  await expect(calculator.getByLabel('Meal Total')).toHaveText('60 g');
  await expect(calculator.locator('[data-carb-calculator-row]')).toHaveCount(1);
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
  await expect(calculator).toBeVisible();
  await expect(calculator.getByRole('button', { name: '+ Add Food Item...' })).toBeFocused();
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
  await expect(calculator.getByRole('button', { name: '+ Add Food Item...' })).toBeFocused();

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
  await calculator.getByRole('button', { name: '+ Add Food Item...' }).click();
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
  await page.getByRole('button', { name: '+ Log Entry' }).click();

  const form = page.locator('[data-lee-lee-editor]');
  await form.getByLabel('Context').selectOption('Dinner');
  await form.getByRole('button', { name: 'Open Carb Calculator' }).click();

  const calculator = page.locator('[data-carb-calculator]');
  await expect(calculator.locator('[name="carbCalcCarbs"]')).toHaveCount(0);
  await expect(calculator.locator('[name="carbCalcQty"]')).toHaveCount(0);

  await calculator.getByRole('button', { name: '+ Add Food Item...' }).click();
  await calculator.getByLabel('Carbs per serving').fill('23');
  await calculator.getByRole('button', { name: 'Add Item' }).click();
  await calculator.getByRole('button', { name: '+ Add Food Item...' }).click();
  await calculator.getByLabel('Quantity').fill('2');
  await calculator.getByLabel('Label').fill('Snack');
  await calculator.getByLabel('Carbs per serving').fill('15');
  await calculator.getByRole('button', { name: 'Add Item' }).click();
  await calculator.getByRole('button', { name: '+ Add Food Item...' }).click();
  await calculator.getByLabel('Carbs per serving').fill('47');
  await calculator.getByRole('button', { name: 'Add Item' }).click();

  await expect(calculator.locator('[data-carb-calculator-row]')).toHaveCount(3);
  await expect(calculator.getByLabel('Meal Total')).toHaveText('100 g');
  await expect(calculator.locator('.lee_lee_diabetes_carb_calc_operator')).toHaveText(['@', '@', '@']);

  await calculator.getByRole('button', { name: 'Edit Manual Amount' }).nth(1).click();
  await calculator.getByLabel('Quantity').fill('1.5');
  await calculator.getByLabel('Carbs per serving').fill('19');
  await calculator.getByRole('button', { name: 'Save Item' }).click();
  await expect(calculator.getByLabel('Meal Total')).toHaveText('72 g');

  expect(await calculator.locator('[tabindex]').count()).toBe(0);
});
