import nodemailer from 'nodemailer';
import config from '../config/env.js';
import logger from '../lib/logger.js';

let transporter = null;

/**
 * Initialize the email transporter.
 * In development without SMTP config, logs emails to console.
 */
const getTransporter = () => {
  if (transporter) return transporter;
  
  if (config.smtp.host && config.smtp.user) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
    logger.info({ host: config.smtp.host, port: config.smtp.port }, 'SMTP transporter initialized');
  } else {
    // Development fallback: log to console
    transporter = {
      sendMail: async (options) => {
        logger.info({
          to: options.to,
          subject: options.subject,
          // Do NOT log OTP content
        }, '[DevEmail] Email would be sent (no SMTP configured)');
        return { messageId: `dev_${Date.now()}` };
      },
    };
    logger.warn('No SMTP configured — emails will be logged to console only');
  }
  
  return transporter;
};

/**
 * Send OTP email for signup verification or password reset.
 * @param {string} to - Recipient email
 * @param {string} otp - The OTP code (plaintext, for email body only)
 * @param {'signup'|'reset'} purpose - OTP purpose
 */
export const sendOtpEmail = async (to, otp, purpose = 'signup') => {
  const transport = getTransporter();
  
  const subjects = {
    signup: 'NetShare — Verify Your Email',
    reset: 'NetShare — Password Reset OTP',
    resend: 'NetShare — Your New Verification Code',
  };
  
  const bodies = {
    signup: `
      <h2>Welcome to NetShare!</h2>
      <p>Your email verification code is:</p>
      <h1 style="font-size: 32px; letter-spacing: 8px; color: #2563eb;">${otp}</h1>
      <p>This code expires in <strong>10 minutes</strong>.</p>
      <p>If you did not create a NetShare account, please ignore this email.</p>
      <hr/>
      <p style="color: #666; font-size: 12px;">NetShare — Managed Distributed Internet Testing Platform</p>
    `,
    reset: `
      <h2>Password Reset Request</h2>
      <p>Your password reset code is:</p>
      <h1 style="font-size: 32px; letter-spacing: 8px; color: #dc2626;">${otp}</h1>
      <p>This code expires in <strong>10 minutes</strong>.</p>
      <p>If you did not request a password reset, please ignore this email and ensure your account is secure.</p>
      <hr/>
      <p style="color: #666; font-size: 12px;">NetShare — Managed Distributed Internet Testing Platform</p>
    `,
    resend: `
      <h2>New Verification Code</h2>
      <p>Your new email verification code is:</p>
      <h1 style="font-size: 32px; letter-spacing: 8px; color: #2563eb;">${otp}</h1>
      <p>This code expires in <strong>10 minutes</strong>.</p>
      <p>Any previously sent codes are now invalid.</p>
      <hr/>
      <p style="color: #666; font-size: 12px;">NetShare — Managed Distributed Internet Testing Platform</p>
    `,
  };
  
  const mailOptions = {
    from: config.smtp.from,
    to,
    subject: subjects[purpose] || subjects.signup,
    html: bodies[purpose] || bodies.signup,
  };
  
  const result = await transport.sendMail(mailOptions);
  logger.info({ to, purpose, messageId: result.messageId }, 'OTP email sent');
  return result;
};

export default { sendOtpEmail };
