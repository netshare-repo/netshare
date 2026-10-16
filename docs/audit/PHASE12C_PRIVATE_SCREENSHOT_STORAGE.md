# Phase 12C — Private screenshot storage

**Date:** 2026-10-15  
**Status:** backend artifact storage, upload, registration, retrieval, and cleanup complete. Browser rendering remains **BLOCKED**.  
**Availability:** `BROWSER_PAGE_INSPECT_ENABLED=false`; the backend execution readiness latch and Android network-rendering latch remain false.

## Storage architecture

Screenshot bytes are stored outside MongoDB through the `ScreenshotObjectStore` abstraction. Development uses `LocalPrivateScreenshotStore`, rooted at the configured private directory and excluded from source control. The local driver derives every object path from a server-generated 128-bit opaque artifact ID, creates directories and files with private permissions, refuses existing objects, and rejects any identifier that could form a traversal path.

Production does not silently use the local filesystem. Its default provider is `external`, for which the storage service fails closed until a production adapter extending `ScreenshotObjectStore` is explicitly configured. This creates the object-storage boundary without selecting a cloud vendor in this phase.

MongoDB stores only `ScreenshotArtifact` lifecycle metadata: opaque ID, task/client/node/routing-session bindings, MIME type, byte length, SHA-256 digest, dimensions, internal storage key, state, timestamps, expiry, and the eventual `TaskResult` ID. Image bytes and public object URLs are never stored in MongoDB or sent through the WebRTC DataChannel.

## Upload authorization and API contracts

All endpoints require the existing verified-account JWT middleware. Upload grant and upload endpoints additionally require a node-participant or dual-role account whose `NodeDevice` owns the assigned task.

### Create a one-use upload grant

`POST /api/tasks/:taskId/browser-artifacts/upload-grant`

Exact JSON request:

```json
{
  "nodeId": "<assigned NodeDevice ObjectId>",
  "routingSessionId": "<active RoutingSession ObjectId>",
  "contentType": "image/png",
  "sizeBytes": 12345,
  "sha256": "<64 lowercase hex characters>"
}
```

The task must be an assigned/running `BROWSER_PAGE_INSPECT` task with screenshot capture authorized. The route must be active, unexpired, and match the task, client, and node. Unknown request fields are rejected. The response contains the four-field v1 artifact reference, retention expiry, and a one-use upload token whose SHA-256 hash is the only token material persisted:

```json
{
  "artifact": {
    "artifactId": "<32 lowercase hex characters>",
    "contentType": "image/png",
    "sizeBytes": 12345,
    "sha256": "<64 lowercase hex characters>"
  },
  "retentionExpiresAt": "<timestamp>",
  "upload": {
    "method": "PUT",
    "path": "/api/tasks/:taskId/browser-artifacts/:artifactId",
    "grantToken": "<one-use secret>",
    "expiresAt": "<timestamp>"
  }
}
```

### Upload the PNG

`PUT /api/tasks/:taskId/browser-artifacts/:artifactId`

- `Authorization: Bearer <node JWT>`
- `X-NetShare-Artifact-Grant: <one-use token>`
- `Content-Type: image/png`
- raw PNG request body

The raw-body parser is capped at the configured limit, itself capped by the v1 maximum of 2 MiB. The service verifies the exact granted length and SHA-256 digest, PNG signature and chunk structure, mandatory `IHDR`/`IDAT`/`IEND`, absence of trailing polyglot data, and contract-bounded dimensions. An atomic `pending → uploading` claim prevents concurrent or repeated consumption. Only the four-field artifact reference is returned.

### Retrieve a registered screenshot

`GET /api/tasks/:taskId/browser-artifacts/:artifactId`

Only the owning client can retrieve an unexpired artifact referenced by that task's persisted `TaskResult`. Administrators, assigned nodes, and unrelated clients are denied by this endpoint. The response is an attachment with `image/png`, `nosniff`, a sandboxed content-security policy, same-origin resource policy, and private/no-store caching. The object length and digest are rechecked before delivery. No public or signed object URL is exposed.

## TaskResult registration and settlement

`validateBrowserPageInspectResult` now uses the real private registry verifier. A claimed artifact must be stored, unexpired, present in the private object store, and exactly match the task, node, routing session, content type, length, and digest. During the existing MongoDB settlement transaction, `TaskResult.browserPageInspect.screenshotArtifact` receives only the v1 opaque metadata and the artifact metadata atomically transitions to `registered` with the new `TaskResult` ID.

The existing unique task result, idempotent debit/reward keys, and transaction boundary remain unchanged. Duplicate task results return the existing result and do not register, debit, or reward twice.

## Lifecycle cleanup

The cleanup service deletes private objects and retires their metadata for:

- expired upload grants and retention periods;
- abandoned `uploading` claims;
- failed or cancelled tasks;
- uploaded objects never referenced by a `TaskResult` after the orphan grace period;
- registered metadata whose result reference is missing or inconsistent;
- extra artifacts after successful settlement.

Task-routing failures trigger task-specific cleanup after the failure transaction. Successful settlement preserves the registered artifact and removes any extra artifact. A periodic unreferenced timer runs outside tests. Local writes are exclusive and direct-to-final only after the entire bounded body has passed validation, so invalid bodies do not create partial files.

## Security coverage

Synthetic PNG tests cover signature/structure validation, trailing data, oversized bodies, exact digest/length, one-use grants, duplicate artifacts, injected fields, node and route spoofing, route expiry, unauthorized upload/retrieval, safe response headers, opaque TaskResult registration, exactly-once settlement, expired grants, failed/cancelled tasks, orphan cleanup, and local path traversal.

## Files changed

- `netshare-backend/models/ScreenshotArtifact.js`
- `netshare-backend/services/screenshotArtifactService.js`
- `netshare-backend/controllers/screenshotArtifactController.js`
- `netshare-backend/routes/taskRoutes.js`
- `netshare-backend/services/taskSettlementService.js`
- `netshare-backend/services/secureTaskRoutingService.js`
- `netshare-backend/models/TaskResult.js` remains the bounded opaque-reference schema introduced in Phase 12A; no byte field was added.
- `netshare-backend/config/env.js`, `.env.example`, `.gitignore`, `server.js`, and `middleware/errorMiddleware.js`
- `netshare-backend/tests/phase12cScreenshotArtifacts.test.js`
- `docs/audit/PHASE12C_PRIVATE_SCREENSHOT_STORAGE.md`
- `docs/audit/IMPLEMENTATION_STATUS.md`

## Validation results

- Phase 12C screenshot security suite: **8/8 PASS**.
- Full backend regression: **259/259 PASS across 19 files** on a fresh isolated MongoDB database with both experimental flags disabled.
- React production build: **PASS**. Vite emitted its existing non-blocking large-chunk advisory.
- React ESLint: **PASS**.
- Flutter tests: **97/97 PASS**.
- Flutter analysis: **PASS**, no issues found.
- Android arm64 debug APK: **PASS** at `Netshare/netshare_node_app/build/app/outputs/flutter-apk/app-debug.apk`.

## Remaining blockers

- Networked Android browser rendering remains blocked until every Chromium request can be forced through and proven against a deny-by-default task-scoped egress boundary.
- A production private object-store adapter and its deployment credentials, encryption, bucket policy, retention policy, and operational monitoring must be configured and acceptance tested. The production default deliberately returns `STORAGE_UNAVAILABLE`.
- Physical Android/TUN and screenshot capture/upload verification remains deferred.

No WebView was started, no existing VPN/TUN policy was weakened, and no browser E2E success is claimed.
