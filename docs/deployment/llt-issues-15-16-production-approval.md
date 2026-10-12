# LLT Issues #15 and #16 — production approval package

## Current release handoff — October 12, 2026

Rolando authorized ONLY the exact 23-file allowlist below for one feature-branch commit, push and PR. The earlier stop for unrelated work is resolved by that explicit authorization. Unrelated work remains untouched. This handoff does not authorize merging or deployment.

Production migration/preflight/postflight, private targeted sensor exports and existing-client physical-iPhone/RPC compatibility are complete as confirmed by Rolando. Do not rerun production migration SQL. The migration hash and all 13 candidate hashes remain unchanged. Historical incomplete/blocked statuses below describe prior preparation, not the current authorized PR gate. Full database backup/isolated restore remains unverified and was explicitly replaced with accepted targeted precautions.

Fresh release validation:

- JavaScript syntax and diff checks passed; 545 unit tests passed (October 12 permitted run).
- Desktop/mobile focused LLT browser suite: **130 passed, 0 failed**, 2.7 minutes. Command: `LANDOS_WORLD_SMOKE_BASE_URL=http://127.0.0.1:8000 npx playwright test tests/browser/llt-low-glucose.spec.js tests/browser/llt-sensor-tracker.spec.js tests/browser/llt-sensor-history.spec.js tests/browser/llt-my-meals-action-row.spec.js tests/browser/llt-today-carb-breakdown.spec.js --workers=1 --output=/private/tmp/llt-scoped-release-browser-final-artifacts`.
- `npm run test:llt:sensor-metadata-db`: **19 passed**, plus **38 passed** in its embedded existing sensor SQL suite.
- `LLT_LOCAL_LOW_GLUCOSE_DB_TEST=1 node --test tests/llt-low-glucose-database.test.js`: **82 passed**.
- `LLT_LOCAL_SENSOR_DB_TEST=1 node --test tests/llt-sensor-local-api.test.js`: **1 passed**. All database runs used local synthetic/disposable environments, not production.
- GitHub Pages runtime artifact rehearsal passed; its base-SHA metadata was for rehearsal only and was not deployed.
- All 75 non-allowlisted changed/untracked file fingerprints matched the captured pre-release baseline.

Browser setup diagnostics: the retained LAN endpoint was unreachable, and the generic local server was unsuitable for the neighboring local-device specs. The runner was stopped, the trusted local-device server restored at localhost port 8000, and all 130 scenarios rerun successfully without code/assertion changes. Superseded environment failures are not counted as passing runs. Preview retained: http://127.0.0.1:8000/#/lee-lees-tracker, HTTP 200; production sync/PWA disabled. No new regression was found.

The broader October 9 suite remains historical: **560 passed, 28 failed**, all 28 reproduced on unchanged main. It was not rerun or represented as green for this handoff. Fresh relevant browser/database release checks above have no failures/skips. After Rolando reviews and merges the PR, verify Actions and served metadata/assets for the exact merge SHA, then obtain updated-app physical-iPhone production acceptance. No production deployment success is claimed here.

## October 12 release inspection — stopped before commit/push

Rolando confirmed production preflight, targeted exports, migration execution, postflight and existing-client physical-iPhone/RPC compatibility checks completed successfully. These are user-confirmed results; production SQL was not rerun. Local migration still matches reviewed SHA-256 `168466776824efe09abddf7b8d501a0105ff470e3b0fdf7a3720a51916343079`. All 13 source/test/migration candidate manifest hashes match.

Fetched origin/main: HEAD, local main and origin/main all `5d49f0c140f78a378e571958550c62c899e5096d`; branch `feature/llt-issues-15-16`; no existing PR found. October 12 JavaScript syntax and diff checks passed. Permitted regression run: 545 passed, 0 failed, 0 skipped. Initial sandbox run could not bind test servers (EPERM), so its result was superseded by the successful permitted run. Browser/database release reruns remain to be completed before release handoff; October 9 evidence above is historical.

The working tree includes unrelated Issue #14.5 report changes, iMT/VFGT/light-mode documentation, insulin/settings/diagnostic reports, local Supabase configuration and death-on-notecards. Per Rolando's explicit stop condition, nothing was staged, committed or pushed. They remain untouched. No Issue #12 change was identified in the intended runtime diff; the diabetes tracker diff is confined to Low Glucose disclosure and the approved label. Only the reviewed metadata migration belongs to this release. No production deployment is claimed.

Proposed exact 23-file commit allowlist, subject to approval to proceed despite the preserved unrelated files:

