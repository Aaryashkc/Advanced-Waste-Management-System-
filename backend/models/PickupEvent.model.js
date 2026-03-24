import mongoose from "mongoose";

/**
 * PickupEvent — immutable audit log for every pickup lifecycle event.
 * Each row represents a single action that occurred on a pickup request.
 * Never updated or deleted — append-only for full traceability.
 */
const pickupEventSchema = new mongoose.Schema(
  {
    pickupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PickupRequest",
      required: true,
      index: true,
    },

    // What happened
    event: {
      type: String,
      enum: [
        "CREATED",       // Customer submitted the request
        "MATCHED",       // Driver matching algorithm ran
        "BROADCAST",     // Fallback broadcast to all drivers
        "ACCEPTED",      // Driver accepted the pickup
        "REJECTED",      // Pickup was already taken (409 attempt logged)
        "EN_ROUTE",      // Driver heading to customer
        "ARRIVED",       // Driver at pickup location
        "COLLECTING",    // Driver collecting waste
        "COMPLETED",     // Pickup finished
        "CANCELLED",     // Customer or admin cancelled
        "EXPIRED",       // TTL expired with no acceptance
        "REASSIGNED",    // Admin reassigned to different driver
      ],
      required: true,
    },

    // Who performed the action
    performedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      role: { type: String, default: null },        // customer_admin, driver, admin, super_admin, system
      name: { type: String, default: null },
    },

    // Previous and new status for state transitions
    fromStatus: { type: String, default: null },
    toStatus: { type: String, default: null },

    // Flexible metadata for event-specific details
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Server timestamp (not client-supplied)
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,  // we use our own `timestamp` field
    versionKey: false,
  }
);

// Compound index for efficient queries: "all events for a pickup" and "events by type"
pickupEventSchema.index({ pickupId: 1, timestamp: 1 });
pickupEventSchema.index({ event: 1, timestamp: -1 });
pickupEventSchema.index({ "performedBy.userId": 1, timestamp: -1 });

const PickupEvent = mongoose.model("PickupEvent", pickupEventSchema);
export default PickupEvent;
