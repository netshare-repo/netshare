import { URL } from 'url';
import net from 'net';
import { validateTarget } from './targetValidationService.js';

export const PUBLIC_DATA_FETCH = 'PUBLIC_DATA_FETCH';
export const PUBLIC_DATA_FETCH_VERSION = 1;
export const PUBLIC_DATA_FETCH_MAX_BYTES = 16 * 1024;

const reject = (message, code = 'INVALID_PUBLIC_DATA_FETCH') =>
  Object.assign(new Error(message), { code });
const allowedSubmissionFields = new Set(['targetUrl', 'serviceType', 'targetRegion', 'executionLimit']);
const allowedResultFields = new Set([
  'schemaVersion', 'finalUrl', 'contentType', 'content', 'responseSizeBytes',
  'httpStatus', 'ttfbMs', 'totalTimeMs', 'error',
]);
const allowedPayloadFields = new Set([
  'contractVersion', 'serviceType', 'taskId', 'routingSessionId', 'nodeId', 'executedAt',
  'success', 'successRate', 'statusCode', 'latencyMs', 'bandwidthUsedMB',
  'uploadBandwidthMB', 'packetLoss', 'targetRegion', 'resultData',
]);
const mediaType = value => typeof value === 'string' ? value.split(';', 1)[0].trim().toLowerCase() : '';
const allowedMediaTypes = new Set(['application/json', 'text/html', 'text/plain']);

export const validatePublicDataFetchTarget = async targetUrl => {
  if (typeof targetUrl !== 'string' || targetUrl.length > 2048) throw reject('Invalid target URL');
  let url;
  try { url = new URL(targetUrl); } catch { throw reject('Invalid target URL'); }
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.hash) {
    throw reject('Public data fetch requires HTTPS on port 443 without a fragment');
  }
  if (url.username || url.password || /(?:^|\.)(?:localhost|local|internal|lan|home|onion)$/i.test(url.hostname)) {
    throw reject('Credentials and internal hosts are forbidden');
  }
  if (net.isIP(url.hostname) || [...url.searchParams.keys()].some(key =>
    /(?:token|api[_-]?key|password|secret|credential|signature|auth|session|cookie)/i.test(key))) {
    throw reject('IP literals and credential-like query parameters are forbidden');
  }
  const result = await validateTarget(targetUrl, { allowedPorts: [443] });
  if (!result.valid) throw reject(`Target rejected: ${result.reason}`, 'SECURITY_REJECTED');
  return url;
};

export const validatePublicDataFetchSubmission = body => {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !allowedSubmissionFields.has(key))) {
    throw reject('Only targetUrl, serviceType, targetRegion and executionLimit are accepted');
  }
  if (body.serviceType !== PUBLIC_DATA_FETCH || body.executionLimit !== 1) {
    throw reject('Public data fetch requires exactly one GET execution');
  }
};

export const buildPublicDataFetchRequest = (task, route) => ({
  contractVersion: PUBLIC_DATA_FETCH_VERSION,
  serviceType: PUBLIC_DATA_FETCH,
  taskId: String(task._id),
  routingSessionId: String(route._id),
  targetUrl: task.targetUrl,
  method: 'GET',
  maxResponseBytes: PUBLIC_DATA_FETCH_MAX_BYTES,
  acceptedMediaTypes: [...allowedMediaTypes],
  redirectPolicy: 'same-origin-https-only',
  credentials: 'omit',
});

export const assertPublicDataFetchIdentity = (task, route, payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      Object.keys(payload).some(key => !allowedPayloadFields.has(key)) ||
      payload.contractVersion !== PUBLIC_DATA_FETCH_VERSION || payload.serviceType !== PUBLIC_DATA_FETCH ||
      String(payload.taskId) !== String(task._id) ||
      String(payload.routingSessionId) !== String(route._id) ||
      String(payload.nodeId) !== String(route.nodeId)) {
    throw reject('Public data fetch version or task/session/node binding mismatch', 'BINDING_MISMATCH');
  }
};

