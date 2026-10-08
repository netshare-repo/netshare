# Phase 8 — Release Candidate Validation

Validation date: 2026-10-08 (Asia/Karachi). Decision: **NOT READY**.

Completed phases 0–7 were preserved. Phase 8 changes fix acceptance/security regressions, dependency vulnerabilities and deployment configuration; they do not add new product workflows.

## Release gates

| Gate | Result | Actual evidence / scope |
|---|---|---|
| Backend | PASS — 205/205, 10 test files | Full Vitest run against the isolated real replica set; 26 additional Phase 8 cases over the 179 baseline. |
| Flutter | PASS — 50/50 | Existing 46 tests plus 4 release protocol/count/measurement regressions. |
| Flutter analysis | PASS | `flutter analyze`: No issues found. |
| Frontend | PASS build / full lint | Vite 8.3.3 production bundle, 1,898 modules; ESLint clean. No frontend test script/browser E2E suite is configured. |
| Android | PASS debug arm64 build | Flutter 3.41.9 / Dart 3.11.5; APK exists, target API 36, minimum API 24. Build is not device validation or release signing. |
| Mongo transactions | PASS | MongoDB 8.2.7 single-member `phase8rs`, elected writable primary on loopback port 27020; real snapshot/majority transactions, injected rollback and concurrent commits. |
| Concurrency | PASS, bounded local scope | 2 clients / 3 nodes / 6 tasks / 18 simultaneous claims, 12 result deliveries, 8 failures, 8 stock purchases, 8 approvals, 8 withdrawals, 4 concurrent process actions per accepted withdrawal. |
| Recovery | PASS, backend/local-peer scope | Actual Redis absent, actual ML endpoint absent, JS fallback, local WebRTC disconnect/failure, duplicate result, persisted pending work, expired routes and actual backend process stop/start. |
| Security regression | PASS, tested code/dependencies | Verified/blocked/role/owner guards, OTP lockout, token/key redaction, SSRF/private/metadata/port/redirect restrictions, atomic rollback, production demo/legacy rejection. |
| npm audit | PASS | Backend, frontend and desktop-agent full audit: 0 known vulnerabilities after compatible remediation. This is not a penetration test or container/OS/Python dependency scan. |
| Docker | FAIL release gate — runtime BLOCKED | Docker CLI/daemon absent. Configuration reviewed/hardened, but Compose parsing/build/start/fresh-volume authentication/readiness were not executed. |
| Official FR completion | 64/84 DONE; 20 PARTIAL | All 84 official numbered SRS requirements are now traced; previous denominator 64 was incomplete. DONE denotes evidenced implementation, not universal hardware E2E. |
| Official strict NFRs | 12 MET / 5 PARTIAL / 6 UNVERIFIED | 23 REL/USE/PER/SEC statements. The 32 interface/environment/constraint statements are separately audited. |

## Environment and reproducibility

Windows host; Node 24.15.0; MongoDB 8.2.7; Flutter 3.41.9; Java/Gradle from installed Android Studio. A dedicated MongoDB data directory `D:\.netshare-phase8-mongo` was used, with databases `netshare_phase8` and `netshare_rc8_validation`; existing operator databases were not modified. The local replica is real but single-member, loopback-only and unauthenticated: production authentication, failover and multi-host availability are not proven. After validation, only this verified temporary replica was stopped and its fixture directory removed. Fixtures are reproducible by reinitializing the isolated replica and rerunning the harness; no operator database was deleted.

Commands, from the appropriate project directory (PowerShell):

```powershell
# Start an isolated mongod, then use mongosh to initiate phase8rs with
# one member 127.0.0.1:27020 and wait for hello().isWritablePrimary.
$env:MONGO_URI='mongodb://127.0.0.1:27020/netshare_phase8?replicaSet=phase8rs'
$env:LOG_LEVEL='error'
npm.cmd test -- --reporter=dot

# netshare-backend; requires installed frontend/agent dependencies too.
$env:RC_MONGO_URI='mongodb://127.0.0.1:27020/netshare_rc8_validation?replicaSet=phase8rs'
node scripts/rcValidation.mjs

# netshare-frontend
npm.cmd run build
npm.cmd run lint
npm.cmd audit --json

# netshare-backend and netshare-agent, individually
npm.cmd audit --json

# Netshare/netshare_node_app
flutter test
flutter analyze
flutter build apk --debug --target-platform android-arm64
```

