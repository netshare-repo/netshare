# Node Health Model

This document outlines the deterministic health model used to evaluate the status of NetShare nodes.

## Inputs and Weighting

The overall `healthScore` (0.0 - 1.0) is calculated using the following inputs:

| Input | Source | Weight | Normalization |
|---|---|---|---|
| Heartbeat freshness | server `lastHeartbeatAt` vs now | 0.25 | 1.0 if <15s, 0.7 if <30s, 0.3 if <60s, 0.0 if >60s |
| Recent task success rate | Last 10 `TaskResults` | 0.25 | `successCount / totalCount` (1.0 if no tasks) |
| Request failure rate | Recent task failures | 0.15 | `1.0 - (failRate / 100)` |
| Latency | Latest `heartbeatRttMs` or `ttfbMs` | 0.15 | 1.0 if <100ms, 0.7 if <300ms, 0.3 if <1000ms, 0.0 if >1000ms |
| Bandwidth remaining | remaining / limit ratio | 0.10 | Direct ratio 0.0-1.0 |
| Task saturation | `activeTasks / maxConcurrent` | 0.10 | `1.0 - saturation ratio` |

## Output

- **Value**: `healthScore` ranging from 0.0 to 1.0.
- **Version**: `healthScoreVersion: 1`

## Thresholds & Hysteresis

- **HEALTHY**: `healthScore >= 0.6`
- **UNHEALTHY**: `healthScore < 0.4`
- **Hysteresis**: To recover from an `UNHEALTHY` state, a node must remain above the RECOVERY threshold (`0.5`) for 3 consecutive health checks (spanning 30 seconds).

## Constants & Safeguards (Poor-Network)

- `MAX_HEARTBEAT_AGE_MS`: 60000
- `MAX_ACCEPTABLE_LATENCY_MS`: 2000
- `MAX_RECENT_FAILURE_RATE`: 0.5
- `MIN_NODE_HEALTH_SCORE`: 0.4
- `RECOVERY_HEALTH_THRESHOLD`: 0.5
- `RECOVERY_CONSECUTIVE_CHECKS`: 3
