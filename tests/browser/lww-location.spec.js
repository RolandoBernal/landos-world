import { test, expect } from '@playwright/test';

const forecast = temperature => ({
  current: { temperature_2m: temperature, apparent_temperature: temperature - 6, relative_humidity_2m: 55, wind_speed_10m: 7, weather_code: 0 },
  hourly: { time: ['2026-10-20T08:00', '2026-10-20T14:00', '2026-10-20T19:00', '2026-10-20T22:00'], temperature_2m: [45, 61, 56, 32], weather_code: [0, 0, 0, 0] },
  daily: { time: ['2026-10-20'], temperature_2m_max: [temperature + 8], temperature_2m_min: [temperature - 9] },
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    window.locationCalls = 0;
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition(success, failure) {
      window.locationCalls++;
      if (window.denyLocation || sessionStorage.getItem('denyLocation')) failure({ code: 1 });
      else success({ coords: { latitude: 35.9251, longitude: -86.8689 } });
    } } });
    Object.defineProperty(navigator, 'permissions', { value: { query: async () => ({ state: 'granted' }) } });
  });
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
  await page.route('https://api.bigdatacloud.net/**', route => route.fulfill({ json: { city: 'Franklin', principalSubdivision: 'Tennessee', countryCode: 'US' } }));
  await page.route(/geocoding-api.open-meteo.com/, route => {
    const query = new URL(route.request().url()).searchParams.get('name');
    const chicago = query.includes('Chicago');
    const austin = query.includes('Austin');
    return route.fulfill({ json: { results: [{ name: chicago ? 'Chicago' : austin ? 'Austin' : 'Nashville', admin1: chicago ? 'Illinois' : austin ? 'Texas' : 'Tennessee', country_code: 'US', latitude: chicago ? 41.88 : austin ? 30.27 : 36.16, longitude: -87 }] } });
  });
  await page.route(/https:\/\/api\.open-meteo\.com\//, route => {
    const lat = new URL(route.request().url()).searchParams.get('latitude');
    return route.fulfill({ json: forecast(lat === '35.93' ? 61 : lat === '41.88' ? 49 : 78) });
  });
});

async function settings(page) {
  await page.goto('/#/weather');
  await expect(page.locator('.weather_current_temp')).toBeVisible();
  await page.getByRole('button', { name: 'Weather Settings', exact: true }).click();
}
const set = page => page.getByRole('button', { name: 'Set', exact: true }).click();

test('current location agrees across app and unchanged launcher, persists, and switches back to saved city', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await settings(page);
  await expect(page.locator('#weather-location-mode option').first()).toHaveText('Current Location');
  await expect(page.locator('#weather-location-mode')).toHaveValue('saved');
  const dateBefore = await page.locator('[data-launcher-weather-date]').textContent();
  await page.locator('#weather-location-mode').selectOption('current');
  await set(page);
  await expect(page.locator('[data-weather-location-status]')).toContainText('Current Location: Franklin, Tennessee, US');
  await expect(page.locator('[data-launcher-weather="weather"]')).toContainText('61°F');
  await expect(page.locator('.clock_utility_weather_location')).toHaveText('Franklin, Tennessee, US');
  await expect(page.locator('[data-launcher-weather-date]')).toHaveText(dateBefore);
  await expect(page.locator('[data-launcher-weather="weather"] button')).toHaveCount(0);
  expect(await page.evaluate(() => window.locationCalls)).toBe(1);
  expect(await page.locator('.weather_settings_form').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Close Weather Settings' }).click();
  await expect(page.locator('.weather_location')).toHaveText('Franklin, Tennessee, US');
  await expect(page.locator('.weather_current_temp')).toHaveText('61°F 16°C');
  await expect(page.locator('.weather_current_details')).toContainText('69°F 21°C / 52°F 11°C');
  await page.reload();
  await expect(page.locator('.weather_location')).toHaveText('Franklin, Tennessee, US');
  await page.getByRole('button', { name: 'Weather Settings', exact: true }).click();
  await expect(page.locator('#weather-location-mode')).toHaveValue('current');
  await page.locator('#weather-location-mode').selectOption('saved');
  await expect(page.locator('#weather-location')).toHaveValue('Nashville, Tennessee');
  await set(page);
  await expect(page.locator('.clock_utility_weather_location')).toHaveText('Franklin, Tennessee, US');
  await page.getByRole('button', { name: 'Close Weather Settings' }).click();
  await expect(page.locator('.weather_location')).toContainText('Nashville');
});

