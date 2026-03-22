import MLSchedule from "../models/MLSchedule.model.js";
import Truck from "../models/Truck.model.js";
import Driver from "../models/Driver.model.js";
import District from "../models/District.model.js";
import User from "../models/User.model.js";
import {
  predictDistrict as mlPredict,
  generateSchedule as mlGenerate,
  checkMLHealth as mlHealth,
} from "../services/mlClient.js";
import { createSystemNotification } from "./notification.controller.js";

/**
 * Get today's local date as a UTC midnight Date.
 * This ensures consistency: `new Date("2026-03-22")` and `getLocalTodayUTC()`
 * both produce `2026-03-22T00:00:00.000Z` when the local date is March 22.
 */
function getLocalTodayUTC() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
}

/**
 * Org-aware truck assignment: assigns trucks to districts based on predicted waste,
 * ensuring trucks only go to districts within the SAME org.
 * Returns { districtsData, summary }.
 */
function assignTrucksToDistricts(mlDistricts, trucksWithDrivers, districtOrgMap, districtOrgNameMap = {}) {
  // Build a pool of available trucks grouped by org
  const truckPoolByOrg = {};
  for (const t of trucksWithDrivers) {
    const orgKey = t.org_id || "__no_org__";
    if (!truckPoolByOrg[orgKey]) truckPoolByOrg[orgKey] = [];
    truckPoolByOrg[orgKey].push({ ...t, _assigned: false });
  }

  // Sort districts by predicted waste descending so high-demand districts pick first
  const sortedDistricts = [...mlDistricts].sort(
    (a, b) => (b.predicted_waste_kg || 0) - (a.predicted_waste_kg || 0)
  );

  const districtsData = [];
  const assignedTruckIds = new Set();

  for (const d of sortedDistricts) {
    const districtOrgId = districtOrgMap[d.district?.toLowerCase()] || null;
    const predictedWaste = d.predicted_waste_kg || 0;

    // Find available trucks from the SAME org (or any org if district has no org)
    let candidateTrucks;
    if (districtOrgId) {
      candidateTrucks = (truckPoolByOrg[districtOrgId] || []).filter(
        (t) => !assignedTruckIds.has(t.id)
      );
    } else {
      // District has no org constraint: pick from all remaining trucks
      candidateTrucks = trucksWithDrivers.filter(
        (t) => !assignedTruckIds.has(t.id)
      );
    }

    // Sort candidates by capacity descending to assign biggest trucks first
    candidateTrucks.sort((a, b) => (b.capacity_kg || 0) - (a.capacity_kg || 0));

    // Greedily assign trucks until we meet or exceed predicted waste
    const assigned = [];
    let totalCapacity = 0;
    for (const truck of candidateTrucks) {
      if (totalCapacity >= predictedWaste && assigned.length > 0) break;
      assigned.push(truck);
      totalCapacity += truck.capacity_kg || 0;
      assignedTruckIds.add(truck.id);
    }

    // Determine action based on capacity coverage
    let action;
    let skipReason = null;
    if (assigned.length === 0) {
      action = "skip";
      if (trucksWithDrivers.length === 0) {
        skipReason = "No trucks with assigned drivers available";
      } else if (districtOrgId && !(truckPoolByOrg[districtOrgId]?.length)) {
        skipReason = "No trucks available from this district's organization";
      } else {
        skipReason = "All matching trucks already assigned to other districts";
      }
    } else if (totalCapacity >= predictedWaste) {
      action = "dispatch";
    } else {
      action = "reduced";
    }

    districtsData.push({
      district: d.district,
      districtType: d.district_type,
      predictedWasteKg: predictedWaste,
      wasteCategory: d.waste_category,
      action,
      recommendation: d.recommendation,
      isHoliday: d.is_holiday,
      holidayName: d.holiday_name || null,
      skipReason,
      orgName: districtOrgNameMap[d.district?.toLowerCase()] || null,
      assignedTrucks: assigned.map((t) => ({
        truckId: t.id,
        licensePlate: t.license_plate,
        driverName: t.driver_name,
        driverId: t.driver_id,
        capacity: t.capacity_kg,
        truckType: t.truck_type,
        orgId: t.org_id,
        orgName: t.org_name,
      })),
    });
  }

  // Re-sort back to original order (by district name) for consistency
  districtsData.sort((a, b) => a.district.localeCompare(b.district));

  // Calculate summary stats from our assignment
  const dispatched = districtsData.filter((d) => d.action === "dispatch").length;
  const reduced = districtsData.filter((d) => d.action === "reduced").length;
  const skipped = districtsData.filter((d) => d.action === "skip").length;

  const summary = {
    totalDistricts: districtsData.length,
    dispatched,
    reduced,
    skipped,
    totalTrucksAssigned: assignedTruckIds.size,
  };

  return { districtsData, summary };
}

