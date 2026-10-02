import { expect, test } from '@playwright/test';

const route = '/#/violet-futbol-game-tracker';
const activeKey = 'lando-world:violet-futbol-game-tracker:active-game:v1';
const appSelector = '#violet-futbol-game-tracker-view';

async function seed(page, phase = 'second_half', overrides = {}) {
  await page.goto(route);
  await page.evaluate(({ phase, overrides, activeKey }) => {
    const api = window.VioletFutbolGameTracker;
    const settings = JSON.parse(localStorage.getItem(api.SETTINGS_KEY));
    const game = api.createGame({ team1: 'Hume-Fogg', team2: 'RePublic', teamSide: 1, gameType: 'districtTournament', teamId: settings.currentTeamId, seasonId: settings.currentSeasonId });
    Object.assign(game, { phase, firstHalfGoalsTeam1: 1, firstHalfGoalsTeam2: 1, secondHalfStartedAt: Date.now() - 2400000 }, overrides);
    localStorage.setItem(activeKey, JSON.stringify(game));
    window.__copies = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => window.__copies.push(text) } });
  }, { phase, overrides, activeKey });
  await page.reload();
  await page.evaluate(() => {
    window.__copies = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => window.__copies.push(text) } });
  });
  await page.locator(appSelector).getByRole('button', { name: 'Resume Game', exact: true }).click();
}

async function action(page, selector) {
  // Respect the existing duplicate touch/click safeguard between separate actions.
  await page.waitForTimeout(380);
  await page.locator(`${appSelector} [data-vfgt-action="${selector}"]`).click();
}
async function confirm(page, label) {
  await page.getByRole('alertdialog').getByRole('button', { name: label, exact: true }).click();
}
async function stored(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), activeKey); }

test('VFGT playoff regulation choices commit only after confirmation, with explicit tie escape', async ({ page }) => {
  await seed(page);
  await action(page, 'end-second');
  await confirm(page, 'Keep Playing');
  expect((await stored(page)).phase).toBe('second_half');
  await expect(page.locator('.vfgt_match_update')).toHaveCount(0);
  await action(page, 'end-second');
  await confirm(page, 'End Game as Tie');
  await confirm(page, 'Go Back');
  expect((await stored(page)).phase).toBe('second_half');
  await action(page, 'end-second');
  await confirm(page, 'End Game as Tie');
  await confirm(page, 'Finish as Tie');
  expect((await stored(page)).completionDecision).toBe('tie_override');
  await expect(page.locator('.vfgt_copy_score')).toHaveAttribute('data-vfgt-copy', 'Final Score:\nHume-Fogg 1 - 1 RePublic');
});

test('VFGT normal tied and non-tied playoff regulation retain normal finish', async ({ page }) => {
  for (const overrides of [{ gameType: 'friendly' }, { secondHalfGoalsTeam1: 1 }]) {
    await seed(page, 'second_half', overrides);
    await action(page, 'end-second');
    await confirm(page, 'End Second Half');
    expect((await stored(page)).phase).toBe('final');
    await expect(page.locator('.vfgt_copy_score')).not.toContainText('After Overtime');
  }
});

