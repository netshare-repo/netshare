# Phase 11E — Public Data Fetch hardening

**Date:** 2026-10-14  
**Status:** Automated hardening complete; physical E2E deferred until final project testing.  
**Feature flag:** `PUBLIC_DATA_FETCH_ENABLED=false`; not enabled during this phase.

## Scope and audited path

Reviewed the 11A backend contract, 11B Android executor and 11C React/Flutter integration, including the `PUBLIC_DATA_FETCH` capability gate, task dispatch, WebRTC DataChannel identity fields, Android HTTPS execution, TUN validation, persisted `TaskResult.publicFetch`, settlement, ownership checks, safe content rendering and downloads. No backend-side fetch fallback exists. Existing testing services and payment implementation were left unchanged.

## Issues found and fixed

1. **Inconsistent one-run result status.** Backend result validation accepted `successRate` values inconsistent with `success` on a v1 single-execution task. It now accepts only 100 for success and 0 for failure. Added rejection tests.
2. **Android VPN waits could outlive task deadline.** The executor deadline closed the active HTTP client, but VPN readiness and metrics futures were awaited without the remaining deadline; a delayed final TUN metrics read could allow late completion. All VPN readiness/metrics operations now use the remaining task deadline and check cancellation after completion. Added tests for delayed final metrics and cancellation of a stalled response body.
3. **Exactly-once test evidence omitted the submission debit.** The settlement fixture previously asserted one node reward but did not explicitly submit a duplicate debit call. It now applies the same task idempotency key twice and verifies a single debit and a single reward across successful and duplicate result settlement.

## Security and contract checks

- Backend task authorization remains separate from the existing testing services. Only authorized HTTPS GET on port 443 is admitted; credentials, query/fragment material, cookies and custom headers are excluded. Existing target validation rejects private/internal destinations and revalidates DNS during routing; the backend does not fetch the URL itself.
- Android resolves and pins public DNS results to the installed route, rejects DNS answers outside the installed TUN routes, validates same-origin HTTPS redirects before another socket, and fails closed if the bound VPN session or forwarding counters are unavailable. It rejects unsupported/binary/encoded responses, permits only JSON, HTML source and plain text with UTF-8, and counts streamed bytes against the 16 KiB cap.
- The backend verifies task/node/routing-session identity, final URL origin, content type, UTF-8 byte count, reported status and bounded metrics before storing the result. Unique result/ledger keys and transactional settlement preserve one result and one reward; client task-detail authorization restricts reads to the owner (or authorized administrative/assigned-node roles).
- React formats JSON as escaped text, displays HTML as escaped source and saves it as `.html.txt` with `text/plain`; plain text is rendered as text. Flutter uses text widgets and text-safe downloads. Neither viewer executes fetched HTML.
- Automated security coverage includes malformed target/result values, unsafe DNS/redirects and origin mismatches, non-HTTPS/non-443 targets, credentials/auth material, unsupported media, invalid UTF-8/JSON, exact and excessive 16 KiB bodies, spoofed node/task/session binding, duplicate DataChannel/task execution, timeout/cancellation, VPN loss and owner authorization.

## Validation results

- Focused backend Phase 11A tests: **14 passed** across contract validation and isolated MongoDB settlement/ownership tests.
- Full backend suite: **247/247 passed across 17 test files** using the local replica-set database `netshare_phase11e_final` and port `18940`.
- React tests: **4/4 passed**; Vite production build passed (non-blocking large-chunk advisory); ESLint passed.
- Flutter tests: **89/89 passed**; `flutter analyze` reported no issues; Android arm64 debug APK build passed at `Netshare/netshare_node_app/build/app/outputs/flutter-apk/app-debug.apk`.
- Regression/build commands run with `PUBLIC_DATA_FETCH_ENABLED=false`.

## Physical acceptance

Physical Android E2E is **DEFERRED** until the final project testing phase, per project plan. No ADB/device testing was required or performed for Phase 11E. Phase 11D's JSON, HTML-source and controlled plain-text fetch, real TUN counters, result persistence/ownership and real settlement remain unverified on a physical node. Do not enable the feature or claim E2E success before completing those acceptance checks.
