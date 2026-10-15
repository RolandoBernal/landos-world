# LLT Item #12 — Phase C physical iPhone UX refinements

October 15, 2026. `feature/llt-shared-carb-calculator`, uncommitted work based on `40f67800dd47e1074e06fd2107ebd37a0bdff643`. All five requested changes are implemented locally. Physical-device acceptance remains pending. This report supersedes the corresponding search-reset, result-list, source-section, and two-line-action descriptions in the earlier Issue #12 reports.

## Five completed actions

1. **Successful additions reset search.** Reference foods, My Foods, and My Meals use the shared successful-add completion path. It clears the input and active discovery list, removes results, and blurs the active calculator control to request keyboard dismissal. It preserves selected rows and never explicitly scrolls to Selected Items. Missing/failed selections retain their query. Opening and canceling Manual Amount retains the preceding query in both contexts. Search input identity remains stable during successful selection; it can immediately be used again. Actual iOS keyboard dismissal remains a physical-device check.
2. **Favorites/Recent toggle and stay bounded.** Each shortcut toggles open/closed, closes the other, and reports its state through `aria-pressed`/`aria-expanded`. Typing closes shortcuts; clearing the query returns to neutral; successful selection closes the list. The results region is keyboard focusable. Only these shortcut lists use a responsive `min(24rem, 45dvh)` height limit, approximately four or five normal result cards on a portrait phone; shorter viewports show fewer. The shortcut controls sit outside this local scroll area. All favorites/recent matches are rendered rather than cutting off after the search limit. Ordinary search keeps its existing page/modal-body scroll behavior and refine-search limit. The Foods switcher remains in normal document flow.
3. **Manual Amount repaired, live total added.** Intrinsic grid rows and start alignment keep each label/input together, with Quantity and optional Label sharing a row except at the smallest width. Inputs use 44px minimum height. The live Total Carbs preview validates incomplete/negative amounts and invalid quantities, and disables Add/Save for invalid values. It uses the same per-unit normalization and shared row multiplication/formatting as item saving, including the existing two-decimal normalization before multiplication. Quantity starts at 1; labels remain optional; Cancel preserves existing rows; Add returns the correct total to the originating calculator.
4. **Repeated source sections removed.** The main calculator no longer emits Preparation & Source Details blocks beneath Total Carbs. Source/serving/brand snapshots, food metadata, library records, component persistence, and existing library item editing/details remain untouched. Useful serving/source text stays in compact item rows. Save as My Meal remains available.
5. **Production compact table restored.** QTY, ITEM, @, CARBS, TOTAL, and directly visible edit/delete actions share the existing six-column grid/subgrid. Actions no longer occupy a second full-width row. Food emojis, serving/source sublines, labels, quantities, unit carbs, and line totals use the existing row renderer. Names/subline text truncate within their column instead of overlapping adjacent values; full item names remain in accessible action labels. Shared actions retain 44×44px targets. Both entry points use this same renderer.

## Manual form root cause and evidence

The item editor body, form, secondary-field group, and generic field labels were nested CSS grids with normal stretch/content alignment. The calculator allocates its body through a `minmax(0, 1fr)` track inside the viewport-constrained shell. Spare block space could therefore stretch nested auto rows and separate a field label from its control. This was layout distribution, not missing content or excessive explicit margins.

The fix gives these item-editor grids start alignment and intrinsic `max-content` auto rows. It leaves the existing visual-viewport sizing, scrollable body, page lock, and in-flow actions intact. No keyboard-overlapping fixed footer or arbitrary spacing offset was introduced.

A browser comparison loaded the exact pre-Phase-C stylesheet from the saved baseline against the same current markup. At 390×844, its three label-to-input gaps measured **119, 82, 82px**; the repaired stylesheet measured **8, 8, 8px**. Comparison screenshots: [before](/tmp/llt-phase-c-manual-before.png), [after](/tmp/llt-phase-c-manual-after.png). Browser measurements confirm this CSS mechanism; actual Safari keyboard behavior still needs device acceptance.

