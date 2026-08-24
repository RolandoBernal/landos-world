import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/violet-futbol-game-tracker.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/violet-futbol-game-tracker.css', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function createRuntime(now = 2_000_000_000_000) {
  let currentTime = now;
  class MockDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [currentTime]));
    }

    static now() {
      return currentTime;
    }
  }
  Object.setPrototypeOf(MockDate, Date);
  const storage = new Map();
  const context = {
    Date: MockDate,
    FormData,
    JSON,
    Math,
    Number,
    Object,
    String,
    clearInterval() {},
    document: {
      addEventListener() {},
      getElementById() {
        return null;
      },
      visibilityState: 'visible',
    },
    localStorage: {
      getItem(key) {
        return storage.get(key) || null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    setInterval() {
      return 1;
    },
    window: null,
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return {
    api: context.VioletFutbolGameTracker,
    storage,
    advance(seconds) {
      currentTime += seconds * 1000;
    },
    now() {
      return currentTime;
    },
  };
}

test('first half starts at zero and continues past 40 minutes with stoppage', () => {
  const { api, advance, now } = createRuntime();
  const game = api.startFirstHalf(api.createGame({ team1: 'Violet', team2: 'Hume-Fogg' }), now());

  assert.equal(api.elapsedForHalf(game, 'first_half', now()), 0);
  advance(api.REGULATION_SECONDS);
  assert.equal(api.elapsedForHalf(game, 'first_half', now()), 2400);
  assert.equal(api.maybeMarkRegulation(game, now()), true);
  assert.equal(game.phase, 'first_half');
  assert.equal(game.firstHalfRegulationWhistlePlayed, true);
  assert.equal(api.maybeMarkRegulation(game, now()), false);

  advance(1);
  assert.equal(api.elapsedForHalf(game, 'first_half', now()), 2401);
  assert.equal(api.formatClock(api.elapsedForHalf(game, 'first_half', now()) - api.REGULATION_SECONDS), '00:01');
});

test('ending first half records duration and starts a 10 minute halftime countdown without starting second half', () => {
  const { api, advance, now } = createRuntime();
  const game = api.startFirstHalf(api.createGame({ team1: 'A', team2: 'B' }), now());
  advance(42 * 60 + 17);

  api.endFirstHalf(game, now());
  assert.equal(game.phase, 'halftime');
  assert.equal(game.firstHalfDurationSeconds, 42 * 60 + 17);
  assert.equal(api.halftimeRemaining(game, now()), api.HALFTIME_SECONDS);

  advance(api.HALFTIME_SECONDS + 30);
  assert.equal(api.halftimeRemaining(game, now()), 0);
  assert.equal(game.phase, 'halftime');
});

test('second half uses the same elapsed regulation behavior and records final duration', () => {
  const { api, advance, now } = createRuntime();
  const game = api.startFirstHalf(api.createGame({ team1: 'A', team2: 'B' }), now());
  advance(40);
  api.endFirstHalf(game, now());
  api.startSecondHalf(game, now());

  assert.equal(api.elapsedForHalf(game, 'second_half', now()), 0);
  advance(api.REGULATION_SECONDS + 83);
  assert.equal(api.maybeMarkRegulation(game, now()), true);
  assert.equal(game.secondHalfRegulationWhistlePlayed, true);
  assert.equal(game.phase, 'second_half');

  api.endSecondHalf(game, now());
  assert.equal(game.phase, 'final');
  assert.equal(game.secondHalfDurationSeconds, api.REGULATION_SECONDS + 83);
});

test('score controls clamp below zero and preserve half-specific totals', () => {
  const { api } = createRuntime();
  const game = api.startFirstHalf(api.createGame({ team1: 'School One', team2: 'School Two' }));

  api.adjustScore(game, 1, 1);
  api.adjustScore(game, 1, 1);
  api.adjustScore(game, 2, -1);
  assert.equal(api.scoreForPhase(game, 1), 2);
  assert.equal(api.scoreForPhase(game, 2), 0);
  assert.equal(game.firstHalfGoalsTeam1, 2);

  api.endFirstHalf(game);
  api.startSecondHalf(game);
  api.adjustScore(game, 1, 1);
  api.adjustScore(game, 2, 1);
  assert.equal(api.scoreForPhase(game, 1), 3);
  assert.equal(api.scoreForPhase(game, 2), 1);
  assert.equal(game.firstHalfGoalsTeam1, 2);
  assert.equal(game.secondHalfGoalsTeam1, 1);
  assert.equal(game.secondHalfGoalsTeam2, 1);
});

test('direct second-half cumulative editing derives second-half contribution', () => {
  const { api } = createRuntime();
  const game = api.startFirstHalf(api.createGame({ team1: 'A', team2: 'B' }));
  api.setScoreForPhase(game, 1, 2);
  api.setScoreForPhase(game, 2, 0);
  api.endFirstHalf(game);
  api.startSecondHalf(game);

  api.setScoreForPhase(game, 1, 5);
  api.setScoreForPhase(game, 2, 1);
  assert.equal(game.firstHalfGoalsTeam1, 2);
  assert.equal(game.secondHalfGoalsTeam1, 3);
  assert.equal(game.secondHalfGoalsTeam2, 1);

  api.setScoreForPhase(game, 1, 1);
  assert.equal(game.secondHalfGoalsTeam1, 0);
  assert.equal(api.scoreForPhase(game, 1), 2);
});

test('completed games serialize with final scores that equal half totals', () => {
  const { api } = createRuntime();
  const game = api.createGame({ team1: 'A', team2: 'B', location: 'Field', date: '2026-08-21', time: '18:30' });
  game.phase = 'final';
  game.firstHalfGoalsTeam1 = 2;
  game.firstHalfGoalsTeam2 = 0;
  game.secondHalfGoalsTeam1 = 1;
  game.secondHalfGoalsTeam2 = 1;

  const saved = api.serializeCompletedGame(game, '2026-08-22T12:00:00.000Z');
  assert.equal(saved.schemaVersion, 2);
  assert.equal(saved.entryType, 'live');
  assert.equal(saved.finalTeam1Score, 3);
  assert.equal(saved.finalTeam2Score, 1);
  assert.equal(api.finalScores(saved).team1, saved.finalTeam1Score);
  assert.equal(saved.savedAt, '2026-08-22T12:00:00.000Z');
});

test('manual past games preserve half scores and optional durations', () => {
  const { api } = createRuntime();
  const game = api.createManualGame({
    team1: 'Violet',
    team2: 'Hume-Fogg',
    location: 'Metro Soccer Complex',
    date: '2026-08-05',
    time: '',
    firstHalfGoalsTeam1: 1,
    firstHalfGoalsTeam2: 0,
    secondHalfGoalsTeam1: 2,
    secondHalfGoalsTeam2: 1,
    firstHalfDurationSeconds: api.parseOptionalDuration('42:15'),
    secondHalfDurationSeconds: api.parseOptionalDuration(''),
  });
  const saved = api.serializeCompletedGame(game, '2026-08-22T12:00:00.000Z');

  assert.equal(saved.entryType, 'manual');
  assert.equal(saved.finalTeam1Score, 3);
  assert.equal(saved.finalTeam2Score, 1);
  assert.equal(saved.firstHalfDurationSeconds, 42 * 60 + 15);
  assert.equal(saved.secondHalfDurationSeconds, null);
});

test('saved history sorts by game date and time instead of save time', () => {
  const { api } = createRuntime();
  const games = [
    { id: 'added-today-old-game', date: '2026-08-05', startTime: '', savedAt: '2026-08-22T12:00:00.000Z' },
    { id: 'newer-game', date: '2026-08-22', startTime: '09:00', savedAt: '2026-08-20T12:00:00.000Z' },
    { id: 'later-same-day', date: '2026-08-05', startTime: '19:00', savedAt: '2026-08-21T12:00:00.000Z' },
  ];

  assert.deepEqual(Array.from(api.sortedGames(games).map((game) => game.id)), [
    'newer-game',
    'later-same-day',
    'added-today-old-game',
  ]);
});

test('saved game updates replace the same record and preserve internal entry type', () => {
  const { api, storage } = createRuntime();
  const saved = api.serializeCompletedGame(api.createManualGame({
    team1: 'Original Team',
    team2: 'Hume-Fogg',
    location: 'Old Field',
    date: '2026-08-22',
    time: '11:00',
    firstHalfGoalsTeam1: 1,
    firstHalfGoalsTeam2: 0,
    secondHalfGoalsTeam1: 0,
    secondHalfGoalsTeam2: 1,
    firstHalfDurationSeconds: null,
    secondHalfDurationSeconds: null,
  }), '2026-08-22T18:00:00.000Z');
  saved.id = 'same-game-id';
  saved.createdAt = '2026-08-22T17:59:00.000Z';
  storage.set(api.SAVED_GAMES_KEY, JSON.stringify([saved]));

  const updated = api.updateSavedGame('same-game-id', (existing) => api.serializeCompletedGame({
    ...existing,
    team1: 'Corrected Team',
    location: '',
    date: '2026-08-23',
    startTime: '10:30',
    firstHalfGoalsTeam1: 2,
    secondHalfGoalsTeam1: 1,
    updatedAt: '2026-08-23T15:00:00.000Z',
  }, existing.savedAt));
  const stored = JSON.parse(storage.get(api.SAVED_GAMES_KEY));

  assert.equal(updated.id, 'same-game-id');
  assert.equal(updated.entryType, 'manual');
  assert.equal(updated.createdAt, '2026-08-22T17:59:00.000Z');
  assert.equal(updated.savedAt, '2026-08-22T18:00:00.000Z');
  assert.equal(updated.finalTeam1Score, 3);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].team1, 'Corrected Team');
});

