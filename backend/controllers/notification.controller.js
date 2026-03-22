import Notification from "../models/notification.model.js";

/**
 * Get notifications for the current user based on their role.
 * GET /api/notifications
 */
export const getNotifications = async (req, res) => {
  try {
    const { role, orgId, _id: userId } = req.user;
    const { unreadOnly, limit = 50, page = 1 } = req.query;

    const filter = {
      targetRoles: role,
    };

    // Admin only sees notifications for their org (or global ones with no orgId)
    if (role === "admin" && orgId) {
      filter.$or = [
        { orgId: orgId },
        { orgId: null },
      ];
    }

    if (unreadOnly === "true") {
      filter.readBy = { $ne: userId };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Add isRead flag for current user
    const data = notifications.map((n) => ({
      ...n,
      isRead: n.readBy?.some((id) => id.toString() === userId.toString()) || false,
    }));

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({
      ...filter,
      readBy: { $ne: userId },
    });

    res.status(200).json({
      success: true,
      data,
      total,
      unreadCount,
      page: parseInt(page),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch notifications", error: error.message });
  }
};

/**
 * Mark a notification as read.
 * PUT /api/notifications/:id/read
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    await Notification.findByIdAndUpdate(id, {
      $addToSet: { readBy: userId },
    });

    res.status(200).json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to mark notification as read", error: error.message });
  }
};

/**
 * Mark all notifications as read for current user.
 * PUT /api/notifications/read-all
 */
export const markAllAsRead = async (req, res) => {
  try {
    const { role, orgId, _id: userId } = req.user;

    const filter = { targetRoles: role };
    if (role === "admin" && orgId) {
      filter.$or = [{ orgId }, { orgId: null }];
    }

    await Notification.updateMany(filter, {
      $addToSet: { readBy: userId },
    });

    res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to mark all as read", error: error.message });
  }
};

/**
 * Get unread notification count.
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (req, res) => {
  try {
    const { role, orgId, _id: userId } = req.user;

    const filter = {
      targetRoles: role,
      readBy: { $ne: userId },
    };

    if (role === "admin" && orgId) {
      filter.$or = [{ orgId }, { orgId: null }];
    }

    const count = await Notification.countDocuments(filter);

    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to get unread count", error: error.message });
  }
};

/**
 * Create a system notification (used internally by other controllers).
 */
export const createSystemNotification = async ({
  type,
  title,
  message,
  severity = "warning",
  targetRoles = ["admin", "super_admin"],
  orgId = null,
  relatedData = {},
}) => {
  try {
    const notification = new Notification({
      type,
      title,
      message,
      severity,
      targetRoles,
      orgId,
      relatedData,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error("Failed to create system notification:", error.message);
    return null;
  }
};
