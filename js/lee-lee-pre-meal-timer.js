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

  // Native mirror (Capacitor shell only): keep one local notification in
  // step with the timer so expiry still reaches the user when the phone is
  // locked or the app is backgrounded. In the PWA/browser there is no
  // Capacitor bridge, so every call below is a no-op. Convenience reminder
  // only — a notification failure must never break the timer.
  const NOTIFICATION_ID = 7331;

  function nativeNotifications() {
    try {
      if (!window.Capacitor?.isNativePlatform?.()) return null;
      return window.Capacitor.Plugins?.LocalNotifications || null;
    } catch (_error) {
      return null;
    }
  }

  function cancelNativeNotification(plugin) {
    try {
      const pending = plugin.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    } catch (_error) { /* ignore */ }
  }

  function syncNativeNotification(timer) {
    const plugin = nativeNotifications();
    if (!plugin) return;
    if (!timer || timer.status !== 'active') {
      cancelNativeNotification(plugin);
      return;
    }
    (async () => {
      try {
        let permission = await plugin.checkPermissions();
        if (permission.display !== 'granted') {
          if (permission.display === 'denied') return;
          permission = await plugin.requestPermissions();
          if (permission.display !== 'granted') return;
        }
        const copy = timer.purpose === 'low-glucose-recheck'
          ? { title: 'Recheck Glucose', body: 'The 15-minute reminder has finished.' }
          : { title: 'Pre-Meal Timer', body: 'Ready to eat.' };
        await plugin.schedule({
          notifications: [{
            id: NOTIFICATION_ID,
            title: copy.title,
            body: copy.body,
            schedule: { at: new Date(timer.endsAt), allowWhileIdle: true },
          }],
        });
      } catch (_error) { /* convenience reminder only */ }
    })();
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

  function start({ durationMinutes, sourceEntryId, sourceEntry, purpose = 'pre-meal', episodeId = null, scheduleId = null, startedAt } = {}) {
    const now = Number.isFinite(startedAt) ? startedAt : Date.now();
    const minutes = purpose === 'low-glucose-recheck' ? 15 : normalizeDuration(durationMinutes);
    const timer = {
      version: 1,
      purpose, episodeId, scheduleId,
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
    if (!persist(timer)) return null;
    syncNativeNotification(timer);
    return timer;
  }

  function stop() {
    const timer = getTimer();
    if (!timer) return null;
    const stopped = { ...timer, status: 'stopped', stoppedAt: new Date().toISOString() };
    if (!persist(stopped)) return null;
    syncNativeNotification(stopped);
    return stopped;
  }

  function dismiss() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      const plugin = nativeNotifications();
      if (plugin) cancelNativeNotification(plugin);
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
    if (!persist(adjusted)) return timer;
    syncNativeNotification(adjusted);
    return adjusted;
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
    markCompletionPresented() { const timer = getTimer(); if (timer) persist({ ...timer, completionPresented: true }); },
    start,
    stop,
    dismiss,
    adjustMinutes,
  });
})();