/**
 * Predict waste for a single district on a date.
 * POST /api/ml-schedule/predict
 */
export const predictDistrict = async (req, res) => {
  try {
    const { district, date } = req.body;

    if (!district || !date) {
      return res.status(400).json({
        success: false,
        message: "district and date are required",
      });
    }

    const result = await mlPredict(district, date);

    if (result.fallback) {
      return res.status(503).json({
        success: false,
        message: result.error,
        detail: result.detail,
      });
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Predict district error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to predict waste volume",
      error: error.message,
    });
  }
};

/**
 * Generate a full ML schedule for a date using REAL trucks/drivers from MongoDB.
 * POST /api/ml-schedule/generate
 * Body: { date, unavailableDrivers? }
 */
export const generateSchedule = async (req, res) => {
  try {
    const { date, unavailableDrivers } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "date is required (YYYY-MM-DD)",
      });
    }

    // 1. Fetch all available trucks from MongoDB with their org info
    const trucks = await Truck.find({ isAvailable: true })
      .populate("orgId", "name")
      .lean();

    // 2. Fetch all drivers with their assigned trucks and user info
    const drivers = await Driver.find({ isAvailable: true })
      .populate("userId", "name")
      .lean();

    // Build a map: truckId -> driver info
    const truckDriverMap = {};
    for (const driver of drivers) {
      if (driver.assignedTruckId) {
        truckDriverMap[driver.assignedTruckId.toString()] = {
          driverId: driver._id.toString(),
          driverUserId: driver.userId?._id?.toString(),
          driverName: driver.userId?.name || "Unknown",
        };
      }
    }

    // 3. Build truck data for ML service (real data only)
    const allTrucks = trucks.map((truck) => {
      const driverInfo = truckDriverMap[truck._id.toString()];
      return {
        id: truck._id.toString(),
        license_plate: truck.licensePlate,
        capacity_kg: truck.capacity,
        duty_type: truck.dutyType || "medium duty",
        truck_type: truck.truckType,
        org_id: truck.orgId?._id?.toString() || null,
        org_name: truck.orgId?.name || null,
        driver_id: driverInfo?.driverId || null,
        driver_user_id: driverInfo?.driverUserId || null,
        driver_name: driverInfo?.driverName || "Unassigned",
      };
    });

    // Split: only trucks WITH drivers get sent to ML for assignment
    const trucksWithDrivers = allTrucks.filter((t) => t.driver_id);
    const driverlessTrucksList = allTrucks.filter((t) => !t.driver_id);

    // 3b. Build district→org map so we can enforce org-scoped truck assignment
    const allDistricts = await District.find({ isActive: true }).populate("orgId", "name").lean();
    const districtOrgMap = {};
    const districtOrgNameMap = {};
    for (const d of allDistricts) {
      districtOrgMap[d.name.toLowerCase()] = d.orgId?._id?.toString() || null;
      districtOrgNameMap[d.name.toLowerCase()] = d.orgId?.name || null;
    }

    // 4. Call ML service with only driver-assigned trucks
    const result = await mlGenerate(date, trucksWithDrivers, unavailableDrivers || []);

    if (result.fallback) {
      return res.status(503).json({
        success: false,
        message: result.error,
        detail: result.detail,
      });
    }

    // Org-aware truck assignment: use ML predictions but assign trucks ourselves
    const { districtsData, summary: assignmentSummary } = assignTrucksToDistricts(
      result.districts,
      trucksWithDrivers,
      districtOrgMap,
      districtOrgNameMap
    );

    // 5. Save schedule to database
    const mlSchedule = new MLSchedule({
      date: new Date(date),
      dayName: result.day_name,
      status: "draft",
      totalPredictedWasteKg: result.summary.total_predicted_waste_kg,
      summary: {
        totalDistricts: assignmentSummary.totalDistricts,
        dispatched: assignmentSummary.dispatched,
        skipped: assignmentSummary.skipped,
        reduced: assignmentSummary.reduced,
        totalTrucksAssigned: assignmentSummary.totalTrucksAssigned,
        totalTrucksAvailable: trucksWithDrivers.length,
        driverlessTrucks: driverlessTrucksList.length,
        unavailableDrivers: result.summary.unavailable_drivers,
      },
      districts: districtsData,
      generatedBy: req.user._id,
      mlModelInfo: {
        model: "GradientBoosting",
        r2Score: 0.974,
      },
    });

    await mlSchedule.save();

    // 6. Create persistent notifications for driverless trucks
    if (driverlessTrucksList.length > 0) {
      const truckDetails = driverlessTrucksList.map((t) => ({
        id: t.id,
        licensePlate: t.license_plate,
        orgName: t.org_name,
        capacity: t.capacity_kg,
      }));

      await createSystemNotification({
        type: "driverless_truck",
        title: "Trucks Without Drivers Detected",
        message: `${driverlessTrucksList.length} truck(s) have no assigned driver and were excluded from scheduling on ${date}. Trucks: ${truckDetails.map(t => t.licensePlate).join(", ")}`,
        severity: "critical",
        targetRoles: ["admin", "super_admin"],
        relatedData: {
          scheduleId: mlSchedule._id,
          truckIds: truckDetails.map((t) => t.id),
          trucks: truckDetails,
          date,
        },
      });

      // Also create org-specific notifications
      const orgGroups = {};
      for (const t of driverlessTrucksList) {
        if (t.org_id) {
          if (!orgGroups[t.org_id]) orgGroups[t.org_id] = [];
          orgGroups[t.org_id].push(t);
        }
      }
      for (const [orgId, orgTrucks] of Object.entries(orgGroups)) {
        await createSystemNotification({
          type: "driverless_truck",
          title: "Your Trucks Need Drivers",
          message: `${orgTrucks.length} truck(s) in your organization have no driver assigned: ${orgTrucks.map(t => t.license_plate).join(", ")}. They were excluded from the ${date} schedule.`,
          severity: "warning",
          targetRoles: ["admin"],
          orgId,
          relatedData: {
            scheduleId: mlSchedule._id,
            trucks: orgTrucks.map((t) => ({
              id: t.id,
              licensePlate: t.license_plate,
              orgName: t.org_name,
              capacity: t.capacity_kg,
            })),
            date,
          },
        });
      }

      try {
        const { getIO } = await import("../socket/socketServer.js");
        const io = getIO();
        io.to("admins").emit("driverless-trucks-alert", {
          message: `${driverlessTrucksList.length} truck(s) have no assigned driver and were excluded from scheduling`,
          trucks: truckDetails,
          scheduleId: mlSchedule._id,
          date,
        });
      } catch (socketErr) {
        console.error("Failed to emit driverless truck alert:", socketErr.message);
      }
    }

    // Create notifications for skipped districts (no truck/driver)
    const skippedDistricts = districtsData.filter(d => d.action === "skip" && d.skipReason);
    if (skippedDistricts.length > 0) {
      await createSystemNotification({
        type: "schedule_failed",
        title: "Districts Skipped Due to Resource Shortage",
        message: `${skippedDistricts.length} district(s) were skipped on ${date}: ${skippedDistricts.map(d => `${d.district} (${d.skipReason})`).join("; ")}`,
        severity: "critical",
        targetRoles: ["super_admin"],
        relatedData: {
          scheduleId: mlSchedule._id,
          date,
          reason: "no_resources",
        },
      });
    }

    res.status(201).json({
      success: true,
      message: `ML schedule generated — ${trucksWithDrivers.length} trucks with drivers, ${driverlessTrucksList.length} trucks without drivers (excluded)`,
      data: mlSchedule,
    });
  } catch (error) {
    console.error("Generate ML schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate ML schedule",
      error: error.message,
    });
  }
};

