# LLT #14.5 — investigation and architecture approval gate

Date: October 3, 2026 (America/Chicago).
Status: PHASE 1 RESUMED, BLOCKED AT EXISTING BASELINE MIGRATION REPLAY. Docker now works; local Supabase startup fails because historical and final settings-audit migrations have incompatible RPC return types. Production execution remains prohibited. Original investigation/design/blocker history below is preserved; the latest resume section supersedes previous environment status.

## Baseline and scope

- Branch remains `main`; no implementation branch created because the architecture gate was reached first. Proposed branch after approval: `feature/llt-alerts-dexcom-tracker`.
- Starting main: `25b360affe2fcdd0f157eafd55323f4e5155705b`. Fetch succeeded; local main equals origin/main.
- #14 PR #139 is merged at that SHA. Its automatic Pages workflow succeeded: https://github.com/RolandoBernal/landos-world/actions/runs/37165786112 . Production-served asset identity was not independently checked in this investigation.
- Existing untracked diagnostic reports and `death-on-notecards/` were preserved.
- No application code, medical data, schema, authentication, service worker, or production infrastructure changed. #12 untouched. No commit, push, PR, merge, or deployment.

## Existing architecture

`js/lee-lee-pre-meal-timer.js` owns a separate device-local timer key, `lando-world:lee-lees-tracker:pre-meal-timer:v1`, and settings key. It persists numeric `startedAt`/`endsAt`, status, duration and an entry-source snapshot. `normalize(now)` completes overdue active timers from the persisted deadline; it does not create a fresh timer. Dismissal removes only this timer key. There is no alert-delivery or acknowledgement ledger in this module. Default duration is 15 minutes; existing user settings support 1–60 minutes and the timer supports adjustment. Those existing semantics need preservation, rather than silently forcing all saved settings to 15.

The tracker integrates the timer with its post-save offer, Today card and timer detail/stop/conflict modals. Existing tests include `tests/lee-lee-pre-meal-timer.test.js` and browser smoke cases. LLT UI/data typography uses DM Sans/Roboto Mono. The intended Dexcom placement is a compact independent Today card alongside existing operational timer UI, outside entry cards; exact responsive placement remains unimplemented.

The service worker provides application-shell/offline caching and update messaging. It contains no push subscription, push handler, notification click handler or deadline scheduler. The manifest uses standalone display and the production `/landos-world/` scope. VFGT has app-local Web Audio helpers; these can inform a brief synthesized LLT chime but do not supply background scheduling.

The persistence ADR describes the original local document and is incomplete about current sync. Current code and migrations were consulted directly. Remote contracts are specialized records, shared settings, food library and settings audit, rather than arbitrary family operational data.

## Blocking persistence finding

`normalizeSharedSettings`, `sharedSettingsFingerprint`, `sharedSettingsFromRemote` and `sharedSettingsToRemote` in `js/lee-lees-tracker-sync.js` explicitly select patient/clinic fields and insulin configuration. The serializer reconstructs `payload`; it does not preserve arbitrary sensor fields. The SQL JSONB column alone is therefore not an appropriate general-data contract.

Adding sensor cycles there would require a new normalization, queue, merge, conflict, audit and compatibility contract. Older clients can rebuild the settings payload without sensor history, potentially erasing it. A single versioned settings row also couples sensor operations to clinical settings conflicts. This cannot be treated as a harmless extra property.

For consistent family-device sensor state and retained history, the recommended smallest safe design is a dedicated family-authorized sensor-cycle table with cycle ID, authoritative start, actual end, created/updated timestamps and version, plus explicit concurrency handling. New-cycle creation must transactionally close the previous cycle and create the next; simultaneous replacements must produce a visible conflict rather than two silently competing active cycles. Correction/deletion should use version checks; deletion should retain recoverable history through a tombstone or equivalent approved policy. Reuse established authenticated-family authorization and queue patterns, but do not reuse insulin records or food data as surrogate sensor storage. Exact SQL, authorization owner and RPC design require review before migration.

Alternative requiring explicit scope approval: device-local V1 with clearly labeled unsynced sensor cycles and history. This avoids a migration but does not provide one consistent family-device sensor schedule. Do not silently choose that reduced scope.

The supplied prompt says: “If robust cross-device persistence requires a material architectural/database change: STOP and present the design before implementing it.” That is the current stop condition. No partial foreground implementation was started after discovering it.

## Authoritative research

Sources accessed October 3, 2026 (client timezone):

- Dexcom standard G7 wear duration: https://www.dexcom.com/en-us/faqs/how-long-can-i-wear-the-sensor — up to 10 days plus 12-hour grace. Standard G7 and G7 15 Day are distinct products; do not substitute the latter.
- Dexcom lifecycle/approaching alerts: https://www.dexcom.com/en-GB/m/faqs/how-long-can-i-wear-sensor-g7?ipc=US — session/grace-end alerts confirmed. Exact 24-hour warning and insertion-versus-activation clock semantics still require the applicable official user guide before constants are implemented. No guessed warning threshold shipped.
- WebKit installed iOS Web Push: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ — Home Screen apps on iOS/iPadOS 16.4+, direct interaction for permission, OS notification integration.
- Apple push architecture: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- Service-worker notification API: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification — secure context, notification permission; `timestamp` is notification metadata, not scheduling; default sound respects device behavior.
- Worker lifetime/background operation: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
- Background Sync: https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API
- Periodic Sync: https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API
- Wake Lock: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
- Gesture-gated audio: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices

## Capability matrix

| Approach | Classification for this requirement | Practical limit |
| --- | --- | --- |
| HTMLAudio / Web Audio chime | FOREGROUND ONLY | Unlock/resume from a user gesture; playback can fail. Does not guarantee execution after lock/suspension. |
| Persisted deadline and foreground catch-up | FOREGROUND ONLY | Correct current state when execution resumes, not delivery during suspension. |
| Notifications API | PARTIALLY RELIABLE | Display primitive with permission/context requirements, not a future alarm scheduler. |
| Service-worker notification | PARTIALLY RELIABLE | Can display when an event runs; cannot independently wake at an arbitrary deadline. |
| Web Push | PARTIALLY RELIABLE | Reaches installed permitted apps while closed/locked; needs remote sender, network and OS delivery. |
| Server-scheduled Web Push | PARTIALLY RELIABLE | Strongest legitimate background approach; no exact-time/offline/audible delivery guarantee. Requires new infrastructure. |
| Background Sync | NOT SUPPORTED / NOT APPROPRIATE | Connectivity-driven work, not deadline scheduling; not a portable iPhone solution. |
| Periodic Background Sync | NOT SUPPORTED / NOT APPROPRIATE | Browser-controlled cadence, not exact deadlines or supported iPhone alarm architecture. |
| Screen Wake Lock | NOT SUPPORTED / NOT APPROPRIATE | Keeps visible screen awake under conditions; cannot alarm on a locked device. |
| Local scheduled web notification | NOT SUPPORTED / NOT APPROPRIATE | No supported iOS future-trigger notification API established. |

No approach earns an unconditional reliable locked-iPhone alarm classification. Web Push also cannot force sound through device notification settings, Focus, mute or network loss. Safari tabs do not replace the installed iPhone Home Screen push context. HTTP LAN previews cannot validate secure-context push behavior.

## Proposed implementation after approval

Keep domain logic separate from a small deadline evaluator. Timer IDs should include persisted start/deadline identity; sensor milestone IDs should include cycle and start revision. Persist delivered/acknowledged state, consume before dispatch to suppress repeated renders/ticks, and handle storage/audio failure explicitly. Evaluate on tick while visible and on resume. For missed sensor milestones, present only the current lifecycle state, not a queue of stale sounds. Audio initialization belongs in the Start Timer user gesture; chime failure must never break completion state.

Sensor cycles: ID, authoritative start timestamp, actual end timestamp when replaced, creation/update timestamps and concurrency version. Derive expected expiration and grace end, do not persist independently stale deadline values. Active correction recalculates all states; early replacement requires confirmation and archives the previous cycle with the actual new start as end, subject to chronological validation. Accidental cycle recovery needs confirmed undo/delete semantics that preserve previous-cycle history.

Start/edit UI uses editable local date/time inputs with a current-time default. History is operational dates, not analytics. Validate future and contradictory dates, invalid DST local times and ambiguous times. Once official clock semantics are verified, use elapsed timestamp arithmetic for lifecycle durations rather than adding calendar labels; test midnight/month/year/DST boundaries. Keep patient identity, insulin and glucose out of alert content.

Offline local state must continue deriving lifecycle correctly. Remote mutations require durable pending operations and explicit conflicts. Device alert acknowledgement should remain device-local unless a different family-wide acknowledgement policy is approved.

Smallest separate push proposal: authenticated subscription registration/revocation, minimal deadline jobs, transactional reschedule/cancellation on timer/sensor edits, bounded server scheduler and Web Push sender, stale-job checks and delivery deduplication, generic lock-screen text, expiration/retry policy, push/click service-worker handlers and opt-in permission UI. Existing Supabase could host approved tables/functions, but repository evidence does not establish an existing scheduler/sender. This requires a separate backend/privacy approval and must not be introduced silently. Do not store entry-source insulin snapshots in push jobs.

## Validation and readiness

No automated implementation tests run (0), no runtime/responsive inspection completed, and no physical-iPhone verification prepared: architecture approval comes first. This is not a test pass or feature readiness claim. Only repository/history/source inspection and official-source research were performed.

After approval, required coverage includes timer duration/deadline persistence, one-time foreground alerts and audio failure; lifecycle boundaries/correction/replacement/history; duplicate acknowledgement and latest-state catch-up; storage/sync conflict safety; exact date/DST semantics; post-save/Today regressions. Use injectable clock fixtures, never a production control that changes real lifecycle constants. Inspect 320/393/768/1280px and iPhone landscape.

Physical preview must use repository tooling with production auth/sync disabled and isolated origin data, preserving the chosen session port. Supply its verified exact LAN URL after implementation. Test foreground/background/lock/resume/no duplicates, sensor state fixtures, history, correction, confirmation, reload and offline state. HTTPS plus installed Home Screen app and granted permission are necessary for meaningful iPhone Web Push testing if that separate infrastructure is approved.

Timer code/default remains unchanged at 15 minutes; no Dexcom constants implemented yet; no clinical calculations or glucose integration changed; no schema/migration/backend introduced. Files changed: this report only. Final tracked diff: none; report is untracked alongside pre-existing unrelated files. No feature verification URL exists yet.

Final capability statement C: Reliable locked-iPhone timer and Dexcom alerts require additional Web Push/server-side scheduling infrastructure that has NOT been implemented pending approval. Here “reliable” means a legitimate background-delivery mechanism, not guaranteed exact-time audible delivery.

## Synced Sensor-Cycle Architecture — Proposed / Awaiting Approval

### Decision and approval boundary

Rolando approved DESIGN of dedicated synced sensor cycles in the second attached prompt. Device-local Dexcom V1 is rejected as the intended architecture. Web Push, VAPID, server scheduling, subscriptions, notification providers and remote timer persistence are out of scope. SQL execution, migrations, live changes, application implementation dependent on the schema, commit/push/PR/merge/deploy remain prohibited. This section is a complete proposed contract for review; nothing described here has been installed.

Review-only SQL: [`docs/architecture/llt-sensor-cycles-REVIEW-ONLY.sql`](docs/architecture/llt-sensor-cycles-REVIEW-ONLY.sql). Header and footer say **NOT APPROVED FOR EXECUTION**. It is outside `supabase/migrations/`, and contains all proposed tables, constraints, indexes, policies, functions, grants/revokes and realtime publication change. It has not been executed against any database, including a local database.

### Current ownership and authentication model

Existing records, settings, settings audit and food-library migrations authorize with `user_id = auth.uid()` (audit uses `authorized_user_id`). “Allow family editors” migrations expand accepted display labels; they do NOT add family membership, shared-patient ACLs or cross-account access. Sync fetch/realtime filter on the authenticated session user ID. Device identity and installation IDs come from existing local-storage helpers; password sign-in supplies the real Supabase session. They are distinct authorities.

Recommendation: one sensor context per existing authenticated `auth.uid()`, representing the same patient scope as existing LLT records. All authorized devices for this shared context must use the same existing account. **The repository proves the per-auth-user contract, not which accounts actual family devices use.** Confirm that operational prerequisite before an approved migration. If family devices use distinct Supabase user IDs, this proposal deliberately isolates their data; a separately reviewed membership/auth design is needed. Do not broaden RLS to all authenticated users or use actor labels as membership. No production credentials or account queries were used to infer family account configuration.

The settings JSONB payload remains unsuitable: its normalization, fingerprinting and serialization select clinical settings explicitly and older clients reconstruct it. Dedicated tables avoid coupling sensor history to that replacement behavior or clinical-setting audit fields.

### Proposed schema, stored and derived values

Three tables are the smallest recommended model that supports a lock even when there is no active cycle, preserved history, atomic replacement, audit and retry receipts:

| Table | Columns and types | Purpose |
| --- | --- | --- |
| `llt_sensor_contexts` | `user_id uuid PK/FK auth.users`; `revision bigint >= 0`; nullable `current_cycle_id uuid`; `created_at`, `updated_at timestamptz` | Single authoritative pointer and mutation serialization row per auth context. Initial revision 0, no current cycle. |
| `llt_sensor_cycles` | composite PK `(user_id uuid,id uuid)`; `sensor_type text`; `started_at timestamptz`; nullable `ended_at timestamptz`; `state text`; nullable `previous_cycle_id uuid`, `cancelled_at timestamptz`; `created_at`, `updated_at timestamptz`; `created_actor`, `updated_actor text`; `revision bigint > 0` | Current and historical cycles. Owner is authenticated, actor labels are untrusted display attribution. Revision is the context revision at last change, not an independent CAS counter. |
| `llt_sensor_operations` | composite PK `(user_id uuid,operation_id uuid)`; `action text`; canonical bounded `request jsonb`; `status`, `reason text`; `expected_revision`, `revision_before`, `revision_after bigint`; `before_cycles`, `after_cycles jsonb arrays`; `actor_label text`; bounded `device_metadata jsonb`; `received_at`, nullable `accepted_at timestamptz` | Dedicated immutable-to-browser audit and idempotency receipt. Snapshots contain only affected sensor cycles. No separate enterprise event system. |

