import mongoose from "mongoose";

// Helper: classify duty type from capacity
const classifyDuty = (capacity) => {
  if (!capacity || capacity < 1000) return 'light duty';
  if (capacity <= 5000) return 'medium duty';
  return 'heavy duty';
};

const truckSchema = new mongoose.Schema({
  truckType: {
    type: String,
    enum: ["BIO", "NON_BIO", "MIXED"],
    required: true
  },
  dutyType: {
    type: String,
    enum: ['light duty', 'medium duty', 'heavy duty'],
    default: 'medium duty'
  },
  capacity: {
    type: Number,
    required: true,
    min: 0
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true
  },
  licensePlate: {
    type: String,
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

truckSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  // Auto-classify duty type from capacity
  if (this.capacity !== undefined) {
    this.dutyType = classifyDuty(this.capacity);
  }
  next();
});

const Truck = mongoose.model("Truck", truckSchema);

export default Truck;

