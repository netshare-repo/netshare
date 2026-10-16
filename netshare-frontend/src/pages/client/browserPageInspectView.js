export const BROWSER_PAGE_INSPECT = "BROWSER_PAGE_INSPECT";
export const BROWSER_MAX_TEXT_BYTES = 32 * 1024;
export const BROWSER_MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;

export function isBrowserPageInspectEnabled(capabilities) {
  return capabilities?.browserPageInspectEnabled === true;
}

export function validScreenshotReference(reference) {
  return Boolean(
    reference &&
      typeof reference === "object" &&
      /^[a-f0-9]{32}$/.test(reference.artifactId || "") &&
      reference.contentType === "image/png" &&
      Number.isInteger(reference.sizeBytes) &&
      reference.sizeBytes > 0 &&
      reference.sizeBytes <= BROWSER_MAX_SCREENSHOT_BYTES &&
      /^[a-f0-9]{64}$/.test(reference.sha256 || "")
  );
}

export function browserScreenshotPath(taskId, artifactId) {
  if (!/^[a-f\d]{24}$/i.test(String(taskId)) || !/^[a-f0-9]{32}$/.test(String(artifactId))) {
    throw new Error("Invalid screenshot reference");
  }
  return `/tasks/${encodeURIComponent(taskId)}/browser-artifacts/${encodeURIComponent(artifactId)}`;
}

const isBoundedMetric = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;

export function prepareBrowserPageInspectResult(browser, success) {
  if (!browser || typeof browser !== "object") {
    return { state: success ? "missing" : "failed", error: "No browser result was recorded." };
  }
  const metrics = {
    httpStatus: browser.httpStatus,
    pageLoadTimeMs: browser.pageLoadTimeMs,
    ttfbMs: browser.ttfbMs,
    totalTimeMs: browser.totalTimeMs,
    resourceCount: browser.resourceCount,
    blockedResourceCount: browser.blockedResourceCount,
    transferredBytes: browser.transferredBytes,
  };
  if (!success) {
    return { state: "failed", error: typeof browser.error === "string" ? browser.error : "Page inspection failed.", browser, metrics };
  }
  const text = browser.textContent;
  let finalUrl = null;
  try { if (typeof browser.finalUrl === "string") finalUrl = new URL(browser.finalUrl); } catch { /* Invalid persisted URL is rejected below. */ }
  const textBytes = typeof text === "string" ? new TextEncoder().encode(text).length : -1;
  const viewport = browser.viewport;
  const valid = browser.contractVersion === 1 && finalUrl?.protocol === "https:" &&
    !finalUrl.username && !finalUrl.password && (!finalUrl.port || finalUrl.port === "443") &&
    Number.isInteger(browser.httpStatus) && browser.httpStatus >= 200 && browser.httpStatus < 300 &&
    typeof browser.pageTitle === "string" && browser.pageTitle.length <= 512 &&
    typeof text === "string" && textBytes <= BROWSER_MAX_TEXT_BYTES && browser.textSizeBytes === textBytes &&
    viewport && Number.isInteger(viewport.width) && viewport.width >= 320 && viewport.width <= 1920 &&
    Number.isInteger(viewport.height) && viewport.height >= 320 && viewport.height <= 2160 &&
    [1, 1.5, 2].includes(viewport.deviceScaleFactor) &&
    isBoundedMetric(browser.pageLoadTimeMs, 20000) && isBoundedMetric(browser.ttfbMs, 30000) &&
    isBoundedMetric(browser.totalTimeMs, 30000) && isBoundedMetric(browser.resourceCount, 64) &&
    isBoundedMetric(browser.blockedResourceCount, browser.resourceCount) &&
    isBoundedMetric(browser.transferredBytes, 8 * 1024 * 1024);
  if (!valid) return { state: "invalid", error: "Stored browser result is invalid or outside its v1 limits.", browser, metrics };
  if (browser.screenshotArtifact != null && !validScreenshotReference(browser.screenshotArtifact)) {
    return { state: "invalid", error: "Stored screenshot reference is invalid.", browser, metrics };
  }
  return { state: "ready", browser, metrics, text, screenshot: browser.screenshotArtifact || null };
}