The acceptance harness refuses an unrelated database name. It starts a genuine production-mode backend and a local SMTP protocol sink, uses real HTTP APIs and native WebRTC, and closes its child server, peer and SMTP sockets. It intentionally leaves data only in its isolated database for inspection until the temporary replica is removed. It does not require or mutate real payment accounts.

## Full workflow evidence

`rcValidation.mjs` passed: registration → actual Nodemailer/local SMTP OTP delivery → verification → zero-funded production wallet → manual proof-fixture top-up approval → authenticated node/start consent → eligible-node allocation → RoutingSession → real native reliable DataChannel → real HTTPS GET of example.com (577 body bytes) → duplicate same protocol result → one TaskResult/one reward → rating → CSV report → withdrawal review/process → marketplace fulfilment → dispute review/resolution → owned notifications/read-all → admin reports/export.

Production-mode legacy task start/complete/fail and demo-credit endpoints return 410. Session legacy mutations are guarded too. Socket.IO remains signaling/telemetry only; no production task execution fallback is enabled. A production node socket requires a verified, unblocked owner and active participation session. Monitoring replay cannot increase billable bandwidth or reactivate a paused node.

**This peer is desktop/native, not Android.** Its HTTPS request proves real request/result/settlement transport, not VpnService, TUN, residential egress, background execution or NAT traversal. Payment proof/account/fulfilment values are explicitly fixtures; no actual external money or goods moved. SMTP sink delivery proves application protocol integration, not provider/inbox delivery. The admin account and catalogue item are provisioned test fixtures rather than public registration paths.

## Concurrency and transaction acceptance

Task reservation and node capacity now commit/rollback together. Duplicate ML/fallback jobs cannot claim an assigned task. Assignment timeout releases only an identity-bound unstarted route and preserves paused/offline states; running HTTP work is never replayed. Mongo write conflicts retry through the existing transaction helper.

Result, reward ledger, wallet, bandwidth, node capacity, participation metrics and task/route states settle in one transaction. An injected credit-ledger failure leaves all financial/result state unchanged and records a deduplicated admin-review alert. Twelve concurrent results produce one committed result/reward; late repeated failure cannot change a settled task or release capacity again. Marketplace stock/order/debit commit atomically. Payment approval/withdrawal processing races preserve available balances and unique ledger effects. Concurrent OTP verification creates one wallet, and an injected wallet failure rolls verification back.

These are bounded real database tests, not a distributed stress or arbitrary crash-point proof. Horizontal multi-backend WebRTC peer ownership is UNVERIFIED. Exactly-once settlement does not imply the network can guarantee execution once across arbitrary lost requests: the recovery policy fails uncertain running tasks instead of replaying them.

## Failure/recovery evidence

| Failure | Result | Scope |
|---|---|---|
| Redis unavailable | PASS | Actual absent Redis endpoint in production harness; readiness reports unavailable, Mongo-backed pending recovery and bounded in-memory fallback operate. Live Redis loss/rejoin under fleet load is UNVERIFIED. |
| ML unavailable/timeout/malformed | PASS | Existing unit cases plus actual unavailable production ML endpoint with logged JS fallback; no eligibility bypass or duplicate allocation. Live Python service health BLOCKED by missing Flask/sklearn runtime dependencies. |
| Node disconnect / WebRTC failure | PASS locally | Backend protocol/peer tests and duplicate failure/capacity cleanup; actual Android disconnection recovery BLOCKED. |
| Duplicate task result | PASS | Real DataChannel duplicate plus 12 concurrent transaction calls; exactly one reward/result. |
| Backend restart | PASS locally | Actual child process stop/start; expired persisted work reaches failed, settled reward/history survives, node capacity releases once. No running HTTP replay. |
| App background/lock/VPN revoke | BLOCKED | No physical Android device or AVD. |
| Wi-Fi/mobile interruption/switch | BLOCKED | No physical Android device/cellular environment. |
| STUN/TURN and NAT separation | UNVERIFIED | No real relay credentials or separated-network peers; loopback is not a substitute. |

