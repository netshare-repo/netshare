# Non-Functional Requirements Audit

## Legend
- **MET**: The requirement is fully implemented and passes inspection/testing.
- **PARTIAL**: The requirement is partially implemented, but some features, components, or edge cases are missing.
- **NOT_MET**: The requirement is not implemented at all, or fails significantly.
- **UNVERIFIED**: The requirement cannot be verified due to lack of benchmark test results or specific testing environments.

## 2.7.1 Reliability
| ID | Requirement | Status | Notes |
|---|---|---|---|
| REL-1 | The system shall log all task failures, connection interruptions, and settlement errors for audit and analysis purposes. | PARTIAL | Task failures logged in TaskResult/logs; settlement errors partially logged; connection interruption logging incomplete (no WebRTC session logging exists) |
| REL-2 | The system shall attempt automatic recovery for temporary connection failures during active task execution. | PARTIAL | BullMQ retry (3 attempts, exponential backoff); 15s timeout recovery in taskWorker. However, WebRTC/VpnService session recovery not implemented since secure routing doesn't exist yet. |
| REL-3 | At least 95% of successfully assigned tasks shall reach a terminal state of Completed or Failed without remaining indefinitely in an intermediate state. | PARTIAL | Timeout recovery exists (15s re-queue); but no comprehensive verification test has been run to measure whether 95% target is met. |
| REL-4 | The system shall preserve transaction history and task logs in persistent storage to avoid loss of billing and monitoring records. | MET | CreditTransaction records are append-only in MongoDB. Task records, TaskResult, BandwidthUsage all in persistent MongoDB. NodeHeartbeat/NodeTelemetry have TTL indexes (7d/14d) which means some monitoring data expires. |
| REL-5 | In case of failure during credit settlement, the system shall mark the transaction for administrative review instead of silently discarding it. | PARTIAL | Settlement errors caught in try/catch and logged. No dedicated 'settlement_failed' status or admin review queue exists. Wallet operations use sequential save() without MongoDB transactions, so partial failure is possible. |

## 2.7.2 Usability
| ID | Requirement | Status | Notes |
|---|---|---|---|
| USE-1 | The system shall allow a Node Participant to start or stop participation using no more than one primary action from the participation dashboard. | MET | Start Participation and Stop Participation are single-button actions on both React web and Flutter mobile dashboards. |
| USE-2 | The system shall allow a Platform Client to submit a testing task in no more than five main interaction steps after login. | MET | Steps: 1) Navigate to Submit Task, 2) Enter URL, 3) Select service type, 4) Select region/execution limit, 5) Submit. Five steps or fewer. |
| USE-3 | The system shall display wallet balance, task status, and node activity using clear labels and dashboard-style summaries consistent with the proposed mockups. | MET | Client dashboard shows active tasks, completed tasks, credits. Node dashboard shows status, bandwidth, credits. Wallet shows balance and transactions. All use dashboard-style layouts. |
| USE-4 | The user interface shall use readable labels, consistent navigation, and simple controls to support users with basic digital literacy. | MET | React frontend uses consistent sidebar navigation, clear button labels, form validation messages. Flutter app uses Material Design patterns. |
| USE-5 | Important system messages such as errors, order updates, payment verification results, and participation status changes shall be shown in clear and understandable language. | PARTIAL | Error messages are descriptive. However, notification system for order updates/payment results is NOT_STARTED. Participation status changes shown in dashboard but no push notifications. |

## 2.7.3 Performance
| ID | Requirement | Status | Notes |
|---|---|---|---|
| PER-1 | 95% of user login requests shall be processed within 3 seconds under normal network conditions. | UNVERIFIED | Architecture appears capable (simple bcrypt compare + JWT generation). No benchmark test has been run. |
| PER-2 | 95% of dashboard pages shall load within 4 seconds over a stable 20 Mbps internet connection. | UNVERIFIED | React static build served via Nginx; API data fetched on mount. No benchmark test has been run. |
| PER-3 | 95% of task submission requests shall be acknowledged by the server within 3 seconds after the client submits the task. | UNVERIFIED | Task creation is synchronous Express handler. No benchmark test has been run. |
| PER-4 | The system shall refresh task execution status for active tasks at least once every 10 seconds. | PARTIAL | Web frontend polls task status; node agents send heartbeat every 10s. Socket.IO events push task_completed. However, active task status is polled by frontend, not pushed in real-time to web dashboard. |
| PER-5 | The system shall display current session statistics for an active node within 5 seconds of receiving updated monitoring data. | PARTIAL | Node session endpoint returns latest data. However, latency display has simulated random noise (Math.random() * 9 - 4). Admin dashboard polls rather than receiving push updates. |
| PER-6 | The system shall support concurrent operation of multiple nodes and clients without causing incorrect task assignment or transaction settlement conflicts. | UNVERIFIED | Task allocation uses atomic-style allocation. Wallet uses sequential save() without MongoDB transactions (race condition possible). No concurrent load test has been run. |

