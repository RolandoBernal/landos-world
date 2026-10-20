# LLT Issues #18 and #19 — mobile UI corrections

## Scope and causes

Issue #18: audit values were serialized inline inside a two-column grid with a 9rem minimum label column. Long identifiers and JSON had no wrapping contract. Narrow screens could overflow. Complex arrays also lost nested structure through `join` formatting.

Issue #19: the fixed calculator layer declared `touch-action: none`. The browser intersects touch permissions through ancestors, so `pan-y` on the inner scrollport could not enable native vertical gestures. The normal calculator body also used implicit grid row sizing. Existing visual-viewport sizing, safe-area padding, keyboard focus handling and document scroll lock are retained.

## Implementation and files

- `css/lee-lee-diabetes.css`: wrap audit text, allow grid children to shrink, stack change labels/values on mobile, and wrap formatted JSON. Permit vertical gestures on the fixed calculator layer; keep normal content rows at intrinsic height. Preserve item-editor centering and standalone layout.
- `js/lee-lee-diabetes-tracker.js`: complex/long audit values use native expandable details with explicit Before/After labels and full escaped, pretty-printed JSON. Short values retain their inline arrow presentation. Event order and the existing 50-event window are unchanged.
- `tests/browser/llt-issues-18-19.spec.js` and `playwright.llt-mobile.config.js`: synthetic narrow WebKit audit fixtures and New/Edit Entry calculator coverage.
- `docs/architecture/llt-issue-17-production-settings-sync-investigation.md`: copy the existing uncommitted production acceptance evidence; original worktree copy preserved.

No clinical calculations, settings synchronization, audit creation, storage contracts, records, food data, service worker or updater logic changed. No production patient data accessed or mutated.

## Validation

- JavaScript syntax checks: PASS.
- Targeted Node tests: 350 PASS (storage/calculations, reporting, sync including Issue #17 recovery, modal utilities, offline and Pages builder).
- Existing Chromium calculator regressions: 17 PASS.
- iPhone-sized WebKit: 13 PASS, including New/Edit Entry and Issue #17 audit synchronization regression coverage.
- Deterministic production artifact builder: PASS using synthetic build metadata for local validation.
- Full scoped/staged diff and whitespace review required before commit.

The history fixture exercises the production rendering functions with synthetic audit events because local-device preview intentionally has no Supabase repository. New/Edit tests check gesture permissions through ancestors, programmatic scroll reachability, reduced visual viewport, food selection, manual rows, cancel/reopen/use, draft preservation and unchanged persisted records. These do not establish native OS keyboard or physical touch behavior. Existing wheel-input tests run in Chromium because mobile WebKit does not support Playwright mouse wheel input.

## Release evidence

Baseline: `6560261caf120c9dd0668a3672491bab3218ab29` (Issue #17 present).
Implementation commit, PR, merge SHA and deployed version: pending release completion.

## Physical iPhone acceptance — pending user execution

Use Settings → Application Status to adopt the deployed release normally, without clearing data or reinstalling.

1. Open Settings → Change History; expand long before/after values. Confirm readable wrapping, chronology and no overlap or horizontal page scrolling.
2. Open Carb Calculator from New Entry, then Edit Entry with an unsaved note. Scroll long content and reach bottom actions.
3. Focus search, show/dismiss the real keyboard; visit Favorites, Recent, My Foods and My Meals, and a manual amount. Confirm required controls remain reachable in Safari and installed PWA.
4. Select a food and use the total; cancel/reopen in a second pass. Confirm correct carbs, restored form position and retained unsaved data.
5. Confirm existing entries remain intact and Issue #17 settings sync remains healthy. Do not rerun recovery unless separately needed.

Physical iPhone acceptance is not claimed by automated browser testing.
