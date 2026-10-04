import { useEffect, useState } from "react";
import { Plus, RefreshCw, Store, Edit } from "lucide-react";
import AdminLayout from "../../layouts/AdminLayout";
import {
  adminCreateMarketplaceProduct,
  adminUpdateMarketplaceProduct,
  getMarketplaceProducts,
} from "../../api/marketplaceApi";
import "./MarketplaceProducts.css";

const emptyForm = {
  name: "",
  description: "",
  category: "subscription",
  requiredCredits: "",
  imageUrl: "",
  stock: "10",
  status: "active",
};

function MarketplaceProducts() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await getMarketplaceProducts();
      setProducts(data.products || []);
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId("");
  };

  const handleEdit = (product) => {
    setEditingId(product._id);
    setForm({
      name: product.name || "",
      description: product.description || "",
      category: product.category || "other",
      requiredCredits: product.requiredCredits || "",
      imageUrl: product.imageUrl || "",
      stock: product.stock || "0",
      status: product.status || "active",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...form,
      requiredCredits: Number(form.requiredCredits),
      stock: Number(form.stock),
    };

    try {
      setSaving(true);
      setMessage("");

      if (editingId) {
        const data = await adminUpdateMarketplaceProduct(editingId, payload);
        setMessage(data.message || "Product updated successfully");
      } else {
        const data = await adminCreateMarketplaceProduct(payload);
        setMessage(data.message || "Product created successfully");
      }

      resetForm();
      await loadProducts();
    } catch (error) {
      setMessage(error.response?.data?.message || "Product save failed");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <AdminLayout>
      <div className="admin-market-products">
        <div className="amp-header">
          <div>
            <h2>Marketplace Products</h2>
            <p>Create and manage credit-based digital products.</p>
          </div>

          <button onClick={loadProducts}>
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>

        {message && <div className="amp-message">{message}</div>}

        <form className="amp-form" onSubmit={handleSubmit}>
          <h3>{editingId ? "Update Product" : "Create Product"}</h3>

          <div className="amp-grid">
            <input
              name="name"
              placeholder="Product name"
              value={form.name}
              onChange={handleChange}
              required
            />

            <select
              name="category"
              value={form.category}
              onChange={handleChange}
            >
              <option value="subscription">Subscription</option>
              <option value="digital_tool">Digital Tool</option>
              <option value="voucher">Voucher</option>
              <option value="software">Software</option>
              <option value="other">Other</option>
            </select>

            <input
              name="requiredCredits"
              type="number"
              placeholder="Required credits"
              value={form.requiredCredits}
              onChange={handleChange}
              required
            />

            <input
              name="stock"
              type="number"
              placeholder="Stock"
              value={form.stock}
              onChange={handleChange}
              required
            />

            <select name="status" value={form.status} onChange={handleChange}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <input
              name="imageUrl"
              placeholder="Image URL optional"
              value={form.imageUrl}
              onChange={handleChange}
            />
          </div>

          <textarea
            name="description"
            placeholder="Product description"
            value={form.description}
            onChange={handleChange}
            required
          />

          <div className="amp-actions">
            <button type="submit" disabled={saving}>
              <Plus size={18} />
              {saving ? "Saving..." : editingId ? "Update Product" : "Add Product"}
            </button>

            {editingId && (
              <button type="button" className="amp-cancel" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        {loading ? (
          <div className="amp-empty">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="amp-empty">No active products found.</div>
        ) : (
          <div className="amp-product-grid">
            {products.map((product) => (
              <div className="amp-card" key={product._id}>
                <div className="amp-card-icon">
                  <Store size={28} />
                </div>

                <h3>{product.name}</h3>
                <p>{product.description}</p>

                <div className="amp-meta">
                  <span>{product.requiredCredits} Credits</span>
                  <span>Stock: {product.stock}</span>
                  <span>{product.category?.replaceAll("_", " ")}</span>
                </div>

                <button onClick={() => handleEdit(product)}>
                  <Edit size={17} />
                  Edit Product
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default MarketplaceProducts;