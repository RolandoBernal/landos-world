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

## PR #175 follow-up: unset Context guidance

New Entry now places “Choose a context to show the fields for this entry.” directly beneath Context, links it with `aria-describedby`, and uses the existing theme accent to emphasize the native select. A disabled Carb Calculator row explains “Choose a meal, snack, or Low Glucose context to use the calculator.” Both disappear immediately on selection. Edit and fixed Low Glucose recheck screens receive neither helper nor placeholder. Required blank selection, save validation and all clinical/calculation functions remain unchanged.

Verified calculator applicability from `entryTypeUsesFoodCalculator`: Breakfast, Lunch, Dinner, Snacks/Snack and Low Glucose support the check-insulin calculator. Low Glucose retains Treatment Carbs; Correction and Bedtime do not expose the calculator. The existing legacy meal event rule is unchanged.

Focus investigation: `.focus({ preventScroll: true })` focused Context without changing document scroll in Chromium and iPhone WebKit. This does not prove native picker opening or smooth physical-iPhone behavior. Therefore no automatic Context focus was added; visible emphasis is the conservative fallback. Existing focus/validation behavior remains intact, with no new delayed focus callbacks or Edit autofocus changes.

Follow-up validation:
- 233 focused unit checks passed, including five explicit-Context checks and existing storage/reporting/Low Glucose coverage.
- 14 Chromium/iPhone WebKit checks passed: blank helper/disabled calculator, all seven contexts, missing-Context no-write validation, saved-context edit/duplicate guard, draft preservation, native select focus/scroll probe, Tab order, light/dark at 320px/390px with no horizontal overflow, and existing Low Glucose treatment calculator/recheck/context restriction flows.
- WebKit light/dark screenshots visually inspected. Syntax and diff checks passed.
- Preview remains http://127.0.0.1:8767/#/lee-lees-tracker; served LLT JS and CSS compared byte-for-byte with this worktree.
- Physical installed-iPhone acceptance and production approval remain pending. No merge or deployment.

Focused follow-up browser command: `npx playwright test tests/browser/llt-explicit-context.spec.js tests/browser/llt-low-glucose.spec.js --config=playwright.llt-context.config.js --grep 'every new entry|scheduled contexts|unset Context|Carb Calculator integrates|saved initial and embedded recheck|manual ending'`.

## PR #175 refinement: instruction in the placeholder

The blank Context option now reads “Choose a context to show the entry fields…”. Removed the separate Context helper and its obsolete accessibility reference. The disabled calculator and its specific applicability explanation remain unchanged. A pointer-transparent, aria-hidden rendering of the native placeholder wraps inside the blank control at narrow widths; the native select retains its option text, keyboard/picker behavior, 16px typography and focus/error outlines. Chosen and saved contexts use the original control display. No automatic focus was added.

Validation: 233 focused unit checks and 14 Chromium/iPhone WebKit checks passed, including required blank selection/no-write save validation, saved-context edits, duplicates, all seven contexts, draft retention, Low Glucose calculator/rechecks, keyboard navigation, and 320px/390px light/dark layouts. Text bounds and page width checks passed; 320px WebKit screenshot visually reviewed. Syntax/diff checks passed. Preview at http://127.0.0.1:8767/#/lee-lees-tracker remains available. Physical-iPhone acceptance remains pending; no merge or deployment.
