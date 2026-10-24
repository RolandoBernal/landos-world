# Violet Dineros (LWVD)

Your money. Your goals.

LWVD is a standalone vanilla HTML/CSS/JavaScript app at `/violet-dineros/`
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
The model stores first name, integer-cent Starting Balance (`balanceCents`),
onboarding completion, payday anchor, optional frequency, and (from Sprint 2)
transactions. Starting Balance is never income. Current Balance is derived from
Starting Balance plus income minus expenses; it is never stored independently.

The daily guide divides `max(0, Current Balance)` by local calendar days until payday,
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

Goals, Insights, Can I Afford This?, and motivation remain honest coming-soon
states. Activity and the Add Money/Add Expense actions are functional in Sprint 2. Rolando confirmed physical-iPhone acceptance before release. Standalone offline
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

## Sprint 2 transactions and Activity

Add Money and Add Expense open opaque full-screen forms in a native dialog. Positive
integer-cent amounts, controlled source/category labels, optional descriptions
(up to 120 characters), stable random IDs, and original creation timestamps are
saved in a `transactions` array within the existing `lando-world:lwvd:v1` record.
Missing transactions means an empty history; loading legacy data writes nothing.
The Starting Balance field and all previous settings remain compatible.

Each successful action writes the entire record once before updating the screen.
Expenses can make Current Balance negative; a future-payday guide then shows zero.
No scheduled paycheck is deposited. Values exceeding exact safe-integer balance
range are rejected instead of rounded or partially saved.

Activity groups local dates newest first, with search and All/Money In/Expenses
filters. Rows open details; edits reuse the form and retain type/ID/creation date.
Only deletion asks for confirmation. Starting Balance edits recalculate the derived
balance and leave transactions untouched.

Successful adds, edits, and deletes show a noninteractive confirmation for 2.5
seconds. There is no Undo action or history state; corrections remain available
through Activity. Delete still requires confirmation. A stored-record check rejects
stale writes. Read errors/malformed records fail closed without replacing data.
Failed writes leave forms and saved balances intact and display a persistent error.

Transaction forms preserve page scroll, lock background scrolling, trap focus
using native dialog behavior, and restore focus/scroll on close. Scrollable fields
are separated from the separate action area. The native dialog host resets browser
default bounds; a top/left/width/height Visual Viewport frame, following LLT’s
calculator pattern, contains the form above Safari’s keyboard and toolbar. Native
nearest-field scrolling keeps focused fields in view. Add and Edit synchronously focus the amount
after the dialog is visible; iOS may require one tap to activate the numeric
keyboard. No timer or animation workaround forces keyboard activation.

Activity rows have compact spacing, muted chevrons, explicit details labels, and
pressed/focus states. Home retains the daily guide card/calculation without the
removed disclaimer. The complete Sprint 2 implementation and subsequent UX corrections received
Rolando’s explicit physical-iPhone PASS before release. Preview storage stays
separate from production.

Focused checks:
- `node --test tests/lwvd.test.js tests/lwvd-transactions.test.js`
- `npx playwright test tests/browser/lwvd-transactions.spec.js tests/browser/lwvd-starting-balance.spec.js`

No goals/reserves, transfers, affordability, analytics, gamification, automatic
income, cloud sync, account system, or other later-sprint features are introduced.

## Accepted final iPhone corrections

Read-only Money In and Expense Details use an opaque full-screen view. The existing
Activity DOM is visually hidden while the native modal blocks its interaction.
Information and Edit/Delete are centered together in the available area, with
scrolling at small heights or larger text sizes. Close preserves Activity search,
filters, page position and keyboard focus. Edit reuses the same single dialog
host in form mode; no second interactive sheet is created.

Quick Actions use hover styling only on hover-capable fine pointers and temporary
`:active` feedback on touch. Keyboard `:focus-visible` remains available. The existing input-modality marker
keeps control outlines keyboard-only across buttons, Activity rows, links, inputs,
selects and navigation. Touch can retain logical focus without leaving a painted outline.

Automated Chromium/mobile WebKit checks cover viewport resizing/dismissal, form
field and action geometry, full-screen Details, 200% text scrolling, Activity state,
touch highlight cleanup, keyboard focus, transactions and persistence. They do not
verify a physical iPhone keyboard. Rolando confirmed physical-iPhone acceptance of the complete implementation.

Final local spacing polish retains the existing viewport/form structure. Field
rows do not shrink inside the scroller, the action area has a separate divider
and padding, and form surfaces are opaque. Transaction selects use a 52px native
control height, zero vertical padding and normal line-height. Details geometry,
transactions, storage and calculations are unchanged. Add/Edit forms share the full-screen Details frame, with fields at the top
and actions outside the scroller. Native selects are not programmatically scrolled
on focus; iOS controls their menu placement. Persistent dollar prefixes are visual
only, and monetary/numeric values use the system font stack with tabular numerals.
The Featured Goal uses an arrow-free bullseye; further icon refinement is deferred.


## Sprint 2.1 UI polish and installed PWA acceptance

