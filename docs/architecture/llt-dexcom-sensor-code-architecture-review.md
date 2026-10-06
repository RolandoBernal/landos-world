# LLT Dexcom G7 sensor code — architecture review

2026-10-06. **REVIEW ONLY. No implementation or migration execution authorized by this report.**

## Executive decision

Recommend **A — SIMPLE ADDITIVE CHANGE**: one nullable `text` field on `llt_sensor_cycles`, a single non-overloaded mutation contract extended with a trailing optional parameter, a null-compatible snapshot projection, and small client plumbing. Existing targeted mutations naturally preserve codes through edits, replacement and undo. No new table, metadata framework, trigger, context field or sync engine is needed.

The recommendation is conditional on the next phase's isolated PostgreSQL/PostgREST validation and a fresh metadata-only production preflight before any production authorization. This review did not access production. It does not claim current live catalogs or migration ledger were freshly verified.

Two compatibility requirements are essential: preserve canonical requests for old operation retries, and omit null `sensor_code` from outward snapshots so old clients do not reject an otherwise identical snapshot at the same revision.

## Repository and evidence (report items 2–4)

- Branch: `fix/llt-post15-ui-dexcom-code`; HEAD `b3c734c024b81e5bda528f2e438414d416678a6c`.
- Starting modified accepted implementation: `css/lee-lee-diabetes.css`, `js/lee-lee-diabetes-tracker.js`, `js/lee-lee-dexcom-sensor.js`, `js/lee-lee-sensor-sync.js`, `js/lee-lee-sensor-ui.js`, `tests/browser/llt-low-glucose.spec.js`, `tests/browser/llt-sensor-tracker.spec.js`, `tests/llt-sensor-application.test.js`.
- Existing modified `LLT_ISSUE_14_5_ALERTS_DEXCOM_TRACKER_REPORT.md` and untracked diagnostic reports, `death-on-notecards/`, review-only sensor SQL and Supabase local configuration preserved. Three prior local cleanup reports are untracked and preserved. Nothing staged; no branch switch/reset/clean.
- This review's only intended repository artifact is this new report. Baseline file hashes were captured separately in `/private/tmp/llt-sensor-code-review-source-hashes.json` for preservation verification.
- User confirms ALL current cleanup items physically accepted: summary rows, iOS native-control containment, replacement review, secure UUID fallback/save, timeline hierarchy and responsive Edit Recheck. Existing reported 519 units and 52 browser checks remain prior validation, not a new test run in this architecture-only phase.

Inspected current migration `supabase/migrations/202610030001_create_llt_sensor_cycles.sql`; sensor domain, sync, UI; relevant transport/backup portions of `js/lee-lees-tracker-sync.js` and `js/lee-lee-diabetes-tracker.js`; sensor application/database/local API and browser tests; #14.5 architecture, production installation/catalog and shipping sections of its root report; existing review SQL; migration directory; #15 production guard/privilege reports; and the three current cleanup/UUID/timeline reports. Checked PostgreSQL and PostgREST primary documentation for signature/default/overload rules.

## Current model, schema and security (items 5–18)

| Object | Role and current schema |
| --- | --- |
| `llt_sensor_contexts` | One authenticated user scope; `user_id uuid` PK/auth FK, `revision bigint` default 0/nonnegative, nullable `current_cycle_id uuid` composite FK, created/updated timestamptz. Serializes writes by row lock; pointer/revision is authoritative. |
| `llt_sensor_cycles` | Physical-cycle history; composite PK `(user_id,id)`, user/context FK; `sensor_type text` fixed `dexcom_g7_10d_v1`; finite `started_at`; nullable `ended_at`, `cancelled_at`, `previous_cycle_id`; `state current/closed/cancelled`; timestamps, allowed actor labels, positive context-associated revision. Same-user predecessor FK and boundary/state constraints. No metadata/JSON payload field. |
| `llt_sensor_operations` | Immutable browser-visible receipts and audit: operation ID, action, bounded canonical request JSONB, status/reason, expected/before/after revisions, before/after cycle JSONB arrays, actor/device attribution, received/accepted timestamps. Not canonical cycle metadata and not an arbitrary restore payload. |

Indexes: single current cycle per user (partial unique); user/start/id history; operation history; PK indexes. Six indexes/30 constraints historically verified. No sensor write triggers in the checked-in migration. Realtime publishes context changes only, as invalidation hints.

