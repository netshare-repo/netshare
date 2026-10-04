# NetShare Telemetry Contract v1.0

> Authoritative specification for all metrics flowing through the NetShare telemetry pipeline.

## Overview

```
Desktop Node Agent / Flutter Node Agent
         ↓ (Socket.IO heartbeat event)
      Backend (validation + persistence)
         ↓
      MongoDB (NodeHeartbeat, NodeTelemetry, BandwidthUsage)
         ↓
      REST API (/api/node/dashboard, /api/node/session/current, /api/node/telemetry)
         ↓
      React Dashboard / Flutter UI
```

## Metric Availability Classification

Every metric must be one of:

| Classification | Meaning |
|---|---|
| **REAL** | Directly measured from hardware/OS/network |
| **DERIVED_FROM_REAL_DATA** | Calculated from real measurements (e.g., throughput = bytes / time) |
| **UNAVAILABLE** | Cannot be measured on this platform; reported as `null` |

**Never fabricate a believable number.** If a metric is UNAVAILABLE, return `null` and the frontend displays "Unavailable".

---

## Metric Definitions

### 1. Node Online State

| Property | Value |
|---|---|
| **Canonical Field** | `status` |
| **Unit** | Enum: `inactive`, `active`, `busy`, `paused`, `draining`, `offline`, `unhealthy` |
| **Producer** | Backend (authoritative based on heartbeat + state machine) |
| **Measurement Method** | Server-side state machine transitions |
| **Collection Frequency** | On state change events |
| **Transport Event** | `node_status_change` (Socket.IO broadcast) |
| **Backend Validation** | Must be valid enum value; state machine validates transitions |
| **Persistence Model** | `NodeDevice.status` |
| **API Field** | `status` in dashboard/session responses |
| **UI Representation** | Status badge with color coding |
| **Unavailable Behavior** | N/A — always known |

### 2. Heartbeat Timestamp

| Property | Value |
|---|---|
| **Canonical Field** | `lastSeenAt` |
| **Unit** | ISO 8601 UTC timestamp |
| **Producer** | Backend (uses server receive time, NOT node-reported time) |
| **Measurement Method** | `Date.now()` on server when heartbeat received |
| **Collection Frequency** | Every 10 seconds (heartbeat interval) |
| **Transport Event** | `heartbeat` (Socket.IO) |
| **Backend Validation** | Server receive time is authoritative; node timestamp stored for diagnostics only |
| **Persistence Model** | `NodeDevice.lastSeenAt`, `NodeHeartbeat.timestamp` |
| **API Field** | `lastSeenAt` |
| **UI Representation** | "Last seen: X seconds ago" or relative time |
| **Unavailable Behavior** | If never connected: `null` → "Never connected" |

### 3. CPU Usage

| Property | Value |
|---|---|
| **Canonical Field** | `cpuUsage` |
| **Unit** | Percentage (0–100) or `null` |
| **Producer** | Desktop Agent (Node.js `os.cpus()`), Flutter Agent: **UNAVAILABLE** |
| **Measurement Method** | Desktop: `os.cpus()` idle/total delta over interval. Android: No reliable API without root |
| **Collection Frequency** | Every 10s with heartbeat |
| **Transport Event** | `heartbeat` → `cpuUsage` field |
| **Backend Validation** | Must be `null` or number 0–100; reject other types |
| **Persistence Model** | `NodeTelemetry.cpuUsage`, `NodeHeartbeat.cpuUsage` |
| **API Field** | `cpuUsage` |
| **UI Representation** | Percentage gauge or "Unavailable" if `null` |
| **Unavailable Behavior** | Return `null`; display "Unavailable" |
| **Platform Limitations** | Android cannot provide reliable CPU usage without `/proc/stat` parsing (requires SELinux exceptions on API 26+). Flutter agent reports `null`. |

### 4. Memory Usage

| Property | Value |
|---|---|
| **Canonical Field** | `memoryUsage` |
| **Unit** | Percentage (0–100) or `null` |
| **Producer** | Desktop Agent (Node.js `os.freemem()/os.totalmem()`), Flutter Agent: **UNAVAILABLE** |
| **Measurement Method** | Desktop: `(1 - os.freemem()/os.totalmem()) * 100`. Android: No reliable public API |
| **Collection Frequency** | Every 10s with heartbeat |
| **Transport Event** | `heartbeat` → `memoryUsage` field |
| **Backend Validation** | Must be `null` or number 0–100 |
| **Persistence Model** | `NodeTelemetry.memoryUsage`, `NodeHeartbeat.memoryUsage` |
| **API Field** | `memoryUsage` |
| **UI Representation** | Percentage or "Unavailable" if `null` |
| **Unavailable Behavior** | Return `null`; display "Unavailable" |

### 5. Heartbeat RTT (Latency)

