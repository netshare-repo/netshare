# NetShare — Architecture Gap Analysis
> Generated: 2026-09-26 | Against NETSHARE_SRS.md + NETSHARE_CHAPTER_3.md (official, authoritative)

---

## 1. Required vs Actual Architecture

### 1.1 Communication Layer

| Component | Required by Docs | Actual Implementation | Gap Severity |
|---|---|---|---|
| Node↔Backend real-time | WebRTC (SRS CON-4, OE-5, SI-3, SI-4) | Socket.IO over WSS | 🔴 CRITICAL |
| Android VpnService | Required for mobile node tunneling (SRS OE-5) | Not implemented | 🔴 CRITICAL |
| Secure routing session | Routing Session Manager per Chapter 3 | `simulatedSecureChannel: true` boolean in TaskSession — does nothing | 🔴 CRITICAL |
| Control plane messaging | Backend → Node dispatch | Socket.IO `task_assigned` event — functional | 🟢 DONE |
| Admin real-time updates | Live Socket.IO to admin dashboard | Socket.IO events pushed to `admin_room` — exists but not consumed by web frontend | 🟡 PARTIAL |

**Analysis:** The SRS explicitly requires WebRTC (CON-4 states: "Secure communication and controlled traffic routing shall be limited to mechanisms supported by WebRTC and Android VpnService API.") and Android VpnService (OE-5). Neither is implemented. The system uses Socket.IO instead, which provides control plane functionality but does NOT implement the secure, encrypted peer-to-peer routing channel described in the architecture. This is the single largest architectural gap.

**However:** Based on the actual documented purpose of NetShare (controlled HTTP testing, NOT unrestricted VPN browsing), Socket.IO satisfies the functional need for controlled task dispatch. The gap is in the literal implementation of specified technologies, not in the system's ability to perform its primary function.

---

### 1.2 Database Layer

| Collection (Chapter 3 Required) | Model Name | Exists? | Schema Match | Gap |
|---|---|---|---|---|
| `users` | User | ✅ | ~90% match | Missing: `lastLoginAt`, `createdByAdmin` flag |
| `node_devices` | Device | ✅ | ~85% match | Missing: `publicKey`/`privateKey` (no WireGuard), extra fields added: `apiKey`, `successRate`, etc. |
| `participation_sessions` | ParticipationSession | ✅ | ~80% match | Fields renamed: `nodeId` instead of `deviceId` (both stored), extra fields added |
| `testing_tasks` | Task | ✅ | ~85% match | Missing: `requestFrequency`, `Draft` state; status enum differs |
| `task_results` | TaskResult | ✅ | ~90% match | Missing: `logReference` (uses embedded `resultData`) |
| `routing_sessions` | **MISSING** | ❌ | N/A | TaskSession.js is a partial substitute; `simulatedSecureChannel` is placeholder |
| `wallets` | Wallet | ✅ | ~80% match | Missing: `walletStatus` field; `earnedCredits` renamed from `totalEarned` |
| `credit_transactions` | Transaction | ✅ | ~85% match | Missing: `referenceId` field (from bank/payment reference) |
| `marketplace_products` | MarketplaceProduct | ✅ | ~90% match | Extra: `category`, `imageUrl`, `stock` fields (reasonable additions) |
| `marketplace_orders` | MarketplaceOrder | ✅ | ~90% match | Extra: refund logic fields (good additions) |
| `anomaly_alerts` | AnomalyAlert | ✅ | N/A | Exists |
| `admin_action_logs` | AdminLog | ✅ | ~85% match | Field names differ: `action` vs `actionType`, `details` vs `description` |
| `notifications` | Notification | ✅ | N/A | Exists |

**Summary:** The actual model count is 15. `AnomalyAlert`, `Notification`, `TopUpRequest`, `WithdrawalRequest`, and `Dispute` models now exist. Only `routing_sessions` is still missing from Chapter 3.

---

### 1.3 Application Layer — Components

