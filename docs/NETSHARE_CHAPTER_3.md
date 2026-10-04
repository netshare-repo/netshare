# Chapter 3: Design and Architecture

> Text-first Markdown conversion of the uploaded Chapter 3 DOCX. Embedded diagrams are represented by figure placeholders/captions while the surrounding design text and tables are preserved.

This chapter presents the high-level design and architecture of NetShare: A Distributed Bandwidth Sharing Platform. The purpose of this chapter is to explain how the system described in the SRS is transformed into a structured software design. It covers the conceptual system architecture, technology and service mapping, architecture style, core design models, and data design. The chapter focuses on the major NetShare workflows: node participation, controlled testing task execution, secure routing through residential nodes, wallet-based credit settlement, marketplace purchase and fulfilment, monitoring, and administrative control. NetShare is not designed as an unrestricted proxy system. It is designed as a managed distributed internet testing platform where Platform Clients submit controlled tasks and Node Participants contribute unused bandwidth within defined limits. The backend validates every task, checks credits, selects a suitable node, creates a secure routing session, stores results, performs credit settlement, and updates dashboards. This design is aligned with the SRS constraints that NetShare shall execute only lawful and permitted internet tasks, shall require user consent for controlled routing, and shall not provide unrestricted access to blocked websites.

## 3.1 System Architecture Overview

NetShare follows a distributed system architecture in which mobile node devices, client interfaces, backend services, database storage, wallet services, marketplace services, monitoring services, and the admin dashboard work together to execute controlled internet testing tasks. The system connects three main user groups: Node Participants, Platform Clients, and System Administrators. Node Participants use the NetShare mobile application to configure bandwidth limits, start or stop participation, monitor active usage, and earn credits. Platform Clients use the client interface to submit internet testing tasks such as website accessibility verification, advertisement verification, localization testing, performance testing, UX testing, and compliance testing. System Administrators use the admin dashboard to monitor users, nodes, tasks, wallet activity, marketplace orders, disputes, suspicious activity, and platform health.

At a macro level, the NetShare architecture contains the following major parts:

#### Client and Node Mobile Application

The mobile application supports user login, profile management, wallet viewing, marketplace access, node participation control, session monitoring, and task-related interaction. For Node Participants, the app connects the device to the platform as a residential node after user consent and configuration.

#### Admin Web Dashboard

The admin dashboard provides operational control for user management, node monitoring, task tracking, payment verification, marketplace management, order fulfilment, dispute handling, reports, and suspicious activity alerts.

#### Backend API Gateway

The backend API gateway receives requests from mobile and web interfaces. It validates

request format, verifies JWT authentication, applies role-based authorization, and forwards valid requests to internal services.

#### Authentication and Authorization Service

This service manages login, registration, OTP/email verification, token issuance, password hashing, role validation, and access control. It ensures that Node Participants, Platform Clients, Dual-Role Users, and Administrators can only access features allowed for their role.

#### Task Management Service

This service manages the complete lifecycle of a testing task. It validates task parameters, creates task records, updates task states, receives results, handles failure states, and coordinates result storage and settlement.

#### Node Selection / ML Service

This service selects suitable residential nodes using region, availability, latency, bandwidth limits, reliability score, and anomaly indicators. This supports BO-6 in the SRS by using rule-based and basic ML-assisted logic for node optimization and fraud/anomaly detection.

#### Secure Routing Session Manager

This component creates authorized routing sessions between the backend and selected node devices. It uses WebRTC signalling and Android VpnService-based controlled routing to ensure that only approved testing requests are executed.

#### Wallet and Credit Service

This service manages wallet balances, credits earned by Node Participants, credits spent by Platform Clients, top-ups, withdrawals, task settlement, marketplace purchases, and transaction history.

#### Marketplace Service

This service manages digital products and services that users can purchase using earned credits. It handles product catalogue display, credit deduction, order creation, order status tracking, and admin-based manual fulfilment in the initial version.

#### Monitoring and Analytics Service

This service records bandwidth usage, active tasks, latency, node health, session activity, earned credits, suspicious activity, task metrics, and dashboard reports.

#### MongoDB Database

