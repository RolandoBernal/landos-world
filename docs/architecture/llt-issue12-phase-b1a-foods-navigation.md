# LLT Item #12 — Phase B.1A Foods / Carb Calc navigation experiment

October 14, 2026. Branch: `feature/llt-shared-carb-calculator`.
Status: implemented locally and verified with automated tests. Awaiting physical iPhone UX acceptance. No staging, commit, push, merge, or deployment occurred.

## Navigation changes

Foods now contains a compact two-option switcher, **Foods / Carb Calc**, below the existing LLT header. The selected view is visibly marked in both themes. The switcher remains reachable while the standalone calculator and its search/manual-item subviews are displayed.

The existing Foods bottom-navigation button always opens Foods with Foods selected. Leaving for Today, History, Reports, Settings, or Log Entry preserves the in-memory scratch calculation. Returning through Foods selects Foods by default; choosing Carb Calc resumes the scratch session. Back and Done return to Foods. Clear replaces only the standalone calculator session.

The center + still opens Log Entry. Other bottom-navigation destinations use their existing handlers and icons.

## Existing navigation investigation and shell adaptation

Foods is rendered by `renderFoodLibrary()`, which owns the existing My Foods/My Meals accordions and uses module-level search/accordion state. The Phase B standalone calculator was launched from Foods but covered the navigation with a full-screen modal overlay. Its working state already belonged to `standaloneCarbCalculatorSession`.

This experiment retains that session and the single `renderCarbCalculator()` renderer. Standalone now renders in the normal Foods page shell, with a labeled non-modal region and ordinary document scrolling. This exposes the switcher and bottom navigation without copying calculator business logic. Dedicated search and manual-item views still use the existing renderer and handlers.

New/Edit Entry retains its full-screen modal calculator, backdrop, focus trap, and body scroll owner. The Foods switcher is absent from those entry workflows.

## State preservation and safety

Selected view is derived from the existing editor mode; there is no new navigation framework or persisted view setting. The existing standalone session owns rows, library selection, search text, and temporary subview drafts. Navigation captures unfinished manual-item values and meal names before changing the displayed view. Resuming Carb Calc restores them. Explicit Cancel or a successful reusable-meal save clears the temporary meal-name draft.

Switching to Foods also retains the Foods accordion and search state. Normal section departures retain the existing Foods entry behavior. Reload and access revocation retain Phase B's existing scratch-reset lifecycle.

Entry and standalone sessions remain isolated. Standalone has no clinical Save, insulin controls, or carbohydrate Apply into an entry. New/Edit Entry still uses the carbohydrate-only adapter and existing validation, historical-plan verification, and persistence authority. No insulin algorithm, clinical record contract, authentication contract, Supabase schema/configuration, or production data was changed. No user storage was cleared.

The shared engine file `js/lee-lee-carb-calculator.js` was compared with the pre-experiment Phase B snapshot and is byte-for-byte unchanged.

## Files created or modified in B.1A

Created:
- `tests/browser/llt-foods-navigation.spec.js`: focused switcher, lifecycle, accessibility, layout, and entry-isolation coverage.
- `docs/architecture/llt-issue12-phase-b1a-foods-navigation.md`: this report.

Modified:
- `js/lee-lee-diabetes-tracker.js`: switcher rendering, standalone page-shell semantics, temporary draft capture/resume, and keyboard activation.
- `css/lee-lee-diabetes.css`: scoped segmented-control and standalone shell styles only. Existing calculator search, item-row, manual-form, and nutrition styling was not redesigned.
- `package.json`: include the new browser file in syntax checks.
- `tests/lee-lees-tracker-reporting.test.js`: verify generated entry/standalone semantics and preserve entry modal assertions.
- `tests/browser/llt-shared-carb-calculator.spec.js`: replace the standalone full-screen size expectation with the new page-shell/navigation expectations.
- `tests/browser/landos-world-smoke.spec.js`: two historical fixtures explicitly remove the starting Entry carbs row before replacing it with their 20 g food. Clinical expectations and restrictions remain unchanged.

All other Phase B work and unrelated working-tree files were preserved. There were no new runtime files, engine rewrites, schema changes, or broader Phase B.1 calculator redesign changes.

## Accessibility and mobile behavior

The switcher uses labeled tabs and tab panels, `aria-selected`, associated panel IDs, and a roving tab stop. Arrow keys, Home, and End activate the corresponding view and retain keyboard focus. Enter/Space use native button activation. Standalone Tab navigation can reach the switcher and bottom navigation; entry focus trapping remains intact.

Segments have at least 44px touch targets. The sticky switcher sits below the existing 44px ecosystem navigation plus safe-area inset and spacing. Narrow-width checks verify no horizontal overflow and that the switcher remains clickable after scrolling. The existing bottom safe-area padding keeps final calculator actions clear of the bottom navigation.

Automated viewport-shrink checks verify input/action reachability at 320px width. These are software checks, not physical iPhone keyboard or Safari validation.

## Test results and baseline comparison

- `npm test`: **547 passed**.
- `npm run check:js`: passed.
- `git diff --check`: passed; staged diff is empty.
- Foods navigation plus shared-calculator browser suites: **18 passed**, desktop/mobile Chromium.
- Existing Low Glucose browser suite: **42 passed**, including episode/recheck calculator integration.
- Existing Foods/meal-builder, historical-entry, and entry-calculator viewport/scroll/focus checks: **20 passed** after the fixture alignment described below.

The initial broader selection passed 16 cases and failed four historical cases. All four failures reproduced in a separate, unchanged snapshot of the local Phase B implementation. Their fixtures added a new 20 g food to the Phase B calculator's seeded original carbohydrate amount while expecting a replacement total of 20 g. The two fixtures were updated to explicitly remove the initial row; all four then passed with their original historical-plan, identity, factual-edit, and save-blocking assertions intact. No clinical code was changed to resolve them.

Four unit assertions initially assumed every invocation was a modal. They now inspect generated entry markup and continue to require its dialog/body-scroll semantics. Added coverage verifies standalone main/search/manual views are non-modal regions.

The full browser suite was not run. Previously documented unrelated legacy smoke failures from Phase B remain outside this experiment; this report does not claim the entire browser suite is green.

## Preview and remaining acceptance

Office iPhone preview: `http://172.22.19.198:8000/#/lee-lees-tracker`

Local Mac preview: `http://127.0.0.1:8000/#/lee-lees-tracker`

Both preview responders remain running on port 8000. Current LAN address was rechecked, and served tracker JavaScript and stylesheet bytes were compared with the working-tree files. This development preview disables production authentication/sync and does not represent production PWA/offline/update behavior.

Physical acceptance should cover switching during scratch work, leaving/returning through bottom navigation, center +, Clear/Done, search/manual-item subviews, the real iPhone keyboard, safe areas, and light/dark appearance. Screen-reader semantics and keyboard behavior were checked in software; actual VoiceOver testing remains outstanding.

Stop here for physical iPhone UX acceptance before committing. The broader Phase B.1 calculator redesign remains deferred.
