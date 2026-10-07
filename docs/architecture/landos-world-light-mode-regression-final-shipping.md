# Lando's World light-mode regression final shipping

## Release scope and authority

Rolando's final attachment authorizes commit, branch push, PR, merge after gates, normal automatic Pages deployment verification and local-main synchronization. Physical-iPhone acceptance: PASS for Weather, Digital Clock, Sprints confirmation, VFGT Safari select, and iMT. Implementation frozen throughout shipping.

Scope: Weather Set/Refresh gold; Digital Clock light-mode active green/transparent inactive segments; opaque Sprints confirmation; native VFGT Game Type light surface/bounded chevron; iMT Home cog and inactive navigation contrast. Includes directly requested and documented launcher follow-ups: square cards, bounded/centered VFGT summaries, equal button gutters, container-sized time, AM/PM letter spacing. These launcher refinements intentionally apply in both themes. All app logic and data contracts unchanged.

Starting branch: `fix/light-mode-regression-sweep`. Starting HEAD/local main/fetched origin/main: `a956bd6745f9596723fc6f43a9e15c28b0cd787c`. Previous production: 2026-10-06-27, Pages run 37528513803, SUCCESS. Root-cause/validation report reviewed: docs/architecture/landos-world-light-mode-regression-sweep.md.

Pre-ship status: five task CSS files edited, sweep report and focused browser spec untracked; unrelated edited LLT_ISSUE_14_5_ALERTS_DEXCOM_TRACKER_REPORT.md and unrelated reports/DONC/local Supabase files excluded and preserved. 73 excluded files fingerprinted by path, length and SHA-256 before shipping; final preservation verification required. No reset/clean/deletion.

## Changed/staged inventory

1. css/weather-app.css — light-only control gold.
2. css/digital-clock.css — light-only main-clock segments; scoped launcher query sizing and AM/PM spacing.
3. css/sprints.css — light-only confirmation base; launcher button gutters and narrow Weather launcher spacing.
4. css/violet-futbol-game-tracker.css — light-only native select; square-compatible launcher summary.
5. css/maintenance-total.css — light-only header/nav foregrounds.
6. tests/browser/light-mode-regression.spec.js — presentation/geometry/theme/containment coverage.
7. docs/architecture/landos-world-light-mode-regression-sweep.md — authoritative root causes and acceptance trail.
8. docs/architecture/landos-world-light-mode-regression-final-shipping.md — this shipping record.

Shared-style consumers: `#lando-launcher .clock_launch_btn` covers Weather, Digital Clock, LLT, Violet Sprints, VFGT, Road Bike Checklist, iMT and DONC launcher buttons. All eight tested for square geometry, containment and equal gutters in both themes across mobile/tablet/desktop. Other rules target exact app/control. No shared theme-token changes. LLT application source, settings, calculations, sync, reports and typography unchanged; LLT launcher receives only authorized shared button sizing. Existing LLT-inclusive theme check passes; LLT unit coverage included.

Dark-mode app controls/segments/modal/nav: computed values match untouched HEAD. Launcher refinements in both themes are separately authorized exceptions; no new dark-mode design changes during shipping.

## Final local validation

- Full unit suite: 540 PASS, 0 FAIL.
- npm run check:js and explicit new spec node --check: PASS.
- Final combined browser selection: 90 PASS, 6 known baseline FAIL, 0 new failures.
- Focused light-mode/launcher spec: 50 PASS (including original 14, square 8, gutter 18, container scaling 10).
- Existing VFGT landing suite: 18 PASS, including lifecycle, long names, PK notation, read-only persistence and Open navigation.
- Existing affected-app/theme selection: 22 PASS plus six baseline failures below. Includes Weather Settings behavior, Digital Clock geometry/mobile cog, theme switching, LLT surfaces and branded launcher islands.
- Sprints Finish confirmation and Cancel, iMT all five destinations/state swaps, all ten clock digits and AM/PM, every VFGT option and focus: PASS in focused suite.
- Accessibility: existing focus outline/shadow rules and semantics preserved; native select focus/options verified; readable controls/labels; modal role/focus retained. No unrelated ARIA changes.
- git diff --check/full intended diff/staged scope audit: PASS at pre-commit gate.
- No secrets, production records, debug logging, synthetic runtime data, screenshots or LAN URLs in production changes. Fixtures exist only in tests. Documentation LAN URLs are excluded from Pages by runtime allowlist.

## Exact six VFGT baseline failures

Each row occurs once in Chromium and once in mobile Chromium, for six failures total:

| Exact test name | Failure classification |
| --- | --- |
| VFGT schedules, edits, quick-starts, and completes one future game without duplication | Timeout waiting for Future Games → Quick Start; save/edit steps already completed |
| VFGT rotation back to portrait keeps game state, score, and the original start timestamp | Timeout waiting for Add one goal to Violet locator |
| VFGT phone landscape mode does not apply to non-running screens or desktop viewports | Missing New Game button locator |

Fresh current and untouched-HEAD snapshot runs match the same six names, project labels and locator failures exactly. Existing tests unchanged; baseline smoke spec SHA-256 equals current smoke spec. No test weakened, skipped, renamed or repaired for shipping. Full VFGT browser suite is not claimed green; only the stated relevant selection was run.

## Release convention and policy

Pages uses UTC committer date plus workflow run number, generated into artifacts only. Next expected run number: 28, following successful 27; actual label is confirmed after merge/run. At preparation time UTC is 2026-10-07, so expected label is `2026-10-07-28`, the UTC-based release date is independent of the user-facing local timezone. Full Git SHA remains canonical identity. SW_VERSION/cache namespace is automatically injected from full merge SHA. No source version/cache bump or service-worker/Pages architecture change needed.

Main has no branch protection, no rulesets and no required PR CI. Only configured workflow is automatic main-push Pages. Verify PR head/base/check statuses and no review blocker before authorized merge; no failed check bypass. Merge strategy: normal merge commit, matching repository history.

## Recovery and release boundary

Rollback risk LOW: five scoped presentation styles plus tests/docs; no schema, migrations or data changes. Previous known-good main is a956bd6745f9596723fc6f43a9e15c28b0cd787c. Recovery: create a fresh fix branch from current main, `git revert -m 1 <this release merge SHA>`, validate, open a PR and merge after review; existing Pages workflow deploys the revert. Do not clear/reset user data or bypass the updater.

Production data mutation: NONE. LLT feature changes: NONE. LLT Issue #12 work: NONE.

## Pipeline evidence

Commit/push/PR/check status/merge/Pages/live asset and app checks/local sync are pending at the pre-commit checkpoint. Complete final evidence will be appended locally after deployment, following existing report practice, without an unnecessary post-merge documentation-only commit.

Known limitations: six established VFGT baseline browser failures; automated WebKit unavailable. Physical-iPhone/Safari acceptance is provided by Rolando. Local LAN preview is not production/offline/update validation. Deployed app checks will use a separate ephemeral browser with no account login or real-data actions.