Browser writes are **RPC-only**: migration revokes ALL from PUBLIC/anon/authenticated on all sensor tables, grants authenticated SELECT only, enables RLS and creates three owner-only SELECT policies (`user_id = auth.uid()`). No INSERT/UPDATE/DELETE policies. #14.5 installation report independently records effective browser SELECT-only permissions, not just client source assumptions. Actual current live effective privileges must be rechecked before future installation.

| Function | Parameters, return and privileges | Writes / behavior |
| --- | --- | --- |
| `llt_sensor_snapshot_for_user` | `(p_uid uuid) → jsonb`; SQL STABLE, SECURITY INVOKER, `search_path=''`; API roles revoked; historical owner postgres, owner-only EXECUTE. | Reads contexts/cycles; complete ordered cycle JSON via `to_jsonb(c)`. Internal callers supply authenticated UID. No writes. |
| `llt_get_sensor_snapshot` | `() → jsonb`; PL/pgSQL SECURITY DEFINER, `search_path=''`; historical owner postgres; EXECUTE authenticated and owner only. | Auth check then internal snapshot; status/snapshot/serverTime. No writes. |
| `llt_mutate_sensor_cycle` | Nine parameters listed below; jsonb; PL/pgSQL SECURITY DEFINER, `search_path=''`; historical owner postgres; EXECUTE authenticated and owner only, no PUBLIC/anon/service_role EXECUTE in recorded installation. | Sole writer: start/replacement, edit_start, undo_current; context insert/lock, targeted cycle mutations, context revision/pointer update and operation receipt insert. |

Current mutation signature (no defaults):

```text
p_operation_id uuid
p_action text
p_expected_revision bigint
p_expected_current_cycle_id uuid
p_new_cycle_id uuid
p_started_at timestamptz
p_confirm_replace boolean
p_actor_label text
p_device_metadata jsonb
```

Client passes a named parameter object to `client.rpc('llt_mutate_sensor_cycle', request)`. The security boundary remains auth.uid(), not labels/device metadata. Context lock, expected revision AND current pointer prevent stale/ABA writes. Receipt lookup precedes version checks; identical retries replay, changed canonical requests under the same operation ID reject. Unexpected failure rolls back cycles/head/receipt together.

`device_metadata` permits only five attribution keys (installation ID/profile/platform/environment/version), bounded strings. It must not carry sensor code. Contexts have no suitable payload; operation JSON is not a storage workaround.

Reads: snapshot RPC used on connect/refresh/mutation/replay; old domain validator accepts extra cycle fields. Direct SELECT is permitted by security but ordinary runtime hydration uses RPC. Sensor history renders from snapshot cycles; it is not separately reconstructed from receipts. Cache serializes complete snapshots; pending queue stores the exact request. Realtime context events refetch snapshot. No code field is currently serialized.

## Recommended field and lifecycle contract (items 19–29)

Canonical location: **`public.llt_sensor_cycles.sensor_code text NULL`**, no default/backfill. Recommend retain `sensor_code` on raw client cycle objects, matching existing `started_at`, `sensor_type`, `previous_cycle_id` conventions. Use `sensorCode` only as a form/draft/request option if convenient; RPC name `p_sensor_code`. Avoid introducing a parallel normalized model.

Database constraint: null OR exactly four ASCII digits, with length 4 and a C-collated `[0-9]` regex. Accept `0000` and `0042`; do not infer issuance ranges or convert to number. Missing property and null both mean unrecorded. No fake placeholder or mandatory legacy update.

**Modern new sensor:** client requires valid string before Review/Save; RPC validates any non-null value, but permits omitted/null code for the existing client contract. This is deliberate: server cannot infer a trustworthy client generation from device metadata, and requiring non-null on all start calls would break old-client start/replacement. Therefore “required for modern UX” is enforced by modern client; database/RPC enforce structural validity of supplied values. This is recording metadata, not authorization. Strict server-wide mandatory new codes would require a different coordinated/versioned API policy and is not the recommendation.

**Replacement:** closes old row using existing targeted update; never writes its code. New row INSERT receives only newly supplied `p_sensor_code` (or null for old clients), never copies old code. Old cycle keeps its code in history.

**Edit start:** updates only current start and previous recorded boundary/revisions/attribution; code unchanged on both rows. Reject non-null code parameter for non-start actions to avoid silently ignoring attempted code edits.

**Undo:** cancels current row (retained) and restores predecessor by status/end-time updates; no row recreation or audit-snapshot restore. Each row keeps its own code. Cancelled replacement retains its own code; restored predecessor retains its different code. Undo with no predecessor leaves no active cycle, with cancelled row/code retained.

