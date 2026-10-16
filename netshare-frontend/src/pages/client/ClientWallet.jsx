import { useEffect, useState } from "react";
import { RefreshCcw, Plus, X } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import ClientLayout from "../../layouts/ClientLayout";
import "./ClientWallet.css";

function ClientWallet() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [topUps, setTopUps] = useState([]);
  const [topUpForm, setTopUpForm] = useState({
    amount: "",
    paymentMethod: "bank_transfer",
    referenceNumber: "",
  });
  const [proof, setProof] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchWalletData = async () => {
    try {
      setLoading(true);

      const walletRes = await axiosInstance.get("/wallet");
      setWallet(walletRes.data.wallet);

      const txRes = await axiosInstance.get("/wallet/transactions");
      setTransactions(txRes.data.transactions || []);
      const topUpRes = await axiosInstance.get("/wallet/top-ups");
      setTopUps(topUpRes.data.requests || []);
    } catch (error) {
      console.log("Wallet error:", error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchWalletData, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!topUpOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !paymentBusy) setTopUpOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [topUpOpen, paymentBusy]);

  const submitTopUp = async (event) => {
    event.preventDefault();
    setPaymentMessage("");
    if (
      !proof ||
      proof.size > 2 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "application/pdf"].includes(proof.type)
    ) {
      setPaymentMessage("Choose a PNG, JPEG, or PDF proof no larger than 2 MB.");
      return;
    }
    setPaymentBusy(true);
    try {
      const proofBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read payment proof"));
        reader.readAsDataURL(proof);
      });
      await axiosInstance.post("/wallet/top-ups", {
        amount: Number(topUpForm.amount),
        paymentMethod: topUpForm.paymentMethod,
        referenceNumber: topUpForm.referenceNumber,
        proofMime: proof.type,
        proofBase64,
      });
      setPaymentMessage(
        "Top-up submitted for manual verification. Your wallet is not credited yet."
      );
      setTopUpForm({
        amount: "",
        paymentMethod: "bank_transfer",
        referenceNumber: "",
      });
      setProof(null);
      setTopUpOpen(false);
      await fetchWalletData();
    } catch (error) {
      setPaymentMessage(error.response?.data?.message || error.message);
    } finally {
      setPaymentBusy(false);
    }
  };

  const pendingTopUpsCount = topUps.filter(
    (t) => t.status === "pending"
  ).length;

  return (
    <ClientLayout pageTitle="Wallet & Billing" pageSubtitle="">
      <div className="ps-wallet-page">
        {/* Top Header */}
        <div className="ps-page-header">
          <div>
            <h1 className="ps-page-title">Wallet &amp; Billing</h1>
            <p className="ps-page-subtitle">
              Manage your NetShare credits, manual top-up requests, and ledger
              audit history.
            </p>
          </div>

          <button
            type="button"
            className="ps-btn-dark"
            onClick={fetchWalletData}
            title="Refresh balance"
          >
            <RefreshCcw size={14} />
            <span>Refresh</span>
          </button>
        </div>

        {paymentMessage && (
          <div className="ps-alert success">
            <span>{paymentMessage}</span>
          </div>
        )}

        {/* -------------------------------------------------------------
            ROW 1: THREE FINANCIAL CARDS
           ------------------------------------------------------------- */}
        <div className="ps-wallet-cards-row">
          {/* Available Credits Card */}
          <div className="ps-card ps-card-teal ps-hero-stat-card ps-wallet-balance-card">
            <div className="ps-card-decor" aria-hidden="true">
              <div className="ps-card-decor-outer" />
              <div className="ps-card-decor-inner" />
            </div>

            <div className="ps-card-header-clean">
              <h2 className="ps-card-title">Available Balance</h2>
              <span className="ps-meta-label">READY TO SPEND</span>
            </div>

            <div className="ps-numeral">
              {loading ? "--" : `${wallet?.balance ?? 0} credits`}
            </div>

            <span className="ps-desc-text">
              1 credit = 1 standard regional execution
            </span>
            <button
              type="button"
              className="ps-wallet-add-funds-button"
              onClick={() => setTopUpOpen(true)}
            >
              <Plus size={16} />
              <span>Add Funds</span>
            </button>
          </div>

          {/* Credits Consumed Card */}
          <div className="ps-card ps-card-violet ps-hero-stat-card">
            <div className="ps-card-decor" aria-hidden="true">
              <div className="ps-card-decor-outer" />
              <div className="ps-card-decor-inner" />
            </div>

            <div className="ps-card-header-clean">
              <h2 className="ps-card-title">Credits Consumed</h2>
              <span className="ps-meta-label">LIFETIME USAGE</span>
            </div>

            <div className="ps-numeral">
              {loading ? "--" : `${wallet?.spentCredits ?? 0} credits`}
            </div>

            <span className="ps-desc-text">Deducted on task submission</span>
          </div>

          {/* Pending Top-ups Card */}
          <div className="ps-card ps-card-amber ps-hero-stat-card">
            <div className="ps-card-decor" aria-hidden="true">
              <div className="ps-card-decor-outer" />
            </div>

            <div className="ps-card-header-clean">
              <h2 className="ps-card-title">Pending Top-Ups</h2>
              <span className="ps-meta-label">AWAITING REVIEW</span>
            </div>

            <div className="ps-numeral">
              {loading ? "--" : `${pendingTopUpsCount} requests`}
            </div>

            <span className="ps-desc-text">Manual verification in progress</span>
          </div>
        </div>

        {topUpOpen && (
          <div
            className="ps-topup-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !paymentBusy) {
                setTopUpOpen(false);
              }
            }}
          >
            <section
              className="ps-card ps-topup-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="topup-modal-title"
            >
              <div className="ps-topup-modal-header">
                <div>
                  <span className="ps-meta-label">MANUAL VERIFICATION</span>
                  <h2 id="topup-modal-title">Add funds</h2>
                  <p>Enter payment details and attach your receipt.</p>
                </div>
                <button
                  type="button"
                  className="ps-topup-modal-close"
                  aria-label="Close add funds dialog"
                  onClick={() => setTopUpOpen(false)}
                  disabled={paymentBusy}
                >
                  <X size={18} />
                </button>
              </div>

              <form className="ps-topup-form" onSubmit={submitTopUp}>
                <div className="ps-form-group">
                  <label>Credits Requested</label>
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    placeholder="e.g. 500"
                    value={topUpForm.amount}
                    onChange={(e) =>
                      setTopUpForm({ ...topUpForm, amount: e.target.value })
                    }
                    className="ps-input"
                    required
                  />
                </div>

                <div className="ps-form-group">
                  <label>Payment Method</label>
                  <select
                    value={topUpForm.paymentMethod}
                    onChange={(e) =>
                      setTopUpForm({ ...topUpForm, paymentMethod: e.target.value })
                    }
                    className="ps-select"
                  >
                    <option value="bank_transfer">Bank Transfer (IBAN)</option>
                    <option value="easypaisa">Easypaisa Wallet</option>
                    <option value="jazzcash">JazzCash Wallet</option>
                  </select>
                </div>

                <div className="ps-form-group ps-topup-reference">
                  <label>Transaction Reference ID</label>
                  <input
                    type="text"
                    required
                    minLength={6}
                    maxLength={64}
                    placeholder="e.g. TRX-98234-871"
                    value={topUpForm.referenceNumber}
                    onChange={(e) =>
                      setTopUpForm({ ...topUpForm, referenceNumber: e.target.value })
                    }
                    className="ps-input"
                  />
                </div>

                <div className="ps-form-group ps-topup-proof">
                  <label>Payment Receipt (PNG, JPEG or PDF ? max 2 MB)</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    required
                    onChange={(e) => setProof(e.target.files?.[0] || null)}
                    className="ps-input"
                  />
                </div>

                <div className="ps-topup-modal-actions">
                  <button
                    type="button"
                    className="ps-btn-dark"
                    onClick={() => setTopUpOpen(false)}
                    disabled={paymentBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={paymentBusy}
                    className="ps-wallet-add-funds-button"
                  >
                    <Plus size={16} />
                    <span>{paymentBusy ? "Submitting..." : "Submit Request"}</span>
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* -------------------------------------------------------------
            ROW 3: RECENT TOP-UP AUDIT TRAIL
           ------------------------------------------------------------- */}
        {topUps.length > 0 && (
          <div className="ps-card ps-table-panel-card">
            <div className="ps-card-header-clean" style={{ marginBottom: 18 }}>
              <h3 className="ps-card-title">Top-Up Request History</h3>
              <span className="ps-meta-label">MANUAL VERIFICATION AUDIT</span>
            </div>

            <div className="ps-table-wrapper">
              <table className="ps-data-table">
                <thead>
                  <tr>
                    <th>Credits</th>
                    <th>Payment Method</th>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Admin Note</th>
                  </tr>
                </thead>
                <tbody>
                  {topUps.map((item) => (
                    <tr key={item._id}>
                      <td style={{ fontWeight: 600, color: "#ffffff" }}>
                        +{item.amount} credits
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {item.paymentMethod?.replace(/_/g, " ")}
                      </td>
                      <td>
                        <code>{item.referenceNumber}</code>
                      </td>
                      <td>
                        <span className={`ps-badge ${item.status}`}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ color: "#92979d", fontSize: 12 }}>
                        {item.adminNote || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            ROW 4: FULL TRANSACTION LEDGER
           ------------------------------------------------------------- */}
        <section className="ps-wallet-ledger-section">
          <div className="ps-card ps-table-panel-card">
            <div className="ps-card-header-clean" style={{ marginBottom: 18 }}>
              <h3 className="ps-card-title">Transaction Ledger</h3>
              <span className="ps-meta-label">FULL DEBIT &amp; CREDIT LOG</span>
            </div>

            <div className="ps-table-wrapper">
              <table className="ps-data-table">
                <thead>
                  <tr>
                    <th style={{ width: "14%" }}>Type</th>
                    <th style={{ width: "42%" }}>Description</th>
                    <th style={{ width: "16%" }}>Amount</th>
                    <th style={{ width: "14%" }}>Status</th>
                    <th style={{ width: "14%" }}>Date</th>
                  </tr>
                </thead>

                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="ps-empty-state">
                        No transaction records found.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx._id}>
                        <td>
                          <span
                            className={`ps-badge ${
                              tx.type === "credit" ? "completed" : "active"
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td style={{ color: "#ffffff", fontWeight: 500 }}>
                          {tx.description}
                        </td>
                        <td>
                          <strong
                            style={{
                              color:
                                tx.type === "credit" ? "#10b981" : "#f43f5e",
                            }}
                          >
                            {tx.type === "credit" ? "+" : "-"}
                            {tx.amount} credits
                          </strong>
                        </td>
                        <td>
                          <span className={`ps-badge ${tx.status}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td style={{ color: "#92979d", fontSize: 12 }}>
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
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

export default ClientWallet;
