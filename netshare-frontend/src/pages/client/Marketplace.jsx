import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Store, Coins, ShoppingCart, RefreshCw, ReceiptText } from "lucide-react";
import ClientLayout from "../../layouts/ClientLayout";
import NodeLayout from "../../layouts/NodeLayout";
import { useAuth } from "../../context/authState";
import {
  createMarketplaceOrder,
  getMarketplaceProducts,
} from "../../api/marketplaceApi";
import "./Marketplace.css";

function Marketplace() {
  const location = useLocation();
  const { user } = useAuth();
  const isNodeExperience = location.pathname.startsWith("/node/") || user?.role === "node_participant";
  const Layout = isNodeExperience ? NodeLayout : ClientLayout;
  const ordersPath = isNodeExperience ? "/node/orders" : "/client/orders";
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState("");
  const [message, setMessage] = useState("");

  const loadProducts = async () => {
    try {
      setLoading(true);
      setMessage("");
      const data = await getMarketplaceProducts();
      setProducts(data.products || []);
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (product) => {
    const ok = window.confirm(
      `Buy "${product.name}" for ${product.requiredCredits} credits?`
    );

    if (!ok) return;

    try {
      setBuyingId(product._id);
      setMessage("");
      const data = await createMarketplaceOrder(product._id);
      setMessage(data.message || "Order created successfully");
      await loadProducts();
    } catch (error) {
      setMessage(error.response?.data?.message || "Purchase failed");
    } finally {
      setBuyingId("");
    }
  };

  useEffect(() => {
    void Promise.resolve().then(loadProducts);
  }, []);

  return (
    <Layout pageTitle="Marketplace" pageSubtitle="">
      <div className="ps-market-page">
        {/* Header */}
        <div className="ps-page-header">
          <div>
            <h1 className="ps-page-title">Credit Marketplace</h1>
            <p className="ps-page-subtitle">
              Redeem your available NetShare credits for digital perks and partner services.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" onClick={loadProducts} className="ps-btn-dark">
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
            <Link to={ordersPath} className="ps-btn-dark">
              <ReceiptText size={15} />
              <span>My Orders</span>
            </Link>
          </div>
        </div>

        {message && (
          <div className="ps-alert success">
            <span>{message}</span>
          </div>
        )}

        {loading ? (
          <div className="ps-loading-state">Loading marketplace offerings...</div>
        ) : products.length === 0 ? (
          <div className="ps-card ps-empty-market-card">
            <Store size={38} style={{ color: "#06b6d4", marginBottom: 12 }} />
            <h3 className="ps-card-title">No Marketplace Offerings</h3>
            <p className="ps-desc-text" style={{ maxWidth: 420, margin: "8px auto 0" }}>
              Digital goods and service vouchers will appear here when posted by the
              platform administration.
            </p>
          </div>
        ) : (
          <div className="ps-market-grid">
            {products.map((product) => (
              <div className="ps-card ps-product-card" key={product._id}>
                <div className="ps-card-decor" aria-hidden="true">
                  <div className="ps-card-decor-outer" />
                </div>

                <div className="ps-card-header-clean">
                  <span className="ps-meta-label">
                    {product.category?.replaceAll("_", " ") || "DIGITAL SERVICE"}
                  </span>
                  <h3 className="ps-card-title" style={{ marginTop: 6, fontSize: 18 }}>
                    {product.name}
                  </h3>
                </div>

                <p className="ps-desc-text" style={{ margin: "12px 0 20px", minHeight: 44 }}>
                  {product.description}
                </p>

                <div className="ps-product-meta-row">
                  <div className="ps-product-cost">
                    <Coins size={16} style={{ color: "#06b6d4" }} />
                    <strong>{product.requiredCredits}</strong>
                    <small>credits</small>
                  </div>

                  <span className="ps-stock-tag">
                    Stock: {product.stock}
                  </span>
                </div>

                <div style={{ marginTop: 20 }}>
                  <button
                    type="button"
                    onClick={() => handleBuy(product)}
                    disabled={buyingId === product._id || product.stock <= 0}
                    className="ps-btn-white"
                    style={{ width: "100%", height: 42 }}
                  >
                    <ShoppingCart size={15} />
                    <span>
                      {buyingId === product._id
                        ? "Processing..."
                        : product.stock <= 0
                        ? "Out of Stock"
                        : "Redeem Now"}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Marketplace;
