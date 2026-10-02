import { expect, test } from '@playwright/test';

async function seed(page, phase, overrides = {}) {
  await page.addInitScript(() => {
    window.__tones = [];
    window.AudioContext = class {
      state = 'running'; currentTime = 10; destination = {};
      createOscillator() {
        const tone = {};
        return { set type(value) { tone.type = value; }, frequency: { setValueAtTime(value) { tone.frequency = value; } },
          connect() {}, start(start) { tone.start = start; }, stop(stop) { tone.duration = stop - tone.start; window.__tones.push(tone); } };
      }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    };
  });
  await page.goto('/#/violet-futbol-game-tracker');
  await page.evaluate(({ phase, overrides }) => {
    const api = window.VioletFutbolGameTracker;
    const game = api.createGame({ team1: 'Hume-Fogg', team2: 'MLK', gameType: 'districtTournament' });
    Object.assign(game, { phase, status: 'inProgress', firstHalfStartedAt: Date.now(), secondHalfStartedAt: Date.now(), halftimeStartedAt: Date.now(), otFirstHalfStartedAt: Date.now(), otSecondHalfStartedAt: Date.now(), firstHalfGoalsTeam1: 2, firstHalfGoalsTeam2: 1 }, overrides);
    localStorage.setItem(api.ACTIVE_GAME_KEY, JSON.stringify(game));
  }, { phase, overrides });
  await page.reload();
  await page.getByRole('button', { name: 'Resume Game', exact: true }).click();
  await page.evaluate(() => { window.__tones = []; });
}
async function tones(page) { return page.evaluate(() => window.__tones); }
async function action(page, name) {
  await page.waitForTimeout(380);
  await page.locator(`#violet-futbol-game-tracker-view [data-vfgt-action="${name}"]`).click();
}
async function expectStartCue(page) {
  const played = await tones(page);
  expect(played).toHaveLength(1);
  expect(played[0].frequency).toBe(880);
  expect(played[0].type).toBe('triangle');
  expect(played[0].duration).toBeCloseTo(0.14);
}

for (const [phase, name] of [['first_half', 'end-first'], ['halftime', 'start-second'], ['second_half', 'end-second'], ['overtime_break', 'start-ot'], ['ot_first_half', 'end-ot'], ['ot_halftime', 'start-ot'], ['ot_second_half', 'end-ot']]) {
  test(`${name} from ${phase} uses one existing Start cue only after confirmation`, async ({ page }) => {
    await seed(page, phase);
    await action(page, name);
    await expect(page.getByRole('alertdialog')).toBeVisible();
    expect(await tones(page)).toEqual([]);
    await page.locator('[data-vfgt-confirm="cancel"]').click();
    expect(await tones(page)).toEqual([]);
    await action(page, name);
    await page.locator('[data-vfgt-confirm="confirm"]').click();
    await expectStartCue(page);
  });
}

for (const phase of ['second_half', 'ot_second_half']) {
  test(`tied ${phase} playoff decision preserves silent cancellation and one shared End cue`, async ({ page }) => {
    await seed(page, phase, { firstHalfGoalsTeam2: 2 });
    const name = phase === 'second_half' ? 'end-second' : 'end-ot';
    await action(page, name);
    expect(await tones(page)).toEqual([]);
    await page.locator('[data-vfgt-confirm="cancel"]').click();
    expect(await tones(page)).toEqual([]);
    await action(page, name);
    await page.locator('[data-vfgt-confirm="confirm"]').click();
    await expectStartCue(page);
  });
}

test('PK start and finish preserve their existing silent feedback behavior', async ({ page }) => {
  await seed(page, 'penalty_break');
  await action(page, 'start-pk');
  expect(await tones(page)).toEqual([]);
  await page.locator('[data-vfgt-confirm="confirm"]').click();
  expect(await tones(page)).toEqual([]);
  await action(page, 'finish-pk');
  expect(await tones(page)).toEqual([]);
  await page.locator('[data-vfgt-confirm="cancel"]').click();
  expect(await tones(page)).toEqual([]);
  await action(page, 'finish-pk');
  await page.locator('[data-vfgt-confirm="confirm"]').click();
  expect(await tones(page)).toEqual([]);
});

test('elapsed regulation alert retains its separate two-tone whistle', async ({ page }) => {
  await seed(page, 'first_half');
  await page.evaluate(() => { const originalNow = Date.now; Date.now = () => originalNow() + 2401000; });
  await expect.poll(async () => (await tones(page)).length).toBe(2);
  expect((await tones(page)).map(tone => [tone.frequency, tone.type])).toEqual([[1480, 'square'], [1720, 'square']]);
});

for (const phase of ['second_half', 'ot_second_half']) {
  test(`finish-as-tie from ${phase} stays silent through both cancellations and cues once on final confirmation`, async ({ page }) => {
    await seed(page, phase, { firstHalfGoalsTeam2: 2 });
    const name = phase === 'second_half' ? 'end-second' : 'end-ot';
    await action(page, name);
    await page.locator('[data-vfgt-confirm="alternative"]').click();
    expect(await tones(page)).toEqual([]);
    await page.locator('[data-vfgt-confirm="cancel"]').click();
    expect(await tones(page)).toEqual([]);
    await action(page, name);
    await page.locator('[data-vfgt-confirm="alternative"]').click();
    expect(await tones(page)).toEqual([]);
    await page.locator('[data-vfgt-confirm="confirm"]').click();
    await expectStartCue(page);
  });
}
