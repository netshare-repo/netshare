import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  HardDrive,
  Upload,
  Download,
  ListOrdered,
  Award,
  ShieldCheck,
  Play,
  Square,
  Clock,
  ArrowUpRight,
  Server,
  Key,
  Copy,
  Check,
  Radio,
  Zap,
  RefreshCw,
} from "lucide-react";
import NodeLayout from "../../layouts/NodeLayout";
import StatsCard from "../../components/common/StatsCard";
import StatusBadge from "../../components/common/StatusBadge";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import {
  getNodeDashboard,
  startParticipation,
  stopParticipation,
  registerNode,
  getNodeApiKey,
  regenerateNodeApiKey,
  getNodeTelemetry,
} from "../../api/nodeApi";
import { useSocket } from "../../context/SocketContext";
import "./NodeDashboard.css";

function NodeDashboard() {
  const { isConnected: isSocketConnected, liveTelemetry, systemEvents } = useSocket();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsRegistration, setNeedsRegistration] = useState(false);

  // API Key state
  const [apiKey, setApiKey] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);

  // Live Telemetry history for sparklines
  const [telemetryHistory, setTelemetryHistory] = useState([]);

  const [registerForm, setRegisterForm] = useState({
    deviceName: "Primary Desktop Node",
    region: "US-East",
    bandwidthLimitMB: 4096,
    uploadSpeedCapMbps: 10,
    downloadSpeedCapMbps: 20,
  });

  const fetchData = async () => {
    try {
      setError("");
      const res = await getNodeDashboard();
      setData(res);
      setNeedsRegistration(false);
    } catch (err) {
      if (err.response?.status === 404) {
        setNeedsRegistration(true);
      } else {
        setError(err.response?.data?.message || "Failed to load dashboard data");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchApiKey = async () => {
    try {
      setKeyLoading(true);
      const res = await getNodeApiKey();
      setApiKey(res.apiKey || "");
    } catch (_) {
      // Non-blocking
    } finally {
      setKeyLoading(false);
    }
  };

  const fetchTelemetryHistory = async () => {
    try {
      const res = await getNodeTelemetry(20);
      if (res.telemetry) {
        setTelemetryHistory(res.telemetry);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchData();
    fetchApiKey();
    fetchTelemetryHistory();
    const interval = setInterval(() => {
      fetchData();
      fetchTelemetryHistory();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleParticipation = async () => {
    if (!data) return;
    try {
      setActionLoading(true);
      if (data.status === "active") {
        await stopParticipation();
      } else {
        await startParticipation();
      }
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError("");
      await registerNode(registerForm);
      setNeedsRegistration(false);
      await fetchData();
      await fetchApiKey();
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyApiKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRegenerateKey = async () => {
    if (!window.confirm("Regenerating this API Key will disconnect any active node daemons. Continue?")) return;
    try {
      setKeyLoading(true);
      const res = await regenerateNodeApiKey();
      setApiKey(res.apiKey);
    } catch (err) {
      setError("Failed to regenerate API Key");
    } finally {
      setKeyLoading(false);
    }
  };

  if (loading) {
    return (
      <NodeLayout>
        <LoadingSpinner text="Connecting to real-time node telemetry..." size="lg" />
      </NodeLayout>
    );
  }

  // If node is not yet registered for this user
  if (needsRegistration) {
    return (
      <NodeLayout>
        <div className="node-onboarding-card">
          <div className="onboarding-icon">
            <Server size={40} />
          </div>
          <h2>Register Your Device Node</h2>
          <p>
            Connect your computer to the NetShare distributed network to start
            sharing bandwidth and earning reward credits.
          </p>

          {error && <ErrorMessage message={error} />}

          <form onSubmit={handleRegister} className="node-register-form">
            <div className="form-group">
              <label>Device Name</label>
              <input
                type="text"
                value={registerForm.deviceName}
                onChange={(e) =>
                  setRegisterForm({ ...registerForm, deviceName: e.target.value })
                }
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Operating Region</label>
                <select
                  value={registerForm.region}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, region: e.target.value })
                  }
                >
                  <option value="US-East">US-East (North America)</option>
                  <option value="US-West">US-West (North America)</option>
                  <option value="EU-Central">EU-Central (Europe)</option>
                  <option value="AP-South">AP-South (Asia Pacific)</option>
                  <option value="Global">Global / Anywhere</option>
                </select>
              </div>

              <div className="form-group">
                <label>Daily Bandwidth Cap (MB)</label>
                <input
                  type="number"
                  min="500"
                  max="50000"
                  value={registerForm.bandwidthLimitMB}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      bandwidthLimitMB: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Upload Speed Cap (Mbps)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={registerForm.uploadSpeedCapMbps}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      uploadSpeedCapMbps: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Download Speed Cap (Mbps)</label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={registerForm.downloadSpeedCapMbps}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      downloadSpeedCapMbps: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="register-node-submit"
              disabled={actionLoading}
            >
              {actionLoading ? "Registering Device..." : "Register Device & Continue"}
            </button>
          </form>
        </div>
      </NodeLayout>
    );
  }

  const bandwidthUsed = data?.bandwidthUsed || 0;
  const bandwidthLimit = data?.bandwidthLimit || 2048;
  const bandwidthPercent = Math.min(
    100,
    Math.round((bandwidthUsed / bandwidthLimit) * 100)
  );

  const isActive = data?.status === "active";
  const myNodeId = data?.device?.id;
  const liveNodeMetrics = myNodeId && liveTelemetry[myNodeId] ? liveTelemetry[myNodeId] : null;

  return (
    <NodeLayout>
      <div className="node-dashboard-container">
        {error && <ErrorMessage message={error} onRetry={fetchData} />}

        {/* Real-time Execution Plane Indicator */}
        <div className="realtime-status-pill">
          <div className="status-pill-indicator">
            <span className={`pill-dot ${isSocketConnected ? "live" : "offline"}`} />
            <Radio size={14} className={isSocketConnected ? "text-green animate-pulse" : "text-gray"} />
            <span className="pill-text">
              Real-Time Execution Plane: <strong>{isSocketConnected ? "CONNECTED" : "CONNECTING..."}</strong>
            </span>
          </div>
          <span className="pill-subtext">
            Node ID: <code className="code-font">{myNodeId?.substring(0, 10)}...</code>
          </span>
        </div>

        {/* Hero Control Banner */}
        <div className={`node-hero-banner ${isActive ? "active-glow" : ""}`}>
          <div className="hero-banner-info">
            <div className="hero-status-row">
              <StatusBadge status={data?.status || "inactive"} />
              <span className="hero-region-badge">{data?.device?.region || "Global"}</span>
              <span className="live-heartbeat-badge">
                <Zap size={12} /> 10s Heartbeat Active
              </span>
            </div>
            <h2>
              Node is {isActive ? "Active & Sharing" : "Idle & Inactive"}
            </h2>
            <p>
              {isActive
                ? "Your node is connected to the execution plane and ready to receive real distributed tasks."
                : "Start participation to contribute spare bandwidth and earn credits automatically."}
            </p>
          </div>

          <div className="hero-banner-actions">
            <button
              className={`participation-btn ${
                isActive ? "btn-stop" : "btn-start"
              }`}
              onClick={handleToggleParticipation}
              disabled={actionLoading}
            >
              {actionLoading ? (
                "Processing..."
              ) : isActive ? (
                <>
                  <Square size={16} /> Stop Sharing
                </>
              ) : (
                <>
                  <Play size={16} /> Start Sharing
                </>
              )}
            </button>

            <Link to="/node/participation" className="settings-link-btn">
              Configure Limits
            </Link>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="node-metrics-grid">
          <StatsCard
            icon={Activity}
            title="Participation Status"
            value={(data?.status || "inactive").toUpperCase()}
            subtitle={isActive ? "Ready for tasks" : "Sharing paused"}
            badge={isSocketConnected ? "Socket Live" : "Offline"}
            badgeType={isActive ? "success" : "neutral"}
            color={isActive ? "green" : "blue"}
          />

          <StatsCard
            icon={Award}
            title="Credits Earned Today"
            value={`${data?.creditsEarned || 0} PTS`}
            subtitle={`Balance: ${data?.walletBalance || 0} Credits`}
            badge="Dynamic Yield"
            badgeType="success"
            color="green"
          />

          <StatsCard
            icon={ListOrdered}
            title="Active Tasks"
            value={data?.activeTasks || 0}
            subtitle={`Max Capacity: ${data?.device?.maxConcurrentTasks || 1}`}
            badge="Live"
            badgeType={data?.activeTasks > 0 ? "warning" : "neutral"}
            color="amber"
          />

          <StatsCard
            icon={ShieldCheck}
            title="Reliability Score"
            value={`${data?.reliabilityScore || 100}%`}
            subtitle={`Latency: ${liveNodeMetrics?.latency || data?.latencyMs || 45}ms`}
            badge="Healthy"
            badgeType="success"
            color="purple"
          />
        </div>

        {/* Node Agent API Key & Daemon Integration Card */}
        <div className="node-card" style={{ marginBottom: "1.5rem" }}>
          <div className="node-card-header">
            <div className="header-title">
              <Key size={18} />
              <h3>Headless Node Agent Authentication</h3>
            </div>
            <button
              onClick={handleRegenerateKey}
              disabled={keyLoading}
              className="quota-tag"
              style={{ cursor: "pointer", background: "rgba(255,255,255,0.08)" }}
              title="Roll fresh API Key"
            >
              <RefreshCw size={12} className={keyLoading ? "animate-spin" : ""} /> Roll Key
            </button>
          </div>

          <p style={{ fontSize: "0.88rem", color: "#94a3b8", marginBottom: "0.75rem" }}>
            Run the <code>netshare-agent</code> execution daemon on your PC, server, or Docker instance to execute real distributed bandwidth tasks.
          </p>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="password"
              readOnly
              value={apiKey || "Generating node API key..."}
              style={{
                flex: 1,
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#e2e8f0",
                fontFamily: "monospace",
                fontSize: "0.9rem",
              }}
            />
            <button
              onClick={handleCopyApiKey}
              className="participation-btn btn-start"
              style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
            >
              {copiedKey ? <Check size={14} /> : <Copy size={14} />} {copiedKey ? "Copied!" : "Copy Key"}
            </button>
          </div>

          <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#64748b" }}>
            CLI: <code>node agent.js --key {apiKey ? `${apiKey.substring(0, 12)}...` : "YOUR_KEY"}</code>
          </div>
        </div>

        {/* Detailed Hardware & Bandwidth Tracking */}
        <div className="node-details-grid">
          {/* Bandwidth Usage Card */}
          <div className="node-card">
            <div className="node-card-header">
              <div className="header-title">
                <HardDrive size={18} />
                <h3>Daily Bandwidth Quota</h3>
              </div>
              <span className="quota-tag">
                {bandwidthUsed} / {bandwidthLimit} MB
              </span>
            </div>

            <div className="bandwidth-progress-wrapper">
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${bandwidthPercent}%` }}
                ></div>
              </div>
              <div className="progress-labels">
                <span>{bandwidthPercent}% Consumed</span>
                <span>{Math.max(0, bandwidthLimit - bandwidthUsed)} MB Remaining</span>
              </div>
            </div>

            <div className="node-speed-row">
              <div className="speed-col">
                <Upload size={16} className="speed-icon upload" />
                <div>
                  <span className="speed-label">Upload Cap</span>
                  <span className="speed-val">
                    {data?.uploadSpeedCap || 5} Mbps
                  </span>
                </div>
              </div>

              <div className="speed-col">
                <Download size={16} className="speed-icon download" />
                <div>
                  <span className="speed-label">Download Cap</span>
                  <span className="speed-val">
                    {data?.downloadSpeedCap || 10} Mbps
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Session & Quick Actions */}
          <div className="node-card">
            <div className="node-card-header">
              <div className="header-title">
                <Clock size={18} />
                <h3>Session Telemetry</h3>
              </div>
              <Link to="/node/session" className="card-link">
                View Live Session <ArrowUpRight size={14} />
              </Link>
            </div>

            {data?.currentSession ? (
              <div className="active-session-summary">
                <div className="session-data-row">
                  <span className="label">Session ID:</span>
                  <span className="val code-font">
                    {data.currentSession.sessionId}
                  </span>
                </div>
                <div className="session-data-row">
                  <span className="label">Data Consumed:</span>
                  <span className="val">
                    {data.currentSession.bandwidthUsed} MB
                  </span>
                </div>
                <div className="session-data-row">
                  <span className="label">Credits Generated:</span>
                  <span className="val text-green">
                    +{data.currentSession.creditsEarned} PTS
                  </span>
                </div>
                <div className="session-data-row">
                  <span className="label">Hardware Device:</span>
                  <span className="val">{data?.device?.deviceName}</span>
                </div>
              </div>
            ) : (
              <div className="no-session-placeholder">
                <p>No active participation session is running.</p>
                <button
                  className="quick-start-btn"
                  onClick={handleToggleParticipation}
                >
                  <Play size={14} /> Start Participation Session
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </NodeLayout>
  );
}

export default NodeDashboard;
