(() => {
  const SAVED_GAMES_KEY = 'lando-world:violet-futbol-game-tracker:saved-games:v1';
  const ACTIVE_GAME_KEY = 'lando-world:violet-futbol-game-tracker:active-game:v1';
  const SCHEMA_VERSION = 1;
  const REGULATION_SECONDS = 40 * 60;
  const HALFTIME_SECONDS = 10 * 60;
  const ACTION_GUARD_MS = 350;

  let state = null;
  let savedGames = [];
  let refreshTimer = null;
  let audioCtx = null;
  let audioUnlocked = false;
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

  function formatClock(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds || 0));
    return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
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
      firstHalfDurationSeconds: 0,
      secondHalfDurationSeconds: 0,
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
    normalized.team1 = String(normalized.team1 || '').trim();
    normalized.team2 = String(normalized.team2 || '').trim();
    normalized.location = String(normalized.location || '').trim();
    [
      'firstHalfGoalsTeam1',
      'firstHalfGoalsTeam2',
      'secondHalfGoalsTeam1',
      'secondHalfGoalsTeam2',
      'firstHalfDurationSeconds',
      'secondHalfDurationSeconds',
    ].forEach((key) => {
      normalized[key] = clampScore(normalized[key]);
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

  function sortedGames(games) {
    return [...games].sort((a, b) => {
      const aTime = Date.parse(a.savedAt || a.completedAt || `${a.date}T${a.startTime}`) || 0;
      const bTime = Date.parse(b.savedAt || b.completedAt || `${b.date}T${b.startTime}`) || 0;
      return bTime - aTime;
    });
  }

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
              <span class="vfgt_history_date">${escapeHtml(formatDateLabel(game.date, game.startTime))} · ${escapeHtml(formatTimeLabel(game.startTime))}</span>
              <span class="vfgt_history_score"><strong>${escapeHtml(game.team1)}</strong> ${score.team1} - ${score.team2} <strong>${escapeHtml(game.team2)}</strong></span>
              <span class="vfgt_history_location">${escapeHtml(game.location || 'Location not set')}</span>
            </button>`;
          }).join('')}
        </div>`
      : `<div class="vfgt_empty">
          <h2>No saved games yet</h2>
          <p>Start a new match when the teams are ready.</p>
        </div>`;
    getRoot().innerHTML = `
      <section class="vfgt_app" aria-labelledby="vfgt-title">
        <header class="vfgt_hero">
          <div>
            <p class="vfgt_kicker">VFGT</p>
            <h1 id="vfgt-title">Violet Futbol Game Tracker</h1>
          </div>
          <button type="button" class="vfgt_button vfgt_button--primary" data-vfgt-action="new">New Game</button>
        </header>
        ${unfinished ? `<section class="vfgt_resume" aria-label="Unfinished game">
          <div>
            <strong>Resume Game</strong>
            <span>${escapeHtml(unfinished.team1)} vs ${escapeHtml(unfinished.team2)} · ${escapeHtml(phaseLabel(unfinished.phase))}</span>
          </div>
          <div class="vfgt_actions">
            <button type="button" class="vfgt_button vfgt_button--primary" data-vfgt-action="resume">Resume Game</button>
            <button type="button" class="vfgt_button vfgt_button--danger" data-vfgt-action="abandon">Abandon</button>
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
          <h1 id="vfgt-live-title">${escapeHtml(state.team1)} vs ${escapeHtml(state.team2)}</h1>
          ${state.location ? `<p>${escapeHtml(state.location)}</p>` : ''}
        </header>
        <section class="vfgt_clock_panel" aria-live="polite">
          <span class="vfgt_phase">${escapeHtml(phaseLabel(phase))}</span>
          <span class="vfgt_clock">${clock}</span>
          ${halfPhase && stoppage > 0 ? `<span class="vfgt_stoppage">+${formatClock(stoppage)} stoppage</span>` : ''}
          ${phase === 'halftime' && remaining === 0 ? '<span class="vfgt_stoppage">Halftime complete</span>' : ''}
        </section>
        ${renderScoreboard(state)}
        <div class="vfgt_actions">${action}</div>
      </section>`;
    startRefreshTimer();
  }

  function summaryMarkup(game, includeSave) {
    const score = finalScores(game);
    return `<section class="vfgt_app" aria-labelledby="vfgt-summary-title">
      <header class="vfgt_page_header">
        <p class="vfgt_kicker">${escapeHtml(formatDateLabel(game.date, game.startTime))} · ${escapeHtml(formatTimeLabel(game.startTime))}</p>
        <h1 id="vfgt-summary-title">FINAL</h1>
        <p>${escapeHtml(game.location || 'Location not set')}</p>
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
          <p>Duration: ${formatClock(game.firstHalfDurationSeconds)}</p>
        </section>
        <section>
          <h2>Second Half</h2>
          <p>${escapeHtml(game.team1)}: ${game.secondHalfGoalsTeam1}</p>
          <p>${escapeHtml(game.team2)}: ${game.secondHalfGoalsTeam2}</p>
          <p>Duration: ${formatClock(game.secondHalfDurationSeconds)}</p>
        </section>
      </div>
      <div class="vfgt_actions vfgt_actions--sticky">
        <button type="button" class="vfgt_button" data-vfgt-action="home">History</button>
        ${includeSave ? '<button type="button" class="vfgt_button vfgt_button--primary" data-vfgt-action="save">Save Game</button>' : '<button type="button" class="vfgt_button vfgt_button--danger" data-vfgt-action="delete-saved">Delete Game</button>'}
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

  function handleClick(event) {
    const button = event.target.closest('[data-vfgt-action], [data-vfgt-score]');
    if (!button || !guardAction(event, button)) return;
    void unlockAudio();
    const action = button.dataset.vfgtAction;
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
    if (action === 'resume') resumeStoredGame();
    if (action === 'abandon' && window.confirm('Abandon the unfinished game?')) {
      clearActiveGame();
      renderHome();
    }
    if (action === 'details') renderDetails(button.dataset.id);
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
    if (action === 'delete-saved' && window.confirm('Delete this saved game?')) {
      savedGames = readSavedGames().filter((game) => game.id !== button.dataset.id);
      writeSavedGames();
      renderHome();
    }
  }

  function handleInput(event) {
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
    elapsedForHalf,
    endFirstHalf,
    endSecondHalf,
    finalScores,
    formatClock,
    halftimeRemaining,
    maybeMarkRegulation,
    normalizeGame,
    scoreForPhase,
    serializeCompletedGame,
    setScoreForPhase,
    sortedGames,
    startFirstHalf,
    startSecondHalf,
  };

  document.addEventListener('DOMContentLoaded', init);
})();
