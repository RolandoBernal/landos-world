# VFGT #2 — District Tournament Overtime + Penalty-Kick Flow

Local implementation for physical-iPhone acceptance. No commit, push, PR, merge, or deployment.

## 1. Existing architecture

`js/violet-futbol-game-tracker.js` owns the game state, transitions, rendering, local persistence, audio, lifecycle reconciliation and Wake Lock. Regulation halves derive elapsed time from start timestamps; reaching duration marks the whistle flag without ending the half. `showVfgtConfirmation()` provides the accessible in-page dialog, focus restoration, Escape cancellation, focus trapping, background scroll lock and duplicate-settlement protection. `formatMatchUpdate()` and `recordMatchUpdate()` produce immutable transient text snapshots; all clipboard surfaces reuse `copyMatchText()`.

`saveActiveGame()` stores the active object. `normalizeGame()` restores it. `serializeCompletedGame()` preserves the completed object and separate final match-score fields. Past Games uses the same final formatter. No material architecture conflict required a migration or broad refactor.

## 2. State-machine extension

Existing `first_half → halftime → second_half` remains. For tied playoffs, confirmed regulation ending enters `overtime_break → ot_first_half → ot_halftime → ot_second_half`. Confirmed tied OT ending enters `penalty_break → penalties`. Every start/end action is explicit. Non-tied endings use `final`. Tournament tie overrides require two confirmations.

Opening/cancelling a dialog changes no phase, score, timestamp or share announcement. Keep Playing preserves the running period. Breaks display no running clock. Tournament break and shootout match-score controls are read-only.

## 3. District Tournament detection

`isPlayoff()` uses the existing normalized `gameType === 'districtTournament'`, whose existing label is `District Tournament (Playoffs)`. Other game types retain regulation-only behavior.

## 4. OT timer configuration and implementation

`PLAYOFF_RULES = Object.freeze({ overtimeHalfMinutes: 10 })` is the explicit rule value. `activeHalfKeys()`, `elapsedForHalf()`, `isRunningHalf()`, `regulationSecondsForGame()` and the existing reconciliation path now include OT halves. Each has separate timestamp, duration and regulation-whistle fields. Each starts at zero, marks its own whistle at 600 seconds, continues into added time, and ends only by confirmation. Existing lifecycle/Wake Lock/audio paths are reused.

## 5. Break behavior

`overtime_break`, `ot_halftime` and `penalty_break` are untimed. No existing authoritative OT halftime duration was present; no countdown was invented. Start Overtime Second Half is explicitly confirmed.

## 6. OT goal minutes

The centralized minute formatter uses period-local OT minutes and the 10-minute rule. Examples: `Overtime 1st Half: Minute 4`, `Overtime 2nd Half: Minute 7`, `Overtime 1st Half: Minute 10+1`. The existing floor(elapsed/60)+1 convention is preserved, including the boundary at 10:00. Goal punctuation continues to follow existing tracked `teamSide` ownership.

## 7–9. PK model, first kicker, alternation and score

Additive fields: `penaltyFirstTeam` (1 or 2) and ordered `penaltyAttempts` entries `{ team, scored }`. The first-kicker dialog uses actual names. Change First Kicker is also available while there are zero attempts. `nextPenaltyTeam()` derives the next team from the most recent attempt, falling back to the selected first team. The choice and full attempt history persist.

`penaltyScores()` counts scored attempts. There is no independently mutable PK score and no attempt limit. PK never changes regulation/OT goal totals. A visible PK total remains outside the horizontally scrollable history table. The table supports kicks 6, 7, 8 and beyond; accessible labels distinguish scored, missed/saved and not yet taken.

## 10. Undo

Undo removes exactly the last ordered attempt, derives the new total and next kicker, and clears the transient announcement/copy feedback. It creates no correction message and changes no match goal or timer history. Repeated undo can recover an incorrect initial order: undo to zero, then use Change First Kicker to select the correct team through the same first-kicker dialog. This changes only the empty shootout order, clears the transient announcement, and generates no transition message. Ordinary last-attempt errors require just undo and re-entry.

