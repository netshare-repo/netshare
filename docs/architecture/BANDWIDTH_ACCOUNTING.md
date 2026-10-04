# Bandwidth Accounting

This document details how bandwidth consumption is measured, recorded, and presented across the NetShare system.

## Core Concepts

- **Internal Unit**: `bytes` (all internal storage and calculations use bytes).
- **What is measured**: Application-level HTTP payload.
- **NOT measured**: Wire-level overhead (TCP/IP headers, TLS negotiation, retransmissions).
- **Fields**:
  - `uploadedBytes`: Bytes sent from the agent.
  - `downloadedBytes`: Bytes received by the agent.
  - `totalBytes`: Total application bandwidth consumed (`uploadedBytes + downloadedBytes`).

## Display Conversions

When presenting bandwidth to the user, bytes are converted to KB, MB, or GB using standard binary prefixes (1 KB = 1024 bytes) with appropriate formatting rules (typically 2 decimal places).

## Accounting Mechanism

- **Per-Task Accounting**: The agent measures the exact `chunk.length` sums for requests and responses during task execution.
- **Billing Integration**: Billing and credit allocation use the `totalBytes` field extracted from the `TaskResult`.
- **Storage**:
  - The `BandwidthUsage` model stores per-task records.
  - `NodeDevice.totalUsedBytes` maintains a running total and is updated via atomic increments.
- **Daily Reset Semantics**: The system supports a configurable daily reset (default UTC midnight) which resets the `totalUsedBytes` for a node if configured. This requires explicit admin configuration.
