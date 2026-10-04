# NetShare — Requirements Traceability Matrix
> Generated: 2026-09-25 | Based on full code inspection

---

> **⚠️ Context**: The following table evaluates requirements against the **actual implemented system** (a distributed web-testing marketplace with HTTP task execution by node agents). Where a requirement describes VPN/bandwidth-sharing features that do not exist at all, they are marked NOT STARTED.

---

## Authentication & User Management

| Requirement | Existing Implementation | Status | Files | Missing Work | Priority |
|---|---|---|---|---|---|
| User registration | `POST /api/auth/register` — name, email, phone, password, role; bcrypt; OTP sent | **DONE** | `authController.js`, `authRoutes.js`, `User.js` | Email delivery (SMTP) not wired | P1 |
| Email OTP verification | `POST /api/auth/verify-signup-otp` — SHA-256 hash compare, expiry check, wallet created | **DONE** | `authController.js` | — | — |
| Login | `POST /api/auth/login` — bcrypt compare, JWT issued, status check | **DONE** | `authController.js` | Token expiry not set | P1 |
| Logout | Client-side token deletion only | **PARTIAL** | Frontend localStorage | No server-side token revocation | P2 |
| Provider role | `node_participant` role in User model | **DONE** | `User.js` | — | — |
| Consumer role | `platform_client` role in User model | **DONE** | `User.js` | — | — |
| Both roles | `both` role in User model | **DONE** | `User.js` | — | — |
| Admin role | `admin` role in User model | **DONE** | `User.js` | — | — |
| User profile | `GET/PUT /api/users/profile` | **DONE** | `userController.js` | Profile image upload endpoint missing | P2 |
| Profile verification (email) | OTP-based email verification | **DONE** | `authController.js` | Actual email delivery missing | P1 |
| Password security | bcrypt salt 10, strength validation | **DONE** | `authController.js`, `validation.js` | — | — |
| MFA / TOTP | Not present | **NOT STARTED** | — | Full TOTP/2FA implementation | P3 |
| JWT authentication | Bearer token, `authMiddleware.js` | **DONE** | `authMiddleware.js` | Token expiry, refresh tokens | P1 |
| Token expiry | Not set in `generateToken.js` | **NOT STARTED** | `generateToken.js` | Add `expiresIn: '7d'`, implement refresh | P0 |
| Password reset | Full OTP-based reset flow | **DONE** | `authController.js` | — | — |
| Change password | `PUT /api/users/change-password` | **DONE** | `userController.js` | — | — |
| Block/unban users | Admin block/unblock with audit log | **DONE** | `adminController.js` | — | — |

---

## Provider (Node Participant) Features

| Requirement | Existing Implementation | Status | Files | Missing Work | Priority |
|---|---|---|---|---|---|
| Register/login as provider | Auth flow with `node_participant` role | **DONE** | `authController.js` | — | — |
| Create provider profile | Node registration `POST /api/node/register` | **DONE** | `nodeController.js` | — | — |
| Update provider profile | `PUT /api/node/settings` | **DONE** | `nodeController.js` | — | — |
| Set bandwidth limit (GB) | `bandwidthLimitMB` field, settable | **DONE** | `NodeDevice.js`, `nodeController.js` | — | — |
| Set Mbps limit (upload) | `uploadSpeedCapMbps` field | **DONE** | `NodeDevice.js` | Not actually enforced at network level | P0 |
| Set Mbps limit (download) | `downloadSpeedCapMbps` field | **DONE** | `NodeDevice.js` | Not actually enforced at network level | P0 |
| Set availability | Start/stop participation session | **DONE** | `nodeController.js` | — | — |
| Set pricing | Not present | **NOT STARTED** | — | No pricing model for bandwidth | P0 |
| Activate sharing | `POST /api/node/start` | **DONE** | `nodeController.js` | — | — |
| Deactivate sharing | `POST /api/node/stop` | **DONE** | `nodeController.js` | — | — |
| Start sharing session | `ParticipationSession` created | **DONE** | `nodeController.js` | — | — |
| Stop sharing session | `ParticipationSession` stopped | **DONE** | `nodeController.js` | — | — |
| View active consumers/sessions | `GET /api/node/session/current` | **PARTIAL** | `nodeController.js` | No true consumer assignment; only task assignment | P0 |
| View bandwidth shared | `bandwidthUsed` in session + `NodeDevice.usedBandwidthMB` | **DONE** | `nodeController.js`, `NodeDevice.js` | — | — |
| View earnings | `GET /api/node/transactions` + dashboard | **DONE** | `nodeController.js` | — | — |
| View transaction history | `CreditTransaction` records | **DONE** | `walletController.js` | — | — |
| WireGuard peer provisioning | Not present | **NOT STARTED** | — | Full WireGuard integration | P0 |
| Traffic routing through provider | Not present | **NOT STARTED** | — | VPN/NAT/forwarding | P0 |

