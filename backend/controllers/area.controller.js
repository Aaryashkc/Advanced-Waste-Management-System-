import Area from "../models/Area.model.js";
import Organization from "../models/Organization.model.js";
import { buildPaginationMeta, getPagination } from "../utils/pagination.js";

/**
 * Get all areas
 * GET /api/areas
 * Super admin: all areas. Admin: only areas matching their orgId.
 */
export const getAreas = async (req, res) => {
  try {
    const filter = { isActive: true };
    const pagination = getPagination(req.query);

    // Scoping: If not super_admin, force orgId
    if (req.user.role !== "super_admin") {
      if (req.user.orgId) {
        filter.orgId = req.user.orgId;
      }
    } else if (req.query.orgId) {
      // Super admin can filter by orgId if provided
      filter.orgId = req.query.orgId;
    }

    const areas = await Area.find(filter)
      .select("name type coordinates address scaleFactor isActive orgId createdAt updatedAt")
      .populate("orgId", "name")
      .sort({ name: 1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();
    const total = await Area.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: areas,
      count: areas.length,
      pagination: buildPaginationMeta({ ...pagination, total }),
    });
  } catch (error) {
    console.error("Get areas error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch areas",
      error: error.message,
    });
  }
};

/**
 * Get single area by ID
 * GET /api/areas/:id
 */
export const getAreaById = async (req, res) => {
  try {
    const { id } = req.params;

    const area = await Area.findById(id)
      .populate("orgId", "name");

    if (!area) {
      return res.status(404).json({
        success: false,
        message: "Area not found",
      });
    }

    res.status(200).json({
      success: true,
      data: area,
    });
  } catch (error) {
    console.error("Get area by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch area",
      error: error.message,
    });
  }
};

/**
 * Create area (super_admin only)
 * POST /api/areas
 * Body: { name, type, coordinates, orgId }
 */
export const createArea = async (req, res) => {
  try {
    const { name, type, coordinates, orgId, address, scaleFactor } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: "name and type are required",
      });
    }

    // Validate orgId if provided
    if (orgId) {
      const org = await Organization.findById(orgId);
      if (!org) {
        return res.status(404).json({
          success: false,
          message: "Organization not found",
        });
      }
    }

    const area = new Area({
      name,
      type,
      coordinates: coordinates || {},
      address: address || "",
      scaleFactor: scaleFactor || 1.0,
      orgId: orgId || null,
    });

    await area.save();

    const populatedArea = await Area.findById(area._id)
      .populate("orgId", "name");

    res.status(201).json({
      success: true,
      message: "Area created successfully",
      data: populatedArea,
    });
  } catch (error) {
    console.error("Create area error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create area",
      error: error.message,
    });
  }
};

/**
 * Update area (super_admin only)
 * PUT /api/areas/:id
 */
export const updateArea = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const area = await Area.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).populate("orgId", "name");

    if (!area) {
      return res.status(404).json({
        success: false,
        message: "Area not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Area updated successfully",
      data: area,
    });
  } catch (error) {
    console.error("Update area error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update area",
      error: error.message,
    });
  }
};

/**
 * Soft delete area (set isActive: false) (super_admin only)
 * DELETE /api/areas/:id
 */
export const deleteArea = async (req, res) => {
  try {
    const { id } = req.params;

    const area = await Area.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );

    if (!area) {
      return res.status(404).json({
        success: false,
        message: "Area not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Area deleted successfully",
    });
  } catch (error) {
    console.error("Delete area error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete area",
      error: error.message,
    });
  }
};
