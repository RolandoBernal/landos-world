# LWDC time-display visual consistency

## Starting state

Started on `main`, HEAD `379a78ae2b04dfa994fd51735a2b79528e6fe824`. Fetched origin/main; HEAD, local main and origin/main match. PR #146 is MERGED at this SHA: iMT/VFGT accepted polish is shipped, not pending locally. Current local report append for that release is unrelated and preserved. Created dedicated branch `fix/lwdc-time-display-palette` from synchronized main.

Unrelated starting files include the modified LLT Issue 14.5 report and the two final shipping reports, untracked LLT diagnostic reports, VFGT report, DONC tree, LLT architecture/SQL files, and Supabase configuration files. None was edited, staged, reset, cleaned, or discarded. Current inventory (includes the new focused test):

```
 M LLT_ISSUE_14_5_ALERTS_DEXCOM_TRACKER_REPORT.md
 M docs/architecture/imt-vfgt-post-release-ui-polish-final-shipping.md
 M docs/architecture/landos-world-light-mode-regression-final-shipping.md
?? LLT_INSULIN_PLAN_RECONCILIATION_DRY_RUN_REPORT.md
?? LLT_INSULIN_PLAN_RECONCILIATION_EXECUTION_REPORT.md
?? LLT_INSULIN_PLAN_SERIALIZATION_AND_STATE_REPORT.md
?? LLT_INSULIN_PLAN_SYNC_SAFETY_AUDIT.md
?? LLT_INSULIN_PLAN_VERIFICATION_RELEASE_READINESS_REPORT.md
?? LLT_INSULIN_PLAN_VERIFICATION_UX_RELEASE_CANDIDATE_REPORT.md
?? LLT_SETTINGS_DIAGNOSTICS_UX_IMPLEMENTATION_REPORT.md
?? LSW_LOCAL_PROD_DIAGNOSTIC_REPORT.md
?? VFGT_ISSUE_3_LANDING_CARD_IMPLEMENTATION_REPORT.md
?? death-on-notecards/
?? docs/architecture/llt-post15-dexcom-sensor-code-final-shipping.md
?? docs/architecture/llt-sensor-cycles-REVIEW-ONLY.sql
?? supabase/.gitignore
?? supabase/config.toml
?? tests/browser/lwdc-display-consistency.spec.js

```

## Investigation and comparison before implementation

The requested runtime result **already exists in the current shipped implementation**. No runtime style change is needed or made. This is a verification/coverage pass, not a new visual modification.

Landing markup is built in `index.html` by the launcher renderer: `.clock_utility_local_time` contains `.clock_utility_local_time_value.digit_clock_time`. Internal markup is `#clock-view .digit_clock_time`, reused for Nashville, Puerto Vallarta, Tepic, and Vancouver. The same `renderSevenSegmentDigit`/time renderer handles their segment mapping.

`css/digital-clock.css` supplies the shared display-background rule and segment rules. `css/app-themes.css` `.app_theme--digital-clock` supplies existing accent `#3dff8a` and RGB `61 255 138`. Both reference and internal time surfaces inherit these exact tokens.

| Property | Landing display | LWDC current | Target/result |
| --- | --- | --- | --- |
| Background | radial-gradient(circle at top right, rgb(61 255 138 / 16%), transparent 9rem), rgb(61 255 138 / 7%) | Same shared rule and computed colors/image | Already identical |
| Lit segments | currentColor → #3dff8a in dark mode | Same token/color | Already identical |
| Unlit segments | rgba(55, 60, 57, 0.497) | Same value in dark mode | Already identical |
| Glow/shadow | scoped --vfgt-segment-glow: none | same override; segment/colon box-shadow none | Already crisp/no glow |

The background layers are translucent; their final composite can differ because the surrounding landing utility card has its own green gradient while the app preserves its outer background. The requested display CSS values match exactly. Copying the outer card gradient would change a separately protected surrounding surface and is not necessary to align the time-display palette.

Implementation choice: **retain the existing shared rule, theme tokens, segment mapping, and scoped no-glow override unchanged**. No duplicated declarations, new tokens/component/theme architecture, or stylesheet-query/version bump. Preserve the intentional light-mode override: lit/digit foreground `#087a3a`, unlit segments transparent. AM/PM, city labels, both dates, weather text, geometry, card borders, dimensions, wrapping, spacing, navigation/settings, timing/timezones/storage remain unchanged. All four internal clock instances are covered, not just Nashville.

No runtime CSS, HTML, JS, service-worker, cache identity, other app source, database, or production change.

## Exact files added

- `tests/browser/lwdc-display-consistency.spec.js`
- `docs/architecture/lwdc-time-display-visual-consistency.md`

## Validation

