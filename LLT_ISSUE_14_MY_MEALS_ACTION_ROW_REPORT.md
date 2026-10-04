# LLT #14 — Saved My Meal card action-footer correction

## Scope correction and branch audit

This report replaces the earlier #14 interpretation. The actual target is the saved My Meal card in Foods → My Meals, with meal information above a full-width Favorite / Edit / Delete footer. The earlier QTY / ITEM / CARBS / TOTAL calculator-row interpretation was incorrect.

Branch: `fix/llt-my-meals-action-row` (continued as requested).
Starting main: `e9e3dacaa3267f3ab1204ac3d993190e7e79504e`, shipped #13 merge. Initial fetch confirmed local main and origin/main equality. No new branch or commit was created during correction.

The complete tracked diff against main was audited before cleanup. All previous branch-only changes to calculator columns, name wrapping, 44px pencil/trash targets, responsive rows/labels, and icon focus styling were solely for the wrong interpretation. They were removed. The associated reporting unit-test assertion was restored exactly to main. Both files now have no diff against main. The earlier untracked #14 browser spec was replaced with saved-card coverage; none of its mistaken item-row tests remain. The existing report was rewritten in place. No whole-branch reset was used.

Unrelated existing diagnostic reports and `death-on-notecards/` remain untouched.

## Actual regression and root cause

Reference card content: “Morning fruits”, “67 g carbs”, and “🧃 100% Fruit Juice · 🍎 Apple · 🍌 Banana”, followed by a star, Edit, and Delete.

`renderSavedMealLibraryRow()` already renders semantic sibling regions in the correct order:

1. `div.lee_lee_diabetes_food_item_content`
2. `footer.lee_lee_diabetes_food_item_footer`, containing the action flex row and right-side Edit/Delete group.

However, its article only used `.lee_lee_diabetes_food_item`. The generic food-item rule supplies `display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center`. Thus the footer occupies the second column beside the content at desktop/tablet widths. Its own divider spans only that detached action region. A generic max-420px rule collapses food items to one column, masking the defect on narrow phones.

My Foods already applies `.lee_lee_diabetes_food_item--library`, whose later rule supplies a single `minmax(0, 1fr)` column, stretched alignment, and existing card spacing. Saved meals omitted that layout class.

Git blame/history: the generic saved article originated in `f3f16ee2`; the saved-meal footer/action markup was added in `65a19209` on September 29. The existing library-card layout class was introduced in `539a90a1` on September 5. The footer was added without opting the card into that existing single-column layout. #11 typography did not cause the missing class.

Relevant selectors are `.lee_lee_diabetes_food_item`, `.lee_lee_diabetes_food_item--library`, `.lee_lee_diabetes_food_item_content`, `.lee_lee_diabetes_food_item_footer`, `.lee_lee_diabetes_food_item_actions`, and `.lee_lee_diabetes_food_item_actions_right`.

Cascade: generic and library class selectors have equal specificity; the library rule appears later and supplies the intended one-column layout. The max-420px generic rule also specifies one column, so both agree on mobile. No desktop media rule turns library cards into two columns. The existing footer border/padding and flex action group then stretch across the content width. No conflicting saved-card duplicate selector was found. The duplicate calculator item-editor footer rules are complementary surface/layout declarations, unrelated to this regression, and remain untouched.

## Exact final fix

Add the existing `lee_lee_diabetes_food_item--library` class to the saved-meal article in `renderSavedMealLibraryRow()`.

This is one production markup-class change. No new CSS, selector override, `!important`, button markup, or interaction code is needed. The class has one existing layout rule. It is appropriate for the same content-plus-footer structure already used by My Foods.

The name, carb total, emoji summary, separators, typography, colors, background, border, radius, and destructive styling remain unchanged. Favorite remains an icon-only star on the left; Edit/Delete remain text controls grouped at the right. The divider spans the card's inner content/footer width. Content wraps naturally and the footer stays below it at all widths.

Desktop (1280px), tablet (768px), iPhone (320/393px), and mobile landscape (852×393): all retain content → divider → footer. Short names remain compact; long meal names and nine-component food summaries wrap safely. Tests include a 1234.5g total, Favorite off/on, and no horizontal document/card overflow. Existing touch-target sizes and button treatments are preserved; the discarded 44px calculator changes are not part of this fix.

## Actions and accessibility

Favorite: star toggles from ☆ to ★; accessible name changes from “Favorite meal” to “Remove meal favorite”; `aria-pressed` changes to true; local saved meal favorite state is verified. No handler/persistence changes.

Edit: opens the existing meal builder for the correct meal, with “Morning fruits” and 67g intact. Cancel returns without modifying it. No editing/creation logic changes.

Delete: retains `window.confirm('Delete Morning fruits?')`. Dismiss keeps the card; accept removes only that card from the active list and records the existing soft-delete timestamp. The other meal remains. Total carbs remain 67 in the persisted deleted fixture.

Semantic content precedes footer. Keyboard order remains star → Edit → Delete. Existing Edit focus outline is visible during keyboard Tab navigation. All controls are reachable through actual browser interactions; no accessible names or action attributes changed.

## Regression review

- My Foods: direct runtime fixture verifies content/footer hierarchy and visible Edit/Delete. Its renderer and CSS are unchanged.
- Favorites and Recent: direct runtime verifies the unchanged food appears in both calculator pickers.
- Search: searches for the safe fixture and adds it; existing focused-input/filtering regression also passes.
- Carb Calculator: added food still totals 12.5g with existing pencil/trash controls. Existing explicit-row editing and scroll-owner regressions pass.
- Manual amounts: add 5g, verify 17.5g combined total, remove it, verify 12.5g.
- Foods accordions: existing one-at-a-time scenario passes.
- New Entry: calculator exercised through Log Entry. Edit Entry shares unchanged calculator CSS/renderer; no historical clinical save was performed in this correction.
- My Meals builder / QTY-ITEM-CARBS-TOTAL rows: no intentional redesign; all wrong-scope code and assertion changes reverted. The saved-card Edit action opens the original builder.

