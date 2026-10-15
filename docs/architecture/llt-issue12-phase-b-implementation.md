# LLT Item #12 — Phase B local implementation

Date: October 13, 2026. Branch: `feature/llt-shared-carb-calculator`.
Base: `40f67800dd47e1074e06fd2107ebd37a0bdff643`; fetched `origin/main` and local `main` matched before implementation.
Status: local implementation and automated verification completed; visual acceptance and physical iPhone verification outstanding. Nothing staged, committed, pushed, merged, or deployed.

## 1. Executive summary

Foods now opens the same full-screen Carb Calculator used by New/Edit Entry. Standalone calculations remain in a temporary session, retain their rows and library/search state after returning to Foods, support Clear, and reset on reload. They cannot Apply into an entry or submit a clinical record. The center + retains Log Entry behavior.

The supplied screenshots informed the opening prompt, full-screen surface, prominent carbohydrate total, and expandable serving/source information. Existing LLT typography, colors, themes, quantity policies, and food data remain authoritative.

## 2. Architecture before and after

Before: calculator arithmetic, temporary state, UI, and handlers lived in the entry tracker. Most calculator actions rerendered New/Edit Entry. Completion required only one valid row, so mixed valid/incomplete rows could complete a partial total.

After: `js/lee-lee-carb-calculator.js` owns the shared arithmetic engine, session creation/binding, and carbohydrate-only return adapter. The tracker retains its established normalization, food-selection/library handlers, one calculator renderer, and clinical editor. A standalone dispatcher routes existing calculator actions to the shared renderer without constructing or updating the clinical editor.

Compatibility accessors preserve the existing handlers while moving their `carbCalculator*` fields into an explicit session. This is an incremental extraction; food-selection presentation remains in the tracker, shared by both contexts.

## 3. Files created or modified

Created:
- `js/lee-lee-carb-calculator.js`
- `tests/browser/llt-shared-carb-calculator.spec.js`
- `docs/architecture/llt-issue12-phase-b-implementation.md`

Modified:
- `js/lee-lee-diabetes-tracker.js`: sessions, standalone dispatcher, Foods launch, entry adapter, validation, shared UI.
- `css/lee-lee-diabetes.css`: scoped full-screen styles, source disclosure, narrow-screen rows, 44px controls.
- `index.html`: loads the shared module before the tracker.
- `scripts/pages-runtime-allowlist.mjs` and `service-worker.js`: package/precache the new runtime module.
- `package.json`: syntax-check the new module.
- `tests/lee-lees-tracker-reporting.test.js`: shared-module loading, mixed-row completion policy, session isolation and adapter tests.
- `tests/lee-lees-tracker-storage.test.js` and `tests/llt-low-glucose-client.test.js`: load the shared dependency in existing VM harnesses.
- `tests/browser/landos-world-smoke.spec.js`: replace the old compact-modal height expectation with the approved full-screen expectation, preserving all interaction and scroll assertions.

Unrelated modified/untracked reports and files were left untouched. No schema, Supabase configuration, starter-food data, insulin algorithm, or release-identity contract was changed.

## 4. Shared calculator/session design

A session contains a generated ID, `entry` or `standalone` context, and temporary calculator state. Initial state is copied. Entry sessions are reused only across rerenders of the same editor mode/record identity. New entries and standalone sessions cannot inherit one another's rows, search, picker, or food drafts.

Standalone has one in-memory working session. Clear replaces it. Reload creates a fresh runtime. Clearing private presentation also drops it so temporary private state cannot survive an access revocation.

Completion requires at least one started row and every started row to have a valid quantity and carbohydrate value. Non-finite row products or combined totals are rejected. Valid arithmetic and existing formatting/rounding remain unchanged. The displayed preview subtotal may exclude invalid rows; Apply and Save as My Meal cannot complete that partial calculation.

## 5. Standalone Foods integration

A prominent Carb Calculator button sits above the existing Foods accordions. Back/Done returns to Foods with working state retained. Clear resets the calculator without deleting library records or saved meals. The standalone form has no insulin, clinical Save, or Use/Apply controls, and its submit handler explicitly refuses clinical persistence. It can explicitly save a reusable meal through the existing library authority.

## 6. New/Edit Entry integration

On first invocation, existing component snapshots seed the calculator; a manually entered carbohydrate amount seeds a manual Entry carbs row when there are no components. Subsequent openings retain the working session rather than reseeding removed rows.

