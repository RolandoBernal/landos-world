# LLT Issue #11 — Typography Audit

Date: October 2, 2026. Initial local audit and verification evidence are recorded below. Physical-iPhone typography verification: **PASS**, confirmed by Rolando's shipping brief. The verified implementation is feature-frozen.

## Starting point and scope

Fetched `origin/main` and verified local `main` and `origin/main` both pointed to `8ca31de5c4aa97b86b0b5479db6c2969bb93263e`. Created `feature/llt-typography-audit` from that commit. Existing untracked diagnostic reports and `death-on-notecards/` were preserved.

Investigation preceded CSS changes. This is a consistency audit, not a redesign. Four supported corrections were made. At the initial audit handoff, no commit, staging, push, PR, merge, or deployment had been performed.

## Current architecture

- `index.html` loads `css/lee-lee-diabetes.css`. Its existing `@font-face` declarations load bundled `fonts/dm-sans-latin.woff2`, `fonts/dm-sans-latin-ext.woff2`, and `fonts/roboto-mono-regular.ttf`; no remote font request is required.
- DM Sans declares normal weights 400–700 with `font-display: swap` and Unicode ranges. Roboto Mono declares normal weight 400 with `font-display: swap`. Heavier numeric emphasis can therefore be synthesized by the browser; this existing behavior is preserved.
- `.lee_lee_diabetes_shell` defines `--llt-ui-font` (DM Sans, Apple/system UI, Segoe UI, Roboto, sans-serif) and `--llt-numeric-font` (Roboto Mono, SFMono-Regular, Menlo, Consolas, monospace). Root weight is 400; body size/line height inherit from the shell context.
- Native inputs, buttons, selects, textareas, and placeholders already inherit the LLT font family. Shared input/select/textarea classes also use `font: inherit` and an explicit 1rem size. Numeric/date/time/decimal-input selectors override only the font family, retaining their existing size and weight.
- `renderNumeric`, `renderFormattedValue`, and the glucose/carbs/insulin rendering helpers distinguish numeric spans from prose. They already cover report metrics, dose breakdowns, entries, percentages, data dates/times, and conflict comparisons.
- Most sizes, weights, line heights, and spacing remain component-specific CSS, not a typography utility framework. Existing field gap tokens serve layout. Only two small field-label tokens were added to consolidate equivalent label roles.
- The font-face names are globally available and other apps can use them. LLT's typography rules and all changes here are LLT-specific. No shared shell stylesheet or font asset was modified.
- Runtime markup has no inline font size/family/weight/line-height/letter-spacing declarations. Its inline styles position chart tooltips, set timer progress, and size progress bars; these were retained.
- Duplicate component selectors include calculator action-row blocks with complementary layout declarations. Light-theme overrides and responsive rules are also intentional. No mechanical cleanup or unrelated `!important` removal was done.

## Semantic inventory and preserved hierarchy

| Recurring role | Current treatment / decision |
| --- | --- |
| App/page title | DM Sans, responsive `clamp(2rem, 9vw, 3.2rem)`, line height 1; preserve |
| Editor/sheet title | DM Sans, 1.5rem; timer titles have their own responsive scale; preserve |
| Section/accordion/card headings | DM Sans; section title 1rem, card context weight 500, Settings summary emphasis; preserve |
| Navigation | DM Sans; desktop section controls use compact 0.86rem/600 treatment; current bottom navigation is icon-based with accessible names, not visible text labels; preserve |
| Field label | DM Sans, 0.92rem/500; standalone Target Range label now shares the same tokens |
| Input/select/textarea | 1rem; DM Sans for prose/options, Roboto Mono for existing numeric/date/time roles; textarea line height 1.45; preserve |
| Helper/error/status prose | DM Sans, generally 0.9rem/1.45; dose notices and supporting metadata have deliberately different compact sizes; preserve |
| Buttons | DM Sans; general action 0.95rem/600, compact actions and primary Log Entry retain role-specific sizes; no global button reset |
| Entry values and notes | Numeric spans in Roboto Mono; units/context/notes in DM Sans; timeline values/notes 0.9rem/1.35 and timestamp 0.85rem; preserve |
| Dose/readout | Numeric spans in Roboto Mono; total 1.7rem/600, breakdown 0.9rem/500; warning and adjustment emphasis retained |
| Report metrics | DM Sans labels (0.76rem/600), Roboto Mono numeric spans in 1rem/600 values, supporting text 0.78rem/500; preserve |
| Foods/calculator | DM Sans names, serving prose, categories and actions; Roboto Mono quantities/carbs; compact editable quantity remains 1.08rem/400/1.2; preserve |
| Settings diagnostics | DM Sans labels, devices and status prose; standalone numeric values now use the existing formatted-value helper |
| Timer | Existing Roboto Mono countdowns and tabular digits retained; ordinary “remaining” caption restored to DM Sans; native card now inherits full UI typography |
| Print-oriented report | Existing denser 0.78rem tables and 0.68rem summary labels retained; document/table presentation is a distinct role |

