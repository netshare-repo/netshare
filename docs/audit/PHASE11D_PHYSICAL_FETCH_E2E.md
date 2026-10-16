# Phase 11D — Physical Public Data Fetch E2E

**Run date:** 2026-10-14  
**Acceptance status:** DEFERRED by project plan until final project testing. The checks below are a reproducible local-device runbook; they are not evidence that Phase 11D passed. Phase 11E does not require ADB or a connected phone.

## Result

| Acceptance check | Result |
| --- | --- |
| Device detected | **NO** — `adb devices -l` returned an empty device list. |
| JSON fetch (`https://jsonplaceholder.typicode.com/todos/1`) | **BLOCKED** — no Android node available. |
| HTML source fetch (`https://example.com`) | **BLOCKED** — no Android node available. |
| Controlled `text/plain` fetch | **BLOCKED** — endpoint not deployed and no Android node available. |
| Actual response body returned through Android | **NO — not observed in this run.** |
| Phase 11D TUN counter evidence | **None.** Phase 10B TUN measurements were for the earlier testing service and do not establish Public Data Fetch execution. The new executor checks all four deltas internally but does not emit or persist raw packet deltas. |
| React / Flutter viewer evidence | **Automated checks only.** The Phase 11C UI tests cover capability gating, inert HTML source, JSON formatting and text-safe downloads; no live result was viewed in this run. |
| Public Data Fetch settlement / persistence / ownership | **BLOCKED on physical execution.** Backend automated tests cover identity validation, persistence, duplicate settlement and owner authorization. |

Phase 10B previously proved physical Android WebRTC/TUN GET routing for the existing testing service on an OPPO CPH2725. Phase 11B reports the Android Public Data Fetch executor and its unit coverage, but also records no attached device. Neither is proof that this new executor returned content or settled a real Public Data Fetch task. No backend-side substitute fetch was run.

## Local environment and feature flag

- MongoDB was reachable at `127.0.0.1:27017`; its replica-set name is `netshareLocalRs` and it can support transaction tests. Regression tests used the separate `netshare_phase11d_regression` database.
- ADB is installed at `C:\Android\sdk\platform-tools\adb.exe`. `adb devices -l` returned no devices. This sandbox required elevated ADB access because it could not create its normal `.android` folder; run the command in a normal local terminal on the workstation.
- `PUBLIC_DATA_FETCH_ENABLED` defaults to false. With the flag set only in a short-lived local process, the capability handler returned `{"publicDataFetchEnabled":true}`; after removing that process override it returned `{"publicDataFetchEnabled":false}`. No long-running service was started with the feature enabled, no `.env` or production setting was changed, and `netshare-backend/.env.example` remains false.
- The authenticated HTTP capability request was not exercised. React and Flutter exposure was checked through their automated true/false feature-gate tests, not through an interactive physical-device session.

## Regression evidence

- Backend full suite: **244/244 PASS across 17 test files** against the isolated Phase 11D replica-set database.
- React tests / production build / lint: **4/4 tests PASS; build PASS; lint PASS**. Vite reports a non-blocking large-chunk advisory.
- Flutter tests / analysis / Android arm64 debug build: **87/87 tests PASS; analysis PASS; arm64 debug APK build PASS** at `Netshare/netshare_node_app/build/app/outputs/flutter-apk/app-debug.apk`.
- Backend suite used `mongodb://127.0.0.1:27017/netshare_phase11d_regression?replicaSet=netshareLocalRs`, `PORT=18938`, and `PUBLIC_DATA_FETCH_ENABLED=false`.

## Manual physical acceptance guide

Run this only against local development data and a development backend. Keep production configuration disabled. Use separate client and node-participant accounts, make sure the client has enough credits, and make sure the phone node is active, connected, verified, and eligible in the chosen region.

### 1. Start the isolated local backend

Open a PowerShell terminal in the repository root. This uses a dedicated database on the local transaction-capable replica set and enables the feature for this process only:

