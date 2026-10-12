# LLT Issue #16 — Low Glucose progressive disclosure

## Current release status — October 12, 2026

Local physical-iPhone acceptance is complete. Rolando confirmed production preflight, targeted sensor CSV exports, Issue #15 migration execution, postflight, existing-client physical-iPhone checks and RPC backward compatibility passed. These are user-confirmed results; production SQL was not rerun during release preparation. Application release is awaiting PR review and Rolando’s merge; no deployment is claimed. Earlier pending-status statements below describe historical milestones. Issue #12, insulin calculations and clinical settings remain outside this release.

Status: Implemented Locally / Ready for Review. Local physical iPhone acceptance confirmed by Rolando in the October 9 deployment-preparation attachment. Production acceptance pending.
Date: October 9, 2026. Local branch: feature/llt-issues-15-16.

## Investigation and files inspected

Inspected `js/lee-lee-diabetes-tracker.js` (deriveLowGlucoseEpisode, renderLowGlucoseCard, renderEntryCardContent, timeline/footer rendering, root action handler), `css/lee-lee-diabetes.css`, `tests/browser/llt-low-glucose.spec.js`, `tests/llt-low-glucose-client.test.js`, `package.json`, and `playwright.config.js`.

Today and History share renderLowGlucoseCard through renderEntryCardContent. The card uses existing derived episode values and a native details/summary timeline. Outer timeline wrapper owns timestamp/Edit/Delete footer. Previously all summary fields were visible immediately; only the timeline was collapsible. Incompatible future episode versions retain the existing compatibility message.

## Decisions and local changes

Changed only the shared card renderer, delegated disclosure handling, scoped CSS and relevant browser coverage. A full-width semantic button (minimum 44px height) controls a hidden per-record details region with aria-expanded and aria-controls. IDs derive from escaped record identity, not list position. State lives solely in the rendered DOM and defaults to collapsed whenever the screen rerenders, including navigation and reload. No storage or sync state is introduced.

Collapsed view retains Low Glucose, actual outcome, and initial/latest glucose. More Details reveals lowest documented glucose, recorded treatment total, recheck count, threshold, existing recovery timing/disclaimer, chronology/closure notices and pending reminder. Existing native Episode timeline remains separate and initially closed; closing More Details also closes the nested timeline. Existing urgent open-episode actions remain accessible below the disclosure. They are preserved even when the details are hidden.

Footer remains in existing normal document flow outside the disclosure and below episode actions. Existing Edit/Delete and recheck behavior remain unchanged. Opening details uses a subtle 140ms opacity/position transition; reduced-motion disables it. Collapse uses native hidden visibility immediately to prevent focus reaching hidden descendants; no height animation or scroll reset is introduced.

No model, schema, persistence, settings, thresholds, derived calculations, doses, reports or exports changed. No Supabase migration required. Issue #12 and all unrelated pre-existing files left untouched.

## Tests and results

Updated three existing timeline tests to open More Details before the nested timeline. Added a browser scenario for independent cards, default collapse, factual collapsed values/open status, keyboard activation, aria-expanded, 44px target, nested default/reset, footer action visibility and geometry, reduced motion, History disclosure and reload collapse, and unchanged persisted records. Captures synthetic collapsed/expanded screenshots; desktop and mobile captures were visually inspected. Card content and footer fit the mobile width. The local preview badge overlays part of the page in full-page captures; it is development UI, so actual Safari/PWA safe-area checks remain manual.

