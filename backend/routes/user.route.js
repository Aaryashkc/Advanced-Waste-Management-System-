import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";
import { uploadSingleImage } from "../middlewares/upload.middleware.js";
import {
  requestOnDemandPickup,
  trackRequestStatus
} from "../controllers/user.controller.js";
import { uploadWasteImage } from "../controllers/upload.controller.js";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware("customer_admin"));

router.post("/pickup-request", requestOnDemandPickup);
router.get("/requests/:taskId/status", trackRequestStatus);
router.post("/upload-waste", (req, res, next) => {
  uploadSingleImage(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ message: "File size should be less than 5MB" });
      return res.status(400).json({ message: err.message || "Invalid file" });
    }
    next();
  });
}, uploadWasteImage);

export default router;

