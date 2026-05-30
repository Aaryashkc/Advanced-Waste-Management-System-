import Organization from "../models/Organization.model.js";
import User from "../models/User.model.js";
import Task from "../models/Task.model.js";
import Truck from "../models/Truck.model.js";
import Driver from "../models/Driver.model.js";
import PickupRequest from "../models/PickupRequest.model.js";
import { buildPickupAnalytics, buildScheduleAnalytics } from "../services/pickupAnalytics.js";
import { cacheDashboardResponse } from "../services/dashboardCache.js";
import DeletionRequest from "../models/DeletionRequest.model.js";
import { getIO } from "../socket/socketServer.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { buildPaginationMeta, getPagination } from "../utils/pagination.js";

export const createOrganization = async (req, res) => {
  try {
    const { name, location } = req.body;

    if (!name || !location || !location.address) {
      return res.status(400).json({ message: "Organization name and location are required" });
    }

    const organization = new Organization({
      name,
      location
    });

    await organization.save();

    res.status(201).json({
      message: "Organization created successfully",
      organization
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create organization", error: error.message });
  }
};

export const getAllOrganizations = async (req, res) => {
  try {
    const pagination = getPagination(req.query, { defaultLimit: 10 });
    const organizations = await Organization.find()
      .select("name location admins createdAt updatedAt")
      .populate("admins", "name email")
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();
    const total = await Organization.countDocuments();

    // Get real fleet + driver data from source-of-truth collections
    const orgsWithFleet = await Promise.all(
      organizations.map(async (org) => {
        const trucks = await Truck.find({ orgId: org._id })
          .select("truckType capacity licensePlate")
          .sort({ createdAt: -1 })
          .limit(100)
          .lean();
        const driverCount = await User.countDocuments({ orgId: org._id, role: "driver" });
        const orgObj = org;
        orgObj.fleet = trucks;
        orgObj.driverCount = driverCount;
        return orgObj;
      })
    );

    res.status(200).json({
      message: "Organizations retrieved successfully",
      organizations: orgsWithFleet,
      pagination: buildPaginationMeta({ ...pagination, total }),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve organizations", error: error.message });
  }
};

/**
 * Get a single organization with full details:
 * admins, trucks (with assigned drivers), drivers, areas
 * GET /api/super-admin/organizations/:orgId
 */
export const getOrganizationById = async (req, res) => {
  try {
    const { orgId } = req.params;

    const org = await Organization.findById(orgId)
      .populate("admins", "name email phone isActive createdAt");

    if (!org) return res.status(404).json({ message: "Organization not found" });

    // Get trucks for this org
    const trucks = await Truck.find({ orgId: org._id })
      .select("licensePlate truckType capacity dutyType isAvailable createdAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Get all drivers for this org
    const orgDriverUsers = await User.find({ orgId: org._id, role: "driver" })
      .select("_id name email phone isActive createdAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const driverUserIds = orgDriverUsers.map(u => u._id);
    const drivers = await Driver.find({ userId: { $in: driverUserIds } })
      .populate("assignedTruckId", "licensePlate truckType capacity")
      .lean();

    // Map driver profile to user data
    const driversWithUser = drivers.map(d => {
      const user = orgDriverUsers.find(u => u._id.toString() === d.userId.toString());
      return {
        id: d._id,
        userId: d.userId,
        name: user?.name || "Unknown",
        email: user?.email || "",
        phone: user?.phone || "",
        isAvailable: d.isAvailable,
        assignedTruck: d.assignedTruckId ? {
          id: d.assignedTruckId._id,
          licensePlate: d.assignedTruckId.licensePlate,
          truckType: d.assignedTruckId.truckType,
          capacity: d.assignedTruckId.capacity,
        } : null,
        createdAt: user?.createdAt,
      };
    });

    // Get areas for this org
    const Area = (await import("../models/Area.model.js")).default;
    const areas = await Area.find({ orgId: org._id, isActive: true })
      .select("name type boundary isActive createdAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Build driver map for trucks
    const driverByTruck = {};
    for (const d of driversWithUser) {
      if (d.assignedTruck) {
        driverByTruck[d.assignedTruck.id.toString()] = { name: d.name, id: d.id };
      }
    }

    const trucksFormatted = trucks.map(t => ({
      id: t._id,
      licensePlate: t.licensePlate,
      truckType: t.truckType,
      capacity: t.capacity,
      dutyType: t.dutyType,
      isAvailable: t.isAvailable,
      assignedDriver: driverByTruck[t._id.toString()] || null,
      createdAt: t.createdAt,
    }));

    // Summary stats
    const totalTrucks = trucks.length;
    const availableTrucks = trucks.filter(t => t.isAvailable).length;
    const totalDrivers = driversWithUser.length;
    const availableDrivers = driversWithUser.filter(d => d.isAvailable).length;
    const trucksWithDrivers = trucksFormatted.filter(t => t.assignedDriver).length;
    const trucksWithoutDrivers = totalTrucks - trucksWithDrivers;
    const totalCapacity = trucks.reduce((sum, t) => sum + (t.capacity || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        _id: org._id,
        name: org.name,
        location: org.location,
        createdAt: org.createdAt,
        admins: org.admins,
        trucks: trucksFormatted,
        drivers: driversWithUser,
        areas,
        stats: {
          totalAdmins: org.admins?.length || 0,
          totalTrucks,
          availableTrucks,
          totalDrivers,
          availableDrivers,
          trucksWithDrivers,
          trucksWithoutDrivers,
          totalAreas: areas.length,
          totalCapacity,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch organization details", error: error.message });
  }
};

export const updateOrganization = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { name, location } = req.body;

    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ message: "Organization not found" });

    if (name) org.name = name;
    if (location) {
      if (location.address) org.location.address = location.address;
      if (location.latitude) org.location.latitude = location.latitude;
      if (location.longitude) org.location.longitude = location.longitude;
    }

    await org.save();
    res.status(200).json({ success: true, message: "Organization updated", organization: org });
  } catch (error) {
    res.status(500).json({ message: "Failed to update organization", error: error.message });
  }
};

export const addAdminToOrg = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, and password are required" });
    }

    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ message: "Organization not found" });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ message: "A user with this email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email: email.toLowerCase(),
      phone: phone || undefined,
      passwordHash: hashedPassword,
      role: "admin",
      orgId
    });
    await user.save();

    org.admins.push(user._id);
    await org.save();

    res.status(201).json({
      success: true,
      message: "Admin added to organization",
      admin: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add admin", error: error.message });
  }
};

export const getSuperAdminAnalytics = async (req, res) => {
  try {
    const cached = await cacheDashboardResponse("super-admin:analytics", async () => {
    // Real ecosystem-wide counts (not pickup-derived)
    const [totalOrganizations, activeVehicles, pickupAnalytics, scheduleAnalytics, orgBreakdown] = await Promise.all([
      Organization.countDocuments(),
      Truck.countDocuments({ isAvailable: true }),
      buildPickupAnalytics({}),
      buildScheduleAnalytics(),
      // Per-organization pickup breakdown — replaces the old Task-based bar chart
      PickupRequest.aggregate([
        { $match: { orgId: { $ne: null } } },
        {
          $group: {
            _id: "$orgId",
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
            revenue: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ["$status", "COMPLETED"] }, { $eq: ["$paymentStatus", "PAID"] }] },
                  { $ifNull: ["$estimatedPrice", 0] },
                  0,
                ],
              },
            },
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
            name: { $ifNull: ["$org.name", "Unknown org"] },
            total: 1,
            completed: 1,
            revenue: { $round: ["$revenue", 0] },
            _id: 0,
          },
        },
      ]),
    ]);

    return {
      success: true,
      data: {
        // Headline cards (Dashboard.jsx reads these)
        ecosystemStats: {
          totalOrganizations,
          activeVehicles,
          totalPickups: pickupAnalytics.summary.total,
          completedPickups: pickupAnalytics.summary.completed,
          activePickups: pickupAnalytics.summary.active,
          cancelledPickups: pickupAnalytics.summary.cancelled,
          completionRate: pickupAnalytics.summary.completionRate,
          totalRevenue: pickupAnalytics.summary.totalRevenue,
          avgResponseMs: pickupAnalytics.summary.avgResponseMs,
          avgTaskDurationMs: pickupAnalytics.summary.avgTaskDurationMs,
        },
        // Charts
        statusDistribution: pickupAnalytics.statusDistribution,
        categoryDistribution: pickupAnalytics.categoryDistribution,
        levelDistribution: pickupAnalytics.levelDistribution,
        paymentMethodRevenue: pickupAnalytics.paymentMethodRevenue,
        dailyTrend: pickupAnalytics.dailyTrend,
        monthlyRevenue: pickupAnalytics.monthlyRevenue,
        hourlyDistribution: pickupAnalytics.hourlyDistribution,
        topDrivers: pickupAnalytics.topDrivers,
        scheduleAnalytics,
        // Cross-org breakdown (super-admin only)
        orgBreakdown,
      },
    };
    });

    res.status(200).json(cached);
  } catch (error) {
    console.error("Error generating super admin analytics:", error);
    res.status(500).json({ success: false, message: "Failed to generate analytics", error: error.message });
  }
};