- npm run check:js: passed.
- Full npm test regression: 540 passed, 0 failed (run with local-server permissions).
- Focused existing LLT storage/sync/reporting/timer/Low Glucose/sensor unit suites: 368 passed, 0 failed.
- Initial Low Glucose browser run: 26 passed; two new-test failures were caused by locating the button by its old label after successful toggling. Corrected the test to use the stable action attribute; targeted rerun: 2 passed.
- Final broad LLT browser run: 98 passed, 2 disclosure failures (reduced-motion selector specificity). Fixed the CSS override; the subsequent targeted run exposed a test navigation mistake (History date list must open its day before showing full cards). Corrected that test; final desktop/mobile disclosure rerun: 2 passed, 0 failed. Thus all 100 scenarios have passing results across the broad run and focused rerun; no single final all-green 100-test rerun was performed. The initial broader run used the default dev-local server, which lacks the LOCAL DEV badge expected by the saved-meal and Today-carb suites. Stopped that mismatched run and reran against the existing iPhone development server without weakening tests.
- git diff --check: passed; intended runtime/test diff reviewed. No staging, commits or pushes.

## Risks and manual iPhone acceptance

Browser mobile coverage is Chromium emulation, not physical iPhone/Safari/PWA evidence. DOM state intentionally resets on card rerender; no persistent expansion contract exists. Existing actions remain visible on open episodes, making those cards taller than completed cards. Unsupported episode versions remain protected by compatibility handling.

On the actual iPhone/PWA:

1. Open Today with two episodes; verify both collapsed, correct status and initial/latest measurements, footer visible.
2. Expand one card; verify the other stays collapsed and the nested timeline stays closed. Expand timeline, collapse/reopen details, verify timeline resets.
3. Check confirmed, open, manually ended and threshold-unavailable episodes; verify recovery disclaimer and factual values.
4. Check History, return to Today and confirm default collapse. Verify Edit/Delete and Edit Recheck with deliberate synthetic data.
5. Test narrow screen, long notes, scrolling, safe areas/bottom navigation, light/dark, and VoiceOver button expanded state. Check reduced-motion setting.
6. Verify no horizontal overflow, clipping, footer overlap or unexpected scrolling; verify data remains unchanged through disclosure/navigation.

No actual iPhone validation, deployment, cache refresh, user-data manipulation or production SQL performed.

Review preview retained at http://10.0.0.160:8000/#/lee-lees-tracker (HTTP 200 verified). It uses isolated local-device data; production sync and PWA/offline behavior are disabled.

## iPhone review follow-up — button spacing

Rolando tested the local card on iPhone and reported that More Details nearly touches Record Recheck. The shared action group already has a 0.65rem button gap, but its default top margin is only 0.15rem. Scoped the Low Glucose action-group top margin to 0.65rem to match the standard action gap. No layout, action or data changes.

Spacing follow-up validation: existing disclosure checks passed on desktop and mobile Chromium (2 passed); git diff --check passed. Physical iPhone recheck remains pending.

## iPhone review follow-up — entry heading

Matched Low Glucose to the other entry titles by resetting its h3 default margin and inheriting font size/line height. It retains the shared timeline_type font weight/color/font family and semantic heading role. Scoped CSS only; no adjacent card or data changes.

## Recovery behavior investigation after iPhone review

Rolando reported 65 → 62 → 75 → 79 with continuing Record Recheck availability. Inspected deriveLowGlucoseEpisode, saveLowGlucoseEditor, persistLowGlucoseRecord and handleLowGlucoseAction. With a saved threshold of 70, 75 is eligible (at/above threshold and not before initial timestamp). Saving the recheck offers Recheck Saved / Mark Episode Complete; closure then requires explicit confirmation. Done leaves the episode Open, with both Record Recheck and Mark Episode Complete available. This path has no local-device environment branch. A missing threshold blocks confirmed recovery intentionally; an episode uses its saved threshold rather than guessing 70 or applying later settings.

Added exact-sequence browser regression with initial 65, rechecks 62/75/79, explicit Done at 75, repeated completion offer at 79, and explicit recovery closure referring to the first qualifying recheck (75). Desktop/mobile: 2 passed. No application behavior or clinical calculations changed. The actual iPhone episode threshold and choices are not available from the screenshot; its root cause remains unconfirmed pending that information. Screenshot alone shows an open episode, not whether the completion prompt appeared or was dismissed.

## Recovery Confirmation Investigation

### Conclusion and evidence boundary

