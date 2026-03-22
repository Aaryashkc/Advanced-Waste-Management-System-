import mongoose from "mongoose";

const districtSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ["commercial", "residential", "suburban", "rural"],
    required: true
  },
  province: {
    type: String,
    enum: [
      "Koshi",
      "Madhesh",
      "Bagmati",
      "Gandaki",
      "Lumbini",
      "Karnali",
      "Sudurpashchim"
    ],
    required: true
  },
  coordinates: {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

districtSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

districtSchema.index({ name: 1 });
districtSchema.index({ type: 1 });
districtSchema.index({ orgId: 1 });
districtSchema.index({ province: 1 });

const District = mongoose.model("District", districtSchema);

export default District;