## 11. Advisory clinch and manual finish

`clinchedPenaltyTeam()` checks whether an initial-five leader exceeds the opponent's remaining possible goals. Beyond five, a differing score clinches only at equal attempt counts. Guidance is inline rather than an automatic popup, so recording/undo remains operational. No automatic completion or lockout occurs.

Finish Match is always available, with Keep Shootout Open / Finish Match confirmation. Tied or incomplete shootouts explicitly warn that officials must have ended the match. A tied confirmed PK finish does not invent a winner.

## 12. OT/PK sharing

Confirmed transitions generate End of Regulation, Overtime Starting Now, End of Overtime, and Penalty Kicks Starting Now messages. OT halftime and second-half start use concise equivalents of existing regulation updates. Each scored/missed PK generates its own frozen text snapshot using PK totals. Successful tracked-team penalties receive `!`; opponents and misses do not. Existing Tap to copy / Copied! / retry feedback and fallback remain shared.

## 13. Final results

Normal regulation copy remains exactly the existing two lines. OT adds `After Overtime`. Penalties add `<winner> wins <winning PK total> - <losing PK total> on penalties`, while keeping match goals separate. A manually confirmed tied shootout reports its tie and confirmed ending. Explicit playoff ties preserve factual regulation or OT context.

Past Games cards, detail copy and season records recognize the penalty result. OT goals/durations appear in the completed summary. Existing saved editing exposes optional OT goal totals only for games that played overtime and preserves PK history.

## 14–15. Persistence, compatibility and safety

Additive fields include OT goals, OT start timestamps, OT durations, independent whistle flags, `overtimePlayed`, PK choice/history and `completionDecision` (`regulation`, `overtime`, `penalties`, `tie_override`). Saved winner and next kicker are derived from persisted attempts. Legacy games default to no OT/PK; old final copy stays unchanged.

Storage keys remain `lando-world:violet-futbol-game-tracker:active-game:v1` and `...:saved-games:v1`. Schema version remains 4; no destructive migration, new storage collection or release/cache change is required. Existing scheduled games and unknown object fields remain preserved. The existing explicit Abandon Game action now also clears the abandoned game's new OT/PK state before returning that same game to Future Games, preventing those scores from carrying into replay.

No actual user local data, Supabase data, LLT settings, queues, food data or other app code was changed. Browser fixtures operate in isolated test contexts. Existing untracked diagnostic reports remain untouched.

## 16. Files changed

- `js/violet-futbol-game-tracker.js`
- `css/violet-futbol-game-tracker.css`
- `tests/violet-futbol-game-tracker.test.js`
- `tests/browser/vfgt-playoffs.spec.js` (new)
- `VFGT_ISSUE_2_IMPLEMENTATION_REPORT.md` (new)

## 17. Tests

Nine additional unit cases cover OT timestamp/whistle/added-time behavior, goal formatting, either first kicker, alternation, recovery, undo, sudden death, exact scored/missed messages, early/equal-round clinch, legacy finals, optional-field round trips, season results, score protection and explicit abandonment.

Nine browser cases run on desktop and mobile Chromium: regulation decisions/tie safeguard; normal regulation regression; complete OT→PK→undo→reload→save→Past Games flow and clipboard snapshot; OT added-time reload; 320/393/768/1280-width long-name/sudden-death portrait/landscape layouts; and OT non-tied final/tie override. Existing match-sharing suite remains unchanged.

## 18. Validation

- Full unit suite: 407 passed, 0 failed.
- VFGT unit suite: 68 passed, 0 failed.
- OT/PK plus existing match-sharing browser suites: 52 passed, 0 failed on desktop/mobile Chromium.
- Final OT/PK browser rerun after the visible PK-total and first-kicker correction additions: 18 passed, 0 failed.
- `npm run check:js`, syntax check for the new browser file, and `git diff --check`: passed.
- Full tracked diff and new files reviewed; staged diff empty.
- Portrait/landscape screenshots inspected, including long names and a scrollable eight-attempt history. No page overflow in layout and final-copy assertions.
- LAN preview returned current JS byte-for-byte and local-device HTML metadata.

