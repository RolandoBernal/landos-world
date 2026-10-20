((global) => {
  const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
  const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
  const CACHE_KEY = 'daily_chief_weather_cache_v1';
  const GEOCODE_CACHE_KEY = 'daily_chief_weather_geocode_cache_v1';
  const DEFAULT_TTL_MS = 20 * 60 * 1000;
  const DAYPART_HOURS = {
    Morning: 8,
    Afternoon: 14,
    Evening: 19,
    Night: 22,
  };
  const inFlight = new Map();
  const PREFERENCES_KEY = 'weather_app_preferences_v1';
  const CURRENT_KEY = 'device-current';
  let currentLocation = null; // Coordinates are memory-only and re-resolved after the refresh interval.
  let currentAttempt = null;
  let lastAttemptAt = 0;
  let locationNotice = '';
  let currentLocationError = '';

  function getLocationPreferences() {
    const prefs = readJson(PREFERENCES_KEY, {});
    const briefing = readJson('daily_chief_briefing_documents_v1', {});
    return {
      ...prefs,
      location: normalizeLocationQuery(prefs.location || briefing.preferences?.preferredLocation || 'Nashville, Tennessee').slice(0, 90),
      weatherLocationMode: prefs.weatherLocationMode === 'current' ? 'current' : 'saved',
    };
  }

  function saveLocationPreferences(mode, location) {
    const prefs = getLocationPreferences();
    writeJson(PREFERENCES_KEY, {
      ...prefs,
      location: normalizeLocationQuery(location || prefs.location).slice(0, 90),
      weatherLocationMode: mode === 'current' ? 'current' : 'saved',
    });
    locationNotice = '';
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    const timer = global.setTimeout(abort, 10000);
    try {
      const response = await global.fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Weather unavailable right now.');
      return await response.json();
    } finally {
      global.clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    }
  }

  async function detectCurrentLocation(requestPermission) {
    if (global.navigator?.onLine === false) throw new Error('You are offline.');
    if (!global.navigator?.geolocation) throw new Error('Device location is unavailable.');
    if (!requestPermission) {
      // Only an explicit Set may open a permission prompt. Older browsers without
      // the Permissions API can still enable/retry location from Settings.
      let permission;
      try { permission = await global.navigator.permissions?.query({ name: 'geolocation' }); } catch { /* unsupported */ }
      if (permission?.state !== 'granted') {
        throw new Error(permission?.state === 'denied' ? 'Location permission is denied.' : 'Select Current Location and tap Set to allow location access.');
      }
    }
    const position = await new Promise((resolve, reject) => {
      const timer = global.setTimeout(() => reject(new Error('Device location timed out.')), 9000);
      global.navigator.geolocation.getCurrentPosition(
        value => { global.clearTimeout(timer); resolve(value); },
        error => {
          global.clearTimeout(timer);
          reject(new Error(error.code === 1 ? 'Location permission is denied.' : error.code === 3 ? 'Device location timed out.' : 'Device location is unavailable.'));
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: DEFAULT_TTL_MS },
      );
    });
    const latitude = Number(position.coords.latitude);
    const longitude = Number(position.coords.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Device location is unavailable.');
    const payload = await fetchJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
    const city = payload.city || payload.locality;
    if (!city || !payload.countryCode) throw new Error('The current city could not be resolved.');
    return {
      locationIdentifier: CURRENT_KEY,
      locationName: [city, payload.principalSubdivision, payload.countryCode].filter(Boolean).join(', '),
      // City-scale coordinates also keep precise fixes out of the existing SW weather cache URLs.
      latitude: Math.round(latitude * 100) / 100, longitude: Math.round(longitude * 100) / 100,
      timezone: 'auto', resolvedAt: Date.now(),
    };
  }

  async function resolveCurrentLocation(options) {
    if (currentLocation && Date.now() - currentLocation.resolvedAt < DEFAULT_TTL_MS) return currentLocation;
    currentLocation = null;
    if (currentAttempt) return currentAttempt;
    if (!options.requestPermission && Date.now() - lastAttemptAt < DEFAULT_TTL_MS) throw new Error(currentLocationError || 'Current Location is temporarily unavailable.');
    lastAttemptAt = Date.now();
    currentAttempt = detectCurrentLocation(options.requestPermission).then(location => {
      currentLocation = location;
      currentLocationError = '';
      return location;
    }).catch(error => {
      currentLocationError = error.message;
      throw error;
    }).finally(() => { currentAttempt = null; });
    return currentAttempt;
  }

  async function getAppWeather(options = {}) {
    const prefs = getLocationPreferences();
    if (prefs.weatherLocationMode !== 'current') return getWeather(prefs.location, options);
    return getCurrentWeather(options);
  }

  // The launcher always follows the device; the full app chooses its own mode.
  // Both paths reuse the same fix, forecast cache, and permission/fallback rules.
  async function getCurrentWeather(options = {}) {
    const prefs = getLocationPreferences();
    try {
      const location = await resolveCurrentLocation(options);
      const result = await getWeatherForLocation(location, options);
      if (!result.snapshot) throw new Error('Weather for Current Location is unavailable.');
      locationNotice = result.error
        ? `Weather could not be refreshed. Showing last-known weather for ${result.snapshot.locationName}.`
        : `Current Location: ${result.snapshot.locationName}.`;
      return { ...result, locationNotice };
    } catch (error) {
      const cached = getCachedWeather(CURRENT_KEY, options);
      const fallback = cached ? { status: 'stale', snapshot: { ...cached, isStale: true } } : await getWeather(prefs.location, options).catch(() => ({ status: 'error', snapshot: null }));
      locationNotice = `${error.message} ${cached ? 'Showing last-known weather for' : 'Using saved city:'} ${fallback.snapshot?.locationName || prefs.location}.`;
      return { ...fallback, locationNotice };
    }
  }


  const CONDITION_MAP = new Map([
    [0, ['Clear', '☀️']],
    [1, ['Mostly clear', '🌤️']],
    [2, ['Partly cloudy', '⛅']],
    [3, ['Cloudy', '☁️']],
    [45, ['Fog', '🌫️']],
    [48, ['Fog', '🌫️']],
    [51, ['Light drizzle', '🌦️']],
    [53, ['Drizzle', '🌦️']],
    [55, ['Heavy drizzle', '🌧️']],
    [56, ['Freezing drizzle', '🌧️']],
    [57, ['Freezing drizzle', '🌧️']],
    [61, ['Light rain', '🌦️']],
    [63, ['Rain', '🌧️']],
    [65, ['Heavy rain', '🌧️']],
    [66, ['Freezing rain', '🌧️']],
    [67, ['Freezing rain', '🌧️']],
    [71, ['Light snow', '🌨️']],
    [73, ['Snow', '🌨️']],
    [75, ['Heavy snow', '❄️']],
    [77, ['Snow grains', '❄️']],
    [80, ['Rain showers', '🌦️']],
    [81, ['Rain showers', '🌧️']],
    [82, ['Heavy rain showers', '🌧️']],
    [85, ['Snow showers', '🌨️']],
    [86, ['Heavy snow showers', '❄️']],
    [95, ['Thunderstorm', '⛈️']],
    [96, ['Thunderstorm with hail', '⛈️']],
    [99, ['Thunderstorm with hail', '⛈️']],
  ]);

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(key) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      global.localStorage?.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  }

  function normalizeLocationQuery(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function locationCacheKey(locationName) {
    return normalizeLocationQuery(locationName).toLowerCase();
  }

  // Rendering only: preserve fetched units and Fahrenheit rounding in the snapshot.
  function formatTemperature(value, unitSystem = 'imperial') {
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' || !Number.isFinite(Number(value))) return '—';
    const temperature = Number(value);
    const fahrenheit = unitSystem === 'metric' ? Math.round(temperature * 9 / 5 + 32) : temperature;
    const celsius = Math.round(unitSystem === 'metric' ? temperature : (temperature - 32) * 5 / 9);
    return `<span class="lww_temperature_pair${String(fahrenheit).length >= 3 ? ' lww_temperature_pair--long' : ''}">${fahrenheit}°F<small class="lww_temperature_celsius"> ${celsius}°C</small></span>`;
  }

  function getCondition(code) {
    const [label, icon] = CONDITION_MAP.get(Number(code)) || ['Current conditions', '🌤️'];
    return {
      code: Number.isFinite(Number(code)) ? Number(code) : null,
      label,
      icon,
    };
  }

  function round(value) {
    return Number.isFinite(Number(value)) ? Math.round(Number(value)) : null;
  }

  function maxNumber(values) {
    const numbers = values.map(Number).filter(Number.isFinite);
    return numbers.length ? Math.max(...numbers) : null;
  }

  function findNearestHourIndex(times, targetHour) {
    if (!Array.isArray(times) || !times.length) return -1;
    let bestIndex = 0;
    let bestDistance = Infinity;
    times.forEach((time, index) => {
      const hourMatch = String(time).match(/T(\d{2})/);
      if (!hourMatch) return;
      const distance = Math.abs(Number(hourMatch[1]) - targetHour);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  function createDaypartForecast(label, hourly) {
    const index = findNearestHourIndex(hourly.time, DAYPART_HOURS[label]);
    if (index < 0) return null;
    const condition = getCondition(hourly.weather_code?.[index]);
    return {
      label,
      representativeTime: hourly.time[index],
      temperature: round(hourly.temperature_2m?.[index]),
      conditionCode: condition.code,
      conditionLabel: condition.label,
      conditionIcon: condition.icon,
      precipitationProbability: round(hourly.precipitation_probability?.[index]),
    };
  }

  function createWeatherCallout(snapshot, hourly) {
    const precipValues = Array.isArray(hourly.precipitation_probability) ? hourly.precipitation_probability : [];
    const maxPrecip = maxNumber(precipValues);
    if (maxPrecip == null || maxPrecip < 20) {
      return 'No meaningful rain is expected today.';
    }
    const wettestIndex = precipValues.findIndex((value) => Number(value) === maxPrecip);
    const wettestTime = hourly.time?.[wettestIndex];
    const hourMatch = String(wettestTime || '').match(/T(\d{2})/);
    if (hourMatch) {
      const date = new Date();
      date.setHours(Number(hourMatch[1]), 0, 0, 0);
      const label = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(date);
      return `Rain is most likely around ${label}.`;
    }
    const warmest = maxNumber(hourly.temperature_2m || []);
    if (warmest != null && snapshot.todayHigh != null && warmest >= snapshot.todayHigh - 1) {
      return 'The warmest part of the day is reflected in the afternoon forecast.';
    }
    return 'Rain chances are worth keeping an eye on today.';
  }

  function formatLocationName(result, fallback) {
    return [
      result?.name,
      result?.admin1,
      result?.country_code || result?.country,
    ].filter(Boolean).join(', ') || fallback;
  }

  async function geocodeLocation(locationName, options = {}) {
    const normalized = normalizeLocationQuery(locationName);
    if (!normalized) {
      throw new Error('Set your weather location first.');
    }
    const cache = readJson(GEOCODE_CACHE_KEY, {});
    const key = locationCacheKey(normalized);
    if (cache[key]?.latitude != null && cache[key]?.longitude != null) {
      return cache[key];
    }
    const url = `${GEOCODING_ENDPOINT}?name=${encodeURIComponent(normalized)}&count=1&language=en&format=json`;
    const payload = await fetchJson(url, options);
    const result = payload?.results?.[0];
    if (!result || result.latitude == null || result.longitude == null) {
      throw new Error('Weather location could not be resolved.');
    }
    const resolved = {
      locationIdentifier: key,
      locationName: formatLocationName(result, normalized),
      latitude: Number(result.latitude),
      longitude: Number(result.longitude),
      timezone: result.timezone || 'auto',
    };
    writeJson(GEOCODE_CACHE_KEY, { ...cache, [key]: resolved });
    return resolved;
  }

  function buildForecastUrl(location, unitSystem = 'imperial') {
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
      hourly: 'temperature_2m,apparent_temperature,weather_code,precipitation_probability,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max',
      forecast_days: '7',
      timezone: 'auto',
      temperature_unit: unitSystem === 'metric' ? 'celsius' : 'fahrenheit',
      wind_speed_unit: unitSystem === 'metric' ? 'kmh' : 'mph',
    });
    return `${FORECAST_ENDPOINT}?${params.toString()}`;
  }

  function normalizeForecastPayload(payload, location, unitSystem = 'imperial', fetchedAt = Date.now()) {
    const current = payload?.current || {};
    const hourly = payload?.hourly || {};
    const daily = payload?.daily || {};
    const condition = getCondition(current.weather_code);
    const snapshot = {
      locationIdentifier: location.locationIdentifier,
      locationName: location.locationName,
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: payload?.timezone || location.timezone || '',
      unitSystem,
      temperatureUnit: unitSystem === 'metric' ? '°C' : '°F',
      windSpeedUnit: unitSystem === 'metric' ? 'km/h' : 'mph',
      currentTemperature: round(current.temperature_2m),
      apparentTemperature: round(current.apparent_temperature),
      humidity: round(current.relative_humidity_2m),
      currentConditionCode: condition.code,
      currentConditionLabel: condition.label,
      currentConditionIcon: condition.icon,
      todayHigh: round(daily.temperature_2m_max?.[0]),
      todayLow: round(daily.temperature_2m_min?.[0]),
      precipitationProbability: round(daily.precipitation_probability_max?.[0] ?? maxNumber(hourly.precipitation_probability || [])),
      windSpeed: round(current.wind_speed_10m),
      morningForecast: createDaypartForecast('Morning', hourly),
      afternoonForecast: createDaypartForecast('Afternoon', hourly),
      eveningForecast: createDaypartForecast('Evening', hourly),
      nightForecast: createDaypartForecast('Night', hourly),
      weeklyForecast: createWeeklyForecast(daily),
      fetchedAt,
      source: 'Open-Meteo',
      isStale: false,
    };
    snapshot.callout = createWeatherCallout(snapshot, hourly);
    return snapshot;
  }

  function createWeeklyForecast(daily) {
    const times = Array.isArray(daily.time) ? daily.time : [];
    return times.slice(0, 7).map((dateKey, index) => {
      const condition = getCondition(daily.weather_code?.[index]);
      return {
        dateKey,
        label: index === 0 ? 'Today' : formatWeekday(dateKey),
        conditionCode: condition.code,
        conditionLabel: condition.label,
        conditionIcon: condition.icon,
        high: round(daily.temperature_2m_max?.[index]),
        low: round(daily.temperature_2m_min?.[index]),
        precipitationProbability: round(daily.precipitation_probability_max?.[index]),
        windSpeed: round(daily.wind_speed_10m_max?.[index]),
      };
    });
  }

  function formatWeekday(dateKey) {
    const date = new Date(`${dateKey}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
  }

  function readCache() {
    return readJson(CACHE_KEY, {});
  }

  function writeSnapshot(snapshot) {
    const cache = readCache();
    const stored = { ...snapshot };
    if (snapshot.locationIdentifier === CURRENT_KEY) {
      delete stored.latitude;
      delete stored.longitude;
    }
    writeJson(CACHE_KEY, { ...cache, [snapshot.locationIdentifier]: stored });
  }

  function readCachedSnapshot(locationIdentifier, ttlMs = DEFAULT_TTL_MS) {
    const snapshot = readCache()[locationIdentifier] || null;
    if (!snapshot?.fetchedAt) return null;
    return {
      ...snapshot,
      isStale: Date.now() - Number(snapshot.fetchedAt) >= ttlMs,
    };
  }

  function clearLocation(locationName) {
    const key = locationCacheKey(locationName);
    if (!key) return;
    const cache = readCache();
    if (cache[key]) {
      delete cache[key];
      writeJson(CACHE_KEY, cache);
    }
  }

  async function fetchForecastForLocation(location, options = {}) {
    const payload = await fetchJson(buildForecastUrl(location, options.unitSystem), options);
    return normalizeForecastPayload(payload, location, options.unitSystem, Date.now());
  }

  async function getWeather(locationName, options = {}) {
    const normalized = normalizeLocationQuery(locationName);
    if (!normalized) {
      return { status: 'needs-location', snapshot: null, error: 'Set your weather location first.' };
    }
    const location = await geocodeLocation(normalized, options);
    return getWeatherForLocation(location, options);
  }

  async function getWeatherForLocation(location, options = {}) {
    const candidate = readCachedSnapshot(location.locationIdentifier, options.ttlMs);
    const cached = candidate && (candidate.unitSystem || 'imperial') === (options.unitSystem || 'imperial')
      && (location.locationIdentifier !== CURRENT_KEY || candidate.locationName === location.locationName) ? candidate : null;
    if (cached && !cached.isStale && !options.force) {
      return { status: 'ready', snapshot: cached, stale: false };
    }
    const flightKey = `${location.locationIdentifier}:${options.unitSystem || 'imperial'}`;
    if (inFlight.has(flightKey)) {
      return inFlight.get(flightKey);
    }
    const request = fetchForecastForLocation(location, options)
      .then((snapshot) => {
        writeSnapshot(snapshot);
        return { status: 'ready', snapshot, stale: false };
      })
      .catch((error) => {
        if (cached) {
          return { status: 'stale', snapshot: cached, stale: true, error: error.message };
        }
        return { status: 'error', snapshot: null, error: error.message || 'Weather unavailable right now.' };
      })
      .finally(() => {
        inFlight.delete(flightKey);
      });
    inFlight.set(flightKey, request);
    return request;
  }

  function getCachedWeather(locationName, options = {}) {
    const key = locationCacheKey(locationName);
    const cached = key ? readCachedSnapshot(key, options.ttlMs) : null;
    return cached && (cached.unitSystem || 'imperial') === (options.unitSystem || 'imperial') ? cached : null;
  }

  global.LandosWeatherService = {
    getLocationPreferences,
    saveLocationPreferences,
    getAppWeather,
    getCurrentWeather,
    CACHE_KEY,
    GEOCODE_CACHE_KEY,
    DEFAULT_TTL_MS,
    normalizeLocationQuery,
    getCondition,
    formatTemperature,
    normalizeForecastPayload,
    createDaypartForecast,
    createWeeklyForecast,
    createWeatherCallout,
    geocodeLocation,
    getWeather,
    getCachedWeather,
    clearLocation,
    _test: {
      buildForecastUrl,
      findNearestHourIndex,
      locationCacheKey,
      readCachedSnapshot,
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
