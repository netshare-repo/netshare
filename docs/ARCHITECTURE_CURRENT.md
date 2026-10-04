# NetShare — Current Architecture
> Generated: 2026-09-25 | Based on code inspection only

---

## ⚠️ Important Framing

The name "NetShare" and the stated goal (peer-to-peer bandwidth sharing) do not match what the repository currently implements. The code describes a **distributed web-testing platform** where internet nodes perform HTTP requests on behalf of client businesses. All architectural descriptions below reflect what is actually coded.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NetShare Distributed Platform                       │
│                                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                   │
│  │ React Web    │   │ Flutter      │   │ Node.js CLI  │                   │
│  │ Frontend     │   │ Mobile App   │   │ Agent Daemon │                   │
│  │ (Vite/React) │   │ (Android/    │   │ (netshare-   │                   │
│  │              │   │  iOS/Web)    │   │  agent)      │                   │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘                   │
│         │ HTTP REST         │ HTTP REST         │ Socket.IO                 │
│         │ + Socket.IO       │ + Socket.IO       │ + Heartbeat               │
│         ▼                   ▼                   ▼                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    NetShare Backend (Port 8000)                      │   │
│  │                    Node.js + Express + Socket.IO                     │   │
│  │                                                                     │   │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────┐               │   │
│  │  │ REST API   │  │ Socket.IO   │  │ Task Queue   │               │   │
│  │  │ (8 route   │  │ Server      │  │ (BullMQ/     │               │   │
│  │  │  files)    │  │ (real-time  │  │  In-Memory)  │               │   │
│  │  │            │  │  plane)     │  │              │               │   │
│  │  └─────┬──────┘  └──────┬──────┘  └──────┬───────┘               │   │
│  │        │                │                 │                        │   │
│  │        ▼                ▼                 ▼                        │   │
│  │  ┌──────────────────────────────────────────────┐                 │   │
│  │  │              MongoDB (Mongoose)               │                 │   │
│  │  │  User, Wallet, CreditTransaction             │                 │   │
│  │  │  NodeDevice, ParticipationSession            │                 │   │
│  │  │  TestingTask, TaskSession, TaskResult        │                 │   │
│  │  │  BandwidthUsage, NodeHeartbeat, NodeTelemetry│                 │   │
│  │  │  MarketplaceProduct, MarketplaceOrder        │                 │   │
│  │  │  AdminLog                                    │                 │   │
│  │  └──────────────────────────────────────────────┘                 │   │
│  │                                                                     │   │
│  │  ┌──────────────┐                                                  │   │
│  │  │ Redis         │  (optional — BullMQ task queue)                 │   │
│  │  │ (Port 6379)   │                                                  │   │
│  │  └──────────────┘                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Python ML Service (Port 5001)  — RandomForest node ranking          │  │
│  │  DEPLOYED but NOT CALLED from backend                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

---

### Frontend (React + Vite)

| Property | Detail |
|---|---|
| Framework | React 18 + Vite |
| Routing | `react-router-dom` v6 with `ProtectedRoute` + `RoleRoute` guards |
| API client | Axios instance (`axiosInstance.js`) — `Bearer` token auto-injected from `localStorage` |
| Real-time | `socket.io-client` (imported in node_modules but not wired in React components) |
| State | Context API (`AuthContext`) — localStorage for token/user |
| Port | 3000 (Dockerized) / Vite dev server |
| Deployment | Docker → Nginx serving static build |

**Role-based routing:**
- `/node/*` routes → `node_participant`, `both`, `admin`
- `/client/*` routes → `platform_client`, `both`
- `/admin/*` routes → `admin` only

**All screens use real backend API calls** — no mock data in production components. Data is fetched on mount and displayed.

---

### Backend (Node.js + Express + Socket.IO)

| Property | Detail |
|---|---|
| Runtime | Node.js (ESM modules — `import/export`) |
| Framework | Express 4 |
| Real-time | Socket.IO (same HTTP server) |
| Database ORM | Mongoose |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Task queue | BullMQ (Redis) with in-memory fallback |
| Port | 8000 |

**Middleware stack** (applied globally):
1. CORS (`origin: "*"`)
2. `express.json()`
3. Rate limiter (120 req/min per IP, in-memory)
4. Input sanitizer (script tag stripping)

**Route structure:**
```
/api/auth          → 8 endpoints (register, verify, login, reset flow, me)
/api/users         → 3 endpoints (profile get/update, change-password)
/api/node          → 14 endpoints (dashboard, register, settings, start/stop, session, transactions, api-key, telemetry)
/api/nodes         → alias for /api/node
/api/tasks         → 7 endpoints (dashboard, create, list, get, start, complete, fail)
/api/sessions      → 4 endpoints (get by id/taskId, start, complete)
/api/wallet        → 3 endpoints (get, transactions, demo-credit)
/api/admin         → 8 endpoints (dashboard, users, nodes, tasks, transactions, block/unblock, logs)
/api/marketplace   → 9 endpoints (products, orders, admin CRUD)
```

