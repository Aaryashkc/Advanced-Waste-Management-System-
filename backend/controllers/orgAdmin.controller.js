import User from "../models/User.model.js";
import Truck from "../models/Truck.model.js";
import Driver from "../models/Driver.model.js";
import Task from "../models/Task.model.js";
import Organization from "../models/Organization.model.js";
import DeletionRequest from "../models/DeletionRequest.model.js";
import PickupRequest from "../models/PickupRequest.model.js";
import Area from "../models/Area.model.js";
import { buildPickupAnalytics, buildScheduleAnalytics } from "../services/pickupAnalytics.js";
import { cacheDashboardResponse } from "../services/dashboardCache.js";
import { getIO } from "../socket/socketServer.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { buildPaginationMeta, getPagination } from "../utils/pagination.js";

async function buildOrganizationDetail(orgId) {
  const org = await Organization.findById(orgId)
    .populate("admins", "name email phone isActive createdAt");

  if (!org) return null;

  const trucks = await Truck.find({ orgId: org._id })
    .select("licensePlate truckType capacity dutyType isAvailable createdAt")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  const orgDriverUsers = await User.find({ orgId: org._id, role: "driver" })
    .select("_id name email phone isActive createdAt")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  const driverUserIds = orgDriverUsers.map((u) => u._id);
  const drivers = await Driver.find({ userId: { $in: driverUserIds } })
    .populate("assignedTruckId", "licensePlate truckType capacity")
    .lean();
  const areas = await Area.find({ orgId: org._id, isActive: true })
    .select("name type boundary isActive createdAt")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const driversWithUser = drivers.map((driver) => {
    const user = orgDriverUsers.find((u) => u._id.toString() === driver.userId.toString());
    return {
      id: driver._id,
      userId: driver.userId,
      name: user?.name || "Unknown",
      email: user?.email || "",
      phone: user?.phone || "",
      isAvailable: driver.isAvailable,
      assignedTruck: driver.assignedTruckId
        ? {
            id: driver.assignedTruckId._id,
            licensePlate: driver.assignedTruckId.licensePlate,
            truckType: driver.assignedTruckId.truckType,
            capacity: driver.assignedTruckId.capacity,
          }
        : null,
      createdAt: user?.createdAt,
    };
  });

  const driverByTruck = {};
  for (const driver of driversWithUser) {
    if (driver.assignedTruck) {
      driverByTruck[driver.assignedTruck.id.toString()] = {
        name: driver.name,
        id: driver.id,
      };
    }
  }

  const trucksFormatted = trucks.map((truck) => ({
    id: truck._id,
    licensePlate: truck.licensePlate,
    truckType: truck.truckType,
    capacity: truck.capacity,
    dutyType: truck.dutyType,
    isAvailable: truck.isAvailable,
    assignedDriver: driverByTruck[truck._id.toString()] || null,
    createdAt: truck.createdAt,
  }));

  const totalTrucks = trucks.length;
  const totalDrivers = driversWithUser.length;
  const trucksWithDrivers = trucksFormatted.filter((truck) => truck.assignedDriver).length;
  const totalCapacity = trucks.reduce((sum, truck) => sum + (truck.capacity || 0), 0);

  return {
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
      availableTrucks: trucks.filter((truck) => truck.isAvailable).length,
      totalDrivers,
      availableDrivers: driversWithUser.filter((driver) => driver.isAvailable).length,
      trucksWithDrivers,
      trucksWithoutDrivers: totalTrucks - trucksWithDrivers,
      totalAreas: areas.length,
      totalCapacity,
    },
  };
}

