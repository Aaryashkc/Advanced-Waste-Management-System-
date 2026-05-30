import mongoose from "mongoose";
import Billing from "../models/Billing.model.js";
import BillingConfig from "../models/BillingConfig.model.js";
import User from "../models/User.model.js";
import Area from "../models/Area.model.js";
import { backfillUnassignedUsersForOrg } from "../services/userOrgResolver.js";
import {
  buildEsewaBillingPayload,
  decodeAndVerifyCallback,
  verifyTransactionStatus,
} from "../services/esewaService.js";
import { buildPaginationMeta, getPagination } from "../utils/pagination.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// ── Defaults (used when no BillingConfig exists in DB) ───────────────────────
const DEFAULT_CUSTOMER_FEE = 500;
const DEFAULT_ADMIN_FEE = 1000;
const OVERVIEW_BACKFILL_TTL_MS = 60 * 1000;
const overviewBackfillCache = new Map();
const OPEN_BILL_STATUSES = ["UNPAID", "OVERDUE", "CASH_PENDING"];
const BILL_STATUSES = [...OPEN_BILL_STATUSES, "PAID", "WAIVED"];
const BILLABLE_ROLES = ["customer_admin", "admin"];

function periodLabel(month, year) {
  const d = new Date(year, month - 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function periodStart(date) {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return periodStart(new Date());
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function comparePeriods(a, b) {
  return a.getFullYear() - b.getFullYear() || a.getMonth() - b.getMonth();
}

function billingDueDate(month, year) {
  return new Date(year, month - 1, 1);
}

function getBillablePeriods(user, throughDate = new Date()) {
  const start = periodStart(user?.createdAt || throughDate);
  const end = periodStart(throughDate);
  const periods = [];

  for (let cursor = start; comparePeriods(cursor, end) <= 0; cursor = addMonths(cursor, 1)) {
    periods.push({
      billingMonth: cursor.getMonth() + 1,
      billingYear: cursor.getFullYear(),
      dueDate: billingDueDate(cursor.getMonth() + 1, cursor.getFullYear()),
    });
  }

  return periods;
}

function getFrontendBillingPath(bill) {
  return bill?.billedRole === "admin" ? "/admin-dashboard/billing" : "/billing";
}

function redirectBillingPayment(res, bill, query) {
  return res.redirect(`${FRONTEND_URL}${getFrontendBillingPath(bill)}?${query}`);
}

/**
 * Resolve the org for a user. Uses user.orgId if set, otherwise
 * tries to find an area matching the user's address.
 */
async function resolveUserOrgId(user) {
  if (user.orgId) return user.orgId;
  const addr = user.address || user.location?.address || "";
  if (!addr) return null;
  const areas = await Area.find({ isActive: true, orgId: { $ne: null } })
    .select("name orgId")
    .lean();
  for (const area of areas) {
    if (addr.toLowerCase().includes(area.name.toLowerCase())) {
      return area.orgId;
    }
  }
  return null;
}

/**
 * Get fees for a given orgId. Returns { customerFee, adminFee }.
 */
async function getFeesForOrg(orgId) {
  // Try org-specific config first
  if (orgId) {
    const orgConfig = await BillingConfig.findOne({ orgId }).lean();
    if (orgConfig) {
      return {
        customerFee: orgConfig.customerMonthlyFee ?? DEFAULT_CUSTOMER_FEE,
        adminFee: orgConfig.adminMonthlyFee ?? DEFAULT_ADMIN_FEE,
      };
    }
  }
  // Fall back to global default config
  const globalConfig = await BillingConfig.findOne({ orgId: null }).lean();
  if (globalConfig) {
    return {
      customerFee: globalConfig.customerMonthlyFee ?? DEFAULT_CUSTOMER_FEE,
      adminFee: globalConfig.adminMonthlyFee ?? DEFAULT_ADMIN_FEE,
    };
  }
  return { customerFee: DEFAULT_CUSTOMER_FEE, adminFee: DEFAULT_ADMIN_FEE };
}

async function markOrgAdminPeriodPaid(sourceBill) {
  if (
    sourceBill.billedRole !== "admin" ||
    !sourceBill.orgId ||
    sourceBill.status !== "PAID"
  ) {
    return;
  }

  await Billing.updateMany(
    {
      orgId: sourceBill.orgId,
      billedRole: "admin",
      billingMonth: sourceBill.billingMonth,
      billingYear: sourceBill.billingYear,
      status: { $in: OPEN_BILL_STATUSES },
    },
    {
      $set: {
        status: "PAID",
        paidAt: sourceBill.paidAt || new Date(),
        paymentMethod: sourceBill.paymentMethod,
        resolvedBy: sourceBill.resolvedBy,
        notes: sourceBill.notes || "Paid by another admin in this organization",
      },
    }
  );
}

async function ensureBillsForUser(user, { throughDate = new Date(), scopedOrgId = null, paidAdminBillByOrg = null } = {}) {
  const userOrgId = await resolveUserOrgId(user);
  if (scopedOrgId && String(userOrgId || "") !== String(scopedOrgId)) {
    return { created: 0, skipped: 0, updated: 0, outOfScope: 1 };
  }

  const adminPaymentCache = paidAdminBillByOrg || new Map();
  const fees = await getFeesForOrg(userOrgId);
  const isAdmin = user.role === "admin";
  const fee = isAdmin ? fees.adminFee : fees.customerFee;
  const periods = getBillablePeriods(user, throughDate);
  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const period of periods) {
    let paidAdminBill = null;

    if (isAdmin && userOrgId) {
      const orgKey = `${userOrgId}:${period.billingYear}-${period.billingMonth}`;
      if (!adminPaymentCache.has(orgKey)) {
        const paidBill = await Billing.findOne({
          orgId: userOrgId,
          billedRole: "admin",
          billingMonth: period.billingMonth,
          billingYear: period.billingYear,
          status: "PAID",
        }).lean();
        adminPaymentCache.set(orgKey, paidBill || null);
      }
      paidAdminBill = adminPaymentCache.get(orgKey) || null;
    }

    const existing = await Billing.findOne({
      customerId: user._id,
      billingMonth: period.billingMonth,
      billingYear: period.billingYear,
    });

    if (existing) {
      const needsOrgUpdate = String(existing.orgId || "") !== String(userOrgId || "");
      const canUpdateOpenBill = OPEN_BILL_STATUSES.includes(existing.status);
      const canRewriteOpenBill = existing.status === "UNPAID" || existing.status === "OVERDUE";
      const needsAmountUpdate = canRewriteOpenBill && existing.amount !== fee;
      const needsRoleUpdate = existing.billedRole !== user.role;
      const existingDue = existing.dueDate ? new Date(existing.dueDate) : null;
      const needsDueDateUpdate =
        canRewriteOpenBill &&
        (!existingDue ||
          existingDue.getFullYear() !== period.dueDate.getFullYear() ||
          existingDue.getMonth() !== period.dueDate.getMonth() ||
          existingDue.getDate() !== period.dueDate.getDate());
      const needsSharedAdminPayment = canUpdateOpenBill && Boolean(paidAdminBill);

      if (needsOrgUpdate || needsAmountUpdate || needsRoleUpdate || needsDueDateUpdate || needsSharedAdminPayment) {
        const updateFields = {};
        if (needsOrgUpdate) updateFields.orgId = userOrgId;
        if (needsAmountUpdate) updateFields.amount = fee;
        if (needsRoleUpdate) updateFields.billedRole = user.role;
        if (needsDueDateUpdate) updateFields.dueDate = period.dueDate;
        if (needsSharedAdminPayment) {
          updateFields.status = "PAID";
          updateFields.paidAt = paidAdminBill.paidAt || new Date();
          updateFields.paymentMethod = paidAdminBill.paymentMethod;
          updateFields.resolvedBy = paidAdminBill.resolvedBy;
          updateFields.notes = paidAdminBill.notes || "Paid by another admin in this organization";
        }
        await Billing.updateOne({ _id: existing._id }, { $set: updateFields });
        updated++;
      }

      skipped++;
      continue;
    }

    await Billing.create({
      customerId: user._id,
      orgId: userOrgId,
      billedRole: user.role,
      billingMonth: period.billingMonth,
      billingYear: period.billingYear,
      amount: fee,
      dueDate: period.dueDate,
      status: paidAdminBill ? "PAID" : "UNPAID",
      paidAt: paidAdminBill?.paidAt || null,
      paymentMethod: paidAdminBill?.paymentMethod || null,
      resolvedBy: paidAdminBill?.resolvedBy || undefined,
      notes: paidAdminBill ? paidAdminBill.notes || "Paid by another admin in this organization" : null,
    });
    created++;
  }

  return { created, skipped, updated, outOfScope: 0 };
}

async function ensureOverviewBillsFresh(orgId = null) {
  const scopeKey = orgId ? String(orgId) : "global";
  const lastBackfillAt = overviewBackfillCache.get(scopeKey) || 0;
  const now = Date.now();

  if (now - lastBackfillAt < OVERVIEW_BACKFILL_TTL_MS) return;

  await runBillGeneration({ orgId });
  overviewBackfillCache.set(scopeKey, now);
}

async function buildAdminBillingFilter(req, { forceStatus, includeStatus = true } = {}) {
  const { status, month, year, billedRole } = req.query;
  const isSuperAdmin = req.user.role === "super_admin";
  const filter = {};

  if (isSuperAdmin) {
    if (req.query.orgId) filter.orgId = new mongoose.Types.ObjectId(req.query.orgId);
  } else {
    if (!req.user.orgId) {
      const error = new Error("No organization assigned to your account");
      error.statusCode = 403;
      throw error;
    }

    const orgUserIds = await User.find({ orgId: req.user.orgId, role: "customer_admin" })
      .select("_id")
      .lean();

    filter.customerId = { $in: orgUserIds.map((u) => u._id) };
  }

  const requestedStatus = forceStatus || (includeStatus ? status : null);
  if (requestedStatus && BILL_STATUSES.includes(requestedStatus)) filter.status = requestedStatus;
  if (month && Number.isInteger(Number(month))) filter.billingMonth = parseInt(month, 10);
  if (year && Number.isInteger(Number(year))) filter.billingYear = parseInt(year, 10);
  if (isSuperAdmin) {
    if (billedRole && BILLABLE_ROLES.includes(billedRole)) filter.billedRole = billedRole;
  } else {
    filter.billedRole = "customer_admin";
  }

  return filter;
}

async function markOverdueBills(filter = {}) {
  const overdueFilter = { ...filter };
  delete overdueFilter.status;
  overdueFilter.status = "UNPAID";
  overdueFilter.dueDate = { $lt: new Date() };
  await Billing.updateMany(overdueFilter, { $set: { status: "OVERDUE" } });
}

// ──────────────────────────────────────────────────────────────────────────────
// CUSTOMER ENDPOINTS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/billing/my-bills
 * Ensures the user's calendar-month bills exist, then reads persisted bills.
 * This keeps unpaid months accumulated even if a monthly cron run was missed.
 */
export const getMyBills = async (req, res) => {
  try {
    const now = new Date();
    const pagination = getPagination(req.query, { defaultLimit: 10 });
    await ensureBillsForUser(req.user, { throughDate: now });
    await Billing.updateMany(
      { customerId: req.user._id, status: "UNPAID", dueDate: { $lt: now } },
      { $set: { status: "OVERDUE" } }
    );

    const bills = await Billing.find({ customerId: req.user._id })
      .select("billingMonth billingYear amount currency status paidAt paymentMethod dueDate notes createdAt updatedAt")
      .sort({ billingYear: -1, billingMonth: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();
    const [total, summaryAgg] = await Promise.all([
      Billing.countDocuments({ customerId: req.user._id }),
      Billing.aggregate([
        { $match: { customerId: new mongoose.Types.ObjectId(req.user._id) } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            paid: { $sum: { $cond: [{ $eq: ["$status", "PAID"] }, 1, 0] } },
            unpaid: { $sum: { $cond: [{ $in: ["$status", OPEN_BILL_STATUSES] }, 1, 0] } },
            totalPaid: { $sum: { $cond: [{ $eq: ["$status", "PAID"] }, "$amount", 0] } },
            totalDue: { $sum: { $cond: [{ $in: ["$status", OPEN_BILL_STATUSES] }, "$amount", 0] } },
          },
        },
      ]),
    ]);

    // Mark overdue locally for display
    const updatedBills = bills.map((b) => {
      if (b.status === "UNPAID" && new Date(b.dueDate) < now) {
        return { ...b, status: "OVERDUE" };
      }
      return b;
    });

    const summary = summaryAgg[0] || { total: 0, paid: 0, unpaid: 0, totalPaid: 0, totalDue: 0 };
    delete summary._id;

    res.json({
      bills: updatedBills,
      summary,
      pagination: buildPaginationMeta({ ...pagination, total }),
    });
  } catch (err) {
    console.error("getMyBills error:", err);
    res.status(500).json({ message: "Failed to fetch bills" });
  }
};

/**
 * POST /api/billing/pay/:billingId
 *
 * For cash:  requests cash confirmation from an admin/super admin.
 * For esewa: returns signed form fields for eSewa hosted checkout redirect.
 *            The bill stays UNPAID until the eSewa callback confirms payment.
 */
export const payBill = async (req, res) => {
  try {
    const { billingId } = req.params;
    const { method } = req.body;

    if (!method || !["cash", "esewa"].includes(method)) {
      return res.status(400).json({ message: "Payment method must be 'cash' or 'esewa'" });
    }

    const bill = await Billing.findOne({
      _id: billingId,
      customerId: req.user._id,
    });

    if (!bill) return res.status(404).json({ message: "Bill not found" });
    if (bill.status === "PAID") return res.status(400).json({ message: "Bill is already paid" });
    if (bill.status === "WAIVED") return res.status(400).json({ message: "Bill has been waived" });
    if (bill.status === "CASH_PENDING") return res.status(400).json({ message: "Cash payment is awaiting confirmation" });

    // ── Cash flow ────────────────────────────────────────────────────────
    if (method === "cash") {
      bill.status = "CASH_PENDING";
      bill.paidAt = null;
      bill.paymentMethod = "cash";
      bill.resolvedBy = {
        userId: req.user._id,
        role: req.user.role,
        name: req.user.name,
      };
      bill.notes = "Cash payment submitted. Awaiting admin confirmation.";
      await bill.save();

      return res.json({ success: true, method: "cash", pendingConfirmation: true, bill });
    }

    // ── eSewa flow ───────────────────────────────────────────────────────
    const { transactionUuid, actionUrl, formFields } = buildEsewaBillingPayload({
      amount: bill.amount,
      billingId: bill._id.toString(),
    });

    // Store the transaction UUID so the callback can find this bill
    bill.transactionRef = transactionUuid;
    bill.paymentMethod = "esewa";
    await bill.save();

    return res.json({
      success: true,
      method: "esewa",
      actionUrl,
      formFields,
      bill,
    });
  } catch (err) {
    console.error("payBill error:", err);
    res.status(500).json({
      message: "Failed to process payment",
      ...(process.env.NODE_ENV === "development" && { error: err.message }),
    });
  }
};

/**
 * GET /api/billing/esewa/success
 *
 * eSewa redirects here after successful billing payment.
 * Same verification flow as pickup payments: signature + status API.
 */
export const esewaBillingSuccess = async (req, res) => {
  try {
    const data = req.query.data || req.body?.data;
    let bill = null;

    let decoded;
    try {
      decoded = decodeAndVerifyCallback(data);
    } catch (err) {
      console.warn("[esewa-billing] callback verification failed:", err.message);
      return res.redirect(`${FRONTEND_URL}/billing?payment=failed&reason=invalid_signature`);
    }

    const { transaction_uuid: transactionUuid, total_amount: totalAmountStr } = decoded;

    bill = await Billing.findOne({ transactionRef: transactionUuid });
    if (!bill) {
      return res.redirect(`${FRONTEND_URL}/billing?payment=failed&reason=unknown_transaction`);
    }

    // Already paid? Just redirect.
    if (bill.status === "PAID") {
      return redirectBillingPayment(res, bill, `payment=success&billingId=${bill._id}`);
    }

    // Verify amount matches
    const callbackAmount = Number(String(totalAmountStr).replace(/,/g, ""));
    if (!Number.isFinite(callbackAmount) || callbackAmount !== bill.amount) {
      console.warn(
        `[esewa-billing] amount mismatch for ${transactionUuid}: expected ${bill.amount}, got ${callbackAmount}`
      );
      return redirectBillingPayment(res, bill, "payment=failed&reason=amount_mismatch");
    }

    // Server-to-server verification
    let statusResp;
    try {
      statusResp = await verifyTransactionStatus({
        transactionUuid,
        totalAmount: bill.amount,
      });
    } catch (err) {
      console.error("[esewa-billing] status API error:", err.message);
      return redirectBillingPayment(res, bill, "payment=failed&reason=verification_failed");
    }

    if (statusResp?.status !== "COMPLETE") {
      return redirectBillingPayment(res, bill, "payment=failed&reason=not_complete");
    }

    // Mark bill as PAID
    bill.status = "PAID";
    bill.paidAt = new Date();
    bill.paymentMethod = "esewa";
    bill.resolvedBy = {
      userId: bill.customerId,
      role: bill.billedRole || "customer_admin",
      name: "eSewa Payment",
    };
    await bill.save();
    await markOrgAdminPeriodPaid(bill);

    return redirectBillingPayment(res, bill, `payment=success&billingId=${bill._id}`);
  } catch (err) {
    console.error("esewaBillingSuccess error:", err.message);
    return res.redirect(`${FRONTEND_URL}/billing?payment=failed&reason=server_error`);
  }
};

/**
 * GET /api/billing/esewa/failure
 */
export const esewaBillingFailure = async (req, res) => {
  try {
    const data = req.query.data || req.body?.data;
    let bill = null;
    if (data) {
      try {
        const decoded = decodeAndVerifyCallback(data);
        bill = await Billing.findOne({ transactionRef: decoded.transaction_uuid });
        // Clear the transactionRef so the customer can retry
        await Billing.updateOne(
          { transactionRef: decoded.transaction_uuid },
          { $set: { transactionRef: null, paymentMethod: null } }
        );
      } catch {
        // Signature failure — ignore silently
      }
    }
    return redirectBillingPayment(res, bill, "payment=failed&reason=cancelled");
  } catch (err) {
    console.error("esewaBillingFailure error:", err.message);
    return res.redirect(`${FRONTEND_URL}/billing?payment=failed&reason=server_error`);
  }
};

/**
 * GET /api/billing/history
 */
export const getPaymentHistory = async (req, res) => {
  try {
    const pagination = getPagination(req.query, { defaultLimit: 10 });
    const history = await Billing.find({
      customerId: req.user._id,
      status: { $in: ["PAID", "WAIVED"] },
    })
      .select("billingMonth billingYear amount currency status paidAt paymentMethod notes createdAt updatedAt")
      .sort({ paidAt: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();
    const total = await Billing.countDocuments({
      customerId: req.user._id,
      status: { $in: ["PAID", "WAIVED"] },
    });

    res.json({ history, pagination: buildPaginationMeta({ ...pagination, total }) });
  } catch (err) {
    console.error("getPaymentHistory error:", err);
    res.status(500).json({ message: "Failed to fetch payment history" });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN / SUPER ADMIN ENDPOINTS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/billing/admin/overview
 * - Org admin: sees only bills in their org
 * - Super admin: sees all bills
 * - Supports ?billedRole=customer_admin or ?billedRole=admin to filter
 */
export const getBillingOverview = async (req, res) => {
  try {
    const pagination = getPagination(req.query, { defaultLimit: 10 });
    const { page, limit } = pagination;
    if (req.user.role === "admin") {
      await backfillUnassignedUsersForOrg(req.user.orgId);
      await ensureOverviewBillsFresh(req.user.orgId);
    } else {
      await ensureOverviewBillsFresh(req.query.orgId || null);
    }
    const filter = await buildAdminBillingFilter(req);

    await markOverdueBills(filter);

    // Summary via aggregation
    const summaryAgg = await Billing.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          paid: { $sum: { $cond: [{ $eq: ["$status", "PAID"] }, 1, 0] } },
          unpaid: { $sum: { $cond: [{ $eq: ["$status", "UNPAID"] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $eq: ["$status", "OVERDUE"] }, 1, 0] } },
          cashPending: { $sum: { $cond: [{ $eq: ["$status", "CASH_PENDING"] }, 1, 0] } },
          waived: { $sum: { $cond: [{ $eq: ["$status", "WAIVED"] }, 1, 0] } },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ["$status", "PAID"] }, "$amount", 0] },
          },
          totalOutstanding: {
            $sum: {
              $cond: [{ $in: ["$status", OPEN_BILL_STATUSES] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    const summary = summaryAgg[0] || {
      totalBills: 0, paid: 0, unpaid: 0, overdue: 0, cashPending: 0, waived: 0,
      totalRevenue: 0, totalOutstanding: 0,
    };

    const [monthlyRevenue, roleRevenue, paymentMethodRevenueRows] = await Promise.all([
      Billing.aggregate([
        { $match: { ...filter, status: "PAID" } },
        {
          $group: {
            _id: {
              year: "$billingYear",
              month: "$billingMonth",
            },
            revenue: { $sum: "$amount" },
            paidBills: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } },
        { $limit: 12 },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        {
          $project: {
            _id: 0,
            month: {
              $concat: [
                { $toString: "$_id.year" },
                "-",
                {
                  $cond: [
                    { $lt: ["$_id.month", 10] },
                    { $concat: ["0", { $toString: "$_id.month" }] },
                    { $toString: "$_id.month" },
                  ],
                },
              ],
            },
            revenue: { $round: ["$revenue", 0] },
            paidBills: 1,
          },
        },
      ]),
      Billing.aggregate([
        { $match: { ...filter, status: "PAID" } },
        {
          $group: {
            _id: "$billedRole",
            revenue: { $sum: "$amount" },
            paidBills: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
        {
          $project: {
            _id: 0,
            role: "$_id",
            revenue: { $round: ["$revenue", 0] },
            paidBills: 1,
          },
        },
      ]),
      Billing.aggregate([
        { $match: { ...filter, status: "PAID" } },
        {
          $group: {
            _id: "$paymentMethod",
            revenue: { $sum: "$amount" },
            paidBills: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            method: "$_id",
            revenue: { $round: ["$revenue", 0] },
            paidBills: 1,
          },
        },
      ]),
    ]);
    const paymentMethodRevenue = paymentMethodRevenueRows.reduce(
      (acc, row) => {
        const method = row.method === "esewa" ? "online" : "cash";
        acc[method] += row.revenue || 0;
        return acc;
      },
      { cash: 0, online: 0 }
    );
    paymentMethodRevenue.total = paymentMethodRevenue.cash + paymentMethodRevenue.online;

    // Defaulters — remove any status filter and force open billing statuses.
    const accountResult = await Billing.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$customerId",
          orgId: { $first: "$orgId" },
          billedRole: { $first: "$billedRole" },
          totalBills: { $sum: 1 },
          paidCount: { $sum: { $cond: [{ $eq: ["$status", "PAID"] }, 1, 0] } },
          unpaidCount: { $sum: { $cond: [{ $eq: ["$status", "UNPAID"] }, 1, 0] } },
          overdueCount: { $sum: { $cond: [{ $eq: ["$status", "OVERDUE"] }, 1, 0] } },
          cashPendingCount: { $sum: { $cond: [{ $eq: ["$status", "CASH_PENDING"] }, 1, 0] } },
          waivedCount: { $sum: { $cond: [{ $eq: ["$status", "WAIVED"] }, 1, 0] } },
          totalOutstanding: { $sum: { $cond: [{ $in: ["$status", OPEN_BILL_STATUSES] }, "$amount", 0] } },
          totalPaid: { $sum: { $cond: [{ $eq: ["$status", "PAID"] }, "$amount", 0] } },
          oldestOpenDueDate: { $min: { $cond: [{ $in: ["$status", OPEN_BILL_STATUSES] }, "$dueDate", new Date("9999-12-31")] } },
          latestBillAt: { $max: "$updatedAt" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "customer",
          pipeline: [{ $project: { name: 1, email: 1, phone: 1, address: 1, role: 1 } }],
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "organizations",
          localField: "orgId",
          foreignField: "_id",
          as: "org",
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: { path: "$org", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          openBillCount: { $add: ["$unpaidCount", "$overdueCount", "$cashPendingCount"] },
          sortDueDate: {
            $cond: [
              { $gt: [{ $add: ["$unpaidCount", "$overdueCount", "$cashPendingCount"] }, 0] },
              "$oldestOpenDueDate",
              "$latestBillAt",
            ],
          },
        },
      },
      { $sort: { totalOutstanding: -1, overdueCount: -1, sortDueDate: 1, latestBillAt: -1 } },
      {
        $facet: {
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          meta: [{ $count: "total" }],
        },
      },
    ]);

    const accounts = accountResult[0]?.data || [];
    const total = accountResult[0]?.meta?.[0]?.total || 0;

    res.json({
      accounts,
      bills: [],
      summary: {
        ...summary,
        monthlyRevenue,
        roleRevenue,
        paymentMethodRevenue,
      },
      defaulters: [],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getBillingOverview error:", err);
    res.status(500).json({ message: "Failed to fetch billing overview" });
  }
};

/**
 * GET /api/billing/admin/accounts/:customerId
 * Lazy-load one account's month-by-month billing rows only when details open.
 */
export const getBillingAccountDetails = async (req, res) => {
  try {
    const { customerId } = req.params;
    const pagination = getPagination(req.query, { defaultLimit: 10 });
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ message: "Invalid account id" });
    }

    const filter = await buildAdminBillingFilter(req, { includeStatus: false });
    const customerObjectId = new mongoose.Types.ObjectId(customerId);
    if (req.user.role === "admin") {
      const scopedCustomerIds = filter.customerId?.$in || [];
      const isScopedCustomer = scopedCustomerIds.some((id) => String(id) === String(customerObjectId));
      if (!isScopedCustomer) {
        return res.status(403).json({ message: "You can only view billing details for users in your organization" });
      }
    }
    filter.customerId = customerObjectId;

    await markOverdueBills(filter);

    const bills = await Billing.find(filter)
      .populate("customerId", "name email phone address role")
      .populate("orgId", "name")
      .select("customerId orgId billedRole billingMonth billingYear amount currency status paidAt paymentMethod dueDate resolvedBy notes createdAt updatedAt")
      .sort({ billingYear: -1, billingMonth: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();
    const total = await Billing.countDocuments(filter);

    const summary = bills.reduce((acc, bill) => {
      acc.totalBills += 1;
      acc.totalAmount += bill.amount || 0;
      if (bill.status === "PAID") {
        acc.paid += 1;
        acc.totalPaid += bill.amount || 0;
      }
      if (OPEN_BILL_STATUSES.includes(bill.status)) {
        acc.open += 1;
        acc.totalOutstanding += bill.amount || 0;
      }
      if (bill.status === "OVERDUE") acc.overdue += 1;
      if (bill.status === "CASH_PENDING") acc.cashPending += 1;
      return acc;
    }, {
      totalBills: 0,
      totalAmount: 0,
      paid: 0,
      open: 0,
      overdue: 0,
      cashPending: 0,
      totalPaid: 0,
      totalOutstanding: 0,
    });

    res.json({
      account: bills[0]?.customerId || null,
      bills,
      summary,
      pagination: buildPaginationMeta({ ...pagination, total }),
    });
  } catch (err) {
    console.error("getBillingAccountDetails error:", err);
    res.status(err.statusCode || 500).json({ message: err.message || "Failed to fetch billing account details" });
  }
};

/**
 * PUT /api/billing/admin/:billingId/waive
 */
export const waiveBill = async (req, res) => {
  try {
    const { billingId } = req.params;
    const { notes } = req.body;
    const isSuperAdmin = req.user.role === "super_admin";

    const bill = await Billing.findById(billingId);
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    if (!isSuperAdmin) {
      if (!req.user.orgId) {
        return res.status(403).json({ message: "No organization assigned to your account" });
      }
      if (bill.billedRole === "admin") {
        return res.status(403).json({ message: "Only super admins can manage admin bills" });
      }
      const billedUser = await User.findById(bill.customerId).select("orgId role").lean();
      const userBelongsToOrg =
        billedUser?.role === "customer_admin" &&
        String(billedUser.orgId || "") === String(req.user.orgId);
      if (!userBelongsToOrg) {
        return res.status(403).json({ message: "You can only manage bills in your organization" });
      }
    }

    if (bill.status === "PAID") return res.status(400).json({ message: "Cannot waive a paid bill" });

    bill.status = "WAIVED";
    bill.notes = notes || "Waived by admin";
    bill.resolvedBy = {
      userId: req.user._id,
      role: req.user.role,
      name: req.user.name,
    };
    await bill.save();

    res.json({ message: "Bill waived", bill });
  } catch (err) {
    console.error("waiveBill error:", err);
    res.status(500).json({ message: "Failed to waive bill" });
  }
};

/**
 * PUT /api/billing/admin/:billingId/confirm-cash
 */
export const confirmCashPayment = async (req, res) => {
  try {
    const { billingId } = req.params;
    const isSuperAdmin = req.user.role === "super_admin";

    const bill = await Billing.findById(billingId);
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    if (!isSuperAdmin) {
      if (!req.user.orgId) {
        return res.status(403).json({ message: "No organization assigned to your account" });
      }
      if (bill.billedRole === "admin") {
        return res.status(403).json({ message: "Only super admins can confirm admin bill payments" });
      }

      const billedUser = await User.findById(bill.customerId).select("orgId role").lean();
      const userBelongsToOrg =
        billedUser?.role === "customer_admin" &&
        String(billedUser.orgId || "") === String(req.user.orgId);
      if (!userBelongsToOrg) {
        return res.status(403).json({ message: "You can only confirm cash payments in your organization" });
      }
    }

    if (bill.status !== "CASH_PENDING") {
      return res.status(400).json({ message: "This bill is not awaiting cash confirmation" });
    }

    bill.status = "PAID";
    bill.paidAt = new Date();
    bill.paymentMethod = "cash";
    bill.resolvedBy = {
      userId: req.user._id,
      role: req.user.role,
      name: req.user.name,
    };
    bill.notes = "Cash payment confirmed by admin.";
    await bill.save();
    await markOrgAdminPeriodPaid(bill);

    res.json({ message: "Cash payment confirmed", bill });
  } catch (err) {
    console.error("confirmCashPayment error:", err);
    res.status(500).json({ message: "Failed to confirm cash payment" });
  }
};

/**
 * POST /api/billing/admin/generate
 */
export const generateMonthlyBills = async (req, res) => {
  try {
    if (req.user.role === "admin" && !req.user.orgId) {
      return res.status(403).json({ message: "No organization assigned to your account" });
    }

    const result = await runBillGeneration({
      orgId: req.user.role === "admin" ? req.user.orgId : null,
    });
    res.json(result);
  } catch (err) {
    console.error("generateMonthlyBills error:", err);
    res.status(500).json({ message: "Failed to generate bills" });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// BILLING CONFIG ENDPOINTS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/billing/config
 * Returns all fee configs with the actual active fees.
 */
export const getBillingConfig = async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === "super_admin";
    const pagination = getPagination(req.query, { defaultLimit: 10 });

    let configs;
    let total;
    if (isSuperAdmin) {
      configs = await BillingConfig.find()
        .select("orgId customerMonthlyFee adminMonthlyFee updatedBy createdAt updatedAt")
        .populate("orgId", "name")
        .populate("updatedBy", "name")
        .sort({ orgId: 1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean();
      total = await BillingConfig.countDocuments();
    } else {
      configs = await BillingConfig.find({
        orgId: { $in: [req.user.orgId, null] },
      })
        .select("orgId customerMonthlyFee adminMonthlyFee updatedBy createdAt updatedAt")
        .populate("orgId", "name")
        .populate("updatedBy", "name")
        .sort({ orgId: 1 })
        .limit(2)
        .lean();
      total = configs.length;
    }

    // Calculate the effective fees from the canonical config, not just the current page.
    const globalConfig = await BillingConfig.findOne({ orgId: null })
      .select("customerMonthlyFee adminMonthlyFee")
      .lean();
    const activeFees = {
      customerFee: globalConfig?.customerMonthlyFee ?? DEFAULT_CUSTOMER_FEE,
      adminFee: globalConfig?.adminMonthlyFee ?? DEFAULT_ADMIN_FEE,
    };

    // If org admin, check for org-specific override
    if (!isSuperAdmin && req.user.orgId) {
      const orgConfig = configs.find((c) => c.orgId && String(c.orgId._id || c.orgId) === String(req.user.orgId));
      if (orgConfig) {
        activeFees.customerFee = orgConfig.customerMonthlyFee;
        activeFees.adminFee = orgConfig.adminMonthlyFee;
      }
    }

    res.json({
      configs,
      activeFees,
      defaults: { customerFee: DEFAULT_CUSTOMER_FEE, adminFee: DEFAULT_ADMIN_FEE },
      pagination: buildPaginationMeta({ ...pagination, total }),
    });
  } catch (err) {
    console.error("getBillingConfig error:", err);
    res.status(500).json({ message: "Failed to fetch billing config" });
  }
};

/**
 * PUT /api/billing/config
 * Body: { orgId?, customerMonthlyFee?, adminMonthlyFee? }
 */
export const updateBillingConfig = async (req, res) => {
  try {
    const { orgId, customerMonthlyFee, adminMonthlyFee } = req.body;
    const isSuperAdmin = req.user.role === "super_admin";

    if (customerMonthlyFee != null && customerMonthlyFee < 0) {
      return res.status(400).json({ message: "Customer fee must be non-negative" });
    }
    if (adminMonthlyFee != null && adminMonthlyFee < 0) {
      return res.status(400).json({ message: "Admin fee must be non-negative" });
    }
    if (customerMonthlyFee == null && adminMonthlyFee == null) {
      return res.status(400).json({ message: "Provide at least one fee to update" });
    }

    const targetOrgId = orgId || null;

    if (!isSuperAdmin) {
      if (targetOrgId === null) {
        return res.status(403).json({ message: "Only super admin can change the global default fees" });
      }
      if (String(targetOrgId) !== String(req.user.orgId)) {
        return res.status(403).json({ message: "You can only configure billing for your own organization" });
      }
    }

    const updateFields = { updatedBy: req.user._id };
    if (customerMonthlyFee != null) updateFields.customerMonthlyFee = customerMonthlyFee;
    if (adminMonthlyFee != null) updateFields.adminMonthlyFee = adminMonthlyFee;

    const config = await BillingConfig.findOneAndUpdate(
      { orgId: targetOrgId },
      { $set: updateFields },
      { upsert: true, new: true }
    );

    res.json({ message: "Billing config updated", config });
  } catch (err) {
    console.error("updateBillingConfig error:", err);
    res.status(500).json({ message: "Failed to update billing config" });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// BILL GENERATION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate bills for BOTH customer_admin and admin users.
 * - Only bills active users
 * - Updates orgId on existing bills if user's org changed
 * - Updates amount on UNPAID bills if fee config changed
 */
export const runBillGeneration = async ({ orgId = null } = {}) => {
  const now = new Date();
  const billingMonth = now.getMonth() + 1;
  const billingYear = now.getFullYear();

  // Fetch all active billable users: customers + admins
  // Use $ne: false instead of true to include users where isActive is undefined/missing
  const userFilter = {
    role: { $in: ["customer_admin", "admin"] },
    isActive: { $ne: false },
  };

  const billableUsers = await User.find(userFilter)
    .select("_id name email role orgId address location createdAt")
    .lean();

  console.log(`[Billing] Found ${billableUsers.length} billable users (customer_admin + admin) through ${billingMonth}/${billingYear}${orgId ? ` in org ${orgId}` : ""}`);

  let created = 0;
  let skipped = 0;
  let updated = 0;
  let outOfScope = 0;
  const paidAdminBillByOrg = new Map();

  for (const user of billableUsers) {
    const result = await ensureBillsForUser(user, {
      throughDate: now,
      scopedOrgId: orgId,
      paidAdminBillByOrg,
    });
    created += result.created;
    skipped += result.skipped;
    updated += result.updated;
    outOfScope += result.outOfScope;
  }

  // Fix any legacy bills with missing billedRole
  const missingRoleBills = await Billing.find({ billedRole: { $in: [null, undefined] } }).select("_id customerId").lean();
  if (missingRoleBills.length > 0) {
    const userIds = [...new Set(missingRoleBills.map((b) => b.customerId.toString()))];
    const users = await User.find({ _id: { $in: userIds } }).select("_id role").lean();
    const roleMap = {};
    users.forEach((u) => { roleMap[u._id.toString()] = u.role; });
    for (const bill of missingRoleBills) {
      const role = roleMap[bill.customerId.toString()] || "customer_admin";
      await Billing.updateOne({ _id: bill._id }, { $set: { billedRole: role } });
    }
    console.log(`[Billing] Fixed billedRole on ${missingRoleBills.length} legacy bills`);
  }

  // Mark overdue
  await Billing.updateMany(
    { status: "UNPAID", dueDate: { $lt: now } },
    { $set: { status: "OVERDUE" } }
  );

  return {
    message: `Bill generation complete: ${created} created, ${skipped} already existed, ${updated} updated${orgId ? `, ${outOfScope} outside org skipped` : ""}`,
    created,
    skipped,
    updated,
    outOfScope,
    period: periodLabel(billingMonth, billingYear),
  };
};
