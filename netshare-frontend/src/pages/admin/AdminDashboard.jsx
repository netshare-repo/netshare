import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Server,
  ListChecks,
  Wallet,
  Activity,
  CheckCircle2,
  Store,
  PackageCheck,
  RefreshCw,
  Radio,
  Globe,
  AlertTriangle,
  Zap,
} from "lucide-react";
import AdminLayout from "../../layouts/AdminLayout";
import {
  getAdminDashboard,
  getAdminUsers,
  getAdminNodes,
  getAdminTasks,
  getAdminTransactions,
} from "../../api/adminApi";
import { useSocket } from "../../context/SocketContext";
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

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setMessage("");

      let dashboardData = null;

      try {
        dashboardData = await getAdminDashboard();
      } catch (_) {
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
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // Compute live regional distribution
  const regionalDistribution = nodesList.reduce((acc, node) => {
    const region = node.region || "Global";
    acc[region] = (acc[region] || 0) + 1;
    return acc;
  }, {});

  const statCards = [
    {
      title: "Execution Plane Sockets",
      value: `${liveNodes.length} Live`,
      icon: Radio,
      color: isSocketConnected ? "#10b981" : "#64748b",
    },
    {
      title: "Active DB Nodes",
      value: stats.activeNodes,
      icon: Activity,
      color: "#16a34a",
    },
    {
      title: "Total Registered Nodes",
      value: stats.totalNodes,
      icon: Server,
      color: "#7c3aed",
    },
    {
      title: "Active Tasks",
      value: stats.activeTasks,
      icon: Zap,
      color: "#0ea5e9",
    },
    {
      title: "Completed Tasks",
      value: stats.completedTasks,
      icon: CheckCircle2,
      color: "#22c55e",
    },
    {
      title: "Failed Tasks",
      value: stats.failedTasks,
      icon: AlertTriangle,
      color: stats.failedTasks > 0 ? "#ef4444" : "#94a3b8",
    },
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "#2563eb",
    },
    {
      title: "Credits Issued",
      value: stats.totalCreditsIssued,
      icon: Wallet,
      color: "#059669",
    },
  ];

  return (
    <AdminLayout>
      <div className="admin-dashboard-page">
        <div className="admin-dashboard-hero">
          <div>
            <h2>Distributed Control & Execution Plane Overview</h2>
            <p>
              Real-time monitoring of connected edge node agents, task queues,
              telemetry metrics, and decentralized bandwidth distribution.
            </p>
          </div>

          <button onClick={loadDashboard}>
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        {message && <div className="admin-dashboard-message">{message}</div>}

        {loading ? (
          <div className="admin-dashboard-loading">Loading dashboard...</div>
        ) : (
          <>
            <div className="admin-stats-grid">
              {statCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div className="admin-stat-card" key={card.title}>
                    <div
                      className="admin-stat-icon"
                      style={{ backgroundColor: `${card.color}18` }}
                    >
                      <Icon size={24} color={card.color} />
                    </div>

                    <div>
                      <h3>{card.value}</h3>
                      <p>{card.title}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Nav */}
            <div className="admin-quick-grid">
              <button onClick={() => navigate("/admin/users")}>
                <Users size={22} />
                Manage Users
              </button>

              <button onClick={() => navigate("/admin/nodes")}>
                <Server size={22} />
                Manage Nodes
              </button>

              <button onClick={() => navigate("/admin/tasks")}>
                <ListChecks size={22} />
                Manage Tasks
              </button>

              <button onClick={() => navigate("/admin/transactions")}>
                <Wallet size={22} />
                Transactions
              </button>

              <button onClick={() => navigate("/admin/marketplace/products")}>
                <Store size={22} />
                Marketplace Products
              </button>

              <button onClick={() => navigate("/admin/marketplace/orders")}>
                <PackageCheck size={22} />
                Marketplace Orders
              </button>
            </div>

            {/* Live Regional Map & Real-time Activity Feeds */}
            <div className="admin-panels-grid" style={{ marginBottom: "1.5rem" }}>
              {/* Regional Node Distribution */}
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Globe size={18} color="#0ea5e9" />
                    <h3>Live Node Regional Distribution</h3>
                  </div>
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
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
                            <div style={{ width: `${percent}%`, height: "100%", background: "#0ea5e9", borderRadius: "3px" }} />
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
                    <Radio size={18} color={isSocketConnected ? "#10b981" : "#64748b"} className={isSocketConnected ? "animate-pulse" : ""} />
                    <h3>Real-Time System Activity Ticker</h3>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: isSocketConnected ? "#10b981" : "#64748b" }}>
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
                          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{evt.timestamp}</span>
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