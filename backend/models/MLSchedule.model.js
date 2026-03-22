import mongoose from "mongoose";

const assignedTruckSchema = new mongoose.Schema({
  truckId: { type: String },
  licensePlate: { type: String },
  driverName: { type: String },
  driverId: { type: String },
  capacity: { type: Number },
  truckType: { type: String },
  orgId: { type: String },
  orgName: { type: String }
}, { _id: false });

const districtEntrySchema = new mongoose.Schema({
  district: { type: String, required: true },
  districtType: { type: String },
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
  isHoliday: { type: Boolean, default: false },
  holidayName: { type: String },
  assignedTrucks: [assignedTruckSchema],
  skipReason: { type: String, default: null },
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
    totalDistricts: { type: Number },
    dispatched: { type: Number },
    skipped: { type: Number },
    reduced: { type: Number },
    totalTrucksAssigned: { type: Number },
    totalTrucksAvailable: { type: Number },
    driverlessTrucks: { type: Number, default: 0 },
    unavailableDrivers: [{ type: String }]
  },
  districts: [districtEntrySchema],
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
    r2Score: { type: Number }
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