| Property | Value |
|---|---|
| **Canonical Field** | `heartbeatRttMs` / `latencyMs` |
| **Unit** | Milliseconds or `null` |
| **Producer** | Agent (measures round-trip of heartbeat ack) |
| **Measurement Method** | Agent sends heartbeat with monotonic timestamp, receives `heartbeat_ack`, computes RTT |
| **Collection Frequency** | Every 10s with heartbeat |
| **Transport Event** | `heartbeat` → `networkStatus.latencyMs` |
| **Backend Validation** | Must be `null` or number 0–30000; reject negative values |
| **Persistence Model** | `NodeDevice.latencyMs`, `NodeHeartbeat.networkStatus.latencyMs` |
| **API Field** | `latencyMs`, `latency` |
| **UI Representation** | "Xms" or "Unavailable" if `null` |
| **Unavailable Behavior** | Return `null`; display "Unavailable" |

### 6. Task Response Time (TTFB where applicable)

| Property | Value |
|---|---|
| **Canonical Field** | `taskResponseTimeMs` |
| **Unit** | Milliseconds |
| **Producer** | Agent (during HTTP task execution) |
| **Measurement Method** | Monotonic timer from request start to first response byte |
| **Collection Frequency** | Per task execution |
| **Transport Event** | `task_completed` → `latencyMs` |
| **Backend Validation** | Must be number ≥ 0 or `null` |
| **Persistence Model** | `TaskResult.latencyMs` |
| **API Field** | `latencyMs` in TaskResult |
| **UI Representation** | "Xms" or "Unavailable" |
| **Unavailable Behavior** | `null` |

### 7. Request Failure Rate

| Property | Value |
|---|---|
| **Canonical Field** | `requestFailureRate` |
| **Unit** | Ratio 0.0–1.0 |
| **Producer** | Backend (DERIVED_FROM_REAL_DATA) |
| **Measurement Method** | Failed tasks / total tasks from last N TaskResults |
| **Collection Frequency** | Calculated on demand (health check, allocation) |
| **Transport Event** | N/A — server-side computation |
| **Backend Validation** | Ratio clamped 0–1 |
| **Persistence Model** | Computed from `TaskResult` collection |
| **API Field** | Part of health score inputs |
| **UI Representation** | Percentage or "Unavailable" |
| **Unavailable Behavior** | Default 0 (no failures recorded) |
| **Note** | This is NOT packet-level loss. It measures HTTP request success/failure. Renamed from misleading `packetLoss` for accuracy. |

### 8. Bytes Uploaded

| Property | Value |
|---|---|
| **Canonical Field** | `uploadedBytes` |
| **Unit** | Bytes (integer) |
| **Producer** | Agent (measured from HTTP request payload) |
| **Measurement Method** | `Content-Length` of request or actual bytes written |
| **Collection Frequency** | Per task completion |
| **Transport Event** | `task_completed` → computed from `uploadBandwidthMB` * 1048576 |
| **Backend Validation** | Must be number ≥ 0 |
| **Persistence Model** | `BandwidthUsage.uploadBandwidthMB` (stored as MB for legacy; canonical is bytes) |
| **API Field** | `uploadBandwidthMB` |
| **UI Representation** | Converted to KB/MB/GB for display |
| **Unavailable Behavior** | 0 (legitimate — request had no body) |

### 9. Bytes Downloaded

| Property | Value |
|---|---|
| **Canonical Field** | `downloadedBytes` |
| **Unit** | Bytes (integer) |
| **Producer** | Agent (measured from HTTP response payload) |
| **Measurement Method** | Response `Content-Length` or actual bytes received |
| **Collection Frequency** | Per task completion |
| **Transport Event** | `task_completed` → computed from `downloadBandwidthMB` * 1048576 |
| **Backend Validation** | Must be number ≥ 0 |
| **Persistence Model** | `BandwidthUsage.downloadBandwidthMB` |
| **API Field** | `downloadBandwidthMB` |
| **UI Representation** | Converted to KB/MB/GB for display |
| **Unavailable Behavior** | `null` if measurement failed |

### 10. Total Bytes

| Property | Value |
|---|---|
| **Canonical Field** | `totalBytes` |
| **Unit** | Bytes (integer) |
| **Producer** | Backend (DERIVED_FROM_REAL_DATA: uploadedBytes + downloadedBytes) |
| **Measurement Method** | Sum of upload + download |
| **Persistence Model** | `BandwidthUsage.totalBandwidthMB`, `NodeDevice.totalUsedBytes` |
| **API Field** | `bandwidthUsedMB`, `totalBandwidthMB` |
| **UI Representation** | Converted to MB/GB |

### 11. Measured Throughput

