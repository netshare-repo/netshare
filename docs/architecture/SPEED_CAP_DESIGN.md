# Speed Cap Design

This document outlines the architecture and design of speed capabilities and limitations within the NetShare client agents.

## Throttling Mechanism

- **Desktop Node.js Agent**: Implements application-level HTTP throttling. This is achieved using delayed chunk reading combined with a configurable byte-rate limiter.
- **Flutter Android Agent**: Follows the same application-level approach. The Dart HTTP client applies rate limiting during stream processing.
- **Scope limitation**: Throttling is strictly **application-level**. We do NOT perform OS/network-level traffic shaping.

## Accuracy & Caveats

- **Best-effort accuracy**: Actual throughput may be slightly below the configured cap due to chunk granularity and event loop scheduling.
- **Short transfers**: If a transfer duration is `< 500ms`, the throughput measurement is considered unreliable and will be reported as `null`.

## Future Considerations

- **VpnService (Android)**: Future implementations utilizing Android's `VpnService` will require a fundamentally different enforcement mechanism at the network layer.

## Configuration & Reporting

- **Configuration**:
  - `configuredUploadCapMbps` and `configuredDownloadCapMbps` are defined by the user and stored on the `NodeDevice` model.
- **Reporting**:
  - `measuredUploadMbps` and `measuredDownloadMbps` are calculated by the agent and reported back to the backend after each task completes.
