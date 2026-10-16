import { validatePublicDataFetchTarget } from './publicDataFetchService.js';

export const BROWSER_PAGE_INSPECT = 'BROWSER_PAGE_INSPECT';
export const BROWSER_PAGE_INSPECT_VERSION = 1;
// Phase 12A deliberately ships no Android browser executor or enforced
// subresource egress path. Keep this code-side latch closed until a later
// phase implements and verifies that execution path; setting the env flag
// alone must never advertise or dispatch a browser task.
export const BROWSER_PAGE_INSPECT_EXECUTION_READY = false;
export const isBrowserPageInspectAvailable = featureEnabled =>
  featureEnabled === true && BROWSER_PAGE_INSPECT_EXECUTION_READY;
export const BROWSER_PAGE_INSPECT_MAX_TEXT_BYTES = 32 * 1024;
export const BROWSER_PAGE_INSPECT_MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;
export const BROWSER_PAGE_INSPECT_MAX_RESOURCES = 64;
export const BROWSER_PAGE_INSPECT_MAX_TOTAL_BYTES = 8 * 1024 * 1024;
export const BROWSER_PAGE_INSPECT_DEFAULTS = Object.freeze({
  viewport: Object.freeze({ width: 1365, height: 768, deviceScaleFactor: 1 }),
  pageLoadTimeoutMs: 15000,
  maxTextBytes: BROWSER_PAGE_INSPECT_MAX_TEXT_BYTES,
  captureScreenshot: true,
});

const reject = (message, code = 'INVALID_BROWSER_PAGE_INSPECT') =>
  Object.assign(new Error(message), { code });
const submissionFields = new Set([
  'targetUrl', 'serviceType', 'targetRegion', 'executionLimit', 'browserPageInspect',
]);
const optionsFields = new Set([
  'contractVersion', 'viewport', 'pageLoadTimeoutMs', 'maxTextBytes', 'captureScreenshot',
]);
const viewportFields = new Set(['width', 'height', 'deviceScaleFactor']);
const payloadFields = new Set([
  'contractVersion', 'serviceType', 'taskId', 'routingSessionId', 'nodeId', 'executedAt',
  'success', 'successRate', 'statusCode', 'latencyMs', 'bandwidthUsedMB',
  'uploadBandwidthMB', 'packetLoss', 'targetRegion', 'resultData',
]);
const resultFields = new Set([
  'schemaVersion', 'finalUrl', 'httpStatus', 'pageTitle', 'viewport', 'textContent',
  'textSizeBytes', 'screenshotArtifact', 'resourceCount', 'blockedResourceCount',
  'transferredBytes', 'ttfbMs', 'pageLoadTimeMs', 'totalTimeMs', 'error',
]);

const isIntegerInRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const byteLength = value => Buffer.byteLength(value, 'utf8');
const hasForbiddenControls = value => [...value].some(char => {
  const point = char.codePointAt(0);
  return point === 0 || (point < 32 && point !== 9 && point !== 10 && point !== 13);
});
const sanitizedError = value => value
  .replace(/([?&](?:token|api[_-]?key|password|secret|credential|signature|auth)[^=]*=)[^&#\s]+/gi, '$1[redacted]')
  .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]');

const normalizedOptions = options => {
  const input = options ?? {};
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !optionsFields.has(key)) ||
      input.contractVersion != null && input.contractVersion !== BROWSER_PAGE_INSPECT_VERSION) {
    throw reject('Invalid browser page inspection options');
  }
  const viewport = input.viewport ?? BROWSER_PAGE_INSPECT_DEFAULTS.viewport;
  if (!viewport || typeof viewport !== 'object' || Array.isArray(viewport) ||
      Object.keys(viewport).some(key => !viewportFields.has(key))) {
    throw reject('Invalid browser viewport configuration');
  }
  const normalizedViewport = {
    width: viewport.width ?? BROWSER_PAGE_INSPECT_DEFAULTS.viewport.width,
    height: viewport.height ?? BROWSER_PAGE_INSPECT_DEFAULTS.viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor ?? BROWSER_PAGE_INSPECT_DEFAULTS.viewport.deviceScaleFactor,
  };
  if (!isIntegerInRange(normalizedViewport.width, 320, 1920) ||
      !isIntegerInRange(normalizedViewport.height, 320, 2160) ||
      ![1, 1.5, 2].includes(normalizedViewport.deviceScaleFactor)) {
    throw reject('Viewport is outside the allowed dimensions');
  }
  const pageLoadTimeoutMs = input.pageLoadTimeoutMs ?? BROWSER_PAGE_INSPECT_DEFAULTS.pageLoadTimeoutMs;
  const maxTextBytes = input.maxTextBytes ?? BROWSER_PAGE_INSPECT_DEFAULTS.maxTextBytes;
  const captureScreenshot = input.captureScreenshot ?? BROWSER_PAGE_INSPECT_DEFAULTS.captureScreenshot;
  if (!isIntegerInRange(pageLoadTimeoutMs, 1000, 20000) ||
      !isIntegerInRange(maxTextBytes, 0, BROWSER_PAGE_INSPECT_MAX_TEXT_BYTES) ||
      typeof captureScreenshot !== 'boolean') {
    throw reject('Browser task limits are invalid');
  }
  return { viewport: normalizedViewport, pageLoadTimeoutMs, maxTextBytes, captureScreenshot };
};