```powershell
$env:NODE_ENV = 'development'
$env:MONGO_URI = 'mongodb://127.0.0.1:27017/netshare_phase11d?replicaSet=netshareLocalRs'
$env:PORT = '8001'
$env:PUBLIC_DATA_FETCH_ENABLED = 'true'
$env:FRONTEND_URL = 'http://localhost:5173'
$env:CORS_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
npm.cmd --prefix .\netshare-backend start
```

In a second terminal, confirm `/health/ready` reports MongoDB connected and transactions available. Sign in using a local development client and request the authenticated capability endpoint:

```powershell
Invoke-RestMethod -Uri 'http://localhost:8001/health/ready'
$headers = @{ Authorization = "Bearer $clientToken" }
Invoke-RestMethod -Headers $headers -Uri 'http://localhost:8001/api/tasks/capabilities'
```

Expected response: `{"publicDataFetchEnabled":true}`. `$clientToken` should be the token from the local development client sign-in. Do not put production tokens in this test. Start React against the same local backend in another terminal:

```powershell
$env:VITE_API_BASE_URL = 'http://localhost:8001/api'
$env:VITE_SOCKET_URL = 'http://localhost:8001'
npm.cmd --prefix .\netshare-frontend run dev -- --host 127.0.0.1 --port 5173
```

Sign into the client UI and confirm Public Data Fetch becomes available only after the capability response is true. Sign into the Flutter client on the same local backend and confirm the same option. The backend remains authoritative for URL, region, cost, task creation and result ownership.

### 2. Connect the Android node to this backend

Connect and unlock the physical phone with USB debugging enabled. `adb devices -l` must show its serial and state `device` (not `unauthorized` or `offline`). Forward the phone’s local API port to the isolated backend port and build/install the debug app with the matching API URL:

```powershell
$adb = 'C:\Android\sdk\platform-tools\adb.exe'
& $adb devices -l
& $adb reverse tcp:8000 tcp:8001
Push-Location .\Netshare\netshare_node_app
& 'C:\src\flutter\bin\flutter.bat' build apk --debug --target-platform android-arm64 --dart-define=NETSHARE_API_URL=http://127.0.0.1:8000/api
& $adb install -r .\build\app\outputs\flutter-apk\app-debug.apk
Pop-Location
```

Open NetShare on the phone, sign into the local node-participant account, grant the VPN prompt, and start participation. Confirm the node reports active/eligible before submitting any task. Keep the device awake and the VPN active through execution.

### 3. Create the controlled plain-text endpoint

Deploy this test-only Cloudflare Worker (or equivalent controlled public HTTPS endpoint). Save the deployed HTTPS URL; it exposes deterministic positive and negative cases without credentials:

```javascript
export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/text') {
      return new Response('netshare-phase11d-text-ok\n', {
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    if (path === '/unsupported') {
      return new Response('not a supported response', {
        headers: { 'content-type': 'application/octet-stream' },
      });
    }
    if (path === '/oversize') {
      return new Response('x'.repeat(16385), {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
    if (path === '/unsafe-redirect') {
      return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } });
    }
    return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};
```

Do not add authorization headers, cookies, credentials or redirects to a non-public destination to positive test cases.

### 4. Run positive cases through the client UI

Before each run, clear/capture the Android log, submit exactly one execution, and save the task ID, routing session ID, node ID and client. Use these URLs:

1. JSON: `https://jsonplaceholder.typicode.com/todos/1` — expect HTTP 200, `application/json`, and the actual todo JSON body (`userId: 1`, `id: 1`, title `delectus aut autem`, `completed: false`).
2. HTML source: `https://example.com` — expect HTTP 200, an HTML content type, and source text only. Confirm the page does not execute/render the returned source as HTML. Copy and download it; the downloaded file must be text-safe (`.html.txt`).
3. Plain text: `https://<your-worker-host>/text` — expect HTTP 200, `text/plain`, and exactly `netshare-phase11d-text-ok` plus the line ending.

For each task, confirm the node received `task_request` over its authenticated WebRTC DataChannel, returned the actual body in a v1 `task_result`, and the backend stored that `TaskResult.publicFetch`. Check status, content type, byte count, final URL, source node, region, execution time and timing metrics. Confirm the React and Flutter task detail viewers read the owner-authorized persisted result, not a fresh client/backend fetch.

