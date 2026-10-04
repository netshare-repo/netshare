import { useEffect, useState } from "react";
import {
  Wallet,
  Send,
  Activity,
  CheckCircle,
  ArrowUpRight,
  Globe2,
} from "lucide-react";
import { Link } from "react-router-dom";
import axiosInstance from "../../api/axiosInstance";
import ClientLayout from "../../layouts/ClientLayout";
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

  const fetchDashboardData = async () => {
    try {
      const dashboardRes = await axiosInstance.get("/tasks/client/dashboard");
      setDashboard(dashboardRes.data);

      const tasksRes = await axiosInstance.get("/tasks/my-tasks");
      setTasks(tasksRes.data.tasks || []);

      const walletRes = await axiosInstance.get("/wallet");
      setWallet(walletRes.data.wallet);
    } catch (error) {
      console.log("Dashboard error:", error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const stats = [
    {
      title: "Available Credits",
      value: wallet?.balance ?? dashboard.availableCredits ?? 0,
      icon: Wallet,
      color: "blue",
      text: "Credits ready to spend",
    },
    {
      title: "Submitted Tasks",
      value: tasks.length,
      icon: Send,
      color: "cyan",
      text: "Total submitted tasks",
    },
    {
      title: "Running Tasks",
      value: dashboard.activeTasks,
      icon: Activity,
      color: "orange",
      text: "Pending, assigned, running",
    },
    {
      title: "Completed Tasks",
      value: dashboard.completedTasks,
      icon: CheckCircle,
      color: "green",
      text: "Successfully completed",
    },
  ];

  if (loading) {
    return (
      <ClientLayout>
        <div className="client-loading">Loading dashboard...</div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="client-dashboard">
        <div className="dashboard-hero">
          <div>
            <span className="dashboard-pill">Platform Client Panel</span>
            <h1>Client Dashboard</h1>
            <p>
              Submit website testing tasks, monitor task status, and manage
              your NetShare credit balance.
            </p>
          </div>

          <Link to="/client/submit-task" className="hero-action-btn">
            Submit New Task <ArrowUpRight size={18} />
          </Link>
        </div>

        <div className="stats-grid">
          {stats.map((item) => {
            const Icon = item.icon;

            return (
              <div className={`stat-card ${item.color}`} key={item.title}>
                <div className="stat-top">
                  <div className="stat-icon">
                    <Icon size={22} />
                  </div>
                  <span>+ Phase 1</span>
                </div>

                <h3>{item.value}</h3>
                <p>{item.title}</p>
                <small>{item.text}</small>
              </div>
            );
          })}
        </div>

        <div className="dashboard-grid">
          <div className="tasks-panel">
            <div className="panel-header">
              <div>
                <h2>Recent Testing Tasks</h2>
                <p>Latest client submitted tasks</p>
              </div>
              <Link to="/client/tasks">View All</Link>
            </div>

           <div className="table-responsive">
  <table className="tasks-table">
    <thead>
      <tr>
        <th>Target URL</th>
        <th>Service</th>
        <th>Region</th>
        <th>Status</th>
        <th>Cost</th>
      </tr>
    </thead>

    <tbody>
      {tasks.length === 0 ? (
        <tr>
          <td colSpan="5" className="empty-cell">
            No task submitted yet.
          </td>
        </tr>
      ) : (
        tasks.slice(0, 5).map((task) => (
          <tr key={task._id}>
            <td>{task.targetUrl}</td>
            <td>{task.serviceType}</td>
            <td>{task.targetRegion}</td>
            <td>
              <span className={`status-badge ${task.status}`}>
                {task.status}
              </span>
            </td>
            <td>{task.estimatedCost} credits</td>
          </tr>
        ))
      )}
    </tbody>
  </table>
</div>
          </div>

          <div className="wallet-panel">
            <div className="wallet-card-main">
              <div className="wallet-icon-box">
                <Wallet size={28} />
              </div>

              <h2>Wallet Summary</h2>
              <p>Current credit balance</p>

              <h1>{wallet?.balance || 0}</h1>
              <span>NetShare Credits</span>

              <div className="wallet-mini-row">
                <div>
                  <small>Spent</small>
                  <h4>{wallet?.spentCredits || 0}</h4>
                </div>
                <div>
                  <small>Earned</small>
                  <h4>{wallet?.earnedCredits || 0}</h4>
                </div>
              </div>

              <Link to="/client/wallet" className="wallet-btn">
                View Transactions
              </Link>
            </div>

            <div className="network-card">
              <Globe2 size={28} />
              <h3>Distributed Network</h3>
              <p>
                Tasks are assigned to active node participants using
                backend-controlled simulation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}

export default ClientDashboard;