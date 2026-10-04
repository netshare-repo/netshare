import User from '../models/User.js';
import logger from '../lib/logger.js';

const MAX_OTP_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds between resends

/**
 * Middleware to check if OTP verification attempts are within limits.
 * Prevents brute-force guessing of 6-digit OTPs.
 */
export const checkOtpAttempts = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next();
    
    const user = await User.findOne({ email });
    if (!user) return next(); // Don't reveal user existence
    
    // Check lockout
    if (user.otpLockedUntil && new Date() < user.otpLockedUntil) {
      const remainingMs = new Date(user.otpLockedUntil).getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      logger.warn({ email, remainingMin }, 'OTP verification blocked — account locked');
      return res.status(429).json({
        success: false,
        error: {
          code: 'OTP_LOCKED',
          message: `Too many failed attempts. Please try again in ${remainingMin} minute(s).`,
          requestId: req.requestId,
        },
      });
    }
    
    next();
  } catch (err) {
    logger.error({ err }, 'OTP protection middleware error');
    next();
  }
};

/**
 * Records a failed OTP attempt. Call this when OTP verification fails.
 */
export const recordFailedOtpAttempt = async (user) => {
  const attempts = (user.otpAttempts || 0) + 1;
  const update = { otpAttempts: attempts };
  
  if (attempts >= MAX_OTP_ATTEMPTS) {
    update.otpLockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    update.otpAttempts = 0; // Reset counter after lockout
    logger.warn({ email: user.email, attempts }, 'OTP attempt limit reached — locking account');
  }
  
  await User.findByIdAndUpdate(user._id, update);
};

/**
 * Resets OTP attempt counter. Call this on successful verification.
 */
export const resetOtpAttempts = async (user) => {
  await User.findByIdAndUpdate(user._id, {
    otpAttempts: 0,
    otpLockedUntil: null,
  });
};

/**
 * Middleware to enforce resend cooldown.
 */
export const checkResendCooldown = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next();
    
    const user = await User.findOne({ email });
    if (!user) return next();
    
    if (user.lastOtpSentAt) {
      const elapsed = Date.now() - new Date(user.lastOtpSentAt).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({
          success: false,
          error: {
            code: 'RESEND_COOLDOWN',
            message: `Please wait ${waitSec} seconds before requesting a new OTP.`,
            requestId: req.requestId,
          },
        });
      }
    }
    
    next();
  } catch (err) {
    logger.error({ err }, 'Resend cooldown middleware error');
    next();
  }
};

/**
 * Records when an OTP was sent. Call this after generating a new OTP.
 */
export const recordOtpSent = async (user) => {
  await User.findByIdAndUpdate(user._id, { lastOtpSentAt: new Date() });
};

export default {
  checkOtpAttempts,
  recordFailedOtpAttempt,
  resetOtpAttempts,
  checkResendCooldown,
  recordOtpSent,
};
