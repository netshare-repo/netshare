import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axiosInstance from "../../api/axiosInstance";
import ClientLayout from "../../layouts/ClientLayout";
import "./TaskDetails.css";

const terminalStates = new Set(["completed", "settled", "failed", "cancelled"]);
const value = (item) => item === null || item === undefined || item === "" ? "Not measured" : String(item);

export default function TaskDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await axiosInstance.get(`/tasks/${encodeURIComponent(id)}`);
      setData(response.data);
      setError("");
    } catch (failure) {
      setError(failure.response?.data?.message || "Could not load task details");
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

  const downloadReport = async () => {
    try {
      const response = await axiosInstance.get(`/tasks/${encodeURIComponent(id)}/report.csv`, { responseType: "blob" });
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

  return <ClientLayout>
    <main className="task-details">
      <Link to="/client/tasks">← My tasks</Link>
      <h1>Task details</h1>
      <button type="button" onClick={load}>Refresh</button>
      {error && <p role="alert">{error}</p>}
      {loading && <p>Loading task…</p>}
      {task && <>
        <dl className="task-details-grid">
          <dt>Task ID</dt><dd>{task._id}</dd>
          <dt>Target URL</dt><dd>{task.targetUrl}</dd>
          <dt>Method</dt><dd>{task.method || "GET"}</dd>
          <dt>Service</dt><dd>{task.serviceType}</dd>
          <dt>Requested region</dt><dd>{task.targetRegion}</dd>
          <dt>Node region</dt><dd>{value(detail.nodeRegion || task.assignedNodeId?.region)}</dd>
          <dt>Status</dt><dd>{task.status}</dd>
          <dt>Requested executions</dt><dd>{task.executionLimit}</dd>
          <dt>Cost</dt><dd>{task.estimatedCost} credits</dd>
          <dt>Summary</dt><dd>{value(task.resultSummary?.message)}</dd>
        </dl>
        {result ? <>
          <h2>Recorded result</h2>
          <dl className="task-details-grid">
            <dt>Success rate</dt><dd>{result.successRate}%</dd>
            <dt>Average response time</dt><dd>{result.latencyMs} ms</dd>
            <dt>Last HTTP status</dt><dd>{result.statusCode === 0 ? "No HTTP response" : result.statusCode}</dd>
            <dt>Measured bandwidth</dt><dd>{result.bandwidthUsedMB} MB</dd>
            <dt>Attempted / completed</dt><dd>{value(detail.attemptedExecutions)} / {value(detail.completedExecutions)}</dd>
            <dt>Total duration</dt><dd>{detail.totalDurationMs == null ? "Not measured" : `${detail.totalDurationMs} ms`}</dd>
            <dt>Total response size</dt><dd>{detail.totalResponseSizeBytes == null ? "Not measured" : `${detail.totalResponseSizeBytes} bytes`}</dd>
            <dt>Recorded at</dt><dd>{value(result.completedAt)}</dd>
            {detail.error && <><dt>Error</dt><dd>{detail.error}</dd></>}
          </dl>
          {executions.length > 0 && <>
            <h2>Individual executions</h2>
            {executions.map((execution) => <section className="task-execution" key={execution.execution}>
              <h3>Execution {execution.execution}: {execution.success ? "Succeeded" : "Failed"}</h3>
              <dl className="task-details-grid">
                <dt>Started</dt><dd>{value(execution.startedAt)}</dd>
                <dt>Completed</dt><dd>{value(execution.completedAt)}</dd>
                <dt>HTTP status</dt><dd>{execution.statusCode === 0 ? "No HTTP response" : value(execution.statusCode)}</dd>
                <dt>Final URL</dt><dd>{value(execution.finalUrl)}</dd>
                <dt>Content type</dt><dd>{value(execution.contentType)}</dd>
                <dt>Latency</dt><dd>{execution.latencyMs == null ? "Not measured" : `${execution.latencyMs} ms`}</dd>
                <dt>Response size</dt><dd>{execution.responseSizeBytes == null ? "Not measured" : `${execution.responseSizeBytes} bytes`}</dd>
                {execution.serviceEvidence && <><dt>Service evidence</dt><dd><pre>{JSON.stringify(execution.serviceEvidence, null, 2)}</pre></dd></>}
                {execution.error && <><dt>Error</dt><dd>{execution.error}</dd></>}
              </dl>
            </section>)}
          </>}
          {["completed", "settled", "failed"].includes(task.status) && <button type="button" onClick={downloadReport}>Download CSV report</button>}
        </> : <p>No recorded result yet. The task will refresh until it reaches a final state.</p>}
      </>}
    </main>
  </ClientLayout>;
}
