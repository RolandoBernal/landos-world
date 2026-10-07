# Lando's World light-mode regression sweep

Date: 2026-10-06. Local review phase only. Production baseline supplied by Rolando: 2026-10-06-27.

## Starting safety and scope

Starting branch: `main`. Starting HEAD: `a956bd6745f9596723fc6f43a9e15c28b0cd787c`.
`git fetch origin main` succeeded with required filesystem access. Local main and freshly fetched origin/main both matched that full SHA. Created `fix/light-mode-regression-sweep` from that baseline. HEAD remains unchanged; no files staged.

Starting status: edited `LLT_ISSUE_14_5_ALERTS_DEXCOM_TRACKER_REPORT.md`; untracked files/directories below were preserved:

- LLT_INSULIN_PLAN_RECONCILIATION_DRY_RUN_REPORT.md
- LLT_INSULIN_PLAN_RECONCILIATION_EXECUTION_REPORT.md
- LLT_INSULIN_PLAN_SERIALIZATION_AND_STATE_REPORT.md
- LLT_INSULIN_PLAN_SYNC_SAFETY_AUDIT.md
- LLT_INSULIN_PLAN_VERIFICATION_RELEASE_READINESS_REPORT.md
- LLT_INSULIN_PLAN_VERIFICATION_UX_RELEASE_CANDIDATE_REPORT.md
- LLT_SETTINGS_DIAGNOSTICS_UX_IMPLEMENTATION_REPORT.md
- LSW_LOCAL_PROD_DIAGNOSTIC_REPORT.md
- VFGT_ISSUE_3_LANDING_CARD_IMPLEMENTATION_REPORT.md
- death-on-notecards/
- docs/architecture/llt-post15-dexcom-sensor-code-final-shipping.md
- docs/architecture/llt-sensor-cycles-REVIEW-ONLY.sql
- supabase/.gitignore
- supabase/config.toml

No reset, clean, deletion, data repair, release version change, or production operation performed.

## Root-cause matrix (recorded before implementation)

| App / defect | Component and actual source | Root cause | Scope / minimal fix |
| --- | --- | --- | --- |
| Weather dark band | `.weather_settings_button`, css/weather-app.css | Gradient consumes `--weather-yellow-soft`, overridden to dark brown `#7a5200` in light mode for text | App/control-specific gold gradient; leave text tokens alone |
| Digital Clock contrast | `.digit_clock_time` and DOM `.vfgt_seven_segment.is-on/.is-off`, css/digital-clock.css | Lit segments use currentColor inherited from bright `--app-accent`; unlit segments use gray RGBA | Light-only clock-view color `#087a3a`, off token transparent |
| Sprints transparent confirmation | `.sprints-confirm__dialog`, css/sprints.css | Later layered gradient replaces earlier surface; both gradient layers have transparency and no opaque base | Light-only opaque `#faf6ff` base beneath existing tinted layers |
| VFGT Game Type | native `.vfgt_game_type_select`, css/violet-futbol-game-tracker.css plus shared `.app_theme select` in css/maintenance-total.css | `color-scheme: dark` persists in light mode; higher-specificity background shorthand resets shared arrow size/position/repeat, leaving default tiled gradients in light mode | Existing native select retained; light-only color-scheme, explicit 16px SVG chevron, positioning, no-repeat, end padding, opacity 1 |
| iMT Home cog | actual `#imt_settings_toggle`, index.html and css/digital-clock.css/app-themes.css | Visible header cog inherits pearl-white accent; legacy maintenance settings-link CSS does not target this element. More sets aria-expanded=true and receives dark active background | Light-only neutral Home foreground; preserve light foreground on expanded dark surface |
| iMT inactive nav | `.imt_nav_button`, css/maintenance-total.css | Explicit light-mode foreground `#fffdf7` against white surface | Light-only neutral `#526171`; retain turquoise active icon rule |

No shared CSS selector/token changed. Each fix is guarded by `data-theme="light"` and its app/component. Shared select rule is inspected but unchanged. LLT consumes none of the changed scoped rules. No app logic changed.

## Exact task files

- css/weather-app.css
- css/digital-clock.css
- css/sprints.css
- css/violet-futbol-game-tracker.css
- css/maintenance-total.css
- tests/browser/light-mode-regression.spec.js
- docs/architecture/landos-world-light-mode-regression-sweep.md

