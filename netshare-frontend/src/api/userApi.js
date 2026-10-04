import axiosInstance from "./axiosInstance";

export const getProfile = async () => {
  const response = await axiosInstance.get("/users/profile");
  return response.data;
};

export const updateProfile = async (data) => {
  const response = await axiosInstance.put("/users/profile", data);
  return response.data;
};

export const changePassword = async (data) => {
  const response = await axiosInstance.put("/users/change-password", data);
  return response.data;
};
