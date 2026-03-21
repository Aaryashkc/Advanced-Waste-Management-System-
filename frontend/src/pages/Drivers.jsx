import React, { useEffect, useState } from "react";
import useDriverStore from "../stores/useDriverStore";
import useAuthStore from "../stores/useAuthStore";

const Drivers = () => {
  const { drivers, isLoading, error, fetchDrivers, addDriver, updateDriver, deleteDriver, requestDeletion } = useDriverStore();
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

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  useEffect(() => {
    if (isSuperAdmin) {
      const token = useAuthStore.getState().token;
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";
      fetch(`${API_URL}/super-admin/organizations`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(data => setOrgs(data.organizations || [])).catch(() => {});
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

  const unassignedCount = drivers.filter(d => d.truck === "No Truck").length;
  const availableCount = drivers.filter(d => d.status === "Available").length;
  const busyCount = drivers.filter(d => d.status === "Busy").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--primary)]">👤 Driver Management</h1>
          <p className="text-sm text-[var(--primary)]/60 mt-1">{isSuperAdmin ? "Manage all drivers across organizations" : "Manage drivers in your organization"}</p>
        </div>
        <button onClick={() => { setShowAddModal(true); setFormError(""); }} className="px-5 py-2.5 bg-[var(--accent)] text-[var(--primary)] font-semibold rounded-xl shadow-sm hover:shadow-md hover:brightness-110 transition-all flex items-center gap-2">
          <span className="text-lg">+</span> Add Driver
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-2xl">👤</div>
          <div><p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">Total</p><p className="text-2xl font-bold text-[var(--primary)]">{drivers.length}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl">🟢</div>
          <div><p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">Available</p><p className="text-2xl font-bold text-green-600">{availableCount}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl">🔴</div>
          <div><p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">On Task</p><p className="text-2xl font-bold text-orange-600">{busyCount}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-2xl">🚫</div>
          <div><p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">No Truck</p><p className="text-2xl font-bold text-purple-600">{unassignedCount}</p></div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 bg-white/50 rounded-2xl border border-[var(--primary)]/10"><div className="w-8 h-8 border-4 border-[var(--primary)]/20 border-t-[var(--accent)] rounded-full animate-spin" /></div>
      ) : error ? (
        <div className="p-6 bg-red-50 rounded-2xl border border-red-200 text-red-600 text-center font-medium">{error}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--primary)]/10 bg-[var(--primary)]/[0.03]">
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Email</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Phone</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Status</th>
                  {isSuperAdmin && <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Organization</th>}
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Assigned Truck</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {drivers.length === 0 ? (
                  <tr><td colSpan={isSuperAdmin ? 7 : 6} className="px-6 py-12 text-center text-[var(--primary)]/40">No drivers found.</td></tr>
                ) : drivers.map(d => (
                  <tr key={d.id} className="border-b border-[var(--primary)]/5 hover:bg-[var(--accent)]/5 transition-colors">
                    <td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-[var(--accent)]/30 flex items-center justify-center text-sm font-bold text-[var(--primary)]">{d.name?.charAt(0)?.toUpperCase() || "?"}</div><span className="font-semibold text-[var(--primary)]">{d.name}</span></div></td>
                    <td className="px-5 py-3.5 text-[var(--primary)]/70">{d.email || "—"}</td>
                    <td className="px-5 py-3.5 text-[var(--primary)]/70">{d.phone || "—"}</td>
                    <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${d.status === "Available" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}><span className={`w-1.5 h-1.5 rounded-full ${d.status === "Available" ? "bg-emerald-500" : "bg-orange-500"}`} />{d.status}</span></td>
                    {isSuperAdmin && <td className="px-5 py-3.5 text-[var(--primary)]/70">{d.organization}</td>}
                    <td className="px-5 py-3.5">
                      {d.truck && d.truck !== "No Truck" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">🚛 {d.truck}</span>
                      ) : <span className="text-purple-500 text-sm font-medium">⚠ No Truck</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isSuperAdmin && <button onClick={() => openEdit(d)} className="px-2.5 py-1 text-xs font-semibold text-[var(--primary)] bg-[var(--primary)]/5 rounded-lg hover:bg-[var(--primary)]/10 transition">Edit</button>}
                        <button onClick={() => { setDeleteTarget(d); setDeleteReason(""); setFormError(""); }} className="px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">
                          {isSuperAdmin ? "Delete" : "Request Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== Add Driver Modal ===== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">✕</button>
            <h2 className="text-xl font-bold text-[var(--primary)] mb-6">Add New Driver</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Full Name</label><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Ram Shrestha" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" /></div>
              <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="driver@example.com" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" /></div>
              <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Phone</label><input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="98XXXXXXXX" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" /></div>
              <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Password</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Min 6 characters" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" /></div>
              {isSuperAdmin && <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Organization</label><select value={form.orgId} onChange={e => setForm({...form, orgId: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white"><option value="">Select Organization...</option>{orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}</select></div>}
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3 bg-[var(--accent)] text-[var(--primary)] font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">{submitting ? "Creating..." : "Create Driver"}</button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Edit Driver Modal ===== */}
      {editDriver && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setEditDriver(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">✕</button>
            <h2 className="text-xl font-bold text-[var(--primary)] mb-6">Edit Driver — {editDriver.name}</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Full Name</label><input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" /></div>
              <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Email</label><input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" /></div>
              <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Phone</label><input type="text" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" /></div>
              {isSuperAdmin && <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Organization</label><select value={editForm.orgId} onChange={e => setEditForm({...editForm, orgId: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white"><option value="">Select Organization...</option>{orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}</select></div>}
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3 bg-[var(--accent)] text-[var(--primary)] font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">{submitting ? "Saving..." : "Save Changes"}</button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Delete / Request Deletion Modal ===== */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setDeleteTarget(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">✕</button>
            <h2 className="text-xl font-bold text-red-600 mb-2">{isSuperAdmin ? "Delete Driver" : "Request Driver Deletion"}</h2>
            <p className="text-sm text-[var(--primary)]/60 mb-4">Driver: <strong>{deleteTarget.name}</strong></p>
            {isSuperAdmin ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-red-50 border border-red-200"><p className="text-sm text-red-700">⚠️ This will permanently delete this driver and their user account.</p></div>
                {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
                <button onClick={handleDelete} disabled={submitting} className="w-full py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition disabled:opacity-50">{submitting ? "Deleting..." : "Confirm Delete"}</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200"><p className="text-sm text-amber-700">📋 This will send a deletion request to the Super Admin for approval.</p></div>
                <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Reason for deletion *</label><textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={3} placeholder="Explain why this driver should be removed..." className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none" /></div>
                {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
                <button onClick={handleDelete} disabled={submitting} className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition disabled:opacity-50">{submitting ? "Submitting..." : "Submit Request"}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Drivers;