Generated ignored local preview metadata and ignored test artifacts are normal development outputs. Unrelated tracked/untracked content remains outside this task.

## Results by app

Weather: Set and Refresh show clean `#ffe566 → #ffd400` gold, readable dark text, unchanged dimensions/labels/behavior. Mobile rendering inspected. Dark computed styles match HEAD.

Digital Clock: active segments/colons/AM-PM inherit dark green, inactive segments transparent. Existing panel backgrounds, geometry, fonts, time/date/weather/settings behavior and settings cog remain untouched. Production renderer `renderSevenSegmentDigit` verified for digits 0–9 with active counts 6,2,5,5,4,5,6,3,7,6; every active segment remains colored and every inactive segment transparent. Mobile current-time rendering inspected. All existing Digital Clock browser tests passed. Dark computed styles match HEAD; previous gray inactive segments return in dark mode.

Violet Sprints: opaque light-purple base prevents underlying workout text from bleeding through translucent gradient layers. Existing light backdrop remains `rgba(15,23,42,.42)`. Finish Workout title, copy, Cancel and Finish buttons visually inspected. Cancel dismisses without finishing the isolated workout. Shared confirmation component covers its other confirmation uses; only Finish confirmation opened in automated browser test. No workout logic edits. Dark computed surface/backdrop styles match HEAD.

VFGT: light-blue input surface, readable placeholder/selected values, bounded blue chevron, no repeating/malformed triangle in Chromium mobile rendering. Native select/options/keyboard semantics retained. Every nonempty option selects correctly and control fits its parent at all tested widths. Existing future-game test saved and edited a game before failing later at an unavailable Quick Start locator, identically on HEAD. No game logic/data edits. Explicit `-webkit-appearance: none` and SVG dimensions remove dependence on native browser indicator drawing, but actual Safari rendering remains a physical-iPhone acceptance item. Dark placeholder computed styles match HEAD.

iMT: Home cog uses `#394552` against existing light square; More retains light `#fffdf7` foreground on existing dark expanded surface. Screenshot inspected after targeting actual header ID. Nav inactive icons/labels use `#526171`; active icons preserve `#64D8CB`. All five navigation destinations swap states in isolated test data. Mobile labels retain their existing hidden behavior, tablet/desktop labels remain present. Data and navigation destinations unchanged. Dark computed styles match HEAD.

## Theme, accessibility and responsive checks

Theme manager combines persisted system/light/dark preference with matchMedia and applies root `data-theme` plus color-scheme. No stale state defect found. Explicit Light→Dark→Light and system Dark→Light→Dark checks pass. CSS transitions are allowed to settle in tests.

Widths: 320, 393, 430, 768, 1280 px, Chromium and mobile Chromium. Computed/control containment checked; rendered screenshots inspected at 393px. Existing clock layout/containment suite passed. These are browser checks, not physical-device acceptance.

Approximate contrast sanity checks: inactive iMT neutral on white 6.35:1; Home cog on #eef3f9 8.77:1; dark green clock on representative pale-green #c3e4d2 3.98:1 (large digits); Weather text on gold 13.14:1. Existing active turquoise is deliberately preserved. VFGT focus shadow/border remains, native select accepts focus and options; Weather outline rules and other focus rules unchanged. No new ARIA added. Sprints dialog retains alertdialog/aria-modal and its focus handling. Active navigation retains existing is-active state and turquoise icons.

## Validation evidence

- `npm run check:js`: PASS; new browser spec separately passes `node --check`.
- `npm test`: 540/540 PASS, including affected app unit suites, theme/modal/preview tests and LLT storage/reporting/sync/sensor/low-glucose coverage. Initial restricted run could not bind loopback; permitted rerun passed.
- Focused new browser spec: 14/14 PASS, two projects, five viewport sizes plus actual Finish confirmation and system switching.
- Existing affected/theme browser selection: 38 PASS, 8 FAIL initially. Six VFGT failures reproduce against untouched HEAD archive (both projects): future game Quick Start locator; Add one goal to Violet locator; New Game locator. They are outside the scoped presentation change and were not weakened or fixed.
- Two initial LLT-inclusive light-surface failures resulted from LAN server writing local-device metadata into the shared ignored preview file. Restored desktop metadata and reran those checks: 2/2 PASS. Effective existing selection result: 40 PASS, 6 confirmed baseline failures.
- Direct baseline stylesheet comparison for affected dark controls: Weather, Digital Clock, Sprints confirmation/backdrop, VFGT placeholder select and iMT cog/nav all EQUIVALENT to HEAD. No dark-mode declarations modified.
- Full intended CSS diff reviewed; `git diff --check`: PASS. No staged diff/commit.