```text
css/lee-lee-diabetes.css
js/lee-lee-dexcom-sensor.js
js/lee-lee-diabetes-tracker.js
js/lee-lee-sensor-sync.js
js/lee-lee-sensor-ui.js
package.json
tests/llt-sensor-application.test.js
tests/llt-sensor-database.test.js
tests/llt-sensor-metadata-database.test.js
tests/browser/llt-low-glucose.spec.js
tests/browser/llt-sensor-tracker.spec.js
tests/browser/llt-sensor-history.spec.js
supabase/migrations/202610090001_add_llt_sensor_replacement_metadata.sql
LLT_ISSUE_15_SENSOR_HISTORY_REPORT.md
LLT_ISSUE_16_LOW_GLUCOSE_CARD_REPORT.md
docs/deployment/llt-issues-15-16-production-approval.md
docs/deployment/llt-issues-15-16-backup-restore-verification.md
docs/deployment/llt-issues-15-16-candidate-sha256.txt
docs/deployment/llt-issues-15-16-preflight.sql
docs/deployment/llt-issues-15-16-post-migration-verification.sql
docs/deployment/llt-issues-15-16-sql-editor-preflight.sql
docs/deployment/llt-issues-15-16-sql-editor-postflight.sql
docs/deployment/llt-issues-15-16-sql-editor-guide.md
```

Before committing, reconcile historical report status with confirmed database completion and new release evidence, finish relevant validation and review the complete staged allowlist. The established repository workflow still requires feature-branch PR review and Rolando's merge before GitHub Actions deploys Pages; this request does not explicitly authorize a review-bypass exception.

**Current workflow update — October 11:** Rolando explicitly discontinued pg_dump/authentication/full isolated-restore preparation for this deployment and selected manual SQL Editor review with targeted exports and preserved RPC definitions, accepting its narrower protection. The historical recovery blockers below no longer mandate that superseded process. Current gate is **AWAITING USER PREFLIGHT RESULTS**, not migration authorization. See [manual SQL Editor guide](llt-issues-15-16-sql-editor-guide.md) and its dedicated read-only preflight/postflight scripts. No full backup or restore is claimed verified. No production SQL, commit, push or deployment occurred in this preparation. The exact migration remains unchanged.

Prepared October 9, 2026. **BLOCKED: recovery readiness is not established. No production migration, commit, push, merge or publication occurred.** Local physical iPhone acceptance was confirmed by Rolando in the deployment-preparation attachment; production acceptance is pending.

## Repository and scope

Branch: `feature/llt-issues-15-16`. HEAD, local main and fetched origin/main: `5d49f0c140f78a378e571958550c62c899e5096d`. No feature commits or existing PR. Candidate is uncommitted; the runtime/test/migration SHA-256 manifest is `llt-issues-15-16-candidate-sha256.txt`. Recheck every hash before execution and invalidate validation if source changes. A final deployed SHA cannot exist before the authorized commit and reviewed merge.

Include only:

- Runtime: `js/lee-lee-dexcom-sensor.js`, `js/lee-lee-sensor-sync.js`, `js/lee-lee-sensor-ui.js`, `js/lee-lee-diabetes-tracker.js`.
- CSS: `css/lee-lee-diabetes.css`.
- Tests/tooling: `package.json`, `tests/llt-sensor-application.test.js`, `tests/llt-sensor-database.test.js`, `tests/llt-sensor-metadata-database.test.js`, `tests/browser/llt-sensor-tracker.spec.js`, `tests/browser/llt-sensor-history.spec.js`, `tests/browser/llt-low-glucose.spec.js`.
- SQL: `supabase/migrations/202610090001_add_llt_sensor_replacement_metadata.sql`.
- Reports: `LLT_ISSUE_15_SENSOR_HISTORY_REPORT.md`, `LLT_ISSUE_16_LOW_GLUCOSE_CARD_REPORT.md`.
- Preparation documentation: this package, the candidate manifest and the two adjacent read-only verification SQL files.

Exclude the pre-existing Issue #14.5 report edits, iMT/VFGT and light-mode shipping documentation, insulin/settings/diagnostic/VFGT reports, `death-on-notecards/`, prior sensor shipping/review SQL documentation, untracked Supabase local configuration and all private test/build artifacts. They are identified pre-existing unrelated work, preserved untouched. No Issue #12 code changes. No insulin, Low Glucose recovery or Dexcom lifecycle arithmetic changed. Full intended runtime diff reviewed against the base.

## Exact migration

