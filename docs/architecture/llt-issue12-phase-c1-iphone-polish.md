# LLT Item #12 — Phase C.1 iPhone UX polish

October 15, 2026. Branch `feature/llt-shared-carb-calculator`. Implementation snapshot, followed by physical iPhone acceptance PASS and explicit production release authorization from Rolando on October 15, 2026. Current release preparation/verification is recorded in `llt-issue12-production-release.md`. No staging, commit, push, PR, merge, deployment, migration, or production-data operation occurred.

## Changes

**Favorites/Recent outside-tap dismissal.** Intentional activation outside the open list and its shortcut controls closes the list. The intended search, manual-entry, edit/delete, or navigation action still receives the first tap. Focusing Search also closes the list immediately without replacing the input. Existing toggle/switch behavior and successful-add query clearing remain intact. Intermediate manual/item and Add New Food editors are explicitly excluded from result-panel dismissal, preserving unfinished inputs.

**Manual Amount spacing and entry-only centering.** Both modes use one shared form and spacing token derived from `--llt-field-group-gap`. The header has matching divider clearance; the body has real top/bottom padding instead of its previous 0.05rem top inset; field-group gaps, total-summary padding, and action-area padding follow the same rhythm. The existing fields, 44px inputs, validation, two-decimal normalization, preview, Cancel/Add behavior, and compact field grouping are unchanged.

The entry modal's body centers the intact form between its existing header and action area using `align-content: safe center`. It falls back to start alignment when content exceeds the available height. An indicated open keyboard explicitly uses start alignment. Standalone retains normal document flow and start alignment, including its existing bottom navigation. There is no new modal, fixed top margin, duplicated form, overlay, or sticky switcher.

## Interaction implementation

The existing LLT root's delegated handlers own dismissal. Results and Favorites/Recent controls are treated as the inside boundary. The click handler clears only the active collection and refreshes results in place before dispatching the original action; it does not cancel propagation or prevent the intended action. Search focus uses the same dismissal helper. Existing pointer-down deletion invokes the helper before its existing removal action so a first tap still works.

Pointer state tracks movement greater than 8 CSS pixels, cancellation, and scroll activity. A trailing click after movement does not count as an outside tap. Native scrolling itself never dismisses the panel. Keyboard activation remains supported. Opening shortcuts does not focus the search field or activate its keyboard. No new document/window outside-click listeners or per-render listeners were added. The root handlers follow the existing application lifetime, pointer state clears at the existing reset boundary, and existing visual-viewport listeners retain their attach/cleanup lifecycle.

Favorite stars now refresh only result contents, retaining the active collection and scroll position. Focus returns to the same star when it remains in the result set, or to the focusable results region when removing a favorite removes that result. This avoids the former full-editor remount and never adds the item. The existing explicit favorite persistence action is unchanged.

## Layout and keyboard handling

The existing visual-viewport updater also marks a keyboard-indicated state when a calculator text field is focused, viewport scale is 1, and visible height is more than 120px below layout height. This separates typical keyboard reduction from small Safari toolbar changes; it is a presentation heuristic, not a clinical or persistence state. Existing viewport dimensions, safe-area padding, page locking, scrolling, and focus visibility remain authoritative.

`safe center` provides an independent overflow fallback even when keyboard detection is unavailable. With a short viewport, the form body scrolls while the header/actions remain within their existing boundaries. After simulated keyboard closure, the form returns to the center of the body. Standalone never receives this modal centering rule. Nested label grids continue using intrinsic rows/start alignment so centering the form does not stretch labels away from inputs.

## Files modified in C.1

- [Tracker interaction/presentation code](</Users/rolandobernal/Documents/My Code/landos-world/js/lee-lee-diabetes-tracker.js>): root-local dismissal and pointer tracking, in-place star refresh, keyboard presentation flag.
- [Shared stylesheet](</Users/rolandobernal/Documents/My Code/landos-world/css/lee-lee-diabetes.css>): form spacing tokens and explicit entry-only centering.
- [package.json](</Users/rolandobernal/Documents/My Code/landos-world/package.json>): syntax-check the new browser suite.
- [New C.1 browser suite](</Users/rolandobernal/Documents/My Code/landos-world/tests/browser/llt-calculator-phase-c1.spec.js>): cross-mode tap/focus, stars, movement/scrolling, responsive spacing/centering, short/keyboard viewports, and screenshots.
- This report.

Existing Phase B/C changes and unrelated dirty files remain local and untouched by this polish pass. Diff review against the pre-C.1 snapshot confirms no changes to carb arithmetic/rounding, the shared engine, insulin algorithms/settings, historical-plan authority, entry integration/persistence, food/meal storage functions, auth/sync, schemas, switcher, or bottom navigation.

## Automated results

| Check | Final result |
| --- | --- |
| Unit suite | 549 passed, 0 failed |
| New C.1 browser cases | 12 passed, 0 failed across final focused runs |
| Existing Phase C, unified search, shared sessions, Foods navigation, Low Glucose browser cases | 90 passed, 0 failed |
| Protected entry/history/keyboard/focus regressions | 26 passed, 0 failed |
| Saved-meal and neighboring-food layout/control regressions | 12 passed, 0 failed |
| Syntax and whitespace checks | Passed |
| Staged diff | Empty |

