import express from "express";
import {
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule
} from "../controllers/schedule.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();


// All routes require authentication
router.use(authMiddleware);

router.get("/", getSchedules);
router.get("/:id", getScheduleById);
router.post("/", createSchedule);
router.put("/:id", updateSchedule);
router.delete("/:id", deleteSchedule);

export default router;

