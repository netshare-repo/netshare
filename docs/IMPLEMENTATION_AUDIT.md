# NetShare — Implementation Audit
> Generated: 2026-09-25 | Based on full code inspection of all source files

---

## ⚠️ CRITICAL ARCHITECTURAL NOTE

> **NetShare is NOT a bandwidth-sharing / VPN platform as described in its README.**
>
> The repository implements a **distributed web-testing marketplace** where:
> - "Providers" (called `node_participant`) share their internet connection to perform **HTTP performance tests and page fetches** on behalf of clients.
> - "Consumers" (called `platform_client`) submit **website testing tasks** (ad verification, accessibility testing, localization testing, performance testing).
> - Credits are exchanged based on bandwidth used during testing.
>
> **There is no WireGuard, no VPN tunnel, no peer-to-peer bandwidth sharing, no IP forwarding, no NAT, and no consumer traffic routed through a provider's connection.** The system routes HTTP requests from the node agent to target URLs on behalf of clients — not consumer internet traffic through providers.

---

## 1. Repository Structure

```
NetshareCode/
├── netshare-backend/          # Node.js/Express API + Socket.IO server
│   ├── config/db.js
│   ├── controllers/           # 8 controllers
│   ├── middleware/            # auth, role, security, error
│   ├── models/                # 12 Mongoose models
│   ├── routes/                # 8 route files
│   ├── services/              # socket, task queue, wallet, reward, allocation
│   ├── utils/                 # token, session token, validation
│   └── workers/taskWorker.js
├── netshare-frontend/         # React + Vite web admin/client/node dashboard
│   └── src/
│       ├── api/               # 5 API client modules
│       ├── components/        # auth guards, layout, sidebar, etc.
│       ├── contexts/          # auth context
│       ├── pages/             # 26 pages (auth, client, node, admin, common)
│       └── routes/AppRoutes.jsx
├── Netshare/netshare_node_app/ # Flutter mobile app (node participant only)
│   └── lib/
│       ├── screens/           # 14 screens
│       ├── services/          # 8 services incl. Socket.IO + task executor
│       └── models/            # 6 data models
├── netshare-agent/            # Node.js headless daemon for desktop/server nodes
│   └── src/                   # heartbeat, metrics, socket client, task executor, receiver
├── ml-service/                # Python Flask ML ranking microservice
│   ├── app.py
│   └── nodeRanking.py         # RandomForest node suitability ranker
├── tests/distributedSystemTest.js
├── docker-compose.yml         # Full stack deployment (6 services)
└── docker-compose.dev.yml
```

---

## 2. Authentication and User Management

### What Exists

| Feature | Status | Notes |
|---|---|---|
| User registration | **DONE** | `POST /api/auth/register` — bcrypt hashing, email+role+phone |
| Email OTP verification | **DONE** | SHA-256 hashed OTP stored, 10-min expiry, wallet created on verify |
| Resend OTP | **DONE** | `POST /api/auth/resend-signup-otp` |
| Login | **DONE** | `POST /api/auth/login` — bcrypt compare, JWT issued |
| Forgot password (OTP) | **DONE** | `POST /api/auth/forgot-password` |
| Verify reset OTP | **DONE** | `POST /api/auth/verify-reset-otp` |
| Reset password | **DONE** | `POST /api/auth/reset-password` — OTP re-verified on submit |
| JWT token auth | **DONE** | `authMiddleware.js` — Bearer token, user status check |
| Role-based access | **DONE** | `roleMiddleware.js` — `allowRoles(...roles)` guard |
| Get current user | **DONE** | `GET /api/auth/me` |
| Update profile | **DONE** | `PUT /api/users/profile` — name, phone, profileImage |
| Change password | **DONE** | `PUT /api/users/change-password` |
| Block/unban user | **DONE** | Admin only — `PUT /api/admin/users/:id/block` |
| User roles | **DONE** | `node_participant`, `platform_client`, `admin`, `both` |
| Email sending (actual) | **NOT IMPLEMENTED** | OTP is returned in response body in dev mode only; no email provider |
| MFA / TOTP | **NOT IMPLEMENTED** | — |
| Refresh tokens | **NOT IMPLEMENTED** | Tokens do not expire by default (no `expiresIn` set in `generateToken.js`) |
| Profile image upload | **PARTIAL** | Field exists; no file upload endpoint, no storage |

