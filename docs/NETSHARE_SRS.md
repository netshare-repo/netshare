# NetShare — Project Proposal / SRS

> Text-first Markdown conversion of the uploaded NetShare proposal/SRS. Mockup and diagram images are not embedded; their captions and all extractable textual requirements are retained. The wording is preserved from the source as closely as practical.

---


<!-- Source PDF page 1 -->

COMSATS University Islamabad (CUI)

Project Proposal

for

NetShare

Version 1.0

By

Muhammad Hashim CIIT/SP23-BCS-055/ISB

Saqlain Mushtaq CIIT/SP23-BCS-083/ISB

Supervisor

Mr. Qasim Malik

Bachelor of Science in Computer Science (2023-2027)

The candidate confirms that the work submitted is their own and appropriate

credit has been given where reference has been made to the work of others.


<!-- Source PDF page 2 -->

COMSATS University, Islamabad Pakistan

NetShare

A project presented to

COMSATS University, Islamabad

In partial fulfillment

of the requirement for the degree of

Bachelor of Science in Computer Science(2023-2027)

By

Muhammad Hashim CIIT/SP23-BCS-055/ISB

Saqlain Mushtaq CIIT/SP23-BCS-083/ISB


<!-- Source PDF page 3 -->

# Abstract

NetShare is proposed to address the underutilization of purchased internet bandwidth and

convert it into a useful digital resource. Existing practice shows that a significant portion of

internet bandwidth on personal and residential connections remains unused for long periods.

At the same time, organizations that need regional internet testing often depend on

datacenter-based systems, which do not always represent real residential user environments

accurately. This creates challenges in verifying advertisements, checking regional website

accessibility, testing localized content, and measuring website performance from real user

networks. It also limits the availability of a structured and rewarding platform through which

ordinary users can safely contribute their unused bandwidth. Current bandwidth-sharing and

proxy-based systems mainly focus on passive monetization and provide limited

transparency, service variety, and localized user control. NetShare is designed to fill this

gap by introducing a managed platform that connects residential node participants with

clients who need controlled internet testing services. The project aims to enable services

such as ad verification, accessibility monitoring, localization testing, performance and UX

testing, and digital policy compliance testing through real residential nodes. It also aims to

provide secure communication, controlled task execution, and accurate monitoring of

bandwidth usage and session activity. In addition, the project intends to reward contributors

through a credit-based system and allow redemption through a digital marketplace. As a

final product, NetShare can improve internet resource utilization while providing a practical,

transparent, and scalable platform for distributed internet testing and monitoring.


<!-- Source PDF page 4 -->

# Abbreviations

| Abbreviation | Description |
| --- | --- |
| API | Application Programming Interface |
| CDN | Content Delivery Network |
| DNS | Domain Name System |
| FR | Functional Requirement |
| FYP | Final Year Project |
| GB | Gigabyte |
| GUI | Graphical User Interface |
| HTTP | Hypertext Transfer Protocol |
| HTTPS | Hypertext Transfer Protocol Secure |
| ISP | Internet Service Provider |
| JWT | JSON Web Token |
| KPI | Key Performance Indicator |
| ML | Machine Learning |
| NFR | Non-Functional Requirement |
| OTP | One-Time Password |
| REST | Representational State Transfer |
| SRS | Software Requirements Specification |
| SQL | Structured Query Language |
| UI | User Interface |
| URL | Uniform Resource Locator |
| UX | User Experience |
| VPN | Virtual Private Network |
| WebRTC | Web Real-Time Communication |


<!-- Source PDF page 5 -->

# Contents

Abstract ................................................................................................................................................. iii

# Chapter 1: Introduction and Problem Definition .................................................................................... 1

## 1.1 Overview of the Project ................................................................................................................ 1

## 1.2 Vision Statement ........................................................................................................................... 1

## 1.3 Problem Statement ........................................................................................................................ 2

## 1.4 Problem Solution / Objectives of the Proposed System .................................................................. 2

## 1.5 Objectives ..................................................................................................................................... 2

## 1.6 Scope ............................................................................................................................................ 3

### 1.6.1 System Limitations / Constraints ............................................................................................... 3

## 1.7 Modules ........................................................................................................................................ 4

### 1.7.1 Module 1: User Management .............................................................................................. 4

### 1.7.2 Module 2: Host Node Management ..................................................................................... 4

### 1.7.3 Module 3: Client Node Management .................................................................................. 5

### 1.7.4 Module 4: Secure Communication & Routing Management .............................................. 5

### 1.7.5 Module 5: Dynamic Pricing & Task Allocation .................................................................. 6

### 1.7.6 Module 6: User Credits & Payments ................................................................................... 6

### 1.7.7 Module 7: Digital Marketplace............................................................................................ 6

### 1.7.8 Module 8: Admin Dashboard & System Monitoring .......................................................... 7

## 1.8 Related System Analysis/Literature Review ................................................................................. 7

## 1.9 Tools and Technologies ................................................................................................................ 8

## 1.10 Project Contribution ................................................................................................................... 9

## 1.11 Relevance to Course Modules .................................................................................................. 10

# Chapter 2: Requirement Analysis ...................................................................................................... 11

## 2.1 User Classes and Characteristics ................................................................................................ 11

## 2.2 Operating Environment .............................................................................................................. 12

## 2.3 Design and Implementation Constraints ..................................................................................... 12

## 2.4 Use Case Diagram ...................................................................................................................... 13

## 2.5 Requirement Identifying Technique ........................................................................................... 14

## 2.6 Functional Requirements ............................................................................................................ 14

## 2.7 Non-Functional Requirements .................................................................................................... 28

## 2.8 External Interface Requirements ................................................................................................ 29


<!-- Source PDF page 6 -->

# List of Figures

*Figure 1 : Mockup M1 for Registration / Login Screen .................................................................................. 14*

*Figure 2: Mockup M2 Profile and Role Management Screen ......................................................................... 15*

*Figure 3: Mockup M3 for Node Participation Dashboard .............................................................................. 16*

*Figure 4: Mockup M4 for Session Monitoring Screen.................................................................................... 18*

*Figure 5: Mockup M5 for Wallet / Earnings / Withdrawal Screen ................................................................. 19*

*Figure 6: Mockup M6 for Client Dashboard ................................................................................................... 19*

*Figure 7: Mockup M7 for Submit Testing Task Screen .................................................................................. 20*

*Figure 8: Mockup M8 for Task Status / Results Screen.................................................................................. 21*

*Figure 9: Mockup M9 for Top-Up Credits Screen .......................................................................................... 22*

*Figure 10: Mockup M10 – Marketplace Screen .............................................................................................. 23*

*Figure 11: Mockup M11 for Order Confirmation Screen ............................................................................... 24*

*Figure 12: Mockup M12 for Admin Dashboard ............................................................................................. 25*

*Figure 13: Mockup M13 for User and Node Management Screen ................................................................. 26*

*Figure 14: Mockup M14 for Payments / Reports / Disputes Screen ............................................................... 27*


