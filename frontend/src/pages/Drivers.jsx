import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useDriverStore from "../stores/useDriverStore";
import useAuthStore from "../stores/useAuthStore";
import { Users, UserCheck, UserX, Truck } from "lucide-react";
import StatsCard from "../components/dashboard/StatsCard";
import PaginationControls from "../components/shared/PaginationControls";
import { AdminEmptyState, AdminErrorState, TableSkeleton } from "../components/shared/AdminListStates";
import api from "../utils/api";

const Drivers = () => {
  const { drivers, pagination, isLoading, error, fetchDrivers, addDriver, updateDriver, deleteDriver, requestDeletion } = useDriverStore();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";

  const [showAddModal, setShowAddModal] = useState(false);
  const [editDriver, setEditDriver] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", orgId: "" });
  const [editForm, setEditForm] = useState({});
  const [deleteReason, setDeleteReason] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchDrivers({ page: 1, limit: 10, signal: controller.signal });
    return () => controller.abort();
  }, [fetchDrivers]);

  useEffect(() => {
    if (isSuperAdmin) {
      const controller = new AbortController();
      api.get("/super-admin/organizations", { signal: controller.signal })
        .then(({ data }) => setOrgs(data.organizations || [])).catch(() => {});
      return () => controller.abort();
    }
  }, [isSuperAdmin]);

  const handleAdd = async (e) => {
    e.preventDefault(); setFormError("");
    if (!form.name || !form.email || !form.phone || !form.password) { setFormError("All fields are required"); return; }
    if (isSuperAdmin && !form.orgId) { setFormError("Please select an organization"); return; }
    setSubmitting(true);
    const result = await addDriver(form);
    setSubmitting(false);
    if (result.success) { setShowAddModal(false); setForm({ name: "", email: "", phone: "", password: "", orgId: "" }); }
    else setFormError(result.error);
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setFormError(""); setSubmitting(true);
    const result = await updateDriver(editDriver.id, editForm);
    setSubmitting(false);
    if (result.success) setEditDriver(null); else setFormError(result.error);
  };

  const handleDelete = async () => {
    setFormError(""); setSubmitting(true);
    if (isSuperAdmin) {
      const result = await deleteDriver(deleteTarget.id);
      setSubmitting(false);
      if (result.success) setDeleteTarget(null); else setFormError(result.error);
    } else {
      if (!deleteReason.trim()) { setFormError("Please provide a reason"); setSubmitting(false); return; }
      const result = await requestDeletion("driver", deleteTarget.id, deleteReason);
      setSubmitting(false);
      if (result.success) { setDeleteTarget(null); setDeleteReason(""); alert("Deletion request submitted for super admin approval!"); }
      else setFormError(result.error);
    }
  };

  const openEdit = (d) => { setEditDriver(d); setEditForm({ name: d.name, email: d.email, phone: d.phone, orgId: d.orgId || "" }); setFormError(""); };

  const totalCount = pagination?.total ?? drivers.length;
  const driverStats = useMemo(
    () => ({
      unassigned: drivers.filter((d) => d.truck === "No Truck").length,
      available: drivers.filter((d) => d.status === "Available").length,
      busy: drivers.filter((d) => d.status === "Busy").length,
    }),
    [drivers]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Driver Management</h1>
          <p className="text-sm text-primary/50 mt-1">{isSuperAdmin ? "Manage all drivers across organizations" : "Manage drivers in your organization"}</p>
        </div>
        <button onClick={() => { setShowAddModal(true); setFormError(""); }} className="px-5 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 self-start sm:self-auto">
          <span className="text-lg leading-none">+</span> Add Driver
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Total Drivers" value={totalCount} label="All drivers" icon={<Users className="w-5 h-5 text-primary" />} iconBg="bg-primary/8" />
        <StatsCard title="Available" value={driverStats.available} label="Ready for tasks" icon={<UserCheck className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-100" valueColor="text-emerald-600" />
        <StatsCard title="On Task" value={driverStats.busy} label="Currently busy" icon={<UserX className="w-5 h-5 text-amber-600" />} iconBg="bg-amber-100" valueColor="text-amber-600" />
        <StatsCard title="No Truck" value={driverStats.unassigned} label="Unassigned" icon={<Truck className="w-5 h-5 text-red-500" />} iconBg="bg-red-100" valueColor="text-red-500" />
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton columns={isSuperAdmin ? 7 : 6} rows={7} />
      ) : error ? (
        <AdminErrorState message={error} onRetry={() => fetchDrivers({ page: pagination?.page || 1, limit: 10 })} />
      ) : (
        <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-primary/8 bg-primary/3">
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Email</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Phone</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Status</th>
                  {isSuperAdmin && <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Organization</th>}
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Assigned Truck</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {drivers.length === 0 ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 7 : 6} className="p-0">
                      <AdminEmptyState icon={Users} title="No drivers found" message="Driver accounts will appear here once they are added." />
                    </td>
                  </tr>
                ) : drivers.map(d => (
                  <tr key={d.id} className="border-b border-primary/5 hover:bg-primary/2 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center text-xs font-bold text-primary shrink-0">{d.name?.charAt(0)?.toUpperCase() || "?"}</div>
                        <span className="font-semibold text-primary text-sm">{d.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-primary/60">{d.email || "--"}</td>
                    <td className="px-5 py-3.5 text-sm text-primary/60">{d.phone || "--"}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${d.status === "Available" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${d.status === "Available" ? "bg-emerald-500" : "bg-amber-500"}`} />
                        {d.status}
                      </span>
                    </td>
                    {isSuperAdmin && <td className="px-5 py-3.5 text-sm text-primary/60">{d.organization}</td>}
                    <td className="px-5 py-3.5">
                      {d.truck && d.truck !== "No Truck" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">{d.truck}</span>
                      ) : <span className="text-red-500 text-xs font-medium">No Truck</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button onClick={() => navigate(`/admin-dashboard/drivers/${d.id}`)} className="px-2.5 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition">View</button>
                        <button onClick={() => openEdit(d)} className="px-2.5 py-1.5 text-xs font-semibold text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition">Edit</button>
                        <button onClick={() => { setDeleteTarget(d); setDeleteReason(""); setFormError(""); }} className="px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">
                          {isSuperAdmin ? "Delete" : "Request Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            pagination={pagination}
            onPageChange={(nextPage) => fetchDrivers({ page: nextPage, limit: 10 })}
            itemLabel="drivers"
          />
        </div>
      )}

      {/* Add Driver Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-7 relative mx-4">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition">
              <span className="text-lg leading-none">&times;</span>
            </button>
            <h2 className="text-lg font-bold text-primary mb-5">Add New Driver</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div><label className="block text-sm font-medium text-primary/60 mb-1">Full Name</label><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Ram Shrestha" className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" /></div>
              <div><label className="block text-sm font-medium text-primary/60 mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="driver@example.com" className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" /></div>
              <div><label className="block text-sm font-medium text-primary/60 mb-1">Phone</label><input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="98XXXXXXXX" className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" /></div>
              <div><label className="block text-sm font-medium text-primary/60 mb-1">Password</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Min 6 characters" className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" /></div>
              {isSuperAdmin && <div><label className="block text-sm font-medium text-primary/60 mb-1">Organization</label><select value={form.orgId} onChange={e => setForm({...form, orgId: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-sm"><option value="">Select Organization...</option>{orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}</select></div>}
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition disabled:opacity-50">{submitting ? "Creating..." : "Create Driver"}</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Driver Modal */}
      {editDriver && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-7 relative mx-4">
            <button onClick={() => setEditDriver(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition">
              <span className="text-lg leading-none">&times;</span>
            </button>
            <h2 className="text-lg font-bold text-primary mb-5">Edit Driver</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div><label className="block text-sm font-medium text-primary/60 mb-1">Full Name</label><input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" /></div>
              <div><label className="block text-sm font-medium text-primary/60 mb-1">Email</label><input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" /></div>
              <div><label className="block text-sm font-medium text-primary/60 mb-1">Phone</label><input type="text" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" /></div>
              {isSuperAdmin && <div><label className="block text-sm font-medium text-primary/60 mb-1">Organization</label><select value={editForm.orgId} onChange={e => setEditForm({...editForm, orgId: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-sm"><option value="">Select Organization...</option>{orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}</select></div>}
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition disabled:opacity-50">{submitting ? "Saving..." : "Save Changes"}</button>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Request Deletion Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-7 relative mx-4">
            <button onClick={() => setDeleteTarget(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition">
              <span className="text-lg leading-none">&times;</span>
            </button>
            <h2 className="text-lg font-bold text-red-600 mb-2">{isSuperAdmin ? "Delete Driver" : "Request Driver Deletion"}</h2>
            <p className="text-sm text-primary/50 mb-4">Driver: <strong>{deleteTarget.name}</strong></p>
            {isSuperAdmin ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-sm text-red-700">This will permanently delete this driver and their user account.</p>
                </div>
                {formError && <p className="text-red-500 text-sm">{formError}</p>}
                <button onClick={handleDelete} disabled={submitting} className="w-full py-2.5 bg-red-500 text-white font-semibold text-sm rounded-xl hover:bg-red-600 transition disabled:opacity-50">{submitting ? "Deleting..." : "Confirm Delete"}</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-sm text-amber-700">This will send a deletion request to the Super Admin for approval.</p>
                </div>
                <div><label className="block text-sm font-medium text-primary/60 mb-1">Reason for deletion *</label><textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={3} placeholder="Explain why this driver should be removed..." className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none text-sm" /></div>
                {formError && <p className="text-red-500 text-sm">{formError}</p>}
                <button onClick={handleDelete} disabled={submitting} className="w-full py-2.5 bg-amber-500 text-white font-semibold text-sm rounded-xl hover:bg-amber-600 transition disabled:opacity-50">{submitting ? "Submitting..." : "Submit Request"}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Drivers;