### Security Assessment

| Item | Status | Notes |
|---|---|---|
| Password hashing | ✅ bcrypt (salt 10) | Correct |
| JWT secret | ⚠️ WEAK | `.env` contains `netshare_phase_one_secret` (short, non-random) |
| Token expiry | ❌ None set | `generateToken.js` does not pass `expiresIn` |
| CORS | ⚠️ `origin: "*"` | Accepts all origins — insecure for production |
| Rate limiting | ✅ Custom in-memory | 120 req/min per IP — functional but lost on restart |
| Input sanitization | ✅ Script tag stripping | Basic XSS prevention |
| NoSQL injection | ✅ Mongoose | Parameterized queries by default |
| `.env` in repo | ⚠️ Yes | `.env` file committed with credentials |
| Secrets exposure | ⚠️ devOtp in response | OTP returned in response body in dev mode |

---

## 3. Database Models (MongoDB/Mongoose)

### User
- **Fields**: `name`, `email` (unique), `phone`, `password` (hashed), `role`, `profileImage`, `status` (active/blocked), `isVerified`, `signupOtpHash`, `signupOtpExpires`, `resetOtpHash`, `resetOtpExpires`, timestamps
- **Relations**: Referenced by all other models
- **Missing**: No `lastLoginAt`, no `createdByAdmin` flag, no address/location
- **Status**: ✅ Functional

### Wallet
- **Fields**: `userId` (ref User, unique), `balance` (default 500), `earnedCredits`, `spentCredits`, timestamps
- **Missing**: No currency field, no `topUpHistory`, no payout flag, no fiat/payment integration
- **Status**: ✅ Functional (credit system only, no real money)

### CreditTransaction
- **Fields**: `userId`, `taskId` (ref TestingTask), `type` (credit/debit), `amount`, `description`, `status`, timestamps
- **Missing**: No `sessionId` ref to ParticipationSession, no platform commission field
- **Status**: ✅ Functional

### NodeDevice (Provider equivalent)
- **Fields**: `userId`, `deviceName`, `deviceId`, `deviceFingerprint`, `region`, `status` (active/inactive/paused/busy), `bandwidthLimitMB`, `usedBandwidthMB`, `uploadSpeedCapMbps`, `downloadSpeedCapMbps`, `speedCapMbps`, `maxConcurrentTasks`, `currentActiveTasks`, `reliabilityScore`, `successRate`, `latencyMs`, `lastSeenAt`, `apiKey`, timestamps
- **Missing**: No `publicKey`/`privateKey` (WireGuard), no `endpoint`, no `listenPort`, no `pricing`, no `location` (lat/long)
- **Status**: ✅ Functional for task marketplace; ❌ No VPN/bandwidth-sharing fields

### ParticipationSession (Provider session)
- **Fields**: `sessionId`, `userId`, `deviceId`/`nodeId` (ref NodeDevice), `status` (active/stopped/paused), `startTime`/`startedAt`, `endTime`/`stoppedAt`, `bandwidthUsed`/`bandwidthUsedMB`, `latency`, `packetLoss`, `networkQuality`, `activeTasksCount`, `creditsEarned`, timestamps
- **Missing**: No `consumerId`, no VPN connection state, no IP assignment
- **Status**: ✅ Functional for participation lifecycle

### TestingTask (Consumer task = "Order")
- **Fields**: `clientId`, `targetUrl`, `serviceType` (ad_verification/accessibility_testing/localization_testing/performance_testing), `targetRegion`, `executionLimit`, `estimatedCost`, `assignedNodeId`, `status` (pending/assigned/running/completed/failed/settled/cancelled), `resultSummary`, timestamps
- **Status**: ✅ Functional

### TaskSession
- **Fields**: `taskId`, `clientId`, `nodeId`, `sessionToken`, `status` (created/running/completed/failed), `simulatedSecureChannel` (boolean, always true), `bandwidthUsedMB`, `latencyMs`, `logs[]`, timestamps
- **Notable**: Field `simulatedSecureChannel: true` — hardcoded simulation flag
- **Status**: ✅ Functional (session management works)

