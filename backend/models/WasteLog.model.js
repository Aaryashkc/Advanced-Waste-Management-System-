import mongoose from "mongoose";

const wasteLogSchema = new mongoose.Schema({
  area: {
    type: String,
    required: true,
    trim: true
  },
  districtType: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  actualWasteKg: {
    type: Number,
    required: true,
    min: 0
  },
  predictedWasteKg: {
    type: Number
  },
  mlScheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MLSchedule"
  },
  loggedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  notes: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    enum: ["driver_completion", "admin_entry", "import"],
    default: "driver_completion"
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

wasteLogSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

wasteLogSchema.index({ area: 1, date: 1 });
wasteLogSchema.index({ mlScheduleId: 1 });

const WasteLog = mongoose.model("WasteLog", wasteLogSchema);

export default WasteLog;
