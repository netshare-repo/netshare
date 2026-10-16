import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCcw, Search, ExternalLink, Star, Plus, Copy, Check } from "lucide-react";
import { Link } from "react-router-dom";
import axiosInstance from "../../api/axiosInstance";
import ClientLayout from "../../layouts/ClientLayout";
import "./MyTasks.css";

function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState({});
  const [actionMessage, setActionMessage] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/tasks/my-tasks");
      setTasks(res.data.tasks || []);
    } catch (error) {
      console.log("Tasks error:", error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyId = (id) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const downloadReport = async (task) => {
    try {
      setActionMessage("");
      const res = await axiosInstance.get(`/tasks/${task._id}/report.csv`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `netshare-task-${task._id}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setActionMessage(error.response?.data?.message || "Report download failed");
    }
  };

  const submitRating = async (task) => {
    const rating = Number(ratings[task._id] || 5);
    try {
      setActionMessage("");
      await axiosInstance.post(`/tasks/${task._id}/rating`, { rating });
      setActionMessage("Node rating saved.");
      await fetchTasks();
    } catch (error) {
      setActionMessage(error.response?.data?.message || "Rating failed");
    }
  };

  useEffect(() => {
    let active = true;
    const refresh = () =>
      axiosInstance
        .get("/tasks/my-tasks")
        .then((res) => {
          if (active) setTasks(res.data.tasks || []);
        })
        .catch((error) => {
          if (active)
            setActionMessage(
              error.response?.data?.message || "Could not refresh task status"
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });

    refresh();
    const timer = setInterval(refresh, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const filteredTasks = useMemo(() => {
    let data = [...tasks];

    if (status !== "all") {
      data = data.filter((task) => task.status === status);
    }

    if (search.trim()) {
      data = data.filter(
        (task) =>
          task.targetUrl.toLowerCase().includes(search.toLowerCase()) ||
          task.serviceType.toLowerCase().includes(search.toLowerCase()) ||
          task.targetRegion.toLowerCase().includes(search.toLowerCase()) ||
          task._id.toLowerCase().includes(search.toLowerCase())
      );
    }

    return data;
  }, [search, status, tasks]);

  const formatServiceType = (type) => {
    if (!type) return "Web Test";
    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <ClientLayout pageTitle="My Tasks" pageSubtitle="">
      <div className="ps-mytasks-page">
        {/* Top Header Row */}
        <div className="ps-page-header">
          <div>
            <h1 className="ps-page-title">My Testing Tasks</h1>
            <p className="ps-page-subtitle">
              Monitor execution progress, assigned nodes, costs, and audit logs.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              className="ps-btn-dark"
              onClick={fetchTasks}
              title="Refresh tasks"
            >
              <RefreshCcw size={14} />
              <span>Refresh</span>
            </button>
            <Link to="/client/submit-task" className="ps-btn-white">
              <Plus size={15} />
              <span>Submit Task</span>
            </Link>
          </div>
        </div>

        {actionMessage && (
          <div className="ps-alert success">
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Tasks Table Panel Card */}
        <div className="ps-card ps-table-panel-card">
          <div className="ps-card-decor" aria-hidden="true">
            <div className="ps-card-decor-outer" />
          </div>

          {/* Table Filters */}
          <div className="ps-table-filter-bar">
            <div className="ps-search-input-wrap">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search by URL, service, region or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-search-field"
              />
            </div>

            <div className="ps-filter-pills">
              {["all", "pending", "assigned", "running", "completed", "failed"].map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    className={`ps-filter-pill-btn ${
                      status === st ? "active" : ""
                    }`}
                    onClick={() => setStatus(st)}
                  >
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Data Table */}
          <div className="ps-table-wrapper">
            <table className="ps-data-table">
              <thead>
                <tr>
                  <th style={{ width: "10%" }}>Task ID</th>
                  <th style={{ width: "20%" }}>Target URL</th>
                  <th style={{ width: "13%" }}>Service Type</th>
                  <th style={{ width: "8%" }}>Region</th>
                  <th style={{ width: "9%" }}>Status</th>
                  <th style={{ width: "7%" }}>Cost</th>
                  <th style={{ width: "10%" }}>Assigned Node</th>
                  <th style={{ width: "9%" }}>Created</th>
                  <th style={{ width: "14%", textAlign: "right" }}>Actions &amp; Report</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="ps-loading-state">
                      Loading tasks...
                    </td>
                  </tr>
                ) : filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="ps-empty-state">
                      {tasks.length === 0 ? (
                        <div>
                          <p style={{ margin: "0 0 14px 0" }}>
                            No testing tasks submitted yet.
                          </p>
                          <Link to="/client/submit-task" className="ps-btn-white">
                            Submit First Task
                          </Link>
                        </div>
                      ) : (
                        "No tasks match your current filter."
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const isCopied = copiedId === task._id;
                    const shortId = `${task._id.slice(0, 6)}...${task._id.slice(
                      -4
                    )}`;

                    return (
                      <tr key={task._id}>
                        {/* Task ID with Copy */}
                        <td>
                          <div
                            style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <code
                            style={{
                              fontSize: 12,
                              color: "#a2a6ab",
                              background: "#16181b",
                              padding: "3px 6px",
                              borderRadius: 6,
                              border: "1px solid #292a2e",
                            }}
                          >
                            {shortId}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopyId(task._id)}
                            title="Copy ID"
                            style={{
                              background: "none",
                              border: "none",
                              color: "#777d84",
                              cursor: "pointer",
                              padding: 2,
                            }}
                          >
                            {isCopied ? (
                              <Check size={13} style={{ color: "#10b981" }} />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Target URL */}
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            maxWidth: "clamp(200px, 25vw, 480px)",
                          }}
                        >
                          <ExternalLink
                            size={13}
                            style={{ color: "#06b6d4", flexShrink: 0 }}
                          />
                          <Link
                            to={`/client/tasks/${task._id}`}
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              color: "#ffffff",
                              textDecoration: "none",
                              fontWeight: 500,
                            }}
                            title={task.targetUrl}
                          >
                            {task.targetUrl}
                          </Link>
                        </div>
                      </td>

                        {/* Service Type */}
                        <td>{formatServiceType(task.serviceType)}</td>

                        {/* Region */}
                        <td>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "#16181b",
                              border: "1px solid #292a2e",
                              fontSize: 11.5,
                              fontWeight: 600,
                            }}
                          >
                            {task.targetRegion}
                          </span>
                        </td>

                        {/* Status */}
                        <td>
                          <span className={`ps-badge ${task.status || ""}`}>
                            {task.status}
                          </span>
                        </td>

                        {/* Cost */}
                        <td style={{ fontWeight: 600, color: "#ffffff" }}>
                          {task.estimatedCost} credits
                        </td>

                        {/* Assigned Node */}
                        <td style={{ color: "#92979d", fontSize: 12.5 }}>
                          {task.assignedNodeId
                            ? task.assignedNodeId.deviceName || "Assigned"
                            : "Pending node"}
                        </td>

                        {/* Created Date */}
                        <td style={{ color: "#92979d", fontSize: 12 }}>
                          {new Date(task.createdAt).toLocaleDateString()}
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: "right" }}>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Link
                              to={`/client/tasks/${task._id}`}
                              className="ps-btn-dark"
                              style={{
                                height: 32,
                                padding: "0 12px",
                                fontSize: 12,
                              }}
                            >
                              Details
                            </Link>

                            {["completed", "settled"].includes(task.status) && (
                              <button
                                type="button"
                                onClick={() => downloadReport(task)}
                                className="ps-btn-dark"
                                style={{
                                  height: 32,
                                  padding: "0 10px",
                                  fontSize: 12,
                                }}
                                title="Download CSV Report"
                              >
                                <Download size={13} />
                              </button>
                            )}

                            {["completed", "settled"].includes(task.status) &&
                              (task.clientRating?.rating ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                    fontSize: 12,
                                    color: "#f59e0b",
                                    fontWeight: 600,
                                  }}
                                >
                                  <Star size={13} fill="#f59e0b" />
                                  {task.clientRating.rating}/5
                                </span>
                              ) : (
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <select
                                    aria-label={`Rate node for task ${task._id}`}
                                    value={ratings[task._id] || 5}
                                    onChange={(e) =>
                                      setRatings((curr) => ({
                                        ...curr,
                                        [task._id]: e.target.value,
                                      }))
                                    }
                                    className="ps-select"
                                    style={{
                                      height: 32,
                                      padding: "0 8px",
                                      fontSize: 11.5,
                                      width: 60,
                                    }}
                                  >
                                    {[5, 4, 3, 2, 1].map((val) => (
                                      <option key={val} value={val}>
                                        {val}★
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => submitRating(task)}
                                    className="ps-btn-dark"
                                    style={{
                                      height: 32,
                                      padding: "0 10px",
                                      fontSize: 11.5,
                                    }}
                                  >
                                    Rate
                                  </button>
                                </div>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}

export default MyTasks;
