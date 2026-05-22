import mongoose from "mongoose";
import Payment from "../models/Payment.model.js";
import PickupRequest from "../models/PickupRequest.model.js";
import User from "../models/User.model.js";
import { computePickupPricingAndRoute, emitPickupToDrivers } from "../services/pickup.service.js";
import { invalidateDashboardCache } from "../services/dashboardCache.js";
import { refreshPickupDailySummaryForDate } from "../services/pickupAnalytics.js";
import {
  buildEsewaInitiationPayload,
  decodeAndVerifyCallback,
  verifyTransactionStatus,
} from "../services/esewaService.js";

/**
 * Payment controller — handles payment-method selection, eSewa initiation,
 * eSewa callback verification, cash collection, and read endpoints.
 *
 * Security rules enforced here
 * ────────────────────────────
 *  - The customer can only initiate payment for a pickup THEY own.
 *  - The amount is recomputed from the pickup's server-side location, org/depot,
 *    category, and level before charging; never from the request body.
 *  - eSewa callbacks are verified twice: signature check + status API.
 *  - Idempotency: a Payment moves from PENDING → COMPLETED via an atomic
 *    findOneAndUpdate guarded by `status: "PENDING"`. Duplicate callbacks
 *    are no-ops.
 *  - Cash payments can only be marked PAID by the assigned driver during
 *    collection or completion.
 *  - Admin/super_admin can read but not silently mutate payment status.
 */

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

function sameId(a, b) {
  return a != null && b != null && a.toString() === b.toString();
}

function adminCanAccessPickup(pickup, user) {
  if (user.role === "super_admin") return true;
  if (user.role !== "admin") return false;
  return sameId(pickup.orgId, user.orgId);
}