## 2.7.4 Security
| ID | Requirement | Status | Notes |
|---|---|---|---|
| SEC-1 | The system shall ensure that only authenticated and authorized users can access protected platform functions. | MET | JWT-based authentication middleware (protect) on all non-auth routes. Role-based access control via allowRoles() middleware. |
| SEC-2 | The system shall protect communication between the server and participating nodes against unauthorized interception or manipulation. | PARTIAL | Socket.IO connections authenticated via JWT or API key. TLS available via reverse proxy. However, the SRS-required WebRTC secure channel is not implemented. No end-to-end encryption beyond transport-level TLS. |
| SEC-3 | The system shall associate participation sessions with verified devices to reduce misuse from unknown or cloned devices. | PARTIAL | NodeDevice model has deviceFingerprint field, and each node is linked to userId. However, device fingerprint is not cryptographically verified; stored but not enforced for authentication. |
| SEC-4 | The system shall record suspicious activities such as abnormal traffic, repeated failures, or unusual payment behavior for administrative review. | NOT_MET | AnomalyAlert model exists in the models directory but no anomaly detection rules are implemented. No suspicious activity is automatically detected or recorded. |
| SEC-5 | The system shall restrict task execution to authorized and lawful requests only. | MET | Task target URLs are validated; loopback addresses blocked in production; only authenticated platform_client/both users can create tasks; node agents only execute tasks dispatched by the backend. |
| SEC-6 | Sensitive wallet, transaction, and account records shall not be exposed to unauthorized users. | MET | Wallet access restricted to owning user. Task results filtered by clientId. Admin-only routes guarded. Passwords excluded via .select('-password'). OTP only returned in dev mode. |
| SEC-7 | Administrative actions affecting user accounts, transactions, or system settings shall be traceable through system logs. | MET | AdminLog model records admin actions: user block/unblock, task creation, settlement, marketplace CRUD. All admin endpoints create AdminLog entries. |

## 2.8.1 User Interface Requirements
| ID | Requirement | Status | Notes |
|---|---|---|---|
| UI-1 | The mobile application shall present dashboard-style views for participation, earnings, wallet, and profile settings. | PARTIAL | Flutter app has node participation dashboard, wallet, and profile. Missing: Platform Client mobile views. Earnings view exists. |
| UI-2 | The admin interface shall present KPI summaries, charts, node health indicators, suspicious activity panels, and user management controls. | PARTIAL | Admin dashboard has KPI summaries (user counts, task counts, credits issued). User/node management exists. Missing: charts, suspicious activity panels (no AnomalyAlert data), node health visualization. |
| UI-3 | The marketplace interface shall display product cards including product name, description, and required credits. | MET | Marketplace products displayed with name, description, creditCost on both React and Flutter. |
| UI-4 | Consistent button labels, navigation patterns, and status indicators shall be used across all system screens. | MET | React frontend uses consistent sidebar navigation and button styling. Flutter uses Material Design consistently. |
| UI-5 | The user interface shall be designed to accommodate future localization and region-based content display where needed. | PARTIAL | No i18n/l10n framework integrated. All UI strings are hardcoded in English. |

