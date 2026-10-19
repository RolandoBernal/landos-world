# À La Carte Apps — isolated launcher release candidate

2026-10-19. **READY TO SHIP for PR preparation and review.** Production deployment and installed-PWA acceptance have not occurred. This scoped assessment follows the latest FINAL LAUNCHER-ONLY RELEASE CANDIDATE instruction, which explicitly excludes historical LLT/VFGT/Food maintenance and supersedes the broader candidate's release gates for this task.

## Candidate and preservation

Worktree: `/private/tmp/lsw-launcher-release`.
Branch: `feature/lsw-a-la-carte-launcher-release`.
Base/HEAD: `89c81e3ab8cc7c7e3fb4ba556d083930d971af26`.
A fresh `git fetch origin main` succeeded; local main and origin/main matched before branch creation. Candidate changes remain uncommitted and the index is empty. No PR exists for this candidate. The future commit SHA must identify the actual candidate; the base SHA is not its release identity.

The original workspace remains on `feature/lsw-a-la-carte-phase-b`, with all entry file contents preserved. Its launcher implementation, LLT three-line `isOffline` correction, partial test-maintenance drafts, reports, DONC work, Supabase configuration and unrelated work are untouched. The candidate was copied selectively into a fresh main-based worktree; no reset, stash, clean or branch switch affected the original workspace. Runtime dependencies are reused through an ignored local node_modules directory, not included in the release.

## Exact commit scope: 11 files

| File | Purpose |
| --- | --- |
| `index.html` | Existing Settings → My Apps interface, filtered/ordered launcher, native controls and stable Sprints route entry |
| `css/digital-clock.css` | 39 additive, scoped My Apps layout/interaction lines; existing stylesheet prefix unchanged |
| `js/launcher-preferences.js` | Local versioned preference model/storage; visibility, ordering and presets |
| `js/sprints-app.js` | Necessary launcher routing integration: reuse the existing open action through a stable API and delegated click listener |
| `package.json` | Register launcher unit/syntax checks; no dependencies changed |
| `scripts/pages-runtime-allowlist.mjs` | Include the launcher module in the production artifact |
| `service-worker.js` | One additive launcher-module precache entry |
| `tests/launcher-preferences.test.js` | Launcher preference model/storage coverage |
| `tests/browser/launcher-preferences.spec.js` | Launcher, mobile/accessibility, storage, ordering, route and Sprints integration coverage |
| `tests/browser/pwa-real-service-worker.spec.js` | Real-worker launcher offline/cache coverage and isolated HTTP fixture state |
| `docs/architecture/lsw-a-la-carte-launcher-only-release-candidate.md` | Current approved behavior, exact scope, evidence and release procedure |

Excluded changes: `js/lee-lee-diabetes-tracker.js`; all changes to `tests/browser/landos-world-smoke.spec.js`, `local-device-development.spec.js`, `vfgt-playoffs.spec.js`, and `vfgt-recovery.spec.js`; all other LLT/VFGT/Food maintenance; previous assessment/triage documents; unrelated reports, DONC and Supabase changes. The candidate's tracked versions of those files are main's existing versions. The unchanged smoke suite is used selectively for route/shell integration without importing its maintenance drafts.

## Approved behavior

All eight existing app registry entries, icons, destinations and relative default order remain identical to main; three entries add Settings-only full labels. Supported apps are Weather, Digital Clock, Lee-Lee's Tracker, Violet Sprints, Violet Futbol Game Tracker, Road Bike Trip Checklist, iMaintenanceTotal and Death on Notecards. The DONC external destination is unchanged and is asserted without making an external navigation.

Missing preferences show all eight apps without writing defaults. The explicit Recommended preset chooses Digital Clock → Weather → Lee-Lee's Tracker. Show All restores visibility while preserving custom order. Hidden apps retain their ordering positions and remain directly routable. Preferences at `landos_world_my_apps_v1` use `{schemaVersion: 1, visibleAppIds, appOrder}`, stay in this origin/browser's localStorage and do not authorize access or synchronize through Supabase. Same-browser tabs converge through storage events; independent browser contexts retain independent preferences. Corrupt, unavailable and future-schema storage paths retain safe access and feedback.

My Apps retains the approved single row: drag handle, icon, full name, visibility control, Move Up and Move Down. Handle-only pointer drag, cancellation, edge scrolling, native keyboard controls, focus, announcements and 44px touch targets remain covered. Local physical-iPhone approval for Phases B/C/C.1 remains accepted; installed production-PWA acceptance is distinct.

### Candidate-specific routing correction

The first isolated expanded route test found that hiding Sprints removed `#open-sprints`, while main's route handler depended on clicking that launcher button. Re-rendering visible cards also replaced the node whose listener Sprints attached at startup. This is a genuine launcher integration regression, not an unrelated baseline repair.

