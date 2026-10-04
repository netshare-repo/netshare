# NetShare — Next Steps & Implementation Plan
> Generated: 2026-09-25

---

## ⚠️ Strategic Decision Required First

Before implementing, you must decide:

**Option A**: Keep the current architecture (distributed HTTP testing marketplace) and rename/rebrand the system accordingly. This is the path of least resistance — the system already works for this purpose.

**Option B**: Pivot to the original goal (peer-to-peer bandwidth sharing via WireGuard). This requires rebuilding the core networking layer from scratch. The existing auth, wallet, session, and admin infrastructure can be reused.

**The tasks below assume Option B** (building toward the stated FYP goal of P2P bandwidth sharing with WireGuard). Tasks that apply equally to Option A are marked [A/B].

---

## P0 — Required for Basic Working NetShare Demo

These tasks are the absolute minimum for a functional, demo-able system that matches the FYP description.

---

### P0-1: Fix JWT Token Expiry [A/B]
**Reason**: JWTs issued today never expire — a critical security flaw and a requirement for any demo.

**Files affected**:
- `netshare-backend/utils/generateToken.js`
- `netshare-backend/controllers/authController.js`

**Changes needed**:
- Add `expiresIn: '7d'` to `jwt.sign()` in `generateToken.js`
- Add a `POST /api/auth/refresh` endpoint (optional but recommended)

**Dependencies**: None

**Acceptance criteria**: Issued tokens expire after 7 days. Frontend redirects to login on 401.

---

### P0-2: Fix CORS [A/B]
**Reason**: `origin: "*"` with `credentials: true` is a security anti-pattern that browsers block, and is a red flag in any FYP defense.

**Files affected**:
- `netshare-backend/server.js`

**Changes needed**:
```js
cors({
  origin: ['http://localhost:3000', process.env.FRONTEND_URL],
  credentials: true
})
```

**Dependencies**: Add `FRONTEND_URL` to `.env`

**Acceptance criteria**: CORS restricted to known origins. Cross-origin requests from other domains rejected.

---

### P0-3: Remove `.env` from Repository [A/B]
**Reason**: `.env` with DB URI and JWT secret is committed. This is a critical security issue.

**Files affected**:
- `.gitignore` (add `*.env`, `.env`)
- `netshare-backend/.env` (remove from git, add to `.gitignore`)
- Create `netshare-backend/.env.example` with placeholder values

**Dependencies**: None

**Acceptance criteria**: `.env` not in git history. `.env.example` committed with safe placeholder values.

---

### P0-4: Email Service for OTP Delivery [A/B]
**Reason**: OTPs are currently returned in the API response body (`devOtp`). Without actual email delivery, the auth system doesn't work in production.

**Files affected**:
- New: `netshare-backend/services/emailService.js`
- `netshare-backend/controllers/authController.js` (add email call)
- `netshare-backend/.env` (add SMTP vars)

**Changes needed**:
- Integrate `nodemailer` (SMTP) or `@sendgrid/mail` (SendGrid free tier)
- Send OTP to user email in `registerUser`, `resendSignupOtp`, `forgotPassword`
- Remove `devOtp` from production responses (keep only in `NODE_ENV=development`)

**Dependencies**: SMTP credentials or SendGrid API key

**Acceptance criteria**: User receives OTP email within 30 seconds. `devOtp` not in production response.

---

### P0-5: WireGuard Backend Integration — Key Generation & Peer Provisioning
**Reason**: The core of the FYP is peer-to-peer bandwidth sharing via WireGuard. Without this, the system cannot be called NetShare.

**Files affected**:
- New: `netshare-backend/services/wireguardService.js`
- New: `netshare-backend/models/WireGuardPeer.js`
- `netshare-backend/models/NodeDevice.js` (add wg fields)
- New API routes in `nodeRoutes.js`

**Changes needed**:
1. Add fields to `NodeDevice`: `wgPublicKey`, `wgPrivateKey` (encrypted), `wgEndpoint`, `wgListenPort`, `wgAllowedIPs`
2. `wireguardService.js` using `child_process.execSync('wg genkey')` / `wg pubkey` OR the `@viselect/wireguard` / pure-JS `@noble/curves` library for key generation
3. `POST /api/node/wg/setup` — generates key pair, stores, returns public key
4. `POST /api/node/wg/peer` — creates peer config for a consumer session
5. Store WireGuard private key encrypted (AES-256-GCM)

