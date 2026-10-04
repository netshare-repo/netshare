# NetShare — Requirements Traceability Matrix
> Generated: 2026-09-26 | Against NETSHARE_SRS.md (official, authoritative)

---

## Legend
- **DONE** — End-to-end working using real implementation  
- **PARTIAL** — Some components exist but complete requirement does not work  
- **MOCK_ONLY** — UI/dummy/static/simulated implementation only  
- **BROKEN** — Implementation exists but fails or contradicts requirements  
- **NOT_STARTED** — No meaningful implementation exists  
- **NOT_APPLICABLE** — Explicitly inapplicable per official documents  

---

## FR1.x — Registration / Login (Module M1)

| FR ID | Requirement | Business Rule | Backend | UI | Database | Real/Mock | E2E | Status | Missing Work | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| FR1.1 | System shall allow new user to create an account using email address or mobile number | Email/mobile must be unique | `POST /api/auth/register` — email+phone+name+role | Register.jsx ✅ | User model (email unique, phone stored) | Real | ✅ Yes | **DONE** | — | — |
| FR1.2 | System shall allow user to enter password during registration and login | Must satisfy security policy | bcrypt salt 10, `isStrongPassword()` validation | Register.jsx, Login.jsx ✅ | passwordHash in User | Real | ✅ Yes | **DONE** | — | — |
| FR1.3 | System shall allow user to select Node Participant, Platform Client, or Both during registration | User may hold multiple roles | Role stored in User.role enum | Register.jsx role dropdown ✅ | role field: node_participant/platform_client/both/admin | Real | ✅ Yes | **DONE** | — | — |
| FR1.4 | System shall allow user to select OTP or email verification during account creation | Account activation requires successful verification | OTP generated (SHA-256 hashed), 10min expiry | VerifySignupOtp.jsx ✅ | signupOtpHash, signupOtpExpires | Real (no email delivery) | ⚠️ Partial | **PARTIAL** | OTP returned in response body only — no email service; must implement Nodemailer/SendGrid | P0 |
| FR1.5 | System shall create new user account after successful validation of registration data | Incomplete/duplicate data shall be rejected | Validates email uniqueness, password strength, role, OTP verification | Register.jsx ✅ | User.isVerified set on OTP verify | Real | ✅ Yes | **DONE** | — | — |
| FR1.6 | System shall allow verified user to log in using valid credentials | Only verified users may access protected features | `POST /api/auth/login` — checks isVerified, status=active | Login.jsx ✅ | isVerified check | Real | ✅ Yes | **DONE** | — | — |

---

## FR2.x — Profile and Role Management (Module M2)

| FR ID | Requirement | Business Rule | Backend | UI | Database | Real/Mock | E2E | Status | Missing Work | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| FR2.1 | System shall display user's profile info: name, email, mobile, profile picture | Users see own profile only | `GET /api/users/profile` | Profile.jsx ✅ | User fields | Real | ✅ Yes | **DONE** | — | — |
| FR2.2 | System shall allow users to update basic profile information | Updated data validated before saving | `PUT /api/users/profile` | Profile.jsx ✅ | User name/phone/profileImage | Real | ✅ Yes | **DONE** | — | — |
| FR2.3 | System shall allow users to upload/change profile picture | Only supported image formats accepted | Field stored in User.profileImage as string | Profile.jsx (field exists) | profileImage string | MOCK_ONLY | ❌ No | **MOCK_ONLY** | No file upload endpoint, no storage (Cloudinary/S3/local) implemented | P1 |
| FR2.4 | System shall display user's current active role | Role reflects stored config | Role returned in `GET /api/auth/me` | Profile.jsx ✅ | role field | Real | ✅ Yes | **DONE** | — | — |
| FR2.5 | System shall allow eligible users to update/confirm selected role | Role changes affect access permissions | Role update via `PUT /api/users/profile` (no dedicated role-update endpoint) | Profile.jsx (limited) | role field | Partial | ⚠️ | **PARTIAL** | No dedicated role-change API with re-verification; role update happens alongside profile edit | P2 |
| FR2.6 | System shall allow users to enable/disable participation preference | Only node-role users may configure | Participation settings via `PUT /api/node/settings` | NodeParticipation.jsx, NodeSettings screen (Flutter) | NodeDevice settings | Real | ✅ Yes | **DONE** | — | — |
| FR2.7 | System shall allow users to update account security settings | User must be authenticated before changing | `PUT /api/users/change-password` | Profile.jsx ✅ | password bcrypt hashed | Real | ✅ Yes | **DONE** | — | — |