## 19. Full browser suite and baseline failures

The full pre-final browser run executed 298 cases: 270 passed, 28 failed. Two failures were new test/summary-layout cases, corrected and passing in subsequent focused runs. The remaining 26 failures reproduced against an untouched archive of `main` at `149ea079848babd327224742b384d910adf0fa9a`.

Eight existing VFGT failures (four tests, both profiles): future-game recovery; scheduled-game completion; portrait rotation recovery; and non-running landscape mode. The baseline VFGT rerun produced 18 passes and these 8 failures.

Eighteen unrelated LLT failures (nine tests, both profiles): print-media report chrome; Bedtime stale carb behavior; temporary Carb Calc receipt rows; Food Library historical snapshots; My Foods footer actions; Today/History deletion; global sync/Settings input; temporary adjustment Settings/reload; and food-upload sync diagnostics. Baseline reruns reproduced all 18. These were left outside scope.

The full suite is therefore not green; final targeted feature and sharing suites are green. The complete full suite was not rerun after the final narrowly scoped corrections. Initial sandbox `listen EPERM` errors were resolved by running network-dependent validation with permitted localhost access.

## 20. Limitations

Physical iPhone audio, keyboard-free touch operation, background/lock recovery, actual Home-indicator clearance and Safari clipboard acceptance remain to be verified. Chromium screenshots are not device acceptance. The local-device preview intentionally disables production service-worker/offline/update behavior; this work does not validate those production paths. No live spectator link or cloud scoring was introduced.

## 21. Git/workspace status

Freshly fetched local and remote main matched the full base SHA above before implementation. Branch: `feature/vfgt-playoff-overtime-penalties`. Implementation and report are uncommitted/unstaged. Existing untracked LLT/LsW diagnostic reports remain unchanged. No commit, push, PR, merge, deployment, cache clearing or release updater bypass.

## 22. Physical-iPhone preview and acceptance checklist

Running preview: **http://10.0.0.160:8770/#/violet-futbol-game-tracker**

Command from the repository root: `npm run dev:iphone -- --port 8770`. The LAN listener uses private `en0` address `10.0.0.160` and same-subnet access. Keep Mac and iPhone on the same trusted Wi-Fi network and leave the terminal/server running. Open in Safari. The preview uses its own browser origin; existing production-origin data is not imported or cleared.

Create a test match with `District Tournament (Playoffs)` and actual or long test school names. Save and inspect only test games on this preview origin.

- [ ] At tied Second Half, End Second Half → Keep Playing: timer continues, no new share text.
- [ ] End Game as Tie → Go Back leaves play unchanged; second-confirmed Finish as Tie produces a factual final. Repeat with a separate test match for the continuing flow.
- [ ] Start Overtime enters the untimed regulation break; cancelling the next start changes nothing.
- [ ] Explicitly start OT First Half at 00:00. Verify whistle around 10:00, continued added time and manual end.
- [ ] Score a goal for each team during OT; copy/paste both updates and verify period-local minutes, added time and tracked-team punctuation.
- [ ] End OT First Half → untimed OT halftime → explicitly start OT Second Half at 00:00; regulation goals remain present.
- [ ] Verify a non-tied OT finish and final copy with After Overtime in a separate test match.
- [ ] At tied OT end: Keep Playing; tie override/back safeguard; then Start Penalty Kicks enters an untimed penalty break.
- [ ] Start Penalty Kicks → Go Back; start again and select either first kicker. Use a second test match to select the other team.
- [ ] Record scored/missed attempts for both teams. Match score stays read-only and unchanged; next kicker alternates.
- [ ] Copy/paste each of the four scored/missed team messages; verify PK totals and Copied!/retry feedback.
- [ ] Undo Last Kick: only last attempt disappears, expected team returns, total recalculates, stale share card disappears. Re-enter the corrected kick. Undo to zero and verify Change First Kicker can correct an initially mistaken order without changing the match score or timers.
- [ ] Track five kicks each; continue to kick 6 and beyond for sudden death if practical. Scroll the history locally; the page must not scroll sideways.
- [ ] Inspect early-clinch/equal-round guidance if practical; keep recording/undo available and verify no automatic finish.
- [ ] Finish Match → Keep Shootout Open changes nothing; confirm Finish Match when officials have ended it. Also verify manual incomplete/tied finish warning in a separate test match.
- [ ] Copy final result; match and PK totals remain separate. Save Game and copy the same result from Past Games card and detail.
- [ ] Background/foreground and briefly lock/unlock during each running OT half; elapsed time reconciles. Reload and Resume Game during OT.
- [ ] Reload and Resume Game during each untimed break and penalties; attempts, totals and next kicker restore.
- [ ] Check portrait/landscape, long school names, touch targets, copy-card separation, primary actions, Home-indicator clearance and absence of keyboard invocation/page overflow.
- [ ] Verify existing non-playoff tied and non-tied playoff regulation finishes still follow their normal flow.