| Chapter 3 Component | Status | Notes |
|---|---|---|
| Platform Client Interface (Web + Mobile) | PARTIAL | Web: ✅ React; Mobile: ❌ Flutter app is node-only, no client UI |
| Node Participant Interface (Mobile + Desktop) | PARTIAL | Flutter ✅; Desktop agent ✅ headless only, no desktop GUI |
| Backend API Server | DONE | Express.js, all core routes present |
| Real-Time Communication Manager | PARTIAL | Socket.IO replaces WebRTC; no WebRTC |
| Secure Routing Session Manager | NOT_STARTED | `simulatedSecureChannel` is a placeholder boolean |
| Task Queue System | DONE | BullMQ + in-memory fallback |
| ML-Based Node Selection Engine | PARTIAL | JS scoring works; Python ML deployed but not integrated |
| Credit/Reward Settlement Engine | DONE | `rewardService.js` + `walletService.js` |
| Admin Monitoring Interface | PARTIAL | Web frontend exists; missing alerts, disputes, payment workflows |
| Performance Monitoring & Anomaly Detection | NOT_STARTED | Full functionality of AnomalyAlert model not yet present |
| Marketplace Module | DONE | Products, orders, admin fulfilment all functional |
| Notification System | NOT_STARTED | Notification model exists but no delivery logic |

---

### 1.4 Task State Machine Gap

| Required State (Chapter 3) | Implemented? | Notes |
|---|---|---|
| Draft | ❌ | Not in Task.status enum |
| Submitted | ❌ | Tasks go directly to `pending` |
| Validation | ❌ | Validation happens synchronously in `createTask`, no explicit state |
| Queued | ❌ | Stored as `pending` in DB while in queue |
| WaitingForNode | ❌ | No separate state |
| NodeAssigned | ✅ | `assigned` state exists |
| SecureSession | ❌ | No secure session state (simulatedSecureChannel is just a boolean) |
| Running | ✅ | `running` state exists |
| ResultReceived | ❌ | Not a separate state; goes directly to `completed` |
| Completed | ✅ | `completed` state exists |
| Settled | ✅ | `settled` state exists |
| Rejected | ❌ | Not implemented |
| Cancelled | ✅ | `cancelled` state exists |
| Failed | ✅ | `failed` state exists |
| TimedOut | ❌ | Not a separate state (retry happens but no `timedOut` state) |

**7 of 15 states implemented. 8 missing.**

---

### 1.5 Data Flow (Chapter 3 — 10-Step Pipeline)

| Step | Description | Status | Notes |
|---|---|---|---|
| 1 | Task Submission | ✅ DONE | `POST /api/tasks` |
| 2 | Validation and Authorization | ✅ DONE | JWT, role, URL, credit check — all in `createTask` |
| 3 | Task Queueing | ✅ DONE | BullMQ/in-memory queue via `enqueueTask()` |
| 4 | Node Selection (ML) | PARTIAL | JS scoring works; ML service not integrated |
| 5 | Secure Session Creation | NOT_STARTED | `simulatedSecureChannel: true` placeholder only |
| 6 | Controlled Execution | ✅ DONE | Real HTTP test via node agent |
| 7 | Result Collection | ✅ DONE | Agent reports via `task_completed` event |
| 8 | Data Storage | ✅ DONE | TaskResult, BandwidthUsage created in MongoDB |
| 9 | Credit Settlement | ✅ DONE | `addCredits` / `deductCredits` in walletService |
| 10 | Dashboard Updates | PARTIAL | Admin room gets Socket.IO events; frontend polls, doesn't receive push |

**7.5 of 10 pipeline steps fully implemented.**

---

### 1.6 Technology Stack Compliance