MongoDB stores users, node devices, participation sessions, testing tasks, task results, wallets, credit transactions, marketplace products, marketplace orders, anomaly alerts, and admin logs. The SRS specifies MongoDB for user records, task records, wallet activity, node monitoring logs, and marketplace data.

> **[Embedded figure/diagram from the original DOCX omitted in this text-only Markdown conversion.]**

*Figure 3.1: Conceptual system architecture of NetShare*

### 3.1.1 Purpose

The purpose of the system architecture overview is to provide a conceptual view of NetShare at the macro level. It shows where each module resides, which technologies support each module, how data and control flow between system components, and where security is applied.

The architecture also defines the operational boundary of NetShare. Node devices do not expose open internet access to clients. Instead, they execute only backend-approved testing tasks. The backend remains responsible for validation, authorization, node matching, secure session creation, monitoring, result storage, wallet settlement, and administrative auditability. This design supports the SRS goal of secure communication, controlled task execution, transparent usage tracking, credit-based rewards, and marketplace redemption.

### 3.1.2 Major Architectural Components

**Table 3.1 describes the main architectural components of NetShare and explains the responsibility of each component within the overall system architecture**

**Table 3.1: Major Architectural Components of NetShare**

| Component | Responsibility |
| --- | --- |
| Node Participant Mobile App | Allows users to configure participation settings, start/stop sharing, monitor bandwidth usage, view active tasks, and track credits earned. |
| Platform Client Interface | Allows clients to submit controlled testing tasks, define URL/region/task type/execution limits, monitor task status, and view results. |
| Admin Web Dashboard | Allows administrators to manage users, nodes, tasks, payments, disputes, marketplace products, orders, reports, and suspicious activity. |
| Backend API Gateway | Receives client requests, verifies JWT tokens, applies role checks, validates input, and routes requests to backend services. |
| Authentication and Authorization Service | Handles login, registration, verification, token issuance, password hashing, and role-based access control. |
| Task Management Service | Manages task validation, task creation, task status changes, result collection, failure handling, and final reporting. |
| Node Selection / ML Service | Selects suitable nodes using region, availability, latency, bandwidth limits, reliability score, and anomaly indicators. |
| Secure Routing Session Manager | Creates secure and authorized task sessions using WebRTC signalling and Android VpnService-based routing. |
| Wallet and Credit Service | Manages credit balances, task deductions, node rewards, top-ups, withdrawals, and transaction records. |
| Marketplace Service | Manages product catalogue, credit-based purchases, marketplace orders, and admin fulfilment. |
| Monitoring and Analytics Service | Tracks session metrics, node health, task logs, bandwidth usage, alerts, and dashboard reports. |
| MongoDB Database | Stores persistent records for users, devices, sessions, tasks, results, wallets, transactions, products, orders, alerts, and logs. |

### 3.1.3 Data and Control Flow

**Table 3.2 explains the step-by-step data and control flow followed when a Platform Client submits a testing task and the system executes it through a selected residential node.**

**Table 3.2: Data and Control Flow of NetShare Task Execution**

| Step | Process | Description |
| --- | --- | --- |
| 1 | Task Submission | The Platform Client enters URL, region, task type, request frequency, and execution limits. |
| 2 | Validation and Authorization | Backend verifies JWT, user role, URL format, task policy, execution limits, and credit availability. |
| 3 | Task Queueing | If valid, the task is stored in queued state until a suitable node is available. |
| 4 | Node Selection | Node Selection / ML Service ranks active nodes using region, latency, availability, bandwidth limits, reliability, and anomaly indicators. |
| 5 | Secure Session Creation | Secure Routing Session Manager creates an authorized task session with the selected node. |
| 6 | Controlled Execution | The node executes only the approved request through its residential connection. |
| 7 | Result Collection | Response status, latency, bandwidth usage, execution status, and logs are returned to the backend. |
| 8 | Data Storage | Task result, session metrics, and logs are stored in MongoDB. |
| 9 | Credit Settlement | Client credits are deducted and Node Participant credits are awarded. |
| 10 | Dashboard Updates | Client, node, and admin dashboards are updated with task status, usage, credits, and alerts. |

## 3.2 Technologies and Services

