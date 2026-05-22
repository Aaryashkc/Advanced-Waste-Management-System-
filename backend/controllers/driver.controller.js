import Task from "../models/Task.model.js";
import Driver from "../models/Driver.model.js";
import Truck from "../models/Truck.model.js";
import User from "../models/User.model.js";
import { validateCoordinates } from "../utils/coordinateValidator.js";
import { buildPaginationMeta, getPagination } from "../utils/pagination.js";

// ── GET /api/driver/me ────────────────────────────────────────────────────
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const driver = await Driver.findOne({ userId })
      .populate({
        path: "assignedTruckId",
        select: "truckType capacity licensePlate dutyType isAvailable orgId",
        populate: { path: "orgId", select: "name" },
      });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    const userDoc = await User.findById(userId)
      .select("name email phone orgId")
      .populate("orgId", "name");

    const truck = driver.assignedTruckId;

    res.status(200).json({
      driver: {
        id: driver._id,
        name: userDoc?.name || "Unknown",
        email: userDoc?.email || null,
        phone: userDoc?.phone || null,
        isAvailable: driver.isAvailable,
        currentLocation: driver.currentLocation || null,
        organization: {
          id: userDoc?.orgId?._id || null,
          name: userDoc?.orgId?.name || "Unassigned",
        },
        truck: truck
          ? {
              id: truck._id,
              truckType: truck.truckType,
              capacity: truck.capacity,
              licensePlate: truck.licensePlate,
              dutyType: truck.dutyType,
              isAvailable: truck.isAvailable,
              organization: truck.orgId?.name || null,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("getMyProfile error:", error);
    res.status(500).json({ message: "Failed to fetch profile", error: error.message });
  }
};


export const getAssignedTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    const driver = await Driver.findOne({ userId });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    const tasks = await Task.find({
      assignedDriverId: driver._id,
      status: { $in: ["ASSIGNED", "IN_PROGRESS"] }
    })
      .populate("assignedTruckId", "truckType capacity licensePlate")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Assigned tasks retrieved successfully",
      tasks
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve tasks", error: error.message });
  }
};

export const acceptTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user._id;
    const driver = await Driver.findOne({ userId });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.assignedDriverId.toString() !== driver._id.toString()) {
      return res.status(403).json({ message: "Task not assigned to this driver" });
    }

    if (task.status !== "ASSIGNED") {
      return res.status(400).json({ message: "Task is not in ASSIGNED status" });
    }

    task.status = "IN_PROGRESS";
    await task.save();

    res.status(200).json({
      message: "Task accepted and started",
      task
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to accept task", error: error.message });
  }
};

export const completeTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user._id;
    const driver = await Driver.findOne({ userId });

    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.assignedDriverId.toString() !== driver._id.toString()) {
      return res.status(403).json({ message: "Task not assigned to this driver" });
    }

    if (task.status !== "IN_PROGRESS") {
      return res.status(400).json({ message: "Task must be IN_PROGRESS to complete" });
    }

    task.status = "COMPLETED";
    task.completedAt = new Date();
    await task.save();

    if (task.assignedTruckId) {
      const truck = await Truck.findById(task.assignedTruckId);
      if (truck) {
        truck.isAvailable = true;
        await truck.save();
      }
    }

    driver.isAvailable = true;
    await driver.save();

    res.status(200).json({
      message: "Task completed successfully",
      task
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to complete task", error: error.message });
  }
};

export const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    const userId = req.user._id;

    const coordinates = validateCoordinates(latitude, longitude, {
      latitudeLabel: "Latitude",
      longitudeLabel: "longitude",
    });
    if (!coordinates.ok) {
      return res.status(400).json({ message: coordinates.message });
    }

    const driver = await Driver.findOne({ userId });
    if (!driver) {
      return res.status(404).json({ message: "Driver profile not found" });
    }

    driver.currentLocation = {
      latitude: coordinates.coordinates.latitude,
      longitude: coordinates.coordinates.longitude,
      address: address || driver.currentLocation?.address
    };

    await driver.save();

    res.status(200).json({
      message: "Location updated successfully",
      location: driver.currentLocation
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update location", error: error.message });
  }
};

export const getAllDrivers = async (req, res) => {
  try {
    const { orgId } = req.user;
    const pagination = getPagination(req.query);

    let userFilter = { role: 'driver' };

    // Scoping
    if (req.user.role !== 'super_admin') {
      userFilter.orgId = orgId;
    } else if (req.query.orgId) {
      userFilter.orgId = req.query.orgId;
    }

    // 1. Find users who are drivers (with org populated)
    const driverUsers = await User.find(userFilter)
      .select('_id orgId')
      .populate('orgId', 'name')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();
    const total = await User.countDocuments(userFilter);
    const driverUserIds = driverUsers.map(u => u._id);

    // Build a map of userId -> org info
    const userOrgMap = {};
    driverUsers.forEach(u => {
      userOrgMap[u._id.toString()] = {
        orgId: u.orgId?._id || null,
        orgName: u.orgId?.name || "Unassigned"
      };
    });

    // 2. Find Driver profiles for these users
    const drivers = await Driver.find({ userId: { $in: driverUserIds } })
      .populate('userId', 'name email phone')
      .populate({
        path: 'assignedTruckId',
        select: 'licensePlate truckType capacity orgId',
        populate: { path: 'orgId', select: 'name' }
      })
      .lean();

    // Format for frontend
    const formattedDrivers = drivers.map(d => {
      const userOrg = userOrgMap[d.userId?._id?.toString()] || {};
      const truckOrg = d.assignedTruckId?.orgId; // populated org from the truck

      // Vehicle's org takes priority over driver's own org
      const displayOrg = truckOrg?.name || userOrg.orgName || "Unassigned";
      const displayOrgId = truckOrg?._id || userOrg.orgId || null;

      return {
        id: d._id,
        name: d.userId?.name || 'Unknown',
        email: d.userId?.email,
        phone: d.userId?.phone,
        status: d.isAvailable ? 'Available' : 'Busy',
        currentTask: d.currentTask || null,
        truck: d.assignedTruckId?.licensePlate || 'No Truck',
        truckType: d.assignedTruckId?.truckType || null,
        truckId: d.assignedTruckId?._id || null,
        organization: displayOrg,
        orgId: displayOrgId
      };
    });

    res.status(200).json({
      success: true,
      data: formattedDrivers,
      pagination: buildPaginationMeta({ ...pagination, total }),
    });

  } catch (error) {
    console.error("Get all drivers error:", error);
    res.status(500).json({ message: "Failed to fetch drivers", error: error.message });
  }
};

