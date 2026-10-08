import bcrypt from "bcryptjs";
import User from '../models/User.js';
import { isStrongPassword, isValidPhone } from "../utils/validation.js";

export const getProfile = async (req, res) => {
  return res.json({
    user: req.user,
  });
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, profileImage } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim() || name.length > 120) {
        return res.status(400).json({ message: "Name cannot be empty" });
      }
      req.user.name = name;
    }

    if (phone !== undefined) {
      if (!isValidPhone(phone)) {
        return res.status(400).json({ message: "Invalid phone format" });
      }
      req.user.phone = phone;
    }

    if (profileImage !== undefined) {
      req.user.profileImage = profileImage;
    }

    const updatedUser = await req.user.save();

    return res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Profile update failed",
      error: error.message,
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Old and new passwords are required" });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ 
        message: "New password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, and a number" 
      });
    }

    const account = await User.findById(req.user._id).select('password');
    const isMatch = typeof oldPassword === 'string' && account?.password && await bcrypt.compare(oldPassword, account.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect old password" });
    }

    req.user.password = await bcrypt.hash(newPassword, 10);
    await req.user.save();

    return res.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to change password",
      error: error.message,
    });
  }
};