**Table 3.3 explains the major technologies, services, and security mechanisms used in the NetShare architecture. The selected technologies are based on the SRS operating environment and constraints. The SRS states that the backend shall use Node.js and Express.js, the mobile application shall use Flutter, MongoDB shall be used as the primary database, and secure routing shall use WebRTC and Android VpnService API.**

**Table 3.3: Technologies, Components, and Security Mechanisms Used in NetShare**

| Component | Description | Technology Used | Security Mechanism |
| --- | --- | --- | --- |
| Mobile Application | User-facing app for Node Participants and Platform Clients. Supports participation control, task submission, wallet, session monitoring, and marketplace access. | Flutter, Android API Level 21+, Android VpnService | HTTPS/TLS, input validation, device binding, user consent, session control |
| Admin Panel | Web dashboard for monitoring and managing users, nodes, tasks, payments, reports, marketplace products, disputes, and suspicious activity. | React.js | Admin authentication, role-based access control, audit logs, HTTPS/TLS |
| Backend API | Main communication and business logic layer for mobile app, client interface, and admin dashboard. | Node.js, Express.js | JWT authentication, bcrypt password hashing, middleware validation, rate limiting |
| Authentication Service | Handles registration, login, OTP/email verification, token generation, and role management. | Node.js service modules, JWT, bcrypt, OTP/email service | Token expiry, password hashing, verification checks, role-based authorization |
| Task Management Service | Creates and manages testing tasks, task states, execution limits, result collection, and task history. | Node.js, Express.js | Client authorization, task validation, policy checks, audit trail |
| Node Selection / ML Service | Selects and ranks suitable residential nodes using availability, region, latency, bandwidth limits, reliability, and anomaly indicators. | Python Scikit-learn or Node ML libraries | Restricted model inputs, anomaly rules, fraud detection, admin review |
| Secure Communication and Routing | Routes controlled testing requests through selected node devices using secure sessions. | WebRTC, Android VpnService API | Encrypted communication, session authentication, key |
|  |  |  | exchange, task authorization |
| Database Layer | Stores users, devices, sessions, tasks, results, wallets, transactions, marketplace records, alerts, and logs. | MongoDB | Database access control, input sanitization, indexed queries, backup protection |
| Wallet and Payment Service | Manages balances, task settlement, earnings, top-ups, withdrawals, transaction history, and payment verification. | Node.js service modules, MongoDB | Append-only transactions, admin verification, fraud checks, audit trail |
| Marketplace Service | Manages catalogue, credit-based purchases, order tracking, and admin fulfilment. | Node.js APIs, MongoDB, React.js admin UI | Order authorization, credit deduction control, fulfilment logs |
| Monitoring and Reporting | Tracks bandwidth usage, latency, node health, task logs, suspicious activity, and system reports. | Node.js services, MongoDB analytics queries | Admin-only access, data minimization, alert generation, audit logs |

### 3.2.1 Technology Justification

Flutter is used for the mobile application because NetShare requires a responsive mobile interface for both normal users and node participants. It allows fast UI development and supports Android-focused implementation, which is required because node participation depends on Android VpnService.

Node.js with Express.js is used for backend services because NetShare contains many asynchronous operations such as task submission, node status updates, monitoring events, wallet transactions, marketplace orders, and session updates. Node.js is suitable for handling these event-driven API workflows.

MongoDB is used because NetShare stores flexible and log-heavy data. Task results, node metrics, wallet transactions, marketplace orders, anomaly alerts, and admin logs may contain different structures and timestamps. A document-based database is suitable for storing this type of semi-structured operational data.

WebRTC is used to support secure communication and session creation between the backend and node devices. Android VpnService is used to support controlled request routing through

the participating device without requiring root access. Together, these technologies support the secure communication and routing requirements defined in the SRS.

JWT and bcrypt are used for authentication and credential safety. JWT supports token-based access control for mobile and web clients, while bcrypt protects stored passwords. Role-based authorization ensures that Node Participants, Platform Clients, Dual-Role Users, and Administrators can access only their permitted modules.

## 3.3 Architecture Style / Pattern

NetShare uses a hybrid Client-Server, Layered, and Event-Driven architecture pattern.

