import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Wallet as WalletIcon,
  TrendingUp,
  Award,
  ArrowDownLeft,
  ArrowUpRight,
  Store,
  Calendar,
  Receipt,
} from "lucide-react";
import NodeLayout from "../../layouts/NodeLayout";
import StatsCard from "../../components/common/StatsCard";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorMessage from "../../components/common/ErrorMessage";
import { getNodeTransactions, getNodeDashboard } from "../../api/nodeApi";
import axiosInstance from "../../api/axiosInstance";
import "./NodeWallet.css";

function NodeWallet() {
  const [walletData, setWalletData] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [withdrawals, setWithdrawals] = useState([]);
  const [eligibleBalance, setEligibleBalance] = useState(0);
  const [withdrawalForm, setWithdrawalForm] = useState({ amount: "", method: "bank_transfer", accountDetails: "" });
  const [withdrawalMessage, setWithdrawalMessage] = useState("");
  const [withdrawalBusy, setWithdrawalBusy] = useState(false);

  const fetchData = async () => {
    try {
      setError("");
      const [txRes, dashRes, walletRes, withdrawalRes] = await Promise.all([
        getNodeTransactions(),
        getNodeDashboard().catch(() => null),
        axiosInstance.get("/wallet"),
        axiosInstance.get("/wallet/withdrawals"),
      ]);
      setWalletData(txRes);
      setDashboardData(dashRes);
      setEligibleBalance(walletRes.data.eligibleWithdrawalBalance || 0);
      setWithdrawals(withdrawalRes.data.requests || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchData, 0);
    return () => clearTimeout(timer);
  }, []);

  const submitWithdrawal = async (event) => {
    event.preventDefault();
    setWithdrawalBusy(true);
    setWithdrawalMessage("");
    try {
      await axiosInstance.post("/wallet/withdrawals", {
        amount: Number(withdrawalForm.amount), method: withdrawalForm.method,
        accountDetails: withdrawalForm.accountDetails,
      });
      setWithdrawalMessage("Withdrawal submitted. Eligible credits are reserved while an admin reviews it.");
      setWithdrawalForm({ amount: "", method: "bank_transfer", accountDetails: "" });
      await fetchData();
    } catch (err) {
      setWithdrawalMessage(err.response?.data?.message || "Withdrawal request failed");
    } finally {
      setWithdrawalBusy(false);
    }
  };

  if (loading) {
    return (
      <NodeLayout>
        <LoadingSpinner text="Retrieving earnings and wallet ledger..." />
      </NodeLayout>
    );
  }

  const transactions = walletData?.transactions || [];

  return (
    <NodeLayout>
      <div className="node-wallet-page">
        {error && <ErrorMessage message={error} onRetry={fetchData} />}

        {/* Top Earnings Overview Cards */}
        <div className="wallet-metrics-grid">
          <StatsCard
            icon={WalletIcon}
            title="Current Credit Balance"
            value={`${walletData?.balance || 0} Credits`}
            subtitle="Available for marketplace redemption"
            badge="Available"
            badgeType="success"
            color="green"
          />

          <StatsCard
            icon={TrendingUp}
            title="Today's Earnings"
            value={`+${dashboardData?.creditsEarned || 0} Credits`}
            subtitle="Accrued from completed tasks today"
            badge="Today"
            badgeType="success"
            color="blue"
          />

          <StatsCard
            icon={Award}
            title="Lifetime Total Earned"
            value={`${walletData?.earnedCredits || walletData?.balance || 0} Credits`}
            subtitle="Historical cumulative bandwidth rewards"
            badge="Cumulative"
            badgeType="neutral"
            color="purple"
          />
        </div>

        <div className="wallet-ledger-card payment-panel">
          <h3>Request a Withdrawal</h3>
          <p>Eligible earned credits: {eligibleBalance}. Demo and top-up credits cannot be withdrawn. Payouts are manually verified and processed by an admin.</p>
          <form className="payment-form" onSubmit={submitWithdrawal}>
            <label>Credits to withdraw<input type="number" min="1" max="1000000" step="1" required value={withdrawalForm.amount} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, amount: event.target.value })} /></label>
            <label>Method<select value={withdrawalForm.method} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, method: event.target.value })}><option value="bank_transfer">Bank transfer</option><option value="easypaisa">Easypaisa</option><option value="jazzcash">JazzCash</option></select></label>
            <label>Account details<input required minLength="5" maxLength="120" autoComplete="off" value={withdrawalForm.accountDetails} onChange={(event) => setWithdrawalForm({ ...withdrawalForm, accountDetails: event.target.value })} /></label>
            <button type="submit" disabled={withdrawalBusy}>{withdrawalBusy ? "Submitting..." : "Request withdrawal"}</button>
          </form>
          {withdrawalMessage && <p role="status">{withdrawalMessage}</p>}
          <h3>Withdrawal History</h3>
          {withdrawals.length === 0 ? <p>No withdrawal requests yet.</p> : <ul className="payment-history">{withdrawals.map((item) => <li key={item._id}>{item.amount} credits · {item.method} · {item.status}{item.adminNote ? ` · ${item.adminNote}` : ""}</li>)}</ul>}
        </div>

        {/* Marketplace Promotion Banner */}
        <div className="marketplace-promo-banner">
          <div className="promo-text">
            <Store size={28} className="promo-icon" />
            <div>
              <h3>Redeem Your Credits for Digital Rewards</h3>
              <p>
                Convert your earned sharing credits into software subscriptions,
                digital developer tools, and gift vouchers in the NetShare Marketplace.
              </p>
            </div>
          </div>

          <Link to="/client/marketplace" className="browse-marketplace-btn">
            Browse Marketplace <ArrowUpRight size={16} />
          </Link>
        </div>

        {/* Transaction History Ledger */}
        <div className="wallet-ledger-card">
          <div className="ledger-header">
            <div className="ledger-title-wrap">
              <Receipt size={18} className="title-icon" />
              <h3>Earnings & Credit Ledger</h3>
            </div>
            <span className="total-tx-pill">
              {transactions.length} Recorded Transactions
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="no-transactions-state">
              <p>No transactions found. Complete testing tasks to earn your first credits!</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Date & Time</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const isCredit = tx.type === "credit";
                    return (
                      <tr key={tx._id}>
                        <td>
                          <div className="tx-type-pill">
                            {isCredit ? (
                              <span className="pill-credit">
                                <ArrowDownLeft size={13} /> Reward
                              </span>
                            ) : (
                              <span className="pill-debit">
                                <ArrowUpRight size={13} /> Spend
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="tx-desc-cell">
                          {tx.description || "Task completion reward"}
                        </td>
                        <td className="tx-date-cell">
                          <span className="date-icon-wrap">
                            <Calendar size={13} />
                            {new Date(tx.createdAt).toLocaleString()}
                          </span>
                        </td>
                        <td className="tx-amount-cell">
                          <span
                            className={
                              isCredit ? "amount-credit" : "amount-debit"
                            }
                          >
                            {isCredit ? "+" : "-"}
                            {tx.amount} Credits
                          </span>
                        </td>
                        <td>
                          <span className="tx-status-tag">Completed</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </NodeLayout>
  );
}

export default NodeWallet;
