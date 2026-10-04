import React, { useState, useEffect } from "react";
import {
  Activity,
  Play,
  Square,
  Save,
  CheckCircle,
  Sliders,
  ShieldAlert,
  Globe,
  HardDrive,
  Upload,
  Download,
  Layers,
} from "lucide-react";
import NodeLayout from "../../layouts/NodeLayout";
import StatusBadge from "../../components/common/StatusBadge";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import {
  getMyNode,
  updateNodeSettings,
  startParticipation,
  stopParticipation,
} from "../../api/nodeApi";
import "./NodeParticipation.css";

function NodeParticipation() {
  const [node, setNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [form, setForm] = useState({
    region: "US-East",
    bandwidthLimitMB: 2048,
    uploadSpeedCapMbps: 5,
    downloadSpeedCapMbps: 10,
    maxConcurrentTasks: 2,
  });

  const fetchNodeData = async () => {
    try {
      setError("");
      const res = await getMyNode();
      if (res.node) {
        setNode(res.node);
        setForm({
          region: res.node.region || "US-East",
          bandwidthLimitMB: res.node.bandwidthLimitMB || 2048,
          uploadSpeedCapMbps: res.node.uploadSpeedCapMbps || 5,
          downloadSpeedCapMbps: res.node.downloadSpeedCapMbps || 10,
          maxConcurrentTasks: res.node.maxConcurrentTasks || 1,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load node settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodeData();
  }, []);

  const handleStart = async () => {
    try {
      setActionLoading(true);
      setError("");
      setSuccessMsg("");
      await startParticipation();
      setSuccessMsg("Participation session started! Node is now actively sharing.");
      await fetchNodeData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start participation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      setActionLoading(true);
      setError("");
      setSuccessMsg("");
      await stopParticipation();
      setSuccessMsg("Participation session stopped. Node is now offline.");
      await fetchNodeData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to stop participation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    // Validation
    if (form.bandwidthLimitMB < 256) {
      setError("Daily bandwidth limit must be at least 256 MB.");
      return;
    }
    if (form.uploadSpeedCapMbps < 1 || form.uploadSpeedCapMbps > 1000) {
      setError("Upload speed cap must be between 1 and 1000 Mbps.");
      return;
    }
    if (form.downloadSpeedCapMbps < 1 || form.downloadSpeedCapMbps > 1000) {
      setError("Download speed cap must be between 1 and 1000 Mbps.");
      return;
    }
    if (form.maxConcurrentTasks < 1 || form.maxConcurrentTasks > 10) {
      setError("Maximum concurrent tasks must be between 1 and 10.");
      return;
    }

    try {
      setSaveLoading(true);
      const res = await updateNodeSettings(form);
      setSuccessMsg("Participation limits and settings saved successfully!");
      if (res.node) setNode(res.node);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save settings");
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <NodeLayout>
        <LoadingSpinner text="Loading participation controls..." />
      </NodeLayout>
    );
  }

  const isActive = node?.status === "active";

  return (
    <NodeLayout>
      <div className="participation-page">
        {error && <ErrorMessage message={error} />}
        {successMsg && (
          <div className="participation-success-alert">
            <CheckCircle size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Master Control Card */}
        <div className="participation-control-card">
          <div className="control-card-header">
            <div>
              <h2>Participation Controller</h2>
              <p>Manage your live participation state and resource boundaries.</p>
            </div>
            <StatusBadge status={node?.status || "inactive"} />
          </div>

          <div className="control-actions-row">
            <div className="state-description">
              {isActive ? (
                <p className="state-active-txt">
                  <span className="pulsing-circle"></span> Your node is actively
                  serving verified testing tasks and accumulating credits.
                </p>
              ) : (
                <p className="state-inactive-txt">
                  Your node is currently offline. Start participation to allow
                  tasks to be routed to your device.
                </p>
              )}
            </div>

            <div className="buttons-group">
              {isActive ? (
                <button
                  className="btn-stop-large"
                  onClick={handleStop}
                  disabled={actionLoading}
                >
                  <Square size={18} />
                  {actionLoading ? "Stopping..." : "Stop Participation"}
                </button>
              ) : (
                <button
                  className="btn-start-large"
                  onClick={handleStart}
                  disabled={actionLoading}
                >
                  <Play size={18} />
                  {actionLoading ? "Starting..." : "Start Participation"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Configuration Settings Form */}
        <div className="participation-settings-card">
          <div className="settings-card-header">
            <div className="settings-title-wrap">
              <Sliders size={20} className="title-icon" />
              <div>
                <h3>Resource Boundaries & Speed Caps</h3>
                <p>Configure bandwidth, speed limits, and concurrency safety.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="settings-form-grid">
            <div className="setting-field">
              <label>
                <Globe size={15} /> Operating Geographic Region
              </label>
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              >
                <option value="US-East">US-East (North America)</option>
                <option value="US-West">US-West (North America)</option>
                <option value="EU-Central">EU-Central (Europe)</option>
                <option value="EU-West">EU-West (Europe)</option>
                <option value="AP-South">AP-South (Asia Pacific)</option>
                <option value="Global">Global / Anywhere</option>
              </select>
              <span className="field-hint">
                Tasks specifically requesting this region will prioritize your node.
              </span>
            </div>

            <div className="setting-field">
              <label>
                <HardDrive size={15} /> Daily Bandwidth Limit (MB)
              </label>
              <input
                type="number"
                min="256"
                max="50000"
                step="256"
                value={form.bandwidthLimitMB}
                onChange={(e) =>
                  setForm({ ...form, bandwidthLimitMB: Number(e.target.value) })
                }
                required
              />
              <span className="field-hint">
                e.g. 2048 MB = 2GB/day. Participation automatically pauses when reached.
              </span>
            </div>

            <div className="setting-field">
              <label>
                <Upload size={15} /> Upload Speed Cap (Mbps)
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={form.uploadSpeedCapMbps}
                onChange={(e) =>
                  setForm({
                    ...form,
                    uploadSpeedCapMbps: Number(e.target.value),
                  })
                }
                required
              />
              <span className="field-hint">
                Limits maximum outbound testing bandwidth. Example: 5 Mbps.
              </span>
            </div>

            <div className="setting-field">
              <label>
                <Download size={15} /> Download Speed Cap (Mbps)
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={form.downloadSpeedCapMbps}
                onChange={(e) =>
                  setForm({
                    ...form,
                    downloadSpeedCapMbps: Number(e.target.value),
                  })
                }
                required
              />
              <span className="field-hint">
                Limits maximum inbound testing speed. Example: 10 Mbps.
              </span>
            </div>

            <div className="setting-field full-width">
              <label>
                <Layers size={15} /> Maximum Concurrent Tasks
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={form.maxConcurrentTasks}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxConcurrentTasks: Number(e.target.value),
                  })
                }
                required
              />
              <span className="field-hint">
                Number of concurrent tasks that can execute on this node simultaneously (1-10).
              </span>
            </div>

            <div className="settings-submit-bar">
              <button
                type="submit"
                className="save-settings-btn"
                disabled={saveLoading}
              >
                <Save size={16} />
                {saveLoading ? "Saving..." : "Save Participation Settings"}
              </button>
            </div>
          </form>
        </div>

        {/* Safety & Compliance Notice */}
        <div className="safety-notice-box">
          <ShieldAlert size={20} className="notice-icon" />
          <div>
            <h4>Controlled Testing Safeguard</h4>
            <p>
              NetShare only executes approved verification tasks matching our
              service protocol (Ad verification, Accessibility, Localization,
              Performance). Unrestricted tunneling or arbitrary traffic is strictly prohibited.
            </p>
          </div>
        </div>
      </div>
    </NodeLayout>
  );
}

export default NodeParticipation;