**E — Inconclusive for the original physical-iPhone incident; further evidence required.** No Issue #16 recovery regression was found in source comparison or isolated interactive reproductions. The verified workflow is existing behavior with a potentially confusing Done label (B as a UX finding), not evidence that the user actually chose Done. Do not call the reported incident resolved. Recovery workflow verified in browser/source; physical Safari acceptance remains pending.

The user's production examples (53 → 108, threshold 70, confirmed after 13 documented minutes; 48 → 90 confirmed) are user-reported reference evidence, not independently inspected live records. No production patient data was accessed. Compared against the actual pre-Issue-#16 Git revision **5d49f0c140f78a378e571958550c62c899e5096d**, the local branch base. Also served that revision's tracker JavaScript and CSS via test-only route interception and reproduced 65 → 62 → 75 → 79 on desktop/mobile: 2 passed. Temporary baseline test harness removed; baseline extracts/results remain under /private/tmp.

### Complete execution path

1. New Low Glucose entries use createLowGlucoseEpisode and resolveLowGlucoseThreshold (around lines 1806–1820 and save path near 7824). The lower configured target is snapshotted with provenance; historical/untrusted context can yield null. No automatic default to 70.
2. openLowGlucoseRecheck prepares an embedded-round editor with parent identity/version and stable round ID. saveLowGlucoseEditor validates the latest parent and persists updateLowGlucoseRound; it requests the post-save offer explicitly.
3. deriveLowGlucoseEpisode uses **the saved thresholdSnapshot.lowMgDl**, not later settings. A recheck qualifies when its reading is at/above the valid threshold and its timestamp is at/after the initial observation. Initial glucose alone is not a qualifying recovery recheck.
4. persistLowGlucoseRecord commits safely, rerenders, then, for an open episode with eligible rechecks, calls showLowGlucoseDialog. The current card's disclosure state does not gate this code. The offer is a separate fixed modal titled **Recheck Saved**, with the exact explanatory message that the documented reading is at/above the episode threshold and the episode remains open until explicitly completed.
5. **Mark Episode Complete** and **Done** appear side-by-side in that modal, using the same ghost-button treatment. At narrow width the longer completion label wraps. Completion receives initial focus. Background root children are inert. Focus cycles through the two buttons; the dialog has role=dialog, aria-modal, labelled title and described message.
6. low-confirm-recovery opens **Confirm documented recovery?**, with a second **Mark Episode Complete** and **Cancel**. low-close-recovery verifies the captured episode has not changed, then closeLowGlucoseEpisode records the first chronological qualifying recheck ID and persists the explicit closure. Time is measured from initial observation to that first documented qualifying recheck, not biological recovery.
7. **Done** in the first offer returns Home without closing. Escape invokes the same action. **Cancel** in the second confirmation also leaves the episode open. The backdrop has no dismissal handler. No automatic closure at threshold crossing.
8. The open card retains Record Recheck plus Mark Episode Complete once any eligible recheck exists. The completion action is outside More Details, so later completion requires no new reading. Both Today and the History day view offer this route. More rechecks while open retain the same episode and do not invalidate earlier eligibility. After closure, the card no longer offers a new recheck; existing rechecks remain explicitly editable, and invalidating the referenced recovery can reopen the episode. Do not infer an unrestricted new-recheck prohibition at the data-model layer: UI removes the action, while updateLowGlucoseRound itself is not a clinical state machine.

### Pre-Issue-#16 comparison and UI mechanics

Function-body comparison found **identical** resolveLowGlucoseThreshold, createLowGlucoseEpisode, deriveLowGlucoseEpisode, updateLowGlucoseRound, closeLowGlucoseEpisode, showLowGlucoseDialog, saveLowGlucoseEditor, persistLowGlucoseRecord, openLowGlucoseRecheck and handleLowGlucoseAction. The event handler change intercepts only low-toggle-details before the unchanged low-* delegation. It changes DOM visibility/button text only; it does not dispatch completion, remove the modal, persist records, or rerender. No disclosure persistence exists.