---

## Consumer (Platform Client) Features

| Requirement | Existing Implementation | Status | Files | Missing Work | Priority |
|---|---|---|---|---|---|
| Register/login as consumer | Auth flow with `platform_client` role | **DONE** | `authController.js` | — | — |
| Select consumer role | Role selection at registration | **DONE** | Frontend register form | — | — |
| Discover available providers | `GET /api/node/` (no public listing endpoint) | **NOT STARTED** | — | Public provider discovery endpoint needed | P0 |
| View provider info | Admin can view nodes; no public endpoint | **NOT STARTED** | — | `GET /api/marketplace/providers` style endpoint | P0 |
| View price | No pricing system | **NOT STARTED** | — | Provider pricing model | P0 |
| View connection quality | Telemetry available server-side; not exposed to consumer | **PARTIAL** | `NodeTelemetry.js` | Consumer-facing quality display | P1 |
| View distance/location | No geolocation | **NOT STARTED** | — | Lat/long on provider, proximity sort | P2 |
| Select/allocate provider | Automatic via task queue scoring | **PARTIAL** | `taskAllocationService.js` | Manual selection not possible | P1 |
| Start connection/session | Submit task = start | **PARTIAL** | `taskController.js` | Not a VPN session; HTTP task only | P0 |
| Stop connection/session | Cancel task (no cancel endpoint) | **NOT STARTED** | — | `PUT /api/tasks/:id/cancel` endpoint | P0 |
| View real-time usage | Not exposed to consumer | **NOT STARTED** | — | Consumer-facing real-time metrics | P1 |
| View bandwidth speed | Not exposed to consumer | **NOT STARTED** | — | Consumer bandwidth speed display | P1 |
| View latency/stability | Task result has `latencyMs` | **PARTIAL** | `TaskResult.js` | Real-time display for consumer | P1 |
| View consumed data | `resultSummary.bandwidthConsumedMB` in task | **PARTIAL** | `TestingTask.js` | Consumer-facing session data display | P1 |
| View session cost | `estimatedCost` in task | **DONE** | `TestingTask.js` | — | — |
| View wallet balance | `GET /api/wallet` | **DONE** | `walletController.js` | — | — |
| View history | `GET /api/tasks/my-tasks` | **DONE** | `taskController.js` | — | — |

---

## Marketplace / Discovery

| Requirement | Existing Implementation | Status | Files | Missing Work | Priority |
|---|---|---|---|---|---|
| Provider listings | No public provider listing | **NOT STARTED** | — | Public listings endpoint | P0 |
| Provider availability | `NodeDevice.status` tracked | **PARTIAL** | `NodeDevice.js` | Not exposed to consumers | P0 |
| Provider status | Active/inactive/busy in DB | **PARTIAL** | `NodeDevice.js` | Consumer-facing status | P0 |
| Provider pricing | Not implemented | **NOT STARTED** | — | Pricing model on NodeDevice | P0 |
| Provider bandwidth capacity | `bandwidthLimitMB`, `usedBandwidthMB` tracked | **PARTIAL** | `NodeDevice.js` | Not exposed to consumer | P0 |
| Location/proximity | Not implemented | **NOT STARTED** | — | Geolocation fields, proximity sorting | P2 |
| Quality metrics | Telemetry exists, not consumer-facing | **PARTIAL** | `NodeTelemetry.js`, `NodeHeartbeat.js` | Consumer quality display | P1 |
| Search/filtering | Admin-only filtering; no consumer search | **PARTIAL** | `adminController.js` | Consumer-facing search | P1 |
| Provider selection | Automatic via allocation engine | **PARTIAL** | `taskAllocationService.js` | Manual consumer selection | P1 |
| Automatic provider allocation | Weighted scoring algorithm | **DONE** | `taskAllocationService.js` | — | — |
| Marketplace (reward redemption) | Products/orders for credit redemption | **DONE** | `marketplaceController.js` | — | — |

---

## Session Management

