# iMT + VFGT post-release UI polish

Implementation completed October 7, 2026. Physical-iPhone review: **PASS**, confirmed by Rolando in the final shipping prompt. Accepted implementation is frozen. The local-only restrictions below record the implementation-stage handoff; the shipping prompt now authorizes the complete release pipeline.

## Starting state and preservation

Started on `main`, HEAD `9da5e289a1c261c3686852140728664e8ebe70af` (PR #145, shipped release `2026-10-07-28`). Fetched origin/main before editing; local main and origin/main matched this SHA. Created `fix/imt-vfgt-post-release-polish` from that base. The working tree contained unrelated tracked reports and untracked work; these were retained without reset, clean, staging, or deletion.

The following current status includes the task changes as well as the preserved starting files. Only the five task files listed below were edited/created in this pass:

```
 M LLT_ISSUE_14_5_ALERTS_DEXCOM_TRACKER_REPORT.md
 M css/maintenance-total.css
 M docs/architecture/landos-world-light-mode-regression-final-shipping.md
 M js/violet-futbol-game-tracker.js
 M tests/browser/light-mode-regression.spec.js
?? LLT_INSULIN_PLAN_RECONCILIATION_DRY_RUN_REPORT.md
?? LLT_INSULIN_PLAN_RECONCILIATION_EXECUTION_REPORT.md
?? LLT_INSULIN_PLAN_SERIALIZATION_AND_STATE_REPORT.md
?? LLT_INSULIN_PLAN_SYNC_SAFETY_AUDIT.md
?? LLT_INSULIN_PLAN_VERIFICATION_RELEASE_READINESS_REPORT.md
?? LLT_INSULIN_PLAN_VERIFICATION_UX_RELEASE_CANDIDATE_REPORT.md
?? LLT_SETTINGS_DIAGNOSTICS_UX_IMPLEMENTATION_REPORT.md
?? LSW_LOCAL_PROD_DIAGNOSTIC_REPORT.md
?? VFGT_ISSUE_3_LANDING_CARD_IMPLEMENTATION_REPORT.md
?? death-on-notecards/
?? docs/architecture/llt-post15-dexcom-sensor-code-final-shipping.md
?? docs/architecture/llt-sensor-cycles-REVIEW-ONLY.sql
?? supabase/.gitignore
?? supabase/config.toml
?? tests/browser/imt-vfgt-post-release-polish.spec.js

```

## Exact task files

- `css/maintenance-total.css`
- `js/violet-futbol-game-tracker.js`
- `tests/browser/light-mode-regression.spec.js`
- `tests/browser/imt-vfgt-post-release-polish.spec.js`
- `docs/architecture/imt-vfgt-post-release-ui-polish.md`

## iMT cause and correction

Classification B: intentionally coded active-state styling inappropriate for light mode. The actual header control is `#imt_settings_toggle.digit_clock_menu_toggle`; More sets `aria-expanded="true"`. Shared digital-clock CSS applies `--app-accent-bg` to expanded controls, which is dark for iMT. The app's explicit light expanded selector additionally set the foreground to Pearl White `#fffdf7`. No light/dark media-query or routing bug is involved. The hidden legacy `.lando_settings_link` is a different element.

Changed only the existing light expanded selector: foreground `#394552`, surface `--color-surface-elevated`, and border `--color-border-strong`, matching accepted light Home. No important override or new color/token. SVG rotation and navigation behavior stay intact. More already has the turquoise bottom-nav active cue.

Light Home retains the accepted surface/dark cog. Light More now matches Home's foreground, background, border, width, and height. Inactive nav items and turquoise active More remain correct. Dark Home and dark More match computed treatments and geometry captured with the exact shipped iMT stylesheet, across 320, 768, and 1280 px in desktop and mobile Chromium.

## VFGT cause and correction

`requestQuickStart` calls `showVfgtConfirmation` without a confirmClass; the generic confirmation default is `vfgt_button--danger`. It was therefore receiving the red destructive style in both themes.

Assigned `confirmClass: 'vfgt_button--success'` only to this Start Game call. This is the established green variant already used for Start Half, Start Overtime, and Start PK. Its existing VFGT CSS defines green `#146c43`, white foreground, and `#66c796` border in both themes. No CSS framework, theme token, generic default, or destructive style was changed.

Start Game resolves green with a white readable label in both themes. Cancel retains the plain `vfgt_button` neutral treatment, identical between Start Game and Delete confirmations. Delete Game still uses the danger variant and resolves red. Focused tests cancel both dialogs and verify the saved-game collection remains identical; only isolated browser fixtures are used.

The single presentation argument leaves Quick Start/game creation/timer/first-half/OT/PK/score/persistence behavior and confirmation copy unchanged. No LLT source change, storage migration, database/Supabase change, or production configuration/data change.

## Validation

- Full unit suite: **540 passed, 0 failed** (`/tmp/polish-unit.log`).
- Focused browser suite: **12 passed**, two projects and three widths (`/tmp/polish-focused.log`).
- Existing light regression, VFGT landing card, and phase confirmation suites: **72 passed**. The initial combined run recorded 78 passes plus six failures in the newly written iMT test because its locator also matched the hidden legacy button. This test-only ambiguity was investigated and corrected by targeting `.imt_nav_button`; all 12 focused checks then passed. These six test-authoring failures are separate from the established six VFGT baseline failures.
- Syntax: `npm run check:js` passed; new test file `node --check` passed. `git diff --check` passed. Reviewed the task diff; no unrelated implementation remains.
- Responsive: 320 px narrow mobile, 768 px tablet, and 1280 px desktop; dark/light state checks and button geometry pass in both projects. Existing landing tests additionally retain intermediate sizes. Browser checks do not establish physical Safari acceptance.
- Visual inspection: 393 px screenshots of iMT light More and VFGT light/dark Start Game show the expected treatment without layout changes. Evidence: `/tmp/polish-imt-light-more.png`, `/tmp/polish-vfgt-light.png`, `/tmp/polish-vfgt-dark.png`.

### Six established VFGT failures

The three established cases are run in both desktop and mobile Chromium: scheduled-game edit/quick-start flow, rotation back to portrait, and landscape non-running/desktop mode. Their accepted baseline is six failures from untouched shipped HEAD. Current rerun: **6 failed, exactly the established baseline** (`/tmp/polish-baseline.log`). In both projects, the scheduled flow times out waiting for Quick Start inside Future Games; rotation times out waiting for Add one goal to Violet; landscape/non-running mode cannot find New Game. These match the established failure modes. No seventh failure or materially changed failure. None was repaired or suppressed by this scope. Final unique passing browser count is **84** (12 focused + 50 light regression + 18 landing + 4 phase confirmation).

## Preview and release boundary

Safe existing HTTP LAN preview: **http://10.0.0.160:8000/**.

Routes: `/#/maintenance-total` and `/#/violet-futbol-game-tracker`. Use the same Wi-Fi/LAN. Production auth/sync remain disabled by the device-preview tooling. Physical Safari remains the final acceptance step.

Commit: **NO**. Push: **NO**. PR: **NO**. Merge: **NO**. Deployment: **NO**. No cache/data clearing or real-game changes.

## Physical-iPhone checklist

iMT — LIGHT MODE

1. Open iMaintenanceTotal Home.
2. Inspect upper-right settings cog.
3. Confirm accepted light-mode treatment remains.
4. Tap More.
5. Inspect upper-right settings cog.
6. Confirm it remains in Pearl White/light-mode styling.
7. Confirm it does NOT become the black/dark-mode square.
8. Confirm cog remains clearly visible.
9. Confirm More remains active turquoise in bottom nav.
10. Confirm inactive bottom-nav items remain clearly visible.

iMT — DARK MODE

11. Switch to dark mode.
12. Open Home.
13. Verify settings treatment remains correct.
14. Open More.
15. Verify existing dark-mode settings treatment remains correct.
16. Verify no dark-mode regression.

VFGT — LIGHT MODE

17. Switch to light mode.
18. Open a future game safely.
19. Trigger Quick Start / Start Game confirmation without actually starting a real game if possible.
20. Verify `Start Game` button is GREEN.
21. Verify label is clearly readable.
22. Verify Cancel retains its neutral treatment.
23. Verify the modal otherwise looks unchanged.

VFGT — DARK MODE

24. Switch to dark mode.
25. Trigger the same Start Game confirmation.
26. Verify `Start Game` is GREEN.
27. Verify label is clearly readable.
28. Verify Cancel remains neutral.
29. Verify modal otherwise looks unchanged.

Do not start/alter a real game merely for visual acceptance if the confirmation can be safely cancelled.

## Final status

iMT + VFGT POST-RELEASE UI POLISH — READY FOR PHYSICAL-IPHONE REVIEW
