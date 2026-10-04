# NetShare — Simulated or Placeholder Features
> Generated: 2026-09-26 | Documents every fake, simulated, or placeholder implementation

---

## Overview

This document catalogues every feature that appears implemented but is actually simulated, hardcoded, mocked, or non-functional. These items must NOT be presented as working features during assessment.

---

## 1. `simulatedSecureChannel: true` — TaskSession Model

**File:** [`netshare-backend/models/TaskSession.js`](../../netshare-backend/models/TaskSession.js)

```javascript
simulatedSecureChannel: {
  type: Boolean,
  default: true,
}
```

**What it claims:** That a secure channel was established between the client, backend, and node for the task session.

**What it actually does:** Nothing. This boolean is always `true`. It is never read by any logic, never computed from a real event, and never connected to any actual secure communication mechanism.

**Required reality:** CON-4, SI-3, SI-4 require a WebRTC Data Channel-based secure routing session. The field name implies compliance where none exists.

---

## 2. Latency Noise Injection — `getCurrentSession()`

**File:** [`netshare-backend/controllers/nodeController.js`](../../netshare-backend/controllers/nodeController.js), line ~221

```javascript
const currentLatency = Math.max(
  20,
  Math.min(150, (node.latencyMs || 45) + Math.floor(Math.random() * 9 - 4))
);
```

**What it claims:** That the NodeSession view shows "live" real-time latency.

**What it actually does:** Takes the stored `node.latencyMs` field from the database and adds a random ±4ms jitter to make it look dynamic in the UI. *(Note: This fake latency noise was removed in Phase 0. Actual DB value is now used without noise).*

**Impact:** Every `GET /api/node/session/current` call returns a slightly different latency value, giving the appearance of real-time measurement when it is actually a decoration over a stored value. *(Resolved in Phase 0)*

---

## 3. Flutter Heartbeat — Hardcoded CPU/Memory

**File:** `Netshare/netshare_node_app/lib/services/NodeSocketService.dart` (confirmed from prior audit)

```dart
// Inside heartbeat timer
'cpuUsage': 5.0,     // Hardcoded — not real system CPU
'memoryUsage': 25.0, // Hardcoded — not real system memory
```

**What it claims:** That Flutter nodes report real device CPU and memory utilization.

**What it actually does:** Sends hardcoded static values `5.0` and `25.0` every 10 seconds regardless of actual device load.

**Note:** The desktop Node.js agent (`netshare-agent`) does measure real CPU/memory using `os.cpus()` and `os.freemem()`. Only the Flutter app is simulated.

---

## 4. OTP Email Delivery — Response Body Only

**File:** [`netshare-backend/controllers/authController.js`](../../netshare-backend/controllers/authController.js)

```javascript
if (process.env.NODE_ENV !== "production") {
  response.devOtp = otp;
}
```

**What it claims:** That OTP verification emails are sent to users.

**What it actually does:** Returns the OTP directly in the API response body in development mode. No email or SMS service is integrated. In production mode (NODE_ENV=production), the OTP is simply not returned in the response, meaning users cannot verify their email at all without a backend code change or database inspection.

**Affected flows:** Registration, forgot password, password reset.

---

## 5. ML Service — Deployed but Never Called

**File:** [`ml-service/app.py`](../../ml-service/app.py), [`netshare-backend/services/taskAllocationService.js`](../../netshare-backend/services/taskAllocationService.js)

**What it claims:** The system uses a machine learning model for intelligent node selection.

**What it actually does:** The Python Flask ML service (`ml-service/`) is a standalone service with a trained `RandomForestRegressor`. It is included in `docker-compose.yml` and starts correctly. However, `taskAllocationService.js` — the only code that selects nodes — does NOT call the ML service at all. It implements its own pure-JavaScript scoring formula.

**Impact:** The ML service runs in Docker, consumes resources, passes health checks, but has zero effect on any task allocation decision.

---

## 6. Session Controller — `startSession` and `completeSession`

**File:** [`netshare-backend/controllers/sessionController.js`](../../netshare-backend/controllers/sessionController.js)

```javascript
session.logs.push({
  message: "Simulated secure session started.",  // <-- says "Simulated"
});
```

```javascript
session.logs.push({
  message: "Simulated secure session completed.", // <-- says "Simulated"
});
```

**What it claims:** That a secure routing session is being started and completed.

