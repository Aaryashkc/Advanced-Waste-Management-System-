import mongoose from "mongoose";

const deletionRequestSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["vehicle", "driver"],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  targetName: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  reviewNote: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date
  }
});

const DeletionRequest = mongoose.model("DeletionRequest", deletionRequestSchema);

export default DeletionRequest;
