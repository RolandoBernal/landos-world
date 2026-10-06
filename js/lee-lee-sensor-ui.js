(function () {
  "use strict";
  const D = globalThis.LeeLeeDexcomSensor,
    A = globalThis.LeeLeeDeadlineAlerts;
  let repository,
    client,
    dialog,
    returnFocus,
    sensorIdentity = null,
    draft = null;
  const escape = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const date = (t) =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(t));
  const remaining = (ms) => {
    const minutes = Math.ceil(ms / 60000);
    return minutes >= 1440
      ? `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
      : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };
  function status(c) {
    if (!c) return { label: "No active sensor", detail: "" };
    const d = D.lifecycle(c);
    return {
      label:
        d.status === "active"
          ? `${remaining(d.remaining)} remaining`
          : d.status === "approaching"
            ? `Expires in ${remaining(d.remaining)}`
            : d.status === "grace"
              ? `Grace period — replace sensor (${remaining(d.remaining)} remaining)`
              : "Sensor expired — replace sensor",
      detail: `${d.status === "grace" || d.status === "expired" ? "Grace period ends" : "Expires"} ${date(d.status === "grace" || d.status === "expired" ? d.graceEnd : d.expires)}`,
      kind: d.status,
    };
  }
  function button(action, label, disabled = false) {
    return `<button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-sensor-action="${action}" ${disabled ? "disabled" : ""}>${label}</button>`;
  }
  function syncNote(state) {
    return state.pending
      ? "Awaiting confirmation"
      : state.offline
        ? `Offline — last synced ${state.lastFetchedAt ? date(state.lastFetchedAt) : "never"}`
        : state.error ||
          (!state.verified
            ? "Refreshing sensor state…"
            : `Last synced ${date(state.lastFetchedAt)}`);
  }
  function renderCard() {
    const slot = document.querySelector("[data-dexcom-card]");
    if (!slot || !client) return;
    const state = client.get(),
      c = D.current(state.snapshot),
      s = status(c);
    const expanded = slot.querySelector(".llt_sensor_card[open]") !== null;
    const statusTag = c ? "span" : "p";
    const heading = `<strong>${escape(D.formatSensorLabel(c))}</strong><${statusTag} class="llt_sensor_status">${state.snapshot ? escape(s.label) : "Sensor tracking unavailable"}</${statusTag}>`;
    const secondary = `${state.snapshot ? `<p class="llt_sensor_time">${escape(s.detail)}</p>` : ""}<p class="llt_sensor_sync" role="status">${escape(syncNote(state))}</p><div class="llt_sensor_actions">${button("details", "Sensor Details & History")}${button("start", c ? "Replace Sensor" : "Start New Sensor", !state.snapshot || !!state.pending)}</div><p class="llt_sensor_notice" aria-live="polite"></p>`;
    const markup = c
      ? `<details class="llt_sensor_card" data-state="${escape(s.kind)}"${expanded ? " open" : ""}><summary class="llt_sensor_disclosure" aria-expanded="${expanded}" aria-controls="llt-sensor-card-content"><span>${heading}</span><span class="lee_lee_diabetes_accordion_chevron" aria-hidden="true">⌄</span></summary><div id="llt-sensor-card-content" class="llt_sensor_content">${secondary}</div></details>`
      : `<section class="llt_sensor_card" data-state="none" aria-label="Dexcom G7 sensor tracker">${heading}${secondary}</section>`;
    if (slot._sensorMarkup !== markup) {
      slot._sensorMarkup = markup;
      const action = document.activeElement?.dataset?.sensorAction;
      const disclosureFocused = document.activeElement === slot.querySelector(".llt_sensor_disclosure");
      slot.innerHTML = markup;
      const disclosure = slot.querySelector(".llt_sensor_disclosure");
      disclosure?.parentElement.addEventListener("toggle", () => {
        disclosure.setAttribute("aria-expanded", String(disclosure.parentElement.open));
      });
      if (disclosureFocused) disclosure?.focus();
      else if (action)
        slot.querySelector(`[data-sensor-action="${action}"]`)?.focus();
    }
  }
  function close() {
    dialog?.close();
    dialog?.remove();
    dialog = null;
    const action = returnFocus?.dataset?.sensorAction;
    const target = returnFocus?.isConnected
      ? returnFocus
      : action && document.querySelector(`.llt_sensor_card [data-sensor-action="${action}"]`);
    target?.focus();
  }
  function open(html) {
    close();
    returnFocus = document.activeElement;
    dialog = document.createElement("dialog");
    dialog.className = "llt_sensor_dialog";
    dialog.innerHTML = `<div class="llt_sensor_dialog_inner"><div class="llt_sensor_dialog_header"><h2 id="llt-sensor-title">Dexcom G7</h2>${button("close", "Close")}</div>${html}</div>`;
    dialog.setAttribute("aria-labelledby", "llt-sensor-title");
    const styles = getComputedStyle(
      document.getElementById("lee-lee-diabetes-root"),
    );
    for (const name of [
      "--llt-ui-font",
      "--llt-numeric-font",
      "--lee-lee-text",
      "--lee-lee-muted",
      "--lee-lee-bg",
      "--lee-lee-border",
      "--lee-lee-panel",
      "--lee-lee-soft",
      "--lee-lee-blue",
      "--lee-lee-accent",
    ])
      dialog.style.setProperty(name, styles.getPropertyValue(name));
    dialog.style.colorScheme = styles.colorScheme;
    document.body.append(dialog);
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });
    dialog.addEventListener("click", handle);
    dialog.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const nodes = [
        ...dialog.querySelectorAll("button:not(:disabled),input,select,summary"),
      ].filter((node) => node.getClientRects().length &&
        (!node.closest("details:not([open])") || node.matches("summary")));
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    });
    const management = dialog.querySelector(".llt_sensor_manage");
    management?.addEventListener("toggle", () => {
      management.querySelector("summary").setAttribute("aria-expanded", String(management.open));
    });
    dialog.showModal();
    dialog.querySelector("input,button")?.focus();
  }
  function details() {
    const state = client.get(),
      c = D.current(state.snapshot),
      s = status(c),
      d = c ? D.lifecycle(c) : null;
    open(
      `<p>${escape(D.formatSensorLabel(c))}</p><p>${escape(state.snapshot ? s.label : "Sensor tracking unavailable")}</p><div class="llt_sensor_sync_row"><p class="llt_sensor_sync" role="status">${escape(syncNote(state))}</p>${button("refresh", "Refresh")}</div>${c ? `<dl class="llt_sensor_facts"><dt>Sensor Start</dt><dd>${escape(date(d.start))}</dd><dt>Standard expiration</dt><dd>${escape(date(d.expires))}</dd><dt>Grace period ends</dt><dd>${escape(date(d.graceEnd))}</dd></dl><section class="llt_sensor_management" aria-labelledby="llt-sensor-management-title"><h3 id="llt-sensor-management-title">Sensor Management</h3><button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-sensor-action="start" aria-describedby="llt-sensor-replace-description" ${state.pending ? "disabled" : ""}>Replace Sensor</button><p id="llt-sensor-replace-description" class="llt_sensor_help">Start tracking a new Dexcom G7.</p><details class="llt_sensor_manage"><summary class="llt_sensor_disclosure" aria-expanded="false" aria-controls="llt-sensor-corrections"><span>Manage Sensor</span><span class="lee_lee_diabetes_accordion_chevron" aria-hidden="true">⌄</span></summary><div id="llt-sensor-corrections" class="llt_sensor_corrections"><div>${button("edit", "Edit Start Time", !!state.pending)}<p>Change the start date or time if it was entered incorrectly. This will update the sensor’s expiration and grace-period times.</p></div><div>${button("undo", "Undo Current Sensor", !!state.pending)}<p>Remove a sensor that was added by mistake and restore the previous sensor when possible.</p></div></div></details></section>` : `<div class="llt_sensor_start">${button("start", "Start New Sensor", !state.snapshot || !!state.pending)}</div>`}<section class="llt_sensor_history_section" aria-labelledby="llt-sensor-history-title"><h3 id="llt-sensor-history-title">Sensor History</h3>${
        (state.snapshot?.cycles || [])
          .map((x) => {
            const life = D.lifecycle({ ...x, state: "current" });
            return `<article class="llt_sensor_history"><p>${escape(D.formatSensorLabel(x))}</p><strong>${escape(x.state === "cancelled" ? "Cancelled — retained in history" : x.state === "current" ? "Currently tracked" : Date.parse(x.ended_at) < life.expires ? "Replaced early" : "Replaced")}</strong><p>Started <span>${escape(date(x.started_at))}</span></p>${x.ended_at ? `<p>Replaced <span>${escape(date(x.ended_at))}</span></p>` : ""}${x.cancelled_at ? `<p>Cancelled <span>${escape(date(x.cancelled_at))}</span></p>` : ""}</article>`;
          })
          .join("") || "<p>No tracked sensor history.</p>"
      }</section><p class="llt_sensor_sync">Reminders work while LLT is open. Alerts cannot be guaranteed while the iPhone is locked.</p>`,
    );
  }
  function form(action) {
    const state = client.get(),
      c = D.current(state.snapshot);
    if (state.pending) return details();
    const values =
      draft?.action === action
        ? draft
        : D.localFields(
            action === "edit_start" && c
              ? Date.parse(c.started_at)
              : Date.now(),
          );
    open(
      `<form data-sensor-form="${action}" data-expected-revision="${state.snapshot?.revision}" data-expected-current="${escape(state.snapshot?.currentCycleId || "")}"><label>Sensor Start Date<input type="date" name="date" required value="${escape(values.date)}"></label><label>Sensor Start Time<input type="time" name="time" required value="${escape(values.time)}"></label>${action === "start" ? `<label>Sensor Code<input type="text" name="sensorCode" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required value="${escape(values.sensorCode || "")}" aria-describedby="llt-sensor-code-help"></label><p id="llt-sensor-code-help" class="llt_sensor_help">4-digit code printed on the Dexcom G7 sensor/applicator.</p>` : ""}<p>Enter the sensor’s start time, even if you are recording it later. Dates display in your local time zone.</p>${action === "edit_start" && c?.previous_cycle_id ? "<p>Changing this start time also changes the recorded replacement time of the previous sensor.</p>" : ""}<div data-sensor-occurrences></div><p role="alert" data-sensor-error></p><div class="llt_sensor_actions">${button("save", action === "start" ? "Review New Sensor" : "Review Start Correction")}${button("details", "Cancel")}</div></form>`,
    );
    const f = dialog.querySelector("form");
    f.addEventListener("input", () => {
      f.elements.sensorCode?.setCustomValidity("");
      draft = {
        action,
        date: f.elements.date.value,
        time: f.elements.time.value,
        sensorCode: f.elements.sensorCode?.value ?? null,
      };
      dialog.querySelector("[data-sensor-occurrences]").innerHTML = "";
    });
  }
  async function review() {
    const f = dialog.querySelector("form");
    const code = f.elements.sensorCode;
    code?.setCustomValidity(D.isValidSensorCode(code.value) ? "" : "Enter the 4-digit sensor code.");
    if (!f.reportValidity()) {
      if (code && !D.isValidSensorCode(code.value))
        dialog.querySelector("[data-sensor-error]").textContent = "Enter the 4-digit sensor code.";
      return;
    }
    draft = {
      action: f.dataset.sensorForm,
      date: f.elements.date.value,
      time: f.elements.time.value,
      sensorCode: code?.value ?? null,
    };
    const candidates = D.wallCandidates(draft.date, draft.time);
    const error = dialog.querySelector("[data-sensor-error]");
    if (!candidates.length) {
      error.textContent =
        "This local time does not exist. Choose a valid date and time.";
      return;
    }
    let selected = dialog.querySelector('[name="occurrence"]')?.value;
    if (candidates.length > 1 && !selected) {
      dialog.querySelector("[data-sensor-occurrences]").innerHTML =
        `<label>This time occurs twice. Choose the intended occurrence<select name="occurrence"><option value="">Choose an occurrence</option>${candidates.map((t) => `<option value="${t}">${escape(date(t))}</option>`).join("")}</select></label>`;
      return;
    }
    const start = Number(selected || candidates[0]);
    if (!candidates.includes(start) || start > Date.now()) {
      error.textContent =
        "Choose a valid sensor start that is not in the future.";
      return;
    }
    await client.refresh();
    const state = client.get();
    if (state.offline || !state.verified || state.error) {
      error.textContent =
        state.error || "Not saved — reconnect and review the current state.";
      return;
    }
    if (
      state.snapshot.revision !== Number(f.dataset.expectedRevision) ||
      (state.snapshot.currentCycleId || "") !== f.dataset.expectedCurrent
    ) {
      error.textContent =
        "Sensor changed on another device. Open Sensor Details to review the current sensor before trying again.";
      return;
    }
    const c = D.current(state.snapshot);
    const request = client.request(draft.action, {
      start: new Date(start).toISOString(),
      confirmed: !!c,
      actor: repository?.getDeviceIdentity() || "Unknown",
      metadata: metadata(),
      sensorCode: draft.sensorCode,
    });
    if (draft.action === "start") {
      const review = `<dl class="llt_sensor_facts llt_sensor_review"><dt>New sensor</dt><dd>${escape(D.formatSensorLabel({sensor_code: draft.sensorCode}))}</dd><dt>New sensor starts:</dt><dd>${escape(date(start))}</dd>${c ? `<dt>Current sensor</dt><dd>${escape(D.formatSensorLabel(c))}</dd><dt>Current sensor started:</dt><dd>${escape(date(c.started_at))}</dd>` : ""}</dl>${c ? "<p>Saving this change will end the current sensor and start the new one.</p>" : ""}`;
      confirm(request, "", review);
    } else {
      confirm(
        request,
        `Sensor Start: ${date(start)}${c?.previous_cycle_id ? " — The previous sensor’s recorded replacement time will also change." : ""}`,
      );
    }
  }
  function metadata() {
    return {
      device_installation_id:
        repository?.getDeviceInstallationId() || "preview",
      device_profile: repository?.getDeviceLabel() || "Local preview",
      device_platform: repository?.getDevicePlatform() || "Browser",
      app_environment: location.hostname,
      app_version: String(
        globalThis.LandoWorldBuildMetadata?.gitSha || "Unknown",
      ).slice(0, 160),
    };
  }
  function confirm(request, message, review = "") {
    open(
      `${review || `<p>${escape(message)}</p>`}<p>Review this change before saving.</p><p data-sensor-error role="alert"></p><div class="llt_sensor_actions">${button("confirm", request.p_action === "undo_current" ? "Undo Current Sensor" : "Save Sensor Change")}${button("details", "Cancel")}</div>`,
    );
    dialog._request = request;
  }
  async function handle(event) {
    const target = event.target.closest("[data-sensor-action]");
    if (!target) return;
    const action = target.dataset.sensorAction;
    if (["start", "edit", "save", "undo", "confirm"].includes(action))
      A.unlock();
    try {
      if (action === "close") close();
      else if (action === "details") details();
      else if (action === "start") form("start");
      else if (action === "edit") form("edit_start");
      else if (action === "save") await review();
      else if (action === "undo") {
        await client.refresh();
        const c = D.current(client.get().snapshot);
        if (!c || client.get().error) return details();
        confirm(
          client.request("undo_current", {
            actor: repository?.getDeviceIdentity() || "Unknown",
            metadata: metadata(),
          }),
          c.previous_cycle_id
            ? "Undo this recorded cycle and restore the previous sensor? The cancelled cycle will stay in history."
            : "Undo this recorded cycle? No current sensor will remain; this cycle stays in history.",
        );
      } else if (action === "refresh") {
        await client.resume();
        details();
      } else if (action === "confirm") {
        target.disabled = true;
        const r = await client.submit(dialog._request);
        if (r.status === "accepted") {
          draft = null;
          details();
        } else if (dialog) {
          dialog.querySelector("[data-sensor-error]").textContent =
            client.get().error ||
            "Awaiting confirmation. Refresh to settle this request.";
          target.disabled = !!client.get().pending;
        }
      }
    } catch (e) {
      const error = dialog?.querySelector("[data-sensor-error]");
      if (error) error.textContent = e.message;
    }
  }
  // Only trusted local-device preview creates this isolated fixture transport.
  // Production/auth-preview never instantiate it or accept URL fixture overrides.
  function fixture() {
    const uid = "local-sensor-fixture",
      key = "lando-world:llt-sensor-fixture:v1";
    globalThis.LeeLeeSensorPreview = {
      setScenario(name) {
        const hours = {
          active: 48,
          approaching: 222,
          grace: 245,
          expired: 260,
        }[name];
        if (name !== "none" && hours === undefined)
          throw new Error("Unknown fixture");
        const id = D.generateUuid(),
          snapshot = { revision: 0, currentCycleId: null, cycles: [] };
        if (hours !== undefined) {
          snapshot.revision = 1;
          snapshot.currentCycleId = id;
          snapshot.cycles = [
            {
              id,
              user_id: uid,
              sensor_type: D.MODEL,
              started_at: new Date(Date.now() - hours * D.HOUR).toISOString(),
              state: "current",
              ended_at: null,
              cancelled_at: null,
              previous_cycle_id: null,
              revision: 1,
            },
          ];
        }
        localStorage.setItem(key, JSON.stringify(snapshot));
        localStorage.removeItem(key + ":receipts");
        localStorage.removeItem("lando-world:llt-sensor:cache:v1:" + uid);
        localStorage.removeItem("lando-world:llt-sensor:pending:v1:" + uid);
        location.reload();
      },
    };
    let data;
    try {
      data = JSON.parse(localStorage.getItem(key) || "null");
    } catch {}
    data ||= { revision: 0, currentCycleId: null, cycles: [] };
    let receipts;
    try {
      receipts = JSON.parse(localStorage.getItem(key + ":receipts") || "{}");
    } catch {}
    receipts ||= {};
    return {
      uid,
      client: {
        channel: () => ({
          on() {
            return this;
          },
          subscribe() {
            return this;
          },
        }),
        removeChannel() {},
        async rpc(name, p) {
          try {
            data = JSON.parse(localStorage.getItem(key) || "null") || data;
            receipts = JSON.parse(
              localStorage.getItem(key + ":receipts") || "{}",
            );
          } catch {}
          if (name === "llt_get_sensor_snapshot")
            return { data: { status: "ok", snapshot: structuredClone(data) } };
          if (p.p_sensor_code != null && !D.isValidSensorCode(p.p_sensor_code))
            return { data: {status: "invalid_request", reason: "invalid_sensor_code"} };
          if (p.p_sensor_code != null && p.p_action !== "start")
            return { data: {status: "invalid_request", reason: "invalid_action_shape"} };
          const canonical = { ...p };
          delete canonical.p_operation_id;
          if (canonical.p_sensor_code == null) delete canonical.p_sensor_code;
          if (receipts[p.p_operation_id]?.request &&
            JSON.stringify(receipts[p.p_operation_id].request) !== JSON.stringify(canonical))
            return {data: {status: "invalid_request", reason: "operation_id_reused", snapshot: structuredClone(data)}};
          if (receipts[p.p_operation_id])
            return {
              data: {
                ...receipts[p.p_operation_id],
                snapshot: structuredClone(data),
              },
            };
          let status = "accepted",
            reason = "applied";
          const c = D.current(data),
            before = structuredClone(data);
          if (
            p.p_expected_revision !== data.revision ||
            p.p_expected_current_cycle_id !== data.currentCycleId
          ) {
            status = "conflict";
            reason = "stale_context";
          } else if (
            p.p_action === "start" &&
            c &&
            Date.parse(p.p_started_at) <= Date.parse(c.started_at)
          ) {
            status = "invalid_state";
            reason = "replacement_not_after_current_start";
          } else {
            const rev = data.revision + 1;
            if (p.p_action === "start") {
              if (c) {
                c.state = "closed";
                c.ended_at = p.p_started_at;
                c.revision = rev;
              }
              data.cycles.unshift({
                ...(p.p_sensor_code != null ? {sensor_code: p.p_sensor_code} : {}),
                id: p.p_new_cycle_id,
                user_id: uid,
                sensor_type: D.MODEL,
                started_at: p.p_started_at,
                state: "current",
                ended_at: null,
                cancelled_at: null,
                previous_cycle_id: c?.id || null,
                revision: rev,
              });
              data.currentCycleId = p.p_new_cycle_id;
            } else if (p.p_action === "edit_start" && c) {
              const prev = data.cycles.find(
                (x) => x.id === c.previous_cycle_id,
              );
              if (
                prev &&
                Date.parse(p.p_started_at) <= Date.parse(prev.started_at)
              ) {
                status = "invalid_state";
                reason = "invalid_previous_boundary";
              } else {
                c.started_at = p.p_started_at;
                c.revision = rev;
                if (prev) {
                  prev.ended_at = p.p_started_at;
                  prev.revision = rev;
                }
              }
            } else if (p.p_action === "undo_current" && c) {
              c.state = "cancelled";
              c.cancelled_at = new Date().toISOString();
              c.revision = rev;
              const prev = data.cycles.find(
                (x) => x.id === c.previous_cycle_id,
              );
              if (prev) {
                prev.state = "current";
                prev.ended_at = null;
                prev.revision = rev;
              }
              data.currentCycleId = prev?.id || null;
            }
            if (status === "accepted") data.revision = rev;
            else data = before;
            data.cycles.sort(
              (a, b) =>
                Date.parse(b.started_at) - Date.parse(a.started_at) ||
                b.id.localeCompare(a.id),
            );
            localStorage.setItem(key, JSON.stringify(data));
          }
          const r = { status, reason, snapshot: structuredClone(data) };
          receipts[p.p_operation_id] = { ...r, request: canonical };
          localStorage.setItem(key + ":receipts", JSON.stringify(receipts));
          return { data: r };
        },
      },
    };
  }
  function init(repo) {
    if (client) return;
    repository = repo;
    const localPreview =
      globalThis.LandoWorldBuildMetadata?.environment === "local-device";
    let fixtureLock = Promise.resolve();
    client = globalThis.LeeLeeSensorSync.create({
      changed: renderCard,
      locks:
        navigator.locks ||
        (localPreview
          ? {
              request(_key, fn) {
                const next = fixtureLock.then(fn);
                fixtureLock = next.catch(() => {});
                return next;
              },
            }
          : undefined),
    });
    if (globalThis.LandoWorldBuildMetadata?.environment === "local-device")
      client.connect(fixture());
    else client.connect(repo?.getSensorConnection());
    document.addEventListener("click", (e) => {
      if (!dialog && e.target.closest("[data-sensor-action]")) handle(e);
    });
    repo?.subscribe(() => {
      if (globalThis.LandoWorldBuildMetadata?.environment !== "local-device") {
        client.connect(repo.getSensorConnection());
        if (!client.get().uid) close();
      }
    });
    window.addEventListener("online", () => client.resume());
    window.addEventListener("offline", renderCard);
    window.addEventListener("storage", (event) => {
      // Cache writes must not trigger reciprocal refresh/write loops across tabs.
      const uid = client.get().uid;
      if (
        event.key === `lando-world:llt-sensor:pending:v1:${uid}` ||
        event.key === "lando-world:llt-sensor-fixture:v1"
      )
        client.resume();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") client.resume();
    });
    setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        location.hash.includes("lee-lees-tracker")
      ) {
        client.resume();
      }
    }, 30000);
    setInterval(() => {
      if (
        document.visibilityState !== "visible" ||
        !location.hash.includes("lee-lees-tracker")
      )
        return;
      const access = globalThis.LeeLeeTrackerSync?.resolveAccessState?.({
        environment: globalThis.LandoWorldBuildMetadata?.environment,
        ...repository?.getSyncStatus?.(),
      });
      if (!["production-authorized", "local-development-authorized"].includes(access)) return;
      renderCard();
      const timer = globalThis.LeeLeePreMealTimer?.normalize();
      if (timer?.status === "completed")
        A.evaluate([
          { id: `timer:${timer.startedAt}:${timer.endsAt}`, due: timer.endsAt },
        ]);
      const s = client.get(),
        c = D.current(s.snapshot);
      if (c) {
        const identity = `${s.uid}:${c.id}:${c.started_at}`,
          initial = identity !== sensorIdentity;
        sensorIdentity = identity;
        A.evaluate(D.milestones(c, s.uid), {
          initial,
          dispatch: () => {
            A.chime();
            const notice = document.querySelector(".llt_sensor_notice");
            if (notice)
              notice.textContent =
                "Sensor reminder — review the current status.";
          },
        });
      }
    }, 1000);
  }
  globalThis.LeeLeeSensorUI = Object.freeze({ init, mount: renderCard });
})();