// ========== Vehicle Management ==========

export const getAllVehicles = async (req, res) => {
  try {
    const { orgId } = req.query;
    const pagination = getPagination(req.query, { defaultLimit: 10 });
    const filter = orgId ? { orgId } : {};

    const trucks = await Truck.find(filter)
      .select("truckType capacity licensePlate isAvailable orgId createdAt")
      .populate("orgId", "name")
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();
    const total = await Truck.countDocuments(filter);

    // Find drivers assigned to each truck
    const truckIds = trucks.map(t => t._id);
    const drivers = await Driver.find({ assignedTruckId: { $in: truckIds } })
      .populate("userId", "name email")
      .lean();

    const driverByTruck = {};
    drivers.forEach(d => {
      if (d.assignedTruckId) {
        driverByTruck[d.assignedTruckId.toString()] = {
          driverId: d._id,
          name: d.userId?.name || "Unknown",
          email: d.userId?.email || ""
        };
      }
    });

    const formattedTrucks = trucks.map(t => ({
      id: t._id,
      truckType: t.truckType,
      capacity: t.capacity,
      licensePlate: t.licensePlate,
      isAvailable: t.isAvailable,
      organization: t.orgId?.name || "Unassigned",
      orgId: t.orgId?._id,
      assignedDriver: driverByTruck[t._id.toString()] || null,
      createdAt: t.createdAt
    }));

    res.status(200).json({
      success: true,
      data: formattedTrucks,
      pagination: buildPaginationMeta({ ...pagination, total }),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch vehicles", error: error.message });
  }
};

export const createVehicle = async (req, res) => {
  try {
    const { truckType = "MIXED", capacity, licensePlate, orgId } = req.body;

    if (!capacity || !licensePlate || !orgId) {
      return res.status(400).json({ message: "capacity, licensePlate, and orgId are required" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const truck = new Truck({ truckType, capacity, licensePlate, orgId });
    await truck.save();

    org.fleet.push(truck._id);
    await org.save();

    res.status(201).json({ success: true, message: "Vehicle created successfully", data: truck });
  } catch (error) {
    res.status(500).json({ message: "Failed to create vehicle", error: error.message });
  }
};

export const updateVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { truckType, capacity, licensePlate, orgId, isAvailable } = req.body;

    const truck = await Truck.findById(vehicleId);
    if (!truck) return res.status(404).json({ message: "Vehicle not found" });

    // If org is changing, validate new org
    if (orgId && orgId !== truck.orgId?.toString()) {
      const org = await Organization.findById(orgId);
      if (!org) return res.status(404).json({ message: "Organization not found" });

      // Remove from old org fleet
      if (truck.orgId) {
        await Organization.findByIdAndUpdate(truck.orgId, { $pull: { fleet: truck._id } });
      }
      // Add to new org fleet
      org.fleet.push(truck._id);
      await org.save();

      truck.orgId = orgId;
    }

    if (truckType) truck.truckType = truckType;
    if (capacity) truck.capacity = capacity;
    if (licensePlate) truck.licensePlate = licensePlate;
    if (typeof isAvailable === "boolean") truck.isAvailable = isAvailable;

    await truck.save();

    res.status(200).json({ success: true, message: "Vehicle updated", data: truck });
  } catch (error) {
    res.status(500).json({ message: "Failed to update vehicle", error: error.message });
  }
};

// ========== Driver Management (Super Admin) ==========

export const createDriverBySuperAdmin = async (req, res) => {
  try {
    const { name, email, phone, password, orgId } = req.body;

    if (!name || !email || !phone || !password || !orgId) {
      return res.status(400).json({ message: "name, email, phone, password, and orgId are required" });
    }

    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ message: "Organization not found" });

    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
    if (existing) return res.status(400).json({ message: "A user with this email or phone already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name, email: email.toLowerCase(), phone,
      passwordHash: hashedPassword, role: "driver", orgId
    });
    await user.save();

    const driver = new Driver({ userId: user._id, isAvailable: true });
    await driver.save();

    res.status(201).json({
      success: true, message: "Driver created successfully",
      data: { id: driver._id, userId: user._id, name: user.name, email: user.email, phone: user.phone, orgId: user.orgId }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create driver", error: error.message });
  }
};

export const updateDriver = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { name, email, phone, orgId, isAvailable } = req.body;

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const user = await User.findById(driver.userId);
    if (!user) return res.status(404).json({ message: "Driver user not found" });

    if (name) user.name = name;
    if (email) user.email = email.toLowerCase();
    if (phone) user.phone = phone;
    if (orgId) user.orgId = orgId;
    await user.save();

    if (typeof isAvailable === "boolean") driver.isAvailable = isAvailable;
    await driver.save();

    res.status(200).json({ success: true, message: "Driver updated", data: { id: driver._id, name: user.name, email: user.email, phone: user.phone, orgId: user.orgId } });
  } catch (error) {
    res.status(500).json({ message: "Failed to update driver", error: error.message });
  }
};

export const assignDriverToTruck = async (req, res) => {
  try {
    const { driverId, truckId } = req.body;

    if (!driverId || !truckId) {
      return res.status(400).json({ message: "driverId and truckId are required" });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const truck = await Truck.findById(truckId);
    if (!truck) return res.status(404).json({ message: "Truck not found" });

    // Unassign any previous driver from this truck
    await Driver.updateMany({ assignedTruckId: truckId }, { $set: { assignedTruckId: null } });

    driver.assignedTruckId = truckId;
    await driver.save();

    res.status(200).json({ success: true, message: "Driver assigned to truck successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to assign driver to truck", error: error.message });
  }
};

// ========== Unassign & Delete ==========

export const unassignDriverFromTruck = async (req, res) => {
  try {
    const { truckId } = req.params;

    const result = await Driver.updateMany(
      { assignedTruckId: truckId },
      { $set: { assignedTruckId: null } }
    );

    res.status(200).json({ success: true, message: `Unassigned ${result.modifiedCount} driver(s) from truck` });
  } catch (error) {
    res.status(500).json({ message: "Failed to unassign driver", error: error.message });
  }
};

export const deleteVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    const truck = await Truck.findById(vehicleId);
    if (!truck) return res.status(404).json({ message: "Vehicle not found" });

    // Unassign any drivers from this truck
    await Driver.updateMany({ assignedTruckId: vehicleId }, { $set: { assignedTruckId: null } });

    // Remove from org fleet array
    if (truck.orgId) {
      await Organization.findByIdAndUpdate(truck.orgId, { $pull: { fleet: truck._id } });
    }

    await Truck.findByIdAndDelete(vehicleId);

    res.status(200).json({ success: true, message: "Vehicle deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete vehicle", error: error.message });
  }
};

