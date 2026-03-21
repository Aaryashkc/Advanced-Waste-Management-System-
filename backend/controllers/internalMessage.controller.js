import InternalMessage from "../models/InternalMessage.model.js";

// Get messages by type (org_admin or driver)
export const getMessagesByType = async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!["org_admin", "driver"].includes(type)) {
      return res.status(400).json({ message: "Invalid message type" });
    }

    const messages = await InternalMessage.find({ type })
      .populate("fromUser", "name email role")
      .populate("orgId", "name")
      .sort({ createdAt: -1 });
      
    res.status(200).json({ success: true, data: messages });
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
    res.status(201).json({ success: true, data: newMessage });
  } catch (error) {
    res.status(500).json({ message: "Failed to send internal message", error: error.message });
  }
};
