import express from "express";
import { getLocations, createLocation, deleteLocation } from "../controllers/location.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getLocations);
router.post("/", createLocation);
router.delete("/:id", deleteLocation);

export default router;
