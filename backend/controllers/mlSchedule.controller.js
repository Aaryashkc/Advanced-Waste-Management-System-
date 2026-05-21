import MLSchedule from "../models/MLSchedule.model.js";
import Truck from "../models/Truck.model.js";
import Driver from "../models/Driver.model.js";
import Area from "../models/Area.model.js";
import User from "../models/User.model.js";
import {
  predictArea as mlPredict,
  generateSchedule as mlGenerate,
  checkMLHealth as mlHealth,
} from "../services/mlClient.js";
import { createSystemNotification } from "./notification.controller.js";
import { getIO } from "../socket/socketServer.js";

const SCHEDULE_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kathmandu";

/**
 * Get today's schedule date in APP_TIMEZONE as a UTC midnight Date.
 * This ensures consistency: `new Date("2026-03-22")` and `getLocalTodayUTC()`
 * both produce `2026-03-22T00:00:00.000Z` when the schedule date is March 22.
 */
function getLocalTodayUTC() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`);
}

const FALLBACK_AREA_TYPES = {
  "Kathmandu-Core": "commercial",
  Baneshwor: "commercial",
  Koteshwor: "commercial",
  Balaju: "residential",
  Maharajgunj: "residential",
  Budhanilkantha: "suburban",
  Tokha: "suburban",
  Chandragiri: "rural",
  Lalitpur: "commercial",
  Satdobato: "commercial",
  Kirtipur: "residential",
  Imadol: "residential",
  Lubhu: "suburban",
  Godawari: "rural",
  Dakshinkali: "rural",
  Bhaktapur: "commercial",
  "Madhyapur Thimi": "residential",
  Suryabinayak: "suburban",
  Changunarayan: "rural",
  Nagarkot: "rural",
};

function getDayName(dateStr) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    new Date(`${dateStr}T00:00:00.000Z`).getUTCDay()
  ];
}

function categorizePredictedWaste(kg) {
  if (kg < 500) return "none";
  if (kg < 1500) return "low";
  if (kg < 3500) return "medium";
  if (kg < 6000) return "high";
  return "critical";
}

function fallbackRecommendation(wasteCategory, area, areaType) {
  const label = areaType || "area";
  if (wasteCategory === "none") return `Skip ${area} - predicted waste is negligible.`;
  if (wasteCategory === "low") return `Reduced service for ${area} - assign a light-duty truck.`;
  if (wasteCategory === "medium") return `Standard service for ${area} - assign a medium-duty truck.`;
  if (wasteCategory === "high") return `High volume expected in ${area} - assign a heavy-duty truck.`;
  return `Critical ${label} waste volume expected in ${area} - assign multiple trucks if available.`;
}

function stableAreaFactor(areaName, dateStr) {
  const input = `${areaName}:${dateStr}`;
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 9973;
  }
  return 0.9 + (hash % 21) / 100;
}

function buildBackendFallbackSchedule(dateStr, allAreas = [], unavailableDrivers = []) {
  const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
  const month = targetDate.getUTCMonth() + 1;
  const dayOfWeek = targetDate.getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const seasonFactor = month >= 6 && month <= 9 ? 1.12 : month === 10 || month === 11 ? 1.08 : 1;
  const weekendFactor = isWeekend ? 1.06 : 1;
  const baseByType = {
    commercial: 4300,
    residential: 2600,
    suburban: 1700,
    rural: 950,
  };

  const areaRows = allAreas.length > 0
    ? allAreas.map((area) => ({
        name: area.name,
        type: area.type || "residential",
        scaleFactor: area.scaleFactor || 1,
      }))
    : Object.entries(FALLBACK_AREA_TYPES).map(([name, type]) => ({
        name,
        type,
        scaleFactor: 1,
      }));

  let totalPredicted = 0;
  const districts = areaRows
    .filter((area) => area.name)
    .map((area) => {
      const areaType = area.type || "residential";
      const base = baseByType[areaType] || baseByType.residential;
      const predictedWasteKg = Math.max(
        0,
        Math.round(base * (area.scaleFactor || 1) * seasonFactor * weekendFactor * stableAreaFactor(area.name, dateStr) * 10) / 10
      );
      const wasteCategory = categorizePredictedWaste(predictedWasteKg);
      totalPredicted += predictedWasteKg;

      return {
        district: area.name,
        district_type: areaType,
        predicted_waste_kg: predictedWasteKg,
        waste_category: wasteCategory,
        action: wasteCategory === "none" ? "skip" : "dispatch",
        recommendation: fallbackRecommendation(wasteCategory, area.name, areaType),
        is_holiday: false,
        holiday_name: null,
        assigned_trucks: [],
      };
    })
    .sort((a, b) => a.district.localeCompare(b.district));

  return {
    date: dateStr,
    day_name: getDayName(dateStr),
    source: "backend_fallback",
    summary: {
      total_districts: districts.length,
      dispatched: districts.filter((d) => d.action === "dispatch").length,
      skipped: districts.filter((d) => d.action === "skip").length,
      reduced: 0,
      total_predicted_waste_kg: Math.round(totalPredicted * 10) / 10,
      total_trucks_assigned: 0,
      total_trucks_available: 0,
      unavailable_drivers: unavailableDrivers,
    },
    districts,
  };
}

function getAssignedDriverAreaMap(schedule) {
  const driverDocIds = new Set();
  const driverAreaMap = {};

  for (const area of (schedule.areas || [])) {
    for (const truck of (area.assignedTrucks || [])) {
      if (truck.driverId) {
        driverDocIds.add(truck.driverId);
        if (!driverAreaMap[truck.driverId]) driverAreaMap[truck.driverId] = [];
        driverAreaMap[truck.driverId].push(area.area);
      }
    }
  }

  return { driverDocIds, driverAreaMap };
}

async function notifyAssignedDrivers(schedule, source = "manual") {
  const { driverDocIds, driverAreaMap } = getAssignedDriverAreaMap(schedule);
  if (driverDocIds.size === 0) return 0;

  const drivers = await Driver.find({ _id: { $in: [...driverDocIds] } }).select("userId").lean();
  const dateLabel = schedule.dayName || schedule.date.toISOString().split("T")[0];
  const io = getIO();
  let notified = 0;

  for (const d of drivers) {
    if (!d.userId) continue;

    const areas = driverAreaMap[d._id.toString()] || [];
    const areasList = areas.join(", ");
    const isAuto = source === "auto";

    io.to(`driver:${d.userId}`).emit("schedule:confirmed", {
      scheduleId: schedule._id,
      date: schedule.date,
      dayName: schedule.dayName,
      message: isAuto
        ? `Schedule auto-dispatched for ${dateLabel}. You are assigned to: ${areasList}`
        : `Schedule confirmed for ${dateLabel}. You are assigned to: ${areasList}`,
    });

    await createSystemNotification({
      type: "schedule_confirmed",
      title: isAuto ? `Schedule Auto-Dispatched - ${dateLabel}` : `Schedule Confirmed - ${dateLabel}`,
      message: `You have been assigned to ${areas.length} area${areas.length !== 1 ? "s" : ""}: ${areasList}. Check your daily schedule for details.`,
      severity: "info",
      targetRoles: ["driver"],
      relatedData: {
        scheduleId: schedule._id,
        date: schedule.date.toISOString().split("T")[0],
        areaName: areasList,
      },
      targetUserId: d.userId,
    });
    notified += 1;
  }

  io.to("drivers").emit("schedule:updated", {
    scheduleId: schedule._id,
    status: "confirmed",
  });

  return notified;
}

async function confirmMLScheduleDocument(schedule, confirmedBy = null, source = "manual") {
  if (!schedule) {
    return { success: false, statusCode: 404, message: "ML schedule not found" };
  }

  if (schedule.status !== "draft") {
    return {
      success: false,
      statusCode: 400,
      message: `Cannot confirm schedule with status '${schedule.status}'. Only 'draft' schedules can be confirmed.`,
    };
  }

  const assignedTruckCount = (schedule.areas || []).reduce(
    (sum, area) => sum + (area.assignedTrucks || []).length,
    0
  );

  if (assignedTruckCount === 0) {
    return {
      success: false,
      statusCode: 400,
      message: "Cannot auto-dispatch schedule because no qualified trucks with assigned drivers were found.",
    };
  }

  schedule.status = "confirmed";
  if (confirmedBy) schedule.confirmedBy = confirmedBy;
  schedule.confirmedAt = new Date();
  await schedule.save();

  let notifiedDrivers = 0;
  try {
    notifiedDrivers = await notifyAssignedDrivers(schedule, source);
  } catch (notifyErr) {
    console.error("Failed to notify assigned drivers:", notifyErr.message);
  }

  return {
    success: true,
    statusCode: 200,
    message: source === "auto" ? "Schedule auto-dispatched" : "Schedule confirmed for dispatch",
    schedule,
    notifiedDrivers,
    assignedTruckCount,
  };
}

function buildExtraAreas(allAreas = []) {
  return allAreas
    .filter((a) => a.type && a.name)
    .map((a) => ({
      name: a.name,
      type: a.type,
      scale_factor: a.scaleFactor || 1.0,
    }));
}

function normalizeScheduleAreaName(name) {
  return (name || "").trim().toLowerCase();
}

function idsMatch(left, right) {
  return left != null && right != null && left.toString() === right.toString();
}

function buildScopedSchedule(schedule, orgId, orgAreaNames) {
  if (!orgId) return schedule;

  const filteredAreas = (schedule.areas || []).filter((area) => {
    if (idsMatch(area.orgId, orgId)) return true;

    // Older schedules do not have areas[].orgId, so fall back to Area.name.
    return orgAreaNames.has(normalizeScheduleAreaName(area.area));
  });

  if (filteredAreas.length === 0) return null;

  const assignedTruckIds = new Set();
  for (const area of filteredAreas) {
    for (const truck of area.assignedTrucks || []) {
      if (truck.truckId) assignedTruckIds.add(truck.truckId);
    }
  }

  return {
    ...schedule,
    areas: filteredAreas,
    totalPredictedWasteKg: Math.round(
      filteredAreas.reduce((sum, area) => sum + Number(area.predictedWasteKg || 0), 0)
    ),
    summary: {
      ...(schedule.summary || {}),
      totalAreas: filteredAreas.length,
      dispatched: filteredAreas.filter((area) => area.action === "dispatch").length,
      reduced: filteredAreas.filter((area) => area.action === "reduced").length,
      skipped: filteredAreas.filter((area) => area.action === "skip").length,
      totalTrucksAssigned: assignedTruckIds.size,
    },
  };
}

async function getOrgAreaNames(orgId) {
  if (!orgId) return new Set();

  const areas = await Area.find({ isActive: true, orgId })
    .select("name")
    .lean();

  return new Set(areas.map((area) => normalizeScheduleAreaName(area.name)));
}

/**
 * Org-aware truck assignment: assigns trucks to areas based on predicted waste,
 * ensuring trucks only go to areas within the SAME org.
 * ML service returns "district" field names which we map to "area" internally.
 * Returns { areasData, summary }.
 */
function assignTrucksToAreas(mlPredictions, trucksWithDrivers, areaOrgMap, areaOrgNameMap = {}) {
  // Build a pool of available trucks grouped by org
  const truckPoolByOrg = {};
  for (const t of trucksWithDrivers) {
    const orgKey = t.org_id || "__no_org__";
    if (!truckPoolByOrg[orgKey]) truckPoolByOrg[orgKey] = [];
    truckPoolByOrg[orgKey].push({ ...t, _assigned: false });
  }

  // Sort areas by predicted waste descending so high-demand areas pick first
  const sortedAreas = [...mlPredictions].sort(
    (a, b) => (b.predicted_waste_kg || 0) - (a.predicted_waste_kg || 0)
  );

  const areasData = [];
  const assignedTruckIds = new Set();

  for (const d of sortedAreas) {
    const areaOrgId = areaOrgMap[d.district?.toLowerCase()] || null;
    const predictedWaste = d.predicted_waste_kg || 0;

    // Find available trucks from the SAME org (or any org if area has no org)
    let candidateTrucks;
    if (areaOrgId) {
      candidateTrucks = (truckPoolByOrg[areaOrgId] || []).filter(
        (t) => !assignedTruckIds.has(t.id)
      );
    } else {
      // Area has no org constraint: pick from all remaining trucks
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
      } else if (areaOrgId && !(truckPoolByOrg[areaOrgId]?.length)) {
        skipReason = "No trucks available from this area's organization";
      } else {
        skipReason = "All matching trucks already assigned to other areas";
      }
    } else if (totalCapacity >= predictedWaste) {
      action = "dispatch";
    } else {
      action = "reduced";
    }

    areasData.push({
      area: d.district,
      areaType: d.district_type,
      predictedWasteKg: predictedWaste,
      wasteCategory: d.waste_category,
      action,
      recommendation: d.recommendation,
      isHoliday: d.is_holiday,
      holidayName: d.holiday_name || null,
      skipReason,
      orgId: areaOrgId,
      orgName: areaOrgNameMap[d.district?.toLowerCase()] || null,
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

  // === SECOND PASS: Auto-redispatch skipped/reduced areas ===
  // Try to assign closest matching truck from ANY org (cross-org fallback)
  // as long as the truck hasn't been assigned yet
  const needsRedispatch = areasData.filter(
    (d) => d.action === "skip" || d.action === "reduced"
  );

  for (const areaEntry of needsRedispatch) {
    const remainingTrucks = trucksWithDrivers.filter(
      (t) => !assignedTruckIds.has(t.id)
    );

    if (remainingTrucks.length === 0) break;

    const neededKg = areaEntry.predictedWasteKg || 0;
    const currentCapacity = areaEntry.assignedTrucks.reduce(
      (sum, t) => sum + (t.capacity || 0), 0
    );
    const deficit = neededKg - currentCapacity;

    if (deficit <= 0 && areaEntry.assignedTrucks.length > 0) continue;

    // Sort by closest capacity match to the deficit (or total need if no trucks yet)
    const targetKg = areaEntry.assignedTrucks.length > 0 ? deficit : neededKg;
    remainingTrucks.sort((a, b) => {
      const diffA = Math.abs((a.capacity_kg || 0) - targetKg);
      const diffB = Math.abs((b.capacity_kg || 0) - targetKg);
      return diffA - diffB;
    });

    // Assign trucks until we meet or exceed the predicted waste
    let totalCap = currentCapacity;
    const newlyAssigned = [];
    for (const truck of remainingTrucks) {
      if (totalCap >= neededKg && (areaEntry.assignedTrucks.length + newlyAssigned.length) > 0) break;
      newlyAssigned.push(truck);
      totalCap += truck.capacity_kg || 0;
      assignedTruckIds.add(truck.id);
    }

    if (newlyAssigned.length > 0) {
      areaEntry.assignedTrucks.push(
        ...newlyAssigned.map((t) => ({
          truckId: t.id,
          licensePlate: t.license_plate,
          driverName: t.driver_name,
          driverId: t.driver_id,
          capacity: t.capacity_kg,
          truckType: t.truck_type,
          orgId: t.org_id,
          orgName: t.org_name,
        }))
      );

      if (totalCap >= neededKg) {
        areaEntry.action = "dispatch";
        areaEntry.skipReason = null;
        areaEntry.recommendation = `Auto-assigned closest available truck(s): ${newlyAssigned.map(t => t.license_plate).join(", ")}`;
      } else {
        areaEntry.action = "reduced";
        areaEntry.skipReason = null;
        areaEntry.recommendation = `Partially covered with ${newlyAssigned.map(t => t.license_plate).join(", ")} (${Math.round(totalCap)}/${Math.round(neededKg)} kg)`;
      }
    }
  }

  // Re-sort back to original order (by area name) for consistency
  areasData.sort((a, b) => a.area.localeCompare(b.area));

  // Calculate summary stats from our assignment
  const dispatched = areasData.filter((d) => d.action === "dispatch").length;
  const reduced = areasData.filter((d) => d.action === "reduced").length;
  const skipped = areasData.filter((d) => d.action === "skip").length;

  const summary = {
    totalAreas: areasData.length,
    dispatched,
    reduced,
    skipped,
    totalTrucksAssigned: assignedTruckIds.size,
  };

  return { areasData, summary };
}

/**
 * Predict waste for a single area on a date.
 * POST /api/ml-schedule/predict
 * Accepts { area, date } — maps "area" to ML service's "district" param.
 */
export const predictArea = async (req, res) => {
  try {
    const { area, date } = req.body;

    if (!area || !date) {
      return res.status(400).json({
        success: false,
        message: "area and date are required",
      });
    }

    // Look up the area in DB to get type and scale factor for unknown districts
    const dbArea = await Area.findOne({ name: area, isActive: true }).lean();
    const areaType = dbArea?.type || null;
    const scaleFactor = dbArea?.scaleFactor || 1.0;

    const result = await mlPredict(area, date, areaType, scaleFactor);

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
    console.error("Predict area error:", error);
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

    // 3b. Build area→org map so we can enforce org-scoped truck assignment
    const allAreas = await Area.find({ isActive: true }).populate("orgId", "name").lean();
    const areaOrgMap = {};
    const areaOrgNameMap = {};
    for (const a of allAreas) {
      areaOrgMap[a.name.toLowerCase()] = a.orgId?._id?.toString() || null;
      areaOrgNameMap[a.name.toLowerCase()] = a.orgId?.name || null;
    }

    // 3c. Build extra areas list — DB areas that aren't in the ML trained set
    //     These get type-based predictions with scale factors
    const extraAreas = buildExtraAreas(allAreas);

    // 4. Call ML service with only driver-assigned trucks + extra areas
    let result = await mlGenerate(date, trucksWithDrivers, unavailableDrivers || [], extraAreas);
    let usedBackendFallback = false;

    if (result.fallback) {
      usedBackendFallback = true;
      console.warn(`[MLSchedule] ML service unavailable for ${date}; using backend fallback predictions. Detail: ${result.detail || result.error}`);
      result = buildBackendFallbackSchedule(date, allAreas, unavailableDrivers || []);
    }

    // Org-aware truck assignment: use ML predictions but assign trucks ourselves
    const { areasData, summary: assignmentSummary } = assignTrucksToAreas(
      result.districts,
      trucksWithDrivers,
      areaOrgMap,
      areaOrgNameMap
    );

    // 5. Save schedule to database
    const mlSchedule = new MLSchedule({
      date: new Date(date),
      dayName: result.day_name,
      status: "draft",
      totalPredictedWasteKg: result.summary.total_predicted_waste_kg,
      summary: {
        totalAreas: assignmentSummary.totalAreas,
        dispatched: assignmentSummary.dispatched,
        skipped: assignmentSummary.skipped,
        reduced: assignmentSummary.reduced,
        totalTrucksAssigned: assignmentSummary.totalTrucksAssigned,
        totalTrucksAvailable: trucksWithDrivers.length,
        driverlessTrucks: driverlessTrucksList.length,
        unavailableDrivers: result.summary.unavailable_drivers,
      },
      areas: areasData,
      generatedBy: req.user._id,
      mlModelInfo: {
        model: usedBackendFallback ? "BackendFallback" : "GradientBoosting",
        r2Score: usedBackendFallback ? 0 : 0.974,
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

    // Create notifications for skipped areas (no truck/driver)
    const skippedAreas = areasData.filter(d => d.action === "skip" && d.skipReason);
    if (skippedAreas.length > 0) {
      await createSystemNotification({
        type: "schedule_failed",
        title: "Areas Skipped Due to Resource Shortage",
        message: `${skippedAreas.length} area(s) were skipped on ${date}: ${skippedAreas.map(d => `${d.area} (${d.skipReason})`).join("; ")}`,
        severity: "critical",
        targetRoles: ["super_admin"],
        relatedData: {
          scheduleId: mlSchedule._id,
          date,
          reason: "no_resources",
        },
      });
    }

    if (usedBackendFallback) {
      return res.status(201).json({
        success: true,
        message: `Schedule generated with backend fallback because ML service is unavailable - ${trucksWithDrivers.length} trucks with drivers, ${driverlessTrucksList.length} trucks without drivers (excluded)`,
        data: mlSchedule,
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

    if (req.user.role === "admin" && !orgId) {
      return res.status(403).json({
        success: false,
        message: "Admin account is not assigned to an organization",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let schedules = await MLSchedule.find(filter)
      .populate("generatedBy", "name email")
      .populate("confirmedBy", "name email")
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // If org-scoped, filter areas by the area's organization. Do not use
    // assignedTrucks[].orgId here: skipped areas have no trucks, and fallback
    // dispatch can assign a truck from another org to this org's area.
    if (orgId) {
      const orgAreaNames = await getOrgAreaNames(orgId);
      schedules = schedules
        .map((schedule) => buildScopedSchedule(schedule, orgId, orgAreaNames))
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

    let schedule = await MLSchedule.findById(id)
      .populate("generatedBy", "name email")
      .populate("confirmedBy", "name email")
      .lean();

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "ML schedule not found",
      });
    }

    if (req.user.role === "admin") {
      const orgId = req.user.orgId?.toString();

      if (!orgId) {
        return res.status(403).json({
          success: false,
          message: "Admin account is not assigned to an organization",
        });
      }

      const orgAreaNames = await getOrgAreaNames(orgId);
      schedule = buildScopedSchedule(schedule, orgId, orgAreaNames);

      if (!schedule) {
        return res.status(404).json({
          success: false,
          message: "ML schedule not found for your organization",
        });
      }
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

    // Notify all assigned drivers via socket AND persistent notifications
    try {
      const io = getIO();
      // Collect unique Driver doc IDs and build a map of driver → assigned areas
      const driverDocIds = new Set();
      const driverAreaMap = {}; // driverId -> [areaName, ...]
      for (const area of (schedule.areas || [])) {
        for (const truck of (area.assignedTrucks || [])) {
          if (truck.driverId) {
            driverDocIds.add(truck.driverId);
            if (!driverAreaMap[truck.driverId]) driverAreaMap[truck.driverId] = [];
            driverAreaMap[truck.driverId].push(area.area);
          }
        }
      }
      // Look up User IDs from Driver documents (socket rooms use userId, not driver._id)
      if (driverDocIds.size > 0) {
        const drivers = await Driver.find({ _id: { $in: [...driverDocIds] } }).select("userId").lean();
        const dateLabel = schedule.dayName || schedule.date.toISOString().split("T")[0];
        for (const d of drivers) {
          if (d.userId) {
            const areas = driverAreaMap[d._id.toString()] || [];
            const areasList = areas.join(", ");

            // Emit real-time socket event
            io.to(`driver:${d.userId}`).emit("schedule:confirmed", {
              scheduleId: schedule._id,
              date: schedule.date,
              dayName: schedule.dayName,
              message: `Schedule confirmed for ${dateLabel}. You are assigned to: ${areasList}`,
            });

            // Create persistent notification for this driver
            await createSystemNotification({
              type: "schedule_confirmed",
              title: `Schedule Confirmed — ${dateLabel}`,
              message: `You have been assigned to ${areas.length} area${areas.length !== 1 ? "s" : ""}: ${areasList}. Check your daily schedule for details.`,
              severity: "info",
              targetRoles: ["driver"],
              relatedData: {
                scheduleId: schedule._id,
                date: schedule.date.toISOString().split("T")[0],
                areaName: areasList,
              },
              targetUserId: d.userId,
            });
          }
        }
      }
      // Also broadcast to all drivers room for general awareness
      io.to("drivers").emit("schedule:updated", {
        scheduleId: schedule._id,
        status: "confirmed",
      });
    } catch (_) { /* socket may not be ready */ }

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
 * Auto-confirm today's generated ML schedule for dispatch (called by 5 AM cron).
 * Qualified trucks are already filtered during generation: available trucks with
 * assigned drivers are scheduled, while driverless/skipped resources remain for
 * admin review and redispatch.
 */
export const autoDispatchQualifiedMLSchedule = async () => {
  try {
    const generationResult = await autoGenerateMLSchedule();
    if (!generationResult.success) return generationResult;

    const today = getLocalTodayUTC();
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const dateStr = today.toISOString().slice(0, 10);

    const schedule = await MLSchedule.findOne({
      date: { $gte: today, $lt: tomorrow },
    });

    if (!schedule) {
      return {
        success: false,
        message: `No ML schedule found for ${dateStr}; auto-dispatch skipped`,
      };
    }

    if (schedule.status !== "draft") {
      return {
        success: true,
        message: `Schedule for ${dateStr} is already ${schedule.status}; auto-dispatch skipped`,
      };
    }

    const result = await confirmMLScheduleDocument(schedule, null, "auto");

    if (!result.success) {
      return {
        success: false,
        message: result.message,
      };
    }

    const skipped = schedule.areas.filter((area) => area.action === "skip").length;
    const reduced = schedule.areas.filter((area) => area.action === "reduced").length;

    if (skipped > 0 || reduced > 0) {
      await createSystemNotification({
        type: "redispatch_needed",
        title: "Auto-Dispatch Needs Admin Review",
        message: `Auto-dispatch confirmed qualified truck assignments for ${dateStr}. ${skipped} skipped area(s) and ${reduced} partially covered area(s) still need admin review.`,
        severity: skipped > 0 ? "critical" : "warning",
        targetRoles: ["admin", "super_admin"],
        relatedData: {
          scheduleId: schedule._id,
          date: dateStr,
          reason: "manual_review_required",
        },
      });
    }

    return {
      success: true,
      message: `Auto-dispatched schedule for ${dateStr}: ${result.assignedTruckCount} truck assignment(s), ${result.notifiedDrivers} driver(s) notified`,
    };
  } catch (error) {
    console.error("Auto-dispatch ML schedule error:", error);
    return {
      success: false,
      message: `Auto-dispatch failed: ${error.message}`,
    };
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

    // Fallback: today's draft schedule (generated but not yet confirmed)
    if (!schedule) {
      schedule = await MLSchedule.findOne({
        date: { $gte: today, $lt: tomorrow },
        status: "draft",
      }).lean();
    }

    // Fallback: latest confirmed schedule (any date)
    if (!schedule) {
      schedule = await MLSchedule.findOne({
        status: "confirmed",
      })
        .sort({ date: -1 })
        .lean();
    }

    // Fallback: latest draft schedule (any date)
    if (!schedule) {
      schedule = await MLSchedule.findOne({
        status: "draft",
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
        areas: schedule.areas,
        createdAt: schedule.createdAt,
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

    // Build area→org map for org-scoped truck assignment
    const allAreas = await Area.find({ isActive: true }).populate("orgId", "name").lean();
    const areaOrgMap = {};
    const areaOrgNameMap = {};
    for (const a of allAreas) {
      areaOrgMap[a.name.toLowerCase()] = a.orgId?._id?.toString() || null;
      areaOrgNameMap[a.name.toLowerCase()] = a.orgId?.name || null;
    }
    const extraAreas = buildExtraAreas(allAreas);

    // 4. Call ML service
    let result = await mlGenerate(dateStr, trucksWithDrivers, [], extraAreas);
    let usedBackendFallback = false;

    if (result.fallback) {
      usedBackendFallback = true;
      console.warn(`[MLSchedule] ML service unavailable for ${dateStr}; using backend fallback predictions. Detail: ${result.detail || result.error}`);
      result = buildBackendFallbackSchedule(dateStr, allAreas, []);
    }

    // Org-aware truck assignment: use ML predictions but assign trucks ourselves
    const { areasData, summary: assignmentSummary } = assignTrucksToAreas(
      result.districts,
      trucksWithDrivers,
      areaOrgMap,
      areaOrgNameMap
    );

    // 5. Save schedule to database
    const mlSchedule = new MLSchedule({
      date: new Date(dateStr),
      dayName: result.day_name,
      status: "draft",
      totalPredictedWasteKg: result.summary.total_predicted_waste_kg,
      summary: {
        totalAreas: assignmentSummary.totalAreas,
        dispatched: assignmentSummary.dispatched,
        skipped: assignmentSummary.skipped,
        reduced: assignmentSummary.reduced,
        totalTrucksAssigned: assignmentSummary.totalTrucksAssigned,
        totalTrucksAvailable: trucksWithDrivers.length,
        driverlessTrucks: driverlessTrucksList.length,
        unavailableDrivers: result.summary.unavailable_drivers,
      },
      areas: areasData,
      generatedBy: null,
      mlModelInfo: {
        model: usedBackendFallback ? "BackendFallback" : "GradientBoosting",
        r2Score: usedBackendFallback ? 0 : 0.974,
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

    // Notify about skipped areas
    const skippedAreas = areasData.filter(d => d.action === "skip" && d.skipReason);
    if (skippedAreas.length > 0) {
      await createSystemNotification({
        type: "schedule_failed",
        title: "Areas Skipped in Auto-Schedule",
        message: `${skippedAreas.length} area(s) were skipped on ${dateStr}: ${skippedAreas.map(d => `${d.area} (${d.skipReason})`).join("; ")}`,
        severity: "critical",
        targetRoles: ["super_admin"],
        relatedData: {
          scheduleId: mlSchedule._id,
          date: dateStr,
          reason: "no_resources",
        },
      });
    }

    if (usedBackendFallback) {
      return {
        success: true,
        message: `Auto-generated fallback schedule for ${dateStr} - ML service unavailable, ${trucksWithDrivers.length} trucks with drivers, ${driverlessTrucksList.length} without`,
      };
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
 * - areaBreakdown: waste by area (for bar chart)
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

    // 2. Area Breakdown (bar chart: avg waste per area)
    const areaTotals = {};
    const areaCounts = {};
    for (const s of schedules) {
      for (const d of (s.areas || [])) {
        if (!d.area) continue;
        if (!areaTotals[d.area]) {
          areaTotals[d.area] = 0;
          areaCounts[d.area] = 0;
        }
        areaTotals[d.area] += d.predictedWasteKg;
        areaCounts[d.area] += 1;
      }
    }
    const areaBreakdown = Object.entries(areaTotals)
      .map(([area, total]) => ({
        area,
        totalWasteKg: Math.round(total),
        avgWasteKg: Math.round(total / (areaCounts[area] || 1)),
        scheduleCount: areaCounts[area],
      }))
      .sort((a, b) => b.avgWasteKg - a.avgWasteKg);

    // 3. Category Distribution (pie chart)
    const categoryCounts = { none: 0, low: 0, medium: 0, high: 0, critical: 0 };
    for (const s of schedules) {
      for (const d of (s.areas || [])) {
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
      for (const d of (s.areas || [])) {
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

    // 7. Incomplete/Failed areas report (skipped with reasons)
    const incompleteAreas = [];
    for (const s of schedules) {
      for (const d of (s.areas || [])) {
        if (d.action === "skip" || (d.action === "reduced" && (!d.assignedTrucks || d.assignedTrucks.length === 0))) {
          incompleteAreas.push({
            area: d.area,
            areaType: d.areaType,
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

    // 9. Reason breakdown for skipped areas
    const reasonCounts = {};
    for (const d of incompleteAreas) {
      const reason = d.reason || "Unknown";
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
    const reasonBreakdown = Object.entries(reasonCounts).map(([reason, count]) => ({ reason, count }));

    res.status(200).json({
      success: true,
      data: {
        wasteTrend,
        areaBreakdown,
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
        incompleteAreas,
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
        const allDriverIds = s.areas.flatMap(d => d.assignedTrucks.map(t => t.driverId));
        console.log(`[DriverAssignments] schedule date=${s.date}, status=${s.status}, driverIdsInSchedule=${JSON.stringify(allDriverIds)}`);
      }
    }

    // Helper: extract assignments for this driver from a schedule
    const extractAssignments = (schedule) => {
      if (!schedule) return null;
      const assignments = [];
      for (const areaEntry of schedule.areas) {
        for (const truck of areaEntry.assignedTrucks) {
          if (truck.driverId === driverId) {
            assignments.push({
              area: areaEntry.area,
              areaType: areaEntry.areaType,
              predictedWasteKg: areaEntry.predictedWasteKg,
              wasteCategory: areaEntry.wasteCategory,
              action: areaEntry.action,
              isHoliday: areaEntry.isHoliday,
              holidayName: areaEntry.holidayName,
              recommendation: areaEntry.recommendation,
              orgName: areaEntry.orgName || null,
              completionStatus: truck.completionStatus || "pending",
              completedAt: truck.completedAt || null,
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
 * Driver marks their area assignment as completed.
 * POST /api/ml-schedule/:id/complete-area
 * Body: { area, note? }
 */
export const completeAreaAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { area: areaName, note } = req.body;
    const userId = req.user._id;

    if (!areaName) {
      return res.status(400).json({ success: false, message: "area name is required" });
    }

    // Find the driver document for this user
    const driver = await Driver.findOne({ userId }).lean();
    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver profile not found" });
    }

    const driverId = driver._id.toString();

    const schedule = await MLSchedule.findById(id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: "Schedule not found" });
    }

    if (schedule.status !== "confirmed" && schedule.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: `Cannot complete assignments on a '${schedule.status}' schedule. Schedule must be confirmed first.`,
      });
    }

    const areaEntry = schedule.areas.find((d) => d.area === areaName);
    if (!areaEntry) {
      return res.status(404).json({ success: false, message: `Area '${areaName}' not found in schedule` });
    }

    // Find the truck assignment for THIS driver
    const truckAssignment = areaEntry.assignedTrucks.find((t) => t.driverId === driverId);
    if (!truckAssignment) {
      return res.status(403).json({ success: false, message: "You are not assigned to this area" });
    }

    if (truckAssignment.completionStatus === "completed") {
      return res.status(400).json({ success: false, message: "This assignment is already marked as completed" });
    }

    // Mark as completed
    truckAssignment.completionStatus = "completed";
    truckAssignment.completedAt = new Date();
    truckAssignment.completedBy = userId.toString();
    truckAssignment.completionNote = note || null;

    // Check if ALL truck assignments across ALL areas in this schedule are completed
    const allCompleted = schedule.areas.every((a) =>
      a.assignedTrucks.every(
        (t) => t.completionStatus === "completed" || a.action === "skip"
      )
    );

    if (allCompleted) {
      schedule.status = "completed";
    }

    await schedule.save();

    // Notify admins about completion via socket
    try {
      const io = getIO();
      const driverName = driver.userId ? (await User.findById(driver.userId).select("name").lean())?.name : "Unknown";

      io.to("admins").emit("schedule:area-completed", {
        scheduleId: schedule._id,
        area: areaName,
        driverName,
        licensePlate: truckAssignment.licensePlate,
        completedAt: truckAssignment.completedAt,
        allCompleted,
        date: schedule.date.toISOString().split("T")[0],
      });

      // Notify the driver back with confirmation
      io.to(`driver:${userId}`).emit("assignment:completed", {
        scheduleId: schedule._id,
        area: areaName,
        message: `You completed collection at ${areaName}`,
      });

      // Create persistent notification for admins
      await createSystemNotification({
        type: "area_completed",
        title: `Collection Completed — ${areaName}`,
        message: `${driverName} completed waste collection at ${areaName} (${truckAssignment.licensePlate}).${allCompleted ? " All assignments for this schedule are now complete." : ""}`,
        severity: "info",
        targetRoles: ["admin", "super_admin"],
        relatedData: {
          scheduleId: schedule._id,
          area: areaName,
          driverId,
          date: schedule.date.toISOString().split("T")[0],
        },
      });
    } catch (_) { /* socket may not be ready */ }

    res.status(200).json({
      success: true,
      message: allCompleted
        ? `Area '${areaName}' completed. All assignments done — schedule marked as completed!`
        : `Area '${areaName}' marked as completed`,
      data: {
        area: areaName,
        completionStatus: "completed",
        completedAt: truckAssignment.completedAt,
        scheduleCompleted: allCompleted,
      },
    });
  } catch (error) {
    console.error("Complete area assignment error:", error);
    res.status(500).json({ success: false, message: "Failed to complete assignment", error: error.message });
  }
};

/**
 * Get schedule completion history — for admins/super_admin and drivers.
 * GET /api/ml-schedule/completions
 * Query: { page, limit, driverId? }
 */
export const getScheduleCompletions = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const role = req.user.role;
    const userId = req.user._id;

    // Get schedules that have at least one completed assignment
    const filter = {
      status: { $in: ["confirmed", "completed"] },
      "areas.assignedTrucks.completionStatus": "completed",
    };

    const schedules = await MLSchedule.find(filter)
      .sort({ date: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await MLSchedule.countDocuments(filter);

    // For drivers, filter to only their completions
    let completions = [];

    if (role === "driver") {
      const driver = await Driver.findOne({ userId }).lean();
      const driverId = driver?._id?.toString();

      for (const s of schedules) {
        for (const area of s.areas) {
          for (const truck of area.assignedTrucks) {
            if (truck.driverId === driverId && truck.completionStatus === "completed") {
              completions.push({
                scheduleId: s._id,
                date: s.date.toISOString().split("T")[0],
                dayName: s.dayName,
                area: area.area,
                areaType: area.areaType,
                predictedWasteKg: area.predictedWasteKg,
                wasteCategory: area.wasteCategory,
                truck: {
                  licensePlate: truck.licensePlate,
                  truckType: truck.truckType,
                  capacity: truck.capacity,
                },
                completedAt: truck.completedAt,
                completionNote: truck.completionNote,
                driverName: truck.driverName,
              });
            }
          }
        }
      }
    } else {
      // Admin/super_admin — show all completions
      for (const s of schedules) {
        for (const area of s.areas) {
          for (const truck of area.assignedTrucks) {
            if (truck.completionStatus === "completed") {
              completions.push({
                scheduleId: s._id,
                date: s.date.toISOString().split("T")[0],
                dayName: s.dayName,
                area: area.area,
                areaType: area.areaType,
                predictedWasteKg: area.predictedWasteKg,
                wasteCategory: area.wasteCategory,
                orgName: area.orgName || truck.orgName,
                truck: {
                  licensePlate: truck.licensePlate,
                  truckType: truck.truckType,
                  capacity: truck.capacity,
                },
                completedAt: truck.completedAt,
                completionNote: truck.completionNote,
                driverName: truck.driverName,
              });
            }
          }
        }
      }
    }

    // Sort by completedAt desc
    completions.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    res.status(200).json({
      success: true,
      data: completions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (error) {
    console.error("Get schedule completions error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch completions", error: error.message });
  }
};

/**
 * Redispatch a single area in an existing schedule.
 * POST /api/ml-schedule/:id/redispatch
 * Body: { area }
 */
export const redispatchArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { area: areaName } = req.body;

    if (!areaName) {
      return res.status(400).json({ success: false, message: "area name is required" });
    }

    const schedule = await MLSchedule.findById(id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: "Schedule not found" });
    }

    const areaEntry = schedule.areas.find((d) => d.area === areaName);
    if (!areaEntry) {
      return res.status(404).json({ success: false, message: `Area '${areaName}' not found in schedule` });
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
    for (const d of schedule.areas) {
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

    // Get the org of this area for org-aware truck selection
    const areaDoc = await Area.findOne({ name: areaName }).populate("orgId", "name").lean();
    const areaOrgId = areaDoc?.orgId?._id?.toString() || null;

    // Prefer trucks from the same org, fall back to any available truck
    let orgTrucks = areaOrgId
      ? availableTrucks.filter((t) => t.org_id === areaOrgId)
      : availableTrucks;
    if (orgTrucks.length === 0) orgTrucks = availableTrucks;

    // Call ML service to predict for this single area
    const dateStr = schedule.date.toISOString().split("T")[0];
    const prediction = await mlPredict(areaName, dateStr);

    if (prediction.fallback) {
      return res.status(503).json({ success: false, message: "ML service unavailable" });
    }

    // Pick the best truck by capacity match from org-filtered list
    const neededKg = prediction.predicted_waste_kg || areaEntry.predictedWasteKg;
    orgTrucks.sort((a, b) => {
      const diffA = Math.abs(a.capacity_kg - neededKg);
      const diffB = Math.abs(b.capacity_kg - neededKg);
      return diffA - diffB;
    });

    const assignedTruck = orgTrucks[0];

    // Update the area entry
    areaEntry.action = "dispatch";
    areaEntry.skipReason = null;
    areaEntry.recommendation = `Redispatched with truck ${assignedTruck.license_plate}`;
    areaEntry.assignedTrucks = [{
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
    const dispatched = schedule.areas.filter((d) => d.action === "dispatch").length;
    const skipped = schedule.areas.filter((d) => d.action === "skip").length;
    schedule.summary.dispatched = dispatched;
    schedule.summary.skipped = skipped;

    await schedule.save();

    res.status(200).json({
      success: true,
      message: `Area '${areaName}' redispatched with truck ${assignedTruck.license_plate}`,
      data: schedule,
    });
  } catch (error) {
    console.error("Redispatch area error:", error);
    res.status(500).json({ success: false, message: "Failed to redispatch area", error: error.message });
  }
};
