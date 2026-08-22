(() => {
  const STORAGE_KEY = 'landos_world_appearance_preference_v1';
  const PREFERENCES = new Set(['system', 'light', 'dark']);
  const DARK_QUERY = '(prefers-color-scheme: dark)';
  const THEME_COLORS = {
    light: '#f6f8fb',
    dark: '#000000',
  };

  let preference = 'system';
  let effectiveTheme = 'light';
  let mediaQuery = null;
  const subscribers = new Set();

  function normalizePreference(value) {
    return PREFERENCES.has(value) ? value : 'system';
  }

  function resolveTheme(nextPreference, systemPrefersDark) {
    const normalized = normalizePreference(nextPreference);
    if (normalized === 'light' || normalized === 'dark') return normalized;
    return systemPrefersDark ? 'dark' : 'light';
  }

  function getSystemPrefersDark() {
    try {
      if (!mediaQuery && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        mediaQuery = window.matchMedia(DARK_QUERY);
      }
      return Boolean(mediaQuery?.matches);
    } catch {
      return false;
    }
  }

  function readStoredPreference(storage = globalThis.localStorage) {
    try {
      return normalizePreference(storage?.getItem(STORAGE_KEY));
    } catch {
      return 'system';
    }
  }

  function writeStoredPreference(nextPreference, storage = globalThis.localStorage) {
    const normalized = normalizePreference(nextPreference);
    try {
      storage?.setItem(STORAGE_KEY, normalized);
    } catch {
      /* storage unavailable */
    }
    return normalized;
  }

  function updateThemeColor(theme) {
    if (typeof document === 'undefined') return;
    const color = THEME_COLORS[theme] || THEME_COLORS.light;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', color);
    });
  }

  function applyTheme(options = {}) {
    if (typeof document === 'undefined') return;
    const nextEffectiveTheme = resolveTheme(preference, getSystemPrefersDark());
    const root = document.documentElement;
    root.dataset.appearancePreference = preference;
    root.dataset.theme = nextEffectiveTheme;
    root.style.colorScheme = nextEffectiveTheme;
    updateThemeColor(nextEffectiveTheme);
    const changed = effectiveTheme !== nextEffectiveTheme || options.force;
    effectiveTheme = nextEffectiveTheme;
    if (changed) notify();
  }

  function notify() {
    const detail = getState();
    subscribers.forEach((callback) => callback(detail));
    try {
      window.dispatchEvent(new CustomEvent('landos:appearancechange', { detail }));
    } catch {
      /* CustomEvent may be unavailable in stripped test environments. */
    }
  }

  function setPreference(nextPreference) {
    preference = writeStoredPreference(nextPreference);
    applyTheme({ force: true });
    return getState();
  }

  function getState() {
    return {
      preference,
      effectiveTheme,
      systemPrefersDark: getSystemPrefersDark(),
    };
  }

  function subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    subscribers.add(callback);
    callback(getState());
    return () => subscribers.delete(callback);
  }

  function handleSystemThemeChange() {
    if (preference !== 'system') return;
    applyTheme();
  }

  function bindSystemThemeListener() {
    if (!mediaQuery) getSystemPrefersDark();
    if (!mediaQuery) return;
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return;
    }
    if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleSystemThemeChange);
    }
  }

  function init() {
    preference = readStoredPreference();
    effectiveTheme = resolveTheme(preference, getSystemPrefersDark());
    applyTheme({ force: true });
    bindSystemThemeListener();
    return getState();
  }

  const api = {
    STORAGE_KEY,
    PREFERENCES: Array.from(PREFERENCES),
    normalizePreference,
    resolveTheme,
    readStoredPreference,
    writeStoredPreference,
    getState,
    setPreference,
    subscribe,
    init,
  };

  if (typeof window !== 'undefined') {
    window.LandosTheme = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  init();
})();
