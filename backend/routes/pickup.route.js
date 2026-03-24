import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";
import {
  createPickup,
  getPickup,
  getPendingPickups,
  acceptPickup,
  cancelPickup,
  updatePickupStatus,
  getActivePickup,
  getPickupEvents,
  getPickupAnalytics,
  getAllPickups,
} from "../controllers/pickup.controller.js";

const router = express.Router();

// All pickup routes require authentication
router.use(authMiddleware);

// ── Analytics (must be before /:id) ──────────────────────────────────────
router.get("/analytics", roleMiddleware("admin", "super_admin"), getPickupAnalytics);

// ── Admin: list all pickups with pagination ──────────────────────────────
router.get("/all", roleMiddleware("admin", "super_admin"), getAllPickups);

// ── Customer: create a pickup request ────────────────────────────────────
router.post("/", roleMiddleware("customer_admin"), createPickup);

// ── Driver: fetch all pending requests (initial load) ────────────────────
router.get("/pending", roleMiddleware("driver"), getPendingPickups);

// ── Driver: fetch active pickup ──────────────────────────────────────────
router.get("/active", roleMiddleware("driver"), getActivePickup);

// ── Shared: get a specific pickup ────────────────────────────────────────
router.get("/:id", getPickup);

// ── Audit trail for a pickup ─────────────────────────────────────────────
router.get("/:id/events", getPickupEvents);

// ── Driver: atomically accept a pending request ──────────────────────────
router.post("/:id/accept", roleMiddleware("driver"), acceptPickup);

// ── Driver: update pickup status through the task flow ───────────────────
router.post("/:id/status", roleMiddleware("driver"), updatePickupStatus);

// ── Customer (or admin): cancel a request ────────────────────────────────
router.post("/:id/cancel", cancelPickup);

export default router;
