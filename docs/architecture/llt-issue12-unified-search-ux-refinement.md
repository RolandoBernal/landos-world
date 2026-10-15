# LLT Item #12 — Unified search and navigation refinement

October 14, 2026 · `feature/llt-shared-carb-calculator` · local changes only.

This report supersedes the sticky-switcher, separate-search, and dropdown descriptions in the earlier Phase B/B.1A reports. No staging, commit, push, merge, deployment, schema migration, or production-data action was performed.

## 1. Summary

Refined the existing shared calculator. Standalone and entry mode now use one inline food/meal search, lightweight Favorites/Recent shortcuts, manual amounts, compact selected rows, and the existing totals/session actions. Standalone headings follow the selected Foods tab. Scratch and clinical-entry sessions remain isolated.

## 2. Files

Modified in this refinement:

- `js/lee-lee-diabetes-tracker.js`: shared rendering/search/results, saved-meal snapshot rows, dynamic heading, subview focus, and visual-viewport handling.
- `css/lee-lee-diabetes.css`: normal-flow switcher, supporting text, search/result styles, and responsive compact table.
- `package.json`: syntax-check the new browser test.
- `tests/lee-lees-tracker-reporting.test.js`: generated markup, unified discovery, and immutable meal tests.
- `tests/browser/llt-shared-carb-calculator.spec.js` and `llt-foods-navigation.spec.js`: adapt discovery/navigation expectations.
- `tests/browser/landos-world-smoke.spec.js`: migrate old dropdown/separate-search interactions while retaining calculation, historical-plan, focus, and scrolling assertions.

Added `tests/browser/llt-calculator-unified-search.spec.js` and this report. Earlier Phase B runtime integration remains in the working tree. The shared engine `js/lee-lee-carb-calculator.js` is byte-for-byte unchanged from the pre-refinement snapshot. Unrelated dirty reports/files were left untouched.

## 3. Switcher overlap root cause

The segmented control used `position: sticky`, a fixed 44px navigation assumption plus safe-area offset, and a stacking level. During scrolling it could paint over subsequent content; nested application chrome and mobile viewport changes made a fixed offset unreliable. There was no requirement to keep it pinned. It now uses normal document flow, with no sticky top offset or special stacking level. Its layout position remains ahead of the active panel throughout scrolling. Existing equal segments, selected state, 44px targets, keyboard tab semantics, and bottom safe-area clearance remain.

Tradeoff: the switcher scrolls offscreen with the page; return to the top to change destinations. No arbitrary replacement offset was introduced.

## 4. Dynamic headings

Foods displays Food Library / Foods / Saved on this device. Carb Calc displays Carb Calculator / Calculate carbs without logging an entry. The application identity remains Lee-Lee’s Tracker. Standalone main has one page heading and no redundant internal title/Back header. Manual/item subviews retain their appropriate title and Back navigation; entry calculator retains its dialog header.

## 5. Unified search

One labeled search input finds existing reference foods, custom foods, and saved meals. It reuses the existing case-insensitive partial/token matching and excludes deleted items. Results identify FOOD · Reference, FOOD · My Foods, or MEAL · My Meals. Results are deduplicated by entity type and ID, bounded to 40 visible matches with a refine-search hint, and rendered in the current calculator body. Empty queries offer shortcuts; unmatched queries retain Add New Food. No internet food search was added.

Typing and selecting a result update results/selected items in place, retaining the original search input, query, focus, and entry draft. There is no separate search modal, required library screen, or calculator collection dropdown.

## 6. Verified My Meals representation and calculations

`trackerData.savedMeals` is the local source, with the existing food-library synchronization queue and saved-meals payload contract. `normalizeSavedMeal()` derives totals from component snapshots when components exist; total-only meals retain their entered total. Components already carry their individual quantities and carbohydrate totals. Meals have no recipe yield/serving-count field. A meal total therefore means the saved amount, not an inferred serving or recipe fraction.

