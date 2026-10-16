import { useEffect, useState } from "react";
import { Plus, RefreshCw, Store, Edit, ImageOff, Package, Tag } from "lucide-react";
import AdminLayout from "../../layouts/AdminLayout";
import AdminPagination from "./AdminPagination";
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const newestProducts = [...products].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
  const pageProducts = newestProducts.slice((page - 1) * pageSize, page * pageSize);

  const loadProducts = async () => {
    setPage(1);
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
    void Promise.resolve().then(loadProducts);
  }, []);

  return (
    <AdminLayout>
      <div className="admin-market-products">
        <div className="amp-header">
          <div>
            <span className="amp-eyebrow">CATALOG MANAGEMENT</span>
            <h2>Marketplace Products</h2>
            <p>Manage the digital products and services available in your marketplace.</p>
          </div>

          <button type="button" onClick={loadProducts} disabled={loading}>
            <RefreshCw size={18} />
            {loading ? "Refreshing…" : "Refresh products"}
          </button>
        </div>

        {message && <div className="amp-message">{message}</div>}

        <form className="amp-form" onSubmit={handleSubmit}>
          <div className="amp-section-heading">
            <div className="amp-heading-icon"><Store size={18} /></div>
            <div>
              <h3>{editingId ? "Edit marketplace product" : "Add a marketplace product"}</h3>
              <p>Set its listing details, price, availability, and status.</p>
            </div>
            {editingId && <span className="amp-editing-badge">Editing listing</span>}
          </div>

          <div className="amp-grid">
            <label className="amp-field amp-field-wide">
              <span>Product name</span>
              <input name="name" placeholder="e.g. Premium VPN subscription" value={form.name} onChange={handleChange} required />
            </label>
            <label className="amp-field">
              <span>Category</span>
              <select name="category" value={form.category} onChange={handleChange}>
                <option value="subscription">Subscription</option>
                <option value="digital_tool">Digital Tool</option>
                <option value="voucher">Voucher</option>
                <option value="software">Software</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="amp-field">
              <span>Price in credits</span>
              <input name="requiredCredits" type="number" min="0" placeholder="e.g. 500" value={form.requiredCredits} onChange={handleChange} required />
            </label>
            <label className="amp-field">
              <span>Available stock</span>
              <input name="stock" type="number" min="0" placeholder="e.g. 10" value={form.stock} onChange={handleChange} required />
            </label>
            <label className="amp-field">
              <span>Listing status</span>
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="amp-field amp-field-wide">
              <span>Image URL <small>Optional</small></span>
              <input name="imageUrl" type="url" placeholder="https://example.com/product-image.png" value={form.imageUrl} onChange={handleChange} />
            </label>
          </div>

          <label className="amp-field amp-description-field">
            <span>Description</span>
            <textarea name="description" placeholder="Describe what customers receive with this product." value={form.description} onChange={handleChange} required />
          </label>

          <div className="amp-actions">
            <button type="submit" disabled={saving}>
              <Plus size={18} />
              {saving ? "Saving…" : editingId ? "Save changes" : "Create product"}
            </button>

            {editingId && (
              <button type="button" className="amp-cancel" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        <div className="amp-list-heading">
          <div>
            <h3>Product listings</h3>
            <p>{products.length} {products.length === 1 ? "listing" : "listings"} in the catalog</p>
          </div>
          {!loading && products.length > 0 && <AdminPagination page={page} pageSize={pageSize} total={products.length} onPageChange={setPage} onPageSizeChange={setPageSize} />}
        </div>
        {loading ? (
          <div className="amp-empty">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="amp-empty"><Store size={22} /><strong>Your catalog is empty</strong><span>Create a product above to add the first marketplace listing.</span></div>
        ) : (
          <div className="amp-product-grid">
            {pageProducts.map((product) => (
              <div className="amp-card" key={product._id}>
                <div className="amp-card-visual">
                  {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <ImageOff size={22} />}
                  <span className={`amp-status ${product.status === "active" ? "is-active" : "is-inactive"}`}>{product.status || "active"}</span>
                </div>
                <div className="amp-card-content">
                  <div className="amp-card-title-row"><span className="amp-category"><Tag size={12} />{product.category?.replaceAll("_", " ") || "Other"}</span></div>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="amp-card-details">
                    <div><span>Price</span><strong>{Number(product.requiredCredits || 0).toLocaleString()} <small>credits</small></strong></div>
                    <div><span>Stock</span><strong><Package size={14} />{product.stock ?? 0}</strong></div>
                  </div>
                  <button type="button" onClick={() => handleEdit(product)}><Edit size={16} />Edit listing</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default MarketplaceProducts;
