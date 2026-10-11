# Requirements Traceability — Phase 9 authoritative register

## Phase 10A scope update (2026-10-11)

FR7.2 now exposes only implemented GET-based accessibility, performance and localization observations; ad, UX and compliance are explicitly unsupported pending test contracts. FR8.1–FR8.4 now have persisted per-execution `TaskResult` records shown in React/Flutter details and CSV, including failure reports. This improves implementation evidence but does not change the historical 84-row totals or certify physical Android egress. See [Phase 10A audit](PHASE10A_REAL_TASK_RESULTS.md).

Updated: 2026-10-09. Source: `docs/NETSHARE_SRS.md` §3.1 official numbered FR tables and `docs/NETSHARE_CHAPTER_3.md`. The SRS contains **84** functional requirements. The former 64-row audit omitted 20 requirements and is superseded, not a valid completion denominator.

**73/84 DONE (86.90%); 11/84 PARTIAL; 0/84 NOT_DONE; release acceptance NOT READY.** DONE means implemented with repository/API/unit/integration evidence, not certified device/browser production E2E. PARTIAL includes missing requirement constraints, missing required mobile surfaces and blocked physical-device acceptance. Phase completion is not synonymous with full SRS compliance. Tests are explicit fixtures unless the production-process acceptance harness states otherwise.

Paths below are relative to their backend/frontend/mobile source roots. Full validation scope and limitations: [release report](RELEASE_CANDIDATE_REPORT.md). Strict NFRs are audited separately in [NFR audit](NFR_AUDIT.md).

