# Telemetry Contract

This document defines the telemetry contract for the NetShare platform, specifying exactly what metrics are collected, how they are measured, and how they are handled across the system.

## Metrics Definition

| Metric | Field | Unit | Producer | Method | Unavailable Behavior |
|---|---|---|---|---|---|
| Node online state | `status` | enum(inactive, active, busy, paused, draining, offline, unhealthy) | Backend | Socket connection + heartbeat | `offline` |
| Heartbeat timestamp | `lastHeartbeatAt` | ISO8601 | Backend | Server receive time (Socket `heartbeat` event → server `Date.now()`) | `null` — display "No heartbeat" |
| CPU usage | `cpuUsage` | percent (0-100) | Desktop: os.cpus() delta, Flutter: UNAVAILABLE | Desktop: real via `os` module, Flutter: Android has no reliable userland API | `null` — display "Unavailable" |
| Memory usage | `memoryUsage` | percent (0-100) | Desktop: os.totalmem/freemem, Flutter: UNAVAILABLE | Desktop: real calculation, Flutter: Android has no reliable userland API | `null` — display "Unavailable" |
| Heartbeat RTT | `heartbeatRttMs` | milliseconds | Agent | Agent timestamps heartbeat send, server sends ack with serverTime, agent calculates difference | `null` — display "Unavailable" |
| Task Response Time (TTFB) | `ttfbMs` | milliseconds | Agent | `performance.now()` from request start to first byte | `null` — display "Unavailable" |
| Request Failure Rate | `requestFailureRate` | percent (0-100) | Backend | `(failedTasks / totalTasks) * 100` over sliding window | `null` or `0` if no tasks |
| Uploaded bytes | `uploadedBytes` | bytes | Agent | Request payload size measurement | `0` |
| Downloaded bytes | `downloadedBytes` | bytes | Agent | Response body `chunk.length` accumulation | `0` |
| Total bytes | `totalBytes` | bytes | Backend | `uploadedBytes + downloadedBytes` | `0` |
| Throughput (upload) | `measuredUploadBps` | bytes/sec | Agent | `uploadedBytes / elapsedSeconds` using monotonic timer | `null` if transfer < 100ms |
| Throughput (download) | `measuredDownloadBps` | bytes/sec | Agent | `downloadedBytes / elapsedSeconds` using monotonic timer | `null` if transfer < 100ms |
| Active tasks | `currentActiveTasks` | count | Backend | In-memory counter, persisted on NodeDevice | `0` |
| Session duration | `connectedDurationSec` | seconds | Backend | `Date.now() - session.startTime` | `0` |
| Bandwidth remaining | `remainingBandwidthBytes` | bytes | Backend | `(bandwidthLimitMB * 1048576) - totalUsedBytes` | Show limit if no usage |
| Credits earned | `creditsEarned` | credits (integer) | Backend | Accumulated from wallet transactions | `0` |
| Configured upload cap | `configuredUploadCapMbps` | Mbps | User config | Stored on NodeDevice | Display configured value |
| Configured download cap | `configuredDownloadCapMbps` | Mbps | User config | Stored on NodeDevice | Display configured value |
| Measured upload speed | `measuredUploadMbps` | Mbps | Agent | `measuredUploadBps * 8 / 1000000` | `null` — display "Unavailable" |
| Measured download speed | `measuredDownloadMbps` | Mbps | Agent | `measuredDownloadBps * 8 / 1000000` | `null` — display "Unavailable" |

## Protocol & Transport

- **Heartbeat protocol version**: 1
- **Heartbeat payload structure**:
  ```json
  {
    "version": 1,
    "cpuUsage": 45.2,
    "memoryUsage": 60.1,
    "heartbeatRttMs": 42
  }
  ```
- **Backend validation rules**:
  - Numeric ranges: 0-100 for percentages, >= 0 for ms/bytes
  - Required fields: `version`
  - Max payload size: 1KB
- **Transport**: Socket.IO `heartbeat` event emitted every 10 seconds.

## Persistence Model

- `NodeHeartbeat`: Transient telemetry data, TTL 7 days.
- `NodeTelemetry`: Aggregated analytics data, TTL 30 days.
- `BandwidthUsage`: Permanent record of bandwidth consumption.
- **Business records (permanent)**: `TaskResult`, `CreditTransaction`, `ParticipationSession`.
