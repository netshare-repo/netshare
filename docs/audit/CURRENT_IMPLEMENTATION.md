# NetShare — Current Implementation Document
> Generated: 2026-09-26 | Full code inspection of all source files against official SRS and Chapter 3

---

## 1. Repository Structure

```
NetshareCode/
├── docs/                          # Documentation
│   ├── NETSHARE_SRS.md            # OFFICIAL SRS (authoritative)
│   ├── NETSHARE_CHAPTER_3.md      # OFFICIAL Chapter 3 (authoritative)
│   ├── ARCHITECTURE_CURRENT.md    # Prior architecture doc (not authoritative)
│   ├── IMPLEMENTATION_AUDIT.md    # Prior audit (not authoritative)
│   ├── NEXT_STEPS.md              # Prior roadmap (not authoritative)
│   ├── REQUIREMENTS_TRACEABILITY.md # Prior traceability (not authoritative)
│   └── audit/                     # NEW - this audit folder
├── netshare-backend/              # Node.js/Express API + Socket.IO
│   ├── config/db.js               # MongoDB connection
│   ├── controllers/               # 8 controllers
│   ├── middleware/                # auth, role, security, error
│   ├── models/                    # 15 Mongoose models
│   ├── routes/                    # 8 route files
│   ├── services/                  # socket, task queue, wallet, reward, allocation
│   ├── utils/                     # token, session token, validation
│   ├── workers/taskWorker.js
│   ├── server.js
│   ├── .env                       # ⚠️ COMMITTED TO REPO — security risk
│   ├── package.json
│   └── Dockerfile
├── netshare-frontend/             # React + Vite web dashboard
│   └── src/
│       ├── api/                   # API client modules (auth, node, task, wallet, admin)
│       ├── components/            # auth guards, layout, sidebar
│       ├── contexts/              # AuthContext
│       ├── pages/                 # 26 pages across admin/client/node/auth/common
│       └── routes/AppRoutes.jsx
├── Netshare/netshare_node_app/    # Flutter mobile app (node participant role only)
│   └── lib/
│       ├── screens/               # 14 screens
│       ├── services/              # NodeSocketService, TaskExecutorService, etc.
│       └── models/                # 6 data models
├── netshare-agent/                # Node.js headless desktop/server agent
│   └── src/
│       ├── index.js               # Entry point
│       ├── heartbeat.js           # Periodic heartbeat sender
│       ├── metricsCollector.js    # CPU/memory via os module
│       ├── receiver.js            # Socket event listener
│       ├── socketClient.js        # Socket.IO client
│       └── taskExecutor.js        # Real HTTP test executor
├── ml-service/                    # Python Flask ML service
│   ├── app.py                     # Flask endpoints
│   └── nodeRanking.py             # RandomForest model
├── tests/
│   └── distributedSystemTest.js   # Integration test
├── docker-compose.yml             # Full stack (6 services)
├── docker-compose.dev.yml         # Dev stack
└── package.json                   # Root-level (tests only)
```

---

## 2. Current Architecture

### 2.1 Frontend Technologies
- **Web**: React 18 + Vite, plain CSS (no Tailwind/MUI), axios for API calls
- **Routes**: React Router DOM v6 with role-based guards
- **Auth**: JWT stored in localStorage via AuthContext
- **Real-time**: No Socket.IO client in web frontend (admin/client dashboards use polling only)
- **Deployed on**: Port 5173 (dev), Nginx container (prod via Docker)

### 2.2 Mobile Technologies
- **Flutter** targeting Android (API Level 21+)
- **Role scope**: Node Participant only — NO Platform Client UI in Flutter app
- **Socket.IO**: `socket_io_client` package for real-time node connection
- **Task execution**: Real HTTP GET via Dart `http` package
- **Heartbeat metrics**: CPU hardcoded to `5.0`, memory hardcoded to `25.0` (NOT real system values)
- **Authentication**: JWT via shared_preferences

