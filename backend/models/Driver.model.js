import mongoose from "mongoose";

const driverSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  currentLocation: {
    latitude: {
      type: Number
    },
    longitude: {
      type: Number
    },
    address: {
      type: String
    }
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  assignedTruckId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Truck",
    default: null
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

driverSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  next();
});

const Driver = mongoose.model("Driver", driverSchema);

export default Driver;

