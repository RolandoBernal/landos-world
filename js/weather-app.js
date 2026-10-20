(() => {
  const CACHE_RECHECK_MS = 20 * 60 * 1000;

  let state = {
    location: loadLocationPreference(),
    view: 'home',
    status: 'idle',
    snapshot: null,
    error: '',
    notice: '',
    noticeTone: 'status',
    isRefreshing: false,
    lastVisibleRefreshAt: 0,
  };
  let initialized = false;
  let weatherRequest = 0;
  const POPULAR_CITIES = {
    'United States': ['Nashville, Tennessee', 'New York, New York', 'Los Angeles, California', 'Chicago, Illinois', 'Miami, Florida', 'Atlanta, Georgia', 'San Francisco, California', 'Seattle, Washington', 'Boston, Massachusetts', 'Washington, DC'],
    International: ['Mexico City, Mexico', 'Cancún, Mexico', 'London, United Kingdom', 'Paris, France', 'Madrid, Spain', 'Barcelona, Spain', 'Rome, Italy', 'Tokyo, Japan', 'Toronto, Canada', 'Vancouver, Canada', 'Sydney, Australia', 'Berlin, Germany'],
  };

  function getRoot() {
    return document.getElementById('weather-root');
  }

  function loadLocationPreference() {
    return window.LandosWeatherService.getLocationPreferences().location;
  }

  function sanitizeLocation(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 90);
  }

  function getUnitSystem() {
    try {
      const parsed = JSON.parse(localStorage.getItem('digit_clock_preferences_v1') || 'null');
      return parsed?.unit === 'C' ? 'metric' : 'imperial';
    } catch {
      return 'imperial';
    }
  }

  function formatTime(timestamp) {
    return new Intl.DateTimeFormat(navigator.language || undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp || Date.now()));
  }

  function formatValue(value, suffix = '') {
    return value == null ? '—' : `${value}${suffix}`;
  }

  function friendlyWeatherError(error) {
    const message = String(error || '');
    if (/location could not be resolved|set your weather location/i.test(message)) {
      return 'That location could not be found. Try a city and state.';
    }
    return 'Weather unavailable right now.';
  }

  function dayparts(snapshot) {
    return [
      snapshot?.morningForecast,
      snapshot?.afternoonForecast,
      snapshot?.eveningForecast,
      snapshot?.nightForecast,
    ].filter(Boolean);
  }

  function getRideNote(snapshot) {
    if (!snapshot) return '';
    const rain = Number(snapshot.precipitationProbability || 0);
    const high = Number(snapshot.todayHigh || snapshot.currentTemperature || 0);
    if (rain >= 45) return 'Rain expected later today.\nMorning is your best window.';
    if (high >= 88) return 'Warm afternoon.\nRide early if possible.';
    if (rain <= 15 && high <= 84) return 'Excellent morning riding weather.';
    return 'A calm window looks possible today.\nCheck conditions before heading out.';
  }

  function render() {
    const root = getRoot();
    if (!root) return;
    syncSettingsToggle();
    const content = state.view === 'settings'
      ? renderSettings()
      : `${renderHero()}${renderMainContent()}`;
    root.innerHTML = `
      <section class="weather_app" aria-labelledby="${state.view === 'settings' ? 'weather-settings-title' : 'weather-title'}">
        ${content}
      </section>
    `;
  }

  function syncSettingsToggle() {
    const toggle = document.querySelector('[data-weather-action="settings"]');
    if (!toggle) return;
    const isOpen = state.view === 'settings';
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Close Weather Settings' : 'Weather Settings');
    toggle.setAttribute('title', isOpen ? 'Close Settings' : 'Settings');
  }

  function renderHero() {
    const snapshot = state.snapshot;
    const unit = snapshot?.temperatureUnit || '°F';
    const offlineNote = navigator.onLine === false && snapshot
      ? '<p class="weather_offline_note">Offline - showing last downloaded forecast.</p>'
      : '';
    return `
      <header class="weather_hero">
        ${state.status === 'loading' && !snapshot ? renderHeroSkeleton() : ''}
        ${state.status === 'error' && !snapshot ? renderErrorState() : ''}
        ${snapshot ? `
          <div class="weather_hero_content">
            <div>
              <p class="weather_location">${escapeHtml(snapshot.locationName || state.location)}</p>
              <h1 id="weather-title">Weather</h1>
              <div class="weather_current_temp">${escapeHtml(formatValue(snapshot.currentTemperature, unit))}</div>
              <p class="weather_condition"><span role="img" aria-label="${escapeHtml(snapshot.currentConditionLabel)}">${escapeHtml(snapshot.currentConditionIcon || '🌤️')}</span> ${escapeHtml(snapshot.currentConditionLabel || 'Current conditions')}</p>
            </div>
            <dl class="weather_current_details">
              ${renderDetail('Feels Like', formatValue(snapshot.apparentTemperature, unit))}
              ${renderDetail('High / Low', `${formatValue(snapshot.todayHigh, unit)} / ${formatValue(snapshot.todayLow, unit)}`)}
              ${renderDetail('Humidity', formatValue(snapshot.humidity, '%'))}
              ${renderDetail('Wind', formatValue(snapshot.windSpeed, ` ${snapshot.windSpeedUnit || 'mph'}`))}
              ${renderDetail('Rain', formatValue(snapshot.precipitationProbability, '%'))}
              ${renderDetail('Updated', formatTime(snapshot.fetchedAt))}
            </dl>
          </div>
          ${offlineNote}
          ${state.error ? `<p class="weather_error_note" role="status">${escapeHtml(state.error)} Showing the last successfully loaded weather data.</p>` : ''}
        ` : ''}
      </header>
    `;
  }

  function renderSettings() {
    const currentMode = window.LandosWeatherService.getLocationPreferences().weatherLocationMode === 'current';
    const updated = state.snapshot?.fetchedAt ? `Last updated ${formatTime(state.snapshot.fetchedAt)}` : 'No weather has been loaded yet.';
    const notice = state.isRefreshing
      ? 'Refreshing weather…'
      : state.error
        ? `${state.error} Showing the last successfully loaded weather data.`
        : state.notice;
    return `
      <section class="weather_settings" aria-labelledby="weather-settings-title">
        <header class="weather_settings_header">
          <div>
            <p class="weather_settings_kicker">Weather</p>
            <h1 id="weather-settings-title">Weather Settings</h1>
          </div>
        </header>
        <section class="weather_settings_panel" aria-labelledby="weather-location-title">
          <h2 id="weather-location-title">Location</h2>
          <form class="weather_settings_form" data-weather-form="location">
            <label for="weather-location-mode">Weather location</label>
            <select id="weather-location-mode" name="mode">
              <option value="current" ${currentMode ? 'selected' : ''}>Current Location</option>
              <option value="saved" ${currentMode ? '' : 'selected'}>Choose a City</option>
            </select>
            <div data-weather-city-fields ${currentMode ? 'hidden' : ''}>
              <label for="weather-popular-city">City</label>
              <select id="weather-popular-city">
                <option value="">Saved city / Enter another city</option>
                ${Object.entries(POPULAR_CITIES).map(([group, cities]) => `<optgroup label="${group}">${cities.map(city => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`).join('')}</optgroup>`).join('')}
              </select>
              <label for="weather-location">City and state / region</label>
              <input id="weather-location" name="location" value="${escapeHtml(state.location)}" maxlength="90" autocomplete="address-level2" required ${currentMode ? 'disabled' : ''}>
            </div>
            <div class="weather_settings_location_row">
              <button type="submit" class="weather_settings_button weather_settings_button--primary" ${state.isRefreshing ? 'disabled' : ''}>Set</button>
            </div>
            <p class="weather_settings_help">Tap Set to apply. Current Location requests device permission and refreshes occasionally while open. Your saved city is kept as a fallback.</p>
            <p class="weather_settings_help">Current Location sends coordinates to BigDataCloud to find the city and to Open-Meteo for weather.</p>
            <p class="weather_settings_help" data-weather-location-status role="status">${escapeHtml(state.locationNotice || '')}</p>
          </form>
        </section>
        <section class="weather_settings_panel" aria-labelledby="weather-refresh-title">
          <div class="weather_settings_panel_header">
            <div>
              <h2 id="weather-refresh-title">Weather data</h2>
              <p class="weather_last_updated">${escapeHtml(updated)}</p>
            </div>
            <button type="button" class="weather_settings_button weather_settings_button--primary" data-weather-action="refresh" ${state.isRefreshing ? 'disabled' : ''}>${state.isRefreshing ? 'Refreshing…' : 'Refresh'}</button>
          </div>
          <div class="weather_settings_status weather_settings_status--${escapeHtml(state.noticeTone)}" role="status" aria-live="polite" ${notice ? '' : 'hidden'}>${escapeHtml(notice)}</div>
        </section>
      </section>
    `;
  }

  function renderMainContent() {
    if (!state.snapshot) return '';
    return `
      <main class="weather_sections">
        ${renderTodayForecast(state.snapshot)}
        ${renderWeeklyForecast(state.snapshot)}
        ${renderRideToday(state.snapshot)}
      </main>
    `;
  }

  function renderDetail(label, value) {
    return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
  }

  function renderTodayForecast(snapshot) {
    return `
      <section class="weather_section" aria-labelledby="weather-today-title">
        <h2 id="weather-today-title">Today</h2>
        <div class="weather_dayparts">
          ${dayparts(snapshot).map(renderDaypartCard).join('')}
        </div>
      </section>
    `;
  }

  function renderDaypartCard(daypart) {
    const unit = state.snapshot?.temperatureUnit || '°F';
    return `
      <article class="weather_daypart_card">
        <span class="weather_card_label">${escapeHtml(daypart.label)}</span>
        <span class="weather_card_icon" role="img" aria-label="${escapeHtml(daypart.conditionLabel)}">${escapeHtml(daypart.conditionIcon || '🌤️')}</span>
        <strong>${escapeHtml(formatValue(daypart.temperature, unit))}</strong>
        <span>${escapeHtml(daypart.conditionLabel || 'Conditions')}</span>
        <small>Rain ${escapeHtml(formatValue(daypart.precipitationProbability, '%'))}</small>
      </article>
    `;
  }

  function renderWeeklyForecast(snapshot) {
    const unit = snapshot.temperatureUnit || '°F';
    const windUnit = snapshot.windSpeedUnit || 'mph';
    return `
      <section class="weather_section" aria-labelledby="weather-week-title">
        <h2 id="weather-week-title">This Week</h2>
        <div class="weather_week">
          ${(snapshot.weeklyForecast || []).map((day) => `
            <article class="weather_week_card">
              <span class="weather_card_label">${escapeHtml(day.label)}</span>
              <span class="weather_card_icon" role="img" aria-label="${escapeHtml(day.conditionLabel)}">${escapeHtml(day.conditionIcon || '🌤️')}</span>
              <strong>${escapeHtml(formatValue(day.high, unit))}</strong>
              <span class="weather_week_low">${escapeHtml(formatValue(day.low, unit))}</span>
              <span>${escapeHtml(day.conditionLabel || 'Conditions')}</span>
              <small>Rain ${escapeHtml(formatValue(day.precipitationProbability, '%'))} · Wind ${escapeHtml(formatValue(day.windSpeed, ` ${windUnit}`))}</small>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderRideToday(snapshot) {
    const lines = getRideNote(snapshot).split('\n').slice(0, 2);
    return `
      <section class="weather_ride" aria-labelledby="weather-ride-title">
        <h2 id="weather-ride-title">🚴 Ride Today</h2>
        ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
      </section>
    `;
  }

  function renderHeroSkeleton() {
    return `
      <div class="weather_skeleton" role="status" aria-live="polite">
        <span></span><span></span><span></span><span></span>
        <p>Loading weather...</p>
      </div>
    `;
  }

  function renderErrorState() {
    return `
      <div class="weather_error" role="status">
        <h1 id="weather-title">Weather</h1>
        <p>Weather cannot be loaded right now.</p>
      </div>
    `;
  }

  async function loadWeather(options = {}) {
    const service = window.LandosWeatherService;
    if (!service || (state.isRefreshing && options.reason !== 'location')) return;
    const request = ++weatherRequest;
    const selection = JSON.stringify(service.getLocationPreferences());
    state = { ...state, isRefreshing: true, error: '', status: state.snapshot ? state.status : 'loading' };
    render();
    let result;
    try {
      result = await service.getAppWeather({
        requestPermission: Boolean(options.requestPermission),
        force: Boolean(options.force),
        unitSystem: getUnitSystem(),
        ttlMs: CACHE_RECHECK_MS,
      });
    } catch (error) {
      result = {
        status: state.snapshot ? 'stale' : 'error',
        snapshot: state.snapshot,
        error: friendlyWeatherError(error?.message),
      };
    }
    if (request !== weatherRequest || selection !== JSON.stringify(service.getLocationPreferences())) return;
    const failed = Boolean(result.error);
    const errorMessage = failed ? friendlyWeatherError(result.error) : '';
    const successNotice = options.reason === 'location'
      ? `Weather loaded for ${service.getLocationPreferences().weatherLocationMode === 'current' ? result.snapshot?.locationName || state.location : state.location}.`
      : options.reason === 'refresh' ? 'Weather refreshed.' : '';
    state = {
      ...state,
      status: result.status,
      locationNotice: result.locationNotice || '',
      snapshot: result.snapshot,
      error: errorMessage,
      isRefreshing: false,
      lastVisibleRefreshAt: Date.now(),
      notice: failed ? '' : successNotice,
      noticeTone: failed ? 'error' : 'success',
    };
    render();
  }

  function handleSubmit(event) {
    const form = event.target.closest('[data-weather-form="location"]');
    if (!form) return;
    event.preventDefault();
    const mode = form.elements.mode.value;
    const nextLocation = sanitizeLocation(form.elements.location.value);
    if (mode === 'saved' && !nextLocation) return;
    // Settings owns this request so only its Set action may prompt for permission.
    window.LandosWeatherService.saveLocationPreferences(mode, nextLocation);
    state = { ...state, location: loadLocationPreference(), status: 'loading', snapshot: null, error: '', notice: '', locationNotice: '' };
    loadWeather({ force: true, reason: 'location', requestPermission: mode === 'current' });
    window.dispatchEvent(new CustomEvent('weather:location-changed'));
  }

  function handleLocationChange(event) {
    const form = event.target.closest('[data-weather-form="location"]');
    if (!form) return;
    if (event.target.id === 'weather-location-mode') {
      const current = event.target.value === 'current';
      form.querySelector('[data-weather-city-fields]').hidden = current;
      form.elements.location.disabled = current;
    }
    if (event.target.id === 'weather-popular-city' && event.target.value) {
      form.elements.location.value = event.target.value;
    }
  }

  function handleClick(event) {
    const button = event.target.closest('[data-weather-action]');
    if (!button) return;
    if (button.dataset.weatherAction === 'settings') {
      state = { ...state, view: state.view === 'settings' ? 'home' : 'settings' };
      render();
      return;
    }
    if (button.dataset.weatherAction === 'refresh') {
      state = { ...state, notice: 'Refreshing weather…', noticeTone: 'status', error: '' };
      loadWeather({ force: true, reason: 'refresh' });
    }
  }

  function handleVisibilityChange() {
    if (!document.hidden && Date.now() - state.lastVisibleRefreshAt > CACHE_RECHECK_MS) {
      loadWeather();
    }
  }

  function initWeatherApp() {
    if (initialized || !getRoot()) return;
    initialized = true;
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('change', handleLocationChange);
    window.addEventListener('storage', event => {
      if (event.key === 'weather_app_preferences_v1') {
        state = { ...state, location: loadLocationPreference(), snapshot: null };
        loadWeather({ reason: 'location' });
      }
    });
    document.addEventListener('click', handleClick);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', () => loadWeather({ force: true }));
    render();
    loadWeather();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  document.addEventListener('DOMContentLoaded', initWeatherApp);

  window.LandosWeatherApp = {
    loadWeather,
    getRideNote,
    loadLocationPreference,
  };
})();