export const getMyOrganization = async (req, res) => {
  try {
    if (!req.user.orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    const data = await buildOrganizationDetail(req.user.orgId);
    if (!data) return res.status(404).json({ message: "Organization not found" });

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch organization details", error: error.message });
  }
};

export const updateMyOrganization = async (req, res) => {
  try {
    if (!req.user.orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    const { name, location } = req.body;
    const org = await Organization.findById(req.user.orgId);
    if (!org) return res.status(404).json({ message: "Organization not found" });

    if (name) org.name = name;
    if (location) {
      if (location.address !== undefined) org.location.address = location.address;
      if (location.latitude !== undefined) org.location.latitude = location.latitude;
      if (location.longitude !== undefined) org.location.longitude = location.longitude;
    }

    await org.save();
    const data = await buildOrganizationDetail(req.user.orgId);

    res.status(200).json({ success: true, message: "Organization updated", data });
  } catch (error) {
    res.status(500).json({ message: "Failed to update organization", error: error.message });
  }
};

export const getOrgAdmins = async (req, res) => {
  try {
    const { role, orgId } = req.user;
    const pagination = getPagination(req.query, { defaultLimit: 10 });
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
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();
    const total = await User.countDocuments(filter);

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
      orgGroups,
      pagination: buildPaginationMeta({ ...pagination, total }),
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
    const { truckType = "MIXED", capacity, licensePlate } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    if (!capacity || !licensePlate) {
      return res.status(400).json({ message: "Capacity and license plate are required" });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const truck = new Truck({
      truckType,
      capacity,
      licensePlate,
      orgId
    });

    await truck.save();

    if (!org.fleet.some((id) => id.toString() === truck._id.toString())) {
      org.fleet.push(truck._id);
      await org.save();
    }

    res.status(201).json({
      success: true,
      message: "Truck added successfully",
      data: truck
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

export const updateDriverByAdmin = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { name, email, phone, isAvailable } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    const driver = await Driver.findById(driverId).populate("userId");
    if (!driver || driver.userId?.orgId?.toString() !== orgId.toString()) {
      return res.status(404).json({ message: "Driver not found in your organization" });
    }

    if (name) driver.userId.name = name;
    if (email) driver.userId.email = email.toLowerCase();
    if (phone) driver.userId.phone = phone;
    await driver.userId.save();

    if (typeof isAvailable === "boolean") driver.isAvailable = isAvailable;
    await driver.save();

    res.status(200).json({
      success: true,
      message: "Driver updated",
      data: {
        id: driver._id,
        name: driver.userId.name,
        email: driver.userId.email,
        phone: driver.userId.phone,
        orgId: driver.userId.orgId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update driver", error: error.message });
  }
};

// ========== Admin: Get own org trucks ==========

export const getOrgTrucks = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const pagination = getPagination(req.query, { defaultLimit: 10 });
    if (!orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    const trucks = await Truck.find({ orgId })
      .select("truckType dutyType capacity licensePlate isAvailable createdAt")
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();
    const total = await Truck.countDocuments({ orgId });
    const truckIds = trucks.map((truck) => truck._id);
    const assignedDrivers = await Driver.find({ assignedTruckId: { $in: truckIds } })
      .populate("userId", "name email")
      .lean();

    const driverByTruck = {};
    assignedDrivers.forEach((driver) => {
      if (driver.assignedTruckId) {
        driverByTruck[driver.assignedTruckId.toString()] = {
          driverId: driver._id,
          name: driver.userId?.name || "Unknown",
          email: driver.userId?.email || "",
        };
      }
    });

    const formatted = trucks.map(t => ({
      id: t._id,
      truckType: t.truckType,
      dutyType: t.dutyType || (t.capacity < 1000 ? 'light duty' : t.capacity <= 5000 ? 'medium duty' : 'heavy duty'),
      capacity: t.capacity,
      licensePlate: t.licensePlate,
      isAvailable: t.isAvailable,
      assignedDriver: driverByTruck[t._id.toString()] || null,
      createdAt: t.createdAt
    }));

    res.status(200).json({
      success: true,
      data: formatted,
      pagination: buildPaginationMeta({ ...pagination, total }),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch trucks", error: error.message });
  }
};

export const updateOrgTruck = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { capacity, licensePlate, isAvailable } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    const truck = await Truck.findById(vehicleId);
    if (!truck || truck.orgId?.toString() !== orgId.toString()) {
      return res.status(404).json({ message: "Vehicle not found in your organization" });
    }

    if (capacity !== undefined) truck.capacity = Number(capacity);
    if (licensePlate) truck.licensePlate = licensePlate;
    if (typeof isAvailable === "boolean") truck.isAvailable = isAvailable;

    await truck.save();

    res.status(200).json({ success: true, message: "Vehicle updated", data: truck });
  } catch (error) {
    res.status(500).json({ message: "Failed to update vehicle", error: error.message });
  }
};

export const assignDriverToOrgTruck = async (req, res) => {
  try {
    const { driverId, truckId } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    if (!driverId || !truckId) {
      return res.status(400).json({ message: "driverId and truckId are required" });
    }

    const [driver, truck] = await Promise.all([
      Driver.findById(driverId).populate("userId", "orgId"),
      Truck.findById(truckId),
    ]);

    if (!driver || driver.userId?.orgId?.toString() !== orgId.toString()) {
      return res.status(404).json({ message: "Driver not found in your organization" });
    }

    if (!truck || truck.orgId?.toString() !== orgId.toString()) {
      return res.status(404).json({ message: "Truck not found in your organization" });
    }

    await Driver.updateMany(
      { assignedTruckId: truckId, _id: { $ne: driver._id } },
      { $set: { assignedTruckId: null } }
    );

    driver.assignedTruckId = truckId;
    await driver.save();

    res.status(200).json({ success: true, message: "Driver assigned to truck successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to assign driver to truck", error: error.message });
  }
};

export const unassignDriverFromOrgTruck = async (req, res) => {
  try {
    const { truckId } = req.params;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    const truck = await Truck.findById(truckId);
    if (!truck || truck.orgId?.toString() !== orgId.toString()) {
      return res.status(404).json({ message: "Truck not found in your organization" });
    }

    const result = await Driver.updateMany(
      { assignedTruckId: truckId },
      { $set: { assignedTruckId: null } }
    );

    res.status(200).json({ success: true, message: `Unassigned ${result.modifiedCount} driver(s) from truck` });
  } catch (error) {
    res.status(500).json({ message: "Failed to unassign driver", error: error.message });
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
      if (truck.orgId?.toString() !== orgId?.toString()) {
        return res.status(403).json({ message: "Vehicle belongs to another organization" });
      }
      targetName = truck.licensePlate;
    } else {
      const driver = await Driver.findById(targetId).populate("userId", "name");
      if (!driver) return res.status(404).json({ message: "Driver not found" });
      const driverUser = await User.findById(driver.userId?._id || driver.userId).select("orgId");
      if (driverUser?.orgId?.toString() !== orgId?.toString()) {
        return res.status(403).json({ message: "Driver belongs to another organization" });
      }
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

    try {
      const totalPending = await DeletionRequest.countDocuments({ status: "pending" });
      getIO().to("super_admins").emit("deletion-request:new", request);
      getIO().to("super_admins").emit("deletion-request:counts", { deletions: totalPending });
    } catch (socketErr) {
      console.error("Socket error on deletion request emission:", socketErr.message);
    }

    res.status(201).json({ success: true, message: "Deletion request submitted for approval", data: request });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit deletion request", error: error.message });
  }
};

export const getMyDeletionRequests = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const pagination = getPagination(req.query, { defaultLimit: 10 });

    const requests = await DeletionRequest.find({ orgId })
      .select("type targetId targetName reason status requestedBy reviewedBy reviewNote reviewedAt createdAt updatedAt")
      .populate("requestedBy", "name email")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();
    const total = await DeletionRequest.countDocuments({ orgId });

    res.status(200).json({
      success: true,
      data: requests,
      pagination: buildPaginationMeta({ ...pagination, total }),
    });
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

    const cached = await cacheDashboardResponse(`admin:analytics:${orgId}`, async () => {
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

    return {
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
        paymentMethodRevenue: pickupAnalytics.paymentMethodRevenue,
        dailyTrend: pickupAnalytics.dailyTrend,
        monthlyRevenue: pickupAnalytics.monthlyRevenue,
        hourlyDistribution: pickupAnalytics.hourlyDistribution,
        topDrivers: pickupAnalytics.topDrivers,
        scheduleAnalytics,
        // Per-area breakdown (admin view)
        areaBreakdown,
      },
    };
    });

    res.status(200).json(cached);
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
