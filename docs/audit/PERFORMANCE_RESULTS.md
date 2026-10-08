# Phase 8 — Actual Performance Results

Recorded: 2026-10-08 Asia/Karachi. Final benchmark completion: `2026-10-07T21:03:59.548Z` (02:03:59 local). Measurements below are actual observations, not expected numbers or extrapolations.

## Method

Harness: `netshare-backend/scripts/rcValidation.mjs`. Actual `NODE_ENV=production` Express child process on loopback port 18081; Node 24.15.0; MongoDB 8.2.7 elected single-member `phase8rs`; Windows development host. Authenticated HTTP APIs with actual bcrypt login and snapshot/majority database transactions. Five warm-up requests per operation are excluded; **100 measured requests per operation, concurrency 5**. Latency uses `performance.now()` from request start through body read and expected-status assertion. Percentiles use sorted nearest rank: index `ceil(p × n) − 1`.

| Workload | Samples | Errors | p50 ms | p95 ms | Maximum ms | SRS comparison |
|---|---:|---:|---:|---:|---:|---|
| Login | 100 | 0 | 581.08 | 1229.54 | 1763.62 | PER-1: p95 ≤3,000 ms — PASS locally only |
| Client dashboard API | 100 | 0 | 38.88 | 65.28 | 109.95 | Not PER-2 page-load evidence |
| Task submission acknowledgement | 100 | 0 | 123.16 | 323.36 | 550.77 | PER-3: p95 ≤3,000 ms — PASS locally only |

Task submission uses valid HTTPS example.com URL, actual server validation/quote/debit/task persistence and queue acknowledgement, with a deliberately unavailable benchmark region. It measures acknowledgement, **not allocation/execution latency**. The client is funded by a reviewed fixture top-up, not production demo credits. Backend is actually restarted between workload groups to reset its real IP rate-limit window; rate limiting is never disabled. This is a development host, not a controlled capacity lab. Earlier runs varied materially (login p95 706.02 / 833.67 ms); the final run above is reported consistently, without selecting the fastest result. The harness aborts on unexpected status/error; it never converts failed samples into successful percentiles.

## Official NFR status

| ID | Acceptance | Phase 8 evidence | Official status |
|---|---|---|---|
| PER-1 | 95% login within 3 s under normal network | Local production API p95 below 3 s | UNVERIFIED for deployed normal-network conditions |
| PER-2 | 95% dashboard pages within 4 s on stable 20 Mbps | API only; no browser render/asset/20 Mbps measurement | UNVERIFIED |
| PER-3 | 95% task acknowledgement within 3 s | Local transaction-backed API p95 below 3 s | UNVERIFIED for deployment/network/load |
| PER-4 | Active task status refreshed at least every 10 s | Web and Flutter 10 s polling code; tests/build pass | PARTIAL; actual browser/device timing unmeasured |
| PER-5 | Node updated statistics displayed within 5 s | Monitoring/polling implementation exists; no device | UNVERIFIED |
| PER-6 | Multiple clients/nodes without assignment/settlement conflicts | 2 clients, 3 nodes, 6 tasks, 18 claims; duplicate and wallet races pass | MET for bounded local concurrency; fleet scale UNVERIFIED |
| REL-3 | ≥95% assigned tasks terminal Completed/Failed | Expiry sweeper/restart tests pass, but no longitudinal assigned-task cohort | UNVERIFIED |

No Android throughput, battery, CPU, mobile handover latency, packet-loss percentage, TURN RTT, real residential region latency or production prediction accuracy is claimed. API response times cannot establish browser page-load or update-to-render compliance.

## Reproduce and extend before release

Install backend/frontend/agent dependencies, start an isolated replica-set primary and run from `netshare-backend`:

```powershell
$env:RC_MONGO_URI='mongodb://127.0.0.1:27020/netshare_rc8_validation?replicaSet=phase8rs'
node scripts/rcValidation.mjs
```

The harness restricts its database name and creates explicitly named fixtures. It needs external DNS/HTTPS access to example.com and locally available native WebRTC; SMTP remains a local sink. For official deployment acceptance, preserve raw sample data, identify server/device/hardware/network versions, warm-up policy and error counts, measure actual browser pages on a controlled 20 Mbps link, measure updated statistics at the render boundary, and run an assigned-task cohort/fleet load with clearly stated duration and sample sizes. Do not relabel these local observations as production guarantees.
