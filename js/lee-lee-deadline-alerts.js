(function () {
  "use strict";
  const RETENTION = 30 * 86400000;
  let opening, audio;
  function database() {
    if (opening) return opening;
    opening = new Promise((resolve) => {
      try {
        const r = indexedDB.open("lando-world:llt-alerts:v1", 1);
        r.onupgradeneeded = () =>
          r.result.createObjectStore("claims", { keyPath: "id" });
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
        r.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return opening;
  }
  async function claim(id, due, now = Date.now()) {
    if (!Number.isFinite(due) || due < now - RETENTION) return false;
    const db = await database();
    if (!db) {
      // Strong fallback: browser Web Locks + durable origin ledger, or visuals only.
      if (!navigator.locks) return false;
      return navigator.locks.request("llt-alert-claims", () => {
        try {
          const key = "lando-world:llt-alert-claims:v1",
            ledger = JSON.parse(localStorage.getItem(key) || "{}");
          if (ledger[id]) return false;
          ledger[id] = due;
          for (const k of Object.keys(ledger))
            if (ledger[k] < now - RETENTION) delete ledger[k];
          localStorage.setItem(key, JSON.stringify(ledger));
          return true;
        } catch {
          return false;
        }
      });
    }
    return new Promise((resolve) => {
      let acquired = false;
      try {
        const tx = db.transaction("claims", "readwrite"),
          store = tx.objectStore("claims"),
          r = store.get(id);
        r.onsuccess = () => {
          if (!r.result) {
            store.add({ id, due });
            acquired = true;
          }
        };
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (c) {
            if (c.value.due < now - RETENTION) c.delete();
            c.continue();
          }
        };
        tx.oncomplete = () => resolve(acquired);
        tx.onerror = tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }
  function unlock() {
    try {
      const C = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!C) return;
      audio ||= new C();
      const result = audio.resume();
      result?.catch(() => {});
    } catch {}
  }
  function chime() {
    try {
      if (!audio || audio.state !== "running") return false;
      [660, 880, 1100].forEach((frequency, i) => {
        const oscillator = audio.createOscillator(),
          gain = audio.createGain(),
          start = audio.currentTime + i * 0.19;
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.36);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      });
      return true;
    } catch {
      return false;
    }
  }
  async function evaluate(
    deadlines,
    { now = Date.now(), initial = false, dispatch = chime } = {},
  ) {
    const due = deadlines
      .filter((d) => d.due <= now)
      .sort((a, b) => a.due - b.due);
    for (let i = 0; i < due.length; i++) {
      const won = await claim(due[i].id, due[i].due, now);
      if (won && !initial && i === due.length - 1) {
        try {
          await dispatch(due[i]);
        } catch {}
      }
    }
  }
  globalThis.LeeLeeDeadlineAlerts = Object.freeze({
    claim,
    evaluate,
    unlock,
    chime,
  });
})();
