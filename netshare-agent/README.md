# Retired desktop daemon / integration-test helpers

The legacy Socket.IO execution daemon is retired. `node agent.js` exits with status 1 without connecting or executing tasks. Production routing uses the Android client's authorized WebRTC DataChannel and VpnService/TUN path; Socket.IO is signaling and telemetry only.

The modules in `src/` are retained for explicit backend integration/security fixtures, including the desktop peer in `scripts/rcValidation.mjs`. They do not certify Android TUN, residential egress, NAT traversal or device lifecycle behavior. HTTP probe failures are availability observations, not packet-loss measurements.