`entryPatch()` returns only `mealCarbs` and `mealComponents`; it rejects standalone contexts and incomplete calculations. Apply returns those fields to the originating draft and does not save it. Cancel retains the draft's previous carbohydrate amount. Existing editor rerenders preserve the original-record baseline, ID, historical plan authority, return route, insulin facts, and Low Glucose parent/round identity.

## 7. Clinical safety verification

The shared module has no storage, sync, insulin-plan, dose, clinical record, or versioning API. Standalone bypasses dose-helper and entry-save updates. Entry validation, historical snapshot restrictions, plan verification, suggested-dose guidance, saving, and versioning remain in the existing entry workflow.

Tests verify carbohydrate-only adapter keys, rejection of standalone Apply, independent session rows, unchanged notes, no automatic entry save, historical Plan A preservation, factual edits, missing historical snapshot restrictions, and Low Glucose episode/recheck returns. This is source/local-browser evidence; it does not claim production, live Supabase, or physical-device verification.

## 8. Existing feature preservation

Food Search, reference foods, Favorites, Recent, My Foods, My Meals, manual amounts, fractional quantities, multiple rows, and row editing/removal use their existing shared handlers and data. Both meal-creation paths were exercised: calculator Save as My Meal and Foods Add New Meal. The new tests confirm that both saved meals remain present and no clinical record is created.

## 9. Test results

- Baseline unit suite before edits: 545 passed.
- Updated unit suite: 546 passed.
- JavaScript syntax checks and `git diff --check`: passed.
- New calculator browser suite: 6 passed across desktop/mobile Chromium, including 320px light/dark captures, session isolation, reload, Clear, initial entry carbs, cancel/apply, lists/search, fractional quantities, and both meal-creation paths.
- Existing Low Glucose browser suite: 42 passed across desktop/mobile Chromium.
- Existing targeted historical/library/row regression selection: 12 passed; 6 failed.
- Existing viewport/scroll/focus selection: 8 passed, including short/long content, scroll restoration, one body scroll owner, and visual-viewport tracking.

The six targeted smoke failures were reproduced on a separate unchanged-main archive at the same base SHA: two carb-guidance expectations and one missing Not Now action, each in desktop/mobile. Their assertions were not weakened and clinical behavior was not changed to satisfy them. The full browser suite was not run; these known baseline failures remain open.

The initial sandbox-only unit run had local `listen EPERM` failures; rerunning with local binding permitted passed. Initial broader smoke attempts reused stale device-preview responders; valid comparisons used a fresh local test server. Those environment failures are distinct from application regressions.

## 10. Remaining issues and risks

Physical iPhone/Safari, actual on-screen keyboard, safe-area behavior, and final visual acceptance remain outstanding. The existing smoke failures need a separate investigation aligned with current insulin verification behavior. Other legacy tests that assert compact table dimensions may need to be reconciled with the approved full-screen/narrow-row design; no broad test rewrite was performed.

The supplied images show richer nutrition fields and a grams selector. Existing LLT data/contracts do not support all of those values or new unit conversions. The implementation presents existing serving/source snapshots and total carbohydrate; it does not fabricate fiber, net carbs, sugars, calories, preparation text, or FDC IDs. The complete interactive mockup was not supplied; if one exists, review its remaining interactions before release approval.

## 11. Visual implementation status

Implemented and awaiting visual review: screenshot-informed full-screen hierarchy, opening prompt, shared selection workflow, totals, expandable source metadata, LLT light/dark styling, and narrow-screen touch controls. This is a translation into the existing multi-item LLT workflow, not a pixel-identical copy of the single-food screenshots. No step is blocked on missing screenshot attachments.

Deferred/out of scope: internet carbohydrate search, Nutrition Label processing, new serving-unit conversions, insulin algorithm changes, schema changes, and production release.

## 12. Recommended next steps

Review the local Foods → Carb Calculator and New/Edit Entry → Carb Calculator flows in light/dark modes on a physical iPhone. Confirm the screenshot adaptation and any additional original mockup interactions. Investigate the six unchanged-main smoke failures separately. After acceptance and explicit authorization, complete the commit/PR workflow and stop for Rolando's review; merging and production deployment remain unapproved.

Previews left running:
- `http://127.0.0.1:8000/#/lee-lees-tracker`
- `http://10.0.0.160:8000/#/lee-lees-tracker`

Both responders were refreshed to load the new runtime allowlist, and the served shared-module bytes were compared with the working-tree file. No browser storage was reset or production data changed.