### TaskResult
- **Fields**: `taskId`, `nodeId`, `clientId`, `nodeUserId`, `serviceType`, `targetUrl`, `success`, `successRate`, `latencyMs`, `packetLoss`, `bandwidthUsedMB`, `statusCode`, `resultData`, `completedAt`, timestamps
- **Status**: ✅ Functional (immutable result record)

### BandwidthUsage
- **Fields**: `nodeId`, `sessionId`, `taskId`, `uploadBandwidthMB`, `downloadBandwidthMB`, `totalBandwidthMB`, `networkAvailability`, `timestamp`, timestamps
- **Status**: ✅ Functional — records per-task and per-telemetry bandwidth

### NodeHeartbeat
- **Fields**: `nodeId`, `status`, `cpuUsage`, `memoryUsage`, `networkStatus` (latencyMs, upload/download speed, packetLoss, ipAddress), `timestamp`
- **TTL**: 7 days auto-expiry
- **Status**: ✅ Functional

### NodeTelemetry
- **Fields**: `nodeId`, `cpuUsage`, `memoryUsage`, `bandwidthUsed`, `latency`, `packetLoss`, `onlineStatus`, `timestamp`
- **TTL**: 14 days auto-expiry
- **Status**: ✅ Functional

### MarketplaceProduct
- **Fields**: `name`, `description`, `category` (subscription/digital_tool/voucher/software/other), `requiredCredits`, `imageUrl`, `stock`, `status`, timestamps
- **Status**: ✅ Functional — reward redemption marketplace

### MarketplaceOrder
- **Fields**: `userId`, `productId`, `productName`, `creditsSpent`, `status` (pending/fulfilled/cancelled/rejected), `fulfilmentNote`, `fulfilledBy`, `fulfilledAt`, `refundedAt`, `refundedCredits`, `refundTransactionId`, timestamps
- **Status**: ✅ Functional — including refund logic

### AdminLog
- **Fields**: `adminId`, `action`, `details`, `targetType` (user/node/task/wallet/system), `targetId`, timestamps
- **Status**: ✅ Functional

---

## 4. Backend API Endpoints

### Auth (`/api/auth`)
| Method | Route | Purpose | Auth | Status |
|---|---|---|---|---|
| POST | `/register` | Register user | None | WORKING |
| POST | `/verify-signup-otp` | Verify email OTP | None | WORKING |
| POST | `/resend-signup-otp` | Resend signup OTP | None | WORKING |
| POST | `/login` | Login, get JWT | None | WORKING |
| POST | `/forgot-password` | Request reset OTP | None | WORKING |
| POST | `/verify-reset-otp` | Verify reset OTP | None | WORKING |
| POST | `/reset-password` | Set new password | None | WORKING |
| GET | `/me` | Get current user | JWT | WORKING |

### Users (`/api/users`)
| Method | Route | Purpose | Auth | Status |
|---|---|---|---|---|
| GET | `/profile` | Get profile | JWT | WORKING |
| PUT | `/profile` | Update profile | JWT | WORKING |
| PUT | `/change-password` | Change password | JWT | WORKING |

### Node/Provider (`/api/node`, `/api/nodes`)
| Method | Route | Purpose | Auth | Role | Status |
|---|---|---|---|---|---|
| GET | `/dashboard` | Node dashboard metrics | JWT | node/both/admin | WORKING |
| POST | `/register` | Register node device | JWT | node/both/admin | WORKING |
| GET | `/my-node` | Get own node | JWT | node/both/admin | WORKING |
| PUT | `/settings` | Update node settings | JWT | node/both/admin | WORKING |
| POST/PUT | `/start` | Start participation | JWT | node/both/admin | WORKING |
| POST/PUT | `/stop` | Stop participation | JWT | node/both/admin | WORKING |
| GET | `/session/current` | Live session metrics | JWT | node/both/admin | WORKING* |
| GET | `/transactions` | Earnings history | JWT | node/both/admin | WORKING |
| GET | `/assigned-task` | Get current assigned task | JWT | node/both/admin | WORKING |
| GET | `/api-key` | Get/generate node API key | JWT | node/both/admin | WORKING |
| POST | `/api-key/regenerate` | Rotate API key | JWT | node/both/admin | WORKING |
| GET | `/telemetry` | Historical telemetry | JWT | node/both/admin | WORKING |
| GET | `/heartbeats` | Recent heartbeats | JWT | node/both/admin | WORKING |
| GET | `/bandwidth-usage` | Bandwidth usage history | JWT | node/both/admin | WORKING |

