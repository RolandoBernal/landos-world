(() => {
  const SAVED_GAMES_KEY = 'lando-world:violet-futbol-game-tracker:saved-games:v1';
  const ACTIVE_GAME_KEY = 'lando-world:violet-futbol-game-tracker:active-game:v1';
  const TEAMS_KEY = 'lando-world:violet-futbol-game-tracker:teams:v1';
  const SEASONS_KEY = 'lando-world:violet-futbol-game-tracker:seasons:v1';
  const SETTINGS_KEY = 'lando-world:violet-futbol-game-tracker:settings:v1';
  const MIGRATION_KEY = 'lando-world:violet-futbol-game-tracker:migration:v1';
  const SCHEMA_VERSION = 3;
  const DEFAULT_HALF_DURATION_MINUTES = 40;
  const REGULATION_SECONDS = 40 * 60;
  const HALFTIME_SECONDS = 10 * 60;
  const ACTION_GUARD_MS = 350;
  const HUME_FOGG_TEAM = 'Hume-Fogg';
  const DEFAULT_SEASON_NAME = '2026 Fall';
  const GAME_TYPE_LABELS = {
    regularSeason: 'Regular Season',
    districtTournament: 'District Tournament (Playoffs)',
    preseason: 'Pre-season',
    friendly: 'Friendly',
    specialTournament: 'Special Tournament',
    other: 'Other',
  };
  const OFFICIAL_GAME_TYPES = ['regularSeason', 'districtTournament'];
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
  let teams = [];
  let seasons = [];
  let vfgtSettings = {};
  let screen = 'home';
  let editingEntityId = '';
  let refreshTimer = null;
  let audioCtx = null;
  let audioUnlocked = false;
  let screenWakeLock = null;
  let screenWakeLockRequest = null;
  let lastDirectActivationAt = 0;
  const guardedActions = new WeakMap();

  function createId() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function nowIso() {
    return new Date(Date.now()).toISOString();
  }

  function normalizeTeam(team) {
    if (!team || typeof team !== 'object') return null;
    const name = String(team.name || '').trim();
    if (!name || !team.id) return null;
    return {
      id: String(team.id),
      name,
      shortName: String(team.shortName || '').trim(),
      archived: team.archived === true,
      createdAt: team.createdAt || nowIso(),
      updatedAt: team.updatedAt || team.createdAt || nowIso(),
    };
  }

  function normalizeSeason(season) {
    if (!season || typeof season !== 'object') return null;
    const name = String(season.name || '').trim();
    if (!name || !season.id || !season.teamId) return null;
    return {
      id: String(season.id),
      teamId: String(season.teamId),
      name,
      halfDurationMinutes: normalizeHalfDurationMinutes(season.halfDurationMinutes),
      archived: season.archived === true,
      createdAt: season.createdAt || nowIso(),
      updatedAt: season.updatedAt || season.createdAt || nowIso(),
    };
  }

  function normalizeHalfDurationMinutes(value, fallback = DEFAULT_HALF_DURATION_MINUTES) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  function readCollection(key, normalizer) {
    const parsed = readJson(key, []);
    return Array.isArray(parsed) ? parsed.map(normalizer).filter(Boolean) : [];
  }

  function writeContext() {
    localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
    localStorage.setItem(SEASONS_KEY, JSON.stringify(seasons));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(vfgtSettings));
  }

  function currentTeam() {
    return teams.find((team) => team.id === vfgtSettings.currentTeamId) || null;
  }

  function currentSeason() {
    return seasons.find((season) => season.id === vfgtSettings.currentSeasonId) || null;
  }

  function ensureCurrentContext() {
    const season = currentSeason();
    const team = season ? teams.find((item) => item.id === season.teamId) : currentTeam();
    if (season && team) {
      vfgtSettings.currentTeamId = team.id;
      return;
    }
    const availableSeason = seasons.find((item) => !item.archived && teams.some((teamItem) => teamItem.id === item.teamId && !teamItem.archived));
    const fallbackTeam = availableSeason ? teams.find((item) => item.id === availableSeason.teamId) : teams.find((item) => !item.archived);
    vfgtSettings.currentSeasonId = availableSeason?.id || '';
    vfgtSettings.currentTeamId = availableSeason?.teamId || fallbackTeam?.id || '';
  }

  function initializeContext() {
    const rawSeasons = readJson(SEASONS_KEY, []);
    const rawSavedGames = readJson(SAVED_GAMES_KEY, []);
    teams = readCollection(TEAMS_KEY, normalizeTeam);
    seasons = readCollection(SEASONS_KEY, normalizeSeason);
    vfgtSettings = readJson(SETTINGS_KEY, {});
    const migrationVersion = Number(readJson(MIGRATION_KEY, 0));
    let changed = false;
    if (!teams.length) {
      const timestamp = nowIso();
      teams = [{ id: createId(), name: HUME_FOGG_TEAM, shortName: 'HF', archived: false, createdAt: timestamp, updatedAt: timestamp }];
      changed = true;
    }
    const initialTeam = teams[0];
    if (!seasons.length) {
      const timestamp = nowIso();
      seasons = [{ id: createId(), teamId: initialTeam.id, name: DEFAULT_SEASON_NAME, halfDurationMinutes: DEFAULT_HALF_DURATION_MINUTES, archived: false, createdAt: timestamp, updatedAt: timestamp }];
      changed = true;
    }
    const previousTeamId = vfgtSettings.currentTeamId || '';
    const previousSeasonId = vfgtSettings.currentSeasonId || '';
    ensureCurrentContext();
    if (previousTeamId !== vfgtSettings.currentTeamId || previousSeasonId !== vfgtSettings.currentSeasonId) changed = true;
    if (!vfgtSettings.currentTeamId || !vfgtSettings.currentSeasonId || migrationVersion < 1) changed = true;
    savedGames = sortedGames(readSavedGames());
    if (migrationVersion < 1) {
      const initialSeason = seasons.find((season) => season.teamId === initialTeam.id) || seasons[0];
      savedGames = savedGames.map((game) => ({
        ...game,
        teamId: game.teamId || initialTeam.id,
        seasonId: game.seasonId || initialSeason.id,
        teamSide: game.teamSide === 1 || game.teamSide === 2
          ? game.teamSide
          : (String(game.team1 || '').trim().toLowerCase() === HUME_FOGG_TEAM.toLowerCase() ? 1 : 2),
      }));
      localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(savedGames));
      const active = normalizeGame(readJson(ACTIVE_GAME_KEY, null));
      if (active) localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ ...active, teamId: active.teamId || initialTeam.id, seasonId: active.seasonId || initialSeason.id }));
      localStorage.setItem(MIGRATION_KEY, '1');
      changed = true;
    }
    if (migrationVersion < 2) {
      savedGames = savedGames.map((game) => {
        const team = teams.find((item) => item.id === game.teamId);
        if (!team) return game;
        const team1 = String(game.team1 || '').trim().toLowerCase();
        const team2 = String(game.team2 || '').trim().toLowerCase();
        const tracked = team.name.trim().toLowerCase();
        if (team1 === tracked && team2 !== tracked) return { ...game, teamSide: 1 };
        if (team2 === tracked && team1 !== tracked) return { ...game, teamSide: 2 };
        return game;
      });
      localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(savedGames));
      localStorage.setItem(MIGRATION_KEY, '2');
      changed = true;
    }
    const seasonsNeedDurationMigration = !Array.isArray(rawSeasons)
      || rawSeasons.some((season) => !Number.isInteger(Number(season?.halfDurationMinutes)) || Number(season.halfDurationMinutes) <= 0);
    const gamesNeedDurationMigration = !Array.isArray(rawSavedGames)
      || rawSavedGames.some((game) => !Number.isInteger(Number(game?.halfDurationMinutes)) || Number(game.halfDurationMinutes) <= 0);
    if (migrationVersion < 3 || seasonsNeedDurationMigration || gamesNeedDurationMigration) {
      seasons = seasons.map((season) => ({ ...season, halfDurationMinutes: normalizeHalfDurationMinutes(season.halfDurationMinutes) }));
      savedGames = savedGames.map((game) => ({ ...game, halfDurationMinutes: normalizeHalfDurationMinutes(game.halfDurationMinutes) }));
      const activeGame = normalizeGame(readJson(ACTIVE_GAME_KEY, null));
      if (activeGame) {
        localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({
          ...activeGame,
          halfDurationMinutes: normalizeHalfDurationMinutes(activeGame.halfDurationMinutes),
        }));
      }
      localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(savedGames));
      localStorage.setItem(MIGRATION_KEY, '3');
      changed = true;
    }
    if (changed) writeContext();
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

  function normalizeGameType(value) {
    const gameType = String(value || '').trim();
    return Object.prototype.hasOwnProperty.call(GAME_TYPE_LABELS, gameType) ? gameType : '';
  }

  function gameTypeLabel(gameType) {
    return GAME_TYPE_LABELS[normalizeGameType(gameType)] || 'Game Type Not Set';
  }

  function gameTypeSelectMarkup(selected = '') {
    const normalized = normalizeGameType(selected);
    return `<select name="gameType" required aria-label="Game Type" class="vfgt_game_type_select${normalized ? '' : ' vfgt_game_type_select--placeholder'}">
      <option value="" disabled ${normalized ? '' : 'selected'}>Select game type</option>
      ${Object.entries(GAME_TYPE_LABELS).map(([value, label]) => `<option value="${value}" ${normalized === value ? 'selected' : ''}>${label}</option>`).join('')}
    </select>`;
  }

  function calculateSeasonRecord(games = [], allowedGameTypes = OFFICIAL_GAME_TYPES, trackedTeamName = HUME_FOGG_TEAM, trackedTeamId = '') {
    return games.reduce((record, game) => {
      if (!game || game.phase !== 'final' || !allowedGameTypes.includes(normalizeGameType(game.gameType))) return record;
      if (trackedTeamId && game.teamId && game.teamId !== trackedTeamId) return record;
      const team1 = String(game.team1 || '').trim().toLowerCase();
      const team2 = String(game.team2 || '').trim().toLowerCase();
      const trackedTeam = String(trackedTeamName || HUME_FOGG_TEAM).trim().toLowerCase();
      const scores = finalScores(game);
      let teamScore;
      let opponentScore;
      if (team1 === trackedTeam && team2 !== trackedTeam) {
        teamScore = scores.team1;
        opponentScore = scores.team2;
      } else if (team2 === trackedTeam && team1 !== trackedTeam) {
        teamScore = scores.team2;
        opponentScore = scores.team1;
      } else if (trackedTeamId && (game.teamSide === 1 || game.teamSide === 2)) {
        teamScore = game.teamSide === 1 ? scores.team1 : scores.team2;
        opponentScore = game.teamSide === 1 ? scores.team2 : scores.team1;
      } else {
        return record;
      }
      if (teamScore > opponentScore) record.wins += 1;
      else if (teamScore < opponentScore) record.losses += 1;
      else record.draws += 1;
      return record;
    }, { wins: 0, losses: 0, draws: 0 });
  }

  function calculateSeasonRecords(games = [], trackedTeamName = HUME_FOGG_TEAM, trackedTeamId = '') {
    return {
      regularSeason: calculateSeasonRecord(games, ['regularSeason'], trackedTeamName, trackedTeamId),
      overallSeason: calculateSeasonRecord(games, OFFICIAL_GAME_TYPES, trackedTeamName, trackedTeamId),
    };
  }

  function regulationSecondsForGame(game) {
    return normalizeHalfDurationMinutes(game?.halfDurationMinutes) * 60;
  }

  function pluralizeResult(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function seasonRecordMarkup(games, team = currentTeam(), season = currentSeason()) {
    const records = calculateSeasonRecords(games, team?.name || HUME_FOGG_TEAM, team?.id || '');
    const recordLine = (label, record) => `<p class="vfgt_season_record">${label}: ${record.wins}&ndash;${record.losses}&ndash;${record.draws}</p>
      <p class="vfgt_season_totals">${pluralizeResult(record.wins, 'Win', 'Wins')} · ${pluralizeResult(record.losses, 'Loss', 'Losses')} · ${pluralizeResult(record.draws, 'Draw', 'Draws')}</p>`;
    return `<div class="vfgt_season_summary" aria-label="${escapeHtml(season?.name || 'Season')} record">
      <h3>${escapeHtml(team?.name || HUME_FOGG_TEAM)}</h3>
      <p class="vfgt_season_context">${escapeHtml(season?.name || 'Season')}</p>
      ${recordLine('Regular Season', records.regularSeason)}
      ${recordLine('Overall Season', records.overallSeason)}
    </div>`;
  }

  function elapsedForHalf(game, phase, now = Date.now()) {
    const durationKey = phase === 'first_half' ? 'firstHalfDurationSeconds' : 'secondHalfDurationSeconds';
    const startKey = phase === 'first_half' ? 'firstHalfStartedAt' : 'secondHalfStartedAt';
    if (game.phase !== phase || !game[startKey]) return Math.max(0, Math.floor(game[durationKey] || 0));
    return Math.max(0, Math.floor((now - game[startKey]) / 1000));
  }

  function isRunningHalf(game) {
    return game?.phase === 'first_half' || game?.phase === 'second_half';
  }

  function activeHalfKeys(phase) {
    return phase === 'first_half'
      ? {
          durationKey: 'firstHalfDurationSeconds',
          regulationFlag: 'firstHalfRegulationWhistlePlayed',
          startedAtKey: 'firstHalfStartedAt',
        }
      : {
          durationKey: 'secondHalfDurationSeconds',
          regulationFlag: 'secondHalfRegulationWhistlePlayed',
          startedAtKey: 'secondHalfStartedAt',
        };
  }

  function deriveTimerState(game, now = Date.now()) {
    if (!game) {
      return {
        elapsedSeconds: 0,
        halfStartedAt: null,
        isRunning: false,
        phase: 'pregame',
        regulationSeconds: regulationSecondsForGame(game),
        stoppageSeconds: 0,
      };
    }
    const phase = game.phase || 'pregame';
    if (phase === 'halftime') {
      const remainingSeconds = halftimeRemaining(game, now);
      return {
        elapsedSeconds: HALFTIME_SECONDS - remainingSeconds,
        halfStartedAt: game.halftimeStartedAt || null,
        isRunning: false,
        phase,
        regulationSeconds: HALFTIME_SECONDS,
        remainingSeconds,
        stoppageSeconds: 0,
      };
    }
    if (!isRunningHalf(game)) {
      return {
        elapsedSeconds: 0,
        halfStartedAt: null,
        isRunning: false,
        phase,
        regulationSeconds: regulationSecondsForGame(game),
        stoppageSeconds: 0,
      };
    }
    const { startedAtKey } = activeHalfKeys(phase);
    const elapsedSeconds = elapsedForHalf(game, phase, now);
    return {
      elapsedSeconds,
      halfStartedAt: game[startedAtKey] || null,
      isRunning: true,
      phase,
      regulationSeconds: regulationSecondsForGame(game),
      remainingSeconds: null,
      stoppageSeconds: Math.max(0, elapsedSeconds - regulationSecondsForGame(game)),
    };
  }

  function halftimeRemaining(game, now = Date.now()) {
    if (game.phase !== 'halftime' || !game.halftimeStartedAt) return HALFTIME_SECONDS;
    return Math.max(0, HALFTIME_SECONDS - Math.floor((now - game.halftimeStartedAt) / 1000));
  }

  function maybeMarkRegulation(game, now = Date.now()) {
    if (!isRunningHalf(game)) return false;
    const phase = game.phase;
    const elapsed = elapsedForHalf(game, phase, now);
    const { regulationFlag: flag } = activeHalfKeys(phase);
    if (elapsed >= regulationSecondsForGame(game) && !game[flag]) {
      game[flag] = true;
      return true;
    }
    return false;
  }

  function createGame({ team1, team2, location = '', date, time, gameType = '', teamId = '', seasonId = '', teamSide = '', halfDurationMinutes = DEFAULT_HALF_DURATION_MINUTES } = {}) {
    const defaults = localDateTimeParts();
    return {
      id: createId(),
      schemaVersion: SCHEMA_VERSION,
      entryType: 'live',
      phase: 'pregame',
      team1: String(team1 || '').trim(),
      team2: String(team2 || '').trim(),
      teamId: String(teamId || '').trim(),
      seasonId: String(seasonId || '').trim(),
      teamSide: teamSide === 1 || teamSide === 2 ? teamSide : '',
      halfDurationMinutes: normalizeHalfDurationMinutes(halfDurationMinutes),
      location: String(location || '').trim(),
      gameType: normalizeGameType(gameType),
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
    gameType = '',
    date,
    time = '',
    firstHalfGoalsTeam1 = 0,
    firstHalfGoalsTeam2 = 0,
    secondHalfGoalsTeam1 = 0,
    secondHalfGoalsTeam2 = 0,
    firstHalfDurationSeconds = null,
    secondHalfDurationSeconds = null,
    teamId = '',
    seasonId = '',
    teamSide = '',
    halfDurationMinutes = DEFAULT_HALF_DURATION_MINUTES,
  } = {}) {
    const game = createGame({ team1, team2, location, date, time, gameType, teamId, seasonId, teamSide, halfDurationMinutes });
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
    normalized.teamId = String(normalized.teamId || '').trim();
    normalized.seasonId = String(normalized.seasonId || '').trim();
    normalized.teamSide = normalized.teamSide === 1 || normalized.teamSide === 2 ? normalized.teamSide : '';
    normalized.halfDurationMinutes = normalizeHalfDurationMinutes(normalized.halfDurationMinutes);
    normalized.location = String(normalized.location || '').trim();
    normalized.gameType = normalizeGameType(normalized.gameType);
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
    ['firstHalfStartedAt', 'secondHalfStartedAt', 'halftimeStartedAt'].forEach((key) => {
      const timestamp = Number(normalized[key]);
      normalized[key] = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
    });
    ['firstHalfRegulationWhistlePlayed', 'secondHalfRegulationWhistlePlayed'].forEach((key) => {
      normalized[key] = normalized[key] === true;
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
      reconcileTimerState({
        allowRegulationWhistle: true,
        renderView: true,
      });
    }, 1000);
  }

  function stopRefreshTimer() {
    if (refreshTimer) window.clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function screenWakeLockSupported() {
    return !!window.navigator?.wakeLock?.request;
  }

  function shouldHoldScreenWakeLock(game = state) {
    return screenWakeLockSupported()
      && isRunningHalf(game)
      && document.visibilityState !== 'hidden';
  }

  async function requestScreenWakeLock(game = state) {
    if (!shouldHoldScreenWakeLock(game) || screenWakeLock || screenWakeLockRequest) return false;
    try {
      screenWakeLockRequest = window.navigator.wakeLock.request('screen');
      screenWakeLock = await screenWakeLockRequest;
      screenWakeLock?.addEventListener?.('release', () => {
        screenWakeLock = null;
      });
      return true;
    } catch (error) {
      window.console?.debug?.('VFGT screen wake lock unavailable.', error);
      return false;
    } finally {
      screenWakeLockRequest = null;
    }
  }

  async function releaseScreenWakeLock() {
    const lock = screenWakeLock;
    screenWakeLock = null;
    screenWakeLockRequest = null;
    if (!lock?.release) return false;
    try {
      await lock.release();
      return true;
    } catch (error) {
      window.console?.debug?.('VFGT screen wake lock release failed.', error);
      return false;
    }
  }

  function syncScreenWakeLock(game = state) {
    if (shouldHoldScreenWakeLock(game)) {
      void requestScreenWakeLock(game);
    } else {
      void releaseScreenWakeLock();
    }
  }

  function reconcileTimerState({ allowRegulationWhistle = false, renderView = false } = {}) {
    if (!state) {
      stopRefreshTimer();
      syncScreenWakeLock(null);
      if (renderView) renderHome();
      return null;
    }
    const now = Date.now();
    const regulationJustMarked = maybeMarkRegulation(state, now);
    saveActiveGame();
    syncScreenWakeLock(state);
    if (regulationJustMarked && allowRegulationWhistle && document.visibilityState !== 'hidden') {
      playRegulationWhistle();
    }
    if (renderView) render();
    return deriveTimerState(state, now);
  }

  function resumeStoredGame() {
    const stored = normalizeGame(readJson(ACTIVE_GAME_KEY, null));
    if (!stored) return false;
    state = stored;
    if (state.phase === 'final') renderSummary();
    else {
      startRefreshTimer();
      reconcileTimerState({ renderView: true });
    }
    return true;
  }

  function gamesForCurrentSeason() {
    const season = currentSeason();
    return season ? savedGames.filter((game) => game.seasonId === season.id) : [];
  }

  function settingsButtonMarkup() {
    return `<button type="button" class="vfgt_icon_button" data-vfgt-action="settings" aria-label="VFGT Settings" title="Settings">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3"></circle><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
      </svg>
    </button>`;
  }

  function contextMarkup() {
    const team = currentTeam();
    const season = currentSeason();
    return `<div class="vfgt_context" aria-label="Current team and season"><strong>${escapeHtml(team?.name || 'No team selected')}</strong><span>${escapeHtml(season?.name || 'No season selected')}</span></div>`;
  }

  function renderSettings() {
    const team = currentTeam();
    const season = currentSeason();
    getRoot().innerHTML = `<section class="vfgt_app" aria-labelledby="vfgt-settings-title">
      <header class="vfgt_page_header vfgt_page_header--with-back">
        <button type="button" class="vfgt_back_button" data-vfgt-action="home" aria-label="Back to tracker">←</button>
        <div><p class="vfgt_kicker">VFGT</p><h1 id="vfgt-settings-title">Settings</h1></div>
      </header>
      <section class="vfgt_settings_group" aria-labelledby="vfgt-team-season-settings-title">
        <h2 id="vfgt-team-season-settings-title">Team &amp; Season</h2>
        <button type="button" class="vfgt_settings_row" data-vfgt-action="teams"><span><small>Current Team</small><strong>${escapeHtml(team?.name || 'None selected')}</strong></span><span aria-hidden="true">›</span></button>
        <button type="button" class="vfgt_settings_row" data-vfgt-action="seasons"><span><small>Current Season</small><strong>${escapeHtml(season?.name || 'None selected')}</strong></span><span aria-hidden="true">›</span></button>
        <button type="button" class="vfgt_settings_row" data-vfgt-action="teams"><span><strong>Manage Teams</strong></span><span aria-hidden="true">›</span></button>
        <button type="button" class="vfgt_settings_row" data-vfgt-action="seasons"><span><strong>Manage Seasons</strong></span><span aria-hidden="true">›</span></button>
      </section>
      <section class="vfgt_settings_group" aria-labelledby="vfgt-game-settings-title"><h2 id="vfgt-game-settings-title">Game Settings</h2><button type="button" class="vfgt_settings_row" data-vfgt-action="half-duration"><span><small>Half Duration</small><strong>${season ? `${season.halfDurationMinutes} minutes` : 'No season selected'}</strong><small>Applies to ${escapeHtml(season?.name || 'the current season')}</small></span><span aria-hidden="true">›</span></button></section>
      <section class="vfgt_settings_group" aria-labelledby="vfgt-about-title"><h2 id="vfgt-about-title">About</h2><p>Violet Futbol Game Tracker</p><p class="vfgt_settings_note">Long-term team and season history tracker.</p></section>
    </section>`;
  }

  function renderHalfDurationForm() {
    const season = currentSeason();
    if (!season) {
      renderSettings();
      return;
    }
    getRoot().innerHTML = `<section class="vfgt_app" aria-labelledby="vfgt-duration-title"><header class="vfgt_page_header vfgt_page_header--with-back"><button type="button" class="vfgt_back_button" data-vfgt-action="settings">←</button><div><p class="vfgt_kicker">Game Settings</p><h1 id="vfgt-duration-title">Half Duration</h1></div></header><form class="vfgt_form" data-vfgt-duration-form><p class="vfgt_settings_note">Applies to ${escapeHtml(season.name)}.</p><label>Minutes <input name="halfDurationMinutes" type="number" inputmode="numeric" min="1" step="1" required value="${season.halfDurationMinutes}"></label><div class="vfgt_actions"><button type="button" class="vfgt_button" data-vfgt-action="settings">Cancel</button><button type="submit" class="vfgt_button vfgt_button--primary">Save Duration</button></div></form></section>`;
  }

  function renderTeams() {
    const activeTeams = teams.filter((team) => !team.archived);
    const archivedTeams = teams.filter((team) => team.archived);
    const teamRow = (team) => `<article class="vfgt_manage_row"><div><strong>${escapeHtml(team.name)}</strong>${team.shortName ? `<span>${escapeHtml(team.shortName)}</span>` : ''}<small>${team.archived ? 'Archived' : (team.id === vfgtSettings.currentTeamId ? 'Current' : '')}</small></div><div class="vfgt_manage_actions"><button type="button" class="vfgt_button vfgt_button--small" data-vfgt-action="select-team" data-id="${escapeHtml(team.id)}">${team.id === vfgtSettings.currentTeamId ? 'Current' : 'Select'}</button><button type="button" class="vfgt_button vfgt_button--small" data-vfgt-action="edit-team" data-id="${escapeHtml(team.id)}">Edit</button><button type="button" class="vfgt_button vfgt_button--small" data-vfgt-action="${team.archived ? 'restore-team' : 'archive-team'}" data-id="${escapeHtml(team.id)}">${team.archived ? 'Restore' : 'Archive'}</button></div></article>`;
    getRoot().innerHTML = `<section class="vfgt_app" aria-labelledby="vfgt-teams-title"><header class="vfgt_page_header vfgt_page_header--with-back"><button type="button" class="vfgt_back_button" data-vfgt-action="settings">←</button><div><p class="vfgt_kicker">Settings</p><h1 id="vfgt-teams-title">Manage Teams</h1></div></header><div class="vfgt_manage_toolbar"><button type="button" class="vfgt_button vfgt_button--primary" data-vfgt-action="add-team">Add Team</button></div><section class="vfgt_manage_list" aria-label="Active teams">${activeTeams.map(teamRow).join('') || '<p class="vfgt_settings_note">No active teams.</p>'}</section>${archivedTeams.length ? `<section class="vfgt_manage_list vfgt_manage_list--archived" aria-label="Archived teams"><h2>Archived</h2>${archivedTeams.map(teamRow).join('')}</section>` : ''}</section>`;
  }

  function renderSeasons() {
    const seasonRow = (season) => { const team = teams.find((item) => item.id === season.teamId); return `<article class="vfgt_manage_row"><div><strong>${escapeHtml(season.name)}</strong><span>${escapeHtml(team?.name || 'Unknown team')}</span><small>${season.archived ? 'Archived' : (season.id === vfgtSettings.currentSeasonId ? 'Current' : '')}</small></div><div class="vfgt_manage_actions"><button type="button" class="vfgt_button vfgt_button--small" data-vfgt-action="select-season" data-id="${escapeHtml(season.id)}">${season.id === vfgtSettings.currentSeasonId ? 'Current' : 'Select'}</button><button type="button" class="vfgt_button vfgt_button--small" data-vfgt-action="edit-season" data-id="${escapeHtml(season.id)}">Edit</button><button type="button" class="vfgt_button vfgt_button--small" data-vfgt-action="${season.archived ? 'restore-season' : 'archive-season'}" data-id="${escapeHtml(season.id)}">${season.archived ? 'Restore' : 'Archive'}</button></div></article>`; };
    const active = seasons.filter((season) => !season.archived);
    const archived = seasons.filter((season) => season.archived);
    getRoot().innerHTML = `<section class="vfgt_app" aria-labelledby="vfgt-seasons-title"><header class="vfgt_page_header vfgt_page_header--with-back"><button type="button" class="vfgt_back_button" data-vfgt-action="settings">←</button><div><p class="vfgt_kicker">Settings</p><h1 id="vfgt-seasons-title">Manage Seasons</h1></div></header><div class="vfgt_manage_toolbar"><button type="button" class="vfgt_button vfgt_button--primary" data-vfgt-action="add-season">Add Season</button></div><section class="vfgt_manage_list" aria-label="Active seasons">${active.map(seasonRow).join('') || '<p class="vfgt_settings_note">No active seasons.</p>'}</section>${archived.length ? `<section class="vfgt_manage_list vfgt_manage_list--archived" aria-label="Archived seasons"><h2>Archived</h2>${archived.map(seasonRow).join('')}</section>` : ''}</section>`;
  }

  function renderTeamForm(id = '') {
    const team = teams.find((item) => item.id === id) || { name: '', shortName: '' };
    editingEntityId = id;
    getRoot().innerHTML = `<section class="vfgt_app" aria-labelledby="vfgt-team-form-title"><header class="vfgt_page_header vfgt_page_header--with-back"><button type="button" class="vfgt_back_button" data-vfgt-action="teams">←</button><div><p class="vfgt_kicker">Settings</p><h1 id="vfgt-team-form-title">${id ? 'Edit Team' : 'Add Team'}</h1></div></header><form class="vfgt_form" data-vfgt-team-form><label>Team Name <input name="name" required maxlength="80" value="${escapeHtml(team.name)}"></label><label>Short Name / Abbreviation <input name="shortName" maxlength="12" value="${escapeHtml(team.shortName)}"></label><div class="vfgt_actions"><button type="button" class="vfgt_button" data-vfgt-action="teams">Cancel</button><button type="submit" class="vfgt_button vfgt_button--primary">Save Team</button></div></form></section>`;
  }

  function renderSeasonForm(id = '') {
    const season = seasons.find((item) => item.id === id) || { name: '', teamId: currentTeam()?.id || '' };
    editingEntityId = id;
    const options = teams.filter((team) => !team.archived).map((team) => `<option value="${escapeHtml(team.id)}" ${team.id === season.teamId ? 'selected' : ''}>${escapeHtml(team.name)}</option>`).join('');
    getRoot().innerHTML = `<section class="vfgt_app" aria-labelledby="vfgt-season-form-title"><header class="vfgt_page_header vfgt_page_header--with-back"><button type="button" class="vfgt_back_button" data-vfgt-action="seasons">←</button><div><p class="vfgt_kicker">Settings</p><h1 id="vfgt-season-form-title">${id ? 'Edit Season' : 'Add Season'}</h1></div></header><form class="vfgt_form" data-vfgt-season-form><label>Season Name <input name="name" required maxlength="80" placeholder="2027 Fall" value="${escapeHtml(season.name)}"></label><label>Team <select name="teamId" required>${options}</select></label><div class="vfgt_actions"><button type="button" class="vfgt_button" data-vfgt-action="seasons">Cancel</button><button type="submit" class="vfgt_button vfgt_button--primary">Save Season</button></div></form></section>`;
  }

  function renderHome() {
    stopRefreshTimer();
    savedGames = sortedGames(readSavedGames());
    const currentGames = gamesForCurrentSeason();
    const unfinished = normalizeGame(readJson(ACTIVE_GAME_KEY, null));
    const history = currentGames.length
      ? `<div class="vfgt_history" role="list">
          ${currentGames.map((game) => {
            const score = finalScores(game);
            return `<button type="button" class="vfgt_history_item" data-vfgt-action="details" data-id="${escapeHtml(game.id)}" role="listitem">
              <span class="vfgt_history_date">${escapeHtml(formatDateTimeLabel(game.date, game.startTime))}</span>
              <span class="vfgt_history_matchup">
                <strong class="vfgt_history_team vfgt_history_team--home">${escapeHtml(game.team1)}</strong>
                <span class="vfgt_history_score" aria-label="Final score ${score.team1} to ${score.team2}">${score.team1} &ndash; ${score.team2}</span>
                <strong class="vfgt_history_team vfgt_history_team--away">${escapeHtml(game.team2)}</strong>
              </span>
              ${game.location ? `<span class="vfgt_history_location">${escapeHtml(game.location)}</span>` : ''}
              <span class="vfgt_history_game_type">${escapeHtml(gameTypeLabel(game.gameType))}</span>
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
            ${contextMarkup()}
          </div>
          <div class="vfgt_home_actions">
            <button type="button" class="vfgt_button vfgt_button--primary" data-vfgt-action="new">New Game</button>
            <button type="button" class="vfgt_button" data-vfgt-action="past">Add Game</button>
          </div>
          ${settingsButtonMarkup()}
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
        <section class="vfgt_section" aria-label="Saved Games">
          ${seasonRecordMarkup(currentGames)}
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
          <label>School/Team 1 <input name="team1" required autocomplete="organization" value="${escapeHtml(currentTeam()?.name || '')}"></label>
          <label>School/Team 2 <input name="team2" required autocomplete="organization"></label>
          <label>Location <input name="location" autocomplete="street-address"></label>
          <label>Game Type ${gameTypeSelectMarkup()}</label>
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
          <label>Game Type ${gameTypeSelectMarkup()}</label>
          <div class="vfgt_form_grid">
            <label>School/Team 1 <input name="team1" required autocomplete="organization" data-vfgt-manual-team="1" value="${escapeHtml(currentTeam()?.name || '')}"></label>
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
    reconcileTimerState();
    const phase = state.phase;
    const halfPhase = phase === 'first_half' || phase === 'second_half';
    const timerState = deriveTimerState(state, now);
    const elapsed = halfPhase ? timerState.elapsedSeconds : 0;
    const stoppage = timerState.stoppageSeconds;
    const remaining = phase === 'halftime' ? timerState.remainingSeconds : halftimeRemaining(state, now);
    const clock = phase === 'halftime' ? formatClock(remaining) : formatClock(elapsed);
    const action = phase === 'first_half'
      ? '<button type="button" class="vfgt_button vfgt_button--primary vfgt_button--wide" data-vfgt-action="end-first">End First Half</button>'
      : phase === 'halftime'
        ? '<button type="button" class="vfgt_button vfgt_button--primary vfgt_button--wide" data-vfgt-action="start-second">Start Second Half</button>'
        : '<button type="button" class="vfgt_button vfgt_button--primary vfgt_button--wide" data-vfgt-action="end-second">End Second Half</button>';
    getRoot().innerHTML = `
      <section class="vfgt_app vfgt_live ${halfPhase ? 'vfgt_live--running-half' : ''}" aria-labelledby="vfgt-live-title">
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
        <p>Half Duration: ${normalizeHalfDurationMinutes(game.halfDurationMinutes)} minutes</p>
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
    syncScreenWakeLock(null);
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
          <label>Game Type ${gameTypeSelectMarkup(game.gameType)}</label>
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
      gameType: normalizeGameType(data.get('gameType')),
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

  function saveTeamForm(form) {
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    if (!name) return;
    const timestamp = nowIso();
    if (editingEntityId) {
      teams = teams.map((team) => team.id === editingEntityId ? { ...team, name, shortName: String(data.get('shortName') || '').trim(), updatedAt: timestamp } : team);
    } else {
      teams = [...teams, { id: createId(), name, shortName: String(data.get('shortName') || '').trim(), archived: false, createdAt: timestamp, updatedAt: timestamp }];
    }
    writeContext();
    screen = 'teams';
    renderTeams();
  }

  function saveSeasonForm(form) {
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const teamId = String(data.get('teamId') || '').trim();
    if (!name || !teams.some((team) => team.id === teamId && !team.archived)) return;
    const timestamp = nowIso();
    if (editingEntityId) {
      seasons = seasons.map((season) => season.id === editingEntityId ? { ...season, name, teamId, updatedAt: timestamp } : season);
    } else {
      seasons = [...seasons, { id: createId(), teamId, name, archived: false, createdAt: timestamp, updatedAt: timestamp }];
    }
    writeContext();
    screen = 'seasons';
    renderSeasons();
  }

  function saveHalfDuration(form) {
    const season = currentSeason();
    const minutes = Number(new FormData(form).get('halfDurationMinutes'));
    if (!season || !Number.isInteger(minutes) || minutes <= 0) return;
    seasons = seasons.map((item) => item.id === season.id ? { ...item, halfDurationMinutes: minutes, updatedAt: nowIso() } : item);
    writeContext();
    screen = 'settings';
    renderSettings();
  }

  function selectTeam(id) {
    const team = teams.find((item) => item.id === id);
    if (!team) return;
    const matchingSeason = seasons.find((season) => season.teamId === id && !season.archived)
      || seasons.find((season) => season.teamId === id);
    vfgtSettings.currentTeamId = id;
    vfgtSettings.currentSeasonId = matchingSeason?.id || '';
    writeContext();
    screen = 'home';
    renderHome();
  }

  function selectSeason(id) {
    const season = seasons.find((item) => item.id === id);
    const team = season && teams.find((item) => item.id === season.teamId);
    if (!season || !team) return;
    vfgtSettings.currentSeasonId = season.id;
    vfgtSettings.currentTeamId = team.id;
    writeContext();
    screen = 'home';
    renderHome();
  }

  function setArchived(type, id, archived) {
    if (type === 'team') {
      const team = teams.find((item) => item.id === id);
      if (!team) return;
      teams = teams.map((item) => item.id === id ? { ...item, archived, updatedAt: nowIso() } : item);
      if (archived && vfgtSettings.currentTeamId === id) ensureCurrentContext();
    } else {
      const season = seasons.find((item) => item.id === id);
      if (!season) return;
      seasons = seasons.map((item) => item.id === id ? { ...item, archived, updatedAt: nowIso() } : item);
      if (archived && vfgtSettings.currentSeasonId === id) ensureCurrentContext();
    }
    writeContext();
    if (screen === 'teams') renderTeams();
    else renderSeasons();
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
      screen = 'home';
      renderHome();
    }
    if (action === 'settings') { screen = 'settings'; renderSettings(); }
    if (action === 'teams') { screen = 'teams'; renderTeams(); }
    if (action === 'seasons') { screen = 'seasons'; renderSeasons(); }
    if (action === 'add-team') renderTeamForm();
    if (action === 'edit-team') renderTeamForm(button.dataset.id);
    if (action === 'add-season') renderSeasonForm();
    if (action === 'edit-season') renderSeasonForm(button.dataset.id);
    if (action === 'half-duration') renderHalfDurationForm();
    if (action === 'select-team') selectTeam(button.dataset.id);
    if (action === 'select-season') selectSeason(button.dataset.id);
    if (action === 'archive-team') setArchived('team', button.dataset.id, true);
    if (action === 'restore-team') setArchived('team', button.dataset.id, false);
    if (action === 'archive-season') setArchived('season', button.dataset.id, true);
    if (action === 'restore-season') setArchived('season', button.dataset.id, false);
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
      syncScreenWakeLock(state);
      renderLive();
    }
    if (action === 'start-second' && state?.phase === 'halftime') {
      startSecondHalf(state);
      playNormalBeep();
      saveActiveGame();
      syncScreenWakeLock(state);
      renderLive();
    }
    if (action === 'end-second' && state?.phase === 'second_half') {
      endSecondHalf(state);
      playEndHalfWhistle();
      saveActiveGame();
      syncScreenWakeLock(state);
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

  function handleChange(event) {
    const select = event.target.closest('select[name="gameType"]');
    if (select) select.classList.toggle('vfgt_game_type_select--placeholder', select.value === '');
  }

  function handleSubmit(event) {
    const teamForm = event.target.closest('[data-vfgt-team-form]');
    if (teamForm) {
      event.preventDefault();
      saveTeamForm(teamForm);
      return;
    }
    const seasonForm = event.target.closest('[data-vfgt-season-form]');
    if (seasonForm) {
      event.preventDefault();
      saveSeasonForm(seasonForm);
      return;
    }
    const durationForm = event.target.closest('[data-vfgt-duration-form]');
    if (durationForm) {
      event.preventDefault();
      saveHalfDuration(durationForm);
      return;
    }
    const manualForm = event.target.closest('[data-vfgt-manual-form]');
    if (manualForm) {
      event.preventDefault();
      const data = new FormData(manualForm);
      const game = createManualGame({
        team1: data.get('team1'),
        team2: data.get('team2'),
        location: data.get('location'),
        gameType: data.get('gameType'),
        date: data.get('date'),
        time: data.get('time'),
        firstHalfGoalsTeam1: data.get('firstHalfGoalsTeam1'),
        firstHalfGoalsTeam2: data.get('firstHalfGoalsTeam2'),
        secondHalfGoalsTeam1: data.get('secondHalfGoalsTeam1'),
        secondHalfGoalsTeam2: data.get('secondHalfGoalsTeam2'),
        firstHalfDurationSeconds: parseOptionalDuration(data.get('firstHalfDuration')),
        secondHalfDurationSeconds: parseOptionalDuration(data.get('secondHalfDuration')),
        teamId: vfgtSettings.currentTeamId,
        seasonId: vfgtSettings.currentSeasonId,
        teamSide: String(data.get('team1') || '').trim().toLowerCase() === String(currentTeam()?.name || '').trim().toLowerCase() ? 1 : 2,
        halfDurationMinutes: currentSeason()?.halfDurationMinutes,
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
      gameType: data.get('gameType'),
      date: data.get('date'),
      time: data.get('time'),
      teamId: vfgtSettings.currentTeamId,
      seasonId: vfgtSettings.currentSeasonId,
      teamSide: String(data.get('team1') || '').trim().toLowerCase() === String(currentTeam()?.name || '').trim().toLowerCase() ? 1 : 2,
      halfDurationMinutes: currentSeason()?.halfDurationMinutes,
    });
    if (!game.team1 || !game.team2) return;
    state = startFirstHalf(game);
    void unlockAudio();
    saveActiveGame();
    syncScreenWakeLock(state);
    renderLive();
  }

  function handleLifecycleResume() {
    if (window.location.hash !== '#/violet-futbol-game-tracker' || !state) return;
    reconcileTimerState({ renderView: true });
  }

  function init() {
    const root = getRoot();
    if (!root) return;
    initializeContext();
    savedGames = sortedGames(readSavedGames());
    if (window.PointerEvent) {
      root.addEventListener('pointerup', handleClick);
    } else {
      root.addEventListener('touchend', handleClick, { passive: false });
    }
    root.addEventListener('click', handleClick);
    root.addEventListener('input', handleInput);
    root.addEventListener('change', handleChange);
    root.addEventListener('submit', handleSubmit);
    window.addEventListener('focus', handleLifecycleResume);
    window.addEventListener('pageshow', handleLifecycleResume);
    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#/violet-futbol-game-tracker') {
        if (state) handleLifecycleResume();
        else renderHome();
      } else {
        syncScreenWakeLock(null);
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleLifecycleResume();
      } else {
        syncScreenWakeLock(null);
      }
    });
    if (window.location.hash === '#/violet-futbol-game-tracker') renderHome();
  }

  window.VioletFutbolGameTracker = {
    ACTIVE_GAME_KEY,
    DEFAULT_SEASON_NAME,
    DEFAULT_HALF_DURATION_MINUTES,
    HUME_FOGG_TEAM,
    HALFTIME_SECONDS,
    REGULATION_SECONDS,
    SAVED_GAMES_KEY,
    SCHEMA_VERSION,
    SEASONS_KEY,
    SETTINGS_KEY,
    TEAMS_KEY,
    adjustScore,
    clampScore,
    calculateSeasonRecord,
    calculateSeasonRecords,
    createGame,
    createManualGame,
    deriveTimerState,
    elapsedForHalf,
    endFirstHalf,
    endSecondHalf,
    finalScores,
    formatClock,
    formatDurationInput,
    gameTypeLabel,
    gameTypeSelectMarkup,
    gameSortTime,
    halftimeRemaining,
    isRunningHalf,
    initializeContext,
    maybeMarkRegulation,
    normalizeGame,
    normalizeSeason,
    normalizeTeam,
    parseOptionalDuration,
    normalizeHalfDurationMinutes,
    regulationSecondsForGame,
    reconcileTimerState,
    releaseScreenWakeLock,
    renderSevenSegmentDigit,
    renderSevenSegmentDisplay,
    requestScreenWakeLock,
    scoreForPhase,
    seasonRecordMarkup,
    serializeCompletedGame,
    setScoreForPhase,
    shouldHoldScreenWakeLock,
    syncScreenWakeLock,
    sevenSegmentActiveSegments,
    sortedGames,
    startFirstHalf,
    startSecondHalf,
    updateSavedGame,
  };

  document.addEventListener('DOMContentLoaded', init);
})();
