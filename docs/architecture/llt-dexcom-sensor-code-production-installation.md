# LLT Dexcom G7 sensor code — production installation

2026-10-06. Phase 3 authorizes fresh production metadata preflight and, only after every gate passes, the exact reviewed single-file migration. Client implementation and Git/Pages release are outside this phase.

## Repository and reviewed authority

Branch `fix/llt-post15-ui-dexcom-code`; HEAD `b3c734c024b81e5bda528f2e438414d416678a6c`. No branch switch/reset/clean/staging. Working tree remains dirty with accepted cleanup and existing unrelated diagnostics. Migration: `supabase/migrations/202610060002_add_llt_sensor_code.sql`; SHA-256 `6e179a31ee794d6a3480b76e185c3b635818bb38a25b2eae98803af383b77292`, identical to isolated validation. Its phase-2 no-production-authorization comment remains byte-identical; the explicit Phase 3 brief supplies installation authority without editing the artifact.

Read completely: `llt-dexcom-sensor-code-architecture-review.md`, migration, and `llt-dexcom-sensor-code-database-local-validation.md`. Prior validated behavior: 49 new DB checks, 38 existing sensor DB checks, 82 broader DB checks, 519 unit tests, 52 browser checks. No production write test is authorized or needed.

Accepted cleanup preserved: CSS, tracker, sensor domain/sync/UI and corresponding low-glucose/sensor browser/application tests. Existing modified sensor DB test and root #14.5 report preserved. Existing diagnostic reports, death-on-notecards directory, review SQL, local Supabase configuration, earlier reports and phase-2 migration/test preserved. Initial full `git status --short` and per-file preservation hashes captured in tool evidence and `/private/tmp/llt-code-phase3-preservation.json`. This report is the only intended repository change.

## Fresh actual production preflight

Existing authenticated Firefox SQL Editor: Lando's World → lee-lee-tracker → main PRODUCTION; project `ujbfqcggtuhagsgwcocr`. No credentials/private connection strings retrieved. Established SQL Editor full-file workflow does not require a commit/merge or apply other local files. All preflight SQL used explicit `BEGIN READ ONLY`/COMMIT; only catalogs and sensor aggregate counts selected. A catalog-query type ambiguity (SQLSTATE 42725, concatenating PostgreSQL internal char) was corrected with explicit casts before successful metadata reads; it was not a migration failure or production mutation.

Live PostgreSQL 17.6 x86_64, database/current/session user postgres; metadata timestamp `2026-10-06T19:18:17.843759+00:00`. SQL Editor statement timeout 2 minutes, lock timeout 0. No competing sensor relation locks at the final preflight. Tables are small: context 24,576 bytes, cycles 65,536 bytes, operations 49,152 bytes. ALTER still acquires locks; statement timeout bounds execution, not a zero-lock claim. Exact migration was not modified to add timeout SQL.

Fresh disposable local PostgreSQL 17.6 baseline reconstructed from original sensor migration with only external auth/publication prerequisites. Exact candidate applied there to derive expected post-install catalog fingerprints; disposable DB dropped. No existing local application DB modified. Production complete column projection, constraints, indexes, policies and all three complete function definitions match that baseline. Definitions include signatures/defaults, return/language/security/config/body; ACL/owner checked separately.

| Artifact | Preflight actual and expected MD5 |
| --- | --- |
| All sensor columns/types/defaults/nullability/order | `063b4d305142cf688b7789a8eeb9cf46` |
| Constraints, including definitions/validated state (30) | `728a1804925f97162eeb456ac7da0d49` |
| Full index definitions (6) | `1361a97ee611efc7d7c16d3335b7b3e9` |
| Full three policies | `1916ccdbf8c27e0601d60fd0ec1dcca3` |
| Getter complete definition | `66b3b1d525dee5cdbde7cddff4aa2a36` |
| Old nine-input mutation complete definition | `65d045374b83392a63719930934cd423` |
| Internal snapshot complete definition | `fbe5fef0dc00c94ddad5421f01894001` |

