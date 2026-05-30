import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";
import {
  getOrgAdmins,
  updateOrgAdmin,
  createAdmin,
  addTruck,
  addDriver,
  reviewOnDemandRequest,
  assignTaskToDriver,
  estimateWasteVolume,
  createDriverByAdmin,
  updateDriverByAdmin,
  getOrgTrucks,
  updateOrgTruck,
  assignDriverToOrgTruck,
  unassignDriverFromOrgTruck,
  requestDeletion,
  getMyDeletionRequests,
  getAdminAnalytics,
  getPendingDeletionCount,
  getMyOrganization,
  updateMyOrganization
} from "../controllers/orgAdmin.controller.js";
import { getAllDrivers } from "../controllers/driver.controller.js";
import { getDriverDetail } from "../controllers/superAdmin.controller.js";
import { getAllUsers, getUserById, updateUser } from "../controllers/userManagement.controller.js";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("admin", "super_admin"));

router.get("/admins", getOrgAdmins);
router.post("/admins", createAdmin);
router.put("/admins/:adminId", updateOrgAdmin);
router.get("/organization", getMyOrganization);
router.put("/organization", updateMyOrganization);
router.post("/trucks", addTruck);
router.post("/drivers", addDriver);
router.put("/requests/:taskId/review", reviewOnDemandRequest);
router.put("/tasks/:taskId/assign", assignTaskToDriver);
router.post("/estimate-volume", estimateWasteVolume);

// Driver management (org-scoped)
router.get("/drivers", getAllDrivers);
router.post("/drivers/create", createDriverByAdmin);
router.put("/drivers/:driverId", updateDriverByAdmin);
router.get("/drivers/:driverId/detail", getDriverDetail);

// Truck listing (org-scoped)
router.get("/trucks", getOrgTrucks);
router.put("/trucks/:vehicleId", updateOrgTruck);
router.post("/trucks/:truckId/unassign-driver", unassignDriverFromOrgTruck);
router.post("/assign-driver-truck", assignDriverToOrgTruck);

// Deletion requests
router.post("/deletion-requests", requestDeletion);
router.get("/deletion-requests/pending-count", getPendingDeletionCount);
router.get("/deletion-requests", getMyDeletionRequests);

// Admin Analytics
router.get("/analytics", getAdminAnalytics);

// User management (org-scoped for organization admins)
router.get("/users", getAllUsers);
router.get("/users/:userId", getUserById);
router.put("/users/:userId", updateUser);

export default router;