export const deleteDriver = async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    // Delete the driver profile
    await Driver.findByIdAndDelete(driverId);

    // Also delete the user account
    if (driver.userId) {
      await User.findByIdAndDelete(driver.userId);
    }

    res.status(200).json({ success: true, message: "Driver deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete driver", error: error.message });
  }
};

export const deleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    const adminUser = await User.findById(adminId);
    if (!adminUser) return res.status(404).json({ message: "Admin not found" });

    if (adminUser.role === "super_admin") {
      return res.status(403).json({ message: "Cannot delete a super admin" });
    }

    if (adminUser.role !== "admin") {
      return res.status(400).json({ message: "User is not an admin" });
    }

    // Remove admin from organization's admins array
    if (adminUser.orgId) {
      await Organization.findByIdAndUpdate(adminUser.orgId, {
        $pull: { admins: adminUser._id },
      });
    }

    // Delete the user account permanently
    await User.findByIdAndDelete(adminId);

    res.status(200).json({ success: true, message: "Admin deleted permanently from database" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete admin", error: error.message });
  }
};

// ========== Deletion Request Approval ==========

export const getDeletionRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const pagination = getPagination(req.query, { defaultLimit: 10 });
    const filter = status ? { status } : {};

    const requests = await DeletionRequest.find(filter)
      .select("type targetId targetName reason status requestedBy orgId reviewedBy reviewNote reviewedAt createdAt updatedAt")
      .populate("requestedBy", "name email")
      .populate("orgId", "name")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();
    const total = await DeletionRequest.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: requests,
      pagination: buildPaginationMeta({ ...pagination, total }),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch deletion requests", error: error.message });
  }
};

