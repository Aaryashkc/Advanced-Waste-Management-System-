import mongoose from "mongoose";

const areaSchema = new mongoose.Schema({
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
  address: {
    type: String,
    default: ""
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

areaSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

areaSchema.index({ name: 1 });
areaSchema.index({ type: 1 });
areaSchema.index({ orgId: 1 });
areaSchema.index({ province: 1 });

const Area = mongoose.model("Area", areaSchema);

export default Area;
