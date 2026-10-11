import bcrypt from "bcryptjs";
import User from '../models/User.js';
import { publicUser } from '../utils/publicUser.js';
import { validateProof } from '../services/paymentService.js';
import { changeAccountRole } from '../services/accountControlService.js';
import { normalizePhone } from '../services/identityService.js';
import { isStrongPassword, isValidPhone } from "../utils/validation.js";

export const getProfile = async (req, res) => {
  return res.json({
    user: publicUser(req.user),
  });
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, profileImage, photo } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim() || name.length > 120) {
        return res.status(400).json({ message: "Name cannot be empty" });
      }
      req.user.name = name;
    }

    if (phone !== undefined) {
      if (req.user.verificationMethod === 'sms' && normalizePhone(phone) !== req.user.phone) {
        return res.status(400).json({ message: 'Verified mobile identity cannot be changed through profile editing' });
      }
      if (!isValidPhone(phone)) {
        return res.status(400).json({ message: "Invalid phone format" });
      }
      if (phone && !normalizePhone(phone)) return res.status(400).json({ message: 'Use an international phone number beginning with +' });
      req.user.phone = phone ? normalizePhone(phone) : '';
    }

    if (profileImage !== undefined) {
      if (profileImage !== '') return res.status(400).json({ message: 'Upload a PNG/JPEG photo; external image URLs are not accepted' });
      req.user.profileImage = '';
    }
    if (photo !== undefined) {
      if (!['image/png', 'image/jpeg'].includes(photo?.mimeType)) return res.status(400).json({ message: 'Photo must be PNG or JPEG' });
      const validated = validateProof(photo.mimeType, photo.base64);
      req.user.profileImage = `data:${photo.mimeType};base64,${validated.toString('base64')}`;
    }

    const updatedUser = await req.user.save();

    return res.json({
      message: "Profile updated successfully",
      user: publicUser(updatedUser),
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Mobile number already registered' });
    return res.status(error.status || 500).json({
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

export const updateRole = async (req, res) => {
  if (req.body.confirm !== true) return res.status(400).json({ message: 'Confirm the role change' });
  try {
    const account = await User.findById(req.user._id).select('password');
    if (typeof req.body.password !== 'string' || !await bcrypt.compare(req.body.password, account.password)) {
      return res.status(401).json({ message: 'Current password required' });
    }
    const user = await changeAccountRole(req.user._id, req.body.role);
    const { disconnectAccountSockets } = await import('../services/socketService.js');
    disconnectAccountSockets(req.user._id);
    return res.json({ user: publicUser(user), message: 'Role updated; reopen your workspace' });
  } catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : 'Role update failed' }); }
};