The Client-Server pattern is used because the mobile application, client interface, and admin dashboard communicate with centralized backend services. However, NetShare is not a simple client-server system because node devices also act as distributed execution nodes for controlled internet testing tasks.

The Layered architecture pattern is used to separate responsibilities into presentation, API/controller, business service, communication/routing, data access, and database layers. This separation improves maintainability, testing, security, and future extension.

The Event-Driven task pipeline is used because NetShare workflows depend on system events such as task submission, task validation, node availability, secure session creation, task execution, result collection, credit settlement, network failure, bandwidth-limit events, marketplace purchase, and admin fulfilment. The current Chapter 3 draft also identifies NetShare as using a hybrid Client-Server and Layered pattern with an event-driven task execution pipeline.

> **[Embedded figure/diagram from the original DOCX omitted in this text-only Markdown conversion.]**

*Figure 3.2: Hybrid client-server and layered architecture pattern of NetShare*

### 3.3.1 Layer Responsibilities

**Table 3.4 presents the responsibilities of each architectural layer used in NetShare, including the presentation layer, API layer, business service layer, routing layer, data access layer, and database layer.**

**Table 3.4: Layer Responsibilities in the NetShare Architecture Pattern**

| Layer | Responsibility |
| --- | --- |
| Presentation Layer | Contains Flutter mobile screens and React.js admin dashboard. It collects input and displays task, wallet, marketplace, node, and admin information. |
| API / Controller Layer | Exposes REST endpoints, validates request format, verifies JWT tokens, applies role checks, and forwards requests to services. |
| Business Service Layer | Contains logic for users, tasks, nodes, wallets, marketplace, payments, alerts, and admin actions. |
| Communication and Routing Layer | Manages WebRTC signalling, secure routing sessions, Android VpnService-based request routing, node health checks, and session closure. |
| Data Access Layer | Provides controlled database operations, query filtering, validation, indexing, and repository-style access to MongoDB collections. |
| Data and Integration Layer | Stores persistent data and connects with OTP/email services, payment verification flows, and target websites used for controlled testing. |

### 3.3.2 Architecture Rationale

This architecture pattern is selected because NetShare has multiple user interfaces, distributed mobile nodes, security-sensitive routing, wallet settlement, marketplace orders, and admin monitoring. A layered structure keeps the system manageable by separating UI, API validation, business logic, routing logic, and database operations. The hybrid design also supports security. Clients cannot directly communicate with node devices for unrestricted browsing. The backend controls task validation, node assignment, secure session creation, result storage, and settlement. This supports the SRS restriction that NetShare must not operate as an open proxy or bypass blocked websites. The event-driven workflow supports reliability. If no node is available, a task can remain queued. If a node fails, the task can be retried, failed, or timed out.

If bandwidth limits are reached, participation can be paused. If a marketplace order requires human verification, it can remain pending until the administrator fulfils it.

## 3.4 Design Models

This section presents the design models used to describe NetShare’s core workflows and internal structure. The report template requires that design models should focus on critical processes rather than trivial operations such as login, logout, edit profile, or view profile. Therefore, the selected models focus on task execution, node participation, marketplace purchase, system entities, and backend task lifecycle. NetShare follows an object-oriented development approach because its domain contains clear entities such as User, NodeDevice, ParticipationSession, TestingTask, TaskResult, Wallet, CreditTransaction, MarketplaceProduct, MarketplaceOrder, AnomalyAlert, and AdminActionLog.

### 3.4.1 Activity Diagram: Client Task Submission and Node Execution

*Figure 3.3 represents the main workflow of Platform Client task execution.*

> **[Embedded figure/diagram from the original DOCX omitted in this text-only Markdown conversion.]**

### 3.4.2 Activity Diagram: Node Participation Workflow

*Figure 3.4 represents how a Node Participant contributes unused bandwidth to*

> **[Embedded figure/diagram from the original DOCX omitted in this text-only Markdown conversion.]**

### 3.4.3 Activity Diagram: Marketplace Purchase Workflow

*Figure 3.5 explains how users redeem earned credits through the NetShare marketplace.*

> **[Embedded figure/diagram from the original DOCX omitted in this text-only Markdown conversion.]**

*Figure 3.5: Activity Diagram - Marketplace Purchase Workflow*

