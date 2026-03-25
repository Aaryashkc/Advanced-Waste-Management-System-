import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["general", "driverless_truck", "no_driver", "no_truck", "schedule_failed", "redispatch_needed", "schedule_confirmed"],
    default: "general",
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  severity: {
    type: String,
    enum: ["info", "warning", "critical"],
    default: "info",
  },
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  targetRoles: [{ type: String, enum: ["admin", "super_admin", "driver"] }],
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    default: null,
  },
  relatedData: {
    scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "MLSchedule" },
    truckIds: [{ type: String }],
    trucks: [{
      id: String,
      licensePlate: String,
      orgName: String,
      capacity: Number,
    }],
    areaName: { type: String },
    date: { type: String },
    reason: { type: String },
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ targetRoles: 1 });
notificationSchema.index({ orgId: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;