**Dependencies**: Linux server with `wireguard-tools` installed, or pure-JS key generation library

**Acceptance criteria**: Provider node can register a WireGuard public key. Backend can generate peer configurations.

---

### P0-6: WireGuard Provider Agent (Start/Stop Tunnel)
**Reason**: Provider must be able to start a WireGuard interface and add/remove consumer peers.

**Files affected**:
- New: `netshare-agent/src/wireguardManager.js`
- `netshare-agent/agent.js` (add wg event handlers)

**Changes needed**:
- `wireguardManager.js`:
  - `createInterface(config)` → write `wg0.conf`, run `wg-quick up wg0`
  - `addPeer(publicKey, allowedIPs)` → `wg set wg0 peer ...`
  - `removePeer(publicKey)` → `wg set wg0 peer ... remove`
  - `getStats()` → parse `wg show wg0 transfer`
  - `enableForwarding()` → `echo 1 > /proc/sys/net/ipv4/ip_forward`
  - `setupNAT(interface)` → `iptables -t nat -A POSTROUTING -o <eth0> -j MASQUERADE`
- Handle Socket.IO events: `wg_peer_add`, `wg_peer_remove`

**Dependencies**: P0-5, Linux with `wireguard-tools`, root or `CAP_NET_ADMIN` capability

**Acceptance criteria**: Provider node can bring up WireGuard interface and add a consumer peer via Socket.IO command.

---

### P0-7: Consumer Provider Discovery Endpoint [A/B]
**Reason**: Consumers currently have no way to discover available providers. This is needed for any demo.

**Files affected**:
- `netshare-backend/controllers/nodeController.js` (new function)
- `netshare-backend/routes/nodeRoutes.js`
- Frontend `Marketplace.jsx` or new `ProviderList.jsx`

**Changes needed**:
- `GET /api/providers` — public (or auth-required) endpoint returning active nodes with: `deviceName`, `region`, `latencyMs`, `bandwidthLimitMB`, `usedBandwidthMB`, `uploadSpeedCapMbps`, `downloadSpeedCapMbps`, `reliabilityScore`, `successRate`, `status`
- Remove sensitive fields: `apiKey`, `userId`, `deviceFingerprint`
- Support query params: `region`, `minSpeed`, `maxLatency`

**Dependencies**: None

**Acceptance criteria**: Consumer can fetch list of available providers with quality metrics. Filtered by region and speed.

---

### P0-8: Consumer VPN Connection Flow
**Reason**: This is the core consumer feature — connecting to a provider via WireGuard.

**Files affected**:
- New: `netshare-backend/controllers/connectionController.js`
- New: `netshare-backend/routes/connectionRoutes.js`
- New: `netshare-backend/models/VpnSession.js`
- Flutter app: new connection flow screens

**Changes needed**:
1. `POST /api/connections/request` — consumer selects provider, creates `VpnSession` (status: `requested`)
2. Backend signals provider via Socket.IO to add consumer peer
3. Backend generates consumer WireGuard config (private key, endpoint, allowed IPs)
4. `GET /api/connections/:id/config` — returns WireGuard config for consumer
5. `POST /api/connections/:id/stop` — remove peer, close session, bill consumer
6. `VpnSession` model: `consumerId`, `providerId`, `status`, `startTime`, `endTime`, `consumerPublicKey`, `providerEndpoint`, `assignedIP`, `dataUsedMB`, `costCredits`

**Dependencies**: P0-5, P0-6, P0-7

**Acceptance criteria**: Consumer can request connection, receive WireGuard config, and a real VPN tunnel is established.

---

### P0-9: Real Bandwidth Metering via WireGuard
**Reason**: Credits must be charged based on real data consumption, not task-based estimates.

**Files affected**:
- `netshare-agent/src/wireguardManager.js`
- `netshare-backend/services/socketService.js`
- `netshare-backend/services/walletService.js`

**Changes needed**:
- Agent periodically runs `wg show wg0 transfer` → parses `rx_bytes`, `tx_bytes` per peer
- Reports via Socket.IO `bandwidth_report` event every 30 seconds
- Backend handler: computes delta, deducts consumer credits, credits provider wallet
- Stop session if consumer balance hits zero