### 3.4.4 Class Diagram: Core Domain Model

*Figure 3.6 represents the main domain entities of NetShare and their relationships.*

> **[Embedded figure/diagram from the original DOCX omitted in this text-only Markdown conversion.]**

*Figure 3.6: Class Diagram - Core NetShare Domain Model*

### 3.4.5 Sequence Diagram: Platform Client Task Submission and Execution

*Figure 3.7 explains the interaction between the Platform Client, Client Interface, Backend API Gateway, Task and Wallet Services, Node Selection Service, Secure Session Manager, Node Device, and Database.*

> **[Embedded figure/diagram from the original DOCX omitted in this text-only Markdown conversion.]**

### 3.4.6 Sequence Diagram: Node Participant Participation Session

This sequence diagram explains how a Node Participant starts and manages a participation session.

*Figure 3.8 Node Participant Participation Session*

### 3.4.7 Sequence Diagram: Marketplace Purchase and Admin Fulfilment

*Figure 3.9 shows how earned credits are redeemed through the marketplace.*

*Figure 3. 9 Marketplace Purchase and Admin Fulfilment*

### 3.4.8 State Transition Diagram: Backend Testing Task Lifecycle

*Figure 3.10 defines the valid lifecycle of a backend testing task.*

> **[Embedded figure/diagram from the original DOCX omitted in this text-only Markdown conversion.]**

*Figure 3.10 the valid lifecycle of a backend testing task*

### 3.4.9 Design Model Traceability Matrix

**Table 3.5 maps the major SRS modules of NetShare to their supporting design models, showing how each diagram contributes to system design traceability**

**Table 3.5: Design Model Traceability Matrix**

| SRS Module / Area | Requirement Coverage | Supporting Design Models |
| --- | --- | --- |
| User Management | Registration, role selection, authentication, verification, profile and device binding | Class Diagram, Technology Table |
| Host Node Management | Participation settings, start/stop participation, bandwidth limits, session monitoring, safeguards | Node Participation Activity Diagram, Node Participation Sequence Diagram, Class Diagram |
| Client Node Management | Task submission, task parameters, task status, result viewing | Task Execution Activity Diagram, Task Execution Sequence Diagram, State Diagram |
| Secure Communication and Routing | Encrypted session setup, controlled routing, session monitoring, failure handling | Conceptual Architecture, Task Sequence Diagram, Node Sequence Diagram |
| Dynamic Pricing and Task Allocation | Node ranking, fair allocation, reliability score, anomaly indicators | Task Activity Diagram, Task Sequence Diagram, Node Selection Service |
| User Credits and Payments | Credit deductions, node rewards, top-ups, withdrawals, transaction history | Marketplace Activity Diagram, Marketplace Sequence Diagram, Class Diagram, Data Design |
| Digital Marketplace | Product catalogue, credit purchase, order creation, admin fulfilment, user alerts | Marketplace Activity Diagram, Marketplace Sequence Diagram, Class Diagram |
| Admin Dashboard and Monitoring | User/node/task monitoring, reports, disputes, suspicious activity, audit logs | Conceptual Architecture, Marketplace Sequence Diagram, Class Diagram, Data Design |
| Backend Task Lifecycle | Validation, queueing, node assignment, running, completion, settlement, failure, timeout | State Transition Diagram |

## 3.5 Data Design

The data design explains how the NetShare information domain is transformed into MongoDB collections. NetShare uses MongoDB because the system stores flexible document-based data such as user profiles, device configuration, node metrics, task parameters, task results, wallet transactions, marketplace orders, alerts, and logs. MongoDB also supports scalable storage of operational records such as session metrics and monitoring events.

The design uses a document-oriented model with controlled references. Core entities such as users, node devices, testing tasks, wallets, and marketplace orders are stored as separate collections. References such as userId, deviceId, taskId, walletId, productId, and orderId connect related records. Transaction and log records are append-only to support auditability.

### 3.5.1 Major Data Entities and Storage Items

**Table 3.6 lists the major MongoDB collections used in NetShare and explains the purpose and key design notes for each data entity.**

**Table 3.6: Major Data Entities and Storage Items**

