import mongoose from "mongoose";

const pickupDailySummarySchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    created: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    cancelled: { type: Number, default: 0 },
    expired: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    responseTimeTotalMs: { type: Number, default: 0 },
    responseTimeCount: { type: Number, default: 0 },
    taskDurationTotalMs: { type: Number, default: 0 },
    taskDurationCount: { type: Number, default: 0 },
    refreshedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

pickupDailySummarySchema.index(
  { date: 1, orgId: 1 },
  { unique: true, name: "date_1_orgId_1" }
);
pickupDailySummarySchema.index({ orgId: 1, date: 1 });
pickupDailySummarySchema.index({ date: 1 });

const PickupDailySummary = mongoose.model("PickupDailySummary", pickupDailySummarySchema);
export default PickupDailySummary;
