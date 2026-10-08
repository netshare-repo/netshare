# NetShare — Implementation Backlog (Corrected)
> Corrected: 2026-09-26 | Ordered by implementation phases from development roadmap

## Phase 8 — Current release blockers (2026-10-08)

**Release candidate NOT READY.** Historical roadmap tables below are not a current todo list; completed Phases 0–7 are not reopened. Phase 8 regression fixes and validation are recorded in [RELEASE_CANDIDATE_REPORT.md](RELEASE_CANDIDATE_REPORT.md).

Validation: 205/205 backend tests on real replica-set transactions; 50/50 Flutter tests; clean analysis; Android arm64 debug build; frontend production build/full lint; all three npm audits zero vulnerabilities. Bounded DB concurrency and production-process local recovery/workflow pass. Docker/runtime and device gates do not.

| Release item | Status | Missing acceptance / gap |
|---|---|---|
| Android real E2E/TUN routing | BLOCKED | No physical device or AVD; code/build/tests cannot prove residential egress. |
| Background/lock/VPN revoke/Wi-Fi-mobile recovery | BLOCKED | Needs real Android lifecycle and network environment. |
| TURN / NAT-separated peers | UNVERIFIED | Needs actual relay credentials, separated networks and candidate evidence. |
| Docker production runtime | BLOCKED | Docker CLI/daemon absent; parse/build/fresh and existing-volume authenticated RS bootstrap/secrets/health/restart not executed. |
| Android API compatibility | NOT_MET | Actual APK min API 24; SRS OE-1 requires API 21. Resolve supported artifact or approved requirement change. |
| Production TLS/SMTP/Mongo HA/restore | UNVERIFIED | Local loopback RS/SMTP sink is not authenticated failover or public deployment evidence. |
| Live Python ML service | BLOCKED | Flask/sklearn dependencies unavailable; actual unavailable-service JS fallback passes. |
| Browser/device/load/usability NFRs | UNVERIFIED | Need 20 Mbps page loads, actual refresh/render timing, ≥95% assigned terminal cohort, fleet/multi-backend recovery and live Redis rejoin. |
| Official FR constraints | PARTIAL | 20 items in refreshed 84-row register: phone/verification selection, photo upload, stored-role changes, daily usage rollover/enforcement, speed caps/live metrics, device lifecycle, Flutter node withdrawals and admin detail/KPIs. |

Current official totals: **64/84 FR DONE (76.19%), 20 PARTIAL; 23 strict NFRs: 12 MET / 5 PARTIAL / 6 UNVERIFIED**. Interfaces/environment/constraints are 32 separate statements, not extra strict NFRs. No new product feature work was authorized in Phase 8. Do not start another phase automatically.

## Requested Phase 6 Completion — 2026-10-07

Alerts, administrative reports/CSV, owned-reference disputes, and in-app notifications are implemented. The historical roadmap headings below differ from the user's requested phase numbering: requested Phase 6 completes ALT-01–05, ADM-03–08, and NOTIF-01–04, not unrelated ADM-01/02 dashboard work. Validation: 179/179 backend tests, production frontend build, and touched frontend ESLint PASS. Atomic reviews/payments/order finalization require MongoDB replica-set/sharded transactions; standalone DB returns 503. No Phase 6 implementation blocker remains. Production deployment/load validation is unverified; prior real Android E2E/TURN and live ML validation limitations remain unchanged.

Rules-v1 uses explicit thresholds and one alert per rule/entity/UTC day, not ML anomaly prediction. Notifications reconcile durable records at startup/every 60 seconds and poll in-app every 30 seconds; payment/dispute/order final transitions also generate notifications transactionally. No push/SMS integration is claimed. Reports distinguish creation-date/current-status cohorts and current wallet snapshots from period ledger/bandwidth data. Dispute resolution does not authorize automatic financial adjustments.

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
 
