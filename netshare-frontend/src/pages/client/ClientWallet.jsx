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
  const [loading, setLoading] = useState(true);

  const fetchWalletData = async () => {
    try {
      setLoading(true);

      const walletRes = await axiosInstance.get("/wallet");
      setWallet(walletRes.data.wallet);

      const txRes = await axiosInstance.get("/wallet/transactions");
      setTransactions(txRes.data.transactions || []);
    } catch (error) {
      console.log("Wallet error:", error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

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
              history for Phase-1 testing tasks.
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
              <h3>Phase-1 Credit Rules</h3>

              <div className="rule-box">
                <span>01</span>
                <p>Client receives demo credits during registration.</p>
              </div>

              <div className="rule-box">
                <span>02</span>
                <p>Task cost = execution limit × 10 credits.</p>
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
              <h3>Payment Status</h3>
              <p>
                Real top-up, withdrawal, and payment gateway are not included in
                Phase-1. This wallet is used for backend-controlled demo credit
                settlement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}

export default ClientWallet;