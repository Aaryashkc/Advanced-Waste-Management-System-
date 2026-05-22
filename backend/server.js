import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import cron from "node-cron";
import connectDB from "./config/db.js";

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
import { autoDispatchQualifiedMLSchedule, autoGenerateMLSchedule } from "./domains/ml-schedules/controller.js";
import { runBillGeneration } from "./controllers/billing.controller.js";
import { ensurePickupRequestIndexes, expireStalePendingPickups } from "./services/pickupExpiry.js";
import { ensurePaymentIndexes } from "./services/paymentIndexes.js";
import { refreshPickupDailySummaries } from "./services/pickupAnalytics.js";
import { initSocket } from "./socket/socketServer.js";
import { sendError } from "./utils/apiResponse.js";
import {
  instrumentMongoose,
  logger,
  metrics,
  reportError,
  requestObservability,
  runObservedCron,
} from "./utils/observability.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Single cron schedule guard so hot reload (e.g. nodemon) does not register multiple jobs
let cleanupCronScheduled = false;
let mlScheduleCronScheduled = false;
let mlAutoDispatchCronScheduled = false;
let billingCronScheduled = false;
let pickupExpiryCronScheduled = false;
let pickupSummaryCronScheduled = false;
const ML_AUTO_DISPATCH_CRON = "0 5 * * *"; // 5:00 AM every day - dispatches qualified ML truck assignments
const CRON_SCHEDULE = "0 2 * * *"; // 2:00 AM every day (server local time)
const PICKUP_EXPIRY_CRON = "*/1 * * * *"; // every minute
const PICKUP_SUMMARY_CRON = "*/15 * * * *"; // keep dashboard daily summaries warm
const ML_SCHEDULE_CRON = "0 0 * * *"; // 12:00 AM (midnight) every day - generates today's schedule
const BILLING_CRON = "0 3 1 * *"; // 3:00 AM on the 1st of every month - generate monthly bills

const LOCAL_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kathmandu";

const app = express();
const PORT = process.env.PORT || 5000;
instrumentMongoose();

// -- CORS ------------------------------------------------------------------
const corsOptions = {
  origin: process.env.NODE_ENV === "production"
    ? (process.env.FRONTEND_URL || "http://localhost:5173")
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
app.use(requestObservability);

// -- REST routes -----------------------------------------------------------
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

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Waste Management System API" });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.get("/api/metrics", (req, res) => {
  const secret = process.env.METRICS_SECRET;
  if (secret && req.query.secret !== secret) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  res.type("text/plain").send(metrics.prometheus());
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
  return res.status(202).json({ accepted: true });
});

// External cron endpoint (optional; protect with CRON_SECRET in production)
app.get("/api/cron/cleanup-uploads", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.query.secret !== secret) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const result = await cleanupExpiredUploads();
    return res.status(200).json({ message: "Cleanup completed", ...result });
  } catch (err) {
    reportError(err, { source: "cron-endpoint", route: req.path });
    return res.status(500).json({ message: "Cleanup failed", error: err.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  reportError(err, {
    source: "backend",
    route: `${req.method} ${req.originalUrl}`,
    userId: req.user?._id,
    orgId: req.user?.orgId,
  });
  return sendError(res, err, err.message || "Internal server error");
});

// -- HTTP + Socket.IO server -----------------------------------------------
const server = http.createServer(app);
initSocket(server); // attach Socket.IO to the same HTTP server

server.listen(PORT, async () => {
  logger.info("Server started", { port: PORT });
  logger.info("CORS configured", {
    origin: process.env.NODE_ENV === "production"
      ? process.env.FRONTEND_URL || "http://localhost:5173"
      : "all origins (development)",
  });
  try {
    await connectDB();
    await ensurePickupRequestIndexes();
    await ensurePaymentIndexes();
    await refreshPickupDailySummaries();
    await expireStalePendingPickups();
  } catch (err) {
    reportError(err, { source: "startup", message: "Startup database initialization failed" });
  }

  if (!cleanupCronScheduled) {
    cleanupCronScheduled = true;
    cron.schedule(CRON_SCHEDULE, runObservedCron("cleanup-expired-uploads", async () => {
      const result = await cleanupExpiredUploads();
      if (result.total > 0) {
        logger.info("Cleanup removed expired uploads", {
          deleted: result.deleted,
          errors: result.errors,
          total: result.total,
        });
      }
      return result;
    }));
  }

  if (!pickupExpiryCronScheduled) {
    pickupExpiryCronScheduled = true;
    cron.schedule(PICKUP_EXPIRY_CRON, runObservedCron("pickup-expiry", async () => {
      const result = await expireStalePendingPickups();
      if (result.modified > 0) {
        logger.info("Pickup expiry marked stale requests", { modified: result.modified });
      }
      return result;
    }));
  }

  if (!pickupSummaryCronScheduled) {
    pickupSummaryCronScheduled = true;
    cron.schedule(PICKUP_SUMMARY_CRON, runObservedCron("pickup-summary-refresh", refreshPickupDailySummaries));
  }

  if (!mlScheduleCronScheduled) {
    mlScheduleCronScheduled = true;
    cron.schedule(ML_SCHEDULE_CRON, runObservedCron("ml-auto-schedule", async () => {
      const result = await autoGenerateMLSchedule();
      logger.info("ML auto-schedule completed", { message: result.message });
      return result;
    }), { timezone: LOCAL_TIMEZONE });

    // Generate today's schedule on startup (if not already generated)
    // Delay slightly to ensure DB connection is ready
    setTimeout(() => {
      runObservedCron("ml-startup-schedule", async () => {
        const result = await autoGenerateMLSchedule();
        logger.info("ML startup schedule completed", { message: result.message });
        return result;
      })();
    }, 5000);
  }

  if (!mlAutoDispatchCronScheduled) {
    mlAutoDispatchCronScheduled = true;
    cron.schedule(ML_AUTO_DISPATCH_CRON, runObservedCron("ml-auto-dispatch", async () => {
      const result = await autoDispatchQualifiedMLSchedule();
      logger.info("ML auto-dispatch completed", { message: result.message });
      return result;
    }), { timezone: LOCAL_TIMEZONE });
  }

  if (!billingCronScheduled) {
    billingCronScheduled = true;
    cron.schedule(BILLING_CRON, runObservedCron("billing-generation", async () => {
      const result = await runBillGeneration();
      logger.info("Billing generation completed", { message: result.message });
      return result;
    }));

    // Bills are created by the monthly cron above or explicit admin action.
    // Avoid startup generation so restarts do not look like daily bill runs.
  }
});