| ID | Task | FR/NFR | Files | Status |
|---|---|---|---|---|
| ROUTE-00 | Create SECURE_ROUTING_IMPLEMENTATION_PLAN.md | CON-4, OE-5, SI-3, SI-4 | docs/audit/SECURE_ROUTING_IMPLEMENTATION_PLAN.md | [DONE] |
| ROUTE-01 | Create RoutingSession Mongoose model | Chapter 3 | models/RoutingSession.js | [DONE - Phase 2A] |
| ROUTE-02 | Implement session lifecycle (created→negotiating→active→recovering→completed→failed) | SI-3 | services/routingSessionService.js | [DONE - Phase 2A] |
| ROUTE-03 | WebRTC signaling via Socket.IO (offer/answer/ICE) | CON-4, SI-3 | services/webrtcSignalingService.js, socketService.js | [DONE - Phase 2A] |
| ROUTE-04 | Android VpnService platform channel (Flutter bridge) | OE-5, SI-4 | NetShareVpnService.kt, MainActivity.kt, lib/services/vpn_service.dart | [DONE - Phase 2C] |
| ROUTE-05 | Connection recovery and failure logging | REL-1, REL-2 | services/routingSessionService.js | [DONE - Phase 2A] |
| ROUTE-06 | Session identity binding (taskId, nodeId, clientId) | SEC-5 | services/routingSessionService.js | [DONE - Phase 2A] |
| ROUTE-07 | Unauthorized target prevention | CON-5, CON-6 | services/routingSessionService.js | [DONE - Phase 2A] |
| ROUTE-08 | Backend WebRTC PeerConnection & DataChannel Manager | Chapter 3, SI-3 | services/webrtcPeerService.js | [DONE - Phase 2B] |
| ROUTE-09 | Versioned DataChannel message protocol & deduplication | Chapter 3, SI-3 | services/webrtcPeerService.js | [DONE - Phase 2B] |
| ROUTE-10 | Environment STUN/TURN configuration & credential safety | Chapter 3, SEC-2 | config/env.js | [DONE - Phase 2B] |
| ROUTE-11 | Connection/Open/Idle timeouts & ICE restart signaling | Chapter 3, REL-1 | services/webrtcPeerService.js, webrtcSignalingService.js | [DONE - Phase 2B] |
| ROUTE-12 | Loop-safe Android VpnService TUN forwarding & socket protect | OE-5, SI-4 | NetShareVpnService.kt, MainActivity.kt, vpn_service.dart | [DONE - Phase 2F task-scoped /32 TCP relay with protected upstream sockets] |
| ROUTE-13 | Target authorization, SSRF, RFC1918, metadata & redirect guards | CON-4, CON-5, SEC-1 | services/targetValidationService.js, secureTaskExecutor.js, task_executor_service.dart | [DONE - Phase 2E validated] |
| ROUTE-14 | End-to-end task routing coordinator & exactly-once settlement | Chapter 3, SI-3 | services/secureTaskRoutingService.js, taskWorker.js, tests/phase2d.test.js | [DONE - live worker/Android DataChannel path wired with failure-without-reward handling] |
| ROUTE-15 | Real Android physical/emulator device E2E task execution | OE-5, SI-4 | Android emulator/device | [BLOCKED - No device/AVD/system image; emulator acceleration inaccessible] |
| ROUTE-16 | Android WebRTC peer/DataChannel task transport | Chapter 3, SI-3 | android_webrtc_service.dart, secure_routing_protocol.dart | [DONE - Phase 2F offer/answer/ICE/reliable DataChannel; Socket.IO task fallback disabled] |
| ROUTE-17 | Approved HTTP forwarding through Android VpnService TUN | OE-5, SI-4 | NetShareVpnService.kt, task_executor_service.dart | [DONE - Phase 2F HTTP/HTTPS TCP relay restricted by authorized public IP and port] |

---

## PHASE 3 — Node Participation Completion

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| NODE-01 | Enforce upload/download speed caps | FR3.3 | netshare-agent/taskExecutor.js, Flutter TaskExecutorService | 3hrs |
| NODE-02 | Daily bandwidth limit with participation pause | FR3.2, Module 2 FE-3 | controllers/nodeController.js, socketService.js | 2hrs |
| NODE-03 | Poor network safeguard (configurable thresholds) | Module 2 FE-3 | services/networkQualityService.js | 3hrs |
| NODE-04 | Session monitoring real values only | FR3.7, FR4.1, FR4.2 | controllers/nodeController.js | 1hr |

---

## PHASE 4 — Platform Client Task Flow (COMPLETED AS REQUESTED PHASE 3)

| ID | Task | FR/NFR | Files | Status |
|---|---|---|---|---|
| TASK-01 | Region availability endpoint | FR7.8 | controllers/nodeController.js, routes/nodeRoutes.js | [DONE - live eligible/connected capacity] |
| TASK-02 | Dynamic pricing service | Module 5 | services/pricingService.js, controllers/taskController.js | [DONE - deterministic `rule-v1`; no ML] |
| TASK-03 | Task report download (CSV) | FR8.4 | controllers/taskController.js, routes/taskRoutes.js | [DONE - owner/admin, completed-only] |
| TASK-04 | Node rating after task completion | FR8.5 | controllers/taskController.js, TestingTask.js, NodeDevice.js | [DONE - one-per-task atomic claim] |
| TASK-05 | Region availability display in SubmitTask.jsx | FR7.8 | netshare-frontend/src/pages/client/SubmitTask.jsx | [DONE] |
| TASK-06 | Display estimated cost from pricing service | FR7.7 | SubmitTask.jsx | [DONE] |

