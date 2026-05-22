import React, { useEffect, useState } from "react";
import useAreaStore from "../stores/useAreaStore";
import useAuthStore from "../stores/useAuthStore";
import { MapPin, CheckCircle, PauseCircle, Store } from "lucide-react";
import StatsCard from "../components/dashboard/StatsCard";
import LocationPickerMap from "../components/shared/LocationPickerMap";
import api from "../utils/api";

const TYPE_BADGES = {
  commercial: { cls: "bg-blue-100 text-blue-700", icon: "C" },
  residential: { cls: "bg-purple-100 text-purple-700", icon: "R" },
  suburban: { cls: "bg-teal-100 text-teal-700", icon: "S" },
  rural: { cls: "bg-emerald-100 text-emerald-700", icon: "U" },
};


const Areas = () => {
  const { areas, loading, error, fetchAreas, createArea, updateArea, deleteArea } = useAreaStore();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";

  const [showAddModal, setShowAddModal] = useState(false);
  const [editArea, setEditArea] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [form, setForm] = useState({ name: "", type: "residential", latitude: null, longitude: null, address: "", orgId: "", scaleFactor: 1.0 });
  const [editForm, setEditForm] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchAreas(); }, [fetchAreas]);

  useEffect(() => {
    if (isSuperAdmin) {
      api.get("/super-admin/organizations")
        .then(({ data }) => setOrgs(data.organizations || [])).catch(() => {});
    }
  }, [isSuperAdmin]);

  const handleAdd = async (e) => {
    e.preventDefault(); setFormError("");
    if (!form.name || (isSuperAdmin && !form.orgId)) { setFormError("All required fields must be filled"); return; }
    setSubmitting(true);
    const payload = {
      name: form.name,
      type: form.type,
      scaleFactor: Number(form.scaleFactor) || 1.0,
      ...(form.latitude && form.longitude ? { coordinates: { latitude: Number(form.latitude), longitude: Number(form.longitude) }, address: form.address } : {}),
      ...(isSuperAdmin && form.orgId ? { orgId: form.orgId } : {}),
    };
    const result = await createArea(payload);
    setSubmitting(false);
    if (result.success) { setShowAddModal(false); setForm({ name: "", type: "residential", latitude: null, longitude: null, address: "", orgId: "", scaleFactor: 1.0 }); }
    else setFormError(result.error);
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setFormError(""); setSubmitting(true);
    const payload = {
      name: editForm.name,
      type: editForm.type,
      isActive: editForm.isActive,
      scaleFactor: Number(editForm.scaleFactor) || 1.0,
      ...(editForm.latitude && editForm.longitude ? { coordinates: { latitude: Number(editForm.latitude), longitude: Number(editForm.longitude) }, address: editForm.address } : {}),
      ...(isSuperAdmin && editForm.orgId ? { orgId: editForm.orgId } : {}),
    };
    const result = await updateArea(editArea._id, payload);
    setSubmitting(false);
    if (result.success) setEditArea(null); else setFormError(result.error);
  };

  const handleDelete = async () => {
    setFormError(""); setSubmitting(true);
    const result = await deleteArea(deleteTarget._id);
    setSubmitting(false);
    if (result.success) setDeleteTarget(null); else setFormError(result.error);
  };

  const openEdit = (d) => {
    setEditArea(d);
    setEditForm({
      name: d.name,
      type: d.type,
      latitude: d.coordinates?.latitude || null,
      longitude: d.coordinates?.longitude || null,
      address: d.address || "",
      orgId: d.orgId?._id || d.orgId || "",
      isActive: d.isActive !== false,
      scaleFactor: d.scaleFactor || 1.0,
    });
    setFormError("");
  };

  const activeCount = areas.filter(d => d.isActive !== false).length;
  const inactiveCount = areas.filter(d => d.isActive === false).length;
  const typeCount = (type) => areas.filter(d => d.type === type).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Collection Areas</h1>
          <p className="text-sm text-primary/50 mt-1">{isSuperAdmin ? "Manage collection areas across all organizations" : "View your organization's collection areas"}</p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => { setShowAddModal(true); setFormError(""); }} className="px-5 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 self-start sm:self-auto">
            <span className="text-lg leading-none">+</span> Add Area
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Total Areas" value={areas.length} label="All collection areas" icon={<MapPin className="w-5 h-5 text-primary" />} iconBg="bg-primary/8" />
        <StatsCard title="Active" value={activeCount} label="Currently served" icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-100" valueColor="text-emerald-600" />
        <StatsCard title="Inactive" value={inactiveCount} label="Paused areas" icon={<PauseCircle className="w-5 h-5 text-amber-600" />} iconBg="bg-amber-100" valueColor="text-amber-600" />
        <StatsCard title="Commercial" value={typeCount("commercial")} label="Business areas" icon={<Store className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-100" valueColor="text-blue-600" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48 bg-white rounded-2xl border border-primary/10">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-6 bg-white rounded-2xl border border-red-200 text-red-600 text-center text-sm">{error}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-primary/8 bg-primary/3">
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Type</th>
                  {isSuperAdmin && <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Organization</th>}
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Location</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Status</th>
                  {isSuperAdmin && <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {areas.length === 0 ? (
                  <tr><td colSpan={isSuperAdmin ? 7 : 5} className="px-6 py-12 text-center text-primary/30 text-sm">No collection areas found.</td></tr>
                ) : areas.map(d => {
                  const badge = TYPE_BADGES[d.type] || { cls: "bg-gray-100 text-gray-700", icon: "?" };
                  const hasCoords = d.coordinates?.latitude && d.coordinates?.longitude;
                  return (
                    <tr key={d._id} className="border-b border-primary/5 hover:bg-primary/2 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-primary">{d.name}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
                          {d.type}
                        </span>
                      </td>
                      {isSuperAdmin && <td className="px-5 py-3.5 text-sm text-primary/60">{d.orgId?.name || "--"}</td>}
                      <td className="px-5 py-3.5 text-sm max-w-50">
                        {hasCoords ? (
                          <div>
                            {d.address ? (
                              <p className="text-primary/60 truncate" title={d.address}>{d.address}</p>
                            ) : (
                              <p className="text-primary/40 text-xs">{d.coordinates.latitude.toFixed(4)}, {d.coordinates.longitude.toFixed(4)}</p>
                            )}
                            <p className="text-emerald-500 text-[10px] flex items-center gap-0.5 mt-0.5">
                              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="4" /></svg>
                              GPS set
                            </p>
                          </div>
                        ) : (
                          <span className="text-primary/30">--</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${d.isActive !== false ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${d.isActive !== false ? "bg-emerald-500" : "bg-gray-400"}`} />
                          {d.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button onClick={() => openEdit(d)} className="px-2.5 py-1.5 text-xs font-semibold text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition">Edit</button>
                            <button onClick={() => { setDeleteTarget(d); setFormError(""); }} className="px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Delete</button>
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-7 relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition z-10">
              <span className="text-lg leading-none">&times;</span>
            </button>
            <h2 className="text-lg font-bold text-primary mb-5">Add New Area</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Area Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Kathmandu Central" className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-primary/60 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-sm">
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="suburban">Suburban</option>
                    <option value="rural">Rural</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary/60 mb-1">Size Scale</label>
                  <input type="number" step="0.1" min="0.1" max="5.0" value={form.scaleFactor} onChange={e => setForm({...form, scaleFactor: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
                  <p className="text-[11px] text-primary/40 mt-1">ML size multiplier (1.0 = avg)</p>
                </div>
              </div>
              <LocationPickerMap
                label="Area Center Location"
                placeholder="Search area location..."
                height="220px"
                value={{ latitude: form.latitude, longitude: form.longitude, address: form.address }}
                onChange={({ latitude, longitude, address }) => setForm({ ...form, latitude, longitude, address })}
              />
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-primary/60 mb-1">Organization *</label>
                  <select value={form.orgId} onChange={e => setForm({...form, orgId: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-sm">
                    <option value="">Select Organization...</option>
                    {orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                  </select>
                </div>
              )}
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition disabled:opacity-50">{submitting ? "Adding..." : "Add Area"}</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editArea && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-7 relative">
            <button onClick={() => setEditArea(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition z-10">
              <span className="text-lg leading-none">&times;</span>
            </button>
            <h2 className="text-lg font-bold text-primary mb-5">Edit Area</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Area Name</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-primary/60 mb-1">Type</label>
                  <select value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-sm">
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="suburban">Suburban</option>
                    <option value="rural">Rural</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary/60 mb-1">Size Scale</label>
                  <input type="number" step="0.1" min="0.1" max="5.0" value={editForm.scaleFactor} onChange={e => setEditForm({...editForm, scaleFactor: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
                  <p className="text-[11px] text-primary/40 mt-1">ML size multiplier (1.0 = avg)</p>
                </div>
              </div>
              <LocationPickerMap
                label="Area Center Location"
                placeholder="Search area location..."
                height="220px"
                value={{ latitude: editForm.latitude, longitude: editForm.longitude, address: editForm.address }}
                onChange={({ latitude, longitude, address }) => setEditForm({ ...editForm, latitude, longitude, address })}
              />
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-primary/60 mb-1">Organization</label>
                  <select value={editForm.orgId} onChange={e => setEditForm({...editForm, orgId: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-sm">
                    <option value="">Select Organization...</option>
                    {orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-primary/60">Active</label>
                <button type="button" onClick={() => setEditForm({...editForm, isActive: !editForm.isActive})} className={`w-12 h-6 rounded-full transition-colors ${editForm.isActive ? "bg-emerald-400" : "bg-gray-300"} relative`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editForm.isActive ? "left-6" : "left-0.5"}`} />
                </button>
              </div>
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition disabled:opacity-50">{submitting ? "Saving..." : "Save Changes"}</button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-7 relative mx-4">
            <button onClick={() => setDeleteTarget(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition">
              <span className="text-lg leading-none">&times;</span>
            </button>
            <h2 className="text-lg font-bold text-red-600 mb-2">Delete Area</h2>
            <p className="text-sm text-primary/50 mb-4">Area: <strong>{deleteTarget.name}</strong> ({deleteTarget.type})</p>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm text-red-700">This will permanently delete this area and remove it from all schedules.</p>
              </div>
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <button onClick={handleDelete} disabled={submitting} className="w-full py-2.5 bg-red-500 text-white font-semibold text-sm rounded-xl hover:bg-red-600 transition disabled:opacity-50">{submitting ? "Deleting..." : "Confirm Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Areas;