test('popular cities and manual entry use the existing Set interaction', async ({ page }) => {
  await settings(page);
  await page.locator('#weather-popular-city').selectOption('Chicago, Illinois');
  await set(page);
  await expect(page.locator('.clock_utility_weather_location')).toHaveText('Franklin, Tennessee, US');
  await expect(page.locator('[data-launcher-weather="weather"]')).toContainText('61°F');
  await page.getByRole('button', { name: 'Close Weather Settings' }).click();
  await expect(page.locator('.weather_location')).toHaveText('Chicago, Illinois, US');
  await expect(page.locator('.weather_current_temp')).toHaveText('49°F 9°C');
  await page.getByRole('button', { name: 'Weather Settings', exact: true }).click();
  await page.locator('#weather-location').fill('Austin, Texas');
  await set(page);
  await expect(page.locator('.clock_utility_weather_location')).toHaveText('Franklin, Tennessee, US');
  await page.getByRole('button', { name: 'Close Weather Settings' }).click();
  await expect(page.locator('.weather_location')).toHaveText('Austin, Texas, US');
  await page.reload();
  await page.getByRole('button', { name: 'Weather Settings', exact: true }).click();
  await expect(page.locator('#weather-location')).toHaveValue('Austin, Texas');
});

test('denial retains last-known device weather without changing the selected mode', async ({ page }) => {
  await settings(page);
  await expect(page.locator('.clock_utility_weather_location')).toHaveText('Franklin, Tennessee, US');
  await page.evaluate(() => { sessionStorage.setItem('denyLocation', 'true'); });
  await page.reload();
  await page.getByRole('button', { name: 'Weather Settings', exact: true }).click();
  await page.locator('#weather-location-mode').selectOption('current');
  await set(page);
  await expect(page.locator('[data-weather-location-status]')).toContainText('Location permission is denied. Showing last-known weather for Franklin');
  await expect(page.locator('.clock_utility_weather_location')).toHaveText('Franklin, Tennessee, US');
  await expect(page.locator('#weather-location-mode')).toHaveValue('current');
});

test('a late current-location response cannot overwrite a newer saved city selection', async ({ page }) => {
  let release;
  await page.route('https://api.bigdatacloud.net/**', async route => {
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({ json: { city: 'Franklin', principalSubdivision: 'Tennessee', countryCode: 'US' } });
  });
  await settings(page);
  await page.locator('#weather-location-mode').selectOption('current');
  await set(page);
  await expect.poll(() => Boolean(release)).toBe(true);
  await page.locator('#weather-location-mode').selectOption('saved');
  await page.locator('#weather-popular-city').selectOption('Chicago, Illinois');
  // Set stays disabled during a request, so send a second preference change as
  // another browser tab would, then release the original network response.
  await page.evaluate(() => {
    const prefs = { location: 'Chicago, Illinois', weatherLocationMode: 'saved' };
    localStorage.setItem('weather_app_preferences_v1', JSON.stringify(prefs));
    window.dispatchEvent(new StorageEvent('storage', { key: 'weather_app_preferences_v1' }));
  });
  await expect(page.locator('.weather_settings_status')).toContainText('Weather loaded for Chicago');
  release();
  await expect(page.locator('.clock_utility_weather_location')).toHaveText('Franklin, Tennessee, US');
  await expect(page.locator('.weather_settings_status')).toContainText('Weather loaded for Chicago');
  await page.getByRole('button', { name: 'Close Weather Settings' }).click();
  await expect(page.locator('.weather_location')).toHaveText('Chicago, Illinois, US');
  await expect(page.locator('.weather_current_temp')).toHaveText('49°F 9°C');
});


