import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.route.js";
import superAdminRoutes from "./routes/superAdmin.route.js";
import orgAdminRoutes from "./routes/orgAdmin.route.js";
import driverRoutes from "./routes/driver.route.js";
import userRoutes from "./routes/user.route.js";
import scheduleRoutes from "./routes/schedule.route.js";
import locationRoutes from "./routes/location.route.js";
import pickupRoutes from "./routes/pickup.route.js";
import contactRoutes from "./routes/contact.route.js";
import internalMessageRoutes from "./routes/internalMessage.route.js";
import mlScheduleRoutes from "./domains/ml-schedules/route.js";
import areaRoutes from "./routes/area.route.js";
import notificationRoutes from "./routes/notification.route.js";
import historyRoutes from "./routes/history.route.js";
import pricingConfigRoutes from "./routes/pricingConfig.route.js";
import paymentRoutes from "./routes/payment.route.js";
import billingRoutes from "./routes/billing.route.js";
import { cleanupExpiredUploads } from "./controllers/upload.controller.js";
import { metrics, reportError, requestObservability } from "./utils/observability.js";
import { apiResponseMiddleware, sendError, sendSuccess } from "./utils/apiResponse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

function normalizeOrigin(origin) {
  return origin?.trim().replace(/\/+$/, "");
}

function getAllowedOrigins() {
  return (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

export function createApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  const corsOptions = {
    origin: process.env.NODE_ENV === "production"
      ? (origin, callback) => {
          if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
            return callback(null, true);
          }
          return callback(new Error("Not allowed by CORS"));
        }
      : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    optionsSuccessStatus: 200,
  };

  app.use(cors(corsOptions));
  app.use(helmet());
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || "1mb" }));
  app.use(apiResponseMiddleware);
  app.use(requestObservability);

  app.use("/api/auth", authRoutes);
  app.use("/api/super-admin", superAdminRoutes);
  app.use("/api/org-admin", orgAdminRoutes);
  app.use("/api/driver", driverRoutes);
  app.use("/api/user", userRoutes);
  app.use("/api/schedule", scheduleRoutes);
  app.use("/api/location", locationRoutes);
  app.use("/api/pickups", pickupRoutes);
  app.use("/api/contact", contactRoutes);
  app.use("/api/internal-messages", internalMessageRoutes);
  app.use("/api/ml-schedule", mlScheduleRoutes);
  app.use("/api/areas", areaRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/history", historyRoutes);
  app.use("/api/pricing-config", pricingConfigRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/billing", billingRoutes);

  app.get("/", (req, res) => {
    return sendSuccess(res, { message: "Waste Management System API" });
  });

  app.get("/api/health", (req, res) => {
    return sendSuccess(res, {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    });
  });

  app.get("/api/metrics", (req, res) => {
    const secret = process.env.METRICS_SECRET;
    if (secret && req.query.secret !== secret) {
      return sendError(res, { statusCode: 401, message: "Unauthorized" }, "Unauthorized");
    }
    return res.type("text/plain").send(metrics.prometheus());
  });

  app.post("/api/errors/frontend", (req, res) => {
    const { message, stack, source, route, componentStack, userAgent } = req.body || {};
    reportError(new Error(message || "Frontend error"), {
      source: "frontend",
      route,
      frontendSource: source,
      componentStack,
      userAgent,
      stack,
    });
    return sendSuccess(res, { accepted: true }, 202);
  });

  app.get("/api/cron/cleanup-uploads", async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (secret && req.query.secret !== secret) {
      return sendError(res, { statusCode: 401, message: "Unauthorized" }, "Unauthorized");
    }
    try {
      const result = await cleanupExpiredUploads();
      return sendSuccess(res, { message: "Cleanup completed", ...result });
    } catch (err) {
      reportError(err, { source: "cron-endpoint", route: req.path });
      return sendError(res, err, "Cleanup failed");
    }
  });

  app.use((err, req, res, next) => {
    reportError(err, {
      source: "backend",
      route: `${req.method} ${req.originalUrl}`,
      userId: req.user?._id,
      orgId: req.user?.orgId,
    });
    return sendError(res, err, err.message || "Internal server error");
  });

  return app;
}

export default createApp();
