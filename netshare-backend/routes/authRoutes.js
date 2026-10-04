import express from 'express';
import {
  registerUser,
  loginUser,
  getMe,
  verifySignupOtp,
  resendSignupOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkOtpAttempts, checkResendCooldown } from '../middleware/otpProtection.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/verify-signup-otp', checkOtpAttempts, verifySignupOtp);
router.post('/resend-signup-otp', checkResendCooldown, resendSignupOtp);
router.post('/login', loginUser);
router.post('/forgot-password', checkResendCooldown, forgotPassword);
router.post('/verify-reset-otp', checkOtpAttempts, verifyResetOtp);
router.post('/reset-password', checkOtpAttempts, resetPassword);
router.get('/me', protect, getMe);

export default router;