export const reviewDeletionRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, reviewNote } = req.body;

    if (!["approved", "rejected"].includes(action)) {
      return res.status(400).json({ message: "Action must be 'approved' or 'rejected'" });
    }

    const request = await DeletionRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== "pending") return res.status(400).json({ message: "Request already reviewed" });

    request.status = action;
    request.reviewedBy = req.user._id;
    request.reviewNote = reviewNote || "";
    request.reviewedAt = new Date();
    await request.save();

    // If approved, perform the actual deletion
    if (action === "approved") {
      if (request.type === "vehicle") {
        const truck = await Truck.findById(request.targetId);
        if (truck) {
          await Driver.updateMany({ assignedTruckId: truck._id }, { $set: { assignedTruckId: null } });
          if (truck.orgId) {
            await Organization.findByIdAndUpdate(truck.orgId, { $pull: { fleet: truck._id } });
          }
          await Truck.findByIdAndDelete(truck._id);
        }
      } else if (request.type === "driver") {
        const driver = await Driver.findById(request.targetId);
        if (driver) {
          await Driver.findByIdAndDelete(driver._id);
          if (driver.userId) await User.findByIdAndDelete(driver.userId);
        }
      }
    }

    try {
      const totalPending = await DeletionRequest.countDocuments({ status: "pending" });
      const orgPending = await DeletionRequest.countDocuments({ orgId: request.orgId, status: "pending" });
      const io = getIO();
      io.to("super_admins").emit("deletion-request:counts", { deletions: totalPending });
      if (request.orgId) {
        io.to(`org:${request.orgId}`).emit("deletion-request:counts", { deletions: orgPending });
      }
    } catch (socketErr) {
      console.error("Socket error on deletion request review emission:", socketErr.message);
    }

    res.status(200).json({ success: true, message: `Request ${action}` });
  } catch (error) {
    res.status(500).json({ message: "Failed to review request", error: error.message });
  }
};