Tables owner postgres/RLS enabled, not forced; no user sensor triggers. Exactly three authenticated SELECT-only owner policies (`user_id = (SELECT auth.uid())`), no write policies. Each table ACL `{postgres=arwdDxtm/postgres,service_role=Dxtm/postgres,authenticated=r/postgres}`; authenticated effective SELECT only and all other privileges false, anon all false, no PUBLIC ACL. Trusted service_role residual privileges match recorded baseline. Public schema authenticated USAGE true/CREATE false; anon CREATE false. Realtime contains only sensor contexts.

Getter `()` and old mutation `(uuid,text,bigint,uuid,uuid,timestamptz,boolean,text,jsonb)` return jsonb, postgres ownership, SECURITY DEFINER, empty search_path, ACL `{postgres=X/postgres,authenticated=X/postgres}`. Internal snapshot `(p_uid uuid)` returns jsonb, postgres owner, SECURITY INVOKER/STABLE/empty search_path, postgres-only EXECUTE. Exactly one function per name; no mutation defaults or dependent catalog objects. Exact definitions prove unchanged auth.uid authorization, row-lock/concurrency, canonical retries and targeted lifecycle behavior.

Fresh sensor aggregate counts: **2 cycles, 2 operations, 1 context**. `sensor_code` absent. No individual rows, identities, dates, values, request bodies or codes selected.

#15 guard body MD5 `12cc06793de2bc83320bb8507eebd87c`, owner postgres, invoker, empty search_path, owner-only ACL. Ordinary enabled BEFORE INSERT OR UPDATE guard trigger remains on records; existing updated-at trigger also present. All unrelated public function definitions/owners/ACL aggregate MD5 `2972b26ee6ff73069f960ce5c272f437`.

Category B retained on records/shared settings: `{postgres=arwdDxtm/postgres,authenticated=arDxtm/postgres,service_role=Dxtm/postgres}`, RLS true. All default privileges aggregate MD5 `09c1230aca3981d740d923fa81ff696e`. Postgres public defaults: sequences owner only, functions owner EXECUTE only, tables owner all plus anon/authenticated/service_role Dxtm. No privilege remediation. Existing three settings-audit full definition MD5s match root report: `8516b6cad2b7ed8b7f23c672282e6f4b`, `83aa553a6d09a743bdb4f331e6035609`, `5307d045f27e0f4f0e2ab5a9a58ee5cb`.

Ledger remains six versions `202608030001,202608040001,202608140001,202608150001,202608150002,202608310001`. Later manually installed audit/sensor/#15 objects match their exact documented artifacts despite omission from CLI ledger. Candidate neither recorded nor effectively applied. This is coherent established manual history, not an unexplained missing schema. CLI would risk replaying unrelated pending files and is excluded; no catch-up/history repair.

## Installation gates — recorded before execution

| Gate | Result | Evidence |
| --- | --- | --- |
| 1 Integrity | PASS | Exact validated SHA and reviewed complete SQL unchanged. |
| 2 Schema | PASS | Complete baseline fingerprints match; column absent. |
| 3 RPC | PASS | All complete definitions/signatures/ACL/owner/security match; no dependencies/overload. |
| 4 Security | PASS | RLS/policies/grants match baseline, browser SELECT-only. |
| 5 History | PASS | Manual objects reconcile to exact artifacts; single-file editor avoids unrelated pending files. |
| 6 #15 guard | PASS | Exact body/security/trigger unchanged; candidate does not touch it. |
| 7 Sensor safety | PASS | Aggregate 2 cycles/2 operations; no individual rows accessed. |
| 8 No backfill | PASS | Nullable no-default ADD COLUMN; no top-level row DML/backfill. |
| 9 Column contract | PASS | Text NULL or exactly four C-collated ASCII digits; strings retain zeros. |
| 10 Old callers | PASS | One replacement with unchanged first nine arguments and trailing default NULL; actual local PostgREST old/new named calls proven. |
| 11 Snapshot | PASS | Exact old projection matches baseline; reviewed null omission applies unchanged. |
| 12 Category B | PASS | Known privileges/defaults retained; only exact mutation EXECUTE ACL restored. |
| 13 Method | PASS | Authenticated established one-file SQL Editor, no commit requirement or automatic batch. |

