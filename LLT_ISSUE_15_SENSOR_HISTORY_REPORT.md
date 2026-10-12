# LLT Issue #15 — Sensor management and history

## Current release status — October 12, 2026

Local physical-iPhone acceptance is complete. Rolando confirmed production preflight, targeted sensor CSV exports, Issue #15 migration execution, postflight, existing-client physical-iPhone checks and RPC backward compatibility passed. These are user-confirmed results; production SQL was not rerun during release preparation. Application release is awaiting PR review and Rolando’s merge; no deployment is claimed. Earlier pending-status statements below describe historical milestones. Issue #12, insulin calculations and clinical settings remain outside this release.

Status: Implemented Locally / Local Database and REST Integration Validated. Production migration requires separate review and explicit approval. Local physical iPhone acceptance confirmed by Rolando in the October 9 deployment-preparation attachment. Production acceptance pending.
Branch: feature/llt-issues-15-16. Base: 5d49f0c140f78a378e571958550c62c899e5096d.

## Investigation and approved architecture

The previous investigation identified separate sensor UI/domain/sync modules, dedicated llt_sensor_contexts / llt_sensor_cycles / immutable llt_sensor_operations, and a transactional mutation RPC. Sensors are not stored in medical records or shared settings. Replacement closes the previous cycle at the NEW sensor's entered start timestamp; current-start correction and Undo have existing boundary protections. Supabase snapshots use revision/current-pointer checks; local cache is last-known data, not write authority.

The latest attached instructions approve extending that architecture, with 2,000-character notes (superseding the earlier proposed 10,000 limit), closed-only metadata editing, and All / Active / Completed / Replaced Early / Sensor Issues / Cancelled filters (superseding the earlier Failed/Other proposal). No production SQL approval has been granted.

Inspected existing modules, schema/RPC migrations, sensor unit/SQL/browser tests, LLT authentication-preview facade and existing issue reports before changes.

## Files changed or added

Runtime:
- js/lee-lee-dexcom-sensor.js: stable reasons, metadata validator, history status and filter predicates; existing lifecycle arithmetic unchanged.
- js/lee-lee-sensor-sync.js: backend capability, metadata request/target fields, clear missing-RPC failure; existing retry/lock/account checks retained.
- js/lee-lee-sensor-ui.js: bounded Today navigation, full-screen All Sensors, search/filter/pagination, details and closed-only edits, optional replacement fields, account-switch dialog cleanup and isolated fixture support.
- css/lee-lee-diabetes.css: scoped sensor history/dialog/textarea styling, retaining LLT typography/colors/touch conventions; also contains the approved Issue #16 card styles.

