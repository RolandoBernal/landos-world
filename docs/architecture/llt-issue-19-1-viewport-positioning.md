# LLT #19.1 — viewport modal positioning

## Defect and evidence

The entry calculator was an ordinary fixed div inside the New/Edit form. It had no browser top-layer isolation, so an ancestor establishing a fixed-position containing block could displace it. A synthetic ancestor `translateZ(0)` reproduces a 128px top displacement on unchanged release 2026-10-20-37 in iPhone-sized WebKit, for both New and Edit Entry. The geometry regression fails on that baseline and passes with this fix.

The plain automated DOM did not reproduce the user's physical-device displacement. Its inspected ancestors had no active transform/filter. Therefore the exact physical-iPhone triggering condition is not independently confirmed. A second concrete defect was competing scroll ownership: the shared utility fixes the body at the negative saved offset, but calculator scroll/viewport listeners also attempted to scroll the locked window back to that saved offset.

## Fix

Use a native modal `dialog` for the entry calculator and call `showModal()`. The browser top layer establishes viewport placement outside ancestor positioning/stacking contexts, while DOM ancestry remains intact for form collection, event delegation, theme inheritance and draft semantics. Standalone calculation remains embedded. Reset only calculator-dialog user-agent margins/borders/max bounds. Keep existing safe-area padding, VisualViewport frame and internal scrollport. Remove the redundant window-scroll correction; retain the shared body lock and exact saved-position restoration after closing. Native cancel routes through the existing calculator cancel action.

No clinical, formula, verification, sync, Supabase, historical-record, food/saved-meal, Issue #18 or updater changes.

## Files

- `js/lee-lee-diabetes-tracker.js`
- `css/lee-lee-diabetes.css`
- `tests/browser/llt-issue-19-1.spec.js`
- `playwright.llt-mobile.config.js`
- This report.

## Validation

- Geometry measured with bounding rectangles at top/middle/bottom and repeated opens for New/Edit; both normal ancestry and a synthetic containing-block ancestor. Header/Cancel, viewport bounds, stationary background, exact saved scroll restoration, unsaved notes, reduced keyboard viewport, long rows and Use totals checked.
- Release-37 negative control: 2 geometry failures with a 128px displacement under the containing-block fixture.
- Final mobile WebKit suite: 17 PASS (four geometry scenarios plus existing calculator, audit and Issue #17 synchronization regressions).
- Desktop calculator regressions: 17 PASS; final strengthened desktop geometry: 4 PASS.
- Targeted storage/calculation/modal utility tests: 33 PASS.
- Syntax and deterministic production build: PASS.

Scoped diff, staged diff and whitespace review passed before commit. Use-total restoration is measured from mid-form: changing carbs can shorten the form and clamp a former bottom offset. Cancel restoration is measured exactly at top/middle/bottom.

## Release

Baseline main: `2a18c919a417c252211f5326504fedbc31df1db8`.
Commit/PR/merge/deployment evidence pending release completion.

## Physical iPhone acceptance — REQUIRED, PENDING

Update through Settings → Application Status. In the installed PWA and Safari:
1. Open New Entry, scroll near the bottom, and open Carb Calc. Confirm it opens at the top of the usable viewport.
2. Scroll long calculator content; confirm its header/Cancel stay anchored and bottom actions remain reachable.
3. Cancel; confirm the exact prior form position and unsaved values return. Reopen repeatedly from top/middle/bottom without drift.
4. Repeat from Edit Entry. Search with the real keyboard shown, then dismiss it; confirm viewport fit and reachable controls.
5. Select food and Use the total; confirm correct returned carbs and intact unsaved form data.

Automated viewport emulation does not establish native OS keyboard or physical-device acceptance. Issue #19.1 remains pending that user PASS.