**All 13 gates PASS. Exact single-file installation authorized by Phase 3.**

Installation completed successfully; post-install verification below PASS.

## Exact installation and post-install result (report items 28–53)

28. Exact 14,131-byte migration read directly from its local file into the native SQL Editor clipboard/paste path. SHA rechecked immediately before paste; no reconstructed SQL, appended statement or additional migration. Visible final lines 269/270 were NOTIFY/COMMIT. Editor target remained production. Supabase destructive-operation warning acknowledged for the authorized exact RESTRICT function replacement after all gates passed.
29. Executed once; SQL Editor returned **Success. No rows returned**. Explicit BEGIN/COMMIT completed; no failure/repair occurred. Subsequent queries were explicit READ ONLY. All post-install checks PASS at `2026-10-06 19:21:57.196034+00`.
30–34. Column exists on public.llt_sensor_cycles: sensor_code, text, nullable YES, default NULL (no default expression). Constraint llt_sensor_code_four_ascii_digits validated true, definition `CHECK (((sensor_code IS NULL) OR ((char_length(sensor_code) = 4) AND ((sensor_code COLLATE "C") ~ '^[0-9]{4}$'::text))))`. Legacy NULL supported; leading zeros remain strings. Complete post-column projection MD5 `966c9d6c7730b9bd66f29241e2b20599` equals exact candidate local catalog. Complete 31-constraint fingerprint `9a6dcf8e53686792f68d5700d884e428` equals candidate.
35–36. Six existing indexes unchanged, MD5 `1361a97ee611efc7d7c16d3335b7b3e9`. Zero non-internal sensor triggers, no new table/index/trigger. Realtime remains contexts only.
37–39. Aggregate **2 cycles, 0 non-NULL codes, 2 operations, 1 context**. Counts identical to preflight. No migration-created sensor receipt, code entry or backfill. No individual sensor rows inspected.
40. Exactly one ten-input mutation; unchanged first nine named/types/order plus `p_sensor_code text DEFAULT NULL::text`. Nine-input identity removed; defaults count one. Complete installed definition MD5 `94b6d1b74f66a45bbcbf6066688fb21e`, body MD5 `fbec6330c97a5c2aab92a50a9eb1cb16`, both equal isolated exact-file application.
41. Old callers supported by optional trailing parameter and preserved nine-key canonical request. No same-name overload ambiguity. Actual old/new named PostgREST calls proven in isolated phase 2; no production mutation invoked.
42. Non-null code validates four ASCII digits before writes, allowed on start only, enters canonical request conditionally and new cycle INSERT only. Existing targeted edit/undo/replacement assignments retain previous codes. Exact body match proves reviewed auth/concurrency/version/audit behavior retained.
43. Internal snapshot installed complete definition MD5 `c8be46596f62291242cdccb208429474`, body `62a4a0bf7244ebb9eca8d35281d779a3`, equal exact candidate. Null sensor_code omitted from outward cycle JSON; non-null included; ordering and revision contract retained. Getter complete definition remains `66b3b1d525dee5cdbde7cddff4aa2a36`.
44–47. Return jsonb/security/owner/search_path/EXECUTE boundaries unchanged: getter/mutation SECURITY DEFINER owner postgres/empty search_path, authenticated and owner EXECUTE only, anon/service_role false/no PUBLIC ACL. Internal snapshot invoker/STABLE owner postgres/empty search_path/owner-only EXECUTE. No new direct browser write path. Transaction-bound NOTIFY pgrst reload schema included and committed.
48–50. Three table owners/RLS/ACLs unchanged. Policy fingerprint remains `1916ccdbf8c27e0601d60fd0ec1dcca3`; authenticated SELECT all, any direct write false, anon any privilege false. Table sizes also unchanged. No table/default-privilege grants changed.
51. Category B records/shared-settings ACL/RLS remain identical; all-default fingerprint remains `09c1230aca3981d740d923fa81ff696e`. Unrelated public complete function definitions/owner/ACL aggregate remains `2972b26ee6ff73069f960ce5c272f437`.
52. #15 guard exact body MD5, owner/security/empty search_path/owner-only ACL and ordinary enabled BEFORE INSERT OR UPDATE trigger unchanged. Existing record updated-at trigger unchanged. No clinical row access/write or synthetic guard test.
53. Same six CLI ledger versions after install. SQL Editor does not record this file automatically and the reviewed file contains no ledger INSERT. No fabricated history or unrelated pending migration applied. This report records exact hash, target, method, execution result and installed fingerprints; CLI adoption remains separately reviewed history reconciliation.

