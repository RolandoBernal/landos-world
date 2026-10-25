# LWVD Sprint 5 — Insights

Scope: spending donut from recorded expense categories, one deterministic friendly observation, and an independent read-only small-purchase calculator. No storage/schema changes, income forecasting, budget limits or external services.

Budget Period uses the existing saved payday and weekly/biweekly/monthly recurrence. The most recent scheduled payday on or before today starts the period; today is inclusive. Monthly dates clamp to the month end without losing the original anchor day. Missing payday or recurrence produces an explanatory unavailable state, with This Month and All Time still usable. This Month is local month start through today. All Time includes all recorded expenses. No historical schedule is fabricated or persisted.

The chart and observation share Activity-style underline buttons with space-evenly alignment and 44px minimum targets. An accessible total and category list accompany the SVG. Empty, single-purchase and tied-category states avoid unsupported claims. Totals use exact integer cents via BigInt. The calculator uses a positive dollar amount and daily/weekly/monthly cadence, with explicit 365/52/12 yearly assumptions. It never calls save or records transactions.

Validation: 21 LWVD unit tests; 39 Pages/offline tests; JavaScript syntax checks; 84 existing LWVD Chromium browser tests; 61 existing transaction/goal/affordability iPhone WebKit tests; five new Insights browser tests in both Chromium and WebKit. Narrow layouts at 320/390/430px, light/dark screenshots, readable controls, scroll, focus, large text, keyboard-sized viewport and existing standalone 33px dvh-underreport regression checked. Physical installed-iPhone acceptance remains a user test.

Release baseline: 236529f (PR #175). Release follows a dedicated feature branch, reviewed PR diff, explicitly authorized merge, and the existing Pages workflow. Rollback: revert the Sprint 5 merge with a new reviewed PR; no financial data migration to reverse.
