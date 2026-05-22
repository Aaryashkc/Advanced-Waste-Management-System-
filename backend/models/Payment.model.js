import mongoose from "mongoose";

/**
 * Payment — immutable transaction record for a PickupRequest.
 *
 * Security notes:
 *  - `amount` is always a trusted server-side pickup price, recomputed before
 *    charging. Never trust the client to set the amount.
 *  - `transactionUuid` is unique per attempt and used as the idempotency key
 *    when verifying with the eSewa status API.
 *  - We never store eSewa secret keys, card data, or PII beyond the eSewa
 *    reference id (which is a public transaction handle).
 */
const paymentSchema = new mongoose.Schema(
  {
    pickupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PickupRequest",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "NPR" },

    method: {
      type: String,
      enum: ["cash", "esewa"],
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },

    // ── eSewa-specific fields ────────────────────────────────────────────
    // Unique idempotency key sent to eSewa (uuid)
    transactionUuid: {
      type: String,
      default: undefined,
    },
    // eSewa's own reference id returned after a successful payment
    esewaRefId: { type: String, default: null },
    // Last raw status string from eSewa (COMPLETE, PENDING, FULL_REFUND, ...)
    esewaStatus: { type: String, default: null },

    // Lifecycle timestamps
    initiatedAt: { type: Date, default: Date.now },
    paidAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },

    // Auditing — who performed the action that finalised this payment
    finalizedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      role: { type: String, default: null },
      name: { type: String, default: null },
    },

    failureReason: { type: String, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ pickupId: 1, status: 1 });
paymentSchema.index({ customerId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ method: 1, status: 1, createdAt: -1 });
paymentSchema.index({ driverId: 1, status: 1, createdAt: -1 });
paymentSchema.index(
  { transactionUuid: 1 },
  {
    unique: true,
    name: "transactionUuid_1",
    partialFilterExpression: { transactionUuid: { $type: "string" } },
  }
);

const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;
