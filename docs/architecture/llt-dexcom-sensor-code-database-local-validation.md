# LLT Dexcom sensor code — database implementation and isolated validation

2026-10-06. **LOCAL DATABASE CONTRACT ONLY. Production installation and client sensor-code implementation are not authorized or performed.**

## Result

Implemented the approved nullable sensor-cycle column, single-signature RPC evolution, null-omitting snapshot projection and compatibility tests. The accepted UI/UUID work remains byte-identical. One focused migration is ready for review, not production execution.

## Required report

1. **Starting branch:** `fix/llt-post15-ui-dexcom-code`; remained on it.
2. **Starting HEAD:** `b3c734c024b81e5bda528f2e438414d416678a6c`.
3. **Git status:** pre-existing accepted cleanup source/tests and modified #14.5 report retained; unrelated untracked diagnostic reports, DONC directory, review SQL and local Supabase configuration retained. Nothing staged. This phase adds one migration, one test suite and this report, and changes existing sensor DB test infrastructure only.
4. **Accepted cleanup:** hash verification proves all previously modified files remain unchanged by this phase, including Low Glucose summary/timeline/mobile actions, Dexcom containment/review, secure UUID helper and accepted browser/application tests. No reset/clean/branch restart.
5. **Authority:** complete `docs/architecture/llt-dexcom-sensor-code-architecture-review.md` read and followed, including null snapshot omission, old receipt canonicalization and non-overloaded optional parameter strategy. Architecture report not edited.
6. **Migration filename:** `supabase/migrations/202610060002_add_llt_sensor_code.sql`; selected after inspecting actual sequence ending with `202610060001_guard_lee_lee_low_glucose_writes.sql`.
7. **Files:** only that new migration; `tests/llt-sensor-code-database.test.js` (new opt-in isolated harness); `tests/llt-sensor-database.test.js` (validated optional disposable DB name, unchanged regression assertions); this report. No package/runtime file changes.
8. **Table changed:** `public.llt_sensor_cycles` only. Context/operation schema unchanged.
9. **Column:** `sensor_code text NULL`, no default. Comment records optional four ASCII digit physical sensor metadata/leading-zero preservation.
10. **Constraint:** `llt_sensor_code_four_ascii_digits`: NULL OR `char_length(sensor_code)=4` AND `(sensor_code COLLATE "C") ~ '^[0-9]{4}$'`. ASCII-only, no issuance-range inference.
11. **NULL:** legacy rows and omitted/explicit-null calls accepted; no fake codes. Null column omitted from outward snapshots. Existing legacy row remains unchanged at the same revision.
12. **Leading zeros:** `0042` persists and round-trips exactly as text; `0000`, `2345`, `9999` accepted.
13. **Functions changed:** internal `llt_sensor_snapshot_for_user(uuid)` same-signature replacement; `llt_mutate_sensor_cycle` changes from nine inputs to one ten-input signature. `llt_get_sensor_snapshot()` unchanged.
14. **Old calls:** defaulted trailing parameter preserves old named/positional nine-argument requests. Actual shipped domain/sync loaded from `git show HEAD:...`, hydrates legacy cached state at the same revision, builds/submits its actual nine-key request successfully. Dedicated actual PostgREST tests verify old named JSON dispatch.
15. **New contract:** original nine names/order/types retained, append `p_sensor_code text DEFAULT NULL`; jsonb return envelope unchanged. Supplied valid non-null code permitted only for start; invalid code rejects before context/receipt creation. Non-start supplied code rejects. Null remains accepted for legacy compatibility; modern UI requirement will be implemented in a separate client phase.
16. **Security before/after:** mutation SECURITY DEFINER retained; getter definer retained; internal snapshot SECURITY INVOKER retained. Auth.uid, ownership/user scoping, expected revision/pointer, context row lock, audit/retry and unexpected-error rollback unchanged.
17. **Owners:** all three functions and tables remain postgres in isolated catalog checks; migration checks mutation owner/security and postgres execution before changes, and explicitly restores mutation owner after recreation.
18. **Search path:** all sensor functions retain explicit empty search_path. Preflight guard rejects mismatched owner/definer/search-path contract.
19. **Grants:** normalized function ACLs and effective grants match before/after. Recreated ten-input mutation explicitly revokes API/PUBLIC defaults then grants authenticated only; no new anon/PUBLIC/service_role execute. Internal snapshot remains owner-only. Table grants unchanged.
20. **RLS/policies:** same owner-only authenticated SELECT policies and enabled RLS; browser direct INSERT/UPDATE/DELETE remains denied. Security fingerprint compares table ACL/RLS/owners, policies, function ACL/security/return types, indexes and non-internal triggers.
21. **Snapshot:** null code removed from cycle JSON using CASE and `to_jsonb(c)-'sensor_code'`; non-null code preserved. Ordering/head/revision unchanged. Audit whole-row snapshots still include code naturally.
22. **Reason:** old sync compares serialized snapshots at equal revisions. Merely exposing an added null field would make unchanged cached legacy state look inconsistent. No artificial revision bump or cache reset used.
23. **Legacy snapshot:** exact structural and JSON.stringify equality against pre-migration snapshot, at same revision. Dedicated actual shipped-sync cache test succeeds. Old pending/receipt retry succeeds without rewriting old operation request.
24. **Coded snapshot:** exact non-null string appears in current/history cycle; old domain validator accepts it. Direct row SELECT remains permitted/owner-scoped by unchanged policies.
25. **Old client/new DB:** reads, starts, replacement, edit_start, undo and named/positional resolution pass. Old start creates NULL code as designed.
26. **Old client/coded row:** edit_start preserves code; replacement closes old code-bearing row without altering it and creates NULL-coded new row; undo restores previous code and retains cancelled replacement. No wholesale replacement of old row.
27. **New DB call:** coded start and replacement work, code is string, 0042 survives. No JS sensor-code UI/payload changes used or claimed.
28. **Replacement:** synthetic A=1234/B=0042 tested; each retains its own submitted code. Legacy replacement never copies old code.
29. **Edit Start Time:** targeted current start and previous boundary edits preserve codes on both rows.
30. **Undo:** actual targeted cancellation/restoration retains correct code on current/cancelled/predecessor rows. No audit-based row reconstruction introduced.
31. **Concurrency:** dedicated simultaneous coded replacements via actual PostgREST produce one accepted and one conflict, with two total cycles and correct winning code. Existing first-start/replace/edit/undo races and ABA/stale-pointer/version scenarios rerun on upgraded DB.
32. **Idempotency:** supplied non-null code appended to canonical request; omitted/null preserves old request shape. Identical coded requests replay; same ID/different code rejects operation_id_reused. Existing pre-migration receipt replay and old omitted versus explicit null replay tested.
33. **Unauthorized writes:** missing auth raises; foreign user cannot see/mutate another user's cycle; direct write grants absent; code cannot bypass auth. Existing comprehensive security regressions pass.
34. **Existing sensor DB tests:** 38 passed, 0 failed, 0 skipped on upgraded fresh DB. Only harness target selection added; all existing assertions retained. Child test runner inheritance removed in invoking harness and positive executed-test/zero-skip assertions prevent silent non-execution.
35. **Sensor-code suite:** 49 passed, 0 failed, 0 skipped. Includes 48 schema/contract scenarios plus one check invoking the 38 existing regressions. Matrix covers five valid values (DB+RPC), 13 invalid values (DB+RPC), snapshots/replay, code preservation, signatures/security, rollback, shipped client, API dispatch and concurrency. Synthetic codes only.
36. **Broader DB suite:** `LLT_LOCAL_LOW_GLUCOSE_DB_TEST=1 node --test tests/llt-low-glucose-database.test.js`: 82 passed, 0 failed, 0 skipped in a separate disposable database. This unchanged harness reconstructs the existing LLT history up to its approved guard; it does not apply sensor-code migration there. Sensor-code interactions are validated separately above.
37. **Full units:** `npm test`: 519 passed, 0 failed (4.3s).
38. **Browser:** unchanged Low Glucose + sensor suites: 52 passed, 0 failed (34.8s), desktop/mobile Chromium, accepted responsive/theme/typography/UUID persistence regressions. No new code UI tested or claimed. Known unrelated historical baseline browser failures not rerun/reclassified.
39. **Static/SQL:** `npm run check:js`, explicit `node --check tests/llt-sensor-code-database.test.js`, existing DB test syntax and `git diff --check` pass. Exact migration parses/applies on isolated PostgreSQL 17.6. Dedicated local PostgREST v16.1 uses both old/new named bodies. No same-name overload survives. NOTIFY pgrst reload schema is transaction-bound.
40. **Manual audit:** mutation body compared to shipped SQL: only added optional parameter, shape validation, conditional canonical code entry and start INSERT column/value. All existing state transitions/locks/constraints/audit logic unchanged. Snapshot projection and exact function grant/ownership maintenance reviewed. Migration begins/commits atomically; RESTRICT, never CASCADE.
41. **Indexes:** NONE added; existing index fingerprint unchanged.
42. **Triggers:** NONE added; no preservation trigger required.
43. **New tables:** NONE.
44. **Backfill:** NONE. Migration contains no data repair/rewrite or fabricated codes; legacy snapshot/revision/receipt remain intact. Physical sensor table relfilenode checked unchanged across migration. CHECK validation still scans and ALTER requires locks; this is not a zero-lock promise.
45. **Real codes:** NONE accessed; no production connection/configuration/row query. All codes and users synthetic.
46. **Sensor Code client UI:** NOT IMPLEMENTED.
47. **Dexcom G7 · 2345 display:** NOT IMPLEMENTED.
48. **Accepted UI:** byte-identical, prior physical PASS retained. Architecture/current prior reports not overwritten. No new physical acceptance requested.
49. **Production schema:** unchanged; no production access in this phase.
50. **Production data:** unchanged.
51. **Production permissions:** unchanged.
52. **Category B:** untouched. No table/default-privilege hardening. Exact reviewed mutation signature ACL maintenance only. Existing broad LLT DB regression confirms guard behavior remains intact.
53. **Commit:** NO.
54. **Push:** NO.
55. **PR:** NO.
56. **Merge:** NO.
57. **Deployment:** NO; release/service-worker untouched.
58. **Limitations:** no live metadata/install proof; no client sensor-code validation/display/sync UI implementation. Database snapshot/API and shipped-client compatibility proven, but new code-bearing family-device Realtime/PWA behavior remains future client acceptance. Existing shared local Supabase API/Realtime test was not pointed at production or repurposed; dedicated disposable PostgREST supplies actual named-RPC proof. The actual production PostgREST version/schema cache, locks/dependencies/default ACLs and manual-install ledger must be checked before production approval. Do not treat schema-only local tests as production acceptance.
59. **Next preflight:** read-only metadata first: verify exact existing nine-input mutation definition/owner/definer/empty search_path/ACL and no overload; snapshot/getter definitions/ACL; sensor columns/constraints/indexes/triggers/RLS/policies/effective grants; unexpected dependencies; publication membership; server/PostgREST versions and lock budget. Confirm code column absent, migration not already installed, and effective manual schema history coherent with recorded sensor/#15 artifacts. Compare reviewed exact new migration SHA below. Do not blindly db push, replay unrelated files or repair ledger. Any drift stops. Only separately authorized single-file production installation may follow; afterward verify exact catalogs/grants and API cache without real sensor writes. Client implementation remains separate approval.
60. **Final status:** database contract ready for production-migration review, not installed or shipped.

