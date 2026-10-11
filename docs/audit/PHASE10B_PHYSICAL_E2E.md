# Phase 10B: Physical Android E2E acceptance

Run date: 2026-10-12. Device: OPPO CPH2725, Android 15, ADB serial `10b0eae2`.

## Result

**Physical example.com execution: PASS. Full Phase 10B acceptance: BLOCKED.**

The phone received authorized `task_request` messages through WebRTC DataChannel, executed HTTPS GETs through its task-scoped TUN relay and captured physical-network responses, returned `task_result`, and the transactional backend persisted and settled each result. The 1- and 3-execution checks passed. The requested independent egress proof is still blocked: no controlled HTTPS endpoint URL or server-log access was provided. The API result was also verified from the task owner account; an interactive client screen was not exercised in this phone run.

## Environment and eligibility

- Isolated acceptance backend: API port 8001; MongoDB replica set on port 27021; database `netshare_phase10b`. The pre-existing port 8000 backend/database was not used for acceptance writes.
- `GET /health/ready`: MongoDB connected and transactions available. Redis was unavailable, so the backend used its in-memory task queue fallback.
- The phone used `adb reverse tcp:8000 tcp:8001`; its debug Flutter build was configured for `http://127.0.0.1:8000/api`.
- Test node `CPH2725 Android 15 Phase10B` was authenticated and eligible in Pakistan with one available slot when tasks were submitted.

## Real execution chain

1. React `SubmitTask` / Flutter `submit_task_screen` call `POST /api/tasks`; the client API created the acceptance task with URL, GET, `performance_testing`, Pakistan, and execution count.
2. `taskRoutes` applies `validateTaskSubmission`; `taskController.createTask` validates the target and transactionally debits the client, stores `TestingTask`, and queues it.
3. `taskQueueService` and `taskAllocationService` select the authenticated, connected, available Pakistan node. `secureTaskRoutingService.prepareAuthorizedTaskSession` binds task, client, node, target and method into a `RoutingSession`.
4. `secureTaskRoutingService.startAndroidSecureRouting` establishes the backend peer. `dispatchTaskOverDataChannel` sends `task_request` using `webrtcPeerService.sendMessage` when the real WebRTC DataChannel opens. The task payload/result were not sent through Socket.IO.
5. `android_webrtc_service.dart` validates the task/session envelope and target, acquires the VPN lease, starts `NetShareVpnService`, waits for Android to report connected `tun0`, then invokes `TaskExecutorService.executeRequestBatch`.
6. `task_executor_service.dart` issued real HTTPS GETs. Android routed the app’s authorized destination `/32` into the TUN; `NetShareVpnService.kt` relayed only the task’s resolved public IP and port to its upstream socket.
7. On this phone, `VpnService.protect(socket)` returned false while the VPN remained authorized. The fix captures the pre-VPN physical default `Network`, declares it as the VPN’s underlying network, and binds a failed-to-protect relay socket to that same network after rechecking VPN permission and service identity. Logcat showed the fallback and successful response.
8. Android sent `task_result` over the same DataChannel. `secureTaskRoutingService` passed it to `taskSettlementService.settleTaskResult`, which verified task/client/node/session/region binding, validated the measurements and execution count, and transactionally persisted `TaskResult`, closed the `RoutingSession`, updated task/node/usage state and applied the node reward.
9. The owner-authenticated `GET /api/tasks/:id` returned the stored result. React `TaskDetails.jsx` and Flutter `task_details_screen.dart` consume that endpoint and render the persisted summary and execution records; both use the same CSV-report endpoint. For this run, the task detail API and CSV were checked directly, including matching execution rows; no separate browser screenshot was captured.

## Physical evidence

### One execution, final build

- Task `6acbf45e2312fc6b5e37a1cf`; RoutingSession `6acbf45e2312fc6b5e37a1eb`; TaskResult `6acbf4602312fc6b5e37a21e`.
- Task status `settled`; TaskSession status `completed`; session log states “Android WebRTC DataChannel opened; secure task dispatched.”
- Actual result: HTTP 200, final URL `https://example.com/`, content type `text/html; charset=utf-8`, 577 response bytes, 219 ms request latency. `httpReachable` and `httpSuccess` are true.
- Device logcat measured `packetsInDelta=13`, `packetsOutDelta=11`, `bytesInDelta=1082`, `bytesOutDelta=5630`, `confirmed=true`.
- Client ledger has one 12-credit debit (`task-submission:6acbf45e2312fc6b5e37a1cf`); node ledger has one 1-credit reward (`task-reward:6acbf45e2312fc6b5e37a1cf`). Owner detail returned one TaskResult. CSV endpoint returned HTTP 200 with matching status evidence.

