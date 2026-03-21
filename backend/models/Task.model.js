import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
  taskType: {
    type: String,
    enum: ["ROUTINE", "ON_DEMAND"],
    required: true
  },
  wasteType: {
    type: String,
    enum: ["BIO", "NON_BIO"],
    required: true
  },
  estimatedVolume: {
    type: Number,
    required: true,
    min: 0
  },
  location: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    address: {
      type: String,
      required: true
    }
  },
  status: {
    type: String,
    enum: ["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED"],
    default: "PENDING"
  },
  assignedDriverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
    default: null
  },
  assignedTruckId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Truck",
    default: null
  },
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  scheduledDate: {
    type: Date
  },
  completedAt: {
    type: Date
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

taskSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  next();
});

const Task = mongoose.model("Task", taskSchema);

export default Task;

