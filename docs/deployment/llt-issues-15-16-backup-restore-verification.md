# Issues #15/#16 production recovery verification

**Current status — October 12:** Rolando confirmed production preflight and postflight passed, targeted sensor-data exports were saved privately, the reviewed migration was executed successfully, and the existing production client/RPC compatibility was verified on physical iPhone. No production SQL was rerun here. Application release now awaits feature-branch PR review and Rolando’s merge. The historical instructions/status below are retained as preparation evidence; do not rerun the migration. Targeted exports are not a verified full database backup or isolated restore.

**Superseding decision — October 11:** Rolando discontinued the full pg_dump/authentication/isolated-restore process for this deployment and explicitly accepted targeted dashboard exports plus saved RPC definitions as narrower precautions. Historical full recovery status remains unverified; it is not represented as VERIFIED or silently weakened. The active deployment review gate is user-provided manual preflight evidence under [the SQL Editor guide](llt-issues-15-16-sql-editor-guide.md). No targeted data exports have yet been confirmed completed. Do not continue PostgreSQL authentication or restore attempts under the superseded instructions.

## CA retry — October 11, 2026

The supplied `prod-ca-2021.crt` was found under the approved backup directory and mounted read-only alongside ~/.pgpass in a disposable PostgreSQL 17.6 client. Explicit sslmode=verify-full with this CA progressed past certificate validation, but the Session Pooler rejected authentication: **FATAL: password authentication failed for user "postgres"**. Client exit status 2; password was retrieved from the private credential file without displaying or copying its contents. The configured username remained the user-verified `postgres.ujbfqcggtuhagsgwcocr`; the server's error labels the underlying role postgres.

**Current gate: BLOCKED by authentication**, superseding the initial missing-CA blocker. No SQL ran, so database/project identity and read-only/server-version checks remain incomplete. No backup or restoration was attempted. Stop before further production connection attempts until the user privately verifies the saved password and the dashboard connection details. No TLS downgrade, password reset, production modification, commit, push or deployment occurred.

## Authentication/TLS test — October 11, 2026

User completed private password entry. ~/.pgpass is owned by the current macOS account and has mode 0600; its contents were not displayed or copied. A disposable read-only Docker client using existing PostgreSQL 17.6 tooling mounted this credential file read-only. It attempted the user-verified Session Pooler endpoint with explicit sslmode=verify-full and the container's system CA bundle. **Connection failed before SQL execution: SSL error: certificate verify failed.** No fallback to require, verify-ca or disabled verification was attempted. Authentication, server identity, SSL session and read-only query results therefore remain unverified.

**Current gate: BLOCKED by TLS certificate trust.** Obtain the appropriate trusted CA certificate from authenticated Supabase project connection/SSL settings or otherwise establish an authoritative trust chain; verify hostname as well as trust on the next attempt. Do not trust an arbitrary certificate harvested from the failing connection. No production backup, restoration, migration, record modification, commit, push or deployment occurred. The credential file remains private; no secret was logged. No production medical data or restore artifact was written.

## Latest storage authorization and verification — October 10

This update supersedes the encrypted-image requirement below. Rolando approved `/Users/rolandobernal/Documents/LLT-Backups/` provided FileVault is enabled. Elevated read-only `fdesetup status` returned **FileVault is On**; `diskutil info /System/Volumes/Data` independently reported **FileVault: Yes**, APFS, owners enabled. The sandboxed initial status command could not resolve the root device; it was not treated as evidence that FileVault was disabled.

Created the approved directory and `2026-10-10-preparation` child on the startup data volume. Both are owned by rolandobernal with mode 0700 and no additional ACL entries shown. No production data dump or restored database was created. Existing prior-preflight RPC definitions were copied into the preparation directory as `prior-production-rpc-definitions.sql`, mode 0600, SHA-256 `d32439ee085c7b6dc97fd515e70da255a6bc5910438a6696caedcede320805ab`. This is prior RPC evidence, not a current refreshed export or complete database recovery point.

