# Node Lifecycle & State Machine

This document defines the lifecycle states and valid transitions for NetShare nodes.

## States

- `inactive` — Not participating in the network.
- `active` — Participating and eligible to receive tasks.
- `busy` — Operating at maximum concurrent task capacity.
- `paused` — Owner explicitly paused participation. Socket connected, heartbeats continue, but no new tasks are assigned.
- `draining` — Stop requested by owner, but active tasks are still running.
- `offline` — Socket is disconnected.
- `unhealthy` — Health score has fallen below the minimum threshold.

## Valid State Transitions

```text
inactive → active (startParticipation)
active → busy (assigned task fills capacity)
active → paused (owner pauses)
active → draining (owner stops, has active tasks)
active → offline (socket disconnect)
active → unhealthy (health check fails)
busy → active (task completes, capacity available)
busy → paused (owner pauses, tasks continue)
busy → draining (owner stops)
busy → offline (socket disconnect)
busy → unhealthy (health check fails)
paused → active (owner resumes, health OK)
paused → offline (socket disconnect)
draining → inactive (all tasks complete/timeout)
draining → offline (socket disconnect)
offline → active (reconnect + health OK + was participating)
offline → inactive (reconnect + was not participating)
unhealthy → active (health recovers with hysteresis)
unhealthy → offline (socket disconnect)
```

## Lifecycle Behaviors

- **Draining timeout**: 120 seconds (configurable).
- **Draining behavior**: No new tasks are assigned. Existing active tasks are allowed to complete. If the timeout is reached, remaining tasks are requeued.
- **Pause**: Preserves the heartbeat and socket connection. Prevents new task allocation without tearing down the connection.
- **Resume**: Re-evaluates node health and bandwidth limits. Only resumes participation (`active` state) if eligible.
- **Reconnection**: Reconciles with the backend persistent state to ensure no duplicate sessions exist for the node.
