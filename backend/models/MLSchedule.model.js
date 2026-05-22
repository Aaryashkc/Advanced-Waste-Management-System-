import mongoose from "mongoose";

const assignedTruckSchema = new mongoose.Schema({
  truckId: { type: String },
  licensePlate: { type: String },
  driverName: { type: String },
  driverId: { type: String },
  capacity: { type: Number },
  truckType: { type: String },
  orgId: { type: String },
  orgName: { type: String },
  completionStatus: {
    type: String,
    enum: ["pending", "in_progress", "completed", "failed"],
    default: "pending",
  },
  completedAt: { type: Date, default: null },
  completedBy: { type: String, default: null },
  completionNote: { type: String, default: null },
}, { _id: false });

const areaEntrySchema = new mongoose.Schema({
  area: { type: String, required: true },
  areaType: { type: String },
  predictedWasteKg: { type: Number, default: 0 },
  wasteCategory: {
    type: String,
    enum: ["none", "low", "medium", "high", "critical"]
  },
  action: {
    type: String,
    enum: ["dispatch", "skip", "reduced"]
  },
  recommendation: { type: String },
  predictionMethod: { type: String },
  predictionConfidence: {
    score: { type: Number },
    label: { type: String },
    estimatedErrorKg: { type: Number },
    basis: { type: mongoose.Schema.Types.Mixed },
  },
  isHoliday: { type: Boolean, default: false },
  holidayName: { type: String },
  assignedTrucks: [assignedTruckSchema],
  skipReason: { type: String, default: null },
  orgId: { type: String },
  orgName: { type: String },
}, { _id: false });

const mlScheduleSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  dayName: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ["draft", "confirmed", "completed", "cancelled"],
    default: "draft"
  },
  totalPredictedWasteKg: {
    type: Number,
    default: 0
  },
  summary: {
    totalAreas: { type: Number },
    dispatched: { type: Number },
    skipped: { type: Number },
    reduced: { type: Number },
    totalTrucksAssigned: { type: Number },
    totalTrucksAvailable: { type: Number },
    driverlessTrucks: { type: Number, default: 0 },
    unavailableDrivers: [{ type: String }],
    optimizer: { type: String }
  },
  areas: [areaEntrySchema],
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  confirmedAt: {
    type: Date
  },
  mlModelInfo: {
    model: { type: String },
    r2Score: { type: Number },
    validationStrategy: { type: String },
    mae: { type: Number },
    rmse: { type: Number },
    latestDataDate: { type: String },
    metrics: { type: mongoose.Schema.Types.Mixed }
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

mlScheduleSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

mlScheduleSchema.index({ date: 1 });
mlScheduleSchema.index({ status: 1 });

const MLSchedule = mongoose.model("MLSchedule", mlScheduleSchema);

export default MLSchedule;
