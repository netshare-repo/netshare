import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ExternalLink,
  Copy,
  Check,
  Search,
  RefreshCw,
  Plus,
} from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import ClientLayout from "../../layouts/ClientLayout";
import RegionAvailabilityPanel from "../../components/client/RegionAvailabilityPanel";
import { useRegionAvailability } from "../../hooks/useRegionAvailability";
import "./ClientDashboard.css";

function ClientDashboard() {
  const [dashboard, setDashboard] = useState({
    activeTasks: 0,
    completedTasks: 0,
    availableCredits: 0,
  });
  const [tasks, setTasks] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  // Table filters & search
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const availability = useRegionAvailability();

  const fetchDashboardData = async () => {
    try {
      setError("");
      const [dashResult, tasksResult, walletResult] = await Promise.allSettled([
        axiosInstance.get("/tasks/client/dashboard"),
        axiosInstance.get("/tasks/my-tasks"),
        axiosInstance.get("/wallet"),
      ]);

      if (dashResult.status === "fulfilled") {
        setDashboard(dashResult.value.data || {});
      }
      if (tasksResult.status === "fulfilled") {
        setTasks(tasksResult.value.data?.tasks || []);
      }
      if (walletResult.status === "fulfilled") {
        setWallet(walletResult.value.data?.wallet || null);
      }

      // If all three failed, report the specific reason
      if (
        dashResult.status === "rejected" &&
        tasksResult.status === "rejected" &&
        walletResult.status === "rejected"
      ) {
        const rejectionErr =
          dashResult.reason?.response?.data?.message ||
          dashResult.reason?.message ||
          "Unable to load dashboard data. Please try again shortly.";
        setError(rejectionErr);
      }
    } catch (err) {
      console.error("Dashboard error:", err.response?.data || err.message);
      setError(
        err.response?.data?.message ||
          "Unable to load dashboard data. Please try again shortly."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchDashboardData);
  }, []);

  const handleCopyId = (id) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Task status counts
  const completedCount = useMemo(() => {
    return tasks.filter((t) => ["completed", "settled"].includes(t.status))
      .length;
  }, [tasks]);

  const runningCount = useMemo(() => {
    return tasks.filter((t) =>
      ["running", "assigned", "pending"].includes(t.status)
    ).length;
  }, [tasks]);

  const failedCount = useMemo(() => {
    return tasks.filter((t) => ["failed", "cancelled"].includes(t.status))
      .length;
  }, [tasks]);

  // Task execution history (grouped by day for activity card)
  const executionHistory = useMemo(() => {
    if (!tasks.length) return [];

    const dateMap = new Map();
    tasks.forEach((t) => {
      const createdAt = new Date(t.createdAt);
      if (Number.isNaN(createdAt.getTime())) return;
      const dateKey = createdAt.toISOString().slice(0, 10);
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
    });

    const today = new Date();
    return Array.from({ length: 14 }, (_, index) => {
      const day = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 13 + index)
      );
      const dateKey = day.toISOString().slice(0, 10);
      return {
        date: day.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
        count: dateMap.get(dateKey) || 0,
      };
    });
  }, [tasks]);

  const maxDailyTasks = useMemo(() => {
    if (!executionHistory.length) return 1;
    return Math.max(...executionHistory.map((d) => d.count), 1);
  }, [executionHistory]);

  const successRate =
    completedCount + failedCount > 0
      ? Math.round((completedCount / (completedCount + failedCount)) * 100)
      : tasks.length > 0
      ? 100
      : 0;

  // Filtered tasks for table
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (
        statusFilter === "completed" &&
        !["completed", "settled"].includes(task.status)
      ) {
        return false;
      }
      if (
        statusFilter === "running" &&
        !["pending", "assigned", "running"].includes(task.status)
      ) {
        return false;
      }
      if (
        statusFilter === "failed" &&
        !["failed", "cancelled"].includes(task.status)
      ) {
        return false;
      }

      if (tableSearch.trim()) {
        const query = tableSearch.toLowerCase();
        const urlMatch = task.targetUrl?.toLowerCase().includes(query);
        const regionMatch = task.targetRegion?.toLowerCase().includes(query);
        const typeMatch = task.serviceType?.toLowerCase().includes(query);
        const idMatch = task._id?.toLowerCase().includes(query);
        return urlMatch || regionMatch || typeMatch || idMatch;
      }

      return true;
    }).sort((a, b) => {
      const bTime = new Date(b.createdAt).getTime() || 0;
      const aTime = new Date(a.createdAt).getTime() || 0;
      return bTime - aTime;
    });
  }, [tasks, statusFilter, tableSearch]);

  const formatServiceType = (type) => {
    if (!type) return "Web Test";
    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const balanceAmount = wallet?.balance ?? dashboard.availableCredits ?? 0;
  const spentAmount = wallet?.spentCredits ?? 0;

  return (
    <ClientLayout pageTitle="Dashboard" pageSubtitle="">
      <div className="ps-overview-page">
        {/* Error banner if fetching failed */}
        {error && (
          <div className="ps-alert error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={fetchDashboardData}
              className="ps-btn-dark"
              style={{ height: 32, padding: "0 12px" }}
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {/* Three aligned summary cards keep the key figures together. */}
        <section className="ps-dashboard-metrics-grid" aria-label="Account summary">
          <div className="ps-card ps-card-teal ps-hero-stat-card">
            <div className="ps-card-decor" aria-hidden="true">
              <div className="ps-card-decor-outer" />
              <div className="ps-card-decor-inner" />
            </div>

            <div className="ps-card-header-clean">
              <h2 className="ps-card-title">Balance</h2>
              <span className="ps-meta-label">AVAILABLE FUNDS</span>
            </div>

            <div className="ps-numeral">
              {loading ? "--" : `${balanceAmount} credits`}
            </div>

            <div className="ps-card-action-row">
              <Link to="/client/wallet" className="ps-btn-white">
                <Plus size={15} />
                <span>Add More Funds</span>
              </Link>
            </div>
          </div>

          <div className="ps-card ps-card-violet ps-hero-stat-card">
            <div className="ps-card-decor" aria-hidden="true">
              <div className="ps-card-decor-outer" />
              <div className="ps-card-decor-inner" />
            </div>

            <div className="ps-card-header-clean">
              <h2 className="ps-card-title">Credits Consumed</h2>
              <span className="ps-meta-label">LAST 14 DAYS</span>
            </div>

            <div className="ps-numeral">
              {loading ? "--" : `${spentAmount} credits`}
            </div>

            <div className="ps-card-action-row">
              <Link to="/client/wallet" className="ps-btn-dark">
                <span>View Transactions</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
          <div className="ps-card ps-task-overview-card">
            <div className="ps-card-decor" aria-hidden="true">
              <div className="ps-card-decor-outer" />
              <div className="ps-card-decor-inner" />
            </div>
            <div className="ps-card-header-clean">
              <h2 className="ps-card-title">Task Overview</h2>
              <span className="ps-meta-label">{tasks.length ? `${successRate}% SUCCESS RATE` : "TASK STATUS"}</span>
            </div>

            <div className="ps-task-overview-metrics">
              <Link to="/client/tasks" className="ps-task-overview-stat">
                <span>Active</span>
                <strong>{loading ? "--" : dashboard.activeTasks ?? runningCount}</strong>
              </Link>
              <Link to="/client/tasks?tab=completed" className="ps-task-overview-stat">
                <span>Completed</span>
                <strong>{loading ? "--" : dashboard.completedTasks ?? completedCount}</strong>
              </Link>
            </div>

            <div className="ps-card-action-row">
              <Link to="/client/tasks" className="ps-btn-dark">
                <span>View all tasks</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        <section className="ps-activity-section" aria-label="Daily activity">
          <div className="ps-card ps-activity-card">
            <div className="ps-card-header-clean">
              <h2 className="ps-card-title">Daily Activity</h2>
              <span className="ps-meta-label">LAST 14 DAYS (UTC)</span>
            </div>

            {executionHistory.length === 0 ? (
              <div className="ps-activity-empty">
                <p>No recent traffic.</p>
              </div>
            ) : (
              <div className="ps-activity-chart-wrap">
                <div className="ps-activity-bars">
                  {executionHistory.map((item) => {
                    const heightPercent = item.count === 0
                      ? 3
                      : Math.max(14, Math.round((item.count / maxDailyTasks) * 100));
                    return (
                      <div className="ps-activity-col" key={item.date}>
                        <div className="ps-activity-bar-track">
                          <div
                            className={`ps-activity-bar-fill ${item.count === 0 ? "is-empty" : ""}`}
                            style={{ height: `${heightPercent}%` }}
                            title={`${item.date}: ${item.count} tasks`}
                          >
                            {item.count > 0 && <span className="ps-activity-val">{item.count}</span>}
                          </div>
                        </div>
                        <span className="ps-activity-label">{item.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* -------------------------------------------------------------
            ROW 4: LIVE NETWORK AVAILABILITY
           ------------------------------------------------------------- */}
        <section id="network-availability" className="ps-availability-section">
          <RegionAvailabilityPanel
            availability={availability.regions}
            loading={availability.loading}
            refreshing={availability.refreshing}
            error={availability.error}
            lastUpdated={availability.lastUpdated}
            stale={availability.stale}
            marquee
          />
        </section>

        {/* -------------------------------------------------------------
            ROW 5: RECENT EXECUTIONS DATA TABLE
           ------------------------------------------------------------- */}
        <section className="ps-recent-table-section">
          <div className="ps-card ps-table-panel-card">
            <div className="ps-panel-header-row">
              <div>
                <h2 className="ps-card-title">Recent Executions</h2>
                <span className="ps-meta-label">
                  AUTHENTICATED TASK AUDIT TRAIL
                </span>
              </div>

              <div className="ps-panel-actions">
                <Link to="/client/tasks" className="ps-btn-dark">
                  <span>View All ({tasks.length})</span>
                </Link>
              </div>
            </div>

            {/* Table Search & Status Filter */}
            <div className="ps-table-filter-bar">
              <div className="ps-search-input-wrap">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Search by target URL, region or task ID..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="ps-search-field"
                />
              </div>

              <div className="ps-filter-pills">
                <button
                  type="button"
                  className={`ps-filter-pill-btn ${
                    statusFilter === "all" ? "active" : ""
                  }`}
                  onClick={() => setStatusFilter("all")}
                >
                  All ({tasks.length})
                </button>
                <button
                  type="button"
                  className={`ps-filter-pill-btn ${
                    statusFilter === "running" ? "active" : ""
                  }`}
                  onClick={() => setStatusFilter("running")}
                >
                  Active ({runningCount})
                </button>
                <button
                  type="button"
                  className={`ps-filter-pill-btn ${
                    statusFilter === "completed" ? "active" : ""
                  }`}
                  onClick={() => setStatusFilter("completed")}
                >
                  Completed ({completedCount})
                </button>
                <button
                  type="button"
                  className={`ps-filter-pill-btn ${
                    statusFilter === "failed" ? "active" : ""
                  }`}
                  onClick={() => setStatusFilter("failed")}
                >
                  Failed ({failedCount})
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="ps-table-wrapper">
              <table className="ps-data-table">
                <thead>
                  <tr>
                    <th>Task ID</th>
                    <th>Target URL</th>
                    <th>Region</th>
                    <th>Service Type</th>
                    <th>Executions</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="ps-empty-state">
                        Loading tasks...
                      </td>
                    </tr>
                  ) : filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="ps-empty-state">
                        {tasks.length === 0 ? (
                          <div>
                            <p style={{ margin: "0 0 14px 0" }}>
                              No testing tasks submitted yet.
                            </p>
                            <Link to="/client/submit-task" className="ps-btn-white">
                              Create New Task
                            </Link>
                          </div>
                        ) : (
                          "No tasks match the selected filter."
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.slice(0, 6).map((task) => {
                      const isCopied = copiedId === task._id;
                      const shortId = task._id
                        ? `${task._id.slice(0, 6)}...${task._id.slice(-4)}`
                        : "ID";

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
                                maxWidth: 220,
                              }}
                            >
                              <ExternalLink
                                size={13}
                                style={{ color: "#06b6d4", flexShrink: 0 }}
                              />
                              <span
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  color: "#ffffff",
                                  fontWeight: 500,
                                }}
                                title={task.targetUrl}
                              >
                                {task.targetUrl}
                              </span>
                            </div>
                          </td>

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
                              {task.targetRegion || "Any"}
                            </span>
                          </td>

                          {/* Service Type */}
                          <td>{formatServiceType(task.serviceType)}</td>

                          {/* Execution limit */}
                          <td>{task.executionLimit || 1} runs</td>

                          {/* Status */}
                          <td>
                            <span className={`ps-badge ${task.status || ""}`}>
                              {task.status}
                            </span>
                          </td>

                          {/* Date */}
                          <td style={{ color: "#92979d", fontSize: 12 }}>
                            {formatDate(task.createdAt)}
                          </td>

                          {/* Action */}
                          <td style={{ textAlign: "right" }}>
                            <Link
                              to={`/client/tasks/${task._id}`}
                              className="ps-btn-dark"
                              style={{ height: 32, padding: "0 12px", fontSize: 12 }}
                            >
                              Details
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </ClientLayout>
  );
}

export default ClientDashboard;