function paymentPayload(p) {
  if (!p) return null;
  return {
    id: p._id,
    pickupId: p.pickupId,
    customerId: p.customerId,
    driverId: p.driverId,
    amount: p.amount,
    currency: p.currency,
    method: p.method,
    status: p.status,
    esewaRefId: p.esewaRefId,
    initiatedAt: p.initiatedAt,
    paidAt: p.paidAt,
    failedAt: p.failedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function invalidatePaymentAnalytics(date = new Date()) {
  invalidateDashboardCache();
  refreshPickupDailySummaryForDate(date).catch((err) => {
    console.error("[PickupAnalytics] Failed to refresh daily summary:", err.message);
  });
}

// ── POST /api/payments/initiate ───────────────────────────────────────────
/**
 * Customer chooses how they want to pay for an existing pickup.
 *
 * Body: { pickupId, method: "cash" | "esewa" }
 *
 * Behaviour
 *  - cash:  records intent, marks pickup paymentMethod=cash, paymentStatus=PENDING
 *  - esewa: creates a Payment row, returns the SIGNED form fields the
 *           browser must POST to eSewa to start the hosted checkout.
 */
const DISPATCHABLE_PAYMENT_STATUSES = ["PAYMENT_REQUIRED", "PENDING"];

function pickupMatchesPayment(pickup, payment) {
  return (
    payment &&
    DISPATCHABLE_PAYMENT_STATUSES.includes(pickup.status) &&
    pickup.paymentMethod === payment.method &&
    pickup.paymentId?.toString() === payment._id.toString()
  );
}

function activePickupPaymentFilter(payment) {
  return {
    _id: payment.pickupId,
    paymentMethod: payment.method,
    paymentId: payment._id,
  };
}

async function updateActivePickupPaymentStatus(payment, paymentStatus) {
  const pickup = await PickupRequest.findOneAndUpdate(
    activePickupPaymentFilter(payment),
    { $set: { paymentStatus } },
    { new: true }
  );
  if (pickup) invalidatePaymentAnalytics(pickup.createdAt);
  return !!pickup;
}

async function cancelSupersededEsewaAttempts(pickupId, activePaymentId) {
  await Payment.updateMany(
    {
      pickupId,
      method: "esewa",
      status: "PENDING",
      _id: { $ne: activePaymentId },
    },
    {
      $set: {
        status: "CANCELLED",
        failedAt: new Date(),
        failureReason: "Superseded by a newer eSewa payment attempt",
      },
    }
  );
}

async function dispatchPickupAfterPaymentChoice(pickup, payment) {
  if (!pickupMatchesPayment(pickup, payment)) {
    return false;
  }

  const previousStatus = pickup.status;

  if (pickup.status === "PAYMENT_REQUIRED") {
    pickup.status = "PENDING";
    pickup.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    pickup.statusHistory.push({
      from: previousStatus,
      to: "PENDING",
      at: new Date(),
      by: { userId: null, role: "system", name: "PaymentFlow" },
      note: "Payment method confirmed; request dispatched to drivers.",
    });
    await pickup.save();
  }

  const customer = await User.findById(pickup.customerId).select("name").lean();
  emitPickupToDrivers(pickup, customer?.name || null);
  return true;
}

export const initiatePayment = async (req, res) => {
  try {
    const { pickupId, method } = req.body;
    const customer = req.user;

    if (!pickupId || !mongoose.isValidObjectId(pickupId)) {
      return res.status(400).json({ message: "Valid pickupId is required" });
    }
    if (!["cash", "esewa"].includes(method)) {
      return res.status(400).json({ message: "method must be 'cash' or 'esewa'" });
    }

    // 1. Authorisation: only the owning customer may initiate payment
    const pickup = await PickupRequest.findById(pickupId);
    if (!pickup) return res.status(404).json({ message: "Pickup not found" });
    if (pickup.customerId.toString() !== customer._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    // 2. Reject if already paid (idempotent guard)
    if (pickup.paymentStatus === "PAID") {
      return res.status(409).json({ message: "This pickup is already paid" });
    }

    // 3. Recompute price and route before charging. Legacy drafts may contain
    // client-supplied estimates, so the database value is refreshed here.
    const quote = await computePickupPricingAndRoute({
      latitude: pickup.location.latitude,
      longitude: pickup.location.longitude,
      category: pickup.category,
      level: pickup.level,
      area: pickup.area,
      orgId: pickup.orgId,
    });
    pickup.orgId = quote.orgId;
    pickup.estimatedPrice = quote.pricing.estimatedPrice;
    pickup.currency = quote.pricing.currency;
    pickup.priceBreakdown = quote.pricing.priceBreakdown;
    pickup.routeDistanceKm = quote.route.distanceKm;
    pickup.routeDurationMinutes = quote.route.durationMinutes;
    pickup.routeGeometry = quote.route.geometry;
    pickup.depotLocation = quote.depotLocation;

    const amount = Number(pickup.estimatedPrice);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        message: "Pickup has no valid price — cannot initiate payment",
      });
    }

    // ── Cash flow ────────────────────────────────────────────────────────
    if (!["PAYMENT_REQUIRED", "PENDING"].includes(pickup.status)) {
      return res.status(400).json({ message: `Cannot choose payment for a pickup with status: ${pickup.status}` });
    }

    if (method === "cash") {
      let payment = await Payment.findOne({ pickupId: pickup._id, method: "cash", status: "PENDING" });
      if (!payment) {
        payment = await Payment.create({
          pickupId: pickup._id,
          customerId: customer._id,
          amount,
          currency: pickup.currency || "NPR",
          method: "cash",
          status: "PENDING",
        });
      } else if (payment.amount !== amount || payment.currency !== (pickup.currency || "NPR")) {
        payment.amount = amount;
        payment.currency = pickup.currency || "NPR";
        await payment.save();
      }

      pickup.paymentMethod = "cash";
      pickup.paymentStatus = "PENDING";
      pickup.paymentId = payment._id;
      await pickup.save();
      invalidatePaymentAnalytics(pickup.createdAt);
      await dispatchPickupAfterPaymentChoice(pickup, payment);

      return res.status(200).json({
        success: true,
        method: "cash",
        payment: paymentPayload(payment),
        pickup: {
          id: pickup._id,
          status: pickup.status,
          paymentMethod: pickup.paymentMethod,
          paymentStatus: pickup.paymentStatus,
        },
      });
    }

    // ── eSewa flow ───────────────────────────────────────────────────────
    // Build the signed form payload (signature is computed server-side using
    // the env secret — the client never sees the secret).
    const { transactionUuid, actionUrl, formFields } = buildEsewaInitiationPayload({
      amount,
      pickupId: pickup._id.toString(),
    });

    const payment = await Payment.create({
      pickupId: pickup._id,
      customerId: customer._id,
      amount,
      currency: pickup.currency || "NPR",
      method: "esewa",
      status: "PENDING",
      transactionUuid,
    });

    pickup.paymentMethod = "esewa";
    pickup.paymentStatus = "PENDING";
    pickup.paymentId = payment._id;
    await pickup.save();
    invalidatePaymentAnalytics(pickup.createdAt);
    await cancelSupersededEsewaAttempts(pickup._id, payment._id);

    return res.status(200).json({
      success: true,
      method: "esewa",
      actionUrl,
      formFields,
      payment: paymentPayload(payment),
    });
  } catch (err) {
    console.error("initiatePayment error:", err);
    return res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "Failed to initiate payment",
      ...(!err.statusCode && process.env.NODE_ENV === "development" && { error: err.message }),
    });
  }
};

