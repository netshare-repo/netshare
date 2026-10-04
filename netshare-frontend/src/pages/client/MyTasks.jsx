import { useEffect, useState } from "react";
import { RefreshCcw, Search, ExternalLink } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import ClientLayout from "../../layouts/ClientLayout";
import "./MyTasks.css";

function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/tasks/my-tasks");
      setTasks(res.data.tasks || []);
      setFilteredTasks(res.data.tasks || []);
    } catch (error) {
      console.log("Tasks error:", error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    let data = [...tasks];

    if (status !== "all") {
      data = data.filter((task) => task.status === status);
    }

    if (search.trim()) {
      data = data.filter(
        (task) =>
          task.targetUrl.toLowerCase().includes(search.toLowerCase()) ||
          task.serviceType.toLowerCase().includes(search.toLowerCase()) ||
          task.targetRegion.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFilteredTasks(data);
  }, [search, status, tasks]);

  return (
    <ClientLayout>
      <div className="mytasks-page">
        <div className="mytasks-header">
          <div>
            <span className="mytasks-pill">Task Management</span>
            <h1>My Testing Tasks</h1>
            <p>Track submitted tasks, assigned nodes, cost, and current status.</p>
          </div>

          <button className="refresh-btn" onClick={fetchTasks}>
            <RefreshCcw size={18} />
            Refresh
          </button>
        </div>

        <div className="task-filters">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by URL, service, or region..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="mytasks-card">
          {loading ? (
            <div className="task-loading">Loading tasks...</div>
          ) : (
            <div className="table-responsive">
              <table className="mytasks-table">
                <thead>
                  <tr>
                    <th>Target URL</th>
                    <th>Service Type</th>
                    <th>Region</th>
                    <th>Status</th>
                    <th>Cost</th>
                    <th>Assigned Node</th>
                    <th>Created</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-cell">
                        No tasks found.
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => (
                      <tr key={task._id}>
                        <td>
                          <div className="url-cell">
                            <ExternalLink size={15} />
                            <span>{task.targetUrl}</span>
                          </div>
                        </td>
                        <td>{task.serviceType}</td>
                        <td>{task.targetRegion}</td>
                        <td>
                          <span className={`status-badge ${task.status}`}>
                            {task.status}
                          </span>
                        </td>
                        <td>{task.estimatedCost} credits</td>
                        <td>
                          {task.assignedNodeId
                            ? task.assignedNodeId.deviceName || "Assigned"
                            : "Not assigned"}
                        </td>
                        <td>{new Date(task.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ClientLayout>
  );
}

export default MyTasks;