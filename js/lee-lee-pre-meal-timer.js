(function () {
  'use strict';

  const STORAGE_KEY = 'lando-world:lee-lees-tracker:pre-meal-timer:v1';
  const SETTINGS_KEY = 'lando-world:lee-lees-tracker:pre-meal-timer-settings:v1';
  const MINUTES_MIN = 1;
  const MINUTES_MAX = 60;
  const DEFAULT_SETTINGS = Object.freeze({ enabled: true, durationMinutes: 15 });

  function read(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function normalizeDuration(value) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes)) return DEFAULT_SETTINGS.durationMinutes;
    return Math.min(MINUTES_MAX, Math.max(MINUTES_MIN, Math.round(minutes)));
  }

  function getSettings() {
    const stored = read(SETTINGS_KEY, DEFAULT_SETTINGS);
    return { enabled: stored.enabled !== false, durationMinutes: normalizeDuration(stored.durationMinutes) };
  }

  function saveSettings(next) {
    const settings = {
      enabled: next?.enabled !== false,
      durationMinutes: normalizeDuration(next?.durationMinutes),
    };
    return write(SETTINGS_KEY, settings) ? settings : null;
  }

  function getTimer() {
    const timer = read(STORAGE_KEY, null);
    if (!timer || typeof timer !== 'object' || !Number.isFinite(Number(timer.endsAt))) return null;
    return {
      ...timer,
      status: ['active', 'completed', 'stopped'].includes(timer.status) ? timer.status : 'active',
      startedAt: Number(timer.startedAt),
      endsAt: Number(timer.endsAt),
      durationMinutes: normalizeDuration(timer.durationMinutes),
    };
  }

  function persist(timer) {
    return write(STORAGE_KEY, timer);
  }

  function normalize(now = Date.now()) {
    const timer = getTimer();
    if (!timer || timer.status !== 'active' || timer.endsAt > now) return timer;
    const completed = { ...timer, status: 'completed', completedAt: new Date(now).toISOString() };
    persist(completed);
    return completed;
  }

  function remainingMs(timer = normalize(), now = Date.now()) {
    if (!timer || timer.status !== 'active') return 0;
    return Math.max(0, timer.endsAt - now);
  }

  function start({ durationMinutes, sourceEntryId, sourceEntry }) {
    const now = Date.now();
    const minutes = normalizeDuration(durationMinutes);
    const timer = {
      version: 1,
      status: 'active',
      startedAt: now,
      endsAt: now + minutes * 60 * 1000,
      durationMinutes: minutes,
      sourceEntryId: sourceEntryId || '',
      sourceEntry: sourceEntry ? {
        type: sourceEntry.type || '',
        recordTimestamp: sourceEntry.recordTimestamp || '',
        mealCarbs: sourceEntry.mealCarbs,
        administeredInsulinUnits: sourceEntry.administeredInsulinUnits,
      } : null,
    };
    return persist(timer) ? timer : null;
  }

  function stop() {
    const timer = getTimer();
    if (!timer) return null;
    const stopped = { ...timer, status: 'stopped', stoppedAt: new Date().toISOString() };
    return persist(stopped) ? stopped : null;
  }

  function dismiss() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function adjustMinutes(delta) {
    const timer = normalize();
    if (!timer || timer.status !== 'active') return timer;
    const nextEndsAt = Math.max(Date.now() + 1000, timer.endsAt + Number(delta || 0) * 60 * 1000);
    const adjusted = { ...timer, endsAt: nextEndsAt };
    return persist(adjusted) ? adjusted : timer;
  }

  window.LeeLeePreMealTimer = Object.freeze({
    STORAGE_KEY,
    SETTINGS_KEY,
    MINUTES_MIN,
    MINUTES_MAX,
    getSettings,
    saveSettings,
    getTimer,
    normalize,
    remainingMs,
    start,
    stop,
    dismiss,
    adjustMinutes,
  });
})();
