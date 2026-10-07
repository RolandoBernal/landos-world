# iMT + VFGT post-release UI polish final shipping

## Scope and acceptance

Physical-iPhone review: **PASS**, explicitly confirmed by Rolando in the shipping prompt. Accepted implementation is frozen. iMT light More keeps the accepted Pearl White surface/dark cog; light Home and both dark states remain intact. More retains the turquoise nav cue and inactive nav contrast. VFGT Quick Start's Start Game confirmation uses the existing green success variant in both themes; neutral Cancel, red destructive controls, modal copy and all game behavior remain intact.

No LLT feature work, Issue #12 work, database/migration/Supabase changes, production configuration changes, or production user-data mutation.

## Starting repository and preservation

Branch: `fix/imt-vfgt-post-release-polish`. HEAD/base/local main/origin/main: `9da5e289a1c261c3686852140728664e8ebe70af`, PR #145 release `2026-10-07-28`. Re-fetched origin/main and confirmed equality before shipping. Existing PR for this branch: none. Hash inventory of **74** unrelated modified/untracked files saved at `/tmp/ship-polish-preserved.json`; all excluded from staging. No reset, clean, or discarding work.

Starting status:

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
?? docs/architecture/imt-vfgt-post-release-ui-polish.md
?? docs/architecture/llt-post15-dexcom-sensor-code-final-shipping.md
?? docs/architecture/llt-sensor-cycles-REVIEW-ONLY.sql
?? supabase/.gitignore
?? supabase/config.toml
?? tests/browser/imt-vfgt-post-release-polish.spec.js

```

## Frozen diff and staged inventory

- `css/maintenance-total.css`: only the existing light expanded-cog rule changes. The shared active background and explicit white foreground caused intentionally coded inappropriate active styling. Reuses accepted Home foreground and global light surface/border tokens. No dark-mode rule changes.
- `js/violet-futbol-game-tracker.js`: one presentation argument in requestQuickStart, `confirmClass: 'vfgt_button--success'`. Previous default `vfgt_button--danger` caused red Start Game; reuses the established Start Half/Overtime/PK green (`#146c43`, white text, `#66c796` border). Generic danger default and logic unchanged.
- `tests/browser/light-mode-regression.spec.js`: accepted More cog foreground expectation.
- `tests/browser/imt-vfgt-post-release-polish.spec.js`: scoped tests, dark-state comparison against exact shipped CSS, responsive states, semantic classes/computed treatments, neutral Cancel and red Delete, saved-game preservation after cancelling isolated fixture dialogs.
- `docs/architecture/imt-vfgt-post-release-ui-polish.md`: implementation evidence and physical-review confirmation.
- `docs/architecture/imt-vfgt-post-release-ui-polish-final-shipping.md`: this release report.

No runtime fixtures, secrets, credentials, screenshots, debug logging, LAN URL, or synthetic user data are added to production source. Test fixtures stay in tests, and Pages publishes only the runtime allowlist. Unrelated local reports, DONC, and Supabase files stay excluded/preserved.

## Release convention

Pages uses the UTC merge commit date and workflow run number as the release identifier. Build/service-worker/cache canonical identity is the full merge SHA; the builder replaces the service-worker placeholder and generates deployment-version.json/network-only metadata. No manual source-version or service-worker bump is needed. Most recent successful Pages run is 28; the next automatic run is expected to be 29, subject to actual workflow evidence. No updater/offline/fetch architecture change.

## Final validation and release proof

Final validation and subsequent commit/PR/CI/Pages/live proof will be recorded below. No claim of shipping success is made until those gates complete. Physical accessibility acceptance covers readability on iPhone; focused browser checks use accessible named controls and verify visible foregrounds but are not a comprehensive accessibility audit.

### Final pre-commit gates

Full unit suite: **540 passed, 0 failed**. Browser selection: **94 passed, 6 established baseline failures** (84 accepted targeted checks plus 10 existing launcher/ecosystem smoke checks). Syntax/check:js and new test syntax: PASS. git diff --check: PASS. Logs: `/tmp/ship-polish-unit.log`, `/tmp/ship-polish-browser.log`, `/tmp/ship-polish-syntax.log`.

Exact failures, each in **chromium** and **mobile-chromium**:

1. `VFGT schedules, edits, quick-starts, and completes one future game without duplication`: missing Quick Start inside Future Games after editing.
2. `VFGT rotation back to portrait keeps game state, score, and the original start timestamp`: timeout waiting for Add one goal to Violet.
3. `VFGT phone landscape mode does not apply to non-running screens or desktop viewports`: missing New Game.

These are exactly the established six; no seventh failure, no materially changed failure, and no previously passing relevant test failed. Tests and application behavior were not altered to hide them. Named buttons/dialogs and label foreground checks pass; physical readability accepted. Automated responsive coverage includes mobile/tablet/desktop and shipped dark-state equality.