**READY FOR VFGT #2 PHYSICAL-IPHONE VERIFICATION**

## Physical-iPhone follow-up — centered break scores and decision buttons

1. **Score alignment root cause:** `renderScoreboard()` uses `.vfgt_readonly_score` for `overtime_break`, `ot_halftime`, `penalty_break` and `penalties`. Unlike the centered score-input controls, that plain `<strong>` inherited start/left text alignment. The prior centering selector applied only inside `.vfgt_penalties`, leaving the three break screens uncovered.
2. **Score fix:** the shared `.vfgt_readonly_score` rule now explicitly uses `display: block; text-align: center`. It centers the actual text within each existing team grid cell without offsets, changing the vertical arrangement, or touching editable regulation controls. The PK screen already had these computed properties and retains its presentation.
3. **Decision layout root cause:** the shared confirmation action container has a two-column grid. Three actions filled two cells and placed the third on a separate row.
4. **Responsive fix:** a presentation-only `actionsClass` option tags only the tournament-ending decision container with `.vfgt_confirm__actions--playoff-decision`. At the existing `max-width: 680px` breakpoint, it uses one column and each button is 100% wide. Above that breakpoint, it uses three equal columns and the tagged dialog can grow to `min(100%, 42rem)`, providing enough room for the existing labels to remain on one line. Existing 52px minimum button height, 0.7rem spacing, order, colors and semantics remain intact.
5. **Equivalent flows:** both End Regulation and End Overtime use the same tag through `confirmTournamentEnd()`. Ordinary two-button confirmations and the PK first-kicker dialog are not tagged and retain their prior layout. No state-machine, timer, attempt, persistence, clipboard or saved-result behavior was modified.
6. **Files changed in this follow-up:** `css/violet-futbol-game-tracker.css`, `js/violet-futbol-game-tracker.js`, `tests/browser/vfgt-playoffs.spec.js`, and this report. Earlier uncommitted feature files remain present.
7. **Tests added:** four responsive cases, each on desktop/mobile Chromium, covering 320/393/768/1280px. Each measures the text center against its team container in all three break states with long school names. Both three-way dialogs are checked for equal widths, 52px touch height, single-line labels, full-width vertical mobile stacking, and same-row larger-screen layout. Keep Playing preserves the phase and produces no announcement.
8. **Validation:** 68 VFGT unit tests passed. Final combined feature/sharing browser run: 60 passed, 0 failed, including the eight new responsive checks. `npm run check:js`, new browser-file syntax checking, and `git diff --check` passed. Mobile and desktop dialog screenshots were visually inspected. The follow-up diff against the existing local feature was reviewed and is presentation-only.
9. **Failures:** no final targeted unit/browser failures. The prior 26 full-suite baseline failures remain outside scope; the broad suite was not rerun or repaired during this surgical follow-up.
10. **Git and preview:** still on `feature/vfgt-playoff-overtime-penalties`; all feature/follow-up work remains uncommitted and unstaged. Existing LLT/LsW diagnostic reports remain untouched. No push, PR, merge or deployment. The existing LAN server remains running at **http://10.0.0.160:8770/#/violet-futbol-game-tracker** (`npm run dev:iphone -- --port 8770`); its served JavaScript and CSS were verified byte-for-byte against the current workspace. No restart was necessary.

