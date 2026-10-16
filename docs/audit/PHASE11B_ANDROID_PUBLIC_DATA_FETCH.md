# Phase 11B Android public data fetch audit

**Status:** Android implementation and automated validation complete. Real-device route and end-to-end acceptance remain blocked because no Android device is attached. `PUBLIC_DATA_FETCH_ENABLED=false`; there is no product UI entry.

## Execution and binding

The Android node accepts the existing WebRTC DataChannel v1 `task_request` only for its bound routing session. The `PUBLIC_DATA_FETCH` branch checks the nested version 1 contract, rejects added request/header/cookie fields, and retains the existing message-ID and task-ID deduplication. The authenticated Socket.IO node handshake supplies `nodeId`; the task result includes this ID, the task ID, and the routing session ID for backend validation.

The node validates a public HTTPS/443 GET target, resolves every DNS answer and installs only public IPv4 `/32` routes in the existing VpnService. It waits for that exact TUN session and network readiness. An `HttpClient` TCP connection is pinned to a resolved, installed route IP while TLS uses the authorized hostname. Each same-origin redirect is revalidated and re-resolved before another socket is opened. Redirects to another scheme, host, port, or unsafe DNS address fail. There is no direct HTTP fallback, backend-side fetch, cookie, credential, authorization header, or unrestricted proxy mode. The existing native VpnService and payment code were not changed.

Responses are read as a bounded stream. A declared or streamed body above 16,384 bytes fails without returning content. Only UTF-8 JSON, HTML source, and plain text are accepted; binary/control bytes, malformed UTF-8, invalid JSON, unsupported media types, and unsupported charsets fail. The result is returned only after the VPN session still matches and TUN packet/byte counters advance. Route loss, deadline expiry, socket disconnect, or peer teardown cancels the request and releases only the owning VPN lease.

## Contract

The outer DataChannel envelope remains `{v:1, sessionId, type, msgId, payload, sentAt}`. The nested request remains the Phase 11A `publicDataFetch` v1 shape. The node sends `task_result.payload` with `contractVersion`, `serviceType`, `taskId`, `routingSessionId`, `nodeId`, `executedAt`, `success`, `successRate`, `statusCode`, `latencyMs`, `bandwidthUsedMB`, `uploadBandwidthMB`, `packetLoss`, `targetRegion`, and `resultData`. `resultData` contains `schemaVersion`, `finalUrl`, `contentType`, `content`, `responseSizeBytes`, `httpStatus`, `ttfbMs`, `totalTimeMs`, and `error`. Failed validation returns no body or content type and status `0` unless an HTTP error status of 400 or above was received, matching the backend Phase 11A validator. The observed successful HTTP status is included only on accepted 2xx content.

## Evidence and limits

- Focused Flutter tests cover JSON, HTML, plain text, v1 shape, unknown request fields, malformed encoding, binary/unsupported content, declared and streamed oversize, unsafe redirect/DNS, changed DNS route, DNS deadline, wrong session, duplicate message/task, and VPN interruption.
- Full Flutter suite: **81/81 PASS**. `flutter analyze`: **no issues**.
- Full backend regression: **243/243 PASS** across 17 files against the isolated `netshare_phase11b_test` database.
- Android arm64 debug APK: **PASS**, `Netshare/netshare_node_app/build/app/outputs/flutter-apk/app-debug.apk`.
- `adb devices` reported no attached device. Physical TUN egress, TLS certificate behavior, redirect traffic, VPN revoke/handover, and server settlement acceptance from an actual Android node are **BLOCKED**, not claimed as passed.

Do not enable the feature flag or expose the service until the real-device and end-to-end acceptance above passes. No Flutter or React UI, WebRTC transport, VpnService, existing testing service, or payment logic was redesigned for this phase.
