import axiosInstance from "./axiosInstance";

export const getNodeDashboard = async () => {
  const res = await axiosInstance.get("/node/dashboard");
  return res.data;
};

export const getMyNode = async () => {
  const res = await axiosInstance.get("/node/my-node");
  return res.data;
};

export const registerNode = async (payload) => {
  const res = await axiosInstance.post("/node/register", payload);
  return res.data;
};

export const updateNodeSettings = async (settings) => {
  const res = await axiosInstance.put("/node/settings", settings);
  return res.data;
};

export const startParticipation = async () => {
  const res = await axiosInstance.post("/node/start");
  return res.data;
};

export const stopParticipation = async () => {
  const res = await axiosInstance.post("/node/stop");
  return res.data;
};

export const getCurrentSession = async () => {
  const res = await axiosInstance.get("/node/session/current");
  return res.data;
};

export const getNodeTransactions = async () => {
  const res = await axiosInstance.get("/node/transactions");
  return res.data;
};

export const getAssignedTask = async () => {
  const res = await axiosInstance.get("/node/assigned-task");
  return res.data;
};

export const startTaskExecution = async (taskId) => {
  const res = await axiosInstance.put(`/tasks/${taskId}/start`);
  return res.data;
};

export const completeTaskExecution = async (taskId, metrics) => {
  const res = await axiosInstance.put(`/tasks/${taskId}/complete`, metrics);
  return res.data;
};

export const getNodeApiKey = async () => {
  const res = await axiosInstance.get("/node/api-key");
  return res.data;
};

export const regenerateNodeApiKey = async () => {
  const res = await axiosInstance.post("/node/api-key/regenerate");
  return res.data;
};

export const getNodeTelemetry = async (limit = 30) => {
  const res = await axiosInstance.get(`/node/telemetry?limit=${limit}`);
  return res.data;
};

export const getNodeHeartbeats = async (limit = 20) => {
  const res = await axiosInstance.get(`/node/heartbeats?limit=${limit}`);
  return res.data;
};

export const getNodeBandwidthHistory = async () => {
  const res = await axiosInstance.get("/node/bandwidth-usage");
  return res.data;
};