// ── GET /api/payments/esewa/success ───────────────────────────────────────
/**
 * eSewa redirects the customer's browser here after a successful payment.
 *
 * Steps
 *  1. Decode + verify the HMAC signature on the base64 payload
 *  2. Independently call eSewa's status API server-to-server
 *  3. Atomically transition the Payment from PENDING → COMPLETED
 *  4. Update the PickupRequest paymentStatus
 *  5. Redirect the browser back to the frontend
 *
 * This endpoint is intentionally unauthenticated (eSewa cannot send our JWT),
 * but it is safe because every state change is gated on a valid signature
 * AND a successful status API verification.
 */
export const esewaSuccess = async (req, res) => {
  try {
    const data = req.query.data || req.body?.data;

    // 1. Verify signature on the redirect payload
    let decoded;
    try {
      decoded = decodeAndVerifyCallback(data);
    } catch (err) {
      console.warn("[esewa] callback verification failed:", err.message);
      return res.redirect(`${FRONTEND_URL}/payment-failed?reason=invalid_signature`);
    }

    const { transaction_uuid: transactionUuid, total_amount: totalAmountStr } = decoded;

    // 2. Look up the payment we created at initiation
    const payment = await Payment.findOne({ transactionUuid });
    if (!payment) {
      return res.redirect(`${FRONTEND_URL}/payment-failed?reason=unknown_transaction`);
    }

    // Already settled? Just redirect — idempotent.
    if (payment.status === "COMPLETED") {
      return res.redirect(
        `${FRONTEND_URL}/payment-success?pickupId=${payment.pickupId}`
      );
    }

    const pickup = await PickupRequest.findById(payment.pickupId);
    if (!pickup) {
      return res.redirect(`${FRONTEND_URL}/payment-failed?reason=pickup_not_found`);
    }

    const quote = await computePickupPricingAndRoute({
      latitude: pickup.location.latitude,
      longitude: pickup.location.longitude,
      category: pickup.category,
      level: pickup.level,
      area: pickup.area,
      orgId: pickup.orgId,
    });
    const expectedAmount = Number(quote.pricing.estimatedPrice);
    pickup.orgId = quote.orgId;
    pickup.estimatedPrice = quote.pricing.estimatedPrice;
    pickup.currency = quote.pricing.currency;
    pickup.priceBreakdown = quote.pricing.priceBreakdown;
    pickup.routeDistanceKm = quote.route.distanceKm;
    pickup.routeDurationMinutes = quote.route.durationMinutes;
    pickup.routeGeometry = quote.route.geometry;
    pickup.depotLocation = quote.depotLocation;

    if (!Number.isFinite(expectedAmount) || payment.amount !== expectedAmount) {
      console.warn(
        `[esewa] stored amount mismatch for ${transactionUuid}: expected ${expectedAmount}, got ${payment.amount}`
      );
      await Payment.updateOne(
        { _id: payment._id, status: "PENDING" },
        {
          status: "FAILED",
          failedAt: new Date(),
          failureReason: "Stored payment amount did not match recomputed pickup price",
        }
      );
      await updateActivePickupPaymentStatus(payment, "FAILED");
      return res.redirect(`${FRONTEND_URL}/payment-failed?reason=amount_mismatch`);
    }

    // 3. Confirm the callback amount matches what we expect (defends against tampering)
    const callbackAmount = Number(String(totalAmountStr).replace(/,/g, ""));
    if (!Number.isFinite(callbackAmount) || callbackAmount !== payment.amount) {
      console.warn(
        `[esewa] amount mismatch for ${transactionUuid}: expected ${payment.amount}, got ${callbackAmount}`
      );
      return res.redirect(`${FRONTEND_URL}/payment-failed?reason=amount_mismatch`);
    }

    // 4. Independent server-to-server verification with eSewa
    let statusResp;
    try {
      statusResp = await verifyTransactionStatus({
        transactionUuid,
        totalAmount: payment.amount,
      });
    } catch (err) {
      console.error("[esewa] status API error:", err.message);
      return res.redirect(`${FRONTEND_URL}/payment-failed?reason=verification_failed`);
    }

    if (statusResp?.status !== "COMPLETE") {
      // Mark as failed but only if still PENDING
      await Payment.updateOne(
        { _id: payment._id, status: "PENDING" },
        {
          status: "FAILED",
          esewaStatus: statusResp?.status || "UNKNOWN",
          failedAt: new Date(),
          failureReason: `eSewa status: ${statusResp?.status}`,
        }
      );
      await updateActivePickupPaymentStatus(payment, "FAILED");
      return res.redirect(`${FRONTEND_URL}/payment-failed?reason=not_complete`);
    }

    // 5. Atomic transition PENDING → COMPLETED (idempotent)
    const updated = await Payment.findOneAndUpdate(
      { _id: payment._id, status: "PENDING" },
      {
        status: "COMPLETED",
        esewaStatus: "COMPLETE",
        esewaRefId: statusResp.ref_id || null,
        paidAt: new Date(),
      },
      { new: true }
    );

    if (updated) {
      const activePickup = await PickupRequest.findOneAndUpdate(
        activePickupPaymentFilter(updated),
        {
          $set: {
            paymentStatus: "PAID",
            orgId: pickup.orgId,
            estimatedPrice: pickup.estimatedPrice,
            currency: pickup.currency,
            priceBreakdown: pickup.priceBreakdown,
            routeDistanceKm: pickup.routeDistanceKm,
            routeDurationMinutes: pickup.routeDurationMinutes,
            routeGeometry: pickup.routeGeometry,
            depotLocation: pickup.depotLocation,
          },
        },
        { new: true }
      );
      if (activePickup) {
        invalidatePaymentAnalytics(activePickup.createdAt);
        await dispatchPickupAfterPaymentChoice(activePickup, updated);
      }
    }

    return res.redirect(
      `${FRONTEND_URL}/payment-success?pickupId=${payment.pickupId}`
    );
  } catch (err) {
    console.error("esewaSuccess error:", err.message);
    return res.redirect(`${FRONTEND_URL}/payment-failed?reason=server_error`);
  }
};

