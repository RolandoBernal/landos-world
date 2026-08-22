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
  assert.match(css, /\.vfgt_form input[\s\S]*background: var\(--vfgt-input\)/);
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
  assert.match(css, /\.vfgt_history_score[\s\S]*font-variant-numeric: tabular-nums/);
  assert.match(css, /\.vfgt_live \.vfgt_scoreboard \+ \.vfgt_actions[\s\S]*margin-top: 1\.25rem/);
});