/**
 * Get all ML schedules (with optional filters).
 * GET /api/ml-schedule
 */
export const getMLSchedules = async (req, res) => {
  try {
    const { status, limit = 20, page = 1, date } = req.query;

    const filter = {};
    if (status) filter.status = status;

    // Filter by specific date if provided
    if (date) {
      const targetDate = new Date(date + "T00:00:00.000Z");
      const nextDay = new Date(targetDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      filter.date = { $gte: targetDate, $lt: nextDay };
    }

    // Org scoping: admin auto-sets orgId from their profile
    const orgId = req.user.role === "admin"
      ? req.user.orgId?.toString()
      : req.query.orgId || null;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let schedules = await MLSchedule.find(filter)
      .populate("generatedBy", "name email")
      .populate("confirmedBy", "name email")
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // If org-scoped, filter districts to only those with trucks from the org
    if (orgId) {
      schedules = schedules
        .map((schedule) => {
          const filteredDistricts = schedule.districts.filter((d) =>
            d.assignedTrucks.some((t) => t.orgId === orgId)
          );
          if (filteredDistricts.length === 0) return null;
          return { ...schedule, districts: filteredDistricts };
        })
        .filter(Boolean);
    }

    const total = orgId
      ? schedules.length
      : await MLSchedule.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: schedules,
      count: schedules.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("Get ML schedules error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch ML schedules",
      error: error.message,
    });
  }
};