test('VFGT complete OT and PK flow, immutable copy, undo, recovery and saved final', async ({ page }) => {
  await seed(page);
  await action(page, 'end-second'); await confirm(page, 'Start Overtime');
  expect((await stored(page)).phase).toBe('overtime_break');
  await expect(page.locator('.vfgt_match_update')).toContainText('End of Regulation:');
  await expect(page.locator('[data-vfgt-seven-segment-display]')).toHaveCount(0);
  await action(page, 'start-ot'); await confirm(page, 'Cancel');
  expect((await stored(page)).phase).toBe('overtime_break');
  await action(page, 'start-ot'); await confirm(page, 'Start Half');
  await expect(page.locator('.vfgt_phase')).toHaveText('Overtime 1st Half');
  await action(page, 'end-ot'); await confirm(page, 'End Half');
  expect((await stored(page)).phase).toBe('ot_halftime');
  await action(page, 'start-ot'); await confirm(page, 'Start Half');
  await action(page, 'end-ot'); await confirm(page, 'Keep Playing');
  expect((await stored(page)).phase).toBe('ot_second_half');
  await action(page, 'end-ot'); await confirm(page, 'Start Penalty Kicks');
  expect((await stored(page)).phase).toBe('penalty_break');
  await action(page, 'start-pk'); await confirm(page, 'RePublic');
  await action(page, 'change-pk-first'); await confirm(page, 'Hume-Fogg');
  await expect(page.locator('.vfgt_pk_next')).toContainText('Hume-Fogg');
  await action(page, 'change-pk-first'); await confirm(page, 'RePublic');
  await expect(page.locator('.vfgt_pk_next')).toContainText('RePublic');
  await expect(page.locator('[data-vfgt-score]')).toHaveCount(0);
  await action(page, 'pk-scored');
  await expect(page.locator('.vfgt_match_update')).toHaveAttribute('data-vfgt-copy', '🟢 Penalty Scored — RePublic\nHume-Fogg 0 - 1 RePublic\nPenalty Kicks');
  await page.locator('.vfgt_match_update').click();
  await expect(page.locator('.vfgt_copy_status')).toHaveText('Copied!');
  expect(await page.evaluate(() => window.__copies.at(-1))).toBe('🟢 Penalty Scored — RePublic\nHume-Fogg 0 - 1 RePublic\nPenalty Kicks');
  await action(page, 'undo-pk');
  await expect(page.locator('.vfgt_match_update')).toHaveCount(0);
  await expect(page.locator('.vfgt_pk_next')).toContainText('RePublic');
  await action(page, 'pk-missed'); await action(page, 'pk-scored');
  await page.reload(); await action(page, 'resume');
  expect((await stored(page)).penaltyAttempts).toHaveLength(2);
  await expect(page.locator('.vfgt_pk_next')).toContainText('RePublic');
  await action(page, 'finish-pk'); await confirm(page, 'Keep Shootout Open');
  expect((await stored(page)).phase).toBe('penalties');
  await action(page, 'finish-pk'); await confirm(page, 'Finish Match');
  const finalText = 'Final Score:\nHume-Fogg 1 - 1 RePublic\nHume-Fogg wins 1 - 0 on penalties';
  await expect(page.locator('.vfgt_copy_score')).toHaveAttribute('data-vfgt-copy', finalText);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await action(page, 'save');
  const app = page.locator(appSelector);
  const past = app.locator('.vfgt_accordion').filter({ hasText: 'Past Games' });
  await page.waitForTimeout(380);
  await past.evaluate(element => { element.open = true; });
  await page.waitForTimeout(380);
  await past.locator('.vfgt_past_card .vfgt_card_summary').click();
  await expect(page.locator('.vfgt_copy_score')).toHaveAttribute('data-vfgt-copy', finalText);
});

test('VFGT OT reload reconciles elapsed added time and preserves score snapshot', async ({ page }) => {
  await seed(page, 'ot_first_half', { overtimePlayed: true, otFirstHalfStartedAt: Date.now() - 665000 });
  await expect(page.locator('.vfgt_stoppage')).toContainText('stoppage');
  await page.waitForTimeout(380);
  await page.locator('[data-vfgt-score="1"][data-delta="1"]').click();
  await expect(page.locator('.vfgt_match_update')).toContainText('Overtime 1st Half: Minute 10+2');
  await page.reload(); await action(page, 'resume');
  expect((await stored(page)).otGoalsTeam1).toBe(1);
  await expect(page.locator('.vfgt_stoppage')).toBeVisible();
});

