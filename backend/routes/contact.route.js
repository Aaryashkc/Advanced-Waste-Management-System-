import express from "express";
import { submitContactMessage, getUnreadCount, getMessages, markAsRead } from "../controllers/contact.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";

const router = express.Router();

// Public route to submit messages
router.post("/submit", submitContactMessage);

// Protected routes for admins/super admins
router.use(authMiddleware);
// Allow both admin types
router.use((req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
    next();
  } else {
    res.status(403).json({ message: "Access denied: Requires admin privileges" });
  }
});

router.get("/unread-count", getUnreadCount);
router.get("/messages", getMessages);
router.put("/:id/read", markAsRead);

export default router;
