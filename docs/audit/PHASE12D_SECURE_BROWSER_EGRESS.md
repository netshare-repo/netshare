# Phase 12D — Secure browser egress

**Date:** 2026-10-15  
**Status:** audit and fail-closed regression coverage complete; native Chromium egress containment is **BLOCKED**.  
**Availability:** `BROWSER_PAGE_INSPECT_ENABLED=false`; backend readiness and Android rendering latches remain false. Physical Android validation is deferred.

## Audited Android path

`NetShareVpnService.startTunnel` (`Netshare/netshare_node_app/android/app/src/main/kotlin/com/example/netshare_node_app/NetShareVpnService.kt`) includes only the NetShare app with `addAllowedApplication(packageName)`, installs the task subnet plus explicit public IPv4 `/32` routes, and intentionally omits an IPv4 default route and IPv6 routes. It does not configure a VPN DNS server. The TUN packet handler accepts IPv4 TCP only; its forwarder checks the destination against the task IP set and the one authorized port, then opens a protected/bound upstream TCP socket. Non-TCP packets arriving at the TUN are dropped. This is a narrow single-target forwarding path, not a browser-wide egress boundary.

The Android VPN API documents that applications outside an allowed-application list use networking as if the VPN were not running, and that routes define which destination prefixes are carried by the VPN. The current renderer would share the node app package and could create Chromium traffic for destinations not covered by the task `/32` routes. Such traffic is not proven to enter the TUN. A same-origin redirect can change addresses; third-party resources, WebSockets, service-worker fetches and prefetches can create additional flows; DNS may use the underlying network; IPv6 and HTTP/3/QUIC are not handled by the current TCP-only forwarder. WebView interception cannot repair this at the actual network boundary or prove that Chromium has no alternate network path.

Android API references: [VpnService.Builder](https://developer.android.com/reference/android/net/VpnService.Builder) and [Android VPN guide](https://developer.android.com/develop/connectivity/vpn).

## Enforcement decision

No new VPN routes, broad default route, WebView hooks, or direct request fallback were added. A default route for the existing node app would capture control-plane/WebRTC and existing task sockets under the same app identity, while its current TUN only supports authorized TCP forwarding. Exempting those sockets without a complete per-socket Chromium integration would create a bypass and could regress existing services. The current API has no app-controlled OS firewall/lockdown facility that can guarantee that every Chromium flow is blocked when the VPN is absent, interrupted, or lacks a matching route.

The already-present protections remain operative: the Android browser task branch does not start the VPN, perform DNS, instantiate WebView, or open a socket; `browserPageInspectNetworkedRenderingAvailable` is a compile-time false; and the backend feature flag and readiness latch remain closed. `BrowserResourceBroker` still validates same-origin HTTPS, public IPv4 DNS answers and task-installed IPs as a future policy layer, but that policy model is not asserted to contain Chromium at the OS network boundary.

## Required secure architecture

Before enabling browser traffic, isolate rendering behind a boundary that can deny by default independently of WebView callbacks. Acceptable directions for a later design review are a platform-managed isolated browser identity with an OS-enforced lockdown VPN/firewall and explicit task destination policy, or a separately sandboxed renderer whose network namespace/firewall authorizes only broker-pinned destinations. The selected design must include DNS, IPv4/IPv6, TCP/UDP, redirects, subresources, service workers, WebSockets, QUIC, cancellation, quotas, and VPN-loss behavior. If the boundary cannot capture and deny a flow, the renderer must not launch. Any chosen design requires physical-device route-loss/fallback verification in the deferred final testing phase.

## Changes and tests

- `Netshare/netshare_node_app/test/browser_page_inspect_test.dart`: expanded the no-egress regression to exercise every browser resource class (navigation, redirect, subresource, service worker) and prove the broker rejects each before DNS when native task egress is unavailable.
- No production routing code was changed because the current VPN architecture cannot safely contain Chromium without changing the network isolation model for all traffic in the shared Android app identity.
- Existing tests continue to cover same-origin policy, third-party redirect/resource rejection, private or changed DNS answers, DNS timeout, cancellation, node binding, and failure before network activity. Automated Dart tests do not establish physical Chromium/TUN containment.

## Validation

- Focused browser egress tests: **8/8 PASS**.
- Full Flutter tests: **97/97 PASS**.
- `flutter analyze`: **PASS**, no issues found.
- Android arm64 debug APK: **PASS** at `Netshare/netshare_node_app/build/app/outputs/flutter-apk/app-debug.apk`.
- Backend regression: **259/259 PASS across 19 files** on a fresh database in the local `netshareLocalRs` replica set, with `PUBLIC_DATA_FETCH_ENABLED=false` and `BROWSER_PAGE_INSPECT_ENABLED=false`.
- An initial backend run against the shared development database had one pre-existing `phase9Identity.test.js` fixture collision (four matching legacy phone records where the fixture expects two); it did not alter the database. The isolated full regression above passed.

No browser request was sent. No physical phone was used. Existing task types, routing behavior, settlement, UI, and payment logic were not changed.

## Readiness

**BLOCKED.** Keep `BROWSER_PAGE_INSPECT_ENABLED=false` and all readiness latches closed. The remaining gates are an independently enforceable deny-by-default renderer egress boundary and deferred physical-device route-loss/fallback verification. Ad Verification remains out of scope.
