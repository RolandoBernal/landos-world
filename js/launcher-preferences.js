(() => {
  const STORAGE_KEY = 'landos_world_my_apps_v1';
  const RECOMMENDED_IDS = Object.freeze(['digital-clock', 'weather', 'lee-lees-tracker']);
  const unique = (values) => [...new Set(values)];

  function normalize(value, registryIds) {
    const ids = unique(registryIds);
    const known = new Set(ids);
    const appOrder = unique([...value.appOrder.filter((id) => known.has(id)), ...ids]);
    const visible = new Set(value.visibleAppIds.filter((id) => known.has(id)));
    return { schemaVersion: 1, visibleAppIds: appOrder.filter((id) => visible.has(id)), appOrder };
  }

  function legacy(ids) {
    return normalize({ visibleAppIds: ids, appOrder: ids }, ids);
  }

  function decode(raw, ids) {
    if (raw === null) return { status: 'missing', preferences: legacy(ids) };
    try {
      const value = JSON.parse(raw);
      if (value && Number.isInteger(value.schemaVersion) && value.schemaVersion > 1) {
        return { status: 'unsupported', preferences: legacy(ids) };
      }
      if (!value || value.schemaVersion !== 1 || !Array.isArray(value.visibleAppIds)
        || !Array.isArray(value.appOrder) || ![...value.visibleAppIds, ...value.appOrder].every((id) => typeof id === 'string')) {
        throw new Error('Invalid launcher preferences');
      }
      return { status: 'saved', preferences: normalize(value, ids) };
    } catch {
      return { status: 'invalid', preferences: legacy(ids) };
    }
  }

  function recommended(preferences, ids) {
    const first = RECOMMENDED_IDS.filter((id) => ids.includes(id));
    return normalize({ visibleAppIds: first, appOrder: [...first, ...preferences.appOrder] }, ids);
  }

  function move(preferences, id, position, ids) {
    const next = normalize(preferences, ids);
    if (!next.appOrder.includes(id) || !Number.isInteger(position)) return next;
    const order = next.appOrder.filter((item) => item !== id);
    order.splice(Math.max(0, Math.min(position, order.length)), 0, id);
    return normalize({ ...next, appOrder: order }, ids);
  }

  // Visible-only reorder replaces visible slots; hidden apps keep their positions.
  function reorderVisible(preferences, order, ids) {
    const next = normalize(preferences, ids);
    const visible = new Set(next.visibleAppIds);
    const requested = unique([...order, ...next.appOrder]).filter((id) => visible.has(id));
    let index = 0;
    return normalize({ ...next, appOrder: next.appOrder.map((id) => visible.has(id) ? requested[index++] : id) }, ids);
  }

  function createStore(ids, getStorage = () => globalThis.localStorage) {
    let current;
    let lastRaw;
    let unsaved = false;
    function read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (unsaved && raw === lastRaw) return current;
        lastRaw = raw;
        unsaved = false;
        current = decode(raw, ids);
      } catch {
        current = { status: 'unavailable', preferences: current?.preferences || legacy(ids) };
      }
      return current;
    }
    function change(action) {
      const base = read();
      // Older code must never overwrite a newer schema, including from another tab.
      if (base.status === 'unsupported') return base;
      const preferences = normalize(action(base.preferences), ids);
      try {
        const raw = JSON.stringify(preferences);
        if (raw !== lastRaw) getStorage().setItem(STORAGE_KEY, raw);
        lastRaw = raw;
        unsaved = false;
        current = { status: 'saved', preferences };
      } catch {
        unsaved = true;
        current = { status: 'unsaved', preferences };
      }
      return current;
    }
    return { read, change };
  }

  globalThis.LandosLauncherPreferences = Object.freeze({
    STORAGE_KEY, RECOMMENDED_IDS, normalize, legacy, decode, recommended, move, reorderVisible, createStore,
  });
})();
