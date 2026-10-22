# Violet Dineros (LWVD)

Your money. Your goals.

Sprint 1 is a standalone vanilla HTML/CSS/JavaScript app at `/violet-dineros/`
(or `/violet-dineros/index.html` on the safe local device server). It is registered in the existing À La Carte launcher and Settings → My Apps.
LWVD is available through Show All Apps or its visibility toggle; Recommended Apps
remains Digital Clock, Weather, and Lee-Lee’s Tracker. Existing saved selections
and ordering are preserved. The existing Pages allowlist includes its runtime files and official icon assets. No framework, backend, authentication, or shared-app data is used.

## Local preview

From this checkout, run `node scripts/dev-iphone.mjs --port 8766`.
Open the printed LAN URL followed by `violet-dineros/index.html` on the Mac or
in Safari on an iPhone connected to the same trusted Wi-Fi. Keep the server running.
The existing safe preview disables production sync and service workers.

Each browser/origin has separate data. The preview does not transfer to production.
Use the same URL/port to revisit your saved preview information.

## Data and rules

`localStorage` key: `lando-world:lwvd:v1`. One installation represents one user.
The model stores first name, integer-cent opening/current balance, onboarding
completion, payday anchor, and optional frequency. Opening balance is never income.
No transaction ledger or balance-adjustment history exists.

The daily guide divides the actual balance by local calendar days until payday,
rounded to cents for display. Missing, today, or expired nonrecurring dates show
an invitation instead. Recurrence advances expired dates to today or the next
future occurrence; it never deposits money. Monthly recurrence retains the original
chosen day and clamps to the last day in shorter months. Editing unrelated settings
preserves that anchor. Date guidance refreshes on return and across midnight.

Saving failures keep the form available with an error. Unreadable or invalid stored
data is preserved and blocks onboarding from overwriting it.

## Validation

- `node --test tests/lwvd.test.js`
- `node --test tests/landos-world-build-pages.test.js`
- `node --check violet-dineros/app.js`
- `node --check violet-dineros/model.js`
- `npx playwright test tests/browser/lwvd.spec.js` (uses the standard local preview)

Browser coverage includes fresh onboarding, personalized greetings, 428 / 8 = 53.50,
returning users, Settings persistence, all tabs, missing payday, and overflow at
320, 375, 390, 430, and 1280 pixels. Calendar tests cover today/past dates, DST,
weekly/biweekly recurrence, year rollover, and monthly/leap-year clamping.

Activity, Goals, Insights, quick actions, and motivation are honest coming-soon
states. Rolando confirmed physical-iPhone acceptance before release. Standalone offline
installation was not validated; Sprint 1 does not add a standalone manifest,
updater, or service worker.

## Official branding and launcher integration

The supplied original SVG and 1024px PNG are stored once as
`icons/violet-dineros.svg` and `icons/violet-dineros.png`, matching sibling app
naming and PNG resolution. The launcher and My Apps use the PNG; onboarding,
completion, and the favicon reuse the SVG. No artwork was redrawn.

Launcher integration uses the existing registry `href` entry, card theme,
visibility controls, ordering controls, and schema version 1. The established
missing-preferences behavior still shows all apps without writing defaults.
No runtime preference logic or recommended IDs were changed.

## Sprint 1.1 navigation and appearance

All four tabs and Settings include a direct arrow-and-label link to `../index.html#/`, preserving
LWVD and launcher data. The existing shared `js/theme-manager.js` runs synchronously
in the document head before the stylesheet/body. It uses the launcher's existing
`landos_world_appearance_preference_v1` Light/Dark/System choice and media-query
listener; LWVD has no separate theme preference or selector. A restored browser
page reinitializes the shared manager on `pageshow` to reread the current choice.
Dark surface overrides are scoped to LWVD's stylesheet.

Focused browser coverage: `tests/browser/lwvd-theme.spec.js`, including preference
resolution before body creation, live System changes, launcher return/reentry,
reloads, all tabs, onboarding in both themes, mobile overflow and unchanged raw
financial/launcher preference values. Screenshots use synthetic browser data only.

## Sprint 1.2 Starting Balance

Settings → Your Money → Starting Balance opens a prefilled dollar input with
Save and Cancel/Back. The editor uses the same `balanceCents` field as onboarding
and Home; existing Sprint 1 data needs no migration. A changed amount replaces
that value, and the next Home render uses it for the Money Story and daily guide.
Unchanged Save, Cancel, and Back do not write. Invalid input and failed storage
writes keep the editor open. Name, payday anchor, frequency, onboarding completion,
launcher preferences and unrelated storage are preserved. No transactions,
adjustment records or historical differences are created.

Focused validation: `tests/browser/lwvd-starting-balance.spec.js` plus existing
LWVD model and theme/navigation tests. Rolando confirmed physical-iPhone acceptance for this addition before release.