<!-- Source PDF page 7 -->

# Chapter 1: Introduction and Problem Definition

This chapter situates NetShare within the domains of distributed networking, bandwidth utilization,

and internet testing services. It explains the problem the system addresses, presents the proposed

solution and its objectives, reviews related systems, and outlines the tools and technologies that will

support the implementation. It also establishes the project context by showing how NetShare can

convert unused residential bandwidth into a structured platform for regional testing, verification,

monitoring, and reward-based participation.

## 1.1 Overview of the Project

NetShare is a distributed internet testing and bandwidth-utilization platform that turns unused internet

bandwidth on user devices into a useful digital resource. The project belongs to the areas of web

systems, mobile applications, and computer networks because it combines a mobile-based node

network with a web-based service and management platform. Its main users are Node Participants

who share unused bandwidth, Platform Clients such as businesses, developers, and researchers who

use testing services, and System Administrators who manage the platform. The project focuses on

two major issues. First, many users pay for internet bandwidth that remains unused for a large part

of the day. Second, organizations often need access to real residential internet environments to check

how websites, ads, content, and online services behave in different regions. Existing datacenter-based

solutions are often less reliable for this purpose because they do not always represent real user

conditions. NetShare improves this process by automating controlled task execution through

residential nodes. It supports services such as ad verification, regional accessibility testing,

localization testing, performance testing, and compliance testing. The platform also includes secure

communication, task monitoring, credit rewards, and marketplace redemption, making the system

more practical, transparent, and beneficial for all users.

## 1.2 Vision Statement

NetShare is a decentralized bandwidth-utilization platform designed for everyday internet users,

students, professionals, and small organizations who want to earn value from their unused internet

resources. Many users pay for internet bandwidth that remains idle for long periods. NetShare aims

to utilize this unused capacity by allowing devices to participate as network nodes that perform

controlled internet tasks through their residential connections. The long-term purpose of this system

is to allow users to contribute their unused internet capacity in return for credit-based rewards,

creating a community-powered network that improves resource utilization while providing useful

services to businesses and researchers. As a real-world solution enabling secure and transparent

distributed connectivity, NetShare differs from existing bandwidth monetization systems that operate

only as passive data-collection networks. Unlike global systems such as Grass, Honeygain, and

DAWN Internet, the proposed platform focuses on structured services such as advertisement

verification, regional accessibility testing, and website monitoring using real residential networks.

The system also integrates a localized digital marketplace where contributors can redeem earned

credits for digital services and other useful products. By transforming unused bandwidth into a usable

digital resource, NetShare aims to improve internet resource utilization while economically

empowering users and supporting research and business applications.


<!-- Source PDF page 8 -->

## 1.3 Problem Statement

A large portion of internet bandwidth purchased by users remains unused, especially during off-peak

hours on home or office connections. At the same time, businesses, developers, and researchers often

need to access websites and online services from real residential networks in different geographic

locations to verify content, test services, or monitor advertisements. However, most existing

infrastructure relies on datacenter servers, which are frequently restricted or blocked by websites and

therefore cannot accurately represent real user environments. Although unused residential bandwidth

is widely available, there is currently no simple and secure platform that allows users to contribute

their connectivity resources in a structured and rewarding way. As a result, valuable internet

resources remain underutilized while organizations struggle to obtain reliable insights from real-

world networks. This gap highlights the need for a secure and managed system that can utilize

distributed residential bandwidth while rewarding participants for their contribution.

.

## 1.4 Problem Solution / Objectives of the Proposed System

The proposed solution is NetShare, a platform that allows users to utilize their unused internet

bandwidth by contributing their devices as network nodes. Instead of sharing internet access directly

with other users, the system allows participating devices to execute controlled internet tasks such as

website verification, advertisement validation, and regional content testing using real residential IP

addresses. Users install the NetShare application, which runs securely in the background and

connects their device to the NetShare network. The platform assigns tasks from businesses or

researchers to available nodes, and these nodes send requests to target websites through their local

internet connection. The results of these tasks are then securely returned to the NetShare server for

analysis. The system includes session monitoring, secure communication, and transparent usage

tracking to ensure privacy and reliability. Users who contribute bandwidth and device availability

earn credits based on their participation. These credits can be withdrawn through local payment

channels or used inside the NetShare marketplace for digital services. By turning unused bandwidth

into a useful resource, NetShare creates a distributed network that supports internet verification,

research, and monitoring services while rewarding users for contributing their connectivity.

## 1.5 Objectives

**BO-1: Utilize Unused Internet Bandwidth**

Enable users to contribute their unused internet bandwidth by allowing their devices to participate

as nodes in the NetShare network, reducing resource wastage and improving utilization.

**BO-2: Enable Distributed Internet Verification Services**

Provide a platform where businesses, developers, and researchers can perform tasks such as

website accessibility checks, advertisement verification, and regional content testing using real

residential IP addresses.

**BO-3: Ensure Secure and Encrypted Communication**

Ensure that all communication between nodes and the NetShare platform is routed through secure

and encrypted channels to protect user privacy and system integrity.

**BO-4: Reward Contributors with Credits**

Introduce a credit system where users earn credits based on their bandwidth contribution and

device participation, creating a transparent reward mechanism.

**BO-5: Integrate a Digital Marketplace for Redeeming Credits**


<!-- Source PDF page 9 -->

Allow users to redeem their earned credits inside a built-in marketplace for digital services and

other products (e.g., ChatGPT Plus, Gemini, Adobe tools) through secure activation and fulfilment

flows.

**BO-6: Utilize Machine Learning for Network Optimization and Fraud Prevention**

Apply ML/AI techniques to improve node selection, detect abnormal activity, optimize task

distribution, and enhance the overall reliability of the network

## 1.6 Scope

The scope of this project covers the design and development of NetShare, a distributed bandwidth-

utilization platform built as a mobile and web application. The system will allow registered users to

participate in the network by running the NetShare application on their devices, which can contribute

unused bandwidth and connectivity as network nodes. These nodes will perform controlled internet

tasks assigned by the NetShare platform. Users will be able to configure participation settings such

as bandwidth usage limits, session restrictions, and activity preferences. The platform will manage

node selection and assign tasks such as website accessibility checks, advertisement verification, and

regional content testing through participating devices using their residential internet connections. All

communication between the NetShare platform and participating nodes will occur through secure

and encrypted channels to ensure privacy and system integrity. Core functionality will include real-

time measurement and logging of bandwidth usage, session activity, and task execution so that user

contributions can be tracked accurately.

The project also includes a credit-based wallet system where users earn credits based on their

participation and bandwidth contribution. Credits will act as the internal currency of the system and

can be used in a built-in marketplace to purchase selected digital services and other products. An

admin web dashboard will be developed to allow administrators to monitor network activity,

manage nodes, review transactions, handle disputes, and manage marketplace items. The system will

use simple rule-based logic for task assignment and node selection, with basic machine-learning–

