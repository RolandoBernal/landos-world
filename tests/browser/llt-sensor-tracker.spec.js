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
  await page.getByLabel("Sensor Code", { exact: true }).fill("2345");
  await page.getByRole("button", { name: "Review New Sensor" }).click();
  await page.getByRole("button", { name: "Save Sensor Change" }).click();
  await expect(page.locator(".llt_sensor_dialog")).toContainText(
    "Currently tracked",
  );
}
test("start, correction, early replacement, undo and retained history survive reload", async ({
  page,
}) => {
  await page.addInitScript(() => Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true }));
  await open(page);
  expect(await page.evaluate(() => typeof crypto.getRandomValues)).toBe("function");
  await start(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("lando-world:llt-sensor-fixture:v1")));
  expect(saved.currentCycleId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  await page.locator(".llt_sensor_manage summary").click();
  await page.getByRole("button", { name: "Edit Start Time", exact: true }).click();
  await page.locator('input[name="time"]').fill("00:01");
  await page.getByRole("button", { name: "Review Start Correction" }).click();
  await page.getByRole("button", { name: "Save Sensor Change" }).click();
  await page
    .getByRole("button", { name: "Replace Sensor", exact: true })
    .last()
    .click();
  await page.getByLabel("Sensor Code", { exact: true }).fill("2345");
  await page.getByRole("button", { name: "Review New Sensor" }).click();
  await expect(page.locator(".llt_sensor_dialog")).toContainText(
    "Saving this change will end the current sensor and start the new one.",
  );
  await expect(page.locator(".llt_sensor_review dt")).toHaveText(["New sensor", "New sensor starts:", "Current sensor", "Current sensor started:"]);
  await expect(page.locator(".llt_sensor_review dd")).toHaveCount(4);
  await page.getByRole("button", { name: "Save Sensor Change" }).click();
  await expect(page.locator(".llt_sensor_dialog")).toContainText(
    "Replaced early",
  );
  await page.locator(".llt_sensor_manage summary").click();
  await page.getByRole("button", { name: "Edit Start Time", exact: true }).click();
  await expect(page.locator(".llt_sensor_dialog")).toContainText(
    "also changes the recorded replacement time",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.locator(".llt_sensor_manage summary").click();
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
  await page.locator(".llt_sensor_disclosure").click();
  await page.getByRole("button", { name: "Sensor Details & History" }).click();
  await expect(page.locator(".llt_sensor_dialog")).toContainText(
    "Cancelled — retained in history",
  );
  const persisted = await page.evaluate(() => ({
    cycles: JSON.parse(localStorage.getItem("lando-world:llt-sensor-fixture:v1")).cycles,
    operations: Object.keys(JSON.parse(localStorage.getItem("lando-world:llt-sensor-fixture:v1:receipts"))),
  }));
  expect(persisted.cycles).toHaveLength(2);
  expect(persisted.operations.length).toBeGreaterThanOrEqual(4);
  for (const id of [...persisted.cycles.map(cycle => cycle.id), ...persisted.operations])
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
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
    await expect(page.locator(".llt_sensor_disclosure")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".llt_sensor_time")).toBeHidden();
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
      if (!(await page.locator(".llt_sensor_card").evaluate((card) => card.open))) await page.locator(".llt_sensor_disclosure").click();
      await page
        .getByRole("button", { name: "Sensor Details & History" })
        .click();
      await expect(page.locator(".llt_sensor_dialog")).toBeVisible();
      expect(
        await page
          .locator(".llt_sensor_dialog")
          .evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
      ).toBe(true);
      await page.locator(".llt_sensor_manage summary").click();
      await page
        .getByRole("button", { name: "Edit Start Time", exact: true })
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
  await page.locator(".llt_sensor_disclosure").click();
  await expect(page.locator(".llt_sensor_card")).toContainText("Offline");
  await page
    .getByRole("button", { name: "Replace Sensor", exact: true })
    .click();
  await page.getByLabel("Sensor Code", { exact: true }).fill("2345");
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


test("tracked sensor disclosure is user controlled, keyboard accessible and responsive", async ({ page, context }) => {
  await open(page);
  await expect(page.getByRole("button", { name: "Start New Sensor", exact: true })).toBeVisible();
  await expect(page.locator(".llt_sensor_disclosure")).toHaveCount(0);
  await start(page);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const summary = page.locator(".llt_sensor_disclosure");
  const card = page.locator(".llt_sensor_card");
  const details = card.locator('[data-sensor-action="details"]');
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await expect(summary).toContainText("Dexcom G7");
  await expect(summary).toContainText("remaining");
  await expect(card.locator(".llt_sensor_time")).toBeHidden();
  await expect(card.locator(".llt_sensor_sync")).toBeHidden();
  await expect(details).toBeHidden();
  await summary.focus();
  await page.keyboard.press("Tab");
  expect(await details.evaluate((button) => button === document.activeElement)).toBe(false);
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await expect(card.locator(".llt_sensor_time")).toBeVisible();
  await expect(card.locator(".llt_sensor_sync")).toBeVisible();
  await expect(page.locator(".llt_sensor_dialog")).toHaveCount(0);
  await expect(details).toBeVisible();
  for (const [width, height] of [[320,740],[393,852],[768,1024],[1280,800],[852,393]]) {
    await page.setViewportSize({width,height});
    if (!(await card.evaluate(element => element.open))) await summary.click();
    await expect(details).toBeVisible();
    const geometry = await card.locator(".llt_sensor_actions").evaluate((actions) => {
      const [first,second] = [...actions.children].map((button) => { const r=button.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,clip:button.scrollWidth>button.clientWidth+1}; });
      return {first,second,width:actions.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.first.clip || geometry.second.clip).toBe(false);
    expect(geometry.first.height).toBeGreaterThanOrEqual(44);
    if (width<=640) {
      expect(geometry.second.y).toBeGreaterThan(geometry.first.y);
      expect(Math.abs(geometry.first.width-geometry.width)).toBeLessThan(2);
      expect(Math.abs(geometry.second.width-geometry.width)).toBeLessThan(2);
    } else {
      expect(geometry.first.y).toBe(geometry.second.y);
      expect(geometry.first.width).toBeLessThan(geometry.width);
    }
    await card.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.screenshot({path:`/private/tmp/llt-accordion-expanded-${width}.png`});
    await summary.click();
    await expect(summary).toHaveAttribute("aria-expanded", "false");
    await card.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.screenshot({path:`/private/tmp/llt-accordion-collapsed-${width}.png`});
    await summary.click();
    await expect(summary).toHaveAttribute("aria-expanded", "true");
  }
  await context.setOffline(true);
  await expect(card.locator(".llt_sensor_sync")).toContainText("Offline");
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await summary.focus();
  await page.keyboard.press("Space");
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await context.setOffline(false);
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await expect(details).toBeHidden();
  await page.screenshot({path:"/private/tmp/llt-accordion-collapsed.png"});
  await summary.click();
  await details.click();
  await expect(page.locator(".llt_sensor_dialog")).toContainText("Sensor Start");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await card.getByRole("button", { name: "Replace Sensor", exact: true }).click();
  await expect(page.locator('[data-sensor-form="start"]')).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await expect(summary).toHaveAttribute("aria-expanded", "false");
});

test("sensor management disclosure preserves keyboard containment and refresh flow", async ({ page }) => {
  await open(page);
  await start(page);
  const modal = page.locator(".llt_sensor_dialog");
  const summary = modal.locator(".llt_sensor_manage summary");
  const edit = modal.locator('[data-sensor-action="edit"]');
  const undo = modal.locator('[data-sensor-action="undo"]');
  await expect(modal.getByRole("heading", { name: "Sensor Management", exact: true })).toBeVisible();
  const replace = modal.getByRole("button", { name: "Replace Sensor", exact: true });
  await expect(replace).toHaveText("Replace Sensor");
  await expect(replace).toHaveClass(/lee_lee_diabetes_button--primary/);
  await expect(modal.locator("#llt-sensor-replace-description")).toHaveText("Start tracking a new Dexcom G7.");
  await expect(replace.locator("#llt-sensor-replace-description")).toHaveCount(0);
  expect(await modal.locator(".llt_sensor_management").evaluate((s) => getComputedStyle(s).borderTopWidth)).toBe("1px");
  expect(await modal.locator(".llt_sensor_history_section").evaluate((s) => getComputedStyle(s).borderTopWidth)).toBe("1px");
  await expect(modal.locator("#llt-sensor-history-title + .llt_sensor_history")).toBeVisible();
  expect(await modal.locator(".llt_sensor_history").first().evaluate((s) => getComputedStyle(s).borderTopWidth)).toBe("0px");
  await expect(modal.locator(".llt_sensor_sync_row")).toContainText("Last synced");
  await expect(modal.locator(".llt_sensor_management [data-sensor-action=refresh]")).toHaveCount(0);
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await expect(edit).toBeHidden();
  await expect(undo).toBeHidden();
  await summary.focus();
  await page.keyboard.press("Tab");
  await expect(modal.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await expect(edit).toHaveText("Edit Start Time");
  await expect(edit).toBeVisible();
  await expect(undo).toBeVisible();
  await expect(modal.locator(".llt_sensor_corrections")).toContainText("Change the start date or time if it was entered incorrectly. This will update the sensor’s expiration and grace-period times.");
  await expect(modal.locator(".llt_sensor_corrections")).toContainText("Remove a sensor that was added by mistake and restore the previous sensor when possible.");
  await page.keyboard.press("Space");
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await expect(edit).toBeHidden();
  await modal.locator(".llt_sensor_sync_row").getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(modal.locator(".llt_sensor_manage summary")).toHaveAttribute("aria-expanded", "false");
  await expect(modal.locator(".llt_sensor_history")).toContainText("Currently tracked");
  await modal.getByRole("button", { name: "Replace Sensor", exact: true }).click();
  await expect(modal.locator('form[data-sensor-form="start"]')).toBeVisible();
  await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  await modal.locator(".llt_sensor_manage summary").click();
  await modal.getByRole("button", { name: "Edit Start Time", exact: true }).click();
  await page.locator('input[name="date"]').fill("2099-01-01");
  await modal.getByRole("button", { name: "Review Start Correction" }).click();
  await expect(modal.locator("[data-sensor-error]")).toContainText("not in the future");
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
});

test("modal management fits narrow, wide and landscape viewports; no-sensor start remains available", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Sensor Details & History" }).click();
  const modal = page.locator(".llt_sensor_dialog");
  await expect(modal.getByRole("button", { name: "Start New Sensor", exact: true })).toBeVisible();
  await expect(modal.locator(".llt_sensor_management")).toHaveCount(0);
  await expect(modal.locator('[data-sensor-action="edit"], [data-sensor-action="undo"]')).toHaveCount(0);
  await modal.getByRole("button", { name: "Start New Sensor", exact: true }).click();
  await page.getByLabel("Sensor Code", { exact: true }).fill("2345");
  await page.getByRole("button", { name: "Review New Sensor" }).click();
  await page.getByRole("button", { name: "Save Sensor Change" }).click();
  await modal.getByRole("button", { name: "Close", exact: true }).click();
  await page.locator(".llt_sensor_disclosure").click();
  await page.getByRole("button", { name: "Sensor Details & History" }).click();
  for (const [width, height] of [[320,740],[393,852],[768,1024],[1280,800],[852,393]]) {
    await page.setViewportSize({ width, height });
    await expect(modal.locator(".llt_sensor_manage summary")).toHaveAttribute("aria-expanded", "false");
    await modal.locator(".llt_sensor_manage summary").click();
    await expect(modal.locator('[data-sensor-action="undo"]')).toBeVisible();
    expect(await modal.evaluate((d) => d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().width <= innerWidth && d.getBoundingClientRect().height <= innerHeight)).toBe(true);
    for (const action of ["start", "refresh", "edit", "undo"]) {
      expect(await modal.locator(`[data-sensor-action="${action}"]`).evaluate((b) => b.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    }
    await modal.locator('[data-sensor-action="undo"]').scrollIntoViewIfNeeded();
    await page.screenshot({ animations: "disabled", path: `/private/tmp/llt-management-expanded-${width}.png` });
    await modal.locator(".llt_sensor_manage summary").click();
    await modal.getByRole("button", { name: "Close", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ animations: "disabled", path: `/private/tmp/llt-management-collapsed-${width}.png` });
  }
  await modal.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sensor Details & History" })).toBeFocused();
});

test("sensor native date/time controls and stacked replacement review fit both themes", async ({ page }, testInfo) => {
  await open(page);
  await start(page);
  for (const width of [320, 393, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      if (!(await page.locator(".llt_sensor_card").evaluate(card => card.open))) await page.locator(".llt_sensor_disclosure").click();
      await page.getByRole("button", { name: "Replace Sensor", exact: true }).click();
      const modal = page.locator(".llt_sensor_dialog");
      const titleFits = await page.locator(".llt_sensor_disclosure").first().evaluate(summary => {
        const title=summary.querySelector("strong").getBoundingClientRect();
        const chevron=summary.querySelector(".lee_lee_diabetes_accordion_chevron").getBoundingClientRect();
        return title.right <= chevron.left && title.width > 0;
      });
      expect(titleFits).toBe(true);
      for (const type of ["date", "time", "text"]) {
        const input = modal.locator(`input[type=${type}]`);
        await expect(input).toBeVisible();
        if (type !== "text") expect(await input.evaluate(input => getComputedStyle(input).appearance)).toBe("none");
        const bounds = await input.evaluate(input => {
          const r = input.getBoundingClientRect(), p = input.parentElement.getBoundingClientRect();
          return { contained: r.left >= p.left && r.right <= p.right + 1, height: r.height, clipped: input.scrollWidth > input.clientWidth + 1 };
        });
        expect(bounds.contained).toBe(true);
        expect(bounds.clipped).toBe(false);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        await input.focus();
        await expect(input).toBeFocused();
      }
      expect(await modal.evaluate(d => d.scrollWidth <= d.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`sensor-inputs-${width}-${theme}.png`) });
      await page.getByLabel("Sensor Code", { exact: true }).fill("2345");
  await page.getByRole("button", { name: "Review New Sensor" }).click();
      await expect(modal.locator(".llt_sensor_review dt")).toHaveText(["New sensor", "New sensor starts:", "Current sensor", "Current sensor started:"]);
      const rows = await modal.locator(".llt_sensor_review dd").evaluateAll(rows => rows.map(row => row.getBoundingClientRect().y));
      expect(rows[1]).toBeGreaterThan(rows[0]);
      await expect(modal.getByText("Saving this change will end the current sensor and start the new one.", { exact: true })).toBeVisible();
      await expect(modal.getByRole("button", { name: "Save Sensor Change" })).toBeVisible();
      await expect(modal.getByRole("button", { name: "Cancel" })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`sensor-review-${width}-${theme}.png`) });
      await modal.getByRole("button", { name: "Cancel" }).click();
    }
  }
});

test('sensor code leading zeros stay attached through replacement, edit, undo, reload and second tab',async({page,context})=>{
  await open(page);
  const second=await context.newPage();await open(second);
  await start(page);
  await page.getByRole('button',{name:'Replace Sensor',exact:true}).last().click();
  const code=page.getByLabel('Sensor Code',{exact:true});
  await expect(code).toHaveValue('');
  await expect(code).toHaveAttribute('type','text');
  await expect(code).toHaveAttribute('inputmode','numeric');
  await expect(code).toHaveAttribute('pattern','[0-9]{4}');
  await expect(code).toHaveAttribute('maxlength','4');
  await page.getByLabel('Sensor Start Time',{exact:true}).fill('00:01');
  // Existing first cycle must predate replacement; use a synthetic past start.
  await page.getByLabel('Sensor Start Date',{exact:true}).fill('2026-10-01');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.locator('.llt_sensor_manage summary').click();
  await page.getByRole('button',{name:'Edit Start Time',exact:true}).click();
  await page.getByLabel('Sensor Start Date',{exact:true}).fill('2026-09-30');
  await page.getByLabel('Sensor Start Time',{exact:true}).fill('00:01');
  await page.getByRole('button',{name:'Review Start Correction'}).click();
  await page.getByRole('button',{name:'Save Sensor Change'}).click();
  await page.getByRole('button',{name:'Replace Sensor',exact:true}).last().click();
  // Cancelling a form is allowed to retain draft; enter the new code explicitly.
  await code.fill('0042');
  await page.getByLabel('Sensor Start Date',{exact:true}).fill('2026-10-01');
  await page.getByLabel('Sensor Start Time',{exact:true}).fill('00:02');
  await page.getByRole('button',{name:'Review New Sensor'}).click();
  await expect(page.locator('.llt_sensor_review dd')).toHaveText([
    'Dexcom G7 · 0042',/Oct 1/, 'Dexcom G7 · 2345',/Sep 30/
  ]);
  await page.getByRole('button',{name:'Save Sensor Change'}).click();
  await expect(second.locator('.llt_sensor_disclosure strong')).toHaveText('Dexcom G7 · 0042');
  await expect(page.locator('.llt_sensor_history').nth(0)).toContainText('Dexcom G7 · 0042');
  await expect(page.locator('.llt_sensor_history').nth(1)).toContainText('Dexcom G7 · 2345');
  await page.locator('.llt_sensor_manage summary').click();
  await page.getByRole('button',{name:'Edit Start Time',exact:true}).click();
  await expect(code).toHaveCount(0);
  await page.getByLabel('Sensor Start Time',{exact:true}).fill('00:03');
  await page.getByRole('button',{name:'Review Start Correction'}).click();
  await page.getByRole('button',{name:'Save Sensor Change'}).click();
  await expect(page.locator('.llt_sensor_card strong')).toHaveText('Dexcom G7 · 0042');
  await page.locator('.llt_sensor_manage summary').click();
  await page.getByRole('button',{name:'Undo Current Sensor',exact:true}).click();
  await page.getByRole('button',{name:'Undo Current Sensor',exact:true}).click();
  await expect(second.locator('.llt_sensor_disclosure strong')).toHaveText('Dexcom G7 · 2345');
  await expect(page.locator('.llt_sensor_history').filter({hasText:'Cancelled'})).toContainText('Dexcom G7 · 0042');
  await page.getByRole('button',{name:'Close',exact:true}).click();await page.reload();
  await expect(page.locator('.llt_sensor_disclosure strong')).toHaveText('Dexcom G7 · 2345');
  await second.close();
});

test('invalid sensor code cannot reach review or save; no normalization',async({page})=>{
  await open(page);
  await page.getByRole('button',{name:'Start New Sensor',exact:true}).click();
  for(const invalid of ['', '234','23456','23A5','12 34',' 2345','2345 ','٢٣٤٥','２３４５']){
    await page.getByLabel('Sensor Code',{exact:true}).evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},invalid);
    await page.getByRole('button',{name:'Review New Sensor'}).click();
    await expect(page.locator('[data-sensor-error]')).toHaveText('Enter the 4-digit sensor code.');
    await expect(page.getByRole('button',{name:'Save Sensor Change'})).toHaveCount(0);
  }
  await page.getByLabel('Sensor Code',{exact:true}).fill('0000');
  await page.getByRole('button',{name:'Review New Sensor'}).click();
  await expect(page.locator('.llt_sensor_review')).toContainText('Dexcom G7 · 0000');
});
