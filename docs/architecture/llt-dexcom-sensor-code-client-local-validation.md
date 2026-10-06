# LLT Dexcom sensor code — client implementation and local validation

2026-10-06. Client implementation complete, automated local validation PASS. **Physical-iPhone acceptance pending; nothing committed or shipped.** Production was not accessed or changed in this phase.

## Repository, authority and representation (items 1–9)

1. Branch: `fix/llt-post15-ui-dexcom-code`; current accumulated cleanup worktree retained, no restart from main.
2. HEAD: `b3c734c024b81e5bda528f2e438414d416678a6c`.
3. Git status: existing dirty accepted cleanup/untracked diagnostic artifacts preserved; nothing staged. Phase 4 changes three existing sensor JS files, sensor application/browser tests and the isolated sensor-code DB test, plus this new report. Existing modified root #14.5 report, CSS, tracker, Low Glucose browser test and sensor DB infrastructure remain byte-identical. Unrelated diagnostic reports/DONC/local Supabase config/review SQL/earlier reports retained.
4. Accepted six cleanup items preserved: summary rows, native date/time containment, semantic replacement review, secure UUID fallback, timeline hierarchy and responsive Edit Recheck. Initial hashes `/private/tmp/llt-code-phase4-preservation.json`: all 83 files outside the six intended existing-file changes byte-identical. No reset/clean/discard/branch switch.
5. All four authoritative artifacts read: architecture review, exact migration, isolated DB-validation report, production-installation report. Migration SHA-256 remains `6e179a31ee794d6a3480b76e185c3b635818bb38a25b2eae98803af383b77292`. These artifacts were not rewritten.
6. Installed contract: single mutation with original nine inputs plus optional `p_sensor_code text DEFAULT NULL`; only coded start/replacement supplies it. JSONB snapshot includes non-null `sensor_code`, omits null. Existing targeted edit/undo retains each row's code and canonical omitted/null old requests remain compatible.
7. **Naming reconciliation:** architecture/current model explicitly recommends retaining raw cycle `sensor_code`, despite the brief's conceptual camelCase example. `sensorCode` is the form/draft/request option; DB/snapshot/cache cycle uses `sensor_code`. No new normalized parallel model/property or same-revision snapshot mutation.
8. Hydration: domain validates present non-null code as exact four ASCII characters; absent/null legacy fields remain valid. Returns the original snapshot unchanged. Refresh/connect/cache paths already preserve whole cycle objects, including leading zeros and absent-field shape.
9. Serialization: optional `sensorCode` request option validates string and maps to `p_sensor_code` for start only; omitted/null excludes the parameter. Existing pending-request storage/retry/account/revision/Realtime paths retained. No numeric coercion of code. Local-only fixture mirrors code validation, code-aware receipt retry, new-row storage and null omission; no new storage key or separate code sync engine.

## Form and display results (items 10–22)

10–13. New Sensor has date, time, then associated **Sensor Code** label and concise helper. Text input, numeric inputmode, `[0-9]{4}` pattern, maxlength 4, required, autocomplete off. Shared validator checks string type, length exactly 4, ASCII regex; rejects empty, short/long, spaces, signs, letters/exponents, non-ASCII digits and newline. Error: “Enter the 4-digit sensor code.” No trim, digit stripping or numeric conversion. Leading zeros preserved. Native text controls themselves strip line breaks; domain/RPC validation separately rejects newline-containing programmatic strings. Browser invalid-value tests do not pretend the DOM can retain a stripped newline.
14. New review explicitly shows New sensor → `Dexcom G7 · 2345`, then start date/time, before Save.
15–16. Replacement collects a new code, starts blank rather than copying current cycle, and shows distinct New sensor/New sensor starts/Current sensor/Current sensor started rows. Each label uses its own code. Existing consequence sentence and Save/Cancel retained.
17–19. One tiny domain label helper renders active/collapsed/expanded title `Dexcom G7 · 2345`; no badge/color/layout redesign. Countdown/disclosure unchanged. Responsive title-versus-chevron geometry checked.
20–21. Details includes current cycle identity; every current/closed/cancelled history entry uses its own raw cycle code. Cancelled replacement keeps 0042 while Undo restores 2345 on predecessor; no active-code substitution across history.
22. Legacy absent/null code displays plain `Dexcom G7`, with no placeholder/warning/fabricated value. Existing synthetic legacy responsive cases still pass. Production's previously verified no-code cycles remain untouched and will display plain labels.

