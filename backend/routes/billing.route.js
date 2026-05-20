import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";
import {
  getMyBills,
  payBill,
  getPaymentHistory,
  getBillingOverview,
  getBillingAccountDetails,
  waiveBill,
  confirmCashPayment,
  generateMonthlyBills,
  getBillingConfig,
  updateBillingConfig,
  esewaBillingSuccess,
  esewaBillingFailure,
} from "../controllers/billing.controller.js";

const router = express.Router();

// ── Personal bill routes (customers AND admins can view/pay their own bills) ─
router.get(
  "/my-bills",
  authMiddleware,
  roleMiddleware("customer_admin", "admin"),
  getMyBills
);

router.post(
  "/pay/:billingId",
  authMiddleware,
  roleMiddleware("customer_admin", "admin"),
  payBill
);

router.get(
  "/history",
  authMiddleware,
  roleMiddleware("customer_admin", "admin"),
  getPaymentHistory
);

// ── eSewa billing callbacks — UNAUTHENTICATED (same as pickup payments) ──────
// Security is enforced by HMAC signature verification + status API.
router.get("/esewa/success", esewaBillingSuccess);
router.get("/esewa/failure", esewaBillingFailure);
router.post("/esewa/success", esewaBillingSuccess);
router.post("/esewa/failure", esewaBillingFailure);

// ── Admin + Super Admin routes ───────────────────────────────────────────────
// Both admin and super_admin can view billing overview (scoped by org)
router.get(
  "/admin/overview",
  authMiddleware,
  roleMiddleware("super_admin", "admin"),
  getBillingOverview
);

router.get(
  "/admin/accounts/:customerId",
  authMiddleware,
  roleMiddleware("super_admin", "admin"),
  getBillingAccountDetails
);

router.put(
  "/admin/:billingId/waive",
  authMiddleware,
  roleMiddleware("super_admin", "admin"),
  waiveBill
);

router.put(
  "/admin/:billingId/confirm-cash",
  authMiddleware,
  roleMiddleware("super_admin", "admin"),
  confirmCashPayment
);

// Generate current monthly bills. Super admin generates globally; admin is scoped to their org.
router.post(
  "/admin/generate",
  authMiddleware,
  roleMiddleware("super_admin", "admin"),
  generateMonthlyBills
);

// ── Billing config (fee management) ──────────────────────────────────────────
router.get(
  "/config",
  authMiddleware,
  roleMiddleware("super_admin", "admin"),
  getBillingConfig
);

router.put(
  "/config",
  authMiddleware,
  roleMiddleware("super_admin", "admin"),
  updateBillingConfig
);

export default router;