Recheck on the physical iPhone: centered scores in End of Regulation/Overtime Break, OT Halftime and End of Overtime/Penalty Break; full-width three-button stacks in both End Regulation and End Overtime; preserved Keep Playing, second-confirmation tie safeguard and explicit advance actions. Continue the original PK acceptance checklist without a PK redesign.

**READY FOR VFGT #2 PHYSICAL-IPHONE RE-VERIFICATION**

## Physical-iPhone follow-up — five confirmed PK/playoff findings (October 2)

1. **Scroll snap-back root cause:** `renderLive()` started the shared one-second refresh interval even in `penalties`. Each interval called reconciliation with rendering enabled, replacing the root `innerHTML`, including `.vfgt_pk_history`. The new container started with `scrollLeft = 0`. No CSS scroll-snap rule or explicit reset was involved.
2. **Exact fix:** `startRefreshTimer()` still stops the previous interval, then returns without starting another in the untimed `penalties` phase. Regulation, OT and existing halftime timing remain unchanged. Native overflow scrolling owns the gesture; no touch handlers, gesture interception or delayed restoration were introduced.
3. **DOM identity and necessary redraws:** the PK history now remains the same DOM element between refresh intervals. Kick entry, Undo and explicit lifecycle reconciliation can still require a redraw. `renderLive()` captures `scrollLeft` for the same game using the history's `data-game-id` and restores it synchronously after that redraw, before focus restoration. The browser naturally clamps position if Undo shortens the table. Reload restores the persisted attempt history/next kicker; horizontal viewport position is session-view state, not added persisted game data.
4. **Utility stack:** Scored/Missed stay in their own equal two-column grid. Undo and the conditionally available Change First Kicker share `.vfgt_pk_utility_actions`, a full-width single-column grid with 1rem top/vertical spacing and 52px minimum button heights. Their secondary treatment and existing enabled/availability rules are unchanged. Selector specificity prevents the older generic PK flex rule from overriding the grids.
5. **Who kicks first:** the dialog reuses the tagged three-choice confirmation system. Order is Go Back, team 1, team 2; action identities/results are unchanged. All choices are full-width, equal-height rows with safe text wrapping. This team-name dialog stays stacked on larger screens as well, with the existing 28rem maximum dialog width, to avoid forcing arbitrary-length school names into cramped columns. Existing End Regulation/End Overtime mobile and larger-screen layouts remain intact.
6. **Color semantics:** `vfgt_button--success` uses white text on green `#146c43` with a green border. It applies only to the new playoff Start Overtime/Start Half/Start Penalty Kicks actions, both first-kicker team choices, and PK Scored. `vfgt_button--miss` uses white on red `#9d1d3b` for PK Missed. End Game as Tie and finish/end safeguards retain the existing danger variant. Keep Playing, Cancel, Go Back and utilities retain neutral styling. Legacy start controls outside this feature retain their styling. Computed text/background contrast is tested at at least 4.5:1 in light/dark themes.
7. **Unified PK vocabulary:** live recording labels are exactly `🟢 Scored` / `🔴 Missed`. Attempt results use the actual 🟢 / 🔴 emoji, with neutral `—` for untaken attempts. PK copy prefixes are `🟢 Penalty Scored` / `🔴 Penalty Missed`. No soccer-ball, cross, circle-glyph, SVG or pseudo-element PK result system remains in these surfaces. Emoji are not recolored with CSS.
8. **Accessibility:** visible action text retains Scored/Missed. Each history result cell retains a semantic label with kick number plus scored, missed or saved, or not taken. Row/column headers and the locally scrollable labelled region remain present; color is not the sole result signal.
9. **Sharing and contracts:** only the PK message emoji prefixes changed. PK totals, immutable text snapshots, punctuation, clipboard/fallback/feedback architecture and final messages remain unchanged. Normal regulation/OT goal messages still start with `⚽️ Goal`. The attempt model, ordering, first-kicker choice, alternation, Undo, clinch, manual finish, tie override, match score arithmetic and storage schema remain unchanged.
10. **Exact files changed in this pass:** `js/violet-futbol-game-tracker.js`, `css/violet-futbol-game-tracker.css`, `tests/violet-futbol-game-tracker.test.js` (PK expected text only), `tests/browser/vfgt-playoffs.spec.js`, and this report.
11. **Tests:** existing unit and browser PK expectations now use 🟢/🔴, while normal-goal expectations remain unchanged. Five additional browser cases run on both profiles: four width cases (320, 393, 768, 1280) test utility geometry, balanced result controls, light/dark contrast, emoji and accessible markers, long-name first-kicker choices, selection behavior, affirmative starts and destructive ties; one sudden-death case verifies stable container identity across multiple old tick intervals, nonzero scroll retention through explicit reconciliation/record/Undo, later-column visibility, page overflow ownership, vertical scroll availability and reload recovery. Existing portrait/landscape and three-way decision regressions still run.
12. **Validation:** results recorded below. Repository JS checks, browser-file syntax check and `git diff --check` pass. Mobile PK controls and long-name first-kicker dialog screenshots were visually inspected. The full follow-up diff was checked for the requested scope.
13. **Failures/baseline:** final targeted results are recorded below. Known unrelated baseline failures were not repaired or rerun. An initial test-server connection reached another application's internal test port; validation was moved directly to the agreed VFGT LAN preview on 8770. A subsequent focused run caught a competing generic flex rule; it was fixed before final validation. Actual Safari momentum/Home-indicator acceptance remains a physical-device check.
14. **Workspace:** branch remains `feature/vfgt-playoff-overtime-penalties`. Earlier feature work and these fixes remain uncommitted/unstaged. Existing untracked LLT/LsW diagnostic reports are untouched. An unrelated untracked `death-on-notecards/` directory is also present and was left untouched. No commit, push, PR, merge or deployment.
15. **Preview:** the same physical-iPhone preview remains **http://10.0.0.160:8770/#/violet-futbol-game-tracker**. Its served code verification is recorded below. Launch command remains `npm run dev:iphone -- --port 8770`. No alternative iPhone port is introduced.

