import http from "http";
import { pathToFileURL } from "url";
import cron from "node-cron";
import connectDB from "./config/db.js";

import app from "./app.js";
import { cleanupExpiredUploads } from "./controllers/upload.controller.js";
import { autoDispatchQualifiedMLSchedule, autoGenerateMLSchedule } from "./domains/ml-schedules/controller.js";
import { runBillGeneration } from "./controllers/billing.controller.js";
import { ensurePickupRequestIndexes, expireStalePendingPickups } from "./services/pickupExpiry.js";
import { ensurePaymentIndexes } from "./services/paymentIndexes.js";
import { refreshPickupDailySummaries } from "./services/pickupAnalytics.js";
import { initSocket } from "./socket/socketServer.js";
import {
  instrumentMongoose,
  logger,
  reportError,
  runObservedCron,
} from "./utils/observability.js";

let cleanupCronScheduled = false;
let mlScheduleCronScheduled = false;
let mlAutoDispatchCronScheduled = false;
let billingCronScheduled = false;
let pickupExpiryCronScheduled = false;
let pickupSummaryCronScheduled = false;

const PORT = process.env.PORT || 5000;
const ML_AUTO_DISPATCH_CRON = "0 5 * * *";
const CRON_SCHEDULE = "0 2 * * *";
const PICKUP_EXPIRY_CRON = "*/1 * * * *";
const PICKUP_SUMMARY_CRON = "*/15 * * * *";
const ML_SCHEDULE_CRON = "0 0 * * *";
const BILLING_CRON = "0 3 1 * *";
const LOCAL_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kathmandu";

async function initializeDatabase() {
  try {
    await connectDB();
    await ensurePickupRequestIndexes();
    await ensurePaymentIndexes();
    await refreshPickupDailySummaries();
    await expireStalePendingPickups();
  } catch (err) {
    reportError(err, { source: "startup", message: "Startup database initialization failed" });
  }
}

function scheduleCronJobs() {
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
  }
}

export async function startServer() {
  instrumentMongoose();

  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, async () => {
    logger.info("Server started", { port: PORT });
    logger.info("CORS configured", {
      origin: process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL || "http://localhost:5173"
        : "all origins (development)",
    });

    await initializeDatabase();
    scheduleCronJobs();
  });

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
