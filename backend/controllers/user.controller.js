import Task from "../models/Task.model.js";

export const requestOnDemandPickup = async (req, res) => {
  return res.status(410).json({
    message: "Legacy pickup requests are disabled. Use /api/pickups to create a payment-gated pickup request.",
  });
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

