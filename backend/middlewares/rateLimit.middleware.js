import rateLimit from "express-rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const rateLimitMessage = "Too many requests. Please try again later.";

export const authRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: rateLimitMessage },
});

export const otpRequestRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: Number(process.env.OTP_REQUEST_RATE_LIMIT_MAX || 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many OTP requests. Please wait before trying again." },
});

export const otpVerifyRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: Number(process.env.OTP_VERIFY_RATE_LIMIT_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many OTP verification attempts. Please request a new code later." },
});