## Production reference and responsive tradeoff

The attached production iPhone screenshot is the visual authority. The existing production renderer and stylesheet were also identified in repository `HEAD` (`40f6780`): `renderCarbCalculatorRow()`, `.lee_lee_diabetes_carb_calc_grid`, `.lee_lee_diabetes_carb_calc_row`, item-name/subline ellipsis, and inline `.lee_lee_diabetes_carb_calc_actions`. Phase C reuses that implementation and removes the prior local two-row action override, rather than creating an action menu or replacement component.

At ≤520px, the same six columns receive tighter gaps/type and content-based numeric/action columns. At 320px, long names and secondary text have less visible space; they truncate like the approved production screenshot while numeric values and actions remain separate. Shared 44px targets occupy more width than the older production 30px mobile icons; this is the deliberate touch-target tradeoff. No horizontal page overflow was observed at 320/390/768/1280px.

## Files changed in Phase C

- `js/lee-lee-diabetes-tracker.js`: shared add completion, toggling/bounded-list semantics, retained canceled-search context, removed source markup, manual preview/validation.
- `css/lee-lee-diabetes.css`: intrinsic item-editor grid flow, bounded shortcut results, restored inline selected-item layout.
- `package.json`: syntax-check the new Phase C browser suite.
- `tests/browser/llt-calculator-phase-c.spec.js`: new cross-mode coverage and requested screenshots.
- `tests/browser/llt-calculator-unified-search.spec.js`: retain input identity while asserting the newly required successful-add reset/blur.
- `tests/browser/llt-shared-carb-calculator.spec.js`: optional-label accessible name and disabled invalid Save behavior.
- `tests/browser/llt-my-meals-action-row.spec.js`: current unified-discovery selectors and optional-label name; existing card/footer assertions retained.
- `tests/browser/landos-world-smoke.spec.js`: reset/blur expectations, bounded shortcut-list scroll assertions, keyboard-focusable results region, selected-table assertions kept scoped to that table.
- This report.

Earlier uncommitted Phase B/refinement files and unrelated reports were preserved. No staging occurred. The shared arithmetic engine, clinical dosing algorithms, historical-plan verification, auth/sync contracts, bottom navigation, switcher, schema, and production data were not changed.

## Validation and test outcomes

- **549 unit tests passed**, zero failures (`/tmp/llt-phase-c-verified-unit.txt`).
- JavaScript syntax checks and `git diff --check` passed; staged diff is empty.
- **48 calculator/navigation cases passed** across desktop/mobile Chromium: 16 new Phase C, 14 unified search, 6 shared sessions, 12 Foods navigation. The final manual-preview precision cases were rerun separately after adding normalization coverage.
- **42 Low Glucose cases passed**, including initial/embedded-recheck calculator paths and no accidental clinical persistence.
- **26 selected protected-entry smoke cases passed across final runs**: 22 in the final group and four bounded-scroll/selected-table reruns. Historical factual edits, Plan A snapshots, missing-plan restrictions, drafts, visual-viewport offsets, page locks, focus, and scroll restoration remain covered.
- **12 saved-meal/neighboring-food presentation cases passed** on their required local-device preview.

These are **128 distinct selected browser cases**, with focused reruns counted once. The full repository browser suite was not run. Existing Phase B baseline failures involving legacy carb-guidance text and a missing `Not Now` action remain documented in the earlier report; this phase does not claim those scenarios pass.

Intermediate failures were resolved rather than suppressed: the quantity input's early event return initially skipped preview updates; canceled standalone manual entry initially lost its query; older tests expected a focused populated search after selection, allowed clicks on now-disabled invalid saves, or assumed unbounded shortcut lists. Those assertions were updated only to match explicitly approved behavior, preserving totals, persistence, keyboard, and clinical checks. A test expectation initially assumed one-decimal carb normalization; source inspection confirmed the existing two-decimal rule, and precision coverage now checks the actual rule without changing it.

