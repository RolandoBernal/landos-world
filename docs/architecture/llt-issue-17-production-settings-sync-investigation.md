# LLT Issue #17 — production settings synchronization investigation

Date: 2026-10-19. Investigation only; no implementation or production access.

## 1. Executive summary

**Incident classification: E — INSUFFICIENT EVIDENCE.** The pending settings write explains the verification block, but its failure cause and remote acceptance cannot be established from the supplied summary. A concrete client/SQL contract defect exists for saves with no audited changes: the client queues a null audit event while the checked-in SQL requires an event ID. A synthetic probe reproduces queue persistence when that rejection is simulated. Whether this is the production operation is unknown.

Do not delete the operation or infer duplicate acceptance from the five-second interval. Obtain the pending operation's sanitized failure and identity metadata before selecting a repair.

## 2. Production evidence

User-supplied evidence, not independently read from the device: iPhone release `2026-10-15-33`; diagnostic time `2026-10-19T18:16:46.029Z`; online true, Realtime connected, one settings operation, retry count 1, zero current settings conflicts, no reported settings/auth error. Remote fetch succeeded at `18:16:34.226Z`, version 32. Verification is `NOT_VERIFIED` because “A shared-settings write is still pending.” Last successful verification is null; last successful full sync is `2026-10-06T12:00:47.674Z`.

Different local/remote plan IDs and empty `mismatchedPaths`/`mismatchedFields` were reported. Different IDs do not establish clinical differences or corruption. Moreover, `evaluateInsulinPlanVerification` initializes those arrays empty and returns on pending writes **before comparison** (`js/lee-lee-diabetes-tracker.js:1760–1811`). Thus these arrays do not establish equality in this state either. Last verification time is runtime state, not an enduring historical record of all device verification.

No October 19 diagnostic JSON or screenshots were located in the repository filename search. Missing: queue operation ID, audit event ID/null status, base version, last attempt/error, coalescing metadata, actual RPC response, and deployed function definitions. No payload, event ID, or server log is inferred here.

## 3. Production/local code comparison