*`/session/current` injects randomized latency variation (±4ms) — artificial simulation

### Tasks / Client (`/api/tasks`)
| Method | Route | Purpose | Auth | Role | Status |
|---|---|---|---|---|---|
| GET | `/client/dashboard` | Client dashboard | JWT | client/both | WORKING |
| POST | `/` | Submit task | JWT | client/both | WORKING |
| GET | `/my-tasks` | Client task history | JWT | client/both | WORKING |
| GET | `/:id` | Get task by ID | JWT | any | WORKING |
| PUT | `/:id/start` | Mark task running | JWT | node/both/admin | WORKING |
| PUT | `/:id/complete` | Complete task + reward | JWT | node/both/admin | WORKING |
| PUT | `/:id/fail` | Fail task | JWT | node/both/admin | WORKING |

### Sessions (`/api/sessions`)
| Method | Route | Purpose | Auth | Status |
|---|---|---|---|---|
| GET | `/task/:taskId` | Get session by task | JWT | WORKING |
| GET | `/:id` | Get session by ID | JWT | WORKING |
| PUT | `/:id/start` | Mark session running | JWT | WORKING |
| PUT | `/:id/complete` | Mark session complete | JWT | WORKING |

### Wallet (`/api/wallet`)
| Method | Route | Purpose | Auth | Status |
|---|---|---|---|---|
| GET | `/` | Get wallet | JWT | WORKING |
| GET | `/transactions` | Transaction history | JWT | WORKING |
| POST | `/demo-credit` | Add demo credits (admin) | JWT+admin | WORKING |

### Admin (`/api/admin`)
| Method | Route | Purpose | Auth | Status |
|---|---|---|---|---|
| GET | `/dashboard` | Admin overview stats | JWT+admin | WORKING |
| GET | `/users` | All users (search/filter) | JWT+admin | WORKING |
| GET | `/nodes` | All nodes (search/filter) | JWT+admin | WORKING |
| GET | `/tasks` | All tasks (search/filter) | JWT+admin | WORKING |
| GET | `/transactions` | All transactions | JWT+admin | WORKING |
| PUT | `/users/:id/block` | Block user | JWT+admin | WORKING |
| PUT | `/users/:id/unblock` | Unblock user | JWT+admin | WORKING |
| GET | `/logs` | Admin audit logs | JWT+admin | WORKING |

### Marketplace (`/api/marketplace`)
| Method | Route | Purpose | Auth | Status |
|---|---|---|---|---|
| GET | `/products` | List active products | JWT | WORKING |
| GET | `/products/:id` | Get product | JWT | WORKING |
| POST | `/orders` | Purchase with credits | JWT | WORKING |
| GET | `/my-orders` | My orders | JWT | WORKING |
| GET | `/admin/products` | Admin product list | JWT+admin | WORKING |
| POST | `/admin/products` | Create product | JWT+admin | WORKING |
| PUT | `/admin/products/:id` | Update product | JWT+admin | WORKING |
| GET | `/admin/orders` | Admin order list | JWT+admin | WORKING |
| PUT | `/admin/orders/:id/status` | Fulfill/cancel order | JWT+admin | WORKING |

### Health
| Method | Route | Purpose | Status |
|---|---|---|---|
| GET | `/` | Server health | WORKING |
| GET | `/api/health` | Connected nodes list | WORKING |

---

## 5. Real-Time / Socket.IO

The backend runs a Socket.IO server with three client types:

### Node Agent Authentication
- Via **Node API Key** (`x-node-api-key` header or auth payload) — looked up against `NodeDevice.apiKey`
- Via **JWT Token** — user must have a `NodeDevice` record

### Socket Events (Server → Node)
| Event | Description |
|---|---|
| `node_connect_ack` | Confirms node is registered |
| `task_assigned` | Dispatches task payload to node |
| `heartbeat_ack` | Acknowledges heartbeat |
| `telemetry_update` | Echoed back to node |

### Socket Events (Node → Server)
| Event | Description |
|---|---|
| `heartbeat` | Every 10s — CPU, memory, network stats |
| `telemetry_update` | Bandwidth, latency metrics |
| `task_started` | Node confirms it began execution |
| `task_completed` | Node returns execution results |

