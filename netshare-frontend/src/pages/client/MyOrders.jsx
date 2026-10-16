import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { RefreshCw, Store, Coins } from "lucide-react";
import ClientLayout from "../../layouts/ClientLayout";
import NodeLayout from "../../layouts/NodeLayout";
import { useAuth } from "../../context/authState";
import { getMyMarketplaceOrders } from "../../api/marketplaceApi";
import "./MyOrders.css";

function MyOrders() {
  const location = useLocation();
  const { user } = useAuth();
  const isNodeExperience = location.pathname.startsWith("/node/") || user?.role === "node_participant";
  const Layout = isNodeExperience ? NodeLayout : ClientLayout;
  const marketplacePath = isNodeExperience ? "/node/marketplace" : "/client/marketplace";
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await getMyMarketplaceOrders();
      setOrders(data.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(loadOrders);
  }, []);

  return (
    <Layout pageTitle="My Orders" pageSubtitle="">
      <div className="ps-orders-page">
        {/* Header */}
        <div className="ps-page-header">
          <div>
            <h1 className="ps-page-title">Marketplace Orders</h1>
            <p className="ps-page-subtitle">
              Audit trail of your redeemed digital goods and fulfillment notes.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" onClick={loadOrders} className="ps-btn-dark">
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
            <Link to={marketplacePath} className="ps-btn-white">
              <Store size={15} />
              <span>Browse Marketplace</span>
            </Link>
          </div>
        </div>

        {/* Orders Card */}
        <div className="ps-card ps-table-panel-card">
          <div className="ps-card-decor" aria-hidden="true">
            <div className="ps-card-decor-outer" />
          </div>

          <div className="ps-card-header-clean" style={{ marginBottom: 20 }}>
            <h2 className="ps-card-title">Order History</h2>
            <span className="ps-meta-label">FULFILLMENT AUDIT TRAIL</span>
          </div>

          {loading ? (
            <div className="ps-loading-state">Loading order history...</div>
          ) : orders.length === 0 ? (
            <div className="ps-empty-state">
              <p style={{ margin: "0 0 14px 0" }}>
                You have not placed any marketplace orders yet.
              </p>
              <Link to={marketplacePath} className="ps-btn-white">
                Explore Marketplace
              </Link>
            </div>
          ) : (
            <div className="ps-table-wrapper">
              <table className="ps-data-table">
                <thead>
                  <tr>
                    <th style={{ width: "22%" }}>Order ID</th>
                    <th style={{ width: "24%" }}>Product / Service</th>
                    <th style={{ width: "14%" }}>Credits Spent</th>
                    <th style={{ width: "12%" }}>Status</th>
                    <th style={{ width: "12%" }}>Date</th>
                    <th style={{ width: "16%" }}>Fulfillment Details</th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((order) => (
                    <tr key={order._id}>
                      <td>
                        <code
                          style={{
                            fontSize: 12,
                            color: "#a2a6ab",
                            background: "#16181b",
                            padding: "3px 6px",
                            borderRadius: 6,
                            border: "1px solid #292a2e",
                          }}
                        >
                          {order._id}
                        </code>
                      </td>

                      <td>
                        <strong style={{ color: "#ffffff" }}>
                          {order.productName}
                        </strong>
                      </td>

                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontWeight: 650,
                            color: "#06b6d4",
                          }}
                        >
                          <Coins size={14} />
                          {order.creditsSpent} credits
                        </span>
                      </td>

                      <td>
                        <span className={`ps-badge ${order.status}`}>
                          {order.status}
                        </span>
                      </td>

                      <td style={{ color: "#92979d", fontSize: 12 }}>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>

                      <td style={{ color: "#cbd5e1", fontSize: 13 }}>
                        {order.fulfilmentNote ? (
                          <span>{order.fulfilmentNote}</span>
                        ) : (
                          <span style={{ color: "#777d84" }}>
                            Standard digital dispatch
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default MyOrders;
