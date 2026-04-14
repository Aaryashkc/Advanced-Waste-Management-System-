import PickupRequest from "../models/PickupRequest.model.js";

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
export async function buildPickupAnalytics(match) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    summaryAgg,
    statusAgg,
    categoryAgg,
    levelAgg,
    dailyAgg,
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
            $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, { $ifNull: ["$estimatedPrice", 0] }, 0] },
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

    PickupRequest.aggregate([
      { $match: { ...match, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          created: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    PickupRequest.aggregate([
      { $match: match },
      { $group: { _id: { $hour: "$createdAt" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),

    PickupRequest.aggregate([
      { $match: { ...match, status: "COMPLETED", driverId: { $ne: null } } },
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
    statusDistribution: statusAgg.map((s) => ({ status: s._id, count: s.count })),
    categoryDistribution: categoryAgg.map((c) => ({ category: c._id, count: c.count })),
    levelDistribution: levelAgg.map((l) => ({ level: l._id, count: l.count })),
    dailyTrend: dailyAgg.map((d) => ({
      date: d._id,
      created: d.created,
      completed: d.completed,
      cancelled: d.cancelled,
    })),
    hourlyDistribution: hourlyAgg.map((h) => ({ hour: h._id, count: h.count })),
    topDrivers: topDriversAgg,
  };
}