## Regressions fixed

- Production REST/legacy/demo execution and automatic fake funding disabled; cryptographic OTP generation; OTP attempt helpers wired, atomic increments, fail-closed protection and consumed-reset predicate.
- Unverified/blocked socket/API authorization and explicit device participation consent; task/session public fields redact credentials.
- Password change fixed when protected requests omit the password hash; invalid profile name types rejected.
- Task validation precedes atomic task/debit creation; atomic result/reward/capacity/bandwidth and marketplace stock/order/debit; durable pending recovery and bounded Redis operations; timeout release made atomic.
- Settlement rollback creates admin-review alerts; result validation rejects non-finite/forged usage and inactive/expired identities; terminal state is monotonic.
- Telemetry is observational, not billable, and cannot resume paused/offline nodes; participation session accounting updated from committed results.
- Web simulated 45 MB/42 ms task-completion control removed; Flutter now executes the authorized bounded count with one deadline, reports actual bytes, and does not invent packet loss/minimum MB. Desktop validation executor also reports measured body/upload bytes rather than minimum MB or inferred packet loss. Unknown node measurements remain unknown.
- Production frontend `/api`/Socket.IO routing fixed; full ESLint regressions fixed; active task refresh added to meet the documented polling contract.
- Compatible npm audit fixes remove all reported vulnerabilities; vulnerable dev watcher removed in favor of Node watch.
- Compose replica-set/keyfile/health/dependency ordering and isolated listeners; backend native-compatible Debian image; frontend same-origin Nginx reverse proxy; LF checkout policy for mounted Linux shell scripts. Runtime remains BLOCKED, not certified.

## Performance and official requirement audit

[PERFORMANCE_RESULTS.md](PERFORMANCE_RESULTS.md) reports actual 100-sample, concurrency-5 p50/p95 measurements. Login and task acknowledgement numeric limits pass locally. Dashboard API latency is not a 20 Mbps page-load result. Public-network p95, full page load, actual mobile 5-second display, longitudinal ≥95% terminal rate and fleet scale remain UNVERIFIED.

[REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md) lists all 84 official FRs. [NFR_AUDIT.md](NFR_AUDIT.md) lists all 23 strict NFRs and 32 separate interface/constraint statements. Newly exposed pre-existing product gaps are not silently relabeled as complete phases or filled with unrequested features: phone-only registration/verification choice, validated photo upload, stored role changes, daily allowance rollover, enforced speed caps, measured speed/packet loss, Flutter node withdrawals and several detailed admin surfaces.

## Remaining release blockers

1. Real Android E2E/TUN and background/lock/VPN revoke/Wi-Fi-mobile recovery acceptance; signed production APK and device/browser compatibility testing.
2. Real TURN/NAT-separated residential connection, deployed TLS and provider SMTP delivery.
3. Docker CLI/daemon and required secrets/users to execute Compose config/build/fresh-volume init/health/restart; Mongo HA/backup restore and container/Python vulnerability scanning.
4. API 21–23 compatibility: current APK minimum is 24, contradicting OE-1.
5. The 20 PARTIAL FRs and PARTIAL/UNVERIFIED NFRs, including strict daily/speed enforcement and measured live statistics.
6. Production-network/load/usability evidence and ≥95% assigned-task terminal-state cohort; multi-backend peer ownership and live Redis rejoin.
7. Live Python ML health remains BLOCKED; safe unavailable-service fallback is verified. Frontend browser test suite is not configured.

Follow [FINAL_DEPLOYMENT_CHECKLIST.md](../operations/FINAL_DEPLOYMENT_CHECKLIST.md). Passing local tests/builds does not close these release gates. **Release candidate NOT READY. Phase 8 stops here.**