## 2.8.2 Software Interfaces
| ID | Requirement | Status | Notes |
|---|---|---|---|
| SI-1 | The system shall interface with a MongoDB database to store user records, task data, node activity logs, transactions, and marketplace information. | MET | MongoDB via Mongoose with 15 models covering all stated data types. |
| SI-2 | The system shall use Node.js and Express.js backend services to provide APIs for authentication, task management, wallet operations, and admin functions. | MET | Express.js REST API with 8 route files, 8 controllers. |
| SI-3 | The system shall interface with WebRTC components for secure peer communication between backend services and participating nodes. | NOT_MET | Zero WebRTC implementation. Socket.IO used instead. |
| SI-4 | The system shall interface with Android VpnService API for controlled traffic forwarding through participating Android devices. | NOT_MET | Flutter app uses http package for direct HTTP requests. No VpnService integration. |
| SI-5 | The system shall support integration with payment verification workflows for credit top-ups and withdrawals. | PARTIAL | TopUpRequest and WithdrawalRequest models exist. Admin demo-credit endpoint exists. Full payment proof upload and admin verification workflow not yet fully implemented. |
| SI-6 | The system shall support notification services for alerts related to orders, wallet updates, and task status changes. | PARTIAL | Notification model exists but notification delivery service not implemented. No push/email notifications sent. |

## 2.8.4 Communications Interfaces
| ID | Requirement | Status | Notes |
|---|---|---|---|
| CI-1 | The system shall use internet-based communication between mobile devices, clients, backend servers, and the admin dashboard. | MET | All communication is internet-based: REST API via HTTP/HTTPS, Socket.IO via WebSocket. |
| CI-2 | The system shall support secure communication channels for task routing and monitoring between the server and participating nodes. | PARTIAL | Socket.IO provides authenticated channel. TLS available via reverse proxy. However, the required WebRTC secure routing channel is not implemented. |
| CI-3 | The system shall support OTP or email-based communication for account verification during registration. | NOT_MET | OTP generated and stored but delivered ONLY in API response body (devOtp). No email/SMS service implemented. |
| CI-4 | The system shall support notification delivery for order updates, transaction updates, and administrative alerts. | NOT_MET | No notification delivery service. Notification model exists but no notification creation or delivery logic. |
| CI-5 | The system shall tolerate temporary communication interruptions by attempting recovery where possible and logging failures otherwise. | PARTIAL | Socket.IO auto-reconnect; BullMQ retry with exponential backoff; task timeout recovery (15s). However, no WebRTC session recovery exists. |

## 2.2 Operating Environment
| ID | Requirement | Status | Notes |
|---|---|---|---|
| OE-1 | The NetShare mobile application shall operate on Android devices supporting Android API Level 21 or above. | MET | Flutter targets minSdkVersion 21. |
| OE-2 | The NetShare web dashboard shall operate through modern web browsers on desktop or laptop systems for administrative use. | MET | React 18 + Vite standard build; works in Chrome, Firefox, Edge. |
| OE-3 | The backend server environment shall support Node.js and Express.js for asynchronous API handling and service management. | MET | Node.js with Express.js (ESM modules). |
| OE-4 | The database environment shall use MongoDB to store user records, task records, wallet activity, node monitoring logs, and marketplace data. | MET | MongoDB via Mongoose; docker-compose uses mongo:7.0. |
| OE-5 | The secure communication environment shall support WebRTC channels and Android VpnService-based traffic forwarding for controlled request routing through residential nodes. | NOT_MET | Neither WebRTC nor VpnService implemented. |
| OE-6 | The system shall support operation for geographically distributed users and participating nodes in different regions, subject to lawful internet access and local network conditions. | MET | Region field on devices; region-based task allocation; multiple nodes in different regions supported. |

## 2.3 Design and Implementation Constraints
| ID | Constraint | Status | Notes |
|---|---|---|---|
| CON-1 | Backend in Node.js and Express.js | MET | |
| CON-2 | Mobile in Flutter, primarily Android | MET | |
| CON-3 | MongoDB as primary database | MET | |
| CON-4 | Secure communication limited to WebRTC and Android VpnService API | NOT_MET | Socket.IO used instead |
| CON-5 | Only lawful/permitted tasks with user consent | MET | URL validation, loopback blocking |
| CON-6 | No bypass of regional firewalls or unrestricted access | MET | only permitted requests |
| CON-7 | Initial payment verification may be manual | MET | manual admin verification design |
| CON-8 | Simple rule-based logic with basic ML support | PARTIAL | JS scoring works; ML deployed but not integrated |
| CON-9 | Active internet connectivity required | MET | inherent |
| CON-10 | Subject to ISP policies | MET | documented limitation |

## Compliance Summary

| Status | Count |
|---|---|
| **MET** | 27 |
| **PARTIAL** | 17 |
| **NOT_MET** | 7 |
| **UNVERIFIED** | 4 |
| **TOTAL** | **55** |
