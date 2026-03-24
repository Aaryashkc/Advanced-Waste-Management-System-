import mongoose from "mongoose";
import PickupRequest from "../models/PickupRequest.model.js";
import PickupEvent from "../models/PickupEvent.model.js";
import Driver from "../models/Driver.model.js";
import Truck from "../models/Truck.model.js";
import User from "../models/User.model.js";
import { getIO } from "../socket/socketServer.js";
import { findBestDrivers } from "../services/driverMatcher.js";

// ── helpers ────────────────────────────────────────────────────────────────

function pickupPayload(doc) {
  return {
    id: doc._id,
    customerId: doc.customerId,
    wasteUploadId: doc.wasteUploadId,
    location: doc.location,
    province: doc.province,
    district: doc.district,
    category: doc.category,
    level: doc.level,
    status: doc.status,
    driverId: doc.driverId,
    driverInfo: doc.driverInfo,
    orgId: doc.orgId,
    assignedAt: doc.assignedAt,
    enRouteAt: doc.enRouteAt,
    arrivedAt: doc.arrivedAt,
    collectingAt: doc.collectingAt,
    completedAt: doc.completedAt,
    cancelledAt: doc.cancelledAt,
    cancelledBy: doc.cancelledBy,
    cancelReason: doc.cancelReason,
    responseTimeMs: doc.responseTimeMs,
    taskDurationMs: doc.taskDurationMs,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Create a PickupEvent audit record (fire-and-forget, never blocks main flow) */
function logEvent(pickupId, event, performer, fromStatus, toStatus, metadata = {}) {
  PickupEvent.create({
    pickupId,
    event,
    performedBy: {
      userId: performer?._id || performer?.userId || null,
      role: performer?.role || "system",
      name: performer?.name || null,
    },
    fromStatus,
    toStatus,
    metadata,
  }).catch((err) => console.error("[PickupEvent] Failed to log:", err.message));
}

function emitSafe(fn) {
  try { fn(getIO()); } catch (_) { /* socket may not be initialized */ }
}

// ── POST /api/pickups ──────────────────────────────────────────────────────

/**
 * Customer creates a new pickup request.
 * Uses the knapsack driver-matching algorithm to notify only best-fit drivers.
 * Falls back to broadcasting to all drivers if no matches found.
 */
export const createPickup = async (req, res) => {
  try {
    const { latitude, longitude, address, category, level, wasteUploadId, province, district } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "latitude and longitude are required" });
    }

    const customer = req.user;

    // Run the knapsack matching algorithm
    const matched = await findBestDrivers({
      latitude: Number(latitude),
      longitude: Number(longitude),
      category: category || "non-recyclable",
      level: level || "easy",
      orgId: customer.orgId,
    });

    const matchedUserIds = matched.map((m) => m.userId);

    const pickup = await PickupRequest.create({
      customerId: customer._id,
      orgId: customer.orgId,
      wasteUploadId: wasteUploadId || null,
      location: { latitude, longitude, address: address || null },
      province: province || null,
      district: district || null,
      category: category || "non-recyclable",
      level: level || "easy",
      matchedDriverIds: matchedUserIds,
      statusHistory: [
        {
          from: null,
          to: "PENDING",
          at: new Date(),
          by: { userId: customer._id, role: customer.role, name: customer.name },
        },
      ],
    });

    // Audit: CREATED event
    logEvent(pickup._id, "CREATED", customer, null, "PENDING", {
      location: pickup.location,
      category: pickup.category,
      level: pickup.level,
      province: pickup.province,
      district: pickup.district,
    });

    // Audit: MATCHED or BROADCAST event
    if (matched.length > 0) {
      logEvent(pickup._id, "MATCHED", { role: "system", name: "DriverMatcher" }, "PENDING", "PENDING", {
        matchedCount: matched.length,
        matchedDriverIds: matchedUserIds,
        scores: matched.map((m) => ({ userId: m.userId, score: m.score })),
      });
    } else {
      logEvent(pickup._id, "BROADCAST", { role: "system", name: "DriverMatcher" }, "PENDING", "PENDING", {
        reason: "No matching drivers found — broadcast to all",
      });
    }

    // Emit to matched drivers (or fallback to all)
    emitSafe((io) => {
      const payload = { ...pickupPayload(pickup), customerName: customer.name };
      if (matched.length > 0) {
        matched.forEach((m) => io.to(`driver:${m.userId}`).emit("pickup:created", payload));
      } else {
        io.to("drivers").emit("pickup:created", payload);
      }
    });

    return res.status(201).json({
      message: "Pickup request created",
      pickup: pickupPayload(pickup),
    });
  } catch (err) {
    console.error("createPickup error:", err);
    return res.status(500).json({ message: "Failed to create pickup request", error: err.message });
  }
};

