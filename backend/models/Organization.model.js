import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  location: {
    latitude: {
      type: Number
    },
    longitude: {
      type: Number
    },
    address: {
      type: String,
      required: true
    }
  },
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  fleet: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Truck"
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

organizationSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  next();
});

const Organization = mongoose.model("Organization", organizationSchema);

export default Organization;

