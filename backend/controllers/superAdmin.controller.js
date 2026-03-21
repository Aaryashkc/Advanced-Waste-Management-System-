import Organization from "../models/Organization.model.js";
import User from "../models/User.model.js";
import Task from "../models/Task.model.js";
import Truck from "../models/Truck.model.js";
import Driver from "../models/Driver.model.js";
import DeletionRequest from "../models/DeletionRequest.model.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

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
    const organizations = await Organization.find()
      .populate("admins", "name email");

    // Get real fleet data from Truck collection (source of truth)
    const orgsWithFleet = await Promise.all(
      organizations.map(async (org) => {
        const trucks = await Truck.find({ orgId: org._id }).select("truckType capacity licensePlate");
        const orgObj = org.toObject();
        orgObj.fleet = trucks;
        return orgObj;
      })
    );

    res.status(200).json({
      message: "Organizations retrieved successfully",
      organizations: orgsWithFleet
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve organizations", error: error.message });
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
    // 1. Ecosystem Stats
    const totalOrganizations = await Organization.countDocuments();
    const activeVehicles = await Truck.countDocuments({ isAvailable: true });
    
    // Total Waste (sum of estimatedVolume from COMPLETED tasks)
    const wasteAggregation = await Task.aggregate([
      { $match: { status: "COMPLETED" } },
      { $group: { _id: null, totalWaste: { $sum: "$estimatedVolume" } } }
    ]);
    const totalWasteCollected = wasteAggregation.length > 0 ? wasteAggregation[0].totalWaste : 0;
    
    // Active Routes (we will use IN_PROGRESS and ASSIGNED tasks as a proxy for active routes)
    const activeRoutes = await Task.countDocuments({ status: { $in: ["ASSIGNED", "IN_PROGRESS"] } });

    // 2. Organization Data for Bar and Scatter Plots
    // Grouping tasks by organization to find their waste, routes, and trucks
    const orgs = await Organization.find();
    
    // Use aggregation to get task stats per org
    const orgStats = await Task.aggregate([
      { $match: { status: "COMPLETED" } },
      { 
        $group: { 
          _id: "$orgId", 
          wasteCollected: { $sum: "$estimatedVolume" },
          completedRoutes: { $sum: 1 } 
        } 
      }
    ]);

    // Count trucks per org
    const truckStats = await Truck.aggregate([
      { $group: { _id: "$orgId", activeVehicles: { $sum: { $cond: ["$isAvailable", 1, 0] } } } }
    ]);

    const orgData = orgs.map(org => {
      const taskStat = orgStats.find(s => String(s._id) === String(org._id)) || { wasteCollected: 0, completedRoutes: 0 };
      const trkStat = truckStats.find(s => String(s._id) === String(org._id)) || { activeVehicles: 0 };
      
      return {
        _id: org._id,
        name: org.name,
        wasteCollectedField: taskStat.wasteCollected,
        activeVehicles: trkStat.activeVehicles,
        routes: taskStat.completedRoutes
      };
    });

    // 3. Time Series Data (Last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const timeSeriesAggregation = await Task.aggregate([
      { $match: { status: "COMPLETED", completedAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            orgId: "$orgId",
            date: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } }
          },
          dailyWaste: { $sum: "$estimatedVolume" }
        }
      },
      {
        $lookup: {
          from: "organizations",
          localField: "_id.orgId",
          foreignField: "_id",
          as: "org"
        }
      },
      { $unwind: "$org" },
      {
        $project: {
          orgName: "$org.name",
          date: "$_id.date",
          dailyWaste: 1,
          _id: 0
        }
      },
      { $sort: { date: 1 } }
    ]);

    // 4. Waste Type Breakdown (Pie Chart)
    const wasteTypeAggregation = await Task.aggregate([
      { $match: { status: "COMPLETED" } },
      { $group: { _id: "$wasteType", amount: { $sum: "$estimatedVolume" } } }
    ]);

    // 5. Task Status Distribution (Doughnut Chart)
    const taskStatusAggregation = await Task.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    // Map time series to a more charting friendly format dynamically in the frontend, 
    // but we can pass the raw aggregated array here.

    res.status(200).json({
      success: true,
      data: {
        ecosystemStats: {
          totalOrganizations,
          totalWasteCollected,
          activeVehicles,
          activeRoutes // pending/assigned tasks
        },
        organizationData: orgData,
        timeSeriesDataRaw: timeSeriesAggregation,
        wasteTypeDistribution: wasteTypeAggregation,
        taskStatusDistribution: taskStatusAggregation
      }
    });

  } catch (error) {
    console.error("Error generating super admin analytics:", error);
    res.status(500).json({ success: false, message: "Failed to generate analytics", error: error.message });
  }
};

// ========== Vehicle Management ==========

export const getAllVehicles = async (req, res) => {
  try {
    const { orgId } = req.query;
    const filter = orgId ? { orgId } : {};

    const trucks = await Truck.find(filter)
      .populate("orgId", "name")
      .sort({ createdAt: -1 });

    // Find drivers assigned to each truck
    const truckIds = trucks.map(t => t._id);
    const drivers = await Driver.find({ assignedTruckId: { $in: truckIds } })
      .populate("userId", "name email");

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

    res.status(200).json({ success: true, data: formattedTrucks });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch vehicles", error: error.message });
  }
};

export const createVehicle = async (req, res) => {
  try {
    const { truckType, capacity, licensePlate, orgId } = req.body;

    if (!truckType || !capacity || !licensePlate || !orgId) {
      return res.status(400).json({ message: "truckType, capacity, licensePlate, and orgId are required" });
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

// ========== Deletion Request Approval ==========

export const getDeletionRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};

    const requests = await DeletionRequest.find(filter)
      .populate("requestedBy", "name email")
      .populate("orgId", "name")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: requests });
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