## Isolation, negative proofs and reproducibility

`tests/llt-sensor-code-database.test.js` is opt-in with `LLT_LOCAL_SENSOR_DB_TEST=1`. It uses a fixed local Docker executable/container and Unix-socket psql; database name is generated `llt_code_test_<pid>_<timestamp>`, never a remote URL. Scaffolds only external auth/publication prerequisites then applies original sensor migration and this exact migration. Local temporary login role and dedicated PostgREST container connect only to that fresh DB on existing local Docker network; HTTP binds loopback with a random port. JWT test secret is synthetic, not production configuration.

Before migration: ten-argument sensor-code call fails (function absent). Counterfactual ADD COLUMN without snapshot adjustment exposes NULL at unchanged revision and makes old/new serialized snapshots unequal; transaction rolled back. Then a temporary dependent view proves DROP RESTRICT blocks replacement and rolls back new column/snapshot DDL; remove only that synthetic view and apply exact candidate. Post-migration repeat intentionally fails/rolls back, preserving installed security. Migration is not intended to be blindly replayed.

Cleanup removes disposable DB with FORCE, its dedicated PostgREST container and its temporary login role. Existing curated application DB/server remains unmodified by the sensor-code harness. Broader Low Glucose harness also removes its own fresh DB. Final local catalog/container checks confirm no temporary sensor-code resources remain.