Issue #16 wraps summary/timeline fields; completion actions stay outside the wrapper. Modal CSS is unchanged and outside the scoped low_episode selectors. It uses fixed inset=0, z-index 50, safe-area padding, bounded scrolling panel; bottom navigation has lower stacking level. renderAfterRecordChange finishes before modal insertion, which replaces any prior timer modal. Background is inert; no card action handles the modal's button click. No stale-reference, accidental backdrop dismissal or rerender loss was reproduced. This is source/test evidence, not a guarantee against every Safari visualViewport or virtual-keyboard condition.

There is no local-device branch in eligibility, offer or confirmation handling. Local development can nevertheless have different isolated settings and saved threshold data from production; offline/auth differences can change surrounding availability. No evidence establishes the original episode's threshold. Missing threshold must not be silently changed to 70.

### Threshold and compatibility findings

- Threshold 70: 62 does not qualify; 75 qualifies; 79 offers completion again when still open.
- Threshold 80: 75 does not qualify, and the episode remains open.
- Null/missing/unavailable threshold: no eligible recovery; factual recording/manual ending remain available. Existing resolver returns null when no trustworthy threshold exists.
- Malformed nonnumeric threshold: no eligible recovery; details explain threshold unavailable. Tests retain the original metadata rather than rewriting it.
- Supported episode schema is version 1 with required fields. Unsupported versions (including absent/older schema that fails validation) retain compatibility messaging and protected editing; the existing version-2 browser test verifies preservation/read-only behavior.
- Issue #16 puts the threshold/unavailable message inside More Details. Thus important explanatory context is hidden by default, but preserved and available on expansion. The unsupported-version compatibility message remains visible. This may contribute to confusion when the saved threshold differs or is unknown; it is not a changed recovery rule.

### Reproduction, coverage and observations

Use synthetic local data only. Create 65 / 15g, save and Done; record 62 / 15g, save (no recovery offer), Done; record 75 / 0g and save. Immediate modal offers completion before any return to the card. Selecting completion opens explicit confirmation; confirming closes. Selecting Done leaves closure null; collapsed card still offers completion. Cancel that later confirmation, open History → date → episode, complete there without adding a third recheck. Verify two rechecks persist and closure references 75. Separately continue with 79 / 0g and confirm; closure still references 75.

Added tests cover 320px and 393px at height 667 on both projects. Both offer buttons fit viewport bounds without scrolling and their centers hit-test to the button (not the nav/backdrop). Touch heights >=44px, initial focus and Tab containment pass. Screenshots captured at test output `qualifying-recheck-offer.png`; mobile artifact visually inspected. Existing suite also covers actual outcome rendering, historical editing, incomplete thresholds, timer interactions, data preservation and responsive presentation. It tests full interactions, not just arithmetic.

- Unit Low Glucose suite: **52 passed**.
- Baseline exact-sequence browser run: **2 passed**.
- First expanded current browser run: **36 passed, 4 failed** in the new test's reload assertion. Root cause was the test helper reseeding initial data on every page load, not an application recovery failure. Replaced that inappropriate reload assertion with navigation back to persisted History; retained direct saved-record assertions.
- Corrected focused investigation scenarios: **12 passed** (exact sequence, narrow visibility/later completion, alternate/null/malformed threshold on desktop/mobile).
- Final full Low Glucose browser suite: **40 passed, 0 failed** (desktop/mobile, 44.3 seconds). Test syntax check and git diff --check passed.
- git diff --check passed.

No application correction was made during this investigation. Only focused test additions and this report changed. Previously approved local heading/spacing/disclosure changes remain. Issue #15, Issue #12, insulin calculations, thresholds, production data and schema untouched. No commits, pushes or deployment.

### Remaining iPhone checks and recommendation

