import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Globe2, MapPin, Zap } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import ClientLayout from "../../layouts/ClientLayout";
import RegionAvailabilityPanel from "../../components/client/RegionAvailabilityPanel";
import { useRegionAvailability } from "../../hooks/useRegionAvailability";
import "./SubmitTask.css";

function SubmitTask() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    targetUrl: "",
    method: "GET",
    serviceType: "accessibility_testing",
    targetRegion: "Pakistan",
    executionLimit: 5,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const availability = useRegionAvailability();
  const [pricing, setPricing] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState("");
  const [quoteRetry, setQuoteRetry] = useState(0);
  const hasValidExecutionLimit =
    Number.isInteger(Number(form.executionLimit)) &&
    Number(form.executionLimit) >= 1 &&
    Number(form.executionLimit) <= 100;

  useEffect(() => {
    const limit = Number(form.executionLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setQuoteLoading(true);
        const res = await axiosInstance.post(
          "/tasks/estimate",
          { targetRegion: form.targetRegion, executionLimit: limit },
          { signal: controller.signal }
        );
        if (!Number.isFinite(res.data?.quote?.totalCredits) || res.data.quote.totalCredits < 1) {
          throw new Error("Invalid price estimate");
        }
        setPricing(res.data.quote);
        setQuoteError("");
      } catch (requestError) {
        if (requestError.code !== "ERR_CANCELED") {
          setPricing(null);
          setQuoteError(requestError.response?.data?.message || "Price estimate could not be loaded.");
        }
      } finally {
        if (!controller.signal.aborted) setQuoteLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.executionLimit, form.targetRegion, quoteRetry]);

  const handleChange = (e) => {
    if (e.target.name === "targetRegion" || e.target.name === "executionLimit") {
      setPricing(null);
      setQuoteError("");
      const nextLimit = e.target.name === "executionLimit" ? Number(e.target.value) : Number(form.executionLimit);
      setQuoteLoading(Number.isInteger(nextLimit) && nextLimit >= 1 && nextLimit <= 100);
    }
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    if (loading) return;
    setMessage("");
    setError("");
    if (!pricing || quoteLoading || !hasValidExecutionLimit) {
      setError("Wait for a valid price estimate before submitting.");
      return;
    }
    let targetUrl;
    try {
      targetUrl = new URL(form.targetUrl.trim());
      if (!["http:", "https:"].includes(targetUrl.protocol) || targetUrl.username || targetUrl.password) {
        throw new Error("Invalid task URL");
      }
    } catch {
      setError("Enter a public HTTP or HTTPS URL without embedded credentials.");
      return;
    }
    setLoading(true);

    try {
      const res = await axiosInstance.post("/tasks", {
        ...form,
        targetUrl: targetUrl.toString(),
        executionLimit: Number(form.executionLimit),
      });

      setMessage(res.data.message || "Task submitted successfully");

      setTimeout(() => {
        navigate("/client/tasks");
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message ||
        (err.response ? "Task submission failed. Please retry." : "Cannot reach the backend. Check its connection and retry."));
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
            <h2>
              {quoteLoading
                ? "…"
                : hasValidExecutionLimit
                  ? pricing?.totalCredits ?? "—"
                  : "—"}
            </h2>
            <span>credits</span>
          </div>
        </div>

        <div className="submit-grid">
          <form className="submit-form-card" onSubmit={handleSubmitTask}>
            {message && <div className="success-alert">{message}</div>}
            {error && <div className="error-alert">{error}</div>}
            {quoteError && (
              <div className="error-alert" role="status">
                {quoteError}{" "}
                <button type="button" className="quote-retry-btn" onClick={() => {
                  setQuoteLoading(true);
                  setQuoteRetry((value) => value + 1);
                }}>Retry estimate</button>
              </div>
            )}

            <div className="task-field">
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

            <div className="task-field">
              <label>Service Type</label>
              <p>HTTP method: GET only. Tests observe the HTTP response from the selected node region.</p>
              <select
                name="serviceType"
                value={form.serviceType}
                onChange={handleChange}
              >
                <option value="accessibility_testing">Accessibility Testing</option>
                <option value="localization_testing">Localization response language</option>
                <option value="performance_testing">HTTP response performance</option>
              </select>
            </div>

            <div className="task-field">
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

            <RegionAvailabilityPanel
              compact
              selectedRegion={form.targetRegion}
              availability={availability.regions}
              loading={availability.loading}
              refreshing={availability.refreshing}
              error={availability.error}
              lastUpdated={availability.lastUpdated}
              stale={availability.stale}
            />

            <div className="task-field">
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
              <small>
                {hasValidExecutionLimit && pricing
                  ? `${pricing.formula}; ${pricing.perExecutionCredits} credits per execution`
                  : "Price is calculated by the platform from current capacity and quality."}
              </small>
            </div>

            <button className="submit-task-btn" type="submit" disabled={loading || quoteLoading || !pricing || !hasValidExecutionLimit}>
              {loading ? "Submitting..." : "Submit Task"}
              <Send size={18} />
            </button>
          </form>

          <div className="submit-info-card">
            <h3>Pricing & Task Flow</h3>

            <div className="flow-step">
              <span>01</span>
              <div>
                <h4>Live Quote</h4>
                <p>
                  Price uses node availability, regional demand, latency,
                  reliability, and the platform region factor.
                </p>
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
                <p>The quoted client cost is charged at submission. Node rewards are credited once after successful execution.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}

export default SubmitTask;