---

## FR3.x — Node Participation Dashboard (Module M3)

| FR ID | Requirement | Business Rule | Backend | UI | Database | Real/Mock | E2E | Status | Missing Work | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| FR3.1 | Display current participation status (active/inactive) | Status reflects actual participation state | `GET /api/node/dashboard` — status field | NodeParticipation.jsx ✅, NodeDashboard.jsx (Flutter) ✅ | NodeDevice.status | Real | ✅ Yes | **DONE** | — | — |
| FR3.2 | Allow Node Participants to define daily bandwidth usage limit | Participation shall not exceed configured limit | `PUT /api/node/settings` — bandwidthLimitMB | NodeParticipation.jsx ✅ | NodeDevice.bandwidthLimitMB | Real (stored, checked in allocation) | ✅ Yes | **DONE** | — | — |
| FR3.3 | Allow Node Participants to define upload/download speed caps | Speed caps enforced during participation | `PUT /api/node/settings` — uploadSpeedCapMbps/downloadSpeedCapMbps | NodeParticipation.jsx ✅ | NodeDevice.uploadSpeedCapMbps/downloadSpeedCapMbps | STORED but not enforced at execution | ⚠️ | **PARTIAL** | Speed caps are stored but agent does not throttle actual HTTP requests to these caps | P1 |
| FR3.4 | Allow Node Participants to define maximum concurrent tasks | System shall not assign more tasks than limit | `PUT /api/node/settings` — maxConcurrentTasks | NodeParticipation.jsx ✅ | NodeDevice.maxConcurrentTasks | Real (enforced in findAvailableNode) | ✅ Yes | **DONE** | — | — |
| FR3.5 | Allow Node Participants to start device participation | Requires authenticated and available device | `POST /api/node/start` — sets status=active, creates ParticipationSession | NodeParticipation.jsx ✅ | NodeDevice.status, ParticipationSession | Real | ✅ Yes | **DONE** | — | — |
| FR3.6 | Allow Node Participants to stop device participation | Running tasks safely handled before full stop | `POST /api/node/stop` — sets status=inactive, closes session | NodeParticipation.jsx ✅ | NodeDevice.status, ParticipationSession.status=stopped | Real (no task drain waiting) | ⚠️ | **PARTIAL** | Stop does not wait for in-progress tasks to complete gracefully before disconnecting | P1 |
| FR3.7 | Display live activity: active tasks, bandwidth, speed, node health | Live metrics reflect current session data | `GET /api/node/session/current` (injects ±4ms latency noise) | NodeSession.jsx ✅, NodeDashboard screens | ParticipationSession, NodeDevice | PARTIAL — session latency has random ±4ms | ⚠️ | **PARTIAL** | Latency variation injected in `sessionController`: `Math.random() * 9 - 4` — simulated noise | P1 |
| FR3.8 | Display credits earned by node participant during session/day | Credit display based on recorded contribution | `GET /api/node/session/current` — creditsEarned from ParticipationSession | NodeSession.jsx ✅ | ParticipationSession.creditsEarned | Real | ✅ Yes | **DONE** | — | — |

---

## FR4.x — Session Monitoring Screen (Module M4)

