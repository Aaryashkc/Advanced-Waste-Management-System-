import ContactMessage from "../models/ContactMessage.model.js";
import { getIO } from "../socket/socketServer.js";

// Submit a new contact message (Public)
export const submitContactMessage = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "Name, email, and message are required." });
    }

    const newMessage = new ContactMessage({ name, email, message });
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
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: messages });
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
