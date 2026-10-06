# LLT local iPhone UUID compatibility

Local-only follow-up, 2026-10-06. No sensor pairing-code work.

1. **Branch:** `fix/llt-post15-ui-dexcom-code`.
2. **HEAD:** `b3c734c024b81e5bda528f2e438414d416678a6c`.
3. **Status:** existing cleanup source/test edits preserved; added edits to sensor domain/sync and sensor application tests, plus this report. Index empty. Unrelated modified #14.5 report and pre-existing untracked diagnostics, DONC directory, review SQL and Supabase configuration untouched.
4. **UI preservation:** all three cleanup changes retained. User physically confirmed date/time containment PASS after the scoped appearance reset. Stacked review and Low Glucose summary remain intact.
5. **Root cause:** HTTP LAN origins lack `crypto.randomUUID`; sensor request creation called it without feature detection. Localhost tests had that API and missed the distinction.
6. **Failing site:** `LeeLeeSensorSync.create().request()`, `p_operation_id` generation, before the confirmation screen and before `mutate()`/fixture persistence. Start also generated `p_new_cycle_id` directly.
7. **Availability:** user's Safari screenshot proves randomUUID undefined. Actual LAN-origin Chromium probe also reports `isSecureContext: false`, `randomUUID: undefined`.
8. **Secure randomness:** same real HTTP LAN probe reports `getRandomValues: function` and successfully creates a sensor using it. Web Crypto explicitly permits getRandomValues in insecure contexts: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues . Actual physical Safari fallback save remains pending; we cannot execute diagnostics on that phone here. Missing getRandomValues fails explicitly; no weak fallback.
9. **Existing helper audit:** searched relevant JS client files. Clinical tracker and sync have private `createId()` helpers with native randomUUID detection but timestamp/Math.random fallbacks. Those helpers do not throw this specific exception, and are unsuitable for standard secure sensor UUIDs. No existing suitable shared UUID helper found; only LLT sensor files contained unconditional direct calls. Other applications were not refactored.
10. **Helper:** created one small `generateUuid` function in the already loaded sensor domain utility, exposed on `LeeLeeDexcomSensor`.
11. **Location:** `js/lee-lee-dexcom-sensor.js`; no new script/load-order/dependency requirements.
12. **Algorithm:** feature-detect and prefer native `randomUUID()`. Otherwise request 16 cryptographically random bytes via `getRandomValues`, set version/variant bits, hex encode and insert standard hyphens. Throws when secure randomness is absent.
13. **Format:** string, 36 characters, `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`, lowercase hex in the fallback.
14. **Bits:** byte 6 `(byte & 0x0f) | 0x40`; byte 8 `(byte & 0x3f) | 0x80`. UUID v4 and RFC variant retained.
15. **Weak randomness:** no Math.random, timestamp, sequential or external-dependency fallback in the new helper. Pre-existing clinical helpers remain unchanged, outside this narrow correction.
16. **Dexcom sites:** request operation IDs for start/correction/undo; new cycle IDs for start/replacement; local preview scenario seed ID. All now call the same helper. Queued/retried operations retain their original IDs; context remains keyed by the existing user ID.
17. **Other LLT calls:** NONE changed.
18. **Scope rationale:** no additional clinical ID path had an unconditional failing randomUUID call, so no broader refactor was performed.
19. **New sensor fallback:** existing complete sensor browser scenario disables randomUUID before load, asserts getRandomValues exists, creates/saves sensor and validates persisted cycle UUID v4. Real LAN-origin fresh Chromium context also saves successfully.
20. **Replacement fallback:** the same scenario replaces the sensor, corrects times, undoes replacement and verifies retained history/reload under fallback. Both persisted cycle IDs and all operation receipt keys are asserted valid UUID v4 after replacement/undo/reload. Other existing scenarios exercise native generation.
21. **Helper tests:** one focused test covers native preference without invoking fallback; secure byte request; deterministic expected UUID; string, length, hyphens, version and variant; distinct calls; failure without crypto.
22. **Full units:** 519 passed, 0 failed (`npm test`).
23. **Browser checks:** full sensor + Low Glucose cleanup suites run across desktop/mobile Chromium, including fallback and existing typography/responsive checks. 50 passed, 0 failed (31.6 seconds). Follow-up persisted cycle/operation UUID assertions: 2 passed (2.7 seconds).
24. **Static:** `npm run check:js` and `git diff --check` passed.
25. **Sensor behavior:** no duration/grace/reminder/start/replacement/undo/realtime/authority/payload/RPC changes. Existing regression scenarios validate these paths.
26. **Cleanup regressions:** summary row values/counts and both-theme typography retained; date/time containment and stacked review tested at narrow/wide viewports.
27. **Production:** native UUID implementation remains preferred when available; unit test confirms fallback is not invoked. No production write or deployment test performed.
28. **LAN behavior:** on `http://172.22.19.198:8000`, actual non-secure Chromium creates a valid persisted local cycle (`ac266838-509c-464d-80d0-26665f6e0891`) in a fresh disposable browser context, with no UUID exception or downstream persistence failure. This is real LAN-origin evidence, not physical Safari evidence.
29. **Isolation:** environment probe returns `local-device`; `init()` selects `fixture()` rather than repository production connection. Fixture stores local cycles/receipts under `lando-world:llt-sensor-fixture:v1`. Routing unchanged. Probe used a fresh disposable browser session and synthetic data only.
30. **Preview:** http://172.22.19.198:8000/#/lee-lees-tracker . Existing port-8000 server continues serving current files.
31. **Production DB changes:** NONE.
32. **Production data changes:** NONE.
33. **Production permission changes:** NONE.
34. **Sensor pairing code:** NOT IMPLEMENTED; remains blocked for separate database/RPC review.
35. **Commit:** NO.
36. **Push:** NO.
37. **PR:** NO.
38. **Merge:** NO.
39. **Deployment:** NO; no release/service-worker bump.

Physical review: reload local preview, start a synthetic sensor, Review → Save, then Replace Sensor and verify the separate new/current timestamps and consequence sentence, Save/Cancel, and history. Check the Low Glucose three-row summary. Do not enter production clinical data or test pairing codes. Native iPhone save remains pending until user confirmation.

Simplicity: one 11-line helper, three call-site substitutions, focused test extensions. No ID service, crypto framework, persistence abstraction or database changes.

Evidence: `/private/tmp/llt-uuid-unit.log`, `/private/tmp/llt-uuid-static.log`, `/private/tmp/llt-uuid-browser.log`. Prior six unrelated baseline browser failures not rerun/reclassified; no database tests needed for this unchanged contract.

LLT LOCAL IPHONE UUID COMPATIBILITY FIX — READY FOR PHYSICAL-IPHONE REVIEW
