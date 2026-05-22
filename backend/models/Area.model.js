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
  coordinates: {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  address: {
    type: String,
    default: ""
  },
  scaleFactor: {
    type: Number,
    default: 1.0,
    min: 0.1,
    max: 5.0
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

areaSchema.index({ type: 1 });
areaSchema.index({ orgId: 1 });

const Area = mongoose.model("Area", areaSchema);

export default Area;