| FR ID | Requirement | Business Rule | Backend | UI | Database | Real/Mock | E2E | Status | Missing Work | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| FR4.1 | Display session metrics: active tasks, bandwidth used, credits earned | Session data = active or latest session | `GET /api/node/session/current` | NodeSession.jsx ✅ | ParticipationSession | Real | ✅ Yes | **DONE** | — | — |
| FR4.2 | Display network metrics: latency, packet loss, stability, connection status | Metrics refreshed from monitoring data | Heartbeat/telemetry data via API | NodeSession.jsx ✅ | NodeHeartbeat, NodeTelemetry | Real (but latency has ±4ms noise) | ⚠️ | **PARTIAL** | sessionController injects `Math.random() * 9 - 4` ms noise into live latency reading | P1 |
| FR4.3 | Display session-specific details: session ID, speed, region | Traceable to running task session | `GET /api/node/session/current` | NodeSession.jsx ✅ | ParticipationSession | Real | ✅ Yes | **DONE** | — | — |
| FR4.4 | Allow Node Participant to pause active participation session | Paused sessions stop new task allocation | `PUT /api/node/pause` — sets NodeDevice.status=paused | NodeParticipation.jsx ✅ | NodeDevice.status=paused, ParticipationSession.status=paused | Real | ✅ Yes | **DONE** | — | — |
| FR4.5 | Allow Node Participant to terminate active participation session | Active tasks safely closed/logged on termination | `POST /api/node/stop` | NodeParticipation.jsx ✅ | ParticipationSession.status=stopped | Real (no task drain) | ⚠️ | **PARTIAL** | Tasks may still be dispatched mid-stop without graceful drain | P1 |

---

## FR5.x — Wallet / Earnings / Withdrawal (Module M5)

| FR ID | Requirement | Business Rule | Backend | UI | Database | Real/Mock | E2E | Status | Missing Work | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| FR5.1 | Display user's available credit balance | Updated from recorded transactions | `GET /api/wallet` | NodeWallet.jsx ✅, ClientWallet.jsx ✅ | Wallet.balance | Real | ✅ Yes | **DONE** | — | — |
| FR5.2 | Display earning-related information | Based on valid contribution records | `GET /api/wallet` + `GET /api/wallet/transactions` | NodeWallet.jsx ✅ | Wallet.earnedCredits, CreditTransaction | Real | ✅ Yes | **DONE** | — | — |
| FR5.3 | Display user's recent wallet transactions | Includes both earned and spent | `GET /api/wallet/transactions` | NodeWallet.jsx ✅, ClientWallet.jsx ✅ | CreditTransaction | Real | ✅ Yes | **DONE** | — | — |
| FR5.4 | Allow eligible users to submit a withdrawal request | Requires sufficient eligible balance | **NO API EXISTS** | **No withdrawal UI** | No withdrawal model | NOT_STARTED | ❌ No | **NOT_STARTED** | Need withdrawal request model, API, admin verification, status tracking | P0 |
| FR5.5 | Allow users to choose a supported withdrawal method | Withdrawal methods limited to supported channels | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | NOT_STARTED | ❌ No | **NOT_STARTED** | Need withdrawal channel options (JazzCash, EasyPaisa, bank) | P0 |
| FR5.6 | Allow users to provide withdrawal account details | Request not proceed without complete details | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | NOT_STARTED | ❌ No | **NOT_STARTED** | Need account details field in withdrawal model | P0 |

---

## FR6.x — Client Dashboard (Module M6)