based optimization to detect abnormal behavior, improve task distribution, and support network

reliability.

### 1.6.1 System Limitations / Constraints

**LI-1: The system requires a functioning internet connection for participating nodes and platform**

clients; it cannot operate in offline environments.

**LI-2: Node participation is constrained by ISP regulations, and some internet service terms may**

limit the use of residential connections for proxy or bandwidth-sharing purposes.

**LI-3: Task execution through node devices is limited to lawful and permitted activities, and requires**

user consent for controlled request routing.

**LI-4: The system depends on accurate bandwidth and network measurement, which may exhibit**

minor discrepancies due to packet overhead, latency variations, and network fluctuations.

**LI-5: Performance limitations may occur during peak demand if many tasks are submitted while only**

a limited number of active nodes are available.

**LI-6: The system does not bypass regional firewalls or enforce unrestricted access to blocked**

websites; it only performs requests that are permitted by the participating network environment.


<!-- Source PDF page 10 -->

## 1.7 Modules

### 1.7.1 Module 1: User Management

**FE-1: Registration and Login**

- Allow new users to create an account using:

Mobile number or email address.

- Let users choose their role during signup:

Node Participant (shares device bandwidth and connectivity).

Platform Client (researcher, developer, or business submitting tasks).

Both roles if applicable.

- Support basic verification (OTP or email code) to confirm account ownership.

- Provide secure login and logout so only authenticated users can access the platform.

**FE-2: Profile and Role Management**

- Provide a profile screen where users can:

o View and update their name, profile picture, and basic information.

o Review and confirm their selected role(s) (Node Participant / Platform Client / Both).

o Configure participation preferences such as bandwidth limits and activity status.

- Store minimal device information to link sessions to a specific device for:

o Account security.

o Preventing misuse from unknown or cloned devices.

**FE-3: Ratings and Reviews**

- Allow platform clients to rate node performance after task execution based on technical factors

such as:

o Task reliability.

o Response latency.

o Node availability.

### 1.7.2 Module 2: Host Node Management

**FE-1: Participation Limits and Configuration**

- Allow node participants to configure how their device participates in the NetShare network by:

o Setting daily bandwidth usage limits (e.g., 2 GB per day).

o Defining upload/download speed caps for task execution.

o Specifying the maximum number of concurrent platform tasks.

- This ensures each participant can control their contribution according to their internet plan and

device capacity.

**FE-2: Session Control and Monitoring**

- Provide clear “Start Participation” / “Stop Participation” controls.

- Show real-time node activity information, including:

o Number of active tasks executed by the node.

o Current data transfer speed.

o Total bandwidth used in the session.

o Credits earned during the session or day.

o Network quality indicators (latency, signal strength, connection status).


<!-- Source PDF page 11 -->

**FE-3: Automatic Safeguards**

- Automatically pause participation when:

o Daily bandwidth limit is reached.

o Network quality drops below a safe threshold.

- Apply basic rules to reduce contribution if the user’s own internet usage becomes high.

- These safeguards ensure the user’s normal internet activities are not heavily affected.

### 1.7.3 Module 3: Client Node Management

**FE-1: Task Submission Interface**

- Provide an interface where platform clients can submit tasks such as:

o Website accessibility verification.

o Advertisement visibility checks.

o Regional content or localization testing.

- Allow clients to define parameters including:

o Target website or service URL.

o Desired geographic region.

o Request frequency or execution limits.

**FE-2: Node Selection & Recommendation**

- The system automatically selects suitable nodes based on:

Node availability.

Network latency and connection quality.

Node reliability score.

- Apply recommendation logic to choose nodes that provide a balance of stability, speed, and

geographic suitability.

**FE-3: Task Execution & Monitoring**

- Provide task execution status such as:

o Queued

o Running

o Completed

o Failed

- Display live task statistics including:

o Number of nodes used.

o Response success rate.

o Bandwidth consumed.

o Credits used for the task.

### 1.7.4 Module 4: Secure Communication & Routing Management

**FE-1: Secure Communication Setup**

- Establish secure encrypted communication between the NetShare server and participating node

devices.

- Use technologies such as WebRTC communication channels and Android VpnService to securely

route platform requests through node devices.

- Perform authentication and key exchange so only authorized tasks can use node connectivity.


<!-- Source PDF page 12 -->

**FE-2: Request Routing & Session Handling**

- Route controlled platform requests through selected node devices using their residential internet

connections.

- Maintain secure communication during the task lifecycle:

o Initialize connection when task starts.

o Maintain communication while task runs.

o Cleanly close connection after task completion.

- Handle events such as app minimization, screen lock, or temporary network changes without

disrupting active tasks.

**FE-3: Connection Health Monitoring**

- Continuously monitor network metrics such as:

o Latency

o Packet loss

o Connection stability

- Attempt automatic recovery if temporary failures occur.

- If recovery fails, safely terminate the task and log the event.

### 1.7.5 Module 5: Dynamic Pricing & Task Allocation

**FE-1: Real-time pricing based on network demand, node availability, latency, and reliability scores.**

**FE-2: Intelligent allocation system ensuring fair distribution of tasks across available nodes.**

**FE-3: Prediction of peak demand periods and adjustment of pricing parameters.**

### 1.7.6 Module 6: User Credits & Payments

**FE-1: Credits Wallet & Balance**

- Maintain a wallet for every user.

- Show current credit balance and recent wallet activity.

- Distinguish between:

o Credits earned from node participation.

o Credits spent on platform services and marketplace purchases.

**FE-2: Task Settlement & Transaction History**

- After task execution:

o Deduct credits from the client based on task usage.

o Credit the node participant according to bandwidth contribution.

- Store each transaction with details such as task ID, time, and credit amount.

- Provide transaction history for transparency.

**FE-3: Top-Ups, Withdrawals & Payment Verification**

- Allow users to top up credits using local payment methods.

- Initially allow admin to manually verify payments.

- Implement basic fraud checks for unusual payment activity.

### 1.7.7 Module 7: Digital Marketplace

**FE-1: Product Catalogue**

- List digital subscriptions and services available for purchase.

- Display description, required credits, and usage conditions.


<!-- Source PDF page 13 -->

**FE-2: Credit Purchase & Order Flow**

- Allow users to select and confirm marketplace offers.

- Deduct credits automatically and create an order record.

**FE-3: Order Fulfilment & User Alerts**

- Admin initially fulfils orders manually (e.g., activation keys).

- Send automatic notifications when order status changes.

- Future scope includes API-based automated fulfilment.

### 1.7.8 Module 8: Admin Dashboard & System Monitoring

**FE-1: Overview Dashboard**

Admin can view:

- Total registered users

- Active tasks and bandwidth usage

- Total credits issued

- Top contributing nodes and active clients

**FE-2: User, Task & Marketplace Management**

- Manage user accounts and activity.

- Inspect task logs and wallet transactions.

- Manage marketplace products.

- Block or restrict suspicious users.

