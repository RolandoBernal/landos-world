# Lando's World agent instructions

## Production release workflow

For production-bound changes, use this default workflow unless Rolando explicitly authorizes a specific exception:

1. Fetch `origin/main` and verify local `main` is synchronized before starting. If it is stale or the remote changed in a way that affects the task, stop and report that before implementation.
2. Create a dedicated `feature/...`, `fix/...`, or `chore/...` branch from the current `main`. Keep the change within the requested scope and leave unrelated working-tree files, including local diagnostic reports, untouched.
3. Run appropriate validation for the change. Review the full diff and staged diff for scope, unrelated files, and `git diff --check` before committing.
4. Commit to the feature branch, push only that branch, and create/update a Pull Request targeting `main`. Include a concise change summary, implementation details, affected areas, test results, and relevant risks or limitations.
5. Stop for Rolando's review. Do not push feature work directly to `main`, merge the PR, bypass review, or manually trigger/deploy production Pages. Rolando's merge is the production approval gate.

### “Ship it” shorthand

“Ship it,” “Ship it!,” “Let’s ship it,” “Ready to ship,” and clearly equivalent release requests mean: finish validation and diff review, commit and push the feature/fix branch, create or update its PR to `main`, report the PR link and release summary, then stop for Rolando's review. They do **not** authorize pushing to `main`, merging, or deploying.

### After approval and deployment

- Rolando merges the approved PR; the existing GitHub Actions Pages workflow deploys `main`. Do not manually deploy or replace/bypass that workflow.
- The deployed-release updater is for adopting a release only after that deployment succeeds. Preserve the full Git SHA as canonical build identity, generated deployment metadata, and the network-only `deployment-version.json` contract. `SW_VERSION` remains a service-worker/cache identity, not the app release identity.
- Do not clear caches, reinstall, force-refresh, or otherwise bypass the updater as part of a normal release. Use Settings → Application Status when needed to verify running/latest version and update status.
- Never reset, clear, or rewrite user data, including LLT records/settings, local storage, IndexedDB, Supabase data, sync queues, drafts, or food data as a side effect of release/update work. Keep application cache management separate from user-data storage.
- Treat direct-to-main pushes, merges, manual production deployments, and review bypasses as exceptions requiring explicit authorization for that specific situation. After an exception, return to this default workflow.

For updater/offline architecture details, see [docs/architecture/deployed-release-updates.md](docs/architecture/deployed-release-updates.md) and [docs/architecture/offline.md](docs/architecture/offline.md).
