import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";
import {
  getPickupHistory,
  getCustomerHistory,
  getDriverHistory,
} from "../controllers/history.controller.js";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("super_admin", "admin"));

router.get("/pickups", getPickupHistory);
router.get("/customers", getCustomerHistory);
router.get("/drivers", getDriverHistory);

export default router;