**Status remains BLOCKED by direct PostgreSQL authentication.** Relevant connection environment variables, ~/.pgpass, ~/.pg_service.conf and local linked-project connection metadata were absent. API access does not establish pg_dump access. No password reset, production login-role creation or permission modification was attempted. Private existing database credentials/connection configuration are required before the consistent pg_dump and isolated restore can proceed; do not send secrets in chat.

All subsequent sensitive temporary files, dumps, database/WAL files and restore artifacts must remain under the approved restricted FileVault-backed directory. Do not place restored production data in existing Docker volumes or writable layers. Verify any isolated target's bind mounts, networking and write paths before restoring. There is no backup timestamp, dump checksum or restore result yet. Earlier encrypted-image instructions are historical and no longer required by the user.

Investigation date: October 10, 2026, America/Chicago. **Status: BLOCKED.** No production backup has been created and no production-data restore has been attempted. Rolando approved `/Users/rolandobernal/Documents/LLT-Secure-Backups.dmg`: AES-256 encrypted APFS, a unique randomly generated password of at least 24 characters held privately in his password manager, no Keychain saving, account-restricted access, dated backup folders and unmounting on completion. Filesystem inspection confirmed that the image does not yet exist. Awaiting private creation and mounting through Disk Utility; approval of a location is not verification of encryption. No production migration, data modification, deployment, commit or push was performed during this investigation.

## Environment and capabilities

The October 9 live preflight identified Supabase `lee-lee-tracker`, project `ujbfqcggtuhagsgwcocr`, region ca-central-1, PostgreSQL 17.6. Its backup listing returned no listed points and PITR disabled; `walg_enabled:true` does not prove an accessible recovery point. These findings must be refreshed before backup creation.

Supabase CLI 2.114.0 and existing Docker PostgreSQL `pg_dump`/`pg_restore` 17.6 are available. Host PostgreSQL client executables were not found on PATH. The existing curated development database must not be overwritten. A separate restore environment with no published ports or external application access remains to be prepared and verified; existing tooling alone does not prove isolation.

Management API catalog-query access was demonstrated in the prior preflight. A credential-safe, read-only direct PostgreSQL connection suitable for pg_dump has **not** been established. Do not infer dump access from API access, reset a database password, create a production login role, change permissions, or print connection credentials.