---

## PHASE 5 — ML Integration (COMPLETED AS REQUESTED PHASE 4)

| ID | Task | FR/NFR | Files | Status |
|---|---|---|---|---|
| ML-01 | HTTP call from taskAllocationService to ml-service /rank-nodes | CON-8 | services/taskAllocationService.js, docker-compose.yml | [DONE — eligible candidates only; 750 ms default timeout] |
| ML-02 | Fallback to JS scoring if ML unreachable | CON-8 | services/taskAllocationService.js, tests/phase4.test.js | [DONE — timeout/network/HTTP/malformed response; source logged] |
| ML-03 | Validate feature vector matches trained model | CON-8 | ml-service/nodeRanking.py, taskAllocationService.js, tests/phase4.test.js | [DONE — exact latency, remaining bandwidth, reliability, successRate mapping] |
| ML-04 | Prevent duplicate task allocation during ranking retry/fallback | CON-8, REL-5 | workers/taskWorker.js, tests/phase4.test.js | [DONE — atomic node reservation and task claim] |
| ML-05 | Verify live Flask service and real-data ranking quality | CON-8 | ml-service/ | [UNVERIFIED — no Flask/scikit-learn/Docker on this host; synthetic model is not production-validated] |

---

## PHASE 6 — Top-Up / Payment Verification (COMPLETED AS REQUESTED PHASE 5)

| ID | Task | FR/NFR | Files | Status |
|---|---|---|---|---|
| TOPUP-01 | TopUpRequest model (was absent) | FR9.5 | models/TopUpRequest.js | [DONE] |
| TOPUP-02 | Submit top-up API with validated proof upload | FR9.1-9.4 | paymentController.js, paymentService.js, walletRoutes.js | [DONE — PNG/JPEG/PDF, 2 MB, unique reference] |
| TOPUP-03 | User view own top-up requests | FR9.6 | paymentController.js | [DONE] |
| TOPUP-04 | Admin pending top-up list and protected proof | FR14.1 | adminPaymentController.js | [DONE] |
| TOPUP-05 | Admin approve (credit wallet exactly once) | FR14.2 | paymentService.js | [DONE — Mongo transaction + unique ledger key] |
| TOPUP-06 | Admin reject with reason | FR14.2 | paymentService.js | [DONE — audited] |
| TOPUP-07 | Frontend top-up form in ClientWallet | FR9.1-9.4 | ClientWallet.jsx | [DONE] |
| TOPUP-08 | Frontend top-up status display | FR9.6 | ClientWallet.jsx | [DONE] |
| TOPUP-09 | Admin payments management view | FR14.1-14.2 | Payments.jsx | [DONE] |

---

## PHASE 7 — Withdrawal System (COMPLETED AS REQUESTED PHASE 5)

| ID | Task | FR/NFR | Files | Status |
|---|---|---|---|---|
| WD-01 | WithdrawalRequest model (was absent) | FR5.4 | models/WithdrawalRequest.js | [DONE] |
| WD-02 | Submit withdrawal API | FR5.4-5.6 | paymentController.js, paymentService.js | [DONE — net earned balance reserved transactionally] |
| WD-03 | Admin withdrawal list | FR14.1 | adminPaymentController.js | [DONE] |
| WD-04 | Admin process/approve/reject withdrawal | FR14.2 | paymentService.js | [DONE — one refund, audited transitions] |
| WD-05 | Frontend withdrawal form | FR5.4-5.6 | NodeWallet.jsx | [DONE] |
| WD-06 | Frontend withdrawal status | FR5.4 | NodeWallet.jsx | [DONE] |

---

## PHASE 8 — Anomaly / Suspicious Activity (COMPLETED AS REQUESTED PHASE 6)

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| ALT-01 | AnomalyAlert model (was absent) | FR12.5 | models/AnomalyAlert.js | [DONE — Chapter 3 fields plus evidence/dedup/review] |
| ALT-02 | Rule-based anomaly definitions | FR12.5, SEC-4 | services/anomalyService.js | [DONE — node limits/health, repeated task failures, task/payment bursts and rejections] |
| ALT-03 | Detect from persisted task/node/payment records | FR12.5 | services/monitoringService.js, server.js | [DONE — startup/60-second scan; retry-safe unique alert keys] |
| ALT-04 | Admin alerts list/review and audit | FR12.5 | operationsController.js, operationsRoutes.js | [DONE — admin only; atomic review/audit] |
| ALT-05 | Admin alert UI | FR12.5 | pages/admin/Operations.jsx | [DONE — status filters, notes, evidence and review] |

