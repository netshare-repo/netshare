import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import { browserScreenshotPath, prepareBrowserPageInspectResult } from "./browserPageInspectView.js";

const value = (item, suffix = "") => item == null ? "Not measured" : `${item}${suffix}`;

export default function BrowserPageInspectResult({ taskId, result, success, detail, task }) {
  const view = prepareBrowserPageInspectResult(result, success);
  const screenshot = view.state === "ready" ? view.screenshot : null;

  const browser = view.browser || {};
  const metrics = view.metrics || {};
  const detailError = detail?.error || browser.error;
  return (
    <section className="ps-card ps-browser-result-card" aria-labelledby="browser-result-title">
      <div className="ps-card-header-clean">
        <div>
          <h2 className="ps-card-title" id="browser-result-title">Page inspection</h2>
          <span className="ps-meta-label">BROWSER PAGE INSPECT · READ ONLY</span>
        </div>
        <span className={`ps-badge ${view.state === "ready" ? "completed" : "failed"}`}>
          {view.state === "ready" ? "Result recorded" : view.state === "failed" ? "Execution failed" : "Result unavailable"}
        </span>
      </div>

      {view.state !== "ready" ? (
        <div className={`ps-public-fetch-state is-${view.state}`} role="status">
          <strong>{view.state === "failed" ? "Page inspection failed" : view.state === "missing" ? "No stored inspection" : "Result could not be displayed"}</strong>
          <span>{view.error}</span>
          {detailError && <span>{String(detailError)}</span>}
        </div>
      ) : <>
        <h3 className="ps-browser-page-title">{browser.pageTitle || "Untitled page"}</h3>
        <div className="ps-public-fetch-metadata">
          <div><span>Final URL</span><strong>{browser.finalUrl}</strong></div>
          <div><span>HTTP status</span><strong>{value(metrics.httpStatus)}</strong></div>
          <div><span>Page load</span><strong>{value(metrics.pageLoadTimeMs, " ms")}</strong></div>
          <div><span>Time to first byte</span><strong>{value(metrics.ttfbMs, " ms")}</strong></div>
          <div><span>Total execution</span><strong>{value(metrics.totalTimeMs, " ms")}</strong></div>
          <div><span>Viewport</span><strong>{browser.viewport.width} × {browser.viewport.height} · {browser.viewport.deviceScaleFactor}×</strong></div>
          <div><span>Resources loaded</span><strong>{value(metrics.resourceCount)}</strong></div>
          <div><span>Resources blocked</span><strong>{value(metrics.blockedResourceCount)}</strong></div>
          <div><span>Transferred</span><strong>{value(metrics.transferredBytes, " bytes")}</strong></div>
          <div><span>Rendered text</span><strong>{value(browser.textSizeBytes, " bytes")}</strong></div>
          <div><span>Target region</span><strong>{value(task?.targetRegion)}</strong></div>
          <div><span>Node region</span><strong>{value(detail?.nodeRegion || task?.assignedNodeId?.region)}</strong></div>
          <div><span>Source node</span><strong>{value(browser.sourceNodeId)}</strong></div>
          <div><span>Executed</span><strong>{value(browser.executedAt ? new Date(browser.executedAt).toLocaleString() : null)}</strong></div>
        </div>
        {detailError && <div className="ps-browser-error" role="status"><strong>Execution note</strong><span>{String(detailError)}</span></div>}
        <div className="ps-browser-text-heading"><h3>Rendered page text</h3><span>Plain text · never executed</span></div>
        <pre className="ps-public-fetch-content ps-browser-text">{view.text}</pre>
        <div className="ps-browser-screenshot">
          <h3>Screenshot</h3>
          {screenshot && <PrivateScreenshot key={screenshot.artifactId} taskId={taskId} screenshot={screenshot} title={browser.pageTitle} />}
          {!screenshot && <div className="ps-public-fetch-state">No screenshot artifact was recorded.</div>}
        </div>
      </>}
    </section>
  );
}

function PrivateScreenshot({ taskId, screenshot, title }) {
  const [state, setState] = useState({ loading: true, url: "", error: "" });

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    axiosInstance.get(browserScreenshotPath(taskId, screenshot.artifactId), { responseType: "blob" })
      .then(async ({ data }) => {
        if (!(data instanceof Blob) || data.type !== "image/png" || data.size !== screenshot.sizeBytes) {
          throw new Error("Screenshot response did not match its registered PNG metadata.");
        }
        const bytes = new Uint8Array(await data.arrayBuffer());
        if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47 ||
            bytes[4] !== 0x0d || bytes[5] !== 0x0a || bytes[6] !== 0x1a || bytes[7] !== 0x0a) {
          throw new Error("Screenshot file is not a valid PNG.");
        }
        if (globalThis.crypto?.subtle) {
          const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
          const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
          if (hex !== screenshot.sha256) throw new Error("Screenshot integrity check failed.");
        }
        objectUrl = URL.createObjectURL(data);
        if (active) setState({ loading: false, url: objectUrl, error: "" });
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((failure) => {
        if (active) setState({ loading: false, url: "", error: failure.response?.status === 403
          ? "This screenshot is not available to this account."
          : "Screenshot preview is unavailable. Refresh the task and try again." });
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [taskId, screenshot.artifactId, screenshot.sha256, screenshot.sizeBytes]);

  const download = () => {
    if (!state.url) return;
    const link = document.createElement("a");
    link.href = state.url;
    link.download = `netshare-page-${taskId}.png`;
    link.click();
  };

  if (state.loading) return <div className="ps-public-fetch-state" role="status">Loading private screenshot…</div>;
  if (state.error) return <div className="ps-public-fetch-state is-invalid" role="status">{state.error}</div>;
  return <>
    <button type="button" className="ps-btn-dark" onClick={download}><Download size={14} /> Download PNG</button>
    <img className="ps-browser-screenshot-image" src={state.url} alt={`Screenshot of ${title || "inspected page"}`} />
  </>;
}
