import { useEffect, useState } from "react";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCcw,
  CreditCard,
} from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import ClientLayout from "../../layouts/ClientLayout";
import "./ClientWallet.css";

function ClientWallet() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [topUps, setTopUps] = useState([]);
  const [topUpForm, setTopUpForm] = useState({ amount: "", paymentMethod: "bank_transfer", referenceNumber: "" });
  const [proof, setProof] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
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

  const submitTopUp = async (event) => {
    event.preventDefault();
    setPaymentMessage("");
    if (!proof || proof.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg", "application/pdf"].includes(proof.type)) {
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
        amount: Number(topUpForm.amount), paymentMethod: topUpForm.paymentMethod,
        referenceNumber: topUpForm.referenceNumber, proofMime: proof.type, proofBase64,
      });
      setPaymentMessage("Top-up submitted for manual verification. Your wallet is not credited yet.");
      setTopUpForm({ amount: "", paymentMethod: "bank_transfer", referenceNumber: "" });
      setProof(null);
      await fetchWalletData();
    } catch (error) {
      setPaymentMessage(error.response?.data?.message || error.message);
    } finally {
      setPaymentBusy(false);
    }
  };

  if (loading) {
    return (
      <ClientLayout>
        <div className="wallet-loading">Loading wallet...</div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="client-wallet-page">
        <div className="wallet-hero">
          <div>
            <span className="wallet-pill">Credit Management</span>
            <h1>Client Wallet</h1>
            <p>
              Track your available credits, task spending, and transaction
              history and manually verified payments.
            </p>
          </div>

          <button className="wallet-refresh-btn" onClick={fetchWalletData}>
            <RefreshCcw size={18} />
            Refresh
          </button>
        </div>

        <div className="wallet-summary-grid">
          <div className="wallet-main-card">
            <div className="wallet-main-icon">
              <Wallet size={30} />
            </div>

            <p>Available Balance</p>
            <h2>{wallet?.balance || 0}</h2>
            <span>NetShare Credits</span>
          </div>

          <div className="wallet-stat-card spent">
            <div className="wallet-stat-icon">
              <ArrowDownCircle size={25} />
            </div>
            <p>Credits Spent</p>
            <h3>{wallet?.spentCredits || 0}</h3>
            <span>Used for testing tasks</span>
          </div>

          <div className="wallet-stat-card earned">
            <div className="wallet-stat-icon">
              <ArrowUpCircle size={25} />
            </div>
            <p>Credits Earned</p>
            <h3>{wallet?.earnedCredits || 0}</h3>
            <span>Node reward credits</span>
          </div>
        </div>

        <div className="wallet-content-grid">
          <div className="transactions-card">
            <div className="wallet-section-header">
              <div>
                <h2>Transaction History</h2>
                <p>All wallet debit and credit records</p>
              </div>
            </div>

            <div className="table-responsive">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>

                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="empty-cell">
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx._id}>
                        <td>
                          <span className={`tx-type ${tx.type}`}>
                            {tx.type === "credit" ? (
                              <ArrowUpCircle size={16} />
                            ) : (
                              <ArrowDownCircle size={16} />
                            )}
                            {tx.type}
                          </span>
                        </td>

                        <td>{tx.description}</td>

                        <td>
                          <strong
                            className={
                              tx.type === "credit"
                                ? "amount-credit"
                                : "amount-debit"
                            }
                          >
                            {tx.type === "credit" ? "+" : "-"}
                            {tx.amount}
                          </strong>
                        </td>

                        <td>
                          <span className={`tx-status ${tx.status}`}>
                            {tx.status}
                          </span>
                        </td>

                        <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="wallet-info-panel">
            <div className="wallet-info-card">
              <CreditCard size={30} />
              <h3>Credit Rules</h3>

              <div className="rule-box">
                <span>01</span>
                <p>Client receives demo credits during registration.</p>
              </div>

              <div className="rule-box">
                <span>02</span>
                <p>Task prices are quoted before submission based on region, demand, availability, and quality.</p>
              </div>

              <div className="rule-box">
                <span>03</span>
                <p>Credits are deducted when a task is submitted.</p>
              </div>

              <div className="rule-box">
                <span>04</span>
                <p>Node participant receives reward after task completion.</p>
              </div>
            </div>

            <div className="wallet-note-card">
              <h3>Request a Top-Up</h3>
              <p>Pay using a supported local channel, then submit the exact reference and proof. An admin verifies payment before credits are added.</p>
              <form onSubmit={submitTopUp} className="payment-form">
                <label>Credits requested<input type="number" min="1" max="1000000" step="1" required value={topUpForm.amount} onChange={(event) => setTopUpForm({ ...topUpForm, amount: event.target.value })} /></label>
                <label>Payment method<select value={topUpForm.paymentMethod} onChange={(event) => setTopUpForm({ ...topUpForm, paymentMethod: event.target.value })}><option value="bank_transfer">Bank transfer</option><option value="easypaisa">Easypaisa</option><option value="jazzcash">JazzCash</option></select></label>
                <label>Payment reference<input required minLength="6" maxLength="64" value={topUpForm.referenceNumber} onChange={(event) => setTopUpForm({ ...topUpForm, referenceNumber: event.target.value })} /></label>
                <label>Payment proof<input type="file" accept="image/png,image/jpeg,application/pdf" required onChange={(event) => setProof(event.target.files?.[0] || null)} /></label>
                <button type="submit" disabled={paymentBusy}>{paymentBusy ? "Submitting..." : "Submit for verification"}</button>
              </form>
              {paymentMessage && <p role="status">{paymentMessage}</p>}
              <h3>Top-Up History</h3>
              {topUps.length === 0 ? <p>No top-up requests yet.</p> : <ul className="payment-history">{topUps.map((item) => <li key={item._id}>{item.amount} credits · {item.paymentMethod} · {item.referenceNumber} · {item.status}{item.adminNote ? ` · ${item.adminNote}` : ""}</li>)}</ul>}
            </div>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}

export default ClientWallet;