---

## PHASE 9 — Admin Completeness

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| ADM-01 | Bandwidth aggregation in admin dashboard | FR12.3 | controllers/adminController.js | 2hrs |
| ADM-02 | Real-time admin dashboard via Socket.IO | FR12.4 | netshare-frontend/src/context/SocketContext.jsx, AdminDashboard.jsx | 3hrs |
| ADM-03 | Reports aggregation endpoint | FR14.3 | services/reportService.js, operationsController.js | [DONE — stored summaries, strict UTC date filters and explicit snapshot basis] |
| ADM-04 | CSV export endpoint | FR14.4 | services/reportService.js, pages/admin/Operations.jsx | [DONE — admin-only downloadable escaped CSV] |
| ADM-05 | Dispute model (was absent) | FR14.5 | models/Dispute.js | [DONE — one per owner/reference, review history] |
| ADM-06 | Dispute submission and list endpoints | FR14.5-14.6 | operationsController.js, operationsRoutes.js | [DONE — task/order/top-up/withdrawal ownership, paginated owner/admin lists] |
| ADM-07 | Admin dispute resolve/dismiss | FR14.7 | operationsController.js | [DONE — under_review required; transaction with audit and notification] |
| ADM-08 | Frontend dispute submission/history and admin view | FR14.5-14.7 | pages/common/Disputes.jsx, pages/admin/Operations.jsx | [DONE] |

---

## PHASE 10 — Notifications (COMPLETED AS REQUESTED PHASE 6)

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| NOTIF-01 | Notification model (was absent) | CI-4, SI-6 | models/Notification.js | [DONE — user/event unique key and read state] |
| NOTIF-02 | Generate/reconcile persistent notifications | CI-4 | notificationService.js, monitoringService.js, paymentService.js, orderStatusService.js | [DONE — tasks, payments, orders, disputes, node warnings and admin alerts] |
| NOTIF-03 | Owned notification list/unread/read endpoints | CI-4 | operationsController.js, operationsRoutes.js | [DONE — paginated list, idempotent individual/all read] |
| NOTIF-04 | Frontend unread count and notification list | CI-4 | components/common/NotificationBell.jsx, layouts | [DONE — admin/client/node header dropdown with polling and pagination] |

---

## PHASE 11 — Platform Client Flutter (COMPLETED AS REQUESTED PHASE 7)

| ID | Task | FR/NFR | Files | Effort |
|---|---|---|---|---|
| MOB-01 | ClientDashboard screen | FR6.x | lib/screens/client/client_dashboard_screen.dart | [DONE — backend totals, shortcuts and recent activity] |
| MOB-02 | SubmitTask screen | FR7.x | lib/screens/client/submit_task_screen.dart, services/client_api.dart | [DONE — live regions, server estimate, validation and submission; no local pricing] |
| MOB-03 | MyTasks and TaskDetails screens | FR8.x | lib/screens/client/my_tasks_screen.dart, task_details_screen.dart | [DONE — owned results, CSV access/save and one-time node rating] |
| MOB-04 | Client wallet/top-up from mobile | FR5.x, FR9.x | lib/screens/client/client_wallet_screen.dart, mobile_document_service.dart, MainActivity.kt | [DONE — history, actual proof picker/upload, manual verification status] |
| MOB-05 | Dual-role user switching | FR1.3 | lib/screens/role_home_screen.dart, login/splash/OTP routes | [DONE — server-validated roles; per-user workspace preference; no implicit participation changes] |
| MOB-06 | Marketplace and notification access | FR10.x, SI-6 | existing marketplace/order screens, notifications_screen.dart, notification_button.dart | [DONE — reuse marketplace; paginated in-app notifications and unread state] |
| MOB-07 | Real Android client-role runtime validation | FR6–10, OE-5 | Android device/AVD | [BLOCKED — no connected device or configured AVD; native proof/save and live task flow unverified on device] |

Requested Phase 7 validation: 179/179 backend tests, 46/46 Flutter tests (24 new client/role tests), clean Flutter analysis, and Android arm64 debug APK build PASS. No backend business logic changes. Deployment API is configurable with `NETSHARE_API_URL` at build time. Node functionality and prior device/TURN/ML validation limitations remain unchanged; a mode switch changes UI only and does not start or stop sharing. No Phase 7 code blocker remains; on-device E2E is still blocked.

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
| Phase 2 — Secure Routing | 18 | ~36 hrs |
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
| **TOTAL** | **89** | **~189 hrs** |