// ── GET /api/pickups/:id ───────────────────────────────────────────────────

export const getPickup = async (req, res) => {
  try {
    const pickup = await PickupRequest.findById(req.params.id);
    if (!pickup) return res.status(404).json({ message: "Pickup request not found" });

    const { role, _id } = req.user;
    const isOwner = pickup.customerId.toString() === _id.toString();
    const isAdmin = role === "admin" || role === "super_admin";
    const isDriver = role === "driver";

    if (!isOwner && !isDriver && !isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.status(200).json({ pickup: pickupPayload(pickup) });
  } catch (err) {
    console.error("getPickup error:", err);
    return res.status(500).json({ message: "Failed to fetch pickup", error: err.message });
  }
};

// ── GET /api/pickups/:id/events ─────────────────────────────────────────

/**
 * Returns the full audit trail for a single pickup.
 * Admins and the pickup owner can view.
 */
export const getPickupEvents = async (req, res) => {
  try {
    const pickup = await PickupRequest.findById(req.params.id).select("customerId orgId").lean();
    if (!pickup) return res.status(404).json({ message: "Pickup request not found" });

    const { role, _id } = req.user;
    const isOwner = pickup.customerId.toString() === _id.toString();
    const isAdmin = role === "admin" || role === "super_admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }

    const events = await PickupEvent.find({ pickupId: req.params.id })
      .sort({ timestamp: 1 })
      .lean();

    return res.status(200).json({ success: true, data: events });
  } catch (err) {
    console.error("getPickupEvents error:", err);
    return res.status(500).json({ message: "Failed to fetch pickup events", error: err.message });
  }
};

// ── GET /api/pickups/active ───────────────────────────────────────────────

export const getActivePickup = async (req, res) => {
  try {
    const { _id, role } = req.user;
    if (role !== "driver") return res.status(403).json({ message: "Access denied" });

    const activePickup = await PickupRequest.findOne({
      driverId: _id,
      status: { $in: ["ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING"] },
    }).sort({ updatedAt: -1 });

    return res.status(200).json({ pickup: activePickup ? pickupPayload(activePickup) : null });
  } catch (err) {
    console.error("getActivePickup error:", err);
    return res.status(500).json({ message: "Failed to fetch active pickup", error: err.message });
  }
};

// ── GET /api/pickups/pending ───────────────────────────────────────────────

/**
 * Driver fetches all PENDING pickups (for initial load / catch-up).
 * Only returns pickups they are eligible for.
 */
export const getPendingPickups = async (req, res) => {
  try {
    const driverUser = req.user;

    const driverProfile = await Driver.findOne({ userId: driverUser._id });
    if (!driverProfile?.assignedTruckId) {
      return res.status(200).json({ pickups: [] });
    }

    // Block if driver already has an active pickup
    const activePickup = await PickupRequest.findOne({
      driverId: driverUser._id,
      status: { $in: ["ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING"] },
    });
    if (activePickup) {
      return res.status(200).json({ pickups: [], activePickup: pickupPayload(activePickup) });
    }

    const pendingPickups = await PickupRequest.find({
      status: "PENDING",
      expiresAt: { $gt: new Date() },
      $or: [{ orgId: driverUser.orgId }, { orgId: null }],
    }).sort({ createdAt: -1 });

    // Filter: only show if driver is explicitly matched, or if broadcast (empty matchedDriverIds)
    const eligiblePickups = pendingPickups.filter((p) => {
      if (p.matchedDriverIds && p.matchedDriverIds.length > 0) {
        return p.matchedDriverIds.some((id) => id.toString() === driverUser._id.toString());
      }
      return true;
    });

    return res.status(200).json({ pickups: eligiblePickups.slice(0, 20).map(pickupPayload) });
  } catch (err) {
    console.error("getPendingPickups error:", err);
    return res.status(500).json({ message: "Failed to fetch pickups", error: err.message });
  }
};

// ── POST /api/pickups/:id/accept ───────────────────────────────────────────

/**
 * Driver accepts a pickup request.
 * ATOMIC: uses findOneAndUpdate with status:"PENDING" filter so only one
 * driver can ever succeed. Full audit trail recorded.
 */
export const acceptPickup = async (req, res) => {
  try {
    const driverUser = req.user;

    const driverProfile = await Driver.findOne({ userId: driverUser._id }).populate(
      "assignedTruckId",
      "licensePlate capacity truckType"
    );
    if (!driverProfile) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    // Block if driver already has an active pickup
    const activePickup = await PickupRequest.findOne({
      driverId: driverUser._id,
      status: { $in: ["ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING"] },
    });
    if (activePickup) {
      return res.status(400).json({ message: "You already have an active pickup. Complete it before accepting a new one." });
    }

    const now = new Date();
    const driverInfo = {
      name: driverUser.name,
      phone: driverUser.phone || null,
      vehicleId: driverProfile.assignedTruckId?._id?.toString() || null,
      licensePlate: driverProfile.assignedTruckId?.licensePlate || null,
    };

    // Atomic update — only succeeds if status is still PENDING
    const updated = await PickupRequest.findOneAndUpdate(
      { _id: req.params.id, status: "PENDING" },
      {
        $set: {
          status: "ASSIGNED",
          driverId: driverUser._id,
          driverInfo,
          assignedAt: now,
        },
        $push: {
          statusHistory: {
            from: "PENDING",
            to: "ASSIGNED",
            at: now,
            by: { userId: driverUser._id, role: "driver", name: driverUser.name },
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      const exists = await PickupRequest.findById(req.params.id);
      if (!exists) return res.status(404).json({ message: "Pickup request not found" });

      // Log the failed attempt for audit
      logEvent(req.params.id, "REJECTED", driverUser, exists.status, exists.status, {
        reason: "Already accepted by another driver",
        existingDriverId: exists.driverId,
      });

      return res.status(409).json({ message: "This request has already been accepted by another driver" });
    }

    // Calculate response time (time from creation to acceptance)
    const responseTimeMs = now.getTime() - new Date(updated.createdAt).getTime();
    updated.responseTimeMs = responseTimeMs;
    await updated.save();

    // Audit: ACCEPTED event
    logEvent(updated._id, "ACCEPTED", driverUser, "PENDING", "ASSIGNED", {
      driverInfo,
      responseTimeMs,
      truckCapacity: driverProfile.assignedTruckId?.capacity,
      truckType: driverProfile.assignedTruckId?.truckType,
    });

    const payload = pickupPayload(updated);

    emitSafe((io) => {
      io.to(`customer:${updated.customerId}`).emit("pickup:accepted", {
        ...payload,
        driverName: driverInfo.name,
      });
      io.to("drivers").emit("pickup:accepted", { id: updated._id, status: "ASSIGNED", driverId: driverUser._id });
    });

    return res.status(200).json({ message: "Pickup request accepted", pickup: payload });
  } catch (err) {
    console.error("acceptPickup error:", err);
    return res.status(500).json({ message: "Failed to accept pickup", error: err.message });
  }
};

// ── POST /api/pickups/:id/cancel ───────────────────────────────────────────

export const cancelPickup = async (req, res) => {
  try {
    const { _id, role, name } = req.user;
    const { reason } = req.body;

    // Atomic: only cancel if in a cancellable state
    const now = new Date();
    const updated = await PickupRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: ["PENDING", "ASSIGNED"] },
        $or: [
          { customerId: _id },                                      // owner
          ...(role === "admin" || role === "super_admin" ? [{}] : []), // admin override
        ],
      },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: now,
          cancelledBy: { userId: _id, role, name },
          cancelReason: reason || null,
        },
        $push: {
          statusHistory: {
            from: null, // will be set by pre-check
            to: "CANCELLED",
            at: now,
            by: { userId: _id, role, name },
            note: reason || null,
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      const exists = await PickupRequest.findById(req.params.id);
      if (!exists) return res.status(404).json({ message: "Pickup request not found" });

      const isOwner = exists.customerId.toString() === _id.toString();
      const isAdmin = role === "admin" || role === "super_admin";
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      return res.status(400).json({ message: `Cannot cancel a request with status: ${exists.status}` });
    }

    // Fix the from status in the history entry we just pushed
    const lastEntry = updated.statusHistory[updated.statusHistory.length - 1];
    if (lastEntry && !lastEntry.from) {
      // Determine the previous status from the second-to-last entry
      const prevEntry = updated.statusHistory[updated.statusHistory.length - 2];
      lastEntry.from = prevEntry?.to || "PENDING";
      await updated.save();
    }

    logEvent(updated._id, "CANCELLED", req.user, lastEntry?.from || "PENDING", "CANCELLED", {
      reason: reason || null,
      cancelledBy: { userId: _id, role, name },
      hadDriver: !!updated.driverId,
    });

    const payload = pickupPayload(updated);

    emitSafe((io) => {
      io.to(`customer:${updated.customerId}`).emit("pickup:statusUpdate", {
        id: updated._id,
        status: "CANCELLED",
      });
      io.to("drivers").emit("pickup:cancelled", { id: updated._id });
      if (updated.driverId) {
        io.to(`driver:${updated.driverId}`).emit("pickup:cancelled", { id: updated._id });
      }
    });

    return res.status(200).json({ message: "Pickup request cancelled", pickup: payload });
  } catch (err) {
    console.error("cancelPickup error:", err);
    return res.status(500).json({ message: "Failed to cancel pickup", error: err.message });
  }
};

// ── POST /api/pickups/:id/status ──────────────────────────────────────────

/**
 * Driver updates the pickup status through the task flow.
 * Valid transitions: ASSIGNED → EN_ROUTE → ARRIVED → COLLECTING → COMPLETED
 * Each transition is atomic and fully audited.
 */
const STATUS_TRANSITIONS = {
  ASSIGNED: "EN_ROUTE",
  EN_ROUTE: "ARRIVED",
  ARRIVED: "COLLECTING",
  COLLECTING: "COMPLETED",
};

const TIMESTAMP_FIELDS = {
  EN_ROUTE: "enRouteAt",
  ARRIVED: "arrivedAt",
  COLLECTING: "collectingAt",
  COMPLETED: "completedAt",
};

export const updatePickupStatus = async (req, res) => {
  try {
    const driverUser = req.user;
    const { status: newStatus } = req.body;

    if (!newStatus) {
      return res.status(400).json({ message: "status is required" });
    }

    // Validate that newStatus is a valid target
    const validTargets = Object.values(STATUS_TRANSITIONS);
    if (!validTargets.includes(newStatus)) {
      return res.status(400).json({ message: `Invalid status: ${newStatus}` });
    }

    // Find the expected previous status for this target
    const expectedPrev = Object.entries(STATUS_TRANSITIONS).find(([, v]) => v === newStatus)?.[0];
    if (!expectedPrev) {
      return res.status(400).json({ message: `No valid transition to ${newStatus}` });
    }

    const now = new Date();
    const updateFields = {
      status: newStatus,
      [TIMESTAMP_FIELDS[newStatus]]: now,
    };

    // On completion, calculate task duration
    if (newStatus === "COMPLETED") {
      // taskDurationMs will be set after the update
    }

    // Atomic update — only succeeds if current status matches expected previous
    const updated = await PickupRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        driverId: driverUser._id,
        status: expectedPrev,
      },
      {
        $set: updateFields,
        $push: {
          statusHistory: {
            from: expectedPrev,
            to: newStatus,
            at: now,
            by: { userId: driverUser._id, role: "driver", name: driverUser.name },
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      const exists = await PickupRequest.findById(req.params.id);
      if (!exists) return res.status(404).json({ message: "Pickup request not found" });

      if (!exists.driverId || exists.driverId.toString() !== driverUser._id.toString()) {
        return res.status(403).json({ message: "Only the assigned driver can update status" });
      }

      const expected = STATUS_TRANSITIONS[exists.status];
      return res.status(400).json({
        message: `Invalid transition: ${exists.status} → ${newStatus}. Expected: ${expected || "none"}`,
      });
    }

    // Calculate task duration on completion
    if (newStatus === "COMPLETED" && updated.assignedAt) {
      updated.taskDurationMs = now.getTime() - new Date(updated.assignedAt).getTime();
      await updated.save();
    }

    // Audit event
    logEvent(updated._id, newStatus, driverUser, expectedPrev, newStatus, {
      ...(newStatus === "COMPLETED" && {
        taskDurationMs: updated.taskDurationMs,
        responseTimeMs: updated.responseTimeMs,
      }),
    });

    const payload = pickupPayload(updated);

    emitSafe((io) => {
      io.to(`customer:${updated.customerId}`).emit("pickup:statusUpdate", {
        id: updated._id,
        status: newStatus,
        driverInfo: updated.driverInfo,
        ...(newStatus === "COMPLETED" && { completedAt: updated.completedAt }),
      });
      io.to(`driver:${updated.driverId}`).emit("pickup:statusUpdate", {
        id: updated._id,
        pickupId: updated._id,
        status: newStatus,
        driverInfo: updated.driverInfo,
      });
    });

    return res.status(200).json({ message: `Status updated to ${newStatus}`, pickup: payload });
  } catch (err) {
    console.error("updatePickupStatus error:", err);
    return res.status(500).json({ message: "Failed to update status", error: err.message });
  }
};

// ── GET /api/pickups/analytics ────────────────────────────────────────────

/**
 * Comprehensive pickup analytics endpoint.
 * Returns real aggregated data for dashboard charts.
 * Scoped by org for admin, global for super_admin.
 */
export const getPickupAnalytics = async (req, res) => {
  try {
    const { role, orgId } = req.user;
    const orgMatch = role === "admin" && orgId ? { orgId: new mongoose.Types.ObjectId(orgId) } : {};

    // 1. Status distribution (doughnut chart)
    const statusDist = await PickupRequest.aggregate([
      { $match: orgMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // 2. Daily pickup trend (last 30 days — line chart)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyTrend = await PickupRequest.aggregate([
      { $match: { ...orgMatch, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    // Reshape daily trend into { date, created, completed, cancelled }
    const trendMap = {};
    for (const row of dailyTrend) {
      const d = row._id.date;
      if (!trendMap[d]) trendMap[d] = { date: d, created: 0, completed: 0, cancelled: 0, expired: 0 };
      if (row._id.status === "COMPLETED") trendMap[d].completed = row.count;
      else if (row._id.status === "CANCELLED") trendMap[d].cancelled = row.count;
      else if (row._id.status === "EXPIRED") trendMap[d].expired = row.count;
      trendMap[d].created += row.count;
    }
    const pickupTrend = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

    // 3. Category distribution (pie chart)
    const categoryDist = await PickupRequest.aggregate([
      { $match: orgMatch },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    // 4. Level distribution (bar chart)
    const levelDist = await PickupRequest.aggregate([
      { $match: orgMatch },
      { $group: { _id: "$level", count: { $sum: 1 } } },
    ]);

    // 5. Top 10 drivers by completed pickups (bar chart)
    const topDrivers = await PickupRequest.aggregate([
      { $match: { ...orgMatch, status: "COMPLETED", driverId: { $ne: null } } },
      {
        $group: {
          _id: "$driverId",
          completed: { $sum: 1 },
          avgResponseMs: { $avg: "$responseTimeMs" },
          avgTaskDurationMs: { $avg: "$taskDurationMs" },
          categories: { $push: "$category" },
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
          driverName: "$driver.name",
          driverEmail: "$driver.email",
          completed: 1,
          avgResponseMs: { $round: ["$avgResponseMs", 0] },
          avgTaskDurationMs: { $round: ["$avgTaskDurationMs", 0] },
          recyclable: {
            $size: { $filter: { input: "$categories", cond: { $eq: ["$$this", "recyclable"] } } },
          },
          nonRecyclable: {
            $size: { $filter: { input: "$categories", cond: { $eq: ["$$this", "non-recyclable"] } } },
          },
          mixed: {
            $size: { $filter: { input: "$categories", cond: { $eq: ["$$this", "both"] } } },
          },
        },
      },
    ]);

    // 6. Hourly distribution (when do pickups happen — bar chart)
    const hourlyDist = await PickupRequest.aggregate([
      { $match: orgMatch },
      { $group: { _id: { $hour: "$createdAt" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // 7. Average response time trend (last 30 days)
    const responseTimeTrend = await PickupRequest.aggregate([
      {
        $match: {
          ...orgMatch,
          status: "COMPLETED",
          assignedAt: { $gte: thirtyDaysAgo },
          responseTimeMs: { $ne: null },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$assignedAt" } },
          avgResponseMs: { $avg: "$responseTimeMs" },
          avgTaskDurationMs: { $avg: "$taskDurationMs" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 8. Summary stats
    const total = statusDist.reduce((sum, s) => sum + s.count, 0);
    const completed = statusDist.find((s) => s._id === "COMPLETED")?.count || 0;
    const cancelled = statusDist.find((s) => s._id === "CANCELLED")?.count || 0;
    const expired = statusDist.find((s) => s._id === "EXPIRED")?.count || 0;
    const active = statusDist
      .filter((s) => ["PENDING", "ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING"].includes(s._id))
      .reduce((sum, s) => sum + s.count, 0);

    // 9. Completion rate
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // 10. District breakdown
    const districtBreakdown = await PickupRequest.aggregate([
      { $match: { ...orgMatch, district: { $ne: null } } },
      {
        $group: {
          _id: "$district",
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 15 },
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: { total, completed, cancelled, expired, active, completionRate },
        statusDistribution: statusDist.map((s) => ({ status: s._id, count: s.count })),
        categoryDistribution: categoryDist.map((c) => ({ category: c._id, count: c.count })),
        levelDistribution: levelDist.map((l) => ({ level: l._id, count: l.count })),
        pickupTrend,
        topDrivers,
        hourlyDistribution: hourlyDist.map((h) => ({ hour: h._id, count: h.count })),
        responseTimeTrend: responseTimeTrend.map((r) => ({
          date: r._id,
          avgResponseMs: Math.round(r.avgResponseMs),
          avgTaskDurationMs: Math.round(r.avgTaskDurationMs || 0),
          count: r.count,
        })),
        districtBreakdown: districtBreakdown.map((d) => ({
          district: d._id,
          total: d.total,
          completed: d.completed,
        })),
      },
    });
  } catch (err) {
    console.error("getPickupAnalytics error:", err);
    return res.status(500).json({ message: "Failed to fetch pickup analytics", error: err.message });
  }
};

// ── GET /api/pickups/all (admin) ──────────────────────────────────────────

/**
 * Admin endpoint to list all pickups with filters and pagination.
 */
export const getAllPickups = async (req, res) => {
  try {
    const { role, orgId } = req.user;
    const { status, category, level, page = 1, limit = 30 } = req.query;

    const filter = {};
    if (role === "admin" && orgId) filter.orgId = orgId;
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (level) filter.level = level;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [pickups, total] = await Promise.all([
      PickupRequest.find(filter)
        .populate("customerId", "name email phone")
        .populate("driverId", "name email phone")
        .populate("orgId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PickupRequest.countDocuments(filter),
    ]);

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
      orgId: p.orgId?._id || null,
      location: p.location,
      province: p.province,
      district: p.district,
      category: p.category,
      level: p.level,
      status: p.status,
      createdAt: p.createdAt,
      assignedAt: p.assignedAt,
      enRouteAt: p.enRouteAt,
      arrivedAt: p.arrivedAt,
      collectingAt: p.collectingAt,
      completedAt: p.completedAt,
      cancelledAt: p.cancelledAt,
      cancelledBy: p.cancelledBy,
      responseTimeMs: p.responseTimeMs,
      taskDurationMs: p.taskDurationMs,
      updatedAt: p.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        pickups: formatted,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    console.error("getAllPickups error:", err);
    return res.status(500).json({ message: "Failed to fetch pickups", error: err.message });
  }
};