Selecting a meal creates one temporary row containing a frozen normalized total and label. Quantity 1 means one saved amount; quantity 2 means two copies. A 68g meal becomes 136g at quantity 2. Its ingredient quantities are already incorporated and are not expanded/countable again. Editing a selected meal changes its quantity, not its frozen base amount. Remove deletes only that calculator row. Repeated selection of the same unchanged meal combines quantity; a later changed total does not rebase an earlier selection.

Applying uses the existing labeled manual carbohydrate-component snapshot representation for a meal row, with its multiplied `carbTotal`. No new persisted clinical fields or live meal references are introduced. Historical reopening displays that labeled frozen amount as a manual snapshot; it does not reconstruct a mutable recipe. Selecting/applying does not edit the saved meal, and later library edits cannot silently recalculate existing clinical records.

## 7. Favorites and Recent

With an empty query, two lightweight shortcuts expose Favorites and Recent. Favorites includes foods and meals, using existing flags. Recent uses the existing food `lastUsedAt` behavior. Saved meals have no persisted recent-use field, so meal recency was not invented. My Foods/My Meals management remains under Foods; adding four prominent controls was unnecessary.

## 8. Dropdown capability mapping

| Previous dropdown capability | Current access |
| --- | --- |
| Favorites | Empty-search Favorites shortcut; existing favorite controls |
| Recent | Empty-search Recent shortcut, existing food recent-use data |
| My Foods | Unified search; Foods → My Foods management |
| My Meals | Unified search; Foods → My Meals management |
| Reference foods | Unified local search, existing source/preparation details |
| Add New Food | Empty-result action and existing Foods creation flow |
| Save as My Meal | Existing explicit calculator save action for reusable selections |

Saving a reusable meal now searches for its saved name afterward so the created result remains discoverable. Collection storage, food/meal creation, favorite changes, soft deletion, and sync contracts remain intact.

## 9. Manual Amount

Add Manual Amount remains available in both contexts. Optional label, quantity, decimal precision, validation, Cancel, Back, Add Item, and editing use the existing shared rules. It creates a scratch row, not a clinical record or reusable food. Persistence requires the existing explicit save action. The internal main title was removed only from standalone main, not necessary subview navigation.

## 10. Selected items

QTY | ITEM | @ CARBS | TOTAL remains a compact table. Names/source labels wrap to stay identifiable. Narrow layouts put 44px edit/remove targets on a second row beneath the numeric/name columns; larger layouts keep actions alongside them. Food, meal, and manual rows share totals/precision. Selected Items and Total Carbs remain explicit. There is no horizontal page overflow in the tested widths.

## 11. Automated results

- `npm test`: 549 passed, zero failures.
- `npm run check:js`: passed.
- `git diff --check`: passed; no staged changes.
- Focused browser acceptance: 74 passed across desktop/mobile Chromium (14 unified-search, 6 shared-calculator, 12 Foods-navigation, 42 Low Glucose cases).

Additional legacy smoke results are recorded below after final reruns. The entire repository browser suite was not run.

## 12. Browser/mobile evidence

Coverage includes 320/390/768/1280px layouts, both themes, top/middle/bottom switcher flow, keyboard tab navigation, unique headings, reference/custom/meal search, empty queries, favorites/recent, meal quantity/edit/remove, combined totals, immutable saved meals, no automatic clinical writes, entry-note preservation, scratch/entry isolation, and simulated reduced visual viewports. Entry uses the existing single modal-body scroll owner and page lock; standalone main remains normal page flow. Result selection retains search input identity/focus.

Browser viewport simulation is not physical iPhone or Safari verification. Real iOS keyboard, safe-area behavior, and VoiceOver acceptance remain pending.

## 13. Remaining limitations

No deferred schema, insulin algorithm, authentication, synchronization, or production change is bundled here. Recent meals remain unsupported because no such stored field exists. Selected meals reopen historically as labeled frozen amounts under the existing component contract. The switcher intentionally scrolls with content. PWA/offline/release-updater behavior is outside this development preview. Legacy smoke failures must be distinguished from the passing focused acceptance tests; see final rerun notes below.

## 14. Exact preview