## Lifecycle, sync and preservation (items 23–33)

23. Edit Start Time has no code field and request omits parameter; coded current and predecessor remain intact in fixture and actual isolated DB/PostgREST.
24. Undo logic unchanged; correct predecessor/code restored, cancelled replacement retains its own code in history. Local browser and DB integration PASS.
25. Two actual client instances round-trip coded start/replacement through disposable PostgREST and DB, then second-device refetch displays correct identity. Existing Realtime invalidation unit harness refetches coded snapshot. Two isolated browser tabs follow normal storage/resume path through start/replace/undo. No live production or physical Realtime claim.
26. Complete cycle cache/offline restore retains 0042; coded pending request persists exact string/operation ID and identical lost-response retry; no new code-only key or snapshot normalization.
27. Existing clinical backup/export does not include authoritative sensor dataset/receipts. No new backup architecture; existing owner-scoped sensor cache/server refetch remains recovery path. Clinical backup behavior unchanged.
28. Existing secure UUID generator untouched: native randomUUID when present, getRandomValues RFC4122 fallback when absent; no Math.random fallback. Browser lifecycle/save regression forces randomUUID unavailable and checks persisted cycle/operation UUIDs; unit native/fallback/error cases pass.
29–30. Date/time CSS byte-identical; all three controls checked contained and focusable at 320/393/768/1280 widths and both themes. Replacement review remains semantic stacked rows, Save/Cancel reachable. Screenshots visually inspected at narrow mobile widths.
31–33. Low Glucose summary/timeline/Edit Recheck source/CSS byte-identical. All existing episode/calculation/sync/typography/mobile-width browser checks pass. No clinical policy, insulin, timer, countdown, duration/grace/reminder or security change.

## Validation (items 34–47)

| Check | Final result |
| --- | --- |
| Full `npm test` | **540 passed**, 0 failed/skipped; baseline 519 + 21 sensor-code client checks |
| Opt-in isolated sensor-code DB suite | **50 passed**, 0 failed/skipped; prior 49 + current client/PostgREST/DB integration |
| Existing sensor PostgreSQL regression suite, invoked on upgraded disposable DB | **38 passed**, 0 failed/skipped |
| Broader isolated Low Glucose database suite | **82 passed**, 0 failed/skipped |
| Sensor + Low Glucose browser suites, desktop/mobile Chromium | **56 passed**, 0 failed; baseline 52 + two new cases across two projects |
| Syntax/static | `npm run check:js`, explicit new DB test syntax, `git diff --check` PASS |

38–40. Existing sync/revision/account/cache/concurrency and secure UUID tests retained. New pending/retry/cache/refetch tests pass. Low Glucose numeric/UI typography checks in both themes pass; no broad font/CSS reset.
42. Associated code label/helper, concise role-alert validation, native required/pattern semantics, keyboard focus/access, logical review reading order, semantic existing buttons/disclosure preserved. Identification conveyed as text, not color.
43–47. Automated iPhone-width (320/393), tablet (768), desktop (1280), landscape and light/dark checks pass. Existing date/time native reset unchanged; numeric keyboard **semantics** verified, actual iOS keyboard/picker/device behavior awaits physical acceptance. Visual inspection of generated 393 dark input and 320 light review screenshots found contained readable controls and distinct rows.

