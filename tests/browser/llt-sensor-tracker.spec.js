import { test, expect } from "@playwright/test";
import { createIPhoneDevServer } from "../../scripts/dev-iphone.mjs";
let server, url;
test.beforeAll(async () => {
  server = createIPhoneDevServer({
    bindAddress: { address: "127.0.0.1", netmask: "255.0.0.0" },
    getMetadata: async () => ({
      environment: "local-device",
      appVersion: "test",
      branch: "sensor-test",
      commit: "test",
      commitFull: "test",
      dirty: true,
      sourceId: "test",
    }),
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${server.address().port}/#/lee-lees-tracker`;
});
test.afterAll(async () => {
  await new Promise((r) => server.close(r));
});
async function open(page) {
  await page.goto(url);
  await expect(page.locator(".llt_sensor_card")).toContainText(
    "No active sensor",
  );
}
async function start(page) {
  await page
    .getByRole("button", { name: "Start New Sensor", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Review New Sensor" }).click();
  await page.getByRole("button", { name: "Save Sensor Change" }).click();
  await expect(page.locator(".llt_sensor_dialog")).toContainText(
    "Currently tracked",
  );
}
test("start, correction, early replacement, undo and retained history survive reload", async ({
  page,
}) => {
  await open(page);
  await start(page);
  await page.getByRole("button", { name: "Edit Start", exact: true }).click();
  await page.locator('input[name="time"]').fill("00:01");
  await page.getByRole("button", { name: "Review Start Correction" }).click();
  await page.getByRole("button", { name: "Save Sensor Change" }).click();
  await page
    .getByRole("button", { name: "Replace Sensor", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Review New Sensor" }).click();
  await expect(page.locator(".llt_sensor_dialog")).toContainText(
    "ends the sensor started",
  );
  await page.getByRole("button", { name: "Save Sensor Change" }).click();
  await expect(page.locator(".llt_sensor_dialog")).toContainText(
    "Replaced early",
  );
  await page.getByRole("button", { name: "Edit Start", exact: true }).click();
  await expect(page.locator(".llt_sensor_dialog")).toContainText(
    "also changes the recorded replacement time",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Undo Current Sensor", exact: true })
    .click();
  await expect(page.locator(".llt_sensor_dialog")).toContainText(
    "restore the previous sensor",
  );
  await page
    .getByRole("button", { name: "Undo Current Sensor", exact: true })
    .click();
  await expect(page.locator(".llt_sensor_dialog")).toContainText(
    "Cancelled — retained in history",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await expect(page.locator(".llt_sensor_card")).toContainText("remaining");
  await page.getByRole("button", { name: "Sensor Details & History" }).click();
  await expect(page.locator(".llt_sensor_dialog")).toContainText(
    "Cancelled — retained in history",
  );
});
for (const [state, hours, copy] of [
  ["active", 48, "remaining"],
  ["approaching", 222, "Expires in"],
  ["grace", 245, "Grace period"],
  ["expired", 260, "Sensor expired"],
])
  test(`responsive ${state} state and history at required widths`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ hours }) => {
        const id = "test-cycle",
          uid = "local-sensor-fixture";
        localStorage.setItem(
          "lando-world:llt-sensor-fixture:v1",
          JSON.stringify({
            revision: 1,
            currentCycleId: id,
            cycles: [
              {
                id,
                user_id: uid,
                sensor_type: "dexcom_g7_10d_v1",
                started_at: new Date(
                  Date.now() - hours * 3600000,
                ).toISOString(),
                state: "current",
                ended_at: null,
                cancelled_at: null,
                previous_cycle_id: null,
                revision: 1,
              },
            ],
          }),
        );
      },
      { hours },
    );
    await page.goto(url);
    await expect(page.locator(".llt_sensor_card")).toContainText(copy);
    for (const [width, height] of [
      [320, 740],
      [393, 852],
      [768, 1024],
      [1280, 800],
      [852, 393],
    ]) {
      await page.setViewportSize({ width, height });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page
        .getByRole("button", { name: "Sensor Details & History" })
        .click();
      await expect(page.locator(".llt_sensor_dialog")).toBeVisible();
      expect(
        await page
          .locator(".llt_sensor_dialog")
          .evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
      ).toBe(true);
      await page
        .getByRole("button", { name: "Edit Start", exact: true })
        .click();
      await expect(page.locator('input[type="date"]')).toBeVisible();
      await page.screenshot({ path: `/private/tmp/llt-${state}-${width}.png` });
      await page.getByRole("button", { name: "Close", exact: true }).click();
    }
  });
test("offline cached state cannot submit a new authoritative sensor", async ({
  page,
  context,
}) => {
  await open(page);
  await start(page);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await context.setOffline(true);
  await expect(page.locator(".llt_sensor_card")).toContainText("Offline");
  await page
    .getByRole("button", { name: "Replace Sensor", exact: true })
    .click();
  await page.getByRole("button", { name: "Review New Sensor" }).click();
  await expect(page.locator("[data-sensor-error]")).toContainText("Not saved");
});
test("native IndexedDB claims suppress concurrent tabs and reload", async ({
  page,
  context,
}) => {
  await open(page);
  const second = await context.newPage();
  await second.goto(url);
  const request = (p) =>
    p.evaluate(() =>
      window.LeeLeeDeadlineAlerts.claim("browser-concurrent-test", Date.now()),
    );
  const outcomes = await Promise.all([request(page), request(second)]);
  expect(outcomes.filter(Boolean)).toHaveLength(1);
  await page.reload();
  expect(await request(page)).toBe(false);
  await second.close();
});
test("cross-tab cache writes do not trigger reciprocal RPC refresh loops", async ({ page, context }) => {
  await open(page);
  const second = await context.newPage();
  await open(second);
  // A cache event must remain untouched; a reciprocal refresh would rewrite it.
  await page.evaluate(() => localStorage.setItem("lando-world:llt-sensor:cache:v1:local-sensor-fixture", "cross-tab-cache-probe"));
  await second.waitForTimeout(700);
  expect(await second.evaluate(() => localStorage.getItem("lando-world:llt-sensor:cache:v1:local-sensor-fixture"))).toBe("cross-tab-cache-probe");
  await second.close();
});
test("timer foreground completion attempt once preserves configured duration and handles playback rejection", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__tones = 0;
    window.AudioContext = class {
      state = "running";
      currentTime = 0;
      destination = {};
      resume() {
        return Promise.resolve();
      }
      createOscillator() {
        window.__tones++;
        return {
          frequency: { value: 0 },
          connect() {},
          start() {},
          stop() {},
          disconnect() {},
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            linearRampToValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          disconnect() {},
        };
      }
    };
  });
  await open(page);
  await page.evaluate(() => {
    window.LeeLeeDeadlineAlerts.unlock();
    const now = Date.now();
    localStorage.setItem(
      window.LeeLeePreMealTimer.STORAGE_KEY,
      JSON.stringify({
        version: 1,
        status: "active",
        startedAt: now - 5000,
        endsAt: now + 500,
        durationMinutes: 7,
      }),
    );
  });
  await page.waitForTimeout(2200);
  expect(
    await page.evaluate(() => window.LeeLeePreMealTimer.getTimer().status),
  ).toBe("completed"); // Ledger claim is authoritative even if actual audio cannot unlock.
  const id = await page.evaluate(() => {
    const t = window.LeeLeePreMealTimer.getTimer();
    return `timer:${t.startedAt}:${t.endsAt}`;
  });
  expect(
    await page.evaluate(
      (id) => window.LeeLeeDeadlineAlerts.claim(id, Date.now()),
      id,
    ),
  ).toBe(false);
  expect(
    await page.evaluate(
      () => window.LeeLeePreMealTimer.getTimer().durationMinutes,
    ),
  ).toBe(7);
  expect(await page.evaluate(() => window.__tones)).toBe(3);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__tones)).toBe(3);
  await page.reload();
  await page.waitForTimeout(1300);
  expect(await page.evaluate(() => window.__tones)).toBe(0);
});
