# Phase 10A: Real client task results

Updated 2026-10-11. Scope: repository implementation and automated validation. No physical Android execution is claimed.

## Supported behavior

The official SRS and Chapter 3 describe regional accessibility, localization, performance, advertisement, UX, and compliance tests. The current authorized input has a URL, service type, target region, and execution count, with GET as the only method. The implemented behaviors are deliberately narrow:

| Type | Actual observation |
| --- | --- |
| `accessibility_testing` | GET reachability and observed HTTP success (2xx/3xx). It does not test screen readers or WCAG conformance. |
| `performance_testing` | Observed response duration and downloaded response size for each GET. It does not claim browser rendering or page-load timing. |
| `localization_testing` | Observed `Content-Language` and `<html lang>` values when an HTML response supplies them. It does not assert translation correctness. |

`ad_verification` is rejected because no expected ad identifier or placement is supplied. UX and compliance tests have no implemented task contract and are rejected. HEAD and other HTTP methods are rejected at submission, dispatch, protocol parsing, and node target validation. Existing records with unsupported types cannot be dispatched. The UI describes the supported observations.

No response body preview is returned. The node reads at most 16 KiB of HTML to extract a language tag, but only the language value is sent. The backend persists an allowlist of result fields, dropping any preview, body, or header values from the node payload. URL userinfo and credential-like query keys are rejected at submission and node validation, including redirects. The backend rejects a reported final URL outside the authorized origin or with credential-like query keys. React renders result strings as text.

## Production chain

React `SubmitTask` and Flutter `submit_task_screen` send `POST /api/tasks` with URL, service type, region, execution limit, and GET. `taskRoutes` invokes `validateTaskSubmission` then `taskController.createTask`, which independently validates the target, prices and debits the client in a transaction, persists `TestingTask`, and queues it. `taskQueueService` / `taskAllocationService` select an eligible regional node. `secureTaskRoutingService.prepareAuthorizedTaskSession` validates the stored target/type/method and calls `routingSessionService.createRoutingSession`. `startAndroidSecureRouting` establishes a peer; `dispatchTaskOverDataChannel` calls `webrtcPeerService.sendMessage('task_request')` when the DataChannel opens. Socket.IO carries signaling only.

On Android, `android_webrtc_service` parses the authorized envelope and checks replay, VPN permission and lease, validates the target, starts the authorized VpnService route, and calls `TaskExecutorService.executeRequestBatch`. Every attempted execution calls `executeHttpPerformanceTest`, which issues a real GET through the device's HTTP client, validates redirects, and checks TUN forwarding counters. The batch sends per-execution records and aggregate observations in `task_result` on the same DataChannel. `secureTaskRoutingService` receives it and calls `taskSettlementService.settleTaskResult`. The transaction verifies task/client/node/RoutingSession binding and active state, validates records, creates `TaskResult`, updates task/session/node/usage, and credits the node once on success. Duplicate results return the existing result. The unique result and idempotent wallet key back this behavior.

`taskController.getTaskById` returns the persisted task and `TaskResult` to the owner (and authorized node/admin); React `TaskDetails` and Flutter `task_details_screen` display its summary and execution records. React polls until terminal state. `taskController.downloadTaskReport` exports the same persisted result, one CSV row per execution with summary fields. It permits a failed task report when a result exists.

## Persisted result fields

The existing `TaskResult` fields remain: task/client/node IDs, service type, target URL, success, success rate, latency, packet loss (null when unmeasured), bandwidth used, HTTP status, `resultData`, and completion time. Schema 2 `resultData` adds method, target and node regions, requested/attempted/completed counts, total duration, average latency, total response bytes, error, and an `executions` array. Each record has ordinal, start/end timestamps, success, actual status (0 means no HTTP response), final URL when observed, content type, latency, response bytes, measured transfer amounts, safe service observations, and error. Unavailable measurements remain null. Failure can stop the batch before the requested count; the unattempted executions are never fabricated.

## Limits and acceptance

The backend tests use a real local MongoDB replica set for transactional result/settlement, wrong-session binding, duplicate delivery, failed request, owner access, CSV, and unsupported inputs. Flutter tests cover batch records, method/type rejection, and evidence without preview. Code inspection verifies DataChannel wiring and real Android HTTP call. A physical Android device and external controlled endpoint are still required to prove residential device egress, real TUN accounting, redirects over live networks, background/revoke behavior, and cross-NAT/TURN recovery. Build and tests alone do not establish those conditions.

Legacy direct/manual result routes remain development-only under `developmentOnly`; production Socket.IO task execution is disabled. The desktop agent fixture and old reports are not Android acceptance evidence.

## Validation run

- Backend full suite: 228/228 tests across 13 files, using an isolated local MongoDB replica set with `DEV_SKIP_OTP_VERIFICATION=false`; focused settlement suite after the final consistency test: 20/20.
- Flutter full suite: 68/68 tests; `flutter analyze`: no issues.
- Frontend: ESLint and production build passed. Vite emitted only a bundle-size advisory.
- Android arm64 debug APK build passed. No physical device or AVD was used.