export const validateBrowserPageInspectTarget = async targetUrl => {
  // Reuse the exact conservative public HTTPS/443, credential and DNS policy
  // already used by the separate PUBLIC_DATA_FETCH service.
  return validatePublicDataFetchTarget(targetUrl);
};

export const validateBrowserPageInspectSubmission = body => {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !submissionFields.has(key))) {
    throw reject('Unexpected browser inspection submission fields');
  }
  if (body.serviceType !== BROWSER_PAGE_INSPECT || body.executionLimit !== 1) {
    throw reject('Browser page inspection requires exactly one execution');
  }
  return normalizedOptions(body.browserPageInspect);
};

export const buildBrowserPageInspectRequest = (task, route) => {
  const options = normalizedOptions(task.browserPageInspect);
  return {
    contractVersion: BROWSER_PAGE_INSPECT_VERSION,
    serviceType: BROWSER_PAGE_INSPECT,
    taskId: String(task._id),
    routingSessionId: String(route._id),
    targetUrl: task.targetUrl,
    targetRegion: task.targetRegion,
    method: 'GET',
    viewport: options.viewport,
    pageLoadTimeoutMs: options.pageLoadTimeoutMs,
    maxTextBytes: options.maxTextBytes,
    captureScreenshot: options.captureScreenshot,
    maxScreenshotBytes: BROWSER_PAGE_INSPECT_MAX_SCREENSHOT_BYTES,
    maxResources: BROWSER_PAGE_INSPECT_MAX_RESOURCES,
    maxTotalBytes: BROWSER_PAGE_INSPECT_MAX_TOTAL_BYTES,
    resourcePolicy: 'intercept-all-public-https-or-fail-closed',
    scriptPolicy: 'disabled-no-client-script',
    credentials: 'omit',
    redirectPolicy: 'same-origin-https-only',
  };
};

export const assertBrowserPageInspectIdentity = (task, route, payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      Object.keys(payload).some(key => !payloadFields.has(key)) ||
      typeof payload.success !== 'boolean' ||
      payload.contractVersion !== BROWSER_PAGE_INSPECT_VERSION ||
      payload.serviceType !== BROWSER_PAGE_INSPECT ||
      String(payload.taskId) !== String(task._id) ||
      String(payload.routingSessionId) !== String(route._id) ||
      String(payload.nodeId) !== String(route.nodeId) ||
      payload.targetRegion !== task.targetRegion) {
    throw reject('Browser result version or task/session/node binding mismatch', 'BINDING_MISMATCH');
  }
};

const validateArtifactReference = async (artifact, expected, verifyScreenshotArtifact) => {
  if (artifact == null) return null;
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact) ||
      Object.keys(artifact).sort().join(',') !== 'artifactId,contentType,sha256,sizeBytes' ||
      typeof artifact.artifactId !== 'string' || !/^[a-f0-9]{32}$/.test(artifact.artifactId) ||
      artifact.contentType !== 'image/png' ||
      !isIntegerInRange(artifact.sizeBytes, 1, BROWSER_PAGE_INSPECT_MAX_SCREENSHOT_BYTES) ||
      typeof artifact.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(artifact.sha256) ||
      typeof verifyScreenshotArtifact !== 'function' ||
      !await verifyScreenshotArtifact(artifact, expected)) {
    throw reject('Screenshot artifact is not registered to this task and route', 'ARTIFACT_UNAVAILABLE');
  }
  return { ...artifact };
};