// ── GET /api/payments/esewa/failure ───────────────────────────────────────
export const esewaFailure = async (req, res) => {
  try {
    const data = req.query.data || req.body?.data;
    if (data) {
      try {
        const decoded = decodeAndVerifyCallback(data);
        const payment = await Payment.findOneAndUpdate(
          { transactionUuid: decoded.transaction_uuid, status: "PENDING" },
          {
            status: "FAILED",
            esewaStatus: decoded.status || "FAILED",
            failedAt: new Date(),
            failureReason: "User cancelled or eSewa reported failure",
          },
          { new: true }
        );
        if (payment) {
          await updateActivePickupPaymentStatus(payment, "FAILED");
          const pickup = await PickupRequest.findById(payment.pickupId).select("createdAt").lean();
          invalidatePaymentAnalytics(pickup?.createdAt);
        }
      } catch {
        // Signature failure — ignore silently, do not mutate state
      }
    }
    return res.redirect(`${FRONTEND_URL}/payment-failed?reason=cancelled`);
  } catch (err) {
    console.error("esewaFailure error:", err.message);
    return res.redirect(`${FRONTEND_URL}/payment-failed?reason=server_error`);
  }
};

// ── POST /api/payments/:pickupId/cash-collected ───────────────────────────
/**
 * Driver marks a CASH payment as collected.
 *
 *  - Only the assigned driver may call this
 *  - Pickup must be in COLLECTING or COMPLETED state
 *  - Method must be cash
 *  - Atomic transition PENDING → COMPLETED
 */