### Socket Events (Server → Admin/Client rooms)
| Event | Description |
|---|---|
| `node_status_change` | Node online/offline |
| `task_assigned_event` | Task dispatched to node |
| `task_started_event` | Task execution began |
| `task_completed_event` | Task finished with results |
| `global_node_status` | Broadcast to all |
| `connected_nodes_snapshot` | Initial admin state |

### Heartbeat Eviction
- Nodes not heartbeating within 35s are automatically marked offline and evicted from in-memory map.

### Status
**Working**: Real-time node registration, heartbeat, telemetry, task dispatch, task completion/settlement over Socket.IO. Tested by `tests/distributedSystemTest.js`.

---

## 6. Task Allocation Engine

**Service**: `taskAllocationService.js`

**Algorithm**: Composite weighted scoring:
```
Score = 0.40 × Reliability + 0.25 × LatencyScore + 0.20 × BandwidthAvailability + 0.15 × RegionMatch
Score = Score × (1.0 if socket-connected, else 0.8)
```

**Live telemetry integration**: Fetches latest `NodeTelemetry` records via MongoDB aggregation.

**Node filtering**:
1. Only `active` or `busy` status nodes
2. Must have `currentActiveTasks < maxConcurrentTasks`
3. Must have remaining bandwidth (`usedBandwidthMB < bandwidthLimitMB`)

**Socket-connected nodes** are prioritized over offline ones.

**Status**: WORKING — but only allocates to nodes that are marked active in DB. Requires a running node agent or manual status set.

---

## 7. Task Queue

**Dual-mode queue** (`taskQueueService.js`):
- **Redis BullMQ** when Redis is available on `localhost:6379`
- **In-memory queue** (custom `EventEmitter`-based) as fallback

**Worker** (`taskWorker.js`):
- Processes `execute-testing-task` jobs
- Finds available node, assigns in DB, creates `TaskSession`, dispatches via Socket.IO
- 15-second timeout recovery: if node doesn't start task, re-queues it

**Status**: WORKING with in-memory fallback; WORKING with Redis when available.

---

## 8. Node Agent (netshare-agent)

A headless Node.js daemon connecting to the backend via Socket.IO.

**Authentication**: Node API Key or JWT Token (via CLI flags or `.env`)

**Heartbeat**: Every 10 seconds — sends CPU usage (measured via `os.cpus()`), memory usage, network status.

**Task execution** (`taskExecutor.js`):
- `executeHttpPerformanceTest()`: Real HTTP/HTTPS GET request to target URL. Measures DNS time, TCP connection time, TTFB, download size. Returns real `statusCode`, `latencyMs`, `bandwidthUsedMB`.
- `executePingTest()`: 4 HTTP pings, calculates average latency, jitter, packet loss.

**Status**: **WORKING** — performs real HTTP tests, not simulations. Reports real metrics back to control plane.

---

## 9. Flutter Mobile App (netshare_node_app)

A Flutter app targeting the **node_participant** role only (no client/consumer UI).

### Screens
| Screen | Backend Connected | Notes |
|---|---|---|
| Splash | N/A | Auto-routes to login/dashboard |
| Login | ✅ | JWT auth |
| Register | ✅ | OTP flow |
| VerifyOtp | ✅ | Signup OTP |
| ForgotPassword | ✅ | Reset flow |
| ResetPassword | ✅ | OTP + new password |
| NodeDashboard | ✅ | Live stats from API |
| NodeRegistration | ✅ | Device registration |
| NodeSettings | ✅ | Settings update |
| AssignedTask | ✅ | Live task polling |
| WalletScreen | ✅ | Balance + transactions |
| MarketplaceScreen | ✅ | Browse products |
| ProductDetail | ✅ | Purchase with credits |
| MyOrders | ✅ | Order history |
| Profile | ✅ | View/edit profile |

### Socket.IO (Flutter)
- `NodeSocketService` connects via `socket_io_client`
- Sends heartbeat every 10 seconds with hardcoded `cpuUsage: 5.0, memoryUsage: 25.0` (not real system metrics)
- Handles `task_assigned` → executes via `TaskExecutorService`
- Reports results back

