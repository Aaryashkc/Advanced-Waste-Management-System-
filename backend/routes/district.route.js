import express from "express";
import {
  getDistricts,
  getDistrictById,
  createDistrict,
  updateDistrict,
  deleteDistrict,
} from "../controllers/district.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get("/", getDistricts); // admin sees own org, super_admin sees all
router.get("/:id", getDistrictById);
router.post("/", roleMiddleware("super_admin"), createDistrict);
router.put("/:id", roleMiddleware("super_admin"), updateDistrict);
router.delete("/:id", roleMiddleware("super_admin"), deleteDistrict);

export default router;
