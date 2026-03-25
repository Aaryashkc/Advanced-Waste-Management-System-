import express from "express";
import {
  getAreas,
  getAreaById,
  createArea,
  updateArea,
  deleteArea,
} from "../controllers/area.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get("/", getAreas); // admin sees own org, super_admin sees all
router.get("/:id", getAreaById);
router.post("/", roleMiddleware("super_admin"), createArea);
router.put("/:id", roleMiddleware("super_admin"), updateArea);
router.delete("/:id", roleMiddleware("super_admin"), deleteArea);

export default router;