Initial full-unit attempt hit sandbox loopback listen EPERM; rerun with required local-server permission passed. Initial browser run: 53 passed/3 failed. One geometry check read a closed card during asynchronous rendering, so it now establishes expanded visibility before measuring; disclosure open/close assertions retained. Two invalid-input tests included newline that a native text input strips to valid digits; removed that browser-only impossible retention assumption, kept newline rejection in domain/DB tests. Final full 56-case run passed without weakened structural assertions. No app layout/CSS change made to mask test failure.

Actual browser form/review/display is exercised against isolated dev fixture; separately the same current client request/hydration code is exercised through actual isolated PostgREST/DB. Browser fixture is not described as a browser-to-production or browser-to-DB connection. Dedicated local DB/API resources removed by harness; shared local Supabase application DB not repurposed.

Logs: `/private/tmp/llt-code-phase4-unit.log`, `llt-code-phase4-db.log`, `llt-code-phase4-broader-db.log`, `llt-code-phase4-browser-final.log`, `llt-code-phase4-static.log`. Intermediate browser failure evidence remains in initial log. Screenshots from final browser run under ignored `test-results/`; no pairing codes written to production/generic diagnostics.

## Preview and boundaries (items 48–57)

48. **HTTP LAN preview left running:** `http://172.20.10.9:8000/#/lee-lees-tracker`. Existing dev-iphone server PID 97547 was bound to retired address 172.22.19.198 and timed out; current en0/default route is 172.20.10.9. Stopped only that identified stale server and restarted the same `node scripts/dev-iphone.mjs --port 8000` workflow, preserving fixed port and all application data. Served metadata confirmed `local-device`; LOCAL DEV banner present; served sensor UI SHA matches local bytes. Same network required; no auth/production sync or service worker in this isolated preview. Existing browser state on a different origin is not copied/reset. Generated ignored local-device metadata is intentional for this review preview; desktop test servers must supply their normal metadata when testing later.
49. Production DB/schema changes: NONE; no production connection/query in this phase.
50. Production sensor/clinical data changes: NONE.
51. Production permissions/Category B/#15 guard changes: NONE.
52. Commit: NO; nothing staged.
53. Push: NO.
54. PR: NO.
55. Merge: NO.
56. Deployment/release/service-worker bump: NO.
57. Limitations: physical-iPhone acceptance pending; live production coded sensor/Realtime/PWA/offline deployment not tested. Browser numeric-input semantics cannot prove native keyboard. All codes/users/cycles exercised locally are synthetic. No Edit Sensor Code path/MVP backfill implemented. Existing unrelated artifacts remain unchanged. Local safe fixture does not claim comprehensive database equivalence beyond targeted validated paths.

## Physical-iPhone acceptance checklist (item 58)

Use the **LOCAL DEV** URL above on Safari, on the same network. Review only synthetic local sensors.

1. Open New Sensor; date, time and Sensor Code fields visible/contained.
2. Tap Sensor Code: numeric keyboard; enter 2345.
3. Review: New sensor `Dexcom G7 · 2345`; start date/time clear; Save/Cancel reachable.
4. Save succeeds over HTTP LAN; active title shows 2345.
5. Collapse/expand: title/code/remaining time/chevron fit without horizontal overflow.
6. Details & History: current cycle shows its own code.
7. Replace using 0042 and a valid later start; form does not copy current code.
8. Review clearly distinguishes new 0042 from current 2345; readable consequence rows.
9. Save: active title shows **0042**, previous history retains 2345; refresh preserves leading zeros.
10. Edit Start Time: no code field; save/refresh preserves 0042.
11. Undo replacement: restores previous 2345; cancelled 0042 remains identifiable in history.
12. Legacy synthetic sensors remain plain Dexcom G7 when no code exists.
13. Recheck all accumulated cleanup: date/time containment, replacement review, HTTP UUID save, Low Glucose summary rows/timeline and full-width mobile Edit Recheck. Review both themes as practical.

59. Recommendation: await Rolando's complete physical-iPhone PASS, then separately authorize final shipping workflow. No Git or production action is implied by this local review readiness.

LLT DEXCOM SENSOR CODE + POST-#15 CLEANUP — READY FOR FINAL PHYSICAL-IPHONE REVIEW