export const getPendingDeletionCount = async (req, res) => {
  try {
    const count = await DeletionRequest.countDocuments({ status: "pending" });
    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pending deletion count", error: error.message });
  }
};

/**
 * Get detailed driver info with pickup history/stats
 * GET /api/super-admin/drivers/:driverId/detail
 */
export const getDriverDetail = async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await Driver.findById(driverId)
      .populate({
        path: "userId",
        select: "name email phone role orgId",
        populate: { path: "orgId", select: "name location" },
      })
      .populate("assignedTruckId")
      .lean();

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const userId = driver.userId?._id;

    // Get all pickups by this driver
    const pickups = await PickupRequest.find({ driverId: userId })
      .select("status category level province area location createdAt assignedAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const completedPickups = pickups.filter(p => p.status === "COMPLETED");
    const activePickup = pickups.find(p => ["ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING"].includes(p.status));

    // Stats breakdown
    const stats = {
      totalPickups: pickups.length,
      completedPickups: completedPickups.length,
      cancelledPickups: pickups.filter(p => p.status === "CANCELLED").length,
      activePickup: activePickup ? {
        id: activePickup._id,
        status: activePickup.status,
        location: activePickup.location,
        category: activePickup.category,
        createdAt: activePickup.createdAt,
      } : null,
      // Category breakdown
      byCategory: {
        recyclable: completedPickups.filter(p => p.category === "recyclable").length,
        nonRecyclable: completedPickups.filter(p => p.category === "non-recyclable").length,
        mixed: completedPickups.filter(p => p.category === "both").length,
      },
      // Level breakdown
      byLevel: {
        easy: completedPickups.filter(p => p.level === "easy").length,
        medium: completedPickups.filter(p => p.level === "medium").length,
        hard: completedPickups.filter(p => p.level === "hard").length,
      },
    };

    // Recent pickups (last 20)
    const recentPickups = pickups.slice(0, 20).map(p => ({
      id: p._id,
      status: p.status,
      category: p.category,
      level: p.level,
      province: p.province,
      area: p.area,
      location: p.location,
      createdAt: p.createdAt,
      assignedAt: p.assignedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        driver: {
          _id: driver._id,
          name: driver.userId?.name,
          email: driver.userId?.email,
          phone: driver.userId?.phone,
          isAvailable: driver.isAvailable,
          organization: driver.userId?.orgId || null,
          truck: driver.assignedTruckId ? {
            _id: driver.assignedTruckId._id,
            licensePlate: driver.assignedTruckId.licensePlate,
            capacity: driver.assignedTruckId.capacity,
            dutyType: driver.assignedTruckId.dutyType,
            isAvailable: driver.assignedTruckId.isAvailable,
          } : null,
        },
        stats,
        recentPickups,
      },
    });
  } catch (error) {
    console.error("Get driver detail error:", error);
    res.status(500).json({ message: "Failed to fetch driver details", error: error.message });
  }
};

