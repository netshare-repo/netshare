import { beforeEach, describe, expect, it, vi } from 'vitest';

const { validateTarget, transactionsSupported } = vi.hoisted(() => ({
  validateTarget: vi.fn(), transactionsSupported: vi.fn(),
}));
vi.mock('../services/targetValidationService.js', () => ({ validateTarget }));
vi.mock('../lib/mongoTransaction.js', () => ({
  runTransaction: vi.fn(), supportsMongoTransactions: transactionsSupported,
}));
vi.mock('../config/env.js', async importOriginal => {
  const actual = await importOriginal();
  return { default: { ...actual.default, publicDataFetchEnabled: false, browserPageInspectEnabled: false } };
});

import {
  PUBLIC_DATA_FETCH, PUBLIC_DATA_FETCH_MAX_BYTES, buildPublicDataFetchRequest,
  validatePublicDataFetchSubmission, validatePublicDataFetchTarget, validatePublicDataFetchResult,
} from '../services/publicDataFetchService.js';
import { createTask } from '../controllers/taskController.js';
import TestingTask from '../models/TestingTask.js';
import TaskResult from '../models/TaskResult.js';
import { getTaskCapabilities } from '../controllers/taskController.js';
import {
  BROWSER_PAGE_INSPECT, BROWSER_PAGE_INSPECT_DEFAULTS,
  BROWSER_PAGE_INSPECT_EXECUTION_READY, BROWSER_PAGE_INSPECT_MAX_TEXT_BYTES,
  BROWSER_PAGE_INSPECT_MAX_SCREENSHOT_BYTES, isBrowserPageInspectAvailable,
  buildBrowserPageInspectRequest, validateBrowserPageInspectSubmission,
  validateBrowserPageInspectTarget, validateBrowserPageInspectResult,
} from '../services/browserPageInspectService.js';

const task = { _id: 'task-1', targetUrl: 'https://public.test/data', method: 'GET', executionLimit: 1 };
const route = { _id: 'route-1', nodeId: 'node-1', startedAt: new Date(Date.now() - 1000) };
const validPayload = () => ({
  contractVersion: 1, serviceType: PUBLIC_DATA_FETCH, taskId: 'task-1', routingSessionId: 'route-1',
  nodeId: 'node-1', executedAt: new Date().toISOString(), success: true, successRate: 100, statusCode: 200,
  latencyMs: 30,
  resultData: { schemaVersion: 1, finalUrl: 'https://public.test/data', contentType: 'application/json',
    content: '{"ok":true}', responseSizeBytes: 11, httpStatus: 200, ttfbMs: 10, totalTimeMs: 30 },
});

beforeEach(() => { vi.clearAllMocks(); validateTarget.mockResolvedValue({ valid: true }); });

