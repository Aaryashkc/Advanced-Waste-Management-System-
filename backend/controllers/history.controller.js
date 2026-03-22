import PickupRequest from "../models/PickupRequest.model.js";
import User from "../models/User.model.js";
import Driver from "../models/Driver.model.js";

/**
 * GET /api/history/pickups
 * Returns all pickup history — super_admin sees all, admin sees org-scoped
 */
export const getPickupHistory = async (req, res) => {
  try {
    const { role, orgId } = req.user;
    const { status, category, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (role === "admin" && orgId) {
      filter.orgId = orgId;
    }
    if (status) filter.status = status;
    if (category) filter.category = category;

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
        ? { name: p.customerId.name, email: p.customerId.email, phone: p.customerId.phone }
        : null,
      driver: p.driverId
        ? { name: p.driverId.name, email: p.driverId.email, phone: p.driverId.phone }
        : null,
      driverInfo: p.driverInfo,
      organization: p.orgId?.name || "N/A",
      location: p.location,
      province: p.province,
      district: p.district,
      category: p.category,
      level: p.level,
      status: p.status,
      createdAt: p.createdAt,
      assignedAt: p.assignedAt,
      updatedAt: p.updatedAt,
    }));

    // Summary stats
    const allForStats = await PickupRequest.find(
      role === "admin" && orgId ? { orgId } : {}
    ).lean();

    const stats = {
      total: allForStats.length,
      completed: allForStats.filter((p) => p.status === "COMPLETED").length,
      cancelled: allForStats.filter((p) => p.status === "CANCELLED").length,
      expired: allForStats.filter((p) => p.status === "EXPIRED").length,
      active: allForStats.filter((p) =>
        ["PENDING", "ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING"].includes(p.status)
      ).length,
    };

    res.status(200).json({
      success: true,
      data: {
        pickups: formatted,
        stats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get pickup history error:", error);
    res.status(500).json({ message: "Failed to fetch pickup history", error: error.message });
  }
};

/**
 * GET /api/history/customers
 * Returns customer pickup stats — super_admin sees all, admin sees org-scoped
 */
export const getCustomerHistory = async (req, res) => {
  try {
    const { role, orgId } = req.user;

    const pickupFilter = {};
    if (role === "admin" && orgId) {
      pickupFilter.orgId = orgId;
    }

    const allPickups = await PickupRequest.find(pickupFilter)
      .populate("customerId", "name email phone")
      .lean();

    // Aggregate by customer
    const customerMap = {};
    for (const p of allPickups) {
      const cId = p.customerId?._id?.toString() || "unknown";
      if (!customerMap[cId]) {
        customerMap[cId] = {
          customerId: cId,
          name: p.customerId?.name || "Unknown",
          email: p.customerId?.email || "",
          phone: p.customerId?.phone || "",
          totalPickups: 0,
          completed: 0,
          cancelled: 0,
          expired: 0,
          active: 0,
          categories: { recyclable: 0, "non-recyclable": 0, both: 0 },
          lastPickupAt: null,
        };
      }
      const c = customerMap[cId];
      c.totalPickups++;
      if (p.status === "COMPLETED") c.completed++;
      else if (p.status === "CANCELLED") c.cancelled++;
      else if (p.status === "EXPIRED") c.expired++;
      else if (["PENDING", "ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING"].includes(p.status))
        c.active++;
      if (p.category) c.categories[p.category] = (c.categories[p.category] || 0) + 1;
      if (!c.lastPickupAt || new Date(p.createdAt) > new Date(c.lastPickupAt)) {
        c.lastPickupAt = p.createdAt;
      }
    }

    const customers = Object.values(customerMap).sort((a, b) => b.totalPickups - a.totalPickups);

    res.status(200).json({
      success: true,
      data: {
        customers,
        totalCustomers: customers.length,
        totalPickups: allPickups.length,
      },
    });
  } catch (error) {
    console.error("Get customer history error:", error);
    res.status(500).json({ message: "Failed to fetch customer history", error: error.message });
  }
};

/**
 * GET /api/history/drivers
 * Returns driver pickup stats — super_admin sees all, admin sees org-scoped
 */
export const getDriverHistory = async (req, res) => {
  try {
    const { role, orgId } = req.user;

    const pickupFilter = {};
    if (role === "admin" && orgId) {
      pickupFilter.orgId = orgId;
    }

    const allPickups = await PickupRequest.find(pickupFilter)
      .populate("driverId", "name email phone")
      .lean();

    // Only pickups that have a driver assigned
    const assignedPickups = allPickups.filter((p) => p.driverId);

    // Build a map of userId -> Driver._id for linking to detail page
    const userIds = [...new Set(assignedPickups.map((p) => p.driverId?._id?.toString()).filter(Boolean))];
    const driverDocs = await Driver.find({ userId: { $in: userIds } }).select("_id userId").lean();
    const userToDriverId = {};
    for (const d of driverDocs) {
      userToDriverId[d.userId.toString()] = d._id.toString();
    }

    const driverMap = {};
    for (const p of assignedPickups) {
      const dId = p.driverId?._id?.toString() || "unknown";
      if (!driverMap[dId]) {
        driverMap[dId] = {
          driverId: userToDriverId[dId] || dId,
          userId: dId,
          name: p.driverId?.name || "Unknown",
          email: p.driverId?.email || "",
          phone: p.driverId?.phone || "",
          totalPickups: 0,
          completed: 0,
          cancelled: 0,
          active: 0,
          categories: { recyclable: 0, "non-recyclable": 0, both: 0 },
          lastPickupAt: null,
        };
      }
      const d = driverMap[dId];
      d.totalPickups++;
      if (p.status === "COMPLETED") d.completed++;
      else if (p.status === "CANCELLED") d.cancelled++;
      else if (["ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING"].includes(p.status)) d.active++;
      if (p.category) d.categories[p.category] = (d.categories[p.category] || 0) + 1;
      if (!d.lastPickupAt || new Date(p.createdAt) > new Date(d.lastPickupAt)) {
        d.lastPickupAt = p.createdAt;
      }
    }

    const drivers = Object.values(driverMap).sort((a, b) => b.totalPickups - a.totalPickups);

    res.status(200).json({
      success: true,
      data: {
        drivers,
        totalDrivers: drivers.length,
        totalPickups: assignedPickups.length,
      },
    });
  } catch (error) {
    console.error("Get driver history error:", error);
    res.status(500).json({ message: "Failed to fetch driver history", error: error.message });
  }
};
