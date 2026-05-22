import mongoose from "mongoose";
import PickupRequest from "../models/PickupRequest.model.js";
import User from "../models/User.model.js";
import Driver from "../models/Driver.model.js";
import { buildPaginationMeta, getPagination } from "../utils/pagination.js";

/**
 * GET /api/history/pickups
 * Returns paginated pickup history with summary stats.
 * Super_admin sees all, admin sees org-scoped.
 * Uses aggregation for stats instead of loading all docs.
 */
export const getPickupHistory = async (req, res) => {
  try {
    const { role, orgId } = req.user;
    const { status, category } = req.query;
    const pagination = getPagination(req.query, { defaultLimit: 10 });

    const filter = {};
    if (role === "admin" && orgId) {
      filter.orgId = new mongoose.Types.ObjectId(orgId);
    }
    if (status) filter.status = status;
    if (category) filter.category = category;

    // Parallel: fetch paginated pickups + total count + summary stats
    const [pickups, total, statusStats] = await Promise.all([
      PickupRequest.find(filter)
        .populate("customerId", "name email phone")
        .populate("driverId", "name email phone")
        .populate("orgId", "name")
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),

      PickupRequest.countDocuments(filter),

      // Aggregated stats — single pass, no loading all docs
      PickupRequest.aggregate([
        { $match: role === "admin" && orgId ? { orgId: new mongoose.Types.ObjectId(orgId) } : {} },
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
            avgResponseMs: {
              $avg: { $cond: [{ $ne: ["$responseTimeMs", null] }, "$responseTimeMs", "$$REMOVE"] },
            },
            avgTaskDurationMs: {
              $avg: { $cond: [{ $ne: ["$taskDurationMs", null] }, "$taskDurationMs", "$$REMOVE"] },
            },
          },
        },
      ]),
    ]);

    const stats = statusStats[0] || { total: 0, completed: 0, cancelled: 0, expired: 0, active: 0 };
    stats.completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    stats.avgResponseMs = Math.round(stats.avgResponseMs || 0);
    stats.avgTaskDurationMs = Math.round(stats.avgTaskDurationMs || 0);
    delete stats._id;

    const formatted = pickups.map((p) => ({
      _id: p._id,
      customer: p.customerId
        ? { id: p.customerId._id, name: p.customerId.name, email: p.customerId.email, phone: p.customerId.phone }
        : null,
      driver: p.driverId
        ? { id: p.driverId._id, name: p.driverId.name, email: p.driverId.email, phone: p.driverId.phone }
        : null,
      driverInfo: p.driverInfo,
      organization: p.orgId?.name || "N/A",
      location: p.location,
      province: p.province,
      area: p.area,
      category: p.category,
      level: p.level,
      status: p.status,
      createdAt: p.createdAt,
      assignedAt: p.assignedAt,
      completedAt: p.completedAt,
      cancelledAt: p.cancelledAt,
      responseTimeMs: p.responseTimeMs,
      taskDurationMs: p.taskDurationMs,
      updatedAt: p.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        pickups: formatted,
        stats,
        pagination: {
          ...buildPaginationMeta({ ...pagination, total }),
        },
      },
    });
  } catch (error) {
    console.error("Get pickup history error:", error);
    res.status(500).json({ message: "Failed to fetch pickup history", error: error.message });
  }
};

/**
 * GET /api/history/customers
 * Returns customer pickup stats using aggregation pipeline.
 */