### 2.3 Backend
- **Runtime**: Node.js with Express.js (ESM modules)
- **Port**: 5000
- **Socket.IO**: v4, integrated into same HTTP server
- **Task queue**: Dual-mode — Redis BullMQ (when Redis available) or in-memory EventEmitter fallback
- **Authentication**: JWT via `jsonwebtoken`, bcrypt for passwords
- **Rate limiting**: Custom in-memory 120 req/min per IP (lost on restart)

### 2.4 Database
- **MongoDB** via Mongoose ODM
- **15 models**: AdminLog, AnomalyAlert, BandwidthUsage, Device, Dispute, MarketplaceOrder, MarketplaceProduct, Notification, Task, TelemetryLog, TopUpRequest, Transaction, User, Wallet, WithdrawalRequest
- **Missing from Chapter 3**: RoutingSession is still missing (the only Chapter 3 model not yet implemented), but AnomalyAlert, Notification, TopUpRequest, WithdrawalRequest, and Dispute now exist as models (even if their full functionality isn't complete)
- **TTL indexes**: NodeHeartbeat (7d), TelemetryLog (14d)

### 2.5 Real-Time Communication
- **Socket.IO** (NOT WebRTC as required by SRS/Chapter 3)
- Bidirectional between backend ↔ node agents and backend ↔ admin/clients
- Node agents (desktop + Flutter) connect via Socket.IO with API key or JWT
- Events: `heartbeat`, `telemetry_update`, `task_assigned`, `task_started`, `task_completed`
- WebRTC: **ZERO implementation** — not present anywhere in codebase

### 2.6 Node-Agent Architecture
- **netshare-agent**: Headless Node.js daemon, connects via Socket.IO
  - Sends real CPU/memory metrics via `os` module
  - Executes real HTTP performance tests (`http`/`https` modules)
  - Reports real latency (TTFB), download size, DNS time
- **Flutter app**: Mobile node agent with hardcoded CPU/memory metrics
  - Executes real HTTP GET tests via Dart `http` package
  - Reports real latency and download size

### 2.7 Task Queue
- `taskQueueService.js`: Dual-mode — BullMQ with Redis or in-memory fallback
- `taskWorker.js`: Processes jobs, finds available node, creates TaskSession, dispatches via Socket.IO
- 15-second timeout recovery: re-queues if node doesn't start task
- Tasks enter state: `pending → assigned → running → completed → settled`

### 2.8 Task Execution Mechanism
- Client submits task via `POST /api/tasks`
- Credits deducted immediately at submission
- Task enqueued
- Worker finds node via `taskAllocationService.findAvailableNode()`
- Task dispatched to node via `socketService.sendTaskToNode()`
- Node executes real HTTP test against target URL
- Node reports results via `task_completed` Socket.IO event
- Server creates `TaskResult`, settles credits, updates `ParticipationSession`

### 2.9 Secure Communication/Routing
- **Current**: Socket.IO over HTTPS/WSS (TLS in production, plain WS in dev)
- **Field in TaskSession**: `simulatedSecureChannel: true` — this is a hardcoded boolean placeholder, does nothing
- **WebRTC**: NOT implemented
- **Android VpnService**: NOT implemented
- **Conclusion**: Secure communication requirement (OE-5, CON-4, SI-3, SI-4) is NOT met

### 2.10 Wallet/Credits
- Wallet created on email verification (initial balance 500 credits for client/both, 0 for node-only)
- `deductCredits()` and `addCredits()` in `walletService.js`
- All transactions recorded in `Transaction`
- **Top-up**: Only `POST /api/wallet/demo-credit` (admin adds credits manually in DB) — no payment proof upload, no admin verification workflow as per FR9.1–FR9.6
- **Withdrawal**: NO implementation — FR5.4, FR5.5, FR5.6 NOT implemented
- Dynamic node reward: `MB × baseRate × qualityScore × regionFactor`

### 2.11 Marketplace
- Products managed by admin (CRUD via admin routes)
- Users purchase with credits (balance checked, deducted atomically)
- Orders tracked with status: `pending → fulfilled / cancelled / rejected`
- Refund on cancel/reject: credits returned
- Admin fulfils orders via `PUT /api/marketplace/admin/orders/:id/status`
- Admin fulfilment logged in `AdminLog`
- **Missing**: No notification sent to user on fulfilment

### 2.12 Admin System
- Full admin dashboard: user counts, task counts, bandwidth usage, credits issued
- User management: list, search, filter, block/unblock
- Node management: list, search, filter by status/region
- Task management: list, search, filter
- Transaction history: view all
- Marketplace: product management + order fulfilment
- **Missing**: No anomaly alerts UI, no dispute management, no payment verification workflow, no reports/export, no platform settings, no admin audit log viewer

### 2.13 Monitoring/Telemetry
- NodeHeartbeat: every 10s from agents (real CPU/memory from desktop agent, hardcoded from Flutter)
- TelemetryLog: bandwidth, latency, packet loss stored per event
- BandwidthUsage: per-task and per-telemetry records
- Admin dashboard polls backend for stats
- Admin Socket.IO room receives live telemetry pushes
- **Missing**: No anomaly detection rules in production, no suspicious activity alerts in DB, full functionality of AnomalyAlert model

### 2.14 ML/AI
- Python Flask service at port 5001
- `RandomForestRegressor` trained on 2500 synthetic samples
- Endpoints: `GET /health`, `POST /predict-score`, `POST /rank-nodes`
- **NOT integrated**: Backend `taskAllocationService.js` uses its own pure-JS scoring formula
- ML service is in `docker-compose.yml` but never called by backend

### 2.15 Deployment/Docker
- `docker-compose.yml`: 6 services — backend, frontend, mongo, redis, ml-service, netshare-agent
- Backend and frontend have individual Dockerfiles
- `docker-compose.dev.yml`: dev variant
- Agent container uses hardcoded API key `nsk_live_docker_demo_agent_key_01`

### 2.16 Authentication/Authorization
- JWT (`jsonwebtoken`) — **expiresIn: 7d** set in `generateToken.js`
- bcrypt (salt rounds 10) for password hashing
- OTP: SHA-256 hashed, 10-minute expiry
- OTP delivery: **NOT implemented** — OTP returned in response body only (dev mode)
- Roles: `node_participant`, `platform_client`, `both`, `admin`
- Role middleware: `allowRoles(...roles)` guard on protected routes
- Device binding: `deviceFingerprint` field on `Device` — stored but not enforced for authentication

---

## 3. Technology Stack Summary

| Component | Documented (SRS/Ch3) | Actual Implementation |
|---|---|---|
| Mobile App | Flutter, Android API 21+ | Flutter (Android only) — ✅ |
| Admin Web | React.js | React 18 + Vite — ✅ |
| Backend | Node.js + Express.js | Node.js + Express.js ESM — ✅ |
| Database | MongoDB | MongoDB via Mongoose — ✅ |
| Auth | JWT + bcrypt | JWT + bcrypt — ✅ |
| Secure Routing | WebRTC + Android VpnService | Socket.IO only — ❌ MISSING |
| ML/Node Selection | Python Scikit-learn | RandomForest deployed but NOT integrated — PARTIAL |
| Task Queue | Implied event-driven | BullMQ + in-memory fallback — ✅ |
| Real-time | WebRTC + Socket.IO implied | Socket.IO only — PARTIAL |
| Payment | Manual admin verification | Demo credit endpoint only — ❌ MISSING |

---

## 4. What Does NOT Exist (Key Gaps)

1. **WebRTC** — zero lines of code
2. **Android VpnService** — zero lines of code  
3. **Reports/export** — FR14.3–FR14.4 not implemented
4. **Platform settings** — admin cannot configure fees, limits, pricing
5. **Node rating** — FR8.5 not implemented
6. **ML service integration** — deployed but never called
7. **Email OTP delivery** — OTP only in response body
8. **Platform Client mobile UI** — Flutter app is node-only (no task submission from mobile)
9. **Routing sessions** — `routing_sessions` collection from Chapter 3 not implemented; `TaskSession.simulatedSecureChannel` is a placeholder