/**
 * Get a single ML schedule by ID.
 * GET /api/ml-schedule/:id
 */
export const getMLScheduleById = async (req, res) => {
  try {
    const { id } = req.params;

    const schedule = await MLSchedule.findById(id)
      .populate("generatedBy", "name email")
      .populate("confirmedBy", "name email");

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "ML schedule not found",
      });
    }

    res.status(200).json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.error("Get ML schedule by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch ML schedule",
      error: error.message,
    });
  }
};

/**
 * Confirm an ML schedule for dispatch.
 * POST /api/ml-schedule/:id/confirm
 */
export const confirmSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    const schedule = await MLSchedule.findById(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "ML schedule not found",
      });
    }

    if (schedule.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm schedule with status '${schedule.status}'. Only 'draft' schedules can be confirmed.`,
      });
    }

    schedule.status = "confirmed";
    schedule.confirmedBy = req.user._id;
    schedule.confirmedAt = new Date();
    await schedule.save();

    res.status(200).json({
      success: true,
      message: "Schedule confirmed for dispatch",
      data: schedule,
    });
  } catch (error) {
    console.error("Confirm ML schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm schedule",
      error: error.message,
    });
  }
};

/**
 * Check ML service health.
 * GET /api/ml-schedule/health
 */
export const getMLHealth = async (req, res) => {
  try {
    const result = await mlHealth();

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("ML health check error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check ML service health",
      error: error.message,
    });
  }
};

/**
 * Get today's ML-assigned pickups for the logged-in driver.
 * Uses the driver's MongoDB _id to match assignments (not name).
 * GET /api/ml-schedule/driver-assignments
 */
/**
 * Get the latest confirmed ML schedule for today or upcoming (public/customer view).
 * GET /api/ml-schedule/public
 */
export const getPublicMLSchedule = async (req, res) => {
  try {
    const today = getLocalTodayUTC();
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // First try to find today's confirmed schedule
    let schedule = await MLSchedule.findOne({
      date: { $gte: today, $lt: tomorrow },
      status: "confirmed",
    }).lean();

    // If none found for today, find the latest confirmed schedule (any date)
    if (!schedule) {
      schedule = await MLSchedule.findOne({
        status: "confirmed",
      })
        .sort({ date: -1 })
        .lean();
    }

    if (!schedule) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "No confirmed schedule found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: schedule._id,
        date: schedule.date,
        dayName: schedule.dayName,
        status: schedule.status,
        totalPredictedWasteKg: schedule.totalPredictedWasteKg,
        summary: schedule.summary,
        districts: schedule.districts,
      },
    });
  } catch (error) {
    console.error("Get public ML schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch public schedule",
      error: error.message,
    });
  }
};

/**
 * Auto-generate today's ML schedule (called by cron at midnight, no req/res).
 * Returns { success, message }.
 */
export const autoGenerateMLSchedule = async () => {
  try {
    // Calculate today's date range (UTC-aligned to match stored dates)
    const today = getLocalTodayUTC();
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // Check if a schedule for today already exists
    const existing = await MLSchedule.findOne({
      date: { $gte: today, $lt: tomorrow },
    });

    if (existing) {
      return {
        success: true,
        message: `Schedule for ${today.toISOString().slice(0, 10)} already exists (status: ${existing.status}), skipping auto-generation`,
      };
    }

    const dateStr = today.toISOString().slice(0, 10);

    // 1. Fetch all available trucks from MongoDB with their org info
    const trucks = await Truck.find({ isAvailable: true })
      .populate("orgId", "name")
      .lean();

    // 2. Fetch all drivers with their assigned trucks and user info
    const drivers = await Driver.find({ isAvailable: true })
      .populate("userId", "name")
      .lean();

    // Build a map: truckId -> driver info
    const truckDriverMap = {};
    for (const driver of drivers) {
      if (driver.assignedTruckId) {
        truckDriverMap[driver.assignedTruckId.toString()] = {
          driverId: driver._id.toString(),
          driverUserId: driver.userId?._id?.toString(),
          driverName: driver.userId?.name || "Unknown",
        };
      }
    }

    // 3. Build truck data for ML service
    const allTrucks = trucks.map((truck) => {
      const driverInfo = truckDriverMap[truck._id.toString()];
      return {
        id: truck._id.toString(),
        license_plate: truck.licensePlate,
        capacity_kg: truck.capacity,
        duty_type: truck.dutyType || "medium duty",
        truck_type: truck.truckType,
        org_id: truck.orgId?._id?.toString() || null,
        org_name: truck.orgId?.name || null,
        driver_id: driverInfo?.driverId || null,
        driver_user_id: driverInfo?.driverUserId || null,
        driver_name: driverInfo?.driverName || "Unassigned",
      };
    });

    // Only trucks WITH drivers get sent to ML
    const trucksWithDrivers = allTrucks.filter((t) => t.driver_id);
    const driverlessTrucksList = allTrucks.filter((t) => !t.driver_id);

    // Build district→org map for org-scoped truck assignment
    const allDistricts = await District.find({ isActive: true }).populate("orgId", "name").lean();
    const districtOrgMap = {};
    const districtOrgNameMap = {};
    for (const d of allDistricts) {
      districtOrgMap[d.name.toLowerCase()] = d.orgId?._id?.toString() || null;
      districtOrgNameMap[d.name.toLowerCase()] = d.orgId?.name || null;
    }

    // 4. Call ML service
    const result = await mlGenerate(dateStr, trucksWithDrivers, []);

    if (result.fallback) {
      return {
        success: false,
        message: `ML service unavailable for ${dateStr}: ${result.error}`,
      };
    }

    // Org-aware truck assignment: use ML predictions but assign trucks ourselves
    const { districtsData, summary: assignmentSummary } = assignTrucksToDistricts(
      result.districts,
      trucksWithDrivers,
      districtOrgMap,
      districtOrgNameMap
    );

    // 5. Save schedule to database
    const mlSchedule = new MLSchedule({
      date: new Date(dateStr),
      dayName: result.day_name,
      status: "draft",
      totalPredictedWasteKg: result.summary.total_predicted_waste_kg,
      summary: {
        totalDistricts: assignmentSummary.totalDistricts,
        dispatched: assignmentSummary.dispatched,
        skipped: assignmentSummary.skipped,
        reduced: assignmentSummary.reduced,
        totalTrucksAssigned: assignmentSummary.totalTrucksAssigned,
        totalTrucksAvailable: trucksWithDrivers.length,
        driverlessTrucks: driverlessTrucksList.length,
        unavailableDrivers: result.summary.unavailable_drivers,
      },
      districts: districtsData,
      generatedBy: null,
      mlModelInfo: {
        model: "GradientBoosting",
        r2Score: 0.974,
      },
    });

    await mlSchedule.save();

    // Create persistent notifications for driverless trucks (cron context)
    if (driverlessTrucksList.length > 0) {
      const truckDetails = driverlessTrucksList.map((t) => ({
        id: t.id,
        licensePlate: t.license_plate,
        orgName: t.org_name,
        capacity: t.capacity_kg,
      }));

      await createSystemNotification({
        type: "driverless_truck",
        title: "Trucks Without Drivers (Auto-Schedule)",
        message: `${driverlessTrucksList.length} truck(s) have no assigned driver and were excluded from auto-schedule on ${dateStr}. Trucks: ${truckDetails.map(t => t.licensePlate).join(", ")}`,
        severity: "critical",
        targetRoles: ["admin", "super_admin"],
        relatedData: {
          scheduleId: mlSchedule._id,
          trucks: truckDetails,
          date: dateStr,
        },
      });

      try {
        const { getIO } = await import("../socket/socketServer.js");
        const io = getIO();
        io.to("admins").emit("driverless-trucks-alert", {
          message: `${driverlessTrucksList.length} truck(s) have no assigned driver and were excluded from today's auto-schedule`,
          trucks: truckDetails,
          scheduleId: mlSchedule._id,
          date: dateStr,
        });
      } catch (socketErr) {
        console.error("Failed to emit driverless truck alert:", socketErr.message);
      }
    }

    // Notify about skipped districts
    const skippedDistricts = districtsData.filter(d => d.action === "skip" && d.skipReason);
    if (skippedDistricts.length > 0) {
      await createSystemNotification({
        type: "schedule_failed",
        title: "Districts Skipped in Auto-Schedule",
        message: `${skippedDistricts.length} district(s) were skipped on ${dateStr}: ${skippedDistricts.map(d => `${d.district} (${d.skipReason})`).join("; ")}`,
        severity: "critical",
        targetRoles: ["super_admin"],
        relatedData: {
          scheduleId: mlSchedule._id,
          date: dateStr,
          reason: "no_resources",
        },
      });
    }

    return {
      success: true,
      message: `Auto-generated ML schedule for ${dateStr} — ${trucksWithDrivers.length} trucks with drivers, ${driverlessTrucksList.length} without`,
    };
  } catch (error) {
    console.error("Auto-generate ML schedule error:", error);
    return {
      success: false,
      message: `Auto-generation failed: ${error.message}`,
    };
  }
};

