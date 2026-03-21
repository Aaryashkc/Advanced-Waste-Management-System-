import Task from "../models/Task.model.js";
import User from "../models/User.model.js";

export const requestOnDemandPickup = async (req, res) => {
  try {
    const { wasteType, estimatedVolume, location, scheduledDate } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!wasteType || !location || !location.latitude || !location.longitude) {
      return res.status(400).json({ 
        message: "Waste type and location (with coordinates) are required" 
      });
    }

    if (!user.orgId) {
      return res.status(400).json({ 
        message: "User must be associated with an organization" 
      });
    }

    const task = new Task({
      taskType: "ON_DEMAND",
      wasteType,
      estimatedVolume: estimatedVolume || 100,
      location,
      status: "PENDING",
      orgId: user.orgId,
      requestedBy: userId,
      scheduledDate: scheduledDate || null
    });

    await task.save();

    res.status(201).json({
      message: "On-demand pickup request created successfully",
      task
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create pickup request", error: error.message });
  }
};

export const trackRequestStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user._id;

    const task = await Task.findById(taskId)
      .populate("assignedDriverId", "userId")
      .populate("assignedTruckId", "truckType capacity licensePlate");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (task.requestedBy && task.requestedBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized access to task" });
    }

    res.status(200).json({
      message: "Request status retrieved successfully",
      task: {
        id: task._id,
        taskType: task.taskType,
        wasteType: task.wasteType,
        status: task.status,
        location: task.location,
        estimatedVolume: task.estimatedVolume,
        assignedDriver: task.assignedDriverId,
        assignedTruck: task.assignedTruckId,
        scheduledDate: task.scheduledDate,
        completedAt: task.completedAt,
        createdAt: task.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to track request status", error: error.message });
  }
};