- Full unit suite: **540 passed, 0 failed** (`/tmp/lwdc-consistency-unit.log`). No Digital Clock-specific unit suite exists; the relevant renderer/layout validation is browser-based.
- Browser: **74 passed, 0 failed**: 72 clock/landing/light regression/ecosystem checks plus two requested representative-time checks. This includes **10 focused new checks** across desktop/mobile Chromium. Logs: `/tmp/lwdc-consistency-browser.log`, `/tmp/lwdc-consistency-times.log`.
- All digits 0–9 render their expected lit segment counts (6,2,5,5,4,5,6,3,7,6), exact lit/unlit colors, and crisp segments across all four clocks. Requested times 1:11, 8:08, 10:07, 12:58 pass renderer mapping/no-glow checks. Existing browser cases also cover centered/contained representative time layouts.
- No segment or colon box shadow, text shadow, filter, or before/after pseudo-element content; time-display ancestor filter/text shadow none. No SVG filter/duplicated luminous layer in the span-based renderer. Outer card shadows remain as requested.
- Dark mode: palette matches landing exactly. Light mode: accepted dark-green foreground/transparent inactive behavior passes across all four clocks; prior light sweep tests pass.
- Responsive: narrow 320, wider 430, tablet 768, desktop 1280 px in both browser projects. Existing clock tests verify square desktop cards, representative-value containment/centering, mobile settings behavior, launcher square/gutters/scaling. Geometry and layout are unchanged because no runtime declaration changed.
- Static: `npm run check:js` PASS; focused test syntax PASS; `git diff --check` PASS. No unrelated source diff.
- Visual: inspected unchanged dark internal clock at 393×852 (`/tmp/lwdc-consistency-dark.png`); light screenshot `/tmp/lwdc-consistency-light.png`. Screenshots remain outside the repo. Physical Safari acceptance is pending.
- Known six VFGT failures: not encountered in this targeted passing selection; prior release accounted for them. They remain outside scope and were neither rerun nor fixed here. No new failures appeared.

## Preview and boundaries

Safe HTTP LAN preview (restored on the same port after en0 changed from 10.0.0.160 to 172.22.19.198): **http://172.22.19.198:8000/#/digital-clock**. Landing comparison: **http://172.22.19.198:8000/**. Same LAN/Wi-Fi required. Preview remains running. Device-preview auth/sync safeguards retained; no real app data changed.

Database changes: **NONE**. Production changes: **NONE**. LLT Issue #12: **NONE**.

Commit: **NO**. Push: **NO**. PR: **NO**. Merge: **NO**. Deployment: **NO**.

## Physical-iPhone review checklist

LWDC — INTERNAL CLOCK DISPLAY

1. Open Lando's World Digital Clock.
2. Inspect the internal time-display card.
3. Confirm the time-card background now visually matches the dark-green background of the Lando's World landing-page Digital Clock display.
4. Confirm active/lit segments use the same bright-green visual treatment as the landing display.
5. Confirm inactive/unlit segments use the same muted/dark-green visual treatment as the landing display.
6. Confirm the time digits are CRISP.
7. Confirm there is NO glow/bloom/blur around the seven-segment numbers.
8. Confirm active segments remain immediately readable.
9. Confirm inactive segments remain visually subordinate.
10. Confirm digit geometry is unchanged.
11. Confirm AM/PM remains unchanged.
12. Confirm Nashville remains unchanged.
13. Confirm both dates remain unchanged.
14. Confirm Current Weather remains unchanged.
15. Confirm card sizing/layout remains unchanged.

LANDING PAGE

16. Return to Lando's World landing page.
17. Inspect the Digital Clock card.
18. Confirm its existing display appearance has NOT changed.

LIGHT MODE, IF APPLICABLE

19. Switch to light mode.
20. Confirm the previously accepted Digital Clock readability remains intact.
21. Confirm active segments remain clearly readable.
22. Confirm inactive-segment behavior remains appropriate to the accepted light-mode design.
23. Confirm no new glow appears.

## Final status

Requested visual styling is already present; no runtime style change was introduced. Local verification passes; ready to confirm the current appearance on physical iPhone.

LWDC TIME-DISPLAY VISUAL CONSISTENCY — READY FOR PHYSICAL-iPHONE REVIEW

## PR shipping handoff

Rolando requested “Ship it” after the local validation handoff. Under AGENTS.md, this authorizes committing/pushing the dedicated branch and opening a PR for review; merge/deployment remain gated. This PR contains only regression coverage and this investigation report. Runtime styles already satisfy the request and remain unchanged. Validation evidence remains 540 passing units and 74 passing selected browser checks; the complete ten-check focused suite was revalidated before commit. No service-worker/version bump is needed for tests/docs. Unrelated working files remain excluded and preserved.
