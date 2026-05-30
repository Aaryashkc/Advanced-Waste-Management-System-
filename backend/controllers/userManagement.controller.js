import User from "../models/User.model.js";
import { buildPaginationMeta, getPagination } from "../utils/pagination.js";
import { backfillUnassignedUsersForOrg } from "../services/userOrgResolver.js";

function isOrgAdmin(req) {
  return req.user?.role === "admin";
}

function applyUserScope(req, filter = {}) {
  if (!isOrgAdmin(req)) return filter;
  if (!req.user.orgId) return { ...filter, _id: null };
  return {
    ...filter,
    orgId: req.user.orgId,
    role: filter.role || { $ne: "super_admin" },
  };
}

function assertCanManageUser(req, user, nextRole) {
  if (!isOrgAdmin(req)) return null;

  if (!req.user.orgId || user.orgId?.toString() !== req.user.orgId.toString()) {
    return { status: 403, message: "You can only manage users in your organization" };
  }

  if (user.role === "super_admin") {
    return { status: 403, message: "Cannot manage super admin users" };
  }

  if (nextRole !== undefined && nextRole !== user.role) {
    return { status: 403, message: "Organization admins cannot change user roles" };
  }

  return null;
}

export const getAllUsers = async (req, res) => {
  try {
    const {
      search = "",
      role = "",
      status = "",
      sort = "-createdAt",
    } = req.query;
    const pagination = getPagination(req.query);

    const filter = {};

    // Search by name, email, or phone
    if (search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    if (role) filter.role = role;

    if (status === "active") filter.isActive = true;
    else if (status === "inactive") filter.isActive = false;

    if (isOrgAdmin(req)) {
      await backfillUnassignedUsersForOrg(req.user.orgId);
    }

    const scopedFilter = applyUserScope(req, filter);

    const [users, total] = await Promise.all([
      User.find(scopedFilter)
        .select("-passwordHash -loginOtp -twoFactor")
        .populate("orgId", "name")
        .sort(sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      User.countDocuments(scopedFilter),
    ]);

    // Role counts for stats
    const [roleCounts, activeCount] = await Promise.all([
      User.aggregate([
        { $match: applyUserScope(req, {}) },
        { $group: { _id: "$role", count: { $sum: 1 } } },
      ]),
      User.countDocuments(applyUserScope(req, { isActive: true })),
    ]);

    const stats = {
      total: await User.countDocuments(applyUserScope(req, {})),
      active: activeCount,
      byRole: {},
    };
    roleCounts.forEach((r) => {
      stats.byRole[r._id] = r.count;
    });

    res.json({
      users: users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone || null,
        role: u.role,
        isActive: u.isActive,
        emailVerified: u.emailVerified,
        organization: u.orgId ? { id: u.orgId._id, name: u.orgId.name } : null,
        address: u.address,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      pagination: buildPaginationMeta({ ...pagination, total }),
      stats,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, role, isActive, address } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const accessError = assertCanManageUser(req, user, role);
    if (accessError) return res.status(accessError.status).json({ message: accessError.message });

    // Prevent modifying super_admin role
    if (user.role === "super_admin" && role && role !== "super_admin") {
      return res.status(403).json({ message: "Cannot change super admin role" });
    }

    // Check email uniqueness if changing
    if (email && email !== user.email) {
      const existing = await User.findOne({ email, _id: { $ne: userId } });
      if (existing) return res.status(400).json({ message: "Email already in use" });
    }

    // Check phone uniqueness if changing
    if (phone && phone !== user.phone) {
      const existing = await User.findOne({ phone, _id: { $ne: userId } });
      if (existing) return res.status(400).json({ message: "Phone number already in use" });
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone || null;
    if (role !== undefined && !isOrgAdmin(req)) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (address !== undefined) user.address = address;

    await user.save();

    res.json({
      success: true,
      message: "User updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        address: user.address,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update user", error: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select("-passwordHash -loginOtp -twoFactor")
      .populate("orgId", "name")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });
    if (isOrgAdmin(req) && (!req.user.orgId || user.orgId?._id?.toString() !== req.user.orgId.toString())) {
      return res.status(403).json({ message: "You can only view users in your organization" });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      organization: user.orgId ? { id: user.orgId._id, name: user.orgId.name } : null,
      address: user.address,
      location: user.location,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user", error: error.message });
  }
};