for (const width of [320, 393, 768, 1280]) {
  test(`VFGT PK sudden-death layout at ${width}px with long names and landscape`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    const attempts = Array.from({ length: 16 }, (_, i) => ({ team: i % 2 ? 2 : 1, scored: true }));
    await seed(page, 'penalties', { overtimePlayed: true, team1: 'Hume-Fogg Academic Magnet High School', team2: 'RePublic School With A Very Long School Name', penaltyFirstTeam: 1, penaltyAttempts: attempts });
    for (const viewport of [{ width, height: 850 }, { width: Math.max(width, 700), height: 393 }]) {
      await page.setViewportSize(viewport);
      await expect(page.locator('[data-vfgt-action="pk-scored"]')).toBeVisible();
      await expect(page.locator('.vfgt_pk_history th[scope="col"]').filter({ hasText: /^8$/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/vfgt-pk-${viewport.width}-${viewport.height}.png`, fullPage: true });
    }
  });
}

test('VFGT OT final and OT tie safeguard remain explicit', async ({ page }) => {
  await seed(page, 'ot_second_half', { overtimePlayed: true, otSecondHalfStartedAt: Date.now(), otGoalsTeam1: 1 });
  await action(page, 'end-ot'); await confirm(page, 'Cancel');
  expect((await stored(page)).phase).toBe('ot_second_half');
  await action(page, 'end-ot'); await confirm(page, 'End Half');
  await expect(page.locator('.vfgt_copy_score')).toHaveAttribute('data-vfgt-copy', 'Final Score:\nHume-Fogg 2 - 1 RePublic\nAfter Overtime');
  await seed(page, 'ot_second_half', { overtimePlayed: true, otSecondHalfStartedAt: Date.now() });
  await action(page, 'end-ot'); await confirm(page, 'End Game as Tie'); await confirm(page, 'Go Back');
  expect((await stored(page)).phase).toBe('ot_second_half');
  await action(page, 'end-ot'); await confirm(page, 'End Game as Tie'); await confirm(page, 'Finish as Tie');
  expect((await stored(page)).completionDecision).toBe('tie_override');
  await expect(page.locator('.vfgt_copy_score')).toHaveAttribute('data-vfgt-copy', 'Final Score:\nHume-Fogg 1 - 1 RePublic\nAfter Overtime');
});

for (const width of [320, 393, 768, 1280]) {
  test(`VFGT iPhone follow-up centers break scores and lays out playoff decisions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    const names = { team1: 'Hume-Fogg Academic Magnet High School', team2: 'Opponent With A Very Long School Name' };
    for (const phase of ['overtime_break', 'ot_halftime', 'penalty_break']) {
      await seed(page, phase, names);
      const scores = page.locator('.vfgt_readonly_score');
      await expect(scores).toHaveCount(2);
      for (const score of await scores.all()) {
        const geometry = await score.evaluate(element => {
          const range = document.createRange(); range.selectNodeContents(element);
          const text = range.getBoundingClientRect();
          const parent = element.parentElement.getBoundingClientRect();
          return { offset: Math.abs((text.left + text.right) / 2 - (parent.left + parent.right) / 2), align: getComputedStyle(element).textAlign };
        });
        expect(geometry.align).toBe('center');
        expect(geometry.offset).toBeLessThan(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    for (const phase of ['second_half', 'ot_second_half']) {
      await seed(page, phase, { ...names, overtimePlayed: phase === 'ot_second_half', otSecondHalfStartedAt: Date.now() });
      await action(page, phase === 'second_half' ? 'end-second' : 'end-ot');
      const dialog = page.getByRole('alertdialog');
      const actions = dialog.locator('.vfgt_confirm__actions');
      const boxes = await actions.locator('button').evaluateAll(buttons => buttons.map(button => {
        const box = button.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(button);
        return { x: box.x, y: box.y, width: box.width, height: box.height, textLines: range.getClientRects().length, textWidth: range.getBoundingClientRect().width };
      }));
      expect(boxes).toHaveLength(3);
      const areaWidth = await actions.evaluate(element => element.getBoundingClientRect().width);
      for (const box of boxes) {
        expect(box.height).toBeGreaterThanOrEqual(52);
        expect(box.textLines).toBe(1);
        expect(box.textWidth).toBeLessThan(box.width);
        expect(Math.abs(box.width - boxes[0].width)).toBeLessThan(1);
      }
      if (width <= 680) {
        for (const box of boxes) expect(Math.abs(box.width - areaWidth)).toBeLessThan(1);
        expect(boxes[1].y).toBeGreaterThan(boxes[0].y + boxes[0].height);
        expect(boxes[2].y).toBeGreaterThan(boxes[1].y + boxes[1].height);
        expect(Math.abs(boxes[1].x - boxes[0].x)).toBeLessThan(1);
      } else {
        expect(Math.abs(boxes[1].y - boxes[0].y)).toBeLessThan(1);
        expect(Math.abs(boxes[2].y - boxes[0].y)).toBeLessThan(1);
      }
      await page.screenshot({ path: `/tmp/vfgt-iphone-followup-${width}-${phase}.png`, fullPage: true });
      await confirm(page, 'Keep Playing');
      expect((await stored(page)).phase).toBe(phase);
      await expect(page.locator('.vfgt_match_update')).toHaveCount(0);
    }
  });
}

async function buttonColor(button, kind) {
  await expect(button).toHaveClass(kind === 'success' ? /vfgt_button--success/ : /vfgt_button--(?:miss|danger)/);
  const colors = await button.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, text: getComputedStyle(el).color }));
  expect(colors.background).toBe(kind === 'success' ? 'rgb(20, 108, 67)' : 'rgb(157, 29, 59)');
  if (kind === 'success') expect(colors.text).toBe('rgb(255, 255, 255)');
  function luminance(rgb) {
    const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map(Number).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return .2126 * r + .7152 * g + .0722 * b;
  }
  const a = luminance(colors.background), b = luminance(colors.text);
  expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toBeGreaterThanOrEqual(4.5);
}

for (const width of [320, 393, 768, 1280]) {
  test(`VFGT five-findings PK controls, vocabulary, team dialog and semantic colors at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    for (const theme of ['light', 'dark']) {
      await seed(page, 'penalties', { penaltyFirstTeam: 1, penaltyAttempts: [], overtimePlayed: true });
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      const utilities = page.locator('.vfgt_pk_utility_actions');
      const boxes = await utilities.locator('button').evaluateAll(buttons => buttons.map(el => {
        const rect = el.getBoundingClientRect(); return { width: rect.width, height: rect.height, y: rect.y };
      }));
      const available = await utilities.evaluate(el => el.getBoundingClientRect().width);
      expect(boxes).toHaveLength(2);
      expect(Math.abs(boxes[0].width - available)).toBeLessThan(1);
      expect(Math.abs(boxes[1].width - available)).toBeLessThan(1);
      expect(boxes[0].height).toBe(boxes[1].height);
      expect(boxes[1].y - boxes[0].y - boxes[0].height).toBeGreaterThanOrEqual(15);
      const scored = page.locator('[data-vfgt-action="pk-scored"]');
      const missed = page.locator('[data-vfgt-action="pk-missed"]');
      await expect(scored).toHaveText('🟢 Scored'); await expect(missed).toHaveText('🔴 Missed');
      await buttonColor(scored, 'success'); await buttonColor(missed, 'danger');
      const a = await scored.boundingBox(), b = await missed.boundingBox();
      expect(Math.abs(a.width - b.width)).toBeLessThan(1); expect(a.height).toBe(b.height);
      expect(a.height).toBeGreaterThanOrEqual(52);
      await expect(page.locator('.vfgt_pk_history td[aria-label="Kick 1: not taken"]').first()).toHaveText('—');
      await page.screenshot({ path: `/tmp/vfgt-five-controls-${width}-${theme}.png`, fullPage: true });
      await action(page, 'pk-scored');
      await expect(page.locator('.vfgt_pk_history td[aria-label="Kick 1: scored"]')).toHaveText('🟢');
      await expect(page.locator('.vfgt_match_update')).toContainText('🟢 Penalty Scored — Hume-Fogg!');
      await action(page, 'pk-missed');
      await expect(page.locator('.vfgt_pk_history td[aria-label="Kick 1: missed or saved"]')).toHaveText('🔴');
      await expect(page.locator('.vfgt_match_update')).toContainText('🔴 Penalty Missed — RePublic');
      await expect(page.locator('.vfgt_penalties')).not.toContainText(/[⚽❌✕×●]/u);
    }
    const longNames = { team1: 'Hume-Fogg Academic Magnet High School', team2: 'Green Hill With A Very Long School Name', overtimePlayed: true };
    await seed(page, 'penalty_break', longNames);
    await action(page, 'start-pk');
    const dialog = page.getByRole('alertdialog');
    const choices = dialog.locator('.vfgt_confirm__actions button');
    await expect(choices).toHaveText(['Go Back', longNames.team1, longNames.team2]);
    await expect(choices.nth(0)).not.toHaveClass(/vfgt_button--(?:success|danger)/);
    await buttonColor(choices.nth(1), 'success'); await buttonColor(choices.nth(2), 'success');
    const geometry = await choices.evaluateAll(buttons => buttons.map(el => { const box = el.getBoundingClientRect(); return { width: box.width, height: box.height, y: box.y, overflow: el.scrollWidth > el.clientWidth }; }));
    const area = await dialog.locator('.vfgt_confirm__actions').evaluate(el => el.clientWidth);
    for (const box of geometry) { expect(Math.abs(box.width - area)).toBeLessThan(1); expect(box.overflow).toBe(false); expect(box.height).toBe(geometry[0].height); }
    expect(geometry[1].y).toBeGreaterThan(geometry[0].y + geometry[0].height);
    expect(geometry[2].y).toBeGreaterThan(geometry[1].y + geometry[1].height);
    await page.screenshot({ path: `/tmp/vfgt-five-team-choice-${width}.png`, fullPage: true });
    await confirm(page, longNames.team2);
    expect((await stored(page)).penaltyFirstTeam).toBe(2);
    for (const phase of ['second_half', 'ot_second_half']) {
      await seed(page, phase, { overtimePlayed: phase === 'ot_second_half', otSecondHalfStartedAt: Date.now() });
      await action(page, phase === 'second_half' ? 'end-second' : 'end-ot');
      await buttonColor(page.getByRole('alertdialog').locator('[data-vfgt-confirm="confirm"]'), 'success');
      await buttonColor(page.getByRole('alertdialog').locator('[data-vfgt-confirm="alternative"]'), 'danger');
      await expect(page.getByRole('alertdialog').locator('[data-vfgt-confirm="cancel"]')).not.toHaveClass(/vfgt_button--(?:success|danger)/);
      await confirm(page, 'Keep Playing');
    }
    for (const phase of ['overtime_break', 'ot_halftime']) {
      await seed(page, phase);
      await buttonColor(page.locator('[data-vfgt-action="start-ot"]'), 'success');
      await action(page, 'start-ot');
      await buttonColor(page.getByRole('alertdialog').locator('[data-vfgt-confirm="confirm"]'), 'success');
      await confirm(page, 'Cancel');
    }
    await seed(page, 'penalty_break');
    await buttonColor(page.locator('[data-vfgt-action="start-pk"]'), 'success');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('VFGT sudden-death scroll keeps stable DOM between ticks and restores position on reconciliation/actions', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  const attempts = Array.from({ length: 20 }, (_, i) => ({ team: i % 2 ? 2 : 1, scored: i % 3 !== 0 }));
  await seed(page, 'penalties', { penaltyFirstTeam: 1, penaltyAttempts: attempts, overtimePlayed: true });
  const history = page.locator('.vfgt_pk_history');
  await history.evaluate(el => { el.scrollLeft = 170; window.__pkScrollElement = el; });
  const position = await history.evaluate(el => el.scrollLeft);
  expect(position).toBeGreaterThan(0);
  await page.waitForTimeout(2300);
  expect(await history.evaluate(el => el === window.__pkScrollElement)).toBe(true);
  expect(await history.evaluate(el => el.scrollLeft)).toBe(position);
  await page.evaluate(() => window.VioletFutbolGameTracker.reconcileTimerState({ renderView: true }));
  expect(await history.evaluate(el => el.scrollLeft)).toBe(position);
  await action(page, 'pk-scored');
  expect(await history.evaluate(el => el.scrollLeft)).toBe(position);
  expect((await stored(page)).penaltyAttempts).toHaveLength(21);
  await action(page, 'undo-pk');
  expect(await history.evaluate(el => el.scrollLeft)).toBe(position);
  expect((await stored(page)).penaltyAttempts).toHaveLength(20);
  const tenth = history.locator('th[scope="col"]').filter({ hasText: /^10$/ });
  await tenth.scrollIntoViewIfNeeded();
  const later = await history.evaluate(el => el.scrollLeft);
  expect(later).toBeGreaterThan(0);
  await page.waitForTimeout(1200);
  expect(await history.evaluate(el => el.scrollLeft)).toBe(later);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true);
  await page.reload(); await action(page, 'resume');
  expect((await stored(page)).penaltyAttempts).toHaveLength(20);
  await expect(page.locator('.vfgt_pk_next')).toContainText('Hume-Fogg');
});

for (const width of [320, 393, 768, 1280]) {
  test(`VFGT compact fixed attempt columns keep marker/header alignment at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    const names = { team1: 'Hume-Fogg Academic Magnet High School', team2: 'Green Hill With A Very Long School Name', penaltyFirstTeam: 1 };
    for (const penaltyAttempts of [[], [{ team: 1, scored: true }, { team: 2, scored: false }, { team: 1, scored: false }, { team: 2, scored: true }], Array.from({ length: 28 }, (_, i) => ({ team: i % 2 ? 2 : 1, scored: i % 3 !== 0 }))]) {
      await seed(page, 'penalties', { ...names, penaltyAttempts });
      const geometry = await page.locator('.vfgt_pk_history table').evaluate(table => {
        const headers = [...table.querySelectorAll('thead .vfgt_pk_attempt_cell')];
        const rows = [...table.querySelectorAll('tbody tr')];
        const rect = el => { const box = el.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(el); const text = range.getBoundingClientRect(); return { width: box.width, center: (box.left + box.right) / 2, textCenter: (text.left + text.right) / 2, textWidth: text.width, contentWidth: box.width - parseFloat(getComputedStyle(el).paddingLeft) - parseFloat(getComputedStyle(el).paddingRight), text: el.textContent }; };
        return { expected: parseFloat(getComputedStyle(document.documentElement).fontSize) * 2, tableWidth: table.getBoundingClientRect().width, headers: headers.map(rect), rows: rows.map(row => [...row.querySelectorAll('.vfgt_pk_attempt_cell')].map(rect)), teamWidth: table.querySelector('tbody th').getBoundingClientRect().width, totalWidth: table.querySelector('tbody tr td:last-child').getBoundingClientRect().width };
      });
      expect(geometry.headers.length).toBe(penaltyAttempts.length > 10 ? 14 : 5);
      for (const [index, header] of geometry.headers.entries()) {
        expect(Math.abs(header.width - geometry.expected)).toBeLessThan(.5);
        expect(Math.abs(header.center - header.textCenter)).toBeLessThan(1);
        for (const row of geometry.rows) {
          const cell = row[index];
          expect(Math.abs(cell.width - geometry.expected)).toBeLessThan(.5);
          expect(Math.abs(cell.center - header.center)).toBeLessThan(1);
          expect(Math.abs(cell.textCenter - header.center)).toBeLessThan(1);
          expect(cell.textWidth).toBeLessThanOrEqual(cell.contentWidth);
        }
      }
      expect(geometry.teamWidth).toBeGreaterThan(geometry.expected * 3);
      expect(geometry.totalWidth).toBeGreaterThan(geometry.expected);
      expect(Math.abs(geometry.tableWidth - (geometry.teamWidth + geometry.totalWidth + geometry.headers.length * geometry.expected))).toBeLessThan(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (penaltyAttempts.length > 10) {
        const history = page.locator('.vfgt_pk_history');
        await history.evaluate(el => { el.scrollLeft = el.scrollWidth; });
        const position = await history.evaluate(el => el.scrollLeft);
        if (width < 768) {
          expect(position).toBeGreaterThan(0);
          await page.evaluate(() => window.VioletFutbolGameTracker.reconcileTimerState({ renderView: true }));
          expect(await history.evaluate(el => el.scrollLeft)).toBe(position);
        }
      }
      await page.screenshot({ path: `/tmp/vfgt-compact-${width}-${penaltyAttempts.length}.png`, fullPage: true });
    }
  });
}
