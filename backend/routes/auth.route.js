import express from "express";
import { register, login, requestOTP, verifyOTP, getMe } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  authRateLimiter,
  otpRequestRateLimiter,
  otpVerifyRateLimiter,
} from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

router.post("/register", authRateLimiter, register);
router.post("/login", authRateLimiter, login);
router.post("/request-otp", otpRequestRateLimiter, requestOTP);
router.post("/verify-otp", otpVerifyRateLimiter, verifyOTP);
router.get("/me", authMiddleware, getMe);

export default router;