Physical iPhone: **http://10.0.0.160:8000/#/lee-lees-tracker**

Mac: **http://127.0.0.1:8000/#/lee-lees-tracker**

Open Foods → Carb Calc. The Mac currently uses en0 `10.0.0.160/24`; the previous `172.22.19.198` listener was stopped and replaced on fixed port 8000. Served tracker JavaScript and CSS were compared byte-for-byte with current working files. Both devices must use the same reachable local network. The development origin has production auth/sync disabled and its own browser data; it does not contain production saved meals automatically. Preview listeners are left running.

## 15. Physical iPhone checklist

1. Open the exact preview and verify LOCAL DEV. Under Foods, switch Foods/Carb Calc: headings, equal touch targets, selected state, single title, both themes.
2. Scroll top/middle/bottom with several selected items: no switcher overlap, horizontal overflow, or bottom-nav obstruction. Return to top to switch tabs.
3. Create a disposable custom food and saved meal in this development origin. Search partial/mixed-case names plus a reference food; inspect FOOD/MEAL labels and the saved-amount unit.
4. Add a saved meal, edit quantity to 2, combine food/manual amounts, remove it, and confirm totals. Confirm the original saved meal is unchanged.
5. With the real search keyboard open, type, scroll results, select repeatedly, clear query, and dismiss/reopen keyboard: no lost focus, hidden controls, jump, or state loss.
6. Add Manual Amount: optional label, decimals/quantity, invalid and blank input, Cancel/Back/Add Item; verify numeric keyboard and return behavior.
7. Edit/remove long-named selected rows at narrow width; check all quantities, unit carbs, totals, and touch targets.
8. Leave/resume standalone through tabs and bottom navigation; verify Clear resets only scratch and Done returns to Foods.
9. In a disposable New/Edit Entry draft, verify calculator Cancel preserves fields; Apply changes only intended carbs/components and does not save. Check historical entries retain plan restrictions. Do not modify real clinical data for this test.
10. Verify screen-reader labels/focus order, light/dark, landscape, and safe areas on the actual device. Report acceptance or remaining screenshots before any release work.

## Final regression notes

The final focused legacy regression group passed **26/26** desktop/mobile Chromium cases on a fresh isolated server (`/tmp/llt-ux-final-regression.txt`). This adds historical snapshot/Plan A preservation, missing-plan save restrictions, Foods accordions, total-only meal creation/validation, search focus containment/input identity, favorites, meal-row editing, page locks, one scroll owner, explicit selected rows, and simulated visual-viewport offsets/resizing. Combined with the 74-case acceptance group, **100 selected browser cases passed**.

Older tests were migrated to inline-search equivalents, including the former separate-search body's geometry assertions. The main entry calculator now follows the same visual viewport as its search input, so its keyboard-open center is asserted against the mocked keyboard viewport rather than the entire window. Single-scroll-owner, input visibility, backdrop bounds, focus, and restored-page-scroll assertions remain. No clinical assertion was removed to obtain a pass.

Two broader legacy scenarios remain unsuccessful in both browser projects: `Lee-Lee Food Library builds carb totals and saves historical snapshots` reaches its existing `Carb coverage: 84 g` guidance expectation; `Lee-Lee My Meals builder creates, edits, favorites, quick-uses, and soft-deletes saved meals` waits for the missing `Not Now` action. These match the unchanged-main failures already established and recorded in the Phase B report. Their clinical assertions were retained; this refinement does not claim these four cases pass or the full browser suite is green. Earlier intermediate runs also encountered stale discovery selectors and local-device metadata contamination; final focus/layout/historical reruns passed on a fresh test server.

Validation logs: `/tmp/llt-ux-final-unit.txt`, `/tmp/llt-ux-syntax.txt`, `/tmp/llt-ux-acceptance.txt`, `/tmp/llt-ux-final-regression.txt`. Browser artifacts and light/dark screenshots: `/tmp/llt-ux-acceptance-results/`. Physical iPhone/Safari and VoiceOver remain implemented-but-unverified acceptance work. No implementation is blocked; no release action is authorized.
