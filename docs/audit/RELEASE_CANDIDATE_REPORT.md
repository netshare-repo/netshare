# Phase 9 — Release Blocker Closure

Validation date: 2026-10-09 (Asia/Karachi). Decision: **NOT READY**. This Phase 9 section is authoritative; the original Phase 8 evidence follows as an explicitly historical snapshot. SRS and Chapter 3 are unchanged.

## Current validation

| Gate | Observed result / scope |
|---|---|
| Backend full suite | **221/221 PASS**, 12 files; baseline 205 plus 16 new Phase 9 cases. Real MongoDB single-member phase9rs on loopback port 27020. |
| Flutter full suite | **62/62 PASS**; baseline 50 plus six screen/role/wallet cases, four STUN protocol/calculation cases and two VPN ownership/lifecycle cases. |
| Flutter analysis | **PASS**, no issues found. |
| Native Kotlin | **5/5 PASS**, TrafficPolicyTest: combined quota/persistence, conservative restart, directional pacing, expiry/persistence failure and concurrent consumers. |
| Frontend | **Production build and full ESLint PASS**. No new browser E2E claim. |
| Android | **arm64 debug APK PASS**. aapt reports minSdk 24, targetSdk 36. Not release signing or device execution. |
| API 21 / OE-1 | **BLOCKED**, actual direct manifest merge failed. Details below. |
| Official FRs | **73 DONE / 11 PARTIAL / 0 NOT_DONE of 84 (86.90%)**. Every former partial row reviewed; code and environment evidence separated below. |
| Android / external environments | No device/AVD. Android E2E/lifecycle/network gates BLOCKED; live STUN/TURN/NAT and SMS UNVERIFIED. Docker/live deployment not claimed. |

Full-suite command: from netshare-backend set MONGO_URI to mongodb://127.0.0.1:27020/netshare_phase9?replicaSet=phase9rs, NODE_ENV=test and a non-production JWT fixture secret, then run `npm.cmd test -- --reporter=dot`. The isolated real Mongo data directory is repository-local `.phase9-mongo` (gitignored); it does not use operator databases. It is a loopback-only, unauthenticated, single-member test replica, not production HA. After validation, its exact owned process was stopped; ignored test fixtures were retained.

From Netshare/netshare_node_app: `flutter test`, `flutter analyze`, `flutter build apk --debug --target-platform android-arm64`. From its android directory: `gradlew.bat :app:testDebugUnitTest --console=plain`. JUnit XML is under build/app/test-results/testDebugUnitTest. From netshare-frontend: `npm.cmd run build` and `npm.cmd run lint`.

## Exact API 21 blocker

The installed Flutter **3.41.9** toolchain defines `minSdkVersion = 24` in FlutterExtension.kt. Dart is **3.11.5** and the application requires ^3.11.5. Direct dependency shared_preferences ^2.5.5 resolves **shared_preferences_android 2.4.23**, whose Android library minimum is also **24**. flutter_webrtc 1.6.2+hotfix.3 declares 21 itself; it is not the first manifest blocker.

An initial `flutter build` automatically migrated the attempted app minimum of 21 back to the supported Flutter minimum; that successful build was **not** API-21 evidence. A second probe used direct `:app:processDebugMainManifest` with minimum 21 and failed with:

> uses-sdk:minSdkVersion 21 cannot be smaller than version 24 declared in library [:shared_preferences_android]

The application was restored to `flutter.minSdkVersion`; the actual final APK minimum is 24. No `tools:overrideLibrary`, fake manifest PASS or SRS change was used. Restoring 21 requires a compatible older Flutter/Dart/plugin family or maintaining a supported port/fork, followed by full regression and API-21 execution. Merely lowering one Gradle integer cannot restore support. This documents a concrete blocker in the current dependency family, not a claim that every possible toolchain is incapable of API 21. Flutter's upstream removal of older Android support is recorded in [issue 170807](https://github.com/flutter/flutter/issues/170807).

## Review of all 20 previously PARTIAL FRs