**FE-3: System Settings & Reports**

- Configure platform parameters such as fees and limits.

- Receive alerts for abnormal activity.

- Export reports on usage, credits, and system growth.

## 1.8 Related System Analysis/Literature Review

Several systems exist that attempt to utilize distributed or shared internet resources.

Grass[1] provides a bandwidth-sharing model where users contribute idle network resources to earn

rewards, but it primarily focuses on global data aggregation and web indexing rather than providing

structured services for businesses or researchers.

DAWN (Decentralized Wireless Network)[2] enables community-driven connectivity but requires

specialized node hardware and is not optimized for casual users with standard devices.

Honeygain[3] monetizes unused bandwidth by allowing devices to participate in a distributed proxy

network used for data collection and web intelligence tasks, but it mainly operates as a passive

bandwidth-sharing service with limited transparency and user-level control.

Each of these systems utilizes aspects of decentralized connectivity and resource sharing, but they

often lack localized platform integration, flexible service models, or accessible reward systems

tailored for everyday users. By analyzing these existing solutions, NetShare aims to provide a more

accessible and user-driven platform that utilizes distributed residential nodes for internet verification,

research, and monitoring services while rewarding participants through a credit-based system and

built-in marketplace


<!-- Source PDF page 14 -->

**Table A-1: Related System Analysis with proposed project solution**

| Application | Weakness | Proposed Project Solution |
| --- | --- | --- |
| Grass [1] | Rewards users for providing bandwidth, but mainly focuses on global data aggregation and AI data collection rather than structured services for businesses or researchers. | NetShare allows distributed residential nodes to perform tasks such as website accessibility verification, advertisement validation, and regional content monitoring using real residential IP addresses. |
| DAWN (DePIN) [2] | Requires specialized hardware nodes and is not easily accessible to everyday users with standard devices. | NetShare runs on regular Android devices and laptops without requiring specialized hardware, making participation easier for normal users. |
| Honeygain [3] | Users earn rewards for idle bandwidth sharing, but the platform mainly operates passively and provides limited transparency or service variety. | NetShare introduces structured services such as ad verification, localization testing, and website monitoring while rewarding contributors through a credit- based system. |
| Traditional ISP hotspot sharing [4] | Unsecured and informal sharing with no authentication, monitoring, or proper reward mechanism. | NetShare provides secure encrypted communication, controlled task execution, and transparent tracking of user contributions through a managed platform. |

## 1.9 Tools and Technologies

**Table A-2: Shows Tools and Technologies used for NetShare**

| Tools and Technologies | Tools | Version | Rationale |
| --- | --- | --- | --- |
|  | MS Visual Studio | Latest | IDE |
|  | MS SQL Server | Latest | DBMS |
|  | Git & GitHub | Latest | Version Control |
|  | Postman | Latest | API Testing |
|  | Docker | Latest | Deployment |
|  | Technology | Version | Rationale |
|  | Node.js | Latest | Backend runtime for handling asynchronous communication and APIs. |
|  | Express.js | Latest | Web framework for building RESTful backend services. |
|  | MongoDB | Latest | Database |
|  | Flutter | Latest | Mobile Development |
|  | React.js | Latest | Web Front End Development |


<!-- Source PDF page 15 -->

| WebRTC | Latest | Enables secure P2P connectivity with NAT traversal and encryption. |
| --- | --- | --- |
| Android VpnService API | Android API Level 21+ | Provides VPN-like traffic forwarding without root access. |
| JWT & bcrypt | Latest | Authentication, tokenization, and secure password storage. |
| Python (Scikit- Learn) or Node ML libraries | Latest | Machine learning for matchmaking, pricing, and anomaly detection. |

## 1.10 Project Contribution

NetShare introduces a set of technical and conceptual contributions that distinguish it from existing

bandwidth-utilization platforms:

- Distributed Residential Node Network:

Instead of passive bandwidth monetization, NetShare creates a network of user devices that can

execute internet verification and monitoring tasks through real residential connections.

- Mobile-Centric DePIN Implementation:

Enables decentralized network participation using standard Android devices, eliminating the need for

specialized hardware nodes.

- AI-Driven Task Allocation and Network Optimization:

Machine learning techniques help select suitable nodes for tasks, improve reliability, detect abnormal

activity, and balance network usage.

- Transparent Usage Logging and Credit Mapping:

Bandwidth usage and task execution are recorded to provide accurate credit rewards and prevent unfair

billing or manipulation.

- Security and Trust through Node Reputation Analytics:

Reputation scoring and activity monitoring help identify unreliable nodes and discourage misuse.

- Digital Subscription Redemption Model:

Users can convert earned credits into valuable digital services such as ChatGPT Plus, Gemini Pro, or Adobe

tools, transforming bandwidth contribution into practical economic value.

Contribution Impact

NetShare transforms unused residential bandwidth into a distributed infrastructure capable of

supporting internet verification, monitoring, and research services. By rewarding contributors

through a transparent credit system and marketplace, the platform demonstrates a scalable and

sustainable model for utilizing idle network resources while supporting real-world digital

applications.


<!-- Source PDF page 16 -->

## 1.11 Relevance to Course Modules

Software Engineering:

The project follows structured SDLC practices including requirements gathering, UML modeling, modular

design, implementation, and system validation.

Computer Networks:

Applies practical networking concepts such as secure communication, request routing, distributed nodes, and

network performance monitoring.

Mobile Application Development:

The node participation and client interfaces are implemented as Android mobile applications.

Database Systems:

MongoDB is used to store user profiles, node activity logs, task records, and wallet transactions.

Machine Learning / Data Analytics:

ML models are used for node reliability scoring, task allocation, anomaly detection, and usage prediction.

Cybersecurity:

Encryption protocols, authentication flows, identity verification, and secure communication mechanisms

ensure system security.

Web Technologies:

The admin dashboard uses modern web frameworks to provide monitoring, analytics, and system

management capabilities


<!-- Source PDF page 17 -->

# Chapter 2: Requirement Analysis

This chapter presents the requirement analysis for the proposed NetShare system. It defines the major user

classes, operating environment, design and implementation constraints, use case structure, requirement

identification technique, functional requirements, non-functional requirements, and external interface

requirements. The purpose of this chapter is to clearly specify what the system must do and the conditions

under which it must operate.

## 2.1 User Classes and Characteristics

**Table 2.1 shows the major user classes of the NetShare system and their characteristics. The system is**

primarily used by users who either contribute unused internet bandwidth as residential nodes, consume testing

services through the platform, or manage the system administratively. These user classes are derived from the

proposed roles, modules, and platform workflow defined in the project proposal.

**Table 2.1: User Classes and Characteristics**