## Local physical-iPhone preview

Safe existing `scripts/dev-iphone.mjs` server is running on **http://10.0.0.160:8000/**. Previous server was bound to stale 172.20.10.9; it was left untouched. Current server binds the selected private en0 address and restricts clients to its subnet. Verified responding HTML/metadata and branch. Keep Mac and iPhone on the same trusted Wi-Fi network.

Routes: `#/weather`, `#/digital-clock`, `#/violet-sprints`, `#/violet-futbol-game-tracker`, `#/maintenance-total`.

HTTP local-device preview disables production sync/auth, service workers and deployed updates. The accepted UUID fallback is unchanged. Use local/isolated data. LAN IP can change if Wi-Fi/network changes.

## Physical-iPhone checklist

Prepare this checklist for the user:

WEATHER — LIGHT MODE

1. Open Weather.
2. Open Settings.
3. Verify Set button has clean gold background.
4. Verify no black/dark band.
5. Verify Refresh button has clean gold background.
6. Verify no black/dark band.

DIGITAL CLOCK — LIGHT MODE

7. Open Digital Clock.
8. Verify current time is immediately readable.
9. Verify active/lit segments clearly contrast with pale-green display.
10. Verify inactive/unlit segments are invisible.
11. Verify digits still look structurally correct.
12. Verify settings cog looks exactly as before.

VIOLET SPRINTS — LIGHT MODE

13. Start/open a workout safely.
14. Trigger Finish Workout confirmation.
15. Verify modal surface is opaque.
16. Verify underlying workout content does not bleed through.
17. Verify dialog text/buttons are readable.
18. Cancel rather than ending a real workout if appropriate.

VFGT — LIGHT MODE

19. Open Add Future Game.
20. Inspect Game Type.
21. Verify light-mode surface.
22. Verify placeholder readable.
23. Verify dropdown indicator looks normal.
24. Open options.
25. Select an option.
26. Verify selected value readable.
27. Do not save a synthetic game unless using isolated/local test data.

iMT — LIGHT MODE

28. Open Home.
29. Verify settings cog clearly visible.
30. Verify active Home nav item visible.
31. Verify inactive nav items clearly visible but subordinate.
32. Open More.
33. Verify settings control.
34. Verify active More item visible.
35. Verify inactive nav items clearly visible.
36. Switch through nav destinations and verify active/inactive states.

DARK MODE REGRESSION

37. Switch to dark mode.
38. Quickly inspect all five apps.
39. Verify none of the accepted dark-mode treatments regressed.

## Release boundary and limitations

Production changes: NONE. Commit: NO. Push: NO. PR: NO. Merge: NO. Deployment: NO.

No actual iPhone/Safari acceptance claimed. Automated WebKit unavailable in installed browser cache; no browser installation performed. Physical review must confirm native options sheet/chevron, real viewing-distance digit contrast, modal opacity, iMT Home/More contrast, all app dark treatments and bidirectional switching. Existing VFGT baseline failures limit full lifecycle browser proof; passing unit coverage and unchanged JS support the scoped behavior boundary. No full repository browser suite claimed.

Final status: local targeted fixes complete, pending physical-iPhone review.

## Physical-review follow-up: square launcher cards

Rolando accepted the five original fixes and requested equal card heights. The initial follow-up used content-driven equal rows, which removed the established square shape. Rolando corrected that requirement: cards must remain squares. That initial layout was superseded before any commit or release.

Final implementation restores common `aspect-ratio: 1 / 1`, automatic height, zero minimum height, and the original automatic grid rows. VFGT's square-disabling exception remains removed. Every launcher card is now square and equal-sized at a given viewport. All eight measured exactly 361 × 361px at a 393px viewport.

VFGT summary uses a shrinkable middle region, safe centering, .2rem group gaps and 1.2 text line-height to fit ordinary lifecycle summaries within the square. For unusually long content, only that middle region scrolls vertically; the header and Open button remain visible. No game summary derivation, saved data, or app logic changed. Individual app screens and the accepted light-mode fixes are unchanged. Both launcher themes intentionally retain square geometry.