| FR ID | Requirement | Business Rule | Backend | UI | Database | Real/Mock | E2E | Status | Missing Work | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| FR6.1 | Display number of active tasks for logged-in client | Only client's own task data shown | `GET /api/tasks/client/dashboard` — activeTasks count | ClientDashboard.jsx ✅ | TestingTask | Real | ✅ Yes | **DONE** | — | — |
| FR6.2 | Display number of completed tasks | Based on stored task records | `GET /api/tasks/client/dashboard` — completedTasks count | ClientDashboard.jsx ✅ | TestingTask | Real | ✅ Yes | **DONE** | — | — |
| FR6.3 | Display client's available credits or credit usage summary | Reflects current wallet records | `GET /api/tasks/client/dashboard` — availableCredits | ClientDashboard.jsx ✅ | Wallet | Real | ✅ Yes | **DONE** | — | — |
| FR6.4 | Provide quick access to task submission screen | Only authorized platform clients | Navigation link in ClientDashboard | ClientDashboard.jsx ✅ | — | Real | ✅ Yes | **DONE** | — | — |
| FR6.5 | Provide quick access to completed task results | Only client's own results | Navigation to MyTasks / TaskDetails | ClientDashboard.jsx ✅ | TestingTask, TaskResult | Real | ✅ Yes | **DONE** | — | — |
| FR6.6 | Provide quick access to credit top-up process | Top-up depends on supported payment workflow | Navigation to ClientWallet | ClientDashboard.jsx ✅ (link exists) | — | PARTIAL (no real top-up) | ⚠️ | **PARTIAL** | Link exists but top-up workflow (proof upload, verification) not implemented | P0 |
| FR6.7 | Display recent client task activity with status | Ordered from stored task history | `GET /api/tasks/my-tasks` | ClientDashboard.jsx shows recent tasks ✅ | TestingTask | Real | ✅ Yes | **DONE** | — | — |

---

## FR7.x — Submit Testing Task (Module M7)

| FR ID | Requirement | Business Rule | Backend | UI | Database | Real/Mock | E2E | Status | Missing Work | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| FR7.1 | Allow Platform Clients to enter target URL | URL must be valid before submission | URL validated via `isValidUrl()` in createTask | SubmitTask.jsx ✅ | TestingTask.targetUrl | Real | ✅ Yes | **DONE** | — | — |
| FR7.2 | Allow Platform Clients to select service type | Must be one of supported platform services | serviceType validated; enum in TestingTask | SubmitTask.jsx ✅ (dropdown) | TestingTask.serviceType | Real | ✅ Yes | **DONE** | — | — |
| FR7.3 | Allow Platform Clients to select target geographic region | Task execution depends on node availability in region | targetRegion field submitted and used in node selection | SubmitTask.jsx ✅ | TestingTask.targetRegion | Real | ✅ Yes | **DONE** | — | — |
| FR7.4 | Allow Platform Clients to define execution frequency/limits | Execution limits within platform bounds | executionLimit field validated; no hard platform max defined | SubmitTask.jsx ✅ | TestingTask.executionLimit | Real | ✅ Yes | **PARTIAL** | No platform-level max execution limit enforcement | P2 |
| FR7.5 | System shall create new testing task after validation | Task submission requires sufficient client credits | Credit check before task creation; enqueues task | SubmitTask.jsx ✅ | TestingTask (status=pending), Wallet deducted | Real | ✅ Yes | **DONE** | — | — |
| FR7.6 | Allow users to clear entered task parameters before submission | Reset removes unsaved data only | Reset button in form | SubmitTask.jsx ✅ | — | UI only | ✅ Yes | **DONE** | — | — |
| FR7.7 | Display estimated task cost before final submission | Based on selected task parameters | estimatedCost = executionLimit × 10 (hardcoded formula) | SubmitTask.jsx ✅ | TestingTask.estimatedCost | Real (formula-based) | ✅ Yes | **PARTIAL** | Cost formula is flat `executionLimit × 10`; not dynamic pricing as per FR-Module5 | P1 |
| FR7.8 | Display whether selected region is available for task execution | Depends on active eligible nodes | No real-time region availability check | SubmitTask.jsx (static regions dropdown, no availability indicator) | NodeDevice by region | MOCK_ONLY | ❌ No | **MOCK_ONLY** | Need `GET /api/nodes/regions/availability` endpoint to show live region node counts | P1 |

