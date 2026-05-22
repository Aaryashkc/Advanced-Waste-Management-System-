/**
 * ML Service Client
 * Calls the Python FastAPI service for waste predictions and scheduling.
 *
 * Key design:
 *   - Every function is wrapped in try/catch — never throws
 *   - Returns { error, fallback: true } on failure instead of crashing
 *   - 10 second timeout (ML predictions can be slow)
 *   - Reads ML_SERVICE_URL from env with fallback default
 */

import axios from "axios";
import { logger, metrics, observeAsync } from "../utils/observability.js";

const ML_BASE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const TIMEOUT_MS = 10000;

const mlApi = axios.create({
  baseURL: ML_BASE_URL,
  timeout: TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
});

/**
 * Predict waste for a single area on a specific date.
 * Known areas use direct model prediction.
 * Unknown areas require district_type and optional scale_factor for type-based prediction.
 */
export async function predictArea(area, date, districtType = null, scaleFactor = 1.0) {
  const endpoint = "predict";
  try {
    const payload = { district: area, date };
    if (districtType) {
      payload.district_type = districtType;
      payload.scale_factor = scaleFactor;
    }
    const response = await observeAsync("ml_service_latency_ms", { endpoint, fallback: "false" }, () =>
      mlApi.post("/predict", payload)
    );
    return response.data;
  } catch (error) {
    metrics.increment("ml_service_fallback_total", { endpoint });
    logger.warn("ML service predict failed; returning fallback", { endpoint, error });
    return {
      error: "ML service unavailable — could not get prediction",
      detail: error.message,
      fallback: true,
    };
  }
}

/**
 * Generate a full day schedule with truck assignments for all areas.
 * Sends real trucks from MongoDB to the ML service.
 * @param {string} date - ISO date string
 * @param {Object[]} trucks - Real truck data from MongoDB
 * @param {string[]} unavailableDrivers - Driver IDs that are unavailable
 * @param {Object[]} extraAreas - New areas from DB for type-based prediction
 *   Each: { name, type, scale_factor }
 */
export async function generateSchedule(date, trucks = [], unavailableDrivers = [], extraAreas = []) {
  const endpoint = "schedule";
  try {
    const response = await observeAsync("ml_service_latency_ms", { endpoint, fallback: "false" }, () =>
      mlApi.post("/schedule", {
        date,
        trucks,
        unavailable_drivers: unavailableDrivers,
        extra_areas: extraAreas,
      })
    );
    return response.data;
  } catch (error) {
    metrics.increment("ml_service_fallback_total", { endpoint });
    logger.warn("ML service schedule failed; returning fallback", { endpoint, error });
    return {
      error: "ML service unavailable — could not generate schedule",
      detail: error.message,
      fallback: true,
    };
  }
}

/**
 * Get list of supported areas from ML service.
 * Note: ML service endpoint is still /districts internally.
 */
export async function getMLAreas() {
  const endpoint = "districts";
  try {
    const response = await observeAsync("ml_service_latency_ms", { endpoint, fallback: "false" }, () =>
      mlApi.get("/districts")
    );
    return response.data;
  } catch (error) {
    metrics.increment("ml_service_fallback_total", { endpoint });
    logger.warn("ML service areas failed; returning fallback", { endpoint, error });
    return {
      error: "ML service unavailable — could not fetch areas",
      detail: error.message,
      fallback: true,
    };
  }
}

/**
 * Check ML service health status.
 */
export async function checkMLHealth() {
  const endpoint = "health";
  try {
    const response = await observeAsync("ml_service_latency_ms", { endpoint, fallback: "false" }, () =>
      mlApi.get("/health")
    );
    return response.data;
  } catch (error) {
    metrics.increment("ml_service_fallback_total", { endpoint });
    logger.warn("ML service health failed; returning offline status", { endpoint, error });
    return {
      status: "offline",
      error: "ML service is not running",
      detail: error.message,
    };
  }
}