Validation: eight square/equal-size/containment tests across 320/393/768/1280px, both Chromium projects and both themes, with sparse and deliberately long content. Existing VFGT landing suite exercises all lifecycle summaries, long names/PK notation, persistence preservation and entry-button navigation. Actual sparse mobile VFGT square rendering inspected. Final validation: presentation suite 22/22 PASS; existing VFGT landing suite 18/18 PASS; syntax and git diff --check PASS. LLT launcher square/containment included; LLT application source unchanged.

No additional task files. No commit, push, PR, merge or deployment. Preview remains http://10.0.0.160:8000/. Square correction ready for physical review.

## Launcher button gutters follow-up

Rolando requested equal left/right/bottom spacing for `clock_launch_btn` at every screen size. Measurements found the 420px button-width cap added 12px extra side spacing on 600–767px screens; the narrow 320px Weather launcher content pushed its button ~3px too close to the bottom.

Scoped `#lando-launcher .clock_launch_btn` now fills the card's padded inner width, has zero horizontal/bottom margins, and cannot shrink. Existing automatic top margin remains; VFGT's own middle-region/CTA rules remain. At widths ≤360px only Weather launcher card gaps are reduced from .85rem to .7rem to fit its content within the square with the proper footer gutter. No Weather app screen, data, typography, button text padding, or behavior changed.

Coverage measures every launch button's left/right/bottom edge distance and preserves each card's square aspect ratio in both themes at 320/393/430/600/767/768/820/1024/1280px, both Chromium projects. Normal gutter is 18px including border on mobile, 27px including border from tablet upward. No commit/push/PR/merge/deployment.

Final combined validation after gutter fix: **58/58 browser checks PASS** (presentation, square geometry, nine-width button gutters, existing VFGT landing lifecycle/long-name coverage). New spec syntax and `git diff --check` PASS.

## Landing clock container scaling follow-up

Rolando requested that the landing-page Digital Clock time shrink/grow with its container at every screen size. The shared digit-width token used viewport units and a fixed maximum; AM/PM used a fixed font size. This did not track narrower cards in multi-column layouts.

Scoped launcher CSS makes `.clock_utility_local_time` an inline-size query container, sizes launcher digit widths at `10cqw`, and launcher AM/PM at `6cqw`. Existing derived digit height/thickness/gaps scale with that digit width. No minimum/maximum blocks container responsiveness. The main Digital Clock, clock renderer/timing/timezone/date formatting, theme colors, square geometry and launch-button gutters remain unchanged.

Coverage: ten checks across 320/393/600/768/1280px and both browser projects, both themes; representative 01:11:11 AM, 08:58:02 PM, 12:59:59 PM and 23:58:58 combinations; digits/colons/AM-PM contained; independent panel resizing at a fixed viewport shrinks/grows the digit width proportionally. Visual mobile/wide-mobile/tablet captures inspected at 393/600/768px. CSS container query units require a browser supporting size containers, including current mobile Safari; physical-iPhone acceptance remains appropriate.

Files: existing css/digital-clock.css, tests/browser/light-mode-regression.spec.js and this report. All release boundaries remain unchanged; no commit/push/PR/merge/deployment.

Final combined validation after container scaling: **68/68 browser checks PASS**. New spec syntax and git diff --check PASS. Safe LAN preview returns HTTP 200.

## Landing AM/PM readability follow-up

Increased launcher-only `.ampm` letter spacing to `0.08em`; font size continues scaling with its container. Main Digital Clock unchanged. Ten responsive container/representative-time checks PASS in both themes and browser projects; git diff --check PASS. No commit/push/PR/merge/deployment.

## Shipping authorization and acceptance — 2026-10-06

Rolando's final shipping attachment confirms physical-iPhone acceptance PASS for all five original areas, including Safari's VFGT control, and explicitly authorizes commit/push/PR/merge plus normal automatic Pages verification. The actual final report and prior directly requested launcher follow-ups define the accepted frozen tree: square cards, bounded VFGT summary, equal launch-button gutters, container-relative launcher time and `0.08em` AM/PM spacing. These launcher refinements intentionally apply in both themes; app-specific dark-mode control/segment/surface styles remain equivalent to the original HEAD. Earlier pending-review/local-only statements above describe the historical validation phase and are superseded by this authorization. No feature changes during shipping.
