import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import generateToken from "../utils/generateToken.js";
import { isValidEmail, isStrongPassword, isValidPhone } from "../utils/validation.js";
import { sendOtpEmail } from '../services/emailService.js';
import logger from '../lib/logger.js';
import config from '../config/env.js';
import { runTransaction } from '../lib/mongoTransaction.js';
import { recordFailedOtpAttempt, resetOtpAttempts } from '../middleware/otpProtection.js';
// Helper to generate a 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "Name, email, password and role are required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ 
        message: "Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, and a number" 
      });
    }

    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ message: "Invalid phone format" });
    }

    const allowedRoles = ["node_participant", "platform_client", "both"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role selected" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      isVerified: false,
      signupOtpHash: otpHash,
      signupOtpExpires: otpExpires,
      lastOtpSentAt: new Date(),
    });

    // Send OTP via email
    try {
      await sendOtpEmail(user.email, otp, 'signup');
    } catch (emailErr) {
      logger.warn({ err: emailErr, email: user.email }, 'Failed to send signup OTP email');
      // Do not fail registration if email fails — user can resend
    }

    const response = {
      message: "Registration successful. Please verify your email.",
      userId: user._id,
      email: user.email,
    };

    if (process.env.NODE_ENV === "development") {
      response.devOtp = otp;
    }

    return res.status(201).json(response);
  } catch (error) {
    return res.status(500).json({
      message: "Registration failed",
      error: error.message,
    });
  }
};

export const verifySignupOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "User is already verified" });
    }

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    if (user.signupOtpHash !== otpHash) {
      await recordFailedOtpAttempt(user);
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (new Date() > user.signupOtpExpires) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    const verified = await runTransaction(async session => {
      const changed = await User.findOneAndUpdate({ _id: user._id, isVerified: false,
        signupOtpHash: otpHash, signupOtpExpires: { $gte: new Date() } },
        { $set: { isVerified: true, signupOtpHash: null, signupOtpExpires: null,
          otpAttempts: 0, otpLockedUntil: null } }, { new: true, session });
      if (!changed) return false;
      await Wallet.create([{
        userId: user._id,
        balance: !config.isProduction && (user.role === 'platform_client' || user.role === 'both') ? 500 : 0,
      }], { session });
      return true;
    });
    if (!verified) return res.status(409).json({ message: 'OTP already consumed, changed, or expired' });

    return res.json({
      message: "Verification successful",
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Verification failed",
      error: error.message,
    });
  }
};

export const resendSignupOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "User is already verified" });
    }

    const otp = generateOTP();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.signupOtpHash = otpHash;
    user.signupOtpExpires = otpExpires;
    user.lastOtpSentAt = new Date();
    await user.save();

    // Send OTP via email
    try {
      await sendOtpEmail(user.email, otp, 'resend');
    } catch (emailErr) {
      logger.warn({ err: emailErr, email: user.email }, 'Failed to send resend OTP email');
    }

    const response = {
      message: "New OTP sent successfully",
    };

    if (process.env.NODE_ENV === "development") {
      response.devOtp = otp;
    }

    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to resend OTP",
      error: error.message,
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Explicitly check for false to allow legacy users (undefined/true) to pass
    if (user.isVerified === false) {
      return res.status(403).json({ message: "Please verify your email before logging in" });
    }

    if (user.status === "blocked") {
      return res.status(403).json({ message: "Your account is blocked" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    return res.json({
      message: "Login successful",
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Do not reveal if user exists or not
      return res.json({ message: "If that email address is in our database, we will send you an email to reset your password." });
    }

    const otp = generateOTP();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetOtpHash = otpHash;
    user.resetOtpExpires = otpExpires;
    user.lastOtpSentAt = new Date();
    await user.save();

    // Send OTP via email
    try {
      await sendOtpEmail(user.email, otp, 'reset');
    } catch (emailErr) {
      logger.warn({ err: emailErr, email: user.email }, 'Failed to send reset OTP email');
    }

    const response = {
      message: "If that email address is in our database, we will send you an email to reset your password.",
    };

    if (process.env.NODE_ENV === "development") {
      response.devOtp = otp;
    }

    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to process forgot password request",
      error: error.message,
    });
  }
};

export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid OTP or Email" });
    }

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    if (user.resetOtpHash !== otpHash || new Date() > user.resetOtpExpires) {
      await recordFailedOtpAttempt(user);
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Since we verified the OTP, we can provide a short-lived token to reset password
    // or just clear the OTP and expect the user to send the new password immediately.
    // A simpler approach: return a success status, frontend can then call resetPassword
    // passing the OTP again to authorize the reset.

    await resetOtpAttempts(user);
    return res.json({
      message: "OTP verified successfully. You can now reset your password.",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to verify reset OTP",
      error: error.message,
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || typeof otp !== 'string' || !/^\d{6}$/.test(otp) || !newPassword) {
      return res.status(400).json({ message: "Email, OTP and new password are required" });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ 
        message: "Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, and a number" 
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid OTP or Email" });
    }

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    if (user.resetOtpHash !== otpHash || new Date() > user.resetOtpExpires) {
      await recordFailedOtpAttempt(user);
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const changed = await User.findOneAndUpdate({ _id: user._id, resetOtpHash: otpHash,
      resetOtpExpires: { $gte: new Date() } }, { $set: {
      password: await bcrypt.hash(newPassword, 10), resetOtpHash: null, resetOtpExpires: null,
      otpAttempts: 0, otpLockedUntil: null,
    } });
    if (!changed) return res.status(409).json({ message: 'Reset OTP already consumed or expired' });

    return res.json({
      message: "Password reset successfully. You can now login.",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to reset password",
      error: error.message,
    });
  }
};

export const getMe = async (req, res) => {
  return res.json({
    user: req.user,
  });
};