The original observation remains unexplained without its saved threshold and immediate post-save interaction. On the same local iPhone episode, inspect More Details → Episode threshold and whether Mark Episode Complete is present below the timeline. On a new synthetic episode using known local threshold 70, repeat 65 → 62 → 75 and capture the immediate Recheck Saved modal before choosing anything. Verify both buttons, keyboard dismissal, orientation, Safari toolbar/safe areas, scroll position and VoiceOver focus/action names. Choose Done deliberately, verify Open and later completion without another reading; repeat choosing completion plus final confirmation. Repeat from History. Do not use production patient records for these acceptance tests.

**Proposal only, requiring approval:** rename Done to **Continue Monitoring** specifically in the qualifying-recheck offer. Preserve the same action, saved threshold, two-step confirmation and calculations. Keep the current explanatory threshold message; do not adopt “Back in Range” because the current rule checks only the lower threshold, not an upper range. A more explicit title such as **Confirm Episode Completion?** can be considered separately, but the smallest change is the one button label. No proposed UX change has been implemented.


## Approved final UX refinement and combined validation

Status: Implemented Locally / Awaiting Physical iPhone Acceptance. Not deployed or fully completed.

The latest attachment explicitly approved renaming **Done** to **Continue Monitoring** only in the qualifying-recheck **Recheck Saved** offer. Updated that one lowButton label in persistLowGlucoseRecord; the low-done identifier, handler and other Done buttons remain unchanged. Explicit completion still opens its existing second confirmation; Continue Monitoring leaves closure null and allows more rechecks/later completion. No thresholds, recovery calculations, medical values or persistence rules changed. The original iPhone incident remains inconclusive; this label change addresses verified ambiguity, not a claimed regression fix.

Files: js/lee-lee-diabetes-tracker.js (one label, plus previously approved disclosure), tests/browser/llt-low-glucose.spec.js (specific accessible names/visibility/focus), this report. Earlier scoped CSS heading/button-gap/disclosure changes retained.

Regression coverage checks 65 → 62 → 75 with threshold70, Continue Monitoring accessible name and focus, open state, later completion from Today/History without another recheck, explicit final closure, plus 79 follow-up referencing first qualifying75. At 320/393 widths both offer buttons fit, hit-test unobscured, touch height >=44px, focus containment preserved. Existing cards remain independently collapsed, additional data inside More Details, nested timeline resets on closing, footer/actions retained, reduced motion respected. Future/malformed threshold handling remains protected.

Full npm test: 545 passed. Combined sensor/Low Glucose browser run: 86 passed. Final complete LLT browser suite after all corrections: 130 passed, 0 failed in one desktop/mobile Chromium run (2.5 minutes). Log: /private/tmp/llt-final-complete-browser.log. Preview http://10.0.0.160:8000/#/lee-lees-tracker returned HTTP 200 after this run. JavaScript and diff checks passed. Physical iPhone acceptance of the final label and Issue #15 UI is pending.

Manual final iPhone checklist: using synthetic local data, verify collapsed cards, matching entry heading/button spacing, More/Less Details and independent nested timeline; record65/62/75 and observe Recheck Saved → Continue Monitoring leaving Open; complete later without new reading; repeat explicit completion/79 follow-up, verify footer and History consistency, VoiceOver action name/focus, scrolling, keyboard dismissal and safe areas. Production records remain untouched. No staging, commits, pushes, deployment or production SQL.

## October 9 production preparation

Local physical iPhone acceptance confirmed by Rolando in the deployment-preparation attachment. No production migration or application publication authorized yet. See docs/deployment/llt-issues-15-16-production-approval.md for live schema review, final validation and recovery blockers. Production migration identifier, deployed candidate revision, production smoke results and production user acceptance remain pending. Existing local test results above are historical; fresh preparation results are recorded in the approval package.

Fresh October 9 preparation validation: 545 unit, 19 metadata integration, 38 existing sensor SQL, 82 Low Glucose database and 1 local Auth/REST/realtime test passed; syntax/diff checks passed. All 130 issue-specific browser scenarios passed. Complete browser coverage: 588 scenarios, 560 passed, 28 failed, 0 skipped; every failure reproduced on unchanged main. Production recovery remains unverified (backup API lists no points; PITR false), so no migration or publication occurred. Detailed exact commands, baseline comparison, scope, verification and recovery procedures are in docs/deployment/llt-issues-15-16-production-approval.md.

