import ContactMessage from "../models/ContactMessage.model.js";
import Organization from "../models/Organization.model.js";
import { getIO } from "../socket/socketServer.js";
import { buildPaginationMeta, getPagination } from "../utils/pagination.js";

// Submit a new contact message (Public)
export const submitContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "Name, email, and message are required." });
    }

    const newMessage = new ContactMessage({ name, email, subject, message });
    await newMessage.save();

    // Emit event to admins room
    try {
      const io = getIO();
      // We pass the new message to instantly populate frontend lists if needed.
      io.to("admins").emit("new_contact_message", newMessage);
    } catch (socketErr) {
      console.error("Socket error on contact message emission:", socketErr);
      // We don't fail the request if the socket isn't initialized yet
    }

    res.status(201).json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit message", error: error.message });
  }
};

// Submit a support message from an authenticated organization admin.
export const submitAdminContactMessage = async (req, res) => {
  try {
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ message: "Subject and message are required." });
    }

    const org = req.user.orgId
      ? await Organization.findById(req.user.orgId).select("name").lean()
      : null;

    const newMessage = new ContactMessage({
      name: req.user.name,
      email: req.user.email,
      subject: subject.trim(),
      message: message.trim(),
      userId: req.user._id,
      role: req.user.role,
      orgId: req.user.orgId || null,
      orgName: org?.name || null,
    });
    await newMessage.save();

    try {
      const io = getIO();
      io.to("admins").emit("new_contact_message", newMessage);
    } catch (socketErr) {
      console.error("Socket error on contact message emission:", socketErr);
    }

    res.status(201).json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit message", error: error.message });
  }
};

// Get the count of all unread messages (Protected: Admin/SuperAdmin)
export const getUnreadCount = async (req, res) => {
  try {
    const count = await ContactMessage.countDocuments({ status: "unread" });
    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch unread count", error: error.message });
  }
};

// Optionally get all messages for a messages dashboard
export const getMessages = async (req, res) => {
  try {
    const pagination = getPagination(req.query);
    const messages = await ContactMessage.find()
      .select("name email subject message status userId role orgId orgName createdAt updatedAt")
      .populate("userId", "name email role")
      .populate("orgId", "name")
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();
    const total = await ContactMessage.countDocuments();
    res.status(200).json({
      success: true,
      data: messages,
      pagination: buildPaginationMeta({ ...pagination, total }),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch messages", error: error.message });
  }
};

// Mark a specific message as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await ContactMessage.findByIdAndUpdate(
      id,
      { status: "read" },
      { new: true }
    );
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }
    
    // Emit event to update count on other admin clients
    try {
      const io = getIO();
      const count = await ContactMessage.countDocuments({ status: "unread" });
      io.to("admins").emit("update_unread_count", count);
    } catch (socketErr) {
      console.error("Socket error on update_unread_count emission:", socketErr);
    }

    res.status(200).json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark message as read", error: error.message });
  }
};

// Delete a specific contact message (Protected: SuperAdmin)
export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await ContactMessage.findByIdAndDelete(id);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    try {
      const io = getIO();
      const count = await ContactMessage.countDocuments({ status: "unread" });
      io.to("admins").emit("update_unread_count", count);
    } catch (socketErr) {
      console.error("Socket error on delete contact message emission:", socketErr);
    }

    res.status(200).json({ success: true, message: "Contact message deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete message", error: error.message });
  }
};