export const validatePublicDataFetchResult = async (task, route, payload) => {
  assertPublicDataFetchIdentity(task, route, payload);
  if (task.method !== 'GET' || task.executionLimit !== 1) throw reject('Invalid public data fetch task');
  if (payload.successRate !== (payload.success ? 100 : 0)) {
    throw reject('Public fetch success rate must match the single execution result');
  }
  const executedAt = new Date(payload.executedAt);
  const now = Date.now();
  if (!Number.isFinite(executedAt.getTime()) || executedAt.getTime() < new Date(route.startedAt).getTime() - 60000 ||
      executedAt.getTime() > now + 60000) throw reject('Invalid execution timestamp');
  const data = payload.resultData;
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).some(key => !allowedResultFields.has(key)) ||
      data.schemaVersion !== PUBLIC_DATA_FETCH_VERSION) throw reject('Invalid public data fetch result schema');
  if (!Number.isInteger(data.httpStatus) || data.httpStatus < 0 || data.httpStatus > 599 ||
      data.httpStatus !== payload.statusCode ||
      typeof data.totalTimeMs !== 'number' || !Number.isFinite(data.totalTimeMs) ||
      data.totalTimeMs < 0 || data.totalTimeMs > 300000 || data.totalTimeMs !== payload.latencyMs ||
      typeof data.ttfbMs !== 'number' || !Number.isFinite(data.ttfbMs) ||
      data.ttfbMs < 0 || data.ttfbMs > data.totalTimeMs) throw reject('Invalid HTTP response metrics');
  if (typeof data.finalUrl !== 'string') throw reject('Final URL is required');
  const original = await validatePublicDataFetchTarget(task.targetUrl);
  const final = await validatePublicDataFetchTarget(data.finalUrl);
  if (final.origin !== original.origin) throw reject('Redirect escaped authorized origin', 'SECURITY_REJECTED');
  if (payload.success) {
    if (data.httpStatus < 200 || data.httpStatus >= 300 ||
        !allowedMediaTypes.has(mediaType(data.contentType)) ||
        typeof data.contentType !== 'string' || data.contentType.length > 100 ||
        (data.contentType.includes(';') && !/^\s*(?:application\/json|text\/html|text\/plain)\s*;\s*charset=utf-8\s*$/i.test(data.contentType)) ||
        typeof data.content !== 'string' || data.content.length > PUBLIC_DATA_FETCH_MAX_BYTES ||
        !Number.isInteger(data.responseSizeBytes) || data.responseSizeBytes < 0 ||
        data.responseSizeBytes > PUBLIC_DATA_FETCH_MAX_BYTES ||
        Buffer.byteLength(data.content, 'utf8') !== data.responseSizeBytes ||
        (mediaType(data.contentType) === 'application/json' && !isJson(data.content)) || data.error != null) {
      throw reject('Unsupported, oversized or inconsistent public response');
    }
  } else if (data.content != null || data.contentType != null || data.responseSizeBytes !== 0 ||
             (data.httpStatus !== 0 && data.httpStatus < 400) ||
             typeof data.error !== 'string' || data.error.length > 500) {
    throw reject('Failed fetch must contain no response content and a bounded error');
  }
  return {
    schemaVersion: PUBLIC_DATA_FETCH_VERSION,
    finalUrl: final.toString(), contentType: payload.success ? data.contentType.toLowerCase() : null,
    content: payload.success ? data.content : null,
    responseSizeBytes: data.responseSizeBytes, httpStatus: data.httpStatus,
    ttfbMs: data.ttfbMs, totalTimeMs: data.totalTimeMs,
    error: payload.success ? null : data.error,
    executedAt,
  };
};

const isJson = content => {
  try { JSON.parse(content); return true; } catch { return false; }
};