| User class | Description |
| --- | --- |
| Node Participant | A Node Participant is a registered user who installs the NetShare application on a personal device and allows the system to use unused internet bandwidth for controlled internet tasks. The device acts as a residential node in the NetShare network. Node Participants can configure participation preferences such as daily bandwidth limits, speed caps, and maximum concurrent tasks. They can start or stop participation at any time, monitor session activity, and earn credits based on their contribution. Most Node Participants are expected to have basic smartphone or mobile application usage skills and will mainly be concerned about privacy, bandwidth control, and transparent reward tracking. |
| Platform Client | A Platform Client is a business, developer, researcher, or small organization that uses NetShare to perform internet verification and monitoring tasks through real residential networks. These users submit tasks such as advertisement verification, regional website accessibility monitoring, localization and content testing, website performance and UX testing, and digital policy and content compliance testing. Platform Clients can define task parameters such as URL, region, and execution limits, and then monitor task status and results. These users are expected to have moderate digital literacy and a basic understanding of websites, testing parameters, and service usage metrics. |
| Dual-Role User | A Dual-Role User is a registered user who performs both roles in the system: Node Participant and Platform Client. Such a user can contribute bandwidth to earn credits and can also use those credits to submit testing tasks or redeem services through the platform. This type of user is especially suitable for students, developers, and researchers who both provide and consume services within the same platform. The system shall allow such users to manage both roles under one account. |
| System Administrator | The System Administrator is the authorized person responsible for monitoring, controlling, and managing the NetShare platform through the admin dashboard. The administrator can view total users, active tasks, bandwidth usage, credits issued, suspicious activity, top contributing nodes, and active clients. The administrator can also manage user accounts, inspect logs and wallet transactions, verify payments, manage marketplace items, handle disputes, configure platform settings, and generate reports. This user is expected to have advanced technical and operational knowledge of the system and full administrative privileges. |


<!-- Source PDF page 18 -->

## 2.2 Operating Environment

NetShare shall operate in a distributed mobile and web environment. The node participation and

client-side service features shall be accessible through a mobile application, while administrative

functionality shall be available through a web-based dashboard.

**OE-1: The NetShare mobile application shall operate on Android devices supporting Android API**

Level 21 or above.

**OE-2: The NetShare web dashboard shall operate through modern web browsers on desktop or**

laptop systems for administrative use.

**OE-3: The backend server environment shall support Node.js and Express.js for asynchronous API**

handling and service management.

**OE-4: The database environment shall use MongoDB to store user records, task records, wallet**

activity, node monitoring logs, and marketplace data.

**OE-5: The secure communication environment shall support WebRTC channels and Android**

VpnService-based traffic forwarding for controlled request routing through residential nodes.

**OE-6: The system shall support operation for geographically distributed users and participating**

nodes in different regions, subject to lawful internet access and local network conditions.

## 2.3 Design and Implementation Constraints

The design and implementation of NetShare are subject to several technical, operational, and

project-scope constraints that restrict the range of available development options.

**CON-1: The backend of the system shall be implemented using Node.js and Express.js to align with**

the proposed system architecture and asynchronous communication requirements.

**CON-2: The mobile application shall be implemented using Flutter and shall primarily target**

Android devices within the scope of this project.

**CON-3: The system shall use MongoDB as the primary database for users, tasks, wallets,**

marketplace data, and activity logs.

**CON-4: Secure communication and controlled traffic routing shall be limited to mechanisms**

supported by WebRTC and Android VpnService API.

**CON-5: The system shall execute only lawful and permitted internet tasks and shall require user**

consent for controlled request routing through participating devices.

**CON-6: The system shall not be designed to bypass regional firewalls or provide unrestricted**

access to blocked websites. It shall only perform requests permitted by the participating network

environment.

**CON-7: Initial payment verification and marketplace order fulfilment may be handled manually by**

the administrator due to project scope limitations.

**CON-8: Task assignment and anomaly detection shall use simple rule-based logic with basic**

machine-learning support instead of large-scale production-grade optimization models.

**CON-9: The system depends on active internet connectivity for both participating nodes and**

platform clients and therefore cannot operate in offline conditions.

**CON-10: The operation of residential node participation is subject to ISP policies and terms of**

service, which may restrict certain uses of residential internet connections.


<!-- Source PDF page 19 -->

## 2.4 Use Case Diagram

The Use Case Diagram of NetShare illustrates the interactions between the primary actors and the

system. The main actors are Node Participant, Platform Client, and System Administrator. The

diagram defines the scope of services and access rights and provides a foundation for later activity

diagrams and sequence diagrams.


<!-- Source PDF page 20 -->

## 2.5 Requirement Identifying Technique

The functional requirements of NetShare are identified using two techniques. First, Mockup-Based

Requirement Analysis is used for all user-facing features. The prepared mockups of the main

screens are used to identify what actions users can perform and what the system must do in response.

Elements such as buttons, forms, dropdowns, status panels, and dashboard sections are analyzed to

derive functional requirements.

Second, Event–Response Tables are used for backend processes that are not directly visible on the

user interface. These include events such as task assignment, node selection, payment verification,

wallet settlement, connection failure handling, and marketplace order processing.

By combining these two techniques, NetShare captures both frontend interactions and backend

system behavior in a clear and complete way, without moving into implementation or design details.

## 2.6 Functional Requirements

This section presents the functional requirements of the NetShare system derived from the user

interface mockups. Each mockup represents a system screen and its visible features. Functional

requirements are identified from the controls, forms, status panels, buttons, and user actions shown

in each mockup. The requirements are written at feature level to ensure clarity, traceability, and

testability.

### M1 : Registration / Login Screen

*Figure 1 : Mockup M1 for Registration / Login Screen*


<!-- Source PDF page 21 -->

### 2.6.1 Functional Requirements Derived from M1 – Registration / Login Screen

**Table A-3: Functional Requirements Derive from Mockup M1**

| Feature (derived from UI) | Functional Requirement (FR-ID: Statement) | Business Rule |
| --- | --- | --- |
| User Registration | FR1.1: The system shall allow a new user to create an account using an email address or mobile number. | Each email address or mobile number shall be unique for one account only. |
| Password Entry | FR1.2: The system shall allow a user to enter a password during registration and login. | Password must satisfy platform security policy. |
| Role Selection | FR1.3: The system shall allow a user to select Node Participant, Platform Client, or Both during registration. | A user may hold multiple roles if permitted by the platform. |
| Verification Method Selection | FR1.4: The system shall allow a user to select OTP verification or email verification during account creation. | Account activation requires successful verification. |
| Register Action | FR1.5: The system shall create a new user account after successful validation of registration data. | Incomplete or duplicate registration data shall be rejected. |
| Login Action | FR1.6: The system shall allow a registered and verified user to log in using valid credentials. | Only verified users shall be allowed to access protected features. |

### M2 : Profile and Role Management Screen

*Figure 2: Mockup M2 Profile and Role Management Screen*


<!-- Source PDF page 22 -->

### 2.6.2 Functional Requirements Derived from M2 – Profile and Role Management Screen

**Table A-4: Functional Requirements Derive from Mockup M2**

