import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";
import { getPricingConfig, updatePricingConfig } from "../controllers/pricingConfig.controller.js";

const router = express.Router();

router.use(authMiddleware);

// Read — super_admin, admin, driver
router.get("/", roleMiddleware("super_admin", "admin", "driver"), getPricingConfig);

// Update — super_admin only
router.put("/", roleMiddleware("super_admin"), updatePricingConfig);

export default router;