/**
 * Get ML scheduling analytics for the Reports page.
 * GET /api/ml-schedule/analytics
 *
 * Returns:
 * - wasteTrend: last 30 days of predicted waste (for line chart)
 * - districtBreakdown: waste by district (for bar chart)
 * - categoryDistribution: waste categories across schedules (for pie chart)
 * - scheduleStats: confirmed/draft/cancelled counts (for doughnut)
 * - actionDistribution: dispatch/skip/reduced counts
 * - weeklyComparison: this week vs last week
 */
export const getMLAnalytics = async (req, res) => {
  try {
    // Get last 30 days of confirmed schedules
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const schedules = await MLSchedule.find({
      date: { $gte: thirtyDaysAgo },
      status: { $in: ["confirmed", "completed"] },
    })
      .sort({ date: 1 })
      .lean();

    // 1. Waste Trend (line chart: date vs total predicted waste)
    const wasteTrend = schedules.map((s) => ({
      date: s.date.toISOString().split("T")[0],
      dayName: s.dayName,
      totalWasteKg: s.totalPredictedWasteKg,
      trucksAssigned: s.summary?.totalTrucksAssigned || 0,
      dispatched: s.summary?.dispatched || 0,
    }));

    // 2. District Breakdown (bar chart: avg waste per district)
    const districtTotals = {};
    const districtCounts = {};
    for (const s of schedules) {
      for (const d of s.districts) {
        if (!districtTotals[d.district]) {
          districtTotals[d.district] = 0;
          districtCounts[d.district] = 0;
        }
        districtTotals[d.district] += d.predictedWasteKg;
        districtCounts[d.district] += 1;
      }
    }
    const districtBreakdown = Object.entries(districtTotals)
      .map(([district, total]) => ({
        district,
        totalWasteKg: Math.round(total),
        avgWasteKg: Math.round(total / (districtCounts[district] || 1)),
        scheduleCount: districtCounts[district],
      }))
      .sort((a, b) => b.avgWasteKg - a.avgWasteKg);

    // 3. Category Distribution (pie chart)
    const categoryCounts = { none: 0, low: 0, medium: 0, high: 0, critical: 0 };
    for (const s of schedules) {
      for (const d of s.districts) {
        if (d.wasteCategory) categoryCounts[d.wasteCategory]++;
      }
    }
    const categoryDistribution = Object.entries(categoryCounts)
      .filter(([, count]) => count > 0)
      .map(([category, count]) => ({ category, count }));

    // 4. Schedule Stats (doughnut chart: status counts for all time)
    const allSchedules = await MLSchedule.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const scheduleStats = allSchedules.map((s) => ({
      status: s._id,
      count: s.count,
    }));

    // 5. Action Distribution (how many dispatches vs skips vs reduced)
    const actionCounts = { dispatch: 0, skip: 0, reduced: 0 };
    for (const s of schedules) {
      for (const d of s.districts) {
        if (d.action) actionCounts[d.action]++;
      }
    }
    const actionDistribution = Object.entries(actionCounts).map(
      ([action, count]) => ({ action, count })
    );

    // 6. Weekly comparison
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const thisWeek = schedules.filter((s) => new Date(s.date) >= oneWeekAgo);
    const lastWeek = schedules.filter(
      (s) =>
        new Date(s.date) >= twoWeeksAgo && new Date(s.date) < oneWeekAgo
    );

    const thisWeekWaste = thisWeek.reduce(
      (sum, s) => sum + (s.totalPredictedWasteKg || 0),
      0
    );
    const lastWeekWaste = lastWeek.reduce(
      (sum, s) => sum + (s.totalPredictedWasteKg || 0),
      0
    );
    const changePercent =
      lastWeekWaste > 0
        ? Math.round(
            ((thisWeekWaste - lastWeekWaste) / lastWeekWaste) * 100
          )
        : 0;

    // 7. Incomplete/Failed districts report (skipped with reasons)
    const incompleteDistricts = [];
    for (const s of schedules) {
      for (const d of s.districts) {
        if (d.action === "skip" || (d.action === "reduced" && (!d.assignedTrucks || d.assignedTrucks.length === 0))) {
          incompleteDistricts.push({
            district: d.district,
            districtType: d.districtType,
            date: s.date.toISOString().split("T")[0],
            dayName: s.dayName,
            predictedWasteKg: d.predictedWasteKg,
            wasteCategory: d.wasteCategory,
            action: d.action,
            reason: d.skipReason || (d.assignedTrucks?.length === 0 ? "No truck/driver available" : "Skipped by ML model"),
            scheduleId: s._id,
            scheduleStatus: s.status,
          });
        }
      }
    }

    // 8. Driverless truck history
    const driverlessTruckStats = schedules
      .filter(s => s.summary?.driverlessTrucks > 0)
      .map(s => ({
        date: s.date.toISOString().split("T")[0],
        driverlessTrucks: s.summary.driverlessTrucks,
        totalTrucks: (s.summary.totalTrucksAvailable || 0) + s.summary.driverlessTrucks,
      }));

    // 9. Reason breakdown for skipped districts
    const reasonCounts = {};
    for (const d of incompleteDistricts) {
      const reason = d.reason || "Unknown";
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
    const reasonBreakdown = Object.entries(reasonCounts).map(([reason, count]) => ({ reason, count }));

    res.status(200).json({
      success: true,
      data: {
        wasteTrend,
        districtBreakdown,
        categoryDistribution,
        scheduleStats,
        actionDistribution,
        weeklyComparison: {
          thisWeekWaste: Math.round(thisWeekWaste),
          lastWeekWaste: Math.round(lastWeekWaste),
          changePercent,
          thisWeekSchedules: thisWeek.length,
          lastWeekSchedules: lastWeek.length,
        },
        totalSchedules: schedules.length,
        modelInfo: { model: "GradientBoosting", r2Score: 0.974 },
        incompleteDistricts,
        driverlessTruckStats,
        reasonBreakdown,
      },
    });
  } catch (error) {
    console.error("Get ML analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch ML analytics",
      error: error.message,
    });
  }
};