The Public Data Fetch executor samples `packetsIn`, `packetsOut`, `bytesIn`, and `bytesOut` immediately before and after the request and rejects success unless every delta is positive. Unlike the older testing-task executor, this Public Data Fetch path does not currently log or persist the raw packet deltas. To capture the required raw evidence without changing the app, run the debug build under the Flutter debugger and pause at the `before = await vpn.metrics()` and `after = await vpn.metrics()` snapshots in `lib/services/public_data_fetch_executor.dart`; record both maps and calculate each after-minus-before delta for the task. The result's upload/download byte measurements should agree with the corresponding TUN byte deltas. Do not treat the old testing executor's log line as Public Data Fetch evidence.

```powershell
& $adb logcat -d | Select-String -Pattern 'Authorized TUN route was interrupted|Authorized TUN forwarding was not confirmed|PublicDataFetch'
```

Require positive inbound and outbound TUN packet/byte deltas for the Public Data Fetch execution. A response without this per-task TUN evidence is not a pass. The `logcat` command is useful for route failure messages; it does not replace the debugger snapshots for raw counters.

### 5. Check persistence, ownership and exactly-once settlement

For each task ID, use the client’s authenticated task details endpoint and check the local database. `taskresults` must contain exactly one result for the task. The client ledger must contain one submission debit with key `task-submission:<taskId>`; the assigned node ledger must contain one reward with key `task-reward:<taskId>`. Replaying result delivery through the existing test harness must not create a second result, debit, reward or bandwidth record. Requesting task details as a different client must return 403.

```javascript
// In mongosh connected to netshare_phase11d on the local replica set:
const taskId = ObjectId('<task-id>');
db.taskresults.countDocuments({ taskId });
db.credittransactions.find(
  { taskId, idempotencyKey: { $in: [`task-submission:${taskId}`, `task-reward:${taskId}`] } },
  { userId: 1, type: 1, amount: 1, idempotencyKey: 1, _id: 0 }
).toArray();
```

Confirm `taskresults` count is `1`, and one correctly owned debit and one node reward exist. If the task fails before completion, record the actual backend settlement state and ledger rather than assuming a successful charge/refund.

### 6. Negative cases

Run each as a separate local task and verify there is no returned/stored body for rejected content, no cross-origin/internal redirect is followed, and no direct-request fallback occurs:

- Submit `https://127.0.0.1/`, `http://127.0.0.1/`, a private-network URL and a cloud metadata target; submission must be rejected before dispatch.
- Use the controlled `/unsupported`, `/oversize` (16,385 bytes), and `/unsafe-redirect` endpoints. Each must fail closed; oversized content must not be partially persisted.
- Start a task with the node VPN unavailable or revoke/disconnect it during execution. The node must fail the task without opening a direct socket, report the routing failure, cancel work and clean up its owned VPN lease.
- Exercise duplicate DataChannel request/result delivery only through the existing integration test harness. Confirm one result and one pair of idempotent wallet operations.

### 7. Restore disabled state

Stop the local backend with Ctrl+C. In that PowerShell session, clear the temporary override and verify the default is false:

```powershell
Remove-Item Env:PUBLIC_DATA_FETCH_ENABLED -ErrorAction SilentlyContinue
node --input-type=module -e "import cfg from './netshare-backend/config/env.js'; console.log(cfg.publicDataFetchEnabled)"
```

The output must be `false`. Leave production configuration disabled. The checked-in `.env.example` must remain `PUBLIC_DATA_FETCH_ENABLED=false` through the final physical acceptance phase.

## Security and scope preserved

No source code, backend production flag, WebRTC protocol, VPN routing, wallet behavior or client design was changed for this phase. The local flag parser and default were checked without starting a feature-enabled server. The only changes in this phase are this acceptance audit and the regression/build artifacts produced by the existing scripts.

The manual positive and negative device cases, returned-body comparison, per-task TUN proof, viewer interaction, owner check, persisted result and exactly-once ledger verification remain outstanding until a physical device is attached and the runbook is executed.
