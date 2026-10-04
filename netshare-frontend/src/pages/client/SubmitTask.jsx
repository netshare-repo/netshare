import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Globe2, MapPin, Zap } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import ClientLayout from "../../layouts/ClientLayout";
import "./SubmitTask.css";

function SubmitTask() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    targetUrl: "",
    serviceType: "accessibility_testing",
    targetRegion: "Pakistan",
    executionLimit: 5,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const estimatedCost = Number(form.executionLimit || 0) * 10;

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const res = await axiosInstance.post("/tasks", {
        ...form,
        executionLimit: Number(form.executionLimit),
      });

      setMessage(res.data.message || "Task submitted successfully");

      setTimeout(() => {
        navigate("/client/tasks");
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Task submission failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClientLayout>
      <div className="submit-task-page">
        <button className="back-btn" onClick={() => navigate("/client/dashboard")}>
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <div className="submit-task-hero">
          <div>
            <span className="submit-pill">New Testing Task</span>
            <h1>Submit Testing Task</h1>
            <p>
              Create a controlled internet testing task. The backend will select
              an active node using region and availability rules.
            </p>
          </div>

          <div className="cost-card">
            <p>Estimated Cost</p>
            <h2>{estimatedCost}</h2>
            <span>credits</span>
          </div>
        </div>

        <div className="submit-grid">
          <form className="submit-form-card" onSubmit={handleSubmitTask}>
            {message && <div className="success-alert">{message}</div>}
            {error && <div className="error-alert">{error}</div>}

            <div className="form-group">
              <label>Target URL</label>
              <div className="input-icon-box">
                <Globe2 size={18} />
                <input
                  type="url"
                  name="targetUrl"
                  placeholder="https://example.com"
                  value={form.targetUrl}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Service Type</label>
              <select
                name="serviceType"
                value={form.serviceType}
                onChange={handleChange}
              >
                <option value="accessibility_testing">Accessibility Testing</option>
                <option value="ad_verification">Ad Verification</option>
                <option value="localization_testing">Localization Testing</option>
                <option value="performance_testing">Performance Testing</option>
              </select>
            </div>

            <div className="form-group">
              <label>Target Region</label>
              <div className="input-icon-box">
                <MapPin size={18} />
                <select
                  name="targetRegion"
                  value={form.targetRegion}
                  onChange={handleChange}
                >
                  <option value="Pakistan">Pakistan</option>
                  <option value="UAE">UAE</option>
                  <option value="USA">USA</option>
                  <option value="UK">UK</option>
                  <option value="India">India</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Execution Limit</label>
              <div className="input-icon-box">
                <Zap size={18} />
                <input
                  type="number"
                  name="executionLimit"
                  min="1"
                  max="100"
                  value={form.executionLimit}
                  onChange={handleChange}
                  required
                />
              </div>
              <small>Cost formula for Phase-1: execution limit × 10 credits</small>
            </div>

            <button className="submit-task-btn" type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Task"}
              <Send size={18} />
            </button>
          </form>

          <div className="submit-info-card">
            <h3>Phase-1 Task Flow</h3>

            <div className="flow-step">
              <span>01</span>
              <div>
                <h4>Task Validation</h4>
                <p>Backend checks URL, task type, region, and wallet balance.</p>
              </div>
            </div>

            <div className="flow-step">
              <span>02</span>
              <div>
                <h4>Node Selection</h4>
                <p>System finds an active node from the selected region.</p>
              </div>
            </div>

            <div className="flow-step">
              <span>03</span>
              <div>
                <h4>Task Session</h4>
                <p>A backend-controlled secure session record is created.</p>
              </div>
            </div>

            <div className="flow-step">
              <span>04</span>
              <div>
                <h4>Credit Settlement</h4>
                <p>Client credits are deducted and node reward is added after completion.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}

export default SubmitTask;