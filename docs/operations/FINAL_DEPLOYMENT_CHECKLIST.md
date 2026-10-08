# Final Deployment Checklist — Phase 8

Updated: 2026-10-08. **Current release decision: NOT READY.** This is an operator acceptance checklist, not evidence that unchecked operations succeeded. See [release report](../audit/RELEASE_CANDIDATE_REPORT.md).

## Requirements and artifacts

- [ ] Close or formally resolve all 20 PARTIAL official FRs and the 5 PARTIAL/6 UNVERIFIED strict NFRs; explicit sign-off cannot silently change the official SRS.
- [ ] Resolve Android OE-1 mismatch: current minimum API 24 versus required API 21; use approved SRS change or genuinely supported/tested artifacts, not a manifest-only downgrade.
- [ ] Re-run backend, Flutter, full frontend lint/build and all security audits on the exact release lockfiles/commit; archive results and artifact checksums.
- [ ] Build signed Android release artifact with production API URL, no cleartext exception/debug signing; test install/upgrade/logout/role switching and device/API compatibility.
- [ ] Execute browser E2E and supported browser compatibility; frontend presently has no configured test script.

## Secrets and MongoDB

- [ ] Install Docker Engine/Compose and confirm daemon availability. This host had neither CLI nor daemon, so no container runtime validation was possible.
- [ ] Provision a private Mongo replica-set keyfile outside Git with valid random content and restricted permissions; set `MONGO_KEYFILE_PATH`. Do not put credentials in committed Compose or logs.
- [ ] Set `MONGO_ROOT_USERNAME`, strong `MONGO_ROOT_PASSWORD`, JWT secret, public HTTPS frontend/CORS origins, SMTP provider credentials/from address and WebRTC STUN/TURN secrets. Keep environment/secret files untracked.
- [ ] Run `docker compose config --quiet` with the intended secret environment, without publishing rendered secret-bearing config.
- [ ] Build backend/frontend/ML images; verify native `node-datachannel` loads in the Debian Node 24 backend image and scan Node/Python/OS/image dependencies. npm audit alone is insufficient.
- [ ] Start `mongo`, `mongo-init` and `redis` first. On a fresh volume, verify authenticated Mongo root bootstrap, successful `rs0` initiation and a writable primary at member `mongo:27017`.
- [ ] Create a dedicated application user in the NetShare database with only required `readWrite`/index permissions using authenticated mongosh. Compose intentionally does not create this user from plaintext embedded credentials.
- [ ] Set authenticated `MONGO_URI` to the internal member hostname with `replicaSet=rs0` and correct `authSource`; URL-encode username/password. Do not use localhost inside backend containers or use root as the app identity.
- [ ] Confirm atomic transaction commit/rollback and concurrent ledger idempotency with the actual production-like authenticated URI. Standalone Mongo must fail readiness/financial writes, not fall back to nonatomic production operation.
- [ ] Inspect/repair legacy duplicate ledger/result/payment records before enabling unique indexes; do not auto-delete financial records. Verify startup indexes and reconcile historical balances/capacity/participation totals.
- [ ] Establish backup retention, restore rehearsal and access control. Current single-member Compose supports transactions, **not high availability**; use a multi-member production topology if uptime/failover is required.

## Compose and public ingress

- [ ] Start remaining services and inspect exit codes/health/readiness. Verify `mongo-init` exits successfully and backend waits for primary; test both fresh and existing volumes.
- [ ] Confirm Mongo/Redis/ML/backend have no public ports. Frontend is bound to `127.0.0.1:3000`; terminate HTTPS at a managed ingress and proxy to it. Do not expose cleartext listener publicly.
- [ ] Verify same-origin `/api` and `/socket.io` reverse proxy, WebSocket upgrades, SPA fallback, real CORS origin policy and expired-token behavior.
- [ ] Confirm production demo funding, REST legacy task/session mutation and Socket.IO task execution are rejected; only secure DataChannel tasks execute. Keep desktop Socket.IO-only executor out of production Compose.
- [ ] Verify readiness fails for DB/transaction loss and exposes Redis/ML degradation accurately; ensure logs redact tokens, keys, proofs and accounts.
- [ ] Rehearse graceful shutdown, abrupt backend restart, live Redis outage/rejoin, node disconnect, WebRTC failure and duplicate delivery without duplicate execution or financial effects. Multi-backend peer ownership is not yet validated.
- [ ] Verify manual top-up proof review and withdrawal payout against real provider references under dual-control/audit policy. Software fixtures do not verify actual cash or marketplace fulfilment.
- [ ] Check SMTP inbox delivery/spam handling/resend/lockout against the real provider. Local SMTP sink acceptance is not provider verification.
- [ ] Start the existing basic/synthetic Python ranking service, verify health and eligible-only feature mapping; keep timeout/JS fallback and honest model claims.

## Mandatory device / network acceptance

- [ ] Use a physical Android device or valid AVD; run client → node → RoutingSession → WebRTC → VpnService/TUN → approved HTTP/HTTPS request → result → exactly-once settlement.
- [ ] Prove egress from the selected node with packet/TUN and server observations; reject unrelated public domain, localhost, RFC1918, metadata IP, unauthorized port and unsafe redirects.
- [ ] Prove GET/HEAD host/port bounds, configured execution count, actual byte accounting, deadline/cancellation, duplicate execution guards and clean resource closure.
- [ ] Test app background, screen lock, VPN permission denial/revoke, foreground service lifecycle and task cleanup. No device evidence currently exists.
- [ ] Test Wi-Fi/mobile change, offline interruption and recovery without replaying uncertain already-executing requests.
- [ ] Run STUN/TURN with real credentials and NAT-separated peers/residential networks; force relay and observe selected candidate type. Loopback DataChannel is insufficient.
- [ ] Obtain participant consent and validate ISP/local lawful-use permissions. Do not treat technical GET authorization as legal approval.

## Performance and release approval

- [ ] Record p50/p95 and errors under deployed normal network for login/task submission; measure actual dashboard pages on stable 20 Mbps, task status refresh and node update-to-render within 5 s.
- [ ] Run representative multi-client/multi-node load plus restart/failover races, and measure the ≥95% assigned-task terminal-state rate over a documented cohort/duration.
- [ ] Conduct usability and browser/device testing. Store raw measurements/environment details; never reuse localhost API timings as full-page or mobile results.
- [ ] Review residual security risk, access/retention policy, vulnerability scans and monitoring/runbooks with an operator.
- [ ] Mark READY only after required evidence is present and all release gates close. Otherwise retain BLOCKED/UNVERIFIED/NOT_MET honestly.

No production deployment was performed during Phase 8. Do not continue into another phase automatically.
