import mongoose from "mongoose";
import PickupRequest from "../models/PickupRequest.model.js";
import PickupDailySummary from "../models/PickupDailySummary.model.js";
import MLSchedule from "../models/MLSchedule.model.js";

/**
 * Build a unified analytics payload from PickupRequest aggregations.
 * Used by BOTH super-admin and org-admin analytics endpoints — the only
 * difference between roles is the `match` filter:
 *   - super-admin: {} (everything)
 *   - org-admin:   { orgId: <theirOrgId> }
 *
 * Returns the canonical shape that the frontend Dashboard / chart components
 * read. Every number here comes from PickupRequest (the real source of truth
 * for completed work) — no more stale Task-collection numbers.
 *
 * Lives in services/ (not in a controller) so both controllers can import it
 * without creating a circular dependency.
 */
function dayRange(days = 30) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

function dateKey(date) {
  return new Date(date).toISOString().split("T")[0];
}

function objectIdOrNull(value) {
  return value || null;
}

export async function refreshPickupDailySummaries({ from, to } = {}) {
  if (mongoose.connection.readyState !== 1) return { refreshed: 0, skipped: "database-not-connected" };

  const { start, end } = from && to ? { start: from, end: to } : dayRange(30);

  const rows = await PickupRequest.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orgId: "$orgId",
        },
        created: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
        expired: { $sum: { $cond: [{ $eq: ["$status", "EXPIRED"] }, 1, 0] } },
        revenue: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$status", "COMPLETED"] }, { $eq: ["$paymentStatus", "PAID"] }] },
              { $ifNull: ["$estimatedPrice", 0] },
              0,
            ],
          },
        },
        responseTimeTotalMs: { $sum: { $ifNull: ["$responseTimeMs", 0] } },
        responseTimeCount: { $sum: { $cond: [{ $ne: ["$responseTimeMs", null] }, 1, 0] } },
        taskDurationTotalMs: { $sum: { $ifNull: ["$taskDurationMs", 0] } },
        taskDurationCount: { $sum: { $cond: [{ $ne: ["$taskDurationMs", null] }, 1, 0] } },
      },
    },
  ]);

  await PickupDailySummary.deleteMany({
    date: { $gte: dateKey(start), $lte: dateKey(end) },
  });

  if (rows.length === 0) return { refreshed: 0 };

  await PickupDailySummary.insertMany(
    rows.map((row) => ({
      date: row._id.date,
      orgId: objectIdOrNull(row._id.orgId),
      created: row.created,
      completed: row.completed,
      cancelled: row.cancelled,
      expired: row.expired,
      revenue: row.revenue,
      responseTimeTotalMs: row.responseTimeTotalMs,
      responseTimeCount: row.responseTimeCount,
      taskDurationTotalMs: row.taskDurationTotalMs,
      taskDurationCount: row.taskDurationCount,
      refreshedAt: new Date(),
    })),
    { ordered: false }
  );

  return { refreshed: rows.length };
}

export async function refreshPickupDailySummaryForDate(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return refreshPickupDailySummaries({ from: start, to: end });
}