| FRs | Code-side result | Acceptance disposition |
|---|---|---|
| FR1.1, FR1.4 | Phone-only canonical E.164 identity, partial unique indexes, email/SMS choice in web/Flutter, signup/resend/reset/verify/login and bounded provider adapter. | Remain PARTIAL: fixtures prove protocol/error behavior, not live provider/handset delivery. |
| FR2.3 | Owner PNG/JPEG upload, canonical base64/signature/2 MB validation, storage, web/Flutter picker/preview and redaction tests. | DONE. |
| FR2.5 | Confirmed current-password role update, transaction, audit, active-work exclusion, socket disconnect and web/Flutter workflow. | DONE. |
| FR3.1, FR3.5, FR3.6, FR4.5 | Status/native VPN display, start failure cleanup, single-owner VPN lease, draining and owned native shutdown remain implemented; duplicate close and competing route tests added. | Remain PARTIAL: actual device start/stop/correlation/background/revoke untested. |
| FR3.2 | UTC rollover only when idle; legacy migration retains usage; immutable authorized policy; fail-closed persisted native TUN byte allowance. | Remains PARTIAL: device quota/kill/restart/rollover evidence required. |
| FR3.3 | Validated upload/download caps and native paced forwarding, shared policy lock, denied active-policy edits. | Remains PARTIAL: actual throughput under device load required. |
| FR3.7, FR4.3 | Native counter-delta upload/download speed, five-second live activity, session/region/bandwidth/health and honest errors/unmeasured display; web current metrics. | Remain PARTIAL: physical counter/traffic correlation required. |
| FR4.2 | Four bounded authenticated-offer STUN binding samples with cookie/transaction/source validation, response-timeout loss, RTT and adjacent RTT jitter; null when absent/stale. | Remains PARTIAL: real Android/STUN evidence missing; no TURN/NAT claim. |
| FR5.4, FR5.5, FR5.6 | Flutter participant wallet withdrawal/history, channels/account inputs, validation, actual-balance eligibility and stable retry key against atomic existing backend. | DONE. |
| FR12.3, FR12.4 | Primary admin bandwidth aggregates and fresh-node latency/reliability/capacity/load snapshot with timestamp/null semantics. | DONE. |
| FR13.3, FR13.4 | Admin individual detail view and audited idempotent read-only restriction distinct from blocking; owner/status checks serialize with task creation/allocation. | DONE. |

The 64 previously DONE FRs retain their explicit implementation evidence and pass the full regression suite; they were not rewritten. The refreshed [84-row register](REQUIREMENTS_TRACEABILITY.md) has nine promotions, eleven retained partial rows, no missing rows and no NOT_DONE rows.

## Security, lifecycle and measurement limits

- Own/admin serializers remove passwords and signup/reset OTP material; node API keys are excluded from admin detail responses.
- Role changes require confirmation/current password and cannot self-promote to admin. Restriction denies state-changing routes and socket admission, disconnects current sockets and prevents further allocation; read access remains distinct from a block.
- Withdrawal retry keys are user-scoped and payload-bound; repeated/concurrent submissions reserve once. Changed payload with the same key returns conflict.
- Native TrafficPolicy counts **forwarded IP bytes** in both directions, persists a conservative 64 KiB reservation before forwarding and fails closed on exhausted/expired policy or storage failure. A restart may under-use the reservation; it must not reopen it. The scope excludes signaling and kernel/network-interface overhead and is not a claim of wire-perfect billing.
- Policy expires at the UTC day boundary; old assignments must finish/fail before the server resets an idle node. A single-process Android VPN lease rejects competing routes instead of replacing another task's tunnel. Device revoke/kill/handover remains unverified.
- Native byte pacing has deterministic unit evidence, not measured handset throughput. Actual speeds come from monotonic counter deltas; missing measurements remain null.
- STUN loss means unanswered binding probes within the explicit 400 ms sample deadline, not loss inferred from failed HTTP tasks. Results expire after 60 seconds. Four samples are diagnostics, not a statistically proven network prediction.
- The legacy desktop Socket.IO daemon now exits without connecting/executing. Mobile manual Start/Complete/Fail controls and synthetic task-result helper were removed. Secure desktop modules remain explicitly for integration fixtures. Missing CPU measurements no longer fabricate 1.5%; HTTP failures are no longer labeled packet loss.
- Tests use explicit provider/protocol fixtures where stated. No production mock, fallback Socket.IO task execution, real SMS delivery or Android E2E PASS is inferred from them.

## Deployment migration and unchanged external gates

The SMS adapter uses the documented [Twilio Messages API](https://www.twilio.com/docs/messaging/api/message-resource), a fixed HTTPS endpoint, no redirects and an eight-second timeout. Optional TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER must be provided securely. Missing/rejected/unavailable provider fails with 503; no console/SMS demo fallback is used. Provider acceptance is not handset delivery. If initial delivery fails, the unverified account can retry via the resend endpoint.

Startup creates replacement partial unique email/phone indexes before dropping the old non-sparse email_1 index. Existing conflicting phone data must be reviewed before rollout; migration never silently merges identities. Only the selected verified SMS channel is a phone authentication identity: an unverified contact number on an email account cannot reset its password.

The migration scopes phone uniqueness to SMS-authentication identities, so duplicate legacy contact numbers on email accounts do not crash startup and are not rewritten. It also replaces the legacy sparse financial idempotency index only after checking for duplicate string keys. Genuine SMS identity, invalid SMS account or financial-key conflicts stop startup with sanitized diagnostics rather than choosing an owner or deleting records. Existing-database restart, clean-database creation and 221 backend regressions pass.

Remaining external gates are actual Android device/AVD E2E, background/screen lock, VPN revoke, Wi-Fi/mobile recovery, native quota/speed evidence, live STUN/TURN/NAT-separated peers, provider SMS/SMTP delivery, live Python dependencies/service, Docker runtime and production TLS/authenticated Mongo HA/restore/fleet/browser performance. No new benchmark, security-audit or deployment PASS is claimed by this phase. Phase 8's 23 strict NFR results (12 MET / 5 PARTIAL / 6 UNVERIFIED) remain historical; API compatibility remains unmet.

**Release candidate NOT READY. STOP after Phase 9.**

---

## Historical Phase 8 report (superseded by Phase 9 above where changed)

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