---

## FR8.x — Task Status / Results (Module M8)

| FR ID | Requirement | Business Rule | Backend | UI | Database | Real/Mock | E2E | Status | Missing Work | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| FR8.1 | Display task info: ID, service type, region, nodes used, credits consumed | Only to owning client or admin | `GET /api/tasks/:id` | TaskDetails.jsx ✅ | TestingTask, TaskResult | Real | ✅ Yes | **DONE** | — | — |
| FR8.2 | Display current status of a task | Status = one of defined task states | `GET /api/tasks/my-tasks`, `GET /api/tasks/:id` | MyTasks.jsx ✅, TaskDetails.jsx ✅ | TestingTask.status | Real | ✅ Yes | **DONE** | — | — |
| FR8.3 | Display summarized task results: success rate, response time | Based on recorded task outcomes | `GET /api/tasks/:id` returns TaskResult | TaskDetails.jsx ✅ | TaskResult | Real | ✅ Yes | **DONE** | — | — |
| FR8.4 | Allow users to download a report for a completed task | Only for completed/report-ready tasks | **NO REPORT EXPORT ENDPOINT** | No download button implemented | No report generation | NOT_STARTED | ❌ No | **NOT_STARTED** | Need report generation (PDF/JSON/CSV) and download endpoint | P1 |
| FR8.5 | Allow clients to rate node performance after task completion | Only for completed tasks | **NO RATING API** | No rating UI | No rating field | NOT_STARTED | ❌ No | **NOT_STARTED** | Need `POST /api/tasks/:id/rate-node` and rating field on NodeDevice/TaskResult | P1 |

---

## FR9.x — Top-Up Credits (Module M9)

| FR ID | Requirement | Business Rule | Backend | UI | Database | Real/Mock | E2E | Status | Missing Work | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| FR9.1 | Allow users to enter top-up amount | Amount must meet minimum | **NOT IMPLEMENTED** (only admin `demo-credit` endpoint) | ClientWallet.jsx has no top-up form; NodeWallet.jsx same | No TopUp model | NOT_STARTED | ❌ No | **NOT_STARTED** | Need top-up request API, amount validation, min limit | P0 |
| FR9.2 | Allow users to choose a supported payment method | Only supported methods available | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | NOT_STARTED | ❌ No | **NOT_STARTED** | Need payment method field and supported methods list | P0 |
| FR9.3 | Allow users to provide payment transaction reference | Reference required for verification | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | NOT_STARTED | ❌ No | **NOT_STARTED** | Need reference number field in top-up request | P0 |
| FR9.4 | Allow users to provide payment proof for manual verification | Proof must be submitted before verification | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | NOT_STARTED | ❌ No | **NOT_STARTED** | Need file upload for payment proof (screenshot/receipt) | P0 |
| FR9.5 | System shall record credit top-up request for admin verification | Wallet balance NOT updated until verified | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | No TopUpRequest model | NOT_STARTED | ❌ No | **NOT_STARTED** | Need TopUpRequest model with status=pending/approved/rejected | P0 |
| FR9.6 | Display verification status of submitted top-up request | Status reflects latest admin action | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | NOT_STARTED | ❌ No | **NOT_STARTED** | Need status display after submission | P0 |

---

## FR10.x — Marketplace (Module M10)

| FR ID | Requirement | Business Rule | Backend | UI | Database | Real/Mock | E2E | Status | Missing Work | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| FR10.1 | Display available marketplace products to authenticated users | Only active products shown | `GET /api/marketplace/products` (status=active filter) | Marketplace.jsx ✅, MarketplaceScreen.dart ✅ | MarketplaceProduct | Real | ✅ Yes | **DONE** | — | — |
| FR10.2 | Display product name, description, required credits | Matches stored marketplace records | `GET /api/marketplace/products` | Marketplace.jsx ✅ | MarketplaceProduct.name/description/requiredCredits | Real | ✅ Yes | **DONE** | — | — |
| FR10.3 | Provide redemption option for eligible items | Redemption requires sufficient credits | Order creation via `POST /api/marketplace/orders` | Marketplace.jsx ✅ (Buy button) | MarketplaceOrder | Real | ✅ Yes | **DONE** | — | — |

