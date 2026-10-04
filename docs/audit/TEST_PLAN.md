# NetShare — Test Plan
> Generated: 2026-09-26 | Comprehensive test plan against all FR requirements

---

## 1. Test Objectives

1. Verify that all claimed-DONE features actually work end-to-end
2. Verify that PARTIAL features fail or behave correctly at their boundary
3. Confirm MOCK/NOT_STARTED features are NOT claimed as functional
4. Validate security controls function as specified

---

## 2. Test Environment Setup

```bash
# Prerequisites
# - Node.js 18+ installed
# - Docker Desktop running
# - MongoDB (Docker or local) on port 27017
# - Redis (Docker) on port 6379

# Start services
docker-compose up -d mongodb redis

# Start backend
cd netshare-backend
npm install
cp .env.example .env  # fill in JWT_SECRET, MONGO_URI
npm run dev            # port 8000

# Start frontend
cd netshare-frontend
npm install
npm run dev            # port 5173

# Start node agent (for full integration tests)
cd netshare-agent
npm install
node agent.js --key YOUR_NODE_API_KEY
```

---

## 3. Module Test Cases

---

### M01 — Registration and Login

| TC-ID | Test Case | Expected Result | Status |
|---|---|---|---|
| M01-TC01 | Register with valid email, password, role=platform_client | 201 Created, userId returned, devOtp returned (dev mode) | Verify |
| M01-TC02 | Register with duplicate email | 400 "Email already registered" | Verify |
| M01-TC03 | Register with weak password (no uppercase) | 400 password policy error | Verify |
| M01-TC04 | Register with invalid email format | 400 invalid email | Verify |
| M01-TC05 | Register with role=node_participant | 201 Created | Verify |
| M01-TC06 | Register with role=both | 201 Created | Verify |
| M01-TC07 | Register with role=admin | 201 Created ← **SECURITY ISSUE** | Verify (should fail) |
| M01-TC08 | Verify OTP with correct code | 200 token returned, isVerified=true | Verify |
| M01-TC09 | Verify OTP with wrong code | 400 "Invalid OTP" | Verify |
| M01-TC10 | Verify OTP after 10 minutes (expired) | 400 "OTP has expired" | Verify |
| M01-TC11 | Login with verified account | 200 token returned | Verify |
| M01-TC12 | Login with unverified account | 403 "Please verify your email" | Verify |
| M01-TC13 | Login with blocked account | 403 "Your account is blocked" | Verify |
| M01-TC14 | Login with wrong password | 401 "Invalid email or password" | Verify |
| M01-TC15 | Forgot password flow OTP → verify → reset | Password changed, can login with new password | Verify |

---

### M02 — Profile Management

| TC-ID | Test Case | Expected Result | Status |
|---|---|---|---|
| M02-TC01 | GET /api/users/profile with valid JWT | 200 user object (no password field) | Verify |
| M02-TC02 | GET /api/users/profile with no JWT | 401 "No token provided" | Verify |
| M02-TC03 | PUT /api/users/profile with new name | 200 updated user | Verify |
| M02-TC04 | PUT /api/users/profile with invalid phone | 400 "Invalid phone format" | Verify |
| M02-TC05 | PUT /api/users/change-password with correct old password | 200 "Password changed" | Verify |
| M02-TC06 | PUT /api/users/change-password with wrong old password | 401 "Incorrect old password" | Verify |
| M02-TC07 | PUT /api/users/profile with profileImage URL string | 200 — string stored | Verify |
| M02-TC08 | Send multipart/form-data image file to /api/users/profile | **Should FAIL** — no file upload handler | Confirm Failure |

---

### M03 — Node Registration and Settings

| TC-ID | Test Case | Expected Result | Status |
|---|---|---|---|
| M03-TC01 | POST /api/node/register with deviceName + region | 201 node created | Verify |
| M03-TC02 | POST /api/node/register when node already registered | 400 "A node device is already registered" | Verify |
| M03-TC03 | GET /api/node/dashboard returns node data | 200 with status, bandwidth, credits | Verify |
| M03-TC04 | GET /api/node/dashboard when no node registered | 404 "No node registered" | Verify |
| M03-TC05 | PUT /api/node/settings updates bandwidthLimitMB | 200 node with new value | Verify |
| M03-TC06 | GET /api/node/api-key | 200 apiKey returned | Verify |
| M03-TC07 | POST /api/node/api-key/regenerate | 200 new apiKey returned | Verify |
| M03-TC08 | POST /api/node/start | 200 ParticipationSession created, node status=active | Verify |
| M03-TC09 | POST /api/node/stop | 200 session status=stopped, node status=inactive | Verify |