**Services:**
- `socketService.js` — Socket.IO server, node tracking, heartbeat eviction, task dispatch/completion handling
- `taskAllocationService.js` — Weighted node scoring and selection
- `taskQueueService.js` — BullMQ/in-memory dual-mode queue
- `walletService.js` — `addCredits()` / `deductCredits()` with transaction logging
- `rewardService.js` — Dynamic reward formula (`MB × quality × regionFactor`)

**Workers:**
- `taskWorker.js` — Background worker: dequeues tasks, finds node, assigns, dispatches via Socket.IO, 15s timeout recovery

---

### Database (MongoDB)

All collections use Mongoose schemas. Key relationships:

```
User ──1────────────────── Wallet
User ──1────────────────── NodeDevice ──*── NodeHeartbeat
                                       ──*── NodeTelemetry
                                       ──*── BandwidthUsage
                                       ──*── ParticipationSession
User ──*────────────────── TestingTask ──1── TaskSession
                                        ──1── TaskResult
                                        ──── BandwidthUsage
User ──*────────────────── CreditTransaction
User ──*────────────────── MarketplaceOrder ──── MarketplaceProduct
User (admin) ──*────────── AdminLog
```

**TTL indexes:**
- `NodeHeartbeat.timestamp` → 7 days
- `NodeTelemetry.timestamp` → 14 days

**No missing critical indexes** — all foreign key fields use `.index: true`.

---

### Authentication

```
Registration Flow:
  POST /register → create User (unverified) → generate OTP → hash OTP (SHA-256)
                 → store in signupOtpHash → return devOtp in dev mode
  POST /verify-signup-otp → compare hash → mark isVerified: true → create Wallet → return JWT

Login Flow:
  POST /login → find user → check isVerified → check status → bcrypt.compare
              → return JWT (NO EXPIRY CURRENTLY SET)

Password Reset:
  POST /forgot-password → generate OTP → hash → store in resetOtpHash
  POST /verify-reset-otp → compare hash → confirm
  POST /reset-password → compare hash again → bcrypt new password → clear OTP

JWT Middleware (protect):
  Authorization: Bearer <token> → jwt.verify → User.findById → attach req.user
  Checks: user exists, status !== "blocked"

Role Middleware (allowRoles):
  req.user.role must be in allowed list
  Roles: node_participant, platform_client, admin, both
```

---

### Node Agent (netshare-agent)

The headless daemon for desktop/server nodes:

```
Startup:
  agent.js → parse args (--url, --key, --token, --nodeId)
            → NodeSocketClient.connect(serverUrl, {apiKey, token, nodeId})
            → HeartbeatManager.start() (10s interval)

Authentication:
  Socket.IO handshake with { apiKey | token, nodeId }
  Server validates against NodeDevice.apiKey or JWT + NodeDevice lookup

Task Flow:
  Server emits task_assigned → agent validates → emits task_started
  taskExecutor.executeTask(task):
    - HTTP GET to targetUrl via Node http/https module
    - Measures: DNS time, TCP time, TTFB, download size
    - Returns: statusCode, latencyMs, bandwidthUsedMB, successRate
  Agent emits task_completed with real metrics
  Server handles task_completed → creates TaskResult → rewards node wallet

Heartbeat:
  Every 10s: emit { cpuUsage (real), memoryUsage (real), networkStatus: {latencyMs: node.latencyMs} }
  Server persists NodeHeartbeat, NodeTelemetry, updates NodeDevice
  35s timeout: node marked offline, evicted from connectedNodes Map
```

---

### Flutter Mobile App (netshare_node_app)

A Flutter application for the **node_participant** role only. No consumer/client features.

```
Auth: Full OTP-based auth via AuthService → secure_storage token
Navigation: Bottom nav (Dashboard, Participation, Wallet, Marketplace, Profile)

Real-time (NodeSocketService):
  socket_io_client → connects with { token, apiKey, nodeId, role: 'node' }
  Heartbeat: every 10s with HARDCODED { cpuUsage: 5.0, memoryUsage: 25.0 }
  task_assigned → TaskExecutorService.executeHttpPerformanceTest/executePingTest
  task_completed → result emitted back (real HTTP metrics)

ForegroundNodeService:
  Static class: start() → NodeService.startParticipation() → NodeSocketService.connect()
  stop() → NodeSocketService.disconnect() → NodeService.stopParticipation()
  Logs available via ValueNotifier for UI display

Task Executor (Dart):
  Uses dart:io HttpClient for real HTTP requests
  Measures response time, download size — same approach as Node.js agent
```

---

### Sessions

Two types of sessions exist:

**ParticipationSession** — Provider/node participation window:
- Created when node calls `POST /api/node/start`
- Tracks: sessionId, userId, deviceId, status, bandwidth, credits earned
- Lifecycle: `active → stopped/paused`
- Updated by task completion events (bandwidth, credits)
- `status` enum: `["active", "stopped", "paused"]`