---

## FR11.x — Order Confirmation (Module M11)

| FR ID | Requirement | Business Rule | Backend | UI | Database | Real/Mock | E2E | Status | Missing Work | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| FR11.1 | Display selected product and required credits before confirmation | From active catalogue records | Product info passed to confirmation | Marketplace.jsx shows details ✅ | MarketplaceProduct | Real | ✅ Yes | **DONE** | — | — |
| FR11.2 | Display user's available credit balance before confirmation | Reflects current wallet | `GET /api/wallet` | ClientWallet.jsx shows balance | Wallet | Real | ✅ Yes | **DONE** | — | — |
| FR11.3 | Allow users to confirm marketplace redemption | Order confirmation requires sufficient balance | `POST /api/marketplace/orders` — checks balance | Marketplace.jsx ✅ Buy button | MarketplaceOrder, Wallet deducted | Real | ✅ Yes | **DONE** | — | — |
| FR11.4 | Allow users to cancel before final confirmation | Cancellation shall not deduct credits | No dedicated cancel endpoint at confirmation stage; user just navigates away | No Cancel button on confirmation modal | — | PARTIAL | ⚠️ | **PARTIAL** | No explicit cancel API; need `DELETE /api/marketplace/orders/:id` for pre-payment cancel | P2 |
| FR11.5 | Display current order status after redemption request | Traceable until fulfilment | `GET /api/marketplace/my-orders` | MyOrders.jsx ✅ | MarketplaceOrder.status | Real | ✅ Yes | **DONE** | — | — |

---

## FR12.x — Admin Dashboard (Module M12)

| FR ID | Requirement | Business Rule | Backend | UI | Database | Real/Mock | E2E | Status | Missing Work | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| FR12.1 | Display total registered users to administrator | Admin-only | `GET /api/admin/dashboard` — totalUsers | AdminDashboard.jsx ✅ | User count | Real | ✅ Yes | **DONE** | — | — |
| FR12.2 | Display number of active tasks | Based on current task records | `GET /api/admin/dashboard` — activeTasks | AdminDashboard.jsx ✅ | TestingTask count | Real | ✅ Yes | **DONE** | — | — |
| FR12.3 | Display overall bandwidth usage statistics | Derived from node activity | `GET /api/admin/dashboard` — (missing explicit BW aggregation) | AdminDashboard.jsx (limited) | NodeDevice.usedBandwidthMB | PARTIAL | ⚠️ | **PARTIAL** | Admin dashboard lacks total platform bandwidth aggregation from BandwidthUsage collection | P1 |
| FR12.4 | Display system performance and network health indicators | Reflects current/recent monitoring data | `GET /api/admin/nodes` — latencyMs, status | AdminDashboard.jsx (basic) | NodeDevice, NodeHeartbeat | PARTIAL | ⚠️ | **PARTIAL** | No live Socket.IO updates in admin web frontend; no health charts | P1 |
| FR12.5 | Display alerts for suspicious/abnormal platform activity | Generated from monitoring rules | **NOT IMPLEMENTED** — no AnomalyAlert model | Alerts.jsx (UI exists but likely no data) | No AnomalyAlert model | NOT_STARTED | ❌ No | **NOT_STARTED** | Need AnomalyAlert model, alert generation rules, admin alerts view | P0 |
| FR12.6 | Provide quick access to managed user and node records | Admin actions traceable | Links to Users.jsx, Nodes.jsx | AdminDashboard.jsx ✅ | — | Real | ✅ Yes | **DONE** | — | — |

---

## FR13.x — User and Node Management (Module M13)

