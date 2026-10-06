# LLT production authenticated privilege investigation — Phase 2C.1

**Decision: CATEGORY B — UNRELATED PRIVILEGE DRIFT / HARDEN SEPARATELY.** The database grants are real and broader than needed. No currently exposed normal LLT browser/API path was found that can exercise them to bypass the proposed guard. Least-privilege cleanup is recommended separately; it is not a technical prerequisite for the guard under the inspected access model. Accepting this conclusion and resuming the remaining production preflight requires review. Nothing was installed or repaired.

## Checkpoint and investigation boundary (1–6)

1. Branch: `feature/llt-low-glucose-episodes`.
2. HEAD: `d30936fc3f78946448a4294961a4dfacd0623da6`, unchanged.
3. Before status matches Phase 2C: existing modified Issue 14.5 report, unrelated untracked diagnostic reports/DONC/sensor review/local Supabase configuration, and four #15 artifacts. After adds only this report. No staged files; unrelated work preserved.
4. Full Phase 2C preflight report reviewed. Guard migration inspected unchanged; relevant full historical record, settings-audit and sensor function definitions reviewed as needed. Phase 2B validation report remains the local acceptance evidence.
5. Production method: existing authenticated Firefox Supabase SQL Editor session. Dashboard organization Lando’s World, project lee-lee-tracker, main PRODUCTION confirmed before queries. Data API settings inspected visually without changes. Credentials, keys and tokens were not accessed.
6. All production SQL was catalog inspection or non-mutating capability checks in explicit READ ONLY transactions. One initial catalog query failed on text/char concatenation; corrected with an explicit cast, following ROLLBACK. No production command created/altered objects or modified records, privileges, membership or configuration.

## What was observed and where it comes from (7–20)

7. Original inspection was `has_table_privilege('authenticated','public.lee_lee_records',v)` for the four unexpected privilege names. Reproduced individually for all eight privileges on PostgreSQL **17.6**.
8. Effective table ACL remains `{postgres=arwdDxtm/postgres,authenticated=arDxtm/postgres,service_role=Dxtm/postgres}`.
9. ACL expansion with `aclexplode` confirms direct grants from postgres; no grant-option stars appear. Comparison:

| Privilege | Direct table ACL | has_table_privilege | information_schema.role_table_grants |
|---|---|---|---|
| SELECT | Yes | true | Yes |
| INSERT | Yes | true | Yes |
| UPDATE | No | false | No |
| DELETE | No | false | No |
| TRUNCATE | Yes | true | Yes |
| REFERENCES | Yes | true | Yes |
| TRIGGER | Yes | true | Yes |
| MAINTAIN | Yes | true | Not represented |

The MAINTAIN difference is an information-schema limitation, not a false positive: PostgreSQL 17's table_privileges view enumerates the older seven privilege types, omitting MAINTAIN. Catalog ACL and has_table_privilege are authoritative for it. [PostgreSQL information schema](https://www.postgresql.org/docs/17/infoschema-table-privileges.html).

10. PUBLIC has no table ACL entry. These grants are not PUBLIC-derived.
11. authenticated inherits no other role privileges (`pg_has_role(...,'USAGE')` across other roles returned none). It cannot SET ROLE postgres. Membership entries are in the opposite direction: authenticator and supabase_realtime_admin can SET ROLE authenticated without inheritance; postgres is also a member of authenticated. They do not make authenticated a member of those administrative roles. authenticated is NOLOGIN, nonsuperuser, no BYPASSRLS, no CREATEDB/CREATEROLE.
12. Table owner is postgres, not authenticated. Schema public USAGE true, CREATE false for authenticated.
13. Record RPC and existing updated_at function are owned by postgres. All 14 public functions are postgres-owned. The proposed guard remains absent and would be installed by the approved administrative workflow, not owned by authenticated.
14. Current postgres/public table default ACL is `{postgres=arwdDxtm/postgres,anon=Dxtm/postgres,authenticated=Dxtm/postgres,service_role=Dxtm/postgres}`. Thus newly created tables in this owner/schema context receive the four extras unless explicitly revoked. Current function/sequence defaults are owner-only. Dashboard “Automatically expose new tables” is off. Current defaults are not proof of historical settings at record-table creation.
15. Entire checked-in migration history searched for grants, revokes, GRANT ALL and ALTER DEFAULT PRIVILEGES. No checked-in default-privilege change or explicit grant of the four extras exists. Original records migration lines 162–164 revokes ALL from anon/PUBLIC, revokes only UPDATE/DELETE from authenticated, and grants SELECT/INSERT. GRANT SELECT/INSERT adds privileges; it does not remove existing extras. No later checked-in migration broadens record-table permissions. Shared settings uses the same partial-revoke pattern. Audit and sensor migrations revoke ALL from authenticated before granting only SELECT.
16. Representative production comparison, all postgres-owned:

