import Schedule from "../models/Schedule.model.js";
import Truck from "../models/Truck.model.js";
import Driver from "../models/Driver.model.js";
import { buildPaginationMeta, getPagination } from "../utils/pagination.js";

/**
 * Get all schedules
 * GET /api/schedule
 * Query params: city, area, day
 */
export const getSchedules = async (req, res) => {
  try {
    const { city, area, day } = req.query;
    const pagination = getPagination(req.query);

    const filter = { isActive: true };

    // Scoping: If not super_admin, force orgId
    if (req.user.role !== 'super_admin') {
      if (req.user.orgId) {
        filter.orgId = req.user.orgId;
      }
    } else if (req.query.orgId) {
      // Super admin can filter by orgId if provided
      filter.orgId = req.query.orgId;
    }

    if (city) {
      filter.city = new RegExp(city, 'i'); // Case-insensitive search
    }

    if (area) {
      filter.area = new RegExp(area, 'i');
    }

    if (day) {
      filter.day = day;
    }

    const schedules = await Schedule.find(filter)
      .populate('truckId', 'licensePlate truckType capacity')
      .populate({
        path: 'driverId',
        populate: {
          path: 'userId',
          select: 'name'
        }
      })
      .populate('orgId', 'name')
      .sort({ day: 1, time: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();
    const total = await Schedule.countDocuments(filter);

    // Format response to match frontend expectations
    const formattedSchedules = schedules.map(schedule => ({
      id: schedule._id,
      city: schedule.city,
      area: schedule.area,
      truckName: schedule.truckId?.licensePlate || 'Unknown',
      truckId: schedule.truckId?._id ? String(schedule.truckId._id).slice(-6).toUpperCase() : null,
      truckObjectId: schedule.truckId?._id || null,
      truckType: schedule.truckType,
      driver: schedule.driverId?.userId?.name || 'Unknown',
      driverObjectId: schedule.driverId?._id || null,
      day: schedule.day,
      time: schedule.time,
      orgId: schedule.orgId?._id || schedule.orgId || null,
      orgName: schedule.orgId?.name || null,
    }));

    res.status(200).json({
      success: true,
      data: formattedSchedules,
      count: formattedSchedules.length,
      pagination: buildPaginationMeta({ ...pagination, total }),
    });
  } catch (error) {
    console.error("Get schedules error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch schedules",
      error: error.message
    });
  }
};

/**
 * Get schedule by ID
 * GET /api/schedule/:id
 */
export const getScheduleById = async (req, res) => {
  try {
    const { id } = req.params;

    const schedule = await Schedule.findById(id)
      .populate('truckId')
      .populate('driverId')
      .populate('driverId.userId', 'name email');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found"
      });
    }

    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    console.error("Get schedule by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch schedule",
      error: error.message
    });
  }
};

/**
 * Create new schedule
 * POST /api/schedule
 * Body: { city, area, truckId, driverId, day, time, truckType, orgId }
 */
export const createSchedule = async (req, res) => {
  try {
    const { city, area, truckId, day, time, truckType, orgId } = req.body;

    // Validation — driverId no longer required, auto-resolved from truck
    if (!city || !area || !truckId || !day || !time || !truckType || !orgId) {
      return res.status(400).json({
        success: false,
        message: "city, area, truckId, day, time, truckType, and orgId are required"
      });
    }

    // Validate truck exists
    const truck = await Truck.findById(truckId);
    if (!truck) {
      return res.status(404).json({
        success: false,
        message: "Truck not found"
      });
    }

    // Auto-resolve driver: find driver assigned to this truck
    let driverId = req.body.driverId || null;
    if (!driverId) {
      const assignedDriver = await Driver.findOne({ assignedTruckId: truckId });
      if (!assignedDriver) {
        return res.status(400).json({
          success: false,
          message: "No driver is assigned to this truck. Please assign a driver to the truck first."
        });
      }
      driverId = assignedDriver._id;
    } else {
      // Validate explicitly provided driverId
      const driver = await Driver.findById(driverId);
      if (!driver) {
        return res.status(404).json({ success: false, message: "Driver not found" });
      }
    }

    const schedule = new Schedule({
      city,
      area,
      truckId,
      driverId,
      day,
      time,
      truckType,
      orgId
    });

    await schedule.save();

    const populatedSchedule = await Schedule.findById(schedule._id)
      .populate('truckId')
      .populate({ path: 'driverId', populate: { path: 'userId', select: 'name' } });

    res.status(201).json({
      success: true,
      message: "Schedule created successfully",
      data: populatedSchedule
    });
  } catch (error) {
    console.error("Create schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create schedule",
      error: error.message
    });
  }
};

/**
 * Update schedule
 * PUT /api/schedule/:id
 */
export const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const schedule = await Schedule.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    )
      .populate('truckId')
      .populate('driverId');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Schedule updated successfully",
      data: schedule
    });
  } catch (error) {
    console.error("Update schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update schedule",
      error: error.message
    });
  }
};

/**
 * Delete schedule (soft delete)
 * DELETE /api/schedule/:id
 */
export const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    const schedule = await Schedule.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Schedule deleted successfully"
    });
  } catch (error) {
    console.error("Delete schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete schedule",
      error: error.message
    });
  }
};

