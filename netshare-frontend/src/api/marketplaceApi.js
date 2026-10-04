import axiosInstance from "./axiosInstance";

export const getMarketplaceProducts = async (params = {}) => {
  const res = await axiosInstance.get("/marketplace/products", { params });
  return res.data;
};

export const getMarketplaceProductById = async (id) => {
  const res = await axiosInstance.get(`/marketplace/products/${id}`);
  return res.data;
};

export const createMarketplaceOrder = async (productId) => {
  const res = await axiosInstance.post("/marketplace/orders", {
    productId,
  });
  return res.data;
};

export const getMyMarketplaceOrders = async () => {
  const res = await axiosInstance.get("/marketplace/my-orders");
  return res.data;
};

export const adminGetMarketplaceProducts = async (params = {}) => {
  const res = await axiosInstance.get("/marketplace/admin/products", { params });
  return res.data;
};

export const adminCreateMarketplaceProduct = async (payload) => {
  const res = await axiosInstance.post(
    "/marketplace/admin/products",
    payload
  );
  return res.data;
};

export const adminUpdateMarketplaceProduct = async (id, payload) => {
  const res = await axiosInstance.put(
    `/marketplace/admin/products/${id}`,
    payload
  );
  return res.data;
};

export const adminGetMarketplaceOrders = async (params = {}) => {
  const res = await axiosInstance.get("/marketplace/admin/orders", { params });
  return res.data;
};

export const adminUpdateMarketplaceOrderStatus = async (id, payload) => {
  const res = await axiosInstance.put(
    `/marketplace/admin/orders/${id}/status`,
    payload
  );
  return res.data;
};