import express from "express";
import { register, login, requestOTP, verifyOTP, getMe } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/request-otp", requestOTP);
router.post("/verify-otp", verifyOTP);
router.get("/me", authMiddleware, getMe);

export default router;