## October 12 scoped release validation

Authorized PR-only release preparation: 545 unit tests and syntax/diff checks passed; fresh desktop/mobile LLT browser suite 130 passed; local database checks 19 metadata plus 38 existing sensor, 82 Low Glucose and one synthetic Auth/REST/realtime all passed. All 13 candidate hashes remain unchanged. Earlier broad-suite evidence remains 560 passed/28 known baseline failures, not a green full suite. No production SQL was rerun; reviewed migration is included for history only. Application awaits PR review and Rolando’s merge; production deployment and updated-app acceptance remain pending.

## Post-release visual polish — October 12, 2026 (local only)

Branch: fix/llt-low-glucose-card-visual-polish. No commit, push, PR, deployment or production-data changes. Physical-iPhone review of this polish remains pending.

Root cause: the episode status used a browser-default bold paragraph at the title's size, primary values used default paragraph spacing/type, and More/Less Details inherited full-width action-button chrome. The title itself already matched shared context-card typography.

Reused timeline_type, card_status, timeline_values and the shared timeline muted-body rule/color tokens. The existing disclosure remains a keyboard-accessible button with a 44px minimum target and aria-expanded/aria-controls, now borderless/background-free with a leading aria-hidden triangle and state-dependent label. Episode Timeline uses matching disclosure font/color/line-height. Scoped paragraph/summary spacing is tighter; the original footer, action controls, timeline order/content/editing and collapse-state reset are retained. A dedicated low_details class shares body styles without changing saved-note semantics or applying the numeric font to all prose.

Files: css/lee-lee-diabetes.css, js/lee-lee-diabetes-tracker.js, tests/browser/llt-low-glucose.spec.js and this report. No clinical calculations, thresholds, synchronization, sensor code, SQL, settings or Issue #12 code changed. All 75 unrelated file fingerprints remain unchanged.

Validation: 221 Low Glucose/storage/reporting unit tests passed; 42 desktop/mobile Issue #16 browser scenarios passed; syntax and diff checks passed. New light/dark 320/393px comparisons verify exact Bedtime heading typography, subordinate status, matching disclosure styling, Space-key toggling, 44px targets, no horizontal overflow and unchanged persisted records. Existing tests cover independent timelines, transient disclosure, footer actions, multi-round chronology/Edit Recheck and explicit recovery/Continue Monitoring behavior. Screenshots reviewed beside Bedtime/Snacks. Initial class reuse accidentally included the container in saved-note selectors; corrected without weakening the assertions, then the full suite rerun successfully.

Existing local preview retained: http://10.0.0.160:8000/#/lee-lees-tracker. HTTP 200 and exact changed JS/CSS served bytes verified. Authentication/production sync/PWA operations are disabled in this local-device preview. Please review collapsed/expanded completed and open episodes, both themes and footer/timeline controls on the physical iPhone before release authorization.

## Issue #16.1 release authorization — October 12, 2026

Rolando confirmed physical-iPhone acceptance and explicitly approved release of all the preceding visual polish, including typography/spacing and the matching native disclosure marker. The four-file scope is the CSS, tracker card rendering, Issue #16 browser spec and this report. The marker now uses native disclosure-open/disclosure-closed list markers rather than small Unicode triangles; aria-hidden presentation leaves the existing accessible button label and toggle contract intact. Clinical calculations, thresholds/completion/Continue Monitoring, insulin/settings, Carb Calculator, Sensor History, authentication/sync and database schema remain unchanged. No migration is included or rerun. All 75 unrelated files remain preserved.

Release checks: 221 relevant unit tests, 42 desktop/mobile browser scenarios and syntax/diff checks passed. Physical-iPhone acceptance is user-confirmed. Production deployment must be verified for the merge SHA through the existing Pages workflow; this local report does not claim an as-yet-unverified deployment.
