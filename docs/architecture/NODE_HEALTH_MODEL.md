# NetShare Node Health Model v1.0

## Overview

The Node Health Model computes a deterministic, reproducible health score for each node device. The score drives:

- Node selection ranking (via `taskAllocationService`)
- Automatic state transitions (`active` → `unhealthy`)
- Recovery detection (`unhealthy` → `active`)
- Dashboard display

## Health Score Formula

```
healthScore = Σ (weight_i × normalized_input_i)
```

| Input | Weight | Range | Source |
|---|---|---|---|
| Heartbeat Freshness | 0.45 | 0.0 – 1.0 | Time since last heartbeat |
| Task Success Rate | 0.15 | 0.0 – 1.0 | Last 10 TaskResult records |
| Request Failure Rate | 0.05 | 0.0 – 1.0 | Inverse of success rate |
| Latency | 0.15 | 0.0 – 1.0 | Stored latencyMs from heartbeat |
| Bandwidth Remaining | 0.10 | 0.0 – 1.0 | Ratio of remaining to total |
| Task Saturation | 0.10 | 0.0 – 1.0 | Inverse of active/max ratio |

**Total weights sum to 1.0.**

## Input Normalization

### Heartbeat Freshness

```
if age < 15s:  1.0
if age < 30s:  0.7
if age < 60s:  0.3
if age ≥ 60s:  0.0
```

Server receive time is authoritative. Node-reported timestamps are ignored for this calculation.

### Latency

```
if latencyMs is null:   0.5 (unknown — neutral)
if latencyMs < 100ms:   1.0
if latencyMs < 300ms:   0.7
if latencyMs < 1000ms:  0.3
if latencyMs ≥ 1000ms:  0.0
```

### Task Success Rate

- Queries last 10 `TaskResult` records for this node
- If no records exist: defaults to 1.0 (benefit of the doubt)
- `successes / total_results`

### Bandwidth Remaining

```
limitBytes = bandwidthLimitMB × 1048576
usedBytes = totalUsedBytes or (usedBandwidthMB × 1048576)
remaining = max(0, min(1, (limitBytes - usedBytes) / limitBytes))
```

### Task Saturation

```
saturation = 1.0 - min(1, currentActiveTasks / maxConcurrentTasks)
```

Higher score = more capacity available.

## Thresholds

| Threshold | Value | Meaning |
|---|---|---|
| HEALTHY | 0.6 | Node is healthy and eligible for tasks |
| UNHEALTHY | 0.4 | Node is unhealthy — should be transitioned |
| RECOVERY | 0.5 | Node must exceed this to begin recovery |
| RECOVERY_CONSECUTIVE | 3 | Consecutive healthy checks needed before auto-recovery |

## State Transitions

### Degradation Path

```
active/busy → unhealthy
Triggered when: healthScore < UNHEALTHY (0.4)
```

### Recovery Path

```
unhealthy → active
Triggered when: healthScore ≥ RECOVERY (0.5)
  AND consecutiveHealthyChecks ≥ RECOVERY_CONSECUTIVE (3)
```

The consecutive check requirement prevents flapping between states.

## Health Check Frequency

- Health scores are recalculated:
  - On every heartbeat (10s interval)
  - On task completion/failure
  - On admin dashboard request
  - On task allocation scoring

## Persistence

| Field | Model | Description |
|---|---|---|
| `healthScore` | NodeDevice | Current computed score |
| `healthScoreVersion` | NodeDevice | Algorithm version (currently 1) |
| `consecutiveHealthyChecks` | NodeDevice | Counter for recovery detection |

## Versioning

The health model is versioned to support future algorithm changes:

```json
{
  "healthScore": 0.82,
  "healthScoreVersion": 1,
  "isHealthy": true,
  "inputs": {
    "heartbeatFreshness": 1.0,
    "taskSuccessRate": 0.9,
    "failureRateNorm": 0.9,
    "latencyNorm": 0.7,
    "bandwidthRemaining": 0.8,
    "taskSaturation": 1.0
  }
}
```

All inputs are stored so health decisions can be audited and reproduced.

## Design Rationale

### Why heartbeat has highest weight (0.45)?

A node that isn't heartbeating is effectively offline. Even if it had perfect latency and success rate historically, if it's not responding, it cannot serve tasks. This weight ensures stale heartbeats reliably drop below the HEALTHY threshold.

### Why no random/simulated components?

Per the project telemetry contract: "Production-visible measurements must be one of: REAL, DERIVED_FROM_REAL_DATA, UNAVAILABLE. Never fabricate a believable number."

The health model uses only:
- Server-measured heartbeat age (REAL)
- Stored task results (REAL)
- Stored latency from telemetry (REAL)
- Byte counters (REAL)
- Task assignment count (REAL)
