(function () {
  "use strict";
  const MODEL = "dexcom_g7_10d_v1",
    HOUR = 3600000;
  function generateUuid(cryptoApi = globalThis.crypto) {
    if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
    if (typeof cryptoApi?.getRandomValues !== "function")
      throw new Error("Secure random generation is unavailable in this browser.");
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  function isValidSensorCode(value) {
    return typeof value === "string" && value.length === 4 && /^[0-9]{4}$/.test(value);
  }
  function formatSensorLabel(cycle) {
    return isValidSensorCode(cycle?.sensor_code)
      ? `Dexcom G7 · ${cycle.sensor_code}` : "Dexcom G7";
  }
  const REASONS = Object.freeze({
    normal_expiration: "Normal Expiration", did_not_pair: "Sensor Did Not Pair",
    brief_sensor_issue: "Brief Sensor Issue / Sensor Error", inaccurate_readings: "Inaccurate Readings",
    signal_loss: "Signal Loss", bleeding_bruising: "Bleeding or Bruising", applying_sensor: "Issue Applying Sensor",
    sensor_failed: "Sensor Failed", fell_off: "Sensor Fell Off", skin_irritation: "Skin Irritation",
    accidentally_removed: "Accidentally Removed", other: "Other",
  });
  function validateMetadata(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== 3 ||
      !["replacement_reason_id", "replacement_notes", "replacement_requested"].every(key => Object.hasOwn(value, key)) ||
      (value.replacement_reason_id !== null && (typeof value.replacement_reason_id !== "string" || !Object.hasOwn(REASONS, value.replacement_reason_id))) ||
      (value.replacement_notes !== null && (typeof value.replacement_notes !== "string" || Array.from(value.replacement_notes).length > 2000)) ||
      (value.replacement_requested !== null && typeof value.replacement_requested !== "boolean"))
      throw new Error("Enter a valid reason, notes up to 2,000 characters, and requested status.");
    return value;
  }
  function historyStatus(cycle) {
    return cycle.state === "cancelled" ? "Cancelled" : cycle.state === "current" ? "Active" :
      lifecycle(cycle).early ? "Replaced Early" : "Completed";
  }
  function matchesFilter(cycle, filter) {
    if (filter === "All") return true;
    if (filter === "Sensor Issues") return Object.hasOwn(REASONS, cycle.replacement_reason_id) &&
      !["normal_expiration", "other"].includes(cycle.replacement_reason_id);
    return historyStatus(cycle) === filter;
  }
  function lifecycle(cycle, now = Date.now()) {
    if (!cycle || cycle.state === "cancelled") return { status: "none" };
    if (
      cycle.sensor_type !== MODEL ||
      !Number.isFinite(Date.parse(cycle.started_at))
    )
      throw new Error("Unsupported sensor cycle.");
    const start = Date.parse(cycle.started_at),
      expires = start + 240 * HOUR,
      graceEnd = expires + 12 * HOUR;
    return {
      start,
      expires,
      graceEnd,
      status:
        cycle.state === "closed"
          ? "closed"
          : now >= graceEnd
            ? "expired"
            : now >= expires
              ? "grace"
              : now >= expires - 24 * HOUR
                ? "approaching"
                : "active",
      remaining: Math.max(0, (now >= expires ? graceEnd : expires) - now),
      early: cycle.ended_at != null && Date.parse(cycle.ended_at) < expires,
    };
  }
  function current(snapshot) {
    return (
      snapshot?.cycles.find((c) => c.id === snapshot.currentCycleId) || null
    );
  }
  function validate(snapshot, uid) {
    if (
      !snapshot ||
      !Number.isSafeInteger(snapshot.revision) ||
      snapshot.revision < 0 ||
      !Array.isArray(snapshot.cycles)
    )
      throw new Error("Invalid sensor snapshot.");
    const ids = new Set();
    let count = 0;
    for (const c of snapshot.cycles) {
      if (
        (c.sensor_code != null && !isValidSensorCode(c.sensor_code)) ||
        !c.id ||
        ids.has(c.id) ||
        c.user_id !== uid ||
        !["current", "closed", "cancelled"].includes(c.state) ||
        !Number.isSafeInteger(c.revision) || c.revision < 1 ||
        c.revision > snapshot.revision
      )
        throw new Error("Invalid sensor history.");
      validateMetadata({ replacement_reason_id: c.replacement_reason_id ?? null,
        replacement_notes: c.replacement_notes ?? null, replacement_requested: c.replacement_requested ?? null });
      ids.add(c.id);
      lifecycle({ ...c, state: "current" });
      if (c.state === "current") {
        count++;
        if (c.ended_at || c.cancelled_at)
          throw new Error("Invalid current sensor.");
      }
      if (
        c.state === "closed" &&
        (!Number.isFinite(Date.parse(c.ended_at)) ||
          Date.parse(c.ended_at) <= Date.parse(c.started_at) ||
          c.cancelled_at)
      )
        throw new Error("Invalid closed sensor.");
      if (
        c.state === "cancelled" &&
        (!Number.isFinite(Date.parse(c.cancelled_at)) || c.ended_at)
      )
        throw new Error("Invalid cancelled sensor.");
    }
    if (
      count > 1 ||
      (snapshot.currentCycleId == null
        ? count !== 0
        : current(snapshot)?.state !== "current" || count !== 1)
    )
      throw new Error("Invalid sensor pointer.");
    for (const c of snapshot.cycles)
      if (
        c.previous_cycle_id &&
        (c.previous_cycle_id === c.id || !ids.has(c.previous_cycle_id))
      )
        throw new Error("Invalid predecessor.");
    return snapshot;
  }
  function milestones(c, uid) {
    const d = lifecycle(c);
    const key = `sensor:${uid}:${c.id}:${Date.parse(c.started_at)}`;
    return [
      { id: `${key}:approaching`, due: d.expires - 24 * HOUR },
      { id: `${key}:grace`, due: d.expires },
      { id: `${key}:expired`, due: d.graceEnd },
    ];
  }
  function localFields(timestamp = Date.now()) {
    const d = new Date(timestamp);
    const pad = (x) => String(x).padStart(2, "0");
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  }
  // Search possible absolute occurrences and round-trip all wall-clock components.
  function wallCandidates(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
      return [];
    const [y, m, d] = date.split("-").map(Number),
      [h, min] = time.split(":").map(Number);
    const guess = new Date(y, m - 1, d, h, min).getTime(),
      values = [];
    for (let offset = -180; offset <= 180; offset++) {
      const t = guess + offset * 60000,
        n = new Date(t);
      if (
        n.getFullYear() === y &&
        n.getMonth() === m - 1 &&
        n.getDate() === d &&
        n.getHours() === h &&
        n.getMinutes() === min
      )
        values.push(t);
    }
    return values;
  }
  globalThis.LeeLeeDexcomSensor = Object.freeze({
    REASONS,
    validateMetadata,
    historyStatus,
    matchesFilter,
    MODEL,
    HOUR,
    generateUuid,
    isValidSensorCode,
    formatSensorLabel,
    lifecycle,
    current,
    validate,
    milestones,
    localFields,
    wallCandidates,
  });
})();
