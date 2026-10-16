# SRS change proposal — `BROWSER_PAGE_INSPECT` v1

**Proposal only.** This phase adds a disabled backend contract foundation. It does not revise the approved SRS or authorize production execution.

## Proposed capability

Add `BROWSER_PAGE_INSPECT` as a task service independent of accessibility, performance, localization, and `PUBLIC_DATA_FETCH`. A task performs exactly one authorized HTTPS GET against a public host on port 443 and returns bounded rendered-page metadata. It does not accept client JavaScript, credentials, cookies, arbitrary headers, downloads, pop-ups, or general browser automation.

## Request

The task request identifies the existing task, routing session, node assignment, target URL, and target region. Its version-1 browser options contain viewport dimensions and scale, a 1–20 second page-load timeout, a 0–32 KiB text limit, and a screenshot-capture boolean. Server authorization fixes the method to GET, credentials to omit, resource ceiling to 64 resources / 8 MiB, and screenshot ceiling to 2 MiB. Unknown fields are invalid.

## Result

The existing `task_result` envelope carries contract version 1 and the task, routing-session, node, and region identities. A successful result includes final URL, HTTP status, title, viewport, bounded extracted text and UTF-8 byte length, resource/blocked-resource counts, transferred bytes, TTFB, page-load and total timings, and optional screenshot artifact metadata. Failed results carry bounded errors and no page content or artifact. The backend validates and persists the dedicated result subdocument using the existing exactly-once transactional settlement.

## Security and availability requirements

Validate the submitted URL, resolved IPs, redirects, and every subresource destination. Only public HTTPS/443 is allowed. Reject private, loopback, link-local, metadata, internal, credential-bearing, or otherwise unvalidated destinations. Browser execution must fail closed if any resource request can bypass the authorized task route. Disable scripts, cookies, storage, credentials, arbitrary actions, and unrestricted navigation. Bind screenshots to task, session, node, owner, content type, digest, and byte limit in private storage; serve them only after owner/admin authorization.

In Phase 12A, all browser execution is unavailable because the Android resource-routing boundary and screenshot service do not exist. The environment flag defaults false and a separate code-side readiness latch prevents accidental enablement. The capability may be enabled only after Android routing and private artifact lifecycle acceptance tests pass.

## Acceptance gates for a future execution phase

1. Demonstrate every top-level and subresource request, redirect, and service-worker request is authorized, DNS checked/pinned, and routed through the assigned node's task-scoped egress path.
2. Demonstrate fail-closed behavior when request interception or TUN authorization is unavailable; prove there is no physical-network fallback.
3. Verify cookies, scripts, credentials, non-HTTPS schemes, unsafe redirects/IPs, resource/byte/time limits, and cancellation are rejected.
4. Verify screenshot upload validation, task/session/node ownership, private retrieval, expiry, and deletion.
5. Verify actual Android result identity and exactly-once debit/reward through the existing settlement path.
6. Keep production capability unavailable until these gates and the project's final device testing are approved.
