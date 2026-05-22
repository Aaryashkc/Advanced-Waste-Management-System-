import mongoose from "mongoose";
import PickupRequest from "../models/PickupRequest.model.js";
import PickupEvent from "../models/PickupEvent.model.js";
import Driver from "../models/Driver.model.js";
import { driverOrgRoom, getIO } from "../socket/socketServer.js";
import { findBestDrivers } from "../services/driverMatcher.js";
import { getRoute } from "../services/openRouteService.js";
import { calculatePrice } from "../services/pricingEngine.js";
import { invalidateDashboardCache } from "../services/dashboardCache.js";
import { refreshPickupDailySummaryForDate } from "../services/pickupAnalytics.js";
import Area from "../models/Area.model.js";
import Organization from "../models/Organization.model.js";
import { expireStalePendingPickups } from "../services/pickupExpiry.js";
import { sendError } from "../utils/apiResponse.js";
import { adminCanAccessPickup, sameId } from "../utils/accessControl.js";
import { BadRequestError, NotFoundError } from "../utils/httpErrors.js";
import { requireCoordinates } from "../utils/requestValidation.js";

// -- helpers ----------------------------------------------------------------

function pickupPayload(doc) {
  return {
    id: doc._id,
    customerId: doc.customerId,
    wasteUploadId: doc.wasteUploadId,
    location: doc.location,
    province: doc.province,
    area: doc.area,
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
    estimatedPrice: doc.estimatedPrice,
    currency: doc.currency,
    priceBreakdown: doc.priceBreakdown,
    routeDistanceKm: doc.routeDistanceKm,
    routeDurationMinutes: doc.routeDurationMinutes,
    depotLocation: doc.depotLocation,
    paymentMethod: doc.paymentMethod,
    paymentStatus: doc.paymentStatus,
    paymentId: doc.paymentId,
    responseTimeMs: doc.responseTimeMs,
    taskDurationMs: doc.taskDurationMs,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function driverIsAssignedToPickup(pickup, driverUser) {
  return sameId(pickup.driverId, driverUser._id);
}

function driverIsMatchedToPickup(pickup, driverUser) {
  return (pickup.matchedDriverIds || []).some((id) => sameId(id, driverUser._id));
}

const MIN_CAPACITY_BY_LEVEL = {
  easy: 0,
  medium: 1000,
  hard: 3500,
};

const MIN_DUTY_RANK_BY_LEVEL = {
  easy: 1,
  medium: 2,
  hard: 3,
};

const DUTY_RANK = {
  "light duty": 1,
  "medium duty": 2,
  "heavy duty": 3,
};

function driverPickupAvailabilityFilter(driverUserId) {
  return {
    driverId: driverUserId,
    status: { $in: ["ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING"] },
  };
}

async function setDriverAvailable(driverUserId, isAvailable) {
  if (!driverUserId) return;
  await Driver.updateOne(
    { userId: driverUserId },
    { $set: { isAvailable, updatedAt: new Date() } }
  );
}

async function releaseDriverIfNoActivePickup(driverUserId) {
  if (!driverUserId) return false;
  const activePickup = await PickupRequest.findOne(driverPickupAvailabilityFilter(driverUserId))
    .select("_id")
    .lean();
  if (activePickup) return false;

  await setDriverAvailable(driverUserId, true);
  return true;
}

function getPickupDriverAccessFilter(driverUser, pickup) {
  const matchedDriverIds = pickup.matchedDriverIds || [];
  if (matchedDriverIds.length > 0) {
    return { matchedDriverIds: driverUser._id };
  }

  return pickup.orgId == null
    ? { matchedDriverIds: { $size: 0 }, orgId: null }
    : { matchedDriverIds: { $size: 0 }, orgId: pickup.orgId };
}

function checkDriverPickupEligibility(pickup, driverUser, driverProfile) {
  if (!driverProfile) return { ok: false, message: "Driver profile not found", status: 404 };
  if (!driverProfile.isAvailable) return { ok: false, message: "Driver is not available", status: 403 };

  const truck = driverProfile.assignedTruckId;
  if (!truck) return { ok: false, message: "Driver must have an assigned truck to accept pickups", status: 403 };
  if (!truck.isAvailable) return { ok: false, message: "Assigned truck is not available", status: 403 };

  if (pickup.orgId && !sameId(truck.orgId, pickup.orgId)) {
    return { ok: false, message: "Assigned truck is not eligible for this pickup organization", status: 403 };
  }

  if (!pickupMatchesPendingDriverVisibility(pickup, driverUser)) {
    return { ok: false, message: "This pickup is not available to you", status: 403 };
  }

  const minCapacity = MIN_CAPACITY_BY_LEVEL[pickup.level] ?? 0;
  if ((truck.capacity || 0) < minCapacity) {
    return { ok: false, message: "Assigned truck does not meet this pickup's capacity requirement", status: 403 };
  }

  const minDutyRank = MIN_DUTY_RANK_BY_LEVEL[pickup.level] ?? 1;
  const dutyRank = DUTY_RANK[truck.dutyType] || 0;
  if (dutyRank < minDutyRank) {
    return { ok: false, message: "Assigned truck does not meet this pickup's duty requirement", status: 403 };
  }

  return { ok: true };
}

function pickupMatchesPendingDriverVisibility(pickup, driverUser) {
  const matchedDriverIds = pickup.matchedDriverIds || [];
  const isBroadcast = matchedDriverIds.length === 0;
  const isMatched = driverIsMatchedToPickup(pickup, driverUser);

  const isOpenPendingPickup =
    pickup.status === "PENDING" &&
    ["cash", "esewa"].includes(pickup.paymentMethod) &&
    ["PENDING", "PAID"].includes(pickup.paymentStatus) &&
    pickup.expiresAt &&
    pickup.expiresAt > new Date();

  if (!isOpenPendingPickup) return false;
  if (isMatched) return true;

  return (
    (sameId(pickup.orgId, driverUser.orgId) || pickup.orgId == null) &&
    isBroadcast
  );
}

async function canDriverViewPickup(pickup, driverUser) {
  if (driverIsAssignedToPickup(pickup, driverUser)) return true;

  const driverProfile = await Driver.findOne({ userId: driverUser._id })
    .populate("assignedTruckId", "capacity dutyType isAvailable orgId")
    .select("isAvailable assignedTruckId")
    .lean();
  if (!checkDriverPickupEligibility(pickup, driverUser, driverProfile).ok) return false;

  const activePickup = await PickupRequest.findOne(driverPickupAvailabilityFilter(driverUser._id)).select("_id").lean();
  if (activePickup && !sameId(activePickup._id, pickup._id)) return false;

  return pickupMatchesPendingDriverVisibility(pickup, driverUser);
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

function invalidatePickupAnalytics(date = new Date()) {
  invalidateDashboardCache();
  refreshPickupDailySummaryForDate(date).catch((err) => {
    console.error("[PickupAnalytics] Failed to refresh daily summary:", err.message);
  });
}

export function getPickupDriverRooms(pickup, { includeAssignedDriver = false } = {}) {
  const rooms = new Set();
  const matchedIds = pickup.matchedDriverIds || [];

  if (matchedIds.length > 0) {
    matchedIds.forEach((driverId) => rooms.add(`driver:${driverId}`));
  } else {
    const orgRoom = driverOrgRoom(pickup.orgId);
    if (orgRoom) rooms.add(orgRoom);
  }

  if (includeAssignedDriver && pickup.driverId) {
    rooms.add(`driver:${pickup.driverId}`);
  }

  return [...rooms];
}

function emitToPickupDriverRooms(io, pickup, event, payload, options = {}) {
  getPickupDriverRooms(pickup, options).forEach((room) => {
    io.to(room).emit(event, payload);
  });
}

export function emitPickupToDrivers(pickup, customerName = null) {
  emitSafe((io) => {
    const payload = { ...pickupPayload(pickup), customerName };
    emitToPickupDriverRooms(io, pickup, "pickup:created", payload);
    io.to("admins").emit("pickup:created", payload);
  });
}

/**
 * Resolve an Organization for a pickup location.
 * Tries area name first, then falls back to nearest area by GPS.
 * Returns the org's _id, or null if nothing matches.
 * Used when a customer doesn't have an orgId set on their account
 * (e.g. self-signup), so pickups still get scoped to a region for
 * admin/history/stats filtering.
 */
async function resolveOrgIdForLocation({ latitude, longitude, area }) {
  let areaDoc = null;
  if (area) {
    areaDoc = await Area.findOne({ name: area, isActive: true, orgId: { $ne: null } }).lean();
  }
  if (!areaDoc && latitude != null && longitude != null) {
    const allAreas = await Area.find({
      isActive: true,
      orgId: { $ne: null },
      "coordinates.latitude": { $exists: true, $ne: null },
      "coordinates.longitude": { $exists: true, $ne: null },
    }).lean();
    if (allAreas.length === 0) return null;

    const toRad = (d) => (d * Math.PI) / 180;
    const lat = Number(latitude);
    const lng = Number(longitude);
    let minDist = Infinity;
    for (const a of allAreas) {
      const dLat = toRad(a.coordinates.latitude - lat);
      const dLng = toRad(a.coordinates.longitude - lng);
      const sLat = Math.sin(dLat / 2);
      const sLng = Math.sin(dLng / 2);
      const h = sLat * sLat + Math.cos(toRad(lat)) * Math.cos(toRad(a.coordinates.latitude)) * sLng * sLng;
      const dist = 2 * 6371 * Math.asin(Math.sqrt(h));
      if (dist < minDist) {
        minDist = dist;
        areaDoc = a;
      }
    }
  }
  return areaDoc?.orgId || null;
}

async function findServiceAreaForLocation({ latitude, longitude, area }) {
  let areaDoc = null;

  if (area) {
    areaDoc = await Area.findOne({ name: area, isActive: true });
  }

  if (!areaDoc) {
    const allAreas = await Area.find({
      isActive: true,
      "coordinates.latitude": { $exists: true, $ne: null },
      "coordinates.longitude": { $exists: true, $ne: null },
      orgId: { $ne: null },
    }).lean();

    if (allAreas.length === 0) return null;

    const custLat = Number(latitude);
    const custLng = Number(longitude);
    const toRad = (deg) => (deg * Math.PI) / 180;

    let minDist = Infinity;
    for (const a of allAreas) {
      const dLat = toRad(a.coordinates.latitude - custLat);
      const dLng = toRad(a.coordinates.longitude - custLng);
      const sinLat = Math.sin(dLat / 2);
      const sinLng = Math.sin(dLng / 2);
      const h = sinLat * sinLat + Math.cos(toRad(custLat)) * Math.cos(toRad(a.coordinates.latitude)) * sinLng * sinLng;
      const dist = 2 * 6371 * Math.asin(Math.sqrt(h));
      if (dist < minDist) {
        minDist = dist;
        areaDoc = a;
      }
    }
  }

  return areaDoc;
}

export async function computePickupPricingAndRoute({ latitude, longitude, category, level, area, orgId = null }) {
  const customer = requireCoordinates(latitude, longitude);

  const areaDoc = await findServiceAreaForLocation({
    latitude: customer.latitude,
    longitude: customer.longitude,
    area,
  });
  const effectiveOrgId = orgId || areaDoc?.orgId || null;

  if (!effectiveOrgId) {
    if (!areaDoc) {
      const hasAreas = await Area.exists({
        isActive: true,
        "coordinates.latitude": { $exists: true, $ne: null },
        "coordinates.longitude": { $exists: true, $ne: null },
        orgId: { $ne: null },
      });
      if (!hasAreas) {
        throw new NotFoundError("No service areas with coordinates are configured yet");
      }

      throw new NotFoundError("No service area found near your location");
    }

    throw new BadRequestError(`No organization is assigned to area "${areaDoc.name}" yet`);
  }

  const org = await Organization.findById(effectiveOrgId);
  if (!org) {
    throw new NotFoundError("Organization not found for this area");
  }
  const depot = requireCoordinates(org.location?.latitude, org.location?.longitude, {
    latitudeLabel: "depot latitude",
    longitudeLabel: "depot longitude",
  });

  const route = await getRoute(depot, customer);
  const pricing = await calculatePrice({
    category: category || "non-recyclable",
    level: level || "easy",
    distanceKm: route.distanceKm,
  });

  return {
    org,
    orgId: org._id,
    areaDoc,
    pricing,
    route,
    depotLocation: {
      latitude: depot.latitude,
      longitude: depot.longitude,
      address: org.location.address || null,
    },
  };
}

// -- POST /api/pickups/estimate ---------------------------------------------

/**
 * Returns a price estimate + route BEFORE the customer confirms the pickup.
 * Looks up the area -> org -> depot, calculates road route via ORS, and prices it.
 */
/**
 * Driver: get a live ORS driving route from current location to a pickup destination.
 * Body: { originLat, originLng, destLat, destLng }
 * Returns: { distanceKm, durationMinutes, geometry, fallback }
 */
export const getDriverRoute = async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.body || {};
    const origin = requireCoordinates(originLat, originLng, {
      latitudeLabel: "originLat",
      longitudeLabel: "originLng",
    });

    const destination = requireCoordinates(destLat, destLng, {
      latitudeLabel: "destLat",
      longitudeLabel: "destLng",
    });

    const route = await getRoute(origin, destination);
    return res.json({ success: true, ...route });
  } catch (err) {
    console.error("getDriverRoute error:", err);
    return sendError(res, err, "Failed to compute route");
  }
};

export const estimatePickup = async (req, res) => {
  try {
    const { latitude, longitude, category, level, area } = req.body;

    const coordinates = requireCoordinates(latitude, longitude);

    // 1. Resolve area -> organization
    const { org, areaDoc, route, pricing, depotLocation } = await computePickupPricingAndRoute({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      category,
      level,
      area,
    });

    // 2. Get route from depot -> customer location
    return res.status(200).json({
      success: true,
      estimatedPrice: pricing.estimatedPrice,
      priceBreakdown: pricing.priceBreakdown,
      currency: pricing.currency,
      distanceKm: route.distanceKm,
      durationMinutes: route.durationMinutes,
      routeGeometry: route.geometry,
      fallback: route.fallback || false,
      depotLocation,
      orgId: org._id,
      orgName: org.name,
      areaName: areaDoc?.name || null,
    });
  } catch (err) {
    console.error("estimatePickup error:", err);
    return sendError(res, err, "Failed to estimate pickup");
  }
};

// -- POST /api/pickups ------------------------------------------------------

/**
 * Customer creates a new pickup request.
 * Uses the knapsack driver-matching algorithm to notify only best-fit drivers.
 * Falls back to the pickup organization's driver room if no matches are found.
 */
export const createPickup = async (req, res) => {
  try {
    const {
      latitude, longitude, address, category, level, wasteUploadId, province, area,
    } = req.body;

    // Whitelist payment method - never trust arbitrary client values
    const coordinates = requireCoordinates(latitude, longitude);

    const customer = req.user;

    // Resolve the org for this pickup. Prefer the customer's orgId if set,
    // otherwise derive it from the area / nearest area to the GPS location.
    // This ensures admin-scoped history & stats see the pickup even when the
    // customer self-signed-up without being assigned to an org.
    let resolvedOrgId = customer.orgId || null;
    if (!resolvedOrgId) {
      resolvedOrgId = await resolveOrgIdForLocation({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        area: area || null,
      });
    }

    const quote = await computePickupPricingAndRoute({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      category,
      level,
      area: area || null,
      orgId: resolvedOrgId,
    });
    resolvedOrgId = quote.orgId;

    // Run the driver-matching algorithm (now area-aware)
    const matched = await findBestDrivers({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      category: category || "non-recyclable",
      level: level || "easy",
      orgId: resolvedOrgId,
      area: area || null,
    });

    const matchedUserIds = matched.map((m) => m.userId);

    const pickup = await PickupRequest.create({
      customerId: customer._id,
      orgId: resolvedOrgId,
      wasteUploadId: wasteUploadId || null,
      location: { ...coordinates, address: address || null },
      province: province || null,
      area: area || null,
      category: category || "non-recyclable",
      level: level || "easy",
      matchedDriverIds: matchedUserIds,
      status: "PAYMENT_REQUIRED",
      estimatedPrice: quote.pricing.estimatedPrice,
      currency: quote.pricing.currency,
      priceBreakdown: quote.pricing.priceBreakdown,
      routeDistanceKm: quote.route.distanceKm,
      routeDurationMinutes: quote.route.durationMinutes,
      routeGeometry: quote.route.geometry,
      depotLocation: quote.depotLocation,
      paymentStatus: "UNPAID",
      statusHistory: [
        {
          from: null,
          to: "PAYMENT_REQUIRED",
          at: new Date(),
          by: { userId: customer._id, role: customer.role, name: customer.name },
          note: "Awaiting payment method selection",
        },
      ],
    });
    invalidatePickupAnalytics(pickup.createdAt);

    // Audit: CREATED event
    logEvent(pickup._id, "CREATED", customer, null, "PAYMENT_REQUIRED", {
      location: pickup.location,
      category: pickup.category,
      level: pickup.level,
      province: pickup.province,
      area: pickup.area,
      paymentRequired: true,
    });

    // Audit: MATCHED or BROADCAST event
    if (matched.length > 0) {
      logEvent(pickup._id, "MATCHED", { role: "system", name: "DriverMatcher" }, "PAYMENT_REQUIRED", "PAYMENT_REQUIRED", {
        matchedCount: matched.length,
        matchedDriverIds: matchedUserIds,
        scores: matched.map((m) => ({ userId: m.userId, score: m.score })),
      });
    } else {
      logEvent(pickup._id, "BROADCAST", { role: "system", name: "DriverMatcher" }, "PAYMENT_REQUIRED", "PAYMENT_REQUIRED", {
        reason: resolvedOrgId
          ? "No matching drivers found - broadcast to pickup organization drivers"
          : "No matching drivers found and no organization scope was available",
        orgId: resolvedOrgId,
      });
    }

    return res.status(201).json({
      message: "Pickup draft created. Choose a payment method to request a driver.",
      pickup: pickupPayload(pickup),
    });
  } catch (err) {
    console.error("createPickup error:", err);
    return sendError(res, err, "Failed to create pickup request");
  }
};

// -- GET /api/pickups/:id ---------------------------------------------------

export const getPickup = async (req, res) => {
  try {
    const pickup = await PickupRequest.findById(req.params.id);
    if (!pickup) return res.status(404).json({ message: "Pickup request not found" });

    const { role, _id } = req.user;
    const isOwner = pickup.customerId.toString() === _id.toString();
    const isAdmin = adminCanAccessPickup(pickup, req.user);
    const isDriver = role === "driver";
    const driverCanView = isDriver ? await canDriverViewPickup(pickup, req.user) : false;

    if (!isOwner && !driverCanView && !isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.status(200).json({ pickup: pickupPayload(pickup) });
  } catch (err) {
    console.error("getPickup error:", err);
    return res.status(500).json({ message: "Failed to fetch pickup", error: err.message });
  }
};

// -- GET /api/pickups/:id/events -----------------------------------------

/**
 * Returns the full audit trail for a single pickup.
 * Admins and the pickup owner can view.
 */
export const getPickupEvents = async (req, res) => {
  try {
    const pickup = await PickupRequest.findById(req.params.id).select("customerId orgId").lean();
    if (!pickup) return res.status(404).json({ message: "Pickup request not found" });

    const { _id } = req.user;
    const isOwner = pickup.customerId.toString() === _id.toString();
    const isAdmin = adminCanAccessPickup(pickup, req.user);
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

// -- GET /api/pickups/active -----------------------------------------------

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

// -- GET /api/pickups/my-pickups -------------------------------------------

/**
 * Customer fetches their own pickups + aggregated stats for dashboard charts.
 */
export const getMyPickups = async (req, res) => {
  try {
    const { _id, role } = req.user;
    if (role !== "customer_admin") return res.status(403).json({ message: "Access denied" });

    await expireStalePendingPickups({ customerId: _id });

    const pickups = await PickupRequest.find({ customerId: _id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Status counts
    const statusCounts = {};
    const categoryCounts = {};
    const levelCounts = {};
    const monthlyData = {};
    let totalSpent = 0;

    pickups.forEach((p) => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
      levelCounts[p.level] = (levelCounts[p.level] || 0) + 1;
      if (p.estimatedPrice && p.status === "COMPLETED" && p.paymentStatus === "PAID") totalSpent += p.estimatedPrice;

      // Monthly aggregation (last 6 months)
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyData[key]) monthlyData[key] = { month: key, created: 0, completed: 0, cancelled: 0 };
      monthlyData[key].created += 1;
      if (p.status === "COMPLETED") monthlyData[key].completed += 1;
      if (p.status === "CANCELLED") monthlyData[key].cancelled += 1;
    });

    // Sort monthly data and take last 6
    const monthly = Object.values(monthlyData)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    return res.status(200).json({
      pickups: pickups.slice(0, 20).map(pickupPayload),
      stats: {
        total: pickups.length,
        statusCounts,
        categoryCounts,
        levelCounts,
        totalSpent,
        monthly,
      },
    });
  } catch (err) {
    console.error("getMyPickups error:", err);
    return res.status(500).json({ message: "Failed to fetch pickups", error: err.message });
  }
};

// -- GET /api/pickups/my-history --------------------------------------------

/**
 * Driver fetches their own pickup history (accepted, completed, cancelled).
 */
export const getMyPickupHistory = async (req, res) => {
  try {
    const { _id, role } = req.user;
    if (role !== "driver") return res.status(403).json({ message: "Access denied" });

    const pickups = await PickupRequest.find({
      driverId: _id,
    })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      pickups: pickups.map((doc) => pickupPayload(doc)),
    });
  } catch (err) {
    console.error("getMyPickupHistory error:", err);
    return res.status(500).json({ message: "Failed to fetch pickup history", error: err.message });
  }
};

// -- GET /api/pickups/pending -----------------------------------------------

/**
 * Driver fetches all PENDING pickups (for initial load / catch-up).
 * Only returns pickups they are eligible for.
 */
export const getPendingPickups = async (req, res) => {
  try {
    const driverUser = req.user;

    const driverProfile = await Driver.findOne({ userId: driverUser._id }).populate(
      "assignedTruckId",
      "capacity dutyType isAvailable orgId"
    );
    if (!driverProfile?.assignedTruckId) {
      return res.status(200).json({ pickups: [] });
    }

    // Block if driver already has an active pickup
    const activePickup = await PickupRequest.findOne(driverPickupAvailabilityFilter(driverUser._id));
    if (activePickup) {
      return res.status(200).json({ pickups: [], activePickup: pickupPayload(activePickup) });
    }

    const pendingPickups = await PickupRequest.find({
      status: "PENDING",
      paymentMethod: { $in: ["cash", "esewa"] },
      paymentStatus: { $in: ["PENDING", "PAID"] },
      expiresAt: { $gt: new Date() },
      $or: [
        { matchedDriverIds: driverUser._id },
        { orgId: driverUser.orgId },
        { orgId: null },
      ],
    }).sort({ createdAt: -1 });

    const eligiblePickups = pendingPickups.filter((p) =>
      checkDriverPickupEligibility(p, driverUser, driverProfile).ok
    );

    return res.status(200).json({ pickups: eligiblePickups.slice(0, 20).map(pickupPayload) });
  } catch (err) {
    console.error("getPendingPickups error:", err);
    return res.status(500).json({ message: "Failed to fetch pickups", error: err.message });
  }
};

// -- POST /api/pickups/:id/accept -------------------------------------------

/**
 * Driver accepts a pickup request.
 * ATOMIC: uses findOneAndUpdate with status:"PENDING" filter so only one
 * driver can ever succeed. Full audit trail recorded.
 */
export const acceptPickup = async (req, res) => {
  let reservedDriverUserId = null;
  try {
    const driverUser = req.user;

    const driverProfile = await Driver.findOne({ userId: driverUser._id }).populate(
      "assignedTruckId",
      "licensePlate capacity truckType dutyType isAvailable orgId"
    );

    // Block if driver already has an active pickup
    const activePickup = await PickupRequest.findOne(driverPickupAvailabilityFilter(driverUser._id));
    if (activePickup) {
      return res.status(400).json({ message: "You already have an active pickup. Complete it before accepting a new one." });
    }

    const requestedPickup = await PickupRequest.findById(req.params.id);
    if (!requestedPickup) {
      return res.status(404).json({ message: "Pickup request not found" });
    }
    const eligibility = checkDriverPickupEligibility(requestedPickup, driverUser, driverProfile);
    if (!eligibility.ok) {
      return res.status(eligibility.status).json({ message: eligibility.message });
    }

    const reservedDriver = await Driver.findOneAndUpdate(
      { _id: driverProfile._id, isAvailable: true },
      { $set: { isAvailable: false, updatedAt: new Date() } },
      { new: true }
    );
    if (!reservedDriver) {
      return res.status(409).json({ message: "Driver is no longer available" });
    }
    reservedDriverUserId = driverUser._id;

    const now = new Date();
    const driverInfo = {
      name: driverUser.name,
      phone: driverUser.phone || null,
      vehicleId: driverProfile.assignedTruckId?._id?.toString() || null,
      licensePlate: driverProfile.assignedTruckId?.licensePlate || null,
    };

    // Atomic update - only succeeds if status is still PENDING
    const updated = await PickupRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "PENDING",
        paymentMethod: { $in: ["cash", "esewa"] },
        paymentStatus: { $in: ["PENDING", "PAID"] },
        expiresAt: { $gt: now },
        ...getPickupDriverAccessFilter(driverUser, requestedPickup),
      },
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
      await releaseDriverIfNoActivePickup(driverUser._id);

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
    invalidatePickupAnalytics(updated.createdAt);

    const payload = pickupPayload(updated);

    emitSafe((io) => {
      io.to(`customer:${updated.customerId}`).emit("pickup:accepted", {
        ...payload,
        driverName: driverInfo.name,
      });
      emitToPickupDriverRooms(
        io,
        updated,
        "pickup:accepted",
        { id: updated._id, status: "ASSIGNED", driverId: driverUser._id },
        { includeAssignedDriver: true }
      );
      io.to("admins").emit("pickup:accepted", { id: updated._id, status: "ASSIGNED", driverId: driverUser._id });
    });

    return res.status(200).json({ message: "Pickup request accepted", pickup: payload });
  } catch (err) {
    if (reservedDriverUserId) {
      await releaseDriverIfNoActivePickup(reservedDriverUserId);
    }
    console.error("acceptPickup error:", err);
    return res.status(500).json({ message: "Failed to accept pickup", error: err.message });
  }
};

// -- POST /api/pickups/:id/cancel -------------------------------------------

export const cancelPickup = async (req, res) => {
  try {
    const { _id, role, name, orgId } = req.user;
    const { reason } = req.body || {};
    const adminAccessClauses = [
      ...(role === "super_admin" ? [{}] : []),
      ...(role === "admin" && orgId ? [{ orgId }] : []),
    ];

    const accessFilter = {
      _id: req.params.id,
      $or: [
        { customerId: _id },                                      // owner
        ...adminAccessClauses,                                    // scoped admin override
      ],
    };

    const cancellablePickup = await PickupRequest.findOne({
      ...accessFilter,
      status: { $in: ["PAYMENT_REQUIRED", "PENDING", "ASSIGNED"] },
    }).select("status").lean();

    if (!cancellablePickup) {
      const exists = await PickupRequest.findById(req.params.id);
      if (!exists) return res.status(404).json({ message: "Pickup request not found" });

      const isOwner = exists.customerId.toString() === _id.toString();
      const isAdmin = adminCanAccessPickup(exists, req.user);
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      return res.status(400).json({ message: `Cannot cancel a request with status: ${exists.status}` });
    }

    const previousStatus = cancellablePickup.status;

    // Atomic: only cancel if the status is still the one we audited.
    const now = new Date();
    const updated = await PickupRequest.findOneAndUpdate(
      {
        ...accessFilter,
        status: previousStatus,
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
            from: previousStatus,
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
      const isAdmin = adminCanAccessPickup(exists, req.user);
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      return res.status(400).json({ message: `Cannot cancel a request with status: ${exists.status}` });
    }

    if (updated.driverId) {
      await releaseDriverIfNoActivePickup(updated.driverId);
    }
    invalidatePickupAnalytics(updated.createdAt);

    logEvent(updated._id, "CANCELLED", req.user, previousStatus, "CANCELLED", {
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
      emitToPickupDriverRooms(
        io,
        updated,
        "pickup:cancelled",
        { id: updated._id },
        { includeAssignedDriver: true }
      );
      io.to("admins").emit("pickup:cancelled", { id: updated._id, status: "CANCELLED" });
    });

    return res.status(200).json({ message: "Pickup request cancelled", pickup: payload });
  } catch (err) {
    console.error("cancelPickup error:", err);
    return res.status(500).json({ message: "Failed to cancel pickup", error: err.message });
  }
};

// -- POST /api/pickups/:id/status ------------------------------------------

/**
 * Driver updates the pickup status through the task flow.
 * Valid transitions: ASSIGNED -> EN_ROUTE -> ARRIVED -> COLLECTING -> COMPLETED
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

const COMPLETION_PAYMENT_FILTER = {
  $or: [
    { paymentMethod: "cash", paymentStatus: "PAID" },
    { paymentMethod: "esewa", paymentStatus: "PAID" },
  ],
};

function completionPaymentError(pickup) {
  if (!pickup) return null;
  if (pickup.paymentMethod === "cash" && pickup.paymentStatus !== "PAID") {
    return "Confirm cash payment before completing this pickup";
  }
  if (pickup.paymentMethod === "esewa" && pickup.paymentStatus !== "PAID") {
    return "eSewa payment must be paid before completing this pickup";
  }
  if (!["cash", "esewa"].includes(pickup.paymentMethod)) {
    return "Choose a payment method before completing this pickup";
  }
  return null;
}

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

    if (newStatus === "COMPLETED") {
      const pickupBeforeCompletion = await PickupRequest.findOne({
        _id: req.params.id,
        driverId: driverUser._id,
        status: expectedPrev,
      }).select("paymentMethod paymentStatus");

      const paymentError = completionPaymentError(pickupBeforeCompletion);
      if (paymentError) {
        return res.status(400).json({ message: paymentError });
      }
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

    // Atomic update - only succeeds if current status matches expected previous
    const transitionFilter = {
      _id: req.params.id,
      driverId: driverUser._id,
      status: expectedPrev,
      ...(newStatus === "COMPLETED" && COMPLETION_PAYMENT_FILTER),
    };

    const updated = await PickupRequest.findOneAndUpdate(
      transitionFilter,
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

      if (newStatus === "COMPLETED" && exists.status === expectedPrev) {
        const paymentError = completionPaymentError(exists);
        if (paymentError) {
          return res.status(400).json({ message: paymentError });
        }
      }

      const expected = STATUS_TRANSITIONS[exists.status];
      return res.status(400).json({
        message: `Invalid transition: ${exists.status} -> ${newStatus}. Expected: ${expected || "none"}`,
      });
    }

    // Calculate task duration on completion
    if (newStatus === "COMPLETED" && updated.assignedAt) {
      updated.taskDurationMs = now.getTime() - new Date(updated.assignedAt).getTime();
      await updated.save();
    }
    if (newStatus === "COMPLETED") {
      await releaseDriverIfNoActivePickup(driverUser._id);
    }
    invalidatePickupAnalytics(updated.createdAt);

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
      io.to("admins").emit("pickup:statusUpdate", {
        id: updated._id,
        pickupId: updated._id,
        status: newStatus,
        orgId: updated.orgId,
        ...(newStatus === "COMPLETED" && { completedAt: updated.completedAt }),
      });
    });

    return res.status(200).json({ message: `Status updated to ${newStatus}`, pickup: payload });
  } catch (err) {
    console.error("updatePickupStatus error:", err);
    return res.status(500).json({ message: "Failed to update status", error: err.message });
  }
};

// -- GET /api/pickups/analytics --------------------------------------------

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

    // 2. Daily pickup trend (last 30 days - line chart)
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

    // 6. Hourly distribution (when do pickups happen - bar chart)
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

    // 10. Area breakdown (within an org) - used by admin view
    const areaBreakdown = await PickupRequest.aggregate([
      { $match: { ...orgMatch, area: { $ne: null } } },
      {
        $group: {
          _id: "$area",
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 15 },
    ]);

    // 11. Organization breakdown (cross-org) - used by super_admin view
    const orgBreakdown = role === "super_admin"
      ? await PickupRequest.aggregate([
          { $match: { orgId: { $ne: null } } },
          {
            $group: {
              _id: "$orgId",
              total: { $sum: 1 },
              completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
            },
          },
          { $sort: { total: -1 } },
          { $limit: 15 },
          {
            $lookup: {
              from: "organizations",
              localField: "_id",
              foreignField: "_id",
              as: "org",
              pipeline: [{ $project: { name: 1 } }],
            },
          },
          { $unwind: { path: "$org", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              orgId: "$_id",
              orgName: "$org.name",
              total: 1,
              completed: 1,
              _id: 0,
            },
          },
        ])
      : [];

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
        areaBreakdown: areaBreakdown.map((d) => ({
          area: d._id,
          total: d.total,
          completed: d.completed,
        })),
        orgBreakdown,
      },
    });
  } catch (err) {
    console.error("getPickupAnalytics error:", err);
    return res.status(500).json({ message: "Failed to fetch pickup analytics", error: err.message });
  }
};

// -- GET /api/pickups/all (admin) ------------------------------------------

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
      area: p.area,
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