The root/body and shell cover the dynamic viewport with theme-appropriate surfaces;
navigation remains fixed and the page scrolls naturally. Settings rows share card
metrics, and Save Settings / Back to Home share a nonsticky row. Back discards
unsaved edits. Home uses “You have / [Current Balance] / right now.” with a more
prominent Daily Guide. Activity keeps its native search field with a decorative
search icon and compact text filters. Goals uses one arrow-free bullseye everywhere.
Financial logic, saved records, transaction forms and Details are unchanged.

Sprint 2.1 uses production-first physical-iPhone acceptance as explicitly requested.
Automated geometry and browser tests do not establish installed-iPhone PWA PASS.
Use the existing Lando’s World Settings → Application Status update mechanism,
then reopen Violet Dineros. No reinstall, cache clearing or storage reset is needed.
The existing service worker changes cache identity with each deployed full Git SHA;
LWVD does not add a separate updater or caching system. Real-worker restart tests
also verify that a prior LWVD record survives and the revised Home loads.

## Sprint 2.1.1 navigation and financial typography

The previous fixed footer was anchored independently of document flow, while Goals
and Insights supplied an extra content minimum height that Home/Activity did not.
The Sprint 2.1 root-color change did not address that positioning difference on the
installed iPhone. The existing shell now uses a flex column: main takes available
space and navigation participates in normal flow with sticky bottom positioning.
Window/document scrolling and the existing full-screen dialog frame remain intact.
Navigation retains its safe-area padding; no spacer, overlay or viewport script is
added. Focused tests compare its bottom edge with the viewport across every tab,
short/long Activity and three iPhone heights at top, middle and bottom scroll.
The precise installed-iOS viewport behavior still requires physical PWA acceptance.

Financial values and currency inputs use one local variable Geist Mono WOFF2
(100–900); labels, descriptions, dates and other UI typography are unchanged.
Source: Vercel's `vercel/geist-font`, pinned revision
`75d647056bcbd9eaba3a14b1b58290d0692685d6`,
`fonts/GeistMono/webfonts/GeistMono[wght].woff2`.
The original SIL Open Font License is included as `fonts/geist-mono-OFL.txt`.
The Pages allowlist includes both files. The font is precached in the existing
app cache; only this font's request uses that precached copy, so first-use offline
loading works without changing other apps' font routing. Real-worker tests load
it with the fixture network unavailable, then check LWVD and stored transactions.

## Sprint 2.1.2 weight refinement

All financial values and currency inputs now use Geist Mono weight 500. Its
existing local variable font supports 100–900; real-worker checks load weight 500
offline. Unnecessary heavy weights were reduced to 500 for headings, buttons,
navigation and emphasized text; body/supporting text uses 400. No displayed UI
retains a weight above 500; font-face range declarations still describe the
available variable font. Families, numeric arithmetic and storage are unchanged.


## Sprint 3 Savings Goals

Goals share the existing v1 record as an optional `goals` array. Missing goals
means no goals; loading old data performs no migration or write. Each goal stores
an ID, name, optional emoji, positive target in cents, reserved cents and archived
flag. Create/edit, reserve/release, archive and confirmed permanent deletion use
the existing atomic save, stale-record guard and full-screen native dialog.
Archive/delete release all reserved money without changing transaction history.
Lowering a target below its reservation requires releasing funds first.

Option A: combined reservations cannot exceed nonnegative Current Balance, and a
goal cannot reserve more than its target. Current Balance remains Starting Balance
plus income minus expenses. Available to spend is Current Balance minus active
reservations. Home shows total, reserved and available amounts when funds are
reserved; Daily Guide divides available money by days until payday. Ordinary
expenses, transaction edits/deletes and Starting Balance changes that would leave
reservations unfunded require releasing funds first. With no reservations, existing
negative-balance behavior remains supported.

The first active goal in creation order is Featured Goal; no manual selection or
new settings are added. Progress uses reserved/target cents and shows Fully Funded
at equality. Archived goals remain manageable in Goals and are excluded from Home.

Record Goal Purchase accepts a positive actual price up to that goal’s reservation
plus unreserved available funds. Saving creates exactly one ordinary expense,
archives the goal and releases its entire reservation in the same storage write.
A cheaper purchase releases the unused remainder; a more expensive purchase can
use available funds without using other goals’ reservations. Existing Activity
edit/delete behavior applies to the expense; it does not reopen or re-reserve an
archived goal. Deleting a goal never deletes its purchase expense.

Settings and Starting Balance back buttons use a 50px lavender circular control
with a centered SVG chevron and existing accessible destination label. Shared
shell sizing, standalone `100vh` fix, sticky navigation and Geist Mono weights
remain unchanged. Production-first installed-iPhone acceptance is still required
after PR review, merge and the normal Pages deployment/update workflow.

Additional validation: `node --test tests/lwvd-goals.test.js` and
`npx playwright test tests/browser/lwvd-goals.spec.js`.

## Temporary diagnostics removed

The temporary Viewport Diagnostics control, report/copy code, event listeners,
styles and measurement probe have been removed following acceptance of the
standalone viewport fix in release 2026-10-24-50. The accepted `100vh` standalone
coverage, sticky navigation, safe-area padding and dialog viewport handling remain.
