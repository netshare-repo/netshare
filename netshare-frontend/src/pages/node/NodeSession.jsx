import { useState, useEffect } from "react";
import {
  Clock,
  HardDrive,
  Activity,
  Award,
  Wifi,
  ShieldCheck,
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
} from "../../api/nodeApi";
import "./NodeSession.css";

function NodeSession() {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

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
    void Promise.resolve().then(fetchSession);
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
            value={sessionData?.latency != null ? `${sessionData.latency} ms` : 'Not measured'}
            subtitle="Round-trip response time"
            badge="Measured telemetry"
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
                {sessionData?.networkQuality || "Not measured"}
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
                  {sessionData?.packetLoss != null ? `${sessionData.packetLoss}% Loss` : 'Not measured'}
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
                  {sessionData?.node?.reliabilityScore != null ? `${sessionData.node.reliabilityScore}%` : 'Not measured'}
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
                  <p>Tasks execute automatically on the authorized Android node through WebRTC and controlled VPN routing. This page only displays recorded results.</p>
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
