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

const ML_BASE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const TIMEOUT_MS = 10000;

const mlApi = axios.create({
  baseURL: ML_BASE_URL,
  timeout: TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
});

/**
 * Predict waste for a single district on a specific date.
 */
export async function predictDistrict(district, date) {
  try {
    const response = await mlApi.post("/predict", { district, date });
    return response.data;
  } catch (error) {
    console.error("[mlClient] predictDistrict error:", error.message);
    return {
      error: "ML service unavailable — could not get prediction",
      detail: error.message,
      fallback: true,
    };
  }
}

/**
 * Generate a full day schedule with truck assignments for all districts.
 * Now sends real trucks from MongoDB to the ML service.
 * @param {string} date - ISO date string
 * @param {Object[]} trucks - Real truck data from MongoDB
 * @param {string[]} unavailableDrivers - Driver IDs that are unavailable
 */
export async function generateSchedule(date, trucks = [], unavailableDrivers = []) {
  try {
    const response = await mlApi.post("/schedule", {
      date,
      trucks,
      unavailable_drivers: unavailableDrivers,
    });
    return response.data;
  } catch (error) {
    console.error("[mlClient] generateSchedule error:", error.message);
    return {
      error: "ML service unavailable — could not generate schedule",
      detail: error.message,
      fallback: true,
    };
  }
}

/**
 * Get list of supported districts from ML service.
 */
export async function getMLDistricts() {
  try {
    const response = await mlApi.get("/districts");
    return response.data;
  } catch (error) {
    console.error("[mlClient] getMLDistricts error:", error.message);
    return {
      error: "ML service unavailable — could not fetch districts",
      detail: error.message,
      fallback: true,
    };
  }
}

/**
 * Check ML service health status.
 */
export async function checkMLHealth() {
  try {
    const response = await mlApi.get("/health");
    return response.data;
  } catch (error) {
    console.error("[mlClient] checkMLHealth error:", error.message);
    return {
      status: "offline",
      error: "ML service is not running",
      detail: error.message,
    };
  }
}