| Official ID | SRS requirement | Status | Actual code/test evidence or remaining gap |
|---|---|---|---|
| FR1.1 | User Registration | PARTIAL | Phone-only registration and canonical E.164 uniqueness implemented; replacement partial unique indexes preserve multiple phone-only users. phase9Identity tests cover concurrent registration/verification. Real SMS delivery is UNVERIFIED. |
| FR1.2 | Password Entry | DONE | authController/authRoutes; phase0 + phase8 OTP/auth tests; rcValidation SMTP/register/login |
| FR1.3 | Role Selection | DONE | authController/authRoutes; phase0 + phase8 OTP/auth tests; rcValidation SMTP/register/login |
| FR1.4 | Verification Method Selection | PARTIAL | Web/Flutter email/SMS choice, OTP verification/resend/login/reset and bounded Twilio adapter implemented. Provider rejection/timeout fail closed; tests use explicit transport fixtures, not live handset delivery. |
| FR1.5 | Register Action | DONE | authController/authRoutes; phase0 + phase8 OTP/auth tests; rcValidation SMTP/register/login |
| FR1.6 | Login Action | DONE | authController/authRoutes; phase0 + phase8 OTP/auth tests; rcValidation SMTP/register/login |
| FR2.1 | View Profile | DONE | userController; web/mobile Profile; phase8 password/ownership tests |
| FR2.2 | Update Basic Information | DONE | userController; web/mobile Profile; phase8 password/ownership tests |
| FR2.3 | Upload Profile Photo | DONE | Owner-only PNG/JPEG upload, canonical base64/signature and 2 MB validation; inline storage and web/Flutter picker/preview. phase9 backend and Flutter profile tests. |
| FR2.4 | View Active Role | DONE | userController; web/mobile Profile; phase8 password/ownership tests |
| FR2.5 | Update Role | DONE | Confirmed password-protected persisted role change with transaction, active-work guard, audit and socket disconnect. Web/Flutter profile workflow; phase9 role/authorization tests. |
| FR2.6 | Participation Preference Setting | DONE | userController; web/mobile Profile; phase8 password/ownership tests |
| FR2.7 | Change Security Settings | DONE | userController; web/mobile Profile; phase8 password/ownership tests |
| FR3.1 | View Participation Status | PARTIAL | Persisted participation plus native VPN state are displayed; start failure resets mobile state. Device/VPN correlation remains BLOCKED without Android hardware/AVD. |
| FR3.2 | Set Bandwidth Limit | PARTIAL | UTC budget rollover waits for idle node; immutable task policy and persisted fail-closed TUN-byte quota with conservative 64 KiB crash reservation implemented. Backend/JUnit tests pass; actual Android quota/restart acceptance BLOCKED. |
| FR3.3 | Set Speed Cap | PARTIAL | Validated directional speed settings and native aggregate byte pacing implemented; active-task policy edits rejected atomically. Kotlin timing/concurrency fixtures pass; real-device throughput enforcement BLOCKED. |
| FR3.4 | Set Concurrent Task Limit | DONE | nodeController/nodeHealth/allocationClaimService; phase1 + phase8; Flutter node screens |
| FR3.5 | Start Participation | PARTIAL | Authenticated consent/start and failure cleanup implemented. A process-wide VPN lease prevents a second route from stealing the active tunnel. Real Android start/VPN validation BLOCKED. |
| FR3.6 | Stop Participation | PARTIAL | Backend drain/stop, native worker interruption/join and owned VPN cleanup implemented/tested at code level; real background/screen-lock shutdown BLOCKED. |
| FR3.7 | View Live Activity | PARTIAL | Flutter live activity polls native TUN byte-counter deltas and backend session/health/bandwidth, with errors/unmeasured states. Widget tests pass; actual device metric correlation BLOCKED. |
| FR3.8 | View Credits Earned | DONE | nodeController/nodeHealth/allocationClaimService; phase1 + phase8; Flutter node screens |
| FR4.1 | View Session Metrics | DONE | sessionController/ParticipationSession/taskSettlementService; phase1 + phase8; NodeSession |
| FR4.2 | View Connection Metrics | PARTIAL | Bounded authenticated-offer STUN binding probes calculate RTT, response-timeout loss and adjacent-sample jitter; stale/unavailable samples remain null. Four protocol/calculation tests pass; live Android/network evidence UNVERIFIED. Not general HTTP packet loss. |
| FR4.3 | View Session Details | PARTIAL | Session IDs/region, native measured upload/download counter deltas and diagnostic provenance exposed in Flutter/web. Code/widget evidence only; real-device speed/session correlation BLOCKED. |
| FR4.4 | Pause Session | DONE | sessionController/ParticipationSession/taskSettlementService; phase1 + phase8; NodeSession |
| FR4.5 | Terminate Session | PARTIAL | Backend termination, route-owned native resource cleanup and duplicate-close guards tested; actual VPN revoke/network switch/device lifecycle BLOCKED. |
| FR5.1 | View Wallet Balance | DONE | walletService/paymentService; phase5 + phase8; web NodeWallet and Flutter Wallet |
| FR5.2 | View Earnings Summary | DONE | walletService/paymentService; phase5 + phase8; web NodeWallet and Flutter Wallet |
| FR5.3 | View Transaction History | DONE | walletService/paymentService; phase5 + phase8; web NodeWallet and Flutter Wallet |
| FR5.4 | Submit Withdrawal Request | DONE | Flutter node-wallet withdrawal submission/history, balance checks and stable retry key use existing transactional API. Backend concurrent idempotency and Flutter wallet/authorization tests pass. |
| FR5.5 | Select Withdrawal Channel | DONE | Flutter bank/easypaisa/jazzcash selection uses existing server-supported channels; phase9 Flutter withdrawal tests. |
| FR5.6 | Enter Withdrawal Details | DONE | Flutter amount/account validation and API error/status handling; owned server-side details, reserved balance and idempotency payload binding tested. |
| FR6.1 | View Active Tasks | DONE | Flutter client_dashboard_screen/client_tasks_screen/client_wallet_screen; client_role_test |
| FR6.2 | View Completed Tasks | DONE | Flutter client_dashboard_screen/client_tasks_screen/client_wallet_screen; client_role_test |
| FR6.3 | View Credit Usage | DONE | Flutter client_dashboard_screen/client_tasks_screen/client_wallet_screen; client_role_test |
| FR6.4 | Submit New Task Shortcut | DONE | Flutter client_dashboard_screen/client_tasks_screen/client_wallet_screen; client_role_test |
| FR6.5 | View Results Shortcut | DONE | Flutter client_dashboard_screen/client_tasks_screen/client_wallet_screen; client_role_test |
| FR6.6 | Top-Up Shortcut | DONE | Flutter client_dashboard_screen/client_tasks_screen/client_wallet_screen; client_role_test |
| FR6.7 | View Recent Task Activity | DONE | Flutter client_dashboard_screen/client_tasks_screen/client_wallet_screen; client_role_test |
| FR7.1 | Enter Target URL | DONE | taskController/pricingService/regionAvailabilityService; phase3; Flutter client submission tests |
| FR7.2 | Select Service Type | DONE | taskController/pricingService/regionAvailabilityService; phase3; Flutter client submission tests |
| FR7.3 | Select Target Region | DONE | taskController/pricingService/regionAvailabilityService; phase3; Flutter client submission tests |
| FR7.4 | Set Execution Limit | DONE | taskController/pricingService/regionAvailabilityService; phase3; Flutter client submission tests |
| FR7.5 | Submit Task | DONE | taskController/pricingService/regionAvailabilityService; phase3; Flutter client submission tests |
| FR7.6 | Reset Task Form | DONE | taskController/pricingService/regionAvailabilityService; phase3; Flutter client submission tests |
| FR7.7 | View Estimated Cost | DONE | taskController/pricingService/regionAvailabilityService; phase3; Flutter client submission tests |
| FR7.8 | View Region Availability | DONE | taskController/pricingService/regionAvailabilityService; phase3; Flutter client submission tests |
| FR8.1 | View Task Information | DONE | taskController/reportService; phase3; Flutter details tests; production rating/report smoke |
| FR8.2 | View Task Status | DONE | taskController/reportService; phase3; Flutter details tests; production rating/report smoke |
| FR8.3 | View Result Summary | DONE | taskController/reportService; phase3; Flutter details tests; production rating/report smoke |
| FR8.4 | Download Report | DONE | taskController/reportService; phase3; Flutter details tests; production rating/report smoke |
| FR8.5 | Rate Nodes | DONE | taskController/reportService; phase3; Flutter details tests; production rating/report smoke |
| FR9.1 | Enter Top-Up | DONE | paymentService/adminPaymentController; phase5 + phase8; Flutter wallet/top-up tests |
| FR9.2 | Select Payment Method | DONE | paymentService/adminPaymentController; phase5 + phase8; Flutter wallet/top-up tests |
| FR9.3 | Enter Payment Reference | DONE | paymentService/adminPaymentController; phase5 + phase8; Flutter wallet/top-up tests |
| FR9.4 | Upload Payment Proof | DONE | paymentService/adminPaymentController; phase5 + phase8; Flutter wallet/top-up tests |
| FR9.5 | Submit Top-Up Request | DONE | paymentService/adminPaymentController; phase5 + phase8; Flutter wallet/top-up tests |
| FR9.6 | View Verification Status | DONE | paymentService/adminPaymentController; phase5 + phase8; Flutter wallet/top-up tests |
| FR10.1 | View Marketplace Catalogue | DONE | marketplaceController; phase6 + phase8; web/Flutter marketplace screens |
| FR10.2 | View Product Information | DONE | marketplaceController; phase6 + phase8; web/Flutter marketplace screens |
| FR10.3 | Redeem Product Option | DONE | marketplaceController; phase6 + phase8; web/Flutter marketplace screens |
| FR11.1 | View Selected Product | DONE | marketplaceController/orderStatusService; phase6 + phase8; production fulfilment/notification smoke |
| FR11.2 | View Available Balance | DONE | marketplaceController/orderStatusService; phase6 + phase8; production fulfilment/notification smoke |
| FR11.3 | Confirm Order | DONE | marketplaceController/orderStatusService; phase6 + phase8; production fulfilment/notification smoke |
| FR11.4 | Cancel Order | DONE | marketplaceController/orderStatusService; phase6 + phase8; production fulfilment/notification smoke |
| FR11.5 | View Order Status | DONE | marketplaceController/orderStatusService; phase6 + phase8; production fulfilment/notification smoke |
| FR12.1 | View Total Users | DONE | adminController/operationsController; phase6; admin dashboard/Operations |
| FR12.2 | View Active Tasks | DONE | adminController/operationsController; phase6; admin dashboard/Operations |
| FR12.3 | View Bandwidth Usage | DONE | Primary admin dashboard exposes actual aggregate BandwidthUsage totals and directional breakdown; admin-only API/UI and phase9 assertions. |
| FR12.4 | View Network Performance | DONE | Primary dashboard shows fresh-node count, measured latency, stored reliability, capacity/load and sample timestamp; null is unmeasured. phase9 dashboard tests. |
| FR12.5 | View Suspicious Activity Alerts | DONE | adminController/operationsController; phase6; admin dashboard/Operations |
| FR12.6 | View User Management Summary | DONE | adminController/operationsController; phase6; admin dashboard/Operations |
| FR13.1 | View User List | DONE | adminController/adminRoutes; phase0/phase6 authorization; ManageUsers |
| FR13.2 | View Node Records | DONE | adminController/adminRoutes; phase0/phase6 authorization; ManageUsers |
| FR13.3 | View User Details | DONE | Admin-only detailed user/wallet/node/recent-task/audit view with validated IDs and credential/API-key/OTP redaction; phase9 access and redaction tests. |
| FR13.4 | Restrict User | DONE | Audited idempotent read-only restriction separate from blocking; writes/socket admission/allocation denied, reads allowed; transaction and role race guards. phase9 authorization/idempotency tests. |
| FR13.5 | Block User | DONE | adminController/adminRoutes; phase0/phase6 authorization; ManageUsers |
| FR14.1 | View Pending Payments | DONE | operationsController/paymentService/reportService; phase5/phase6/phase8; production admin smoke |
| FR14.2 | Verify Payments | DONE | operationsController/paymentService/reportService; phase5/phase6/phase8; production admin smoke |
| FR14.3 | View Reports Summary | DONE | operationsController/paymentService/reportService; phase5/phase6/phase8; production admin smoke |
| FR14.4 | Export Reports | DONE | operationsController/paymentService/reportService; phase5/phase6/phase8; production admin smoke |
| FR14.5 | View Open Disputes | DONE | operationsController/paymentService/reportService; phase5/phase6/phase8; production admin smoke |
| FR14.6 | Review Dispute | DONE | operationsController/paymentService/reportService; phase5/phase6/phase8; production admin smoke |
| FR14.7 | Resolve Dispute | DONE | operationsController/paymentService/reportService; phase5/phase6/phase8; production admin smoke |

## Cross-cutting secure routing acceptance (SRS modules / Chapter 3)

Reliable DataChannel authorization, GET/HEAD host/port restrictions, private/metadata/redirect rejection, Android VpnService/TUN code, duplicate guards and atomic settlement exist. Backend native WebRTC loopback performs a real HTTPS request and duplicate-result delivery with one settlement. It is **not** Android, residential egress, TUN forwarding, background/lock, VPN revoke, cellular handover or NAT-separated/TURN proof. Those gates remain BLOCKED/UNVERIFIED.

## Honest model and payment scope

Ranking uses existing synthetic/basic ML-assisted scoring only over eligible nodes, with bounded deterministic JS fallback. Live Python service health remains BLOCKED by missing runtime dependencies. Alerts are rules-v1, not ML fraud prediction. Manual admin payment verification is within SRS scope; acceptance proofs/account details/fulfilment are fixtures and do not prove real external cash transfer.

## Interfaces, environment and constraints

The 32 official UI/SI/CI/OE/CON statements are included in NFR_AUDIT as separate interface/constraint checks; they must not inflate the 23 strict REL/USE/PER/SEC NFR denominator. Automatic safeguards and secure-routing module acceptance above remain release gates even where the screen-oriented FR tables do not assign a separate FR number.
