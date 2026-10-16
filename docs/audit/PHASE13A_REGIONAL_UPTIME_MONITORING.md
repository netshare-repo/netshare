# Phase 13A — Regional Uptime Monitoring

Date: 2026-10-15  
Scope: backend only

## Implementation

Added a separate `REGIONAL_UPTIME_MONITOR` resource, API, and scheduler. Monitor probes are persisted as ordinary one-execution `performance_testing` HTTPS GET tasks and enter the existing allocation, secure routing, WebRTC DataChannel, Android VPN/TUN, and result settlement path. Keeping the execution task type unchanged preserves the existing node contract. The monitor service itself remains distinct and feature gated.

The scheduler uses MongoDB as its durable schedule and outbox. At each bounded scheduler tick (15 seconds by default, configurable from 5 to 60 seconds), it selects up to 25 due active monitors. In one MongoDB transaction it atomically claims the next sequence, reserves one run's prepaid budget, advances `nextRunAt`, and creates both the task and run record. The unique `{monitorId, sequence}` and `taskId` indexes plus the monitor's single in-flight slot prevent duplicate or concurrent runs. The task queue uses the persisted task ID and reconciles queued run records after interruption; it does not create a second run or make a new target request. A terminal probe failure is recorded once and is not retried as the same run.

Monitor creation reserves the client-approved budget once from the wallet. Each valid HTTP response consumes that run's reserved amount, whether its status matches the expected status or not. A no-response or pre-execution failure releases the run reservation. Cancellation stops future scheduling, marks queued tasks canceled, and refunds unused budget; an already assigned/running request may finish and settle through its existing route. Every ledger effect uses an idempotency key inside MongoDB transactions.

All targets must be HTTPS on port 443, have no userinfo or URL fragment, and use one of the configured client regions. Monitor creation invokes the existing DNS/IP target validator. The existing secure task dispatch validates the target again before node execution and applies existing private-network and SSRF protections. The backend never fetches the monitored URL. No WebRTC, Android, VPN, browser, client UI, or payment-policy changes were made.

## API contract

All endpoints require authentication and a `platform_client` or `both` role. Feature-disabled requests return unavailable (404).

- `POST /api/uptime-monitors` creates a monitor. It requires an `Idempotency-Key` header containing 8–100 safe characters. Body fields: `targetUrl`, `targetRegion`, `expectedStatusCode`, `intervalMinutes`, `maxRuns`, and `creditBudget`. The interval is 5–1440 minutes, max runs is 1–500, and budget is bounded to 50,000 credits and may not exceed the priced maximum run total. The response includes the monitor and `pricePerRunCredits`.
- `GET /api/uptime-monitors?limit=...` lists the authenticated client's monitors, with a maximum of 100 records.
- `GET /api/uptime-monitors/:id?limit=...` returns the owner-scoped monitor, up to 500 run records, and aggregate summary. The history limit defaults to 100.
- `DELETE /api/uptime-monitors/:id` stops future work and returns unused/unexecuted reserved credits according to the cancellation rules above.

Each `RegionalUptimeRun` records its monitor and sequence, associated ordinary `taskId`, scheduled/start/completion timestamps, target region, expected and actual HTTP status, response latency, availability result, node region, and a bounded safe error reason. The aggregate returns check count, failed execution count, uptime percentage, average/p50/p95 latency, and daily check/uptime/latency trends. Any completed HTTP response is a measured sample; a mismatched status is down. A failed execution with no HTTP response also counts as downtime. A queued run canceled before dispatch does not count as a probe.

## Tests and validation

- Phase 13A focused tests: **6/6 PASS**.
- Full backend suite: **265/265 PASS across 20 files**, on isolated local MongoDB replica-set database `netshare_phase13a_final_20261015` with the feature flag off.
- Existing ordinary task settlement regression: **20/20 PASS**.
- `node --check` passed for the added/changed backend services, scheduler, controller, routes, server, worker, and settlement modules.
- The shared default test database contains stale legacy phone fixtures, so full regression was run against an isolated database to avoid cross-run contamination.

## Readiness and remaining work

`REGIONAL_UPTIME_MONITOR_ENABLED=false` by default and in the local development environment. There is no client submission UI or public capability announcement. Physical Android testing is deferred as requested. Before enabling the flag, run authorized physical-node tests for scheduling under node loss, VPN interruption, status mismatches, cancellation during an active request, queue recovery, wallet ledger consistency, and per-region result identity. Browser architecture was not changed.
