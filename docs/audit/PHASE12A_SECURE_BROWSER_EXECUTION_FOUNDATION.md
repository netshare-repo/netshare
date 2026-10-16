# Phase 12A — Secure browser execution foundation

**Status: backend contract foundation only. Browser execution is unavailable.**

`BROWSER_PAGE_INSPECT_ENABLED=false` is the default in `.env.example`. A separate code-side readiness latch is also closed because the Android browser executor, complete subresource egress enforcement, and screenshot artifact store are not implemented. Setting the environment flag alone cannot advertise or dispatch this service. No device/browser execution or ad verification was performed.

## Android routing assessment

The existing Android `AuthorizedTaskRequest` allowlist accepts the three established testing services and `PUBLIC_DATA_FETCH`; it rejects `BROWSER_PAGE_INSPECT`. The VPN service installs routes for the authorized target IPs and task subnet, and its TUN TCP forwarder checks each packet against `allowedTargetIps` and the single `authorizedPort`. It deliberately installs no default route. That policy fits a single-host request but does not authorize the changing set of hosts used by a rendered page's images, stylesheets, fonts, and other resources.

An Android WebView is not a secure route by itself. Android's VPN documentation describes routing app traffic through the VPN interface according to installed routes; it does not imply that this task-scoped TUN has authorized every browser resource destination. WebView's `shouldInterceptRequest` callback has coverage limits: it does not cover `javascript:` or `blob:` URLs, and for redirects it reports the initial URL rather than each subsequent URL. Service-worker traffic has a separate callback API. Returning no response from an interceptor permits WebView's normal loader to handle the request, which is not an acceptable fail-open behavior here.

**Decision:** do not execute a page in Phase 12A. A later Android phase must first implement an isolated browser request broker that validates, resolves, pins, and routes every HTTPS resource through an explicit task-scoped authorization path, including redirects and service workers, with a deny-by-default egress boundary that prevents Chromium fallback to the physical network. If that cannot be enforced and measured, the task must fail before navigation. A simple WebView wrapper or one-host TUN route is insufficient. The browser should have JavaScript, cookies, storage, credentials, downloads, pop-ups, arbitrary navigation, and client-supplied scripts disabled. Rendering is limited to the requested top-level page and bounded passive resource loading; it is not general browser automation.

Platform references: [Android VPN guide](https://developer.android.com/develop/connectivity/vpn), [WebViewClient request interception](https://developer.android.com/reference/android/webkit/WebViewClient), [ServiceWorkerClient](https://developer.android.com/reference/android/webkit/ServiceWorkerClient), and [WebSettings](https://developer.android.com/reference/android/webkit/WebSettings).

## Backend contract v1

The new `BROWSER_PAGE_INSPECT` service is separate from the existing testing services. It is one GET execution for a public HTTPS target on port 443. The task accepts a target URL, target region, and bounded options: viewport width 320–1920, height 320–2160, device scale factor 1/1.5/2, load timeout 1–20 seconds, extracted text at most 32 KiB, and optional screenshot capture. Unknown fields, arbitrary headers, cookies, scripts, and execution counts other than one are rejected.

The DataChannel task envelope retains the existing task/session identity fields and adds `browserPageInspect` with contract version 1, viewport and time/text limits, resource budget (64 resources and 8 MiB total), `credentials: omit`, and explicit script/resource/redirect policies. The result is the existing `task_result` envelope with a version-1 result object containing final URL, HTTP status, page title, viewport, bounded UTF-8 text and byte count, resource counts, transfer/TTFB/load/total timing metrics, and a nullable bounded error. A successful final URL must pass the existing public target DNS/SSRF validation and remain on the authorized origin. Results bind task, route, node, and region. Browser content is persisted only in the bounded `TaskResult.browserPageInspect` subdocument; generic `resultData` contains summary metadata, not extracted page text.

Screenshot metadata is an opaque 128-bit artifact ID, PNG MIME type, byte length (maximum 2 MiB), and SHA-256 digest. The backend rejects every artifact unless an injected registry verifier confirms its task, routing-session, node, size, and digest binding. The default verifier rejects all references. This phase does not create upload or download endpoints and does not accept DataChannel image bytes.

## Screenshot storage design for a later phase

Use private object storage, never a public bucket. The backend should mint a one-use upload grant scoped to task, node, routing session, content type, and maximum size; verify the uploaded PNG's actual format, dimensions, length, and digest; and register its opaque ID in a database record bound to the task owner and node. Encrypt the object, apply a short documented retention period, and delete it on expiry or task deletion. Retrieval must authorize the task owner (or an audited administrator), stream from private storage or issue a short-lived read grant, set `Content-Type: image/png`, `X-Content-Type-Options: nosniff`, and force download where appropriate. Upload/retrieval lifecycle, malware/content scanning policy, and retention configuration remain unimplemented and are Phase 12B+ gates.

## Security and settlement

- The target reuses the `PUBLIC_DATA_FETCH` public HTTPS/443 validator, including credential, IP-literal, internal hostname, DNS/private-address, and credential-like query restrictions. Redirects are limited to the original origin and revalidated. This validates the submitted target and reported final URL; it is **not** proof that Android intercepted every browser subresource.
- Request/result schemas reject unrecognized fields; client JavaScript, auth headers, cookies, arbitrary browser actions, and credential injection are unsupported.
- Resource count, transferred bytes, text bytes, screenshot bytes, viewport, timeout, metadata lengths, timestamps, status codes, and task/session/node identity are bounded and checked.
- Task allocation and settlement continue through the existing queue, routing session, and transactional exactly-once settlement path. The result remains unique per task/node; duplicate results do not repeat rewards.
- Feature availability requires both `BROWSER_PAGE_INSPECT_ENABLED=true` and the code-side Android readiness latch. The latch is `false` in this phase, so API capability remains false and submission/dispatch are rejected.

## Files changed

- `netshare-backend/services/browserPageInspectService.js` — v1 contract, bounds, target/result validation, identity checks, screenshot registry verification seam, and closed readiness latch.
- `netshare-backend/models/TestingTask.js`, `netshare-backend/models/TaskResult.js` — separate task options and bounded result metadata.
- `netshare-backend/config/env.js`, `netshare-backend/.env.example` — separate disabled-by-default flag.
- `netshare-backend/controllers/taskController.js`, `netshare-backend/services/secureTaskRoutingService.js`, `netshare-backend/services/taskSettlementService.js` — capability gate, rejected submission/dispatch while unready, versioned envelope validation, and transactional bounded persistence.
- `netshare-backend/tests/phase11aPublicDataFetch.test.js` — browser schema/security/readiness tests.
- `netshare-backend/tests/phase12aBrowserPageInspectSettlement.test.js` — isolated database duplicate settlement/debit/reward test.
- `docs/changes/PHASE12A_BROWSER_PAGE_INSPECT_SRS_PROPOSAL.md` — proposed requirements and acceptance gates.
- `docs/audit/IMPLEMENTATION_STATUS.md` — current phase status.

## Validation and remaining blockers

The focused browser/public-fetch/settlement suite passed **18/18 tests**. The full backend regression passed **251/251 tests across 18 files** against an isolated MongoDB replica set. Both ran with `PUBLIC_DATA_FETCH_ENABLED=false` and `BROWSER_PAGE_INSPECT_ENABLED=false`; a runtime check also confirmed the effective browser capability is false. Browser execution, browser subresource network enforcement, artifact storage/retrieval, React/Flutter UI, ad verification, physical-device testing, and production availability are intentionally not claimed. Do not open the readiness latch until the Android implementation proves deny-by-default routing for every network resource and the private artifact lifecycle is deployed and tested.
