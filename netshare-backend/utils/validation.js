import mongoose from "mongoose";

export const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

export const isStrongPassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return re.test(password);
};

export const isValidPhone = (phone) => {
  // Simple phone validation (10-15 digits, optional +)
  if (!phone) return true; // Phone is optional in our schema, handle empty
  const re = /^\+?[\d\s\-]{10,15}$/;
  return re.test(phone);
};

export const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

export const isPositiveNumber = (num) => {
  return typeof num === "number" && num > 0;
};

export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
};