export const getCustomerHistory = async (req, res) => {
  try {
    const { role, orgId } = req.user;
    const pagination = getPagination(req.query, { defaultLimit: 10 });

    const matchStage = {};
    if (role === "admin" && orgId) {
      matchStage.orgId = new mongoose.Types.ObjectId(orgId);
    }

    const customerStats = await PickupRequest.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$customerId",
          totalPickups: { $sum: 1 },
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
          recyclable: { $sum: { $cond: [{ $eq: ["$category", "recyclable"] }, 1, 0] } },
          nonRecyclable: { $sum: { $cond: [{ $eq: ["$category", "non-recyclable"] }, 1, 0] } },
          both: { $sum: { $cond: [{ $eq: ["$category", "both"] }, 1, 0] } },
          lastPickupAt: { $max: "$createdAt" },
          avgResponseMs: { $avg: "$responseTimeMs" },
        },
      },
      { $sort: { totalPickups: -1, lastPickupAt: -1, _id: 1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
          pipeline: [{ $project: { name: 1, email: 1, phone: 1 } }],
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          customerId: "$_id",
          name: { $ifNull: ["$user.name", "Unknown"] },
          email: { $ifNull: ["$user.email", ""] },
          phone: { $ifNull: ["$user.phone", ""] },
          totalPickups: 1,
          completed: 1,
          cancelled: 1,
          expired: 1,
          active: 1,
          categories: {
            recyclable: "$recyclable",
            "non-recyclable": "$nonRecyclable",
            both: "$both",
          },
          lastPickupAt: 1,
          avgResponseMs: { $round: [{ $ifNull: ["$avgResponseMs", 0] }, 0] },
          _id: 0,
        },
      },
      {
        $facet: {
          data: [{ $skip: pagination.skip }, { $limit: pagination.limit }],
          meta: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                totalPickups: { $sum: "$totalPickups" },
              },
            },
          ],
        },
      },
    ]);
    const customers = customerStats[0]?.data || [];
    const total = customerStats[0]?.meta?.[0]?.total || 0;
    const totalPickups = customerStats[0]?.meta?.[0]?.totalPickups || 0;

    res.status(200).json({
      success: true,
      data: {
        customers,
        totalCustomers: total,
        totalPickups,
        pagination: buildPaginationMeta({ ...pagination, total }),
      },
    });
  } catch (error) {
    console.error("Get customer history error:", error);
    res.status(500).json({ message: "Failed to fetch customer history", error: error.message });
  }
};

/**
 * GET /api/history/drivers
 * Returns driver pickup stats using aggregation pipeline.
 */
export const getDriverHistory = async (req, res) => {
  try {
    const { role, orgId } = req.user;
    const pagination = getPagination(req.query, { defaultLimit: 10 });

    const matchStage = { driverId: { $ne: null } };
    if (role === "admin" && orgId) {
      matchStage.orgId = new mongoose.Types.ObjectId(orgId);
    }

    const driverStats = await PickupRequest.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$driverId",
          totalPickups: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
          active: {
            $sum: {
              $cond: [
                { $in: ["$status", ["ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING"]] },
                1, 0,
              ],
            },
          },
          recyclable: { $sum: { $cond: [{ $eq: ["$category", "recyclable"] }, 1, 0] } },
          nonRecyclable: { $sum: { $cond: [{ $eq: ["$category", "non-recyclable"] }, 1, 0] } },
          both: { $sum: { $cond: [{ $eq: ["$category", "both"] }, 1, 0] } },
          lastPickupAt: { $max: "$createdAt" },
          avgResponseMs: { $avg: "$responseTimeMs" },
          avgTaskDurationMs: { $avg: "$taskDurationMs" },
        },
      },
      { $sort: { completed: -1, lastPickupAt: -1, _id: 1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
          pipeline: [{ $project: { name: 1, email: 1, phone: 1 } }],
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "drivers",
          localField: "_id",
          foreignField: "userId",
          as: "driverDoc",
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      { $unwind: { path: "$driverDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          driverId: { $ifNull: ["$driverDoc._id", "$_id"] },
          userId: "$_id",
          name: { $ifNull: ["$user.name", "Unknown"] },
          email: { $ifNull: ["$user.email", ""] },
          phone: { $ifNull: ["$user.phone", ""] },
          totalPickups: 1,
          completed: 1,
          cancelled: 1,
          active: 1,
          categories: {
            recyclable: "$recyclable",
            "non-recyclable": "$nonRecyclable",
            both: "$both",
          },
          lastPickupAt: 1,
          completionRate: {
            $cond: [
              { $gt: ["$totalPickups", 0] },
              { $round: [{ $multiply: [{ $divide: ["$completed", "$totalPickups"] }, 100] }, 0] },
              0,
            ],
          },
          avgResponseMs: { $round: [{ $ifNull: ["$avgResponseMs", 0] }, 0] },
          avgTaskDurationMs: { $round: [{ $ifNull: ["$avgTaskDurationMs", 0] }, 0] },
          _id: 0,
        },
      },
      {
        $facet: {
          data: [{ $skip: pagination.skip }, { $limit: pagination.limit }],
          meta: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                totalPickups: { $sum: "$totalPickups" },
              },
            },
          ],
        },
      },
    ]);
    const drivers = driverStats[0]?.data || [];
    const total = driverStats[0]?.meta?.[0]?.total || 0;
    const totalPickups = driverStats[0]?.meta?.[0]?.totalPickups || 0;

    res.status(200).json({
      success: true,
      data: {
        drivers,
        totalDrivers: total,
        totalPickups,
        pagination: buildPaginationMeta({ ...pagination, total }),
      },
    });
  } catch (error) {
    console.error("Get driver history error:", error);
    res.status(500).json({ message: "Failed to fetch driver history", error: error.message });
  }
};
