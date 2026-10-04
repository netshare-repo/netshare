import axiosInstance from "./axiosInstance";

export const register = async (data) => {
  const response = await axiosInstance.post("/auth/register", data);
  return response.data;
};

export const verifySignupOtp = async (data) => {
  const response = await axiosInstance.post("/auth/verify-signup-otp", data);
  return response.data;
};

export const resendSignupOtp = async (data) => {
  const response = await axiosInstance.post("/auth/resend-signup-otp", data);
  return response.data;
};

export const login = async (data) => {
  const response = await axiosInstance.post("/auth/login", data);
  return response.data;
};

export const forgotPassword = async (data) => {
  const response = await axiosInstance.post("/auth/forgot-password", data);
  return response.data;
};

export const verifyResetOtp = async (data) => {
  const response = await axiosInstance.post("/auth/verify-reset-otp", data);
  return response.data;
};

export const resetPassword = async (data) => {
  const response = await axiosInstance.post("/auth/reset-password", data);
  return response.data;
};

export const getMe = async () => {
  const response = await axiosInstance.get("/auth/me");
  return response.data;
};
