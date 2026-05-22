import InternalMessage from "../models/InternalMessage.model.js";
import { getIO } from "../socket/socketServer.js";
import { buildPaginationMeta, getPagination } from "../utils/pagination.js";

async function emitInternalMessageCounts(type) {
  try {
    const count = await InternalMessage.countDocuments({ type, status: "unread" });
    getIO().to("admins").emit("internal-message:counts", { [type]: count });
  } catch (socketErr) {
    console.error("Socket error on internal message count emission:", socketErr.message);
  }
}

// Get messages by type (org_admin or driver)
export const getMessagesByType = async (req, res) => {
  try {
    const { type } = req.params;
    const pagination = getPagination(req.query);
    
    if (!["org_admin", "driver"].includes(type)) {
      return res.status(400).json({ message: "Invalid message type" });
    }

    const messages = await InternalMessage.find({ type })
      .select("type fromUser orgId title message status createdAt updatedAt")
      .populate("fromUser", "name email role")
      .populate("orgId", "name")
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();
    const total = await InternalMessage.countDocuments({ type });
      
    res.status(200).json({
      success: true,
      data: messages,
      pagination: buildPaginationMeta({ ...pagination, total }),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch internal messages", error: error.message });
  }
};

// Get unread count by type
export const getUnreadCount = async (req, res) => {
  try {
    const { type } = req.params;
    if (!["org_admin", "driver"].includes(type)) {
      return res.status(400).json({ message: "Invalid message type" });
    }
    const count = await InternalMessage.countDocuments({ type, status: "unread" });
    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch unread count", error: error.message });
  }
};

// Mark an internal message as read
export const markMessageAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await InternalMessage.findByIdAndUpdate(
      id,
      { status: "read" },
      { new: true }
    );
    
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    await emitInternalMessageCounts(message.type);

    res.status(200).json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark message as read", error: error.message });
  }
};

// Optional: Endpoint for drivers and org_admins to send a message
export const sendInternalMessage = async (req, res) => {
  try {
    const { title, message, type } = req.body;
    
    // In a real implementation we would validate the sender role matches the type
    const newMessage = new InternalMessage({
      type,
      fromUser: req.user._id,
      orgId: req.user.orgId,
      title,
      message,
    });
    
    await newMessage.save();

    const populatedMessage = await InternalMessage.findById(newMessage._id)
      .populate("fromUser", "name email role")
      .populate("orgId", "name");

    try {
      getIO().to("admins").emit("internal-message:new", populatedMessage || newMessage);
    } catch (socketErr) {
      console.error("Socket error on internal message emission:", socketErr.message);
    }

    res.status(201).json({ success: true, data: newMessage });
  } catch (error) {
    res.status(500).json({ message: "Failed to send internal message", error: error.message });
  }
};
