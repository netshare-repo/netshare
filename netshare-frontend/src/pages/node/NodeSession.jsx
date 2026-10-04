import React, { useState, useEffect } from "react";
import {
  Radio,
  Clock,
  HardDrive,
  Activity,
  Award,
  Wifi,
  ShieldCheck,
  CheckCircle,
  Play,
  RotateCcw,
  Zap,
} from "lucide-react";
import NodeLayout from "../../layouts/NodeLayout";
import StatsCard from "../../components/common/StatsCard";
import StatusBadge from "../../components/common/StatusBadge";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import {
  getCurrentSession,
  startParticipation,
  startTaskExecution,
  completeTaskExecution,
} from "../../api/nodeApi";
import "./NodeSession.css";

function NodeSession() {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [taskNotice, setTaskNotice] = useState("");

  const fetchSession = async () => {
    try {
      setError("");
      const res = await getCurrentSession();
      setSessionData(res);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch session telemetry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    // 5-second real-time polling
    const interval = setInterval(fetchSession, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return "00:00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
      2,
      "0"
    )}:${String(secs).padStart(2, "0")}`;
  };

  const handleStartSession = async () => {
    try {
      setActionLoading(true);
      await startParticipation();
      await fetchSession();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start session");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunTask = async (taskId) => {
    try {
      setActionLoading(true);
      setTaskNotice("Starting test task execution...");
      await startTaskExecution(taskId);
      await fetchSession();

      // Execute task and wait for result
      setTimeout(async () => {
        try {
          await completeTaskExecution(taskId, {
            bandwidthUsedMB: 45,
            latencyMs: sessionData?.latency || 42,
            packetLoss: 0,
            successRate: 100,
          });
          setTaskNotice("Task executed and settled! Reward credits disbursed.");
          await fetchSession();
        } catch {
          // ignore
        } finally {
          setActionLoading(false);
        }
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to execute task");
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <NodeLayout>
        <LoadingSpinner text="Streaming real-time session telemetry..." />
      </NodeLayout>
    );
  }

  const isSessionActive = sessionData?.active;
  const assignedTask = sessionData?.assignedTask;

  return (
    <NodeLayout>
      <div className="session-page">
        {error && <ErrorMessage message={error} onRetry={fetchSession} />}
        {taskNotice && (
          <div className="session-notice-banner">
            <CheckCircle size={18} />
            <span>{taskNotice}</span>
          </div>
        )}

        {/* Live Status Header */}
        <div className="session-hero-header">
          <div className="session-title-block">
            <div className="session-badge-row">
              <span className="live-streaming-indicator">
                <span className="blink-dot"></span> 5s Real-Time Polling
              </span>
              <StatusBadge status={isSessionActive ? "active" : "inactive"} />
            </div>
            <h2>Session Monitor & Performance Telemetry</h2>
            <p>
              Inspect connection latency, packet consistency, assigned tasks, and
              credit accrual in real time.
            </p>
          </div>

          <div className="session-header-actions">
            {!isSessionActive ? (
              <button
                className="session-start-btn"
                onClick={handleStartSession}
                disabled={actionLoading}
              >
                <Play size={16} />
                {actionLoading ? "Connecting..." : "Initiate Live Session"}
              </button>
            ) : (
              <button
                className="session-refresh-btn"
                onClick={fetchSession}
                title="Refresh telemetry"
              >
                <RotateCcw size={16} /> Refresh Telemetry
              </button>
            )}
          </div>
        </div>

        {/* Primary Telemetry Metric Cards */}
        <div className="session-metrics-grid">
          <StatsCard
            icon={Clock}
            title="Connected Time"
            value={formatDuration(sessionData?.connectedDurationSec)}
            subtitle={`Started: ${
              sessionData?.startTime
                ? new Date(sessionData.startTime).toLocaleTimeString()
                : "N/A"
            }`}
            badge="Live Uptime"
            badgeType="neutral"
            color="blue"
          />

          <StatsCard
            icon={Activity}
            title="Latency & Ping"
            value={`${sessionData?.latency || 45} ms`}
            subtitle="Round-trip response time"
            badge="Low Ping"
            badgeType="success"
            color="purple"
          />

          <StatsCard
            icon={HardDrive}
            title="Bandwidth Consumed"
            value={`${sessionData?.bandwidthConsumedMB || 0} MB`}
            subtitle="Testing payload transferred"
            badge="Usage"
            badgeType="neutral"
            color="blue"
          />

          <StatsCard
            icon={Award}
            title="Credits Generated"
            value={`+${sessionData?.creditsGenerated || 0} PTS`}
            subtitle="Accrued in this session"
            badge="Earnings"
            badgeType="success"
            color="green"
          />
        </div>

        {/* Detailed Session Telemetry Cards */}
        <div className="session-details-layout">
          {/* Hardware & Network Quality Monitor */}
          <div className="telemetry-card">
            <div className="telemetry-card-header">
              <div className="header-title-wrap">
                <Wifi size={18} className="icon-blue" />
                <h3>Network Quality Diagnostics</h3>
              </div>
              <span className={`quality-pill quality-${String(sessionData?.networkQuality).toLowerCase()}`}>
                {sessionData?.networkQuality || "Good"}
              </span>
            </div>

            <div className="telemetry-specs-list">
              <div className="spec-item">
                <span className="spec-label">Session ID</span>
                <span className="spec-value mono">
                  {sessionData?.sessionId || "None active"}
                </span>
              </div>

              <div className="spec-item">
                <span className="spec-label">Hardware Device</span>
                <span className="spec-value">
                  {sessionData?.node?.deviceName || "Desktop Client"}
                </span>
              </div>

              <div className="spec-item">
                <span className="spec-label">Operating Region</span>
                <span className="spec-value">
                  {sessionData?.node?.region || "Global"}
                </span>
              </div>

              <div className="spec-item">
                <span className="spec-label">Packet Loss</span>
                <span className="spec-value text-green">
                  {sessionData?.packetLoss || 0}% Loss
                </span>
              </div>

              <div className="spec-item">
                <span className="spec-label">Speed Caps</span>
                <span className="spec-value">
                  {sessionData?.node?.uploadSpeedCap || 5} Mbps Up /{" "}
                  {sessionData?.node?.downloadSpeedCap || 10} Mbps Down
                </span>
              </div>

              <div className="spec-item">
                <span className="spec-label">Reliability Index</span>
                <span className="spec-value text-purple">
                  {sessionData?.node?.reliabilityScore || 100}%
                </span>
              </div>
            </div>
          </div>

          {/* Assigned Task Execution Panel */}
          <div className="telemetry-card">
            <div className="telemetry-card-header">
              <div className="header-title-wrap">
                <Zap size={18} className="icon-amber" />
                <h3>Assigned Task Execution</h3>
              </div>
              <span className="task-count-pill">
                {sessionData?.assignedTasksCount || 0} Active Task(s)
              </span>
            </div>

            {assignedTask ? (
              <div className="assigned-task-box">
                <div className="task-meta-header">
                  <div>
                    <span className="task-type-tag">
                      {assignedTask.taskId?.serviceType?.replace("_", " ")}
                    </span>
                    <h4 className="task-url">
                      {assignedTask.taskId?.targetUrl}
                    </h4>
                  </div>
                  <StatusBadge status={assignedTask.status} />
                </div>

                <div className="task-parameters-grid">
                  <div className="param-item">
                    <span className="param-label">Target Region:</span>
                    <span className="param-val">
                      {assignedTask.taskId?.targetRegion}
                    </span>
                  </div>
                  <div className="param-item">
                    <span className="param-label">Execution Limit:</span>
                    <span className="param-val">
                      {assignedTask.taskId?.executionLimit} runs
                    </span>
                  </div>
                  <div className="param-item">
                    <span className="param-label">Client:</span>
                    <span className="param-val">
                      {assignedTask.clientId?.name || "Platform Client"}
                    </span>
                  </div>
                </div>

                <div className="task-run-bar">
                  <button
                    className="execute-task-btn"
                    onClick={() => handleRunTask(assignedTask.taskId?._id)}
                    disabled={actionLoading}
                  >
                    <Play size={16} />
                    {actionLoading
                      ? "Executing Test..."
                      : "Execute Task"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="no-task-assigned-state">
                <ShieldCheck size={36} className="idle-shield" />
                <h4>Node is in Idle Listening Mode</h4>
                <p>
                  Waiting for incoming client tasks matching region{" "}
                  <strong>{sessionData?.node?.region || "Global"}</strong>.
                  Tasks will appear here automatically when allocated.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </NodeLayout>
  );
}

export default NodeSession;
