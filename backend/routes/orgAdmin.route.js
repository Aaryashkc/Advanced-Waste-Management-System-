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
  getOrgTrucks,
  requestDeletion,
  getMyDeletionRequests,
  getAdminAnalytics,
  getPendingDeletionCount
} from "../controllers/orgAdmin.controller.js";
import { getAllDrivers } from "../controllers/driver.controller.js";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("admin"));

router.get("/admins", getOrgAdmins);
router.post("/admins", createAdmin);
router.put("/admins/:adminId", updateOrgAdmin);
router.post("/trucks", addTruck);
router.post("/drivers", addDriver);
router.put("/requests/:taskId/review", reviewOnDemandRequest);
router.put("/tasks/:taskId/assign", assignTaskToDriver);
router.post("/estimate-volume", estimateWasteVolume);

// Driver management (org-scoped)
router.get("/drivers", getAllDrivers);
router.post("/drivers/create", createDriverByAdmin);

// Truck listing (org-scoped)
router.get("/trucks", getOrgTrucks);

// Deletion requests
router.post("/deletion-requests", requestDeletion);
router.get("/deletion-requests/pending-count", getPendingDeletionCount);
router.get("/deletion-requests", getMyDeletionRequests);

// Admin Analytics
router.get("/analytics", getAdminAnalytics);

export default router;