| Technology | Required | Actual | Compliant |
|---|---|---|---|
| Node.js + Express.js | ✅ | ✅ Node.js ESM + Express | ✅ YES |
| Flutter (Android API 21+) | ✅ | ✅ Flutter mobile app | ✅ YES |
| React.js (Admin) | ✅ | ✅ React 18 + Vite | ✅ YES |
| MongoDB | ✅ | ✅ Mongoose ODM | ✅ YES |
| JWT + bcrypt | ✅ | ✅ jsonwebtoken + bcryptjs | ✅ YES |
| WebRTC | ✅ (CON-4) | ❌ NOT implemented | ❌ NO |
| Android VpnService | ✅ (OE-5) | ❌ NOT implemented | ❌ NO |
| Python Scikit-learn (ML) | ✅ | ✅ Deployed, ❌ not integrated into flow | PARTIAL |
| Task Queue (Event-driven) | ✅ | ✅ BullMQ + custom in-memory | ✅ YES |
| Redis | Optional (for BullMQ) | ✅ Docker container, fallback works | ✅ YES |

---

## 2. Critical Architecture Concerns

### 2.1 Secure Routing — THE PRIMARY MISSING COMPONENT

The SRS document explicitly requires:
- **CON-4**: Secure communication and controlled traffic routing shall be limited to mechanisms supported by WebRTC and Android VpnService API.
- **OE-5**: Android VpnService API for node-side secure routing
- **SI-3**: The system shall interface with WebRTC components for secure peer communication between backend services and participating nodes.
- **SI-4**: The system shall interface with Android VpnService API for controlled traffic forwarding through participating Android devices.

**Current state**: `TaskSession.simulatedSecureChannel = true` — this boolean field does absolutely nothing. There is no WebRTC peer connection, no ICE candidates, no DTLS handshake, no VpnService tunnel. The system routes task instructions through Socket.IO (a standard WebSocket protocol), which is encrypted only when TLS is enabled at the transport layer.

**Impact**: Task execution works functionally (real HTTP tests occur), but the specific secure routing mechanism required by the SRS is absent.

### 2.2 ML Service Integration Gap

- Python Flask ML service (`ml-service/`) is fully deployed in Docker
- Trained model: `RandomForestRegressor` with features matching the JS scoring formula
- **Never called**: `taskAllocationService.js` uses its own pure-JS weighted scoring
- **Impact**: The architecture diagram in Chapter 3 shows ML Service as a distinct component in the pipeline. This component exists but is disconnected.

### 2.3 Missing MongoDB Collections

Only **`routing_sessions`** is truly missing as a collection (tracks per-task WebRTC session lifecycle). `AnomalyAlert` and `Notification` models exist.

### 2.4 Admin Dashboard Incomplete

The admin web frontend is missing several module-level features:
- No Alerts/AnomalyAlert view (Alerts.jsx exists but has no data source)
- No Payments management (no top-up request workflow)
- No Disputes management (no Dispute model)
- No Reports export
- Admin dashboard does not consume Socket.IO real-time events (uses polling)

### 2.5 Flutter App Scope Mismatch

SRS implies the mobile app covers both Node Participant and Platform Client roles.  
**Actual**: Flutter app is **node participant only** — no task submission, no client wallet, no client marketplace from mobile. Platform clients must use the web frontend.

---

## 3. Architecture Strengths (Well-Implemented)

1. **Task allocation engine** — composite weighted scoring (reliability, latency, bandwidth, region) with live telemetry integration
2. **Real-time node lifecycle** — heartbeat eviction (35s timeout), live status broadcast, task dispatch, result settlement all work end-to-end
3. **Dual-mode task queue** — Redis BullMQ with automatic in-memory fallback, retry logic, timeout recovery
4. **Credit settlement** — atomic wallet operations, immutable transaction log, dynamic reward formula
5. **Marketplace** — complete product/order lifecycle with refund support
6. **Role-based access** — well-structured middleware guards for all routes
7. **Node API key system** — nodes can authenticate via API key without JWT (suitable for headless agents)
8. **Admin audit log** — AdminLog created for task creation, settlement, block/unblock actions
