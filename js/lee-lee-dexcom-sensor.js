(function () {
  "use strict";
  const MODEL = "dexcom_g7_10d_v1",
    HOUR = 3600000;
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
        !c.id ||
        ids.has(c.id) ||
        c.user_id !== uid ||
        !["current", "closed", "cancelled"].includes(c.state) ||
        !Number.isSafeInteger(c.revision) || c.revision < 1 ||
        c.revision > snapshot.revision
      )
        throw new Error("Invalid sensor history.");
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
    MODEL,
    HOUR,
    lifecycle,
    current,
    validate,
    milestones,
    localFields,
    wallCandidates,
  });
})();