Some protected smoke runs were invalidated by shared development metadata being overwritten as `local-device` by simultaneous preview requests/unit tooling. Those checks were rerun without concurrent device-preview requests. The saved-meal layout suite initially ran against the wrong server type; its final run used the required local-device preview. These environment failures do not establish application regressions.

## Visual evidence

Requested artifacts are captured for both calculator entry points. Representative review images:

| State | Screenshot |
| --- | --- |
| Search before selection | [Before](/tmp/llt-phase-c-review/search-before.png) |
| Search after successful selection | [After](/tmp/llt-phase-c-review/search-after.png) |
| Favorites open / closed | [Open](/tmp/llt-phase-c-review/favorites-open.png), [closed](/tmp/llt-phase-c-review/favorites-closed.png) |
| Recent open / closed | [Open](/tmp/llt-phase-c-review/recent-open.png), [closed](/tmp/llt-phase-c-review/recent-closed.png) |
| Manual portrait / landscape | [Portrait](/tmp/llt-phase-c-review/manual-portrait.png), [landscape](/tmp/llt-phase-c-review/manual-landscape.png) |
| Manual reduced viewport | [Simulation](/tmp/llt-phase-c-review/manual-short-viewport.png) |
| Standalone dark, mixed rows and total | [Standalone](/tmp/llt-phase-c-review/selected-standalone-dark.png) |
| Entry light, mixed rows and total | [Entry](/tmp/llt-phase-c-review/selected-entry-light.png) |
| Narrow long-name table | [320px](/tmp/llt-phase-c-review/selected-narrow.png) |

Full screenshots/traces are in `/tmp/llt-phase-c-complete-results/`, `/tmp/llt-phase-c-reviewed-results/`, and `/tmp/llt-phase-c-manual-final-results/`. A reduced viewport/focused input is a keyboard-layout simulation, not a captured native iOS keyboard.

## Preview and physical iPhone acceptance

**iPhone: http://10.0.0.160:8000/#/lee-lees-tracker**

**Mac: http://127.0.0.1:8000/#/lee-lees-tracker**

Use the same reachable local network as the Mac. Open Foods → Carb Calc for standalone, or New/Edit Entry → Carb Calculator. The development origin disables production auth/sync and uses isolated browser data. It does not automatically contain production saved meals. Preview listeners remain on port 8000.

1. Search/add a reference food, custom food, and saved meal: input clears, results close, keyboard dismisses, rows persist, no forced jump to Selected Items; repeat immediately.
2. Open/close Favorites and Recent repeatedly. Switch between them, type/clear a search, and add from each. With a large list, swipe within it, reach the last item, then swipe the surrounding calculator. Check VoiceOver and keyboard focus. If real Safari/PWA gestures conflict, replace local scrolling with bounded Show More/Show Less after that evidence.
3. Manual Amount: labels/input grouping, default quantity 1, decimal/quantity live preview, invalid values, optional label, Cancel, Back, and Add. Test portrait/landscape and the real keyboard opening/closing with focus on each field; actions must remain reachable and values retained.
4. Inspect several short/long food, meal, and manual rows. Edit quantity/delete each; compare unit, line, and running totals. Verify inline actions, touch targets, truncation, light/dark, and no horizontal overflow.
5. Confirm no repeated source sections beneath Total Carbs; serving/source sublines and existing library item details still work. Explicit Save as My Meal must still create the intended reusable meal.
6. Verify switcher/headings, normal scrolling and bottom-nav clearance remain correct. Scratch Clear/Done must stay isolated. In a disposable entry draft, Cancel preserves facts and Apply returns only carbs/components without saving. Confirm historical-plan restrictions using disposable fixtures, not real clinical data.

**Implemented and software-tested:** all five action items and both session contexts. **Awaiting physical verification:** real iOS keyboard dismissal, Safari/PWA nested gestures, safe areas, touch feel, and VoiceOver. No production PWA/offline/update claim is made from this preview. No action item was deferred. Next step is user physical acceptance; commit/push/PR/deployment remain unapproved.