async function buildPrecomputedDailyTrend(match, thirtyDaysAgo) {
  const summaryMatch = {
    date: { $gte: dateKey(thirtyDaysAgo) },
    ...(match.orgId ? { orgId: match.orgId } : {}),
  };

  const rows = await PickupDailySummary.aggregate([
    { $match: summaryMatch },
    {
      $group: {
        _id: "$date",
        created: { $sum: "$created" },
        completed: { $sum: "$completed" },
        cancelled: { $sum: "$cancelled" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((d) => ({
    date: d._id,
    created: d.created,
    completed: d.completed,
    cancelled: d.cancelled,
  }));
}

export async function buildPickupAnalytics(match) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    summaryAgg,
    statusAgg,
    categoryAgg,
    levelAgg,
    dailyTrend,
    monthlyRevenueAgg,
    paymentMethodRevenueAgg,
    hourlyAgg,
    topDriversAgg,
  ] = await Promise.all([
    PickupRequest.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
          expired: { $sum: { $cond: [{ $eq: ["$status", "EXPIRED"] }, 1, 0] } },
          active: {
            $sum: {
              $cond: [
                { $in: ["$status", ["PENDING", "ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING"]] },
                1, 0,
              ],
            },
          },
          totalRevenue: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$status", "COMPLETED"] }, { $eq: ["$paymentStatus", "PAID"] }] },
                { $ifNull: ["$estimatedPrice", 0] },
                0,
              ],
            },
          },
          avgResponseMs: {
            $avg: { $cond: [{ $ne: ["$responseTimeMs", null] }, "$responseTimeMs", "$$REMOVE"] },
          },
          avgTaskDurationMs: {
            $avg: { $cond: [{ $ne: ["$taskDurationMs", null] }, "$taskDurationMs", "$$REMOVE"] },
          },
        },
      },
    ]),

    PickupRequest.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    PickupRequest.aggregate([
      { $match: match },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),

    PickupRequest.aggregate([
      { $match: match },
      { $group: { _id: "$level", count: { $sum: 1 } } },
    ]),

    buildPrecomputedDailyTrend(match, thirtyDaysAgo),

    PickupRequest.aggregate([
      { $match: { ...match, status: "COMPLETED", paymentStatus: "PAID" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          revenue: { $sum: { $ifNull: ["$estimatedPrice", 0] } },
          completed: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 12 },
      { $sort: { _id: 1 } },
    ]),

    PickupRequest.aggregate([
      { $match: { ...match, status: "COMPLETED", paymentStatus: "PAID" } },
      {
        $group: {
          _id: "$paymentMethod",
          revenue: { $sum: { $ifNull: ["$estimatedPrice", 0] } },
          completed: { $sum: 1 },
        },
      },
    ]),

    PickupRequest.aggregate([
      { $match: match },
      { $group: { _id: { $hour: "$createdAt" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),

    PickupRequest.aggregate([
      { $match: { ...match, status: "COMPLETED", paymentStatus: "PAID", driverId: { $ne: null } } },
      {
        $group: {
          _id: "$driverId",
          completed: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$estimatedPrice", 0] } },
          avgResponseMs: { $avg: "$responseTimeMs" },
          avgTaskDurationMs: { $avg: "$taskDurationMs" },
        },
      },
      { $sort: { completed: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "driver",
          pipeline: [{ $project: { name: 1, email: 1 } }],
        },
      },
      { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          driverId: "$_id",
          name: { $ifNull: ["$driver.name", "Unknown driver"] },
          email: { $ifNull: ["$driver.email", ""] },
          completed: 1,
          revenue: { $round: ["$revenue", 0] },
          avgResponseMs: { $round: [{ $ifNull: ["$avgResponseMs", 0] }, 0] },
          avgTaskDurationMs: { $round: [{ $ifNull: ["$avgTaskDurationMs", 0] }, 0] },
          _id: 0,
        },
      },
    ]),
  ]);

  const summary = summaryAgg[0] || {
    total: 0, completed: 0, cancelled: 0, expired: 0, active: 0,
    totalRevenue: 0, avgResponseMs: 0, avgTaskDurationMs: 0,
  };
  const completionRate = summary.total > 0
    ? Math.round((summary.completed / summary.total) * 100)
    : 0;
  const paymentRevenue = paymentMethodRevenueAgg.reduce(
    (acc, row) => {
      const method = row._id === "esewa" ? "online" : "cash";
      acc[method] += Math.round(row.revenue || 0);
      return acc;
    },
    { cash: 0, online: 0 }
  );

  return {
    summary: {
      total: summary.total,
      completed: summary.completed,
      cancelled: summary.cancelled,
      expired: summary.expired,
      active: summary.active,
      completionRate,
      totalRevenue: Math.round(summary.totalRevenue || 0),
      avgResponseMs: Math.round(summary.avgResponseMs || 0),
      avgTaskDurationMs: Math.round(summary.avgTaskDurationMs || 0),
    },
    paymentMethodRevenue: {
      cash: paymentRevenue.cash,
      online: paymentRevenue.online,
      total: paymentRevenue.cash + paymentRevenue.online,
    },
    statusDistribution: statusAgg.map((s) => ({ status: s._id, count: s.count })),
    categoryDistribution: categoryAgg.map((c) => ({ category: c._id, count: c.count })),
    levelDistribution: levelAgg.map((l) => ({ level: l._id, count: l.count })),
    dailyTrend,
    monthlyRevenue: monthlyRevenueAgg.map((d) => ({
      month: d._id,
      revenue: Math.round(d.revenue || 0),
      completed: d.completed,
    })),
    hourlyDistribution: hourlyAgg.map((h) => ({ hour: h._id, count: h.count })),
    topDrivers: topDriversAgg,
  };
}

function formatDateKey(date) {
  return new Date(date).toISOString().split("T")[0];
}

function emptyScheduleAnalytics() {
  return {
    summary: {
      totalSchedules: 0,
      confirmedSchedules: 0,
      completedSchedules: 0,
      totalAssignments: 0,
      completedAssignments: 0,
      pendingAssignments: 0,
      failedAssignments: 0,
      completionRate: 0,
      predictedWasteKg: 0,
    },
    statusDistribution: [],
    dailyTrend: [],
    areaBreakdown: [],
    topDrivers: [],
  };
}

/**
 * Build dashboard analytics from ML scheduled collection assignments.
 * These are separate from customer pickup requests: a driver completing an
 * ML-scheduled area updates MLSchedule.areas[].assignedTrucks[], not
 * PickupRequest, so dashboard charts need this source too.
 */
export async function buildScheduleAnalytics({ orgId } = {}) {
  const orgIdString = orgId?.toString();
  const filter = {
    status: { $in: ["confirmed", "completed"] },
    ...(orgIdString ? { "areas.assignedTrucks.orgId": orgIdString } : {}),
  };

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [allSchedules, recentSchedules] = await Promise.all([
    MLSchedule.find(filter).sort({ date: -1 }).lean(),
    MLSchedule.find({ ...filter, date: { $gte: thirtyDaysAgo } }).sort({ date: 1 }).lean(),
  ]);

  if (allSchedules.length === 0) return emptyScheduleAnalytics();

  const includeTruck = (truck) => !orgIdString || truck.orgId?.toString() === orgIdString;

  const summary = {
    totalSchedules: 0,
    confirmedSchedules: 0,
    completedSchedules: 0,
    totalAssignments: 0,
    completedAssignments: 0,
    pendingAssignments: 0,
    failedAssignments: 0,
    predictedWasteKg: 0,
  };
  const statusCounts = {};
  const areaMap = new Map();
  const driverMap = new Map();
  const scheduleIdsWithAssignments = new Set();

  const accumulateSchedule = (
    schedule,
    { includeDaily = false, dailyMap = null, countSummary = true } = {}
  ) => {
    let hasScopedAssignment = false;
    const date = formatDateKey(schedule.date);
    const daily = includeDaily
      ? dailyMap.get(date) || { date, assigned: 0, completed: 0, predictedWasteKg: 0 }
      : null;

    for (const area of schedule.areas || []) {
      const scopedTrucks = (area.assignedTrucks || []).filter(includeTruck);
      if (scopedTrucks.length === 0) continue;

      hasScopedAssignment = true;
      const areaName = area.area || "Unknown";
      const predictedWasteKg = Number(area.predictedWasteKg || 0);
      const completedForArea = scopedTrucks.filter((truck) => truck.completionStatus === "completed").length;
      const failedForArea = scopedTrucks.filter((truck) => truck.completionStatus === "failed").length;
      const pendingForArea = scopedTrucks.length - completedForArea - failedForArea;

      if (countSummary) {
        summary.totalAssignments += scopedTrucks.length;
        summary.completedAssignments += completedForArea;
        summary.failedAssignments += failedForArea;
        summary.pendingAssignments += pendingForArea;
        summary.predictedWasteKg += predictedWasteKg;

        const areaStats = areaMap.get(areaName) || {
          name: areaName,
          assigned: 0,
          completed: 0,
          predictedWasteKg: 0,
        };
        areaStats.assigned += scopedTrucks.length;
        areaStats.completed += completedForArea;
        areaStats.predictedWasteKg += predictedWasteKg;
        areaMap.set(areaName, areaStats);
      }

      if (daily) {
        daily.assigned += scopedTrucks.length;
        daily.completed += completedForArea;
        daily.predictedWasteKg += predictedWasteKg;
      }

      if (countSummary) {
        for (const truck of scopedTrucks) {
          const driverKey = truck.driverId || truck.driverName || "unknown";
          const driverStats = driverMap.get(driverKey) || {
            driverId: truck.driverId || null,
            name: truck.driverName || "Unknown driver",
            completed: 0,
            assigned: 0,
            predictedWasteKg: 0,
          };
          driverStats.assigned += 1;
          driverStats.predictedWasteKg += predictedWasteKg;
          if (truck.completionStatus === "completed") driverStats.completed += 1;
          driverMap.set(driverKey, driverStats);
        }
      }
    }

    if (hasScopedAssignment) {
      if (countSummary) scheduleIdsWithAssignments.add(schedule._id.toString());
      if (includeDaily && daily) dailyMap.set(date, daily);
    }
  };

  for (const schedule of allSchedules) {
    accumulateSchedule(schedule);
  }

  for (const schedule of allSchedules) {
    if (!scheduleIdsWithAssignments.has(schedule._id.toString())) continue;
    statusCounts[schedule.status] = (statusCounts[schedule.status] || 0) + 1;
  }

  summary.totalSchedules = scheduleIdsWithAssignments.size;
  summary.confirmedSchedules = statusCounts.confirmed || 0;
  summary.completedSchedules = statusCounts.completed || 0;

  const dailyMap = new Map();
  for (const schedule of recentSchedules) {
    accumulateSchedule(schedule, { includeDaily: true, dailyMap, countSummary: false });
  }

  const completionRate = summary.totalAssignments > 0
    ? Math.round((summary.completedAssignments / summary.totalAssignments) * 100)
    : 0;

  return {
    summary: {
      ...summary,
      predictedWasteKg: Math.round(summary.predictedWasteKg),
      completionRate,
    },
    statusDistribution: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
    dailyTrend: Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, predictedWasteKg: Math.round(d.predictedWasteKg) })),
    areaBreakdown: Array.from(areaMap.values())
      .sort((a, b) => b.completed - a.completed || b.assigned - a.assigned)
      .slice(0, 15)
      .map((area) => ({ ...area, predictedWasteKg: Math.round(area.predictedWasteKg) })),
    topDrivers: Array.from(driverMap.values())
      .sort((a, b) => b.completed - a.completed || b.assigned - a.assigned)
      .slice(0, 10)
      .map((driver) => ({ ...driver, predictedWasteKg: Math.round(driver.predictedWasteKg) })),
  };
}
