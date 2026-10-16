import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  RefreshCcw,
  ExternalLink,
  Copy,
  Check,
  Clock,
} from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import ClientLayout from "../../layouts/ClientLayout";
import { preparePublicFetchResult, publicFetchDownload } from "./publicDataFetchView.js";
import BrowserPageInspectResult from "./BrowserPageInspectResult.jsx";
import "./TaskDetails.css";

const terminalStates = new Set(["completed", "settled", "failed", "cancelled"]);
const val = (item) =>
  item === null || item === undefined || item === ""
    ? "Not measured"
    : String(item);
const formatService = (service) =>
  String(service || "Unknown service")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function TaskDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await axiosInstance.get(
        `/tasks/${encodeURIComponent(id)}`
      );
      setData(response.data);
      setError("");
    } catch (failure) {
      setError(
        failure.response?.data?.message || "Could not load task details"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (terminalStates.has(data?.task?.status)) return undefined;
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [data?.task?.status, load]);

  const handleCopyId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const downloadReport = async () => {
    try {
      const response = await axiosInstance.get(
        `/tasks/${encodeURIComponent(id)}/report.csv`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `netshare-task-${id}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (failure) {
      setError(failure.response?.data?.message || "Report download failed");
    }
  };

  const task = data?.task;
  const result = data?.result;
  const detail = result?.resultData || {};
  const executions = Array.isArray(detail.executions) ? detail.executions : [];
  const isPublicFetch = task?.serviceType === "PUBLIC_DATA_FETCH";
  const isBrowserInspect = task?.serviceType === "BROWSER_PAGE_INSPECT";
  const publicFetch = isPublicFetch
    ? preparePublicFetchResult(result?.publicFetch, detail, result?.success === true)
    : null;

  const copyPublicFetch = async () => {
    try {
      await navigator.clipboard.writeText(publicFetch.content);
      setError("");
    } catch {
      setError("Could not copy response content. Check clipboard permissions.");
    }
  };

  const downloadPublicFetch = () => {
    const file = publicFetchDownload(publicFetch.contentType, id);
    const url = URL.createObjectURL(new Blob([publicFetch.content], { type: file.mimeType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = file.filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <ClientLayout pageTitle="Task Details" pageSubtitle="">
      <div className="ps-details-page">
        {/* Top Header Row */}
        <div className="ps-page-header">
          <div>
            <h1 className="ps-page-title">Task Details &amp; Telemetry</h1>
            <p className="ps-page-subtitle">
              Verified execution measurements, HTTP evidence, and node telemetry.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link to="/client/tasks" className="ps-btn-dark">
              <ArrowLeft size={15} />
              <span>Back to Tasks</span>
            </Link>
            <button type="button" onClick={load} className="ps-btn-dark">
              <RefreshCcw size={14} />
              <span>Refresh</span>
            </button>
            {["completed", "settled", "failed"].includes(task?.status) && (
              <button
                type="button"
                onClick={downloadReport}
                className="ps-btn-white"
              >
                <Download size={15} />
                <span>Download CSV</span>
              </button>
            )}
          </div>
        </div>

        {error && <div className="ps-alert error">{error}</div>}
        {loading && <div className="ps-loading-state">Loading task data...</div>}

        {task && (
          <div className="ps-details-content">
            {/* Row 1: Task Overview Card */}
            <div className="ps-card ps-details-overview-card">
              <div className="ps-card-decor" aria-hidden="true">
                <div className="ps-card-decor-outer" />
              </div>

              <div className="ps-card-header-clean" style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <h2 className="ps-card-title">Task Specification</h2>
                  <span className={`ps-badge ${task.status || ""}`}>
                    {task.status}
                  </span>
                </div>
                <span className="ps-meta-label">DISPATCH CONFIGURATION</span>
              </div>

              <div className="ps-meta-grid">
                <div className="ps-meta-item ps-meta-item-id">
                  <span className="ps-meta-label">TASK ID</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    <code
                      style={{
                        fontSize: 12.5,
                        color: "#a2a6ab",
                        background: "#16181b",
                        padding: "3px 8px",
                        borderRadius: 6,
                        border: "1px solid #292a2e",
                      }}
                    >
                      {task._id}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      title="Copy Task ID"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#777d84",
                        cursor: "pointer",
                      }}
                    >
                      {copiedId ? (
                        <Check size={14} style={{ color: "#10b981" }} />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="ps-meta-item ps-meta-item-url">
                  <span className="ps-meta-label">TARGET URL</span>
                  <div
                    className="ps-meta-url-wrap"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    <ExternalLink size={14} style={{ color: "#06b6d4" }} />
                    <a
                      className="ps-meta-url-value"
                      href={task.targetUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {task.targetUrl}
                    </a>
                  </div>
                </div>

                <div className="ps-meta-item">
                  <span className="ps-meta-label">SERVICE TYPE</span>
                  <strong className="ps-meta-value">
                    {formatService(task.serviceType)}
                  </strong>
                </div>

                <div className="ps-meta-item">
                  <span className="ps-meta-label">TARGET REGION</span>
                  <strong className="ps-meta-value">
                    {task.targetRegion}
                  </strong>
                </div>

                <div className="ps-meta-item">
                  <span className="ps-meta-label">ASSIGNED NODE REGION</span>
                  <span className="ps-meta-value is-muted">
                    {val(detail.nodeRegion || task.assignedNodeId?.region)}
                  </span>
                </div>

                <div className="ps-meta-item ps-meta-item-cost">
                  <span className="ps-meta-label">COST / LIMIT</span>
                  <strong className="ps-meta-value">
                    {task.estimatedCost} credits ({task.executionLimit} runs)
                  </strong>
                </div>
              </div>
            </div>

            {/* Row 2: Performance Telemetry Metrics (if recorded) */}
            {result ? (
              <div className="ps-top-cards-row">
                <div className="ps-card ps-card-teal ps-hero-stat-card">
                  <div className="ps-card-decor" aria-hidden="true">
                    <div className="ps-card-decor-outer" />
                    <div className="ps-card-decor-inner" />
                  </div>
                  <div className="ps-card-header-clean">
                    <h3 className="ps-card-title">Success Rate</h3>
                    <span className="ps-meta-label">VERIFIED DELIVERIES</span>
                  </div>
                  <div className="ps-numeral">{result.successRate}%</div>
                  <span className="ps-desc-text">
                    Attempted: {val(detail.attemptedExecutions)} · Completed:{" "}
                    {val(detail.completedExecutions)}
                  </span>
                </div>

                <div className="ps-card ps-card-violet ps-hero-stat-card">
                  <div className="ps-card-decor" aria-hidden="true">
                    <div className="ps-card-decor-outer" />
                    <div className="ps-card-decor-inner" />
                  </div>
                  <div className="ps-card-header-clean">
                    <h3 className="ps-card-title">Response Latency</h3>
                    <span className="ps-meta-label">MEASURED ROUND TRIP</span>
                  </div>
                  <div className="ps-numeral">{result.latencyMs} ms</div>
                  <span className="ps-desc-text">
                    Bandwidth: {result.bandwidthUsedMB} MB · HTTP Status:{" "}
                    {result.statusCode === 0
                      ? "No HTTP response"
                      : result.statusCode}
                  </span>
                </div>
              </div>
            ) : (
              <div className="ps-card ps-awaiting-card">
                <span className="ps-awaiting-icon">
                  <Clock size={21} />
                </span>
                <div>
                  <span className="ps-meta-label">LIVE TASK STATUS</span>
                  <h3 className="ps-card-title">Awaiting node results</h3>
                  <p className="ps-desc-text">
                    The task is being assigned or executed. Telemetry refreshes automatically.
                  </p>
                </div>
              </div>
            )}

            {isPublicFetch && result && (
              <section className="ps-card ps-public-fetch-card" aria-labelledby="public-fetch-title">
                <div className="ps-card-header-clean">
                  <div>
                    <h2 className="ps-card-title" id="public-fetch-title">Public response</h2>
                    <span className="ps-meta-label">STORED NODE RESPONSE · SOURCE TEXT ONLY</span>
                  </div>
                  {publicFetch.state === "ready" && (
                    <div className="ps-public-fetch-actions">
                      <button type="button" className="ps-btn-dark" onClick={copyPublicFetch}><Copy size={14} /> Copy content</button>
                      <button type="button" className="ps-btn-white" onClick={downloadPublicFetch}><Download size={14} /> Download</button>
                    </div>
                  )}
                </div>
                <div className="ps-public-fetch-metadata">
                  <div><span>HTTP status</span><strong>{val(publicFetch.httpStatus)}</strong></div>
                  <div><span>Content type</span><strong>{val(publicFetch.contentType)}</strong></div>
                  <div><span>Response size</span><strong>{publicFetch.responseSizeBytes == null ? "Not measured" : `${publicFetch.responseSizeBytes} bytes`}</strong></div>
                  <div><span>Target region</span><strong>{val(task.targetRegion)}</strong></div>
                  <div><span>Node region</span><strong>{val(publicFetch.nodeRegion || detail.nodeRegion || task.assignedNodeId?.region)}</strong></div>
                  <div><span>Executed</span><strong>{val(publicFetch.executedAt)}</strong></div>
                  <div><span>Source node</span><strong>{val(publicFetch.sourceNodeId)}</strong></div>
                  <div><span>Time to first byte</span><strong>{publicFetch.ttfbMs == null ? "Not measured" : `${publicFetch.ttfbMs} ms`}</strong></div>
                  <div><span>Total response time</span><strong>{publicFetch.totalTimeMs == null ? "Not measured" : `${publicFetch.totalTimeMs} ms`}</strong></div>
                  <div><span>Measured latency</span><strong>{result.latencyMs == null ? "Not measured" : `${result.latencyMs} ms`}</strong></div>
                  <div><span>Bandwidth</span><strong>{result.bandwidthUsedMB == null ? "Not measured" : `${result.bandwidthUsedMB} MB`}</strong></div>
                  <div><span>Packet loss</span><strong>{result.packetLoss == null ? "Not measured" : `${result.packetLoss}%`}</strong></div>
                  <div className="ps-public-fetch-url"><span>Final URL</span><strong>{val(publicFetch.finalUrl)}</strong></div>
                </div>
                {publicFetch.state === "ready" ? (
                  <pre className="ps-public-fetch-content" aria-label="Fetched response text">{publicFetch.content}</pre>
                ) : (
                  <div className={`ps-public-fetch-state is-${publicFetch.state}`} role="status">
                    <strong>{publicFetch.state === "failed" ? "Fetch failed" : publicFetch.state === "missing" ? "No stored response" : publicFetch.state === "oversized" ? "Response rejected" : publicFetch.state === "empty" ? "Empty response" : "Response unavailable"}</strong>
                    <span>{publicFetch.error || "The node did not return a readable response."}</span>
                  </div>
                )}
              </section>
            )}

            {isBrowserInspect && result && (
              <BrowserPageInspectResult
                taskId={id}
                result={result.browserPageInspect}
                success={result.success === true}
                detail={detail}
                task={task}
              />
            )}

            {/* Row 3: Individual Executions Table */}
            {executions.length > 0 && (
              <div className="ps-card ps-table-panel-card">
                <div className="ps-card-header-clean" style={{ marginBottom: 20 }}>
                  <h3 className="ps-card-title">Individual Executions</h3>
                  <span className="ps-meta-label">
                    PER-RUN TELEMETRY LOGS ({executions.length} RUNS)
                  </span>
                </div>

                <div className="ps-table-wrapper">
                  <table className="ps-data-table">
                    <thead>
                      <tr>
                        <th>Run #</th>
                        <th>Outcome</th>
                        <th>HTTP Status</th>
                        <th>Latency</th>
                        <th>Response Size</th>
                        <th>Content Type</th>
                        <th>Final URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {executions.map((item) => (
                        <tr key={item.execution}>
                          <td>
                            <strong>#{item.execution}</strong>
                          </td>
                          <td>
                            <span
                              className={`ps-badge ${
                                item.success ? "completed" : "failed"
                              }`}
                            >
                              {item.success ? "Succeeded" : "Failed"}
                            </span>
                          </td>
                          <td>
                            <code>
                              {item.statusCode === 0
                                ? "No HTTP response"
                                : val(item.statusCode)}
                            </code>
                          </td>
                          <td>
                            {item.latencyMs == null
                              ? "Not measured"
                              : `${item.latencyMs} ms`}
                          </td>
                          <td>
                            {item.responseSizeBytes == null
                              ? "Not measured"
                              : `${item.responseSizeBytes} B`}
                          </td>
                          <td style={{ color: "#92979d", fontSize: 12 }}>
                            {val(item.contentType)}
                          </td>
                          <td
                            style={{
                              maxWidth: 220,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={val(item.finalUrl)}
                          >
                            {val(item.finalUrl)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
