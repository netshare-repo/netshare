# NetShare — Implementation Backlog (Corrected)
> Corrected: 2026-09-26 | Ordered by implementation phases from development roadmap

---

## PHASE 0 — Security Baseline

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| SEC-01 | Remove Admin from public registration (frontend + backend) | SEC-1 | Register.jsx, authController.js | 2hrs |
| SEC-02 | Ensure .env gitignored, create .env.example | SEC-2 | .gitignore, .env.example | 1hr |
| SEC-03 | Move secrets from docker-compose.yml to env vars | SEC-2 | docker-compose.yml | 1hr |
| SEC-04 | Implement Nodemailer email OTP delivery | FR1.4, CI-3 | services/emailService.js, authController.js | 4hrs |
| SEC-05 | Add OTP rate limiting and attempt limits | SEC-1 | middleware/securityMiddleware.js, authRoutes.js | 2hrs |
| SEC-06 | Tighten CORS to configured origins | CI-2 | server.js, socketService.js | 1hr |
| SEC-07 | Install Helmet security headers | SEC-2 | server.js | 0.5hr |
| SEC-08 | MongoDB transactions for wallet operations | REL-5 | services/walletService.js | 3hrs |

---

## PHASE 1 — Remove Simulations

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| REAL-01 | Remove latency noise Math.random() | FR4.2 | controllers/nodeController.js | 0.5hr |
| REAL-02 | Flutter real device metrics (or report unavailable) | OE-1 | Flutter NodeSocketService.dart | 2hrs |
| REAL-03 | Remove/deprecate simulatedSecureChannel field | SI-3 | models/TaskSession.js, controllers/sessionController.js | 1hr |
| REAL-04 | Profile image upload with Multer | FR2.3 | middleware/uploadMiddleware.js, controllers/userController.js, routes/userRoutes.js | 3hrs |
| REAL-05 | Graceful task drain on node stop | FR3.6, FR4.5 | controllers/nodeController.js | 2hrs |

---

## PHASE 2 — Secure Communication/Routing Architecture

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| ROUTE-00 | Create SECURE_ROUTING_IMPLEMENTATION_PLAN.md | CON-4, OE-5, SI-3, SI-4 | docs/audit/SECURE_ROUTING_IMPLEMENTATION_PLAN.md | 4hrs |
| ROUTE-01 | Create RoutingSession Mongoose model | Chapter 3 | models/RoutingSession.js | 1hr |
| ROUTE-02 | Implement session lifecycle (created→negotiating→active→recovering→completed→failed) | SI-3 | services/routingSessionService.js | 4hrs |
| ROUTE-03 | WebRTC signaling via Socket.IO (offer/answer/ICE) | CON-4, SI-3 | services/webrtcSignalingService.js, socketService.js | 8hrs |
| ROUTE-04 | Android VpnService platform channel (Flutter POC) | OE-5, SI-4 | Flutter android/app/src/main/java/.../VpnService.java, Flutter platform channel | 12hrs |
| ROUTE-05 | Connection recovery and failure logging | REL-1, REL-2 | services/routingSessionService.js | 3hrs |
| ROUTE-06 | Session identity binding (taskId, nodeId, clientId) | SEC-5 | services/routingSessionService.js | 2hrs |
| ROUTE-07 | Unauthorized target prevention | CON-5, CON-6 | services/routingSessionService.js | 2hrs |

---

## PHASE 3 — Node Participation Completion

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| NODE-01 | Enforce upload/download speed caps | FR3.3 | netshare-agent/taskExecutor.js, Flutter TaskExecutorService | 3hrs |
| NODE-02 | Daily bandwidth limit with participation pause | FR3.2, Module 2 FE-3 | controllers/nodeController.js, socketService.js | 2hrs |
| NODE-03 | Poor network safeguard (configurable thresholds) | Module 2 FE-3 | services/networkQualityService.js | 3hrs |
| NODE-04 | Session monitoring real values only | FR3.7, FR4.1, FR4.2 | controllers/nodeController.js | 1hr |

---

