# Lando's World agent instructions

## Production release workflow

Step 0 applies before every repository task; the remaining production release workflow applies to production-bound changes unless Rolando explicitly authorizes a specific exception:

0. Run `git fetch origin` before starting. Locate any worktree with `main` checked out, verify it is clean (including untracked files), and verify local `main` is an ancestor of or equal to the fetched `origin/main` (`git merge-base --is-ancestor main origin/main`). When these checks pass, automatically synchronize local `main` with `git merge --ff-only origin/main` in that clean main worktree; no approval is required for this safe fast-forward. If `main` is not checked out, use a separate clean main worktree. Never switch or modify an existing feature worktree to do this.
1. Stop and report if fetching fails or the remote is inaccessible, main is dirty, main has diverged or contains local-only commits, or new upstream changes materially conflict with the task. Never reset, force-pull, overwrite uncommitted changes, discard work, or update a checked-out worktree unsafely. Preserve existing feature branches/worktrees and their uncommitted changes. Upstream changes touching the same file alone are not a conflict: inspect the relevant hunks in an isolated task branch before deciding whether to stop.
2. Create a dedicated `feature/...`, `fix/...`, or `chore/...` branch from the current `main`. Keep the change within the requested scope and leave unrelated working-tree files, including local diagnostic reports, untouched.
3. Run appropriate validation for the change. Review the full diff and staged diff for scope, unrelated files, and `git diff --check` before committing.
4. Commit to the feature branch, push only that branch, and create/update a Pull Request targeting `main`. Include a concise change summary, implementation details, affected areas, test results, and relevant risks or limitations.
5. Stop for Rolando's review. Do not push feature work directly to `main`, merge the PR, bypass review, or manually trigger/deploy production Pages. Rolando's merge is the production approval gate.

### “Ship it” shorthand

“Ship it,” “Ship it!,” “Let’s ship it,” “Ready to ship,” and clearly equivalent release requests mean: finish validation and diff review, commit and push the feature/fix branch, create or update its PR to `main`, report the PR link and release summary, then stop for Rolando's review. They do **not** authorize pushing to `main`, merging, or deploying.

### After approval and deployment

- After every merged or closed PR, verify its actual merge status using GitHub (for example, `gh pr view <number> --json state,mergedAt,mergeCommit`); closed does not necessarily mean merged. Then repeat Step 0: fetch and safely fast-forward local `main` before the next task, without approval when the safety checks pass. Stop and report the same blockers listed above.
- Rolando merges the approved PR; the existing GitHub Actions Pages workflow deploys `main`. Do not manually deploy or replace/bypass that workflow.
- The deployed-release updater is for adopting a release only after that deployment succeeds. Preserve the full Git SHA as canonical build identity, generated deployment metadata, and the network-only `deployment-version.json` contract. `SW_VERSION` remains a service-worker/cache identity, not the app release identity.
- Do not clear caches, reinstall, force-refresh, or otherwise bypass the updater as part of a normal release. Use Settings → Application Status when needed to verify running/latest version and update status.
- Never reset, clear, or rewrite user data, including LLT records/settings, local storage, IndexedDB, Supabase data, sync queues, drafts, or food data as a side effect of release/update work. Keep application cache management separate from user-data storage.
- Treat direct-to-main pushes, merges, manual production deployments, and review bypasses as exceptions requiring explicit authorization for that specific situation. After an exception, return to this default workflow.

For updater/offline architecture details, see [docs/architecture/deployed-release-updates.md](docs/architecture/deployed-release-updates.md) and [docs/architecture/offline.md](docs/architecture/offline.md).

## iMT development preview

For every iMT implementation, serve the active development checkout at exactly:
`http://Rolandos-MacBook-Air.local:8000/#/maintenance-total`

Use port 8000 with LAN access for the MacBook and iPhone (normally `node scripts/dev-iphone.mjs --port 8000`). Keep the hostname and port unchanged between iterations. If occupied, identify the existing server and its checkout; safely reuse or replace it only when appropriate. Never terminate unrelated processes. Verify the bookmarked URL serves the active checkout and include the working preview link in every implementation report.