**Dependencies**: P0-6, P0-8

**Acceptance criteria**: Consumer is charged in real-time based on actual WireGuard transfer bytes. Provider earns proportionally.

---

### P0-10: Task Cancellation Endpoint [A/B]
**Reason**: Consumers have no way to cancel a task/session once started. Also needed for system cleanup.

**Files affected**:
- `netshare-backend/controllers/taskController.js`
- `netshare-backend/routes/taskRoutes.js`

**Changes needed**:
- `DELETE /api/tasks/:id` or `PUT /api/tasks/:id/cancel`
- Refund remaining credits if task was `pending` (not yet executed)
- Node must be notified to stop execution if `running`

**Dependencies**: None

**Acceptance criteria**: Consumer can cancel pending task and receive credit refund. Running tasks are stopped gracefully.

---

## P1 — Required for Complete FYP

---

### P1-1: Failure Refund on Task/Session Failure [A/B]
**Reason**: When a task fails, the consumer loses credits with no refund. This is unfair and broken.

**Files affected**:
- `netshare-backend/controllers/taskController.js` (`failTask` function)
- `netshare-backend/services/walletService.js`

**Changes needed**:
- In `failTask()`, call `addCredits()` to refund `task.estimatedCost` to `task.clientId`
- Create a `CreditTransaction` with type `credit` and description `"Refund for failed task"`

**Dependencies**: None

**Acceptance criteria**: Consumer receives full credit refund when task fails.

---

### P1-2: Platform Commission Deduction [A/B]
**Reason**: A marketplace platform takes a commission. Currently 100% of the client's payment goes to nothing (the cost is burned), and the node earns separately from a reward formula — there's no financial coherence.

**Files affected**:
- `netshare-backend/services/walletService.js`
- `netshare-backend/controllers/taskController.js`
- New: `netshare-backend/models/PlatformRevenue.js` or field in `AdminLog`

**Changes needed**:
- Define `PLATFORM_COMMISSION = 0.20` (20%)
- Node reward = `estimatedCost × (1 - PLATFORM_COMMISSION)`
- Platform revenue = `estimatedCost × PLATFORM_COMMISSION`
- Track platform revenue in a dedicated collection or admin summary

**Dependencies**: None

**Acceptance criteria**: Platform retains 20% of each transaction. Admin can see total platform revenue.

---

### P1-3: Real-Time Admin Socket Dashboard [A/B]
**Reason**: The backend emits rich Socket.IO events to `admin_room` but the admin frontend does not consume them.

**Files affected**:
- `netshare-frontend/src/pages/admin/AdminDashboard.jsx`
- New: `netshare-frontend/src/services/socketService.js`

**Changes needed**:
- Create `SocketContext` / hook for the frontend
- Admin connects to Socket.IO on login with JWT
- Listen to: `node_status_change`, `task_assigned_event`, `task_completed_event`, `telemetry_update`
- Display: live connected nodes count, live task stream, real-time alert feed

**Dependencies**: None (backend already emits events)

**Acceptance criteria**: Admin dashboard shows live node connections and task activity without page refresh.

---

### P1-4: Integrate ML Service into Node Allocation [A/B]
**Reason**: The ML service is deployed and running but never called. This is a significant FYP feature that currently has zero usage.

**Files affected**:
- `netshare-backend/services/taskAllocationService.js`
- `netshare-backend/server.js` (or new `mlService.js`)

**Changes needed**:
- Add `axios` call to `http://ml-service:5001/rank-nodes` in `findAvailableNode()`
- Pass candidate nodes with their telemetry metrics
- Use ML-ranked order as primary sort (fall back to JS formula on ML service failure)

**Dependencies**: ML service running (already in Docker)

**Acceptance criteria**: Node allocation uses ML-predicted scores when ML service is reachable. Falls back to JS formula gracefully.

---

### P1-5: Consumer Real-Time Session Monitoring [A/B]
**Reason**: Consumer has no real-time visibility into their active session. Only task status via polling.

**Files affected**:
- `netshare-frontend/src/pages/client/ClientDashboard.jsx`
- New: active session component
- Backend: emit events to `client_${id}` room (already done)

