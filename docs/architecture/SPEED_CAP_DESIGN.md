# NetShare Speed Cap Design v1.0

## Overview

NetShare enforces **user-configurable bandwidth speed caps** that limit the maximum transfer rate a node can sustain during task execution. These caps protect node participants from excessive bandwidth consumption and honor their ISP plan constraints.

## Speed Cap Fields

| Field | Schema | Default | Description |
|---|---|---|---|
| `uploadSpeedCapMbps` | `NodeDevice.uploadSpeedCapMbps` | 5 Mbps | Max upload speed the node will sustain |
| `downloadSpeedCapMbps` | `NodeDevice.downloadSpeedCapMbps` | 10 Mbps | Max download speed the node will sustain |
| `speedCapMbps` | `NodeDevice.speedCapMbps` | 10 Mbps | Legacy unified cap (alias for downloadSpeedCapMbps) |

## Important Distinction

| Concept | Meaning |
|---|---|
| **Speed Cap** | User-configured maximum. A **policy limit**, not a measurement. |
| **Measured Throughput** | Actually observed transfer rate during execution. Always ≤ speed cap (in theory). |

**Never display a speed cap as if it were measured throughput.**

## Enforcement Points

### Phase 1 (Current)

Speed caps are **advisory and display-only** in Phase 1:
- Stored in `NodeDevice` and displayed on dashboards
- Task allocation considers them as metadata for future ML scoring
- No active traffic shaping or rate limiting is implemented

### Phase 2+ (Planned)

When real routing is implemented via Android VpnService / WebRTC:
- Agent-side rate limiting will throttle transfer to configured cap
- Backend validates reported throughput doesn't consistently exceed cap
- Anomaly detection flags nodes reporting throughput > cap

## API Representation

```json
{
  "uploadSpeedCap": 5,
  "downloadSpeedCap": 10,
  "measuredUploadMbps": null,
  "measuredDownloadMbps": null
}
```

- `*SpeedCap` = user configuration (always present)
- `measured*Mbps` = actual observation (`null` if no recent task)

## Configuration Constraints

| Rule | Enforcement |
|---|---|
| Minimum upload cap | 0.5 Mbps (below this, node is not useful) |
| Minimum download cap | 1 Mbps |
| Maximum upload cap | None (limited by ISP) |
| Maximum download cap | None (limited by ISP) |
| Validation | `updateNodeSettings` controller validates and clamps |
