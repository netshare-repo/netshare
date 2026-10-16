# Phase 11C — Public Data Fetch client UI

**Status:** Client integration complete; the service remains unavailable while `PUBLIC_DATA_FETCH_ENABLED=false`.

## Scope and behavior

- Added authenticated `GET /api/tasks/capabilities`, returning the explicit `publicDataFetchEnabled` capability. React and Flutter require that value to be exactly `true` before enabling the Public Data Fetch submission option. A capability request failure leaves the option unavailable.
- Kept existing task URL, region, estimate, and submit APIs. Public Data Fetch submissions are constrained in the client to HTTPS on port 443 and one execution; the backend remains authoritative and keeps its existing flag, URL, DNS, SSRF, redirect, authorization, and settlement checks.
- Added React and Flutter views for the persisted `TaskResult.publicFetch` document returned by the existing owner-authorized task detail API. The clients do not perform a fetch or synthesize result data.
- JSON is parsed and pretty-printed as text. HTML source and plain text are displayed only as text (`<pre>` in React and `SelectableText` in Flutter). No fetched HTML is inserted as markup or opened in a WebView.
- Both clients show recorded HTTP status, content type, response size, final URL, target and node regions, source node, execution timestamp, response timing, measured task metrics, and recorded errors. Empty, missing, unsupported, inconsistent, oversized, and failed results have explicit states.
- Copy is available for readable content. Downloads use text-safe MIME types; HTML files use an `.html.txt` extension. Android document export accepts only `text/plain` for these results. CSV report behavior is unchanged.
- The feature is not production-enabled. `netshare-backend/.env.example` retains `PUBLIC_DATA_FETCH_ENABLED=false`; the runtime capability also defaults false unless explicitly enabled.

## Files changed for Phase 11C

- Backend: `controllers/taskController.js`, `routes/taskRoutes.js`, `middleware/securityMiddleware.js`, `tests/phase11aPublicDataFetch.test.js`, and `tests/phase8.test.js`.
- React: `src/pages/client/SubmitTask.jsx`, `src/pages/client/TaskDetails.jsx`, `src/pages/client/TaskDetails.css`, `src/pages/client/publicDataFetchView.js`, `tests/publicDataFetchView.test.js`, and `package.json`.
- Flutter: `lib/services/client_api.dart`, `lib/screens/client/submit_task_screen.dart`, `lib/screens/client/task_details_screen.dart`, `lib/services/mobile_document_service.dart`, `lib/widgets/public_data_fetch_result_view.dart`, `android/app/src/main/kotlin/com/example/netshare_node_app/MainActivity.kt`, and `test/public_data_fetch_client_test.dart`.
- The admin dashboard and admin data page also received small existing lint fixes needed for a clean repository-wide frontend lint run.

## Security and validation

- The task detail API retains its existing client ownership check; a regression assertion verifies that a different client receives HTTP 403.
- UI result validation enforces the 16 KiB UTF-8 byte bound, persisted byte-count agreement, successful HTTP status, supported JSON/HTML/plain-text media types, and UTF-8-only charset declarations.
- Fetched HTML is treated as untrusted source at display, copy, and download. The React view renders it as a text child; the Flutter view uses `SelectableText`; both downloads are forced to plain text.
- No WebRTC, VpnService, Android executor, or wallet settlement implementation was changed in this phase. Existing polling, CSV report, rating, and settlement paths remain in place.

## Verification

See the Phase 11C test results recorded in `IMPLEMENTATION_STATUS.md`. Validation includes the full backend suite, React helper tests/build/lint, full Flutter suite and analysis, and Android arm64 debug build.

Physical Android execution and end-to-end settlement are **not claimed as passed**. Phase 11B records that no Android device was attached; those checks remain blocked pending device availability. Keep the feature flag disabled until that acceptance is completed.
