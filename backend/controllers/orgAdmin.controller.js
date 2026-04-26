import User from "../models/User.model.js";
import Truck from "../models/Truck.model.js";
import Driver from "../models/Driver.model.js";
import Task from "../models/Task.model.js";
import Organization from "../models/Organization.model.js";
import DeletionRequest from "../models/DeletionRequest.model.js";
import PickupRequest from "../models/PickupRequest.model.js";
import { buildPickupAnalytics, buildScheduleAnalytics } from "../services/pickupAnalytics.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

export const getOrgAdmins = async (req, res) => {
  try {
    const { role, orgId } = req.user;
    const isSuperAdmin = role === "super_admin";

    let filter;
    if (isSuperAdmin) {
      // Super admins see all admins across all orgs
      filter = { role: { $in: ["admin", "super_admin"] } };
    } else {
      if (!orgId) return res.status(403).json({ message: "Organization ID required" });
      // Org admins only see admins from their own org (not super_admins)
      filter = { orgId, role: "admin" };
    }

    const admins = await User.find(filter)
      .select("name email phone role orgId createdAt isActive")
      .populate("orgId", "name")
      .sort({ createdAt: -1 });

    const orgName = isSuperAdmin ? "All Organizations" : (await Organization.findById(orgId).select("name"))?.name || "Unknown";

    // For super admin: group admins by organization
    const adminData = admins.map(a => ({
      id: a._id,
      name: a.name,
      email: a.email,
      phone: a.phone || "",
      role: a.role,
      organization: a.orgId ? { id: a.orgId._id, name: a.orgId.name } : null,
      isActive: a.isActive !== false,
      createdAt: a.createdAt
    }));

    // Build org groups for super admin view
    let orgGroups = null;
    if (isSuperAdmin) {
      const groups = {};
      for (const admin of adminData) {
        const orgKey = admin.organization?.name || "Global / Unassigned";
        if (!groups[orgKey]) groups[orgKey] = { orgName: orgKey, orgId: admin.organization?.id || null, admins: [] };
        groups[orgKey].admins.push(admin);
      }
      orgGroups = Object.values(groups).sort((a, b) => {
        if (a.orgName === "Global / Unassigned") return 1;
        if (b.orgName === "Global / Unassigned") return -1;
        return a.orgName.localeCompare(b.orgName);
      });
    }

    res.status(200).json({
      success: true,
      orgName,
      data: adminData,
      orgGroups
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch admins", error: error.message });
  }
};

export const updateOrgAdmin = async (req, res) => {
  try {
    const { role, orgId } = req.user;
    const isSuperAdmin = role === "super_admin";
    const { adminId } = req.params;
    const { name, email, phone } = req.body;

    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Org admins can only update admins in their own org
    if (!isSuperAdmin) {
      if (admin.orgId?.toString() !== orgId?.toString() || admin.role !== "admin") {
        return res.status(404).json({ message: "Admin not found in your organization" });
      }
    }

    if (name) admin.name = name;
    if (email) admin.email = email.toLowerCase();
    if (phone) admin.phone = phone;
    await admin.save();

    res.status(200).json({ success: true, message: "Admin updated", data: { id: admin._id, name: admin.name, email: admin.email, phone: admin.phone } });
  } catch (error) {
    res.status(500).json({ message: "Failed to update admin", error: error.message });
  }
};
export const createAdmin = async (req, res) => {
  try {
    const { name, email, phone, password, contactInfo, orgId: requestedOrgId } = req.body;
    const isSuperAdmin = req.user.role === "super_admin";
    const orgId = isSuperAdmin ? requestedOrgId : req.user.orgId;

    if (!orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ message: "Valid organization ID is required" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = new User({
      name,
      email: email.toLowerCase(),
      passwordHash: hashedPassword,
      phone: phone || contactInfo || undefined,
      role: "admin",
      orgId
    });

    await admin.save();

    if (!org.admins.some((id) => id.toString() === admin._id.toString())) {
      org.admins.push(admin._id);
      await org.save();
    }

    res.status(201).json({
      message: "Admin created successfully",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone || "",
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create admin", error: error.message });
  }
};

export const addTruck = async (req, res) => {
  try {
    const { truckType, capacity, licensePlate } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    if (!truckType || !capacity || !licensePlate) {
      return res.status(400).json({ message: "Truck type, capacity, and license plate are required" });
    }

    const truck = new Truck({
      truckType,
      capacity,
      licensePlate,
      orgId
    });

    await truck.save();

    res.status(201).json({
      message: "Truck added successfully",
      truck
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add truck", error: error.message });
  }
};

export const addDriver = async (req, res) => {
  try {
    const { userId } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "driver") {
      return res.status(400).json({ message: "User must have driver role" });
    }

    if (user.orgId && user.orgId.toString() !== orgId.toString()) {
      return res.status(403).json({ message: "Driver belongs to another organization" });
    }

    user.orgId = orgId;
    await user.save();

    const existingDriver = await Driver.findOne({ userId });
    if (existingDriver) {
      return res.status(400).json({ message: "Driver already exists" });
    }

    const driver = new Driver({
      userId,
      isAvailable: true
    });

    await driver.save();

    res.status(201).json({
      message: "Driver added successfully",
      driver
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add driver", error: error.message });
  }
};

export const reviewOnDemandRequest = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { action, estimatedVolume } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.orgId.toString() !== orgId.toString()) {
      return res.status(403).json({ message: "Unauthorized access to task" });
    }

    if (task.taskType !== "ON_DEMAND") {
      return res.status(400).json({ message: "Task is not an on-demand request" });
    }

    if (action === "approve") {
      if (estimatedVolume) {
        task.estimatedVolume = estimatedVolume;
      }
      task.status = "PENDING";
      await task.save();
      return res.status(200).json({
        message: "On-demand request approved",
        task
      });
    } else if (action === "reject") {
      task.status = "COMPLETED";
      await task.save();
      return res.status(200).json({
        message: "On-demand request rejected",
        task
      });
    } else {
      return res.status(400).json({ message: "Invalid action. Use 'approve' or 'reject'" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to review request", error: error.message });
  }
};

export const assignTaskToDriver = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { driverId, truckId } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    if (!driverId || !truckId) {
      return res.status(400).json({ message: "Driver ID and Truck ID are required" });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.orgId.toString() !== orgId.toString()) {
      return res.status(403).json({ message: "Unauthorized access to task" });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const truck = await Truck.findById(truckId);
    if (!truck) {
      return res.status(404).json({ message: "Truck not found" });
    }

    if (truck.orgId.toString() !== orgId.toString()) {
      return res.status(403).json({ message: "Truck belongs to another organization" });
    }

    if (truck.truckType !== task.wasteType) {
      return res.status(400).json({ message: "Truck type does not match waste type" });
    }

    task.assignedDriverId = driverId;
    task.assignedTruckId = truckId;
    task.status = "ASSIGNED";
    await task.save();

    res.status(200).json({
      message: "Task assigned successfully",
      task
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to assign task", error: error.message });
  }
};

export const estimateWasteVolume = async (req, res) => {
  try {
    const { location, wasteType, taskType } = req.body;

    if (!location || !wasteType) {
      return res.status(400).json({ message: "Location and waste type are required" });
    }

    // Placeholder estimation logic
    // In production, this would use historical data, ML models, or other algorithms
    const baseEstimate = taskType === "ROUTINE" ? 500 : 200;
    const randomVariation = Math.random() * 200;
    const estimatedVolume = Math.round(baseEstimate + randomVariation);

    res.status(200).json({
      message: "Waste volume estimated",
      estimatedVolume,
      unit: "liters"
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to estimate waste volume", error: error.message });
  }
};

// ========== Admin: Create Driver (auto-scoped to their org) ==========

export const createDriverByAdmin = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "name, email, phone, and password are required" });
    }

    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
    if (existing) {
      return res.status(400).json({ message: "A user with this email or phone already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash: hashedPassword,
      role: "driver",
      orgId
    });
    await user.save();

    const driver = new Driver({
      userId: user._id,
      isAvailable: true
    });
    await driver.save();

    res.status(201).json({
      success: true,
      message: "Driver created successfully",
      data: {
        id: driver._id,
        userId: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        orgId: user.orgId
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create driver", error: error.message });
  }
};

// ========== Admin: Get own org trucks ==========

export const getOrgTrucks = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    if (!orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    const trucks = await Truck.find({ orgId }).sort({ createdAt: -1 });

    const formatted = trucks.map(t => ({
      id: t._id,
      truckType: t.truckType,
      dutyType: t.dutyType || (t.capacity < 1000 ? 'light duty' : t.capacity <= 5000 ? 'medium duty' : 'heavy duty'),
      capacity: t.capacity,
      licensePlate: t.licensePlate,
      isAvailable: t.isAvailable,
      createdAt: t.createdAt
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch trucks", error: error.message });
  }
};

// ========== Deletion Requests (Admin) ==========

export const requestDeletion = async (req, res) => {
  try {
    const { type, targetId, reason } = req.body;
    const orgId = req.user.orgId;

    if (!type || !targetId || !reason) {
      return res.status(400).json({ message: "type, targetId, and reason are required" });
    }

    if (!["vehicle", "driver"].includes(type)) {
      return res.status(400).json({ message: "type must be 'vehicle' or 'driver'" });
    }

    // Validate target exists
    let targetName = "";
    if (type === "vehicle") {
      const truck = await Truck.findById(targetId);
      if (!truck) return res.status(404).json({ message: "Vehicle not found" });
      targetName = truck.licensePlate;
    } else {
      const driver = await Driver.findById(targetId).populate("userId", "name");
      if (!driver) return res.status(404).json({ message: "Driver not found" });
      targetName = driver.userId?.name || "Unknown Driver";
    }

    // Check for existing pending request
    const existing = await DeletionRequest.findOne({ targetId, status: "pending" });
    if (existing) return res.status(400).json({ message: "A pending deletion request already exists for this item" });

    const request = new DeletionRequest({
      type,
      targetId,
      targetName,
      reason,
      requestedBy: req.user._id,
      orgId
    });
    await request.save();

    res.status(201).json({ success: true, message: "Deletion request submitted for approval", data: request });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit deletion request", error: error.message });
  }
};

export const getMyDeletionRequests = async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const requests = await DeletionRequest.find({ orgId })
      .populate("requestedBy", "name email")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch deletion requests", error: error.message });
  }
};

// ========== Admin Analytics ==========

/**
 * Org admin dashboard analytics — same shape as super-admin's, but scoped
 * to the admin's organization. All numbers come from PickupRequest (the
 * real source of truth) — the legacy Task-based aggregations were stale
 * because Task is the ML scheduler's per-area record, not actual work.
 *
 * Reuses buildPickupAnalytics() from superAdmin.controller.js so both
 * roles share one aggregation pipeline.
 */
export const getAdminAnalytics = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    if (!orgId) return res.status(403).json({ message: "Organization ID required" });

    const orgIdObj = new mongoose.Types.ObjectId(orgId);
    const match = { orgId: orgIdObj };

    const [totalDrivers, activeVehicles, pickupAnalytics, scheduleAnalytics, areaBreakdown] = await Promise.all([
      User.countDocuments({ orgId, role: "driver" }),
      Truck.countDocuments({ orgId, isAvailable: true }),
      buildPickupAnalytics(match),
      buildScheduleAnalytics({ orgId }),
      // Per-area pickup breakdown — replaces the old Task-based driver chart
      PickupRequest.aggregate([
        { $match: { ...match, area: { $ne: null } } },
        {
          $group: {
            _id: "$area",
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
            revenue: {
              $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, { $ifNull: ["$estimatedPrice", 0] }, 0] },
            },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 15 },
        {
          $project: {
            name: "$_id",
            total: 1,
            completed: 1,
            revenue: { $round: ["$revenue", 0] },
            _id: 0,
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        // Headline cards (Dashboard.jsx reads these — note totalOrganizations
        // is repurposed as totalDrivers for the admin role; the frontend
        // already labels it correctly based on role).
        ecosystemStats: {
          totalOrganizations: totalDrivers,
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
        dailyTrend: pickupAnalytics.dailyTrend,
        hourlyDistribution: pickupAnalytics.hourlyDistribution,
        topDrivers: pickupAnalytics.topDrivers,
        scheduleAnalytics,
        // Per-area breakdown (admin view)
        areaBreakdown,
      },
    });
  } catch (error) {
    console.error("Error generating admin analytics:", error);
    res.status(500).json({ success: false, message: "Failed to generate analytics", error: error.message });
  }
};

export const getPendingDeletionCount = async (req, res) => {
  try {
    const count = await DeletionRequest.countDocuments({ orgId: req.user.orgId, status: "pending" });
    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pending deletion count", error: error.message });
  }
};