Physical-iPhone retest focus: utility widths/gaps and bottom clearance; green Start actions and team choices versus red tie override; Who kicks first stacking with long names; 🟢/🔴 result controls/history/copy text; native horizontal swipe and release/momentum at attempts 6–10, including after recording and Undo; continued vertical page scrolling; portrait/landscape and reload recovery. Automated Chromium checks do not constitute physical Safari acceptance.

Final results for the five-findings pass: **68 VFGT unit tests passed; 70 playoff/sharing browser tests passed; no new final failures**. JavaScript/syntax checks and `git diff --check` passed. Served JavaScript and CSS at **10.0.0.160:8770** match the workspace byte-for-byte; the existing listener is running and was left available.

**READY FOR VFGT #2 PHYSICAL-IPHONE RE-VERIFICATION**

## Final visual refinement — compact fixed PK attempt columns

The user confirmed the previous five findings were fixed on the physical iPhone. This pass changes only the history table's presentation.

1. **Cause:** the history used automatic table layout, `width: 100%`, and `.65rem` cell padding. Emoji and dashes have different intrinsic widths, and the table distributed surplus width across its columns. Attempt widths were neither fixed nor independent of content/viewport width.
2. **Chosen width:** each numbered attempt uses one `--vfgt-pk-attempt-width: 2rem` rule (32px with the current 16px root font). It comfortably accommodates unchanged emoji and two-digit attempt numbers, while scaling with the root font for accessibility. Team names use a separate 9rem column, within the existing 7–11rem name-area range; the independent PK total column is 3rem.
3. **Spacing:** numbered headers/results use `.25rem` (4px at default size) padding on each side, replacing the approximately 10px padding on each side. Existing vertical padding and emoji sizing remain unchanged. Cells remain distinct; no separate intercolumn gaps or touching result markers were introduced.
4. **Alignment:** a shared `<colgroup>` defines team, all numbered attempt columns, and total. `table-layout: fixed` and an explicit table width calculated from those columns prevent stretching on desktop and content-driven expansion on iPhone. Each numbered header and both result rows use the same attempt-column definition and centered text.
5. **Initial/sudden-death equivalence:** the same generated attempt column/class applies to every numbered kick, both team rows, all 🟢/🔴/— states and restored games. No special first-five versus sudden-death sizing or storage limit was added. At the default font, five attempts occupy 160px; the entire initial table occupies 352px. This fits the representative 393px layout, while 320px may still use local scrolling rather than crushing names/emoji.
6. **Scrolling:** the existing overflow owner, untimed-PK interval guard and same-game synchronous scroll restoration are unchanged. A sufficiently long shootout still exceeds the viewport and scrolls locally. Existing stable-DOM/reconciliation/kick/Undo/reload assertions are included in the final regression run. No page-level horizontal overflow is allowed by the responsive checks.
7. **Exact files changed in this refinement:** `js/violet-futbol-game-tracker.js` (colgroup and presentation classes/count CSS variable only), `css/violet-futbol-game-tracker.css`, `tests/browser/vfgt-playoffs.spec.js`, and this report. No state, attempt logic, colors, messages, timestamps, persistence or dialogs changed.
8. **Tests added:** four responsive cases on both browser profiles, at 320/393/768/1280px. Empty, mixed scored/missed/untaken, and fourteen-kick-per-team histories are measured. Every numbered header/result must share the fixed width, center alignment and sufficient content space. Independent team/total widths and exact compact table width are checked, along with long names, local scroll retention and absence of page overflow. Existing previous-finding and flow/sharing suites remain included.
9. **Validation:** final results recorded below. VFGT unit tests (68), repository JS checks, browser-file syntax checking and `git diff --check` pass. The refinement diff was reviewed for presentation-only scope. Known unrelated broad-suite failures remain outside scope; final physical iPhone acceptance remains with the user.
10. **Workspace/preview:** remains uncommitted/unstaged on `feature/vfgt-playoff-overtime-penalties`. No commit, push, PR, merge or deployment. Existing diagnostic reports and unrelated `death-on-notecards/` directory remain untouched. Physical-iPhone link remains **http://10.0.0.160:8770/#/violet-futbol-game-tracker**; no port change.