**What it actually does:** Updates the `status` field on a `TaskSession` document and adds a log entry that literally says "Simulated". These REST endpoints (`PUT /api/sessions/:id/start`, `PUT /api/sessions/:id/complete`) are never called by the normal task execution flow, which goes through Socket.IO events instead.

---

## 7. Profile Image Upload

**File:** [`netshare-backend/controllers/userController.js`](../../netshare-backend/controllers/userController.js)

```javascript
if (profileImage !== undefined) {
  req.user.profileImage = profileImage;
}
```

**What it claims:** Users can upload and store profile pictures.

**What it actually does:** Accepts a string value for `profileImage` and stores it as-is in the database. There is no multipart file upload endpoint, no Multer/Formidable middleware, no cloud storage (Cloudinary, S3, or local filesystem). The "upload" is actually just storing whatever string the client sends (presumably a URL or base64 string) without any validation.

**Impact:** If a client sends an actual image file via multipart/form-data, it will fail entirely. Only works if client sends a string URL.

---

## 8. Register.jsx — "Admin" Role Selectable by Anyone

**File:** [`netshare-frontend/src/pages/auth/Register.jsx`](../../netshare-frontend/src/pages/auth/Register.jsx)

```jsx
<select name="role" value={form.role} onChange={handleChange}>
  <option value="platform_client">Platform Client</option>
  <option value="admin">Admin</option>
</select>
```

**What it claims:** Role selection during registration.

**What it actually does:** Allows anyone to register as an `admin` without any invitation, approval, or verification. The backend `authController.js` accepts `admin` as a valid role.

**Note:** `node_participant` and `both` are valid roles per SRS but are not in the dropdown — the frontend is incomplete.

---

## 9. Docker Agent API Key — Pre-Seeded Requirement

**File:** [`docker-compose.yml`](../../docker-compose.yml)

```yaml
node-agent:
  environment:
    - NODE_API_KEY=nsk_live_docker_demo_agent_key_01
```

**What it claims:** The Docker agent can connect automatically.

**What it actually does:** The agent uses this API key, but the key only works if a `NodeDevice` record with `apiKey: 'nsk_live_docker_demo_agent_key_01'` already exists in MongoDB. There is no seed script, no migration, and no automated setup. The agent will fail to connect on a fresh database.

---

## 10. Admin Dashboard — `bandwidth_usage` Aggregation Missing

**File:** [`netshare-backend/controllers/adminController.js`](../../netshare-backend/controllers/adminController.js)

**What it claims:** Admin dashboard shows "overall bandwidth usage statistics" (FR12.3).

**What it actually does:** The `getAdminDashboard` endpoint returns `totalUsers`, `totalNodes`, `activeNodes`, `totalTasks`, `activeTasks`, `completedTasks`, `totalCreditsIssued` — but does NOT aggregate `BandwidthUsage` collection at all. The bandwidth statistics promised by FR12.3 are absent from the admin dashboard API response.

---

## 11. Task Status "Queued" — Not Stored

**What it claims:** Tasks pass through a "queued" state per Chapter 3 state machine.

**What it actually does:** When a task is submitted, it is stored in MongoDB with status `pending`. When it enters the BullMQ/in-memory queue, the status in DB remains `pending` — there is no `queued` state stored in the database. The task is in a queue in memory/Redis, but the DB does not reflect this intermediate state.

---

## Summary Table

| # | Feature | Simulated Element | Real Equivalent Needed |
|---|---|---|---|
| 1 | Secure Channel | `simulatedSecureChannel: true` boolean | WebRTC Data Channel |
| 2 | Live Latency | `Math.random() * 9 - 4` noise added | Real-time telemetry push |
| 3 | Flutter CPU/Memory | Hardcoded 5.0 / 25.0 | `cpu_info` / `memory_info` Dart plugins |
| 4 | OTP Email Delivery | `devOtp` in response body | Nodemailer / SendGrid / Twilio |
| 5 | ML Node Selection | ML service deployed, never called | HTTP call to `/rank-nodes` |
| 6 | Session Start/Complete | Log says "Simulated" | Real WebRTC session lifecycle |
| 7 | Profile Image Upload | String stored, no upload endpoint | Multer + cloud storage |
| 8 | Admin Registration | Anyone can self-register as admin | Invite-only / seeded only |
| 9 | Docker Agent Key | Requires manual DB seed | Seed script in startup |
| 10 | Admin Bandwidth Stats | Not aggregated in API | BandwidthUsage aggregation |
| 11 | Task "Queued" State | `pending` status used for both | Separate `queued` status |
