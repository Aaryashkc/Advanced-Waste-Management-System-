import React, { useEffect, useState } from "react";
import useDistrictStore from "../stores/useDistrictStore";
import useAuthStore from "../stores/useAuthStore";

const TYPE_BADGES = {
  commercial: { cls: "bg-blue-100 text-blue-700", icon: "🏬" },
  residential: { cls: "bg-purple-100 text-purple-700", icon: "🏠" },
  suburban: { cls: "bg-teal-100 text-teal-700", icon: "🏘️" },
  rural: { cls: "bg-emerald-100 text-emerald-700", icon: "🌾" },
};

const PROVINCES = ["Koshi", "Madhesh", "Bagmati", "Gandaki", "Lumbini", "Karnali", "Sudurpashchim"];

const Districts = () => {
  const { districts, loading, error, fetchDistricts, createDistrict, updateDistrict, deleteDistrict } = useDistrictStore();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";

  const [showAddModal, setShowAddModal] = useState(false);
  const [editDistrict, setEditDistrict] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [form, setForm] = useState({ name: "", type: "residential", province: "", latitude: "", longitude: "", orgId: "" });
  const [editForm, setEditForm] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchDistricts(); }, [fetchDistricts]);

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
    if (!form.name || !form.province || (isSuperAdmin && !form.orgId)) { setFormError("All required fields must be filled"); return; }
    setSubmitting(true);
    const payload = {
      name: form.name,
      type: form.type,
      province: form.province,
      ...(form.latitude && form.longitude ? { coordinates: { latitude: Number(form.latitude), longitude: Number(form.longitude) } } : {}),
      ...(isSuperAdmin && form.orgId ? { orgId: form.orgId } : {}),
    };
    const result = await createDistrict(payload);
    setSubmitting(false);
    if (result.success) { setShowAddModal(false); setForm({ name: "", type: "residential", province: "", latitude: "", longitude: "", orgId: "" }); }
    else setFormError(result.error);
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setFormError(""); setSubmitting(true);
    const payload = {
      name: editForm.name,
      type: editForm.type,
      province: editForm.province,
      isActive: editForm.isActive,
      ...(editForm.latitude && editForm.longitude ? { coordinates: { latitude: Number(editForm.latitude), longitude: Number(editForm.longitude) } } : {}),
      ...(isSuperAdmin && editForm.orgId ? { orgId: editForm.orgId } : {}),
    };
    const result = await updateDistrict(editDistrict._id, payload);
    setSubmitting(false);
    if (result.success) setEditDistrict(null); else setFormError(result.error);
  };

  const handleDelete = async () => {
    setFormError(""); setSubmitting(true);
    const result = await deleteDistrict(deleteTarget._id);
    setSubmitting(false);
    if (result.success) setDeleteTarget(null); else setFormError(result.error);
  };

  const openEdit = (d) => {
    setEditDistrict(d);
    setEditForm({
      name: d.name,
      type: d.type,
      province: d.province || "",
      latitude: d.coordinates?.latitude || "",
      longitude: d.coordinates?.longitude || "",
      orgId: d.orgId || "",
      isActive: d.isActive !== false,
    });
    setFormError("");
  };

  const activeCount = districts.filter(d => d.isActive !== false).length;
  const inactiveCount = districts.filter(d => d.isActive === false).length;
  const typeCount = (type) => districts.filter(d => d.type === type).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--primary)]">District Management</h1>
          <p className="text-sm text-[var(--primary)]/60 mt-1">{isSuperAdmin ? "Manage districts across all organizations" : "View your organization's districts"}</p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => { setShowAddModal(true); setFormError(""); }} className="px-5 py-2.5 bg-[var(--accent)] text-[var(--primary)] font-semibold rounded-xl shadow-sm hover:shadow-md hover:brightness-110 transition-all flex items-center gap-2">
            <span className="text-lg">+</span> Add District
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl">📍</div>
          <div><p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">Total</p><p className="text-2xl font-bold text-[var(--primary)]">{districts.length}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">✅</div>
          <div><p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">Active</p><p className="text-2xl font-bold text-green-600">{activeCount}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl">⏸️</div>
          <div><p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">Inactive</p><p className="text-2xl font-bold text-amber-600">{inactiveCount}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-2xl">🏬</div>
          <div><p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">Commercial</p><p className="text-2xl font-bold text-purple-600">{typeCount("commercial")}</p></div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
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
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Province</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Type</th>
                  {isSuperAdmin && <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Organization</th>}
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Coordinates</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Status</th>
                  {isSuperAdmin && <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {districts.length === 0 ? (
                  <tr><td colSpan={isSuperAdmin ? 7 : 5} className="px-6 py-12 text-center text-[var(--primary)]/40">No districts found.</td></tr>
                ) : districts.map(d => {
                  const badge = TYPE_BADGES[d.type] || { cls: "bg-gray-100 text-gray-700", icon: "📍" };
                  return (
                    <tr key={d._id} className="border-b border-[var(--primary)]/5 hover:bg-[var(--accent)]/5 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-[var(--primary)]">{d.name}</td>
                      <td className="px-5 py-3.5 text-sm text-[var(--primary)]/70">{d.province || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
                          {badge.icon} {d.type}
                        </span>
                      </td>
                      {isSuperAdmin && <td className="px-5 py-3.5 text-[var(--primary)]/70">{d.orgName || d.organization?.name || "—"}</td>}
                      <td className="px-5 py-3.5 text-[var(--primary)]/70 text-sm">
                        {d.coordinates?.latitude && d.coordinates?.longitude
                          ? `${d.coordinates.latitude.toFixed(4)}, ${d.coordinates.longitude.toFixed(4)}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${d.isActive !== false ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${d.isActive !== false ? "bg-emerald-500" : "bg-gray-400"}`} />
                          {d.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button onClick={() => openEdit(d)} className="px-2.5 py-1 text-xs font-semibold text-[var(--primary)] bg-[var(--primary)]/5 rounded-lg hover:bg-[var(--primary)]/10 transition">Edit</button>
                            <button onClick={() => { setDeleteTarget(d); setFormError(""); }} className="px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Delete</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== Add Modal ===== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">✕</button>
            <h2 className="text-xl font-bold text-[var(--primary)] mb-6">Add New District</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">District Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Kathmandu Central" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white">
                  <option value="residential">🏠 Residential</option>
                  <option value="commercial">🏬 Commercial</option>
                  <option value="suburban">🏘️ Suburban</option>
                  <option value="rural">🌾 Rural</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Province *</label>
                <select value={form.province} onChange={e => setForm({...form, province: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white">
                  <option value="">Select Province...</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Latitude</label>
                  <input type="number" step="any" value={form.latitude} onChange={e => setForm({...form, latitude: e.target.value})} placeholder="27.7172" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Longitude</label>
                  <input type="number" step="any" value={form.longitude} onChange={e => setForm({...form, longitude: e.target.value})} placeholder="85.3240" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                </div>
              </div>
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Organization *</label>
                  <select value={form.orgId} onChange={e => setForm({...form, orgId: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white">
                    <option value="">Select Organization...</option>
                    {orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                  </select>
                </div>
              )}
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3 bg-[var(--accent)] text-[var(--primary)] font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">{submitting ? "Adding..." : "Add District"}</button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Edit Modal ===== */}
      {editDistrict && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setEditDistrict(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">✕</button>
            <h2 className="text-xl font-bold text-[var(--primary)] mb-6">Edit District — {editDistrict.name}</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">District Name</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Type</label>
                <select value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white">
                  <option value="residential">🏠 Residential</option>
                  <option value="commercial">🏬 Commercial</option>
                  <option value="suburban">🏘️ Suburban</option>
                  <option value="rural">🌾 Rural</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Province *</label>
                <select value={editForm.province} onChange={e => setEditForm({...editForm, province: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white">
                  <option value="">Select Province...</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Latitude</label>
                  <input type="number" step="any" value={editForm.latitude} onChange={e => setEditForm({...editForm, latitude: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Longitude</label>
                  <input type="number" step="any" value={editForm.longitude} onChange={e => setEditForm({...editForm, longitude: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                </div>
              </div>
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Organization</label>
                  <select value={editForm.orgId} onChange={e => setEditForm({...editForm, orgId: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white">
                    <option value="">Select Organization...</option>
                    {orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-[var(--primary)]/70">Active</label>
                <button type="button" onClick={() => setEditForm({...editForm, isActive: !editForm.isActive})} className={`w-12 h-6 rounded-full transition-colors ${editForm.isActive ? "bg-emerald-400" : "bg-gray-300"} relative`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editForm.isActive ? "left-6" : "left-0.5"}`} />
                </button>
              </div>
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3 bg-[var(--accent)] text-[var(--primary)] font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">{submitting ? "Saving..." : "Save Changes"}</button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Delete Modal ===== */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setDeleteTarget(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">✕</button>
            <h2 className="text-xl font-bold text-red-600 mb-2">Delete District</h2>
            <p className="text-sm text-[var(--primary)]/60 mb-4">District: <strong>{deleteTarget.name}</strong> ({deleteTarget.type})</p>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm text-red-700">This will permanently delete this district and remove it from all schedules.</p>
              </div>
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button onClick={handleDelete} disabled={submitting} className="w-full py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition disabled:opacity-50">{submitting ? "Deleting..." : "Confirm Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Districts;
