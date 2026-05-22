import Notification from "../models/notification.model.js";
import { emitNotification, getIO } from "../socket/socketServer.js";
import { buildPaginationMeta, getPagination } from "../utils/pagination.js";

/**
 * Get notifications for the current user based on their role.
 * GET /api/notifications
 */
export const getNotifications = async (req, res) => {
  try {
    const { role, orgId, _id: userId } = req.user;
    const { unreadOnly } = req.query;
    const pagination = getPagination(req.query, { defaultLimit: 10 });

    const filter = {
      targetRoles: role,
    };

    // Drivers only see notifications targeted at them specifically
    if (role === "driver") {
      filter.targetUserId = userId;
    }

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

    const notifications = await Notification.find(filter)
      .select("type title message severity from targetRoles orgId relatedData targetUserId readBy createdAt")
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
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
      page: pagination.page,
      pagination: buildPaginationMeta({ ...pagination, total }),
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

    // Emit updated unread count so the badge updates in real-time
    try {
      const { role, orgId } = req.user;
      const countFilter = { targetRoles: role, readBy: { $ne: userId } };
      if (role === "driver") {
        countFilter.targetUserId = userId;
      }
      if (role === "admin" && orgId) {
        countFilter.$or = [{ orgId }, { orgId: null }];
      }
      const count = await Notification.countDocuments(countFilter);
      const io = getIO();
      if (role === "driver") {
        io.to(`driver:${userId}`).emit("notification:counts", { notifications: count });
      } else {
        io.to("admins").emit("notification:counts", { notifications: count });
      }
    } catch (_) { /* socket may not be ready */ }

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
    if (role === "driver") {
      filter.targetUserId = userId;
    }
    if (role === "admin" && orgId) {
      filter.$or = [{ orgId }, { orgId: null }];
    }

    await Notification.updateMany(filter, {
      $addToSet: { readBy: userId },
    });

    // Emit updated unread count so the badge clears immediately
    try {
      const io = getIO();
      if (role === "driver") {
        io.to(`driver:${userId}`).emit("notification:counts", { notifications: 0 });
      } else {
        io.to("admins").emit("notification:counts", { notifications: 0 });
      }
    } catch (_) { /* socket may not be ready */ }

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

    if (role === "driver") {
      filter.targetUserId = userId;
    }

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
  targetUserId = null,
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
      targetUserId,
    });
    await notification.save();

    // Push real-time notification via socket
    try {
      const payload = {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        severity: notification.severity,
        targetRoles: notification.targetRoles,
        orgId: notification.orgId,
        relatedData: notification.relatedData,
        createdAt: notification.createdAt,
        isRead: false,
      };

      if (targetUserId && targetRoles.includes("driver")) {
        // Send to the specific driver's socket room
        const { getIO } = await import("../socket/socketServer.js");
        const io = getIO();
        io.to(`driver:${targetUserId}`).emit("notification:new", payload);
      } else {
        emitNotification(payload);
      }
    } catch (_) { /* socket may not be initialized during tests */ }

    return notification;
  } catch (error) {
    console.error("Failed to create system notification:", error.message);
    return null;
  }
};