Numeric treatment was not applied to options such as “7 Days,” ordinary date headings, food names, prose, or every string containing digits. Existing data-date/time treatment was preserved rather than expanded arbitrarily. Compact correction-table labels remain 0.78rem/600 because they label repeated table-like rows rather than top-level form fields.

## Supported corrections / before and after

| Role | Before | After | Reason |
| --- | --- | --- | --- |
| Settings Target Range label | 0.86rem/600 while adjacent field labels were 0.92rem/500 | Shared `--llt-field-label-size` and `--llt-field-label-weight` with ordinary field labels | Same semantic level in the same Settings form |
| Active timer card UI | DM Sans family, but browser-default 13.3333px button size in Chromium | Full `font: inherit`; 16px in the audited shell | Avoid an accidental native button default; retain existing countdown size/font |
| Timer conflict caption | “remaining” inherited Roboto Mono from countdown container | Caption explicitly uses `--llt-ui-font` | Ordinary interface language should use DM Sans |
| Status/diagnostic numeric values | Shared grid escaped every value as plain UI text | `renderFormattedValue(value)` adds existing numeric spans for recognized data values | Standalone counts should match other LLT data readouts; preserve escaping and visible text |

Roboto Mono was added to recognized numeric status-grid values through the existing helper. It was removed from the timer conflict caption. DM Sans was explicitly restored there, and full UI inheritance was restored on the timer card. No new font family, font asset, numeric calculation, or responsive font-size rule was introduced.

## Responsive and native-control inspection

Automated screenshots and font/overflow measurements cover 320×900, 393×900, 768×900, 1280×900, and 852×393 landscape in the configured desktop/mobile Chromium projects. Screens reviewed include Today, History/date detail, New/Edit Entry, all four report views with a populated custom range, Foods, Add Food, My Meals builder, calculator category modes, food search, manual amount, and expanded Settings sections. A final fixture also includes populated Today with a longer prose note.

The existing architecture keeps headings distinct, food names/servings wrapping, numeric values distinct from units/prose, and actions within their existing control layouts. No document-wide horizontal overflow was detected in the audited navigation/draft workflow. Compact print tables use their existing constrained scrollable presentation; no attempt was made to restructure them. At 320px, native date/time controls in the two-column temporary-adjustment area remain tight; their layout and platform-specific rendering should receive physical-iPhone attention, not a global text-size reduction.

Settings review includes Sync Status, Sync Diagnostics, plan-verification diagnostics, App Information, change history, Patient & Clinic Info, History Preferences, Pre-Meal Timer, Insulin Dose Guidance, Correction Table, Local Backup, and Recently Deleted. Long diagnostic identifiers/serialized values retain existing wrapping. The existing icon-only bottom navigation is preserved.

The current source has a manual carbs-per-serving/quantity/label screen and food-reference copy that advises checking Nutrition Facts labels. No separate nutrition-label scanning/import workflow was found; no such feature was added. My Meals action-row layout was intentionally left for #14.

Desktop/mobile Chromium does not establish Safari/iOS native-control metrics, keyboard behavior, Dynamic Type, physical-device readability, or installed-PWA behavior. Rolando subsequently confirmed physical-iPhone typography verification PASS; an installed-PWA/offline verification was not separately claimed. The local-device preview deliberately disables service workers/offline/release updates.

## Files and automated contracts

Exactly these task files are changed:

1. `css/lee-lee-diabetes.css` — label tokens, timer card inheritance, timer caption font.
2. `js/lee-lee-diabetes-tracker.js` — status-grid rendering uses the existing presentation-only formatted-value helper.
3. `tests/browser/landos-world-smoke.spec.js` — two Issue #11 contracts plus font assertions in the existing timer-conflict test.
4. `LLT_ISSUE_11_TYPOGRAPHY_AUDIT_REPORT.md` — this report.

The new contracts compare equivalent labels, inherited timer typography, actual UI/data font families, loaded fonts, Settings counts versus prose, responsive document overflow, and exact persisted tracker contents after navigation and cancelled drafts. They do not assert a pixel size for every selector. The timer-conflict behavior test also checks that the countdown and caption use their respective fonts.

Screenshots/traces are ignored test artifacts under `test-results/`; validation logs and unchanged-main comparison copies are under `/tmp/llt11-*`. These are synthetic test contexts with mocked authentication/cloud clients, not user production data.

## Validation results