**TaskSession** — Individual task execution window:
- Created by `taskWorker.js` when allocating a node
- Tracks: taskId, clientId, nodeId, sessionToken, status, bandwidth, latency, logs
- Lifecycle: `created → running → completed/failed`
- `simulatedSecureChannel: true` — hardcoded boolean, no functional meaning

---

### Billing / Credits

```
Credits flow:
  Consumer registers → Wallet created with 500 credits (default)
  Consumer submits task:
    estimatedCost = executionLimit × 10
    Wallet.balance >= estimatedCost → deductCredits()
    CreditTransaction(type: "debit") created
    Task enqueued

  Node completes task:
    calculateReward({ bandwidthUsedMB, node, targetRegion })
    reward = MB × 1.0 × qualityScore × regionFactor
    addCredits(node.userId, reward)
    CreditTransaction(type: "credit") created
    NodeDevice.usedBandwidthMB += bandwidthUsedMB

  Marketplace:
    Node participant redeems credits for products
    deductCredits() → MarketplaceOrder created
    Admin fulfills order or cancels → refund via addCredits()

No real money flow exists. No payment gateway integrated.
Platform commission is not modeled.
```

---

### Reward Formula

```
Reward = max(1, round(MB × baseRate × qualityScore × regionFactor))

qualityScore = (0.5 × reliabilityScore/100) + (0.3 × successRate/100) + (0.2 × latencyScore)
latencyScore:  ≤60ms → 1.05 | ≤150ms → 1.0 | ≤300ms → 0.9 | >300ms → 0.75
Clamped to [0.1, 1.5]

regionFactor:
  us-east/us-west/north-america: 1.2
  europe/eu-central: 1.15
  asia-pacific/asia: 1.1
  latam/africa: 1.05
  global: 1.0
  unknown: 1.0

baseRate: 1.0 credits/MB (constant)
```

---

### Task Allocation Algorithm

```
findAvailableNode(targetRegion):
  1. Query NodeDevice WHERE status IN ["active","busy"] AND currentActiveTasks < maxConcurrentTasks
  2. Filter: usedBandwidthMB < bandwidthLimitMB
  3. Fetch latest NodeTelemetry via aggregation for live latency
  4. Score each node:
     compositeScore = (0.40 × reliability) + (0.25 × latencyScore) + (0.20 × bandwidthAvailability) + (0.15 × regionMatch)
     compositeScore × (socket-connected ? 1.0 : 0.8)
  5. Sort: socket-connected first, then by score descending
  6. Return top node
```

---

### ML Service (Standalone, Unintegrated)

| Property | Detail |
|---|---|
| Language | Python 3 + Flask |
| Model | RandomForestRegressor (scikit-learn) |
| Training data | 2500 synthetic samples matching the JS scoring formula |
| Endpoints | `/health`, `/predict-score`, `/rank-nodes` |
| Port | 5001 |
| Integration | NONE — not called from backend |
| Storage | `node_ranker.joblib` model file |

The ML service exists and is deployed via Docker but the backend scoring in `taskAllocationService.js` uses its own pure-JS formula identical to the ML training objective. To integrate, the backend would need to call `http://ml-service:5001/rank-nodes` during allocation.

---

### Docker Compose (6 services)

| Service | Image/Build | Port | Dependencies |
|---|---|---|---|
| mongo | mongo:7.0 | 27017 | — |
| redis | redis:7-alpine | 6379 | — |
| ml-service | ./ml-service | 5001 | — |
| backend | ./netshare-backend | 8000 | mongo, redis, ml-service |
| node-agent | ./netshare-agent | — | backend |
| frontend | ./netshare-frontend | 3000→80 | backend |

**Known issue**: The `node-agent` service uses `NODE_API_KEY=nsk_live_docker_demo_agent_key_01`. This API key must already exist in MongoDB for the agent to authenticate. There is no seed/init script.

---

## What Is NOT Implemented

| Category | Missing |
|---|---|
| **Networking** | WireGuard, VPN tunnels, IP forwarding, NAT, routing, peer provisioning |
| **P2P bandwidth** | Consumer traffic routing through provider |
| **Email** | SMTP/SendGrid — OTPs only returned in API response |
| **Payments** | Stripe, PayPal, bank integration, fiat payouts |
| **File upload** | Profile images, task attachments |
| **Real-time admin UI** | Admin dashboard does not consume Socket.IO events |
| **ML integration** | ML service runs but is never called |
| **Token expiry** | JWT tokens never expire |
| **Consumer discovery** | No public provider listing for consumers |
| **Task cancellation** | No `DELETE /api/tasks/:id` or cancel endpoint |
| **Failure refunds** | Failed tasks do not auto-refund consumer credits |
| **Platform commission** | No percentage taken by platform |
| **Geolocation** | No lat/long on providers |
| **Disputes** | No dispute model or workflow |
| **Admin seeding** | No admin creation endpoint or seed script |
