# Authentication iPhone preview

Run `npm run dev:iphone:auth` on the existing LLT authentication branch. The private-LAN, same-subnet, runtime-allowlisted server uses port **8769**, separate from `npm run dev:iphone` on port 8000. Open the printed LLT URL. This is not a production release.

The badge is **AUTH PREVIEW** and the notice says **Production data access disabled**. Trusted server metadata identifies `local-auth-preview`; it does not authorize LLT. Only a usable real Supabase Auth session authorizes this mode. URL parameters, browser storage and LAN hostnames do not grant access. Ordinary Local Dev remains `local-device` with its existing explicit local authorization and plan provenance.

## Security hold

The default server is HTTP. Optional `--https --tls-cert <path> --tls-key <path>` uses Node’s built-in HTTPS server and requires both readable, valid files; it never falls back to HTTP. **Do not enter real credentials on the iPhone over HTTP.** The HTTP preview hides credential inputs and refuses to create the Auth client outside a secure browser context. HTTPS delivery of Auth requests alone cannot protect an HTTP-delivered application from LAN script tampering. Trusted HTTPS and any certificate/trust changes require separate approval; this command does not create certificates or alter trust, firewall or device settings. Loopback desktop browsers are secure contexts and can run automated synthetic-credential fixtures.

## Default Auth-only data boundary

The production Supabase SDK and browser publishable configuration are reused. Session persistence, refresh, Auth events and local-scope sign-out retain their existing behavior. Preview-specific SDK `global.fetch` allows only the configured HTTPS Auth token, user, logout and settings endpoints and refuses redirects. The wrapped client blocks table, RPC, Storage, Edge Function and realtime access. Server CSP independently limits connections to same-origin static files and the configured Auth path, and prohibits workers. Runtime metadata failure prevents serving the preview shell.

Repository reconciliation, queue processors, audit uploads and clinical realtime subscriptions are disabled. Default Auth Preview also blocks sensor realtime; the explicit exception is documented below. Background data-sync listeners and polling are not started. Pending queues are not pruned, acknowledged or consumed; preview saves do not enqueue production operations or resolve cached conflicts. Existing documents are not merged with remote data. Shared-settings status cannot report a newly verified remote plan. Authenticated preview entry skips migration prompts. Local user actions remain local; this is not a clinical-plan verification or sync test.

The separate browser origin isolates preview sessions and data from production and normal Local Dev. Auth-preview metadata is generated in memory and does not overwrite the ordinary development metadata file. No service-worker registration, cache cleanup, deployment checks, production login or data migration is part of preview setup. The explicit sensor mode below permits only its approved sensor backend access. Never copy production storage into the preview or clear production data to test this feature.

## Verification

Unit coverage checks Auth-only transport, SDK data canaries, auth access states, secure-context/configuration failures, queue preservation, restrictive server headers and PWA inactivity. Desktop/mobile Chromium fixtures use synthetic Auth responses, not production credentials. Physical-iPhone password sign-in, persistence/refresh and local sign-out remain pending trusted HTTPS approval and device testing.


## Explicit HTTPS sensor acceptance mode

`--sensor-preview` requires both `--auth-preview` and `--https`. Auth Preview alone, HTTPS alone, or existing certificate files never enable sensor access. The server supplies frozen `previewHttps` and `sensorPreview` booleans and retains `environment: local-auth-preview`. Browser secure-context checks and a usable authenticated session remain required. Metadata is a restriction selector, never an authentication grant.

Only POST requests to the configured project’s `/rest/v1/rpc/llt_get_sensor_snapshot` and `/rest/v1/rpc/llt_mutate_sensor_cycle` are added to the SDK transport. Query-string variants, other RPCs, alternate RPC options and unrelated endpoints remain rejected. The bounded client exposes only Auth, those two RPC names, and its own exact sensor subscription/removal operations. Direct queries, Storage, Functions and raw Realtime remain unavailable.

The only allowed channel is `llt-sensor-${authenticatedUid}`, with `postgres_changes`, event `*`, schema `public`, table `llt_sensor_contexts` and filter `user_id=eq.${authenticatedUid}`. Subscription callbacks recheck the current usable session; obsolete channels can be cleaned up but cannot be resubscribed. Broadcast, presence and unrelated channels/filters are unavailable. This reuses the existing sensor sync module. RLS and the approved RPCs remain authoritative.

CSP adds the two exact RPC URLs and the project’s `wss://…/realtime/v1/websocket` endpoint; it retains Auth-only paths, same-origin connections, `form-action 'self'` and `worker-src 'none'`. No wildcard project-wide data access is added. Clinical queues/reconciliation/audits/settings/food sync and service-worker/release-updater paths remain disabled.

Credentials go directly from the browser to Supabase Auth over HTTPS. Passwords are not logged or stored by LLT. The existing SDK persists session/refresh tokens in browser local storage and refreshes them normally. The HTTPS host/port has separate origin storage from HTTP preview and production. Do not copy production browser storage into the preview.

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


## Mac-only acceptance

Add `--loopback` to bind only to `127.0.0.1`, without LAN-interface selection. This works with a certificate covering localhost and 127.0.0.1, uses the same authenticated sensor-only restrictions, and requires no iPhone setup. Stop a previous server with Ctrl-C before restarting:

```sh
npm run dev:iphone:auth -- --loopback --https --sensor-preview --tls-cert .local/llt-auth-preview-tls/cert.pem --tls-key .local/llt-auth-preview-tls/key.pem
```

Open `https://127.0.0.1:8769/#/lee-lees-tracker` in Mac Safari. Desktop acceptance does not establish physical-iPhone or installed-PWA acceptance.