| Table | authenticated ACL | Interpretation |
|---|---|---|
| lee_lee_records | arDxtm | SELECT/INSERT plus four extras |
| lee_lee_shared_settings | arDxtm | Same partial-revoke pattern |
| lee_lee_foods | arwDxtm | SELECT/INSERT/UPDATE plus extras |
| lee_lee_settings_audit | r | Explicit full revoke, then SELECT |
| llt_sensor_cycles | r | Explicit full revoke, then SELECT |

17–20. TRUNCATE, REFERENCES, TRIGGER and MAINTAIN each have the same established immediate source: **direct postgres grants**, with a matching current schema/owner default-privilege mechanism and migration revocations that leave them intact. Classification: project/platform default-privilege residue consistent with incomplete narrowing, not inheritance, ownership or query artifact. **Exact historical provenance is UNKNOWN**: ACL catalogs do not record the original SQL, operator or timestamp. No evidence identifies a particular manual action or proves the precise Supabase platform change that introduced them. Supabase documents automatic grants/default-privilege transitions generally; that supports the mechanism, not an exact historical claim for this project. [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api).

## Database powers versus browser/API powers (21–32)

21. TRUNCATE authorizes whole-table removal in SQL, subject to command constraints. It is separate from DELETE and is not constrained by row RLS or this proposed INSERT/UPDATE row trigger. No production truncate was attempted. [PostgreSQL TRUNCATE](https://www.postgresql.org/docs/17/sql-truncate.html).
22. **Normal LLT browser can invoke TRUNCATE: NO under the inspected model.** Client uses supabase-js Data API table operations and named RPCs. PostgREST table routes provide constrained CRUD, not an arbitrary SQL/TRUNCATE route. No inspected exposed RPC performs TRUNCATE or passes supplied text into executable SQL. Database JWT authentication is not a database-password SQL connection. [PostgREST table API](https://docs.postgrest.org/en/v14/references/api/tables_views.html).
23. TRIGGER permits creating or replacing a trigger when EXECUTE on its function is also available. It is not table ownership. An executable existing trigger function can suffice; schema CREATE is not required to attach it. This distinction includes CREATE OR REPLACE TRIGGER, not just adding a new trigger. [PostgreSQL CREATE TRIGGER](https://www.postgresql.org/docs/17/sql-createtrigger.html).
24. **Normal browser create trigger: NO. SQL role with a statement-execution path: YES**, using an existing executable function. Local reproduction confirms this.
25. **Normal browser disable guard: NO.** SQL ALTER TABLE DISABLE TRIGGER requires ownership, which authenticated lacks. [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/17/sql-altertable.html).
26. **Normal browser drop guard: NO.** DROP TRIGGER requires table ownership. A future arbitrary-SQL path could nonetheless use CREATE OR REPLACE TRIGGER with a different executable function, so inability to DROP is not sufficient protection against arbitrary SQL. [PostgreSQL DROP TRIGGER](https://www.postgresql.org/docs/17/sql-droptrigger.html).
27. **Normal browser replace guard function: NO.** It lacks ownership and public schema CREATE. The proposed guard also revokes its direct EXECUTE permission. That revocation does not eliminate the hypothetical ability to replace the trigger with some other executable function if SQL execution were introduced.
28. REFERENCES permits foreign-key references to the table/columns.
29. No current browser DDL path exists to create such constraints. It does not grant UPDATE/DELETE, RLS bypass, or episode mutation. Risks of foreign-key/trigger code become relevant if SQL/DDL exposure is later added; do not assume unavailable capabilities.
30. PostgreSQL 17 MAINTAIN covers VACUUM, ANALYZE, CLUSTER, REFRESH MATERIALIZED VIEW, REINDEX and LOCK TABLE. These are maintenance powers, not UPDATE or trigger ownership.
31. No current browser/API maintenance route or RPC found. It does not itself permit disabling triggers or replacing the guard. Maintenance can affect availability and physical storage, so it is unnecessary for this browser role, but no current episode-destruction path was established. These privilege meanings follow [PostgreSQL 17 privileges](https://www.postgresql.org/docs/17/ddl-priv.html).
32. Arbitrary-SQL investigation: dashboard confirms Data API enabled, exposed schemas **public and graphql_public**; extra search path public/extensions. No catalog pgrst.db_schemas/db_pre_request override found. Public contains exactly 14 known LLT functions. All bodies' MD5 hashes match checked-in effective implementations, including record RPC, audited settings functions, sensor functions and timestamp helpers. No generic exec_sql/query passthrough/dynamic EXECUTE exists in these bodies. Executable mutator RPCs take typed data, fixed actions and ownership/version checks, not statements. Helper functions for snapshots/change calculations are not executable by authenticated. Existing timestamp trigger functions are executable but cannot be called as ordinary scalar RPC functions outside trigger context and contain no SQL passthrough. graphql_public has one executable platform wrapper; inspected body returns an error that pg_graphql is not enabled, rather than executing caller SQL. No inspected API exposes database-admin SQL. This conclusion is scoped to the verified normal LLT Data API, not a general audit of unrelated Supabase services or privileged credentials. [PostgREST RPC model](https://postgrest.org/en/v14/references/api/functions.html).

## Effect on the guard and recommended scope (33–42)

33. Normal browser direct UPDATE: **NO**. Effective grant false; no UPDATE policy. Client record updates use the versioned RPC.
34. Normal browser direct DELETE: **NO**. Effective grant false; no DELETE policy. Client deletion is versioned soft deletion.
35. Direct INSERT: **YES**, intentionally. Existing INSERT policy requires user_id = auth.uid(). No production insert was attempted.
36. Record RLS enabled; exactly authenticated owner SELECT/INSERT policies observed. Extras do not supply UPDATE/DELETE permission or BYPASSRLS.
37. Effective record RPC remains the checked-in SECURITY DEFINER function with empty search_path, auth.uid authentication, owner and expected-version predicates, payload replacement and version increment. Body MD5 `6f061a0cab1538d83be4db9212f829ea`. authenticated EXECUTE true; PUBLIC/anon absent per Phase 2C ACL evidence. Owner execution does not suppress ordinary table triggers.
38. **TRIGGER GUARD REMAINS COMPLETE for the inspected normal LLT browser INSERT/versioned UPDATE paths.** Direct inserts fire it. Owner-executed versioned updates fire it. Direct browser UPDATE is unavailable. No exposed SQL/DDL/maintenance path was found. This is compatibility-envelope protection, not validation of every clinical field or protection against intentional privileged administration. It remains uninstalled.
39. TRUNCATE changes the broader SQL-role least-privilege assessment, not the currently verified browser architecture. SQL possession is real; current browser invocation is unavailable; no inspected exposed RPC invokes it. A future SQL-execution feature would invalidate this conclusion and could also expose CREATE OR REPLACE TRIGGER bypass.
40. Separate least-privilege cleanup recommended.
41. Cleanup is **not required BEFORE #15** under the inspected current browser access model. Review must explicitly accept the documented privilege exception before the remaining Phase 2C gates are resumed; this report does not automatically turn the prior preflight into a PASS.
42. Minimum suggested separate cleanup is removal of the four unnecessary table privileges from authenticated on lee_lee_records, retaining SELECT/INSERT and RPC EXECUTE. Review matching owner/schema default privileges to prevent recurrence and similar related tables separately. No production cleanup SQL was executed or migration added. Do not fold a whole-project hardening project into #15.

## Local semantics experiments and final boundary (43–53)

43. Experiments used a new disposable database `llt15_privilege_review_<timestamp>` in fixed existing local Docker container supabase_db_llt-14-5-curated, PostgreSQL 17.6 via Unix socket. Created only a synthetic fixture table/function/trigger and reproduced SELECT/INSERT/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN grants in that database. Each role experiment used SET LOCAL ROLE authenticated in a transaction ending ROLLBACK; no global role changes. Database removed afterward.
44. Local results: CREATE TRIGGER allowed; CREATE OR REPLACE TRIGGER allowed; TRUNCATE allowed; ALTER TABLE DISABLE TRIGGER denied (owner required); DROP TRIGGER denied (owner required); function replacement denied (schema permission); direct UPDATE/DELETE denied (table permission). These are database permission experiments, **not production browser acceptance tests**. REFERENCES/MAINTAIN commands were not executed; their meaning was verified from catalogs and PostgreSQL documentation. All local fixtures were disposable.
45. Security implication: SQL access for authenticated would be dangerous despite absent UPDATE/DELETE grants. Keep arbitrary SQL/DDL RPCs unavailable; broadened exposure requires renewed review. Current NOLOGIN/JWT Data API boundary is essential. The SQL Editor admin session used for inspection is not the application's authenticated role path.
46. Simplicity review: “Are we fixing an actual #15 safety problem, or pulling unrelated database-hardening work into this feature?” Evidence shows unnecessary broad database powers, but no currently exposed application bypass. A separate cleanup is appropriate; mandatory general remediation within #15 is not supported by the inspected path.
47. Final category: **B — UNRELATED PRIVILEGE DRIFT / HARDEN SEPARATELY**.
48. Recommended next step: review/accept Category B and authorize resuming the remaining Phase 2C preflight with the explicit documented privilege exception. Recheck effective model and all incomplete gates before any guard installation. Track least-privilege cleanup separately. Do not resume client implementation until installation and non-destructive production verification succeed.
49. No production mutation occurred.
50. No guard installation occurred; function remains absent.
51. No production privilege, role, default or configuration changes occurred.
52. No clinical rows or values were read in this investigation. Only catalog metadata/capability checks; prior aggregate evidence remains in the unchanged preflight report.
53. No commit, push, PR, merge or deployment occurred. No client implementation or unrelated repair. Only this local report was added.

LLT PRODUCTION PRIVILEGE REVIEW READY