**Changes needed**:
- Frontend connects to Socket.IO as client
- Listens to `task_assigned_event`, `task_started_event`, `task_completed_event`
- Shows live task status, latency, bandwidth consumed

**Dependencies**: P1-3 (socket service reuse)

**Acceptance criteria**: Consumer sees live task progress in real-time without polling.

---

### P1-6: Provider Pricing Model
**Reason**: Providers cannot set a price for their bandwidth. The reward formula is determined by the platform only.

**Files affected**:
- `netshare-backend/models/NodeDevice.js`
- `netshare-backend/controllers/nodeController.js`
- `netshare-backend/services/rewardService.js`

**Changes needed**:
- Add `pricePerMB` (credits) field to `NodeDevice`
- Allow provider to set their price in node settings
- Adjust reward calculation: `reward = bandwidthMB × provider.pricePerMB × (1 - PLATFORM_COMMISSION)`

**Dependencies**: P1-2

**Acceptance criteria**: Provider can set their price. Consumer sees provider price before connecting.

---

### P1-7: Consumer-Facing Provider Discovery UI
**Reason**: Consumers have no screen to browse and select providers.

**Files affected**:
- New: `netshare-frontend/src/pages/client/Providers.jsx`
- `netshare-frontend/src/api/nodeApi.js` (add `getProviders()`)
- `netshare-frontend/src/routes/AppRoutes.jsx`

**Changes needed**:
- Provider listing page showing: region, speed, reliability score, price, latency, online status
- Filter by region, min speed
- "Connect" button → triggers session request

**Dependencies**: P0-7

**Acceptance criteria**: Consumer can browse providers and initiate connection.

---

### P1-8: Admin User Creation / Seeding [A/B]
**Reason**: There is no way to create an admin user through the UI or API. Must currently be done via direct MongoDB manipulation.

**Files affected**:
- New: `netshare-backend/scripts/createAdmin.js`
- Optionally: `POST /api/admin/create-admin` (admin-only)

**Changes needed**:
- CLI seed script: `node scripts/createAdmin.js --email admin@netshare.com --password <strong>`
- Creates User with role `admin`, verifies, creates Wallet

**Dependencies**: None

**Acceptance criteria**: Developer can create initial admin user via script. Admin can log in to panel.

---

### P1-9: Mobile App Real System Metrics [A/B]
**Reason**: Flutter mobile heartbeat sends hardcoded `cpuUsage: 5.0, memoryUsage: 25.0`. Real metrics should be reported.

**Files affected**:
- `Netshare/netshare_node_app/lib/services/socket_service.dart`
- Add: `device_info_plus` / `system_info_plus` Flutter package

**Changes needed**:
- Replace hardcoded values with real CPU and memory from device
- Use `dart:ffi` or platform channels for CPU usage if needed

**Dependencies**: None

**Acceptance criteria**: Mobile heartbeat reports real CPU and memory utilization.

---

### P1-10: Docker Agent Pre-Seeding [A/B]
**Reason**: `docker-compose.yml` agent uses API key `nsk_live_docker_demo_agent_key_01` which must already exist in MongoDB. Without seeding, the agent fails on startup.

**Files affected**:
- New: `netshare-backend/scripts/seedDockerAgent.js`
- `docker-compose.yml` (add init container or `command`)

**Changes needed**:
- Seed script creates a `node_participant` user, verifies them, creates wallet, creates `NodeDevice` with the hardcoded API key
- Run as Docker entrypoint or `docker-compose` init condition

**Dependencies**: None

**Acceptance criteria**: `docker compose up` results in a fully functional stack including a connected agent node.

---

## P2 — Enhancements

---

### P2-1: Refresh Token Implementation [A/B]
Add refresh token endpoint (`POST /api/auth/refresh`) with short-lived access token (15min) and long-lived refresh token (30d) stored in httpOnly cookie.

**Files**: `authController.js`, `generateToken.js`, new `Token` model

---

### P2-2: SMTP Email Service [A/B]
Integrate `nodemailer` with configurable SMTP (or SendGrid). Send branded HTML email for OTP delivery.

**Files**: New `emailService.js`, `authController.js`

---

