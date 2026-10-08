import { useEffect, useState } from "react";
import { Store, Coins, Package, ShoppingCart, RefreshCw } from "lucide-react";
import ClientLayout from "../../layouts/ClientLayout";
import {
  createMarketplaceOrder,
  getMarketplaceProducts,
} from "../../api/marketplaceApi";
import "./Marketplace.css";

function Marketplace() {
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
    <ClientLayout>
      <div className="market-page">
        <div className="market-header">
          <div>
            <h2>Credit Marketplace</h2>
            <p>Redeem your NetShare credits for digital services and vouchers.</p>
          </div>

          <button onClick={loadProducts} className="market-refresh-btn">
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        {message && <div className="market-message">{message}</div>}

        {loading ? (
          <div className="market-loading">Loading marketplace products...</div>
        ) : products.length === 0 ? (
          <div className="market-empty">
            <Store size={48} />
            <h3>No products available</h3>
            <p>Admin has not added marketplace products yet.</p>
          </div>
        ) : (
          <div className="market-grid">
            {products.map((product) => (
              <div className="market-card" key={product._id}>
                <div className="market-card-icon">
                  <Store size={32} />
                </div>

                <div className="market-card-body">
                  <span className="market-category">
                    {product.category?.replaceAll("_", " ")}
                  </span>

                  <h3>{product.name}</h3>
                  <p>{product.description}</p>

                  <div className="market-meta">
                    <span>
                      <Coins size={17} />
                      {product.requiredCredits} Credits
                    </span>

                    <span>
                      <Package size={17} />
                      Stock: {product.stock}
                    </span>
                  </div>

                  <button
                    onClick={() => handleBuy(product)}
                    disabled={buyingId === product._id}
                    className="market-buy-btn"
                  >
                    <ShoppingCart size={18} />
                    {buyingId === product._id ? "Buying..." : "Buy Now"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}

export default Marketplace;
