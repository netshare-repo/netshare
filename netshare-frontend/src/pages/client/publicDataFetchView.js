export const PUBLIC_FETCH_MAX_BYTES = 16 * 1024;
const acceptedTypes = new Set([
  "application/json",
  "text/html",
  "text/plain",
]);

export function isPublicDataFetchEnabled(capabilities) {
  return capabilities?.publicDataFetchEnabled === true;
}

export function preparePublicFetchResult(fetch, resultData = {}, success = false) {
  const common = {
    httpStatus: fetch?.httpStatus ?? resultData?.httpStatus ?? null,
    contentType: fetch?.contentType ?? resultData?.contentType ?? null,
    responseSizeBytes: fetch?.responseSizeBytes ?? resultData?.responseSizeBytes ?? null,
    finalUrl: fetch?.finalUrl ?? resultData?.finalUrl ?? null,
    executedAt: fetch?.executedAt ?? null,
    sourceNodeId: fetch?.sourceNodeId ?? null,
    ttfbMs: fetch?.ttfbMs ?? resultData?.ttfbMs ?? null,
    totalTimeMs: fetch?.totalTimeMs ?? resultData?.totalTimeMs ?? null,
    nodeRegion: resultData?.nodeRegion ?? null,
    error: resultData?.error ?? null,
  };
  if (!success || !fetch || fetch.content == null) {
    return {
      ...common,
      state: common.error ? "failed" : fetch ? "empty" : "missing",
      error: common.error || "No response content was recorded.",
      content: null,
    };
  }
  if (typeof fetch.content !== "string") {
    return { ...common, state: "invalid", error: "Stored response content is invalid.", content: null };
  }
  const size = new TextEncoder().encode(fetch.content).length;
  const rawContentType = String(fetch.contentType || "").trim();
  const mediaType = rawContentType.split(";", 1)[0].trim().toLowerCase();
  const parameters = rawContentType.slice(rawContentType.indexOf(";") + 1).trim();
  const validEncoding = !rawContentType.includes(";") || /^charset\s*=\s*utf-8$/i.test(parameters);
  if (
    size > PUBLIC_FETCH_MAX_BYTES ||
    !Number.isInteger(fetch.responseSizeBytes) ||
    fetch.responseSizeBytes !== size
  ) {
    return { ...common, state: "oversized", error: "Stored response exceeds the 16 KiB limit or has an invalid size.", content: null };
  }
  if (!acceptedTypes.has(mediaType) || !validEncoding || !/^2\d\d$/.test(String(fetch.httpStatus))) {
    return { ...common, state: "invalid", error: "Stored response type or HTTP status is invalid.", content: null };
  }
  let content = fetch.content;
  if (mediaType === "application/json") {
    try {
      content = JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return { ...common, state: "invalid", error: "The stored JSON response cannot be parsed.", content: null };
    }
  }
  return { ...common, state: size === 0 ? "empty" : "ready", content };
}

export function publicFetchDownload(contentType, taskId) {
  const mediaType = String(contentType || "").split(";", 1)[0].trim().toLowerCase();
  const extension = mediaType === "application/json"
    ? "json"
    : mediaType === "text/html"
      ? "html.txt"
      : "txt";
  return {
    filename: "netshare-task-" + String(taskId || "result") + "." + extension,
    mimeType: "text/plain;charset=utf-8",
  };
}