## PHASE 4 — Platform Client Task Flow

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| TASK-01 | Region availability endpoint | FR7.8 | controllers/nodeController.js, routes/nodeRoutes.js | 2hrs |
| TASK-02 | Dynamic pricing service | Module 5 | services/pricingService.js, controllers/taskController.js | 4hrs |
| TASK-03 | Task report download (CSV/PDF) | FR8.4 | controllers/taskController.js, routes/taskRoutes.js | 3hrs |
| TASK-04 | Node rating after task completion | FR8.5 | controllers/taskController.js, Task model | 3hrs |
| TASK-05 | Region availability display in SubmitTask.jsx | FR7.8 | netshare-frontend/src/pages/client/SubmitTask.jsx | 1hr |
| TASK-06 | Display estimated cost from pricing service | FR7.7 | SubmitTask.jsx | 1hr |

---

## PHASE 5 — ML Integration

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| ML-01 | HTTP call from taskAllocationService to ml-service /rank-nodes | CON-8 | services/taskAllocationService.js | 3hrs |
| ML-02 | Fallback to JS scoring if ML unreachable | CON-8 | services/taskAllocationService.js | 1hr |
| ML-03 | Validate feature vector matches trained model | CON-8 | ml-service/nodeRanking.py, taskAllocationService.js | 2hrs |

---

## PHASE 6 — Top-Up / Payment Verification

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| TOPUP-01 | TopUpRequest model (already exists — verify fields) | FR9.5 | models/TopUpRequest.js | 0.5hr |
| TOPUP-02 | Submit top-up API with proof upload | FR9.1-9.4 | controllers/walletController.js, routes/walletRoutes.js | 3hrs |
| TOPUP-03 | User view own top-up requests | FR9.6 | controllers/walletController.js | 1hr |
| TOPUP-04 | Admin pending top-up list | FR14.1 | controllers/adminController.js | 1hr |
| TOPUP-05 | Admin approve (credit wallet exactly once) | FR14.2 | controllers/adminController.js, walletService.js | 2hrs |
| TOPUP-06 | Admin reject with reason | FR14.2 | controllers/adminController.js | 1hr |
| TOPUP-07 | Frontend top-up form in ClientWallet | FR9.1-9.4 | ClientWallet.jsx | 3hrs |
| TOPUP-08 | Frontend top-up status display | FR9.6 | ClientWallet.jsx | 1hr |
| TOPUP-09 | Admin payments management view | FR14.1-14.2 | Payments.jsx | 3hrs |

---

## PHASE 7 — Withdrawal System

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| WD-01 | WithdrawalRequest model (already exists — verify fields) | FR5.4 | models/WithdrawalRequest.js | 0.5hr |
| WD-02 | Submit withdrawal API | FR5.4-5.6 | controllers/walletController.js | 2hrs |
| WD-03 | Admin withdrawal list | FR14.1 | controllers/adminController.js | 1hr |
| WD-04 | Admin process/approve/reject withdrawal | FR14.2 | controllers/adminController.js | 2hrs |
| WD-05 | Frontend withdrawal form | FR5.4-5.6 | NodeWallet.jsx | 3hrs |
| WD-06 | Frontend withdrawal status | FR5.4 | NodeWallet.jsx | 1hr |

---

## PHASE 8 — Anomaly / Suspicious Activity

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| ALT-01 | AnomalyAlert model (already exists — verify fields match Ch3) | FR12.5 | models/AnomalyAlert.js | 0.5hr |
| ALT-02 | Create anomalyService.js with rule definitions | FR12.5, SEC-4 | services/anomalyService.js | 4hrs |
| ALT-03 | Integrate detection into telemetry/task handlers | FR12.5 | services/socketService.js | 2hrs |
| ALT-04 | Admin alerts endpoint and route | FR12.5 | controllers/adminController.js, routes/adminRoutes.js | 1.5hrs |
| ALT-05 | Wire Alerts.jsx frontend to API | FR12.5 | Alerts.jsx | 2hrs |

---

