import mongoose from "mongoose";

const locationSchema = new mongoose.Schema({
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
    address: {
        type: String,
        required: true,
        trim: true
    },
    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },
    orgId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        index: true
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

locationSchema.pre("save", function (next) {
    this.updatedAt = Date.now();
    next();
});

// Index for efficient queries
locationSchema.index({ city: 1, area: 1 });

const Location = mongoose.model("Location", locationSchema);

export default Location;
