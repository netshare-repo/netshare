import test from "node:test";
import assert from "node:assert/strict";
import {
  browserScreenshotPath,
  isBrowserPageInspectEnabled,
  prepareBrowserPageInspectResult,
  validScreenshotReference,
} from "../src/pages/client/browserPageInspectView.js";

const goodResult = (overrides = {}) => ({
  contractVersion: 1,
  finalUrl: "https://example.com/page",
  httpStatus: 200,
  pageTitle: "Example",
  viewport: { width: 1365, height: 768, deviceScaleFactor: 1 },
  textContent: "<script>must remain text</script>",
  textSizeBytes: new TextEncoder().encode("<script>must remain text</script>").length,
  resourceCount: 4,
  blockedResourceCount: 1,
  transferredBytes: 1234,
  ttfbMs: 20,
  pageLoadTimeMs: 1500,
  totalTimeMs: 1700,
  executedAt: "2026-10-15T00:00:00.000Z",
  ...overrides,
});

test("browser capability is opt-in from the authenticated backend response", () => {
  assert.equal(isBrowserPageInspectEnabled({}), false);
  assert.equal(isBrowserPageInspectEnabled({ browserPageInspectEnabled: false }), false);
  assert.equal(isBrowserPageInspectEnabled({ browserPageInspectEnabled: true }), true);
});

test("valid results are plain text and preserve metadata for the viewer", () => {
  const view = prepareBrowserPageInspectResult(goodResult(), true);
  assert.equal(view.state, "ready");
  assert.equal(view.text, "<script>must remain text</script>");
  assert.equal(view.metrics.httpStatus, 200);
});

test("missing, failed, invalid and oversized results have explicit states", () => {
  assert.equal(prepareBrowserPageInspectResult(null, true).state, "missing");
  assert.equal(prepareBrowserPageInspectResult({ error: "route unavailable" }, false).state, "failed");
  assert.equal(prepareBrowserPageInspectResult(goodResult({ finalUrl: "javascript:alert(1)" }), true).state, "invalid");
  assert.equal(prepareBrowserPageInspectResult(goodResult({ textContent: "x".repeat(32769), textSizeBytes: 32769 }), true).state, "invalid");
  assert.equal(prepareBrowserPageInspectResult(goodResult({ resourceCount: 2, blockedResourceCount: 3 }), true).state, "invalid");
});

test("screenshot references are opaque metadata and build only the owner endpoint path", () => {
  const ref = { artifactId: "a".repeat(32), contentType: "image/png", sizeBytes: 100, sha256: "b".repeat(64) };
  assert.equal(validScreenshotReference(ref), true);
  assert.equal(validScreenshotReference({ ...ref, sizeBytes: 2 * 1024 * 1024 + 1 }), false);
  assert.equal(browserScreenshotPath("0123456789abcdef01234567", ref.artifactId), `/tasks/0123456789abcdef01234567/browser-artifacts/${ref.artifactId}`);
  assert.throws(() => browserScreenshotPath("../private", ref.artifactId));
  assert.throws(() => browserScreenshotPath("0123456789abcdef01234567", "../../file"));
});

test("an invalid persisted artifact makes the browser result unavailable", () => {
  const view = prepareBrowserPageInspectResult(goodResult({ screenshotArtifact: { storagePath: "secret/path" } }), true);
  assert.equal(view.state, "invalid");
});
