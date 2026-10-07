(() => {
  const SAVED_GAMES_KEY = 'lando-world:violet-futbol-game-tracker:saved-games:v1';
  const ACTIVE_GAME_KEY = 'lando-world:violet-futbol-game-tracker:active-game:v1';
  const TEAMS_KEY = 'lando-world:violet-futbol-game-tracker:teams:v1';
  const SEASONS_KEY = 'lando-world:violet-futbol-game-tracker:seasons:v1';
  const SETTINGS_KEY = 'lando-world:violet-futbol-game-tracker:settings:v1';
  const MIGRATION_KEY = 'lando-world:violet-futbol-game-tracker:migration:v1';
  const RECOVERY_BACKUP_KEY_PREFIX = 'lando-world:violet-futbol-game-tracker:recovery-backup:';
  const RECOVERED_ICS_SCHEDULE = [
    { uid: 'd349b04105cc19e0@hume-fogg-soccer-2026', date: '2026-09-17', startTime: '18:00', team2: 'Green Hill', location: 'Green Hill', gameType: 'regularSeason' },
    { uid: '1fef8dcd09362c84@hume-fogg-soccer-2026', date: '2026-09-18', startTime: '17:00', team2: 'RePublic (Senior Night)', location: 'Ezell Road Park', gameType: 'regularSeason' },
    { uid: 'd6f676e263c286ea@hume-fogg-soccer-2026', date: '2026-09-22', startTime: '18:00', team2: 'Portland', location: 'Ezell Road Park', gameType: 'regularSeason' },
    { uid: 'c108188d4a0f2f11@hume-fogg-soccer-2026', date: '2026-09-25', startTime: '18:00', team2: 'MLK', location: 'MLK', gameType: 'regularSeason' },
    { uid: '5918d88a658e4479@hume-fogg-soccer-2026', date: '2026-09-29', startTime: '17:00', team2: 'Donelson Christian', location: 'Donelson Christian', gameType: 'regularSeason' },
    { uid: 'd88b1871dffbdb83@hume-fogg-soccer-2026', date: '2026-10-02', startTime: '18:00', team2: 'USN', location: 'USN', gameType: 'regularSeason' },
    { uid: '411a52cfdcc21ad3@hume-fogg-soccer-2026', date: '2026-10-05', startTime: '', team2: 'District Tournament', location: '', gameType: 'districtTournament', notes: 'Kickoff time and location were TBD in the source calendar.' },
    { uid: '341bd87e8cf6e1f1@hume-fogg-soccer-2026', date: '2026-10-06', startTime: '', team2: 'District Tournament', location: '', gameType: 'districtTournament', notes: 'Kickoff time and location were TBD in the source calendar.' },
    { uid: 'cd60272eae554ace@hume-fogg-soccer-2026', date: '2026-10-08', startTime: '', team2: 'District Tournament', location: '', gameType: 'districtTournament', notes: 'Kickoff time and location were TBD in the source calendar.' },
    { uid: 'cba6b64eaf71b01c@hume-fogg-soccer-2026', date: '2026-10-20', startTime: '', team2: 'Region Semi-Final', location: '', gameType: 'specialTournament', notes: 'Kickoff time and location were TBD in the source calendar.' },
    { uid: '9f5567b5860d08fe@hume-fogg-soccer-2026', date: '2026-10-22', startTime: '', team2: 'Region Final', location: '', gameType: 'specialTournament', notes: 'Kickoff time and location were TBD in the source calendar.' },
    { uid: '5a1db9fb042a2578@hume-fogg-soccer-2026', date: '2026-10-24', startTime: '', team2: 'Sectional', location: '', gameType: 'specialTournament', notes: 'Kickoff time and location were TBD in the source calendar.' },
    { uid: '0df765cfa740a710@hume-fogg-soccer-2026', date: '2026-10-28', startTime: '', team2: 'State Tournament', location: '', gameType: 'specialTournament', notes: 'Kickoff time and location were TBD in the source calendar.' },
    { uid: '0b4f0943e43b219e@hume-fogg-soccer-2026', date: '2026-10-31', startTime: '', team2: 'State Tournament', location: '', gameType: 'specialTournament', notes: 'Kickoff time and location were TBD in the source calendar.' },
  ];
  const SCHEMA_VERSION = 4;
  const DEFAULT_HALF_DURATION_MINUTES = 40;
  const REGULATION_SECONDS = 40 * 60;
  const HALFTIME_SECONDS = 10 * 60;
  const PLAYOFF_RULES = Object.freeze({ overtimeHalfMinutes: 10 });
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

  let latestMatchUpdate = null;
  let copyFeedback = '';
  let copyFeedbackTimer = null;
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
  let recoveryScan = null;
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

  function readStoredJson(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return { present: false, valid: true, value: null };
    try {
      return { present: true, valid: true, value: JSON.parse(raw) };
    } catch {
      return { present: true, valid: false, value: null };
    }
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
    const rawSavedGamesRecord = readStoredJson(SAVED_GAMES_KEY);
    const rawSavedGames = rawSavedGamesRecord.valid && Array.isArray(rawSavedGamesRecord.value) ? rawSavedGamesRecord.value : null;
    let migrationGames = rawSavedGames;
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
      if (Array.isArray(migrationGames)) {
        migrationGames = migrationGames.map((game) => {
          if (!game || typeof game !== 'object') return game;
          return {
            ...game,
            teamId: game.teamId || initialTeam.id,
            seasonId: game.seasonId || initialSeason.id,
            teamSide: game.teamSide === 1 || game.teamSide === 2
              ? game.teamSide
              : (String(game.team1 || '').trim().toLowerCase() === HUME_FOGG_TEAM.toLowerCase() ? 1 : 2),
          };
        });
        localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(migrationGames));
      }
      const active = normalizeGame(readJson(ACTIVE_GAME_KEY, null));
      if (active) localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({ ...active, teamId: active.teamId || initialTeam.id, seasonId: active.seasonId || initialSeason.id }));
      localStorage.setItem(MIGRATION_KEY, '1');
      changed = true;
    }
    if (migrationVersion < 2) {
      if (Array.isArray(migrationGames)) {
        migrationGames = migrationGames.map((game) => {
          if (!game || typeof game !== 'object') return game;
          const team = teams.find((item) => item.id === game.teamId);
          if (!team) return game;
          const team1 = String(game.team1 || '').trim().toLowerCase();
          const team2 = String(game.team2 || '').trim().toLowerCase();
          const tracked = team.name.trim().toLowerCase();
          if (team1 === tracked && team2 !== tracked) return { ...game, teamSide: 1 };
          if (team2 === tracked && team1 !== tracked) return { ...game, teamSide: 2 };
          return game;
        });
        localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(migrationGames));
      }
      localStorage.setItem(MIGRATION_KEY, '2');
      changed = true;
    }
    const seasonsNeedDurationMigration = !Array.isArray(rawSeasons)
      || rawSeasons.some((season) => !Number.isInteger(Number(season?.halfDurationMinutes)) || Number(season.halfDurationMinutes) <= 0);
    const gamesNeedDurationMigration = Array.isArray(migrationGames)
      && migrationGames.some((game) => !Number.isInteger(Number(game?.halfDurationMinutes)) || Number(game.halfDurationMinutes) <= 0);
    if (migrationVersion < 3 || seasonsNeedDurationMigration || gamesNeedDurationMigration) {
      seasons = seasons.map((season) => ({ ...season, halfDurationMinutes: normalizeHalfDurationMinutes(season.halfDurationMinutes) }));
      if (Array.isArray(migrationGames)) {
        migrationGames = migrationGames.map((game) => game && typeof game === 'object'
          ? { ...game, halfDurationMinutes: normalizeHalfDurationMinutes(game.halfDurationMinutes) }
          : game);
        localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(migrationGames));
      }
      const activeGame = normalizeGame(readJson(ACTIVE_GAME_KEY, null));
      if (activeGame) {
        localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({
          ...activeGame,
          halfDurationMinutes: normalizeHalfDurationMinutes(activeGame.halfDurationMinutes),
        }));
      }
      localStorage.setItem(MIGRATION_KEY, '3');
      changed = true;
    }
    if (migrationVersion < 4) {
      if (Array.isArray(migrationGames)) {
        migrationGames = migrationGames.map((game) => {
          if (!game || typeof game !== 'object') return game;
          if (game.status === 'scheduled' || game.phase === 'pregame') return { ...game, status: 'scheduled', phase: 'pregame' };
          if (game.status === 'completed' || game.phase === 'final') return { ...game, status: 'completed', phase: 'final' };
          if (game.status === 'inProgress' || ['first_half', 'halftime', 'second_half'].includes(game.phase)) return game;
          return game;
        });
        localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(migrationGames));
      }
      localStorage.setItem(MIGRATION_KEY, '4');
      changed = true;
    }
    savedGames = sortedGames(readSavedGames());
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
    if (!['pregame', 'first_half', 'halftime'].includes(game.phase)) return first + second + clampScore(game[`otGoalsTeam${teamIndex}`]);
    return first;
  }

  function setScoreForPhase(game, teamIndex, cumulativeValue) {
    const value = clampScore(cumulativeValue);
    if (['overtime_break', 'ot_halftime', 'penalty_break', 'penalties'].includes(game.phase)) return game;
    if (['ot_first_half', 'ot_second_half'].includes(game.phase)) {
      const base = clampScore(game[`firstHalfGoalsTeam${teamIndex}`]) + clampScore(game[`secondHalfGoalsTeam${teamIndex}`]);
      game[`otGoalsTeam${teamIndex}`] = Math.max(0, value - base);
      return game;
    }
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
      team1: clampScore(game.firstHalfGoalsTeam1) + clampScore(game.secondHalfGoalsTeam1) + clampScore(game.otGoalsTeam1),
      team2: clampScore(game.firstHalfGoalsTeam2) + clampScore(game.secondHalfGoalsTeam2) + clampScore(game.otGoalsTeam2),
    };
  }

  function formatScoreLine(game) {
    const score = finalScores(game);
    return `${game.team1} ${score.team1} - ${score.team2} ${game.team2}`;
  }

  function formatSoccerMinute(game, elapsedSeconds) {
    const halfMinutes = isOvertimeHalf(game.phase) ? PLAYOFF_RULES.overtimeHalfMinutes : normalizeHalfDurationMinutes(game.halfDurationMinutes);
    const minute = Math.floor(Math.max(0, elapsedSeconds) / 60) + 1;
    const offset = game.phase === 'second_half' ? halfMinutes : 0;
    return minute > halfMinutes ? `${offset + halfMinutes}+${minute - halfMinutes}` : String(offset + minute);
  }

  function formatMatchUpdate(kind, game, teamIndex, now = Date.now()) {
    const score = formatScoreLine(game);
    if (kind === 'goal') {
      if (!isRunningHalf(game)) return '';
      const name = teamIndex === 1 ? game.team1 : game.team2;
      return `⚽️ Goal ${name}${teamIndex === game.teamSide ? '!' : ''}\n${score}\n${phaseLabel(game.phase)}: Minute ${formatSoccerMinute(game, elapsedForHalf(game, game.phase, now))}`;
    }
    if (kind === 'penalty') {
      const attempt = game.penaltyAttempts?.at(-1);
      if (!attempt) return '';
      const pk = penaltyScores(game);
      const name = attempt.team === 1 ? game.team1 : game.team2;
      return `${attempt.scored ? '🟢 Penalty Scored' : '🔴 Penalty Missed'} — ${name}${attempt.scored && attempt.team === game.teamSide ? '!' : ''}\n${game.team1} ${pk.team1} - ${pk.team2} ${game.team2}\nPenalty Kicks`;
    }
    if (kind === 'final') return `Final Score:\n${score}${finalResultLine(game) ? `\n${finalResultLine(game)}` : ''}`;
    const title = { end_regulation: 'End of Regulation:', overtime: 'Overtime Starting Now...', ot_halftime: 'End of Overtime First Half:', ot_second: 'Overtime Second Half Starting Now...', end_overtime: 'End of Overtime:', penalties: 'Penalty Kicks Starting Now...', halftime: 'End of First Half:', second: 'Second Half Starting Now...', final: 'Final Score:' }[kind];
    return title ? `${title}\n${score}` : '';
  }

  function recordMatchUpdate(kind, game, teamIndex, now) {
    const text = formatMatchUpdate(kind, game, teamIndex, now);
    if (text) latestMatchUpdate = Object.freeze({ gameId: game.id, text });
    copyFeedback = '';
  }

  function copyUpdateMarkup(game) {
    if (latestMatchUpdate?.gameId !== game.id) return '';
    return `<button type="button" class="vfgt_match_update" data-vfgt-copy="${escapeHtml(latestMatchUpdate.text)}" aria-label="Copy match update"><span class="vfgt_match_update_text">${escapeHtml(latestMatchUpdate.text)}</span><span class="vfgt_copy_hint">Tap to copy</span></button>`;
  }

  function copyStatusMarkup() {
    return `<span class="vfgt_copy_status" role="status" aria-live="polite">${escapeHtml(copyFeedback)}</span>`;
  }

  function fallbackCopyText(text) {
    const previousFocus = document.activeElement;
    const selection = window.getSelection?.();
    const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
    const field = document.createElement('textarea');
    field.value = text;
    field.readOnly = true;
    field.setAttribute('aria-hidden', 'true');
    field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px;pointer-events:none;';
    document.body.appendChild(field);
    try {
      field.focus({ preventScroll: true });
      field.select();
      field.setSelectionRange(0, text.length);
      return document.execCommand?.('copy') === true;
    } catch { return false; }
    finally {
      field.remove();
      previousFocus?.focus?.({ preventScroll: true });
      if (selection) { selection.removeAllRanges(); ranges.forEach((range) => selection.addRange(range)); }
    }
  }

  async function copyMatchText(text) {
    let copied = false;
    try {
      if (window.navigator?.clipboard?.writeText) {
        await window.navigator.clipboard.writeText(text);
        copied = true;
      } else copied = fallbackCopyText(text);
    } catch { copied = fallbackCopyText(text); }
    copyFeedback = copied ? 'Copied!' : 'Could not copy. Tap to retry.';
    const status = getRoot()?.querySelector('.vfgt_copy_status');
    if (status) status.textContent = copyFeedback;
    window.clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = window.setTimeout(() => {
      copyFeedback = '';
      const current = getRoot()?.querySelector('.vfgt_copy_status');
      if (current) current.textContent = '';
    }, 2500);
    return copied;
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
    return `<select name="gameType" aria-label="Game Type" class="vfgt_game_type_select${normalized ? '' : ' vfgt_game_type_select--placeholder'}">
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
      if (teamScore === opponentScore && game.completionDecision === 'penalties' && penaltyLeader(game)) {
        const winnerName = String(penaltyLeader(game) === 1 ? game.team1 : game.team2).trim().toLowerCase();
        const trackedWinner = winnerName === trackedTeam || (trackedTeamId && game.teamId === trackedTeamId && penaltyLeader(game) === game.teamSide);
        if (trackedWinner) record.wins += 1;
        else record.losses += 1;
      } else if (teamScore > opponentScore) record.wins += 1;
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
    return (isOvertimeHalf(game?.phase) ? PLAYOFF_RULES.overtimeHalfMinutes : normalizeHalfDurationMinutes(game?.halfDurationMinutes)) * 60;
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

  function isOvertimeHalf(phase) {
    return phase === 'ot_first_half' || phase === 'ot_second_half';
  }

  function isRunningHalf(game) {
    return ['first_half', 'second_half', 'ot_first_half', 'ot_second_half'].includes(game?.phase);
  }

  function activeHalfKeys(phase) {
    const prefix = { first_half: 'firstHalf', second_half: 'secondHalf', ot_first_half: 'otFirstHalf', ot_second_half: 'otSecondHalf' }[phase];
    return { durationKey: `${prefix}DurationSeconds`, startedAtKey: `${prefix}StartedAt`, regulationFlag: `${prefix}RegulationWhistlePlayed` };
  }

  function elapsedForHalf(game, phase, now = Date.now()) {
    const { durationKey, startedAtKey } = activeHalfKeys(phase);
    if (game.phase !== phase || !game[startedAtKey]) return Math.max(0, Math.floor(game[durationKey] || 0));
    return Math.max(0, Math.floor((now - game[startedAtKey]) / 1000));
  }

  function isPlayoff(game) {
    return normalizeGameType(game?.gameType) === 'districtTournament';
  }

  function tiedMatch(game) {
    const score = finalScores(game);
    return score.team1 === score.team2;
  }

  function finishMatch(game, decision, now = Date.now()) {
    if (isRunningHalf(game)) game[activeHalfKeys(game.phase).durationKey] = elapsedForHalf(game, game.phase, now);
    game.completionDecision = decision;
    game.phase = 'final';
    game.status = 'completed';
    game.completedAt = new Date(now).toISOString();
    return game;
  }

  function enterTournamentBreak(game, now = Date.now()) {
    if (!isPlayoff(game) || !tiedMatch(game) || !['second_half', 'ot_second_half'].includes(game.phase)) return game;
    game[activeHalfKeys(game.phase).durationKey] = elapsedForHalf(game, game.phase, now);
    game.phase = game.phase === 'second_half' ? 'overtime_break' : 'penalty_break';
    return game;
  }

  function startOvertimeHalf(game, now = Date.now()) {
    if (!['overtime_break', 'ot_halftime'].includes(game.phase)) return game;
    game.overtimePlayed = true;
    game.phase = game.phase === 'overtime_break' ? 'ot_first_half' : 'ot_second_half';
    game[activeHalfKeys(game.phase).startedAtKey] = now;
    return game;
  }

  function endOvertimeFirstHalf(game, now = Date.now()) {
    if (game.phase !== 'ot_first_half') return game;
    game.otFirstHalfDurationSeconds = elapsedForHalf(game, game.phase, now);
    game.phase = 'ot_halftime';
    return game;
  }

  function initializePenalties(game, firstTeam) {
    if (game.phase !== 'penalty_break' || ![1, 2].includes(firstTeam)) return game;
    game.penaltyFirstTeam = firstTeam;
    game.penaltyAttempts = [];
    game.phase = 'penalties';
    return game;
  }

  function penaltyScores(game) {
    return (game.penaltyAttempts || []).reduce((score, attempt) => {
      if (attempt.scored) score[`team${attempt.team}`] += 1;
      return score;
    }, { team1: 0, team2: 0 });
  }

  function nextPenaltyTeam(game) {
    const last = game.penaltyAttempts?.at(-1);
    return last ? 3 - last.team : game.penaltyFirstTeam;
  }

  function recordPenalty(game, scored) {
    if (game.phase !== 'penalties' || ![1, 2].includes(nextPenaltyTeam(game))) return false;
    game.penaltyAttempts.push({ team: nextPenaltyTeam(game), scored: scored === true });
    return true;
  }

  function undoPenalty(game) {
    if (game.phase !== 'penalties' || !game.penaltyAttempts.length) return false;
    game.penaltyAttempts.pop();
    latestMatchUpdate = null;
    copyFeedback = '';
    return true;
  }

  function penaltyLeader(game) {
    const score = penaltyScores(game);
    return score.team1 === score.team2 ? null : score.team1 > score.team2 ? 1 : 2;
  }

  function clinchedPenaltyTeam(game) {
    const attempts = game.penaltyAttempts || [];
    const counts = [1, 2].map(team => attempts.filter(attempt => attempt.team === team).length);
    const score = penaltyScores(game);
    if (counts.every(count => count <= 5)) {
      if (score.team1 > score.team2 + 5 - counts[1]) return 1;
      if (score.team2 > score.team1 + 5 - counts[0]) return 2;
    } else if (counts[0] === counts[1]) return penaltyLeader(game);
    return null;
  }

  function finalResultLine(game) {
    if (game.completionDecision === 'penalties') {
      const score = penaltyScores(game);
      const winner = penaltyLeader(game);
      return winner ? `${winner === 1 ? game.team1 : game.team2} wins ${Math.max(score.team1, score.team2)} - ${Math.min(score.team1, score.team2)} on penalties` : `Penalty kicks tied ${score.team1} - ${score.team2}; match ended by confirmation`;
    }
    return game.overtimePlayed ? 'After Overtime' : '';
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

  function createGame({ team1, team2, location = '', notes = '', date, time, gameType = '', teamId = '', seasonId = '', teamSide = '', halfDurationMinutes = DEFAULT_HALF_DURATION_MINUTES } = {}) {
    const defaults = localDateTimeParts();
    return {
      id: createId(),
      schemaVersion: SCHEMA_VERSION,
      entryType: 'live',
      status: 'inProgress',
      phase: 'pregame',
      team1: String(team1 || '').trim(),
      team2: String(team2 || '').trim(),
      teamId: String(teamId || '').trim(),
      seasonId: String(seasonId || '').trim(),
      teamSide: teamSide === 1 || teamSide === 2 ? teamSide : '',
      halfDurationMinutes: normalizeHalfDurationMinutes(halfDurationMinutes),
      location: String(location || '').trim(),
      notes: String(notes || '').trim(),
      gameType: normalizeGameType(gameType),
      date: date || defaults.date,
      startTime: time || defaults.time,
      actualStartedAt: null,
      overtimePlayed: false,
      otGoalsTeam1: 0,
      otGoalsTeam2: 0,
      penaltyFirstTeam: null,
      penaltyAttempts: [],
      completionDecision: null,
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
    game.status = 'inProgress';
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
    game.completionDecision = 'regulation';
    game.phase = 'final';
    game.status = 'completed';
    game.completedAt = new Date(now).toISOString();
    return game;
  }

  function normalizeGame(game) {
    if (!game || typeof game !== 'object') return null;
    const normalized = { ...createGame(), ...game, schemaVersion: SCHEMA_VERSION };
    normalized.entryType = normalized.entryType === 'manual' ? 'manual' : 'live';
    normalized.status = ['scheduled', 'inProgress', 'completed'].includes(game.status)
      ? game.status
      : (normalized.phase === 'final' ? 'completed' : 'inProgress');
    normalized.team1 = String(normalized.team1 || '').trim();
    normalized.team2 = String(normalized.team2 || '').trim();
    normalized.teamId = String(normalized.teamId || '').trim();
    normalized.seasonId = String(normalized.seasonId || '').trim();
    normalized.teamSide = normalized.teamSide === 1 || normalized.teamSide === 2 ? normalized.teamSide : '';
    normalized.halfDurationMinutes = normalizeHalfDurationMinutes(normalized.halfDurationMinutes);
    normalized.location = String(normalized.location || '').trim();
    normalized.notes = String(normalized.notes || '').trim();
    normalized.gameType = normalizeGameType(normalized.gameType);
    [
      'firstHalfGoalsTeam1',
      'firstHalfGoalsTeam2',
      'secondHalfGoalsTeam1',
      'secondHalfGoalsTeam2',
      'otGoalsTeam1',
      'otGoalsTeam2',
    ].forEach((key) => {
      normalized[key] = clampScore(normalized[key]);
    });
    ['firstHalfDurationSeconds', 'secondHalfDurationSeconds', 'otFirstHalfDurationSeconds', 'otSecondHalfDurationSeconds'].forEach((key) => {
      normalized[key] = normalized[key] === null || normalized[key] === undefined || normalized[key] === ''
        ? null
        : clampScore(normalized[key]);
    });
    ['firstHalfStartedAt', 'secondHalfStartedAt', 'halftimeStartedAt', 'otFirstHalfStartedAt', 'otSecondHalfStartedAt'].forEach((key) => {
      const timestamp = Number(normalized[key]);
      normalized[key] = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
    });
    ['firstHalfRegulationWhistlePlayed', 'secondHalfRegulationWhistlePlayed', 'otFirstHalfRegulationWhistlePlayed', 'otSecondHalfRegulationWhistlePlayed'].forEach((key) => {
      normalized[key] = normalized[key] === true;
    });
    normalized.penaltyFirstTeam = [1, 2].includes(normalized.penaltyFirstTeam) ? normalized.penaltyFirstTeam : null;
    normalized.penaltyAttempts = Array.isArray(game.penaltyAttempts) ? game.penaltyAttempts.filter(attempt => attempt && [1, 2].includes(attempt.team) && typeof attempt.scored === 'boolean').map(attempt => ({ team: attempt.team, scored: attempt.scored })) : [];
    return normalized.team1 && normalized.team2 ? normalized : null;
  }

  function serializeCompletedGame(game, savedAt = nowIso()) {
    const normalized = normalizeGame(game);
    if (!normalized || normalized.phase !== 'final') return null;
    const score = finalScores(normalized);
    return {
      ...normalized,
      status: 'completed',
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

  function isVfgtStorageKey(key) {
    return /violet-futbol|saved-games|active-game|vfgt/i.test(String(key || ''));
  }

  function futureCandidateReason(game, sourceKey) {
    const status = String(game?.status || game?.gameStatus || '').toLowerCase();
    const phase = String(game?.phase || game?.gamePhase || '').toLowerCase();
    if (status === 'scheduled' || phase === 'pregame' || game?.isFuture === true || game?.scheduled === true || game?.isScheduled === true || ['future', 'scheduled'].includes(String(game?.kind || game?.recordType || '').toLowerCase())) {
      return 'Explicit scheduled/future marker';
    }
    if (['deleted', 'archived', 'abandoned', 'soft-deleted', 'soft_deleted'].includes(status) || game?.deletedAt || game?.archivedAt || game?.isDeleted === true) {
      return 'Archived/deleted/abandoned game retained in source; review before restoring';
    }
    if (isVfgtStorageKey(sourceKey)
      && game?.entryType !== 'manual'
      && status === 'completed'
      && phase === 'final'
      && !game.completedAt
      && !game.finalTeam1Score
      && !game.finalTeam2Score
      && !game.firstHalfDurationSeconds
      && !game.secondHalfDurationSeconds) {
      return 'Possible VFGT migration-v4 scheduled record: live game marked final without completion data';
    }
    if (/future|scheduled/i.test(String(sourceKey || ''))) return 'Future/scheduled storage source';
    return '';
  }

  function isGameCandidate(game, sourceKey) {
    if (!game || typeof game !== 'object') return false;
    const hasTeams = String(game.team1 || game.homeTeam || '').trim() && String(game.team2 || game.awayTeam || game.opponent || '').trim();
    const hasDate = String(game.date || game.gameDate || game.startDate || '').trim();
    return Boolean(hasTeams && hasDate && futureCandidateReason(game, sourceKey));
  }

  function looksLikeSavedGameRecord(game) {
    if (!game || typeof game !== 'object' || Array.isArray(game)) return false;
    const markers = ['id', 'team1', 'team2', 'homeTeam', 'awayTeam', 'opponent', 'date', 'gameDate', 'startDate', 'status', 'phase', 'entryType', 'gameType', 'location', 'notes'];
    return markers.filter((key) => game[key] !== undefined && game[key] !== null && String(game[key]).trim() !== '').length >= 2;
  }

  function recoveredScheduleCandidates() {
    return RECOVERED_ICS_SCHEDULE.map((event) => ({
      source: 'Recovered calendar',
      sourceKey: 'hume-fogg-soccer-2026.ics',
      path: event.uid,
      raw: {
        id: `ics-${event.uid.split('@')[0]}`,
        schemaVersion: SCHEMA_VERSION,
        entryType: 'live',
        status: 'scheduled',
        phase: 'pregame',
        team1: HUME_FOGG_TEAM,
        team2: event.team2,
        teamId: vfgtSettings.currentTeamId || '',
        seasonId: vfgtSettings.currentSeasonId || '',
        teamSide: 1,
        date: event.date,
        startTime: event.startTime,
        location: event.location,
        gameType: event.gameType,
        notes: event.notes || 'Recovered from the Hume-Fogg Soccer 2026 calendar file.',
        sourceCalendarUid: event.uid,
      },
      reason: 'Recovered from the authoritative Hume-Fogg Soccer 2026 calendar after Valor; review before restoring',
    }));
  }

  function collectRecoveryCandidates(value, sourceKey, path, candidates, seen = new Set(), depth = 0) {
    if (!value || typeof value !== 'object' || depth > 5 || seen.has(value)) return;
    seen.add(value);
    if (isGameCandidate(value, sourceKey)) {
      candidates.push({ source: 'localStorage', sourceKey, path, raw: value, reason: futureCandidateReason(value, sourceKey) });
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => collectRecoveryCandidates(item, sourceKey, `${path}[${index}]`, candidates, seen, depth + 1));
      return;
    }
    Object.entries(value).forEach(([key, item]) => {
      if (key !== 'raw' && key !== 'payload' && key !== 'data' && key !== 'games' && key !== 'records' && key !== 'items' && depth > 1) return;
      collectRecoveryCandidates(item, sourceKey, `${path}.${key}`, candidates, seen, depth + 1);
    });
  }

  async function scanIndexedDbRecovery(candidates) {
    if (!window.indexedDB || typeof window.indexedDB.databases !== 'function') return { supported: false, databases: [], stores: 0 };
    let databases = [];
    try {
      databases = (await window.indexedDB.databases()).filter((item) => item?.name);
    } catch {
      return { supported: true, databases: [], stores: 0, error: 'IndexedDB database listing was unavailable.' };
    }
    let stores = 0;
    for (const info of databases) {
      await new Promise((resolve) => {
        let request;
        try {
          request = window.indexedDB.open(info.name, info.version);
        } catch {
          resolve();
          return;
        }
        request.onerror = () => resolve();
        request.onsuccess = () => {
          const db = request.result;
          const storeNames = [...db.objectStoreNames];
          stores += storeNames.length;
          Promise.all(storeNames.map((storeName) => new Promise((storeResolve) => {
            try {
              const transaction = db.transaction(storeName, 'readonly');
              const getAll = transaction.objectStore(storeName).getAll();
              getAll.onsuccess = () => {
                (getAll.result || []).forEach((record, index) => {
                  if (isGameCandidate(record, `${info.name}/${storeName}`)) {
                    candidates.push({ source: 'IndexedDB', sourceKey: `${info.name}/${storeName}`, path: `[${index}]`, raw: record, reason: futureCandidateReason(record, `${info.name}/${storeName}`) });
                  }
                });
                storeResolve();
              };
              getAll.onerror = () => storeResolve();
            } catch {
              // A read-only diagnostic skips stores that cannot be opened.
              storeResolve();
            }
          }))).finally(() => {
            db.close();
            resolve();
          });
        };
      });
    }
    return { supported: true, databases: databases.map((item) => item.name), stores };
  }

  async function scanCacheRecovery(candidates) {
    if (!window.caches?.keys) return { supported: false, caches: [], entries: [] };
    const cacheNames = await window.caches.keys();
    const entries = [];
    for (const cacheName of cacheNames) {
      try {
        const cache = await window.caches.open(cacheName);
        const requests = await cache.keys();
        for (const request of requests) {
          if (!/violet-futbol|saved-games|active-game/i.test(request.url)) continue;
          entries.push({ cacheName, url: request.url });
          try {
            const response = await cache.match(request);
            const text = await response?.clone().text();
            if (!text) continue;
            const parsed = JSON.parse(text);
            collectRecoveryCandidates(parsed, `${cacheName}:${request.url}`, '$', candidates);
          } catch {
            // Matching cached responses are often HTML or JavaScript; inspect JSON only.
          }
        }
      } catch {
        // Cache diagnostics are best-effort and never modify caches.
      }
    }
    return { supported: true, caches: cacheNames, entries };
  }

  async function scanVfgtDataLayer() {
    const candidates = [];
    const localStorageKeys = [];
    let savedGameSource = { present: false, valid: true, recordCount: 0, rawType: 'absent' };
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      localStorageKeys.push(key);
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        if (key === SAVED_GAMES_KEY) {
          savedGameSource = {
            present: true,
            valid: true,
            recordCount: Array.isArray(parsed) ? parsed.length : 0,
            rawType: Array.isArray(parsed) ? 'array' : typeof parsed,
          };
          if (Array.isArray(parsed)) {
            parsed.forEach((record, recordIndex) => {
              if (looksLikeSavedGameRecord(record) && !isGameCandidate(record, key)) {
                candidates.push({
                  source: 'localStorage',
                  sourceKey: key,
                  path: `$[${recordIndex}]`,
                  raw: record,
                  reason: 'Unclassified record in the current saved-game collection; review before restoring',
                });
              }
            });
          }
        }
        collectRecoveryCandidates(parsed, key, '$', candidates);
      } catch {
        if (key === SAVED_GAMES_KEY) savedGameSource = { present: true, valid: false, recordCount: 0, rawType: 'malformed JSON' };
        // Keep malformed source data untouched and report the key as scanned.
      }
    }
    const indexedDb = await scanIndexedDbRecovery(candidates);
    const cache = await scanCacheRecovery(candidates);
    candidates.push(...recoveredScheduleCandidates());
    const unique = [];
    const seen = new Set();
    candidates.forEach((candidate) => {
      const id = String(candidate.raw?.id || '').trim();
      const identity = `${candidate.source}:${candidate.sourceKey}:${id || candidate.path}`;
      if (seen.has(identity)) return;
      seen.add(identity);
      unique.push({ ...candidate, index: unique.length });
    });
    return { localStorageKeys, savedGameSource, indexedDb, cache, candidates: unique, scannedAt: nowIso() };
  }

  function recoveryField(game, keys, fallback = 'Not available') {
    const key = keys.find((item) => game?.[item] !== undefined && game?.[item] !== null && String(game[item]).trim() !== '');
    return key ? String(game[key]) : fallback;
  }

  function downloadRecoveryJson(filename, payload) {
    if (!window.Blob || !window.URL?.createObjectURL) return false;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    return true;
  }

  function restoreRecoveryCandidates(indices) {
    const storedSource = readStoredJson(SAVED_GAMES_KEY);
    if (storedSource.present && (!storedSource.valid || !Array.isArray(storedSource.value))) {
      return { error: 'The current saved-game source is not a readable array. No import was attempted.' };
    }
    const rawCollection = storedSource.present ? storedSource.value : [];
    const selected = indices.map((index) => recoveryScan?.candidates?.[index]).filter(Boolean);
    if (!selected.length) return { error: 'Select at least one candidate before restoring.' };
    const backup = {
      kind: 'VFGT non-destructive recovery backup',
      createdAt: nowIso(),
      sourceKey: SAVED_GAMES_KEY,
      originalCollection: rawCollection,
      selectedCandidates: selected.map((candidate) => ({ ...candidate, raw: candidate.raw })),
    };
    const backupKey = `${RECOVERY_BACKUP_KEY_PREFIX}${Date.now()}-${createId()}`;
    try {
      localStorage.setItem(backupKey, JSON.stringify(backup));
    } catch {
      return { error: 'The recovery backup could not be saved. No records were imported.' };
    }
    downloadRecoveryJson(`vfgt-recovery-backup-${Date.now()}.json`, backup);
    const byId = new Map(rawCollection.map((game) => [String(game?.id || '').trim(), game]));
    let recovered = 0;
    let skipped = 0;
    selected.forEach((candidate) => {
      const raw = candidate.raw && typeof candidate.raw === 'object' ? candidate.raw : null;
      if (!raw) return;
      const id = String(raw.id || '').trim() || createId();
      const existing = byId.get(id);
      if (existing && existing.status === 'scheduled' && existing.phase === 'pregame') {
        skipped += 1;
        return;
      }
      const restored = { ...raw, id, status: 'scheduled', phase: 'pregame' };
      byId.set(id, existing ? { ...existing, ...restored } : restored);
      recovered += 1;
    });
    if (recovered) localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify([...byId.values()]));
    savedGames = sortedGames(readSavedGames());
    return { recovered, skipped, backupKey };
  }

  function recoveryCandidateMarkup(candidate) {
    const game = candidate.raw || {};
    const rawJson = JSON.stringify(game, null, 2);
    return `<article class="vfgt_recovery_candidate">
      <label><input type="checkbox" data-vfgt-recovery-index="${candidate.index}"> <strong>${escapeHtml(recoveryField(game, ['team2', 'opponent', 'awayTeam'], 'Unknown opponent'))}</strong></label>
      <dl>
        <dt>Date</dt><dd>${escapeHtml(recoveryField(game, ['date', 'gameDate', 'startDate']))}</dd>
        <dt>Location</dt><dd>${escapeHtml(recoveryField(game, ['location']))}</dd>
        <dt>Team</dt><dd>${escapeHtml(recoveryField(game, ['team1', 'homeTeam']))}</dd>
        <dt>Season</dt><dd>${escapeHtml(recoveryField(game, ['seasonId', 'season', 'seasonName']))}</dd>
        <dt>Game type</dt><dd>${escapeHtml(recoveryField(game, ['gameType', 'type']))}</dd>
        <dt>Source</dt><dd>${escapeHtml(candidate.sourceKey)} · ${escapeHtml(candidate.path)}</dd>
        <dt>Why flagged</dt><dd>${escapeHtml(candidate.reason)}</dd>
      </dl>
      <details><summary>All raw fields</summary><pre>${escapeHtml(rawJson)}</pre></details>
    </article>`;
  }

  function renderRecoveryDiagnostic() {
    const result = recoveryScan;
    getRoot().innerHTML = `<section class="vfgt_app" aria-labelledby="vfgt-recovery-title">
      <header class="vfgt_page_header vfgt_page_header--with-back">
        <button type="button" class="vfgt_back_button" data-vfgt-action="settings" aria-label="Back to VFGT Settings">←</button>
        <div><p class="vfgt_kicker">Temporary, non-destructive tool</p><h1 id="vfgt-recovery-title">VFGT Future Game Recovery</h1></div>
      </header>
      <section class="vfgt_recovery_notice"><strong>Read-only scan until you select Restore.</strong><p>This diagnostic never clears storage or changes source records while scanning.</p></section>
      <div class="vfgt_actions vfgt_recovery_actions"><button type="button" class="vfgt_button vfgt_button--primary" data-vfgt-action="recovery-scan">Scan VFGT Data Layer</button>${result?.candidates?.length ? '<button type="button" class="vfgt_button" data-vfgt-action="recovery-export">Export Scan Results</button><button type="button" class="vfgt_button vfgt_button--danger" data-vfgt-action="recovery-restore">Restore Selected</button>' : ''}</div>
      ${result?.loading ? '<p class="vfgt_settings_note" aria-live="polite">Scanning localStorage, IndexedDB, and service-worker caches…</p>' : ''}
      ${result?.error || result?.importMessage ? `<p class="vfgt_recovery_result" role="status">${escapeHtml(result.error || result.importMessage)}</p>` : ''}
      ${result && !result.loading ? `<section class="vfgt_recovery_summary" aria-label="Recovery scan summary"><strong>${result.candidates.length} candidate game${result.candidates.length === 1 ? '' : 's'} found</strong><span>${result.localStorageKeys.length} localStorage keys scanned · ${result.indexedDb.databases.length} IndexedDB databases · ${result.cache.caches.length} caches</span><details><summary>Scanned data sources</summary><p>VFGT-related localStorage keys: ${escapeHtml(result.localStorageKeys.filter(isVfgtStorageKey).join(', ') || 'None')}</p><p>Current saved-game collection: ${result.savedGameSource.present ? `${result.savedGameSource.recordCount} raw record${result.savedGameSource.recordCount === 1 ? '' : 's'} (${escapeHtml(result.savedGameSource.rawType)})` : 'Not present'}</p><p>IndexedDB stores inspected: ${result.indexedDb.stores || 0}</p><p>Cached VFGT entries: ${result.cache.entries.length}</p></details></section>${result.candidates.length ? `<div class="vfgt_recovery_candidates">${result.candidates.map(recoveryCandidateMarkup).join('')}</div>` : '<p class="vfgt_empty vfgt_empty--compact">No future-game candidates were found in the scanned data layer. The saved-game collection count above is the authoritative next diagnostic.</p>'}` : ''}
    </section>`;
  }

  async function runRecoveryScan() {
    recoveryScan = { loading: true, candidates: [] };
    renderRecoveryDiagnostic();
    try {
      recoveryScan = await scanVfgtDataLayer();
    } catch (error) {
      recoveryScan = { loading: false, candidates: [], localStorageKeys: [], savedGameSource: { present: false, valid: false, recordCount: 0, rawType: 'unavailable' }, indexedDb: { databases: [] }, cache: { caches: [] }, error: `Recovery scan could not complete: ${error.message || error}` };
    }
    renderRecoveryDiagnostic();
  }

  function saveActiveGame() {
    if (!state) {
      localStorage.removeItem(ACTIVE_GAME_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(state));
  }

  function clearActiveGame() {
    latestMatchUpdate = null;
    copyFeedback = '';
    state = null;
    localStorage.removeItem(ACTIVE_GAME_KEY);
    stopRefreshTimer();
  }

  function abandonedFutureGame(game) {
    const normalized = normalizeGame(game);
    if (!normalized) return null;
    return {
      ...normalized,
      status: 'scheduled',
      phase: 'pregame',
      overtimePlayed: false,
      otGoalsTeam1: 0,
      otGoalsTeam2: 0,
      otFirstHalfStartedAt: null,
      otSecondHalfStartedAt: null,
      otFirstHalfDurationSeconds: null,
      otSecondHalfDurationSeconds: null,
      otFirstHalfRegulationWhistlePlayed: false,
      otSecondHalfRegulationWhistlePlayed: false,
      penaltyFirstTeam: null,
      penaltyAttempts: [],
      completionDecision: null,
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
      updatedAt: nowIso(),
    };
  }

  function returnActiveGameToFuture() {
    const futureGame = abandonedFutureGame(state);
    if (!futureGame) {
      clearActiveGame();
      renderHome();
      return;
    }
    const games = readAllGames().filter((game) => game.id !== futureGame.id);
    localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify([...games, futureGame]));
    clearActiveGame();
    renderHome();
  }

  function readSavedGames() {
    const parsed = readJson(SAVED_GAMES_KEY, []);
    return Array.isArray(parsed)
      ? parsed.map((game) => normalizeGame(game)).filter((game) => game && game.status === 'completed').map((game) => serializeCompletedGame(game, game.savedAt)).filter(Boolean)
      : [];
  }

  function readAllGames() {
    const parsed = readJson(SAVED_GAMES_KEY, []);
    return Array.isArray(parsed) ? parsed.map(normalizeGame).filter(Boolean) : [];
  }

  function readScheduledGames() {
    return readAllGames().filter((game) => game.status === 'scheduled');
  }

  function writeSavedGames() {
    const scheduled = readAllGames().filter((game) => game.status === 'scheduled');
    localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify([...scheduled, ...savedGames]));
  }

  function replaceSavedGamePreservingScheduled(allGames, saved) {
    return [...allGames.filter((game) => game.id !== saved.id), saved];
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

  // Read-only presentation of the same selected-season collections used by VFGT.
  function deriveLandingSummary(completedGames, scheduledGames, team, season) {
    const completed = completedGames.filter(game => season && game.seasonId === season.id && game.status === 'completed' && game.phase === 'final');
    const scheduled = scheduledGames.filter(game => season && game.seasonId === season.id && game.status === 'scheduled');
    return {
      lastGame: sortedGames(completed)[0] || null,
      nextGame: [...scheduled].sort((a, b) => gameSortTime(a) - gameSortTime(b))[0] || null,
      record: calculateSeasonRecords(completed, team?.name || HUME_FOGG_TEAM, team?.id || '').overallSeason,
    };
  }

  function landingScoreParts(game) {
    const score = finalScores(game);
    const pk = game.completionDecision === 'penalties' ? penaltyScores(game) : null;
    return {
      team1: game.team1,
      score: pk ? `${score.team1} (${pk.team1}) – (${pk.team2}) ${score.team2}` : `${score.team1} – ${score.team2}`,
      team2: game.team2,
    };
  }

  function landingSummaryMarkup(summary) {
    const { lastGame, nextGame, record } = summary;
    const section = (label, content) => `<div class="vfgt_launcher_section"><h3>${label}</h3>${content}</div>`;
    let markup = '';
    if (lastGame) {
      const parts = landingScoreParts(lastGame);
      const metadata = [lastGame.gameType ? gameTypeLabel(lastGame.gameType) : '',
        lastGame.overtimePlayed && lastGame.completionDecision !== 'penalties' ? 'After Overtime' : ''].filter(Boolean).join(' · ');
      markup += section('Last Game', `<p class="vfgt_launcher_score"><span>${escapeHtml(parts.team1)}</span> <span class="vfgt_launcher_score_numbers">${parts.score}</span> <span>${escapeHtml(parts.team2)}</span></p>${metadata ? `<p class="vfgt_launcher_detail">${escapeHtml(metadata)}</p>` : ''}`);
    }
    if (nextGame) {
      const opponent = nextGame.teamSide === 2 ? nextGame.team1 : nextGame.team2;
      markup += section('Next Game', `<p class="vfgt_launcher_value">vs. ${escapeHtml(opponent)}</p><p class="vfgt_launcher_detail">${escapeHtml(formatDateTimeLabel(nextGame.date, nextGame.startTime))}</p>`);
    }
    if (!lastGame || !nextGame) {
      markup += section(lastGame ? 'Final Record' : 'Current Record', `<p class="vfgt_launcher_value">${record.wins}–${record.losses}–${record.draws}</p>`);
    }
    return markup;
  }

  function refreshLandingSummary() {
    const element = document.querySelector('[data-launcher-vfgt-summary]');
    if (!element) return;
    const settings = readJson(SETTINGS_KEY, {});
    const season = readCollection(SEASONS_KEY, normalizeSeason).find(item => item.id === settings.currentSeasonId);
    const team = readCollection(TEAMS_KEY, normalizeTeam).find(item => item.id === (season?.teamId || settings.currentTeamId));
    element.innerHTML = landingSummaryMarkup(deriveLandingSummary(readSavedGames(), readScheduledGames(), team, season));
  }

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function gameLocationParts(game = {}) {
    const location = String(game.location || '').trim();
    const venue = String(game.venue || game.venueName || game.locationName || '').trim();
    const address = String(game.address || game.fullAddress || game.streetAddress || '').trim();
    const resolvedAddress = address || (venue ? location : '');
    const resolvedVenue = venue || (!address ? location : '');
    const display = resolvedVenue && resolvedAddress && resolvedVenue !== resolvedAddress
      ? `<span class="vfgt_map_link_venue">${escapeHtml(resolvedVenue)}</span><span class="vfgt_map_link_address">${escapeHtml(resolvedAddress)}</span>`
      : escapeHtml(resolvedVenue || resolvedAddress || location);
    return {
      venue: resolvedVenue,
      address: resolvedAddress,
      display,
      label: resolvedVenue || resolvedAddress || location,
    };
  }

  function buildAppleMapsUrl(game = {}) {
    const parts = gameLocationParts(game);
    if (!parts.label) return '';
    const params = [];
    if (parts.address) params.push(`address=${encodeURIComponent(parts.address)}`);
    params.push(`q=${encodeURIComponent(parts.venue || parts.address)}`);
    return `https://maps.apple.com/?${params.join('&')}`;
  }

  function mapLinkMarkup(game, className = 'vfgt_map_link') {
    const parts = gameLocationParts(game);
    const url = buildAppleMapsUrl(game);
    if (!url) return '';
    return `<a class="${className}" data-vfgt-map-link href="${escapeHtml(url)}" aria-label="Open ${escapeHtml(parts.label)} in Apple Maps"><span class="vfgt_map_link_icon" aria-hidden="true">⌖</span>${parts.display}</a>`;
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

  function playEndTransitionCue() {
    playNormalBeep();
  }

  function startRefreshTimer() {
    stopRefreshTimer();
    // Penalties have no clock. Replacing their DOM every second resets horizontal scrolling.
    if (state?.phase === 'penalties') return;
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

  function showVfgtConfirmation({ title, message, confirmLabel, cancelLabel = 'Cancel', alternativeLabel = '', actionsClass = '', confirmClass = 'vfgt_button--danger', alternativeClass = 'vfgt_button--danger', confirmFirst = false, returnFocusAction = '' }) {
    return new Promise((resolve) => {
      const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const previousAction = returnFocusAction || previousFocus?.dataset?.vfgtAction;
      const titleId = `vfgt-confirm-title-${createId()}`;
      const messageId = `vfgt-confirm-message-${createId()}`;
      const dialog = document.createElement('div');
      const scrollLockToken = window.LandosWorldModalUtils?.lockBackgroundScroll?.('violet-futbol-confirm');
      dialog.className = 'vfgt_confirm';
      const alternativeButton = alternativeLabel ? `<button type="button" class="vfgt_button ${escapeHtml(alternativeClass)}" data-vfgt-confirm="alternative">${escapeHtml(alternativeLabel)}</button>` : '';
      const confirmButton = `<button type="button" class="vfgt_button ${escapeHtml(confirmClass)}" data-vfgt-confirm="confirm">${escapeHtml(confirmLabel)}</button>`;
      dialog.innerHTML = `
        <div class="vfgt_confirm__backdrop" aria-hidden="true"></div>
        <section class="vfgt_confirm__dialog" role="alertdialog" aria-modal="true" aria-labelledby="${titleId}" aria-describedby="${messageId}">
          <h2 class="vfgt_confirm__title" id="${titleId}">${escapeHtml(title)}</h2>
          <p class="vfgt_confirm__message" id="${messageId}">${escapeHtml(message)}</p>
          <div class="vfgt_confirm__actions ${escapeHtml(actionsClass)}">
            <button type="button" class="vfgt_button" data-vfgt-confirm="cancel">${escapeHtml(cancelLabel)}</button>
            ${confirmFirst ? confirmButton : alternativeButton}
            ${confirmFirst ? alternativeButton : confirmButton}
          </div>
        </section>`;

      let settled = false;
      function close(confirmed) {
        if (settled) return;
        settled = true;
        window.LandosWorldModalUtils?.unlockBackgroundScroll?.(scrollLockToken);
        document.removeEventListener('keydown', handleKeydown);
        dialog.remove();
        const focusTarget = previousAction ? getRoot()?.querySelector(`[data-vfgt-action="${previousAction}"]`)
          : previousFocus?.isConnected ? previousFocus : null;
        focusTarget?.focus({ preventScroll: true });
        resolve(confirmed);
      }

      function handleKeydown(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          close(false);
          return;
        }
        if (event.key !== 'Tab') return;
        const focusable = [...dialog.querySelectorAll('button:not([disabled])')];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }

      dialog.addEventListener('click', (event) => {
        const button = event.target.closest('[data-vfgt-confirm]');
        if (!button) return;
        close(button.dataset.vfgtConfirm === 'alternative' ? 'alternative' : button.dataset.vfgtConfirm === 'confirm');
      });
      document.body.appendChild(dialog);
      document.addEventListener('keydown', handleKeydown);
      dialog.querySelector('[data-vfgt-confirm="cancel"]')?.focus({ preventScroll: true });
    });
  }

  async function confirmTournamentEnd() {
    const game = state;
    const phase = game?.phase;
    if (!['second_half', 'ot_second_half'].includes(phase)) return;
    const overtime = phase === 'ot_second_half';
    const decision = await showVfgtConfirmation({
      title: overtime ? 'End Overtime?' : 'End Regulation?',
      message: `${formatScoreLine(game)}\nThe match is tied. You can continue playing, proceed to ${overtime ? 'penalty kicks' : 'overtime'}, or finish the game as tied.`,
      actionsClass: 'vfgt_confirm__actions--playoff-decision',
      confirmClass: 'vfgt_button--success',
      cancelLabel: 'Keep Playing', confirmLabel: overtime ? 'Start Penalty Kicks' : 'Start Overtime', alternativeLabel: 'End Game as Tie',
    });
    if (!decision || state !== game || state.phase !== phase) return;
    if (decision === 'alternative') {
      const confirmed = await showVfgtConfirmation({ title: 'Finish as a Tie?', message: 'District Tournament games normally require a winner. Are you sure you want to record this game as a tie?', cancelLabel: 'Go Back', confirmLabel: 'Finish as Tie' });
      if (!confirmed || state !== game || state.phase !== phase) return;
      finishMatch(game, 'tie_override');
      recordMatchUpdate('final', game);
    } else {
      enterTournamentBreak(game);
      recordMatchUpdate(overtime ? 'end_overtime' : 'end_regulation', game);
    }
    playEndTransitionCue();
    saveActiveGame();
    syncScreenWakeLock(state);
    render();
  }

  async function handleTournamentAction(action) {
    const game = state;
    const phase = game?.phase;
    if (!game) return;
    if (action === 'start-ot' && ['overtime_break', 'ot_halftime'].includes(phase)) {
      const confirmed = await showVfgtConfirmation({ title: phase === 'overtime_break' ? 'Start Overtime?' : 'Start Overtime Second Half?', message: 'This will start the overtime clock.', confirmLabel: 'Start Half', confirmClass: 'vfgt_button--success' });
      if (!confirmed || state !== game || game.phase !== phase) return;
      startOvertimeHalf(game);
      recordMatchUpdate(phase === 'overtime_break' ? 'overtime' : 'ot_second', game);
      playNormalBeep();
    } else if (action === 'end-ot' && isOvertimeHalf(phase)) {
      if (phase === 'ot_second_half' && tiedMatch(game)) { void confirmTournamentEnd(); return; }
      const confirmed = await showVfgtConfirmation({ title: `End ${phaseLabel(phase)}?`, message: phase === 'ot_first_half' ? 'This will stop the timer and begin an untimed overtime break.' : 'This will finish the match after overtime.', confirmLabel: 'End Half' });
      if (!confirmed || state !== game || game.phase !== phase) return;
      if (phase === 'ot_first_half') { endOvertimeFirstHalf(game); recordMatchUpdate('ot_halftime', game); }
      else { finishMatch(game, 'overtime'); recordMatchUpdate('final', game); }
      playEndTransitionCue();
    } else if ((action === 'start-pk' && phase === 'penalty_break') || (action === 'change-pk-first' && phase === 'penalties' && !game.penaltyAttempts.length)) {
      const first = await showVfgtConfirmation({ title: 'Who kicks first?', message: 'Select the team taking the first penalty.', cancelLabel: 'Go Back', confirmLabel: game.team1, alternativeLabel: game.team2, confirmClass: 'vfgt_button--success', alternativeClass: 'vfgt_button--success', confirmFirst: true, actionsClass: 'vfgt_confirm__actions--playoff-decision vfgt_confirm__actions--team-choice' });
      if (!first || state !== game || game.phase !== phase) return;
      if (phase === 'penalty_break') {
        initializePenalties(game, first === 'alternative' ? 2 : 1);
        recordMatchUpdate('penalties', game);
      } else {
        game.penaltyFirstTeam = first === 'alternative' ? 2 : 1;
        latestMatchUpdate = null;
        copyFeedback = '';
      }
    } else if (['pk-scored', 'pk-missed'].includes(action) && phase === 'penalties') {
      if (!recordPenalty(game, action === 'pk-scored')) return;
      recordMatchUpdate('penalty', game);
    } else if (action === 'undo-pk' && phase === 'penalties') {
      if (!undoPenalty(game)) return;
    } else if (action === 'finish-pk' && phase === 'penalties') {
      const confirmed = await showVfgtConfirmation({ title: 'Finish Match?', message: `${formatScoreLine(game)}\nPenalty kicks: ${penaltyScores(game).team1} - ${penaltyScores(game).team2}. ${clinchedPenaltyTeam(game) ? 'Confirm the match has ended.' : 'The shootout may be tied or incomplete. Confirm that officials have ended the match.'}`, cancelLabel: 'Keep Shootout Open', confirmLabel: 'Finish Match' });
      if (!confirmed || state !== game || game.phase !== phase) return;
      finishMatch(game, 'penalties');
      recordMatchUpdate('final', game);
    } else return;
    saveActiveGame();
    syncScreenWakeLock(state);
    render();
  }

  function confirmPhaseEnd(action) {
    if (action === 'end-second' && isPlayoff(state) && tiedMatch(state)) { void confirmTournamentEnd(); return; }
    const details = action === 'end-first'
      ? { phase: 'first_half', title: 'End First Half?', message: 'This will stop the first-half timer and begin halftime.', confirmLabel: 'End First Half' }
      : action === 'start-second'
        ? { phase: 'halftime', title: 'End Halftime?', message: 'This will end halftime and start the second half.', confirmLabel: 'End Halftime' }
        : { phase: 'second_half', title: 'End Second Half?', message: 'This will stop the second-half timer and finish the game.', confirmLabel: 'End Second Half' };
    if (state?.phase !== details.phase) return;
    const gameAtRequest = state;
    void showVfgtConfirmation({ ...details, returnFocusAction: action }).then((confirmed) => {
      if (!confirmed || state !== gameAtRequest || state.phase !== details.phase) return;
      if (action === 'end-first') {
        endFirstHalf(state);
        recordMatchUpdate('halftime', state);
        playEndTransitionCue();
        saveActiveGame();
        syncScreenWakeLock(state);
        renderLive();
      } else if (action === 'start-second') {
        startSecondHalf(state);
        recordMatchUpdate('second', state);
        playNormalBeep();
        saveActiveGame();
        syncScreenWakeLock(state);
        renderLive();
      } else {
        endSecondHalf(state);
        recordMatchUpdate('final', state);
        playEndTransitionCue();
        saveActiveGame();
        syncScreenWakeLock(state);
        renderSummary();
      }
    });
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
    return season ? savedGames.filter((game) => game.seasonId === season.id && game.status === 'completed') : [];
  }

  function settingsButtonMarkup(settingsOpen = false) {
    return `<button type="button" class="digit_clock_menu_toggle vfgt_icon_button" data-vfgt-action="settings" data-vfgt-settings-toggle aria-expanded="${settingsOpen ? 'true' : 'false'}" aria-label="${settingsOpen ? 'Close VFGT Settings' : 'VFGT Settings'}" title="${settingsOpen ? 'Close Settings' : 'Settings'}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3"></circle><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
      </svg>
    </button>`;
  }

  function syncSettingsHeaderToggle() {
    const button = document.getElementById('vfgt_settings_toggle');
    if (!button) return;
    const expanded = screen === 'settings';
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', expanded ? 'Close VFGT Settings' : 'VFGT Settings');
    button.setAttribute('title', expanded ? 'Close Settings' : 'Settings');
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
      <section class="vfgt_settings_group" aria-labelledby="vfgt-recovery-settings-title"><h2 id="vfgt-recovery-settings-title">Data Recovery</h2><p class="vfgt_settings_note">Temporary, read-only scan for future games affected by an upgrade.</p><button type="button" class="vfgt_button vfgt_button--primary" data-vfgt-action="recovery">Open Future Game Recovery</button></section>
      <section class="vfgt_settings_group" aria-labelledby="vfgt-about-title"><h2 id="vfgt-about-title">About</h2><p>Violet Futbol Game Tracker</p><p class="vfgt_settings_note">Long-term team and season history tracker.</p></section>
    </section>`;
    syncSettingsHeaderToggle();
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

  function scheduledGameMarkup(game) {
    return `<article class="vfgt_history_item vfgt_scheduled_card" data-id="${escapeHtml(game.id)}">
      <div class="vfgt_card_summary">
        <span class="vfgt_scheduled_badge">Scheduled</span>
        <strong class="vfgt_scheduled_opponent">${escapeHtml(game.team2)}</strong>
        <span class="vfgt_history_date">${escapeHtml(formatDateTimeLabel(game.date, game.startTime))}</span>
        ${mapLinkMarkup(game, 'vfgt_map_link vfgt_map_link--card')}
        ${game.gameType ? `<span class="vfgt_history_game_type">${escapeHtml(gameTypeLabel(game.gameType))}</span>` : ''}
        ${game.notes ? `<p class="vfgt_scheduled_notes">${escapeHtml(game.notes)}</p>` : ''}
      </div>
      <div class="vfgt_actions vfgt_card_actions vfgt_scheduled_actions">
        <button type="button" class="vfgt_button vfgt_button--primary" data-vfgt-action="quick-start" data-id="${escapeHtml(game.id)}">Quick Start</button>
        <button type="button" class="vfgt_button" data-vfgt-action="edit-scheduled" data-id="${escapeHtml(game.id)}">Edit</button>
        <button type="button" class="vfgt_button vfgt_button--danger" data-vfgt-action="delete-scheduled" data-id="${escapeHtml(game.id)}">Delete</button>
      </div>
    </article>`;
  }

  function renderGameTypeChoice() {
    getRoot().innerHTML = `
      <section class="vfgt_app" aria-labelledby="vfgt-game-choice-title">
        <header class="vfgt_page_header">
          <p class="vfgt_kicker">Add Game</p>
          <h1 id="vfgt-game-choice-title">What type of game would you like to add?</h1>
        </header>
        <section class="vfgt_game_choices" aria-label="Game type choices">
          <button type="button" class="vfgt_game_choice" data-vfgt-action="choose-played">
            <strong>Played Game</strong>
            <span>Enter a completed result</span>
          </button>
          <button type="button" class="vfgt_game_choice" data-vfgt-action="choose-future">
            <strong>Future Game</strong>
            <span>Schedule a game to prepare ahead</span>
          </button>
        </section>
        <div class="vfgt_actions vfgt_actions--sticky">
          <button type="button" class="vfgt_button" data-vfgt-action="home">Cancel</button>
        </div>
      </section>`;
  }

  function renderFutureForm(id = '') {
    const game = readScheduledGames().find((item) => item.id === id);
    const defaults = game || {
      team1: currentTeam()?.name || '', team2: '', location: '', notes: '', date: localDateTimeParts().date, startTime: localDateTimeParts().time, gameType: '',
    };
    getRoot().innerHTML = `
      <section class="vfgt_app" aria-labelledby="vfgt-future-title">
        <header class="vfgt_page_header">
          <p class="vfgt_kicker">Future Game</p>
          <h1 id="vfgt-future-title">${id ? 'Edit Future Game' : 'Add Future Game'}</h1>
        </header>
        <form class="vfgt_form" data-vfgt-future-form data-id="${escapeHtml(id)}">
          <label>Opponent <input name="team2" required autocomplete="organization" value="${escapeHtml(defaults.team2)}"></label>
          <div class="vfgt_form_grid">
            <label>Date <input name="date" type="date" required value="${escapeHtml(defaults.date || '')}"></label>
            <label>Time <input name="time" type="time" required value="${escapeHtml(defaults.startTime || '')}"></label>
          </div>
          <label>Location <input name="location" autocomplete="street-address" placeholder="Optional" value="${escapeHtml(defaults.location)}"></label>
          <label>Game Type ${gameTypeSelectMarkup(defaults.gameType)}</label>
          <label>Notes <textarea name="notes" rows="3" placeholder="Optional">${escapeHtml(defaults.notes)}</textarea></label>
          <div class="vfgt_actions vfgt_actions--sticky">
            <button type="button" class="vfgt_button" data-vfgt-action="choose-game-type">Back</button>
            <button type="submit" class="vfgt_button vfgt_button--primary">Save Future Game</button>
          </div>
        </form>
      </section>`;
  }

  function saveFutureGame(form) {
    const data = new FormData(form);
    const opponent = String(data.get('team2') || '').trim();
    const date = String(data.get('date') || '').trim();
    const time = String(data.get('time') || '').trim();
    if (!opponent || !date || !time) return;
    const id = form.dataset.id;
    const original = id && readScheduledGames().find((game) => game.id === id);
    const game = normalizeGame({
      ...(original || createGame()),
      id: original?.id || createId(),
      team1: original?.team1 || currentTeam()?.name || HUME_FOGG_TEAM,
      team2: opponent,
      location: data.get('location'),
      notes: data.get('notes'),
      gameType: data.get('gameType'),
      date,
      startTime: time,
      status: 'scheduled',
      phase: 'pregame',
      entryType: 'live',
      teamId: original?.teamId || vfgtSettings.currentTeamId,
      seasonId: original?.seasonId || vfgtSettings.currentSeasonId,
      teamSide: original?.teamSide || 1,
      updatedAt: nowIso(),
    });
    if (!game) return;
    const games = readAllGames().filter((item) => item.id !== game.id);
    localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify([...games, game]));
    savedGames = sortedGames(readSavedGames());
    renderHome();
  }

  function quickStartGame(id) {
    const scheduled = readScheduledGames().find((game) => game.id === id);
    if (!scheduled) return;
    state = startFirstHalf({ ...scheduled, status: 'inProgress' });
    localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(readAllGames().filter((game) => game.id !== id)));
    saveActiveGame();
    syncScreenWakeLock(state);
    renderLiveAfterActivation(state.id);
  }

  function requestQuickStart(id) {
    const scheduled = readScheduledGames().find((game) => game.id === id);
    if (!scheduled) return;
    void showVfgtConfirmation({
      title: `Start game vs. ${scheduled.team2}?`,
      message: `${formatDateTimeLabel(scheduled.date, scheduled.startTime)}\n\nThe live timer will begin with the first half.`,
      confirmLabel: 'Start Game',
      confirmClass: 'vfgt_button--success',
    }).then((confirmed) => {
      if (confirmed) quickStartGame(id);
    });
  }

  function requestReturnActiveGameToFuture() {
    if (!state) return;
    const gameAtRequest = state;
    void showVfgtConfirmation({
      title: 'Return this game to Future Games?',
      message: 'The live timer and score will be reset. You can start it again or delete it later.',
      confirmLabel: 'Return to Future Games',
    }).then((confirmed) => {
      if (confirmed && state === gameAtRequest) returnActiveGameToFuture();
    });
  }

  function requestDeleteSavedGame(id) {
    const game = readSavedGames().find((item) => item.id === id);
    if (!game) return;
    void showVfgtConfirmation({
      title: 'Delete this game?',
      message: deleteConfirmationMessage(game),
      confirmLabel: 'Delete Game',
    }).then((confirmed) => {
      if (!confirmed || !readSavedGames().some((item) => item.id === id)) return;
      savedGames = readSavedGames().filter((item) => item.id !== id);
      writeSavedGames();
      renderHome();
    });
  }

  function requestDeleteScheduledGame(id) {
    const game = readScheduledGames().find((item) => item.id === id);
    if (!game) return;
    void showVfgtConfirmation({
      title: 'Delete this scheduled game?',
      message: `${game.team1} vs. ${game.team2}\n\nThis action cannot be undone.`,
      confirmLabel: 'Delete Game',
    }).then((confirmed) => {
      if (!confirmed || !readScheduledGames().some((item) => item.id === id)) return;
      localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(readAllGames().filter((item) => item.id !== id)));
      renderHome();
    });
  }

  function renderLiveAfterActivation(gameId) {
    // Let the original pointer/click activation finish before replacing the
    // scheduled-game button with the live-game controls. Otherwise the same
    // tap can land on the newly rendered End First Half button.
    window.setTimeout(() => {
      if (state?.id === gameId) renderLive();
    }, 0);
  }

  function renderHome() {
    stopRefreshTimer();
    savedGames = sortedGames(readSavedGames());
    const currentGames = gamesForCurrentSeason();
    const futureGames = readScheduledGames().filter((game) => game.seasonId === currentSeason()?.id).sort((a, b) => gameSortTime(a) - gameSortTime(b));
    const unfinished = normalizeGame(readJson(ACTIVE_GAME_KEY, null));
    const history = currentGames.length
      ? `<div class="vfgt_history" role="list">
          ${currentGames.map((game) => {
            const score = finalScores(game);
            return `<article class="vfgt_history_item vfgt_past_card" data-id="${escapeHtml(game.id)}" role="listitem">
              <div class="vfgt_past_card_header">
                <button type="button" class="vfgt_card_summary" data-vfgt-action="details" data-id="${escapeHtml(game.id)}" aria-label="Open summary for ${escapeHtml(game.team1)} versus ${escapeHtml(game.team2)}">
                  <span class="vfgt_scheduled_badge">Completed</span>
                  <span class="vfgt_history_date">${escapeHtml(formatDateTimeLabel(game.date, game.startTime))}</span>
                  <span class="vfgt_history_game_type">${escapeHtml(gameTypeLabel(game.gameType))}</span>
                </button>
                <button type="button" class="vfgt_history_matchup vfgt_copy_score" data-vfgt-copy="${escapeHtml(formatMatchUpdate('final', game))}" aria-label="Copy final score">
                    <strong class="vfgt_history_team vfgt_history_team--home">${escapeHtml(game.team1)}</strong>
                    ${finalResultLine(game) ? `<span class="vfgt_result_context">${escapeHtml(finalResultLine(game))}</span>` : ''}
                    <span class="vfgt_history_score" aria-label="Final score ${score.team1} to ${score.team2}">${score.team1} &ndash; ${score.team2}</span>
                    <strong class="vfgt_history_team vfgt_history_team--away">${escapeHtml(game.team2)}</strong>
                </button>
                ${mapLinkMarkup(game, 'vfgt_map_link vfgt_map_link--card')}
              </div>
            </article>`;
          }).join('')}
        </div>`
      : `<div class="vfgt_empty">
          <h2>No saved games yet</h2>
          <p>Start a new match or add a past result.</p>
        </div>`;
    const futureSection = `<details class="vfgt_accordion">
      <summary>Future Games <span>${futureGames.length}</span></summary>
      <div class="vfgt_accordion_content">${futureGames.length ? `<div class="vfgt_history" role="list">${futureGames.map(scheduledGameMarkup).join('')}</div>` : '<div class="vfgt_empty vfgt_empty--compact"><p>No future games scheduled</p></div>'}</div>
    </details>`;
    const pastSection = `<details class="vfgt_accordion" open>
      <summary>Past Games <span>${currentGames.length}</span></summary>
      <div class="vfgt_accordion_content">${history}</div>
    </details>`;
    getRoot().innerHTML = `
      <section class="vfgt_app" aria-labelledby="vfgt-title">
        <header class="vfgt_hero">
          <div>
            <p class="vfgt_kicker">VFGT</p>
            <h1 id="vfgt-title">Violet Futbol Game Tracker</h1>
            ${contextMarkup()}
          </div>
          <div class="vfgt_home_actions">
            <button type="button" class="vfgt_button vfgt_button--primary" data-vfgt-action="choose-game-type">Add Game</button>
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
        <section class="vfgt_section" aria-label="Saved Games">
          ${seasonRecordMarkup(currentGames)}
          ${copyStatusMarkup()}${futureSection}
          ${pastSection}
        </section>
      </section>`;
    syncSettingsHeaderToggle();
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
            <button type="button" class="vfgt_button" data-vfgt-action="choose-game-type">Back</button>
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
            <button type="button" class="vfgt_button" data-vfgt-action="choose-game-type">Back</button>
            <button type="submit" class="vfgt_button vfgt_button--primary">Save Past Game</button>
          </div>
        </form>
      </section>`;
  }

  function phaseLabel(phase) {
    if (phase === 'first_half') return 'First Half';
    if (phase === 'halftime') return 'Halftime';
    if (phase === 'second_half') return 'Second Half';
    const tournament = { overtime_break: 'End of Regulation · Overtime Break', ot_first_half: 'Overtime 1st Half', ot_halftime: 'Overtime Halftime', ot_second_half: 'Overtime 2nd Half', penalty_break: 'End of Overtime · Penalty Break', penalties: 'Penalty Kicks' };
    if (tournament[phase]) return tournament[phase];
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
          ${['overtime_break', 'ot_halftime', 'penalty_break', 'penalties'].includes(game.phase) ? `<strong class="vfgt_readonly_score">${score}</strong>` : `<div class="vfgt_score_controls">
            <button type="button" class="vfgt_score_button" data-vfgt-score="${team}" data-delta="-1" aria-label="Subtract one goal from ${escapeHtml(name)}">-</button>
            <input class="vfgt_score_input" inputmode="numeric" pattern="[0-9]*" value="${score}" aria-label="${escapeHtml(name)} score" data-vfgt-score-input="${team}">
            <button type="button" class="vfgt_score_button" data-vfgt-score="${team}" data-delta="1" aria-label="Add one goal to ${escapeHtml(name)}">+</button>
          </div>`}
        </div>`;
      }).join('<span class="vfgt_vs">vs</span>')}
    </section>`;
  }

  function penaltyMarkup(game) {
    const score = penaltyScores(game);
    const winner = clinchedPenaltyTeam(game);
    const next = nextPenaltyTeam(game);
    const count = Math.max(5, ...[1, 2].map(team => game.penaltyAttempts.filter(attempt => attempt.team === team).length));
    return `<section class="vfgt_penalties" aria-label="Penalty shootout">
      <p class="vfgt_pk_total" aria-label="Penalty score: ${escapeHtml(game.team1)} ${score.team1}, ${escapeHtml(game.team2)} ${score.team2}">PK: <strong>${score.team1} - ${score.team2}</strong></p>
      <div class="vfgt_pk_history" data-game-id="${escapeHtml(game.id)}" tabindex="0" role="region" aria-label="Penalty attempt history; scroll for additional kicks"><table style="--vfgt-pk-attempt-count: ${count}">
      <colgroup><col class="vfgt_pk_team_column">${Array.from({ length: count }, () => '<col class="vfgt_pk_attempt_column">').join('')}<col class="vfgt_pk_total_column"></colgroup>
      <thead><tr><th scope="col">Team</th>${Array.from({ length: count }, (_, i) => `<th scope="col" class="vfgt_pk_attempt_cell">${i + 1}</th>`).join('')}<th scope="col">PK</th></tr></thead>
      <tbody>${[1, 2].map(team => {
        const attempts = game.penaltyAttempts.filter(attempt => attempt.team === team);
        return `<tr><th scope="row">${escapeHtml(team === 1 ? game.team1 : game.team2)}</th>${Array.from({ length: count }, (_, i) => `<td class="vfgt_pk_attempt_cell" aria-label="Kick ${i + 1}: ${attempts[i] ? attempts[i].scored ? 'scored' : 'missed or saved' : 'not taken'}">${attempts[i] ? attempts[i].scored ? '🟢' : '🔴' : '—'}</td>`).join('')}<td>${score[`team${team}`]}</td></tr>`;
      }).join('')}</tbody></table></div>
      ${winner ? `<p role="status">${escapeHtml(winner === 1 ? game.team1 : game.team2)} has clinched the shootout. Confirm the match has ended, or keep the shootout open.</p>` : ''}
      <p class="vfgt_pk_next">NEXT KICK<br><strong>${escapeHtml(next === 1 ? game.team1 : game.team2)}</strong></p>
      <div class="vfgt_actions vfgt_pk_record_actions"><button type="button" class="vfgt_button vfgt_button--success" data-vfgt-action="pk-scored">🟢 Scored</button><button type="button" class="vfgt_button vfgt_button--miss" data-vfgt-action="pk-missed">🔴 Missed</button></div>
      <div class="vfgt_actions vfgt_pk_utility_actions"><button type="button" class="vfgt_button" data-vfgt-action="undo-pk" ${game.penaltyAttempts.length ? '' : 'disabled'}>Undo Last Kick</button>
      ${game.penaltyAttempts.length ? '' : '<button type="button" class="vfgt_button" data-vfgt-action="change-pk-first">Change First Kicker</button>'}</div>
    </section>`;
  }

  function renderLive() {
    if (!state) {
      renderHome();
      return;
    }
    const previousHistory = getRoot()?.querySelector('.vfgt_pk_history');
    const penaltyScrollLeft = state.phase === 'penalties' && previousHistory?.dataset.gameId === state.id ? previousHistory.scrollLeft : 0;
    const copyFocused = getRoot()?.querySelector('[data-vfgt-copy]') === document.activeElement;
    const focusedAction = getRoot()?.contains(document.activeElement) ? document.activeElement?.dataset?.vfgtAction : null;
    const now = Date.now();
    reconcileTimerState();
    const phase = state.phase;
    const halfPhase = isRunningHalf(state);
    const timerState = deriveTimerState(state, now);
    const elapsed = halfPhase ? timerState.elapsedSeconds : 0;
    const stoppage = timerState.stoppageSeconds;
    const remaining = phase === 'halftime' ? timerState.remainingSeconds : halftimeRemaining(state, now);
    const clock = phase === 'halftime' ? formatClock(remaining) : formatClock(elapsed);
    const action = ['overtime_break', 'ot_halftime'].includes(phase)
      ? `<button type="button" class="vfgt_button vfgt_button--success" data-vfgt-action="start-ot">${phase === 'overtime_break' ? 'Start Overtime' : 'Start Overtime Second Half'}</button>`
      : isOvertimeHalf(phase) ? `<button type="button" class="vfgt_button vfgt_button--primary" data-vfgt-action="end-ot">End ${phaseLabel(phase)}</button>`
      : phase === 'penalty_break' ? '<button type="button" class="vfgt_button vfgt_button--success" data-vfgt-action="start-pk">Start Penalty Kicks</button>'
      : phase === 'penalties' ? '<button type="button" class="vfgt_button" data-vfgt-action="finish-pk">Finish Match</button>'
      : phase === 'first_half'
      ? '<button type="button" class="vfgt_button vfgt_button--primary vfgt_button--wide" data-vfgt-action="end-first">End First Half</button>'
      : phase === 'halftime'
        ? '<button type="button" class="vfgt_button vfgt_button--primary vfgt_button--wide" data-vfgt-action="start-second">End Halftime</button>'
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
          ${mapLinkMarkup(state, 'vfgt_map_link vfgt_map_link--live') ? `<p>${mapLinkMarkup(state, 'vfgt_map_link vfgt_map_link--live')}</p>` : ''}
        </header>
        <section class="vfgt_clock_panel" aria-live="polite">
          <span class="vfgt_phase">${escapeHtml(phaseLabel(phase))}</span>
          ${halfPhase || phase === 'halftime' ? renderSevenSegmentDisplay(clock, accessibleClockLabel(phase, phase === 'halftime' ? remaining : elapsed)) : '<p>No match clock running</p>'}
          ${halfPhase && stoppage > 0 ? `<span class="vfgt_stoppage">+${formatClock(stoppage)} stoppage</span>` : ''}
          ${phase === 'halftime' && remaining === 0 ? '<span class="vfgt_stoppage">Halftime complete</span>' : ''}
        </section>
        ${renderScoreboard(state)}
        ${phase === 'penalties' ? penaltyMarkup(state) : ''}
        ${copyUpdateMarkup(state)}
        ${copyStatusMarkup()}
        <div class="vfgt_actions vfgt_live_action_rail">${action}</div>
      </section>`;
    // Necessary action/lifecycle redraws preserve the current game's horizontal position synchronously.
    const nextHistory = getRoot().querySelector('.vfgt_pk_history');
    if (nextHistory) nextHistory.scrollLeft = penaltyScrollLeft;
    if (copyFocused) getRoot().querySelector('[data-vfgt-copy]')?.focus({ preventScroll: true });
    else if (focusedAction) getRoot().querySelector(`[data-vfgt-action="${focusedAction}"]`)?.focus({ preventScroll: true });
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
        ${mapLinkMarkup(game, 'vfgt_map_link vfgt_map_link--detail') ? `<p>${mapLinkMarkup(game, 'vfgt_map_link vfgt_map_link--detail')}</p>` : ''}
        <p>Half Duration: ${normalizeHalfDurationMinutes(game.halfDurationMinutes)} minutes</p>
      </header>
      <button type="button" class="vfgt_final_score vfgt_copy_score" data-vfgt-copy="${escapeHtml(formatMatchUpdate('final', game))}" aria-label="${includeSave ? 'Copy match update' : 'Copy final score'}">
        <span class="vfgt_final_label">Final Score:</span>
        <strong>${escapeHtml(game.team1)}</strong>
        <span>${score.team1} - ${score.team2}</span>
        <strong>${escapeHtml(game.team2)}</strong>
        ${finalResultLine(game) ? `<span class="vfgt_result_context">${escapeHtml(finalResultLine(game))}</span>` : ''}
        <small class="vfgt_copy_hint">Tap to copy</small>
      </button>
      ${copyStatusMarkup()}
      ${game.overtimePlayed ? `<section><h2>Overtime</h2><p>${escapeHtml(game.team1)}: ${clampScore(game.otGoalsTeam1)} · ${escapeHtml(game.team2)}: ${clampScore(game.otGoalsTeam2)}</p>${summaryDurationMarkup('OT First Half', game.otFirstHalfDurationSeconds)}${summaryDurationMarkup('OT Second Half', game.otSecondHalfDurationSeconds)}</section>` : ''}
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
          ${game.overtimePlayed ? `<section class="vfgt_manual_half"><h2>Overtime Goals</h2><div class="vfgt_form_grid">${manualScoreEditor('otGoalsTeam1', 'Team 1 OT goals', game.otGoalsTeam1)}${manualScoreEditor('otGoalsTeam2', 'Team 2 OT goals', game.otGoalsTeam2)}</div></section>` : ''}
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
      otGoalsTeam1: original.overtimePlayed ? clampScore(data.get('otGoalsTeam1')) : clampScore(original.otGoalsTeam1),
      otGoalsTeam2: original.overtimePlayed ? clampScore(data.get('otGoalsTeam2')) : clampScore(original.otGoalsTeam2),
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
    const allGames = replaceSavedGamePreservingScheduled(readAllGames(), saved);
    savedGames = sortedGames([saved, ...readSavedGames().filter((game) => game.id !== saved.id)]);
    localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(allGames));
    clearActiveGame();
    renderHome();
  }

  function saveManualGame(game) {
    const saved = serializeCompletedGame(game);
    if (!saved) return;
    const allGames = replaceSavedGamePreservingScheduled(readAllGames(), saved);
    savedGames = sortedGames([saved, ...readSavedGames().filter((item) => item.id !== saved.id)]);
    localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(allGames));
    renderHome();
  }

  function updateManualFinalPreview(form) {
    const data = new FormData(form);
    const team1 = clampScore(data.get('firstHalfGoalsTeam1')) + clampScore(data.get('secondHalfGoalsTeam1')) + clampScore(data.get('otGoalsTeam1'));
    const team2 = clampScore(data.get('firstHalfGoalsTeam2')) + clampScore(data.get('secondHalfGoalsTeam2')) + clampScore(data.get('otGoalsTeam2'));
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
    const mapLink = event.target.closest('[data-vfgt-map-link]');
    if (mapLink) {
      const now = Date.now();
      if (event.type === 'click' && now - lastDirectActivationAt < ACTION_GUARD_MS) {
        event.preventDefault();
        return;
      }
      const capacitor = window.Capacitor;
      const nativeShell = Boolean(capacitor?.isNativePlatform?.() || capacitor?.getPlatform?.() === 'ios' || capacitor?.getPlatform?.() === 'android');
      const appPlugin = capacitor?.Plugins?.App;
      if (nativeShell) {
        event.preventDefault();
        if (event.type === 'pointerup' || event.type === 'touchend') lastDirectActivationAt = now;
        if (typeof appPlugin?.openUrl === 'function') {
          Promise.resolve(appPlugin.openUrl({ url: mapLink.href })).catch(() => { window.location.href = mapLink.href; });
        } else {
          const externalWindow = window.open(mapLink.href, '_system');
          if (!externalWindow) window.location.href = mapLink.href;
        }
      }
      return;
    }
    const copyButton = event.target.closest('[data-vfgt-copy]');
    if (copyButton) {
      if (event.type === 'click') {
        event.preventDefault();
        event.stopPropagation();
        void copyMatchText(copyButton.dataset.vfgtCopy);
      }
      return;
    }
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
      const teamIndex = Number(button.dataset.vfgtScore);
      const delta = Number(button.dataset.delta);
      const before = scoreForPhase(state, teamIndex);
      adjustScore(state, teamIndex, delta);
      if (delta > 0 && scoreForPhase(state, teamIndex) > before) recordMatchUpdate('goal', state, teamIndex, now);
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
    if (action === 'settings') {
      if (button.dataset.vfgtSettingsToggle !== undefined) {
        if (screen === 'settings') { screen = 'home'; renderHome(); }
        else { screen = 'settings'; renderSettings(); }
      } else {
        screen = 'settings';
        renderSettings();
      }
    }
    if (action === 'recovery') { recoveryScan = null; renderRecoveryDiagnostic(); void runRecoveryScan(); }
    if (action === 'recovery-scan') void runRecoveryScan();
    if (action === 'recovery-export' && recoveryScan) downloadRecoveryJson(`vfgt-recovery-scan-${Date.now()}.json`, recoveryScan);
    if (action === 'recovery-restore' && recoveryScan) {
      const indices = [...getRoot().querySelectorAll('[data-vfgt-recovery-index]:checked')].map((input) => Number(input.dataset.vfgtRecoveryIndex));
      const result = restoreRecoveryCandidates(indices);
      recoveryScan = { ...recoveryScan, importMessage: result.error || `Recovery complete: ${result.recovered} game${result.recovered === 1 ? '' : 's'} restored; ${result.skipped || 0} already present. Backup saved before import.` };
      renderRecoveryDiagnostic();
    }
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
    if (action === 'choose-game-type') renderGameTypeChoice();
    if (action === 'choose-played') renderManualForm();
    if (action === 'choose-future') renderFutureForm();
    if (action === 'add-future') renderFutureForm();
    if (action === 'edit-scheduled') renderFutureForm(button.dataset.id);
    if (action === 'quick-start') requestQuickStart(button.dataset.id);
    if (action === 'resume') resumeStoredGame();
    if (action === 'abandon') requestReturnActiveGameToFuture();
    if (action === 'details') renderDetails(button.dataset.id);
    if (action === 'edit-saved') renderEditForm(button.dataset.id);
    if (action === 'cancel-edit') renderDetails(button.dataset.id);
    if (action === 'end-first' && state?.phase === 'first_half') confirmPhaseEnd(action);
    if (action === 'start-second' && state?.phase === 'halftime') confirmPhaseEnd(action);
    if (action === 'end-second' && state?.phase === 'second_half') confirmPhaseEnd(action);
    if (['start-ot', 'end-ot', 'start-pk', 'change-pk-first', 'pk-scored', 'pk-missed', 'undo-pk', 'finish-pk'].includes(action)) void handleTournamentAction(action);
    if (action === 'save') saveCompletedGame();
    if (action === 'discard-final') requestReturnActiveGameToFuture();
    if (action === 'delete-saved') requestDeleteSavedGame(button.dataset.id);
    if (action === 'delete-scheduled') requestDeleteScheduledGame(button.dataset.id);
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

    const futureForm = event.target.closest('[data-vfgt-future-form]');
    if (futureForm) {
      event.preventDefault();
      saveFutureGame(futureForm);
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
    renderLiveAfterActivation(state.id);
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
    refreshLandingSummary();
    window.addEventListener('hashchange', refreshLandingSummary);
    window.addEventListener('focus', refreshLandingSummary);
    window.addEventListener('pageshow', refreshLandingSummary);
    window.addEventListener('storage', (event) => {
      if (event.key === null || [SAVED_GAMES_KEY, TEAMS_KEY, SEASONS_KEY, SETTINGS_KEY].includes(event.key)) refreshLandingSummary();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshLandingSummary();
    });
    document.getElementById('vfgt_settings_toggle')?.addEventListener('click', () => {
      if (screen === 'settings') {
        screen = 'home';
        renderHome();
      } else {
        screen = 'settings';
        renderSettings();
      }
    });
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
    PLAYOFF_RULES,
    deriveLandingSummary,
    landingScoreParts,
    landingSummaryMarkup,
    refreshLandingSummary,
    isPlayoff,
    tiedMatch,
    finishMatch,
    enterTournamentBreak,
    startOvertimeHalf,
    endOvertimeFirstHalf,
    initializePenalties,
    penaltyScores,
    nextPenaltyTeam,
    recordPenalty,
    undoPenalty,
    clinchedPenaltyTeam,
    finalResultLine,
    ACTIVE_GAME_KEY,
    abandonedFutureGame,
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
    formatScoreLine,
    formatSoccerMinute,
    formatMatchUpdate,
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
    futureCandidateReason,
    formatClock,
    formatDurationInput,
    gameTypeLabel,
    gameTypeSelectMarkup,
    gameSortTime,
    halftimeRemaining,
    isRunningHalf,
    initializeContext,
    isGameCandidate,
    maybeMarkRegulation,
    normalizeGame,
    normalizeSeason,
    normalizeTeam,
    parseOptionalDuration,
    normalizeHalfDurationMinutes,
    regulationSecondsForGame,
    reconcileTimerState,
    releaseScreenWakeLock,
    readStoredJson,
    replaceSavedGamePreservingScheduled,
    recoveredScheduleCandidates,
    renderSevenSegmentDigit,
    renderSevenSegmentDisplay,
    requestScreenWakeLock,
    returnActiveGameToFuture,
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
    buildAppleMapsUrl,
    gameLocationParts,
  };

  document.addEventListener('DOMContentLoaded', init);
})();