This is **140 distinct selected browser cases**, with reruns counted once. Tests cover standalone/entry modes, first-tap search focus and input identity, empty/selected-area dismissal, manual/edit/remove actions, toggle switching, successful single additions, favorite-star behavior, actual mouse-wheel list scrolling, surrounding scrolling, simulated touch movement/trailing clicks, default quantity, decimal/live totals, invalid values, no automatic clinical writes, preserved entry notes, historical snapshots/plan restrictions, and existing clinical integration.

Manual-form geometry was checked at **320, 390, 430, 768, and 1280px**, both themes, plus a short landscape viewport. Tests check shared minimum divider padding, unclipped heading bounds, centering within the body, keyboard-focused field visibility, overflowing-body scrolling, standalone start alignment, and re-centering after keyboard closure.

The first broad run passed 100 cases and failed two new test setups: one retained a mocked 844px visual viewport after shrinking the window, and one seeded data before the tracker namespace was ready. The final focused suite synchronizes the mock and awaits startup, then passes all 12 cases. No production behavior or old clinical assertions were weakened to satisfy these failures. The four theme/centering cases were also rerun after expanding geometry coverage, and the four outside-activation cases were rerun with unfinished-food-editor preservation; all passed.

The full repository browser suite was not run. Four previously documented legacy failures (two carb-guidance/`Not Now` scenarios across desktop/mobile) remain outside these selected groups and were not rerun or claimed fixed. No new application failure remains in the executed C.1 checks.

Logs: `/tmp/llt-c1-final-unit.txt`, `/tmp/llt-c1-final-syntax.txt`, `/tmp/llt-c1-acceptance.txt`, `/tmp/llt-c1-final-focused.txt`, `/tmp/llt-c1-geometry.txt`, `/tmp/llt-c1-intermediate.txt`, `/tmp/llt-c1-regression.txt`, `/tmp/llt-c1-meals.txt`.

## Screenshots and visual review

The entry form is centered between its header and bottom actions; the standalone form begins after the same shared divider padding in normal page flow. In the reduced keyboard simulation, the focused Quantity field and actions are visible while other form content remains scrollable. This is not a captured native keyboard.

| Requested view | Screenshot |
| --- | --- |
| A. Standalone Favorites open | [Open](/tmp/llt-c1-review/standalone-favorites-open.png) |
| B. Standalone after dismissal | [Dismissed](/tmp/llt-c1-review/standalone-favorites-dismissed.png) |
| C. Entry Recent open | [Open](/tmp/llt-c1-review/entry-recent-open.png) |
| D. Entry after dismissal | [Dismissed](/tmp/llt-c1-review/entry-recent-dismissed.png) |
| E. Standalone Manual Amount | [Normal page flow](/tmp/llt-c1-review/standalone-manual.png) |
| F. Entry Manual Amount, keyboard closed | [Centered](/tmp/llt-c1-review/entry-manual-centered.png) |
| G. Entry Manual Amount, keyboard simulation | [Reduced visual viewport](/tmp/llt-c1-review/entry-manual-keyboard-simulation.png) |

Full artifacts: `/tmp/llt-c1-final-focused-results/` and `/tmp/llt-c1-geometry-results/`. Browser measurements and screenshots do not establish physical iPhone Safari/PWA or VoiceOver acceptance.

## Preview

**iPhone:** [http://10.0.0.160:8000/#/lee-lees-tracker](http://10.0.0.160:8000/#/lee-lees-tracker)

**Mac:** [http://127.0.0.1:8000/#/lee-lees-tracker](http://127.0.0.1:8000/#/lee-lees-tracker)

The current Mac LAN address was rechecked, and served tracker JavaScript/CSS matched the working files byte-for-byte. Port 8000 preview listeners remain running. Both devices must use a reachable shared local network. This isolated development origin disables production auth/sync; production PWA/offline/updater behavior is not represented.

## Physical iPhone acceptance

1. In both modes, open Favorites/Recent, switch/toggle them, then tap Search, Manual Amount, an item edit/delete action, Selected Items, and empty space. The intended action must work on its first tap with no extra overlay tap.
2. Swipe within a long list and swipe the surrounding calculator. Neither gesture should dismiss the list. Use a star and confirm the favorite change without an item addition; select a result and confirm one addition, list closure, and cleared search.
3. Compare first-divider clearance, field spacing, totals, and button sizes in both forms. Entry content should center only when space permits; standalone should retain its compact page flow.
4. Open/dismiss the real keyboard on each field in portrait/landscape. Confirm values persist, focused controls stay visible, the body scrolls as needed, actions remain reachable, and entry content re-centers when the keyboard closes.
5. Check narrow widths, light/dark, safe areas, touch gesture transitions, hardware-keyboard focus, and VoiceOver. Verify Cancel/Apply on disposable entry drafts preserve notes and do not save automatically. Use test fixtures rather than real clinical records.

Remaining risk is physical iOS gesture/keyboard behavior, including the viewport-based keyboard indicator and hardware/floating-keyboard differences. No architectural redesign, schema change, persistence change, or unresolved implementation question is required. Physical iPhone acceptance subsequently passed. Rolando explicitly authorized staging, commit, push, PR, merge, and workflow deployment on October 15, 2026; release evidence is recorded separately.
