import React, { useEffect, useState } from "react";
import useUserStore from "../stores/useUserStore";
import {
  Users as UsersIcon,
  Search,
  X,
  Mail,
  Phone,
  Calendar,
  Building2,
  Shield,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  Eye,
  MapPin,
} from "lucide-react";
import StatsCard from "../components/dashboard/StatsCard";

const ROLES = [
  { value: "", label: "All Roles" },
  { value: "customer_admin", label: "Customer" },
  { value: "driver", label: "Driver" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

const STATUSES = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const ROLE_STYLES = {
  super_admin: "bg-violet-100 text-violet-700",
  admin: "bg-blue-100 text-blue-700",
  driver: "bg-amber-100 text-amber-700",
  customer_admin: "bg-primary/8 text-primary",
};

const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  driver: "Driver",
  customer_admin: "Customer",
};

const Users = () => {
  const { users, stats, pagination, isLoading, error, fetchUsers, updateUser } = useUserStore();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [viewUser, setViewUser] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users when filters change
  useEffect(() => {
    fetchUsers({
      search: debouncedSearch,
      role: roleFilter,
      status: statusFilter,
      page,
      limit: 10,
    });
  }, [debouncedSearch, roleFilter, statusFilter, page, fetchUsers]);

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({
      name: u.name,
      email: u.email,
      phone: u.phone || "",
      role: u.role,
      isActive: u.isActive,
      address: u.address || "",
    });
    setFormError("");
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!editForm.name || !editForm.email) {
      setFormError("Name and email are required");
      return;
    }
    setSubmitting(true);
    const result = await updateUser(editUser.id, editForm);
    setSubmitting(false);
    if (result.success) {
      setEditUser(null);
    } else {
      setFormError(result.error);
    }
  };

  const toggleActive = async (u) => {
    await updateUser(u.id, { isActive: !u.isActive });
    fetchUsers({ search: debouncedSearch, role: roleFilter, status: statusFilter, page, limit: 10 });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">User Management</h1>
        <p className="text-sm text-primary/50 mt-1">
          View and manage all registered users across the platform
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            title="Total Users"
            value={stats.total}
            label="All registered accounts"
            icon={<UsersIcon className="w-5 h-5 text-primary" />}
            iconBg="bg-primary/8"
          />
          <StatsCard
            title="Active Users"
            value={stats.active}
            label="Currently active"
            icon={<UserCheck className="w-5 h-5 text-emerald-600" />}
            iconBg="bg-emerald-100"
          />
          <StatsCard
            title="Customers"
            value={stats.byRole?.customer_admin || 0}
            label="Customer accounts"
            icon={<UsersIcon className="w-5 h-5 text-blue-600" />}
            iconBg="bg-blue-100"
          />
          <StatsCard
            title="Drivers"
            value={stats.byRole?.driver || 0}
            label="Driver accounts"
            icon={<UsersIcon className="w-5 h-5 text-amber-600" />}
            iconBg="bg-amber-100"
          />
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-primary/12 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm text-primary placeholder:text-primary/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary/60"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 rounded-xl border border-primary/12 bg-white text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 rounded-xl border border-primary/12 bg-white text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 bg-white rounded-2xl border border-primary/10">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-6 bg-white rounded-2xl border border-primary/10 text-primary/50 text-center text-sm">
          {error}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-primary/8 bg-primary/3">
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">User</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Contact</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Role</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Joined</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-primary/30 text-sm">
                      {debouncedSearch || roleFilter || statusFilter
                        ? "No users match your filters."
                        : "No users found."}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-primary/5 hover:bg-primary/2 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${ROLE_STYLES[u.role] || "bg-primary/8 text-primary"}`}>
                            {u.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-primary text-sm block truncate">{u.name}</span>
                            {u.organization && (
                              <span className="text-xs text-primary/40 flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {u.organization.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-0.5">
                          <span className="text-sm text-primary/60 flex items-center gap-1">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[180px]">{u.email}</span>
                          </span>
                          {u.phone && (
                            <span className="text-sm text-primary/60 flex items-center gap-1">
                              <Phone className="w-3 h-3 shrink-0" />
                              {u.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_STYLES[u.role]}`}>
                          {u.role === "super_admin" && <Shield className="w-3 h-3" />}
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-primary/40 whitespace-nowrap">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "--"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setViewUser(u)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEdit(u)}
                            className="px-3 py-1.5 text-xs font-semibold text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition"
                          >
                            Edit
                          </button>
                          {u.role !== "super_admin" && (
                            <button
                              onClick={() => toggleActive(u)}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                u.isActive
                                  ? "text-red-600 bg-red-50 hover:bg-red-100"
                                  : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                              }`}
                            >
                              {u.isActive ? "Deactivate" : "Activate"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="px-5 py-3 border-t border-primary/8 bg-primary/2 flex items-center justify-between">
              <span className="text-xs text-primary/40">
                Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-primary/5 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 text-primary/60" />
                </button>
                {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
                  let pageNum;
                  if (pagination.pages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= pagination.pages - 2) {
                    pageNum = pagination.pages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                        page === pageNum
                          ? "bg-primary text-white"
                          : "text-primary/60 hover:bg-primary/5"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="p-1.5 rounded-lg hover:bg-primary/5 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4 text-primary/60" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View User Modal */}
      {viewUser && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg p-7 relative mx-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setViewUser(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold ${ROLE_STYLES[viewUser.role]}`}>
                {viewUser.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <h2 className="text-lg font-bold text-primary">{viewUser.name}</h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1 ${ROLE_STYLES[viewUser.role]}`}>
                  {viewUser.role === "super_admin" && <Shield className="w-3 h-3" />}
                  {ROLE_LABELS[viewUser.role]}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <DetailRow icon={<Mail className="w-4 h-4 text-primary/50" />} label="Email" value={viewUser.email} />
              <DetailRow icon={<Phone className="w-4 h-4 text-primary/50" />} label="Phone" value={viewUser.phone || "Not provided"} />
              <DetailRow
                icon={<Building2 className="w-4 h-4 text-primary/50" />}
                label="Organization"
                value={viewUser.organization?.name || "None"}
              />
              <DetailRow
                icon={<MapPin className="w-4 h-4 text-primary/50" />}
                label="Address"
                value={viewUser.address || "Not provided"}
              />
              <DetailRow
                icon={<Calendar className="w-4 h-4 text-primary/50" />}
                label="Joined"
                value={viewUser.createdAt ? new Date(viewUser.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Unknown"}
              />
              <DetailRow
                icon={<Calendar className="w-4 h-4 text-primary/50" />}
                label="Last Login"
                value={viewUser.lastLoginAt ? new Date(viewUser.lastLoginAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"}
              />

              <div className="pt-3 border-t border-primary/10 flex items-center gap-3">
                <span className="text-xs font-medium text-primary/40">Status:</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  viewUser.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${viewUser.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                  {viewUser.isActive ? "Active" : "Inactive"}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  viewUser.emailVerified ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"
                }`}>
                  {viewUser.emailVerified ? "Email Verified" : "Email Unverified"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setViewUser(null); openEdit(viewUser); }}
                className="flex-1 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition"
              >
                Edit User
              </button>
              <button
                onClick={() => setViewUser(null)}
                className="px-6 py-2.5 bg-primary/5 text-primary font-semibold text-sm rounded-xl hover:bg-primary/10 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-7 relative mx-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditUser(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-primary mb-5">Edit User</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Phone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="98XXXXXXXX"
                  className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="User address"
                  className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  disabled={editUser.role === "super_admin"}
                  className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm disabled:opacity-50"
                >
                  <option value="customer_admin">Customer</option>
                  <option value="driver">Driver</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-primary/60">Active</label>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    editForm.isActive ? "bg-emerald-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      editForm.isActive ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/2 border border-primary/5">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-primary/40 uppercase tracking-wider">{label}</p>
        <div className="text-sm font-medium text-primary mt-0.5 break-all">{value}</div>
      </div>
    </div>
  );
}

export default Users;