describe('Phase 11A public data fetch foundation', () => {
  it('is a separate schema service and stays unavailable at the API while disabled', async () => {
    expect(TestingTask.schema.path('serviceType').enumValues).toContain(PUBLIC_DATA_FETCH);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    await createTask({ body: { targetUrl: task.targetUrl, serviceType: PUBLIC_DATA_FETCH,
      targetRegion: 'Pakistan', executionLimit: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(transactionsSupported).not.toHaveBeenCalled();
  });

  it('reports the backend feature capability as disabled', () => {
    const res = { json: vi.fn() };
    getTaskCapabilities({}, res);
    expect(res.json).toHaveBeenCalledWith({ publicDataFetchEnabled: false, browserPageInspectEnabled: false });
  });

  it('registers a separate browser service and keeps its submission gate closed', async () => {
    expect(TestingTask.schema.path('serviceType').enumValues).toContain(BROWSER_PAGE_INSPECT);
    expect(BROWSER_PAGE_INSPECT_EXECUTION_READY).toBe(false);
    expect(isBrowserPageInspectAvailable(true)).toBe(false);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    await createTask({ body: { targetUrl: task.targetUrl, serviceType: BROWSER_PAGE_INSPECT,
      targetRegion: 'Pakistan', executionLimit: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(transactionsSupported).not.toHaveBeenCalled();
  });

  it('enforces the UTF-8 byte cap in the persisted result schema', () => {
    const result = new TaskResult({ publicFetch: { content: 'é'.repeat(8193) } });
    expect(result.validateSync().errors['publicFetch.content']).toBeDefined();
  });

  it('rejects submission headers, cookies, credentials and multi-execution requests', () => {
    const base = { targetUrl: task.targetUrl, serviceType: PUBLIC_DATA_FETCH, targetRegion: 'Pakistan', executionLimit: 1 };
    expect(() => validatePublicDataFetchSubmission(base)).not.toThrow();
    for (const extra of [{ headers: { Authorization: 'Bearer secret' } }, { cookies: 'x=y' },
      { username: 'alice' }, { method: 'POST' }, { executionLimit: 2 }]) {
      expect(() => validatePublicDataFetchSubmission({ ...base, ...extra })).toThrow();
    }
  });

  it('requires public HTTPS and inherited target validation on port 443', async () => {
    for (const url of ['http://public.test', 'https://public.test:8443', 'https://alice:secret@public.test',
      'https://127.0.0.1', 'https://metadata.google.internal', 'https://public.test/?token=secret',
      'https://public.test/#fragment']) {
      await expect(validatePublicDataFetchTarget(url)).rejects.toThrow();
    }
    await validatePublicDataFetchTarget(task.targetUrl);
    expect(validateTarget).toHaveBeenCalledWith(task.targetUrl, { allowedPorts: [443] });
    validateTarget.mockResolvedValueOnce({ valid: false, reason: 'Hostname resolves to a private IP' });
    await expect(validatePublicDataFetchTarget(task.targetUrl)).rejects.toMatchObject({ code: 'SECURITY_REJECTED' });
  });

  it('rejects malformed target values and success rates that contradict the single result', async () => {
    for (const target of [null, {}, [], 42, 'https://public.test/' + 'x'.repeat(2050)]) {
      await expect(validatePublicDataFetchTarget(target)).rejects.toThrow();
    }
    for (const successRate of [0, 1, 50, 99]) {
      await expect(validatePublicDataFetchResult(task, route, {
        ...validPayload(), successRate,
      })).rejects.toThrow(/success rate/i);
    }
    const failed = validPayload();
    Object.assign(failed, { success: false, successRate: 100, statusCode: 503 });
    Object.assign(failed.resultData, {
      content: null, contentType: null, responseSizeBytes: 0,
      httpStatus: 503, error: 'upstream unavailable',
    });
    await expect(validatePublicDataFetchResult(task, route, failed)).rejects.toThrow(/success rate/i);
  });

  it('defines a versioned GET-only DataChannel payload with no auth material', () => {
    const request = buildPublicDataFetchRequest(task, route);
    expect(request).toMatchObject({ contractVersion: 1, serviceType: PUBLIC_DATA_FETCH,
      taskId: 'task-1', routingSessionId: 'route-1', method: 'GET', maxResponseBytes: 16384,
      credentials: 'omit', redirectPolicy: 'same-origin-https-only' });
    expect(JSON.stringify(request)).not.toMatch(/authorization|cookie/i);
  });

  it('accepts bounded JSON, HTML and plain text with metrics and identity', async () => {
    for (const [type, body] of [['application/json', '{"ok":true}'], ['text/html', '<h1>ok</h1>'],
      ['text/plain', 'hello']]) {
      const payload = validPayload();
      Object.assign(payload.resultData, { contentType: type, content: body,
        responseSizeBytes: Buffer.byteLength(body) });
      const result = await validatePublicDataFetchResult(task, route, payload);
      expect(result.content).toBe(body);
      expect(result.httpStatus).toBe(200);
    }
  });

  it('counts multibyte result content by UTF-8 bytes at the exact 16 KiB boundary', async () => {
    const body = '🙂'.repeat(PUBLIC_DATA_FETCH_MAX_BYTES / 4);
    const payload = validPayload();
    Object.assign(payload.resultData, {
      contentType: 'text/plain; charset=utf-8',
      content: body,
      responseSizeBytes: Buffer.byteLength(body, 'utf8'),
    });
    const result = await validatePublicDataFetchResult(task, route, payload);
    expect(Buffer.byteLength(result.content, 'utf8')).toBe(PUBLIC_DATA_FETCH_MAX_BYTES);
  });

  it('rejects oversized UTF-8 bodies, mismatched lengths, unsupported media and malformed JSON', async () => {
    const oversized = validPayload();
    oversized.resultData.content = 'é'.repeat(PUBLIC_DATA_FETCH_MAX_BYTES / 2 + 1);
    oversized.resultData.responseSizeBytes = Buffer.byteLength(oversized.resultData.content);
    await expect(validatePublicDataFetchResult(task, route, oversized)).rejects.toThrow();
    const wrongSize = validPayload(); wrongSize.resultData.responseSizeBytes = 10;
    await expect(validatePublicDataFetchResult(task, route, wrongSize)).rejects.toThrow();
    const binary = validPayload(); binary.resultData.contentType = 'application/octet-stream';
    await expect(validatePublicDataFetchResult(task, route, binary)).rejects.toThrow();
    const malformed = validPayload(); malformed.resultData.content = 'not json'; malformed.resultData.responseSizeBytes = 8;
    await expect(validatePublicDataFetchResult(task, route, malformed)).rejects.toThrow();
  });

  it('rejects forged node/session identity, cross-origin redirects and unexpected data fields', async () => {
    for (const patch of [{ nodeId: 'other-node' }, { routingSessionId: 'other-route' }, { taskId: 'other-task' }]) {
      await expect(validatePublicDataFetchResult(task, route, { ...validPayload(), ...patch })).rejects.toMatchObject({ code: 'BINDING_MISMATCH' });
    }
    const redirect = validPayload(); redirect.resultData.finalUrl = 'https://other.test/data';
    await expect(validatePublicDataFetchResult(task, route, redirect)).rejects.toMatchObject({ code: 'SECURITY_REJECTED' });
    const extra = validPayload(); extra.resultData.authorization = 'secret';
    await expect(validatePublicDataFetchResult(task, route, extra)).rejects.toThrow();
    await expect(validatePublicDataFetchResult(task, route, { ...validPayload(), cookies: 'x=y' }))
      .rejects.toMatchObject({ code: 'BINDING_MISMATCH' });
  });

  it('allows a bounded failure without content and rejects claimed successful redirects', async () => {
    const failure = validPayload();
    Object.assign(failure, { success: false, statusCode: 503 });
    failure.successRate = 0;
    Object.assign(failure.resultData, { content: null, contentType: null, responseSizeBytes: 0,
      httpStatus: 503, error: 'Upstream unavailable' });
    expect((await validatePublicDataFetchResult(task, route, failure)).content).toBeNull();
    failure.resultData.content = 'leak';
    await expect(validatePublicDataFetchResult(task, route, failure)).rejects.toThrow();
    const redirect = validPayload(); redirect.statusCode = redirect.resultData.httpStatus = 302;
    await expect(validatePublicDataFetchResult(task, route, redirect)).rejects.toThrow();
  });

  it('validates bounded browser submissions and defines the isolated v1 request contract', async () => {
    const base = { targetUrl: task.targetUrl, serviceType: BROWSER_PAGE_INSPECT,
      targetRegion: 'Pakistan', executionLimit: 1 };
    expect(validateBrowserPageInspectSubmission(base)).toEqual(BROWSER_PAGE_INSPECT_DEFAULTS);
    for (const invalid of [
      { ...base, executionLimit: 2 },
      { ...base, headers: { Authorization: 'secret' } },
      { ...base, browserPageInspect: { pageLoadTimeoutMs: 30000 } },
      { ...base, browserPageInspect: { viewport: { width: 5000, height: 768, deviceScaleFactor: 1 } } },
      { ...base, browserPageInspect: { maxTextBytes: BROWSER_PAGE_INSPECT_MAX_TEXT_BYTES + 1 } },
      { ...base, browserPageInspect: { arbitraryScript: 'alert(1)' } },
    ]) expect(() => validateBrowserPageInspectSubmission(invalid)).toThrow();

    await validateBrowserPageInspectTarget(task.targetUrl);
    const browserTask = { ...task, serviceType: BROWSER_PAGE_INSPECT,
      browserPageInspect: BROWSER_PAGE_INSPECT_DEFAULTS, targetRegion: 'Pakistan' };
    const request = buildBrowserPageInspectRequest(browserTask, route);
    expect(request).toMatchObject({ contractVersion: 1, serviceType: BROWSER_PAGE_INSPECT,
      taskId: task._id, routingSessionId: route._id, targetRegion: 'Pakistan', method: 'GET',
      maxTextBytes: BROWSER_PAGE_INSPECT_MAX_TEXT_BYTES,
      maxScreenshotBytes: BROWSER_PAGE_INSPECT_MAX_SCREENSHOT_BYTES,
      maxResources: 64, maxTotalBytes: 8 * 1024 * 1024,
      scriptPolicy: 'disabled-no-client-script', credentials: 'omit',
      resourcePolicy: 'intercept-all-public-https-or-fail-closed' });
    expect(JSON.stringify(request)).not.toMatch(/javascript|cookie|authorization/i);
  });

  it('validates bounded browser results, DNS-backed redirects and registered-only screenshot references', async () => {
    const browserTask = { ...task, serviceType: BROWSER_PAGE_INSPECT, executionLimit: 1,
      targetRegion: 'Pakistan', browserPageInspect: { ...BROWSER_PAGE_INSPECT_DEFAULTS, captureScreenshot: false } };
    const browserPayload = () => ({ contractVersion: 1, serviceType: BROWSER_PAGE_INSPECT,
      taskId: task._id, routingSessionId: route._id, nodeId: route.nodeId, targetRegion: 'Pakistan',
      executedAt: new Date().toISOString(), success: true, successRate: 100, statusCode: 200, latencyMs: 80,
      resultData: { schemaVersion: 1, finalUrl: task.targetUrl, httpStatus: 200, pageTitle: 'Public page',
        viewport: { ...browserTask.browserPageInspect.viewport }, textContent: 'hello', textSizeBytes: 5,
        screenshotArtifact: null, resourceCount: 4, blockedResourceCount: 1, transferredBytes: 2048,
        ttfbMs: 20, pageLoadTimeMs: 65, totalTimeMs: 80, error: null } });
    const validated = await validateBrowserPageInspectResult(browserTask, route, browserPayload());
    expect(validated).toMatchObject({ pageTitle: 'Public page', textContent: 'hello',
      textSizeBytes: 5, blockedResourceCount: 1, httpStatus: 200 });

    const spoofed = browserPayload(); spoofed.nodeId = 'other-node';
    await expect(validateBrowserPageInspectResult(browserTask, route, spoofed))
      .rejects.toMatchObject({ code: 'BINDING_MISMATCH' });
    const escaped = browserPayload(); escaped.resultData.finalUrl = 'https://other.test/';
    await expect(validateBrowserPageInspectResult(browserTask, route, escaped))
      .rejects.toMatchObject({ code: 'SECURITY_REJECTED' });
    const tooMuchText = browserPayload(); tooMuchText.resultData.textContent = '🙂'.repeat(8193);
    tooMuchText.resultData.textSizeBytes = Buffer.byteLength(tooMuchText.resultData.textContent);
    await expect(validateBrowserPageInspectResult(browserTask, route, tooMuchText)).rejects.toThrow();
    const excessiveResources = browserPayload(); excessiveResources.resultData.resourceCount = 65;
    await expect(validateBrowserPageInspectResult(browserTask, route, excessiveResources)).rejects.toThrow();
    const unsafeTitle = browserPayload(); unsafeTitle.resultData.pageTitle = 'bad\u0000title';
    await expect(validateBrowserPageInspectResult(browserTask, route, unsafeTitle)).rejects.toThrow();

    const failed = browserPayload();
    Object.assign(failed, { success: false, successRate: 0, statusCode: 503 });
    Object.assign(failed.resultData, { httpStatus: 503, pageTitle: null, textContent: null,
      textSizeBytes: 0, error: 'Authorization Bearer abc123; token?token=secret' });
    const safeFailure = await validateBrowserPageInspectResult(browserTask, route, failed);
    expect(safeFailure.textContent).toBeNull();
    expect(safeFailure.error).toBe('Authorization Bearer [redacted]; token?token=[redacted]');

    const withScreenshot = { ...browserTask, browserPageInspect: BROWSER_PAGE_INSPECT_DEFAULTS };
    const screenshotPayload = browserPayload();
    screenshotPayload.resultData.screenshotArtifact = { artifactId: 'a'.repeat(32),
      contentType: 'image/png', sizeBytes: 128, sha256: 'b'.repeat(64) };
    await expect(validateBrowserPageInspectResult(withScreenshot, route, screenshotPayload))
      .rejects.toMatchObject({ code: 'ARTIFACT_UNAVAILABLE' });
    await expect(validateBrowserPageInspectResult(withScreenshot, route, screenshotPayload, {
      verifyScreenshotArtifact: async (_artifact, binding) => binding.taskId === task._id && binding.nodeId === route.nodeId,
    })).resolves.toMatchObject({ screenshotArtifact: screenshotPayload.resultData.screenshotArtifact });
  });
});