| Feature (derived from UI) | Functional Requirement (FR-ID: Statement) | Business Rule |
| --- | --- | --- |
| View Profile | FR2.1: The system shall display the current user’s profile information including name, email, mobile number, and profile picture. | Users shall only view their own profile unless authorized otherwise. |
| Update Basic Information | FR2.2: The system shall allow users to update their basic profile information. | Updated data shall be validated before saving. |
| Upload Profile Photo | FR2.3: The system shall allow users to upload or change their profile picture. | Only supported image formats shall be accepted. |
| View Active Role | FR2.4: The system shall display the current active role of the user. | Role display shall reflect the stored account configuration. |
| Update Role | FR2.5: The system shall allow eligible users to update or confirm their selected role. | Role changes shall affect access permissions. |
| Participation Preference Setting | FR2.6: The system shall allow users to enable or disable their participation preference. | Only users with node participation role may configure participation preference. |
| Change Security Settings | FR2.7: The system shall allow users to update account security settings. | User must be authenticated before changing security settings. |

### M3 : Node Participation Dashboard

*Figure 3: Mockup M3 for Node Participation Dashboard*


<!-- Source PDF page 23 -->

### 2.6.3 Functional Requirements Derived from M3 – Node Participation Dashboard

**Table A-5: Functional Requirements Derive from Mockup M3**

| Feature (derived from UI) | Functional Requirement (FR-ID: Statement) | Business Rule |
| --- | --- | --- |
| View Participation Status | FR3.1: The system shall display the current participation status of the node as active or inactive. | Status shall reflect actual participation state. |
| Set Bandwidth Limit | FR3.2: The system shall allow Node Participants to define a daily bandwidth usage limit. | Participation shall not exceed the configured daily limit. |
| Set Speed Cap | FR3.3: The system shall allow Node Participants to define upload and download speed caps. | Speed caps shall be enforced during participation. |
| Set Concurrent Task Limit | FR3.4: The system shall allow Node Participants to define the maximum number of concurrent tasks. | The system shall not assign more tasks than the configured limit. |
| Start Participation | FR3.5: The system shall allow Node Participants to start device participation in the network. | Participation requires an authenticated and available device. |
| Stop Participation | FR3.6: The system shall allow Node Participants to stop device participation in the network. | Running tasks shall be safely handled before full stop. |
| View Live Activity | FR3.7: The system shall display live activity information including active tasks, session bandwidth usage, current speed, and node health. | Live metrics shall reflect current or recent session data. |
| View Credits Earned | FR3.8: The system shall display the credits earned by the node participant during the current day or session. | Credit display shall be based on recorded contribution data. |

### M4 : Session Monitoring Screen


<!-- Source PDF page 24 -->

*Figure 4: Mockup M4 for Session Monitoring Screen*

### 2.6.4 Functional Requirements Derived from M4 – Session Monitoring Screen

**Table A-6: Functional Requirements Derive from Mockup M4**

| Feature (derived from UI) | Functional Requirement (FR-ID: Statement) | Business Rule |
| --- | --- | --- |
| View Session Metrics | FR4.1: The system shall display session metrics including active tasks, bandwidth used, and credits earned. | Session data shall correspond to the active or latest session. |
| View Connection Metrics | FR4.2: The system shall display network- related metrics including latency, packet loss, stability, and connection status. | Metrics shall be refreshed from monitoring data. |
| View Session Details | FR4.3: The system shall display session- specific details such as session ID, current speed, and assigned region. | Session information shall be traceable to the running task session. |
| Pause Session | FR4.4: The system shall allow a Node Participant to pause an active participation session. | Paused sessions shall temporarily stop new task allocation. |
| Terminate Session | FR4.5: The system shall allow a Node Participant to terminate an active participation session. | Active tasks shall be safely closed or logged on termination. |

### M5 – Wallet / Earnings / Withdrawal Screen


<!-- Source PDF page 25 -->

*Figure 5: Mockup M5 for Wallet / Earnings / Withdrawal Screen*

### 2.6.5 Functional Requirements Derived from M5 – Wallet / Earnings / Withdrawal Screen

**Table A-7: Functional Requirements Derive from Mockup M5**

| Feature (derived from UI) | Functional Requirement (FR-ID: Statement) | Business Rule |
| --- | --- | --- |
| View Wallet Balance | FR5.1: The system shall display the user’s available credit balance. | Wallet balance shall be updated from recorded transactions. |
| View Earnings Summary | FR5.2: The system shall display earning-related information to the user. | Earnings shall be based on valid contribution records. |
| View Transaction History | FR5.3: The system shall display the user’s recent wallet transactions. | Transaction history shall include both earned and spent credits. |
| Submit Withdrawal Request | FR5.4: The system shall allow eligible users to submit a withdrawal request. | Withdrawal shall require sufficient eligible balance. |
| Select Withdrawal Channel | FR5.5: The system shall allow users to choose a supported withdrawal method. | Withdrawal methods shall be limited to supported channels. |
| Enter Withdrawal Details | FR5.6: The system shall allow users to provide withdrawal account details. | Withdrawal request shall not proceed with incomplete details. |

### M6 – Client Dashboard

*Figure 6: Mockup M6 for Client Dashboard*

### 2.6.6 Functional Requirements Derived from M6 – Client Dashboard

**Table A-8: Functional Requirements Derive from Mockup M6**

| Feature | Functional Requirement (FR-ID: | Business Rule |
| --- | --- | --- |


<!-- Source PDF page 26 -->

| (derived from UI) | Statement) |  |
| --- | --- | --- |
| View Active Tasks | FR6.1: The system shall display the number of active tasks for the logged-in platform client. | Only the client’s own task data shall be shown. |
| View Completed Tasks | FR6.2: The system shall display the number of completed tasks for the logged-in platform client. | Completed tasks shall be based on stored task records. |
| View Credit Usage | FR6.3: The system shall display the client’s available credits or credit usage summary. | Credit values shall reflect current wallet records. |
| Submit New Task Shortcut | FR6.4: The system shall provide the client with quick access to the task submission screen. | Only authorized platform clients may submit tasks. |
| View Results Shortcut | FR6.5: The system shall provide the client with quick access to completed task results. | Results shall only be shown for the client’s own tasks. |
| Top-Up Shortcut | FR6.6: The system shall provide the client with quick access to the credit top-up process. | Top-up availability depends on supported payment workflow. |
| View Recent Task Activity | FR6.7: The system shall display recent client task activity with task status. | Task activity shall be ordered from stored task history. |

### M7 – Submit Testing Task Screen

*Figure 7: Mockup M7 for Submit Testing Task Screen*

### 2.6.7 Functional Requirements Derived from M7 – Submit Testing Task Screen

**Table A-9: Functional Requirements for M7 – Submit Testing Task Screen**


<!-- Source PDF page 27 -->

