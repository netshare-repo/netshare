import { useCallback, useEffect, useState } from "react";
import { PackageCheck, RefreshCw, Search } from "lucide-react";
import AdminLayout from "../../layouts/AdminLayout";
import AdminPagination from "./AdminPagination";
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  const [filters, setFilters] = useState({
    status: "",
    search: ""
  });

  const loadOrders = useCallback(async () => {
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
  }, [filters]);

  const handleFilterChange = (e) => {
    setPage(1);
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const newestOrders = [...orders].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const filteredOrders = newestOrders.filter((order) => {
    const search = filters.search.trim().toLowerCase();
    const matchesSearch = !search || [order._id, order.productName, order.userId?.name, order.userId?.email].some((value) => String(value || "").toLowerCase().includes(search));
    return matchesSearch && (!filters.status || order.status === filters.status);
  });
  const pageOrders = filteredOrders.slice((page - 1) * pageSize, page * pageSize);

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
    void Promise.resolve().then(loadOrders);
  }, [loadOrders]);

  return (
    <AdminLayout>
      <div className="admin-orders-page">
        <div className="amo-header">
          <div>
            <h2>Marketplace Orders</h2>
            <p>View and fulfil credit-based marketplace orders.</p>
          </div>

          <button onClick={() => { if (page === 1) void loadOrders(); else setPage(1); }}>
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        <div className="amo-filters">
          <form onSubmit={handleSearch} className="amo-search-form">
            <Search size={18} color="white" />
            <input 
              type="text" 
              name="search"
              placeholder="Search by Order ID..." 
              value={filters.search}
              onChange={handleFilterChange}
            />
            <button type="submit">Search</button>
          </form>

          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {message && <div className="amo-message">{message}</div>}

        {!loading && <AdminPagination page={page} pageSize={pageSize} total={filteredOrders.length} onPageChange={setPage} onPageSizeChange={setPageSize} />}
        {loading ? (
          <div className="amo-empty">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
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
                {pageOrders.map((order) => (
                  <tr key={order._id}>
                    <td>
                      <div className="amo-product">
                        <PackageCheck size={20} />
                        <div>
                          <strong>{order.productName}</strong>
                          <span className="amo-secondary">{order._id}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="amo-user">
                        <strong>{order.userId?.name || "Unknown"}</strong>
                        <span className="amo-secondary">{order.userId?.email}</span>
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