/**
 * Get pickup stats across all drivers (for super admin reports)
 * GET /api/super-admin/pickup-stats
 */
export const getPickupStats = async (req, res) => {
  try {
    // Use aggregation instead of loading all docs
    const [statusStats, driverStats, categoryStats, dailyTrend] = await Promise.all([
      // 1. Status breakdown
      PickupRequest.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),

      // 2. Top drivers by completed pickups
      PickupRequest.aggregate([
        { $match: { status: "COMPLETED", driverId: { $ne: null } } },
        {
          $group: {
            _id: "$driverId",
            count: { $sum: 1 },
            recyclable: { $sum: { $cond: [{ $eq: ["$category", "recyclable"] }, 1, 0] } },
            nonRecyclable: { $sum: { $cond: [{ $eq: ["$category", "non-recyclable"] }, 1, 0] } },
            mixed: { $sum: { $cond: [{ $eq: ["$category", "both"] }, 1, 0] } },
            avgResponseMs: { $avg: "$responseTimeMs" },
            avgTaskDurationMs: { $avg: "$taskDurationMs" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 100 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "driver",
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            driverId: "$_id",
            driverName: { $ifNull: ["$driver.name", "Unknown"] },
            count: 1,
            categories: {
              recyclable: "$recyclable",
              "non-recyclable": "$nonRecyclable",
              both: "$mixed",
            },
            avgResponseMs: { $round: [{ $ifNull: ["$avgResponseMs", 0] }, 0] },
            avgTaskDurationMs: { $round: [{ $ifNull: ["$avgTaskDurationMs", 0] }, 0] },
            _id: 0,
          },
        },
      ]),

      // 3. Category breakdown
      PickupRequest.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),

      // 4. Daily trend (last 14 days)
      PickupRequest.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Build summary
    const statusMap = {};
    let totalPickups = 0;
    for (const s of statusStats) {
      statusMap[s._id] = s.count;
      totalPickups += s.count;
    }

    res.status(200).json({
      success: true,
      data: {
        totalPickups,
        completedPickups: statusMap.COMPLETED || 0,
        cancelledPickups: statusMap.CANCELLED || 0,
        expiredPickups: statusMap.EXPIRED || 0,
        activePickups: (statusMap.PENDING || 0) + (statusMap.ASSIGNED || 0) +
          (statusMap.EN_ROUTE || 0) + (statusMap.ARRIVED || 0) + (statusMap.COLLECTING || 0),
        completionRate: totalPickups > 0 ? Math.round(((statusMap.COMPLETED || 0) / totalPickups) * 100) : 0,
        statusDistribution: statusStats.map(s => ({ status: s._id, count: s.count })),
        categoryDistribution: categoryStats.map(c => ({ category: c._id, count: c.count })),
        driverStats,
        dailyTrend: dailyTrend.map(d => ({ date: d._id, total: d.total, completed: d.completed, cancelled: d.cancelled })),
      },
    });
  } catch (error) {
    console.error("Get pickup stats error:", error);
    res.status(500).json({ message: "Failed to fetch pickup stats", error: error.message });
  }
};