test('landing card shows device Nashville while the full app uses Vancouver', async ({ page }) => {
  await page.route('https://api.bigdatacloud.net/**', route => route.fulfill({ json: { city: 'Nashville', principalSubdivision: 'Tennessee', countryCode: 'US' } }));
  await page.route(/geocoding-api.open-meteo.com/, route => route.fulfill({ json: { results: [{ name: 'Vancouver', admin1: 'British Columbia', country_code: 'CA', latitude: 49.28, longitude: -123.12 }] } }));
  await settings(page);
  await page.locator('#weather-popular-city').selectOption('Vancouver, Canada');
  await set(page);
  await expect(page.locator('.clock_utility_weather_location')).toHaveText('Nashville, Tennessee, US');
  await expect(page.locator('[data-launcher-weather="weather"]')).toContainText('61°F');
  await expect(page.locator('.clock_utility_weather_range')).toContainText('69°F 21°C · L 52°F 11°C');
  await page.getByRole('button', { name: 'Close Weather Settings' }).click();
  await expect(page.locator('.weather_location')).toHaveText('Vancouver, British Columbia, CA');
  await expect(page.locator('.weather_current_temp')).toHaveText('78°F 26°C');
  await expect(page.locator('.weather_current_details')).toContainText('86°F 30°C / 69°F 21°C');
  await page.getByRole('link', { name: "Return to Lando's World home", exact: true }).filter({ visible: true }).click();
  await expect(page.locator('.clock_utility_weather_location')).toHaveText('Nashville, Tennessee, US');
  await page.reload();
  await expect(page.locator('.clock_utility_weather_location')).toHaveText('Nashville, Tennessee, US');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('weather_app_preferences_v1')).location)).toBe('Vancouver, Canada');
});


test('paired Celsius covers every weather temperature and fits both themes on desktop and iPhone', async ({ page }) => {
  await page.goto('/#/weather');
  await expect(page.locator('.weather_current_temp')).toHaveText('78°F 26°C');
  await expect(page.locator('.weather_current_details div').filter({ has: page.locator('dt', { hasText: 'Feels Like' }) })).toContainText('72°F 22°C');
  await expect(page.locator('.weather_current_details')).toContainText('86°F 30°C / 69°F 21°C');
  await expect(page.locator('.weather_daypart_card .lww_temperature_celsius')).toHaveText(['7°C', '16°C', '13°C', '0°C']);
  await expect(page.locator('.weather_week_card .lww_temperature_celsius')).toHaveText(['30°C', '21°C']);
  for (const name of ['Humidity', 'Wind', 'Rain', 'Updated']) {
    await expect(page.locator('.weather_current_details div').filter({ has: page.locator('dt', { hasText: name }) }).locator('.lww_temperature_celsius')).toHaveCount(0);
  }
  await expect(page.locator('.weather_ride .lww_temperature_celsius')).toHaveCount(0);
  for (const width of [1280, 393, 320]) {
    await page.setViewportSize({ width, height: 852 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => window.LandosTheme.setPreference(value), theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const geometry = await page.locator('.weather_hero').evaluate(el => {
        const pair = el.querySelector('.weather_current_temp .lww_temperature_pair');
        const secondary = pair.querySelector('small');
        return { fits: el.scrollWidth <= el.clientWidth, primary: parseFloat(getComputedStyle(pair).fontSize), secondary: parseFloat(getComputedStyle(secondary).fontSize), color: getComputedStyle(secondary).color, ink: getComputedStyle(pair).color };
      });
      expect(geometry.fits).toBe(true);
      expect(geometry.secondary / geometry.primary).toBeCloseTo(0.45, 2);
      expect(geometry.color).not.toBe(geometry.ink);
      expect(await page.locator('#weather-root').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await page.locator('.weather_daypart_card, .weather_week_card').evaluateAll(cards => cards.every(el => el.scrollWidth <= el.clientWidth))).toBe(true);
      if (width !== 320) await page.locator('.weather_hero').screenshot({ path: `/tmp/lww-celsius-${width}-${theme}-hero.png` });
      await page.goto('/#/');
      await expect(page.locator('.clock_utility_weather_temp')).toHaveText('61°F 16°C');
      await expect(page.locator('.clock_utility_weather_range')).toContainText('H 69°F 21°C · L 52°F 11°C');
      expect(await page.locator('.clock_utility_card--weather').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await page.locator('.clock_utility_weather_summary').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      if (width !== 320) await page.locator('.clock_utility_card--weather').screenshot({ path: `/tmp/lww-celsius-${width}-${theme}-card.png` });
      await page.goto('/#/weather');
    }
  }
});

test('three-digit and negative temperatures fit narrow screens without invalid Celsius', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 852 });
  await page.route(/https:\/\/api\.open-meteo\.com\//, route => route.fulfill({ json: forecast(100) }));
  await page.goto('/#/weather');
  await expect(page.locator('.weather_current_temp')).toHaveText('100°F 38°C');
  expect(await page.locator('.weather_hero').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.evaluate(() => {
    const service = window.LandosWeatherService;
    for (const el of document.querySelectorAll('.weather_current_temp')) el.innerHTML = service.formatTemperature(-40);
  });
  await expect(page.locator('.weather_current_temp')).toHaveText('-40°F -40°C');
  expect(await page.locator('.weather_hero').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});
