import User from "../models/User.model.js";
import { generateToken } from "../config/jwt.config.js";
import bcrypt from "bcryptjs";
import { generateOTP, hashOTP, verifyOTP as verifyOTPHash, isOTPExpired, getOTPExpiration, canResendOTP, isAttemptLimitExceeded } from "../utils/otp.utils.js";
import { sendOTPEmail, sendOTPSMS } from "../services/emailService.js";

export const register = async (req, res) => {
  try {
    const { name, email, password, phone, address, role } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ message: "Name, email, and phone are required" });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }]
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return res.status(400).json({ message: "Email already exists. Please login." });
      }
      if (existingUser.phone === phone) {
        return res.status(400).json({ message: "Phone number already exists. Please login." });
      }
    }

    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Generate OTP for verification
    const otpCode = generateOTP();
    const hashedOTP = hashOTP(otpCode);
    const expiresAt = getOTPExpiration();

    const user = new User({
      name,
      email: email.toLowerCase(),
      passwordHash: hashedPassword,
      phone,
      address,
      role: role || "customer_admin",
      loginOtp: {
        hash: hashedOTP,
        expiresAt: expiresAt,
        attempts: 0,
        lastSentAt: new Date()
      }
    });

    await user.save();

    // Send OTP via email or SMS
    try {
      if (email) {
        await sendOTPEmail(email, otpCode);
      } else if (phone) {
        await sendOTPSMS(phone, otpCode);
      }
    } catch (sendError) {
      console.error("Error sending OTP:", sendError);
      // We continue even if sending fails, user can request resend
    }

    res.status(201).json({
      message: "User registered successfully. Please verify OTP.",
      requireOtp: true,
      email: user.email,
      phone: user.phone,
      // In production, don't send OTP in response. Only for development/testing
      ...(process.env.NODE_ENV === 'development' && { otp: otpCode })
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if user has passwordHash (password-based login) or uses OTP-only
    if (user.passwordHash) {
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
    } else {
      // User doesn't have password, must use OTP
      return res.status(400).json({ message: "Please use OTP login" });
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        orgId: user.orgId,
        address: user.address,
        location: user.location
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

/**
 * Request OTP for login
 * POST /api/auth/request-otp
 * Body: { email?: string, phone?: string }
 */
export const requestOTP = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ message: "Email or phone is required" });
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
    }

    // Find or create user
    let user = null;
    if (email) {
      user = await User.findOne({ email: email.toLowerCase() });
    } else if (phone) {
      user = await User.findOne({ phone });
    }

    // If user doesn't exist, return error (Login flow)
    if (!user) {
      return res.status(404).json({ message: "User not found. Please sign up first." });
    }

    // Check resend cooldown
    if (user.loginOtp?.lastSentAt) {
      if (!canResendOTP(user.loginOtp.lastSentAt, 60)) {
        const remainingSeconds = Math.ceil(60 - (new Date() - new Date(user.loginOtp.lastSentAt)) / 1000);
        return res.status(429).json({
          message: "Please wait before requesting a new OTP",
          retryAfter: remainingSeconds
        });
      }
    }

    // Generate OTP
    const otpCode = generateOTP();
    const hashedOTP = hashOTP(otpCode);
    const expiresAt = getOTPExpiration();

    // Update user's OTP data
    user.loginOtp = {
      hash: hashedOTP,
      expiresAt: expiresAt,
      attempts: 0,
      lastSentAt: new Date()
    };

    await user.save();

    // Send OTP via email or SMS
    try {
      if (email) {
        await sendOTPEmail(email, otpCode);
      } else if (phone) {
        await sendOTPSMS(phone, otpCode);
      }
    } catch (sendError) {
      console.error("Error sending OTP:", sendError);
      // Don't fail the request if email/SMS fails in dev mode
      // In production, you might want to fail here
    }

    res.status(200).json({
      message: "OTP sent successfully",
      // In production, don't send OTP in response. Only for development/testing
      ...(process.env.NODE_ENV === 'development' && { otp: otpCode })
    });
  } catch (error) {
    console.error("Request OTP error:", error);
    res.status(500).json({ message: "Failed to send OTP", error: error.message });
  }
};

/**
 * Verify OTP and login
 * POST /api/auth/verify-otp
 * Body: { email?: string, phone?: string, otp: string }
 */
export const verifyOTP = async (req, res) => {
  try {
    const { email, phone, otp } = req.body;

    if (!otp || otp.length !== 6) {
      return res.status(400).json({ message: "OTP must be 6 digits" });
    }

    if (!email && !phone) {
      return res.status(400).json({ message: "Email or phone is required" });
    }

    // Find user
    let user = null;
    if (email) {
      user = await User.findOne({ email: email.toLowerCase() });
    } else if (phone) {
      user = await User.findOne({ phone });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if OTP exists
    if (!user.loginOtp || !user.loginOtp.hash) {
      return res.status(400).json({ message: "No OTP found. Please request a new OTP" });
    }

    // Check if OTP is expired
    if (isOTPExpired(user.loginOtp.expiresAt)) {
      // Clear expired OTP
      user.loginOtp = null;
      await user.save();
      return res.status(400).json({ message: "OTP has expired. Please request a new one" });
    }

    // Check attempt limit
    if (isAttemptLimitExceeded(user.loginOtp.attempts, 5)) {
      // Clear OTP after max attempts
      user.loginOtp = null;
      await user.save();
      return res.status(429).json({ message: "Too many attempts. Please request a new OTP" });
    }

    // Verify OTP
    const isValid = verifyOTPHash(otp, user.loginOtp.hash);

    if (!isValid) {
      // Increment attempts
      user.loginOtp.attempts = (user.loginOtp.attempts || 0) + 1;
      await user.save();

      const remainingAttempts = 5 - user.loginOtp.attempts;
      return res.status(401).json({
        message: "Invalid OTP",
        remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0
      });
    }

    // OTP is valid - clear it and generate token
    user.loginOtp = null;
    user.lastLoginAt = new Date();
    if (email) {
      user.emailVerified = true;
    }
    if (phone) {
      user.phoneVerified = true;
    }
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id, user.role);

    res.status(200).json({
      message: "OTP verified successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        orgId: user.orgId,
        address: user.address,
        location: user.location
      }
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ message: "OTP verification failed", error: error.message });
  }
};

/**
 * Get current authenticated user
 * GET /api/auth/me
 * Requires: Authorization header with Bearer token
 */
export const getMe = async (req, res) => {
  try {
    // User is attached by authMiddleware
    const user = req.user;

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        orgId: user.orgId,
        address: user.address,
        location: user.location
      }
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ message: "Failed to fetch user", error: error.message });
  }
};

