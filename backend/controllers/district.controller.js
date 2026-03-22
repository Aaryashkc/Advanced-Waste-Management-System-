import District from "../models/District.model.js";
import Organization from "../models/Organization.model.js";

/**
 * Get all districts
 * GET /api/districts
 * Super admin: all districts. Admin: only districts matching their orgId.
 */
export const getDistricts = async (req, res) => {
  try {
    const filter = { isActive: true };

    // Scoping: If not super_admin, force orgId
    if (req.user.role !== "super_admin") {
      if (req.user.orgId) {
        filter.orgId = req.user.orgId;
      }
    } else if (req.query.orgId) {
      // Super admin can filter by orgId if provided
      filter.orgId = req.query.orgId;
    }

    const districts = await District.find(filter)
      .populate("orgId", "name")
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: districts,
      count: districts.length,
    });
  } catch (error) {
    console.error("Get districts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch districts",
      error: error.message,
    });
  }
};

/**
 * Get single district by ID
 * GET /api/districts/:id
 */
export const getDistrictById = async (req, res) => {
  try {
    const { id } = req.params;

    const district = await District.findById(id)
      .populate("orgId", "name");

    if (!district) {
      return res.status(404).json({
        success: false,
        message: "District not found",
      });
    }

    res.status(200).json({
      success: true,
      data: district,
    });
  } catch (error) {
    console.error("Get district by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch district",
      error: error.message,
    });
  }
};

/**
 * Create district (super_admin only)
 * POST /api/districts
 * Body: { name, type, coordinates, orgId }
 */
export const createDistrict = async (req, res) => {
  try {
    const { name, type, province, coordinates, orgId } = req.body;

    if (!name || !type || !province) {
      return res.status(400).json({
        success: false,
        message: "name, type, and province are required",
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

    const district = new District({
      name,
      type,
      province,
      coordinates: coordinates || {},
      orgId: orgId || null,
    });

    await district.save();

    const populatedDistrict = await District.findById(district._id)
      .populate("orgId", "name");

    res.status(201).json({
      success: true,
      message: "District created successfully",
      data: populatedDistrict,
    });
  } catch (error) {
    console.error("Create district error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create district",
      error: error.message,
    });
  }
};

/**
 * Update district (super_admin only)
 * PUT /api/districts/:id
 */
export const updateDistrict = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const district = await District.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).populate("orgId", "name");

    if (!district) {
      return res.status(404).json({
        success: false,
        message: "District not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "District updated successfully",
      data: district,
    });
  } catch (error) {
    console.error("Update district error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update district",
      error: error.message,
    });
  }
};

/**
 * Soft delete district (set isActive: false) (super_admin only)
 * DELETE /api/districts/:id
 */
export const deleteDistrict = async (req, res) => {
  try {
    const { id } = req.params;

    const district = await District.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );

    if (!district) {
      return res.status(404).json({
        success: false,
        message: "District not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "District deleted successfully",
    });
  } catch (error) {
    console.error("Delete district error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete district",
      error: error.message,
    });
  }
};
