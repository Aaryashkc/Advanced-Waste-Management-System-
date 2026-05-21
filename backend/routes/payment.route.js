import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";
import {
  initiatePayment,
  esewaSuccess,
  esewaFailure,
  markCashCollected,
  getPaymentByPickup,
  getAllPayments,
} from "../controllers/payment.controller.js";

const router = express.Router();

// Customer initiates a payment (cash or eSewa) for one of their pickups
router.post(
  "/initiate",
  authMiddleware,
  roleMiddleware("customer_admin"),
  initiatePayment
);

// eSewa redirect callbacks — UNAUTHENTICATED on purpose.
// Security is enforced by HMAC signature verification + server-to-server
// status confirmation inside the controller.
router.get("/esewa/success", esewaSuccess);
router.get("/esewa/failure", esewaFailure);
router.post("/esewa/success", esewaSuccess);
router.post("/esewa/failure", esewaFailure);

// Driver settles a cash payment during collection, before completing a pickup
router.post(
  "/:pickupId/cash-collected",
  authMiddleware,
  roleMiddleware("driver"),
  markCashCollected
);

// Read endpoints
router.get("/pickup/:pickupId", authMiddleware, getPaymentByPickup);
router.get(
  "/all",
  authMiddleware,
  roleMiddleware("admin", "super_admin"),
  getAllPayments
);

export default router;
