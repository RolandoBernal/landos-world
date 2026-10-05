// Synthetic LOCAL-only Auth/REST integration. No production configuration imported.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
const enabled = process.env.LLT_LOCAL_SENSOR_DB_TEST === "1";
test(
  "local Auth JWTs scope REST RPCs and browser-table access for two synthetic users",
  { skip: !enabled },
  async () => {
    const config = JSON.parse(
      fs.readFileSync("/private/tmp/llt14-local-status.json", "utf8"),
    );
    assert.equal(config.API_URL, "http://127.0.0.1:54321");
    const key = config.ANON_KEY,
      base = config.API_URL;
    async function signup() {
      const r = await fetch(base + "/auth/v1/signup", {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `sensor-${randomUUID()}@example.com`,
          password: `Local-test-${randomUUID()}!`,
        }),
      });
      const data = await r.json();
      assert.equal(r.ok, true, JSON.stringify(data));
      assert.ok(data.access_token);
      return data;
    }
    const a = await signup(),
      b = await signup();
    const socket = new WebSocket(
      base.replace("http:", "ws:") +
        `/realtime/v1/websocket?apikey=${key}&vsn=1.0.0`,
    );
    const messages = [];
    socket.addEventListener("message", (event) =>
      messages.push(JSON.parse(event.data)),
    );
    const until = async (predicate) => {
      const end = Date.now() + 15000;
      while (!predicate()) {
        assert.ok(
          Date.now() < end,
          "Local realtime subscription/delivery timed out",
        );
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    };
    try {
      await until(() => socket.readyState === WebSocket.OPEN);
      socket.send(
        JSON.stringify({
          topic: "realtime:sensor-local-test",
          event: "phx_join",
          ref: "1",
          payload: {
            access_token: a.access_token,
            config: {
              broadcast: { self: false },
              presence: { key: "" },
              postgres_changes: [
                {
                  event: "*",
                  schema: "public",
                  table: "llt_sensor_contexts",
                  filter: `user_id=eq.${a.user.id}`,
                },
              ],
            },
          },
        }),
      );
      await until(() =>
        messages.some((m) => m.event === "system" && m.payload.status === "ok"),
      );
      async function request(user, path, body) {
        return fetch(base + path, {
          method: body ? "POST" : "GET",
          headers: {
            apikey: key,
            Authorization: `Bearer ${user.access_token}`,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      }
      const id = randomUUID(),
        op = randomUUID(),
        body = {
          p_operation_id: op,
          p_action: "start",
          p_expected_revision: 0,
          p_expected_current_cycle_id: null,
          p_new_cycle_id: id,
          p_started_at: new Date(Date.now() - 3600000).toISOString(),
          p_confirm_replace: false,
          p_actor_label: "Emily",
          p_device_metadata: { device_profile: "Synthetic local test" },
        };
      for (const user of [a, b]) {
        const r = await request(
          user,
          "/rest/v1/rpc/llt_mutate_sensor_cycle",
          body,
        );
        const result = await r.json();
        assert.equal(result.status, "accepted", JSON.stringify(result));
        assert.equal(result.snapshot.cycles[0].user_id, user.user.id);
      }
      await until(() => messages.some((m) => m.event === "postgres_changes"));
      const delivered = messages.filter((m) => m.event === "postgres_changes");
      assert.ok(
        delivered.every((m) => m.payload.data.record.user_id === a.user.id),
      );
      const refreshed = await (
        await request(a, "/rest/v1/rpc/llt_get_sensor_snapshot", {})
      ).json();
      assert.equal(refreshed.snapshot.revision, 1);
      for (const [user, other] of [
        [a, b],
        [b, a],
      ]) {
        const r = await request(
          user,
          `/rest/v1/llt_sensor_cycles?user_id=eq.${other.user.id}&select=id`,
        );
        assert.equal(r.ok, true);
        assert.deepEqual(await r.json(), []);
      }
      const denied = await request(a, "/rest/v1/llt_sensor_contexts", {
        user_id: b.user.id,
        revision: 0,
      });
      assert.equal(denied.ok, false);
      const helper = await request(
        a,
        "/rest/v1/rpc/llt_sensor_snapshot_for_user",
        { p_uid: b.user.id },
      );
      assert.equal(helper.ok, false);
      const replay = await (
        await request(a, "/rest/v1/rpc/llt_mutate_sensor_cycle", body)
      ).json();
      assert.equal(replay.replayed, true);
      assert.equal(replay.snapshot.revision, 1);
      const health = await fetch(base + "/auth/v1/health", {
        headers: { apikey: key },
      });
      assert.equal(health.ok, true);
    } finally {
      socket.close();
    }
  },
);