| Property | Value |
|---|---|
| **Canonical Field** | `measuredDownloadMbps` / `measuredUploadMbps` |
| **Unit** | Megabits per second (Mbps) |
| **Producer** | Agent or Backend (DERIVED_FROM_REAL_DATA) |
| **Measurement Method** | `(transferredBytes * 8) / (elapsedMs / 1000) / 1000000` |
| **Collection Frequency** | Per task completion |
| **Backend Validation** | Must be ≥ 0. If elapsed time < 100ms, report `null` (too short for meaningful estimate) |
| **Persistence Model** | Calculated on demand |
| **API Field** | `measuredDownloadMbps`, `measuredUploadMbps` |
| **UI Representation** | "X.X Mbps" or "Unavailable" |
| **Unavailable Behavior** | `null` when transfer too short |

### 12. Active Tasks

| Property | Value |
|---|---|
| **Canonical Field** | `currentActiveTasks` |
| **Unit** | Integer count |
| **Producer** | Backend (authoritative — tracks assignments) |
| **Measurement Method** | Incremented on assignment, decremented on completion/failure |
| **Persistence Model** | `NodeDevice.currentActiveTasks` |
| **API Field** | `activeTasks` |
| **UI Representation** | Number |

### 13. Session Duration

| Property | Value |
|---|---|
| **Canonical Field** | `connectedDurationSec` |
| **Unit** | Seconds |
| **Producer** | Backend (DERIVED_FROM_REAL_DATA) |
| **Measurement Method** | `Math.floor((Date.now() - sessionStartTime) / 1000)` |
| **Persistence Model** | Calculated from `ParticipationSession.startTime` |
| **API Field** | `connectedDurationSec` |
| **UI Representation** | "Xh Xm Xs" |

### 14. Bandwidth Remaining

| Property | Value |
|---|---|
| **Canonical Field** | `remainingBandwidthMB` |
| **Unit** | Megabytes |
| **Producer** | Backend (DERIVED_FROM_REAL_DATA) |
| **Measurement Method** | `bandwidthLimitMB - usedBandwidthMB` |
| **Persistence Model** | Calculated from `NodeDevice` fields |
| **API Field** | `bandwidthLimit - bandwidthUsed` |
| **UI Representation** | "X MB remaining" with progress bar |

### 15. Credits Earned

| Property | Value |
|---|---|
| **Canonical Field** | `creditsEarned` |
| **Unit** | Credits (integer) |
| **Producer** | Backend (authoritative) |
| **Measurement Method** | Sum of CreditTransaction amounts for user |
| **Persistence Model** | `Wallet.earnedCredits`, `ParticipationSession.creditsEarned` |
| **API Field** | `creditsEarned`, `walletBalance` |
| **UI Representation** | Number with currency symbol |

---

## Heartbeat Contract v1

```json
{
  "version": 1,
  "nodeId": "<implicit from socket auth>",
  "timestamp": "<ISO 8601 - agent local time, for diagnostics only>",
  "metrics": {
    "cpuUsage": null,
    "memoryUsage": null,
    "status": "active",
    "networkStatus": {
      "latencyMs": null,
      "uploadSpeedMbps": 0,
      "downloadSpeedMbps": 0,
      "packetLoss": 0
    }
  }
}
```

### Backend Validation Rules

1. **Authenticated node identity**: Socket must be authenticated; nodeId derived from socket auth, not payload
2. **Version**: Must be present and supported (currently v1)
3. **Timestamp sanity**: Agent timestamp, if present, must be within ±60s of server time (for diagnostics only; server time is authoritative)
4. **Numeric ranges**: `cpuUsage` 0–100 or null, `memoryUsage` 0–100 or null, `latencyMs` 0–30000 or null
5. **Allowed properties**: Only documented fields accepted; extra properties stripped
6. **Payload size**: Max 4KB per heartbeat event
7. **No arbitrary field updates**: Heartbeat cannot modify `status`, `bandwidthLimitMB`, or other configuration fields

---

## Data Retention Policy

| Data Type | Retention | TTL Index | Rationale |
|---|---|---|---|
| NodeHeartbeat | 7 days | Yes (`timestamp`) | High-frequency diagnostic data |
| NodeTelemetry | 7 days | Yes (`timestamp`) | High-frequency metric snapshots |
| BandwidthUsage | 90 days | No | Billing/audit support data |
| TaskResult | Permanent | No | Business record — audit trail |
| CreditTransaction | Permanent | No | Financial record — required for billing |
| ParticipationSession | Permanent | No | Business record — contribution history |
| TestingTask | Permanent | No | Business record — task history |

> **CRITICAL**: TTL indexes must NOT be applied to TaskResult, CreditTransaction, ParticipationSession, or TestingTask collections. These are durable business records.

---

## Time Authority

- **Server time (UTC)** is authoritative for:
  - Task state transitions
  - Participation start/end
  - Settlement timestamps
  - Wallet transaction timestamps
  - Node online/offline determination
  - Heartbeat freshness calculation

- **Node/device timestamp** is stored for diagnostics but NEVER trusted for financial calculations.

- **Monotonic elapsed time** should be used for performance timings (throughput, TTFB) where available.