### P2-3: Profile Image Upload [A/B]
Add `POST /api/users/upload-avatar` using `multer` + local storage or AWS S3.

**Files**: `userController.js`, `userRoutes.js`, new `uploadMiddleware.js`

---

### P2-4: Task Cancellation with Partial Refund [A/B]
If task is `running`, refund partial credits based on unused `executionLimit`.

**Files**: `taskController.js`, `walletService.js`

---

### P2-5: Admin Node Telemetry Charts [A/B]
Admin dashboard to display historical telemetry charts (latency, bandwidth) per node using Recharts.

**Files**: `AdminDashboard.jsx`, new `NodeDetail.jsx` admin page

---

### P2-6: Geolocation on Provider [B]
Add `location: { lat, lng, city, country }` to `NodeDevice`. Sort providers by proximity in consumer discovery.

**Files**: `NodeDevice.js`, `nodeController.js`, `taskAllocationService.js`

---

### P2-7: Platform Revenue Dashboard [A/B]
Admin screen showing total platform revenue, monthly breakdown, top earners.

**Files**: New `adminController.getPlatformRevenue()`, admin frontend

---

### P2-8: Dispute System [A/B]
Model `Dispute { sessionId, reportedBy, reason, status, resolution }`. Consumer can open a dispute for a failed/unsatisfactory session.

**Files**: New `Dispute.js` model, controller, admin UI

---

### P2-9: Verification Badge [A/B]
Admin can manually verify a provider (e.g., after KYC). Providers with verification badge shown first in discovery.

**Files**: `NodeDevice.js` add `isVerified`, admin UI

---

### P2-10: Alert System [A/B]
Backend detects anomalies (node offline > 1h, task queue depth > 50, bandwidth exhausted) and stores `SystemAlert` records. Admin panel displays active alerts.

**Files**: New `SystemAlert.js`, new `alertService.js`, admin UI

---

## P3 — Future Work

---

### P3-1: Real Money Integration
Stripe payment gateway for wallet top-up. Provider payout via bank transfer or crypto (USDC on Polygon). Requires business registration and KYC.

---

### P3-2: iOS VPN Extension
For true consumer VPN on iOS, a `NetworkExtension` target using `NEPacketTunnelProvider` is needed. This requires Apple Developer program membership and VPN entitlement.

---

### P3-3: Android VPN Service
`VpnService` Android API for consumer-side tunnel. WireGuard Android library (wireguard-android).

---

### P3-4: Multi-Hop Routing
Route consumer traffic through multiple provider hops for privacy. Requires onion-routing or proxy chain design.

---

### P3-5: BGP/Anycast for Provider Selection
Use Anycast routing to direct consumer traffic to the geographically closest active provider automatically.

---

### P3-6: WebRTC Data Channels
Alternative to WireGuard for browser-based consumers. WebRTC peer connections with data channel for bandwidth sharing.

---

### P3-7: Kubernetes / Helm Deployment
Replace Docker Compose with Kubernetes. Auto-scale node-agent workers. Add Prometheus + Grafana for observability.

---

### P3-8: Fraud Detection
ML model to detect fake bandwidth reporting by node agents (submit task_completed with inflated bandwidth). Cross-validate with actual HTTP response sizes.

---

## Implementation Order Summary

```
Week 1-2 (P0 Critical):
  P0-1: JWT expiry
  P0-2: CORS fix
  P0-3: Remove .env from repo
  P0-4: Email OTP delivery
  P0-10: Task cancellation
  P0-7: Provider discovery endpoint

Week 3-4 (P0 WireGuard Core):
  P0-5: WireGuard backend key generation
  P0-6: WireGuard agent integration
  P0-8: Consumer VPN connection flow
  P0-9: Real bandwidth metering

Week 5-6 (P1 Completeness):
  P1-1: Failure refunds
  P1-2: Platform commission
  P1-3: Admin real-time socket UI
  P1-4: ML service integration
  P1-8: Admin seeding script
  P1-10: Docker agent seeding

Week 7-8 (P1 Features):
  P1-5: Consumer real-time monitoring
  P1-6: Provider pricing
  P1-7: Consumer discovery UI
  P1-9: Mobile real metrics

Week 9+ (P2 Polish):
  P2-1 through P2-10: Enhancements for FYP defense quality
```
