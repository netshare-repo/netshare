# Phase 12B — Android browser executor

**Date:** 2026-10-15  
**Status:** fail-closed Android executor foundation complete; networked page rendering is **BLOCKED**.  
**Availability:** `BROWSER_PAGE_INSPECT_ENABLED=false` and the backend code-side readiness latch remain false.

## Decision

Phase 12A's routing constraint still applies. `NetShareVpnService` routes only the task subnet and the explicit public IPv4 `/32` addresses supplied for one authorized port. It deliberately has no default route. A WebView can load redirects, subresources, service-worker requests, and Chromium-initiated traffic that are not safely covered by an application-level interception callback. Those requests could fall back to the device's physical network instead of the task-scoped TUN.

This phase therefore does **not** instantiate Android WebView, does not add a WebView package, and does not open a browser socket. It would be insecure to treat WebView interception as a complete network boundary. The executor accepts and validates the authorized v1 DataChannel request, then returns a bounded v1 failure result before DNS, VPN startup, TUN route installation, rendering, or network activity. No direct HTTP fallback exists.

The same conclusion applies to service workers and redirects: they must not be allowed until a native boundary can prove that every Chromium request is authorized and cannot use the physical-network fallback.

## Implemented Android/Flutter execution foundation

- Added `BROWSER_PAGE_INSPECT` v1 parsing to the existing `AuthorizedTaskRequest` DataChannel contract. It rejects unknown outer or nested fields, scripts, headers, cookies, credentials, altered resource policy, invalid viewport/limits, a non-GET method, a non-443 port, a different region, and more than one execution.
- Added a dedicated `BrowserPageInspectExecutor` branch to the existing Android WebRTC task handler. It requires the authenticated node ID, task ID, routing-session ID, target URL, target region, and one-execution binding; it participates in the existing message/task deduplication, cancellation, lifecycle, and VPN lease release paths.
- Added a deny-by-default `BrowserResourceBroker` model for a later native renderer. Each navigation, redirect, subresource, and service-worker request must pass the same policy: same authorized HTTPS origin, port 443, no credentials/unsafe query material/IP literal, public IPv4 DNS answers only, and DNS answers pinned to the routes installed for the task. The broker refuses to perform DNS lookup when its task-scoped egress guard is unavailable.
- Added `ControlledAndroidBrowserRenderer` as a closed rendering boundary. It has no WebView or `HttpClient` fallback. Its compile-time execution latch remains false.
- Added screenshot capture preparation only. It records that capture was requested, explicitly forbids image bytes on the DataChannel, and produces no artifact reference. Private artifact upload/registry/retrieval remains Phase 12C work.
- Added the exact backend `task_result` v1 shape for a browser failure: task/session/node/region binding, final URL, viewport, bounded metrics, no text, no screenshot artifact, and a bounded/redacted error. This lets the backend reject spoofed or malformed results using its existing validation and exactly-once settlement path.

## Automated security coverage

`Netshare/netshare_node_app/test/browser_page_inspect_test.dart` covers:

- exact v1 request parsing and rejection of headers, client script injection, and routing-session spoofing;
- deny-before-DNS behavior when task-scoped egress is not available;
- same-origin authorization of navigation, redirect, subresource, and service-worker request kinds;
- third-party redirect/subresource/service-worker rejection;
- private DNS answers, installed-route mismatch/DNS rebinding, and DNS timeout rejection;
- executor failure before any browser DNS or network operation;
- cancellation, missing node identity, result payload identity, and screenshot DataChannel prohibition.

The tests use fake DNS data only; they do not contact a browser, device, or public endpoint.

## Validation results

- Focused browser executor/security tests: **8/8 PASS**.
- Full Flutter tests: **97/97 PASS**.
- Flutter static analysis: **PASS**, no issues found.
- Android arm64 debug APK: **PASS** at `Netshare/netshare_node_app/build/app/outputs/flutter-apk/app-debug.apk`.
- Full backend regression: **251/251 PASS across 18 files** using a fresh isolated MongoDB database with `PUBLIC_DATA_FETCH_ENABLED=false` and `BROWSER_PAGE_INSPECT_ENABLED=false`.

A preliminary backend run against the shared development database encountered stale test-fixture records in an unrelated Phase 9 identity count assertion. The final regression evidence above uses a clean isolated database and completed with zero failures.

## Contract compatibility

The outer DataChannel envelope remains `{ v: 1, sessionId, type, msgId, payload, sentAt }`. The nested `browserPageInspect` authorization is the Phase 12A v1 contract, including `viewport`, `pageLoadTimeoutMs`, `maxTextBytes`, `captureScreenshot`, `maxScreenshotBytes`, `maxResources`, `maxTotalBytes`, `resourcePolicy`, `scriptPolicy`, `credentials`, and `redirectPolicy`.

The returned failure payload has the Phase 12A fields: `contractVersion`, `serviceType`, `taskId`, `routingSessionId`, `nodeId`, `executedAt`, `success`, `successRate`, `statusCode`, `latencyMs`, bandwidth fields, `targetRegion`, and a `resultData` object with final URL, HTTP status, viewport, bounded text/screenshot/resource/timing fields, and error. There is no successful browser response because no safe renderer is active.

## Security properties preserved

- Browser capability remains unavailable even if the environment flag were mistakenly changed because the backend readiness latch and Android network-rendering latch are closed.
- The branch neither starts `VpnService` nor performs DNS while blocked, so it cannot send an unapproved request using the physical route.
- Existing PUBLIC_DATA_FETCH and testing task executors retain their existing branches, identity binding, deadlines, settlement behavior, and payment logic.
- Browser failures remain ordinary task results and do not create a second debit or node reward; the backend's existing unique result and transactional settlement controls remain responsible for exactly-once behavior.
- No client UI, ad verification, screenshot storage, WebRTC transport, or native VPN forwarding behavior was changed.

## Remaining blockers and required next implementation

Networked browser rendering remains blocked until native Android provides all of the following with automated and physical-device evidence:

1. A browser process/network policy that prevents all direct physical-network fallback and forces top-level, redirect, subresource, service-worker, prefetch, download, and Chromium-originated traffic through an authorized task route.
2. A native request broker that validates/pins public DNS answers and maintains an allowlist for every permitted resource while enforcing 443 and byte/resource/deadline limits.
3. A verified no-script/cookie/storage/credential profile with task-isolated state and no arbitrary navigation or automation.
4. Private, task/session/node-bound screenshot artifact upload, registry verification, owner-authorized retrieval, retention, and cleanup.
5. Physical Android validation of TUN counters, route loss, cancellation, redirect/service-worker rejection, persisted result binding, and exactly-once wallet settlement.

No device was required or used in this phase. Do not open either feature/readiness latch or claim browser E2E success.
