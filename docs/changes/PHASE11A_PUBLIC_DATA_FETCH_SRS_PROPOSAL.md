# SRS change proposal: Public Data Fetch (Phase 11A)

**Status:** Proposed. The official `NETSHARE_SRS.md` requirements and the Chapter 3 architecture are unchanged. The backend foundation is disabled by default and the service is not yet available to clients.

## Proposed requirement

Add a distinct `PUBLIC_DATA_FETCH` task type to FR7.2 and FR8.3, subject to SEC-1, SEC-2 and SEC-5. A verified Platform Client may request one authorized public HTTPS GET through an assigned, consenting Android node and receive a bounded JSON, HTML source or plain text body. This is a content retrieval service, separate from the existing reachability, performance and localization testing services. The backend remains the authorization, routing and settlement control plane; it must not fetch the target on behalf of the node.

## Proposed acceptance criteria

1. An explicit deployment flag gates creation and dispatch. It defaults to off. Product UI and service availability must remain hidden until Android execution and end-to-end acceptance are complete.
2. The request uses HTTPS port 443, GET, no credentials or cookies, no custom request headers, one execution, and the existing target authorization. Private, loopback, link-local, metadata and internal network destinations are rejected. Node DNS resolution and every redirect must be revalidated against the authorized origin and port before network access; redirects outside the same HTTPS origin are rejected.
3. The Android node executes the request through the existing authorized DataChannel/VpnService route. It must not silently fall back to a direct or backend-side fetch.
4. The node returns at most 16,384 UTF-8 bytes with a media type of `application/json`, `text/html` or `text/plain`. An unsupported type or larger body fails the task without returning a truncated preview. Request credentials, cookies, custom authorization headers and response headers are not accepted as structured fields.
5. A versioned `task_request`/`task_result` extension retains the WebRTC outer envelope v1. The backend checks task, node and routing session identity, version, final URL, status, content type, byte count and timing metrics before accepting content.
6. A result is stored once per task and the existing transactional wallet settlement and idempotency constraints remain intact. A failed or rejected response earns no node reward. Existing task detail authorization permits the owner, administrator and assigned node to view a result; any future HTML display must escape or sandbox it.

## Scope and decision needed

Phase 11A adds only backend schema, validation, contract, tests and documentation. Android DataChannel handling, request execution, product UI and production rollout are later phases. Approve the SRS change and Android acceptance plan before exposing this service.