Final refinement validation: **68 VFGT unit tests and 78 playoff/sharing browser tests passed, with no new failures**. JavaScript/syntax checks and `git diff --check` passed. Phone/desktop screenshots were inspected. The running preview's JS and CSS match the current workspace byte-for-byte at **10.0.0.160:8770**. Unrelated baseline failures remain outside scope.

**READY FOR FINAL VFGT #2 PHYSICAL-IPHONE VERIFICATION**

## Shipping acceptance and final validation — October 2, 2026

Rolando confirmed FINAL physical-iPhone verification PASS and explicitly authorized commit, push, PR, checks, and merge in the shipping attachment. Earlier uncommitted/pending-acceptance statements above record the prior implementation stages.

Final shipping sanity review: correct `feature/vfgt-playoff-overtime-penalties` branch; fetched local/remote main both `149ea079848babd327224742b384d910adf0fa9a`; only the five intended VFGT code/test/report files selected. No verified implementation behavior changed during shipping. Existing unrelated reports and directory remain excluded and untouched.

Shipping-pass rerun: **68 VFGT unit tests passed; 78 playoff/sharing browser tests passed**. Repository JavaScript checks, browser-file syntax checking, and `git diff --check` passed. The same port **8770** preview serves the verified JavaScript byte-for-byte. Full-suite baseline limitations above remain unchanged.