| Feature (derived from UI) | Functional Requirement (FR-ID: Statement) | Business Rule |
| --- | --- | --- |
| Enter Target URL | FR7.1: The system shall allow Platform Clients to enter a target website or service URL for testing. | URL must be valid before task submission. |
| Select Service Type | FR7.2: The system shall allow Platform Clients to select a service type for the testing task. | Service type must be one of the supported platform services. |
| Select Target Region | FR7.3: The system shall allow Platform Clients to select the target geographic region for task execution. | Task execution depends on node availability in the selected region. |
| Set Execution Limit | FR7.4: The system shall allow Platform Clients to define execution frequency or request limits for the task. | Execution limits shall remain within platform-defined bounds. |
| Submit Task | FR7.5: The system shall create a new testing task after successful validation of task parameters. | Task submission requires sufficient client credits. |
| Reset Task Form | FR7.6: The system shall allow users to clear entered task parameters before submission. | Reset shall remove unsaved data only. |
| View Estimated Cost | FR7.7: The system shall display estimated task cost before final submission. | Estimated cost shall be based on selected task parameters. |
| View Region Availability | FR7.8: The system shall display whether the selected region is available for task execution. | Availability depends on active eligible nodes. |

### M8 – Task Status / Results Screen

*Figure 8: Mockup M8 for Task Status / Results Screen*

### 2.6.8 Functional Requirements Derived from M8 – Task Status / Results Screen


<!-- Source PDF page 28 -->

**Table A-8: Functional Requirements Derive from Mockup M8**

| Feature (derived from UI) | Functional Requirement (FR-ID: Statement) | Business Rule |
| --- | --- | --- |
| View Task Information | FR8.1: The system shall display task information including task ID, service type, region, nodes used, and credits consumed. | Task details shall only be visible to the owning client or authorized admin. |
| View Task Status | FR8.2: The system shall display the current status of a task. | Status shall be one of the defined task states. |
| View Result Summary | FR8.3: The system shall display summarized task results including success rate and response time. | Result summary shall be based on recorded task outcomes. |
| Download Report | FR8.4: The system shall allow users to download a report for a completed task. | Report download shall be available only for completed or report-ready tasks. |
| Rate Nodes | FR8.5: The system shall allow clients to rate node performance after task completion. | Rating shall only be allowed for completed tasks. |

### M9 – Top-Up Credits Screen

*Figure 9: Mockup M9 for Top-Up Credits Screen*

### 2.6.9 Functional Requirements Derived from M9 – Top-Up Credits Screen

**Table A-11: Functional Requirements Derive from Mockup M9**

| Feature (derived from UI) | Functional Requirement (FR-ID: Statement) | Business Rule |
| --- | --- | --- |
| Enter Top-Up | FR9.1: The system shall allow users to | Top-up amount shall meet |


<!-- Source PDF page 29 -->

| Amount | enter the amount for credit top-up. | minimum platform requirements. |
| --- | --- | --- |
| Select Payment Method | FR9.2: The system shall allow users to choose a supported payment method. | Only supported payment methods shall be available. |
| Enter Payment Reference | FR9.3: The system shall allow users to provide payment transaction reference details. | Reference is required for payment verification. |
| Upload Payment Proof | FR9.4: The system shall allow users to provide payment proof for manual verification. | Payment proof must be submitted before verification. |
| Submit Top-Up Request | FR9.5: The system shall record a credit top-up request for admin verification. | Wallet balance shall not update until payment is verified. |
| View Verification Status | FR9.6: The system shall display the verification status of the submitted top-up request. | Status shall reflect latest admin action. |

### M10 : Marketplace Screen

*Figure A-12: Mockup M10 for Marketplace Screen*

*Figure 10: Mockup M10 – Marketplace Screen*

### 2.6.10 Functional Requirements Derived from M10 – Marketplace Screen

**Table A-12: Functional Requirements Derive from Mockup M10**

| Feature (derived from UI) | Functional Requirement (FR-ID: Statement) | Business Rule |
| --- | --- | --- |
| View Marketplace Catalogue | FR10.1: The system shall display available marketplace products and services to authenticated users. | Only active products shall be shown. |
| View Product Information | FR10.2: The system shall display product name, description, and required credits for each marketplace item. | Product information shall match stored marketplace records. |
| Redeem Product Option | FR10.3: The system shall provide users with a redemption option for eligible marketplace items. | Redemption requires sufficient credits. |


<!-- Source PDF page 30 -->

### M11 – Order Confirmation Screen

*Figure 11: Mockup M11 for Order Confirmation Screen*

### 2.6.11 Functional Requirements Derived from M11 – Order Confirmation Screen

**Table A-13: Functional Requirements Derive from Mockup M11**

| Feature (derived from UI) | Functional Requirement (FR-ID: Statement) | Business Rule |
| --- | --- | --- |
| View Selected Product | FR11.1: The system shall display the selected marketplace product and its required credits before confirmation. | Selected product data shall be taken from active catalogue records. |
| View Available Balance | FR11.2: The system shall display the user’s available credit balance before order confirmation. | Balance shall reflect current wallet data. |
| Confirm Order | FR11.3: The system shall allow users to confirm a marketplace redemption request. | Order confirmation requires sufficient balance. |
| Cancel Order | FR11.4: The system shall allow users to cancel the redemption process before final confirmation. | Cancellation shall not deduct credits. |
| View Order Status | FR11.5: The system shall display current order status after redemption request creation. | Order status shall be traceable until fulfilment. |


<!-- Source PDF page 31 -->

### M12 – Admin Dashboard

*Figure 12: Mockup M12 for Admin Dashboard*

### 2.6.12 Functional Requirements Derived from M12 – Admin Dashboard

**Table A-14: Functional Requirements Derive from Mockup M12**

| Feature (derived from UI) | Functional Requirement (FR-ID: Statement) | Business Rule |
| --- | --- | --- |
| View Total Users | FR12.1: The system shall display the total number of registered users to the administrator. | Admin dashboard data shall be restricted to authorized administrators. |
| View Active Tasks | FR12.2: The system shall display the number of active tasks in the system. | Active task count shall be based on current task records. |
| View Bandwidth Usage | FR12.3: The system shall display overall bandwidth usage statistics. | Usage data shall be derived from recorded node activity. |
| View Network Performance | FR12.4: The system shall display system performance and network health indicators. | Indicators shall reflect current or recent monitoring data. |
| View Suspicious Activity Alerts | FR12.5: The system shall display alerts for suspicious or abnormal platform activity. | Alerts shall be generated from monitoring rules. |
| View User Management Summary | FR12.6: The system shall provide quick access to managed user and node records. | Admin actions shall be traceable. |


<!-- Source PDF page 32 -->

### M13 – User and Node Management Screen

*Figure 13: Mockup M13 for User and Node Management Screen*

### 2.6.13 Functional Requirements Derived from M13 – User and Node Management Screen

**Table A-15: Functional Requirements Derive from Mockup M13**

