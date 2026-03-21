import mongoose from "mongoose";

const RETENTION_DAYS = 30;

function defaultExpiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + RETENTION_DAYS);
  return d;
}

const wasteUploadSchema = new mongoose.Schema({
  publicId: {
    type: String,
    required: true,
    unique: true,
  },
  url: {
    type: String,
    required: true,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  category: {
    type: String,
    enum: ["recyclable", "non-recyclable", "both"],
    default: "non-recyclable",
  },
  level: {
    type: String,
    enum: ["easy", "medium", "hard"],
    default: "easy",
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  expiresAt: {
    type: Date,
    default: defaultExpiresAt,
    required: true,
  },
  context: {
    type: String,
    default: "waste_upload",
    trim: true,
  },
  wasteRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
});

wasteUploadSchema.index({ expiresAt: 1 });

const WasteUpload = mongoose.model("WasteUpload", wasteUploadSchema);

export default WasteUpload;
export { RETENTION_DAYS };
