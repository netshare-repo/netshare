import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCcw, Search, ExternalLink, Star } from "lucide-react";
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
    const refresh = () => axiosInstance
      .get("/tasks/my-tasks")
      .then((res) => {
        if (active) setTasks(res.data.tasks || []);
      })
      .catch((error) => {
        if (active) setActionMessage(error.response?.data?.message || 'Could not refresh task status');
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
          task.targetRegion.toLowerCase().includes(search.toLowerCase())
      );
    }

    return data;
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
          {actionMessage && <div className="task-action-message">{actionMessage}</div>}
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
                    <th>Report & Rating</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="empty-cell">
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
                        <td>
                          {["completed", "settled"].includes(task.status) ? (
                            <div className="task-actions">
                              <button
                                type="button"
                                onClick={() => downloadReport(task)}
                                title="Download CSV report"
                              >
                                <Download size={15} /> CSV
                              </button>
                              {task.clientRating?.rating ? (
                                <span className="rated-label">
                                  <Star size={14} fill="currentColor" />
                                  {task.clientRating.rating}/5
                                </span>
                              ) : (
                                <div className="rating-control">
                                  <select
                                    aria-label={`Rate node for task ${task._id}`}
                                    value={ratings[task._id] || 5}
                                    onChange={(event) =>
                                      setRatings((current) => ({
                                        ...current,
                                        [task._id]: event.target.value,
                                      }))
                                    }
                                  >
                                    {[5, 4, 3, 2, 1].map((value) => (
                                      <option key={value} value={value}>
                                        {value}/5
                                      </option>
                                    ))}
                                  </select>
                                  <button type="button" onClick={() => submitRating(task)}>
                                    <Star size={15} /> Rate
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="action-pending">Available when complete</span>
                          )}
                        </td>
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