export const markCashCollected = async (req, res) => {
  try {
    const { pickupId } = req.params;
    const driver = req.user;

    if (!mongoose.isValidObjectId(pickupId)) {
      return res.status(400).json({ message: "Invalid pickupId" });
    }

    const pickup = await PickupRequest.findById(pickupId);
    if (!pickup) return res.status(404).json({ message: "Pickup not found" });

    if (!pickup.driverId || pickup.driverId.toString() !== driver._id.toString()) {
      return res.status(403).json({ message: "Only the assigned driver may settle this payment" });
    }
    if (pickup.paymentMethod !== "cash") {
      return res.status(400).json({ message: "Pickup is not a cash payment" });
    }
    if (!["COLLECTING", "COMPLETED"].includes(pickup.status)) {
      return res.status(400).json({ message: "Pickup must be in collection before collecting cash" });
    }
    if (pickup.paymentStatus === "PAID") {
      return res.status(200).json({ success: true, message: "Already settled" });
    }

    const payment = await Payment.findOneAndUpdate(
      { pickupId: pickup._id, method: "cash", status: "PENDING" },
      {
        status: "COMPLETED",
        paidAt: new Date(),
        driverId: driver._id,
        finalizedBy: { userId: driver._id, role: driver.role, name: driver.name },
      },
      { new: true }
    );

    if (!payment) {
      return res.status(409).json({ message: "No pending cash payment to settle" });
    }

    pickup.paymentStatus = "PAID";
    await pickup.save();
    invalidatePaymentAnalytics(pickup.createdAt);

    return res.status(200).json({ success: true, payment: paymentPayload(payment) });
  } catch (err) {
    console.error("markCashCollected error:", err.message);
    return res.status(500).json({ message: "Failed to mark cash collected" });
  }
};

// ── GET /api/payments/pickup/:pickupId ────────────────────────────────────
export const getPaymentByPickup = async (req, res) => {
  try {
    const { pickupId } = req.params;
    if (!mongoose.isValidObjectId(pickupId)) {
      return res.status(400).json({ message: "Invalid pickupId" });
    }

    const pickup = await PickupRequest.findById(pickupId).select(
      "customerId driverId orgId"
    );
    if (!pickup) return res.status(404).json({ message: "Pickup not found" });

    const { _id } = req.user;
    const isOwner = pickup.customerId.toString() === _id.toString();
    const isAssignedDriver =
      pickup.driverId && pickup.driverId.toString() === _id.toString();
    const isAdmin = adminCanAccessPickup(pickup, req.user);

    if (!isOwner && !isAssignedDriver && !isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }

    const payment = await Payment.findOne({ pickupId }).sort({ createdAt: -1 });
    return res.status(200).json({ payment: paymentPayload(payment) });
  } catch (err) {
    console.error("getPaymentByPickup error:", err.message);
    return res.status(500).json({ message: "Failed to fetch payment" });
  }
};

// ── GET /api/payments/all (admin) ─────────────────────────────────────────
export const getAllPayments = async (req, res) => {
  try {
    const { method, status, limit = 100 } = req.query;
    const { role, orgId } = req.user;
    const filter = {};
    if (method) filter.method = method;
    if (status) filter.status = status;
    const maxLimit = Math.min(Number(limit) || 100, 500);

    const scopedStages = [];
    if (role === "admin") {
      if (!orgId || !mongoose.isValidObjectId(orgId)) {
        return res.status(403).json({ message: "Organization ID required" });
      }

      const orgObjectId = new mongoose.Types.ObjectId(orgId);
      scopedStages.push(
        {
          $lookup: {
            from: "pickuprequests",
            localField: "pickupId",
            foreignField: "_id",
            as: "pickup",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "customerId",
            foreignField: "_id",
            as: "customer",
          },
        },
        {
          $match: {
            $or: [
              { "pickup.orgId": orgObjectId },
              { "customer.orgId": orgObjectId },
            ],
          },
        },
        { $project: { pickup: 0, customer: 0 } }
      );
    }

    const [payments, totals] = await Promise.all([
      Payment.aggregate([
        { $match: filter },
        ...scopedStages,
        { $sort: { createdAt: -1 } },
        { $limit: maxLimit },
      ]),
      Payment.aggregate([
        { $match: { status: "COMPLETED" } },
        ...scopedStages,
        {
          $group: {
            _id: "$method",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      payments: payments.map(paymentPayload),
      totals,
    });
  } catch (err) {
    console.error("getAllPayments error:", err.message);
    return res.status(500).json({ message: "Failed to fetch payments" });
  }
};