Store the user-entered absolute start and actual replacement/end, not computed standard/grace expiration or remaining time. `state` is a structural state (`current`, `closed`, `cancelled`), **not** the time-derived lifecycle. Even a fully expired sensor remains the currently tracked cycle until explicitly replaced or undone. Nothing automatically starts a new cycle.

`sensor_type = dexcom_g7_10d_v1` is a small versioned model identifier. A proposed `js/lee-lee-dexcom-sensor.js` domain module maps that identifier to immutable V1 rules: 240 elapsed hours standard session and 12 additional elapsed hours grace, with a 24-hour pre-expiration LLT reminder. The design treats the entered start as the authoritative sensor-session start; users should enter the start underlying their Dexcom session, not the time they log it in LLT. Standard G7 10 days + 12 hours is officially confirmed: [Dexcom wear duration](https://www.dexcom.com/en-us/faqs/how-long-can-i-wear-the-sensor). The 24-hour milestone is the requested LLT reminder policy; do not present it as an exact replication of all Dexcom warnings until the applicable official user guide is verified. Exact insertion/activation semantics likewise remain a wording verification item before application implementation.

Derived expiration = start + 240 × 60 × 60 × 1000 ms; grace end = expiration + 12 × 60 × 60 × 1000 ms. At expiration exactly, grace state begins; at grace end exactly, fully expired state begins. Before expiration within the final 24 hours, approaching state applies. Operational early replacement = actual end earlier than derived normal expiration. No glucose/treatment conclusions follow from this state.

Do not repeat numerical lifecycle constants in each row. The versioned type protects history: future sensor types or revised rules use a different identifier and a retained rule mapping; never reinterpret existing `dexcom_g7_10d_v1` rows by changing its duration. V1 CHECK permits only that model. Future extension is an additive reviewed CHECK/rule-map change, not a history rewrite.

### Constraints and authoritative current-cycle selection

- Composite foreign keys keep the current pointer and predecessor within the same authenticated context. `on delete restrict` protects history and prevents cascading account deletion of sensor data.
- A partial unique index on `user_id WHERE state = 'current'` enforces **at most one** current cycle at database level, including concurrent attempts.
- Structural CHECKs require current rows to have no end/cancellation time, closed rows to have an end later than start, and cancelled rows to have a cancellation time and no operational end. Absolute timestamps must be finite. Self-predecessors are prohibited.
- Context revision increments once per accepted logical mutation; every affected cycle receives that revision. Accepted operation receipts enforce `after = before + 1`; rejected domain/conflict outcomes leave it unchanged.
- History index `(user_id,started_at DESC,id DESC)` gives deterministic ordering. Operation index `(user_id,received_at DESC,operation_id DESC)` supports action history; PKs support receipts and same-context pointer lookups.

The authoritative answer is the context's `current_cycle_id` in an atomic server snapshot, resolved by exact ID. Never select whichever row comes first. A partial index protects cardinality; the only browser mutation API maintains pointer/state consistency in one transaction. No triggers are necessary because direct writes are revoked. Foreign keys alone do not prove that a pointed row has state `current`; the RPC validates this and administrative verification checks it. Privileged manual/service-role mutation remains outside this contract and must not be used to bypass it.

### Minimal API and structured results

Two exposed RPCs, one internal non-exposed helper:

1. `llt_get_sensor_snapshot()` has no owner parameter. It returns `{status:'ok', snapshot:{revision,currentCycleId,cycles}, serverTime}`. Head and cycles come from one SQL statement/MVCC snapshot, including the initial absent-context response (revision 0, null pointer, empty cycles). The internal invoker helper `llt_sensor_snapshot_for_user(uuid)` is executable only by its trusted owner, not browser roles.
2. `llt_mutate_sensor_cycle(...)` has action `start`, `edit_start` or `undo_current`; no separate replace RPC is needed. The complete typed parameter contract is below.

| Parameter | Meaning |
| --- | --- |
| `p_operation_id uuid` | Client-generated stable logical request ID, persisted before first send. |
| `p_action text` | One of the three explicit actions; no arbitrary patch payload. |
| `p_expected_revision bigint` | Expected entire sensor-context revision from the reviewed snapshot. |
| `p_expected_current_cycle_id uuid/null` | Exact pointer the user reviewed, null for first start. |
| `p_new_cycle_id uuid/null` | Stable UUID for start only; reused on retry. |
| `p_started_at timestamptz/null` | Explicit offset/UTC absolute timestamp for start/edit only. |
| `p_confirm_replace boolean` | Explicit confirmation for starting with any currently tracked cycle. False for edit/undo. Undo has its own confirmed UI action. |
| `p_actor_label text` | Existing enumerated device/person label; attribution only. |
| `p_device_metadata jsonb` | Allowlisted string fields: installation ID, device profile/platform, app environment/version; bounded sizes. Reuse existing helpers. Freeze metadata for retry. |

Successful and well-shaped domain outcomes return `status`, `reason`, `operationId`, `replayed`, `operationRevision`, `acceptedAt`, `snapshot` and `serverTime`. `status` is `accepted`, `conflict` or `invalid_state`; operation receipts persist all three. `operationRevision` is the outcome's revision; `snapshot.revision` is the current authoritative reconciliation version and may be newer on replay. JSON naming is camelCase at envelope level and SQL names inside row snapshots; client adapters must normalize explicitly. Client revisions must be safe integers, not coerced from unknown values; reject impossible unsafe values rather than silently lose precision.

Malformed action/shape/metadata yields `invalid_request` without a persisted receipt. A reused operation ID with different canonical request yields `invalid_request/operation_id_reused` and a current snapshot, leaving the original receipt intact. Missing/invalid auth is a transport permission/auth error (including SQLSTATE `28000` for a callable function with absent UID); the client maps this to an authentication-required outcome and cannot interpret it as success. Typed UUID/timestamp parse errors happen before the function body and are validation errors. Infrastructure/constraint failures propagate and roll back; do not masquerade as structured accepted results.

### Transaction, CAS and idempotency

For any well-shaped mutation, insert an empty context row if absent (`ON CONFLICT DO NOTHING`), then lock that exact row `FOR UPDATE`. Concurrent first requests serialize on its PK; all subsequent domain mutations serialize on this same row. No reliance on checking an empty active-cycle query without a lock. Capture server time after locking.

Look up the `(user_id,operation_id)` receipt **before** version validation. Same canonical request returns its original accepted/conflict/domain-rejected outcome with a freshly read current snapshot, without further updates or audit entries. Reuse with changed action/start/IDs/version/confirmation/metadata is rejected. Canonical absolute start uses epoch, independent of session timezone. Retain receipts for the dataset lifetime; never prune accepted IDs and then allow those requests to create cycles again.

If no receipt exists, compare expected context revision AND expected pointer. A stale request records a conflict receipt, returns the authoritative snapshot, and changes no cycle/head revision. Client does not automatically rebase or overwrite. The user reviews the new state and reconfirms a newly created operation ID if still appropriate. A rejected receipt remains final on retry; correction of a request needs a new ID. Context revision prevents the ABA problem where undo restores an old pointer but a stale request still believes nothing changed.

All accepted cycle changes, pointer/revision updates and operation receipt insertion belong to one RPC transaction. A failed receipt insert rolls back the domain changes too. Under read-committed isolation, a waiting row lock sees the newly committed head. Serialization/deadlock/timeout errors use bounded exact-request retries, with no new IDs until the original outcome is known. [PostgreSQL locking documentation](https://www.postgresql.org/docs/current/explicit-locking.html) supports the row-lock/concurrency choice; [constraint documentation](https://www.postgresql.org/docs/current/ddl-constraints.html) supports partial uniqueness rather than a cross-row CHECK. Actual Supabase database version must be verified in the later approved preflight.

### Start/replace, correction and undo

**Start/replace:** user reviews an absolute editable date/time. First start uses expected revision 0 and null pointer. If any current cycle exists, show a confirmation explaining that it will end at the new start; this applies even in grace or fully expired state. Reject a future/infinite timestamp, duplicate cycle ID, or replacement timestamp not strictly later than current start. Close the previous row at the entered new start, create a new current row linked to it, update head and receipt atomically. Do not clip actual end to scheduled expiration, or call record creation time sensor start. No special server expiry constants are necessary to replace.

**Edit start:** target is only the exact current ID with current context revision. Preserve cycle ID/model/creation metadata. Reject unchanged/future/invalid start. If a predecessor exists, ensure it is closed and its end matches the previous current-start boundary, and that corrected start is later than predecessor start. Update both current start and predecessor actual end to the corrected replacement time in the same transaction; audit both before/after rows. UI must disclose that correction also changes when the previous sensor was recorded as replaced. This is a deliberate assumption that replacement and next start share one timestamp. Independently recording removal and insertion gaps is outside this V1 design. No arbitrary historical editing.

**Undo accidental current cycle:** confirmed `undo_current` only, expected revision and exact current ID mandatory. Mark current row cancelled, retain identity/start/creation history and server cancellation time, then reopen its immediate closed predecessor (clear end) and point head to it; if none, head becomes null. Validate the predecessor boundary before restoration. Release the current partial-unique slot first. A restored predecessor may already be time-expired; derived status remains expired rather than pretending it is healthy. No history row is hard-deleted, no bulk action, no automatic physical sensor reversal. Confirmation must say what tracked cycle will be restored. Any newer replacement makes the attempted undo conflict; editing an active cycle on another device also forces renewed review. History cancellation beyond current is deliberately unsupported. Multiple individually confirmed sequential undos are possible, each at a newly fetched revision.

### History and audit

Cycle history is stable across app/device changes and ordered by `(started_at DESC,id DESC)`. Show start and actual replacement time, early replacement when derivable, and cancelled status; do not label a cancelled record as an actual completed wear interval. Predecessor links identify the operational chain even with cancelled branches. Corrections change the current representation but immutable before/after receipts retain original timestamps and who/device label submitted them. Replacement receipts include old/new cycles; early-versus-normal is derived from the old cycle's model/start/end, never stored as contradictory redundant truth.

Dedicated operation log replaces neither clinical settings audit nor existing records. Accepted actions and stale/domain-rejected attempts are database-recorded. Malformed requests, unauthorized calls and failed transactions cannot reliably append an audit record in the same rolled-back transaction; keep sanitized client diagnostics, not invented “accepted” audit entries or a new logging backend. The actor user is the database-derived `user_id`; Rolando/Emily, installation/profile/platform/version are allowlisted but spoofable attribution. Do not use them for security or claim cryptographic person identification. This design does not add patient notes, glucose, insulin, carbs, credentials or Dexcom account fields. JSON structures have domain/metadata scope, not arbitrary medical-note inputs.

### RLS and security review

Authenticated browser role has SELECT only, with `user_id = (select auth.uid())` on each table. Anonymous/PUBLIC have no table privileges. Direct browser INSERT/UPDATE/DELETE have neither grants nor policies, so start/close/edit/cancel are available only through the mutation RPC. No owner or patient ID is accepted from the client. Different accounts cannot select, mutate, reference or retrieve receipts belonging to another account. Same operation/cycle UUID across accounts is harmless because keys are context-scoped.

The read and mutation entry points use `SECURITY DEFINER` to implement an atomic read/mutation without direct write grants. Install under the trusted migration owner, which must own/have access to these new objects; do not assign browser role ownership. Empty `search_path`, explicit `public`/`auth`/`pg_catalog` qualification, typed parameters and no dynamic SQL prevent object-resolution and SQL-injection hazards. Revoke default PUBLIC execute, then grant only these two entry points to `authenticated`. Internal UID-parameter helper remains invoker and has execute revoked from all API roles. All calls get UID from authenticated context; definer RLS bypass is justified only because every query is explicitly UID-scoped. Do not add an RPC accepting owner ID or granting cross-context access. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [PostgreSQL definer guidance](https://www.postgresql.org/docs/current/sql-createfunction.html) were consulted for these boundaries on October 3, 2026.

No direct browser mutation can spoof revision, created/updated time, row state or authoritative owner. Labels can be spoofed and are explicitly untrusted. No new extension, external provider, service-role client key, auth change or SQL executor is needed in the application. Admin/service roles remain privileged and must not bypass normal mutation paths during routine operation. Browser-immutable receipts are not tamper-proof against a database administrator. The partial index is a second defense against duplicate current cycles; head lock, expected revision and receipts cover races and duplicates without advisory hash collisions. A write may create an empty context for a rejected first domain request; it still contains no fabricated sensor.

### Sync-client and offline contract

Proposed extension to the existing LLT repository adds a separate sensor domain/cache; does not change clinical settings serializer, record queues or timer keys. Initial authenticated load calls snapshot RPC. Refresh on foreground/resume, online/reconnect, auth change, successful mutation, and realtime head invalidation. While visible/online, use a modest 30-second fallback refresh so missed realtime events cannot leave data silently stale indefinitely. Realtime subscribes to `llt_sensor_contexts` filtered by session UID; payload is an invalidation signal, followed by a fresh atomic snapshot. Proposed SQL adds only this table to the existing `supabase_realtime` publication. Require publication preflight and fail migration on unexpected absence; no silently created publication or swallowed error. Cycle/history updates always bump head on accepted mutation, so one invalidation stream suffices.

Cache entire coherent `{revision,currentCycleId,cycles,lastFetchedAt}` under a sensor-specific namespace containing authenticated UID. No merging by “newest updatedAt”; replace with a validated authoritative snapshot if its revision is >= cached revision. Do not regress cache due to out-of-order fetches. On equal revision, validate snapshot equality/invariants; unexpected disagreement is an error, not silent repair. Resolve current pointer exactly; inconsistent snapshots trigger refetch/error, never select another current row opportunistically. Use session-generation guards for all async responses; after sign-out/account switch, hide sensor UI, stop subscriptions, and do not present another account's cache or send its operation. Existing unrelated data/queues stay untouched.

Offline: display the last-known cycle and derived lifecycle with “Offline — last synced …”. Before any fetch succeeds, show unavailable/offline state, not a verified “no sensor” state. Keep displayed data while refreshing and clearly show stale/refresh failure. No promise of zero-latency cross-device consistency: foreground refresh/realtime/polling provide eventual convergence, network failure remains visible.

Recommended V1 mutation rule: **connection required** for start, correction or undo; no speculative offline lifecycle writes. Keep the entered draft if the connection is missing, label “Not saved”, and require review after reconnect. `navigator.onLine` alone is not proof of connectivity; fetch authoritative snapshot and perform RPC. Do not secretly submit offline drafts later or reinterpret them as pending active sensors.

Before sending a confirmed online mutation, persist one pending exact request (ID, timestamp, expected revision, metadata, user scope). If local persistence fails, refuse to send to avoid losing the retry identity. While awaiting/uncertain, current server snapshot remains authoritative and UI says “Awaiting confirmation”; block a second lifecycle mutation on that device. If response is lost, retain request across reload and boundedly retry ONLY that already submitted request with the same ID; do not refresh expected revision or timestamp. Reconcile from returned current snapshot and settle receipt. If auth/network fails, show “Outcome unknown — reconnect to confirm” and keep the pending request. Across tabs use shared storage/events to display pending state, but DB CAS remains the final concurrency defense. A conflict is not silently overwritten; present authoritative state and retained user draft for explicit reconfirmation with a new operation ID. Receipt replay can return a newer snapshot after another device's action; apply snapshot, never restore old outcome rows into current cache.

### Older clients

The new context/cycle/operation tables, RPC names, cache keys and publication entry are independent of existing settings/records/library. Old clients retain their existing API grants and feature behavior; their settings writes cannot reach new tables, old RPCs never touch them, and settings payload replacement cannot remove sensor history. No forced upgrade, data backfill, clinical serializer modification or old-row payload mutation. Old clients won't display sensor state; that is expected. New clients encountering an unapplied schema show feature unavailable without breaking the existing LLT entry workflow. Rolling back the frontend has the same isolation benefit.

### Absolute times and DST

Database uses `timestamptz` absolute instants; RPC clients send ISO 8601 with `Z` or explicit numeric offset (never bare local wall-clock). Client caches use normalized ISO UTC and computes using epoch milliseconds. UI displays `Intl.DateTimeFormat` in local timezone, with zone/offset visible in start confirmation and when ambiguity matters. Preserve input minutes; format full absolute values consistently. Database creation/update/receipt times use server clock, separate from entered operational start.

Reject local DST gaps through round-trip validation. For a repeated fall-back hour, ask which offset/occurrence the user means rather than implicitly choosing; UI resolves to one absolute instant before RPC. Different devices may display different local clock labels for the same stored instant. Elapsed 240 hours and 12 hours span DST correctly; do not use `setDate(+10)` or session-timezone `interval '10 days'` to determine these deadlines. Add month/year/leap-day/midnight and both DST transition fixtures. Server rejects future starts; clock skew may require a visible correction rather than silently adjusting entered timestamps. No automatic operational end is recorded just because derived grace time passed.

### Shared deadline layer boundary and capability

Database stores sensor state only, no milestone/job/notification rows. Application derives three sensor deadlines and the existing timer deadline. A small proposed `js/lee-lee-deadline-alerts.js` handles visible evaluation, persisted local consumption/acknowledgement and foreground sound dispatch; domain modules retain lifecycle semantics. Leave existing timer domain persistence and adjustable settings unchanged; 15 minutes remains its default. Initialize audio during explicit Start Timer interaction, catch unlock/play failures, play one brief chime, and keep visual completion authoritative.

Stable sensor milestone identity includes context UID, cycle ID, authoritative start timestamp and milestone kind; correction gets new deadline identities. Undo must preserve consumption state for a restored predecessor, so do not key sensor alerts merely on every head revision. Timer identity includes original start plus authoritative adjusted deadline. Never include insulin/source snapshot data in sound/notification content.

On visible ticks/resume, calculate current state first; consume obsolete sensor milestone IDs without sounding their backlog, then present/alert only the applicable current transition. First fetch of an existing already-due sensor should show its current state without replaying historical milestones. Acknowledgements are per device/origin, not synced family acknowledgements. Simultaneous tabs need atomic local consumption (prefer small IndexedDB transaction/claim, with deterministic single-tab fallback if unavailable); localStorage read/write alone cannot guarantee cross-tab exactly-once playback. Claim before dispatch gives at-most-once attempts, not proof the user heard sound; failure still preserves visual state. Bounded ledger pruning must not reactivate old cycles. Unsupported/denied notifications must never block timer/sensor functionality; do not request permission on load or promise background delivery. No notification permission UI or OS notification route is required to achieve this foreground-only iteration; keep any optional foreground notification decision separate during application implementation.

Current V1 capability statement **B** supersedes the original investigation's proposed C scope: **LLT can reliably provide foreground alerts and correct deadline state on resume, but the current local-only PWA alert architecture cannot guarantee alerts while the iPhone is locked/suspended.** Sensor persistence is synced; “local-only” here describes alert scheduling, not the new sensor persistence. Foreground audio remains conditional on browser unlock and device audibility. Push/server scheduling is explicitly NOT implemented or included in proposed SQL.

### Ten transaction/concurrency walkthroughs

| Scenario | Authoritative outcome |
| --- | --- |
| 1. Rolando first start | Lock/create revision-0 head, expected null pointer; create cycle, revision 1, one accepted receipt. No fabricated earlier history. |
| 2. Emily normal replacement | Same authorized context, current pointer/revision and confirmation; old end = entered next start, new row current, one revision increment and audit captures both. |
| 3. Early failure replacement | Identical transaction; early classification derived from old start/model/end. History retained; no expiry wait. |
| 4. Simultaneous replacements | Both contend on same head. First accepted; second sees advanced revision and records conflict without closing/creating another cycle. |
| 5. Stale version 4 after version 5 | CAS rejects with conflict receipt and version-5-or-newer snapshot. No automatic rebase; user must review and reconfirm new request. |
| 6. Network retries same start | Receipt lookup wins before CAS; original outcome returned, fresh snapshot reconciles, no duplicate row/end/revision/audit event. Changed request under same ID rejected. |
| 7. Old client syncs settings | Existing settings table/RPC only; sensor context/cycles/receipts untouched. |
| 8. Correct current start | CAS accepted; same cycle ID, new absolute start, predecessor end corrected atomically if present, one revision, two-row audit; new derived deadlines. |
| 9. Cancel accidental current | Confirm + CAS; tombstone cycle, reopen immediate predecessor or null head, retain audit/history, one revision. Intervening mutation forces conflict; restored expired predecessor still displays expired. |
| 10. Offline replacement attempt | No server write and no authoritative new local cycle. Draft remains unsaved; reconnect fetch/review required. Already-sent request with unknown outcome retries exact same ID to settle, never creates a second operation. |

Additional cases for review: simultaneous first starts; same UUID in different user scopes; same ID changed payload; repeat a domain rejection; start after undo; two-tab pending races; predecessor boundary violation; correction/undo race; delayed older snapshots; service-role/manual corruption must fail validation and require investigation rather than automatic repair.

### Future migration and rollback plan — not executed

After explicit approval and isolated DB validation, use the repo timestamp convention, e.g. `supabase/migrations/YYYYMMDD001_create_llt_sensor_cycles.sql` with the actual approved date and next free sequence. Do not create that migration now. Review artifact uses plain CREATE deliberately: existing object drift must fail, not be hidden by `IF NOT EXISTS`.

Preflight later: confirm deployed Postgres version, existing auth model/account sharing prerequisite, trusted migration owner, absence of proposed objects/functions, default grants, existing realtime publication and existing backup/recovery process. No existing sensor backfill exists; do not invent one. Initial read is a verified empty state after successful authenticated fetch. Context row is lazily initialized on first valid-shaped operation, not on every read.

Creation order in one transaction: context → cycles + same-context predecessor FK → context current FK → partial/history indexes → operation/audit table/index → RLS and read-only grants/policies → internal snapshot helper → read RPC → mutation RPC + execute grants/revokes → context publication entry. No extension, auth migration, clinical-table alteration, scheduler or trigger. Functions must share trusted ownership. If any step fails, the migration transaction rolls back all proposed objects.

After approval, verification queries (do not run yet):

```sql
-- Cardinality check: expect no rows.
select user_id, count(*) from public.llt_sensor_cycles
where state = 'current' group by user_id having count(*) > 1;

-- Pointer/state/revision consistency: expect no rows.
select h.user_id from public.llt_sensor_contexts h
left join public.llt_sensor_cycles c
  on c.user_id = h.user_id and c.id = h.current_cycle_id
where (h.current_cycle_id is not null and (c.id is null or c.state <> 'current'))
   or exists (select 1 from public.llt_sensor_cycles x
              where x.user_id = h.user_id and x.state = 'current'
                and x.id is distinct from h.current_cycle_id)
   or exists (select 1 from public.llt_sensor_cycles x
              where x.user_id = h.user_id and x.revision > h.revision);

-- Read-only browser grant review.
select table_name, privilege_type from information_schema.role_table_grants
where grantee in ('anon','authenticated','PUBLIC')
  and table_schema = 'public'
  and table_name in ('llt_sensor_contexts','llt_sensor_cycles','llt_sensor_operations');
select tablename, policyname, roles, cmd, qual, with_check from pg_catalog.pg_policies
where schemaname = 'public' and tablename like 'llt_sensor_%';
select proname, prosecdef, proconfig, proacl from pg_catalog.pg_proc
where pronamespace = 'public'::regnamespace and proname like 'llt_%sensor%';
select schemaname, tablename from pg_catalog.pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'llt_sensor_contexts';
```

Also verify the expected partial unique index via `pg_indexes`, exercise two distinct synthetic auth UIDs, role grants and helper denial, and verify receipts/domain constraints in an approved isolated database. Catalog checks alone do not prove runtime RLS/CAS behavior.

Pre-production rollback: migration transaction failure requires no teardown. If committed only in an isolated test environment with no needed data, a reviewed rollback removes context publication entry, exposed RPCs, helper, context current FK, operation table, cycle table, then context table, in dependency order; do not use unreviewed CASCADE or touch clinical tables.

Post-production rollback with history: disable new mutation execute grants and feature UI/transport, preserve all three tables, receipts, RLS, and recoverable backups. An old frontend may continue existing LLT features safely. Avoid leaving a sensor UI showing a silently frozen schedule; show unavailable/read-only status when mutations disabled. Undo publication entry only when intentionally retiring realtime, not as data cleanup. No dropping rows/tables, clearing local storage, rewriting starts or pruning history. Export/verify recovery and use a separately approved corrective migration. Any later destructive retirement needs explicit data-retention approval.

### Test plan and design validation limits

No schema-dependent tests were executed, as requested. SQL has been manually reviewed as text, not compiled or installed. This is proposed production-oriented SQL, not a runtime-validated migration. `npm run check:js` and app/browser tests were not run because application JS is unchanged. Whitespace/source checks must not be described as database validation.

After schema approval, use an isolated Supabase-compatible test database and synthetic auth users, never production medical data:

- Constraints: state/end combinations, finite times, positive/global revisions, same-context predecessor/current FKs, self-predecessor and duplicate-current failures; cancelled history retained.
- RLS/privileges: anonymous denied, UID A selects A only, UID B cannot select A or reuse its owner; direct table mutations and internal helper denied; only exposed RPCs callable; metadata cannot authorize anything; revoked/expired sessions denied.
- Transactions: start empty and replacement normal/early/grace/expired; close/create/audit all roll back together on forced failure; correction updates both boundaries; undo restores predecessor or empty state; invalid chronology/future/duplicate cycle rejected.
- Concurrent connections: parallel first starts and replacements, edit versus replace, undo versus edit; exactly one winning mutation and one current row. Stale revision/pointer rejected; ABA after undo cannot accept stale input.
- Receipts: accepted/rejected/conflict retry unchanged, no repeated revision/audit, same ID changed payload rejected, failed transaction safely retriable, lost response then another-device mutation returns original outcome plus newest snapshot.
- Audit: before/after captures both affected rows; actor UID authoritative and labels untrusted; conflicts recorded without state change; malformed/auth/infrastructure failures never reported as accepted.
- Old-client isolation: run existing settings/record/library paths before/after synthetic sensor setup and assert byte-equivalent sensor history/context/receipts; no forced upgrade or existing-feature regression.
- Client fixtures: sign-in/load/refresh, realtime dropped + polling, offline cached lifecycle, no-sensor versus unavailable, no offline auto-submit, persisted unknown-outcome request/reload, reconnect same ID, conflict reconfirmation, multi-tab and account-switch generation guards, out-of-order snapshots and cache write failure.
- Time: exact expiration/grace boundaries, 24-hour reminder, midnight/month/year/leap day, both DST transitions, repeated hour/gap resolution, timezone changes, edited timestamp recalculation, historical early classification and cancelled-branch ordering.
- Alerts: default 15-minute timer unchanged, foreground single chime, repeated tick/render/reload/navigation suppression, failure/unsupported audio, restore/correction deadline identity, cross-tab claim, latest-state catch-up without stale sensor sound backlog, no background-delivery claims.
- Later UI acceptance: 320/393/768/1280px and iPhone landscape; dates, card, form/history/confirmation; isolated physical-device fixture preview with production transport disabled. Local fixtures cannot validate live RLS or family sync. Separate approved synthetic authenticated test environment is required for real DB integration.

### Files inspected, files changed and git status

Inspected: `AGENTS.md`; current report; `js/lee-lees-tracker-sync.js` (settings serialization/fingerprints/audit, device metadata, auth, conflict/realtime); `js/lee-lees-tracker-config.js` (browser-safe runtime setup); `js/lee-lee-pre-meal-timer.js`; relevant timer integration in `js/lee-lee-diabetes-tracker.js`; records/shared-settings/family-label/food-library/final-settings-audit SQL migrations; `docs/lee-lees-tracker-persistence.md`; `docs/authentication-preview.md`; `tests/lee-lees-tracker-sync.test.js`; `tests/lee-lee-pre-meal-timer.test.js`; `package.json`; manifest/service worker from the initial audit. No secret or production data queried.

DESIGN ONLY files changed: this existing untracked report and new untracked `docs/architecture/llt-sensor-cycles-REVIEW-ONLY.sql`. No migration file, application implementation, live SQL execution, credentials, medical data, push scheduling, #12 work, commit, push, PR or deployment. Final status check: branch `main`; HEAD/local main/local origin-main ref all equal `25b360affe2fcdd0f157eafd55323f4e5155705b`. No new fetch was needed for this documentation-only design checkpoint; remote freshness was verified during the initial audit. Existing untracked diagnostic reports and `death-on-notecards/` are preserved. No tracked diff or staged diff. `git diff --check` and separate `git diff --no-index --check /dev/null <artifact>` checks for both untracked artifacts produced no whitespace diagnostics. No SQL execution or schema-dependent tests occurred.

Major review tradeoffs: one existing auth-user context (requires same-account devices); three small tables instead of risky settings reuse; connection-required lifecycle writes rather than speculative offline state; undo limited to current cycle; correction deliberately changes the predecessor replacement boundary; full history snapshot favors simplicity over pagination at family-scale; local foreground alerts without locked-device guarantees. These choices are proposed for review, not additional permissions already granted.

## Phase 1 execution approval — isolated database preflight blocked

Rolando's third attached prompt approves isolated synthetic database validation, a validated repository migration, application implementation and tests, with production Supabase execution/commit/push/PR/merge/deploy still forbidden. The approved architecture and SQL remain preserved above and in the review-only artifact.

### Baseline

Before any implementation, fetched `origin/main` successfully. HEAD, local main and origin/main all remain `25b360affe2fcdd0f157eafd55323f4e5155705b`; no intervening changes. Branch is `main` with no tracked or staged modifications and existing untracked artifacts preserved. The feature branch has not been created because the required isolated environment gate stopped work before implementation setup. No migration or application code was written.

### Environment evidence and exact blocker

- Installed Supabase CLI: `/opt/homebrew/bin/supabase`, version `2.114.0`.
- `supabase status` failed with `LegacyStatusDbInspectError`: `failed to inspect container health: docker: command not found (podman also not found) — install Docker Desktop or Podman and ensure it is on PATH`.
- `docker`, `psql` and `postgres` were not on PATH. No PostgreSQL/libpq installation was found under `/opt/homebrew/opt`.
- Checked conventional Docker/Colima/OrbStack socket paths and Docker/OrbStack/Postgres application paths; none were present at those paths. This is evidence about inspected local paths, not a claim that no external development DB exists anywhere.
- Repository search found migrations/review SQL but no local Supabase `config.toml`, container-compose setup or established isolated DB test target.
- Initial CLI checks were blocked by sandbox writes to its own telemetry file; permitted read-only local version/status checks then reproduced the actual missing-container-runtime error. This is an environment blocker, not an SQL test failure or approval-review rejection.

Missing infrastructure: a functioning local Docker/Podman-compatible container runtime for isolated Supabase, plus an initialized isolated project/test setup; alternatively an explicitly identified disposable non-production PostgreSQL/Supabase-compatible test environment capable of auth/RLS/RPC, real separate-connection concurrency, constraints and publication checks. No database version, auth schema, default grants, publication, function ownership or transaction semantics could be verified because no local DB was reachable. Merely having the CLI does not provide a running database.

The supplied prompt explicitly states: “If no appropriate isolated environment is available: STOP.” It also lists “isolated Supabase-compatible DB is unavailable” as an early stop condition. No automatic runtime installation, production fallback, substitute engine, schema execution or dependent application implementation was attempted.

### Results and outstanding work

Database/schema/RLS/RPC/concurrency/idempotency/rollback tests executed: **0**. Application/unit/browser tests executed: **0**. SQL was not compiled/executed; no deviations from reviewed SQL; no real migration artifact yet. No runtime/responsive/physical-device verification or new preview URL exists. Only this report was updated for Phase 1; review-only SQL is unchanged. Production credentials/accounts/medical data were not queried or used.

After an isolated environment is available, resume at preflight with synthetic users, validate the reviewed SQL and invariants/concurrency before creating the migration, then implement on `feature/llt-alerts-dexcom-tracker`. Recheck current main first. The approved test/implementation/preview plan remains in the preceding design section and Phase 1 user prompt; it has not been reported as completed.

Family-auth status: **PRODUCTION AUTH PREREQUISITE REQUIRES PHYSICAL/OPERATIONAL CONFIRMATION**. Repository supports same-auth-user ownership but cannot establish how actual family devices authenticate without operational confirmation. All participating devices must use the same authorized Supabase account for shared sensor state under V1; no RLS weakening or new membership model.

Production Supabase untouched; Web Push/server scheduling not implemented; no clinical changes; #12 untouched; nothing committed/pushed/deployed. Existing report, review SQL, diagnostic artifacts and `death-on-notecards/` retained. Final branch remains `main`; tracked/staged diff empty. This is a blocked preflight handoff, **not** production-migration-review or physical-iPhone readiness.

## Phase 1 resume — Docker working; existing baseline replay blocker

The fourth attached prompt resumes isolated local Supabase validation and application implementation without expanding scope. Production Supabase, commit/push/PR/merge/deployment, Web Push and #12 remain prohibited. The earlier missing-Docker blocker is resolved.

### Baseline and feature branch

Fetched origin/main; local main/origin main/starting HEAD were all `25b360affe2fcdd0f157eafd55323f4e5155705b`. No intervening commits or tracked application changes existed. Created approved `feature/llt-alerts-dexcom-tracker` from that baseline. Original report, review SQL, unrelated diagnostic reports and `death-on-notecards/` were preserved.

### Local infrastructure preflight

- Docker Desktop is installed at `/Applications/Docker.app`; its CLI is also symlinked under the user's `.docker/bin`, but those directories were absent from the execution shell PATH. Used a command-local PATH addition, not a persistent shell/system change.
- `docker info --format '{{.ServerVersion}}'` succeeded: engine **29.8.1**. Daemon is responsive.
- Supabase CLI **2.114.0**. Initial local `supabase status` reported no `supabase_db_landos-world` container; no pre-existing stack was reused.
- Standard ports 54321–54324 had no listening process in the preflight check.
- `supabase init` created `supabase/config.toml` and `supabase/.gitignore`. Config identifies local project `landos-world`, API port 54321, DB port 54322, major version 17. No production link or credential was configured.
- `supabase start` downloaded official images and started local database initialization. Postgres image tag **17.6.1.158**. A live `SELECT version()`/auth/RLS/publication preflight was not completed because baseline migration replay failed before startup finished. Do not represent image metadata as a fully validated live DB version.
- Local API/DB endpoints configured for 127.0.0.1:54321/54322; these are not reported as verified usable endpoints. No synthetic users or sensor data were created.

### Exact startup failure and diagnosis

Baseline replay applied seven existing migration files in order, including historical `202609170001_create_lee_lee_settings_audit.sql`, then failed while applying eighth file `202609170002_llt_settings_audit_final.sql`. The CLI reported `LegacyMigrationApplyError`, **SQLSTATE 42P13**: `cannot change return type of existing function`, at statement 11 (`update_lee_lee_shared_settings_with_audit`). The CLI then reported stopping containers; local stack startup did not succeed.

Source diagnosis:

- Historical `202609170001_create_lee_lee_settings_audit.sql` defines both `insert_lee_lee_shared_settings_with_audit(jsonb,jsonb)` and `update_lee_lee_shared_settings_with_audit(integer,text,date,text,text,text,jsonb,integer,jsonb)` with return type `public.lee_lee_shared_settings`.
- Final `202609170002_llt_settings_audit_final.sql` defines those same signatures with `CREATE OR REPLACE FUNCTION` and return type `jsonb`. PostgreSQL cannot change a function return type by replacing the same signature. The update function produces the observed first failure; the insert signature has the same incompatibility.
- Final file's header explicitly says to apply it instead of the historical file. `docs/SUPABASE_SETUP.md` lines 61–75 identify the final file as current and the earlier file as retained historical PR #99 context. Automatic directory replay still applies both. The ordinary CLI path is therefore not a reproducible fresh baseline as currently organized.
- Classification: **unchanged repository historical/baseline migration conflict**, not a new #14.5 regression, Docker outage, RLS failure or sensor-schema defect. Old migration files were not modified, relocated, deleted or rewritten.

The resume prompt requires stopping if baseline migrations cannot safely establish the test DB and reporting material blockers without silently patching history. Work stopped before reviewed sensor SQL compilation/execution, migration creation or application implementation. No production fallback or alternate database engine was used.

### Smallest proposed recovery for review

Use a clearly separate disposable local Supabase workspace with the same official stack and a documented curated copy of the current baseline: all existing applicable migrations, except the explicitly superseded historical `202609170001` artifact, retaining the final `202609170002` unchanged. Start with a fresh isolated project/database so historical functions from the failed replay cannot contaminate it. Keep every repository source migration untouched; record the exact selected files and why the historical artifact is excluded. This follows the setup guide's intended final-schema selection but differs from blind directory replay, so it has **not** been executed in this checkpoint.

Alternatively approve a separate repository baseline-migration repair/archival plan. That broader change affects clinical settings migration history and should not be silently folded into #14.5. Do not drop functions against production, repair production migration tracking, or alter live clinical schema to solve this local bootstrap issue.

### Results, files and safety

- Local stack startup attempts: **1**, failed on the existing baseline conflict after image downloads/database initialization.
- Sensor database/schema/RLS/RPC/concurrency/idempotency/rollback tests executed: **0**. Seven baseline file applications before an eighth-file failure are setup evidence, not passing tests.
- Application/unit/browser tests executed: **0**. No sensor migration, SQL deviation, domain module, sync client, alert layer or UI implementation yet. No runtime/responsive verification, preview URL or physical-iPhone readiness claim.
- Files changed this resume: report updated; local Supabase `config.toml` and `.gitignore` created. Review-only sensor SQL unchanged. No old migrations or tracked application files changed; no staged changes.
- Branch `feature/llt-alerts-dexcom-tracker`; HEAD still `25b360affe2fcdd0f157eafd55323f4e5155705b`. Existing unrelated untracked work preserved.
- Production Supabase untouched; no production credentials/data queried or used; no Web Push, clinical changes or #12. Nothing committed, pushed, merged or deployed.
- Family-auth prerequisite remains **PRODUCTION AUTH PREREQUISITE REQUIRES PHYSICAL/OPERATIONAL CONFIRMATION**: participating devices must use the same authorized Supabase account under V1. No broadening of RLS.


## Phase 1 resume #2 — approved curated baseline and completed local implementation

### Authority and fresh baseline

This checkpoint follows the explicit curated-baseline approval. Branch remains `feature/llt-alerts-dexcom-tracker`; HEAD, local main and freshly fetched origin/main were verified equal at `25b360affe2fcdd0f157eafd55323f4e5155705b` before implementation. Prior report, reviewed SQL, local Supabase config, unrelated diagnostic artifacts and `death-on-notecards/` were preserved.

Disposable workspace: `/private/tmp/llt-14-5-curated`; project/container: `llt-14-5-curated` / `supabase_db_llt-14-5-curated`. This is separate from canonical migration history. Official Supabase CLI 2.114.0, Docker engine 29.8.1, live PostgreSQL 17.6 (aarch64 Linux). Local API `http://127.0.0.1:54321`, database port 54322, Studio port 54323. Test configuration and synthetic credentials stay local; no production configuration was imported into database tests.

The seven copied migrations below replayed successfully in their original filename order. The **only omission** was `202609170001_create_lee_lee_settings_audit.sql`, explicitly superseded by the retained final migration. This avoids the pre-existing 42P13 return-type conflict in the disposable baseline; it does not repair canonical replay. All copies were SHA-256 checked against their source, including after implementation. Manifest: `/private/tmp/llt-14-5-curated/BASELINE_MANIFEST.json`.

| Order | Unchanged copied migration | SHA-256 |
| --- | --- | --- |
| 1 | `202608030001_create_lee_lee_tracker_records.sql` | `9e91a4802a6f4fbe1160eefc0bc5009c3c9dd41b48aee3147ec7aa284b9c77d7` |
| 2 | `202608040001_create_lee_lee_shared_settings.sql` | `483d3f3d7e1a3820307dcb83cc37950b148befd10cbe740b8f43bd9f661e1776` |
| 3 | `202608140001_allow_family_shared_settings_editors.sql` | `d85c894b32cb7702b22f9e811be2640c35dc29334f3a39538bac0c95c294bf8b` |
| 4 | `202608150001_allow_family_record_editors.sql` | `c5082731c03ba1cbdfff92a6fbdc1ccd57edb3ae638802c5ce6842b81f784535` |
| 5 | `202608150002_fix_versioned_rpc_coalesce.sql` | `0151f16ccb0f943edc3a4a6012d2b6e13362001eda1837d3b23d37756a691a07` |
| 6 | `202608310001_create_lee_lee_food_library.sql` | `9fcd52d6f756be8c4497c6f6ab0ba1e72aa15d6938ed05c4a85b422201cecd3b` |
| 7 | `202609170002_llt_settings_audit_final.sql` | `0acb119ce754d844685d7647c95a00a8e9ff1a3d0838041d6dff24605f35188c` |

Baseline verification confirmed existing LLT records/settings/food tables, real `auth.users`/`auth.uid()`, authenticated/anon/service roles, Realtime publication, and both final settings-audit RPCs returning `jsonb`. Existing canonical historical migrations have no diff and were not edited, moved, removed or repaired.

### Sensor SQL and database evidence

Reviewed SQL compiled and executed successfully only in the disposable Supabase. After database tests passed, created canonical review candidate `supabase/migrations/202610030001_create_llt_sensor_cycles.sql`. **Every executable statement is identical to the reviewed SQL.** Only the first two and final comment lines changed to identify local validation and the separate production execution approval gate. No security/domain deviation or additional baseline omission was needed.

Final database suite: **39 passed, zero failed/skipped**: 38 live PostgreSQL scenarios plus one integrated local Auth/REST/Realtime scenario. The integrated scenario uses two synthetic GoTrue accounts and real JWTs, verifies scoped RPCs/table reads, denied direct writes/helper access, accepted receipt replay, authenticated WebSocket context-change delivery and snapshot refetch. Database scenarios include normal/early/grace/expired replacement, edit/predecessor correction, non-destructive undo, retained cancelled history, restoration of expired structural current, unique-current/context-pointer constraints, chronological/future validation, RLS own-user/anonymous boundaries, restricted grants/hardened definer functions, operation-ID scoping/collision/replay after later changes, stale CAS/ABA protection and forced receipt failure rollback. Four actual concurrent separate PostgreSQL connections exercised start/start, replace/replace, edit/replace and undo/replace races; each produced one accepted mutation and one conflict, preserving one current cycle. Publication membership and replica identity were inspected too.

Reproduce while the disposable stack is running: generate its **local-only** status JSON at `/private/tmp/llt14-local-status.json`, then `npm run test:llt:sensor-db`. The opt-in tests target the named disposable container and assert the API is exactly localhost; standard `npm test` does not require Docker. Evidence: `/private/tmp/llt-final-db-results.txt`.

### Application implementation

- `js/lee-lee-dexcom-sensor.js`: fixed Dexcom G7 240 elapsed hours plus 12-hour grace; lifecycle is derived independently of structural current/closed/cancelled state. Final 24-hour threshold follows approved reminder policy. UTC instants and local display; editable date/time with DST gap rejection and explicit repeated-hour occurrence selection.
- `js/lee-lee-sensor-sync.js`: existing repository SDK/auth connection, UID-scoped cache and exact pending request, revision/current-pointer CAS, validated monotonic snapshots, account-generation isolation, exact receipt retry for uncertain outcomes, no offline new mutation or automatic rebasing. Realtime invalidates/refetches; foreground resume/poll fallback every 30 seconds. Production mutations require browser Web Locks for local tab coordination; unsupported browsers remain display-only.
- `js/lee-lee-deadline-alerts.js`: atomic IndexedDB milestone claim before brief audio dispatch, strong Web Locks/localStorage fallback or visual-only degradation. Stable identity suppresses tick/rerender/reload/tab repeats; obsolete milestones are consumed without replay, first fetched historical sensor is silent, failed playback remains consumed. Consumed ledger prunes after 30 days and ancient deadlines never replay.
- `js/lee-lee-sensor-ui.js`: secondary Today card, explicit lifecycle text, details/history, editable start, replacement/correction confirmations, predecessor-boundary disclosure, cancelled-history-preserving undo, cache/offline/pending/conflict messages and retained unsaved draft. Dialog supports keyboard focus/Escape and focus return. Foreground evaluation respects LLT authorization and route visibility. Cross-tab cache writes are ignored as invalidations to prevent reciprocal refresh loops.
- Existing tracker/sync changes are additive hooks only: sensor card/mount/init, shared SDK getter and user-gesture audio unlock. The timer domain/persistence module is unchanged; default 15 minutes and configurable 1–60 minutes remain intact. New assets are in HTML, Pages runtime allowlist and service-worker precache. No notification scheduler, server timer, push/VAPID or clinical calculation/persistence change.

### Validation and responsive inspection

- `npm run check:js`: PASS; includes new modules/tests.
- `npm test`: **450 passed, zero failed/skipped**, including 36 new application tests and all existing unit suites. Covers lifecycle/DST, cache, realtime invalidation/cache failure, unknown outcome/exact retry, conflicts, account switching, delayed responses, alert claims/audio failure, timer durations, storage/sync/reporting/clinical regressions and runtime build/offline contracts. `/private/tmp/llt-final-unit-results.txt`.
- Browser: initial final combined run **58 passed** (16 sensor + 42 #13 Today carb breakdown/#14 My Meals cases, desktop and mobile). Existing post-save timer browser coverage: **8 passed**. Final sensor run: **18 passed**, including the explicit cache-loop regression and authorization guard. Final distinct applicable browser cases: **68 passed** (18 sensor + 42 #13/#14 + 8 existing timer). Evidence: `/private/tmp/llt-final-sensor-browser-results.txt`, `/private/tmp/llt-final-safe-browser-results.txt`, `/private/tmp/llt-focused-browser-regressions.txt`. Cases inspect 320/393/768/1280 and 852×393 landscape, all sensor lifecycle states, start/edit/replace/undo/history/reload, offline mutation refusal, native IndexedDB two-tab claims and foreground timer attempts.
- Light-theme screenshots were visually inspected at 320, 393, 768, 1280 and iPhone landscape; automated bounds cover all five widths including 768. Date/time fields are readable, contained and scrollable; action wrapping remains usable, nav/footer stays contained, dialog uses safe-area padding. Browser fixtures establish functional/layout evidence, not physical iPhone audio/PWA PASS.
- Initial sandbox localhost binds failed EPERM; approved local-server access resolved it. An initial #13/#14 run used default `local` metadata and failed their required LOCAL DEV setup marker; interrupted it and reran against the correct isolated `local-device` preview, all 58 passed. No baseline application failure was waived. Browser testing also caught missing runtime allowlist entries and light-theme input contrast, both corrected.
- `git diff --check`: PASS; full tracked diff and new sensor artifacts reviewed. Staged diff empty. No dependency/lockfile changes, historical SQL edits, generated deployment identity changes or clinical data changes.

### Safe previews and operational limitations

Desktop: **http://127.0.0.1:8765/#/lee-lees-tracker**.
Physical iPhone Safari on the same trusted Wi-Fi: **http://10.0.0.160:8765/#/lee-lees-tracker**.
Both are served by `/private/tmp/llt14-safe-preview.mjs` using the existing production-isolating iPhone server, local-device metadata, read-only source serving and same-subnet checks. Server is left running. Production auth/Supabase/application sync and service-worker installation are disabled. The new sensor transport is an explicitly local-device-only synthetic fixture with separate preview sensor keys. Production/auth-preview do not instantiate it. Preview reload retains this origin's fixture history; HTTP fixture fallback serialization is single-process and does not prove real cross-device coordination. Real DB/Auth/Realtime contracts are proven separately above.

Sensor scenario helper `window.LeeLeeSensorPreview.setScenario('none'|'active'|'approaching'|'grace'|'expired')` is available only in this trusted isolated preview; it uses real durations and changes only synthetic preview sensor keys. Normal editable start dates can exercise every state without console access. Browser fixture data is not family clinical data. Safari background/locked audio, installation/offline PWA behavior and cross-device family authentication remain unverified.

**PRODUCTION AUTH PREREQUISITE REQUIRES PHYSICAL/OPERATIONAL CONFIRMATION**: participating family LLT devices must authenticate with the same authorized Supabase account/auth.uid(). Display labels do not establish sharing authority. This has not been proven false or confirmed true. If devices use different UIDs, STOP before production migration; do not broaden RLS or introduce family membership silently.

### Physical-iPhone checklist — prepared, NOT PASS

1. Open the exact LAN URL in Safari on trusted shared Wi-Fi; confirm LOCAL DEV and no production sign-in. Verify 320/393 portrait, landscape, native date/time picker, readable light/dark appearance, dialog scroll/focus, bottom nav/footer and safe areas.
2. Timer: retain current configured duration, test normal Insulin Given flow and a 1-minute configured timer if useful, foreground brief chime, exactly one attempt, visual completion with muted/failed audio, reload/resume and configurable duration preserved. Restore the original preview configuration if changed. Background/locked behavior is observation only, never an alarm guarantee.
3. Sensor: no-sensor, start, active (e.g. 48h old), approaching (222h old), grace (245h old), fully expired (260h old). Use dates for these elapsed ages with the real 240h+12h model; no shortened production controls.
4. Replace early and during grace/expired; confirm actual boundary/history. Edit current start and read predecessor-boundary disclosure. Undo with/without predecessor, retained cancelled row, and expired predecessor restoration. Refresh/reload history.
5. After loading, disconnect Wi-Fi to inspect cached state and blocked new authoritative changes; retain draft. Reconnect/refresh; inspect stale/conflict and pending messaging. The isolated fixture verifies presentation, not real network-outcome/RLS behavior; use separate local DB evidence for those contracts.
6. Before production migration, operationally confirm family devices' actual authorized Supabase UID equality in an authorized setting. Do not enter production credentials into this HTTP preview. Real family cross-device/PWA checks require a separately approved secure environment and migration/release preparation.

### Files and final gates

Tracked edits: `css/lee-lee-diabetes.css`, `index.html`, `js/lee-lee-diabetes-tracker.js`, `js/lee-lees-tracker-sync.js`, `package.json`, `scripts/pages-runtime-allowlist.mjs`, `service-worker.js`.
New implementation artifacts: four sensor/alert JS modules, three sensor test files and browser spec, canonical candidate sensor migration. Existing architecture report updated; reviewed SQL remains unchanged. Existing untracked Supabase config/.gitignore preserved. Unrelated reports and `death-on-notecards/` untouched.

Branch/HEAD unchanged; working implementation remains unstaged and uncommitted. **Production Supabase untouched. Canonical historical migrations untouched. Nothing committed, pushed, PRed, merged or deployed.** No Web Push, #12, glucose feed, clinical advice or treatment/calculation changes. The existing baseline replay conflict remains outside this scope. Stop here for production-migration review and physical-iPhone preparation.

Final handoff verification: both exact preview addresses returned HTTP 200 for HTML, local-device metadata and all four new modules; metadata explicitly identified `local-device`. Final `npm run check:js` and `git diff --check` passed. Seven tracked files modified, no staged files, new sensor/report/local config artifacts untracked; all unrelated untracked artifacts preserved. Preview process and disposable Supabase left running.


## Production migration gate — 2026-10-04T21:10:30-05:00 — STOPPED before execution

Rolando's new production-execution approval confirms that all participating LLT devices, including Rolando's iPhone and Emily's device, use one shared existing Supabase login/auth.uid(). The V1 family-auth prerequisite is CONFIRMED by operational attestation. No membership/auth redesign or RLS broadening is needed or authorized.

Small repository preflight PASSED: branch `feature/llt-alerts-dexcom-tracker`; HEAD/local main/freshly fetched origin/main `25b360affe2fcdd0f157eafd55323f4e5155705b`; no new origin/main commits. Existing seven tracked implementation changes remain unstaged/uncommitted; unrelated untracked files are preserved. Candidate `supabase/migrations/202610030001_create_llt_sensor_cycles.sql` exists, SHA-256 `1d043949d0a663a07c798831eda4ae8ae92c6e4425632f85084845198d994a4e`. Removing comment-only lines establishes exact executable equality with `docs/architecture/llt-sensor-cycles-REVIEW-ONLY.sql`. Canonical historical migrations have no diff, including both settings-audit files. No reset/rebase/merge performed.

Established production workflow in `docs/SUPABASE_SETUP.md` identifies organization **Lando's World**, project **lee-lee-tracker**, and SQL Editor as a supported migration mechanism. SQL Editor permits executing only the exact approved candidate without replaying the known incompatible historical directory. No CLI db push, migration-history repair or historical replay attempted.

**BLOCKER / STOP CONDITION: production identity cannot yet be positively established.** The opened Firefox Supabase dashboard resolves to its sign-in screen. No authenticated admin project context or approved production SQL execution connection is available in this checkpoint. The organization/project names above are documented intended identity, not live verified target evidence. No credentials were requested in chat, inspected or exposed. No production query or mutation was executed.

Production target verified: NO. Production PostgreSQL version, auth availability, existing LLT baseline, owner/execution role, publication compatibility, absence of sensor objects: NOT ASSESSED. Production migration: NOT RUN. Tables/constraints/indexes/RLS/grants/RPC security/search_path/publication/empty dataset/consistency and existing LLT schema sanity: NOT ASSESSED. Local validation from the previous checkpoint must not be represented as production verification.

Real authenticated physical-iPhone path: BLOCKED. Existing `docs/authentication-preview.md` and implementation intentionally limit Auth Preview to Auth endpoints: table/RPC/realtime access is blocked, production reconciliation disabled, and LAN HTTP credential input is refused. Ordinary local-device preview uses synthetic sensor state and production auth/sync is disabled. Neither path establishes real sensor production acceptance. No protections were removed, no HTTPS/trust changes, staging platform or feature deployment created. After production verification, the smallest further step needs review: authorize a secure test delivery path for the approved frontend with narrowly permitted real sensor RPC/read/realtime access, or review a controlled frontend release if existing tooling cannot safely support that. This step is not implemented or assumed approved here.

**Exact next action:** sign in directly to Supabase in the new Firefox dashboard tab; open **Lando's World → lee-lee-tracker**; tell Codex when that authenticated project is open. Do not paste passwords, tokens, JWTs or private connection strings into chat. Then Codex can positively compare live project identity with established browser configuration, run read-only production preflight, execute only the unchanged approved candidate if all gates pass, and perform read-only post-migration verification. No synthetic production cycles or other patient data may be created by Codex.

Physical acceptance remains pending: real Today/portrait/landscape/theme/dialog/safe-area checks; configured timer behavior/foreground one-time chime and resume; first legitimate sensor start using actual start time; same sensor read on Emily's normal shared login; realtime/fallback/reload convergence; cached offline display and blocked mutation. Do not manipulate real starts to force states or perform fake replace/edit/undo/race tests. LLT provides foreground chimes and correct deadline state on resume; it does not guarantee sound while locked, suspended, muted or restricted, and does not replace Dexcom alerts.

Final checkpoint: only this report changed in this turn. Production clinical data/settings, records, food library, serializers and authentication architecture untouched. Historical migrations untouched. No Web Push/VAPID/scheduler/Dexcom integration/glucose/#12 work. Nothing committed, pushed, PRed, merged or deployed; production frontend remains unchanged. `git diff --check` passed; staged diff remains empty.


## Production target verified and read-only preflight passed — 2026-10-04T21:52:47-05:00

Rolando confirmed the authenticated dashboard was available. Fresh fetch again left origin/main equal to HEAD `25b360affe2fcdd0f157eafd55323f4e5155705b`, branch `feature/llt-alerts-dexcom-tracker`. Candidate SHA-256 remains `1d043949d0a663a07c798831eda4ae8ae92c6e4425632f85084845198d994a4e`; executable SQL still matches reviewed artifact exactly. Historical migration diff remains empty. Shared family-auth prerequisite remains CONFIRMED by Rolando.

**Production target verified: YES.** Live dashboard breadcrumbs display **Lando's World → lee-lee-tracker → main PRODUCTION**. Dashboard displays `https://ujbfqcggtuhagsgwcocr.supabase.co`, exactly matching the established `js/lee-lees-tracker-config.js` project URL; region Canada (Central), ca-central-1, status Healthy. Non-secret project ref: `ujbfqcggtuhagsgwcocr`; organization ref: `whcmuqciptfnnhsuiocm`. No keys, credentials or sessions were inspected/exported. An initial stale browser binding was recovered with a fresh Firefox window using the existing signed-in session.

**Read-only SQL Editor preflight: PASS.** Executed only a `BEGIN READ ONLY` catalog query followed by COMMIT; no patient rows selected. Live PostgreSQL `17.6 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit`; database/current_user/session_user all `postgres`. `auth.users`, `auth.uid()` and `supabase_realtime` exist. Five baseline tables exist, owned by postgres and RLS-enabled: `lee_lee_records`, `lee_lee_shared_settings`, `lee_lee_foods`, `lee_lee_saved_meals`, `lee_lee_settings_audit`. Existing audit functions: `append_lee_lee_settings_audit_event(jsonb)` returns void, definition MD5 `8516b6cad2b7ed8b7f23c672282e6f4b`; final `insert_lee_lee_shared_settings_with_audit(jsonb,jsonb)` returns jsonb, MD5 `83aa553a6d09a743bdb4f331e6035609`; final `update_lee_lee_shared_settings_with_audit(integer,text,date,text,text,text,jsonb,integer,jsonb)` returns jsonb, MD5 `5307d045f27e0f4f0e2ab5a9a58ee5cb`. These are schema fingerprints, not patient data.

Sensor relations matching `llt_sensor_%`: none. Candidate's three sensor RPC names: none. `llt_sensor_contexts` publication membership: absent. Execution context matches the approved owner/security assumptions. No historical migrations replayed or migration tracking changed.

The exact candidate file was opened read-only in TextEdit, selected/copied and pasted in SQL Editor without editing or running. Query URL `/dashboard/project/ujbfqcggtuhagsgwcocr/sql/d720e1eb-a963-4e36-ac5d-0540e074e4e5` is the staged unsaved query. The computer-use policy requires execution-time confirmation when creating new security-sensitive access permissions, even after advance approval. A specific confirmation request was presented for clicking Run on the approved migration, including scoped authenticated SELECT/RPC grants and realtime membership. **Migration remains NOT RUN pending that confirmation.** This is an execution-policy gate, not SQL drift or a production preflight failure.

Post-migration schema/grants/RPC/publication/empty-state/consistency verification remains pending. Safe authenticated physical-iPhone path remains blocked by existing Auth Preview's intentional RPC/realtime restrictions; no frontend deployed or protection changed. Only this report changed in the repository this turn; implementation remains unstaged/uncommitted, unrelated artifacts preserved; diff check passes. Clinical data/settings, records, foods, auth architecture and historical SQL untouched. No commit/push/PR/merge/Pages/Web Push/#12.


## Production migration executed and verified — 2026-10-04T21:59:46-05:00

### Execution authority and target

Rolando explicitly confirmed execution of the staged, already-reviewed `202610030001_create_llt_sensor_cycles.sql` against **Lando's World → lee-lee-tracker → main PRODUCTION**, and authorized only read-only post-migration verification afterward. This satisfied the computer-use execution-time confirmation gate. The signed-in SQL Editor still showed the verified project `ujbfqcggtuhagsgwcocr` and organization `whcmuqciptfnnhsuiocm`; its live project URL matched repository browser configuration. No credentials, JWTs or private connection strings were accessed or disclosed.

Branch remains `feature/llt-alerts-dexcom-tracker`; HEAD and fetched origin/main `25b360affe2fcdd0f157eafd55323f4e5155705b`. No main advancement at preflight. Family devices' one shared Supabase login/auth.uid() remains CONFIRMED by Rolando. Candidate executable SQL and SHA-256 remain unchanged (`1d043949d0a663a07c798831eda4ae8ae92c6e4425632f85084845198d994a4e`). Historical SQL, including both settings-audit migrations, remains untouched.

**Migration result: SUCCESS.** Clicked Run once for the exact staged approved file. SQL Editor returned **“Success. No rows returned.”** Transactional candidate completed against PostgreSQL 17.6, execution/current/session user postgres. No ad-hoc patch, historical replay, `db push`, migration tracking repair or synthetic production sensor operation occurred. Used the repository-documented SQL Editor mechanism; no CLI migration-history record was manually inserted or modified. Migration query: `/dashboard/project/ujbfqcggtuhagsgwcocr/sql/d720e1eb-a963-4e36-ac5d-0540e074e4e5`.

### Immediate post-migration checks — READ ONLY

A separate query, `/dashboard/project/ujbfqcggtuhagsgwcocr/sql/ffc09e8f-5752-40ed-8cb8-89940085125f`, used `BEGIN READ ONLY`/COMMIT. Subsequent consistency/audit checks used the same read-only verification tab. No mutation RPC was invoked; no patient rows or family identity details were exported.

- Installed tables: `public.llt_sensor_contexts`, `public.llt_sensor_cycles`, `public.llt_sensor_operations`. Each is owned by postgres, RLS enabled, replica identity default with primary key.
- **30 constraints, six indexes, three policies** match the validated disposable schema exactly. Catalog fingerprint comparison includes every constraint definition, each full index definition and each full policy's roles/command/qual/check. All constraints validated and indexes valid/ready.
- Verified the partial unique `llt_sensor_one_current_idx`, composite context/current FK, predecessor same-context FK, history index and operation-history index through exact structural equality. No drift or missing object.
- RLS: exactly three SELECT policies, roles authenticated, condition `user_id = (SELECT auth.uid())`; no write policies.
- Browser table permissions: authenticated SELECT only, non-grantable; no effective INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER. anon and PUBLIC have no table access. Existing trusted service_role table privileges inherited from Supabase defaults are not browser access; no frontend key or role was changed or exposed.
- Exposed read and mutation RPCs: owner postgres, SECURITY DEFINER true, `search_path=""`, returns jsonb, authenticated EXECUTE only (besides owner), anon/PUBLIC/service_role EXECUTE false. Mutation identity signature is `uuid,text,bigint,uuid,uuid,timestamptz,boolean,text,jsonb`.
- Internal `llt_sensor_snapshot_for_user(uuid)`: invoker (SECURITY DEFINER false), `search_path=""`, postgres-only EXECUTE. authenticated, anon, PUBLIC and service_role cannot call it.
- All three complete RPC definition fingerprints match the already-validated local PostgreSQL schema, including full mutation body/signature. No SQL changed between review, local validation and production execution.
- Realtime: `supabase_realtime` contains **exactly one** sensor table, `public.llt_sensor_contexts`. Membership and structural setup PASS. Actual family-device event delivery remains pending physical acceptance; no fake mutation was created to generate an event.
- Initial dataset: **contexts 0, cycles 0, operations 0**. No current cycle, receipt, fabricated history or migration-created patient sensor data.

| Structural artifact | Count | Production/local matching MD5 |
| --- | --- | --- |
| Constraints | 30 | `0f96a0ef706797f27b45811fa062f5ab` |
| Indexes | 6 | `c99aad7cccb8ea65f0c6505155fa46ec` |
| Policies | 3 | `85904ec6eacb715055a2d675b250fcb8` |
| `llt_get_sensor_snapshot` definition | 1 | `66b3b1d525dee5cdbde7cddff4aa2a36` |
| `llt_mutate_sensor_cycle` definition | 1 | `65d045374b83392a63719930934cd423` |
| `llt_sensor_snapshot_for_user` definition | 1 | `fbe5fef0dc00c94ddad5421f01894001` |

MD5 fingerprints here are deterministic schema comparison markers, not credentials or a cryptographic authorization mechanism. Candidate file identity remains the separately recorded SHA-256.

### Consistency and existing LLT sanity — PASS

Read-only production checks returned **zero violations** for each of:

1. duplicate structurally current cycles;
2. dangling/non-current context pointers;
3. unpointed current cycles;
4. cycle revisions ahead of context;
5. unexpected browser table ACL entries;
6. effective authenticated mutation or anon table access;
7. unexpected function EXECUTE grants;
8. unvalidated constraints;
9. invalid/unready indexes.

Publication membership count: one. Existing LLT baseline table count: five, still RLS-enabled and owned by postgres. Existing audit definitions were re-read separately after migration and are exactly unchanged:

| Existing function | Result | Before/after definition MD5 |
| --- | --- | --- |
| `append_lee_lee_settings_audit_event` | void | `8516b6cad2b7ed8b7f23c672282e6f4b` |
| `insert_lee_lee_shared_settings_with_audit` | jsonb | `83aa553a6d09a743bdb4f331e6035609` |
| `update_lee_lee_shared_settings_with_audit` | jsonb | `5307d045f27e0f4f0e2ab5a9a58ee5cb` |

Existing records/shared settings/foods/saved meals/settings audit capability remains exposed as before. This is read-only schema sanity evidence, not a newly executed production clinical save or full device regression. The approved migration contains no existing clinical DDL/DML or settings/record/food writes; none were issued separately. No clinical serializers, dose calculations or auth architecture changed.

### Physical authenticated device path — BLOCKED / needs explicit review

The production backend installation is VERIFIED. The feature frontend remains uncommitted on the feature branch, NOT shipped/deployed. No real authenticated physical-iPhone acceptance PASS is claimed.

The existing documented tooling cannot currently provide this test safely:

- Ordinary local-device LAN preview is synthetic and disables real auth/Supabase sync.
- `docs/authentication-preview.md` documents Auth-only access: table/RPC/realtime blocked, CSP restricted, production reconciliation disabled.
- `getSensorConnection()` explicitly returns null in Auth Preview.
- iPhone HTTP preview refuses credential entry; trusted HTTPS and certificate/trust changes require separate approval. Merely adding HTTPS would not enable the blocked sensor transport.

**Smallest reviewable next step:** separately approve a narrowly scoped extension of the existing Auth Preview for sensor-only real backend verification, together with trusted HTTPS delivery acceptable to the devices. Reuse existing Auth and project; allow only the reviewed sensor snapshot/mutation RPCs and UID-filtered sensor context realtime/refetch; keep clinical queue writes and unrelated backend access blocked. Review the transport/CSP/environment boundary and secure delivery plan before implementation. Do not silently label the current HTTP fixture URL as a real authenticated test path. No certificate/trust changes, transport exceptions, second backend, staging platform or feature deployment were made here. If acceptable secure delivery requires substantial new infrastructure, stop and review a controlled frontend-release alternative separately; current no-deploy authorization remains binding.

**Exact next instruction for Rolando:** review/authorize the secure sensor-capable preview preparation as a separate gate, including its HTTPS delivery choice; until then, do not enter production credentials into the LAN HTTP preview or use fixtures as production acceptance evidence. The production sensor dataset should remain empty until Rolando starts the currently relevant real cycle through an approved authenticated UI using its correct actual start time.

### Concise real-device acceptance checklist — prepared, not executed

- Today and existing entries load normally; secondary sensor card, portrait/landscape, light/dark, dialog scroll/focus and bottom nav/safe areas.
- Existing configured timer preserved; normal Insulin Given flow, foreground chime/visual completion, one attempt, reload/resume. A supported temporary 1-minute setting is optional; restore desired setting afterward.
- Initial no-sensor; editable start date/time; record ONLY the actual relevant real session; check derived current lifecycle, expiration and grace information.
- Emily's device on the same normal shared login reads the same current sensor/start/status. Observe realtime, allow 30-second foreground fallback and verify reload convergence. No arbitrary replace/edit/undo solely to exercise controls.
- After valid sync, briefly disconnect: cached state visible, clear offline/stale status, blocked authoritative mutation; reconnect converges. Do not induce uncertain production mutations.
- Approaching/grace/expired and complex mutation/race paths remain covered by isolated evidence; never change the real start just to force those states.
- Capability statement: LLT provides foreground chimes and correct deadline state on resume. It does not guarantee sound while locked, suspended, muted, under Focus restrictions or otherwise preventing browser execution/audio; it does not replace Dexcom alerts.

### Final scope and repository state

Only the already-approved production migration changed production; all subsequent production SQL was read-only. Empty sensor dataset retained. Clinical data/settings/auth architecture, record/food data and historical migration files untouched. No family membership, Web Push/VAPID/scheduler/Dexcom API/glucose/#12 work. No additional production patch or permission alteration. Only the architecture report changed in the working repository this execution turn; seven pre-existing tracked implementation changes remain unstaged, new implementation artifacts remain untracked, unrelated diagnostic reports and `death-on-notecards/` preserved. Staged diff empty and `git diff --check` PASS. **Nothing committed, pushed, PRed, merged or deployed. Production frontend still NOT released.** Stop at the explicitly required physical-path review gate.


## 2026-10-04 — Approved HTTPS sensor-only Auth Preview implementation

### Preflight and scope

Branch `feature/llt-alerts-dexcom-tracker`; HEAD `25b360affe2fcdd0f157eafd55323f4e5155705b`. Fetched origin/main; it matches HEAD, with no upstream drift. Existing uncommitted #14.5 implementation and unrelated reports/Death on Notecards files were preserved. No rebase/reset/merge or staging occurred.

The approved migration remains present and untouched. SHA-256: `1d043949d0a663a07c798831eda4ae8ae92c6e4425632f85084845198d994a4e`. No production Supabase connection, authentication, query, mutation, Realtime experiment, sensor record, Auth configuration or schema change occurred in this phase.

Changed this phase only:
- scripts/dev-iphone.mjs
- js/lee-lees-tracker-sync.js
- js/lee-lee-diabetes-tracker.js (App Information copy only; earlier feature integration preserved)
- tests/landos-world-dev-iphone.test.js
- tests/lee-lees-tracker-sync.test.js
- tests/browser/authentication-preview.spec.js
- docs/authentication-preview.md
- this report

No package, lockfile, migration, service-worker, sensor-domain, clinical-domain or unrelated application changes were made this phase. Existing package/service-worker/etc. modifications predate this phase. `.local/llt-auth-preview-tls/key.pem` is already ignored by `.local/`; no ignore change needed.

### Architecture and boundaries

Existing environment remains `local-auth-preview`. Optional `--https --tls-cert <path> --tls-key <path>` uses Node's built-in HTTPS server around the same LAN/runtime-allowlisted handler. Both readable valid TLS files are required; missing/incomplete/invalid configuration fails without HTTP fallback. No certificate provisioning is performed by the server. Sensor mode additionally requires explicit `--sensor-preview`; Auth Preview, TLS, existing certificate files or metadata provider assertions alone do not enable it. The server overrides capability metadata with launch-derived `previewHttps` and `sensorPreview` booleans.

The existing two secure-context guards remain unchanged. Client capability checks also require secure context and both metadata booleans. A usable authenticated session is required for sensor client operations; metadata grants no authentication. Public publishable project configuration, direct browser Supabase Auth, JWT and RLS/RPC authorization remain authoritative. No service-role key, credential proxy, password logging/plaintext password persistence or HTTP physical-device credential fallback was introduced. Existing SDK session-token persistence/refresh remains unchanged and isolated by browser origin.

SDK fetch adds only POST `/rest/v1/rpc/llt_get_sensor_snapshot` and POST `/rest/v1/rpc/llt_mutate_sensor_cycle` at the configured HTTPS project origin. Query-string variants, redirects, alternate RPC options, arbitrary RPCs/table access/Storage/Functions/other REST APIs stay blocked. The wrapper exposes no raw SDK client or raw Realtime client.

The only permitted sensor channel is `llt-sensor-${activeAuthenticatedUid}`, with `postgres_changes`, event `*`, schema `public`, table `llt_sensor_contexts`, filter `user_id=eq.${activeAuthenticatedUid}`. Filter values are copied into fixed subscription configuration; mutating caller objects cannot broaden the subscription. Subscribe and callback delivery recheck the active usable session. Removal/unsubscription applies only to owned handles, including cleanup after auth loss/account change. No broadcast, presence, arbitrary channels/tables/filters or unrelated remove operations. Existing sensor sync remains unchanged.

CSP adds only the two exact RPC URLs and configured project's secure `/realtime/v1/websocket` endpoint. Auth paths, same-origin runtime access, form-action self and worker-src none remain. Clinical records/settings/food/audit reconciliation and queues remain disabled. Service worker/release updater stay disabled. UI badge, status and App Information distinguish live sensor acceptance from disabled clinical sync.

Simplicity review: optional HTTPS, one explicit sensor capability, two RPC exceptions, one bounded sensor-channel exception, tests/docs only. No generalized preview platform, API gateway, cloud/staging/proxy/auth service, new sync layer or domain-policy changes.

### Validation results and limits

- `npm run check:js`: PASS.
- `npm test`: **455/455 PASS**, zero skipped/cancelled/failing tests. Includes dev-iPhone **8/8**, LLT sync **75/75**, sensor/alerts, timer, storage, reporting, PWA and broader existing unit regressions.
- Final Auth Preview browser suite: **14/14 PASS**, desktop and mobile Chromium, including default denial, secure sensor fixture, insecure credential refusal, auth loss/channel cleanup, clinical canaries and PWA inactivity.
- Correctly configured sensor + Issue #13 + Issue #14 browser regressions: **60/60 PASS**, desktop and mobile Chromium. Includes lifecycle/cache/concurrent-tab/timer behavior, Today carb/Entry Saved/timer conflict regressions and saved-meal responsive layout.
- Combined final browser coverage: **74/74 PASS** across the two correctly configured runs.
- Initial mixed browser invocation used ordinary desktop preview for regressions requiring local-device metadata/LOCAL DEV badge. It was stopped after identifying this harness mismatch; the unchanged regression assertions all passed with the existing fixture server on fixed port 8000. No application change was made to accommodate those harness failures.
- `git diff --check`: PASS. Staged diff empty. Full tracked diff reviewed with pre-existing feature modifications distinguished from this phase's eight-file scope.

TLS construction is mocked in the positive server/browser fixtures; malformed TLS is rejected by the real Node HTTPS constructor. No certificates or CA were generated, no TLS verification was disabled, and no machine/device trust was changed. A real trusted TLS handshake, physical Safari authentication/refresh and actual production Realtime delivery remain for the human certificate/acceptance gate. Synthetic results are not physical-iPhone or production acceptance evidence.

Production touched this phase: NO. mkcert installed: NO. Mac trust store changed: NO. iPhone trust changed: NO. Certificates/CA generated/transferred: NO. Nothing committed/pushed/PRed/merged/deployed. Current implementation is local, unstaged and reviewable. No architecture deviation/blocker; certificate setup and real-device acceptance remain pending as required.

### Git status at handoff

```text
 M css/lee-lee-diabetes.css
 M docs/authentication-preview.md
 M index.html
 M js/lee-lee-diabetes-tracker.js
 M js/lee-lees-tracker-sync.js
 M package.json
 M scripts/dev-iphone.mjs
 M scripts/pages-runtime-allowlist.mjs
 M service-worker.js
 M tests/browser/authentication-preview.spec.js
 M tests/landos-world-dev-iphone.test.js
 M tests/lee-lees-tracker-sync.test.js
?? LLT_INSULIN_PLAN_RECONCILIATION_DRY_RUN_REPORT.md
?? LLT_INSULIN_PLAN_RECONCILIATION_EXECUTION_REPORT.md
?? LLT_INSULIN_PLAN_SERIALIZATION_AND_STATE_REPORT.md
?? LLT_INSULIN_PLAN_SYNC_SAFETY_AUDIT.md
?? LLT_INSULIN_PLAN_VERIFICATION_RELEASE_READINESS_REPORT.md
?? LLT_INSULIN_PLAN_VERIFICATION_UX_RELEASE_CANDIDATE_REPORT.md
?? LLT_ISSUE_14_5_ALERTS_DEXCOM_TRACKER_REPORT.md
?? LLT_SETTINGS_DIAGNOSTICS_UX_IMPLEMENTATION_REPORT.md
?? LSW_LOCAL_PROD_DIAGNOSTIC_REPORT.md
?? VFGT_ISSUE_3_LANDING_CARD_IMPLEMENTATION_REPORT.md
?? death-on-notecards/
?? docs/architecture/llt-sensor-cycles-REVIEW-ONLY.sql
?? js/lee-lee-deadline-alerts.js
?? js/lee-lee-dexcom-sensor.js
?? js/lee-lee-sensor-sync.js
?? js/lee-lee-sensor-ui.js
?? supabase/.gitignore
?? supabase/config.toml
?? supabase/migrations/202610030001_create_llt_sensor_cycles.sql
?? tests/browser/llt-sensor-tracker.spec.js
?? tests/llt-sensor-application.test.js
?? tests/llt-sensor-database.test.js
?? tests/llt-sensor-local-api.test.js
```

## Human-controlled certificate setup — not executed by implementation

Use the Mac and iPhone on the same trusted LAN. These commands install trust and create certificates only when Rolando performs the next gate; automated validation uses mocks and does not do so.

From the repository directory:

```sh
brew install mkcert
TRUST_STORES=system mkcert -install
node --input-type=module -e "import {getMacLanInterfaceAddress} from './scripts/dev-iphone.mjs'; console.log(getMacLanInterfaceAddress().address)"
```

Copy the printed IP into the following variable, replacing the placeholder:

```sh
LLT_PREVIEW_IP='<printed-Mac-LAN-IP>'
mkdir -p .local/llt-auth-preview-tls
mkcert -cert-file .local/llt-auth-preview-tls/cert.pem -key-file .local/llt-auth-preview-tls/key.pem "$LLT_PREVIEW_IP" localhost 127.0.0.1
chmod 600 .local/llt-auth-preview-tls/key.pem
mkcert -CAROOT
```

`.local/` is already ignored, and its TLS paths are outside the server runtime allowlist. Never commit or serve certificate/private-key files. Keep the CA private key on the Mac; it can issue trusted certificates.

AirDrop **only `rootCA.pem`** from the printed CAROOT directory to the iPhone. Never transfer `rootCA-key.pem` or `key.pem`. Install the certificate profile through Settings → Profile Downloaded (or General → VPN & Device Management), then enable full trust under Settings → General → About → Certificate Trust Settings.

Launch:

```sh
npm run dev:iphone:auth -- --https --sensor-preview --tls-cert .local/llt-auth-preview-tls/cert.pem --tls-key .local/llt-auth-preview-tls/key.pem
```

Open the printed `https://<Mac-LAN-IP>:8769/#/lee-lees-tracker` URL in iPhone Safari. Proceed only with a trusted certificate and the sensor-acceptance notice. Never bypass a TLS warning. If the IP changes, regenerate the leaf certificate with the new IP and sign in at the new origin.

Rolando performs the normal family sign-in and starts only the actual current Dexcom sensor using its actual start time. No synthetic cycles, forced lifecycle changes, production race tests or malformed operations. Clinical-sync and installed-PWA acceptance remain separate gates. Stop the server with Ctrl-C and sign out of the preview when finished; remove the development CA profile/trust from the iPhone when no longer needed.

References: [mkcert](https://github.com/FiloSottile/mkcert), [Apple certificate trust](https://support.apple.com/en-us/102390), [Node HTTPS](https://nodejs.org/api/https.html#httpscreateserveroptions-requestlistener).

Implementation status: HTTPS SENSOR AUTH PREVIEW IMPLEMENTED — READY FOR CERTIFICATE SETUP

## 2026-10-05 — Mac-only loopback preview follow-up

Rolando selected Mac-only testing and reported successful mkcert installation/Mac system CA trust and a localhost/127.0.0.1 certificate. No iPhone trust setup was performed by this agent. Added optional `--loopback` to the existing preview CLI: binds only 127.0.0.1 and skips LAN route selection; default LAN behavior remains intact. Updated existing argument coverage and preview documentation. Fetched origin/main and confirmed unchanged baseline `25b360affe2fcdd0f157eafd55323f4e5155705b` on `feature/llt-alerts-dexcom-tracker`. Preview server tests 8/8 PASS, Node syntax check PASS, git diff --check PASS. No authentication, production access, certificate generation, trust modification or shipping action by this agent. Physical-iPhone acceptance remains pending; Mac-only results cannot establish it.

Stop the prior LAN-bound process with Ctrl-C, then run:

```sh
npm run dev:iphone:auth -- --loopback --https --sensor-preview --tls-cert .local/llt-auth-preview-tls/cert.pem --tls-key .local/llt-auth-preview-tls/key.pem
```

Mac Safari URL: `https://127.0.0.1:8769/#/lee-lees-tracker`. All prior sensor-only/clinical-sync/security boundaries retained.


## 2026-10-05 — Controlled production-validation release approval and final pre-ship gate

Rolando explicitly authorized commit/push/PR, merge after applicable checks, and the existing merge-triggered Pages deployment BEFORE final physical-iPhone acceptance. This overrides only acceptance order. Reason: remaining acceptance will use the actual installed production PWA. #14.5 is NOT complete; physical-iPhone acceptance remains PENDING until Rolando reports PASS.

Rolando reports that a legitimate real sensor was created through authenticated preview and visually verified: start October 3, 2026 at 10:00 PM CDT; standard expiration October 13 at 10:00 PM CDT; grace end October 14 at 10:00 AM CDT. This is user-reported real data, not an automated shipping mutation. No database queries/authentication/migrations or sensor edits/replacements/undo/resets were performed by this agent during shipping.

Preflight: `feature/llt-alerts-dexcom-tracker`, HEAD and freshly fetched origin/main `25b360affe2fcdd0f157eafd55323f4e5155705b`; no drift. No existing PR for this branch. Existing unrelated work preserved. Final scope: 22 files, classified below. A = required production implementation/schema artifact; B = intended #14.5 tests/docs/report/development tooling; C = local-only/review artifacts excluded; D = unrelated/pre-existing files excluded. HTTPS tooling is intentionally included in B, but generated certificate material is excluded. Committing the already-applied migration records its exact source; no migration executes during Pages deployment.

```text
A css/lee-lee-diabetes.css
B docs/authentication-preview.md
A index.html
A js/lee-lee-diabetes-tracker.js
A js/lee-lees-tracker-sync.js
B package.json
B scripts/dev-iphone.mjs
A scripts/pages-runtime-allowlist.mjs
A service-worker.js
B tests/browser/authentication-preview.spec.js
B tests/landos-world-dev-iphone.test.js
B tests/lee-lees-tracker-sync.test.js
D LLT_INSULIN_PLAN_RECONCILIATION_DRY_RUN_REPORT.md
D LLT_INSULIN_PLAN_RECONCILIATION_EXECUTION_REPORT.md
D LLT_INSULIN_PLAN_SERIALIZATION_AND_STATE_REPORT.md
D LLT_INSULIN_PLAN_SYNC_SAFETY_AUDIT.md
D LLT_INSULIN_PLAN_VERIFICATION_RELEASE_READINESS_REPORT.md
D LLT_INSULIN_PLAN_VERIFICATION_UX_RELEASE_CANDIDATE_REPORT.md
B LLT_ISSUE_14_5_ALERTS_DEXCOM_TRACKER_REPORT.md
D LLT_SETTINGS_DIAGNOSTICS_UX_IMPLEMENTATION_REPORT.md
D LSW_LOCAL_PROD_DIAGNOSTIC_REPORT.md
D VFGT_ISSUE_3_LANDING_CARD_IMPLEMENTATION_REPORT.md
D death-on-notecards/
C docs/architecture/llt-sensor-cycles-REVIEW-ONLY.sql
A js/lee-lee-deadline-alerts.js
A js/lee-lee-dexcom-sensor.js
A js/lee-lee-sensor-sync.js
A js/lee-lee-sensor-ui.js
C supabase/.gitignore
C supabase/config.toml
A supabase/migrations/202610030001_create_llt_sensor_cycles.sql
B tests/browser/llt-sensor-tracker.spec.js
B tests/llt-sensor-application.test.js
B tests/llt-sensor-database.test.js
B tests/llt-sensor-local-api.test.js
C .local/llt-auth-preview-tls/ (ignored generated material, excluded)
```

Secret/certificate audit PASS: complete candidate scanned for PEM private-key markers, JWT literals, service/secret keys, GitHub tokens and credential-bearing PostgreSQL URLs; zero matches. Runtime allowlist excludes scripts/docs/reports/tests/Supabase/local material. Both leaf TLS paths are ignored. Candidate contains no certificate files, CA files, private keys, production credentials or tokens. Report contains setup instructions only, no private material.

Final source review confirms unchanged insulin calculations/rounding/correction tables/I:C/meal bases/bedtime insulin/TEA/food calculations/settings and existing entry workflows. No #12 or unrelated app changes. Feature integration adds sensor surface/init and foreground audio unlock only; Auth Preview capability requires local-auth-preview metadata, explicit HTTPS/capability booleans, secure context and a usable session. Production Pages metadata is constructed as environment production with no preview capability flags, so preview transport exceptions cannot accidentally activate there. Normal production authentication is unchanged.

Final validation from exact runtime candidate: `npm run check:js` PASS; `npm test` 455/455 PASS (including preview server 8/8 and LLT sync 75/75); Auth Preview desktop/mobile Chromium 14/14 PASS; sensor + Issue #13/#14 desktop/mobile Chromium 60/60 PASS; total browser 74/74 PASS; git diff --check PASS. No unexplained failures. Prior isolated database validation 39 PASS remains prior evidence, not rerun against production.

Release identity: preserve established `SW_VERSION = '__LANDOS_BUILD_SHA__'` template. Pages builder substitutes the new full merge SHA into SW/cache identity and runtime/deployment metadata. Release label is UTC merge-commit date plus actual Pages run_number, generated by existing workflow. New sensor assets are runtime-allowlisted and precached. No manual deployment, workflow change, alternate version scheme, cache clearing or data reset. Exact merge SHA/release/run/served-asset evidence will be reported after deployment.

GitHub preflight reports main unprotected with zero required check contexts; existing Pages workflow is main-only, with no pull_request CI trigger. PR checks/mergeability will still be inspected and any reported failure stops release. Do not bypass checks. Normal merge-commit method matches recent releases.

Recovery: rollback risk MEDIUM (shared sensor UI/new cache release). Revert the feature merge through a new reviewed PR, retain production sensor schema and all sensor/clinical data, and allow existing Pages workflow to redeploy the revert commit with a fresh SHA identity. Do not drop tables, replay the migration, reset browser storage or modify the real sensor. Previous known-good main is 25b360affe2fcdd0f157eafd55323f4e5155705b.

Physical-iPhone acceptance remains PENDING after this controlled deployment. No final acceptance claim is authorized yet.


## 2026-10-05 — Controlled deployment verified; live physical-iPhone acceptance PENDING

Release feature commit: `5a7d079379f188b32a6d91afe3dc6c6cc37adc2c` on `feature/llt-alerts-dexcom-tracker`. Push succeeded. PR [#140](https://github.com/RolandoBernal/landos-world/pull/140) attached to this chat and merged through the normal merge-commit process under Rolando's explicit authorization. Exact head/base checked before merge; mergeability MERGEABLE/CLEAN. Required PR CI: none configured (zero required contexts, zero check runs/statuses); no failed check was bypassed. Local static, 455 unit and 74 browser checks passed as recorded above.

Merge commit: `ab8f9bf41ca5044d5c4bdf22aba5c78a391a7dd0`. Local main and origin/main synchronized to that SHA while preserving the feature checkout and unrelated files. Merge tree equals the validated feature tree byte-for-byte. No direct-to-main push, branch deletion or manually triggered deployment.

Automatic Pages [run 37342665188](https://github.com/RolandoBernal/landos-world/actions/runs/37342665188), run number 23: build SUCCESS, deploy SUCCESS, overall SUCCESS. Release label `2026-10-05-23`; built at `2026-10-05T16:40:49.000Z`. Service-worker/cache identity is the full merge SHA. Production metadata environment remains production with no sensor-preview capability flags.

Live served proof: HTML, LLT CSS, tracker/sync and all four new sensor/alert JavaScript modules exactly match merge-commit bytes. Service worker exactly matches the SHA/release/build-time/run substitutions in the committed template. Runtime metadata exactly matches deployment-version.json. This is asset identity evidence, not merely HTTP 200.

- `index.html` SHA-256 `acc400c667e9a504c648a41cafd36731d704da2d1c1de3a8448196239cc30dfb` — MATCH
- `css/lee-lee-diabetes.css` SHA-256 `e4b18d1bc644c0507f357675edc326919b3b92e5b32098161c91f21ce96466fb` — MATCH
- `js/lee-lee-diabetes-tracker.js` SHA-256 `81e7b1a6500f3b75ea7581e126cf0231df5f9cb650acaea6a9a64d2426f8e8a9` — MATCH
- `js/lee-lees-tracker-sync.js` SHA-256 `b4264f99a1215c2bc8b58ce61445b0b9f8d876061beaa398a47dca4ad1a59e44` — MATCH
- `js/lee-lee-dexcom-sensor.js` SHA-256 `97f9362a8092b2f33ac73625704da2c7cd3c8ba77f9166e996aac74ef369b553` — MATCH
- `js/lee-lee-deadline-alerts.js` SHA-256 `0d94c276bfc9185e6b3317731ff7431498dfd9fc0a5a69a3bf3bb3fc2a9353b0` — MATCH
- `js/lee-lee-sensor-sync.js` SHA-256 `582a4130e620a076e444c753ad5339cbdc8b2ba73008ad7d32c92e0bbbd58726` — MATCH
- `js/lee-lee-sensor-ui.js` SHA-256 `1a5b8937427f3bf917c85e2e002e98a4272916cd6b6fa37358ddd3a2fa920f83` — MATCH
- service-worker.js SHA-256 `323658bcf122f80cb4020618a768ac2f2e0bd0bad42e430b876682513c29ac4c` — MATCH

Fresh unauthenticated live Chromium sanity PASS: Lando's World loaded, launcher button navigated to LLT, Sign In visible, current production build identity, zero page errors and zero sensor-mutation requests. Mutation RPC was explicitly blocked in that fresh context. Initial automation used an incorrect link selector; corrected to the existing launcher button with no app modification. No real-session login or clinical/sensor interaction was performed.

Production sensor backend changed during shipping: NO. Existing real sensor modified during shipping: NO. Nothing unrelated shipped: YES. Secret/certificate audit PASS; no certificates/trust material committed. Clinical calculations/settings changes NONE. All thirteen excluded untracked entries remain preserved. Local fixture preview on port 8000 remains available; it is not the acceptance environment. This post-deployment evidence is a local report append only, not a second shipped change.

Primary acceptance now uses Rolando's existing installed live production PWA, not LAN preview/mkcert/other family devices. Use Settings → Application Status and the normal update control to verify running/latest release 2026-10-05-23 (ab8f9bf); close/reopen once if needed. Do not clear caches/user data or reinstall.

Confirm the actual current sensor: October 3 10:00 PM CDT start, October 13 10:00 PM CDT standard expiration, October 14 10:00 AM CDT grace end. Open/close Sensor Details & History, reopen LLT, verify same sensor/sync. After syncing, briefly go offline while loaded, confirm last-known state without mutations, reconnect and confirm convergence. Use normal pre-meal timer workflow, optionally existing supported 1-minute setting; keep LLT foregrounded, verify visual completion and one chime, restore preferred duration. Check portrait/landscape, safe areas, modal scroll and bottom navigation. No edit/replace/undo merely to test; no locked/background/Focus/silent-mode guarantee.

#14.5 remains NOT COMPLETE. Wait for Rolando's physical-iPhone PASS or feature-specific regression report before freezing the implementation. No shipping blocker or scope deviation. The only workflow qualification is that the existing repository has no required PR CI; established local gates and automatic Pages build/deploy passed. No additional feature work is authorized during this acceptance wait.

LLT #14.5 DEPLOYED — AWAITING LIVE PHYSICAL-IPHONE ACCEPTANCE

## 2026-10-05 — Physical acceptance PASS; post-release accordion polish

Rolando explicitly reported live physical-iPhone acceptance PASS for production release 2026-10-05-23 / ab8f9bf (PR #140). The released #14.5 implementation is accepted COMPLETE. This separate presentation polish is implemented locally only and has not shipped.

Fresh branch `fix/llt-dexcom-card-accordion` from clean synchronized main `ab8f9bf41ca5044d5c4bdf22aba5c78a391a7dd0`; prior local deployment-report append restored byte-for-byte and all unrelated untracked work preserved. UI scope: `js/lee-lee-sensor-ui.js`, `css/lee-lee-diabetes.css`, `tests/browser/llt-sensor-tracker.spec.js`, plus this short report append.

Tracked sensors use native details/summary, collapsed by default: label/status/chevron only; secondary timestamps/actions are revealed on user activation. No duplicated header, persisted disclosure state or automatic expansion. Open state and disclosure focus survive periodic rendering. Native keyboard semantics, accurate aria-expanded/aria-controls, visible focus and hidden-action exclusion verified. No-sensor/loading-without-current workflow remains a visible ordinary card with its existing Start action. Card-only mobile actions stack full width at existing 640px breakpoint; wider actions remain natural width. Modal content/handlers, sensor/domain/sync/database/offline/alerts/timer/clinical calculations/settings unchanged.

Final validation: static PASS; full unit suite 455/455 PASS; final desktop/mobile Chromium browser suite 62/62 PASS (20 sensor/accordion, 42 Issue #13/#14). Initial new keyboard test attempted role lookup for a correctly accessibility-hidden action; corrected to inspect the hidden DOM node, with final full browser run passing. Collapsed/expanded screenshots reviewed at 320/393/768/1280 and 852x393 landscape; no horizontal overflow/clipped labels, narrow full-width buttons and >=44px targets. Landscape scroll additionally verified action bottom 219.44px above bottom-nav top 312.81px. git diff --check PASS; staged diff empty.

Safe fixture preview remains running at `http://127.0.0.1:8000/#/lee-lees-tracker` on the fresh branch; no production authentication or sensor mutation. This polish has not been physically accepted or released. Nothing committed/pushed/PRed/merged/deployed this phase. No blocker or scope deviation. STOP for Rolando's review.

## 2026-10-05 — Combined UI polish: modal action hierarchy

Rolando approved the local Today accordion visually and explicitly extended the same unshipped branch with presentation-only Sensor Details & History polish. The approved Today card remains intact. Refresh now sits beside the unchanged dynamic sync status and calls the exact existing resume/details handler. After unchanged sensor dates, Sensor Management presents a filled Replace Sensor action with “Start tracking a new Dexcom G7.” A native Manage Sensor disclosure defaults collapsed and reveals Edit Start Time / Undo Current Sensor with the exact approved explanatory copy. No-sensor retains its existing Start New Sensor flow; inappropriate correction/replacement controls are absent. History and reminder limitation copy are unchanged.

Accessibility includes aria-expanded/content relationships, visible focus, native Enter/Space interaction, >=44px controls, and modal containment excluding collapsed correction controls. Closing restores the current copy of the original card action if periodic rendering replaced its DOM node. All code from form/review/confirmation through action handlers, fixture transport, client initialization and alert integration is byte-identical to HEAD. No sensor/domain/sync/database/cache/offline/timer/alert/clinical behavior or settings changed.

Final validation: JS/static PASS; full unit suite 455/455 PASS; desktop/mobile Chromium regression set 66/66 PASS (24 sensor/accordion/modal, 42 #13/#14); authentication-preview isolation 14/14 PASS. Responsive geometry and screenshots reviewed at 320/393/768/1280 and 852x393 landscape: contained modal, scrollable content/reachable Close, wrapping sync row and microcopy, full-width narrow management controls, unchanged contained desktop width and no horizontal overflow. Initial checks exposed and resolved collapsed-control focus exclusion, accessible Replace Sensor naming and focus restoration; test setup/screenshot timing corrected. A premature fixture-server stop caused explained connection-refused failures in one intermediate run; the uninterrupted final 66-test run passed. No unexplained regression remains.

Diff review and git diff --check PASS; staged diff empty. Same branch/HEAD: fix/llt-dexcom-card-accordion / ab8f9bf41ca5044d5c4bdf22aba5c78a391a7dd0. Only the sensor UI, LLT CSS, focused browser test and this report changed; preexisting unrelated reports/untracked work preserved. Safe fixture preview remains at http://127.0.0.1:8000/#/lee-lees-tracker with production authentication/sync disabled. No production data changes. Nothing committed/pushed/PRed/merged/deployed. No scope deviation or blocker. Await Rolando's combined UI review before shipping.

## 2026-10-05 — Final visual-hierarchy refinement (local review only)

Preserved all approved Today/disclosure/modal behavior. Replace Sensor now reuses LLT's established primary button class, contains only its action label, fills the mobile management width and uses natural width on wider screens. Its separate noninteractive secondary description remains associated through aria-describedby. Edit Start Time now explains: “Change the start date or time if it was entered incorrectly. This will update the sensor’s expiration and grace-period times.” Undo explanation unchanged. Matching existing 1px sensor-divider styling begins Sensor Management and Sensor History; first history record no longer has a border beneath the heading, while later record separators remain intact. Refresh placement, Manage Sensor disclosure, focus/disabled states and all existing handlers/confirmations preserved.

This refinement changes only details() markup/copy, focused CSS, focused test assertions and this concise note. Every function outside details() is byte-identical to the prior reviewed implementation. No sensor/domain/sync/database/history semantics, offline/cache, timer/alerts, authentication/PWA or clinical behavior changed. Final checks: static PASS; units 455/455; desktop/mobile Chromium sensor/Today/modal/#13/#14 browsers 66/66; Auth Preview 14/14; git diff --check PASS. Responsive screenshots/geometry reviewed at 320/393/768/1280 and 852x393 landscape; no horizontal overflow, proper button/description separation and section grouping, >=44px targets, scrolling/Close preserved. No failures, deviations or blockers this iteration.

Branch/HEAD remain fix/llt-dexcom-card-accordion / ab8f9bf41ca5044d5c4bdf22aba5c78a391a7dd0. Four cumulative modified files; staged diff empty and unrelated work preserved. Safe local fixture preview restored on port 8000. Nothing committed/pushed/PRed/merged/deployed. Await final visual review before shipping.

## 2026-10-05 — Authorized final polish release candidate

Rolando reported final combined visual review PASS and explicitly authorized commit/push/PR, merge after release checks, automatic Pages deployment verification and safe local-main synchronization. Fresh fetch confirms starting HEAD/local main/origin main all ab8f9bf41ca5044d5c4bdf22aba5c78a391a7dd0. Exact reviewed UI/assets unchanged during shipping. Static checks PASS; 455/455 units, 66/66 responsive/accessibility sensor/Today/#13/#14 browsers, 14/14 Auth Preview regressions PASS. git diff --check and candidate secret audit PASS. Only the four approved UI/CSS/test/report files will be staged; unrelated work, local Supabase files, screenshots and ignored TLS/CA material excluded. All forms/domain/action handlers and sync/alert integration remain byte-identical to the production baseline. No database or real-sensor changes.

Existing Pages workflow generates the next commit-date/run-number release label and full merge-SHA service-worker/cache identity automatically. No source version bump or workflow change is needed. Main is unprotected with no rulesets/required PR checks configured. Deployment and live served-byte evidence will be appended after the authorized merge; previous known-good main is ab8f9bf41ca5044d5c4bdf22aba5c78a391a7dd0. Rollback risk LOW: revert this polish merge through a new PR and let normal Pages deploy the revert; retain all sensor/clinical data and database objects.
