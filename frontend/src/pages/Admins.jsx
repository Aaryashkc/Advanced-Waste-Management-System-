import React, { useEffect, useState, useMemo } from "react";
import useAdminStore from "../stores/useAdminStore";
import useAuthStore from "../stores/useAuthStore";
import { UserCog, Users, Building2, Shield, Search, ChevronRight, Mail, Phone, Calendar, X, Eye } from "lucide-react";
import StatsCard from "../components/dashboard/StatsCard";

const Admins = () => {
  const { admins, orgName, orgGroups, isLoading, error, fetchAdmins, createAdmin, updateAdmin, deleteAdmin } = useAdminStore();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";

  const [showAdd, setShowAdd] = useState(false);
  const [editAdmin, setEditAdmin] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewAdmin, setViewAdmin] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [editForm, setEditForm] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const filteredAdmins = useMemo(() => {
    let result = admins;

    if (roleFilter !== "all") {
      result = result.filter(a => a.role === roleFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.phone?.includes(q) ||
        a.organization?.name?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [admins, searchQuery, roleFilter]);

  // For super admin: filter orgGroups based on search/role
  const filteredOrgGroups = useMemo(() => {
    if (!isSuperAdmin || !orgGroups) return null;
    return orgGroups
      .map(group => ({
        ...group,
        admins: group.admins.filter(a => {
          if (roleFilter !== "all" && a.role !== roleFilter) return false;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return a.name?.toLowerCase().includes(q) ||
              a.email?.toLowerCase().includes(q) ||
              a.phone?.includes(q) ||
              a.organization?.name?.toLowerCase().includes(q);
          }
          return true;
        })
      }))
      .filter(group => group.admins.length > 0);
  }, [isSuperAdmin, orgGroups, searchQuery, roleFilter]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.name || !form.email || !form.password) { setFormError("Name, email, and password are required"); return; }
    setSubmitting(true);
    const result = await createAdmin(form);
    setSubmitting(false);
    if (result.success) { setShowAdd(false); setForm({ name: "", email: "", phone: "", password: "" }); }
    else setFormError(result.error);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    const result = await updateAdmin(editAdmin.id, editForm);
    setSubmitting(false);
    if (result.success) setEditAdmin(null);
    else setFormError(result.error);
  };

  const openEdit = (a) => {
    setEditAdmin(a);
    setEditForm({ name: a.name, email: a.email, phone: a.phone });
    setFormError("");
  };

  // Derived stats
  const totalAdmins = admins.length;
  const orgSet = new Set(admins.map(a => a.organization?.name).filter(Boolean));
  const superAdminCount = admins.filter(a => a.role === "super_admin").length;
  const recentCount = admins.filter(a => {
    if (!a.createdAt) return false;
    const diff = Date.now() - new Date(a.createdAt).getTime();
    return diff < 30 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Admin Management</h1>
          <p className="text-sm text-primary/50 mt-1">
            {isSuperAdmin
              ? "Full visibility and control over all admins across organizations"
              : <>Manage admins for <strong>{orgName}</strong></>
            }
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setFormError(""); }}
          className="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <span className="text-lg leading-none">+</span> Add Admin
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Total Admins"
          value={totalAdmins}
          label="Active accounts"
          icon={<Users className="w-5 h-5 text-primary" />}
          iconBg="bg-primary/8"
        />
        <StatsCard
          title="Organizations"
          value={isSuperAdmin ? orgSet.size || "All" : orgName || "--"}
          label={isSuperAdmin ? "Across organizations" : "Current org"}
          icon={<Building2 className="w-5 h-5 text-blue-600" />}
          iconBg="bg-blue-100"
        />
        <StatsCard
          title="Super Admins"
          value={superAdminCount}
          label="Elevated access"
          icon={<Shield className="w-5 h-5 text-violet-600" />}
          iconBg="bg-violet-100"
        />
        <StatsCard
          title="Added Recently"
          value={recentCount}
          label="Last 30 days"
          icon={<UserCog className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-100"
        />
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone, or organization..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-primary/12 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm text-primary placeholder:text-primary/30"
          />
        </div>
        {isSuperAdmin && (
          <div className="flex gap-1">
            {[
              { value: "all", label: "All Roles" },
              { value: "super_admin", label: "Super Admins" },
              { value: "admin", label: "Admins" },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setRoleFilter(opt.value)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                  roleFilter === opt.value
                    ? "bg-primary text-white"
                    : "bg-primary/5 text-primary/60 hover:bg-primary/10"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Admin List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 bg-white rounded-2xl border border-primary/10">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-6 bg-white rounded-2xl border border-primary/10 text-primary/50 text-center text-sm">
          Unable to load admins.
        </div>
      ) : isSuperAdmin && filteredOrgGroups ? (
        /* Super Admin: Grouped by Organization */
        <div className="space-y-5">
          {filteredOrgGroups.length === 0 ? (
            <div className="p-8 bg-white rounded-2xl border border-primary/10 text-primary/30 text-center text-sm">
              {searchQuery || roleFilter !== "all" ? "No admins match your filters." : "No admins found."}
            </div>
          ) : filteredOrgGroups.map((group) => (
            <div key={group.orgName} className="bg-white rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
              {/* Org header */}
              <div className="px-5 py-3.5 bg-primary/3 border-b border-primary/8 flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-primary/50" />
                <span className="text-sm font-semibold text-primary">{group.orgName}</span>
                <span className="ml-auto text-xs text-primary/40 bg-primary/5 px-2 py-0.5 rounded-full">
                  {group.admins.length} admin{group.admins.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-primary/5">
                      <th className="px-5 py-2.5 text-xs font-semibold text-primary/40 uppercase tracking-wider">Admin</th>
                      <th className="px-5 py-2.5 text-xs font-semibold text-primary/40 uppercase tracking-wider">Contact</th>
                      <th className="px-5 py-2.5 text-xs font-semibold text-primary/40 uppercase tracking-wider">Role</th>
                      <th className="px-5 py-2.5 text-xs font-semibold text-primary/40 uppercase tracking-wider">Joined</th>
                      <th className="px-5 py-2.5 text-xs font-semibold text-primary/40 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.admins.map(a => (
                      <AdminRow key={a.id} a={a} isSuperAdmin={isSuperAdmin} setViewAdmin={setViewAdmin} openEdit={openEdit} setDeleteTarget={setDeleteTarget} setFormError={setFormError} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div className="text-xs text-primary/40 text-center">
            Showing {filteredAdmins.length} of {admins.length} admin{admins.length !== 1 ? "s" : ""} across {filteredOrgGroups.length} organization{filteredOrgGroups.length !== 1 ? "s" : ""}
          </div>
        </div>
      ) : (
        /* Org Admin: Flat table for own org */
        <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-primary/8 bg-primary/3">
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Admin</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Contact</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Role</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Joined</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-primary/30 text-sm">
                    {searchQuery || roleFilter !== "all" ? "No admins match your filters." : "No admins found."}
                  </td></tr>
                ) : filteredAdmins.map(a => (
                  <AdminRow key={a.id} a={a} isSuperAdmin={false} setViewAdmin={setViewAdmin} openEdit={openEdit} setDeleteTarget={setDeleteTarget} setFormError={setFormError} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-primary/8 bg-primary/2 text-xs text-primary/40">
            Showing {filteredAdmins.length} of {admins.length} admin{admins.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* View Admin Detail Panel */}
      {viewAdmin && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-7 relative mx-4 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setViewAdmin(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition">
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold ${
                viewAdmin.role === "super_admin" ? "bg-violet-100 text-violet-700" : "bg-primary/8 text-primary"
              }`}>
                {viewAdmin.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <h2 className="text-lg font-bold text-primary">{viewAdmin.name}</h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1 ${
                  viewAdmin.role === "super_admin" ? "bg-violet-100 text-violet-700" : "bg-primary/8 text-primary"
                }`}>
                  {viewAdmin.role === "super_admin" && <Shield className="w-3 h-3" />}
                  {viewAdmin.role === "super_admin" ? "Super Admin" : "Admin"}
                </span>
              </div>
            </div>

            {/* Details grid */}
            <div className="space-y-4">
              <DetailRow icon={<Mail className="w-4 h-4 text-primary/50" />} label="Email" value={viewAdmin.email} />
              <DetailRow icon={<Phone className="w-4 h-4 text-primary/50" />} label="Phone" value={viewAdmin.phone || "Not provided"} />
              <DetailRow
                icon={<Building2 className="w-4 h-4 text-primary/50" />}
                label="Organization"
                value={viewAdmin.organization?.name || "Global / Unassigned"}
              />
              <DetailRow
                icon={<Calendar className="w-4 h-4 text-primary/50" />}
                label="Joined"
                value={viewAdmin.createdAt ? new Date(viewAdmin.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Unknown"}
              />
              {/* Responsibilities section */}
              <div className="pt-4 border-t border-primary/10">
                <p className="text-xs font-semibold text-primary/50 uppercase tracking-wider mb-3">Responsibilities</p>
                <div className="space-y-2">
                  {viewAdmin.role === "super_admin" ? (
                    <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 text-sm text-violet-700">
                      <p className="font-semibold mb-1">Full System Access</p>
                      <p className="text-xs text-violet-600">Can manage all organizations, admins, drivers, vehicles, areas, and system settings.</p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-primary/3 border border-primary/10 text-sm text-primary/70">
                      <p className="font-semibold mb-1">Organization Admin</p>
                      <p className="text-xs text-primary/50">
                        Manages drivers, vehicles, and operations for {viewAdmin.organization?.name || "their assigned organization"}.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setViewAdmin(null); openEdit(viewAdmin); }}
                className="flex-1 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition"
              >
                Edit Admin
              </button>
              {isSuperAdmin && viewAdmin.role !== "super_admin" && (
                <button
                  onClick={() => { setViewAdmin(null); setDeleteTarget(viewAdmin); setFormError(""); }}
                  className="px-6 py-2.5 bg-red-50 text-red-600 font-semibold text-sm rounded-xl hover:bg-red-100 transition border border-red-200"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-7 relative mx-4">
            <button onClick={() => setShowAdd(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-primary mb-5">Add New Admin</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Full Name</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Hari Bahadur" className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="admin@example.com" className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Phone</label>
                <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="98XXXXXXXX" className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Password</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Min 6 characters" className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
              </div>
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition disabled:opacity-50">
                {submitting ? "Creating..." : "Create Admin"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Admin Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-7 relative mx-4">
            <button onClick={() => setDeleteTarget(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-red-600 mb-2">Delete Admin</h2>
            <p className="text-sm text-primary/50 mb-1">Admin: <strong>{deleteTarget.name}</strong></p>
            {deleteTarget.organization?.name && (
              <p className="text-sm text-primary/40 mb-4">Organization: {deleteTarget.organization.name}</p>
            )}
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm text-red-700">This will permanently remove this admin. This action cannot be undone.</p>
              </div>
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <button
                onClick={async () => {
                  setSubmitting(true);
                  const result = await deleteAdmin(deleteTarget.id);
                  setSubmitting(false);
                  if (result.success) setDeleteTarget(null);
                  else setFormError(result.error);
                }}
                disabled={submitting}
                className="w-full py-2.5 bg-red-500 text-white font-semibold text-sm rounded-xl hover:bg-red-600 transition disabled:opacity-50"
              >
                {submitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {editAdmin && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-7 relative mx-4">
            <button onClick={() => setEditAdmin(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-primary mb-5">Edit Admin</h2>
            {editAdmin.organization?.name && (
              <p className="text-sm text-primary/40 mb-4 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {editAdmin.organization.name}
              </p>
            )}
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Full Name</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Phone</label>
                <input type="text" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
              </div>
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition disabled:opacity-50">
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Admin table row (shared between grouped and flat views) ──────────── */
function AdminRow({ a, isSuperAdmin, setViewAdmin, openEdit, setDeleteTarget, setFormError }) {
  return (
    <tr className="border-b border-primary/5 hover:bg-primary/2 transition-colors">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
            a.role === "super_admin"
              ? "bg-violet-100 text-violet-700"
              : "bg-primary/8 text-primary"
          }`}>
            {a.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div>
            <span className="font-semibold text-primary text-sm block">{a.name}</span>
            <span className="text-xs text-primary/40">{a.email}</span>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <div className="text-sm text-primary/60">
          {a.phone ? (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {a.phone}
            </span>
          ) : (
            <span className="text-primary/30">--</span>
          )}
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
          a.role === "super_admin"
            ? "bg-violet-100 text-violet-700"
            : "bg-primary/8 text-primary"
        }`}>
          {a.role === "super_admin" && <Shield className="w-3 h-3" />}
          {a.role === "super_admin" ? "Super Admin" : "Admin"}
        </span>
      </td>
      <td className="px-5 py-3.5 text-sm text-primary/40">
        {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "--"}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setViewAdmin(a)} className="px-2.5 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition" title="View Details">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => openEdit(a)} className="px-3 py-1.5 text-xs font-semibold text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition">Edit</button>
          {isSuperAdmin && a.role !== "super_admin" && (
            <button onClick={() => { setDeleteTarget(a); setFormError(""); }} className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Delete</button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ── Detail row helper ──────────────────────────────────────────────────── */
function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/2 border border-primary/5">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-primary/40 uppercase tracking-wider">{label}</p>
        <div className="text-sm font-medium text-primary mt-0.5">{value}</div>
      </div>
    </div>
  );
}

export default Admins;