| Collection / Data Store | Purpose | Key Design Notes |
| --- | --- | --- |
| users | Stores registered user accounts, role, profile information, verification status, and security fields. | Email/mobile should be unique; passwordHash is stored instead of plain password. |
| node_devices | Stores device records for participating nodes, including region, status, device identity, bandwidth limits, speed caps, and reliability score. | Linked to users through userId; one user may register multiple devices. |
| participation_sessions | Stores node session start time, end time, bandwidth usage, latency, packet loss, active tasks, and credits earned. | Linked to node_devices through deviceId and users through userId. |
| testing_tasks | Stores client-submitted testing tasks, including URL, task type, region, execution limits, credit estimate, and status. | Linked to client userId; task status follows state transition model. |
| task_results | Stores response status, response time, bandwidth used, execution logs, and summary of results. | Linked to taskId and deviceId. |
| routing_sessions | Stores secure session metadata such as taskId, deviceId, session status, start time, end time, and routing state. | Used to track authorized execution sessions. |
| wallets | Stores user credit balance, total earned, total spent, and wallet status. | One wallet belongs to one user. |
| credit_transactions | Stores task deductions, node earnings, top-ups, withdrawals, marketplace spending, refunds, and transaction status. | Append-only transaction records for auditability. |
| marketplace_products | Stores product name, description, required credits, availability status, and fulfilment conditions. | Managed by admin. |
| marketplace_orders | Stores buyer, product, credits deducted, order status, fulfilment notes, and activation details/status. | Linked to userId and productId. |
| anomaly_alerts | Stores suspicious activity related to nodes, users, tasks, payments, or sessions. | Supports fraud prevention and admin monitoring. |
| admin_action_logs | Stores administrator actions on users, payments, disputes, marketplace orders, restrictions, and alerts. | Required for traceability and audit. |
| notifications | Stores user/admin notifications related to tasks, wallet, marketplace orders, warnings, and alerts. | Supports dashboard and mobile alerts. |

### 3.5.2 Data Relationships

**Table 3.7 shows the important relationships between NetShare entities such as users, node devices, testing tasks, wallets, marketplace orders, task results, and admin logs**

**Table 3.7: Data Relationships among NetShare Entities**

| Relationship | Relationship Type | Explanation |
| --- | --- | --- |
| User → NodeDevice | One-to-Many | A Node Participant can register one or more devices, while each node device belongs to one user. |
| User → Wallet | One-to-One | Each user has one wallet for storing earned, spent, and available credits. |
| NodeDevice → ParticipationSession | One-to-Many | Each node device can create multiple participation sessions over time. |
| User → TestingTask | One-to-Many | A Platform Client can submit many testing tasks, while each task belongs to one client. |
| TestingTask → TaskResult | One-to-Many | A task can produce one or more task results depending on execution attempts or selected nodes. |
| TestingTask → RoutingSession | One-to-One / One-to-Many | A task normally uses one secure routing session, but multiple sessions may exist if retries or reassignment are required. |
| Wallet → CreditTransaction | One-to-Many | Each wallet can have many transaction records such as task deductions, node rewards, top-ups, withdrawals, and marketplace purchases. |
| User → MarketplaceOrder | One-to-Many | A user can place many marketplace orders, while each order belongs to one user. |
| MarketplaceProduct → MarketplaceOrder | One-to-Many | A marketplace product can appear in many orders, while each order refers to one selected product. |
| User → AnomalyAlert | One-to-Many | A user can be associated with multiple anomaly alerts if suspicious activity is detected. |
| TestingTask → AnomalyAlert | One-to-Many | A testing task can generate multiple anomaly alerts if abnormal execution, failure, or misuse is detected. |
| NodeDevice → AnomalyAlert | One-to-Many | A node device can be linked with multiple anomaly alerts related to poor behavior, unusual traffic, or reliability issues. |
| Admin → AdminActionLog | One-to-Many | One administrator can perform many actions, and each action is stored as a separate audit log entry. |

### 3.5.3 Data Dictionary

**Table 3.8 defines the important attributes of each core NetShare entity and explains the role of each entity in the system data design.**

**Table 3.8: Data Dictionary for NetShare Core Entities**

