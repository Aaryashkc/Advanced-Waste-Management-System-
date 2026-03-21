import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";
import {
  createOrganization,
  getAllOrganizations,
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
  assignDriverToTruck,
  getDeletionRequests,
  reviewDeletionRequest,
  getPendingDeletionCount
} from "../controllers/superAdmin.controller.js";
import { getAllDrivers } from "../controllers/driver.controller.js";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("super_admin"));

router.post("/organizations", createOrganization);
router.get("/organizations", getAllOrganizations);
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
router.put("/drivers/:driverId", updateDriver);
router.delete("/drivers/:driverId", deleteDriver);
router.post("/assign-driver-truck", assignDriverToTruck);

// Deletion requests
router.get("/deletion-requests/pending-count", getPendingDeletionCount);
router.get("/deletion-requests", getDeletionRequests);
router.put("/deletion-requests/:requestId", reviewDeletionRequest);

export default router;

