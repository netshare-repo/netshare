# Phase 12F — Browser egress solution

**Date:** 2026-10-15  
**Status:** architecture selected; Android prototype **BLOCKED** pending an isolated managed-profile test environment and physical Android verification.  
**Availability:** `BROWSER_PAGE_INSPECT_ENABLED=false`; backend readiness and Android network-rendering latches remain false. Physical device testing is deferred.

## Findings from the current implementation

The existing `NetShareVpnService` belongs to the same Android package and profile as the Flutter node app. For each authorized task it adds the NetShare package to the VPN, installs the task subnet and explicit IPv4 `/32` target routes, and forwards IPv4 TCP only to the authorized address and port. It has no default route, IPv6 route, or VPN DNS configuration. It protects/binds upstream sockets to avoid routing loops. WebRTC signaling, control traffic, and the existing HTTP executor share this app identity and VPN lifecycle.

The browser executor deliberately stops before DNS, VPN startup, WebView creation, or socket activity. The browser resource broker is a policy model, not a Chromium network boundary. Widening the current app's routes or reusing the task TUN for WebView would risk capturing WebRTC and existing task traffic while leaving IPv6, DNS, UDP/QUIC, and browser subprocess routing unproven. The existing fail-closed behavior is retained.

## Architecture comparison

| Approach | Isolation and outage behavior | DNS, IPv6, UDP and browser processes | Compatibility / integration | Decision |
|---|---|---|---|---|
| WebView inside the node app with request callbacks | Same app identity and no independent network boundary; callbacks cannot stop unobserved sockets from using a physical network | Does not establish coverage of DNS, IPv6, QUIC, service workers, WebSockets, or Chromium's isolated renderer | Lowest code change, but overlaps existing WebRTC and task VPN | Reject |
| Full-tunnel VPN for the existing node app | A full route would affect the whole app identity; app code cannot itself guarantee lockdown when the service is revoked or stopped | Could carry IPv4/IPv6 and UDP only after a new packet engine is implemented; current TUN is IPv4 TCP only | Competes with existing per-task routes and can disrupt current HTTP/WebRTC flows | Reject |
| Separate browser APK with ordinary per-app VPN | App allowlisting separates package traffic, but without always-on lockdown an unavailable VPN can leave normal Android networking available | Browser host and isolated renderer UID behavior must be measured; DNS/IPv6/UDP need explicit full-route handling | One active VPN service per Android user/profile; using the same profile would conflict with the node VPN | Insufficient by itself |
| **Managed-profile browser APK + dedicated always-on lockdown VPN and native egress broker** | Separate Android work profile has its own VPN; profile-owner policy can make the VPN always-on with lockdown. Only the dedicated browser app is admitted to that VPN; all captured packets default-deny unless they use the task broker | Full IPv4 and IPv6 routes capture direct flows; DNS and UDP/QUIC are denied or explicitly brokered; the broker resolves, validates, pins and limits destinations. Host and Chromium renderer UID routing still require device proof | Android Enterprise/profile-owner provisioning and a companion app/task handoff are required; this does not replace or reconfigure the personal-profile node VPN | **Selected target architecture; prototype blocked pending device test** |
| Remote sandboxed Chromium over a node egress tunnel | Server-side network namespace/firewall can enforce egress; Android only maintains an authenticated outbound tunnel | Central Chromium networking is measurable and can deny unsupported transports, but traffic/cookies/content are processed by server infrastructure | Changes execution location and requires an egress gateway; it does not render on the Android node | Fallback if managed-profile deployment is unavailable; product approval needed |

Android documents that each user or work profile can run its own VPN, while only one VPN service is active per user/profile. `VpnService.Builder.addAllowedApplication` can scope VPN use by installed package, but unlisted applications use normal system networking unless the profile's lockdown policy blocks traffic outside the VPN. Device/profile owners can set an always-on VPN and lockdown; an ordinary app cannot grant itself profile-owner authority. WebView's renderer is a separate sandboxed process on supported configurations, but Android's general WebView documentation does not prove how every OEM/version maps all renderer traffic to a per-app VPN. These are design inputs, not claims that the chosen architecture has been tested on NetShare devices.

