(function () {
  "use strict";
  const D = globalThis.LeeLeeDexcomSensor,
    A = globalThis.LeeLeeDeadlineAlerts;
  let repository,
    client,
    dialog,
    returnFocus,
    sensorIdentity = null,
    draft = null,
    historyState = { search: "", filter: "All", limit: 25, scroll: 0, focusId: null },
    selectedSensorId = null,
    renderedUid = null;
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
    if (renderedUid !== state.uid) {
      if (renderedUid !== null) close();
      renderedUid = state.uid; draft = null; selectedSensorId = null;
      historyState = { search: "", filter: "All", limit: 25, scroll: 0, focusId: null };
    }
    const expanded = slot.querySelector(".llt_sensor_card[open]") !== null;
    const statusTag = c ? "span" : "p";
    const heading = `<strong>${escape(D.formatSensorLabel(c))}</strong><${statusTag} class="llt_sensor_status">${state.snapshot ? escape(s.label) : "Sensor tracking unavailable"}</${statusTag}>`;
    const life = c ? D.lifecycle(c) : null;
    const secondary = `${state.snapshot ? `<p class="llt_sensor_time">${escape(s.detail)}</p>` : ""}<p class="llt_sensor_sync" role="status">${escape(syncNote(state))}</p>${life ? `<dl class="llt_sensor_facts"><dt>Sensor Start</dt><dd>${escape(date(life.start))}</dd><dt>Standard Expiration</dt><dd>${escape(date(life.expires))}</dd><dt>Grace Period Ends</dt><dd>${escape(date(life.graceEnd))}</dd></dl>` : ""}<div class="llt_sensor_actions">${button("details", "Manage Sensor")}${button("start", c ? "Replace Sensor" : "Start New Sensor", !state.snapshot || !!state.pending)}</div>${button("history", "View All Sensor History →")}<p class="llt_sensor_notice" aria-live="polite"></p>`;
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
  function open(html, title = "Dexcom G7", fullScreen = false) {
    const opener = dialog ? returnFocus : document.activeElement;
    close();
    returnFocus = opener;
    dialog = document.createElement("dialog");
    dialog.className = "llt_sensor_dialog" + (fullScreen ? " llt_sensor_dialog--full" : "");
    dialog.innerHTML = `<div class="llt_sensor_dialog_inner"><div class="llt_sensor_dialog_header"><h2 id="llt-sensor-title">${escape(title)}</h2>${button("close", "Close")}</div>${html}</div>`;
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
        ...dialog.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary"),
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
      `<p>${escape(D.formatSensorLabel(c))}</p><p>${escape(state.snapshot ? s.label : "Sensor tracking unavailable")}</p><div class="llt_sensor_sync_row"><p class="llt_sensor_sync" role="status">${escape(syncNote(state))}</p>${button("refresh", "Refresh")}</div>${c ? `<dl class="llt_sensor_facts"><dt>Sensor Start</dt><dd>${escape(date(d.start))}</dd><dt>Standard expiration</dt><dd>${escape(date(d.expires))}</dd><dt>Grace period ends</dt><dd>${escape(date(d.graceEnd))}</dd></dl><section class="llt_sensor_management" aria-labelledby="llt-sensor-management-title"><h3 id="llt-sensor-management-title">Sensor Management</h3><button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-sensor-action="start" aria-describedby="llt-sensor-replace-description" ${state.pending ? "disabled" : ""}>Replace Sensor</button><p id="llt-sensor-replace-description" class="llt_sensor_help">Start tracking a new Dexcom G7.</p><details class="llt_sensor_manage"><summary class="llt_sensor_disclosure" aria-expanded="false" aria-controls="llt-sensor-corrections"><span>Manage Sensor</span><span class="lee_lee_diabetes_accordion_chevron" aria-hidden="true">⌄</span></summary><div id="llt-sensor-corrections" class="llt_sensor_corrections"><div>${button("edit", "Edit Start Time", !!state.pending)}<p>Change the start date or time if it was entered incorrectly. This will update the sensor’s expiration and grace-period times.</p></div><div>${button("undo", "Undo Current Sensor", !!state.pending)}<p>Remove a sensor that was added by mistake and restore the previous sensor when possible.</p></div></div></details></section>` : `<div class="llt_sensor_start">${button("start", "Start New Sensor", !state.snapshot || !!state.pending)}</div>`}${button("history", "View All Sensor History →")}<p class="llt_sensor_sync">Reminders work while LLT is open. Alerts cannot be guaranteed while the iPhone is locked.</p>`,
    );
  }
  const duration = (cycle) => {
    const minutes = Math.floor((Date.parse(cycle.ended_at) - Date.parse(cycle.started_at)) / 60000);
    return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h ${minutes % 60}m`;
  };
  function reason(cycle) { return D.REASONS[cycle.replacement_reason_id] || "Reason Not Recorded"; }
  function matchingSensors() {
    const query = historyState.search.trim().toLocaleLowerCase();
    return (client.get().snapshot?.cycles || []).slice().sort((a, b) =>
      Date.parse(b.started_at) - Date.parse(a.started_at) || b.id.localeCompare(a.id))
      .filter(c => D.matchesFilter(c, historyState.filter) && (!query ||
        [date(c.started_at), c.started_at, c.ended_at ? date(c.ended_at) : "", c.ended_at || "",
          c.cancelled_at ? date(c.cancelled_at) : "", reason(c), c.replacement_notes || ""]
          .join(" ").toLocaleLowerCase().includes(query)));
  }
  function renderHistoryResults() {
    const records = matchingSensors();
    dialog.querySelector("[data-sensor-results]").innerHTML = records.slice(0, historyState.limit).map(c =>
      `<button type="button" class="llt_sensor_history llt_sensor_history_link" data-sensor-action="history-record" data-sensor-id="${escape(c.id)}"><strong>${escape(D.formatSensorLabel(c))}</strong><span>${escape(D.historyStatus(c))}</span><span>Started ${escape(date(c.started_at))}</span>${c.ended_at ? `<span>Replaced ${escape(date(c.ended_at))}</span><span>Duration: ${escape(duration(c))}</span>` : c.state === "current" ? `<span>${escape(status(c).label)}</span>` : `<span>Cancelled ${escape(date(c.cancelled_at))}</span>`}</button>`).join("") || "<p>No sensors match this search and filter.</p>";
    dialog.querySelector("[data-sensor-count]").textContent = `${Math.min(historyState.limit, records.length)} of ${records.length} sensors`;
    dialog.querySelector('[data-sensor-action="history-more"]').hidden = historyState.limit >= records.length;
  }
  function allSensors(reset = false) {
    if (reset) historyState = { search: "", filter: "All", limit: 25, scroll: 0, focusId: null };
    open(`<p class="llt_sensor_sync" role="status">${escape(syncNote(client.get()))}</p><label for="llt-history-search">Search Sensors</label><input id="llt-history-search" type="search" data-sensor-search value="${escape(historyState.search)}" placeholder="Dates, reasons or notes"><label for="llt-history-filter">Filter Sensors</label><select id="llt-history-filter" data-sensor-filter>${["All", "Active", "Completed", "Replaced Early", "Sensor Issues", "Cancelled"].map(f => `<option${f === historyState.filter ? " selected" : ""}>${f}</option>`).join("")}</select><p data-sensor-count role="status"></p><div data-sensor-results></div>${button("history-more", "Load More")}<p class="llt_sensor_help">Sensor Issues includes recorded issue reasons. Other is excluded because free-text notes are not classified.</p>`, "All Sensors", true);
    renderHistoryResults();
    dialog.querySelector("[data-sensor-search]").addEventListener("input", e => { historyState.search = e.target.value; historyState.limit = 25; historyState.scroll = 0; renderHistoryResults(); });
    dialog.querySelector("[data-sensor-filter]").addEventListener("change", e => { historyState.filter = e.target.value; historyState.limit = 25; historyState.scroll = 0; renderHistoryResults(); });
    const focus = [...dialog.querySelectorAll("[data-sensor-id]")].find(el => el.dataset.sensorId === historyState.focusId);
    focus?.focus({ preventScroll: true });
    dialog.scrollTop = historyState.scroll;
  }
  function metadataFields(c = {}, disabled = false) {
    return `<label for="llt-replacement-reason">Replacement Reason (optional)</label><select id="llt-replacement-reason" name="replacementReason" ${disabled ? "disabled" : ""}><option value="">Reason Not Recorded</option>${Object.entries(D.REASONS).map(([id, label]) => `<option value="${id}"${id === c.replacement_reason_id ? " selected" : ""}>${escape(label)}</option>`).join("")}</select><label for="llt-replacement-notes">Replacement Notes</label><textarea id="llt-replacement-notes" name="replacementNotes" rows="4" ${disabled ? "disabled" : ""} aria-describedby="llt-sensor-notes-help">${escape(c.replacement_notes || "")}</textarea><p id="llt-sensor-notes-help" class="llt_sensor_help">Optional. Maximum 2,000 characters.</p><label for="llt-replacement-requested">Replacement Requested from Dexcom</label><select id="llt-replacement-requested" name="replacementRequested" ${disabled ? "disabled" : ""}><option value=""${c.replacement_requested == null ? " selected" : ""}>Not Recorded</option><option value="true"${c.replacement_requested === true ? " selected" : ""}>Yes</option><option value="false"${c.replacement_requested === false ? " selected" : ""}>No</option></select>`;
  }
  function readMetadata(f) {
    return D.validateMetadata({ replacement_reason_id: f.elements.replacementReason.value || null,
      replacement_notes: f.elements.replacementNotes.value || null,
      replacement_requested: f.elements.replacementRequested.value === "" ? null : f.elements.replacementRequested.value === "true" });
  }
  function sensorDetails(id) {
    selectedSensorId = id;
    const state = client.get(), c = state.snapshot?.cycles.find(c => c.id === id);
    if (!c) { allSensors(); return; }
    const life = D.lifecycle({ ...c, state: "current" });
    open(`${button("history-back", "← All Sensors")}<p>${escape(D.formatSensorLabel(c))}</p><p><strong>${escape(D.historyStatus(c))}</strong></p>${c.state === "current" ? `<p>${escape(status(c).label)}</p>` : ""}<dl class="llt_sensor_facts"><dt>Sensor Start</dt><dd>${escape(date(c.started_at))}</dd><dt>Standard Expiration</dt><dd>${escape(date(life.expires))}</dd><dt>Grace Period Ends</dt><dd>${escape(date(life.graceEnd))}</dd>${c.ended_at ? `<dt>Actual Replacement</dt><dd>${escape(date(c.ended_at))}</dd><dt>Actual Duration</dt><dd>${escape(duration(c))}</dd>` : c.cancelled_at ? `<dt>Cancelled</dt><dd>${escape(date(c.cancelled_at))}</dd>` : ""}</dl>${c.state !== "current" ? `<p>${escape(reason(c))}</p><p class="llt_sensor_notes">${escape(c.replacement_notes || "No Notes Recorded")}</p><p>Replacement Requested: ${c.replacement_requested == null ? "Not Recorded" : c.replacement_requested ? "Yes" : "No"}</p>` : ""}${c.state === "closed" ? `${button("metadata-edit", "Edit Replacement Metadata", !!state.pending || !state.supportsMetadata)}${!state.supportsMetadata ? '<p role="status">Metadata editing requires the sensor database migration.</p>' : ""}` : ""}`, "Sensor Details", true);
  }
  function editMetadata() {
    const state = client.get(), c = state.snapshot?.cycles.find(c => c.id === selectedSensorId);
    if (!c || c.state !== "closed") return sensorDetails(selectedSensorId);
    open(`${button("sensor-back", "← Sensor Details")}<form data-metadata-form data-expected-revision="${state.snapshot.revision}" data-expected-current="${escape(state.snapshot.currentCycleId || "")}">${metadataFields(c)}<p data-sensor-error role="alert"></p>${button("metadata-save", "Save Replacement Metadata", !state.supportsMetadata || !!state.pending)}</form>`, "Edit Replacement Metadata", true);
    dialog.querySelector("form").addEventListener("submit", async e => { e.preventDefault(); try { await saveMetadata(); } catch (error) { dialog?.querySelector("[data-sensor-error]")?.replaceChildren(document.createTextNode(error.message)); } });
  }
  async function saveMetadata() {
    const f = dialog.querySelector("[data-metadata-form]"), value = readMetadata(f);
    await client.refresh();
    const state = client.get();
    if (state.offline || !state.verified || state.error || state.snapshot.revision !== Number(f.dataset.expectedRevision) || (state.snapshot.currentCycleId || "") !== f.dataset.expectedCurrent)
      throw new Error(state.error || "Not saved — sensor state changed or is offline. Review the latest sensor before editing again.");
    const request = client.request("update_metadata", { targetId: selectedSensorId, replacementMetadata: value,
      actor: repository?.getDeviceIdentity() || "Unknown", metadata: metadata() });
    f.querySelector('[data-sensor-action="metadata-save"]').disabled = true;
    const result = await client.submit(request);
    if (result.status === "accepted") sensorDetails(selectedSensorId);
    else { f.querySelector("[data-sensor-error]").textContent = client.get().error || "Not saved — review the sensor state.";
      f.querySelector('[data-sensor-action="metadata-save"]').disabled = !!client.get().pending; }
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
      `<form data-sensor-form="${action}" data-expected-revision="${state.snapshot?.revision}" data-expected-current="${escape(state.snapshot?.currentCycleId || "")}"><label>Sensor Start Date<input type="date" name="date" required value="${escape(values.date)}"></label><label>Sensor Start Time<input type="time" name="time" required value="${escape(values.time)}"></label>${action === "start" ? `<label>Sensor Code<input type="text" name="sensorCode" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required value="${escape(values.sensorCode || "")}" aria-describedby="llt-sensor-code-help"></label><p id="llt-sensor-code-help" class="llt_sensor_help">4-digit code printed on the Dexcom G7 sensor/applicator.</p>` : ""}${action === "start" && c ? `<fieldset><legend>Sensor Being Replaced — Optional Details</legend>${metadataFields(values.replacementMetadata || {}, !state.supportsMetadata)}${!state.supportsMetadata ? '<p role="status">Replacement metadata is unavailable until the sensor database migration is installed. You can still replace the sensor without metadata.</p>' : ""}</fieldset>` : ""}<p>Enter the sensor’s start time, even if you are recording it later. Dates display in your local time zone.</p>${action === "edit_start" && c?.previous_cycle_id ? "<p>Changing this start time also changes the recorded replacement time of the previous sensor.</p>" : ""}<div data-sensor-occurrences></div><p role="alert" data-sensor-error></p><div class="llt_sensor_actions">${button("save", action === "start" ? "Review New Sensor" : "Review Start Correction")}${button("details", "Cancel")}</div></form>`,
    );
    const f = dialog.querySelector("form");
    f.addEventListener("input", () => {
      f.elements.sensorCode?.setCustomValidity("");
      draft = {
        action,
        date: f.elements.date.value,
        time: f.elements.time.value,
        sensorCode: f.elements.sensorCode?.value ?? null,
        replacementMetadata: f.elements.replacementReason && !f.elements.replacementReason.disabled ? {
          replacement_reason_id: f.elements.replacementReason.value || null,
          replacement_notes: f.elements.replacementNotes.value || null,
          replacement_requested: f.elements.replacementRequested.value === "" ? null : f.elements.replacementRequested.value === "true",
        } : null,
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
      replacementMetadata: f.elements.replacementReason && !f.elements.replacementReason.disabled ? readMetadata(f) : null,
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
      replacementMetadata: draft.replacementMetadata && Object.values(draft.replacementMetadata).some(v => v !== null) ? draft.replacementMetadata : null,
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
      else if (action === "history") allSensors(true);
      else if (action === "history-back") allSensors();
      else if (action === "history-more") { historyState.limit += 25; renderHistoryResults(); }
      else if (action === "history-record") {
        historyState.scroll = dialog.scrollTop; historyState.focusId = target.dataset.sensorId;
        sensorDetails(target.dataset.sensorId);
      }
      else if (action === "sensor-back") sensorDetails(selectedSensorId);
      else if (action === "metadata-edit") editMetadata();
      else if (action === "metadata-save") await saveMetadata();
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
  function applyMetadata(cycle, value) {
    for (const [key, field] of Object.entries(value)) {
      if (field === null) delete cycle[key]; else cycle[key] = field;
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
            return { data: { status: "ok", snapshot: structuredClone(data), capabilities: {sensorMetadata: 1} } };
          if (p.p_sensor_code != null && !D.isValidSensorCode(p.p_sensor_code))
            return { data: {status: "invalid_request", reason: "invalid_sensor_code"} };
          if (p.p_sensor_code != null && p.p_action !== "start")
            return { data: {status: "invalid_request", reason: "invalid_action_shape"} };
          if (p.p_replacement_metadata != null) {
            try { D.validateMetadata(p.p_replacement_metadata); }
            catch { return { data: {status: "invalid_request", reason: "invalid_replacement_metadata"} }; }
          }
          if (p.p_action === "update_metadata" && (p.p_started_at !== null || p.p_new_cycle_id !== null || p.p_confirm_replace || !p.p_target_cycle_id || p.p_replacement_metadata == null))
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
                if (p.p_replacement_metadata) applyMetadata(c, p.p_replacement_metadata);
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
            } else if (p.p_action === "update_metadata") {
              const target = data.cycles.find(x => x.id === p.p_target_cycle_id);
              if (!target || target.state !== "closed") { status = "invalid_state"; reason = "target_not_closed"; }
              else { applyMetadata(target, p.p_replacement_metadata); target.revision = rev; }
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
