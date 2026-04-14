import mongoose from "mongoose";

/**
 * Billing — monthly subscription bills for customers and admins.
 *
 * Each record represents one billing cycle (month) for one user.
 * Bills are auto-generated monthly and can be paid via cash or eSewa.
 */
const billingSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Organisation scope — org admin sees only their org's bills
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },

    // Which role this bill is for (customer vs admin)
    billedRole: {
      type: String,
      enum: ["customer_admin", "admin"],
      default: "customer_admin",
      index: true,
    },

    // Billing period
    billingMonth: { type: Number, required: true, min: 1, max: 12 },
    billingYear: { type: Number, required: true },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "NPR" },

    status: {
      type: String,
      enum: ["UNPAID", "PAID", "OVERDUE", "WAIVED"],
      default: "UNPAID",
      index: true,
    },

    // Payment details (filled when paid)
    paidAt: { type: Date, default: null },
    paymentMethod: {
      type: String,
      enum: ["cash", "esewa", null],
      default: null,
    },
    transactionRef: { type: String, default: null },

    // Due date for this bill
    dueDate: { type: Date, required: true },

    // Who marked it paid / waived (admin or system)
    resolvedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      role: { type: String, default: null },
      name: { type: String, default: null },
    },

    notes: { type: String, default: null },
  },
  { timestamps: true }
);

// Ensure one bill per customer per month
billingSchema.index({ customerId: 1, billingYear: 1, billingMonth: 1 }, { unique: true });
billingSchema.index({ status: 1, dueDate: 1 });
billingSchema.index({ billingYear: 1, billingMonth: 1 });

const Billing = mongoose.model("Billing", billingSchema);
export default Billing;