References: [Android VPN guide](https://developer.android.com/develop/connectivity/vpn), [VpnService.Builder per-app filtering](https://developer.android.com/reference/android/net/VpnService.Builder#addAllowedApplication(java.lang.String)), [DevicePolicyManager always-on VPN](https://developer.android.com/reference/android/app/admin/DevicePolicyManager#setAlwaysOnVpnPackage(android.content.ComponentName,java.lang.String,boolean)), [WebView renderer process](https://developer.android.com/develop/ui/views/layout/webapps/manage-webview-memory).

## Selected design and enforcement contract

The on-device design is a separate browser APK installed in a dedicated managed work profile with a profile-scoped VPN service. A profile-owner/DPC configures that service as always-on with lockdown. The browser task enters the profile only through a narrow authenticated task handoff bound to task, node, route session, and expiry. The normal node app and its WebRTC/DataChannel session remain in the personal profile on the existing narrow task routes.

The browser profile VPN uses a full IPv4 and IPv6 route so every direct browser flow reaches its TUN. The TUN is deny-by-default. Chromium is configured to use a local native request broker with no bypass rules. The broker is the only component allowed to open protected upstream sockets. It validates the active task grant and HTTPS port 443, performs DNS checks immediately before connecting, rejects every private/reserved/metadata answer, pins the chosen public address, limits connections/bytes/time, and revalidates every redirect and new resource authorization. The initial resource policy is same-origin only; a cross-origin request is denied unless the task grant explicitly authorizes that origin. WebSocket upgrades, if supported, pass through the same broker and limits. QUIC/UDP is blocked initially; no direct DNS is allowed from Chromium. IPv6 is routed into the TUN and denied unless the broker has equivalent IPv6 validation and pinning. Any packet not attributable to an active brokered task is dropped. VPN loss, profile removal, broker crash, proxy failure, or an uncovered renderer UID must produce a failed task with no direct network fallback.

WebView callbacks may supply resource URLs for authorization but are not enforcement. The proxy/TUN path must make callback omissions, direct sockets, alternate DNS, WebSockets, and QUIC fail closed. Do not enable `allowBypass`, do not install a device-wide VPN, do not add broad routes to the current node VPN, and do not allow the browser APK to choose an underlying network. A profile-owner policy is a deployment prerequisite and may make a separate managed profile impractical for some residential participants.

## Feasibility and prototype decision

Android provides the building blocks for this architecture, so isolated browser egress is technically plausible under a managed profile. It is **not yet feasible to claim containment or to safely prototype networked rendering in this workspace**: there is no profile-owner/DPC test profile or connected device, the current app has only a single-profile task VPN, and platform documentation does not certify WebView renderer UID routing, proxy behavior, DNS behavior, or OEM VPN-loss behavior for this exact design. A synthetic broker test could verify application policy but would not close those platform gaps.

No code prototype, APK networking change, new VPN route, browser launch, backend change, or UI change was made. Existing browser no-network tests are the prototype boundary for this phase: they ensure unsupported browser requests fail before network activity. This follows the requirement to stop rather than add a workaround whose egress cannot be demonstrated. Existing task routing, WebRTC, wallet, allocation, settlement, and screenshot access behavior are unchanged.

## Implementation roadmap

1. Provision a disposable Android Enterprise managed profile on supported API levels and OEM builds; record the DPC/profile-owner setup and permitted app-install workflow.
2. Build a separate browser APK and profile VPN/broker module. Define signed, short-lived task grants and an authenticated, one-task IPC handoff from the node app. Keep both browser flags disabled.
3. Add unit and instrumentation tests for host and isolated-renderer UIDs, all-route capture, direct socket attempts, DNS/DoH, IPv4/IPv6, redirects, third-party resources, service workers, WebSockets, QUIC, size/time budgets, cancellation, profile switching, VPN revocation, tunnel loss, process death, and no fallback.
4. On physical devices, capture TUN counters and network traces at the device and controlled endpoints. Prove that only broker-authorized destinations receive traffic and that a VPN/profile failure cannot reach the physical network. Repeat across supported Android versions and OEMs.
5. Only after evidence passes, complete screenshot artifact lifecycle/deployment work, activate backend readiness and feature flags in a controlled environment, then run the full task-to-persisted-result/settlement E2E. Keep Ad Verification out of scope until this gate is approved.

If NetShare cannot require a dedicated managed profile for node participants, use the remote sandboxed Chromium plus authenticated node egress-tunnel alternative. That path needs product and privacy approval because the page is rendered in server infrastructure, and requires a separately audited egress gateway. Do not silently substitute it for Android execution.

## Validation

- Source audit: current Android manifest, `NetShareVpnService`, `AuthorizedTaskRequest`, WebRTC dispatch, `BrowserPageInspectExecutor`, and Phase 12A–12E audit documents reviewed.
- Browser-focused Flutter regression: **8/8 PASS**.
- Full Flutter suite: **100/100 PASS**; `flutter analyze`: **PASS**, no issues found.
- Android arm64 debug APK: **PASS** at `Netshare/netshare_node_app/build/app/outputs/flutter-apk/app-debug.apk`.
- `BROWSER_PAGE_INSPECT_ENABLED=false` remains the documented backend default, and the Android network-rendering latch is compile-time false.
- No physical device, managed profile, Chromium request, or production configuration was used. No backend capability was enabled. This phase does not claim browser execution or physical egress containment.

## Readiness

**BLOCKED.** Keep `BROWSER_PAGE_INSPECT_ENABLED=false` and all backend/Android readiness latches closed. Before Ad Verification, complete the managed-profile browser APK and broker, instrumentation and physical route-loss proof across the supported device matrix, production private screenshot storage, and full authorized task/result/settlement verification. Ad Verification remains out of scope.