File: `202610090001_add_llt_sensor_replacement_metadata.sql`.

SHA-256: `168466776824efe09abddf7b8d501a0105ff470e3b0fdf7a3720a51916343079`.

Transactional additive nullable TEXT reason, TEXT notes and BOOLEAN requested columns; no defaults, backfill, historical timestamp rewrites or deletion. Twelve allowed reason IDs, PostgreSQL 2,000-character limit, explicit FALSE retained separately from NULL. Existing operation constraints add `update_metadata` and raise bounded JSON request size to 16,384 bytes to accommodate Unicode notes.

The one existing mutation RPC changes from ten to twelve parameters with two optional trailing fields. The old signature is removed with RESTRICT; one overload remains. Existing positional/named requests and immutable receipt retries remain compatible. Targeted metadata writes require an owned closed cycle, context lock, revision and current-pointer checks; timestamps/IDs/pointers remain unchanged. Replacement metadata applies atomically to the preceding closed cycle at the new sensor start. Start correction and Undo behavior retained. NULL projection preserves legacy same-revision snapshots; capability is outside the snapshot. Existing auth.uid checks, postgres ownership, empty search_path, RPC-only writes and authenticated-only mutation grants remain. No unrelated tables or RLS policies changed.

Local tests demonstrate currently deployed client call compatibility during database-first transition. Production inspection confirms all three live RPC bodies match the reviewed prerequisite bodies. No new metadata writes are enabled until authoritative capability is advertised.

## Actual production inspection

Target: Supabase `lee-lee-tracker`, reference `ujbfqcggtuhagsgwcocr`, ca-central-1, ACTIVE_HEALTHY; configured application URL uses this reference. Read-only catalog/aggregate queries executed through the authenticated Management API; no patient rows exported and no migration SQL executed.

Live PostgreSQL 17.6, database postgres, inspection actor postgres. Sensor tables have the expected columns including nullable sensor_code, and none of the three proposed metadata columns. Existing three RPCs have expected owner/search_path/grants. get/mutate are security definer; internal snapshot helper is not. Each sensor table has RLS enabled and an authenticated SELECT-own policy; authenticated users have SELECT only. No user triggers or dependent objects on the mutation function were found. Existing service_role REFERENCES/TRIGGER/TRUNCATE grants are baseline privileges, not introduced or broadened by this migration. The migration does not change them.

Migration ledger reports only 202608030001, 202608040001, 202608140001, 202608150001, 202608150002, 202608310001. Installed sensor RPCs nevertheless match `202610030001` / `202610060002` source prerequisites. **Do not use bulk `supabase db push`: it could replay unrelated migrations absent from this ledger.** Execute only the exact reviewed transaction after approval and readiness. Record its identifier/hash/execution evidence separately; any migration-ledger repair is a distinct reviewed task.

Private evidence: `/private/tmp/llt-production-catalog-evidence.json`, `/private/tmp/llt-deploy-migration-history.json`, `/private/tmp/llt-production-prior-rpc-definitions.sql`. Aggregate counts/fingerprints are available for comparison across a quiet migration window; concurrent legitimate writes must be distinguished from migration effects. Refresh evidence immediately before execution.

## Backup blocker and recovery

### PRODUCTION BACKUP AND RESTORE VERIFICATION

Latest October 11 retry: downloaded Supabase CA allowed explicit verify-full TLS to progress to authentication. The pooler rejected the password retrieved from ~/.pgpass (client exit 2). **Gate now BLOCKED by authentication.** No SQL, dump or restore ran. User must privately verify credentials before retrying; no reset or security downgrade was performed.

October 11 authentication update: user privately configured ~/.pgpass; ownership and mode 0600 verified. The initial PostgreSQL 17.6 connection with sslmode=verify-full and the available system CA bundle failed certificate verification before SQL execution. **Backup/restore and deployment remain BLOCKED by TLS trust configuration.** No TLS downgrade, backup export or production SQL execution was performed. Next prerequisite is an authoritative trusted CA configuration and successful hostname/certificate verification.

Latest authorization supersedes the disk-image plan: FileVault was verified ON using fdesetup and startup data-volume diskutil inspection. Approved `/Users/rolandobernal/Documents/LLT-Backups/` and its dated preparation directory now exist with account ownership and mode 0700. Prior RPC definitions are preserved there at mode 0600; details/checksum are in the recovery report. **Gate remains BLOCKED:** no configured direct PostgreSQL authentication was found, no pg_dump was created and no restore was performed. Await private connection configuration without password reset, production role creation or secret disclosure. No migration, commit, push or deployment occurred.

