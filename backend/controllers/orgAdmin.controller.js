import User from "../models/User.model.js";
import Truck from "../models/Truck.model.js";
import Driver from "../models/Driver.model.js";
import Task from "../models/Task.model.js";
import Organization from "../models/Organization.model.js";
import DeletionRequest from "../models/DeletionRequest.model.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

export const getOrgAdmins = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    if (!orgId) return res.status(403).json({ message: "Organization ID required" });

    const admins = await User.find({ orgId, role: "admin, superAdmin" }).select("name email phone createdAt");
    const org = await Organization.findById(orgId).select("name");

    res.status(200).json({
      success: true,
      orgName: org?.name || "Unknown",
      data: admins.map(a => ({
        id: a._id,
        name: a.name,
        email: a.email,
        phone: a.phone || "",
        createdAt: a.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch admins", error: error.message });
  }
};

export const updateOrgAdmin = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const { adminId } = req.params;
    const { name, email, phone } = req.body;

    const admin = await User.findById(adminId);
    if (!admin || admin.orgId?.toString() !== orgId?.toString() || admin.role !== "admin") {
      return res.status(404).json({ message: "Admin not found in your organization" });
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
    const { name, email, password, contactInfo } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(403).json({ message: "Organization ID required" });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = new User({
      name,
      email,
      passwordHash: hashedPassword,
      contactInfo,
      role: "admin",
      orgId
    });

    await admin.save();

    res.status(201).json({
      message: "Admin created successfully",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
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

export const getAdminAnalytics = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    if (!orgId) return res.status(403).json({ message: "Organization ID required" });

    const orgIdObj = new mongoose.Types.ObjectId(orgId);

    // 1. Ecosystem Stats
    const totalDrivers = await User.countDocuments({ orgId, role: "driver" });
    const activeVehicles = await Truck.countDocuments({ orgId, isAvailable: true });
    
    // Total Waste (sum of estimatedVolume from COMPLETED tasks)
    const wasteAggregation = await Task.aggregate([
      { $match: { orgId: orgIdObj, status: "COMPLETED" } },
      { $group: { _id: null, totalWaste: { $sum: "$estimatedVolume" } } }
    ]);
    const totalWasteCollected = wasteAggregation.length > 0 ? wasteAggregation[0].totalWaste : 0;
    
    const activeRoutes = await Task.countDocuments({ 
        orgId, 
        status: { $in: ["ASSIGNED", "IN_PROGRESS"] } 
    });

    // 2. Driver Performance
    const driverStats = await Task.aggregate([
      { $match: { orgId: orgIdObj, status: "COMPLETED", assignedDriverId: { $ne: null } } },
      { 
        $group: { 
          _id: "$assignedDriverId", 
          wasteCollected: { $sum: "$estimatedVolume" },
          completedTasks: { $sum: 1 } 
        } 
      }
    ]);

    // Populate driver names
    const driverData = await Promise.all(driverStats.map(async stat => {
      const driver = await Driver.findById(stat._id).populate("userId", "name");
      return {
        _id: stat._id,
        name: driver?.userId?.name || "Unknown Driver",
        wasteCollectedField: stat.wasteCollected,
        activeVehicles: 1, // Dummy data so Scatter chart doesn't break
        routes: stat.completedTasks
      };
    }));

    // 3. Time Series Data (Last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const timeSeriesAggregation = await Task.aggregate([
      { $match: { orgId: orgIdObj, status: "COMPLETED", completedAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
          dailyWaste: { $sum: "$estimatedVolume" }
        }
      },
      {
        $project: {
          date: "$_id",
          dailyWaste: 1,
          _id: 0
        }
      },
      { $sort: { date: 1 } }
    ]);

    const org = await Organization.findById(orgId);
    const timeSeriesDataRaw = timeSeriesAggregation.map(item => ({
      ...item,
      orgName: org?.name || "Organization"
    }));

    // 4. Waste Type Breakdown
    const wasteTypeDistribution = await Task.aggregate([
      { $match: { orgId: orgIdObj, status: "COMPLETED" } },
      { $group: { _id: "$wasteType", amount: { $sum: "$estimatedVolume" } } }
    ]);

    // 5. Task Status Distribution
    const taskStatusDistribution = await Task.aggregate([
      { $match: { orgId: orgIdObj } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        ecosystemStats: {
          totalOrganizations: totalDrivers, // Reusing keys for ease, will map appropriately in frontend if needed
          totalWasteCollected,
          activeVehicles,
          activeRoutes 
        },
        organizationData: driverData,
        timeSeriesDataRaw,
        wasteTypeDistribution,
        taskStatusDistribution
      }
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