The calculator My Meals picker renders a separate selection button rather than this editable saved-card article; it remains unchanged. #12 architecture/navigation work remains out of scope and untouched.

## Final files

1. `js/lee-lee-diabetes-tracker.js`: one saved-card class addition.
2. `tests/browser/llt-my-meals-action-row.spec.js`: corrected saved-card responsive/runtime coverage and neighboring-interface checks.
3. `LLT_ISSUE_14_MY_MEALS_ACTION_ROW_REPORT.md`: this corrected report.

`css/lee-lee-diabetes.css` and `tests/lee-lees-tracker-reporting.test.js` exactly match main again. Temporary baseline/shared test adapters were removed after verification.

## Current validation results

- `node --test tests/lee-lees-tracker-storage.test.js tests/lee-lees-tracker-reporting.test.js tests/lee-lees-tracker-sync.test.js tests/lee-lee-pre-meal-timer.test.js`: **244 passed, 0 failed**, freshly run after correction.
- `LANDOS_WORLD_SMOKE_BASE_URL=http://10.0.0.160:8000 npx playwright test tests/browser/llt-my-meals-action-row.spec.js`: **12 passed, 0 failed (9.0s)**. Ten saved-card cases (five widths × Chromium/mobile Chromium) plus two neighboring-interface cases. These counts come from the corrected suite, not the earlier implementation.
- Four existing Foods/calculator browser scenarios through a temporary safe-local adapter: **4 passed, 0 failed (8.8s)** — Foods accordions, Food Search input filtering, one body scroll owner, explicit row editing. Adapter only omitted the mock-auth helper's rejection of local-device metadata; application runtime remained unchanged.
- `npm run check:js`: passed. New focused spec also passed `node --check`.
- `git diff --check`: passed. Full production diff reviewed; staged diff empty.
- Runtime screenshots inspected at 320, 393, 768, 1280, and 852×393. The corrected “Morning fruits” card visually has a full-width divider/footer and no side action panel. Screenshots are `/tmp/llt14-saved-card-chromium-<width>.png`.
- Baseline proof: final saved-card test served exact `git show main:js/lee-lee-diabetes-tracker.js` in a fresh safe-local context at 1280px. It fails `below=false` and `fullWidth=false`, confirming unchanged main reproduces the desktop regression. All other geometry assertions remain true. This intentional baseline failure is the bug fixed by #14.

No new #14-attributable failures remain. Initial test setup incorrectly clicked an already-open My Meals accordion and used manual components that intentionally strip emojis; setup was corrected to preserve open state and use food snapshots. A neighboring test initially used the wrong search-input selector; the final test uses the real `carbFoodSearch` field. No app changes were made for these test errors.

The previous report's comprehensive builder `Not Now` timeout and older My Foods `Remove favorite` locator timeout were reproduced against main during the earlier run. Those two legacy scenarios were not rerun during this correction, so their present status is not newly claimed. The current selected shared scenarios pass. No unrelated baseline test infrastructure was changed.

## Data safety and workspace

No calculations, quantities, insulin/clinical rules, persistence contracts, schema, migrations, sync, Supabase, authentication, timers, reports, or navigation changed. Test Favorite/Delete writes occur only in disposable isolated browser contexts on the safe preview. No production data is used or reset.

Branch remains `fix/llt-my-meals-action-row`, with only the three scoped files above changed/untracked. Unrelated pre-existing untracked reports and `death-on-notecards/` are preserved. At pre-ship review, nothing was staged or committed. Rolando explicitly authorized commit, push, PR, merge, automatic Pages deployment verification, and local main synchronization in the October 3 shipping prompt. #12 remains untouched.

## Safe iPhone preview and checklist

Existing supported preview remains running: `node scripts/dev-iphone.mjs --port 8000`.
Exact URL: http://10.0.0.160:8000/#/lee-lees-tracker
The served `/.local/landos-world-build-metadata.js?v=local-device` confirms `environment: local-device`, this branch, and the unchanged starting commit with dirty source identity. Authentication and production sync are disabled; browser storage is isolated by origin. Use Safari on the same trusted Wi-Fi and confirm LOCAL DEV.

On iPhone: open Foods → My Meals, create/use a local test saved meal, then inspect its saved card (not the calculator item table). Verify name/carbs/summary, natural wrapping, a full-width divider below content, star left, Edit/Delete right, no side panel/dead space/clipping/horizontal scrolling. Toggle Favorite, open/cancel Edit, cancel then confirm Delete on a disposable test meal. Check a long saved meal and neighboring Foods/calculator interfaces. Final physical-iPhone verification: PASS, confirmed by Rolando in the October 3 shipping authorization. The verified UI is feature-frozen.

## Shipping sanity — October 3

Remote fetch reconfirmed local main and origin/main at the starting SHA. Only the saved-card layout class, corrected focused tests, and this report will be staged. Wrong-scope CSS and unit-test changes are absent. Fresh shipping validation: 244 LLT unit tests, 12 focused browser tests, and four shared regressions passed; JavaScript syntax/static checks and diff checks passed. The known broader baseline failures were not rerun. No post-iPhone-verification UI changes were made. The safe preview responds on the required port 8000. Existing tracked #11/#13 reports establish this report as a repository artifact.
