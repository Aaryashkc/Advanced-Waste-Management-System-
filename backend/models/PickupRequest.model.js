import mongoose from "mongoose";

/**
 * PickupRequest — represents a customer's ad-hoc waste pickup request.
 * Lifecycle:  PENDING → ASSIGNED (driver accepted)
 *                     → CANCELLED (customer cancelled)
 *                     → EXPIRED   (no driver within 10 min)
 * After pickup: ASSIGNED → COMPLETED
 */
const pickupRequestSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        wasteUploadId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "WasteUpload",
            default: null,
        },

        // Pickup location chosen by customer on map
        location: {
            latitude: { type: Number, required: true },
            longitude: { type: Number, required: true },
            address: { type: String, default: null },
        },

        // Copied from the waste image upload
        category: {
            type: String,
            enum: ["recyclable", "non-recyclable", "both"],
            default: "non-recyclable",
        },
        level: {
            type: String,
            enum: ["easy", "medium", "hard"],
            default: "easy",
        },

        // Organisation scope — used to broadcast only to relevant drivers
        orgId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            default: null,
            index: true,
        },

        // Drivers selected by the matching algorithm
        matchedDriverIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }],

        status: {
            type: String,
            enum: ["PENDING", "ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING", "REJECTED", "CANCELLED", "EXPIRED", "COMPLETED"],
            default: "PENDING",
            index: true,
        },

        // Set atomically when a driver accepts
        driverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        // Denormalised driver snapshot so the customer gets it instantly
        driverInfo: {
            name: { type: String, default: null },
            phone: { type: String, default: null },
            vehicleId: { type: String, default: null },   // truck id / plate
            licensePlate: { type: String, default: null },
        },

        assignedAt: { type: Date, default: null },

        // Auto-expires pending request after 10 minutes
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 10 * 60 * 1000),
        },
    },
    { timestamps: true }
);

// TTL index so MongoDB removes expired PENDING docs automatically (optional; status-based filtering is primary)
pickupRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PickupRequest = mongoose.model("PickupRequest", pickupRequestSchema);
export default PickupRequest;
