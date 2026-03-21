import crypto from 'crypto';

/**
 * Generate a random 6-digit OTP code
 * @returns {string} - 6-digit OTP code
 */
export const generateOTP = () => {
  // Use crypto.randomInt for cryptographically secure random OTP
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Hash OTP using SHA-256
 * @param {string} otp - Plain OTP code
 * @returns {string} - Hashed OTP
 */
export const hashOTP = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

/**
 * Verify OTP by comparing hashed values
 * @param {string} plainOTP - Plain OTP code from user
 * @param {string} hashedOTP - Stored hashed OTP
 * @returns {boolean} - True if OTP matches
 */
export const verifyOTP = (plainOTP, hashedOTP) => {
  if (!hashedOTP) return false;

  const hashedInput = hashOTP(plainOTP);

  try {
    const a = Buffer.from(hashedInput, 'hex');
    const b = Buffer.from(hashedOTP, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (err) {
    return false;
  }
};

/**
 * Check if OTP is expired
 * @param {Date} expiresAt - Expiration date
 * @returns {boolean} - True if expired
 */
export const isOTPExpired = (expiresAt) => {
  if (!expiresAt) return true;
  return new Date() > new Date(expiresAt);
};

/**
 * Get OTP expiration time (10 minutes from now)
 * @returns {Date} - Expiration date
 */
export const getOTPExpiration = () => {
  const expiration = new Date();
  expiration.setMinutes(expiration.getMinutes() + 10);
  return expiration;
};

/**
 * Check if resend is allowed (cooldown period)
 * @param {Date} lastSentAt - Last sent timestamp
 * @param {number} cooldownSeconds - Cooldown in seconds (default: 60)
 * @returns {boolean} - True if resend is allowed
 */
export const canResendOTP = (lastSentAt, cooldownSeconds = 60) => {
  if (!lastSentAt) return true;
  const now = new Date();
  const lastSent = new Date(lastSentAt);
  const diffSeconds = (now - lastSent) / 1000;
  return diffSeconds >= cooldownSeconds;
};

/**
 * Check if OTP attempts exceeded limit
 * @param {number} attempts - Current attempt count
 * @param {number} maxAttempts - Maximum allowed attempts (default: 5)
 * @returns {boolean} - True if exceeded
 */
export const isAttemptLimitExceeded = (attempts, maxAttempts = 5) => {
  return attempts >= maxAttempts;
};