Database/test/tooling:
- supabase/migrations/202610090001_add_llt_sensor_replacement_metadata.sql (new, review required).
- tests/llt-sensor-metadata-database.test.js (new isolated database/PostgREST harness).
- tests/browser/llt-sensor-history.spec.js (new).
- tests/llt-sensor-application.test.js (metadata/status/capability/retry coverage).
- tests/browser/llt-sensor-tracker.spec.js (existing history assertions moved to the approved dedicated screen; lifecycle/correction/Undo assertions retained).
- tests/llt-sensor-database.test.js (strict disposable-name allowlist additionally accepts this harness's llt_metadata_test_<pid>_<timestamp> database).
- package.json (syntax checks and explicit isolated metadata DB test command).

Issue #16 files/report are recorded separately. Unrelated pre-existing modified/untracked files preserved. Nothing staged.

## Migration and RPC contract

The new transactional, additive migration adds nullable replacement_reason_id TEXT, replacement_notes TEXT, replacement_requested BOOLEAN. No data backfill, timestamp rewrite, default metadata, table replacement or second audit system. Reason constraint allows exactly the 12 approved identifiers. Notes use PostgreSQL char_length <= 2000; client counts Unicode code points with Array.from, so a 2,000-emoji note is accepted consistently. Requested NULL/TRUE/FALSE remains Not Recorded/Yes/No.

Existing operations action check includes update_metadata. Its bounded request-size constraint becomes 16,384 bytes: a 2,000-character UTF-8 note can need 8,000 bytes before JSON/device metadata. This supports the approved character limit without losing bounded requests. Receipts remain immutable to browser roles.

A single mutation function replaces the old 10-argument signature with 12 arguments, adding optional p_target_cycle_id UUID and p_replacement_metadata JSONB. Old 9/10-argument positional/named callers continue through defaults; no ambiguous overload retained. Metadata object requires exactly replacement_reason_id, replacement_notes, replacement_requested with strict types/valid values. Extra business fields/timestamps are rejected.

- start: when metadata is supplied, atomically assigns it to the prior cycle being closed. New cycle receives only its own pairing code/start. No metadata is required; legacy calls retain exact canonical request shape.
- update_metadata: requires target ID, null start/new ID, false replacement-confirm flag and a complete metadata object. Requires authorized account, existing context lock, expected revision/current pointer and closed target. Updates only the three business metadata fields plus necessary revision/update audit fields. Pointer, UUID, start/end, state and previous pointer are unchanged. Active/cancelled/nonexistent/foreign targets fail closed.
- edit_start / undo_current: preserve existing timestamp/boundary/restoration behavior and metadata retention. Supplied metadata is rejected for these actions.

Receipt lookup remains before expected-version checks. Canonical requests include target/metadata only when supplied, so old operation replay remains compatible. Same-ID changed payload is rejected. Parallel writes serialize on the context lock and yield one accepted/one conflict for the same expected revision.

Snapshot projection omits NULL new metadata keys (and keeps the previous sensor-code omission), preserving unchanged legacy snapshots at equal revision. Explicit FALSE is retained. Capability sensorMetadata:1 is added outside the snapshot to llt_get_sensor_snapshot; this does not alter snapshot identity. Client enables metadata writes only after an authoritative response advertises capability. Missing migration blocks metadata edits clearly, while replacement without optional metadata remains usable. A PGRST202 missing-function response is reported Not saved and clears that known-unexecuted request; network/unknown outcomes retain their exact pending request for replay.

Preflight checks the installed sensor-code prerequisite/RPC owner/security and uses RESTRICT on old signature removal. Unexpected dependencies abort the entire transaction; tested no partial columns/data. Repeat installation preserves records and leaves one function signature. Fresh installation means applying existing base + sensor-code migrations before this additive migration, not bypassing prerequisites.

## UI and historical policy

Today compact countdown remains unchanged. Expanded card now contains start, standard expiration, grace end, replacement, management and the full-width **View All Sensor History →** button. The management dialog has the same bounded navigation row; neither renders history cards.

All Sensors is a full-screen native modal with theme, focus containment, safe-area padding and Close. Native top-layer placement keeps bottom nav underneath. Includes current/closed/cancelled cycles; sort by started_at descending and UUID descending tie-breaker. Initially at most 25 rendered rows; Load More adds 25; search/filter resets pagination. Returning from details restores query, filter, loaded count, focus target and scroll (subject to normal content-size clamping). Closing restores the original app opener. Account switch closes stale-account dialogs and clears temporary drafts/search identity.

Rows show type/code, start, actual replacement/end and elapsed duration when closed, lifecycle status; current rows use current lifecycle countdown with no fabricated end/completed duration. Details show expected start/standard/grace, actual replacement/duration or cancellation where applicable, and escaped multiline metadata for noncurrent records. Null/missing legacy metadata displays Reason Not Recorded / No Notes Recorded / Replacement Requested: Not Recorded; FALSE displays No. Only closed records offer Edit Replacement Metadata. Current and cancelled details are read-only for metadata; existing guarded current timestamp management remains separate.

Lifecycle rules remain 240 elapsed hours + 12 hours grace. Closed before standard expiration = Replaced Early; at/after = Completed; current = Active even in grace/expired time states; cancelled = Cancelled. Status is never inferred from reason.

Sensor Issues matches the ten approved nonnormal/nonother identifiers. Other is excluded even when notes mention an issue because there is no deterministic structured classification; no keyword guessing. Filters may overlap (e.g. early + issue). Case-insensitive search combines formatted/ISO dates, reason labels and notes. Local Intl timezone formatting and timestamp-difference durations preserve DST behavior.

## Validation results

- Full npm test: 545 passed, 0 failed.
- Focused sensor unit suite: 63 passed (included in full suite); Low Glucose unit suite: 52 passed (included).
- Isolated metadata database/REST suite: 19 passed, 0 failed. Includes fresh/existing/repeat installs, dependency rollback, legacy same-revision equality/receipt replay, NULL/FALSE, invalid metadata/2,001-character rejection, 2,000 Unicode characters, atomic replacement, closed edits, unchanged timestamps/pointers, stale/parallel writes, target-state rejection, authorization/RLS, Undo and immutable request identity.
- Within that suite: all 38 pre-existing sensor SQL regressions passed on the upgraded disposable schema.
- Actual disposable PostgREST + synthetic JWTs verified old/new named calls and account scope. Current client code verified REST → DB → hydration/cache roundtrip, persisted lost-response retry, second-device refetch/invalidation callback and stale conflict. Realtime delivery itself is not a physical-device/network subscription acceptance claim; the existing transport invalidation mechanism is unchanged.
- Combined focused sensor/Low Glucose browser run: 86 passed, 0 failed before adding the final notes-length test.
- Final complete LLT browser suite after all corrections: 130 passed, 0 failed in one run (2.5 minutes), covering Low Glucose, sensor tracker/history, Today carb breakdown and saved-meal action rows on desktop/mobile Chromium. Log: /private/tmp/llt-final-complete-browser.log.
- npm run check:js and git diff --check passed; intended diff reviewed. No staging/commits/pushes.

During development, old browser assertions expecting inline history were updated to navigate into All Sensors; no lifecycle/Undo/code regression expectations were weakened. New metadata labels were made explicit for accessible association. A new replacement test originally read localStorage before the async save completed; it now waits for the accepted current code. A disposable auth helper initially supported SQL claim settings only; it was corrected to support PostgREST JSON JWT claims. Production code was not changed for those test-fixture mismatches.

Tests cover empty, active-only, 2 historical, 25 historical and 105 historical records, bounded DOM, combined filters/search, missing metadata, escaped notes, list return position, responsive layout, replacement placement, optional metadata via existing replacement regressions, cross-tab refetch/conflict, read-only cancellation and client note limit.

## Deployment requirements and limitations

No production SQL, live patient data access or deployment occurred. Test harness created and removed disposable local databases, synthetic login and PostgREST container; it did not install the migration into the existing local service database or production. The retained iPhone preview uses the established isolated sensor fixture, not production Supabase.

Before any production migration: review the exact SQL/RPC changes and prerequisites, verify actual installed security/dependencies, approve that specific execution separately, and use the established release workflow. Migration capability must be present before metadata writes; no simulated/local-only save is used in production. Production database installation and device acceptance remain required; do not call this deployed or production-ready.

## Manual iPhone acceptance checklist

Preview: http://10.0.0.160:8000/#/lee-lees-tracker (HTTP 200 reverified after the final suite). Use synthetic entries first:
1. Confirm current compact countdown and expanded start/expiration/grace, full-width history navigation, replacement and management.
2. Open All Sensors; verify full-screen safe areas, Close/focus, newest-first active/history/cancelled rows and scrolling with 100+ records.
3. Combine date/reason/notes search and all filters; test Load More/reset, detail/back retaining query/filter/page/position. Confirm Other is excluded from Sensor Issues.
4. Check active detail without fabricated end/duration, historical metadata unknown vs No, cancelled read-only, long labels and long escaped notes.
5. Replace without optional metadata; replace with reason/notes/Yes or No. Verify previous-cycle metadata and replacement boundary at entered new start. Verify guarded correction/Undo.
6. Edit closed metadata, clear fields to unknown, check 2,000 limit and keyboard/VoiceOver/touch targets. Confirm no timestamp controls in historical metadata editor.
7. On an explicitly approved isolated integration environment, test offline rejection/last-known cache, pending lost-response replay, concurrent conflict, account switch and cross-device synchronization. Do not use production patient records or claim fixture cross-tab tests validate live Supabase/iPhone delivery.

Physical iPhone/Safari/PWA acceptance remains pending. Normal production updater/cache behavior was not altered or used to bypass release checks.

## October 9 production preparation

Local physical iPhone acceptance confirmed by Rolando in the deployment-preparation attachment. No production migration or application publication authorized yet. See docs/deployment/llt-issues-15-16-production-approval.md for live schema review, final validation and recovery blockers. Production migration identifier, deployed candidate revision, production smoke results and production user acceptance remain pending. Existing local test results above are historical; fresh preparation results are recorded in the approval package.

Fresh October 9 preparation validation: 545 unit, 19 metadata integration, 38 existing sensor SQL, 82 Low Glucose database and 1 local Auth/REST/realtime test passed; syntax/diff checks passed. All 130 issue-specific browser scenarios passed. Complete browser coverage: 588 scenarios, 560 passed, 28 failed, 0 skipped; every failure reproduced on unchanged main. Production recovery remains unverified (backup API lists no points; PITR false), so no migration or publication occurred. Detailed exact commands, baseline comparison, scope, verification and recovery procedures are in docs/deployment/llt-issues-15-16-production-approval.md.

## October 12 scoped release validation

Authorized PR-only release preparation: 545 unit tests and syntax/diff checks passed; fresh desktop/mobile LLT browser suite 130 passed; local database checks 19 metadata plus 38 existing sensor, 82 Low Glucose and one synthetic Auth/REST/realtime all passed. All 13 candidate hashes remain unchanged. Earlier broad-suite evidence remains 560 passed/28 known baseline failures, not a green full suite. No production SQL was rerun; reviewed migration is included for history only. Application awaits PR review and Rolando’s merge; production deployment and updated-app acceptance remain pending.