October 10, 2026 investigation: **BLOCKED**. See [backup/restore verification record](llt-issues-15-16-backup-restore-verification.md). Existing PostgreSQL 17.6 tools support a provisional logical-backup approach; no subscription upgrade is established as necessary. Secure storage and encryption/key arrangements await Rolando's selection. No backup timestamp/checksum or restore result exists. Direct dump access, full LLT/Auth/Storage dependency inventory and a protected isolated restore remain to be verified. Required scope includes all eight LLT application tables and their security/function dependencies, not only sensors. The linked record contains the conditional emergency recovery procedure and remaining limitations. Production migration/deployment approval remains withheld.

Migration SHA-256 was rechecked October 10 and remains unchanged. Application validation below was performed October 9; it was not rerun or relabeled as current-day validation during this documentation-only investigation.

Storage approval update: Rolando selected `/Users/rolandobernal/Documents/LLT-Secure-Backups.dmg`, AES-256 encrypted APFS, with a private password-manager-held random password (24+ characters), no Keychain saving and account-restricted access. The image does not exist yet. Backup/restore remains BLOCKED pending private creation/mounting and verification. All sensitive temporary files and restore database artifacts must stay on the verified encrypted volume; ordinary temporary directories and unencrypted Docker storage are prohibited. No backup or restore has been attempted.

Authenticated `supabase backups list --project-ref ujbfqcggtuhagsgwcocr --output json` returned backups:null, physical_backup_data:{}, pitr_enabled:false, walg_enabled:true. WAL-G being enabled does not establish an accessible/restorable recovery point. No restore test or verified existing recovery point is available. **Do not execute the migration even if approval arrives until this blocker is resolved.** Requested secure backup date/location/restore evidence from Rolando. No recovery credentials or patient data belong in repository reports.

Required before execution: establish a secure restorable production backup covering sensor data, contexts, immutable receipts, schema/functions/policies/grants and required ownership/auth dependencies, or a verified managed recovery point. Record timestamp, exact target, secure location, integrity evidence and restore verification in an isolated authorized environment. Do not send credentials or raw backup contents into chat. A schema-only catalog export is not a data backup.

Recovery procedure:

1. Stop before any app merge/publication if backup, migration or verification fails. Do not manually dispatch Pages.
2. SQL errors within the migration transaction must abort/ROLLBACK; confirm connection completion before reporting success. If response is lost, inspect catalogs/fingerprints first; do not infer failure or start unrelated changes.
3. Compare pre/post column definitions, RPC signatures/bodies/grants, RLS/policies, current-pointer invariants, counts and old-field fingerprints. The migration itself must not change existing business/audit timestamps or receipts. Concurrent user writes require a fresh quiet baseline or explicit reconciliation of legitimate changes.
4. If database succeeds but app publication fails, retain the upgraded backward-compatible RPC/schema and the prior application. Retry the approved application release after diagnosis. Do not drop new columns.
5. Prefer forward repair for a database defect. Before any corrective SQL, preserve a new recovery point including all metadata and receipts written since migration. Separate approval is required for corrective SQL or managed restore.
6. Previous production application revision is `5d49f0c140f78a378e571958550c62c899e5096d`, release `2026-10-07-30`. Restore its runtime behavior through a dedicated revert/fix PR reviewed and merged by Rolando; existing Actions deploys the new rollback commit. Never reset/force-push main or manually replace Pages. Keep upgraded DB unless a separately reviewed compatibility repair is necessary.
7. Do not blindly reinstall previous RPC definitions: overlapping defaulted signatures can become ambiguous, and old projection logic against extended tables can change equal-revision snapshot shape. Exported definitions are evidence, not an executable universal rollback.
8. Leave localStorage, IndexedDB, sync queues, medical records and food/settings data untouched. Normal Application Status updater handles cache adoption. A database restore can lose post-backup data; preserve/reconcile newer metadata before any authorized restoration.

Verification queries: adjacent `llt-issues-15-16-preflight.sql` and `llt-issues-15-16-post-migration-verification.sql` are read-only. CLI displays the last query result, so run individual post-verification SELECTs separately when collecting all results. False/null persistence is proven by isolated integration tests; production verification will not create synthetic sensor/patient records.

## Fresh validation

Candidate runtime/test/migration hashes are unchanged since these fresh runs. No tests were weakened.