---

### M04 — Session Monitoring

| TC-ID | Test Case | Expected Result | Status |
|---|---|---|---|
| M04-TC01 | GET /api/node/session/current — node active | 200 session data, latency in 20–150ms range | Verify |
| M04-TC02 | GET /api/node/session/current called twice — latency identical? | Latency will differ by ±4ms (simulated noise) | Document as Known Issue |
| M04-TC03 | GET /api/node/session/current — node inactive | 200 active:false | Verify |
| M04-TC04 | GET /api/node/telemetry | 200 array of telemetry records | Verify |
| M04-TC05 | GET /api/node/bandwidth-usage | 200 usage records | Verify |

---

### M05 — Wallet and Transactions

| TC-ID | Test Case | Expected Result | Status |
|---|---|---|---|
| M05-TC01 | GET /api/wallet | 200 wallet with balance | Verify |
| M05-TC02 | GET /api/wallet/transactions | 200 transaction list | Verify |
| M05-TC03 | POST /api/wallet/demo-credit (admin) | 200 credits added | Verify |
| M05-TC04 | POST /api/wallet/demo-credit (non-admin) | 403 Access denied | Verify |
| M05-TC05 | Submit withdrawal request | **Should return 404 or 400** — not implemented | Confirm NOT_STARTED |
| M05-TC06 | Submit top-up request | **Should return 404 or 400** — not implemented | Confirm NOT_STARTED |

---

### M06–M07 — Task Submission and Client Dashboard

| TC-ID | Test Case | Expected Result | Status |
|---|---|---|---|
| M06-TC01 | GET /api/tasks/client/dashboard | 200 activeTasks, completedTasks, availableCredits | Verify |
| M07-TC01 | POST /api/tasks with valid payload and sufficient credits | 201 task created, queued | Verify |
| M07-TC02 | POST /api/tasks with invalid URL | 400 "Invalid target URL" | Verify |
| M07-TC03 | POST /api/tasks with insufficient credits | 400 "Insufficient credits" | Verify |
| M07-TC04 | POST /api/tasks with executionLimit=0 | 400 validation error | Verify |
| M07-TC05 | POST /api/tasks with loopback URL (localhost) in production | 400 "Prohibited target host" | Verify (production only) |
| M07-TC06 | estimatedCost for executionLimit=5 | estimatedCost = 50 (flat formula) | Verify |

---

### M08 — Task Results

| TC-ID | Test Case | Expected Result | Status |
|---|---|---|---|
| M08-TC01 | GET /api/tasks/:id for own task | 200 task + result | Verify |
| M08-TC02 | GET /api/tasks/:id for another user's task | 403 "Access denied" | Verify |
| M08-TC03 | GET /api/tasks/:id/report | **Should 404** — not implemented | Confirm NOT_STARTED |
| M08-TC04 | POST /api/tasks/:id/rate | **Should 404** — not implemented | Confirm NOT_STARTED |

---

### M09 — Marketplace

| TC-ID | Test Case | Expected Result | Status |
|---|---|---|---|
| M09-TC01 | GET /api/marketplace/products | 200 list of active products | Verify |
| M09-TC02 | POST /api/marketplace/orders with sufficient credits | 201 order created, credits deducted | Verify |
| M09-TC03 | POST /api/marketplace/orders with insufficient credits | 400 insufficient credits error | Verify |
| M09-TC04 | GET /api/marketplace/my-orders | 200 user's orders | Verify |
| M09-TC05 | Admin PUT /api/marketplace/admin/orders/:id/status to fulfilled | 200 order fulfilled, AdminLog created | Verify |
| M09-TC06 | Admin PUT order status to cancelled | 200 refund credited back to user | Verify |

---

### M10 — Admin Management

| TC-ID | Test Case | Expected Result | Status |
|---|---|---|---|
| M10-TC01 | GET /api/admin/dashboard | 200 with all counts | Verify |
| M10-TC02 | GET /api/admin/users | 200 paginated user list | Verify |
| M10-TC03 | GET /api/admin/users?search=email@test.com | 200 filtered list | Verify |
| M10-TC04 | PUT /api/admin/users/:id/block | 200 user.status=blocked, AdminLog created | Verify |
| M10-TC05 | PUT /api/admin/users/:id/unblock | 200 user.status=active | Verify |
| M10-TC06 | Admin blocking themselves | 400 "Admin cannot block themselves" | Verify |
| M10-TC07 | GET /api/admin/logs | 200 audit log entries | Verify |
| M10-TC08 | GET /api/admin/alerts | **Should 404** — not implemented | Confirm NOT_STARTED |

