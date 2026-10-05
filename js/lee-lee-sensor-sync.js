(function () {
  "use strict";
  const D = globalThis.LeeLeeDexcomSensor;
  function create({
    storage = globalThis.localStorage,
    online = () => navigator.onLine !== false,
    changed = () => {},
    locks = globalThis.navigator?.locks,
  } = {}) {
    let connection = null,
      generation = 0,
      channel = null,
      running = false;
    let state = {
      uid: null,
      snapshot: null,
      verified: false,
      lastFetchedAt: null,
      pending: null,
      error: "",
      offline: !online(),
    };
    const key = (kind) => `lando-world:llt-sensor:${kind}:v1:${state.uid}`;
    const emit = () => changed({ ...state, offline: !online() });
    function read(kind) {
      try {
        return JSON.parse(storage.getItem(key(kind)) || "null");
      } catch {
        return null;
      }
    }
    function write(kind, value) {
      storage.setItem(key(kind), JSON.stringify(value));
    }
    function accept(snapshot) {
      D.validate(snapshot, state.uid);
      if (state.snapshot) {
        if (snapshot.revision < state.snapshot.revision) return false;
        if (
          snapshot.revision === state.snapshot.revision &&
          JSON.stringify(snapshot) !== JSON.stringify(state.snapshot)
        )
          throw new Error(
            "Sensor snapshot disagrees at the same revision. Refresh before making changes.",
          );
      }
      state.snapshot = snapshot;
      state.verified = true;
      state.lastFetchedAt = new Date().toISOString();
      state.error = "";
      try {
        write("cache", { snapshot, lastFetchedAt: state.lastFetchedAt });
      } catch {
        state.error =
          "Sensor state loaded, but local cache could not be saved.";
      }
      return true;
    }
    async function refresh() {
      const own = connection,
        epoch = generation;
      if (!own) return;
      if (!online()) {
        emit();
        return;
      }
      try {
        const { data, error } = await own.client.rpc("llt_get_sensor_snapshot");
        if (epoch !== generation) return;
        if (error || data?.status !== "ok")
          throw new Error(
            "Sensor sync unavailable. Last known state is shown.",
          );
        accept(data.snapshot);
      } catch (e) {
        if (epoch === generation) state.error = e.message;
      }
      if (epoch === generation) emit();
    }
    function connect(next) {
      if (connection?.uid === next?.uid && connection?.client === next?.client)
        return;
      generation++;
      if (channel) connection?.client.removeChannel?.(channel);
      channel = null;
      connection = next;
      state = {
        uid: next?.uid || null,
        snapshot: null,
        verified: false,
        lastFetchedAt: null,
        pending: null,
        error: "",
        offline: !online(),
      };
      if (next) {
        const cached = read("cache");
        try {
          if (cached) {
            state.snapshot = D.validate(cached.snapshot, next.uid);
            state.lastFetchedAt = cached.lastFetchedAt;
          }
        } catch {
          state.error = "Cached sensor state is unavailable.";
        }
        state.pending = read("pending");
        channel = next.client
          .channel(`llt-sensor-${next.uid}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "llt_sensor_contexts",
              filter: `user_id=eq.${next.uid}`,
            },
            () => refresh(),
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") refresh();
          });
        const connectedGeneration = generation;
        refresh().then(() => {
          if (generation === connectedGeneration && state.pending && online())
            submit();
        });
      }
      emit();
    }
    async function submit(request = null) {
      if (!connection || !online()) {
        state.error = "Not saved — reconnect and review the sensor state.";
        emit();
        return { status: "offline" };
      }
      if (!locks) {
        state.error =
          "Not saved — this browser cannot safely coordinate sensor changes.";
        emit();
        return { status: "unavailable" };
      }
      const uid = state.uid;
      return locks.request(`llt-sensor-write:${uid}`, async () => {
        if (!connection || uid !== state.uid) return { status: "signed_out" };
        state.pending = read("pending");
        if (state.pending && request) {
          emit();
          return { status: "pending" };
        }
        if (running) return { status: "pending" };
        const pending = request || state.pending;
        if (!pending) return { status: "idle" };
        const epoch = generation,
          own = connection;
        if (request) {
          try {
            write("pending", request);
            state.pending = request;
          } catch {
            state.error = "Not saved — the request could not be stored safely.";
            emit();
            return { status: "storage_failed" };
          }
        }
        running = true;
        emit();
        try {
          const { data, error } = await own.client.rpc(
            "llt_mutate_sensor_cycle",
            pending,
          );
          if (epoch !== generation) return { status: "signed_out" };
          if (error || !data)
            throw new Error("Outcome unknown — reconnect to confirm.");
          if (
            ![
              "accepted",
              "conflict",
              "invalid_state",
              "invalid_request",
            ].includes(data.status)
          )
            throw new Error("Outcome unknown — invalid server response.");
          if (data.snapshot) accept(data.snapshot);
          storage.removeItem(key("pending"));
          state.pending = null;
          state.error =
            data.status === "accepted"
              ? ""
              : data.status === "conflict"
                ? "Sensor changed on another device. Review the current state before saving again."
                : `Not saved — ${String(data.reason || "invalid request").replaceAll("_", " ")}.`;
          emit();
          return data;
        } catch (e) {
          if (epoch === generation) {
            state.error = "Outcome unknown — reconnect to confirm.";
            emit();
          }
          return { status: "unknown" };
        } finally {
          running = false;
        }
      });
    }
    function request(
      action,
      {
        id = null,
        start = null,
        confirmed = false,
        actor = "Unknown",
        metadata = {},
      } = {},
    ) {
      if (!state.verified || !state.snapshot)
        throw new Error("Refresh the authoritative sensor state first.");
      return {
        p_operation_id: crypto.randomUUID(),
        p_action: action,
        p_expected_revision: state.snapshot.revision,
        p_expected_current_cycle_id: state.snapshot.currentCycleId,
        p_new_cycle_id: action === "start" ? id || crypto.randomUUID() : null,
        p_started_at: action === "undo_current" ? null : start,
        p_confirm_replace: action === "start" && confirmed,
        p_actor_label: actor,
        p_device_metadata: metadata,
      };
    }
    const get = () => ({ ...state, offline: !online() });
    return {
      connect,
      refresh,
      submit,
      request,
      get,
      async resume() {
        await refresh();
        if (state.pending && online()) return submit();
      },
    };
  }
  globalThis.LeeLeeSensorSync = Object.freeze({ create });
})();