| Command / coverage | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| npm run check:js | syntax check passed | 0 | 0 |
| npm test | 545 | 0 | 0 |
| npm run test:llt:sensor-metadata-db | 19 | 0 | 0 |
| Existing sensor SQL regressions invoked inside metadata harness | 38 | 0 | 0 |
| LLT_LOCAL_LOW_GLUCOSE_DB_TEST=1 node --test tests/llt-low-glucose-database.test.js | 82 | 0 | 0 |
| LLT_LOCAL_SENSOR_DB_TEST=1 node --test tests/llt-sensor-local-api.test.js | 1 | 0 | 0 |
| Device-specific browser group (three specs, desktop/mobile) | 82 | 0 | 0 |
| Complete normal-server browser group (other sixteen specs) | 478 | 28 | 0 |
| git diff --check | passed | 0 | 0 |

Unit suite includes 63 sensor and 52 Low Glucose cases. Metadata harness uses fresh disposable databases and disposable PostgREST; no production/local-service schema installation. Local Auth/REST/realtime regression uses synthetic users against the existing loopback curated service, exercising legacy transport rather than migrated-service metadata realtime. Its missing local config was recovered with read-only local container status; final run passed. The initial sandbox unit invocation hit listen EPERM; the permitted rerun passed.

The 588 browser scenarios require two environments: Low Glucose, Today-carb and saved-meal specs require the port-8000 device preview; other specs require the ordinary local server. A mixed-server attempt and a normal-server run contaminated by the device server's shared generated .local metadata were stopped and superseded. No assertions, snapshots or test cases were omitted from final coverage. The final normal-server group uses a separate source copy whose candidate hashes match the workspace, with separate generated metadata and shared read-only Git object history for existing git-show fixtures. An initial archive-only attempt lacked the Git history required by those fixtures and was superseded before tests ran.

Device group command:
```sh
LANDOS_WORLD_SMOKE_BASE_URL=http://10.0.0.160:8000 npx playwright test tests/browser/llt-low-glucose.spec.js tests/browser/llt-my-meals-action-row.spec.js tests/browser/llt-today-carb-breakdown.spec.js --workers=1 --output=/private/tmp/llt-deploy-device-browser-artifacts
```