export const validateBrowserPageInspectResult = async (
  task,
  route,
  payload,
  { verifyScreenshotArtifact = async () => false } = {},
) => {
  assertBrowserPageInspectIdentity(task, route, payload);
  if (task.method !== 'GET' || task.executionLimit !== 1) throw reject('Invalid browser task configuration');
  const options = normalizedOptions(task.browserPageInspect);
  if (payload.successRate !== (payload.success ? 100 : 0)) {
    throw reject('Browser success rate must match the single page inspection result');
  }
  const executedAt = new Date(payload.executedAt);
  if (!Number.isFinite(executedAt.getTime()) ||
      executedAt.getTime() < new Date(route.startedAt).getTime() - 60000 ||
      executedAt.getTime() > Date.now() + 60000) {
    throw reject('Invalid browser execution timestamp');
  }
  const data = payload.resultData;
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).some(key => !resultFields.has(key)) ||
      data.schemaVersion !== BROWSER_PAGE_INSPECT_VERSION) {
    throw reject('Invalid browser page inspection result schema');
  }
  if (!Number.isInteger(data.httpStatus) || data.httpStatus < 0 || data.httpStatus > 599 ||
      data.httpStatus !== payload.statusCode ||
      !Number.isFinite(data.totalTimeMs) || data.totalTimeMs < 0 || data.totalTimeMs > 30000 ||
      data.totalTimeMs !== payload.latencyMs ||
      !Number.isFinite(data.ttfbMs) || data.ttfbMs < 0 || data.ttfbMs > data.totalTimeMs ||
      !Number.isInteger(data.pageLoadTimeMs) || data.pageLoadTimeMs < 0 ||
      data.pageLoadTimeMs > options.pageLoadTimeoutMs ||
      !isIntegerInRange(data.resourceCount, 0, BROWSER_PAGE_INSPECT_MAX_RESOURCES) ||
      !isIntegerInRange(data.blockedResourceCount, 0, data.resourceCount) ||
      !isIntegerInRange(data.transferredBytes, 0, BROWSER_PAGE_INSPECT_MAX_TOTAL_BYTES)) {
    throw reject('Invalid browser response metrics');
  }
  const originalUrl = await validateBrowserPageInspectTarget(task.targetUrl);
  const finalUrl = await validateBrowserPageInspectTarget(data.finalUrl);
  if (finalUrl.origin !== originalUrl.origin) {
    throw reject('Top-level browser redirect escaped the authorized origin', 'SECURITY_REJECTED');
  }
  if (payload.success) {
    if (data.httpStatus < 200 || data.httpStatus >= 300 ||
        typeof data.pageTitle !== 'string' || data.pageTitle.length > 512 || hasForbiddenControls(data.pageTitle) ||
        !data.viewport || typeof data.viewport !== 'object' || Array.isArray(data.viewport) ||
        data.viewport.width !== options.viewport.width ||
        data.viewport.height !== options.viewport.height ||
        data.viewport.deviceScaleFactor !== options.viewport.deviceScaleFactor ||
        typeof data.textContent !== 'string' || byteLength(data.textContent) > options.maxTextBytes ||
        data.textSizeBytes !== byteLength(data.textContent) || hasForbiddenControls(data.textContent) ||
        typeof data.error !== 'undefined' && data.error !== null) {
      throw reject('Browser document metadata or bounded text is invalid');
    }
    const screenshotArtifact = await validateArtifactReference(data.screenshotArtifact, {
      taskId: String(task._id), nodeId: String(route.nodeId), routingSessionId: String(route._id),
    }, verifyScreenshotArtifact);
    if (options.captureScreenshot && !screenshotArtifact) {
      throw reject('Screenshot artifact is required but no registered artifact was supplied', 'ARTIFACT_UNAVAILABLE');
    }
    if (!options.captureScreenshot && screenshotArtifact) {
      throw reject('Screenshot was not authorized for this task');
    }
    return {
      schemaVersion: BROWSER_PAGE_INSPECT_VERSION,
      finalUrl: finalUrl.toString(), httpStatus: data.httpStatus,
      pageTitle: data.pageTitle, viewport: options.viewport,
      textContent: data.textContent, textSizeBytes: data.textSizeBytes,
      screenshotArtifact, resourceCount: data.resourceCount,
      blockedResourceCount: data.blockedResourceCount, transferredBytes: data.transferredBytes,
      ttfbMs: data.ttfbMs, pageLoadTimeMs: data.pageLoadTimeMs,
      totalTimeMs: data.totalTimeMs, error: null, executedAt,
    };
  }

  if ((data.httpStatus !== 0 && data.httpStatus < 400) ||
      data.pageTitle != null || data.textContent != null || data.textSizeBytes !== 0 ||
      data.screenshotArtifact != null || typeof data.error !== 'string' || data.error.length > 500 ||
      hasForbiddenControls(data.error)) {
    throw reject('Failed browser execution must not include page content or an artifact');
  }
  return {
    schemaVersion: BROWSER_PAGE_INSPECT_VERSION,
    finalUrl: finalUrl.toString(), httpStatus: data.httpStatus,
    pageTitle: null, viewport: options.viewport, textContent: null, textSizeBytes: 0,
    screenshotArtifact: null, resourceCount: data.resourceCount,
    blockedResourceCount: data.blockedResourceCount, transferredBytes: data.transferredBytes,
    ttfbMs: data.ttfbMs, pageLoadTimeMs: data.pageLoadTimeMs,
    totalTimeMs: data.totalTimeMs, error: sanitizedError(data.error), executedAt,
  };
};

