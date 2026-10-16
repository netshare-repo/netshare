import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Radio,
  Globe,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../layouts/AdminLayout";
import {
  getAdminDashboard,
  getAdminUsers,
  getAdminNodes,
  getAdminTasks,
  getAdminTransactions,
} from "../../api/adminApi";
import { useSocket } from "../../context/socketState";
import "./AdminDashboard.css";

function AdminDashboard() {
  const navigate = useNavigate();
  const { isConnected: isSocketConnected, liveNodes, systemEvents } = useSocket();

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalNodes: 0,
    activeNodes: 0,
    totalTasks: 0,
    activeTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalTransactions: 0,
    totalCreditsIssued: 0,
  });

  const [nodesList, setNodesList] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const safeArray = (data, keys) => {
    for (const key of keys) {
      if (Array.isArray(data?.[key])) return data[key];
    }
    return [];
  };

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");

      let dashboardData = null;

      try {
        dashboardData = await getAdminDashboard();
      } catch {
        dashboardData = null;
      }

      const usersData = await getAdminUsers();
      const nodesData = await getAdminNodes();
      const tasksData = await getAdminTasks();
      const transactionsData = await getAdminTransactions();

      const users = safeArray(usersData, ["users"]);
      const nodes = safeArray(nodesData, ["nodes"]);
      const tasks = safeArray(tasksData, ["tasks"]);
      const transactions = safeArray(transactionsData, ["transactions"]);

      setNodesList(nodes);

      const activeNodes = nodes.filter((node) => node.status === "active").length;

      const activeTasks = tasks.filter(
        (task) => task.status === "assigned" || task.status === "running"
      ).length;

      const completedTasks = tasks.filter(
        (task) => task.status === "completed" || task.status === "settled"
      ).length;

      const failedTasks = tasks.filter(
        (task) => task.status === "failed" || task.status === "cancelled"
      ).length;

      const totalCreditsIssued = transactions
        .filter((tx) => tx.type === "credit")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      setStats({
        bandwidth: dashboardData?.bandwidth,
        network: dashboardData?.network,
        totalUsers:
          dashboardData?.totalUsers ??
          dashboardData?.stats?.totalUsers ??
          users.length,

        totalNodes:
          dashboardData?.totalNodes ??
          dashboardData?.stats?.totalNodes ??
          nodes.length,

        activeNodes:
          dashboardData?.activeNodes ??
          dashboardData?.stats?.activeNodes ??
          activeNodes,

        totalTasks:
          dashboardData?.totalTasks ??
          dashboardData?.stats?.totalTasks ??
          tasks.length,

        activeTasks:
          dashboardData?.activeTasks ??
          dashboardData?.stats?.activeTasks ??
          activeTasks,

        completedTasks:
          dashboardData?.completedTasks ??
          dashboardData?.stats?.completedTasks ??
          completedTasks,

        failedTasks,

        totalTransactions:
          dashboardData?.totalTransactions ??
          dashboardData?.stats?.totalTransactions ??
          transactions.length,

        totalCreditsIssued:
          dashboardData?.totalCreditsIssued ??
          dashboardData?.stats?.totalCreditsIssued ??
          totalCreditsIssued,
      });

      setRecentUsers(users.slice(0, 5));
      setRecentTasks(tasks.slice(0, 5));
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Failed to load admin dashboard. Check backend routes and admin token."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadDashboard);
  }, [loadDashboard]);

  // Compute live regional distribution
  const regionalDistribution = nodesList.reduce((acc, node) => {
    const region = node.region || "Global";
    acc[region] = (acc[region] || 0) + 1;
    return acc;
  }, {});

  const summaryCards = [
    {
      title: "Network Health",
      accent: "#06b6d4",
      primaryLabel: "Accounted bandwidth",
      primaryValue: stats.bandwidth?.totalMB?.toFixed(2) ?? "Unavailable",
      unit: "MB",
      metrics: [
        { label: "Fresh nodes", value: stats.network?.freshNodes ?? "Unavailable" },
        { label: "Mean latency", value: stats.network?.latencyMs != null ? `${stats.network.latencyMs.toFixed(1)} ms` : "Unmeasured" },
        { label: "Reliability", value: stats.network?.reliabilityPercent != null ? `${stats.network.reliabilityPercent.toFixed(1)}%` : "Unmeasured" },
        { label: "Assignments / capacity", value: stats.network ? `${stats.network.activeAssignments} / ${stats.network.capacity}` : "Unavailable" },
      ],
      status: `${liveNodes.length} live socket${liveNodes.length === 1 ? "" : "s"}`,
      statusTone: isSocketConnected ? "online" : "offline",
    },
    {
      title: "Task Execution",
      accent: "#06b6d4",
      primaryLabel: "Active tasks",
      primaryValue: stats.activeTasks,
      metrics: [
        { label: "All tasks", value: stats.totalTasks },
        { label: "Completed", value: stats.completedTasks },
        { label: "Failed", value: stats.failedTasks },
        { label: "Execution sockets", value: `${liveNodes.length} live` },
      ],
    },
    {
      title: "Platform & Credits",
      accent: "#10b981",
      primaryLabel: "Total users",
      primaryValue: stats.totalUsers,
      metrics: [
        { label: "Active DB nodes", value: stats.activeNodes },
        { label: "Registered nodes", value: stats.totalNodes },
        { label: "Credits issued", value: stats.totalCreditsIssued },
        { label: "Transactions", value: stats.totalTransactions },
      ],
    },
  ];

  return (
    <AdminLayout>
      <div className="admin-dashboard-page">
        <div className="admin-dashboard-toolbar">
          <div className="admin-dashboard-live-state">
            <span className={`admin-live-dot ${isSocketConnected ? "online" : "offline"}`} />
            <span>{isSocketConnected ? "Control plane connected" : "Connecting to control plane"}</span>
          </div>
          <button onClick={loadDashboard}>
            <RefreshCw size={15} /> Refresh data
          </button>
        </div>

        {message && <div className="admin-dashboard-message">{message}</div>}

        {loading ? (
          <div className="admin-dashboard-loading">Loading dashboard...</div>
        ) : (
          <>
            <div className="admin-summary-grid">
              {summaryCards.map((card) => {
                return (
                  <section className="admin-summary-card" key={card.title} style={{ "--summary-accent": card.accent }}>
                    <div className="admin-summary-card-header">
                      <div className="admin-summary-heading">
                        <h2>{card.title}</h2>
                      </div>
                      {card.status && <span className={`admin-summary-status ${card.statusTone}`}>{card.status}</span>}
                    </div>
                    <div className="admin-summary-primary">
                      <span>{card.primaryLabel}</span>
                      <strong>{card.primaryValue}{card.unit && <small> {card.unit}</small>}</strong>
                    </div>
                    <div className="admin-summary-metrics">
                      {card.metrics.map((metric) => (
                        <div className="admin-summary-metric" key={metric.label}>
                          <span>{metric.label}</span>
                          <strong>{metric.value}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            {/* Live Regional Map & Real-time Activity Feeds */}
            <div className="admin-panels-grid" style={{ marginBottom: "1.5rem" }}>
              {/* Regional Node Distribution */}
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Globe size={18} color="#06b6d4" />
                    <h3>Live Node Regional Distribution</h3>
                  </div>
                  <span style={{ fontSize: "0.85rem", color: "#777d84" }}>
                    {nodesList.length} Registered Nodes
                  </span>
                </div>

                <div style={{ padding: "0.5rem 0" }}>
                  {Object.keys(regionalDistribution).length === 0 ? (
                    <p className="admin-empty-text">No active regions registered.</p>
                  ) : (
                    Object.entries(regionalDistribution).map(([region, count]) => {
                      const percent = Math.round((count / (nodesList.length || 1)) * 100);
                      return (
                        <div key={region} style={{ marginBottom: "0.75rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                            <span><strong>{region}</strong></span>
                            <span>{count} node{count > 1 ? "s" : ""} ({percent}%)</span>
                          </div>
                          <div style={{ height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${percent}%`, height: "100%", background: "#06b6d4", borderRadius: "3px" }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Real-Time System Activity Feed */}
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Radio size={18} color={isSocketConnected ? "#10b981" : "#777d84"} className={isSocketConnected ? "animate-pulse" : ""} />
                    <h3>Real-Time System Activity Ticker</h3>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: isSocketConnected ? "#10b981" : "#777d84" }}>
                    {isSocketConnected ? "WebSocket Stream Online" : "Connecting..."}
                  </span>
                </div>

                {systemEvents.length === 0 ? (
                  <p className="admin-empty-text">Waiting for real-time edge activity...</p>
                ) : (
                  <div className="admin-mini-list">
                    {systemEvents.slice(0, 5).map((evt) => (
                      <div className="admin-mini-item" key={evt.id} style={{ fontSize: "0.85rem" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ color: "#e2e8f0" }}>{evt.message}</span>
                          <span style={{ fontSize: "0.75rem", color: "#777d84" }}>{evt.timestamp}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Existing Recent Users & Tasks Panels */}
            <div className="admin-panels-grid">
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <h3>Recent Users</h3>
                  <button onClick={() => navigate("/admin/users")}>
                    View All
                  </button>
                </div>

                {recentUsers.length === 0 ? (
                  <p className="admin-empty-text">No users found.</p>
                ) : (
                  <div className="admin-mini-list">
                    {recentUsers.map((user) => (
                      <div className="admin-mini-item" key={user._id}>
                        <div className="admin-mini-avatar">
                          {user.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>

                        <div>
                          <h4>{user.name}</h4>
                          <p>{user.email}</p>
                        </div>

                        <span>{user.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="admin-panel">
                <div className="admin-panel-header">
                  <h3>Recent Tasks</h3>
                  <button onClick={() => navigate("/admin/tasks")}>
                    View All
                  </button>
                </div>

                {recentTasks.length === 0 ? (
                  <p className="admin-empty-text">No tasks found.</p>
                ) : (
                  <div className="admin-mini-list">
                    {recentTasks.map((task) => (
                      <div className="admin-mini-item task" key={task._id}>
                        <div>
                          <h4>{task.targetUrl || "Testing Task"}</h4>
                          <p>{task.serviceType}</p>
                        </div>

                        <span className={`task-status ${task.status}`}>
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminDashboard;