## Preservation, limits and next phase (report items 54–67)

54. No production sensor row UPDATE/DELETE/INSERT/backfill was performed. Nullable schema addition leaves existing cycles unrecorded; counts and zero-code aggregate confirm expected immediate state. This is aggregate/schema evidence, not an invasive whole-row audit.
55. No operation row created; count remains two.
56. No actual or synthetic production sensor code read/entered.
57. No sensor created/replaced/edited/undone; no mutation RPC invoked.
58. All pre-existing modified/untracked file contents verified against preflight hashes unchanged. Accepted physical-iPhone cleanup preserved; prior reports untouched. Only this new report created.
59. Sensor Code client UI NOT IMPLEMENTED. No payload/display/cache/client change.
60. No commit; index unchanged/empty.
61. No push.
62. No PR.
63. No merge.
64. No Pages deployment, release or service-worker bump.
65. Limitations: no production sensor write/Undo test by design; no physical client-code acceptance. Production PostgREST version and live old/new write dispatch were not exercised; transaction-bound schema-cache reload was emitted and committed, while actual named dispatch was validated on isolated PostgREST v16.1. Browser/network/Realtime code-bearing roundtrip remains future client validation. No assertion of live API cache internals or synthetic family-device event delivery. Accepted Category B security residue and incomplete CLI ledger remain disclosed/separate. Prefer retaining compatible additive DB contract if future client rollout pauses; never drop codes/receipts as rollback.
66. Recommended next separately authorized phase: Sensor Code client implementation and local/device validation against the installed contract. Start/replacement input preserves four-digit text/leading zeros, current/history identifier display reads each cycle, legacy no-code display stays valid; retain secure UUID and accepted responsive UI. Test old/new clients, cache/pending requests/retry/sync paths. No edit-code/backfill path without separate review. Stop before Git/Pages shipping unless authorized.
67. Final status: exact production database contract installed and read-only verified; client implementation may begin after separate user authorization.

Evidence: `/private/tmp/llt-code-preflight-a.sql`, `llt-code-preflight-b.sql`, `llt-code-post-c.sql`; captured native SQL Editor result states under `/private/tmp/llt-code-production-*.ax.txt`; expected disposable local catalogs `/private/tmp/llt-code-expected-before.txt` and `llt-code-expected-after.txt`; preservation hashes above. UI query used established `/dashboard/project/ujbfqcggtuhagsgwcocr/sql/84832c39-bcd3-4ef4-af72-30315cd72984`; unsaved editor now contains read-only post-install verification, not executable migration. No keys/tokens/individual clinical or sensor data in evidence.

LLT DEXCOM SENSOR CODE PRODUCTION DATABASE CONTRACT INSTALLED AND VERIFIED — CLIENT IMPLEMENTATION MAY BEGIN