### Task Executor (Flutter)
- `TaskExecutorService` performs real HTTP GET requests via Dart's `http` package
- Same approach as the Node.js agent — measures latency, download size

---

## 10. WireGuard / VPN / Tunneling

> **RESULT: ZERO implementation. No references anywhere in the codebase.**

A full-text search across all `.js`, `.ts`, `.dart`, `.py`, `.yml`, `.json`, `.md`, `.env` files (excluding node_modules) for: `wireguard`, `wg`, `wg-quick`, `VPNService`, `AllowedIPs`, `iptables`, `nftables`, `tunnel`, `peer` (in VPN context), `public key`, `private key` (crypto keys), `endpoint`, `routing`, `NAT`, `forwarding` returned **no results**.

| WireGuard Feature | Status |
|---|---|
| WireGuard integration | ❌ NOT IMPLEMENTED |
| Key generation | ❌ NOT IMPLEMENTED |
| Peer provisioning | ❌ NOT IMPLEMENTED |
| Config generation | ❌ NOT IMPLEMENTED |
| Consumer tunnel establishment | ❌ NOT IMPLEMENTED |
| Traffic routing through provider | ❌ NOT IMPLEMENTED |
| IP forwarding | ❌ NOT IMPLEMENTED |
| NAT/masquerade | ❌ NOT IMPLEMENTED |
| VPN session lifecycle | ❌ NOT IMPLEMENTED |
| Bandwidth metering via tunnel | ❌ NOT IMPLEMENTED |

**The `simulatedSecureChannel: true` field in `TaskSession` is a placeholder boolean — it does nothing.**

---

## 11. Monitoring / Metering

| Metric | Measured | Source | Notes |
|---|---|---|---|
| Bytes downloaded | ✅ Real | Node agent HTTP response | Per task |
| Bytes uploaded | ⚠️ Estimated | Fixed 0.01MB per request | Not real |
| Total MB consumed | ✅ Real | Aggregated from tasks | `NodeDevice.usedBandwidthMB` |
| Connection duration | ✅ Real | `ParticipationSession` start/end times | |
| Latency (TTFB) | ✅ Real | Node agent `performance.now()` | |
| Packet loss | ⚠️ Approximate | Calculated from failed pings | |
| CPU usage | ✅ Real (agent) | `os.cpus()` | Mobile: hardcoded 5.0 |
| Memory usage | ✅ Real (agent) | `os.freemem()` | Mobile: hardcoded 25.0 |
| Mbps speed | ❌ Not measured | No real throughput measurement | |
| Session latency variation | ⚠️ Simulated | `Math.random() * 9 - 4` added in `getCurrentSession` | |
| Real-time updates | ✅ Socket.IO | Telemetry pushed to admin_room | |
| WebSocket/SSE | ✅ Socket.IO | Bidirectional | |
| Provider online state | ✅ Real | Heartbeat eviction (35s timeout) | |

---

## 12. Wallet / Billing

| Feature | Status | Notes |
|---|---|---|
| Wallet creation | ✅ DONE | Created on email verification |
| Starting balance | ✅ DONE | 500 credits for clients/both; 0 for pure nodes |
| Deduct on task submit | ✅ DONE | `deductCredits()` called in `createTask` |
| Credit node on completion | ✅ DONE | `addCredits()` called in `completeTask` + `handleTaskCompleted` |
| Dynamic reward formula | ✅ DONE | `MB × baseRate × qualityScore × regionFactor` |
| Transaction history | ✅ DONE | `CreditTransaction` model |
| Marketplace purchase | ✅ DONE | Credits deducted, stock decremented |
| Refund on order cancel | ✅ DONE | `addCredits()` called for cancelled/rejected orders |
| Admin add demo credits | ✅ DONE | `POST /api/wallet/demo-credit` |
| Top-up (real payment) | ❌ NOT IMPLEMENTED | No Stripe/payment gateway |
| Provider payout (real money) | ❌ NOT IMPLEMENTED | Credits only, no fiat conversion |
| Platform commission | ❌ NOT IMPLEMENTED | Full `estimatedCost` deducted from client; node earns based on MB only; no platform cut modeled |
| Wallet balance check before purchase | ✅ DONE | Both in `createTask` and `createMarketplaceOrder` |

---

## 13. Admin Panel (Web Frontend)