| FR ID | Requirement | Business Rule | Backend | UI | Database | Real/Mock | E2E | Status | Missing Work | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| FR13.1 | Display list of registered users to administrator | Only administrators may access | `GET /api/admin/users` (search, filter, paginate) | Users.jsx ✅ | User | Real | ✅ Yes | **DONE** | — | — |
| FR13.2 | Display node-related details: health, activity status | Based on participation data | `GET /api/admin/nodes` | Nodes.jsx ✅ | NodeDevice | Real | ✅ Yes | **DONE** | — | — |
| FR13.3 | Allow administrators to open detailed records for individual users | Limited to authorized admins | `GET /api/admin/users` (detailed per user possible) | Users.jsx (modal or detail view) | User | Real | ✅ Yes | **DONE** | — | — |
| FR13.4 | Allow administrators to restrict suspicious user accounts | Restriction actions shall be logged | `PUT /api/admin/users/:id/block` (sets status=blocked, logs action) | Users.jsx ✅ | User.status, AdminLog | Real | ✅ Yes | **DONE** | — | — |
| FR13.5 | Allow administrators to block user accounts | Blocking auditable and follows platform rules | `PUT /api/admin/users/:id/block` + AdminLog created | Users.jsx ✅ | User.status, AdminLog | Real | ✅ Yes | **DONE** | — | — |

---

## FR14.x — Payments / Reports / Disputes (Module M14)

| FR ID | Requirement | Business Rule | Backend | UI | Database | Real/Mock | E2E | Status | Missing Work | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| FR14.1 | Display pending top-up and withdrawal requests to administrator | Admin-only | **NOT IMPLEMENTED** (only demo-credit endpoint) | Payments.jsx (UI may exist but no data) | No TopUpRequest/Withdrawal model | NOT_STARTED | ❌ No | **NOT_STARTED** | Need TopUpRequest model, withdrawal model, pending list API | P0 |
| FR14.2 | Allow administrators to approve/reject payment requests | Decision updates payment status | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | NOT_STARTED | ❌ No | **NOT_STARTED** | Need admin verify/reject API, wallet credit on approval | P0 |
| FR14.3 | Display report-related information for admin review | Report data from stored system records | `GET /api/admin/dashboard` (partial) | Reports.jsx (UI may exist) | Various collections | PARTIAL | ⚠️ | **PARTIAL** | Report aggregation incomplete; no structured report view | P1 |
| FR14.4 | Allow administrators to export reports | Exported reports reflect stored data | **NOT IMPLEMENTED** | Reports.jsx (likely no export button) | — | NOT_STARTED | ❌ No | **NOT_STARTED** | Need CSV/PDF export endpoint for transactions, tasks, usage | P1 |
| FR14.5 | Display submitted disputes awaiting admin review | Only open/stored disputes visible | **NOT IMPLEMENTED** — no Dispute model | Disputes.jsx (UI may exist but no data) | No Dispute model | NOT_STARTED | ❌ No | **NOT_STARTED** | Need Dispute model, submission API, admin list API | P1 |
| FR14.6 | Allow administrators to open and review dispute details | Dispute review actions traceable | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | NOT_STARTED | ❌ No | **NOT_STARTED** | Need dispute detail view and admin action endpoint | P1 |
| FR14.7 | Allow administrators to record final decision for dispute case | Final dispute status stored | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | **NOT IMPLEMENTED** | NOT_STARTED | ❌ No | **NOT_STARTED** | Need dispute resolution endpoint with AdminLog entry | P1 |

---

## Summary Count

| Status | Count |
|---|---|
| DONE | 29 |
| PARTIAL | 15 |
| MOCK_ONLY | 2 |
| NOT_STARTED | 18 |
| BROKEN | 0 |
| NOT_APPLICABLE | 0 |
| **TOTAL** | **64** |

**True end-to-end completion: 29/64 = ~45% of requirements fully working**
