import test from "node:test";
import assert from "node:assert/strict";
import {
  isPublicDataFetchEnabled,
  preparePublicFetchResult,
  publicFetchDownload,
} from "../src/pages/client/publicDataFetchView.js";

test("feature stays unavailable unless backend capability is explicitly true", () => {
  assert.equal(isPublicDataFetchEnabled({ publicDataFetchEnabled: false }), false);
  assert.equal(isPublicDataFetchEnabled({}), false);
  assert.equal(isPublicDataFetchEnabled({ publicDataFetchEnabled: true }), true);
});

test("formats JSON and preserves HTML as inert source text", () => {
  const json = preparePublicFetchResult({
    content: '{"ok":true}',
    contentType: "application/json",
    httpStatus: 200,
    responseSizeBytes: 11,
  }, {}, true);
  assert.equal(json.state, "ready");
  assert.equal(json.content, '{\n  "ok": true\n}');

  const html = preparePublicFetchResult({
    content: "<script>alert(1)</script>",
    contentType: "text/html",
    httpStatus: 200,
    responseSizeBytes: 25,
  }, {}, true);
  assert.equal(html.state, "ready");
  assert.equal(html.content, "<script>alert(1)</script>");
  assert.equal(html.state, "ready");
});

test("rejects invalid, empty, failed and oversized stored results", () => {
  assert.equal(preparePublicFetchResult(null, {}, true).state, "missing");
  assert.equal(preparePublicFetchResult({ content: null }, { error: "fetch failed" }, false).state, "failed");
  assert.equal(preparePublicFetchResult({
    content: '{"',
    contentType: "application/json",
    httpStatus: 200,
    responseSizeBytes: 2,
  }, {}, true).state, "invalid");
  assert.equal(preparePublicFetchResult({
    content: "x".repeat(16385),
    contentType: "text/plain",
    httpStatus: 200,
    responseSizeBytes: 16385,
  }, {}, true).state, "oversized");
  assert.equal(preparePublicFetchResult({
    content: "abc",
    contentType: "text/plain; charset=iso-8859-1",
    httpStatus: 200,
    responseSizeBytes: 3,
  }, {}, true).state, "invalid");
  assert.equal(preparePublicFetchResult({
    content: "abc",
    contentType: "text/plain",
    httpStatus: 404,
    responseSizeBytes: 3,
  }, {}, true).state, "invalid");
});

test("download descriptors force HTML to a text file", () => {
  assert.deepEqual(publicFetchDownload("text/html", "abc"), {
    filename: "netshare-task-abc.html.txt",
    mimeType: "text/plain;charset=utf-8",
  });
});
