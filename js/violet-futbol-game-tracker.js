(() => {
  const SAVED_GAMES_KEY = 'lando-world:violet-futbol-game-tracker:saved-games:v1';
  const ACTIVE_GAME_KEY = 'lando-world:violet-futbol-game-tracker:active-game:v1';
  const SCHEMA_VERSION = 2;
  const REGULATION_SECONDS = 40 * 60;
  const HALFTIME_SECONDS = 10 * 60;
  const ACTION_GUARD_MS = 350;
  const SEVEN_SEGMENT_NAMES = ['top', 'upper-left', 'upper-right', 'middle', 'lower-left', 'lower-right', 'bottom'];
  const SEVEN_SEGMENT_DIGITS = {
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

  let state = null;
  let savedGames = [];
  let refreshTimer = null;
  let audioCtx = null;
  let audioUnlocked = false;
  let lastDirectActivationAt = 0;
  const guardedActions = new WeakMap();

  function createId() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function nowIso() {
    return new Date(Date.now()).toISOString();
  }

  function pad(value) {
    return String(Math.max(0, value)).padStart(2, '0');
  }

  function clampScore(value) {
    const parsed = parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function parseOptionalDuration(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    if (text.includes(':')) {
      const [minutesText, secondsText = '0'] = text.split(':');
      const minutes = parseInt(minutesText, 10);
      const seconds = parseInt(secondsText, 10);
      if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
      return Math.max(0, minutes * 60 + Math.min(59, Math.max(0, seconds)));
    }
    const minutes = Number.parseFloat(text);
    return Number.isFinite(minutes) ? Math.max(0, Math.round(minutes * 60)) : null;
  }

  function formatClock(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds || 0));
    return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
  }

  function formatDurationInput(seconds) {
    return seconds === null || seconds === undefined ? '' : formatClock(seconds);
  }

  function formatDateLabel(date, time) {
    const parsed = new Date(`${date || ''}T${time || '00:00'}`);
    if (Number.isNaN(parsed.getTime())) return date || 'Unscheduled';
    return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTimeLabel(time) {
    if (!time) return '';
    const parsed = new Date(`2000-01-01T${time}`);
    if (Number.isNaN(parsed.getTime())) return time;
    return parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function formatDateTimeLabel(date, time) {
    const dateLabel = formatDateLabel(date, time);
    const timeLabel = formatTimeLabel(time);
    return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
  }

  function localDateTimeParts(date = new Date(Date.now())) {
    return {
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    };
  }

  function scoreForPhase(game, teamIndex) {
    const first = teamIndex === 1 ? game.firstHalfGoalsTeam1 : game.firstHalfGoalsTeam2;
    const second = teamIndex === 1 ? game.secondHalfGoalsTeam1 : game.secondHalfGoalsTeam2;
    if (game.phase === 'second_half' || game.phase === 'final') return first + second;
    return first;
  }

  function setScoreForPhase(game, teamIndex, cumulativeValue) {
    const value = clampScore(cumulativeValue);
    if (game.phase === 'second_half' || game.phase === 'final') {
      const firstKey = teamIndex === 1 ? 'firstHalfGoalsTeam1' : 'firstHalfGoalsTeam2';
      const secondKey = teamIndex === 1 ? 'secondHalfGoalsTeam1' : 'secondHalfGoalsTeam2';
      game[secondKey] = Math.max(0, value - clampScore(game[firstKey]));
      return game;
    }
    const firstKey = teamIndex === 1 ? 'firstHalfGoalsTeam1' : 'firstHalfGoalsTeam2';
    game[firstKey] = value;
    return game;
  }

  function adjustScore(game, teamIndex, delta) {
    const current = scoreForPhase(game, teamIndex);
    return setScoreForPhase(game, teamIndex, current + delta);
  }

  function finalScores(game) {
    return {
      team1: clampScore(game.firstHalfGoalsTeam1) + clampScore(game.secondHalfGoalsTeam1),
      team2: clampScore(game.firstHalfGoalsTeam2) + clampScore(game.secondHalfGoalsTeam2),
    };
  }

  function elapsedForHalf(game, phase, now = Date.now()) {
    const durationKey = phase === 'first_half' ? 'firstHalfDurationSeconds' : 'secondHalfDurationSeconds';
    const startKey = phase === 'first_half' ? 'firstHalfStartedAt' : 'secondHalfStartedAt';
    if (game.phase !== phase || !game[startKey]) return Math.max(0, Math.floor(game[durationKey] || 0));
    return Math.max(0, Math.floor((now - game[startKey]) / 1000));
  }

  function halftimeRemaining(game, now = Date.now()) {
    if (game.phase !== 'halftime' || !game.halftimeStartedAt) return HALFTIME_SECONDS;
    return Math.max(0, HALFTIME_SECONDS - Math.floor((now - game.halftimeStartedAt) / 1000));
  }

  function maybeMarkRegulation(game, now = Date.now()) {
    if (game.phase !== 'first_half' && game.phase !== 'second_half') return false;
    const phase = game.phase;
    const elapsed = elapsedForHalf(game, phase, now);
    const flag = phase === 'first_half' ? 'firstHalfRegulationWhistlePlayed' : 'secondHalfRegulationWhistlePlayed';
    if (elapsed >= REGULATION_SECONDS && !game[flag]) {
      game[flag] = true;
      return true;
    }
    return false;
  }

  function createGame({ team1, team2, location = '', date, time } = {}) {
    const defaults = localDateTimeParts();
    return {
      id: createId(),
      schemaVersion: SCHEMA_VERSION,
      entryType: 'live',
      phase: 'pregame',
      team1: String(team1 || '').trim(),
      team2: String(team2 || '').trim(),
      location: String(location || '').trim(),
      date: date || defaults.date,
      startTime: time || defaults.time,
      actualStartedAt: null,
      firstHalfStartedAt: null,
      secondHalfStartedAt: null,
      halftimeStartedAt: null,
      firstHalfDurationSeconds: null,
      secondHalfDurationSeconds: null,
      firstHalfGoalsTeam1: 0,
      firstHalfGoalsTeam2: 0,
      secondHalfGoalsTeam1: 0,
      secondHalfGoalsTeam2: 0,
      firstHalfRegulationWhistlePlayed: false,
      secondHalfRegulationWhistlePlayed: false,
      completedAt: null,
      savedAt: null,
    };
  }

  function createManualGame({
    team1,
    team2,
    location = '',
    date,
    time = '',
    firstHalfGoalsTeam1 = 0,
    firstHalfGoalsTeam2 = 0,
    secondHalfGoalsTeam1 = 0,
    secondHalfGoalsTeam2 = 0,
    firstHalfDurationSeconds = null,
    secondHalfDurationSeconds = null,
  } = {}) {
    const game = createGame({ team1, team2, location, date, time });
    return {
      ...game,
      entryType: 'manual',
      phase: 'final',
      startTime: String(time || '').trim(),
      firstHalfGoalsTeam1: clampScore(firstHalfGoalsTeam1),
      firstHalfGoalsTeam2: clampScore(firstHalfGoalsTeam2),
      secondHalfGoalsTeam1: clampScore(secondHalfGoalsTeam1),
      secondHalfGoalsTeam2: clampScore(secondHalfGoalsTeam2),
      firstHalfDurationSeconds,
      secondHalfDurationSeconds,
      completedAt: nowIso(),
    };
  }

  function startFirstHalf(game, now = Date.now()) {
    game.phase = 'first_half';
    game.actualStartedAt = game.actualStartedAt || new Date(now).toISOString();
    game.firstHalfStartedAt = now;
    return game;
  }

  function endFirstHalf(game, now = Date.now()) {
    game.firstHalfDurationSeconds = elapsedForHalf(game, 'first_half', now);
    game.phase = 'halftime';
    game.halftimeStartedAt = now;
    return game;
  }

  function startSecondHalf(game, now = Date.now()) {
    game.phase = 'second_half';
    game.secondHalfStartedAt = now;
    return game;
  }

  function endSecondHalf(game, now = Date.now()) {
    game.secondHalfDurationSeconds = elapsedForHalf(game, 'second_half', now);
    game.phase = 'final';
    game.completedAt = new Date(now).toISOString();
    return game;
  }

  function normalizeGame(game) {
    if (!game || typeof game !== 'object') return null;
    const normalized = { ...createGame(), ...game, schemaVersion: SCHEMA_VERSION };
    normalized.entryType = normalized.entryType === 'manual' ? 'manual' : 'live';
    normalized.team1 = String(normalized.team1 || '').trim();
    normalized.team2 = String(normalized.team2 || '').trim();
    normalized.location = String(normalized.location || '').trim();
    [
      'firstHalfGoalsTeam1',
      'firstHalfGoalsTeam2',
      'secondHalfGoalsTeam1',
      'secondHalfGoalsTeam2',
    ].forEach((key) => {
      normalized[key] = clampScore(normalized[key]);
    });
    ['firstHalfDurationSeconds', 'secondHalfDurationSeconds'].forEach((key) => {
      normalized[key] = normalized[key] === null || normalized[key] === undefined || normalized[key] === ''
        ? null
        : clampScore(normalized[key]);
    });
    return normalized.team1 && normalized.team2 ? normalized : null;
  }

  function serializeCompletedGame(game, savedAt = nowIso()) {
    const normalized = normalizeGame(game);
    if (!normalized || normalized.phase !== 'final') return null;
    const score = finalScores(normalized);
    return {
      ...normalized,
      finalTeam1Score: score.team1,
      finalTeam2Score: score.team2,
      savedAt,
    };
  }

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveActiveGame() {
    if (!state) {
      localStorage.removeItem(ACTIVE_GAME_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(state));
  }

  function clearActiveGame() {
    state = null;
    localStorage.removeItem(ACTIVE_GAME_KEY);
    stopRefreshTimer();
  }

  function readSavedGames() {
    const parsed = readJson(SAVED_GAMES_KEY, []);
    return Array.isArray(parsed)
      ? parsed.map((game) => serializeCompletedGame({ ...game, phase: 'final' }, game.savedAt)).filter(Boolean)
      : [];
  }

  function writeSavedGames() {
    localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(savedGames));
  }

  function gameSortTime(game, index = 0) {
    const parsed = Date.parse(`${game?.date || ''}T${game?.startTime || '00:00'}`);
    if (Number.isFinite(parsed)) return parsed;
    return Date.parse(game?.completedAt || game?.savedAt || '') || index;
  }

  function sortedGames(games) {
    return [...games]
      .map((game, index) => ({ game, index }))
      .sort((a, b) => {
        const delta = gameSortTime(b.game, b.index) - gameSortTime(a.game, a.index);
        return delta || a.index - b.index;
      })
      .map(({ game }) => game);
  }

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function accessibleClockLabel(phase, totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds || 0));
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const minuteLabel = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    const secondLabel = `${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'}`;
    return `${phaseLabel(phase)} timer: ${minuteLabel}, ${secondLabel}`;
  }

  function sevenSegmentActiveSegments(digit) {
    return SEVEN_SEGMENT_DIGITS[Number(digit)] || [];
  }

  function renderSevenSegmentDigit(digit) {
    const active = new Set(sevenSegmentActiveSegments(digit));
    return `<span class="vfgt_seven_segment_digit" data-vfgt-seven-segment-digit="${escapeHtml(digit)}" aria-hidden="true">
      ${SEVEN_SEGMENT_NAMES.map((segment) => `<span class="vfgt_seven_segment vfgt_seven_segment--${segment} ${active.has(segment) ? 'is-on' : 'is-off'}" data-segment="${segment}" data-state="${active.has(segment) ? 'on' : 'off'}"></span>`).join('')}
    </span>`;
  }

  function renderSevenSegmentDisplay(clock, label) {
    const digits = String(clock || '00:00').replace(/\D/g, '').padStart(4, '0').slice(-4);
    return `<span class="vfgt_clock vfgt_seven_segment_display" role="timer" aria-label="${escapeHtml(label || clock)}" data-vfgt-seven-segment-display="${escapeHtml(clock)}">
      <span class="vfgt_sr_only">${escapeHtml(label || clock)}</span>
      <span class="vfgt_seven_segment_visual" aria-hidden="true">
        ${renderSevenSegmentDigit(digits[0])}
        ${renderSevenSegmentDigit(digits[1])}
        <span class="vfgt_seven_segment_colon" data-vfgt-seven-segment-colon><span></span><span></span></span>
        ${renderSevenSegmentDigit(digits[2])}
        ${renderSevenSegmentDigit(digits[3])}
      </span>
    </span>`;
  }

  function getRoot() {
    return document.getElementById('violet-futbol-game-tracker-root');
  }

  function guardAction(event, button) {
    const now = Date.now();
    const key = [
      button?.dataset?.vfgtAction || '',
      button?.dataset?.vfgtScore || '',
      button?.dataset?.delta || '',
      button?.dataset?.id || '',
    ].join(':');
    const last = button ? guardedActions.get(button) : null;
    if (last && last.key === key && now - last.time < ACTION_GUARD_MS) {
      event.preventDefault();
      return false;
    }
    if (button) {
      guardedActions.set(button, { key, time: now });
      window.setTimeout(() => {
        const current = guardedActions.get(button);
        if (current?.key === key && current.time === now) guardedActions.delete(button);
      }, ACTION_GUARD_MS);
    }
    event.preventDefault();
    button?.blur?.();
    return true;
  }

  function getAudioContext() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioCtx) audioCtx = new AudioCtor();
    return audioCtx;
  }

  async function unlockAudio() {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    audioUnlocked = ctx.state === 'running';
    return audioUnlocked;
  }

  function tone(frequency, start, duration, gainValue = 0.2, type = 'square') {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== 'running') return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.015);
    gain.gain.setValueAtTime(gainValue, start + Math.max(0.02, duration - 0.04));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  }

  function playNormalBeep() {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== 'running') return;
    tone(880, ctx.currentTime, 0.14, 0.24, 'triangle');
  }

  function playRegulationWhistle() {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== 'running') return;
    tone(1480, ctx.currentTime, 0.22, 0.26, 'square');
    tone(1720, ctx.currentTime + 0.24, 0.2, 0.22, 'square');
  }

  function playEndHalfWhistle() {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== 'running') return;
    tone(1320, ctx.currentTime, 0.22, 0.24, 'square');
    tone(1320, ctx.currentTime + 0.3, 0.22, 0.24, 'square');
    tone(1640, ctx.currentTime + 0.6, 0.32, 0.28, 'square');
  }

  function startRefreshTimer() {
    stopRefreshTimer();
    refreshTimer = window.setInterval(() => {
      if (!state) return;
      if (maybeMarkRegulation(state)) {
        playRegulationWhistle();
        saveActiveGame();
      }
      render();
    }, 1000);
  }

  function stopRefreshTimer() {
    if (refreshTimer) window.clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function resumeStoredGame() {
    const stored = normalizeGame(readJson(ACTIVE_GAME_KEY, null));
    if (!stored) return false;
    state = stored;
    if (state.phase === 'final') renderSummary();
    else {
      startRefreshTimer();
      render();
    }
    return true;
  }

  function renderHome() {
    stopRefreshTimer();
    savedGames = sortedGames(readSavedGames());
    const unfinished = normalizeGame(readJson(ACTIVE_GAME_KEY, null));
    const history = savedGames.length
      ? `<div class="vfgt_history" role="list">
          ${savedGames.map((game) => {
            const score = finalScores(game);
            return `<button type="button" class="vfgt_history_item" data-vfgt-action="details" data-id="${escapeHtml(game.id)}" role="listitem">
              <span class="vfgt_history_date">${escapeHtml(formatDateTimeLabel(game.date, game.startTime))}</span>
              <span class="vfgt_history_matchup">
                <strong class="vfgt_history_team vfgt_history_team--home">${escapeHtml(game.team1)}</strong>
                <span class="vfgt_history_score" aria-label="Final score ${score.team1} to ${score.team2}">${score.team1} &ndash; ${score.team2}</span>
                <strong class="vfgt_history_team vfgt_history_team--away">${escapeHtml(game.team2)}</strong>
              </span>
              ${game.location ? `<span class="vfgt_history_location">${escapeHtml(game.location)}</span>` : ''}
            </button>`;
          }).join('')}
        </div>`
      : `<div class="vfgt_empty">
          <h2>No saved games yet</h2>
          <p>Start a new match or add a past result.</p>
        </div>`;
    getRoot().innerHTML = `
      <section class="vfgt_app" aria-labelledby="vfgt-title">
        <header class="vfgt_hero">
          <div>
            <p class="vfgt_kicker">VFGT</p>
            <h1 id="vfgt-title">Violet Futbol Game Tracker</h1>
          </div>
          <div class="vfgt_home_actions">
            <button type="button" class="vfgt_button vfgt_button--primary" data-vfgt-action="new">New Game</button>
            <button type="button" class="vfgt_button" data-vfgt-action="past">Add Game</button>
          </div>
        </header>
        ${unfinished ? `<section class="vfgt_resume" aria-label="Unfinished game">
          <div>
            <strong>Resume Game</strong>
            <span>${escapeHtml(unfinished.team1)} vs ${escapeHtml(unfinished.team2)} · ${escapeHtml(phaseLabel(unfinished.phase))}</span>
          </div>
          <div class="vfgt_actions">
            <button type="button" class="vfgt_button vfgt_button--primary" data-vfgt-action="resume">Resume Game</button>
            <button type="button" class="vfgt_button vfgt_button--danger" data-vfgt-action="abandon">Abandon Game</button>
          </div>
        </section>` : ''}
        <section class="vfgt_section" aria-labelledby="vfgt-history-title">
          <h2 id="vfgt-history-title">Saved Games</h2>
          ${history}
        </section>
      </section>`;
  }

  function renderSetup() {
    const defaults = localDateTimeParts();
    getRoot().innerHTML = `
      <section class="vfgt_app" aria-labelledby="vfgt-setup-title">
        <header class="vfgt_page_header">
          <p class="vfgt_kicker">New Game</p>
          <h1 id="vfgt-setup-title">Game Setup</h1>
        </header>
        <form class="vfgt_form" data-vfgt-setup>
          <label>School/Team 1 <input name="team1" required autocomplete="organization"></label>
          <label>School/Team 2 <input name="team2" required autocomplete="organization"></label>
          <label>Location <input name="location" autocomplete="street-address"></label>
          <div class="vfgt_form_grid">
            <label>Date <input name="date" type="date" value="${defaults.date}"></label>
            <label>Start time <input name="time" type="time" value="${defaults.time}"></label>
          </div>
          <div class="vfgt_actions vfgt_actions--sticky">
            <button type="button" class="vfgt_button" data-vfgt-action="home">Cancel</button>
            <button type="submit" class="vfgt_button vfgt_button--primary">Start Game</button>
          </div>
        </form>
      </section>`;
  }

  function manualScoreEditor(name, label, value = 0) {
    const safeName = escapeHtml(name);
    const safeLabel = escapeHtml(label);
    return `<label class="vfgt_score_editor">
      <span>${safeLabel}</span>
      <div class="vfgt_score_controls vfgt_score_controls--compact">
        <button type="button" class="vfgt_score_button" data-vfgt-manual-score="${safeName}" data-delta="-1" aria-label="Decrease ${safeLabel}">-</button>
        <input class="vfgt_score_input" name="${safeName}" inputmode="numeric" pattern="[0-9]*" value="${clampScore(value)}" aria-label="${safeLabel}" data-vfgt-manual-input>
        <button type="button" class="vfgt_score_button" data-vfgt-manual-score="${safeName}" data-delta="1" aria-label="Increase ${safeLabel}">+</button>
      </div>
    </label>`;
  }

  function renderManualForm() {
    const defaults = localDateTimeParts();
    getRoot().innerHTML = `
      <section class="vfgt_app" aria-labelledby="vfgt-manual-title">
        <header class="vfgt_page_header">
          <p class="vfgt_kicker">Saved Game</p>
          <h1 id="vfgt-manual-title">Add Game</h1>
        </header>
        <form class="vfgt_form" data-vfgt-manual-form>
          <div class="vfgt_form_grid">
            <label>Date <input name="date" type="date" value="${defaults.date}" required></label>
            <label>Start time <input name="time" type="time"></label>
          </div>
          <label>Location <input name="location" autocomplete="street-address" placeholder="Optional"></label>
          <div class="vfgt_form_grid">
            <label>School/Team 1 <input name="team1" required autocomplete="organization" data-vfgt-manual-team="1"></label>
            <label>School/Team 2 <input name="team2" required autocomplete="organization" data-vfgt-manual-team="2"></label>
          </div>
          <section class="vfgt_manual_half" aria-labelledby="vfgt-manual-first-half">
            <h2 id="vfgt-manual-first-half">First Half</h2>
            <div class="vfgt_form_grid">
              ${manualScoreEditor('firstHalfGoalsTeam1', 'Team 1 goals')}
              ${manualScoreEditor('firstHalfGoalsTeam2', 'Team 2 goals')}
            </div>
            <label>Duration <input name="firstHalfDuration" inputmode="numeric" placeholder="Optional, e.g. 40 or 42:15"></label>
          </section>
          <section class="vfgt_manual_half" aria-labelledby="vfgt-manual-second-half">
            <h2 id="vfgt-manual-second-half">Second Half</h2>
            <div class="vfgt_form_grid">
              ${manualScoreEditor('secondHalfGoalsTeam1', 'Team 1 goals')}
              ${manualScoreEditor('secondHalfGoalsTeam2', 'Team 2 goals')}
            </div>
            <label>Duration <input name="secondHalfDuration" inputmode="numeric" placeholder="Optional, e.g. 40 or 43:05"></label>
          </section>
          <output class="vfgt_manual_total" data-vfgt-manual-final aria-live="polite">Final: 0 - 0</output>
          <div class="vfgt_actions vfgt_actions--sticky">
            <button type="button" class="vfgt_button" data-vfgt-action="home">Cancel</button>
            <button type="submit" class="vfgt_button vfgt_button--primary">Save Past Game</button>
          </div>
        </form>
      </section>`;
  }

  function phaseLabel(phase) {
    if (phase === 'first_half') return 'First Half';
    if (phase === 'halftime') return 'Halftime';
    if (phase === 'second_half') return 'Second Half';
    if (phase === 'final') return 'Final';
    return 'Pregame';
  }

  function renderScoreboard(game) {
    return `<section class="vfgt_scoreboard" aria-label="Live scoreboard">
      ${[1, 2].map((team) => {
        const name = team === 1 ? game.team1 : game.team2;
        const score = scoreForPhase(game, team);
        return `<div class="vfgt_team_score">
          <span class="vfgt_team_name">${escapeHtml(name)}</span>
          <div class="vfgt_score_controls">
            <button type="button" class="vfgt_score_button" data-vfgt-score="${team}" data-delta="-1" aria-label="Subtract one goal from ${escapeHtml(name)}">-</button>
            <input class="vfgt_score_input" inputmode="numeric" pattern="[0-9]*" value="${score}" aria-label="${escapeHtml(name)} score" data-vfgt-score-input="${team}">
            <button type="button" class="vfgt_score_button" data-vfgt-score="${team}" data-delta="1" aria-label="Add one goal to ${escapeHtml(name)}">+</button>
          </div>
        </div>`;
      }).join('<span class="vfgt_vs">vs</span>')}
    </section>`;
  }

  function renderLive() {
    if (!state) {
      renderHome();
      return;
    }
    const now = Date.now();
    maybeMarkRegulation(state, now);
    saveActiveGame();
    const phase = state.phase;
    const halfPhase = phase === 'first_half' || phase === 'second_half';
    const elapsed = halfPhase ? elapsedForHalf(state, phase, now) : 0;
    const stoppage = Math.max(0, elapsed - REGULATION_SECONDS);
    const remaining = halftimeRemaining(state, now);
    const clock = phase === 'halftime' ? formatClock(remaining) : formatClock(elapsed);
    const action = phase === 'first_half'
      ? '<button type="button" class="vfgt_button vfgt_button--primary vfgt_button--wide" data-vfgt-action="end-first">End First Half</button>'
      : phase === 'halftime'
        ? '<button type="button" class="vfgt_button vfgt_button--primary vfgt_button--wide" data-vfgt-action="start-second">Start Second Half</button>'
        : '<button type="button" class="vfgt_button vfgt_button--primary vfgt_button--wide" data-vfgt-action="end-second">End Second Half</button>';
    getRoot().innerHTML = `
      <section class="vfgt_app vfgt_live" aria-labelledby="vfgt-live-title">
        <header class="vfgt_match_header">
          <p class="vfgt_kicker">${escapeHtml(formatDateLabel(state.date, state.startTime))} · ${escapeHtml(formatTimeLabel(state.startTime))}</p>
          <h1 id="vfgt-live-title" class="vfgt_matchup_title">
            <span class="vfgt_matchup_team">${escapeHtml(state.team1)}</span>
            <span class="vfgt_matchup_vs">VS</span>
            <span class="vfgt_matchup_team">${escapeHtml(state.team2)}</span>
          </h1>
          ${state.location ? `<p>${escapeHtml(state.location)}</p>` : ''}
        </header>
        <section class="vfgt_clock_panel" aria-live="polite">
          <span class="vfgt_phase">${escapeHtml(phaseLabel(phase))}</span>
          ${renderSevenSegmentDisplay(clock, accessibleClockLabel(phase, phase === 'halftime' ? remaining : elapsed))}
          ${halfPhase && stoppage > 0 ? `<span class="vfgt_stoppage">+${formatClock(stoppage)} stoppage</span>` : ''}
          ${phase === 'halftime' && remaining === 0 ? '<span class="vfgt_stoppage">Halftime complete</span>' : ''}
        </section>
        ${renderScoreboard(state)}
        <div class="vfgt_actions">${action}</div>
      </section>`;
    startRefreshTimer();
  }

  function summaryDurationMarkup(label, seconds) {
    return seconds === null || seconds === undefined ? '' : `<p>${label}: ${formatClock(seconds)}</p>`;
  }

  function summaryMarkup(game, includeSave) {
    const score = finalScores(game);
    return `<section class="vfgt_app ${includeSave ? '' : 'vfgt_saved_detail'}" aria-labelledby="vfgt-summary-title">
      <header class="vfgt_page_header">
        <p class="vfgt_kicker">${escapeHtml(formatDateTimeLabel(game.date, game.startTime))}</p>
        <h1 id="vfgt-summary-title">FINAL</h1>
        ${game.location ? `<p>${escapeHtml(game.location)}</p>` : ''}
      </header>
      <section class="vfgt_final_score">
        <strong>${escapeHtml(game.team1)}</strong>
        <span>${score.team1} - ${score.team2}</span>
        <strong>${escapeHtml(game.team2)}</strong>
      </section>
      <div class="vfgt_summary_grid">
        <section>
          <h2>First Half</h2>
          <p>${escapeHtml(game.team1)}: ${game.firstHalfGoalsTeam1}</p>
          <p>${escapeHtml(game.team2)}: ${game.firstHalfGoalsTeam2}</p>
          ${summaryDurationMarkup('Duration', game.firstHalfDurationSeconds)}
        </section>
        <section>
          <h2>Second Half</h2>
          <p>${escapeHtml(game.team1)}: ${game.secondHalfGoalsTeam1}</p>
          <p>${escapeHtml(game.team2)}: ${game.secondHalfGoalsTeam2}</p>
          ${summaryDurationMarkup('Duration', game.secondHalfDurationSeconds)}
        </section>
      </div>
      <div class="vfgt_actions vfgt_actions--sticky">
        ${includeSave ? '<button type="button" class="vfgt_button vfgt_button--danger" data-vfgt-action="discard-final">Abandon Game</button><button type="button" class="vfgt_button vfgt_button--primary" data-vfgt-action="save">Save Game</button>' : '<button type="button" class="vfgt_button" data-vfgt-action="home">Back</button><button type="button" class="vfgt_button vfgt_button--primary" data-vfgt-action="edit-saved">Edit Game</button><button type="button" class="vfgt_button vfgt_button--danger" data-vfgt-action="delete-saved">Delete Game</button>'}
      </div>
    </section>`;
  }

  function renderSummary() {
    stopRefreshTimer();
    getRoot().innerHTML = summaryMarkup(state, true);
  }

  function renderDetails(id) {
    const game = savedGames.find((saved) => saved.id === id);
    if (!game) {
      renderHome();
      return;
    }
    getRoot().innerHTML = summaryMarkup(game, false);
    getRoot().querySelector('[data-vfgt-action="delete-saved"]')?.setAttribute('data-id', id);
    getRoot().querySelector('[data-vfgt-action="edit-saved"]')?.setAttribute('data-id', id);
  }

  function renderEditForm(id) {
    const game = savedGames.find((saved) => saved.id === id);
    if (!game) {
      renderHome();
      return;
    }
    const score = finalScores(game);
    getRoot().innerHTML = `
      <section class="vfgt_app" aria-labelledby="vfgt-edit-title">
        <header class="vfgt_page_header">
          <p class="vfgt_kicker">${escapeHtml(formatDateTimeLabel(game.date, game.startTime))}</p>
          <h1 id="vfgt-edit-title">Edit Game</h1>
        </header>
        <form class="vfgt_form" data-vfgt-edit-form data-id="${escapeHtml(id)}">
          <div class="vfgt_form_grid">
            <label>Date <input name="date" type="date" value="${escapeHtml(game.date || '')}" required></label>
            <label>Start time <input name="time" type="time" value="${escapeHtml(game.startTime || '')}"></label>
          </div>
          <label>Location <input name="location" autocomplete="street-address" value="${escapeHtml(game.location || '')}"></label>
          <div class="vfgt_form_grid">
            <label>School/Team 1 <input name="team1" required autocomplete="organization" value="${escapeHtml(game.team1)}"></label>
            <label>School/Team 2 <input name="team2" required autocomplete="organization" value="${escapeHtml(game.team2)}"></label>
          </div>
          <section class="vfgt_manual_half" aria-labelledby="vfgt-edit-first-half">
            <h2 id="vfgt-edit-first-half">First Half</h2>
            <div class="vfgt_form_grid">
              ${manualScoreEditor('firstHalfGoalsTeam1', 'Team 1 goals', game.firstHalfGoalsTeam1)}
              ${manualScoreEditor('firstHalfGoalsTeam2', 'Team 2 goals', game.firstHalfGoalsTeam2)}
            </div>
            <label>Duration <input name="firstHalfDuration" inputmode="numeric" value="${escapeHtml(formatDurationInput(game.firstHalfDurationSeconds))}" placeholder="Optional, e.g. 40 or 42:15"></label>
          </section>
          <section class="vfgt_manual_half" aria-labelledby="vfgt-edit-second-half">
            <h2 id="vfgt-edit-second-half">Second Half</h2>
            <div class="vfgt_form_grid">
              ${manualScoreEditor('secondHalfGoalsTeam1', 'Team 1 goals', game.secondHalfGoalsTeam1)}
              ${manualScoreEditor('secondHalfGoalsTeam2', 'Team 2 goals', game.secondHalfGoalsTeam2)}
            </div>
            <label>Duration <input name="secondHalfDuration" inputmode="numeric" value="${escapeHtml(formatDurationInput(game.secondHalfDurationSeconds))}" placeholder="Optional, e.g. 40 or 43:05"></label>
          </section>
          <output class="vfgt_manual_total" data-vfgt-manual-final aria-live="polite">Final: ${score.team1} - ${score.team2}</output>
          <div class="vfgt_actions vfgt_actions--sticky">
            <button type="button" class="vfgt_button" data-vfgt-action="cancel-edit" data-id="${escapeHtml(id)}">Cancel</button>
            <button type="submit" class="vfgt_button vfgt_button--primary">Save Changes</button>
          </div>
        </form>
      </section>`;
  }

  function editedGameFromForm(original, form) {
    const data = new FormData(form);
    const edited = {
      ...original,
      schemaVersion: SCHEMA_VERSION,
      phase: 'final',
      entryType: original.entryType === 'manual' ? 'manual' : 'live',
      team1: String(data.get('team1') || '').trim(),
      team2: String(data.get('team2') || '').trim(),
      location: String(data.get('location') || '').trim(),
      date: String(data.get('date') || '').trim(),
      startTime: String(data.get('time') || '').trim(),
      firstHalfGoalsTeam1: clampScore(data.get('firstHalfGoalsTeam1')),
      firstHalfGoalsTeam2: clampScore(data.get('firstHalfGoalsTeam2')),
      secondHalfGoalsTeam1: clampScore(data.get('secondHalfGoalsTeam1')),
      secondHalfGoalsTeam2: clampScore(data.get('secondHalfGoalsTeam2')),
      firstHalfDurationSeconds: parseOptionalDuration(data.get('firstHalfDuration')),
      secondHalfDurationSeconds: parseOptionalDuration(data.get('secondHalfDuration')),
      updatedAt: nowIso(),
    };
    if (!edited.team1 || !edited.team2) return null;
    return serializeCompletedGame(edited, original.savedAt || edited.savedAt || nowIso());
  }

  function updateSavedGame(id, updater) {
    const games = readSavedGames();
    const existing = games.find((game) => game.id === id);
    if (!existing) return null;
    const updated = updater(existing);
    if (!updated || updated.id !== id) return null;
    savedGames = sortedGames([updated, ...games.filter((game) => game.id !== id)]);
    writeSavedGames();
    return updated;
  }

  function deleteConfirmationMessage(game) {
    const score = finalScores(game);
    return `Delete this game?\n\n${game.team1} ${score.team1} - ${score.team2} ${game.team2}\n\nThis action cannot be undone.`;
  }

  function render() {
    if (!getRoot()) return;
    if (!state) {
      renderHome();
    } else if (state.phase === 'final') {
      renderSummary();
    } else {
      renderLive();
    }
  }

  function saveCompletedGame() {
    const saved = serializeCompletedGame(state);
    if (!saved) return;
    savedGames = sortedGames([saved, ...readSavedGames().filter((game) => game.id !== saved.id)]);
    writeSavedGames();
    clearActiveGame();
    renderHome();
  }

  function saveManualGame(game) {
    const saved = serializeCompletedGame(game);
    if (!saved) return;
    savedGames = sortedGames([saved, ...readSavedGames().filter((item) => item.id !== saved.id)]);
    writeSavedGames();
    renderHome();
  }

  function updateManualFinalPreview(form) {
    const data = new FormData(form);
    const team1 = clampScore(data.get('firstHalfGoalsTeam1')) + clampScore(data.get('secondHalfGoalsTeam1'));
    const team2 = clampScore(data.get('firstHalfGoalsTeam2')) + clampScore(data.get('secondHalfGoalsTeam2'));
    const output = form.querySelector('[data-vfgt-manual-final]');
    if (output) output.textContent = `Final: ${team1} - ${team2}`;
  }

  function handleClick(event) {
    const button = event.target.closest('[data-vfgt-action], [data-vfgt-score], [data-vfgt-manual-score]');
    const now = Date.now();
    if (!button) return;
    if (event.type === 'click' && now - lastDirectActivationAt < ACTION_GUARD_MS) {
      event.preventDefault();
      return;
    }
    if (!guardAction(event, button)) return;
    if (event.type === 'pointerup' || event.type === 'touchend') lastDirectActivationAt = now;
    void unlockAudio();
    const action = button.dataset.vfgtAction;
    if (button.dataset.vfgtManualScore) {
      const form = button.closest('[data-vfgt-manual-form], [data-vfgt-edit-form]');
      const input = form?.querySelector(`[name="${button.dataset.vfgtManualScore}"]`);
      if (input) {
        input.value = String(Math.max(0, clampScore(input.value) + Number(button.dataset.delta || 0)));
        updateManualFinalPreview(form);
      }
      return;
    }
    if (button.dataset.vfgtScore && state) {
      adjustScore(state, Number(button.dataset.vfgtScore), Number(button.dataset.delta));
      playNormalBeep();
      saveActiveGame();
      renderLive();
      return;
    }
    if (action === 'home') {
      state = null;
      renderHome();
    }
    if (action === 'new') renderSetup();
    if (action === 'past') renderManualForm();
    if (action === 'resume') resumeStoredGame();
    if (action === 'abandon' && window.confirm('Abandon the unfinished game?')) {
      clearActiveGame();
      renderHome();
    }
    if (action === 'details') renderDetails(button.dataset.id);
    if (action === 'edit-saved') renderEditForm(button.dataset.id);
    if (action === 'cancel-edit') renderDetails(button.dataset.id);
    if (action === 'end-first' && state?.phase === 'first_half') {
      endFirstHalf(state);
      playEndHalfWhistle();
      saveActiveGame();
      renderLive();
    }
    if (action === 'start-second' && state?.phase === 'halftime') {
      startSecondHalf(state);
      playNormalBeep();
      saveActiveGame();
      renderLive();
    }
    if (action === 'end-second' && state?.phase === 'second_half') {
      endSecondHalf(state);
      playEndHalfWhistle();
      saveActiveGame();
      renderSummary();
    }
    if (action === 'save') saveCompletedGame();
    if (action === 'discard-final' && window.confirm('Abandon this unsaved game?')) {
      clearActiveGame();
      renderHome();
    }
    if (action === 'delete-saved') {
      const game = readSavedGames().find((item) => item.id === button.dataset.id);
      if (!game || !window.confirm(deleteConfirmationMessage(game))) return;
      savedGames = readSavedGames().filter((game) => game.id !== button.dataset.id);
      writeSavedGames();
      renderHome();
    }
  }

  function handleInput(event) {
    const manualForm = event.target.closest('[data-vfgt-manual-form], [data-vfgt-edit-form]');
    if (manualForm) {
      const input = event.target.closest('[data-vfgt-manual-input]');
      if (input && input.value !== '') input.value = String(clampScore(input.value));
      updateManualFinalPreview(manualForm);
      return;
    }
    const input = event.target.closest('[data-vfgt-score-input]');
    if (!input || !state) return;
    const raw = input.value;
    if (raw === '') return;
    const score = clampScore(raw);
    input.value = String(score);
    setScoreForPhase(state, Number(input.dataset.vfgtScoreInput), score);
    saveActiveGame();
  }

  function handleSubmit(event) {
    const manualForm = event.target.closest('[data-vfgt-manual-form]');
    if (manualForm) {
      event.preventDefault();
      const data = new FormData(manualForm);
      const game = createManualGame({
        team1: data.get('team1'),
        team2: data.get('team2'),
        location: data.get('location'),
        date: data.get('date'),
        time: data.get('time'),
        firstHalfGoalsTeam1: data.get('firstHalfGoalsTeam1'),
        firstHalfGoalsTeam2: data.get('firstHalfGoalsTeam2'),
        secondHalfGoalsTeam1: data.get('secondHalfGoalsTeam1'),
        secondHalfGoalsTeam2: data.get('secondHalfGoalsTeam2'),
        firstHalfDurationSeconds: parseOptionalDuration(data.get('firstHalfDuration')),
        secondHalfDurationSeconds: parseOptionalDuration(data.get('secondHalfDuration')),
      });
      if (!game.team1 || !game.team2) return;
      saveManualGame(game);
      return;
    }

    const editForm = event.target.closest('[data-vfgt-edit-form]');
    if (editForm) {
      event.preventDefault();
      const id = editForm.dataset.id;
      const updated = updateSavedGame(id, (existing) => editedGameFromForm(existing, editForm));
      if (updated) renderDetails(updated.id);
      return;
    }

    const form = event.target.closest('[data-vfgt-setup]');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const game = createGame({
      team1: data.get('team1'),
      team2: data.get('team2'),
      location: data.get('location'),
      date: data.get('date'),
      time: data.get('time'),
    });
    if (!game.team1 || !game.team2) return;
    state = startFirstHalf(game);
    void unlockAudio();
    saveActiveGame();
    renderLive();
  }

  function init() {
    const root = getRoot();
    if (!root) return;
    savedGames = sortedGames(readSavedGames());
    if (window.PointerEvent) {
      root.addEventListener('pointerup', handleClick);
    } else {
      root.addEventListener('touchend', handleClick, { passive: false });
    }
    root.addEventListener('click', handleClick);
    root.addEventListener('input', handleInput);
    root.addEventListener('submit', handleSubmit);
    window.addEventListener('focus', () => {
      if (window.location.hash === '#/violet-futbol-game-tracker' && state) renderLive();
    });
    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#/violet-futbol-game-tracker' && !state) renderHome();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && window.location.hash === '#/violet-futbol-game-tracker' && state) renderLive();
    });
    if (window.location.hash === '#/violet-futbol-game-tracker') renderHome();
  }

  window.VioletFutbolGameTracker = {
    ACTIVE_GAME_KEY,
    HALFTIME_SECONDS,
    REGULATION_SECONDS,
    SAVED_GAMES_KEY,
    adjustScore,
    clampScore,
    createGame,
    createManualGame,
    elapsedForHalf,
    endFirstHalf,
    endSecondHalf,
    finalScores,
    formatClock,
    formatDurationInput,
    gameSortTime,
    halftimeRemaining,
    maybeMarkRegulation,
    normalizeGame,
    parseOptionalDuration,
    renderSevenSegmentDigit,
    renderSevenSegmentDisplay,
    scoreForPhase,
    serializeCompletedGame,
    setScoreForPhase,
    sevenSegmentActiveSegments,
    sortedGames,
    startFirstHalf,
    startSecondHalf,
    updateSavedGame,
  };

  document.addEventListener('DOMContentLoaded', init);
})();
