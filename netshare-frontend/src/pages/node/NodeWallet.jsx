import React, { useState, useEffect } from "react";
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
import "./NodeWallet.css";

function NodeWallet() {
  const [walletData, setWalletData] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      setError("");
      const [txRes, dashRes] = await Promise.all([
        getNodeTransactions(),
        getNodeDashboard().catch(() => null),
      ]);
      setWalletData(txRes);
      setDashboardData(dashRes);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