`git ls-remote origin refs/heads/main` returned `e9b844964e759a796f1ce8a8aa4df6b9f0640af5`, identical to local main (PR #151 launcher merge). Current checkout is `feature/lsw-a-la-carte-phase-b`, HEAD `89c81e3`, with extensive pre-existing modifications/untracked reports. Nothing was switched, fetched into refs, reset, or synchronized.

`git diff 89c81e3 e9b8449 -- js/lee-lees-tracker-sync.js js/lee-lee-diabetes-tracker.js supabase` is empty. October 15 PR #150 source baseline, current main, and local working sync/SQL files have identical relevant queue/RPC/verification code, except the local tracker edit below. Release label alone is not cryptographic proof of the installed assets; this investigation did not verify production-served bytes or the device build SHA.

The launcher merge changes shell preferences/presentation, Sprints, build registration and tests; no LLT settings/verification/RPC implementation changes. The local tracker diff removes a three-line migration continuation block referencing `isOffline`, `isAuth`, `isFailed`, and `session` from the render function preceding `renderSharedSettingsMigrationPrompt`. It can affect that UI/error path, but does not alter queue acknowledgment, versioning or RPC serialization. There is no evidence tying it to this pending write; it is not a demonstrated queue repair.

Local incident reproduction: **not established**. Synthetic reproduction below confirms a specific contract failure path only, without production data or a physical iPhone. Ordinary local development/auth-preview modes gate remote synchronization and cannot establish production parity merely by opening localhost.

## 4. Settings write lifecycle

Source references below refer to current working source, also unchanged on main for these functions.

1. `activatePendingPlan` or `savePatientSettings` updates local tracker state, then calls `saveSharedSettings` (`js/lee-lee-diabetes-tracker.js:9828,9870`). Patient Save calls it even when values are unchanged.
2. `saveSharedSettings` normalizes/caches local settings before upload; computes audited differences; creates a queue operation and starts processing (`js/lee-lees-tracker-sync.js:2052–2072`). Cache/queue use separate localStorage keys; they are not a transaction.
3. `createSharedSettingsOperation` creates operation ID/time and, ordinarily, an audit event with a separate stable event ID. Explicit null bypasses event creation. Base version prefers an existing queued base, otherwise supplied/cached version.
4. `coalesceSharedSettingsOperation` retains the oldest base version, maximum retries and existing first audit event, replacing the operation ID/payload with the newest save. Multiple saves can therefore appear as one current operation; its creation time need not be the original event time.
5. `processSharedSettingsQueue` serializes processing behind a shared promise, snapshots the queue and sends audited insert/update RPCs. Updates send `p_expected_version` and `p_audit_event` (`2170–2234`).
6. SQL derives `auth.uid()`, validates expected version, reads current settings and either returns conflict or updates/increments the row and inserts audit history in the same transaction (`202609170002_llt_settings_audit_final.sql:69–100`). Failed audit insertion rolls back that RPC's update.
7. Client requires an object with `status: accepted` and `settings`; errors, unexpected response shapes, or exceptions during acknowledgment enter catch.
8. `acknowledgeSharedSettings` caches an Accepted event, removes the attempted operation by ID, advances queued successors to returned version, and merges remote settings if no successors (`2074–2094`). An exception before removal can leave a remotely accepted request queued.
9. Catch retains the attempted operation as pending, increments retry count and stores sanitized error/category/code/message. Final queue rebuilding preserves newer IDs while removing successfully handled snapshot IDs (`2235–2251`).
10. Fetch/realtime may merge compatible settings but do not themselves acknowledge a queued event. Audit-history fetch also does not remove queue items. Conflict handling removes an equal full shared-settings operation; differing content enters explicit conflict review. Final snapshot cleanup removes that attempted queue item while retaining the conflict record.
11. Once pending/conflicts clear, subsequent verification evaluation requires authenticated configured session, successful authoritative revision, complete matching dose-affecting fields, and no relevant fetch error. Only then may suggested-dose guidance recover. Clearing a queue alone does not force verification to pass.

## 5. Version-32 timeline analysis

Accepted event 31 → 32: `17:03:44Z`. Current operation creation: `17:03:49.130Z` (5.130 seconds later). Diagnostic is about 73 minutes after operation creation.

Another save immediately after acceptance is possible, including an unchanged patient-settings Save. Saves during an in-flight request can replace the queued operation ID while retaining its audit event/base; acknowledgment can then advance the successor's base version. Realtime callbacks and merge callbacks do not directly call `saveSharedSettings`; no direct fetch-to-requeue loop was found in these paths.

Retries use the stored base version, without preflight rebasing. If remote accepted a request but its response was lost, retry normally reaches a version conflict; equality of **all shared settings**, not merely clinical fields, can clear it through `registerSharedSettingsConflict`. Otherwise it becomes a conflict for review. A queue fetch alone cannot prove prior acceptance.

The reported creation timestamp does not reveal whether this is a second change, coalesced successor, unchanged save, or retry of an accepted event. It cannot authorize removal. Retry count 1 is not proof of one lifetime request: coalescing, current-operation identity and persistence must be examined. Five-minute intervals also depend on browser execution; iOS background suspension and unresolved requests can prevent expected attempts.

## 6. Queue/retry findings

- Shared-settings retries occur on save, startup/auth reconciliation, online event, visibility return, manual sync and five-minute reconciliation (`2731–2752`). There is no settings-specific exponential backoff, maximum attempts, timeout, or terminal deterministic-error state in this loop. Do not confuse record-queue backoff/needs-attention behavior with settings behavior.
- A settings RPC rejection remains pending indefinitely if unchanged. Catch records queue-item errors but does not set the top-level settings/auth error. Successful fetch clears fetch errors independently. Therefore the reported no-error state does not rule out repeated RPC failure.
- An unresolved RPC keeps `processSharedSettingsQueuePromise` occupied; later callers join it. `lastAttemptAt` is persisted only when an error is caught, not before awaiting RPC. A silent in-flight stall is another unproven possibility.
- Fetch failure in `reconcileSharedSettings` prevents reaching the processor in that invocation. The supplied successful fetch rules out that particular fetch failure at that time, not an earlier failure.
- Full-sync success timestamp advances only when aggregate pending/conflicts/errors clear (`syncAll:2585–2612`). An old timestamp does not prove every intervening record/settings read or write failed.
- Queue diagnostics use generic `sanitizeOperationMetadata`; the synthetic shared-settings item reports `expectedTarget: lee_lee_records`. Treat that generic diagnostic label as misleading, not evidence the write actually targets records. Actual RPCs target shared settings.

## 7. RPC and audit findings

**Confirmed source defect, production causality unconfirmed:** `saveSharedSettings` passes null audit event when `sharedSettingsChanges` is empty. `auditEventToRemote` returns null (`770`); final SQL extracts null event UUID and inserts it into primary-key `event_id`. Both accepted and stale-version conflict insertion paths require that ID. PostgreSQL rejects null primary-key insertion; the transaction rolls back. Neither unchanged local values nor a successful fetch removes the operation beforehand. This can therefore leave pending=1, no conflict, successful fetch, and no top-level settings error.

Synthetic probe `/tmp/llt17-probe.mjs` uses existing in-memory VM/test helpers, synthetic version 32 and a mocked `23502` rejection: unchanged save yields null audit event; initial processing leaves pending=1; successful `syncSharedSettings()` fetch plus retry leaves pending=1, retryCount=2, code `23502`. This is **not** a real PostgreSQL execution or observed production response. Existing mock accepts a null event and thus conceals the SQL constraint gap.

**Idempotency limitation:** final SQL uses `ON CONFLICT(event_id) DO NOTHING` only for audit insertion. It does not first look up a previously accepted event and return its original result. Duplicate event IDs do not by themselves guarantee idempotent settings mutation. Coalescing can retain an audit ID while changing desired payload. Simply adding server event-ID deduplication without fixing successor identity could discard a legitimate later change. These are source risks, not proof that version 32 was this operation.

Installed SQL/schema/grants and RPC return shape were not inspected live. Repository setup documentation prescribes the final audit migration and warns against using the historical earlier file. Do not assume production definitions match either merely because the repository contains them.

## 8. Insulin-plan verification findings

Pending-write refusal is intentional and correct (`evaluateInsulinPlanVerification:1778`). Plan ID inequality is not its trigger. Empty mismatch arrays in an early-return result are inconclusive. A successful settings fetch is necessary evidence but cannot override a pending intent. Preserve calculation/rounding/correction/temporary-adjustment behavior and all verification prerequisites.

## 9. Existing test coverage and validation

Executed `node --test tests/lee-lees-tracker-sync.test.js tests/lee-lees-tracker-storage.test.js`: **111 passed, 0 failed**. Executed reporting tests with `--test-name-pattern='insulin-plan verification'`: **3 passed, 0 failed**. These use synthetic VM data; no real Supabase or browser profile is involved. Probe described above also passed after correcting its call to the exported `syncSharedSettings` API.

Existing tests cover accepted settings acknowledgment/audit grouping, complete serialization, cached base versions, stale-version conflict and preservation, cross-device reads, offline reload/exactly-once mock synchronization and coalescing. Verification tests cover complete matching plans, mismatches, and unavailable prerequisites. SQL tests inspect source strings; mocks do not enforce real event UUID/null constraints.

Missing targeted evidence/coverage: accepted-but-interrupted response with actual SQL semantics; duplicate event-ID replay; stale retry with null event; unchanged Save; settings fetch/realtime during queued/in-flight writes; edits/coalescing across acceptance; queue restart after partial acknowledgment/local-storage failure; stalled RPC; long-lived deterministic failures and error visibility; end-to-end verification recovery after settings queue clears. Existing record/food tests do not substitute for these settings cases. No unrelated tests changed.

## 10. Confirmed findings versus hypotheses

Confirmed: production reports pending=1 and corresponding fail-closed refusal; source has null-audit contract gap, independent fetch/ack paths, retained retry errors, and incomplete event-ID idempotency; launcher source does not change these paths. Synthetic rejection demonstrates local persistence for the null-audit path.

Unconfirmed: production null audit; remote acceptance of this operation; response loss/local-storage failure; old expected version; coalesced successor; server deployment mismatch; suspended/stalled retries. No production hypothesis is ruled out solely by timing or empty mismatch arrays. Different IDs alone are ruled out as proof of clinical mismatch; launcher changes to these LLT functions are ruled out by Git diff. No data corruption is demonstrated.

## 11. Root-cause classification

**E — INSUFFICIENT EVIDENCE for the October 19 incident.** There is a confirmed application/client-SQL contract defect in source, but selecting A, B, C or D as the incident cause would require connecting it to the actual queued operation or deployed RPC. Production impact is blocked suggested-dose guidance while unresolved settings intent prevents authoritative plan verification. No evidence establishes loss of records or accepted settings.

## 12. Smallest safe corrective plan (conditional; not approved or implemented)

If the pending item has null audit plus the corresponding required-ID error, scope implementation to `saveSharedSettings`, event construction/coalescing and targeted sync tests. Avoid creating a new write only when a save is proven a semantic no-op with no pending intent requiring preservation; otherwise ensure every submitted mutation has a valid audit identity. A null event must never reach an audit-required RPC. Add a faithful SQL-constraint mock or disposable database test and expose retained settings errors usefully. Do not silently drop an existing null-event operation based on this diagnosis.

For the existing operation, design a separately reviewed recovery after inspecting full intended shared settings locally and authoritative current revision. Preserve its original payload and metadata; if still an unaccepted legitimate intent, assign a valid event through a reviewed recovery transition and retain optimistic version/conflict protection. If already accepted, require identity/acceptance and successor-intent reconciliation evidence before acknowledgment. Fetch authority again and reevaluate existing verification normally afterward. No forced PASS.

A client null-event prevention fix need not require a production migration. An idempotency repair would require a separately reviewed additive RPC migration plus distinct immutable event identity for in-flight successors; it is broader and should not be bundled without evidence. Deployment rollback cannot undo accepted settings/audit events; preserve queues and payloads, use the normal PR release gate, and recognize old clients may recreate the defect. A client release alone is not proof the existing operation is recovered.

## 13. Remaining diagnostic requirement

**ONE highest-value step:** inspect the current pending operation's sanitized metadata from the production device, preferably the already-exported diagnostic JSON. Needed fields: operation ID, creation/last-attempt time, base version, retry count, last error category/code/message, and audit event ID or explicit null status (plus coalescing count if available). Existing diagnostics expose errors/base version but may omit audit identity. If omitted, a separately authorized read-only device inspection should return only those metadata fields, never the settings payload, names, dates of birth, tokens or storage dump. Do not press Save or initiate retries merely to obtain evidence.

If a non-null event needs remote correlation, a separately approved read-only query can establish whether that identity has an Accepted event. Example parameterized SQL, **not executed**:

```sql
begin read only;
select event_id, status, version_before, version_after,
       client_created_at, accepted_at
from public.lee_lee_settings_audit
where authorized_user_id = :authorized_uid
  and event_id = :pending_event_uuid;
select version, updated_at
from public.lee_lee_shared_settings
where user_id = :authorized_uid;
rollback;
```

Use an approved read-only administrative session with SELECT permission, or the existing authenticated account constrained by RLS. No credentials need be shared with Codex. An Accepted row proves acceptance of that event identity, not of a changed coalesced successor payload; absence does not prove no acceptance if deployed logging/schema differs. Schema/function-definition inspection would be a later separately approved read-only step if the error points to deployment mismatch.

## 14. Production safety and separate backlog

No production database calls, writes, migrations, settings edits, sign-out, reinstall, cache/data clearing, queue removal, or clinical changes occurred. Synthetic probes used disposable in-memory storage. Existing repository work and diagnostic reports were preserved. Git main comparison was read-only; no fetch was needed because the verified remote SHA already existed locally. Workflow skill explicitly excludes read-only investigations.

Preserved separate P1 backlog: (A) Settings Change History horizontal overflow for serialized values/temporary adjustments; (B) Carb Calculator bottom-sheet scrolling on production iPhone. Neither was investigated or fixed here.

## 15. Exact next action

Inspect the pending item's sanitized error/base-version/audit-identity metadata from the existing October 19 export. Choose the narrowly scoped implementation and any separate queue recovery only after that evidence identifies the failing path. Implementation, production read queries and recovery each remain subject to their applicable authorization; PR merge remains Rolando's release approval gate.

## Phase B — Pending Operation Diagnostic Evidence

### Evidence availability and export gap

Phase B inspects the serialization boundary only; it does not repeat the architecture investigation. The actual October 19 JSON remains unavailable in the workspace/attachment filename searches. Conclusions about its structure below follow the checked-in export implementation, not a newly inspected production file. Supplied facts establish pending=1 and the verification refusal; clinical equality remains user-reported rather than established by the early-return mismatch arrays.

`getSyncDiagnostics()` in `js/lee-lees-tracker-sync.js:1381` builds a separate `sharedSettingsQueue` through `sanitizeOperationMetadata` (`888`). However, `buildSyncDiagnosticsPackage()` in `js/lee-lee-diabetes-tracker.js:8515` exports `queue.operations` from **`diagnostics.queue` (records only)**. It never copies `diagnostics.sharedSettingsQueue`. Consequently aggregate totals can include a settings operation while exported operations omit it. This sharpens and supersedes section 13's tentative statement that existing diagnostics expose the necessary errors/base version: they exist internally, but are not exposed for settings through the ordinary export.

| Required evidence | Existing internal repository diagnostic | Existing Settings export/UI |
| --- | --- | --- |
| A: operation ID | `sharedSettingsQueue[i].id` | Omitted |
| B: expected/base version | `sharedSettingsQueue[i].baseVersion` | Omitted; displayed remote/cache version is not the queued base |
| C: audit event ID/null status | Raw queued `auditEvent.eventId` / `auditEvent === null`; not serialized | Omitted; history export also omits event IDs |
| D: last rejection | `lastErrorCategory`, `lastErrorCode`, `lastErrorMessage` on the item | Omitted; general/fetch errors are different channels |
| E: retries/eligibility | Item `retryCount`; generic `transient` classification | Aggregate retrying-item count only; not per-operation attempts/eligibility |
| F: timestamps | Item `operationCreatedAt`, `lastAttemptAt` | Aggregate oldest time only; no settings last attempt |
| G: state | Item `state`/`syncState` | Aggregate `byState`; settings status can show waiting/syncing |
| H: awaiting acknowledgment | Not a persisted operation state; live processor flag only | “Saving…” can indicate active processing, not server acceptance |

Existing paths for aggregate evidence: `sections.syncDiagnostics.queue.{total,oldestCreatedAt,retryingCount,byState}`, `sections.syncDiagnostics.sharedSettings`, and `sections.syncStatus.pending.settings` in Copy All Settings Diagnostics. Copy Section Info for Sync Diagnostics wraps the same package under `data`; it does not restore missing settings operations. `renderSyncDiagnostics:8748` renders individual **food** queue items, not shared-settings items. `buildSettingsChangeHistoryDiagnostics:8550` provides status/time/versions/changed-field labels but strips event identity. Neither that history nor missing history establishes acceptance of this local intent. In particular, exported `retryingCount` counts items with nonzero retries; it is not their attempt count.

The only local source of the absent audit identity/null status is the production iPhone queue key `lando-world:lee-lees-tracker:shared-settings-queue:v1`. Mac storage and remote Supabase do not substitute for it. No device storage inspection or debugging was performed or proposed as an immediately executable procedure.

### Hypothesis-to-evidence mapping

| Hypothesis | Minimum discriminating evidence and limits |
| --- | --- |
| A: null audit rejected | Actual queued audit object state (null/missing/present), event-ID presence, and item error code plus allowlisted constraint classification. Null plus `23502` specifically classified as audit `event_id` not-null rejection supports this path; `23502` alone does not identify the table/column. A valid event on the *attempted* immutable operation rules out null audit for that attempt, not every prior/coalesced attempt. |
| B: stale expected version | Item base version and contemporaneous authoritative version; an observed structured conflict result establishes rejection for staleness. Lower base alone shows version divergence, not the last RPC outcome or whether it was previously accepted. An earlier fetched version 32 cannot establish the current server version. |
| C: accepted, unacknowledged | Non-null event identity correlated with an Accepted remote event and versions; must also establish it refers to the attempted payload rather than a coalesced successor. Queue presence plus matching values or timestamps is insufficient. No event match leaves this undetermined without deployed audit semantics. |
| D: retry/reconciliation defect | Same operation's retry count/last attempt/error, live processing flag, online/auth prerequisites and a later observation under known foreground execution. A single old timestamp cannot distinguish suspension, hung RPC, lost bookkeeping or scheduler failure. No explicit retry or settings save should be initiated merely to collect evidence. |
| E: other server/RPC rejection | Item error category/code and safe response classification (authorization, network, response shape, other constraint, etc.). These distinguish candidate failure families; they cannot prove a production schema defect without separately authorized definition inspection. |

### Null-audit finding

**Undetermined for production.** The observed pending/no-conflict/no-general-error combination is compatible with the source contract defect: catch retains pending, increments item retry count, records SQL error on the item, and does not set a general sync error. Final checked-in SQL rejects a null audit UUID with `23502` when it tries to insert audit history, including on the stale-version branch; no structured conflict result reaches the client if that insertion throws. The update is rolled back. Production's installed definitions and actual item are still unknown. No current export safely reveals the null condition. A refreshed current export would retain this omission, so another export is **not requested**.

### Preferred next step: authorize a metadata-only diagnostic export

The existing installed UI/export cannot supply the minimum set. **Preferred next action is approval to implement a narrowly scoped diagnostic-only export**, then submit it through the normal branch/PR review gate. This is a proposal only; no diagnostic implementation has been made. Do not combine it with the null-audit fix or queue recovery.

Proposed strict export allowlist:

- Envelope: diagnostic schema version, capture UTC time, running build SHA/release, online boolean, authenticated-session-present boolean (no session identifier), settings pending/conflict counts, live settings processor-active boolean, and latest authoritative settings version/fetch time if already in memory.
- Each settings operation: operation ID, operation type, base version, stored state, creation time, persisted last-attempt time, retry count, coalesced count, audit object state (`null`, `missing`, `present`), event-ID state (`missing`, `invalid`, `present`) and event ID only when valid. Treat IDs as correlation metadata, not credentials or device identities.
- Failure: allowlisted error category, validated SQLSTATE/PostgREST/HTTP code, and a fixed enum describing the recognized failure (for example `audit-event-id-required`, `authorization`, `network`, `invalid-rpc-response`, `other-constraint`, `unknown`). Emit no arbitrary message/detail/hint. Recognize `audit-event-id-required` only when the internally inspected message explicitly identifies both the audit table and `event_id` null constraint; otherwise retain `unknown`/`other-constraint` and code. Existing `sanitizeSupabaseError` merely truncates strings, so its text must not be copied wholesale or claimed privacy-redacted.
- Retry prerequisites: online, session-present and processor-active flags only; label eligibility as conditional on those prerequisites. Do not export the record queue's generic `transient` flag as a settings retry guarantee. Persisted error/timestamp is the last retained failure, not guaranteed current in-flight state. Do not claim an `awaitingAcknowledgment` boolean establishes remote acceptance; that outcome remains unknown without correlation.

The export must only read existing in-memory/persisted metadata, without fetching, calling sync, creating audit IDs, touching retry state or invoking writes. Omit settings payloads, clinical values, patient identifiers, raw errors, tokens, credentials, auth/session IDs, user IDs, installation/device identifiers, record/food data and unrelated history. Unknown values must stay unknown; do not manufacture attempt/result fields that the current queue never persisted. Test the export with synthetic canaries to ensure excluded data cannot appear and stored bytes remain unchanged.

Code scope would be a dedicated settings-operation metadata builder in `js/lee-lees-tracker-sync.js` and an explicit metadata-only copy action/package in `js/lee-lee-diabetes-tracker.js`, plus focused synthetic tests. It requires authorization for code work, PR review/merge for any production release, and subsequent **user-operated** read-only copying on the actual iPhone through the new action. It does not require database access, credentials, remote debugging or storage inspection. Release adoption must follow the existing updater, respect pending-write/reload blockers and preserve queue bytes; do not force a reload if blocked. Ordinary app resume may independently trigger existing sync, so the export cannot promise to freeze the queue; capture timestamps and current identity accurately.

Exact authorization requested for the next phase: **implement and validate this metadata-only export for review, with no sync fix, queue recovery, production writes or deployment authorization.** After an approved release is available and safely adopted, the user would open LLT Settings → Sync Diagnostics → the proposed “Copy Pending Settings Metadata” action and share only that output. That action does not exist yet; do not look for it in the current PWA.

Only if the captured non-null event requires acceptance correlation should a separately approved read-only database lookup from section 13 follow. Such a lookup can see remote events, never an unsubmitted local operation. Preserve the pending intent and fail-closed dose safeguard throughout. Incident classification remains E.

## Phase C — Metadata-Only Diagnostic Export

### Implementation and isolation

Implemented locally on `feature/llt-issue17-diagnostics`, based on synchronized main/origin/main `e9b844964e759a796f1ce8a8aa4df6b9f0640af5` after `git fetch origin main`. The isolated managed worktree is `/Users/rolandobernal/.codex/worktrees/llt-issue17-diagnostics/landos-world`. The original workspace/branch and all its pre-existing code changes, including the local `isOffline` edit, remain untouched. This report is mirrored to its original requested workspace path for continuity. Phase C supersedes Phase B's request for implementation approval; implementation was authorized, production delivery was not.

Exactly six task files:

1. `js/lee-lees-tracker-sync.js` — new read-only `getPendingSharedSettingsDiagnostics` repository API; no write/RPC/retry changes.
2. `js/lee-lee-diabetes-tracker.js` — new dedicated metadata package/copy action, additive field in existing sync diagnostics, and early routing around persisted Settings UI bookkeeping.
3. `tests/lee-lees-tracker-sync.test.js` — synthetic serialization, privacy, error classification, byte-preservation and in-flight observation tests.
4. `tests/lee-lees-tracker-reporting.test.js` — existing export compatibility and unchanged fail-closed verification test.
5. `tests/browser/llt-pending-settings-diagnostics.spec.js` — guarded action, native click, clipboard failure and storage/sync/verification checks.
6. `docs/architecture/llt-issue-17-production-settings-sync-investigation.md` — this report.

No package, storage schema, migration, RPC, settings-save, clinical calculation, service-worker or release-identity source changes. Existing source functions are unchanged except the additive diagnostic package/UI integration and routing of the new action.

### Exact exported fields

Dedicated package envelope: `schemaVersion` (1), `capturedAt`, `online`, `authenticatedSessionPresent` (boolean only), `processorActive`, `authoritativeVersion`, `authoritativeFetchedAt`, `operations`.

Each operation has this explicit allowlist: `operationId`, `operationType`, `baseVersion`, `auditEventState`, `auditEventIdState`, `auditEventId`, `lastErrorCategory`, `lastErrorCode`, `lastFailureClassification`, `retryCount`, `coalescedCount`, `state`, `createdAt`, `lastAttemptAt`, `nextRetryAt`, `retryEligibility`, `acknowledgmentState`.

Audit object state distinguishes `null`, `missing`, `present`, and `invalid`; event-ID state independently distinguishes `null`, `missing`, `present`, and `invalid`. Operation/event identifiers are retained only when UUID-shaped, normalized to lowercase; other identifier strings become null. These are opaque operation/event correlation IDs, not patient/account/session/device identifiers. Nonnegative safe-integer validation applies to numeric metadata; absent/invalid values stay null. Valid UTC ISO timestamps are normalized; absent/invalid timestamps stay null. Operation types, states and error categories use fixed allowlists. No payload properties are traversed or exported.

Error codes are limited to known SQLSTATE codes and structurally validated PostgREST/HTTP error codes. Error text remains local: only fixed classifications are exported (`audit-event-id-required`, `invalid-rpc-response`, `authentication`, `authorization`, `network`, `duplicate`, `missing-record`, `other-constraint`, `other-rejection`, `unavailable`). `audit-event-id-required` requires code `23502` and a retained message explicitly identifying the audit table, `event_id` and not-null failure; a generic `23502` cannot acquire that label. No message/detail/hint, payload, clinical value, patient name/date, token, credential, session/user/device identifier, unrelated record or arbitrary object spread enters this package.

Retry scheduling and per-operation acknowledgment outcomes are not tracked by the existing settings queue. Accordingly `nextRetryAt` is null, `retryEligibility` and `acknowledgmentState` are `unavailable`. Online/session-present/processor flags expose current prerequisites without asserting that a retry will occur or that a write was accepted. `lastAttemptAt` is the persisted last failed attempt; an in-flight attempt may not yet be represented. Retained error metadata cannot establish that it belongs to a different coalesced successor. Event correlation may still require separately authorized read-only server inspection; no acceptance diagnosis is fabricated.

### Access and non-mutation

New action: **LLT Settings → Sync Diagnostics → Copy Pending Settings Metadata**. Success/failure is announced in an inline live status region. The action requires clipboard access and gives fixed safe feedback when unavailable/denied. It does not fall back to selecting a broader diagnostic/storage dump. The dedicated action copies only the allowlist above; use that output for this incident, rather than sharing the broader legacy Settings package, which includes additional existing settings/device diagnostics.

Existing Copy All Settings Diagnostics and Sync Diagnostics Copy Section Info remain backward compatible, with an additive `pendingSharedSettings` field (`sections.syncDiagnostics.pendingSharedSettings`, or `data.pendingSharedSettings` in the section export). Existing record `queue.operations` retains its original meaning.

Collection reads only the settings queue and already-held runtime metadata. It does not initialize a client, fetch, generate identity, sync, retry, save, persist diagnostics or alter verification. The new action returns before the normal Settings click handler's sessionStorage bookkeeping and does not rerender Settings. Only its inline copy feedback changes. Ordinary navigation/scrolling can independently persist existing UI state, and normal foreground synchronization can still occur independently; the diagnostic action does not freeze the app or claim otherwise.

### Validation

- Focused LLT sync/reporting/storage tests: **264 passed, 0 failed**, using synthetic fixtures.
- Pages builder tests: **3 passed, 0 failed**.
- Browser final suite: **8 passed Chromium/mobile Chromium; 8 passed desktop WebKit/iPhone WebKit**. Guarded action tests trap all local/session storage writes/removals, fetches and repository sync calls; compare storage bytes; cover clipboard success, absence and rejection. A separate native-click test preserves all localStorage data and makes no synchronization calls. Tests retain the verification block. Browser tests run only on local disposable origins, with external requests blocked.
- `npm run check:js`, explicit syntax check for the new browser file, and `git diff --check`: passed. Full runtime diff reviewed; no clinical/write/RPC implementation changes.
- Production Pages builder: passed using synthetic release `2026-10-19-999` and base SHA as build inputs. Artifact: `/var/folders/_x/w_9mk62s5z33r9rkbz20jnzh0000gn/T/landos-pages-build-llt17-phasec-final`. This validates the uncommitted source build; it is not a production release or identity claim for these changes.

During validation, the initial browser fixture used an incorrect Settings locator and was corrected. Storage traps then exposed the existing action-handler UI persistence, motivating the diagnostic-only early return. Guarded tests dispatch the action after navigation/scroll/focus settles, so unrelated browser scroll persistence is not attributed to copying; native-click checks separately cover normal interaction. WebKit initially could not launch because its runtime was absent; the matching runtime was installed and the final suites passed. Earlier failed/interrupted runs are not counted as passes. Automated iPhone WebKit is not physical-iPhone/PWA or real production-queue evidence. No production data was used and no unrelated legacy failure was repaired.

### Production delivery, risks and rollback

A production deployment is required before the installed iPhone can expose these fields. No deployment, updater action, production device access or queue recovery occurred. After explicit release-preparation authorization: review only these six files, stage/commit/push the dedicated branch, create a PR, and stop for Rolando's review. Rolando's merge remains the release gate; the existing Pages workflow generates canonical full-SHA metadata and deploys main. Do not manually deploy or invent a cache identity.

After successful approved deployment, adopt through the existing updater only when its normal safety gates permit it, then use the new action on the physical iPhone and share only its metadata output. Pending writes may affect reload/adoption eligibility; do not bypass any blocker, force-refresh, clear caches/data, reinstall or discard the operation to obtain the diagnostics. Clipboard access on the installed iPhone remains to be verified. The production incident remains classification E until actual metadata arrives; this diagnostic change fixes neither null-audit submission nor the existing queue.

Risk is limited to diagnostic serialization/UI integration and ordinary release adoption, but is not zero: missing/legacy identifiers may be unavailable, retained error text may be insufficient for a specific classification, and background sync may change the queue between observations. No migration or data transformation is required. Rollback would revert only the diagnostic additions through a reviewed branch/PR and normal deployment. It must preserve all queue/storage data; returning to the old export simply removes the new visibility. No rollback, recovery or production release is authorized by this local implementation phase.

**Next authorization:** approve preparing these six files for a reviewable PR. No files were staged or committed, and nothing was pushed, merged or deployed.

Local review preview: `http://127.0.0.1:8766/#/lee-lees-tracker`, loopback-only LOCAL DEV with Supabase synchronization disabled. Served sync/tracker files were byte-compared with the implementation; metadata identifies the diagnostic branch and dirty baseline. Port 8765 already served a different source and was left untouched. The preview stays running for review. Earlier investigation line references retain their pre-Phase-C baseline numbering.