[Supabase documents logical exports through its CLI, including for Free projects](https://supabase.com/docs/guides/platform/backups). A subscription upgrade is not established as necessary. Provider daily backups, downloadable logical exports and PITR are separate capabilities; a logical export is a point-in-time snapshot, not continuous recovery. No managed backup retention or download availability has been verified for this project.

[PostgreSQL pg_dump supports consistent backups and custom archives](https://www.postgresql.org/docs/17/app-pgdump.html). A single custom-format database dump is the provisional method, subject to connection, scope and storage verification. Independently timed schema/data exports must not be represented as one consistent snapshot. Snapshot-aligned comparison evidence must accompany the dump, rather than comparing live counts from unrelated times.

## Required scope and unresolved inventory

Application source identifies these eight LLT tables: `lee_lee_records`, `lee_lee_shared_settings`, `lee_lee_foods`, `lee_lee_saved_meals`, `lee_lee_settings_audit`, `llt_sensor_contexts`, `llt_sensor_cycles`, `llt_sensor_operations`. Backup coverage must include their complete persisted data, dependent schemas, constraints, indexes, sequences, triggers, functions/RPCs, ownership, grants and RLS policies. Include migration history as recovery evidence; its known omissions must not cause bulk migration replay.

Required RPC coverage includes record version updates, audited settings insert/update and append operations, sensor snapshot/mutation and their helper dependencies. Repository foreign keys reference `auth.users`; recovering public tables alone is insufficient. Complete live dependency inventory, Auth-managed data/objects, extension requirements, role memberships and grants remain unverified for the full recovery scope.

The inspected LLT sync modules contain no Storage API calls. This does not establish that production Storage is empty or irrelevant: inventory buckets/objects and dependencies before defining exclusions. Database dumps contain Storage metadata, not uploaded file contents. Secrets, provider service configuration and external assets require separately protected recovery arrangements. Role passwords/provider-managed roles must not be assumed recoverable from a database archive. Follow the [Supabase CLI restoration guidance](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) for platform-specific components; default CLI exclusions must be audited against the actual scope.

## Backup and restore evidence

| Evidence | Result |
| --- | --- |
| Approved secure storage / encryption key arrangement | Approved encrypted image above; image absent, awaiting user creation and mounting |
| Backup timestamp, format, size, SHA-256 | Not available; no backup created |
| Verified direct production dump access | Pending |
| Isolated restore target and restore timestamp | Not established |
| Schema/data/security/RPC verification | Not performed on restored production backup |
| Auth/Storage/roles/extensions recovery | Unverified |
| Recovery gate | BLOCKED |

Only proceed after verifying restricted access, encryption at rest and temporary-file protection for the selected destination. Keep all backup contents and secrets outside Git and reports. Protect any restore volume to the same standard. Capture sanitized execution status without medical rows or credential-bearing logs.

No production dump, temporary medical-data file or restore artifact has been created. All future disk-backed sensitive temporary files, database files/WAL, restore logs and dump artifacts must reside inside the verified encrypted image. Do not use ordinary temporary directories, existing Docker writable layers or Docker volumes for restored production data. Verify container mounts and all database write paths before restoration; use a fresh network-isolated target, preserve existing development data, and stop its processes before unmounting. Never capture the private password prompt through automation or logs. Verify AES-256/image identity, APFS format, ownership, ACLs and mount permissions without requesting the password. Unmount after completion or safely after a failure.

## Conditional emergency recovery procedure

This is a preparation checklist, **not a tested recovery runbook or authorization to restore production**.

1. Obtain the protected backup manifest; verify project identity, snapshot time, scope and encrypted artifact SHA-256 before decrypting with separately protected key access. Reject mismatches.
2. Obtain explicit recovery authorization and credential access without exposing secrets. Preserve newer records, receipts and metadata before any recovery decision.
3. Verify a fresh isolated target's host/database identity and absence of valuable data. Keep it inaccessible to external applications. Never direct test pg_restore at production or the existing development database.
4. Provision compatible PostgreSQL/extensions and reviewed Supabase role/Auth prerequisites. Audit archive contents; restore required schema, data, ownership, grants, policies and functions with error-stop behavior. Resolve platform dependencies without weakening RLS or suppressing unexplained errors.
5. Compare snapshot-aligned counts and private fingerprints for every critical table; verify UUIDs, business timestamps, revisions, immutable receipts and current pointers. Verify constraints, indexes, sequences, triggers and RPC definitions.
6. Functionally verify unauthenticated denial and account isolation using isolated synthetic identities. Verify deployed-version RPC behavior without displaying production medical records or making production writes. Preserve protected verification evidence and document exclusions.
7. Only classify VERIFIED after successful restore and sufficient coverage of the approved scope. Document repeatable commands after the actual method is established. Current investigation has not reached this stage.
8. Full database restoration, selective record recovery, application rollback and forward database repair are separate operations requiring their own reviewed decisions. Application rollback does not undo schema changes. Prefer forward repair for migration defects; do not default to dropping new metadata columns or discard post-backup data.

## Deployment reassessment

Migration `202610090001_add_llt_sensor_replacement_metadata.sql` was rehashed October 10 and remains `168466776824efe09abddf7b8d501a0105ff470e3b0fdf7a3720a51916343079`. Prior production compatibility/security findings are retained, not presented as newly refreshed. No application code changed during this backup investigation.

October 9 validation remains: 545 unit passes; database checks passed; all 130 issue-specific browser scenarios passed; broad suite 560 passed and 28 failed, with all 28 reproduced on unchanged main. The full browser suite is not green. Physical iPhone acceptance was previously confirmed by Rolando.

Recommendation: keep production approval blocked. Required next step is private creation and mounting of the approved encrypted image; then verify storage, establish read-only dump access, complete live scope/dependency inventory, create the consistent backup and perform the protected isolated restore and verification. Do not request production migration/deployment approval until recovery requirements are satisfied.
