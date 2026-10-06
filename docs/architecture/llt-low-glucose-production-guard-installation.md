# LLT #15 Phase 2C.2 — production guard installed and verified

Verification completed 2026-10-06 04:53 UTC. Earlier stopped preflight and privilege investigation reports are preserved. Category B was explicitly accepted by the Phase 2C.2 user brief. Only the reviewed guard SQL was applied; client implementation remains paused pending separate authorization.

## Resumed preflight (1–24)

1. Branch: `feature/llt-low-glucose-episodes`.
2. HEAD: `d30936fc3f78946448a4294961a4dfacd0623da6`, unchanged.
3. Git status: before matched the reviewed checkpoint (existing modified Issue 14.5 report, unrelated untracked diagnostic reports/DONC/sensor SQL/Supabase local configuration, and five #15 artifacts). After adds only this report. Nothing staged. No reset/clean/discard performed.
4. Full Phase 2B local validation report reviewed; actual migration and opt-in database tests inspected. Accepted results remain 81 isolated database tests, 455 unit tests, and identical 18-pass/6-failure browser results on branch and unchanged main. No production behavioral test was substituted for these local results.
5. Original production preflight report reviewed in full; historical STOP retained.
6. Privilege investigation reviewed in full; historical Category B retained.
7. Category B acceptance acknowledged: extra PostgreSQL privileges are disclosed and accepted for this guard under the inspected normal browser/API model.
8. No privilege cleanup performed.
9. Migration: `supabase/migrations/202610060001_guard_lee_lee_low_glucose_writes.sql`.
10. SHA-256: `7722232038f4c1d76cb170c897221f534453dcbe954b502fcc10bb6b8cfcc933`. Bytes equal the exact SQL block in the approved Phase 2B report. Hash rechecked after installation; migration unchanged.
11. Production identity: authenticated Firefox dashboard showed Lando’s World / lee-lee-tracker / main PRODUCTION before any resumed SQL. No secret credentials or connection strings accessed or printed.
12. Established workflow: documented SQL Editor full-file application in docs/SUPABASE_SETUP.md section 3. This existing workflow supports an individual reviewed migration without automatically applying other files.
13. Workflow permits installation without commit/merge. No Supabase CLI push/link or repository shipping attempted.
14. Table contract PASS: explicit expected-name/type comparison returned zero mismatches across 27 record columns, including all guard references. Earlier report’s “28” count was a counting error; its listed contract and the actual columns are the same. No relevant schema mismatch discovered. No clinical field values retrieved.
15. RPC contract PASS: one function; all 24 argument names and types match. Return type lee_lee_records. Body MD5 `6f061a0cab1538d83be4db9212f829ea` matches the locally tested checked-in body. Authentication, owner predicate, expected version, wholesale payload replacement, version increment and returned composite behavior unchanged. SECURITY DEFINER, empty search_path; EXECUTE authenticated true / anon false; ACL `{postgres=X/postgres,authenticated=X/postgres}` excludes PUBLIC.
16. RLS enabled. Existing authenticated owner SELECT/INSERT policies retained; no UPDATE/DELETE policy.
17. Application path remains direct owned INSERT and versioned RPC UPDATE. Effective direct UPDATE and DELETE grants false; SELECT/INSERT true. Accepted extras remain in the same table ACL.
18. No newly exposed SQL bypass found: public function catalog and known bodies rechecked against the immediately preceding accepted investigation; no new function appeared before installation. graphql_public still has one wrapper returning extension-not-enabled. Prior inspected exposed schemas public/graphql_public and standard Data API path remain the accepted boundary. No browser SQL execution or production test write used.
19. Guard function absent before installation.
20. Guard trigger absent before installation. Existing updated_at trigger was the sole non-internal record trigger.
21. Pre-install marker count: **0**, covering SQL context, payload context, or presence of lowGlucoseEpisode, including soft-deleted rows.
22. Migration history inspected read-only: versions `202608030001,202608040001,202608140001,202608150001,202608150002,202608310001`. Later effective settings-audit/sensor objects exist despite absence from that CLI ledger, consistent with the documented manual SQL Editor workflow. The ledger is not complete evidence of installed manual SQL. No catch-up or repair attempted.
23. Selected SQL Editor process executes only submitted guard SQL; no pending migration is automatically applied. CLI db push was deliberately not used because it could replay unrelated files.
24. Final preflight **PASS**, including the explicitly accepted Category B exception. No new architecture/security blocker discovered.

## Installation and non-destructive verification (25–53)

25. Method: full exact reviewed migration submitted through the existing production SQL Editor; explicit BEGIN/COMMIT in the file. Supabase’s destructive-operation warning was acknowledged for the authorized schema-only file after confirming guard absence. No clinical write occurred.
26. Installed migration is the filename/hash in items 9–10, without edits or added SQL.
27. Only that migration was applied. No catch-up migration, settings repair, ACL cleanup or history-repair statement bundled.
28. Execution returned **Success. No rows returned**. Subsequent catalog inspection proves committed function/trigger existence.
29. Function exists: public.guard_lee_lee_low_glucose_write().
30. Trigger exists: lee_lee_records_low_glucose_write_guard on public.lee_lee_records, ordinary enabled status O.
31. Trigger timing: BEFORE.
32. Events: INSERT OR UPDATE.
33. Scope: FOR EACH ROW.
34. Function SECURITY INVOKER (`prosecdef=false`).
35. Function configuration `search_path=""`, matching the reviewed file.
36. Installed function body MD5 `12cc06793de2bc83320bb8507eebd87c` equals the exact local file body. Definition metadata, trigger attachment/events and ACL checked separately. No production-only function changes.
37. Installed body contains exact SQLSTATE 23514.
38. Installed body contains LLT_LOW_GLUCOSE_WRITE_INCOMPATIBLE.
39. Installed body contains constraint lee_lee_records_low_glucose_write_guard. Error contract inspected, never triggered using production records.
40. Function ACL only `postgres=X/postgres`; authenticated/anon EXECUTE false, PUBLIC absent. It was not granted browser-callable execution.
41. RLS remains enabled.
42. Policy metadata hash unchanged: `5f4bfbf68989b84b2d5495edaea7546c`.
43. Table ACL unchanged: `{postgres=arwdDxtm/postgres,authenticated=arDxtm/postgres,service_role=Dxtm/postgres}`. SELECT/INSERT true and UPDATE/DELETE false remain unchanged.
44. Category B privileges unchanged: authenticated ACL retains TRUNCATE/REFERENCES/TRIGGER/MAINTAIN. No silent hardening.
45. All default-privilege catalog metadata hash unchanged: `99962fc2b9fb48d53e7b60f5d29ed1fa`.
46. Existing public functions, including versioned RPC, unchanged: aggregate hash excluding new guard `2baec5dbe974f09218002edb70f2dc11`. Includes argument types, body hashes, definer mode, config and ACL.
47. Existing set_lee_lee_record_updated_at trigger intact, BEFORE UPDATE FOR EACH ROW, ordinary enabled O. Existing function included in unchanged function metadata hash.
48. No new table: public relation inventory hash unchanged `7de3cacbb4926d5ec63a6c4cc5d5b448`.
49. No new column: record column name/type/nullability hash unchanged `de9dfafb35ed29c26afa8c5d12e3a74f`.
50. No new index: same public relation inventory includes indexes and is unchanged. Reviewed SQL contains no index/table/column DDL.
51. Pre/post record count: **286 → 286**. Aggregate ordered ID/version/updated_at hash unchanged `1a691fd58f5d78b505a12f0635f3ab7a`; no individual metadata or clinical values emitted.
52. Post-install marker count: **0**.
53. No application-data rewrite: migration contains no record DML/backfill; counts and record metadata hashes unchanged. This is schema-only installation evidence, not an invasive whole-row audit or production acceptance write. CLI migration-history versions remain unchanged, as expected for direct SQL Editor execution; the exact reviewed file does not insert a ledger row. Installation is recorded here by hash, method, result and installed catalog evidence. No ledger version was fabricated. Future CLI shipping must reconcile manually applied history separately rather than blindly replaying unrelated SQL.

## Scope, rollback and recommendation (54–70)

54. No synthetic LLT record created.
55. No production INSERT test.
56. No production UPDATE test.
57. No production DELETE test.
58. No production TRUNCATE test.
59. No clinical record modified; no Notes/glucose/carbs/treatment/episode JSON/full-row retrieval.
60. No existing privilege, table ACL, role membership, default, RLS or policy changed. The new guard’s reviewed EXECUTE revocations were applied as part of its own creation, not permission cleanup on existing objects.
61. No #15 client implementation.
62. Unrelated repository work and prior reports untouched; only this report added locally.
63. No commit.
64. No push.
65. No PR.
66. No merge.
67. No Pages deployment, release bump or service-worker bump.
68. Emergency rollback **not executed**; successful verified installation retained. Review-only rollback remains:

```sql
begin;
drop trigger if exists lee_lee_records_low_glucose_write_guard
  on public.lee_lee_records;
drop function if exists public.guard_lee_lee_low_glucose_write();
commit;
```

69. Remaining risks: accepted broad SQL-role privileges require separate least-privilege review. Any future arbitrary-SQL/DDL/API exposure invalidates the current access-path analysis. Privileged administrators can intentionally disable protection; ordinary client writes cannot under the inspected model. Guard protects stable compatibility structure, not deep clinical semantics. Old clients may retain rejected local drafts; future client UX must retain/recover those edits. Historical SQL Editor installs are not all represented in the CLI ledger. Existing unrelated settings replay defect and baseline browser failures remain untouched.
70. **Backend protection is installed and verified; LLT #15 client implementation may resume after separate explicit user authorization.** Stop here as required; do not implement or ship the client in this phase.

LLT #15 PRODUCTION DATABASE GUARD INSTALLED AND VERIFIED — CLIENT IMPLEMENTATION MAY RESUME

## Final shipping catalog sanity — October 6, 2026

Before client shipment, an explicit READ ONLY SQL Editor transaction reconfirmed body MD5 `12cc06793de2bc83320bb8507eebd87c`, SECURITY INVOKER, empty search_path, owner-only function ACL, ordinary enabled BEFORE INSERT OR UPDATE trigger, RLS enabled, and unchanged table ACL including accepted Category B privileges. Migration ledger still lists the same six earlier versions documented above. This is coherent with the established manual SQL Editor installation, whose exact reviewed file does not write the CLI ledger. Git/Pages shipping performs no database migration. No reinstall, CLI db push, ledger repair, production DDL/DML, permission change or clinical query occurred. Future CLI adoption still requires separate reconciliation of manual history.