The candidate extracts the existing Sprints open action unchanged into `openSprints()`, exposes it as `VioletSprints.open`, delegates the launcher click at document level and invokes that action directly from the shell route. Timer algorithms, saved-workout contracts, storage keys and restore semantics are unchanged. Tests now exercise hidden direct routes in all four browser projects and Sprints entry after Recommended/Show All, hiding and reload. Existing Sprints unit coverage also passes. The initial diagnostic run had two Chromium and two WebKit failures in this newly added route test; final corrected runs are separately identified below.

## Fresh validation against this worktree

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Launcher: desktop Chromium + Pixel 5 | 56 | 0 | 0 |
| Launcher: desktop Safari + iPhone 13 WebKit | 54 | 0 | 0 |
| Real-worker/cache/offline + deployed-update UI: Chromium/mobile | 10 | 0 | 0 |
| Real-worker/cache/offline + deployed-update UI: WebKit/iPhone | 10 | 0 | 0 |
| Unchanged main route/shell smoke cases: Chromium/mobile | 28 | 0 | 0 |
| Unit/shared-infrastructure suite | 569 | 0 | 0 |

Total selected browser cases: **158 passed, zero failed, zero skipped**, with no retries/flaky outcomes. WebKit selection excludes the single Chromium DevTools Protocol touch-dispatch case in each WebKit project because that protocol is Chromium-only. Both Chromium projects execute it successfully; WebKit executes the applicable pointer, mobile geometry, focus, cancellation, scrolling and neighboring-control coverage. This is an applicability selection, not a test skip or a claim that WebKit ran CDP.

Syntax (`npm run check:js`) and `git diff --check` pass. The production Pages builder passes and includes the new module. Built launcher, Sprints, LLT, sync and CSS asset bytes were compared with source. The build uses synthetic fixture version `2026-10-19-999` and the base SHA solely for validation: it is not a committed/deployed candidate or production version. The approved GitHub Actions workflow must later generate canonical metadata and full-SHA worker identity for the actual merged commit.

The offline fixture now makes its HTTP origin unreachable by destroying connections, instead of using Playwright's WebKit context-offline emulation that previously caused an internal browser reload error. It still uses the actual built service worker. The fixture isolates the existing loopback-only PWA-manager development guard; deployed guard policy is unchanged. All original cache identities, retained cache entries, asset body digests, offline visibility/order persistence and hidden-child direct-route assertions remain. The full PWA/update set now passes in both engines; this is fresh automated evidence, not installed-iPhone acceptance.

### Reproduction and evidence

Run from the candidate worktree:

```sh
LANDOS_WORLD_SMOKE_PORT=8030 npx playwright test tests/browser/launcher-preferences.spec.js tests/browser/pwa-real-service-worker.spec.js tests/browser/pwa-release-updates.spec.js
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/lsw-c-browsers LANDOS_WORLD_SMOKE_PORT=8031 npx playwright test --config=/private/tmp/lsw-launcher-release-webkit.config.mjs tests/browser/launcher-preferences.spec.js tests/browser/pwa-real-service-worker.spec.js tests/browser/pwa-release-updates.spec.js --grep-invert 'touch handle drag and natural row scrolling'
LANDOS_WORLD_SMOKE_PORT=8032 npx playwright test tests/browser/landos-world-smoke.spec.js --grep 'route renders its first screen|launcher opens every local app route|appearance setting reflects|LsW settings cog|weather launcher card|Digital Clock launcher'
npm test
npm run check:js
```

The temporary WebKit config imports this candidate's Playwright config, sets this worktree's test/server directories, and selects Desktop Safari/iPhone 13; it introduces no runtime change. Logs: `/private/tmp/lsw-launcher-only-chromium-final.log`, `lsw-launcher-only-webkit-final.log`, `lsw-launcher-only-routing.log`, `lsw-launcher-only-units-final.log`, `lsw-launcher-only-syntax-final.log`, and `lsw-launcher-only-build-final.log`. Structured browser results: `/private/tmp/lsw-launcher-only-results.json`. Isolation/build/fingerprint inventories are retained under the same temporary prefix. These are local review artifacts, not production evidence.

The isolated local preview is `http://127.0.0.1:8033/#/settings`; it does not replace the user's original preview. Default preview port 8765 was occupied and was left alone.

## Isolation and existing baseline disposition

Every tracked file outside the exact scope matches main. In particular, every LLT JS module, clinical calculation, shared-settings/sync module, Supabase migration, `js/pwa-manager.js`, build-metadata module and Pages builder is byte-identical to main. LLT/app theme styles and untouched test suites are unchanged. No database migration, medical-data migration, storage reset, queue rewrite, cache-policy change or Supabase synchronization is introduced. The existing default LLT startup behavior is retained, including its known baseline defects; this release does not certify unrelated clinical workflows.

