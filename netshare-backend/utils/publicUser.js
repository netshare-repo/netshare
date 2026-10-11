// Central serialization prevents password/OTP material leaking through profile/admin APIs.
export const publicUser = user => {
  if (!user) return null;
  const value = user.toObject ? user.toObject() : { ...user };
  for (const key of ['password', 'signupOtpHash', 'signupOtpExpires', 'resetOtpHash',
    'resetOtpExpires', 'otpAttempts', 'otpLockedUntil', 'lastOtpSentAt', '__v']) delete value[key];
  return value;
};
