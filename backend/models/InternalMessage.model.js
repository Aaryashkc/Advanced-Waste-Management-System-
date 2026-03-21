import mongoose from "mongoose";

const internalMessageSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["org_admin", "driver"],
    required: true,
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["unread", "read"],
    default: "unread",
  },
}, { timestamps: true });

const InternalMessage = mongoose.model("InternalMessage", internalMessageSchema);
export default InternalMessage;