Commands:

```sh
LLT_LOCAL_SENSOR_DB_TEST=1 node --test tests/llt-sensor-code-database.test.js
LLT_LOCAL_LOW_GLUCOSE_DB_TEST=1 node --test tests/llt-low-glucose-database.test.js
npm test
npm run check:js
node --check tests/llt-sensor-code-database.test.js
LANDOS_WORLD_SMOKE_PORT=8876 npx playwright test tests/browser/llt-low-glucose.spec.js tests/browser/llt-sensor-tracker.spec.js
```

Exact migration SHA-256: `6e179a31ee794d6a3480b76e185c3b635818bb38a25b2eae98803af383b77292`.

Evidence logs: `/private/tmp/llt-code-db-final.log`, `/private/tmp/llt-code-broader-db.log`, `/private/tmp/llt-code-unit.log`, `/private/tmp/llt-code-static.log`, `/private/tmp/llt-code-browser.log`. Source-preservation hashes: `/private/tmp/llt-code-phase2-hashes.json`. No weak UUID fallback or source/UI edits introduced.

Rollback concept: retain the additive column/compatible RPC if client rollout is paused/reverted; never drop recorded codes/receipts. Returning to old nine-input signature while future clients/pending coded requests exist requires separate reviewed coordination. Failed DDL transaction naturally restores pre-migration objects, proven by dependency test.

LLT DEXCOM SENSOR CODE DATABASE CONTRACT — READY FOR PRODUCTION-MIGRATION REVIEW
