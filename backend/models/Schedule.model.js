import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema({
  city: {
    type: String,
    required: true,
    trim: true
  },
  area: {
    type: String,
    required: true,
    trim: true
  },
  truckId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Truck",
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
    required: true
  },
  day: {
    type: String,
    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    required: true
  },
  time: {
    type: String,
    required: true,
    trim: true // e.g., "~7:00 am"
  },
  truckType: {
    type: String,
    enum: ["light duty", "medium duty", "heavy duty"],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true
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

scheduleSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
scheduleSchema.index({ city: 1, area: 1 });
scheduleSchema.index({ day: 1 });
scheduleSchema.index({ orgId: 1 });

const Schedule = mongoose.model("Schedule", scheduleSchema);

export default Schedule;