| Requirement | Existing Implementation | Status | Files | Missing Work | Priority |
|---|---|---|---|---|---|
| Session ID | `sessionId` string field | **DONE** | `ParticipationSession.js`, `TaskSession.js` | — | — |
| Provider ID | `deviceId`/`nodeId` in ParticipationSession | **DONE** | `ParticipationSession.js` | — | — |
| Consumer ID | `clientId` in TaskSession | **DONE** | `TaskSession.js` | — | — |
| Start time | `startTime`/`startedAt` | **DONE** | Both session models | — | — |
| End time | `endTime`/`stoppedAt` | **DONE** | Both session models | — | — |
| Assigned bandwidth | `bandwidthLimitMB` tracked | **PARTIAL** | `NodeDevice.js` | Not per-session assigned value | P1 |
| Data transferred | `bandwidthUsedMB` per session | **DONE** | `ParticipationSession.js` | — | — |
| Connection status | `status` enum in both models | **DONE** | Both session models | — | — |
| Price/rate | No per-session rate field | **PARTIAL** | `TestingTask.estimatedCost` | Per-session pricing model | P1 |
| Final cost | `estimatedCost` on task | **PARTIAL** | `TestingTask.js` | No refund for unused portion | P1 |
| Failure reason | `failTask` reason in `resultSummary.message` | **PARTIAL** | `TestingTask.js` | No `failureReason` field | P2 |
| Session lifecycle (AVAILABLE→COMPLETED) | `pending→assigned→running→completed/failed/settled` | **DONE** | `TestingTask.js` | Missing CONNECTING, STOPPING states | P2 |
| WireGuard tunnel lifecycle | Not present | **NOT STARTED** | — | Full VPN session lifecycle | P0 |

---

## WireGuard / Networking

| Requirement | Existing Implementation | Status | Files | Missing Work | Priority |
|---|---|---|---|---|---|
| WireGuard integration | Zero code | **NOT STARTED** | — | Full WireGuard implementation | P0 |
| Key generation | Zero code | **NOT STARTED** | — | `wg genkey`, public/private key fields | P0 |
| Peer creation | Zero code | **NOT STARTED** | — | Peer provisioning on backend | P0 |
| Config generation | Zero code | **NOT STARTED** | — | `wg-quick` config templating | P0 |
| Consumer tunnel establishment | Zero code | **NOT STARTED** | — | VPN client integration | P0 |
| Traffic routing through provider | Zero code | **NOT STARTED** | — | IP forwarding, routing tables | P0 |
| IP forwarding | Zero code | **NOT STARTED** | — | `/proc/sys/net/ipv4/ip_forward` | P0 |
| NAT/masquerade | Zero code | **NOT STARTED** | — | `iptables`/`nftables` postrouting | P0 |
| Bandwidth metering via tunnel | Zero code | **NOT STARTED** | — | `wg show` / `vnstat` / eBPF | P0 |
| VPN session start/stop | Zero code | **NOT STARTED** | — | Backend orchestration | P0 |

---

## Monitoring / Metering

| Requirement | Existing Implementation | Status | Files | Missing Work | Priority |
|---|---|---|---|---|---|
| Bytes downloaded | ✅ Real (HTTP response body size) | **DONE** | `taskExecutor.js`, `TaskExecutorService.dart` | — | — |
| Bytes uploaded | ⚠️ Fixed 0.01MB estimate | **PARTIAL** | `taskExecutor.js` | Real upload measurement | P2 |
| Total GB consumed | `NodeDevice.usedBandwidthMB` cumulative | **DONE** | `nodeController.js` | — | — |
| Connection duration | Session start/end time | **DONE** | `ParticipationSession.js` | — | — |
| Speed (Mbps) | Not measured | **NOT STARTED** | — | Throughput measurement | P1 |
| Latency | ✅ Real TTFB via `performance.now()` | **DONE** | `taskExecutor.js` | — | — |
| Packet loss | ⚠️ Via failed HTTP pings | **PARTIAL** | `taskExecutor.js` | True ICMP/network packet loss | P2 |
| Tunnel health | Not applicable (no tunnel) | **NOT STARTED** | — | — | P0 |
| Provider online/offline | Heartbeat eviction (35s) | **DONE** | `socketService.js` | — | — |
| Real-time updates | Socket.IO `telemetry_update` events | **DONE** | `socketService.js` | — | — |
| CPU usage (node) | ✅ Real via `os.cpus()` | **DONE** | `metricsCollector.js` | Mobile hardcoded 5.0 | P2 |
| Memory usage (node) | ✅ Real via `os.freemem()` | **DONE** | `metricsCollector.js` | Mobile hardcoded 25.0 | P2 |

