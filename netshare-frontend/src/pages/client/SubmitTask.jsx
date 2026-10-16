import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Globe2, MapPin, Zap, ArrowLeft, RefreshCw } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import ClientLayout from "../../layouts/ClientLayout";
import RegionAvailabilityPanel from "../../components/client/RegionAvailabilityPanel";
import { useRegionAvailability } from "../../hooks/useRegionAvailability";
import { isPublicDataFetchEnabled } from "./publicDataFetchView.js";
import { isBrowserPageInspectEnabled } from "./browserPageInspectView.js";
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
  const [publicFetchEnabled, setPublicFetchEnabled] = useState(false);
  const [browserInspectEnabled, setBrowserInspectEnabled] = useState(false);
  const [viewport, setViewport] = useState("1365x768");
  const [pageLoadTimeoutMs, setPageLoadTimeoutMs] = useState(15000);
  const [captureScreenshot, setCaptureScreenshot] = useState(true);

  useEffect(() => {
    let active = true;
    axiosInstance.get("/tasks/capabilities")
      .then((response) => {
        if (active) setPublicFetchEnabled(isPublicDataFetchEnabled(response.data));
        if (active) setBrowserInspectEnabled(isBrowserPageInspectEnabled(response.data));
      })
      .catch(() => {
        if (active) setPublicFetchEnabled(false);
        if (active) setBrowserInspectEnabled(false);
      });
    return () => { active = false; };
  }, []);

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
        if (
          !Number.isFinite(res.data?.quote?.totalCredits) ||
          res.data.quote.totalCredits < 1
        ) {
          throw new Error("Invalid price estimate");
        }
        setPricing(res.data.quote);
        setQuoteError("");
      } catch (requestError) {
        if (requestError.code !== "ERR_CANCELED") {
          setPricing(null);
          setQuoteError(
            requestError.response?.data?.message ||
              "Price estimate could not be loaded."
          );
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
      const nextLimit =
        e.target.name === "executionLimit"
          ? Number(e.target.value)
          : Number(form.executionLimit);
      setQuoteLoading(
        Number.isInteger(nextLimit) && nextLimit >= 1 && nextLimit <= 100
      );
    }
    const nextForm = {
      ...form,
      [e.target.name]: e.target.value,
    };
    if (e.target.name === "serviceType" && e.target.value === "PUBLIC_DATA_FETCH") {
      nextForm.executionLimit = 1;
    }
    if (e.target.name === "serviceType" && e.target.value === "BROWSER_PAGE_INSPECT") {
      nextForm.executionLimit = 1;
    }
    setForm(nextForm);
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
    if (form.serviceType === "PUBLIC_DATA_FETCH" && !publicFetchEnabled) {
      setError("Public Data Fetch is not enabled by the backend.");
      return;
    }
    if (form.serviceType === "BROWSER_PAGE_INSPECT" && !browserInspectEnabled) {
      setError("Browser Page Inspect is coming soon and is not enabled by the backend.");
      return;
    }
    let targetUrl;
    try {
      targetUrl = new URL(form.targetUrl.trim());
      if (
        !["http:", "https:"].includes(targetUrl.protocol) ||
        targetUrl.username ||
        targetUrl.password
      ) {
        throw new Error("Invalid task URL");
      }
      if (form.serviceType === "PUBLIC_DATA_FETCH" &&
          (targetUrl.protocol !== "https:" || targetUrl.port && targetUrl.port !== "443" ||
           Number(form.executionLimit) !== 1)) {
        throw new Error("Public Data Fetch requires one HTTPS request on port 443.");
      }
      if (form.serviceType === "BROWSER_PAGE_INSPECT" &&
          (targetUrl.protocol !== "https:" || (targetUrl.port && targetUrl.port !== "443") ||
           Number(form.executionLimit) !== 1)) {
        throw new Error("Browser Page Inspect requires one public HTTPS request on port 443.");
      }
    } catch {
      setError("Enter a valid public HTTP or HTTPS URL without embedded credentials.");
      return;
    }
    setLoading(true);

    try {
      const browserOption = viewport.split("x").map(Number);
      const res = await axiosInstance.post("/tasks", {
        ...form,
        targetUrl: targetUrl.toString(),
        executionLimit: Number(form.executionLimit),
        ...(form.serviceType === "BROWSER_PAGE_INSPECT" ? {
          browserPageInspect: {
            contractVersion: 1,
            viewport: { width: browserOption[0], height: browserOption[1], deviceScaleFactor: 1 },
            pageLoadTimeoutMs: Number(pageLoadTimeoutMs),
            maxTextBytes: 32768,
            captureScreenshot,
          },
        } : {}),
      });

      setMessage(res.data.message || "Task submitted successfully");

      setTimeout(() => {
        navigate("/client/tasks");
      }, 1200);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (err.response
            ? "Task submission failed. Please retry."
            : "Cannot reach the backend. Check its connection and retry.")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClientLayout pageTitle="Submit Task" pageSubtitle="">
      <div className="ps-submit-page">
        {/* Top Header Row with Back Button */}
        <div className="ps-page-header">
          <div>
            <h1 className="ps-page-title">Submit Testing Task</h1>
            <p className="ps-page-subtitle">
              Dispatch an automated HTTP testing run to an active residential node.
            </p>
          </div>
          <button
            type="button"
            className="ps-btn-dark"
            onClick={() => navigate("/client/dashboard")}
          >
            <ArrowLeft size={15} />
            <span>Back to Dashboard</span>
          </button>
        </div>

        {/* Full-width task form followed by regional and pricing details */}
        <div className="ps-submit-grid">
          {/* Left Form Card */}
          <div className="ps-card ps-submit-form-card">
            <div className="ps-submit-form-header">
              <div className="ps-submit-form-heading">
                <span className="ps-submit-form-icon"><Globe2 size={17} /></span>
                <div>
                  <span className="ps-submit-form-kicker">TASK CONFIGURATION</span>
                  <h2>Set up your test</h2>
                </div>
              </div>
              <span className="ps-submit-form-badge">PUBLIC URL ONLY</span>
            </div>

            {message && <div className="ps-alert success">{message}</div>}
            {error && <div className="ps-alert error">{error}</div>}
            {quoteError && (
              <div className="ps-alert error">
                <span>{quoteError}</span>
                <button
                  type="button"
                  className="ps-btn-dark"
                  style={{ height: 30, padding: "0 10px", fontSize: 11 }}
                  onClick={() => {
                    setQuoteLoading(true);
                    setQuoteRetry((v) => v + 1);
                  }}
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            )}

            <form onSubmit={handleSubmitTask}>
              <div className="ps-submit-fields-grid">
              {/* Target URL */}
              <div className="ps-form-group ps-submit-field-url">
                <label htmlFor="task-target-url">{form.serviceType === "BROWSER_PAGE_INSPECT" ? "Public HTTPS URL" : "Target URL (HTTP / HTTPS)"}</label>
                <div className="ps-input-with-icon">
                  <Globe2 size={16} className="ps-field-icon" />
                  <input
                    id="task-target-url"
                    type="url"
                    name="targetUrl"
                    placeholder="https://example.com"
                    value={form.targetUrl}
                    onChange={handleChange}
                    className="ps-input"
                    required
                  />
                </div>
                <small>Public URL to test. Credentials not permitted.</small>
              </div>

              {/* Service Type */}
              <div className="ps-form-group ps-submit-field-service">
                <label htmlFor="task-service-type">Supported Testing Service</label>
                <select
                  id="task-service-type"
                  name="serviceType"
                  value={form.serviceType}
                  onChange={handleChange}
                  className="ps-select"
                >
                  <option value="accessibility_testing">
                    Regional Accessibility (Public HTTP availability check)
                  </option>
                  <option value="performance_testing">
                    Website Performance (Response latency &amp; size benchmark)
                  </option>
                  <option value="localization_testing">
                    Basic Localization (Regional localized response audit)
                  </option>
                  <option value="PUBLIC_DATA_FETCH" disabled={!publicFetchEnabled}>
                    Public Data Fetch{publicFetchEnabled ? " (16 KiB, text only)" : " (currently unavailable)"}
                  </option>
                  <option value="BROWSER_PAGE_INSPECT" disabled={!browserInspectEnabled}>
                    Browser Page Inspect{browserInspectEnabled ? " (one HTTPS page)" : " (Coming Soon)"}
                  </option>
                </select>
                <small>{form.serviceType === "BROWSER_PAGE_INSPECT"
                  ? "Browser rendering is gated by backend capability and remains unavailable until secure execution is ready."
                  : "Method is strictly GET. Executed through residential routing."}</small>
              </div>

              {!browserInspectEnabled && (
                <div className="ps-browser-coming-soon" role="status">
                  <div><strong>Browser Page Inspect · Coming Soon</strong><span>Secure browser execution is not enabled by the backend. These settings are prepared but cannot be submitted.</span></div>
                  <label>Viewport<select className="ps-select" value="1365x768" disabled onChange={() => {}}><option value="1365x768">1365 × 768</option></select></label>
                  <label>Page load timeout<select className="ps-select" value="15000" disabled onChange={() => {}}><option value="15000">15 seconds</option></select></label>
                  <label className="ps-browser-screenshot-toggle"><input type="checkbox" checked={captureScreenshot} disabled readOnly /> Include screenshot artifact</label>
                </div>
              )}

              {form.serviceType === "BROWSER_PAGE_INSPECT" && (
                <>
                  <div className="ps-form-group">
                    <label htmlFor="browser-viewport">Viewport</label>
                    <select id="browser-viewport" className="ps-select" value={viewport} onChange={(event) => setViewport(event.target.value)}>
                      <option value="1280x720">1280 × 720</option>
                      <option value="1365x768">1365 × 768</option>
                      <option value="1920x1080">1920 × 1080</option>
                    </select>
                  </div>
                  <div className="ps-form-group">
                    <label htmlFor="browser-timeout">Page load timeout</label>
                    <select id="browser-timeout" className="ps-select" value={pageLoadTimeoutMs} onChange={(event) => setPageLoadTimeoutMs(event.target.value)}>
                      {[5000, 10000, 15000, 20000].map((value) => <option key={value} value={value}>{value / 1000} seconds</option>)}
                    </select>
                  </div>
                  <label className="ps-browser-screenshot-toggle"><input type="checkbox" checked={captureScreenshot} onChange={(event) => setCaptureScreenshot(event.target.checked)} /> Include screenshot artifact</label>
                </>
              )}

              {/* Region Selection */}
              <div className="ps-form-group ps-submit-field-region">
                <label htmlFor="task-target-region">Target Execution Region</label>
                <div className="ps-input-with-icon">
                  <MapPin size={16} className="ps-field-icon" />
                  <select
                    id="task-target-region"
                    name="targetRegion"
                    value={form.targetRegion}
                    onChange={handleChange}
                    className="ps-select"
                  >
                    <option value="Pakistan">Pakistan</option>
                    <option value="UAE">UAE</option>
                    <option value="USA">USA</option>
                    <option value="UK">UK</option>
                    <option value="India">India</option>
                  </select>
                </div>
              </div>

              {/* Execution Limit */}
              <div className="ps-form-group ps-submit-field-limit">
                <label htmlFor="task-execution-limit">Execution Count (1 – 100)</label>
                <div className="ps-input-with-icon">
                  <Zap size={16} className="ps-field-icon" />
                  <input
                    id="task-execution-limit"
                    type="number"
                    name="executionLimit"
                    min="1"
                    max="100"
                    value={form.executionLimit}
                    disabled={form.serviceType === "PUBLIC_DATA_FETCH" || form.serviceType === "BROWSER_PAGE_INSPECT"}
                    onChange={handleChange}
                    className="ps-input"
                    required
                  />
                </div>
                <small>
                  {hasValidExecutionLimit && pricing
                    ? `${pricing.formula || "Standard formula"}; ${pricing.perExecutionCredits} credits per run`
                    : "Price dynamically calculated from regional node availability."}
                </small>
              </div>

              <div className="ps-submit-actions">
                <button
                  type="submit"
                  disabled={
                    loading || quoteLoading || !pricing || !hasValidExecutionLimit ||
                    (form.serviceType === "BROWSER_PAGE_INSPECT" && !browserInspectEnabled)
                  }
                  className="ps-submit-button"
                >
                  <Send size={16} />
                  <span>{loading ? "Submitting..." : "Submit Task"}</span>
                </button>
              </div>
              </div>
            </form>
          </div>

          <section className="ps-run-overview" aria-label="Task run overview">
            <div className="ps-run-overview-heading">
              <div>
                <span className="ps-run-overview-eyebrow">LIVE RUN OVERVIEW</span>
                <h2>Regional run overview</h2>
              </div>
              <span className="ps-run-overview-live"><i /> Live estimate · updates with your settings</span>
            </div>

            <div className="ps-submit-support-grid">
              <div className="ps-overview-region">
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
              </div>

              <div className="ps-overview-cost">
              <div className="ps-card-decor" aria-hidden="true">
                <div className="ps-card-decor-outer" />
                <div className="ps-card-decor-inner" />
              </div>

              <div className="ps-card-header-clean">
                <h2 className="ps-card-title">Estimated Cost</h2>
                <span className="ps-meta-label">CREDIT SETTLEMENT</span>
              </div>

              <div className="ps-numeral" style={{ margin: "16px 0 10px" }}>
                {quoteLoading
                  ? "…"
                  : hasValidExecutionLimit
                  ? `${pricing?.totalCredits ?? "—"} credits`
                  : "—"}
              </div>

              <p className="ps-desc-text" style={{ fontSize: 13 }}>
                Credits are reserved immediately upon submission and settled upon
                verified task delivery.
              </p>
              </div>

              <div className="ps-overview-flow">
              <div className="ps-card-header-clean" style={{ marginBottom: 18 }}>
                <h3 className="ps-card-title">Task Execution Flow</h3>
                <span className="ps-meta-label">END-TO-END PIPELINE</span>
              </div>

              <div className="ps-flow-steps">
                <div className="ps-flow-step-item">
                  <span className="ps-step-num">01</span>
                  <div>
                    <strong>Quote Lock</strong>
                    <p>Price derived from real regional demand and node quality.</p>
                  </div>
                </div>

                <div className="ps-flow-step-item">
                  <span className="ps-step-num">02</span>
                  <div>
                    <strong>Node Assignment</strong>
                    <p>System allocates an active verified node in {form.targetRegion}.</p>
                  </div>
                </div>

                <div className="ps-flow-step-item">
                  <span className="ps-step-num">03</span>
                  <div>
                    <strong>Encrypted Dispatch</strong>
                    <p>GET request executed with zero client/node IP exposure.</p>
                  </div>
                </div>

                <div className="ps-flow-step-item">
                  <span className="ps-step-num">04</span>
                  <div>
                    <strong>Results &amp; Settlement</strong>
                    <p>Response telemetry logged and credits finalized.</p>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </ClientLayout>
  );
}

export default SubmitTask;
