# LLT explicit Context selection

New entries start with “Select a context…” and require an explicit valid choice. Date/time changes and availability refreshes never select a replacement. Saved entries retain their context, including their own once-per-day option; duplicate scheduled contexts still block persistence. Snack(s), Correction and Low Glucose remain repeatable.

The editor preserves blank drafts instead of using persisted-record normalization defaults. Empty Context has no dose guidance. Save remains actionable while Context is missing, routes to inline accessible validation before record construction or Low Glucose dispatch, focuses and scrolls the field/error into view, and performs no persistence. Other existing validation resumes once a context is selected. Dropdown styling and 50px target remain shared; error outlines support both themes.

## Scope and production safety

Only LLT JS/CSS and focused tests/configuration change. No schema, migrations, backfill, remote writes, storage contracts, queue changes or backup/restore operations. Synthetic browser tests use isolated local-device mode and reject non-local network access. Existing user checkout remains untouched; implementation uses `fix/llt-explicit-context` in an isolated worktree from synchronized main `23299f9df7df8b29c8c2636cfad5e499645d5228`.

Reviewed every editor entry point: Log Entry, Today new entry, extra/event picker, legacy primary shortcut, saved-entry edit, calculator/draft rerenders, confirmation return and Low Glucose recheck. Rechecks retain their fixed clinical context; fresh ordinary entries remain unset after save/cancel. No clinical calculation policy changed.

## Validation

- New focused unit tests: 4 passed (empty/invalid context, event options, duplicate availability/edit exclusion, no-write early save guard).
- Existing LLT storage/reporting/sync/Low Glucose/food unit tests: 357 passed.
- Offline and deterministic Pages-build tests: 39 passed.
- Syntax checks and diff whitespace checks passed.
- Chromium + iPhone WebKit: Context, calculator, Low Glucose and viewport suite: 58 passed, 2 baseline failures. The same multi-round timeline test times out waiting for More Details on unchanged main in both engines, before opening an editor. No assertions were weakened.
- Final Context rerun after focus/native-validation refinement: 4 passed in Chromium/WebKit. Covers missing Context plus empty Date, inline feedback, focus, >=44px targets, short viewport, unchanged stored data/no remote requests, reset after saving/cancel, all scheduled/repeatable availability, date-change duplicate guard and saved-context note-only edit.
- WebKit error screenshot visually reviewed: placeholder/chevron, inline spacing and error outline visible after scroll.

Run focused browser checks with `npx playwright test tests/browser/llt-explicit-context.spec.js --config=playwright.llt-context.config.js`. Run unit coverage with `node --test tests/llt-explicit-context.test.js`.

## Review and rollback

PR review/owner merge remains the production gate under AGENTS.md. No merge or production deployment performed. Production release/served-asset verification and installed-iPhone acceptance remain pending. Local browser/WebKit evidence is not physical-device acceptance.

Rollback risk LOW: revert this fix commit through a reviewed PR and let the existing Pages workflow deploy; no data rollback/migration is required. Previous known-good main: `23299f9df7df8b29c8c2636cfad5e499645d5228`. Do not clear user storage, queues or caches.