| Entity | Important Attributes | Description |
| --- | --- | --- |
| User | userId, name, email, mobileNumber, passwordHash, role, verificationStatus, createdAt | Stores account and role information for Node Participants, Platform Clients, Dual-Role Users, and Administrators. |
| NodeDevice | deviceId, userId, deviceFingerprint, region, status, bandwidthLimit, speedCap, reliabilityScore, lastSeenAt | Stores device-level information for residential node participation. |
| ParticipationSession | sessionId, userId, deviceId, startTime, endTime, bandwidthUsed, averageLatency, activeTasks, creditsEarned, status | Stores node participation session details and contribution summary. |
| TestingTask | taskId, clientId, taskType, targetUrl, region, executionLimit, requestFrequency, status, creditCost, createdAt | Stores task submitted by Platform Client. |
| TaskResult | resultId, taskId, deviceId, responseStatus, responseTime, bandwidthUsed, executionStatus, logReference, createdAt | Stores result and metrics returned from node execution. |
| RoutingSession | routingSessionId, taskId, deviceId, sessionStatus, startedAt, endedAt | Stores metadata of authorized secure routing sessions. |
| Wallet | walletId, userId, balance, totalEarned, totalSpent, walletStatus | Stores credit balance and wallet summary. |
| CreditTransaction | transactionId, walletId, userId, transactionType, amount, status, referenceId, createdAt | Stores credit changes such as task payment, node reward, top-up, withdrawal, or marketplace purchase. |
| MarketplaceProduct | productId, name, description, requiredCredits, availabilityStatus, conditions | Stores digital products and services available for credit redemption. |
| MarketplaceOrder | orderId, buyerId, productId, creditsDeducted, orderStatus, fulfilmentNotes, createdAt, fulfilledAt | Stores marketplace purchase and fulfilment details. |
| AnomalyAlert | alertId, relatedUserId, relatedDeviceId, relatedTaskId, alertType, severity, description, status, createdAt | Stores abnormal activity alerts for admin monitoring. |
| AdminActionLog | logId, adminId, actionType, targetEntity, targetEntityId, description, createdAt | Stores admin actions for audit and dispute tracking. |
| Notification | notificationId, userId, type, message, status, createdAt | Stores system notifications sent to users or administrators. |

### 3.5.4 Indexing and Integrity Rules

**Table 3.9 identifies the recommended indexed fields for important MongoDB collections to support faster searching, filtering, reporting, and dashboard performance.**

**Table 3.9: Suggested Indexing Fields for NetShare Collections**

| Collection | Suggested Indexed Fields |
| --- | --- |
| users | email, mobileNumber, role |
| node_devices | userId, region, status, reliabilityScore |
| participation_sessions | userId, deviceId, startTime, status |
| testing_tasks | clientId, status, region, taskType, createdAt |
| task_results | taskId, deviceId, createdAt |
| wallets | userId |
| credit_transactions | walletId, userId, transactionType, createdAt |
| marketplace_products | availabilityStatus, requiredCredits |
| marketplace_orders | buyerId, productId, orderStatus, createdAt |
| anomaly_alerts | severity, status, createdAt |
| admin_action_logs | adminId, targetEntity, createdAt |

### Integrity rules:

Passwords must be stored as hashes and never as plain text.

A task cannot move to running state unless a suitable node is assigned.

A task cannot be settled until its result is received and stored.

Client credits must be checked before task execution.

Wallet transactions must be append-only for auditability.

Marketplace orders cannot be created if credits are insufficient.

Node participation must stop or pause when the configured bandwidth limit is reached.

Node participation may pause or reduce when network quality becomes poor.

Admin fulfilment actions must be logged.

Suspicious activity must create an anomaly alert for admin review.

### 3.5.5 Data Security and Audit Design

Security is integrated into the data design through authentication, authorization, controlled references, audit logs, and append-only financial records. JWT-based authentication protects API access, while role-based authorization restricts users to their permitted features. Passwords are stored using bcrypt hashes. Wallet transactions, marketplace purchases, admin fulfilment actions, node restrictions, and suspicious activity alerts are stored for traceability. Data minimization is also applied. Only necessary device information, session metrics, task details, and wallet records are stored. This supports the SRS goal of transparent usage tracking while reducing unnecessary data collection.
