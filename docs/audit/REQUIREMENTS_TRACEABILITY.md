# Requirements Traceability — Phase 8 authoritative register

Updated: 2026-10-08. Source: `docs/NETSHARE_SRS.md` §3.1 official numbered FR tables and `docs/NETSHARE_CHAPTER_3.md`. The SRS contains **84** functional requirements. The former 64-row audit omitted 20 requirements and is superseded, not a valid completion denominator.

**64/84 DONE (76.19%); 20/84 PARTIAL; release acceptance NOT READY.** DONE means implemented with repository/API/unit/integration evidence, not certified device/browser production E2E. PARTIAL includes missing requirement constraints, missing required mobile surfaces and blocked physical-device acceptance. Phase completion is not synonymous with full SRS compliance. Tests are explicit fixtures unless the production-process acceptance harness states otherwise.

Paths below are relative to their backend/frontend/mobile source roots. Full validation scope and limitations: [release report](RELEASE_CANDIDATE_REPORT.md). Strict NFRs are audited separately in [NFR audit](NFR_AUDIT.md).

| Official ID | SRS requirement | Status | Actual code/test evidence or remaining gap |
|---|---|---|---|
| FR1.1 | User Registration | PARTIAL | Email registration works; email-only schema prevents phone-only registration and phone uniqueness is not enforced. |
| FR1.2 | Password Entry | DONE | authController/authRoutes; phase0 + phase8 OTP/auth tests; rcValidation SMTP/register/login |
| FR1.3 | Role Selection | DONE | authController/authRoutes; phase0 + phase8 OTP/auth tests; rcValidation SMTP/register/login |
| FR1.4 | Verification Method Selection | PARTIAL | Email OTP works; no selectable SMS/alternative verification channel. |
| FR1.5 | Register Action | DONE | authController/authRoutes; phase0 + phase8 OTP/auth tests; rcValidation SMTP/register/login |
| FR1.6 | Login Action | DONE | authController/authRoutes; phase0 + phase8 OTP/auth tests; rcValidation SMTP/register/login |
| FR2.1 | View Profile | DONE | userController; web/mobile Profile; phase8 password/ownership tests |
| FR2.2 | Update Basic Information | DONE | userController; web/mobile Profile; phase8 password/ownership tests |
| FR2.3 | Upload Profile Photo | PARTIAL | Profile image string can change; supported-format upload validation/storage is absent. |
| FR2.4 | View Active Role | DONE | userController; web/mobile Profile; phase8 password/ownership tests |
| FR2.5 | Update Role | PARTIAL | Both-role workspace switching works; persisted account role change workflow is absent. |
| FR2.6 | Participation Preference Setting | DONE | userController; web/mobile Profile; phase8 password/ownership tests |
| FR2.7 | Change Security Settings | DONE | userController; web/mobile Profile; phase8 password/ownership tests |
| FR3.1 | View Participation Status | PARTIAL | Persisted participation status exists; correlation with actual Android VPN/device activity is BLOCKED. |
| FR3.2 | Set Bandwidth Limit | PARTIAL | Allocation/settlement enforce stored remaining allowance; daily reset and strict in-flight daily cap are not complete. |
| FR3.3 | Set Speed Cap | PARTIAL | Speed-cap settings are stored; packet-level upload/download throttling is not implemented. |
| FR3.4 | Set Concurrent Task Limit | DONE | nodeController/nodeHealth/allocationClaimService; phase1 + phase8; Flutter node screens |
| FR3.5 | Start Participation | PARTIAL | Authenticated start and device-session consent are enforced; real Android start/VPN validation is BLOCKED. |
| FR3.6 | Stop Participation | PARTIAL | Backend drain/stop is tested; real Android shutdown/background behavior is BLOCKED. |
| FR3.7 | View Live Activity | PARTIAL | Recorded bandwidth/capacity/health exist; measured live speed and complete device metrics remain incomplete. |
| FR3.8 | View Credits Earned | DONE | nodeController/nodeHealth/allocationClaimService; phase1 + phase8; Flutter node screens |
| FR4.1 | View Session Metrics | DONE | sessionController/ParticipationSession/taskSettlementService; phase1 + phase8; NodeSession |
| FR4.2 | View Connection Metrics | PARTIAL | Measured HTTP latency/status exists; packet loss is explicitly unmeasured, not fabricated. |
| FR4.3 | View Session Details | PARTIAL | Session ID/region exist; measured current transfer speed is incomplete. |
| FR4.4 | Pause Session | DONE | sessionController/ParticipationSession/taskSettlementService; phase1 + phase8; NodeSession |
| FR4.5 | Terminate Session | PARTIAL | Backend termination is tested; real Android resources/VPN revoke behavior is BLOCKED. |
| FR5.1 | View Wallet Balance | DONE | walletService/paymentService; phase5 + phase8; web NodeWallet and Flutter Wallet |
| FR5.2 | View Earnings Summary | DONE | walletService/paymentService; phase5 + phase8; web NodeWallet and Flutter Wallet |
| FR5.3 | View Transaction History | DONE | walletService/paymentService; phase5 + phase8; web NodeWallet and Flutter Wallet |
| FR5.4 | Submit Withdrawal Request | PARTIAL | Authorized withdrawal API/web flow passes; Node Participant Flutter withdrawal UI is absent. |
| FR5.5 | Select Withdrawal Channel | PARTIAL | Supported channel validation/web selection passes; Flutter node-wallet selection is absent. |
| FR5.6 | Enter Withdrawal Details | PARTIAL | Validated owned account details/web submission pass; Flutter node-wallet withdrawal details are absent. |
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
| FR12.3 | View Bandwidth Usage | PARTIAL | Usage reports exist; aggregate bandwidth KPI on the primary admin dashboard is absent. |
| FR12.4 | View Network Performance | PARTIAL | Node records/health monitoring exist; complete current network/performance dashboard indicators are incomplete. |
| FR12.5 | View Suspicious Activity Alerts | DONE | adminController/operationsController; phase6; admin dashboard/Operations |
| FR12.6 | View User Management Summary | DONE | adminController/operationsController; phase6; admin dashboard/Operations |
| FR13.1 | View User List | DONE | adminController/adminRoutes; phase0/phase6 authorization; ManageUsers |
| FR13.2 | View Node Records | DONE | adminController/adminRoutes; phase0/phase6 authorization; ManageUsers |
| FR13.3 | View User Details | PARTIAL | Admin lists exist; individual-user detailed record workflow is absent. |
| FR13.4 | Restrict User | PARTIAL | Audited blocking exists; distinct restricted-account state/workflow is absent. |
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