The full normal-server command expands every tests/browser/*.spec.js except those exact three files, with two workers and the isolated runner's recorded port in /private/tmp/llt-deploy-broad-port.txt; final command/file list is recorded below. Together the groups cover every browser file/project. The unchanged-main baseline uses the exact same bytes of landos-world-smoke.spec.js, authentication-preview.spec.js and vfgt-recovery.spec.js, with its own generated metadata.

Private logs: /private/tmp/llt-deploy-syntax.log, llt-deploy-unit.log, llt-deploy-db.log, llt-deploy-low-db.log, llt-deploy-local-api-final.log, llt-deploy-device-browser.log, llt-deploy-broad-final.log, llt-deploy-baseline-smoke.log, llt-deploy-baseline-other.log. Final broad group completed in 12.2 minutes: 478 passed, 28 failed, 0 skipped. Combined with the complete device group: **588 scenarios, 560 passed, 28 failed, 0 skipped**. All 130 issue-specific scenarios passed (48 sensor + 82 device-specific LLT). The complete suite is not green.

Every one of the 28 candidate failures matches the same project/file/line/title failure on unchanged main: main smoke baseline 206 passed/26 failed (232 total), plus Auth Preview/VFGT baseline 14 passed/2 failed (16 total). No candidate-only failure found. Auth and appearance failures from the contaminated-server run were eliminated in the final isolated run. Existing failures include VFGT future scheduling/landscape/recovery, LLT print media, older Bedtime/Foods/Meals/calculator/save/delete/sync/temporary-adjustment workflows. They remain unresolved baseline failures and must be visible in release review; no unrelated application/test fixes were introduced.

Production execution is blocked by the unverified recovery point. Full-suite baseline failures are an additional known limitation; issue-specific regression checks passed. No production acceptance claim is made.

Final normal-server command, run from the hash-verified /private/tmp/llt-deploy-candidate copy:
```sh
LANDOS_WORLD_SMOKE_PORT=58772 LANDOS_WORLD_SMOKE_BASE_URL=http://127.0.0.1:58772 node_modules/.bin/playwright test tests/browser/authentication-preview.spec.js tests/browser/imt-vfgt-post-release-polish.spec.js tests/browser/landos-world-smoke.spec.js tests/browser/light-mode-regression.spec.js tests/browser/llt-sensor-history.spec.js tests/browser/llt-sensor-tracker.spec.js tests/browser/local-device-development.spec.js tests/browser/lwdc-display-consistency.spec.js tests/browser/pwa-real-service-worker.spec.js tests/browser/pwa-release-updates.spec.js tests/browser/vfgt-audio-feedback.spec.js tests/browser/vfgt-landing-card.spec.js tests/browser/vfgt-match-updates.spec.js tests/browser/vfgt-phase-confirmation.spec.js tests/browser/vfgt-playoffs.spec.js tests/browser/vfgt-recovery.spec.js --workers=2 --output=/private/tmp/llt-deploy-broad-final-artifacts
```

## Deployment plan after readiness and explicit approval

1. Reverify project/reference, schema/security/dependencies, backup/restore evidence and exact migration/candidate hashes. If remote main or source changed, reconcile before continuing.
2. Obtain explicit approval for the exact SQL and planned application release. Apply only this migration to confirmed production as postgres, with failure-aborting execution; do not bulk push migrations or touch medical data.
3. Collect all post-migration verification results. Require one twelve-argument RPC, expected optional defaults/security/grants, metadata columns/constraints, unchanged old-field fingerprints in a quiet window, intact RLS/policies/receipts and valid pointers. Inspect an authenticated existing sensor read without creating or changing records. If any check fails, stop before app release.
4. Only after successful DB verification, stage the explicit approved files, review full/staged diffs and diff --check, commit on feature/llt-issues-15-16, push that branch and open PR targeting main. No direct-to-main push or automatic merge. Rolando reviews and merges under AGENTS.md; that merge is the production publication gate.
5. GitHub Pages configuration is workflow-based. `.github/workflows/pages.yml` builds on main push using `node scripts/build-pages.mjs`, uploads `dist-pages`, and deploys via actions/deploy-pages. Runtime allowlist includes all four changed JS files and CSS. SQL/tests/docs/reports/dev-server scripts are excluded from the artifact.
6. Build injects full merge SHA into SW_VERSION and all release metadata; do not hand-edit the SHA placeholder or invent a cache version. Current production worker SW_VERSION and served release metadata were reverified as the full base SHA and release 2026-10-07-30; remote main stayed at the same SHA. Existing precache includes sensor modules; no new runtime assets require a manifest entry. A local build rehearsal produced 67 files with no tests/migrations/reports/dev scripts. Its base-SHA metadata is only a rehearsal identity for uncommitted source; never publish it. Real production artifact must be freshly generated by Actions from the approved merge SHA.
7. Verify successful workflow for merge SHA, served deployment-version.json, embedded metadata, service-worker commit/cache identity and exact JS/CSS contents. Check updater via Settings → Application Status; no forced cache clearing/reinstall. Normal service-worker lifecycle preserves user storage. Existing tests cover updater/offline paths; physical production offline acceptance remains separate.
8. Production URL: https://rolandobernal.github.io/landos-world/#/lee-lees-tracker. Safe smoke checks: existing sensor countdown/history/search/filter/pagination/details/legacy unknown metadata; existing Low Glucose More/Less Details, timeline/footer and Today/History consistency. Inspect console/network/auth/sync errors and assets. Do not start/replace/cancel sensors or fabricate medical events to smoke test. Persisted edits/cross-device synchronization require an explicitly authorized legitimate metadata edit; qualifying-recheck label uses automated coverage until a real appropriate workflow occurs.
9. Rolando performs physical iPhone production smoke acceptance. Ask for confirmation of history/records/details/search/filter, authorized metadata save/sync, Low Glucose disclosure/Today/History and no errors. Do not mark acceptance complete before confirmation. Update issue reports with actual migration identifier/date, merge SHA/deployment identity, verification/smoke evidence and user acceptance.

Expected UI changes: dedicated All Sensors history with search, six filters, Load More/details, optional replacement metadata and closed-only editing; compact Low Glucose cards with More/Less Details, nested timeline and Continue Monitoring wording. Clinical recovery thresholds/calculations and sensor 240h+12h lifecycle unchanged.

Preview retained: http://10.0.0.160:8000/#/lee-lees-tracker (HTTP 200 reverified after validation). This is an isolated local-device preview, not production.

## Approval gate

Not ready for execution while backup/recovery and final validation blockers remain. After resolving readiness, ask:

“Do you approve executing the reviewed Issue #15 migration against production Supabase, followed by deployment of Issues #15 and #16?”

Approval does not bypass unresolved readiness, branch protection, PR review or Rolando’s merge gate. No staging/commits/pushes, migration execution or publication in this preparation phase.
