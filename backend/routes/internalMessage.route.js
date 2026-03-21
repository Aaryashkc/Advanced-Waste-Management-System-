import express from "express";
import { getMessagesByType, markMessageAsRead, sendInternalMessage, getUnreadCount } from "../controllers/internalMessage.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

// Get unread count by type
router.get("/:type/unread-count", getUnreadCount);

// Get messages by type (e.g. org_admin or driver)
router.get("/:type", getMessagesByType);

// Mark a message as read
router.put("/:id/read", markMessageAsRead);

// Send an internal message (for drivers and org admins to use)
router.post("/send", sendInternalMessage);

export default router;