---

## Wallet / Billing

| Requirement | Existing Implementation | Status | Files | Missing Work | Priority |
|---|---|---|---|---|---|
| Consumer wallet | `Wallet` model + API | **DONE** | `Wallet.js`, `walletController.js` | — | — |
| Provider wallet | Same `Wallet` model | **DONE** | `Wallet.js` | — | — |
| Credits system | Credits as unit of exchange | **DONE** | `walletService.js` | — | — |
| Balance display | `GET /api/wallet` | **DONE** | `walletController.js` | — | — |
| Top-up (real payment) | Not implemented | **NOT STARTED** | — | Stripe/PayPal integration | P1 |
| Charging consumer | `deductCredits()` on task submit | **DONE** | `walletService.js` | — | — |
| Session cost calculation | `executionLimit × 10` formula | **DONE** | `taskController.js` | More sophisticated pricing | P1 |
| Provider earnings | `addCredits()` on task completion | **DONE** | `walletService.js` | — | — |
| Platform commission | Not deducted | **NOT STARTED** | — | Commission model | P1 |
| Transaction history | `CreditTransaction` per event | **DONE** | `walletController.js` | — | — |
| Provider payout (fiat) | Not implemented | **NOT STARTED** | — | Bank/crypto payout | P2 |
| Refund on failure | No auto-refund on task failure | **NOT STARTED** | — | `failTask` should refund | P1 |
| Refund on order cancel | ✅ Implemented in marketplace | **DONE** | `marketplaceController.js` | — | — |

---

## Admin Panel

| Requirement | Existing Implementation | Status | Files | Missing Work | Priority |
|---|---|---|---|---|---|
| Total users count | Dashboard endpoint | **DONE** | `adminController.js` | — | — |
| Providers/nodes list | `GET /api/admin/nodes` | **DONE** | `adminController.js` | — | — |
| Consumers list | `GET /api/admin/users` with role filter | **DONE** | `adminController.js` | — | — |
| Active sessions | Via tasks status filter | **PARTIAL** | `adminController.js` | Dedicated session view | P2 |
| Active providers | `activeNodes` count | **DONE** | `adminController.js` | — | — |
| GB/data traded | Sum of `bandwidthConsumedMB` in results | **PARTIAL** | `adminController.js` | No dedicated stats endpoint | P2 |
| Platform revenue | Not tracked | **NOT STARTED** | — | Commission tracking | P1 |
| Transaction history | `GET /api/admin/transactions` | **DONE** | `adminController.js` | — | — |
| Latency/health metrics | Via nodes list | **PARTIAL** | — | Dedicated health dashboard | P2 |
| Tunnel/network health | Not applicable (no tunnel) | **NOT STARTED** | — | — | — |
| System alerts | Not implemented | **NOT STARTED** | — | Alert system | P2 |
| User details | User list with all fields | **DONE** | `adminController.js` | — | — |
| Ban/unban user | `block`/`unblock` endpoints | **DONE** | `adminController.js` | — | — |
| Disputes | Not implemented | **NOT STARTED** | — | Dispute model and workflow | P2 |
| Verification management | `isVerified` filter on user list | **PARTIAL** | `adminController.js` | Manual verification actions | P2 |
| Admin audit logs | `AdminLog` model + endpoint | **DONE** | `adminController.js`, `AdminLog.js` | — | — |
| Real-time Socket events in admin | Server emits to `admin_room` | **PARTIAL** | `socketService.js` | Admin UI not consuming socket events | P2 |

---

## Infrastructure

| Requirement | Existing Implementation | Status | Files | Missing Work | Priority |
|---|---|---|---|---|---|
| Docker Compose | 6-service composition (mongo, redis, ml, backend, agent, frontend) | **DONE** | `docker-compose.yml` | Pre-seed agent API key | P1 |
| MongoDB | Connected via Mongoose | **DONE** | `config/db.js` | — | — |
| Redis (optional) | BullMQ with in-memory fallback | **DONE** | `taskQueueService.js` | — | — |
| ML service | Flask RandomForest — deployed but not integrated | **PARTIAL** | `ml-service/` | Wire to backend scoring | P2 |
| Email service | Not implemented | **NOT STARTED** | — | SMTP/SendGrid integration | P1 |
| File upload / storage | Not implemented | **NOT STARTED** | — | Profile image upload | P2 |
| Environment secrets | Committed `.env` with weak JWT secret | **BROKEN** | `.env` | Move to secrets manager, strong key | P0 |
