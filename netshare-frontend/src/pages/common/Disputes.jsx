import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import axios from "../../api/axiosInstance";
import { useAuth } from "../../context/authState";
import ClientLayout from "../../layouts/ClientLayout";
import NodeLayout from "../../layouts/NodeLayout";
import AdminLayout from "../../layouts/AdminLayout";
import "./Operations.css";
import "./Disputes.css";

export default function Disputes() {
  const { user } = useAuth();
  const Layout =
    user?.role === "admin"
      ? AdminLayout
      : user?.role === "node_participant"
        ? NodeLayout
        : ClientLayout;

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [type, setType] = useState("task");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await axios.get("/disputes", { params: { offset } });
      setItems(res.data.disputes || []);
      setTotal(res.data.total || 0);
      setError("");
    } catch {
      setError("Could not load disputes.");
    }
  }, [offset]);

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await axios.post("/disputes", {
        relatedType: type,
        relatedId: reference.trim(),
        description,
      });
      setReference("");
      setDescription("");
      setError("");
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not submit dispute.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout pageTitle="Disputes" pageSubtitle="">
      <main className="ps-disputes-page">
        <div className="ps-page-header">
          <div>
            <h1 className="ps-page-title">Dispute Management</h1>
            <p className="ps-page-subtitle">
              Submit and track formal audit reviews for tasks, orders, or billing transactions.
            </p>
          </div>
          <button type="button" onClick={refresh} className="ps-btn-dark">
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>

        {error && <div className="ps-alert error" role="alert">{error}</div>}

        <section className="ps-dispute-submit ps-card" aria-labelledby="dispute-submit-title">
          <div className="ps-dispute-section-head">
            <div>
              <span className="ps-dispute-kicker">CASE SUBMISSION</span>
              <h2 id="dispute-submit-title" className="ps-card-title">Open a Formal Dispute</h2>
              <p className="ps-dispute-intro">
                Link the transaction and explain what needs review. One active dispute is allowed per reference.
              </p>
            </div>
            <span className="ps-dispute-policy"><span aria-hidden="true" /> Secure review</span>
          </div>

          <form className="ps-dispute-form" onSubmit={submit}>
            <div className="ps-dispute-fields">
              <div className="ps-form-group ps-dispute-field">
                <label htmlFor="dispute-type">Reference category</label>
                <select id="dispute-type" value={type} onChange={(e) => setType(e.target.value)} className="ps-select">
                  <option value="task">Testing Task</option>
                  <option value="order">Marketplace Order</option>
                  <option value="topup">Credit Top-Up</option>
                  <option value="withdrawal">Withdrawal</option>
                </select>
              </div>
              <div className="ps-form-group ps-dispute-field">
                <label htmlFor="dispute-reference">24-character reference ID</label>
                <input
                  id="dispute-reference"
                  type="text"
                  required
                  maxLength={24}
                  pattern="[a-fA-F0-9]{24}"
                  placeholder="e.g. 64b8f3a9e1d2c4001a2b3c4d"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="ps-input"
                />
                <small>Find this ID in the relevant task, order, or payment record.</small>
              </div>
            </div>

            <div className="ps-form-group ps-dispute-field ps-dispute-notes">
              <label htmlFor="dispute-description">
                Dispute justification <span>10–2,000 characters</span>
              </label>
              <textarea
                id="dispute-description"
                required
                minLength={10}
                maxLength={2000}
                placeholder="Describe the issue, what you expected to happen, and any relevant details for the reviewer."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="ps-textarea"
              />
              <small className="ps-dispute-character-count">{description.length} / 2,000</small>
            </div>

            <div className="ps-dispute-form-footer">
              <span>Your case will appear below as soon as it is submitted.</span>
              <button type="submit" disabled={busy} className="ps-btn-white ps-dispute-submit-button">
                <Plus size={15} />
                <span>{busy ? "Submitting..." : "Submit Dispute Case"}</span>
              </button>
            </div>
          </form>
        </section>

        <section className="ps-dispute-ledger ps-card" aria-labelledby="dispute-ledger-title">
          <div className="ps-dispute-ledger-head">
            <div>
              <span className="ps-dispute-kicker">CASE HISTORY</span>
              <h2 id="dispute-ledger-title" className="ps-card-title">Dispute cases</h2>
            </div>
            <span className="ps-dispute-count">{total} {total === 1 ? "case" : "cases"}</span>
          </div>

          {!items.length ? (
            <div className="ps-dispute-empty">
              <span className="ps-dispute-empty-mark" aria-hidden="true">—</span>
              <div>
                <strong>No dispute cases yet</strong>
                <p>Submitted cases and their review updates will appear here.</p>
              </div>
            </div>
          ) : (
            <div className="ps-dispute-case-list">
              {items.map((item) => (
                <article key={item._id} className="ps-dispute-case">
                  <div className="ps-dispute-case-top">
                    <div className="ps-dispute-case-heading">
                      <span className="ps-dispute-case-type">{item.relatedType} dispute</span>
                      <code>Case {item._id}</code>
                    </div>
                    <span className={`ps-badge ${item.status}`}>{item.status}</span>
                  </div>

                  <div className="ps-dispute-reference-line">
                    <span>Reference ID</span>
                    <code>{item.relatedId}</code>
                  </div>

                  <p className="ps-dispute-description">{item.description}</p>

                  <div className="ps-dispute-resolution">
                    <div>
                      <span className="ps-dispute-detail-label">REVIEW UPDATE</span>
                      <p>{item.adminNote || "Awaiting administrative review"}</p>
                    </div>
                    <span className="ps-dispute-history-count">
                      {item.history?.length || 0} {item.history?.length === 1 ? "update" : "updates"}
                    </span>
                  </div>
                </article>
              ))}

              <div className="ps-dispute-pagination">
                <span>Showing {offset + 1}–{Math.min(offset + items.length, total)} of {total}</span>
                <div>
                  <button
                    type="button"
                    disabled={!offset}
                    onClick={() => setOffset(Math.max(0, offset - 50))}
                    className="ps-btn-dark"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={offset + 50 >= total}
                    onClick={() => setOffset(offset + 50)}
                    className="ps-btn-dark"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </Layout>
  );
}