The service-worker source diff is exactly the new `./js/launcher-preferences.js` precache entry. Existing update strategy, network-only `deployment-version.json`, cache management and canonical full-build identity are preserved. The normal builder regenerates deployment identity; no manual SW_VERSION bump or release metadata was introduced.

The prior combined-workspace report's 64 baseline failures (50 previously nonblocking, 12 blocked coverage cases and two visual cases) remain historical findings. No full-suite rerun or repair is claimed here. Some drafts in the original workspace subsequently passed targeted checks; none of those maintenance changes were imported. Both visual-contract cases concern the LLT Carb Calculator item editor's form-to-footer gap, not My Apps. LLT runtime/styles/calculator and relevant shared styles are unchanged; My Apps selectors are scoped to the new UI. Those cases do not validate or block this isolated change's approved launcher layout.

The known LLT migration-prompt `isOffline` fix remains preserved only in the original development workspace. Launcher entry, visibility, preference persistence and routing tests pass without it. No launcher code depends on that correction. Excluding it retains main's existing defect rather than removing a deployed fix.

Production's October 19 pending shared-settings write, NOT VERIFIED state and withheld suggested doses remain **unresolved**. This task neither accessed production nor diagnosed its root cause. This isolated release changes no relevant LLT/shared-settings code or data. Per the latest instruction, restoring production sync health is not a prerequisite for this scoped release; post-deployment comparison must verify no additional regression without claiming the existing issue fixed.

## Release readiness and execution boundary

Launcher function, persistence/order, affected routes, mobile/accessibility automation, shared infrastructure, PWA/update/offline, source isolation, syntax and build: **PASS for the local candidate**. Production deployment and installed-PWA acceptance: **PENDING**. Readiness is for the normal reviewed release workflow, not permission to merge or manually deploy.

Proposed commit: `feat: personalize launcher app visibility and ordering` containing only the 11 files above. Before staging after authorization, re-fetch main, confirm branch/base and review the complete diff plus all new files. If the base has advanced materially, reconcile and rerun affected checks before proceeding. Do not commit the dependency links, ignored .local files or temporary validation artifacts.

1. Obtain explicit authorization to stage these exact files, commit this candidate, push `feature/lsw-a-la-carte-launcher-release`, and open its PR to main. Review full and staged diff, exact file inventory and whitespace checks before commit.
2. Push only this branch, create the review PR and attach it to the chat. Include scope, results, known baseline limitations, preservation and rollback details. Stop for Rolando's review. Nothing in this task authorizes a merge or direct-to-main push.
3. Rolando merges the approved PR. The existing GitHub Actions Pages workflow deploys main automatically. Do not manually dispatch or bypass deployment.
4. Verify the merge SHA, successful Pages run for that SHA, generated deployment-version metadata, served index/module/CSS/Sprints bytes and service worker's full-SHA cache identity. HTTP 200 or PR state alone is insufficient. Local fixture build success is not production proof.
5. Adopt the deployed release through the normal updater/Settings → Application Status flow. Do not force-refresh, clear caches/storage, reinstall or delete the existing PWA. Complete installed-iPhone acceptance below.

## Rollback

Previous known-good deployment source: main `89c81e3ab8cc7c7e3fb4ba556d083930d971af26`. Rollback risk is low for user data because changes introduce only a separate launcher key and no migrations; launcher entry/routing must still be reviewed. If rollback is needed, prepare a scoped revert PR of this release's merged changes using the appropriate merge/squash history, review it, have Rolando merge, and let the same Pages workflow publish the revert. Preserve all LLT data/settings, Supabase data, queues, browser storage and the launcher preference key. Older code may ignore that key; retain it for a later roll-forward. Do not revert unrelated later fixes or redeploy a manually assembled artifact. Verify the resulting revert SHA and normal updater adoption as above.

## Installed-iPhone acceptance after approved deployment

- Record Application Status version and the already known LLT pending-settings/NOT VERIFIED state before adoption; do not change clinical settings to test this release.
- Open the existing installed LsW PWA normally and adopt the available release through its standard update flow; verify the expected version and no storage loss.
- Open Settings → My Apps; hide/show and reorder apps using the approved controls. Verify natural scrolling and handle drag remain distinct.
- Close and reopen the PWA; verify visibility/order persist and a hidden local app still opens through its direct route.
- Verify the explicit Recommended preset and Show All behavior.
- Confirm existing LLT records/settings remain intact and the deployment introduces no additional sync/verification regression. The pre-existing pending write is not required to become healthy and must not be labeled resolved.

No installed-PWA acceptance is claimed before Rolando performs it. Nothing has been staged, committed, pushed, merged or deployed by this task.
