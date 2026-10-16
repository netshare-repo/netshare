# Phase 11A public data fetch foundation audit

Phase 11B adds the Android executor described in [the Phase 11B audit](PHASE11B_ANDROID_PUBLIC_DATA_FETCH.md). Real-device and end-to-end acceptance remain pending; the backend feature flag stays disabled.

**Status:** Backend foundation only; `PUBLIC_DATA_FETCH_ENABLED=false` by default. No Android execution or public availability claim.

## Boundary and contract

The existing WebRTC DataChannel outer message remains `{v:1, sessionId, type, msgId, payload, sentAt}`. For the new service only, `task_request.payload` retains the existing authorized host/port/method, task and routing session fields, plus:

```json
{"publicDataFetch":{"contractVersion":1,"serviceType":"PUBLIC_DATA_FETCH","taskId":"<task-id>","routingSessionId":"<route-id>","targetUrl":"https://public.example/data","method":"GET","maxResponseBytes":16384,"acceptedMediaTypes":["application/json","text/html","text/plain"],"redirectPolicy":"same-origin-https-only","credentials":"omit"}}
```

The required `task_result.payload` fields are the existing `taskId`, `routingSessionId`, `success`, `statusCode`, `latencyMs`, `bandwidthUsedMB` and `resultData`, plus `contractVersion:1`, `serviceType:"PUBLIC_DATA_FETCH"`, `nodeId` and `executedAt`. The new `resultData` shape is `{schemaVersion:1, finalUrl, contentType, content, responseSizeBytes, httpStatus, ttfbMs, totalTimeMs, error}`. For success, status is 2xx, `content` is a UTF-8 string, `responseSizeBytes` exactly equals its UTF-8 byte length and does not exceed 16 KiB, `error` is null, and the media type is one of the three accepted types. For failure, `content`/`contentType` are null, `responseSizeBytes` is zero, and `error` is a bounded string. Response headers are excluded. One task means one GET execution.

## Backend controls

- New service is separate from legacy testing service enums and result validation. The flag blocks submission and dispatch while off.
- Submission allowlists four fields, rejecting credentials, cookies, headers, method overrides and execution count above one. Target policy adds HTTPS/443 only, no URL userinfo, credential-like query keys, fragments, IP literals or internal host suffixes, and calls the existing DNS/SSRF target validator. Dispatch revalidates the target.
- Settlement verifies contract version and task/session/node IDs against the stored route and assigned node, then validates the final URL on the same HTTPS origin, media type, status, byte length and metrics. Only validated content enters `TaskResult.publicFetch` with content type, HTTP status, source node, execution timestamp and response metrics. Generic `resultData` contains metadata only, so content is not duplicated there.
- The existing MongoDB transaction, unique result index, route state check and reward idempotency key are unchanged. Backend code has no target fetch path for this service.

## Remaining work before enabling

Android must parse the nested versioned request, enforce the same target/DNS/redirect/header/cookie/size policy at the actual socket, execute via the authorized VpnService route, stop reading at byte 16,385, and return exactly the result payload above. It must preserve DataChannel message and task deduplication. Follow with device, TUN egress, redirect, failure, duplicate and settlement acceptance tests. React, Flutter, WebRTC transport, VpnService and payment code were outside Phase 11A.

## Evidence

`netshare-backend/tests/phase11aPublicDataFetch.test.js` covers the disabled gate, strict submission, target policy, versioned request, accepted content, byte/type rejection, identity binding, redirect rejection and failure shape. `phase11aPublicDataFetchSettlement.test.js` exercises the real MongoDB transaction, rejected forged/oversized results, bounded storage, and exactly-once result/reward effects. Existing Phase 2D/10A tests cover the shared routing path. The full backend suite passed **243/243 tests in 17 files** against an isolated MongoDB test database and port on 2026-10-14.