- Final LLT unit command: `node --test tests/lee-lee-pre-meal-timer.test.js tests/lee-lees-tracker-storage.test.js tests/lee-lees-tracker-reporting.test.js tests/lee-lees-tracker-sync.test.js` — **239 passed, 0 failed**.
- `npm run check:js` — passed; includes repository JavaScript/static syntax checks.
- Final focused command: `LANDOS_WORLD_SMOKE_PORT=8765 npx playwright test tests/browser/landos-world-smoke.spec.js --grep 'Issue #11|defers an existing-timer conflict|Settings shows one global sync'` — **8 passed, 0 failed**, in desktop and mobile Chromium, including the final status-grid rendering addition.
- Broad existing LLT browser command: `LANDOS_WORLD_SMOKE_PORT=8765 npx playwright test tests/browser/landos-world-smoke.spec.js --grep 'Lee-Lee|LLT'` — **82 passed, 18 failed**, across both configured projects. This run preceded the final standalone-count rendering addition; final focused and unit checks cover that addition.
- The 18 failures represent nine existing test cases failing in both projects. All 18 reproduced against the exact unchanged `main` archive served separately on port 8771. **No new failures identified.** No unrelated baseline failures were fixed.
- `git diff --check` passed. Full application/test diff was reviewed for scope; staged diff is empty.

| Baseline case | Failure observed |
| --- | --- |
| Print media hides app chrome | Test expects 6 ecosystem navigation elements; current shell has 7 |
| Bedtime context | Expected dose-total element is absent |
| Temporary receipt rows | Existing editor-content expectation fails |
| Food Library carb totals/historical snapshots | Existing editor-content expectation fails |
| My Foods footer actions | Waits for an absent “Remove favorite” control |
| Today/History deletion | Expected Recently Deleted detail element is absent |
| Global sync / Settings input | Patient Name input is hidden in its accordion |
| Temporary adjustment | Waits for hidden/missing checkbox under existing Settings accordion flow |
| Food upload diagnostics | Existing exact Sync Diagnostics text locator cannot find the expected element |

An initial audit assertion intentionally reproduced the native timer button-size drift before the fix. One expanded audit run was interrupted because the test requested an unsupported “all” report range; the test was corrected to use the supported custom range. Starting the iPhone server also rewrote shared generated `.local` metadata to `local-device`, causing an environment-mismatch failure; the affected run was stopped, desktop metadata restored, and the full regression run executed in the correct environment. These were audit/test-environment findings, not typography regressions.

## Safety and excluded issues

No clinical/dosing or data behavior changed: insulin plans/base units, I:C, correction tables, rounding, TEA, bedtime logic, target ranges, timer state/behavior, carb/report calculations, historical recalculation, verification, sync, queues, persistence, audit logs, or source-of-truth logic are untouched. The sole application-JavaScript change affects markup presentation through an existing escaped formatter; values are not recalculated or rewritten.

No migration, storage clearing, schema/Supabase mutation, preference reset, cache clearing, force-refresh, or release/updater change occurred. No production service-worker/asset version was bumped for this local-only handoff.

Issue #12 calculator architecture/dedicated space, #13 Today carb breakdown, and #14 My Meals action-row styling were not implemented. VFGT, LWW, iMaintenanceTotal and other applications were not changed.

## Initial physical iPhone handoff and workspace

Branch: `feature/llt-typography-audit`; HEAD remains the starting `main` commit. All implementation is unstaged/uncommitted. Existing unrelated untracked files remain untouched.

Repository-supported iPhone preview: `node scripts/dev-iphone.mjs --port 8000`, bound to the private Wi-Fi interface with same-subnet access restrictions. Exact route: **http://10.0.0.160:8000/#/lee-lees-tracker**. Desktop route: **http://127.0.0.1:8765/#/lee-lees-tracker**. Both previews are left running. The iPhone origin uses separate local browser storage, disables production authentication/sync, and is not a production PWA/release test.

Handoff verification: fetched the iPhone server's generated metadata and confirmed `local-device`, the requested feature branch, and modified source. Fetched CSS matched the working-tree CSS byte-for-byte. Chromium opened the exact LAN route at 393px, rendered Lee-Lee’s Tracker in DM Sans, and reported no document overflow. This confirms host-side serving/rendering, not physical-iPhone connectivity or approval.

On iPhone, inspect both orientations, equivalent Settings labels, native Context/Date Range and numeric controls, timer card and conflict caption, long notes/food names, report values, and Settings helper/diagnostic text. Physical verification is the next gate; no shipping action is authorized by this handoff.

READY FOR LLT #11 PHYSICAL-IPHONE TYPOGRAPHY VERIFICATION

## Shipping approval

Rolando confirmed physical-iPhone typography verification PASS and explicitly authorized commit, push, PR creation, merge after checks, automatic Pages deployment verification, and local `main` synchronization. No post-verification typography, layout, refactoring, clinical, or data changes were made. Shipping validation and release identifiers are recorded in the PR and final shipping report; the audit evidence above describes the initial local handoff.

The shipping pass reproduced **239/239 LLT unit passes**, **8/8 focused desktop/mobile browser passes**, and passing `npm run check:js` / `git diff --check`. The earlier 18 unchanged-main baseline failures remain documented above and were not rerun or repaired during shipping. Remote `main` still matched the audit base at final sanity review. Effective main-branch rules were empty and the classic branch-protection API reported “Branch not protected”; PR checks are inspected separately after creation.
