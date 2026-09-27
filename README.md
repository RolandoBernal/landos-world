# Lando's World

Lando's World is a static GitHub Pages app that hosts several small family tools, including Digital Clock, Weather, Daily Chief Briefing, Violet Sprints, Death on Notecards, and Lee-Lee's Tracker.

## Lee-Lee's Tracker Shared Data

Lee-Lee's Tracker uses Supabase for authentication, shared records, synchronization, and Realtime updates. The app remains a static client-side deployment.

Data storage model:

- Supabase is the authoritative shared record source after sign-in.
- Browser storage remains the local cache, pending-operation queue, migration safety layer, and recovery fallback.
- JSON backup is the full restore-oriented backup format.
- CSV export is human-readable only and is not used for restore.

Do not put privileged Supabase credentials in frontend code. The browser may use only the project URL and publishable/anon key. Never use the service-role key or database password in this repository.

## Configuration

Local runtime config lives in `js/lee-lees-tracker-config.js`:

```js
window.LEE_LEE_TRACKER_SUPABASE_CONFIG = {
  url: 'https://YOUR-PROJECT.supabase.co',
  publishableKey: 'YOUR-PUBLISHABLE-KEY',
};
```

`.env.example` also documents reserved public variable names for a future build-injection workflow:

```sh
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Full setup steps are in `docs/SUPABASE_SETUP.md`.

## Commands

```sh
pnpm install
pnpm dev
pnpm test
pnpm run check:js
```

The supported local-development command is `pnpm dev`. It verifies the repository root, generates ignored local source metadata, starts the static server from this working tree, and prints the branch, commit, source state, URL, and port. Open the exact URL printed by the command, normally:

```text
http://127.0.0.1:8000/
```

Stop the server with `Ctrl-C`. `Source: Modified` means the served files include uncommitted working-tree changes based on the displayed commit; `Source: Clean` means Git reports no non-ignored changes.

Do not use `localhost:5500`, VS Code Live Server, or an arbitrary manually started server as the supported workflow. Those servers may serve another checkout, branch, or directory and do not generate the source identity used by the app’s Settings diagnostics.

The browser app remains static. `pnpm dev` is a small repository-owned static server, not a bundler or build system. It sends `Cache-Control: no-store` for local responses so a normal reload requests current working-tree files. Localhost service workers are intentionally disabled; local development does not clear LLT records, settings, pending sync state, foods, or timer state.

For physical-iPhone Safari UI testing on the same trusted local network, run:

```sh
pnpm dev:iphone
```

This separate HTTP server binds only to the Mac's private IPv4 address on its default network interface, accepts clients on that interface's subnet, and serves only the reviewed Pages runtime allowlist plus generated local metadata. It prints the URL to open in iPhone Safari. If the network route is ambiguous or no single private address can be selected, it refuses to start. macOS Firewall may ask to allow Node.js incoming connections; do not disable the firewall. Stop the server with `Ctrl-C`.

The served shell is marked `environment: local-device` and shows a small `LOCAL DEV` badge. This explicit mode bypasses LLT's sign-in gate only for local UI testing and fails closed before creating a Supabase client; LLT records/changes stay in that browser origin and are not synchronized. Use test data only. The mode disables service-worker registration and deployed-release checks and serves assets with `Cache-Control: no-store`, so refresh requests current working-tree code. It intentionally uses HTTP and does not represent installed-PWA, service-worker, offline, Cache Storage, or secure-context behavior. The LAN origin has separate browser storage from production, but storage separation does not isolate the shared Supabase backend; real authentication/sync is blocked in this mode.

For a source-identity fallback check, request the generated metadata directly:

```sh
curl -s http://127.0.0.1:8000/.local/landos-world-build-metadata.js
```

The production GitHub Pages shell is intended to live at:

```text
https://rolandobernal.github.io/landos-world/
```

## Database

Supabase SQL migrations live in `supabase/migrations`.

The current Lee-Lee's Tracker migration creates `public.lee_lee_records`, indexes, RLS policies, soft-delete metadata, attribution metadata, and Realtime publication registration.
