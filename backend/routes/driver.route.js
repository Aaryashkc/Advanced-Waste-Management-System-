import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";
import {
  getMyProfile,
  getAssignedTasks,
  acceptTask,
  completeTask,
  updateLocation,
  getAllDrivers
} from "../controllers/driver.controller.js";

const router = express.Router();

router.use(authMiddleware);

// Routes for Drivers
router.get("/me", roleMiddleware("driver"), getMyProfile);
router.get("/tasks", roleMiddleware("driver"), getAssignedTasks);
router.put("/tasks/:taskId/accept", roleMiddleware("driver"), acceptTask);
router.put("/tasks/:taskId/complete", roleMiddleware("driver"), completeTask);
router.put("/location", roleMiddleware("driver"), updateLocation);

// Routes for Org Admins / Super Admins
// Since roleMiddleware takes a single role, we might need a custom check or array support.
// Assuming we want customer_admin (Org Admin) and super_admin to access this.
// If roleMiddleware only accepts one string, we might need to skip it here and rely on logic inside controller or create a reusable middleware for multiple roles.
// For now, let's just use authMiddleware (already applied) and let the controller handle scoping/security or add a specific check if critical.
// Actually, let's use a simple inline middleware for multiple roles if roleMiddleware doesn't support arrays.
const allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

router.get("/", allowRoles("customer_admin", "admin", "super_admin"), getAllDrivers);

export default router;