---

### M11 — Full Integration Test (Task Lifecycle)

| TC-ID | Test Case | Expected Result | Status |
|---|---|---|---|
| INT-TC01 | Register → verify → login as platform_client | Token returned | Verify |
| INT-TC02 | Verify wallet has 500 starter credits | GET /api/wallet returns balance=500 | Verify |
| INT-TC03 | Submit task (executionLimit=1, cost=10) | Task status=pending, balance=490 | Verify |
| INT-TC04 | Register another user as node_participant, start participation | Node status=active | Verify |
| INT-TC05 | Start node agent with API key | Agent connects via Socket.IO | Verify |
| INT-TC06 | Task gets allocated to node (wait for worker) | Task status=assigned | Verify |
| INT-TC07 | Agent executes real HTTP test to targetUrl | HTTP response received | Verify |
| INT-TC08 | Agent reports task_completed event | TaskResult created, node rewarded | Verify |
| INT-TC09 | Client checks task status | Task status=settled | Verify |
| INT-TC10 | Node user checks wallet | Credits earned (reward > 0) | Verify |

---

### M12 — Security Tests

| TC-ID | Test Case | Expected Result | Status |
|---|---|---|---|
| SEC-TC01 | Access /api/admin/dashboard without JWT | 401 | Verify |
| SEC-TC02 | Access /api/admin/dashboard with node_participant JWT | 403 | Verify |
| SEC-TC03 | Rate limit: 121 requests in 60s from same IP | 429 "Too many requests" | Verify |
| SEC-TC04 | Send `<script>alert(1)</script>` as name in register | Script tags stripped by sanitizeInputs | Verify |
| SEC-TC05 | Attempt to forge task ownership (GET task of other user) | 403 | Verify |
| SEC-TC06 | Block a user, try to log in with their credentials | 403 "Your account is blocked" | Verify |
| SEC-TC07 | Self-register as admin via API | 201 created — **KNOWN SECURITY BUG** | Document as Bug |
| SEC-TC08 | Use expired/invalid JWT | 401 "Invalid or expired token" | Verify |

---

## 4. Performance Tests

| TC-ID | Test | Target | Tool |
|---|---|---|---|
| PERF-TC01 | 50 concurrent task submissions | All queued, no 500 errors | Apache Bench / wrk |
| PERF-TC02 | 100 simultaneous Socket.IO node connections | All connected, heartbeat working | Custom test script in tests/ |
| PERF-TC03 | GET /api/admin/users with 1000 users | Response < 2s | Verify with populated DB |
| PERF-TC04 | Task allocation: time from queue to node dispatch | < 5 seconds | distributedSystemTest.js |

---

## 5. Existing Test Files

| File | What it Tests |
|---|---|
| [`tests/distributedSystemTest.js`](../../tests/distributedSystemTest.js) | End-to-end: user registration, login, node registration, task creation, Socket.IO node connection, task execution, settlement |

**Run command:**
```bash
cd netshare-backend
npm run dev &  # Start backend first

cd tests
node distributedSystemTest.js
```

**Known issues with existing test:**
- Test attempts to register admin and does not verify failure (no self-registration guard)
- Test uses hardcoded credentials — must update to random values for repeatable runs
- Test does not clean up created test data from MongoDB after running

---

## 6. Testing Gaps (Not Yet Automated)

| Gap | Recommendation |
|---|---|
| No unit tests for walletService.js | Add Jest unit tests for deductCredits, addCredits |
| No unit tests for rewardService.js | Add Jest unit tests for calculateReward |
| No unit tests for taskAllocationService.js | Add Jest unit tests for findAvailableNode scoring |
| No frontend tests | Add Cypress e2e tests for core flows |
| No load test results | Run and document wrk or k6 load test results |

---

## 7. Pre-Assessment Checklist

Before supervisor presentation, verify these manually:

- [ ] Backend starts cleanly with `npm run dev`
- [ ] Frontend loads at http://localhost:5173
- [ ] Registration + OTP verification works
- [ ] Login redirects correctly by role
- [ ] Task submission creates a task and deducts credits
- [ ] Node dashboard shows correct status
- [ ] Integration flow (task lifecycle) completes end-to-end
- [ ] Admin can block/unblock a user
- [ ] Marketplace order can be placed and fulfilled
- [ ] Docker Compose `docker-compose up` starts all services
