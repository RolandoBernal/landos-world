# LLT Issue #20 — My Meals in Carb Calculator

## Implementation

Adds My Meals beside Favorites and Recent in the shared calculator used by New Entry, Edit Entry, and Foods standalone calculation. The existing search, panel, manual amount, selected items, total, and Use flow is preserved. The supplied brief's hierarchy is the reference; the separate interactive ChatGPT mockup was not attached.

My Meals stays selected after adding. One tap immediately creates one selected meal row and updates the total without closing the calculator. Intentional repeats display “Add again (+1)” and increment the existing row's saved-amount quantity. The existing 350 ms duplicate-tap guard remains in force. Quantity editing, removal, individual foods, and manual amounts reuse existing calculator handlers.

## Existing data integration

Uses the existing `savedMeals` library and `activeSavedMeals` / `normalizeSavedMeal` normalization. Component snapshots, including saved quantities and carbohydrate totals, determine the normalized meal total; a standalone saved total is used only when components are absent. `carbRowFromSavedMeal` freezes that total as one saved amount. Existing two-decimal normalization is preserved; no new rounding rule is introduced. Applying the result uses existing labeled manual-component snapshots, so ingredients are not added twice or recalculated from live food values.

Selection is temporary calculator state. No meal, food, patient record, schema, auth, insulin-plan verification, settings synchronization, or clinical calculation changes are introduced. Meal creation/editing remains in Foods → My Meals.

The library is local-first and is read synchronously. Empty state directs users to Foods → My Meals. Existing sync progress/errors are presented without hiding local meals or claiming a separate remote meal-loading contract. Active My Meals results refresh on existing sync notifications and library updates without rebuilding the entry form.

## Changed inventory

- `js/lee-lee-diabetes-tracker.js`: quick-access option, meal-only filtering, panel states, repeat-add label, panel retention, and refresh integration.
- `tests/browser/llt-issue-20.spec.js`: synthetic New/Edit/standalone, totals, snapshot/quantity semantics, combinations, removal, rapid/intentional repeats, cancel/reopen, unchanged persisted data, and empty/search coverage.
- `tests/llt-issue-20.test.js`: local-first sync progress/error presentation.
- `tests/lee-lees-tracker-reporting.test.js`: three stale pre-Issue-19.1 assertions now verify native dialog markup.
- `package.json`: includes new unit/syntax checks.
- `docs/architecture/llt-issue-20-my-meals-carb-calculator.md`: implementation and release evidence.

## Validation

- Relevant storage/reporting/sync and Issue #20 unit tests: **305 passed**.
- Final combined desktop Chromium feature/search/Issue #19.1 suite: **16 passed**.
- Mobile Chromium feature/search/Issue #19.1 suite: **16 passed**.
- iPhone 13 WebKit feature and Issue #19.1 suite: **9 passed**; final accessible-label feature rerun: **5 passed**.
- Isolated desktop Chromium Issue #19.1 repeated three times: **12 passed**; unchanged-main comparison: **12 passed**.
- `npm run check:js`, new-file syntax checks, and `git diff --check`: passed.
- Production Pages artifact build: passed using synthetic build metadata, not a production deployment claim.
- Synthetic iPhone WebKit screenshot inspected: three shortcuts fit and a selected meal remains one row.

Two earlier combined Chromium runs intermittently restored New Entry scroll 21 px below the expected value. This was retained as a test observation, not silently weakened: final combined suite and 12 repeated isolated viewport checks passed. No modal, scroll-lock, viewport, safe-area, focus-restoration, or clinical functions were changed. Physical iPhone acceptance remains required.

The three outdated unit assertions also failed on unchanged main (300 passed / 3 failed). Only their expected modal markup was corrected to match Issue #19.1's native dialog; the baseline evidence is in the session logs.

## Release tracking

- Verified starting local/remote main: `42545678aa1fc8214e323b6b0b5f47a66e6c6649`.
- Branch: `feature/llt-issue-20-my-meals` in an isolated managed worktree.
- Implementation commit: `4869150585b03914a2de1a8d1f18be9fa053430d`.
- PR: https://github.com/RolandoBernal/landos-world/pull/156 (open and mergeable; base remains the verified starting main).
- Required CI: GitHub reports no checks for the PR; main has no branch protection or rulesets. Local test/build evidence is listed above; absent CI is not presented as a passing CI run.
- Merge SHA: **not created**. Automatic approval review rejected the merge because it triggers production and did not recognize the attached brief as trusted direct merge authorization. Direct confirmation in chat is required before retrying.
- Deployed release: **Issue #20 not deployed**. The latest successful Pages run observed was `39361847104` for starting main `42545678aa1fc8214e323b6b0b5f47a66e6c6649`; this is not an Issue #20 release verification.
- Preview: http://127.0.0.1:55960/#/lee-lees-tracker (isolated local-device development, with the served calculator JavaScript byte-compared to the feature source).
- Existing GitHub Actions Pages workflow is the only production deployment path.
- iPhone acceptance: **PENDING Rolando's physical-device PASS**. Browser automation does not constitute physical acceptance.

## Physical iPhone acceptance

Update through the installed PWA's normal updater / Settings → Application Status. Confirm the released version, then:

1. New Entry → Open Carb Calc → My Meals: existing meals appear with correct totals.
2. Add one meal: one Selected Items row; total correct; Use X g transfers the expected carbs.
3. Repeat from Edit Entry; preserve other unsaved fields.
4. Verify repeated opening, top positioning, internal scrolling, keyboard dismissal, and underlying form position.
5. Confirm Favorites, Recent, and Cancel still work.

Do not clear user storage, reinstall, or bypass the updater. The issue remains pending acceptance until Rolando confirms PASS.

## Recovery

Risk: LOW; presentation/discovery changes over existing saved-meal selection. Previous known-good main is the starting SHA above. If needed, revert the eventual Issue #20 merge commit using `git revert -m 1 <merge-sha>` on a fresh fix branch, validate, and release that revert through a reviewed PR and the same Pages workflow. Never reset or migrate user data for rollback.