/**
 * Get today's and tomorrow's ML-assigned pickups for the logged-in driver.
 * Uses the driver's MongoDB _id to match assignments (not name).
 * GET /api/ml-schedule/driver-assignments
 */
export const getDriverMLAssignments = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find the Driver document for this user
    const driver = await Driver.findOne({ userId }).lean();

    if (!driver) {
      return res.status(200).json({
        success: true,
        data: { today: null, tomorrow: null },
        message: "No driver profile found",
      });
    }

    const driverId = driver._id.toString();

    // Date ranges for today and tomorrow (UTC-aligned to match stored schedule dates)
    const today = getLocalTodayUTC();
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);

    // Fetch both today's and tomorrow's schedules (confirmed or draft)
    const schedules = await MLSchedule.find({
      date: { $gte: today, $lt: dayAfter },
      status: { $in: ["confirmed", "completed", "draft"] },
    })
      .sort({ date: 1 })
      .lean();

    console.log(`[DriverAssignments] driverId=${driverId}, today=${today.toISOString()}, dayAfter=${dayAfter.toISOString()}, schedulesFound=${schedules.length}`);
    if (schedules.length > 0) {
      for (const s of schedules) {
        const allDriverIds = s.districts.flatMap(d => d.assignedTrucks.map(t => t.driverId));
        console.log(`[DriverAssignments] schedule date=${s.date}, status=${s.status}, driverIdsInSchedule=${JSON.stringify(allDriverIds)}`);
      }
    }

    // Helper: extract assignments for this driver from a schedule
    const extractAssignments = (schedule) => {
      if (!schedule) return null;
      const assignments = [];
      for (const district of schedule.districts) {
        for (const truck of district.assignedTrucks) {
          if (truck.driverId === driverId) {
            assignments.push({
              district: district.district,
              districtType: district.districtType,
              predictedWasteKg: district.predictedWasteKg,
              wasteCategory: district.wasteCategory,
              action: district.action,
              isHoliday: district.isHoliday,
              holidayName: district.holidayName,
              recommendation: district.recommendation,
              orgName: district.orgName || null,
              truck: {
                truckId: truck.truckId,
                licensePlate: truck.licensePlate,
                capacity: truck.capacity,
                truckType: truck.truckType,
              },
            });
          }
        }
      }
      return {
        scheduleId: schedule._id,
        scheduleDate: schedule.date,
        dayName: schedule.dayName,
        status: schedule.status,
        totalPredictedWasteKg: schedule.totalPredictedWasteKg,
        assignments,
      };
    };

    // Find today's schedule and tomorrow's schedule
    const todaySchedule = schedules.find(
      (s) => new Date(s.date) >= today && new Date(s.date) < tomorrow
    );
    const tomorrowSchedule = schedules.find(
      (s) => new Date(s.date) >= tomorrow && new Date(s.date) < dayAfter
    );

    res.status(200).json({
      success: true,
      data: {
        today: extractAssignments(todaySchedule),
        tomorrow: extractAssignments(tomorrowSchedule),
      },
    });
  } catch (error) {
    console.error("Get driver ML assignments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch driver assignments",
      error: error.message,
    });
  }
};

