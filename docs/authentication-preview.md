# Authentication-only iPhone preview

Run `npm run dev:iphone:auth` on the existing LLT authentication branch. The private-LAN, same-subnet, runtime-allowlisted server uses port **8769**, separate from `npm run dev:iphone` on port 8000. Open the printed LLT URL. This is not a production release.

The badge is **AUTH PREVIEW** and the notice says **Production data access disabled**. Trusted server metadata identifies `local-auth-preview`; it does not authorize LLT. Only a usable real Supabase Auth session authorizes this mode. URL parameters, browser storage and LAN hostnames do not grant access. Ordinary Local Dev remains `local-device` with its existing explicit local authorization and plan provenance.

## Security hold

The initial server is HTTP. **Do not enter real credentials on the iPhone over HTTP.** The HTTP preview hides credential inputs and refuses to create the Auth client outside a secure browser context. HTTPS delivery of Auth requests alone cannot protect an HTTP-delivered application from LAN script tampering. Trusted HTTPS and any certificate/trust changes require separate approval; this command does not create certificates or alter trust, firewall or device settings. Loopback desktop browsers are secure contexts and can run automated synthetic-credential fixtures.

## Data boundary

The production Supabase SDK and browser publishable configuration are reused. Session persistence, refresh, Auth events and local-scope sign-out retain their existing behavior. Preview-specific SDK `global.fetch` allows only the configured HTTPS Auth token, user, logout and settings endpoints and refuses redirects. The wrapped client blocks table, RPC, Storage, Edge Function and realtime access. Server CSP independently limits connections to same-origin static files and the configured Auth path, and prohibits workers. Runtime metadata failure prevents serving the preview shell.

Repository reconciliation, queue processors, audit uploads and realtime subscriptions are disabled. Background data-sync listeners and polling are not started. Pending queues are not pruned, acknowledged or consumed; preview saves do not enqueue production operations or resolve cached conflicts. Existing documents are not merged with remote data. Shared-settings status cannot report a newly verified remote plan. Authenticated preview entry skips migration prompts. Local user actions remain local; this is not a clinical-plan verification or sync test.

The separate browser origin isolates preview sessions and data from production and normal Local Dev. Auth-preview metadata is generated in memory and does not overwrite the ordinary development metadata file. No service-worker registration, cache cleanup, deployment checks, production login, database access or data migration is part of preview setup. Never copy production storage into the preview or clear production data to test this feature.

## Verification

Unit coverage checks Auth-only transport, SDK data canaries, auth access states, secure-context/configuration failures, queue preservation, restrictive server headers and PWA inactivity. Desktop/mobile Chromium fixtures use synthetic Auth responses, not production credentials. Physical-iPhone password sign-in, persistence/refresh and local sign-out remain pending trusted HTTPS approval and device testing.
