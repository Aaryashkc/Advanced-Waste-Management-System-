import express from "express";
import {
  predictArea,
  generateSchedule,
  getMLSchedules,
  getMLScheduleById,
  confirmSchedule,
  getMLHealth,
  getMLAnalytics,
  getDriverMLAssignments,
  getPublicMLSchedule,
  redispatchArea,
} from "../controllers/mlSchedule.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";

const router = express.Router();

// Public/customer endpoint — requires auth but allows customer_admin, admin, super_admin
router.get("/public", authMiddleware, roleMiddleware("customer_admin", "admin", "super_admin"), getPublicMLSchedule);

// All remaining routes require authentication
router.use(authMiddleware);

// Driver endpoint (must be before /:id to avoid route conflict)
router.get("/driver-assignments", roleMiddleware("driver"), getDriverMLAssignments);

// ML service health check
router.get("/health", roleMiddleware("admin", "super_admin"), getMLHealth);

// ML analytics for Reports page — super_admin only
router.get("/analytics", roleMiddleware("super_admin"), getMLAnalytics);

// Admin/Super-admin endpoints
router.post("/predict", roleMiddleware("admin", "super_admin"), predictArea);
router.post("/generate", roleMiddleware("admin", "super_admin"), generateSchedule);
router.get("/", roleMiddleware("admin", "super_admin"), getMLSchedules);
router.get("/:id", roleMiddleware("admin", "super_admin"), getMLScheduleById);
router.post("/:id/confirm", roleMiddleware("admin", "super_admin"), confirmSchedule);
router.post("/:id/redispatch", roleMiddleware("admin", "super_admin"), redispatchArea);

export default router;