**Operations:** retain existing whole before/after snapshots, which naturally include the new column. No new receipt column or device metadata key. Minimal intentional duplication is within the already approved audit snapshots/request, not a second authority. Supplied non-null code must be part of canonical request comparison; otherwise reuse of the same operation ID with a different code would incorrectly replay. Do not rewrite old receipts. For null/omitted code, preserve the exact old canonical request shape (do not add `sensorCode:null`). Audit snapshots may show null, while outward read snapshots omit it. Undo continues to use targeted rows, not audit reconstruction.

**Context:** no schema/data duplication. Context revision advances with normal accepted start/replacement/edit/undo and invalidates readers as today.

## Read, cache, sync and mixed-client details (items 30–36)

Default `to_jsonb(c)` would automatically expose the new column. However the old sync client compares `JSON.stringify(snapshot)` at the same revision and throws if it differs. A newly added null JSON property could therefore invalidate an old cached legacy snapshot without any actual mutation.

Recommendation: change ONLY the internal snapshot projection to remove `sensor_code` when null; include it when non-null. Existing legacy snapshot shape/order remains the same without artificial revision bumps or cache resets. Code first appears through a normal start operation that increments context revision. New clients read `cycle.sensor_code ?? null`; do not mutate raw snapshots merely to normalize absent fields into null. Audit snapshots need not use the outward projection.

New domain validator tolerates absent/null and rejects malformed supplied code. Cache writes already preserve unknown fields; no new key or sync engine needed. Existing stale snapshot and owner checks remain. Same-revision snapshot differences continue to signal real inconsistency. Mixed-generation tabs/cache must be tested, including property order round trips.

| Scenario | Expected behavior |
| --- | --- |
| Old client / new DB / legacy null row | Snapshot omits field, preserving old cached shape at same revision. All actions retain existing contract; missing parameter defaults null. |
| Old client / code-bearing row | Validator ignores extra field; targeted start edit/undo cannot erase it. Replacement closes old coded row and creates new null-code row; does not inherit code. Old UI simply lacks identifier display. |
| New client / legacy row | Reads absent/null as unrecorded; clean `Dexcom G7` display. Legacy edit_start/undo remain permitted. |
| New client / new coded row | Requires valid code on start/replacement; refresh/history/active/collapsed UI reads that cycle's code; secure UUID behavior unchanged. |
| Pending old request / upgraded DB | Original canonical shape preserved; old receipt retry succeeds unchanged. Existing expected revision rules apply. |
| Same operation ID / changed code | Reject operation_id_reused, with no cycle/receipt mutation. |

No wholesale sensor row replacement occurs; no mixed-client preservation trigger is required. Code null does not erase a pre-existing cycle because start inserts a distinct new cycle and other actions reject supplied code changes.

Backup: existing “full” LLT clinical backup does **not** include authoritative sensor dataset/receipts. Do not silently extend clinical import/export to restore sensor rows; browser has no such authority. Existing supported sensor recovery is server refetch plus owner-scoped cached snapshot/pending request. Code follows those existing paths automatically. No new backup promise: an offline cache is not a disaster-recovery backup. A dedicated sensor export/restore policy, if desired, is separate scope.

## RPC evolution and migration safety (items 37–44)

Recommend replace the nine-input function with **exactly one** same-name ten-input function, adding trailing `p_sensor_code text DEFAULT NULL`. Old named and positional nine-argument callers use the default; modern named callers supply code for start. Keep all nine names/order/types and jsonb result identical.

Adding an input changes PostgreSQL identity; `CREATE OR REPLACE` alone would create a distinct overload, not modify the nine-input function. Retaining the nine-input function alongside a defaulted ten-input version risks ambiguous resolution. **Do not retain both.** Transactionally DROP the exact old signature with RESTRICT (never CASCADE), CREATE the ten-input function, restore exact owner/ACL, and commit. No intermediate API-visible grant/public window within the committed schema. Dependency checks are required before constructing the final executable migration; unexpected dependents cause stop, not cascading removal.

PostgREST uses named JSON arguments; defaults allow omitted optional fields. Schema cache must be reloaded using the established mechanism after the committed change and old/new named requests tested through actual PostgREST. Do not rely on SQL positional tests alone. Preserve queued nine-key request support. No function name change or Auth Preview allowlist expansion needed.

