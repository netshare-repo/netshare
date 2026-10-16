# Phase 12E — Browser task client UI

**Date:** 2026-10-15  
**Availability:** `BROWSER_PAGE_INSPECT_ENABLED=false`; backend execution readiness and Android network-rendering latches remain closed. This phase prepares client screens only and does not enable browser execution.

## Delivered

- React and Flutter task submission screens read the authenticated `/tasks/capabilities` response. The browser task option is disabled unless `browserPageInspectEnabled` is exactly `true`. With the current capability off, both clients show **Coming Soon**, expose the prepared viewport, timeout, and screenshot settings in disabled form controls, and prevent submission. Network/API errors fail closed.
- When the backend explicitly advertises the capability in a future release, the clients submit the existing task target and region with one execution and the v1 options: contract version 1, bounded viewport preset, 5–20 second load timeout, 32 KiB text limit, and optional PNG capture. Pricing continues through the existing estimate endpoint and result navigation stays on the existing task-details routes.
- React and Flutter task details read only the persisted `TaskResult.browserPageInspect` subdocument. They display the final URL, title, status, viewport, rendered text, region/node identity, timestamps, resource counts, transferred bytes, timings, and execution errors. Missing, failed, or invalid result states are explicit.
- Extracted content is displayed as ordinary React text / Flutter `SelectableText`; HTML-like text is never interpreted, inserted as markup, or opened in a WebView. Screenshot references are checked for their v1 opaque metadata shape and size. The clients request image bytes only from the authenticated owner route `GET /api/tasks/:taskId/browser-artifacts/:artifactId`; neither storage paths nor upload grants enter the client UI. React verifies PNG signature, length, and SHA-256 where Web Crypto is available. Flutter verifies response type, length, and PNG signature. Both offer preview and download; Flutter uses the native document picker to save as PNG.
- Existing testing services, task result polling, reports, ratings, route/auth behavior, pricing, and settlement were left intact. No WebRTC, VPN, browser-networking, or wallet code was changed.

## Validation

- Backend full suite: **259/259 PASS across 19 test files**, run with both `PUBLIC_DATA_FETCH_ENABLED=false` and `BROWSER_PAGE_INSPECT_ENABLED=false` in an isolated local MongoDB replica-set database. Existing Phase 12C tests cover unauthenticated, node, and non-owner screenshot retrieval denial; screenshot grants, registered references, expiry, and integrity remain enforced server-side.
- React: **9/9 helper tests PASS**, production build PASS, ESLint PASS. The build reports the existing non-blocking large-bundle advisory.
- Flutter: **100/100 tests PASS**, including the new browser capability, Coming Soon, inert-content validation, and authenticated screenshot-route/role tests. `flutter analyze`: clean.
- Android arm64 debug APK: **PASS** at `Netshare/netshare_node_app/build/app/outputs/flutter-apk/app-debug.apk`.
- No physical Android or browser execution was attempted or claimed. The service remains unavailable, and this work does not resolve the platform-enforced Chromium egress blocker from Phase 12D.

## Changed files

- `netshare-frontend/src/pages/client/SubmitTask.jsx`
- `netshare-frontend/src/pages/client/TaskDetails.jsx`
- `netshare-frontend/src/pages/client/BrowserPageInspectResult.jsx`
- `netshare-frontend/src/pages/client/browserPageInspectView.js`
- `netshare-frontend/src/pages/client/SubmitTask.css`
- `netshare-frontend/src/pages/client/TaskDetails.css`
- `netshare-frontend/tests/browserPageInspectView.test.js`
- `Netshare/netshare_node_app/lib/screens/client/submit_task_screen.dart`
- `Netshare/netshare_node_app/lib/screens/client/task_details_screen.dart`
- `Netshare/netshare_node_app/lib/widgets/browser_page_inspect_result_view.dart`
- `Netshare/netshare_node_app/lib/services/client_api.dart`
- `Netshare/netshare_node_app/lib/services/mobile_document_service.dart`
- `Netshare/netshare_node_app/android/app/src/main/kotlin/com/example/netshare_node_app/MainActivity.kt`
- `Netshare/netshare_node_app/test/public_data_fetch_client_test.dart`

## Remaining gates

Browser rendering is still **BLOCKED**. Do not set the feature flag or readiness latches. Phase 12D's enforceable task-scoped Chromium egress boundary and deferred physical route-loss/fallback validation remain required before execution can be enabled. The private screenshot storage production adapter is also still a deployment requirement. Physical device testing remains deferred.
