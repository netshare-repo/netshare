import { useEffect, useState } from "react";
import { ReceiptText, RefreshCw, Coins } from "lucide-react";
import ClientLayout from "../../layouts/ClientLayout";
import { getMyMarketplaceOrders } from "../../api/marketplaceApi";
import "./MyOrders.css";

function MyOrders() {
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
    <ClientLayout>
      <div className="orders-page">
        <div className="orders-header">
          <div>
            <h2>My Marketplace Orders</h2>
            <p>Track your credit-based marketplace purchases.</p>
          </div>

          <button onClick={loadOrders}>
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="orders-empty">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="orders-empty">
            <ReceiptText size={48} />
            <h3>No orders found</h3>
            <p>Your marketplace purchases will appear here.</p>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <div className="order-card" key={order._id}>
                <div className="order-left">
                  <div className="order-icon">
                    <ReceiptText size={24} />
                  </div>

                  <div>
                    <h3>{order.productName}</h3>
                    <p>
                      Order ID: <span>{order._id}</span>
                    </p>
                    {order.fulfilmentNote && (
                      <p>
                        Admin Note: <span>{order.fulfilmentNote}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="order-right">
                  <span className={`order-status ${order.status}`}>
                    {order.status}
                  </span>

                  <div className="order-credits">
                    <Coins size={17} />
                    {order.creditsSpent} Credits
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}

export default MyOrders;