## PHASE 9 — Admin Completeness

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| ADM-01 | Bandwidth aggregation in admin dashboard | FR12.3 | controllers/adminController.js | 2hrs |
| ADM-02 | Real-time admin dashboard via Socket.IO | FR12.4 | netshare-frontend/src/context/SocketContext.jsx, AdminDashboard.jsx | 3hrs |
| ADM-03 | Reports aggregation endpoint | FR14.3 | controllers/adminController.js | 3hrs |
| ADM-04 | CSV export endpoint | FR14.4 | controllers/adminController.js | 2hrs |
| ADM-05 | Dispute model (already exists — verify) | FR14.5 | models/Dispute.js | 0.5hr |
| ADM-06 | Dispute submission and list endpoints | FR14.5-14.6 | controllers/disputeController.js, routes/disputeRoutes.js | 3hrs |
| ADM-07 | Admin dispute resolve/dismiss | FR14.7 | controllers/disputeController.js | 2hrs |
| ADM-08 | Frontend Disputes admin view | FR14.5-14.7 | Disputes.jsx | 3hrs |

---

## PHASE 10 — Notifications

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| NOTIF-01 | Notification model (already exists — verify fields) | CI-4, SI-6 | models/Notification.js | 0.5hr |
| NOTIF-02 | Create notification service (generation triggers) | CI-4 | services/notificationService.js | 3hrs |
| NOTIF-03 | GET /api/notifications and PUT /read endpoints | CI-4 | controllers/notificationController.js, routes/notificationRoutes.js | 2hrs |
| NOTIF-04 | Frontend unread count and notification list | CI-4 | netshare-frontend components | 3hrs |

---

## PHASE 11 — Platform Client Flutter

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| MOB-01 | ClientDashboard screen | FR6.x | Flutter lib/screens/ | 4hrs |
| MOB-02 | SubmitTask screen | FR7.x | Flutter lib/screens/ | 4hrs |
| MOB-03 | MyTasks and TaskDetails screens | FR8.x | Flutter lib/screens/ | 4hrs |
| MOB-04 | Client wallet/top-up from mobile | FR5.x, FR9.x | Flutter lib/screens/ | 3hrs |
| MOB-05 | Dual-role user switching | FR1.3 | Flutter navigation | 2hrs |

---

## PHASE 12 — Task State Machine

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| STATE-01 | Map behavior to Chapter 3 states | Chapter 3 | docs/audit/ | 2hrs |
| STATE-02 | Implement state machine with transition rules | Chapter 3 | Task model, taskWorker.js, socketService.js | 4hrs |

---

## PHASE 13 — Testing and Verification

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| TEST-01 | Automated tests for walletService, rewardService, taskAllocationService | REL-4 | tests/ | 4hrs |
| TEST-02 | Tests for public admin registration rejection | SEC-1 | tests/ | 1hr |
| TEST-03 | Tests for OTP limits, cross-user access | SEC-1, SEC-6 | tests/ | 2hrs |
| TEST-04 | Tests for task state transitions | REL-3 | tests/ | 2hrs |
| TEST-05 | Tests for top-up/withdrawal/marketplace | FR9.x, FR5.x | tests/ | 3hrs |
| TEST-06 | Performance benchmarks PER-1 through PER-6 | PER-1-6 | docs/audit/PERFORMANCE_RESULTS.md | 4hrs |

---

## Backlog Summary

| Phase | Items | Est. Effort |
|---|---|---|
| Phase 0 — Security | 8 | ~14.5 hrs |
| Phase 1 — Remove Simulations | 5 | ~8.5 hrs |
| Phase 2 — Secure Routing | 8 | ~36 hrs |
| Phase 3 — Node Participation | 4 | ~9 hrs |
| Phase 4 — Client Task Flow | 6 | ~14 hrs |
| Phase 5 — ML Integration | 3 | ~6 hrs |
| Phase 6 — Top-Up | 9 | ~15.5 hrs |
| Phase 7 — Withdrawal | 6 | ~9.5 hrs |
| Phase 8 — Anomaly Detection | 5 | ~10 hrs |
| Phase 9 — Admin Completeness | 8 | ~18.5 hrs |
| Phase 10 — Notifications | 4 | ~8.5 hrs |
| Phase 11 — Flutter Client | 5 | ~17 hrs |
| Phase 12 — State Machine | 2 | ~6 hrs |
| Phase 13 — Testing | 6 | ~16 hrs |
| **TOTAL** | **79** | **~189 hrs** |