| Feature (derived from UI) | Functional Requirement (FR-ID: Statement) | Business Rule |
| --- | --- | --- |
| View User List | FR13.1: The system shall display a list of registered users to the administrator. | Only administrators may access this list. |
| View Node Records | FR13.2: The system shall display node- related details such as node health and activity status. | Node information shall be based on recorded participation data. |
| View User Details | FR13.3: The system shall allow administrators to open detailed records for individual users. | Detailed view shall be limited to authorized administrators. |
| Restrict User | FR13.4: The system shall allow administrators to restrict suspicious user accounts. | Restriction actions shall be logged. |
| Block User | FR13.5: The system shall allow administrators to block user accounts when required. | Blocking shall follow platform rules and be auditable. |


<!-- Source PDF page 33 -->

### M14 – Payments / Reports / Disputes Screen

*Figure 14: Mockup M14 for Payments / Reports / Disputes Screen*

### 2.6.14 Functional Requirements Derived from M14 – Payments / Reports / Disputes Screen

**Table A-16: Functional Requirements Derive from Mockup M14**

| Feature (derived from UI) | Functional Requirement (FR-ID: Statement) | Business Rule |
| --- | --- | --- |
| View Pending Payments | FR14.1: The system shall display pending top-up and withdrawal requests to the administrator. | Only authorized administrators may access payment review data. |
| Verify Payments | FR14.2: The system shall allow administrators to approve or reject submitted payment requests. | Verification decision shall update payment status accordingly. |
| View Reports Summary | FR14.3: The system shall display report- related information for administrative review. | Report data shall come from stored system records. |
| Export Reports | FR14.4: The system shall allow administrators to export reports related to usage, credits, and growth. | Exported reports shall reflect available stored data. |
| View Open Disputes | FR14.5: The system shall display submitted disputes awaiting administrative review. | Only open or stored disputes shall be visible. |
| Review Dispute | FR14.6: The system shall allow administrators to open and review dispute details. | Dispute review actions shall be traceable. |
| Resolve Dispute | FR14.7: The system shall allow administrators to record a final decision for a dispute case. | Final dispute status shall be stored in the system. |


<!-- Source PDF page 34 -->

## 2.7 Non-Functional Requirements

This section specifies the quality attributes of NetShare other than design constraints and external

interfaces.

### 2.7.1 Reliability

**REL-1: The system shall log all task failures, connection interruptions, and settlement errors for**

audit and analysis purposes.

**REL-2: The system shall attempt automatic recovery for temporary connection failures during**

active task execution.

**REL-3: At least 95% of successfully assigned tasks shall reach a terminal state of Completed or**

Failed without remaining indefinitely in an intermediate state.

**REL-4: The system shall preserve transaction history and task logs in persistent storage to avoid**

loss of billing and monitoring records.

**REL-5: In case of failure during credit settlement, the system shall mark the transaction for**

administrative review instead of silently discarding it.

### 2.7.2 Usability

**USE-1: The system shall allow a Node Participant to start or stop participation using no more than**

one primary action from the participation dashboard.

**USE-2: The system shall allow a Platform Client to submit a testing task in no more than five main**

interaction steps after login.

**USE-3: The system shall display wallet balance, task status, and node activity using clear labels**

and dashboard-style summaries consistent with the proposed mockups.

**USE-4: The user interface shall use readable labels, consistent navigation, and simple controls to**

support users with basic digital literacy.

**USE-5: Important system messages such as errors, order updates, payment verification results,**

and participation status changes shall be shown in clear and understandable language.

### 2.7.3 Performance

**PER-1: 95% of user login requests shall be processed within 3 seconds under normal network**

conditions.

**PER-2: 95% of dashboard pages shall load within 4 seconds over a stable 20 Mbps internet**

connection.

**PER-3: 95% of task submission requests shall be acknowledged by the server within 3 seconds**

after the client submits the task.

**PER-4: The system shall refresh task execution status for active tasks at least once every 10**

seconds.

**PER-5: The system shall display current session statistics for an active node within 5 seconds of**

receiving updated monitoring data.

**PER-6: The system shall support concurrent operation of multiple nodes and clients without**

causing incorrect task assignment or transaction settlement conflicts.

### 2.7.4 Security

**SEC-1: The system shall ensure that only authenticated and authorized users can access protected**

platform functions.


<!-- Source PDF page 35 -->

**SEC-2: The system shall protect communication between the server and participating nodes**

against unauthorized interception or manipulation.

**SEC-3: The system shall associate participation sessions with verified devices to reduce misuse**

from unknown or cloned devices.

**SEC-4: The system shall record suspicious activities such as abnormal traffic, repeated failures, or**

unusual payment behavior for administrative review.

**SEC-5: The system shall restrict task execution to authorized and lawful requests only.**

**SEC-6: Sensitive wallet, transaction, and account records shall not be exposed to unauthorized**

users.

**SEC-7: Administrative actions affecting user accounts, transactions, or system settings shall be**

traceable through system logs.

## 2.8 External Interface Requirements

This section defines the interfaces through which NetShare communicates with users, software

components, hardware platforms, and communication services.

### 2.8.1 User Interface Requirements

The NetShare system shall provide a mobile user interface for Node Participants and Platform Clients

and a web-based interface for System Administrators.

**UI-1: The mobile application shall present dashboard-style views for participation, earnings,**

wallet, and profile settings.

**UI-2: The admin interface shall present KPI summaries, charts, node health indicators, suspicious**

activity panels, and user management controls.

**UI-3: The marketplace interface shall display product cards including product name, description,**

and required credits.

**UI-4: Consistent button labels, navigation patterns, and status indicators shall be used across all**

system screens.

**UI-5: The user interface shall be designed to accommodate future localization and region-based**

content display where needed.

### 2.8.2 Software Interfaces

**SI-1: The system shall interface with a MongoDB database to store user records, task data, node**

activity logs, transactions, and marketplace information.

**SI-2: The system shall use Node.js and Express.js backend services to provide APIs for**

authentication, task management, wallet operations, and admin functions.

**SI-3: The system shall interface with WebRTC components for secure peer communication between**

backend services and participating nodes.

**SI-4: The system shall interface with Android VpnService API for controlled traffic forwarding**

through participating Android devices.

**SI-5: The system shall support integration with payment verification workflows for credit top-ups**

and withdrawals.

**SI-6: The system shall support notification services for alerts related to orders, wallet updates, and**

task status changes.


<!-- Source PDF page 36 -->

### 2.8.3 Hardware Interfaces

No direct hardware interfaces are required. The system is a mobile and web-based application that

runs on standard server hardware and client devices with a modern web browser.

### 2.8.4 Communications Interfaces

**CI-1: The system shall use internet-based communication between mobile devices, clients, backend**

servers, and the admin dashboard.

**CI-2: The system shall support secure communication channels for task routing and monitoring**

between the server and participating nodes.

**CI-3: The system shall support OTP or email-based communication for account verification during**

registration.

**CI-4: The system shall support notification delivery for order updates, transaction updates, and**

administrative alerts.

**CI-5: The system shall tolerate temporary communication interruptions by attempting recovery**

where possible and logging failures otherwise.
