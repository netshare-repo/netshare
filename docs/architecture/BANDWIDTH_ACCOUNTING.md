# NetShare Bandwidth Accounting v1.0

## Accounting Model

NetShare uses **application-level HTTP payload accounting**, not wire-level network accounting.

### What is measured

| Data | Measured? | Method |
|---|---|---|
| HTTP request body bytes | Yes | `Content-Length` or actual bytes written |
| HTTP response body bytes | Yes | `Content-Length` or actual bytes received |
| HTTP request headers | **No** | Not currently measured |
| HTTP response headers | **No** | Not currently measured |
| TCP/IP overhead | **No** | Not accessible at application level |
| TLS handshake bytes | **No** | Not accessible at application level |

> **Accuracy Statement**: NetShare accounts for HTTP payload bytes only. This underestimates actual network usage by ~5-15% depending on header sizes and TCP overhead. NetShare does NOT claim wire-level accuracy.

---

## Canonical Internal Fields

| Field | Type | Unit | Description |
|---|---|---|---|
| `uploadedBytes` | Integer | Bytes | Request payload sent by node |
| `downloadedBytes` | Integer | Bytes | Response payload received by node |
| `totalBytes` | Integer | Bytes | `uploadedBytes + downloadedBytes` |

### Legacy Fields (MB-based)

For backward compatibility, the following MB-based fields exist:

| Field | Conversion | Stored In |
|---|---|---|
| `uploadBandwidthMB` | `uploadedBytes / 1048576` | BandwidthUsage |
| `downloadBandwidthMB` | `downloadedBytes / 1048576` | BandwidthUsage |
| `totalBandwidthMB` | `totalBytes / 1048576` | BandwidthUsage |
| `usedBandwidthMB` | Cumulative total | NodeDevice |

> **Rule**: Business-critical usage is tracked in bytes internally. MB/GB conversions are for display only.

---

## Display Conversions

```
if bytes < 1024:         display as "{bytes} B"
if bytes < 1048576:      display as "{bytes/1024:.1f} KB"
if bytes < 1073741824:   display as "{bytes/1048576:.2f} MB"
else:                    display as "{bytes/1073741824:.2f} GB"
```

---

## Bandwidth Limit Enforcement

### Before Task Allocation

```
remainingBytes = (bandwidthLimitMB * 1048576) - totalUsedBytes
if remainingBytes <= 0:
    node is EXCLUDED from allocation
```

### During Task Execution

- Agent tracks real bytes transferred during HTTP execution
- Bytes are reported in `task_completed` event

### After Task Completion

- `NodeDevice.usedBandwidthMB` atomically incremented
- `BandwidthUsage` record created with task-level breakdown
- `ParticipationSession.bandwidthUsed` incremented

### When Limit Reached

- Node excluded from new task allocations
- If SRS requires automatic pause: transition to `paused` state with reason `bandwidth_exhausted`
- No new tasks assigned until limit reset

### Limit Reset Semantics

Usage does NOT silently reset on:
- Backend restart
- Agent restart
- Socket reconnection

Reset occurs only via:
- Explicit admin action
- Configurable daily UTC reset (if configured)
- Manual `usedBandwidthMB = 0` reset via settings

---

## Measured Throughput

Throughput is calculated from actual transferred bytes and elapsed monotonic time:

```
throughputBps = transferredBytes / (elapsedMs / 1000)
throughputMbps = (throughputBps * 8) / 1000000
```

### Distinction from Speed Caps

| Field | Meaning |
|---|---|
| `configuredUploadCapMbps` | User-set maximum upload speed |
| `configuredDownloadCapMbps` | User-set maximum download speed |
| `measuredUploadMbps` | Actually observed upload throughput |
| `measuredDownloadMbps` | Actually observed download throughput |

**Never use configured caps as measured speed.**

### Minimum Transfer Duration

If transfer duration is less than 100ms, throughput is reported as `null` (too short for meaningful estimate).

---

## Accounting Lifecycle

```
1. Task assigned to node
2. Agent begins HTTP execution
3. Agent measures request payload bytes (upload)
4. Agent measures response payload bytes (download)
5. Agent reports bytes in task_completed event
6. Backend validates reported bytes (non-negative, reasonable range)
7. Backend creates BandwidthUsage record
8. Backend atomically updates NodeDevice.usedBandwidthMB
9. Backend updates ParticipationSession.bandwidthUsed
10. Reward calculation uses measured bandwidth
```

---

## Idempotency

Duplicate `task_completed` events must NOT:
- Create multiple BandwidthUsage records for the same task
- Increment bandwidth counters twice
- Award credits twice

The backend checks `task.status` before processing — if already `completed`/`settled`, the event is ignored.