Primary references: [PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html), [PostgREST function RPC](https://postgrest.org/en/v14/references/api/functions.html). Exact deployed PostgREST version remains a future preflight/test fact, not assumed from documentation version.

Ownership/ACL: install under verified intended owner postgres; recreate SECURITY DEFINER, empty search_path, same auth/owner/version checks and qualified object references. Revoke PUBLIC/anon/authenticated default EXECUTE before granting authenticated only; ensure service_role EXECUTE is not accidentally inherited from defaults. Compare normalized ACL and effective grants to preflight, restore owner and intended existing ACL exactly. `CREATE OR REPLACE` for the internal same-signature snapshot preserves ownership/ACL, but verify them anyway.

Table RLS/policies/grants unchanged. No index needed for a four-digit display identifier (not unique). No trigger needed. Existing constraints remain; add one code check. Nullable no-default column does not require a value backfill; ALTER still requires a lock and CHECK validation scans existing rows, so inspect table size/lock budget rather than claiming zero operational cost.

Production metadata not accessed in this review. Historical #14.5 report records PostgreSQL 17.6, postgres ownership, matching definitions/constraints/indexes/policies and effective sensor SELECT-only permissions. #15 guard report records later metadata-only verification and manual installation. These are previous evidence, may be stale, and must not substitute for new preflight.

Category B: separate record/settings default-privilege residue; sensor tables historically had explicit revoke-all/SELECT-only grants. Adding a column does not create a table or grant extra table rights; recreating the RPC DOES interact with function defaults, hence explicit ACL restoration/check above. No default/table hardening bundled; stop if fresh sensor-specific permissions differ materially.

Migration sequence: latest repository file is `202610060001_guard_lee_lee_low_glucose_writes.sql`. Reserve a unique monotonically later version at implementation time after inspecting current repo again (same-day `202610060002...` only if still free; otherwise current-day later version). Do not choose/write a migration now.

The documented production CLI ledger contains six earlier versions and omits later manual SQL Editor installations. This is an established incomplete ledger with separately recorded exact SQL/hash/catalog evidence, not evidence that sensor/guard objects are absent. No fresh ledger verification performed. Never blindly `db push` or repair history in this feature. Next production preflight must reconcile effective objects against their exact manually installed artifacts and select one reviewed-file SQL Editor application; any unexplained divergence stops execution. A CLI migration-history adoption is separate reviewed work.

## REVIEW DRAFT — DO NOT EXECUTE (item 45)

The following is a **non-executable report draft**, not a migration file or authorization. It shows exact additive field/projection and required RPC body edits. The complete unchanged transactional mutation body must be incorporated/reviewed during the future implementation phase; placeholders deliberately make this unusable as runnable SQL.

```sql
-- REVIEW ONLY — NOT EXECUTABLE AS A WHOLE
BEGIN;
ALTER TABLE public.llt_sensor_cycles ADD COLUMN sensor_code text;
ALTER TABLE public.llt_sensor_cycles
  ADD CONSTRAINT llt_sensor_code_four_ascii_digits CHECK (
    sensor_code IS NULL OR (
      pg_catalog.char_length(sensor_code) = 4
      AND (sensor_code COLLATE "C") ~ '^[0-9]{4}$'
    )
  );
COMMENT ON COLUMN public.llt_sensor_cycles.sensor_code IS
  'Optional four ASCII digit physical sensor pairing code; NULL for unrecorded legacy cycles. Preserve leading zeros.';

CREATE OR REPLACE FUNCTION public.llt_sensor_snapshot_for_user(p_uid uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT pg_catalog.jsonb_build_object(
    'revision', coalesce(h.revision, 0),
    'currentCycleId', h.current_cycle_id,
    'cycles', coalesce((
      SELECT pg_catalog.jsonb_agg(
        CASE WHEN c.sensor_code IS NULL
          THEN pg_catalog.to_jsonb(c) - 'sensor_code'
          ELSE pg_catalog.to_jsonb(c) END
        ORDER BY c.started_at DESC, c.id DESC)
      FROM public.llt_sensor_cycles c WHERE c.user_id = p_uid
    ), '[]'::jsonb)
  )
  FROM (SELECT p_uid AS user_id) u
  LEFT JOIN public.llt_sensor_contexts h ON h.user_id = u.user_id;
$$;

-- First verify no unexpected dependent objects and exact preflight owner/ACL.
DROP FUNCTION public.llt_mutate_sensor_cycle(
  uuid,text,bigint,uuid,uuid,timestamptz,boolean,text,jsonb
) RESTRICT;
CREATE FUNCTION public.llt_mutate_sensor_cycle(
  p_operation_id uuid, p_action text, p_expected_revision bigint,
  p_expected_current_cycle_id uuid, p_new_cycle_id uuid,
  p_started_at timestamptz, p_confirm_replace boolean,
  p_actor_label text, p_device_metadata jsonb,
  p_sensor_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $review_only$
  [FULL EXISTING BODY WITH ONLY THE REVIEWED EDITS BELOW]
$review_only$;
-- Subject to matching the fresh preflight owner/ACL:
ALTER FUNCTION public.llt_mutate_sensor_cycle(
  uuid,text,bigint,uuid,uuid,timestamptz,boolean,text,jsonb,text
) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.llt_mutate_sensor_cycle(
  uuid,text,bigint,uuid,uuid,timestamptz,boolean,text,jsonb,text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.llt_mutate_sensor_cycle(
  uuid,text,bigint,uuid,uuid,timestamptz,boolean,text,jsonb,text
) TO authenticated;
-- Snapshot same-signature replacement retains owner-only ACL; verify it.
COMMIT;
-- Follow established PostgREST schema-cache reload and read-only catalog checks.
```

Required mutation body deltas, no others:

1. Before context creation/lock, reject malformed non-null code with `invalid_request / invalid_sensor_code` using length 4 and C-collated `[0-9]{4}`; reject non-start action with supplied non-null code (`invalid_action_shape`). Null is allowed for legacy callers.
2. Immediately after existing `v_request` construction: if non-null, append `jsonb_build_object('sensorCode', p_sensor_code)`; otherwise keep old JSON exactly. Do not alter old stored receipts.
3. Start INSERT appends `sensor_code` column and `p_sensor_code` value. All closure/edit/undo UPDATE assignments stay unchanged.
4. Whole before/after audit row serialization already includes new column; no extra copies or audit schema changes. Read function above controls only outward shape.
5. Explicit ownership/privilege restoration of the exact ten-type function identity; no old nine-type overload left behind.

## Future isolated validation matrix (item 46)

Use disposable local Supabase/PostgreSQL; never family sensor rows. Keep current tests and run actual PostgREST/Realtime contract checks. Seed synthetic users/cycles and examine pre/post catalogs.

| Area | Required cases |
| --- | --- |
| Schema | Legacy NULL valid; 2345/0042/0000/9999 valid; 3/5 digits, letters, signs, exponent, decimals, spaces, newline, tab, Arabic-Indic/fullwidth digits invalid. DB and RPC tests; no new-row backfill. |
| Old client | Exact old snapshot/cache at same revision stays byte-equivalent; all six read/start/replace/edit/undo behaviors succeed where valid; nine positional and named arguments accepted. Coded cycles remain intact through edit, replacement and undo. Old-created replacement code null, never copied. |
| New client | Start/replacement stores exact string; old code remains; hydrate/history/cache/refresh preserve 0042; legacy absent/null tolerated; invalid supplied code rejected before any context/receipt writes. Modern UI requires code. |
| Audit/retry | Old pre-migration receipt and pending request replay unchanged; new coded request replays; changed code under same ID rejects; failed transaction rolls back everything; audit before/after codes tied to correct cycles; no operation schema duplication. |
| Concurrency | Same expected revision first-start race; stale replace/edit/undo; ABA; two coded starts with distinct IDs; conflict cannot copy/reassign code; code association stable after undo/replacement chains. |
| API/cache | Exactly one mutation signature; old/new PostgREST named body dispatch after cache reload; missing/null versus non-null canonical equality; same-revision raw snapshot equality; mixed-version tabs; schema-change refresh on legacy cache. |
| Security | Unauthenticated/foreign-user writes denied; authenticated direct INSERT/UPDATE/DELETE denied; no new EXECUTE for PUBLIC/anon/service_role; internal snapshot owner-only; RLS/grants/owner/search_path unchanged; protected labels never establish identity. |
| Realtime/recovery | Context event invalidates/refetches including code; second authorized local device sees code; cache retains field; pending coded request retains exact ID/value; offline cannot invent authority. Clinical backup remains unchanged/excludes sensor rows. |
| Regression | Existing sensor lifetime/grace/reminders/history/order/boundaries/undo/edit and secure UUID tests; full units; accepted cleanup screenshots; both themes, narrow/modern iPhone, tablet/desktop. No fake clinical default data. |
| Rollback/DDL | Lock timeout leaves old function/column intact transactionally; RESTRICT dependency check; preserved grants; old code-bearing rows readable by old app; no destructive rollback of code data. |

## Future client touch points and UX (items 47–50)

| File/function | Planned change, not implemented |
| --- | --- |
| `js/lee-lee-sensor-ui.js`: `form(action)`, draft listeners | For start/replacement only: Sensor Code text input, inputmode numeric, maxlength/pattern 4 ASCII digits, leading zeros untouched. Do not add code to Edit Start Time. |
| Same file: `review()` | Validate `^[0-9]{4}$`, concise error, preserve refresh/revision guard; pass new code option; show new code in semantic review without redesigning accepted start/current/consequence layout. |
| Same file: `renderCard()` | Active and collapsed header `Dexcom G7 · 2345` when available; otherwise `Dexcom G7`. Retain countdown/disclosure layout. |
| Same file: `details()` history mapping | Identify each current/historical/cancelled cycle by its own code when available, no placeholder. |
| Same file: `fixture()` | Mirror optional RPC parameter, canonical request distinction and cycle storage; legacy rows/pending requests remain valid. No production routing change. |
| `js/lee-lee-sensor-sync.js`: `request()` | Optional code option; supply `p_sensor_code` for coded starts; omit for edit/undo/old pending requests. Existing submit/accept/cache/realtime behavior preserved. |
| `js/lee-lee-dexcom-sensor.js`: `validate()` | Validate non-null provided string; allow missing/null; preserve raw snapshot shape. No lifecycle or UUID edits. |
| `js/lee-lees-tracker-sync.js` | Existing RPC name/allowlist/getSensorConnection remain; no new security or routing capability. |
| Backup | No change to clinical export/import. Code follows existing sensor snapshot/cache/server recovery only. |
| Tests | Extend sensor application, local database, local API, browser and preview contracts as matrix above. |

Recommend **A: no edit-code path in MVP**. Code begins with future starts/replacements. Legacy current sensor remains plain Dexcom G7. A correction/add-code-only operation would require reviewed write/audit/idempotency semantics; do not overload Edit Start Time or invent a general sensor editor. Revisit separately if product need warrants it.

Treat pairing code as protected sensor metadata, not a password/authentication factor. Owner-authorized UI/history and Supabase cycle row should contain it; existing snapshots/audit can carry it. Do not put it in console, analytics, generic diagnostics, device attribution or exception strings. No uniqueness rule or narrower Dexcom issuance inference. Keep existing auth/RLS. Current clinical backups do not include it; any future dedicated export requires explicit scope.

## Rollback, risks and next phase (items 51–60)

**Rollback:** prefer reverting client UI while retaining additive column/constraint and compatible RPC. Old client remains supported; stored codes remain intact. Reverting the RPC to the old nine-parameter signature while new clients/pending coded requests exist would break them; do not do that casually. Never drop/backfill/clear codes or receipts as rollback. Failed migration transaction naturally rolls back DDL; after successful installation keep database additions unless separately reviewed data-preserving recovery requires otherwise.

**Risks:** same-revision cache shape, pre-existing receipt replay, accidental same-name overload, stale PostgREST cache, lost default ACL restrictions during function recreation, dependency/lock drift, and mistakenly promising clinical backup coverage. Each has an explicit design/test/preflight gate. No fresh production inspection, no local experimental SQL, and no new implementation tests run in this phase. Proposal remains review-only.

**Simplicity:** one nullable field plus one mutation API evolution and one small internal projection change. Two function definitions need review, but only one write contract changes. No coordinated multi-writer subsystem, trigger, new table or security model. Classification **A** is appropriate for the verified repository architecture; it is not approval to install anything.

**Recommended next phase:** approve database implementation + disposable local validation only: construct one complete migration with the above exact compatibility requirements, extend local DB/PostgREST mixed-client tests, verify ACL/dependency/cache behavior, and produce exact reviewed bytes/hash. Stop before production installation and before client feature implementation unless separately authorized. Subsequent production metadata-only preflight must confirm current schema, function identity/body/owner/ACL/dependencies, RLS/indexes/triggers/publication and manual-history evidence. Any unexplained drift invokes the brief's stop conditions.

Production schema/data/permissions unchanged. Application source and accepted cleanup unchanged, verified against captured hashes. Only this report added. No migration file, checked-in SQL edit, DDL/DML execution, commit, push, PR, merge, deployment, release or service-worker bump.

LLT DEXCOM SENSOR CODE ARCHITECTURE REVIEW — READY FOR DATABASE IMPLEMENTATION REVIEW