### Three executions, final build

- Task `6acbf47a2312fc6b5e37a2a5`; RoutingSession `6acbf47a2312fc6b5e37a2c1`; TaskResult `6acbf47c2312fc6b5e37a2ef`.
- Task status `settled`; requested / attempted / completed = `3 / 3 / 3`; aggregate duration 386 ms, mean latency 107 ms, total response size 1,731 bytes.
- All three actual GET records succeeded: HTTP 200, final URL `https://example.com/`, `text/html; charset=utf-8`, 577 bytes each. Latencies were 122, 89 and 110 ms; reachability and HTTP-success observations were true for each.
- Per-execution TUN deltas from device logcat:

| Execution | Packets in / out | Bytes in / out | TUN confirmed |
|---|---:|---:|---|
| 1 | 15 / 11 | 1,246 / 5,629 | yes |
| 2 | 13 / 13 | 1,006 / 5,709 | yes |
| 3 | 12 / 11 | 966 / 5,629 | yes |

- The owner detail endpoint returned all three stored records. Exactly one client debit and one node reward were present for the task, using task-specific idempotency keys.

The TUN counters are emitted as runtime diagnostic logs and are not currently part of the persisted `TaskResult` schema. The success decision requires positive inbound TUN packet and byte deltas. `packetLoss` remains null/unmeasured.

## Negative and idempotency checks

- `http://127.0.0.1` and `http://192.168.1.1` submissions were rejected with HTTP 400 as private/reserved targets.
- POST to `https://example.com` was rejected with HTTP 400: only GET is supported.
- Unsupported task types, wrong node/session bindings, duplicate DataChannel messages/results, failed requests, ownership checks, result uniqueness, and duplicate settlement are covered by the passing Flutter/backend acceptance tests. Manual `complete`/`fail` task routes are development-only; no manual result route or Socket.IO task execution was used in these device runs.

## First failures and fixes

1. The first Android attempt received HTTP 200 outside the authorized TUN path and correctly returned `Authorized TUN forwarding was not confirmed`. Android had not finished connecting `tun0` when execution began. The node now waits for the VPN network readiness signal before issuing the request.
2. The next attempt entered TUN but failed with `No route to host`; logcat showed `Unable to protect upstream socket`. The physical-network binding fallback described above fixed this on the CPH2725. Subsequent requests produced positive TUN deltas and settled results.
3. Performance results initially showed `httpReachable=false` and `httpSuccess=false` despite HTTP 200. `serviceEvidence` now derives those fields from the observed status code. The final single- and three-execution records report true.

## Validation

- Backend: 66/66 tests passed in `phase2b.test.js`, `phase2d.test.js`, and `phase3.test.js` on the isolated replica set. These cover wrong-session/node binding, duplicates, settlement, ownership and task validation.
- Flutter: full suite 68/68 passed; final focused result validation 6/6 passed; `flutter analyze` reported no issues.
- Android debug APK built and installed on the CPH2725 after the routing and evidence changes.
- API and CSV checks used the acceptance client’s authenticated owner token. The client detail response returned the persisted TaskResult, not a backend-executed HTTP substitute.

## Remaining blockers

- **Controlled endpoint evidence:** the user said they would provide the URL/log access, then confirmed the phone was connected. No controlled HTTPS endpoint or server-log access was received. Therefore no server-side source-IP log independently proves egress identity. Example.com is not user-controlled.
- **Device clock:** phone time was about 15 seconds ahead of the backend during this run. Per-execution timestamps are the node’s UTC clock; `TaskResult.completedAt` is backend time. The stored times must be interpreted with this measured clock skew.
- **Client rendering:** owner API data and the CSV were fetched and compared, and both UI implementations read these persisted fields. A separate interactive browser/client screen capture was not made.

Accordingly, the authorized example.com execution and transactional result path **PASS** on the physical phone; the full requested Phase 10B acceptance is **BLOCKED** pending controlled endpoint logs (and external review of the client screen if visual proof is required).
