import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import generateToken from "../utils/generateToken.js";
import { isValidEmail, isStrongPassword, isValidPhone } from "../utils/validation.js";
import { sendOtpEmail } from '../services/emailService.js';
import { findIdentity, normalizePhone } from '../services/identityService.js';
import { sendSmsOtp, smsAvailable } from '../services/smsService.js';
const sendCode = (user, otp, purpose) => user.verificationMethod === 'sms'
  ? sendSmsOtp(user.phone, otp, purpose) : sendOtpEmail(user.email, otp, purpose);
import logger from '../lib/logger.js';
import config from '../config/env.js';
import { runTransaction } from '../lib/mongoTransaction.js';
import { recordFailedOtpAttempt, resetOtpAttempts } from '../middleware/otpProtection.js';
// Helper to generate a 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// Explicit local-development escape hatch; production and tests retain OTP.
const developmentOtpDisabled = () => !config.isProduction &&
  process.env.NODE_ENV === 'development' &&
  process.env.DEV_SKIP_OTP_VERIFICATION === 'true';

const authUser = user => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
});

// Standalone MongoDB cannot run the normal verification transaction. The
// wallet upsert is idempotent, and password login can finish an interrupted
// activation without creating or crediting the wallet twice.
const activateDevelopmentAccount = async user => {
  const balance = user.role === 'platform_client' || user.role === 'both' ? 500 : 0;
  try {
    await Wallet.updateOne({ userId: user._id },
      { $setOnInsert: { userId: user._id, balance } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000 || !await Wallet.exists({ userId: user._id })) throw error;
  }
  await User.updateOne({ _id: user._id, isVerified: false }, { $set: {
    isVerified: true, signupOtpHash: null, signupOtpExpires: null,
    otpAttempts: 0, otpLockedUntil: null,
  } });
};

export const registerUser = async (req, res) => {
  try {
    const { name, password, role, verificationMethod = 'email' } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const phone = req.body.phone ? normalizePhone(req.body.phone) : '';

    if (!name || !password || !role || (!email && !phone)) {
      return res.status(400).json({
        message: "Name, email, password and role are required",
      });
    }

    if (email && !isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ 
        message: "Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, and a number" 
      });
    }

    if (req.body.phone && !phone) {
      return res.status(400).json({ message: 'Use a unique international phone number such as +923001234567' });
    }

    const allowedRoles = ["node_participant", "platform_client", "both"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role selected" });
    }

    if (!['email', 'sms'].includes(verificationMethod) || (verificationMethod === 'email' && !email) || (verificationMethod === 'sms' && !phone)) {
      return res.status(400).json({ message: 'Select email verification with an email address or SMS OTP with a mobile number' });
    }
    const skipOtp = developmentOtpDisabled();
    if (verificationMethod === 'sms' && !skipOtp && !smsAvailable()) return res.status(503).json({ message: 'SMS verification is not configured' });
    // Only the selected verification channel is an authentication identity.
    const existingUser = await User.findOne(verificationMethod === 'sms'
      ? { phone, verificationMethod: 'sms' }
      : { email });

    if (existingUser) {
      return res.status(409).json({ message: existingUser.isVerified === false
        ? skipOtp
          ? 'Account already created. Sign in with your password to finish local activation.'
          : 'Account already created but not verified. Request a new OTP.'
        : verificationMethod === 'sms' ? 'Mobile number already registered' : 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = skipOtp ? null : generateOTP();
    const otpHash = otp ? crypto.createHash('sha256').update(otp).digest('hex') : null;
    const otpExpires = otp ? new Date(Date.now() + 10 * 60 * 1000) : null; // 10 minutes

    const user = await User.create({
      name,
      email: verificationMethod === 'email' ? email : undefined,
      phone,
      verificationMethod,
      password: hashedPassword,
      role,
      isVerified: false,
      signupOtpHash: otpHash,
      signupOtpExpires: otpExpires,
      lastOtpSentAt: otp ? new Date() : undefined,
    });

    if (skipOtp) {
      await activateDevelopmentAccount(user);
      logger.warn({ userId: user._id }, 'Development-only signup OTP bypass used');
      return res.status(201).json({
        message: 'Registration successful in local development mode.',
        verificationRequired: false,
        token: generateToken(user._id),
        user: authUser(user),
      });
    }

    // Send OTP via email
    try {
      await sendCode(user, otp, 'signup');
    } catch (emailErr) {
      logger.warn({ userId: user._id }, 'Verification delivery failed');
      return res.status(503).json({ message: 'Account created but verification delivery failed. Retry using resend.', userId: user._id });
    }

    const response = {
      message: 'Registration successful. Enter the verification code sent to your selected channel.',
      userId: user._id,
      email: user.email,
      identifier: verificationMethod === 'sms' ? user.phone : user.email,
      verificationMethod,
    };

    if (process.env.NODE_ENV === "development") {
      response.devOtp = otp;
    }

    return res.status(201).json(response);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Email or mobile number already registered' });
    return res.status(500).json({
      message: "Registration failed",
      error: error.message,
    });
  }
};

export const verifySignupOtp = async (req, res) => {
  try {
    if (developmentOtpDisabled()) {
      return res.status(409).json({ message: 'Signup OTP is disabled for local development. Sign in with your password instead.' });
    }
    const { email, otp } = req.body;

    if (!email || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await findIdentity(email);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "User is already verified" });
    }

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    if (!user.signupOtpHash || !user.signupOtpExpires || new Date() > user.signupOtpExpires) {
      return res.status(400).json({ message: "OTP has expired. Request a new code." });
    }

    if (user.signupOtpHash !== otpHash) {
      await recordFailedOtpAttempt(user);
      return res.status(400).json({ message: "Invalid OTP. Use the latest code; requesting a new OTP replaces the previous one." });
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
    if (error.status === 503) return res.status(503).json({
      message: 'Verification needs MongoDB replica set transactions. Configure a replica set, then retry or request a new OTP if the code expired.',
    });
    return res.status(500).json({ message: "Verification failed" });
  }
};

export const resendSignupOtp = async (req, res) => {
  try {
    if (developmentOtpDisabled()) {
      return res.status(409).json({ message: 'Signup OTP is disabled for local development. Sign in with your password instead.' });
    }
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await findIdentity(email);

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
      await sendCode(user, otp, 'resend');
    } catch (emailErr) {
      return res.status(503).json({ message: 'Verification delivery failed; retry later' });
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

    const user = await findIdentity(email);

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Explicitly check for false to allow legacy users (undefined/true) to pass
    if (user.isVerified === false && !developmentOtpDisabled()) {
      return res.status(403).json({ message: "Please verify your email before logging in" });
    }

    if (user.status === "blocked") {
      return res.status(403).json({ message: "Your account is blocked" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.isVerified === false) {
      await activateDevelopmentAccount(user);
      logger.warn({ userId: user._id }, 'Development-only signup OTP bypass used for existing account');
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

    const user = await findIdentity(email);

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
      await sendCode(user, otp, 'reset');
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

    const user = await findIdentity(email);

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

    const user = await findIdentity(email);

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
  const { publicUser } = await import('../utils/publicUser.js');
  return res.json({
    user: publicUser(req.user),
  });
};
