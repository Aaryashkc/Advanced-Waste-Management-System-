import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";
import {
  createOrganization,
  getAllOrganizations,
  getOrganizationById,
  updateOrganization,
  addAdminToOrg,
  getSuperAdminAnalytics,
  getAllVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  unassignDriverFromTruck,
  createDriverBySuperAdmin,
  updateDriver,
  deleteDriver,
  deleteAdmin,
  assignDriverToTruck,
  getDeletionRequests,
  reviewDeletionRequest,
  getPendingDeletionCount,
  getDriverDetail,
  getPickupStats
} from "../controllers/superAdmin.controller.js";
import { getAllDrivers } from "../controllers/driver.controller.js";
import { getAllUsers, updateUser, getUserById } from "../controllers/userManagement.controller.js";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("super_admin"));

router.post("/organizations", createOrganization);
router.get("/organizations", getAllOrganizations);
router.get("/organizations/:orgId", getOrganizationById);
router.put("/organizations/:orgId", updateOrganization);
router.post("/organizations/:orgId/admins", addAdminToOrg);
router.get("/analytics", getSuperAdminAnalytics);

// Vehicle management
router.get("/vehicles", getAllVehicles);
router.post("/vehicles", createVehicle);
router.put("/vehicles/:vehicleId", updateVehicle);
router.delete("/vehicles/:vehicleId", deleteVehicle);
router.post("/vehicles/:truckId/unassign-driver", unassignDriverFromTruck);

// Driver management
router.get("/drivers", getAllDrivers);
router.post("/drivers", createDriverBySuperAdmin);
router.get("/drivers/:driverId/detail", getDriverDetail);
router.put("/drivers/:driverId", updateDriver);
router.delete("/drivers/:driverId", deleteDriver);
router.post("/assign-driver-truck", assignDriverToTruck);

// Pickup stats
router.get("/pickup-stats", getPickupStats);

// Admin management
router.delete("/admins/:adminId", deleteAdmin);

// User management (all users)
router.get("/users", getAllUsers);
router.get("/users/:userId", getUserById);
router.put("/users/:userId", updateUser);

// Deletion requests
router.get("/deletion-requests/pending-count", getPendingDeletionCount);
router.get("/deletion-requests", getDeletionRequests);
router.put("/deletion-requests/:requestId", reviewDeletionRequest);

export default router;

