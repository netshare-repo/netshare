import { useEffect, useState } from "react";
import { PackageCheck, RefreshCw, Search } from "lucide-react";
import AdminLayout from "../../layouts/AdminLayout";
import {
  adminGetMarketplaceOrders,
  adminUpdateMarketplaceOrderStatus,
} from "../../api/marketplaceApi";
import "./MarketplaceOrders.css";

function MarketplaceOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [message, setMessage] = useState("");
  
  const [filters, setFilters] = useState({
    status: "",
    search: ""
  });

  const loadOrders = async () => {
    try {
      setLoading(true);
      const queryParams = { ...filters };
      if (!queryParams.status) delete queryParams.status;
      if (!queryParams.search) delete queryParams.search;

      const data = await adminGetMarketplaceOrders(queryParams);
      setOrders(data.orders || []);
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadOrders();
  };

  const updateStatus = async (orderId, status) => {
    const fulfilmentNote =
      status === "fulfilled"
        ? window.prompt("Enter fulfilment note:", "Order fulfilled manually by admin.")
        : window.prompt("Enter note:", `Order marked as ${status}.`);

    if (fulfilmentNote === null) return;

    try {
      setUpdatingId(orderId);
      const data = await adminUpdateMarketplaceOrderStatus(orderId, {
        status,
        fulfilmentNote,
      });
      setMessage(data.message || "Order status updated");
      await loadOrders();
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to update order");
    } finally {
      setUpdatingId("");
    }
  };

  useEffect(() => {
    loadOrders();
  }, [filters.status]);

  return (
    <AdminLayout>
      <div className="admin-orders-page">
        <div className="amo-header">
          <div>
            <h2>Marketplace Orders</h2>
            <p>View and fulfil credit-based marketplace orders.</p>
          </div>

          <button onClick={loadOrders}>
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', padding: '0 10px', flex: 1, minWidth: '250px' }}>
            <Search size={18} color="white" />
            <input 
              type="text" 
              name="search"
              placeholder="Search by Order ID..." 
              value={filters.search}
              onChange={handleFilterChange}
              style={{ background: 'transparent', border: 'none', color: 'white', padding: '10px', flex: 1, outline: 'none' }}
            />
            <button type="submit" style={{ background: '#38bdf8', border: 'none', color: '#0f172a', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Search</button>
          </form>

          <select name="status" value={filters.status} onChange={handleFilterChange} style={{ background: '#1e293b', border: '1px solid #334155', color: 'white', padding: '10px', borderRadius: '6px', outline: 'none' }}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {message && <div className="amo-message">{message}</div>}

        {loading ? (
          <div className="amo-empty">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="amo-empty">No marketplace orders found.</div>
        ) : (
          <div className="amo-table-wrap">
            <table className="amo-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>User</th>
                  <th>Credits</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td>
                      <div className="amo-product">
                        <PackageCheck size={20} />
                        <div>
                          <strong>{order.productName}</strong>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{order._id}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong>{order.userId?.name || "Unknown"}</strong>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{order.userId?.email}</span>
                      </div>
                    </td>

                    <td>{order.creditsSpent}</td>

                    <td>
                      <span className={`amo-status ${order.status}`}>
                        {order.status}
                      </span>
                    </td>

                    <td>{order.fulfilmentNote || "No note"}</td>

                    <td>
                      <div className="amo-actions">
                        <button
                          disabled={updatingId === order._id || order.status !== 'pending'}
                          onClick={() => updateStatus(order._id, "fulfilled")}
                        >
                          Fulfil
                        </button>

                        <button
                          className="reject"
                          disabled={updatingId === order._id || order.status !== 'pending'}
                          onClick={() => updateStatus(order._id, "rejected")}
                        >
                          Reject
                        </button>

                        <button
                          className="cancel"
                          disabled={updatingId === order._id || order.status === 'cancelled'}
                          onClick={() => updateStatus(order._id, "cancelled")}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default MarketplaceOrders;