/**
 * Redispatch a single district in an existing schedule.
 * POST /api/ml-schedule/:id/redispatch
 * Body: { district }
 */
export const redispatchDistrict = async (req, res) => {
  try {
    const { id } = req.params;
    const { district: districtName } = req.body;

    if (!districtName) {
      return res.status(400).json({ success: false, message: "district name is required" });
    }

    const schedule = await MLSchedule.findById(id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: "Schedule not found" });
    }

    const districtEntry = schedule.districts.find((d) => d.district === districtName);
    if (!districtEntry) {
      return res.status(404).json({ success: false, message: `District '${districtName}' not found in schedule` });
    }

    // Fetch current available trucks WITH drivers
    const trucks = await Truck.find({ isAvailable: true }).populate("orgId", "name").lean();
    const drivers = await Driver.find({ isAvailable: true }).populate("userId", "name").lean();

    const truckDriverMap = {};
    for (const driver of drivers) {
      if (driver.assignedTruckId) {
        truckDriverMap[driver.assignedTruckId.toString()] = {
          driverId: driver._id.toString(),
          driverUserId: driver.userId?._id?.toString(),
          driverName: driver.userId?.name || "Unknown",
        };
      }
    }

    // Get trucks with drivers that are NOT already assigned in this schedule
    const assignedTruckIds = new Set();
    for (const d of schedule.districts) {
      for (const t of d.assignedTrucks) {
        assignedTruckIds.add(t.truckId);
      }
    }

    const availableTrucks = trucks
      .filter((truck) => {
        const hasDriver = !!truckDriverMap[truck._id.toString()];
        const notAssigned = !assignedTruckIds.has(truck._id.toString());
        return hasDriver && notAssigned;
      })
      .map((truck) => {
        const driverInfo = truckDriverMap[truck._id.toString()];
        return {
          id: truck._id.toString(),
          license_plate: truck.licensePlate,
          capacity_kg: truck.capacity,
          duty_type: truck.dutyType || "medium duty",
          truck_type: truck.truckType,
          org_id: truck.orgId?._id?.toString() || null,
          org_name: truck.orgId?.name || null,
          driver_id: driverInfo.driverId,
          driver_user_id: driverInfo.driverUserId,
          driver_name: driverInfo.driverName,
        };
      });

    if (availableTrucks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No available trucks with drivers for redispatch. Please assign drivers to trucks first.",
      });
    }

    // Get the org of this district for org-aware truck selection
    const districtDoc = await District.findOne({ name: districtName }).populate("orgId", "name").lean();
    const districtOrgId = districtDoc?.orgId?._id?.toString() || null;

    // Prefer trucks from the same org, fall back to any available truck
    let orgTrucks = districtOrgId
      ? availableTrucks.filter((t) => t.org_id === districtOrgId)
      : availableTrucks;
    if (orgTrucks.length === 0) orgTrucks = availableTrucks;

    // Call ML service to predict for this single district
    const dateStr = schedule.date.toISOString().split("T")[0];
    const prediction = await mlPredict(districtName, dateStr);

    if (prediction.fallback) {
      return res.status(503).json({ success: false, message: "ML service unavailable" });
    }

    // Pick the best truck by capacity match from org-filtered list
    const neededKg = prediction.predicted_waste_kg || districtEntry.predictedWasteKg;
    orgTrucks.sort((a, b) => {
      const diffA = Math.abs(a.capacity_kg - neededKg);
      const diffB = Math.abs(b.capacity_kg - neededKg);
      return diffA - diffB;
    });

    const assignedTruck = orgTrucks[0];

    // Update the district entry
    districtEntry.action = "dispatch";
    districtEntry.skipReason = null;
    districtEntry.recommendation = `Redispatched with truck ${assignedTruck.license_plate}`;
    districtEntry.assignedTrucks = [{
      truckId: assignedTruck.id,
      licensePlate: assignedTruck.license_plate,
      driverName: assignedTruck.driver_name,
      driverId: assignedTruck.driver_id,
      capacity: assignedTruck.capacity_kg,
      truckType: assignedTruck.truck_type,
      orgId: assignedTruck.org_id,
      orgName: assignedTruck.org_name,
    }];

    // Update summary counts
    const dispatched = schedule.districts.filter((d) => d.action === "dispatch").length;
    const skipped = schedule.districts.filter((d) => d.action === "skip").length;
    schedule.summary.dispatched = dispatched;
    schedule.summary.skipped = skipped;

    await schedule.save();

    res.status(200).json({
      success: true,
      message: `District '${districtName}' redispatched with truck ${assignedTruck.license_plate}`,
      data: schedule,
    });
  } catch (error) {
    console.error("Redispatch district error:", error);
    res.status(500).json({ success: false, message: "Failed to redispatch district", error: error.message });
  }
};
