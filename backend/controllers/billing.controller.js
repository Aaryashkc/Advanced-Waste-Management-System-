import mongoose from "mongoose";
import Billing from "../models/Billing.model.js";
import BillingConfig from "../models/BillingConfig.model.js";
import User from "../models/User.model.js";
import Area from "../models/Area.model.js";
import {
  buildEsewaBillingPayload,
  decodeAndVerifyCallback,
  verifyTransactionStatus,
} from "../services/esewaService.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// ── Defaults (used when no BillingConfig exists in DB) ───────────────────────
const DEFAULT_CUSTOMER_FEE = 500;
const DEFAULT_ADMIN_FEE = 1000;

function periodLabel(month, year) {
  const d = new Date(year, month - 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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
      status: { $in: ["UNPAID", "OVERDUE"] },
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

// ──────────────────────────────────────────────────────────────────────────────
// CUSTOMER ENDPOINTS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/billing/my-bills
 * Reads the user's persisted monthly bills.
 * Bill creation is handled by the monthly cron or explicit admin generation.
 */
export const getMyBills = async (req, res) => {
  try {
    const now = new Date();

    const bills = await Billing.find({ customerId: req.user._id })
      .sort({ billingYear: -1, billingMonth: -1 })
      .lean();

    // Mark overdue locally for display
    const updatedBills = bills.map((b) => {
      if (b.status === "UNPAID" && new Date(b.dueDate) < now) {
        return { ...b, status: "OVERDUE" };
      }
      return b;
    });

    const summary = {
      total: updatedBills.length,
      paid: updatedBills.filter((b) => b.status === "PAID").length,
      unpaid: updatedBills.filter((b) => b.status === "UNPAID" || b.status === "OVERDUE").length,
      totalPaid: updatedBills
        .filter((b) => b.status === "PAID")
        .reduce((sum, b) => sum + b.amount, 0),
      totalDue: updatedBills
        .filter((b) => b.status === "UNPAID" || b.status === "OVERDUE")
        .reduce((sum, b) => sum + b.amount, 0),
    };

    res.json({ bills: updatedBills, summary });
  } catch (err) {
    console.error("getMyBills error:", err);
    res.status(500).json({ message: "Failed to fetch bills" });
  }
};

/**
 * POST /api/billing/pay/:billingId
 *
 * For cash:  marks bill as PAID immediately.
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

    // ── Cash flow ────────────────────────────────────────────────────────
    if (method === "cash") {
      bill.status = "PAID";
      bill.paidAt = new Date();
      bill.paymentMethod = "cash";
      bill.resolvedBy = {
        userId: req.user._id,
        role: req.user.role,
        name: req.user.name,
      };
      await bill.save();
      await markOrgAdminPeriodPaid(bill);

      return res.json({ success: true, method: "cash", bill });
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
    res.status(500).json({ message: "Failed to process payment" });
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
    const history = await Billing.find({
      customerId: req.user._id,
      status: { $in: ["PAID", "WAIVED"] },
    })
      .sort({ paidAt: -1 })
      .lean();

    res.json({ history });
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
    const { status, month, year, billedRole, page = 1, limit = 50 } = req.query;
    const isSuperAdmin = req.user.role === "super_admin";

    const filter = {};

    if (isSuperAdmin) {
      if (req.query.orgId) filter.orgId = new mongoose.Types.ObjectId(req.query.orgId);
    } else {
      if (!req.user.orgId) {
        return res.status(403).json({ message: "No organization assigned to your account" });
      }
      // Org admin sees: their org's bills, bills for users in their org, AND unassigned bills (orgId null)
      const orgObjectId = new mongoose.Types.ObjectId(req.user.orgId);
      const orgUserIds = await User.find({ orgId: req.user.orgId, role: { $in: ["customer_admin", "admin"] } })
        .select("_id")
        .lean();
      const orgUserObjectIds = orgUserIds.map((u) => u._id);
      filter.$or = [
        { orgId: orgObjectId },
        { orgId: null },
        { customerId: { $in: orgUserObjectIds } },
      ];
    }

    if (status) filter.status = status;
    if (month) filter.billingMonth = parseInt(month);
    if (year) filter.billingYear = parseInt(year);
    if (billedRole) filter.billedRole = billedRole;

    const [bills, total] = await Promise.all([
      Billing.find(filter)
        .populate("customerId", "name email phone address")
        .populate("orgId", "name")
        .sort({ billingYear: -1, billingMonth: -1, status: 1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean(),
      Billing.countDocuments(filter),
    ]);

    // Build aggregation-safe filter (must use ObjectId types for _id fields)
    const aggFilter = {};
    if (filter.$or) {
      aggFilter.$or = filter.$or;
    }
    if (filter.orgId) aggFilter.orgId = filter.orgId;
    if (status) aggFilter.status = status;
    if (month) aggFilter.billingMonth = parseInt(month);
    if (year) aggFilter.billingYear = parseInt(year);
    if (billedRole) aggFilter.billedRole = billedRole;

    // Summary via aggregation
    const summaryAgg = await Billing.aggregate([
      { $match: aggFilter },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          paid: { $sum: { $cond: [{ $eq: ["$status", "PAID"] }, 1, 0] } },
          unpaid: { $sum: { $cond: [{ $eq: ["$status", "UNPAID"] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $eq: ["$status", "OVERDUE"] }, 1, 0] } },
          waived: { $sum: { $cond: [{ $eq: ["$status", "WAIVED"] }, 1, 0] } },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ["$status", "PAID"] }, "$amount", 0] },
          },
          totalOutstanding: {
            $sum: {
              $cond: [{ $in: ["$status", ["UNPAID", "OVERDUE"]] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    const summary = summaryAgg[0] || {
      totalBills: 0, paid: 0, unpaid: 0, overdue: 0, waived: 0,
      totalRevenue: 0, totalOutstanding: 0,
    };

    // Defaulters — remove any status filter and force UNPAID/OVERDUE
    const defaulterFilter = { ...aggFilter };
    delete defaulterFilter.status;
    defaulterFilter.status = { $in: ["UNPAID", "OVERDUE"] };

    const unpaidBills = await Billing.find(defaulterFilter)
      .populate("customerId", "name email phone address")
      .sort({ dueDate: 1 })
      .lean();

    const defaulters = unpaidBills.map((b) => ({
      _id: b._id,
      customer: b.customerId,
      amount: b.amount,
      billedRole: b.billedRole || "customer_admin",
      period: periodLabel(b.billingMonth, b.billingYear),
      dueDate: b.dueDate,
      status: b.status,
    }));

    res.json({
      bills,
      summary,
      defaulters,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
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
      // Allow waiving if bill belongs to org OR if the billed user belongs to admin's org
      const billBelongsToOrg = bill.orgId && String(bill.orgId) === String(req.user.orgId);
      let userBelongsToOrg = false;
      if (!billBelongsToOrg) {
        const billedUser = await User.findById(bill.customerId).select("orgId").lean();
        userBelongsToOrg = billedUser && String(billedUser.orgId) === String(req.user.orgId);
      }
      if (!billBelongsToOrg && !userBelongsToOrg) {
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

    let configs;
    if (isSuperAdmin) {
      configs = await BillingConfig.find()
        .populate("orgId", "name")
        .populate("updatedBy", "name")
        .sort({ orgId: 1 })
        .lean();
    } else {
      configs = await BillingConfig.find({
        orgId: { $in: [req.user.orgId, null] },
      })
        .populate("orgId", "name")
        .populate("updatedBy", "name")
        .lean();
    }

    // Calculate the effective fees the caller would see
    const globalConfig = configs.find((c) => !c.orgId);
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
  const dueDate = new Date(billingYear, billingMonth - 1, 15);

  // Fetch all active billable users: customers + admins
  // Use $ne: false instead of true to include users where isActive is undefined/missing
  const userFilter = {
    role: { $in: ["customer_admin", "admin"] },
    isActive: { $ne: false },
  };

  const billableUsers = await User.find(userFilter)
    .select("_id name email role orgId address location")
    .lean();

  console.log(`[Billing] Found ${billableUsers.length} billable users (customer_admin + admin) for ${billingMonth}/${billingYear}${orgId ? ` in org ${orgId}` : ""}`);

  let created = 0;
  let skipped = 0;
  let updated = 0;
  let outOfScope = 0;
  const paidAdminBillByOrg = new Map();

  for (const user of billableUsers) {
    const userOrgId = await resolveUserOrgId(user);
    if (orgId && String(userOrgId || "") !== String(orgId)) {
      outOfScope++;
      continue;
    }

    const fees = await getFeesForOrg(userOrgId);
    const isAdmin = user.role === "admin";
    const fee = isAdmin ? fees.adminFee : fees.customerFee;
    let paidAdminBill = null;

    if (isAdmin && userOrgId) {
      const orgKey = String(userOrgId);
      if (!paidAdminBillByOrg.has(orgKey)) {
        const paidBill = await Billing.findOne({
          orgId: userOrgId,
          billedRole: "admin",
          billingMonth,
          billingYear,
          status: "PAID",
        }).lean();
        paidAdminBillByOrg.set(orgKey, paidBill || null);
      }
      paidAdminBill = paidAdminBillByOrg.get(orgKey);
    }

    const existing = await Billing.findOne({
      customerId: user._id,
      billingMonth,
      billingYear,
    });

    if (existing) {
      // Fix missing/wrong fields on existing bills
      const needsOrgUpdate = String(existing.orgId || "") !== String(userOrgId || "");
      const canUpdateOpenBill = existing.status === "UNPAID" || existing.status === "OVERDUE";
      const needsAmountUpdate = canUpdateOpenBill && existing.amount !== fee;
      const needsRoleUpdate = existing.billedRole !== user.role;
      const needsSharedAdminPayment = canUpdateOpenBill && Boolean(paidAdminBill);

      if (needsOrgUpdate || needsAmountUpdate || needsRoleUpdate || needsSharedAdminPayment) {
        const updateFields = {};
        if (needsOrgUpdate) updateFields.orgId = userOrgId;
        if (needsAmountUpdate) updateFields.amount = fee;
        if (needsRoleUpdate) updateFields.billedRole = user.role;
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
      billingMonth,
      billingYear,
      amount: fee,
      dueDate,
      status: paidAdminBill ? "PAID" : "UNPAID",
      paidAt: paidAdminBill?.paidAt || null,
      paymentMethod: paidAdminBill?.paymentMethod || null,
      resolvedBy: paidAdminBill?.resolvedBy || undefined,
      notes: paidAdminBill ? paidAdminBill.notes || "Paid by another admin in this organization" : null,
    });
    created++;
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