| Screen | Data Source | Status |
|---|---|---|
| AdminDashboard | `GET /api/admin/dashboard` | WORKING |
| ManageUsers | `GET /api/admin/users` | WORKING |
| Block/Unblock User | `PUT /api/admin/users/:id/block` | WORKING |
| ManageNodes | `GET /api/admin/nodes` | WORKING |
| ManageTasks | `GET /api/admin/tasks` | WORKING |
| Transactions | `GET /api/admin/transactions` | WORKING |
| MarketplaceProducts | `GET /api/marketplace/admin/products` | WORKING |
| MarketplaceOrders | `GET /api/marketplace/admin/orders` | WORKING |
| Fulfill/Cancel Orders | `PUT /api/marketplace/admin/orders/:id/status` | WORKING |

**Missing Admin Features**:
- No real-time Socket.IO events displayed in admin panel
- No system alerts or health monitoring UI
- No node telemetry charts in admin
- No platform revenue/commission reporting
- No dispute management
- No verification management
- No admin user creation flow (admins must be seeded via DB or role update)

---

## 14. ML Ranking Service

**Service**: Python Flask at port 5001

**Model**: `RandomForestRegressor` (scikit-learn), trained on 2500 synthetic samples matching the same formula used in `taskAllocationService.js`.

**Endpoints**:
- `GET /health` — service status
- `POST /predict-score` — score single node
- `POST /rank-nodes` — rank array of nodes

**Integration**: The ML service is included in `docker-compose.yml` but **is NOT called** from the backend. `taskAllocationService.js` uses its own pure-JS scoring formula. The ML service is standalone and unused in the production flow.

---

## 15. Frontend (Web React)

### Node Participant Screens
| Screen | Route | Connected | Notes |
|---|---|---|---|
| NodeDashboard | `/node/dashboard` | ✅ | Polls `/api/node/dashboard` |
| NodeParticipation | `/node/participation` | ✅ | Start/stop via API; shows session |
| NodeSession | `/node/session` | ✅ | Polls `/api/node/session/current` |
| NodeWallet | `/node/wallet` | ✅ | Balance + transactions |

### Client Screens
| Screen | Route | Connected | Notes |
|---|---|---|---|
| ClientDashboard | `/client/dashboard` | ✅ | Task counts + wallet balance |
| SubmitTask | `/client/submit-task` | ✅ | Form → `POST /api/tasks` |
| MyTasks | `/client/tasks` | ✅ | Task list with status |
| TaskDetails | (inline) | ✅ | From MyTasks |
| ClientWallet | `/client/wallet` | ✅ | Balance + history |
| Marketplace | `/client/marketplace` | ✅ | Products from API |
| MyOrders | `/client/orders` | ✅ | Orders from API |

### Auth Screens
All auth screens (Login, Register, VerifySignupOtp, ForgotPassword, VerifyResetOtp, ResetPassword) are connected to backend.

### Common
| Screen | Route | Status |
|---|---|---|
| Profile | `/client/profile` or `/admin/profile` | ✅ Connected |
| LandingPage | `/` | Static only |

---

## 16. Key Architectural Issues

1. **Terminology mismatch**: The codebase uses "node_participant/platform_client" but the project is described as "Provider/Consumer bandwidth sharing". These are fundamentally different business models.

2. **Simulated secure channel**: `simulatedSecureChannel: true` is hardcoded — there is no actual secure channel.

3. **No actual bandwidth sharing**: The system routes HTTP requests through nodes, not consumer traffic. A consumer cannot browse the internet through a provider's connection.

4. **ML service not integrated**: The `ml-service` is deployed in Docker but never called by the backend.

5. **JWT tokens never expire**: `generateToken.js` issues tokens without `expiresIn`.

6. **CORS wildcard**: `origin: "*"` is inappropriate for production with authentication.

7. **No email service**: OTPs are only returned in development response bodies, never emailed.

8. **Mobile app hardcoded metrics**: Flutter heartbeat sends `cpuUsage: 5.0, memoryUsage: 25.0` always.

9. **`.env` committed**: JWT secret and DB URI are committed to the repository.

10. **Docker agent key**: `docker-compose.yml` contains a hardcoded API key `nsk_live_docker_demo_agent_key_01` that must be pre-seeded in the database.
