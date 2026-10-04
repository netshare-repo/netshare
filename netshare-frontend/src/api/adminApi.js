import axiosInstance from "./axiosInstance";

export const getAdminDashboard = async () => {
  const res = await axiosInstance.get("/admin/dashboard");
  return res.data;
};

export const getAdminUsers = async (params = {}) => {
  const res = await axiosInstance.get("/admin/users", { params });
  return res.data;
};

export const getAdminNodes = async (params = {}) => {
  const res = await axiosInstance.get("/admin/nodes", { params });
  return res.data;
};

export const getAdminTasks = async (params = {}) => {
  const res = await axiosInstance.get("/admin/tasks", { params });
  return res.data;
};

export const getAdminTransactions = async (params = {}) => {
  const res = await axiosInstance.get("/admin/transactions", { params });
  return res.data;
};

export const blockUser = async (id) => {
  const res = await axiosInstance.put(`/admin/users/${id}/block`);
  return res.data;
};

export const unblockUser = async (id) => {
  const res = await axiosInstance.put(`/admin/users/${id}/unblock`);
  return res.data;
};

export const getAdminLogs = async () => {
  const res = await axiosInstance.get("/admin/logs");
  return res.data;
};

export const addDemoCredit = async (payload) => {
  const res = await axiosInstance.post("/wallet/demo-credit", payload);
  return res.data;
};