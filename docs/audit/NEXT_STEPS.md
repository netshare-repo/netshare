# NetShare — Development Roadmap (Corrected)
> Corrected: 2026-09-26 | Based on official NETSHARE_SRS.md and NETSHARE_CHAPTER_3.md
>
> ⚠️ DO NOT BEGIN IMPLEMENTATION UNTIL SUPERVISOR APPROVES

---

## Priority Classification
- 🔴 P0 — Critical — Security baseline, system correctness
- 🟠 P1 — High — Core SRS features and architecture
- 🟡 P2 — Medium — Feature completeness, mobile client
- 🟢 P3 — Low — Polish, optimization

---

## PHASE 0 — Security Baseline (P0) - ✅ COMPLETE

These have been addressed and completed.

### SEC-01: Remove public Admin registration
- Remove Admin from Register.jsx dropdown
- Backend: POST /api/auth/register must reject role=admin
- Admin accounts via seed script or admin-only creation
- Add tests proving public admin registration fails

### SEC-02: Secrets handling
- Ensure .env is gitignored
- Create/update .env.example with placeholders
- Move hardcoded secrets from docker-compose.yml to env vars
- Document secret rotation requirement

### SEC-03: CORS
- Replace origin: '*' with environment-configured origins
- Apply to both Express and Socket.IO

### SEC-04: OTP Email Delivery
- Implement Nodemailer with configurable SMTP
- Create services/emailService.js
- Env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
- OTP rate limiting and attempt limiting
- devOtp only when NODE_ENV === 'development'

### SEC-05: Security headers
- Add Helmet

### SEC-06: Financial operation safety
- MongoDB transactions for wallet operations
- Prevent double-processing

Estimated effort: 3-4 days (✅ COMPLETED)

---

## PHASE 1 — Remove Simulations (P0)

### REAL-01: Remove simulated latency noise
- Remove Math.random() * 9 - 4 from getCurrentSession
- Use actual telemetry, show 'Unavailable' if none

### REAL-02: Flutter device metrics
- Replace hardcoded cpuUsage: 5.0, memoryUsage: 25.0
- Use actual metrics or report 'unavailable'

### REAL-03: Remove misleading secure channel claims
- Remove/deprecate simulatedSecureChannel: true
- Remove 'Simulated secure session started' log text

### REAL-04: Profile image upload (FR2.3)
- Multer + local uploads
- Validate MIME type, file size, ownership

### REAL-05: Graceful Node stop (FR3.6, FR4.5)
- Prevent new assignments on stop
- Drain active tasks before stopping

Estimated effort: 3-4 days

---

## PHASE 2 — Core Secure Communication/Routing Architecture (P1)

**THIS IS A MAJOR PROJECT REQUIREMENT**

First create: docs/audit/SECURE_ROUTING_IMPLEMENTATION_PLAN.md

Then implement:

### ROUTE-01: RoutingSession model
- Create based on Chapter 3 data design
- Fields: taskId, deviceId/nodeId, clientId, sessionStatus, startedAt, endedAt

### ROUTE-02: Secure session lifecycle
- States: created, negotiating, active, recovering, completed, failed
- Map to Chapter 3 task lifecycle

### ROUTE-03: WebRTC signaling
- Implement WebRTC functionality required by Chapter 3
- Socket.IO as signaling transport
- Offer, answer, ICE candidate exchange
- Session authorization, timeout, cleanup

### ROUTE-04: Android VpnService integration
- Platform channel for Flutter/Android native
- Proof-of-concept for controlled routing

### ROUTE-05: Recovery
- Connection interruption handling per SRS
- Log connection interruption, recovery attempt, success/failure

Estimated effort: 8-12 days

---

## PHASE 3 — Complete Node Participation (P1)

### NODE-01: Enforce speed caps
### NODE-02: Daily bandwidth limit enforcement
### NODE-03: Poor network safeguard
### NODE-04: Session monitoring (real values only)

Estimated effort: 3-4 days

---

## PHASE 4 — Complete Platform Client Task Flow (P1)

### TASK-01: Region availability (FR7.8)
### TASK-02: Dynamic pricing (Module 5)
### TASK-03: Task report download (FR8.4)
### TASK-04: Node rating (FR8.5)

Estimated effort: 4-5 days

---

## PHASE 5 — ML Integration (P1)

### ML-01: Integrate Python ML service into taskAllocationService
### ML-02: Fallback to JS scoring if ML unavailable
### ML-03: Validate feature vector matches model inputs

Estimated effort: 2-3 days

---

## PHASE 6 — Top-Up / Payment Verification (P0)

### TOPUP-01 through TOPUP-10: Full FR9.1-FR9.6 implementation
- TopUpRequest model, API, proof upload, admin verify, wallet credit
- Frontend forms and admin panel

Estimated effort: 4-5 days

---

## PHASE 7 — Withdrawal System (P0)

### WD-01 through WD-07: Full FR5.4-FR5.6 implementation
- WithdrawalRequest model, API, admin review, status tracking

Estimated effort: 3-4 days

---

## PHASE 8 — Anomaly / Suspicious Activity (P1)

### ALT-01 through ALT-06: AnomalyAlert system
- Rule-based detection, admin review

Estimated effort: 3-4 days

---

## PHASE 9 — Admin Completeness (P1)

### ADMIN-01: Bandwidth aggregation (FR12.3)
### ADMIN-02: Real-time dashboard (FR12.4)
### ADMIN-03: Reports (FR14.3)
### ADMIN-04: Export (FR14.4)
### ADMIN-05: Disputes (FR14.5-FR14.7)

Estimated effort: 5-6 days

---

## PHASE 10 — Notifications (P2)

### NOTIF-01 through NOTIF-04: Full notification system
- Model, creation triggers, API, frontend unread count

Estimated effort: 2-3 days

---

## PHASE 11 — Platform Client Flutter Support (P2)

### MOBILE-01: ClientDashboard, SubmitTask, MyTasks, TaskDetails screens
### MOBILE-02: Dual-role user support

Estimated effort: 5-7 days

---

## PHASE 12 — Task State Machine Alignment (P2)

### STATE-01: Map actual behavior to Chapter 3 states
### STATE-02: Implement clean state machine with transition rules

Estimated effort: 2-3 days

---

## PHASE 13 — Testing and Performance Verification (P1)

### TEST-01: Automated test coverage
### TEST-02: Performance benchmarks for PER-1 through PER-6
### TEST-03: Create PERFORMANCE_RESULTS.md

Estimated effort: 4-5 days

---

## Total Estimated Effort

| Phase | Priority | Est. Days |
|---|---|---|
| Phase 0 — Security | P0 | 3-4 |
| Phase 1 — Remove Simulations | P0 | 3-4 |
| Phase 2 — Secure Routing | P1 | 8-12 |
| Phase 3 — Node Participation | P1 | 3-4 |
| Phase 4 — Client Task Flow | P1 | 4-5 |
| Phase 5 — ML Integration | P1 | 2-3 |
| Phase 6 — Top-Up | P0 | 4-5 |
| Phase 7 — Withdrawal | P0 | 3-4 |
| Phase 8 — Anomaly Detection | P1 | 3-4 |
| Phase 9 — Admin Completeness | P1 | 5-6 |
| Phase 10 — Notifications | P2 | 2-3 |
| Phase 11 — Flutter Client | P2 | 5-7 |
| Phase 12 — State Machine | P2 | 2-3 |
| Phase 13 — Testing | P1 | 4-5 |
| **TOTAL** | — | **~52-69 days** |
