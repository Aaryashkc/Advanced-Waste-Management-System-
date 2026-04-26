import mongoose from "mongoose";

/**
 * PickupRequest — represents a customer's ad-hoc waste pickup request.
 *
 * Lifecycle:  PENDING → ASSIGNED (driver accepted)
 *                     → EN_ROUTE → ARRIVED → COLLECTING → COMPLETED
 *                     → CANCELLED (customer/admin cancelled)
 *                     → EXPIRED   (no driver within TTL)
 *
 * statusHistory[] tracks every transition with actor + timestamp for audit.
 */

const statusTransitionSchema = new mongoose.Schema(
  {
    from: { type: String, default: null },
    to: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      role: { type: String, default: null },
      name: { type: String, default: null },
    },
    note: { type: String, default: null },
  },
  { _id: false }
);

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

    // Customer-selected province and area (within the org/municipality)
    province: { type: String, default: null },
    area: { type: String, default: null },

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
    matchedDriverIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],

    status: {
      type: String,
      enum: [
        "PENDING", "ASSIGNED", "EN_ROUTE", "ARRIVED",
        "COLLECTING", "REJECTED", "CANCELLED", "EXPIRED", "COMPLETED",
      ],
      default: "PENDING",
      index: true,
    },

    // Set atomically when a driver accepts
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // Denormalised driver snapshot so the customer gets it instantly
    driverInfo: {
      name: { type: String, default: null },
      phone: { type: String, default: null },
      vehicleId: { type: String, default: null },
      licensePlate: { type: String, default: null },
    },

    // ── Key timestamps ──────────────────────────────────────────────────
    assignedAt: { type: Date, default: null },
    enRouteAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    collectingAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },

    // Who cancelled (if applicable)
    cancelledBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      role: { type: String, default: null },
      name: { type: String, default: null },
    },
    cancelReason: { type: String, default: null },

    // ── Embedded audit trail ────────────────────────────────────────────
    statusHistory: [statusTransitionSchema],

    // Auto-expires pending request (TTL)
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 10 * 60 * 1000),
    },

    // ── Pricing & route data (set from estimate before creation) ────────
    estimatedPrice: { type: Number, default: null },
    currency: { type: String, default: "NPR" },
    priceBreakdown: {
      categoryBase: { type: Number, default: null },
      levelMultiplier: { type: Number, default: null },
      distanceCharge: { type: Number, default: null },
      total: { type: Number, default: null },
    },
    routeDistanceKm: { type: Number, default: null },
    routeDurationMinutes: { type: Number, default: null },
    routeGeometry: { type: [[Number]], default: null },
    depotLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      address: { type: String, default: null },
    },

    // ── Payment ─────────────────────────────────────────────────────────
    // Method chosen by the customer at booking time.
    paymentMethod: {
      type: String,
      enum: ["cash", "esewa"],
      default: "cash",
      index: true,
    },
    // High-level payment state — driven by the Payment record(s) for this pickup.
    //   UNPAID  — no payment attempted yet (initial)
    //   PENDING — eSewa initiated, awaiting verification, or cash awaiting collection
    //   PAID    — verified by gateway / collected by driver and confirmed
    //   FAILED  — gateway failure or driver-reported non-payment
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PENDING", "PAID", "FAILED"],
      default: "UNPAID",
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    // Response time metrics (computed on acceptance)
    responseTimeMs: { type: Number, default: null },
    // Total task duration (computed on completion)
    taskDurationMs: { type: Number, default: null },
  },
  { timestamps: true }
);

// Lookup index only. Do not use a TTL index here because pickup records must
// remain available for dashboards, payment callbacks, and history.
pickupRequestSchema.index({ expiresAt: 1 });

// Compound indexes for analytics queries
pickupRequestSchema.index({ status: 1, createdAt: -1 });
pickupRequestSchema.index({ driverId: 1, status: 1 });
pickupRequestSchema.index({ orgId: 1, status: 1, createdAt: -1 });
pickupRequestSchema.index({ customerId: 1, createdAt: -1 });

const PickupRequest = mongoose.model("PickupRequest", pickupRequestSchema);
export default PickupRequest;