test('seven-segment digit mapping uses standard active segments', () => {
  const { api } = createRuntime();
  const expected = {
    0: ['top', 'upper-left', 'upper-right', 'lower-left', 'lower-right', 'bottom'],
    1: ['upper-right', 'lower-right'],
    2: ['top', 'upper-right', 'middle', 'lower-left', 'bottom'],
    3: ['top', 'upper-right', 'middle', 'lower-right', 'bottom'],
    4: ['upper-left', 'upper-right', 'middle', 'lower-right'],
    5: ['top', 'upper-left', 'middle', 'lower-right', 'bottom'],
    6: ['top', 'upper-left', 'middle', 'lower-left', 'lower-right', 'bottom'],
    7: ['top', 'upper-right', 'lower-right'],
    8: ['top', 'upper-left', 'upper-right', 'middle', 'lower-left', 'lower-right', 'bottom'],
    9: ['top', 'upper-left', 'upper-right', 'middle', 'lower-right', 'bottom'],
  };

  Object.entries(expected).forEach(([digit, segments]) => {
    assert.deepEqual(Array.from(api.sevenSegmentActiveSegments(digit)), segments);
  });
});

test('seven-segment display keeps a stable four-digit and colon structure', () => {
  const { api } = createRuntime();
  ['00:01', '11:11', '12:34', '41:07', '48:27'].forEach((clock) => {
    const markup = api.renderSevenSegmentDisplay(clock, `Timer ${clock}`);
    assert.equal((markup.match(/data-vfgt-seven-segment-digit=/g) || []).length, 4);
    assert.equal((markup.match(/data-vfgt-seven-segment-colon/g) || []).length, 1);
    assert.equal((markup.match(/class="vfgt_seven_segment /g) || []).length, 28);
  });
});

test('seven-segment display renders inactive segments and an accessible timer label', () => {
  const { api } = createRuntime();
  const one = api.renderSevenSegmentDigit('1');
  const display = api.renderSevenSegmentDisplay('00:01', 'First Half timer: 0 minutes, 1 second');

  assert.equal((one.match(/data-state="off"/g) || []).length, 5);
  assert.equal((one.match(/data-state="on"/g) || []).length, 2);
  assert.match(display, /role="timer"/);
  assert.match(display, /aria-label="First Half timer: 0 minutes, 1 second"/);
  assert.match(display, /class="vfgt_sr_only">First Half timer: 0 minutes, 1 second<\/span>/);
});

test('normalization recovers unfinished persisted game state', () => {
  const { api } = createRuntime();
  const recovered = api.normalizeGame({
    team1: 'Violet',
    team2: 'Hume-Fogg',
    phase: 'first_half',
    firstHalfStartedAt: 1,
    firstHalfRegulationWhistlePlayed: true,
    firstHalfGoalsTeam1: '2',
  });

  assert.equal(recovered.phase, 'first_half');
  assert.equal(recovered.firstHalfRegulationWhistlePlayed, true);
  assert.equal(recovered.entryType, 'live');
  assert.equal(recovered.firstHalfGoalsTeam1, 2);
  assert.equal(recovered.secondHalfGoalsTeam1, 0);
});

test('launcher and VFGT setup use the approved icon and dark form controls', () => {
  assert.match(indexHtml, /iconSrc: 'icons\/violet-futbol-game-tracker\.png'/);
  assert.match(css, /\.vfgt_page_header h1,[\s\S]*\.vfgt_match_header h1 \{[\s\S]*margin: 20px 0 0 0/);
  assert.match(css, /\.vfgt_form \{[\s\S]*min-width: 0/);
  assert.match(css, /\.vfgt_form label \{[\s\S]*min-width: 0/);
  assert.match(css, /\.vfgt_form input[\s\S]*background: var\(--vfgt-input\)/);
  assert.match(css, /\.vfgt_form input \{[\s\S]*width: 100%[\s\S]*max-width: 100%[\s\S]*min-width: 0[\s\S]*display: block/);
  assert.match(css, /\.vfgt_form input\[type="date"\],[\s\S]*\.vfgt_form input\[type="time"\] \{[\s\S]*width: 100%[\s\S]*max-width: 100%[\s\S]*min-width: 0[\s\S]*box-sizing: border-box/);
  assert.match(css, /\.vfgt_form_grid,[\s\S]*\.vfgt_summary_grid \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[\s\S]*min-width: 0/);
  assert.match(css, /\.vfgt_form_grid > \*,[\s\S]*\.vfgt_summary_grid > \* \{[\s\S]*min-width: 0/);
  assert.match(css, /--vfgt-input: rgb\(0 0 0 \/ 26%\)/);
  assert.doesNotMatch(css, /\.vfgt_form input[\s\S]{0,240}background: #f8fbff/);
});

test('saved games and live headers separate team names from score and VS labels', () => {
  assert.match(source, /class="vfgt_history_matchup"/);
  assert.match(source, /class="vfgt_history_score"/);
  assert.match(source, /class="vfgt_history_team vfgt_history_team--home"/);
  assert.match(source, /class="vfgt_history_team vfgt_history_team--away"/);
  assert.match(source, /class="vfgt_matchup_title"/);
  assert.match(source, /class="vfgt_matchup_vs">VS<\/span>/);
  assert.match(css, /\.vfgt_history_matchup[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  assert.match(css, /\.vfgt_history_team--home[\s\S]*text-align: left/);
  assert.match(css, /\.vfgt_history_team--away[\s\S]*text-align: right/);
  assert.match(css, /\.vfgt_history_score[\s\S]*font-variant-numeric: tabular-nums/);
  assert.match(css, /\.vfgt_scoreboard \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  assert.match(css, /\.vfgt_vs \{[\s\S]*align-self: end/);
  assert.match(css, /\.vfgt_vs \{[\s\S]*justify-self: center/);
  assert.match(css, /\.vfgt_vs \{[\s\S]*place-items: center/);
  assert.match(css, /--vfgt-score-control-height: 60px/);
  assert.match(css, /\.vfgt_score_button,\n\.vfgt_score_input \{[\s\S]*min-height: var\(--vfgt-score-control-height\)/);
  assert.match(css, /\.vfgt_vs \{[\s\S]*min-height: var\(--vfgt-score-control-height\)/);
  assert.match(css, /\.vfgt_live \.vfgt_scoreboard \+ \.vfgt_actions[\s\S]*margin-top: 1\.25rem/);
  assert.match(css, /\.vfgt_summary_grid \+ \.vfgt_actions[\s\S]*margin-top: var\(--vfgt-section-gap\)/);
});

test('mobile keeps saved history in a row while stacking live score controls', () => {
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.vfgt_scoreboard \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.vfgt_history_matchup \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.vfgt_vs \{[\s\S]*width: auto/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.vfgt_score_controls \{[\s\S]*grid-template-columns: minmax\(56px, auto\) minmax\(0, 1fr\) minmax\(56px, auto\)/);
  assert.doesNotMatch(css, /@media \(max-width: 680px\)[\s\S]*\.vfgt_matchup_title \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
});

test('live phase actions support one-tap pointer activation and final discard', () => {
  assert.match(source, /root\.addEventListener\('pointerup', handleClick\)/);
  assert.match(source, /root\.addEventListener\('touchend', handleClick, \{ passive: false \}\)/);
  assert.match(source, /lastDirectActivationAt/);
  assert.match(source, /event\.type === 'click' && now - lastDirectActivationAt < ACTION_GUARD_MS/);
  assert.match(source, /data-vfgt-action="discard-final">Abandon Game<\/button>/);
  assert.match(source, /action === 'discard-final'[\s\S]*clearActiveGame\(\)/);
  assert.doesNotMatch(source, /data-vfgt-action="home">History<\/button>\s*\$\{includeSave \?/);
});

test('saved game UI uses edit and delete terminology without entry-type labels', () => {
  assert.match(source, /data-vfgt-action="edit-saved">Edit Game<\/button>/);
  assert.match(source, /data-vfgt-action="delete-saved">Delete Game<\/button>/);
  assert.match(source, /data-vfgt-action="abandon">Abandon Game<\/button>/);
  assert.doesNotMatch(source, />Live game</);
  assert.doesNotMatch(source, />Past game</);
  assert.doesNotMatch(source, /Manually entered/);
  assert.match(source, /entryType: 'manual'/);
  assert.match(source, /entryType: 'live'/);
});

test('seven-segment timer replaces font-rendered clock text and is responsive', () => {
  assert.match(source, /renderSevenSegmentDisplay\(clock, accessibleClockLabel/);
  assert.doesNotMatch(source, /<span class="vfgt_clock">\$\{clock\}<\/span>/);
  assert.match(css, /\.vfgt_seven_segment_visual[\s\S]*grid-template-columns: repeat\(2, var\(--digit-width\)\) calc\(var\(--digit-width\) \* 0\.28\) repeat\(2, var\(--digit-width\)\)/);
  assert.match(css, /\.vfgt_seven_segment\.is-off[\s\S]*opacity: 1/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.vfgt_seven_segment_visual \{/);
  assert.doesNotMatch(css, /\.vfgt_clock \{[\s\S]{0,260}font-family: 'Digital-7'/);
});

test('VFGT light mode uses readable semantic foreground and timer tokens', () => {
  assert.match(css, /:root\[data-theme="light"\] \.app_theme \.vfgt_app \{[\s\S]*--vfgt-team-text: #071b38/);
  assert.match(css, /:root\[data-theme="light"\] \.app_theme \.vfgt_app \{[\s\S]*--vfgt-score-text: #061a35/);
  assert.match(css, /:root\[data-theme="light"\] \.app_theme \.vfgt_app \{[\s\S]*--vfgt-final-score-text: #064596/);
  assert.match(css, /:root\[data-theme="light"\] \.app_theme \.vfgt_app \{[\s\S]*--vfgt-summary-text: #143a67/);
  assert.match(css, /:root\[data-theme="light"\] \.app_theme \.vfgt_app \{[\s\S]*--vfgt-phase-text: #064596/);
  assert.match(css, /:root\[data-theme="light"\] \.app_theme \.vfgt_app \{[\s\S]*--vfgt-segment-on: #064596/);
  assert.match(css, /:root\[data-theme="light"\] \.app_theme \.vfgt_app \{[\s\S]*--vfgt-segment-off: rgb\(166 204 232 \/ 42%\)/);
  assert.match(css, /\.vfgt_team_name \{[\s\S]*color: var\(--vfgt-team-text\)/);
  assert.match(css, /\.vfgt_score_input \{[\s\S]*color: var\(--vfgt-score-text\)[\s\S]*background: var\(--vfgt-score-bg\)/);
  assert.match(css, /\.vfgt_final_score span \{[\s\S]*color: var\(--vfgt-final-score-text\)/);
  assert.match(css, /\.vfgt_summary_grid p \{[\s\S]*color: var\(--vfgt-summary-text\)/);
  assert.match(css, /\.vfgt_phase \{[\s\S]*color: var\(--vfgt-phase-text\)/);
});
