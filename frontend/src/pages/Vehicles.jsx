import React, { useEffect, useState } from "react";
import useVehicleStore from "../stores/useVehicleStore";
import useDriverStore from "../stores/useDriverStore";
import useAuthStore from "../stores/useAuthStore";

// Auto-classify duty type from capacity
const getDutyType = (capacity) => {
  const kg = Number(capacity);
  if (!kg || isNaN(kg)) return null;
  if (kg < 1000) return { label: '🔵 Light Duty', cls: 'bg-blue-100 text-blue-700', desc: '< 1,000 kg' };
  if (kg <= 5000) return { label: '🟡 Medium Duty', cls: 'bg-amber-100 text-amber-700', desc: '1,000 – 5,000 kg' };
  return { label: '🔴 Heavy Duty', cls: 'bg-red-100 text-red-700', desc: '> 5,000 kg' };
};

const Vehicles = () => {
  const { vehicles, isLoading, error, fetchVehicles, addVehicle, updateVehicle, deleteVehicle, unassignDriverFromTruck, assignDriverToTruck, requestDeletion } = useVehicleStore();
  const { drivers, fetchDrivers } = useDriverStore();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";

  const [showAddModal, setShowAddModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [assignVehicle, setAssignVehicle] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [form, setForm] = useState({ truckType: "BIO", capacity: "", licensePlate: "", orgId: "" });
  const [editForm, setEditForm] = useState({});
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchVehicles(); fetchDrivers(); }, [fetchVehicles, fetchDrivers]);

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
    if (!form.capacity || !form.licensePlate || (isSuperAdmin && !form.orgId)) { setFormError("All fields are required"); return; }
    setSubmitting(true);
    const result = await addVehicle({ ...form, capacity: Number(form.capacity) });
    setSubmitting(false);
    if (result.success) { setShowAddModal(false); setForm({ truckType: "BIO", capacity: "", licensePlate: "", orgId: "" }); }
    else setFormError(result.error);
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setFormError(""); setSubmitting(true);
    const result = await updateVehicle(editVehicle.id, { ...editForm, capacity: Number(editForm.capacity) });
    setSubmitting(false);
    if (result.success) setEditVehicle(null); else setFormError(result.error);
  };

  const handleAssign = async () => {
    if (!selectedDriverId) { setFormError("Select a driver"); return; }
    setSubmitting(true);
    const result = await assignDriverToTruck(selectedDriverId, assignVehicle.id);
    setSubmitting(false);
    if (result.success) { setAssignVehicle(null); setSelectedDriverId(""); fetchDrivers(); } else setFormError(result.error);
  };

  const handleUnassign = async (truckId) => {
    if (!confirm("Unassign driver from this truck?")) return;
    await unassignDriverFromTruck(truckId);
    fetchDrivers();
  };

  const handleDelete = async () => {
    setFormError(""); setSubmitting(true);
    if (isSuperAdmin) {
      const result = await deleteVehicle(deleteTarget.id);
      setSubmitting(false);
      if (result.success) setDeleteTarget(null); else setFormError(result.error);
    } else {
      if (!deleteReason.trim()) { setFormError("Please provide a reason"); setSubmitting(false); return; }
      const result = await requestDeletion("vehicle", deleteTarget.id, deleteReason);
      setSubmitting(false);
      if (result.success) { setDeleteTarget(null); setDeleteReason(""); alert("Deletion request submitted for super admin approval!"); }
      else setFormError(result.error);
    }
  };

  const openEdit = (v) => { setEditVehicle(v); setEditForm({ truckType: v.truckType, capacity: v.capacity, licensePlate: v.licensePlate, orgId: v.orgId || "", isAvailable: v.isAvailable }); setFormError(""); };

  const unassignedDrivers = drivers.filter(d => d.truck === "No Truck").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--primary)]">🚛 Vehicle Management</h1>
          <p className="text-sm text-[var(--primary)]/60 mt-1">{isSuperAdmin ? "Manage vehicles across all organizations" : "Manage your organization's fleet"}</p>
        </div>
        <button onClick={() => { setShowAddModal(true); setFormError(""); }} className="px-5 py-2.5 bg-[var(--accent)] text-[var(--primary)] font-semibold rounded-xl shadow-sm hover:shadow-md hover:brightness-110 transition-all flex items-center gap-2">
          <span className="text-lg">+</span> Add Vehicle
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl">🚛</div>
          <div><p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">Total</p><p className="text-2xl font-bold text-[var(--primary)]">{vehicles.length}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">✅</div>
          <div><p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">Available</p><p className="text-2xl font-bold text-green-600">{vehicles.filter(v => v.isAvailable).length}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl">🔧</div>
          <div><p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">In Use</p><p className="text-2xl font-bold text-amber-600">{vehicles.filter(v => !v.isAvailable).length}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-2xl">🚫</div>
          <div><p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">No Driver</p><p className="text-2xl font-bold text-purple-600">{vehicles.filter(v => !v.assignedDriver).length}</p></div>
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
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">License Plate</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Capacity</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Status</th>
                  {isSuperAdmin && <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Organization</th>}
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Assigned Driver</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 ? (
                  <tr><td colSpan={isSuperAdmin ? 7 : 6} className="px-6 py-12 text-center text-[var(--primary)]/40">No vehicles found.</td></tr>
                ) : vehicles.map(v => (
                  <tr key={v.id} className="border-b border-[var(--primary)]/5 hover:bg-[var(--accent)]/5 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-[var(--primary)]">{v.licensePlate}</td>
                    <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${v.truckType === "BIO" ? "bg-green-100 text-green-700" : v.truckType === "MIXED" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-700"}`}>{v.truckType === "BIO" ? "🌿" : v.truckType === "MIXED" ? "🔀" : "♻️"} {v.truckType}</span></td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[var(--primary)]/70">{v.capacity} kg</span>
                        {v.dutyType && <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit ${getDutyType(v.capacity)?.cls || 'bg-gray-100 text-gray-600'}`}>{getDutyType(v.capacity)?.label || v.dutyType}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${v.isAvailable ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}><span className={`w-1.5 h-1.5 rounded-full ${v.isAvailable ? "bg-emerald-500" : "bg-amber-500"}`} />{v.isAvailable ? "Available" : "In Use"}</span></td>
                    {isSuperAdmin && <td className="px-5 py-3.5 text-[var(--primary)]/70">{v.organization}</td>}
                    <td className="px-5 py-3.5">
                      {v.assignedDriver ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[var(--accent)]/30 flex items-center justify-center text-xs font-bold text-[var(--primary)]">{v.assignedDriver.name?.charAt(0)?.toUpperCase()}</div>
                          <span className="text-sm text-[var(--primary)]">{v.assignedDriver.name}</span>
                          {isSuperAdmin && <button onClick={() => handleUnassign(v.id)} className="ml-1 text-red-400 hover:text-red-600 text-xs" title="Unassign">✕</button>}
                        </div>
                      ) : <span className="text-purple-500 text-sm font-medium">⚠ No Driver</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isSuperAdmin && <button onClick={() => openEdit(v)} className="px-2.5 py-1 text-xs font-semibold text-[var(--primary)] bg-[var(--primary)]/5 rounded-lg hover:bg-[var(--primary)]/10 transition">Edit</button>}
                        {isSuperAdmin && <button onClick={() => { setAssignVehicle(v); setSelectedDriverId(""); setFormError(""); }} className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition">Assign</button>}
                        <button onClick={() => { setDeleteTarget(v); setDeleteReason(""); setFormError(""); }} className="px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">
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

      {/* ===== Add Modal ===== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">✕</button>
            <h2 className="text-xl font-bold text-[var(--primary)] mb-6">Add New Vehicle</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Truck Type</label><select value={form.truckType} onChange={e => setForm({...form, truckType: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white"><option value="BIO">🌿 BIO</option><option value="NON_BIO">♻️ NON_BIO</option><option value="MIXED">🔀 MIXED</option></select></div>
              <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Capacity (kg)</label><input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} placeholder="e.g. 5000" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                {form.capacity && getDutyType(form.capacity) && (
                  <div className={`mt-2 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${getDutyType(form.capacity).cls}`}>
                    <span>{getDutyType(form.capacity).label}</span>
                    <span className="opacity-60">({getDutyType(form.capacity).desc})</span>
                  </div>
                )}
              </div>
              <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">License Plate</label><input type="text" value={form.licensePlate} onChange={e => setForm({...form, licensePlate: e.target.value})} placeholder="e.g. BA 1 PA 4567" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" /></div>
              {isSuperAdmin && <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Organization</label><select value={form.orgId} onChange={e => setForm({...form, orgId: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white"><option value="">Select Organization...</option>{orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}</select></div>}
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3 bg-[var(--accent)] text-[var(--primary)] font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">{submitting ? "Adding..." : "Add Vehicle"}</button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Edit Modal ===== */}
      {editVehicle && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setEditVehicle(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">✕</button>
            <h2 className="text-xl font-bold text-[var(--primary)] mb-6">Edit Vehicle — {editVehicle.licensePlate}</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Truck Type</label><select value={editForm.truckType} onChange={e => setEditForm({...editForm, truckType: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white"><option value="BIO">🌿 BIO</option><option value="NON_BIO">♻️ NON_BIO</option><option value="MIXED">🔀 MIXED</option></select></div>
              <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Capacity (kg)</label><input type="number" value={editForm.capacity} onChange={e => setEditForm({...editForm, capacity: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                {editForm.capacity && getDutyType(editForm.capacity) && (
                  <div className={`mt-2 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${getDutyType(editForm.capacity).cls}`}>
                    <span>{getDutyType(editForm.capacity).label}</span>
                    <span className="opacity-60">({getDutyType(editForm.capacity).desc})</span>
                  </div>
                )}
              </div>
              <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">License Plate</label><input type="text" value={editForm.licensePlate} onChange={e => setEditForm({...editForm, licensePlate: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" /></div>
              {isSuperAdmin && <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Organization</label><select value={editForm.orgId} onChange={e => setEditForm({...editForm, orgId: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white"><option value="">Select Organization...</option>{orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}</select></div>}
              <div className="flex items-center gap-3"><label className="text-sm font-medium text-[var(--primary)]/70">Available</label><button type="button" onClick={() => setEditForm({...editForm, isAvailable: !editForm.isAvailable})} className={`w-12 h-6 rounded-full transition-colors ${editForm.isAvailable ? "bg-emerald-400" : "bg-gray-300"} relative`}><span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editForm.isAvailable ? "left-6" : "left-0.5"}`} /></button></div>
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3 bg-[var(--accent)] text-[var(--primary)] font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">{submitting ? "Saving..." : "Save Changes"}</button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Assign Driver Modal ===== */}
      {assignVehicle && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setAssignVehicle(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">✕</button>
            <h2 className="text-xl font-bold text-[var(--primary)] mb-2">Assign Driver to Truck</h2>
            <p className="text-sm text-[var(--primary)]/60 mb-6">Truck: <strong>{assignVehicle.licensePlate}</strong></p>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Select Driver</label><select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white"><option value="">Choose a driver...</option>{drivers.map(d => (<option key={d.id} value={d.id}>{d.name} — {d.organization} {d.truck !== "No Truck" ? `(${d.truck})` : ""}</option>))}</select></div>
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button onClick={handleAssign} disabled={submitting} className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition disabled:opacity-50">{submitting ? "Assigning..." : "Assign Driver"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete / Request Deletion Modal ===== */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setDeleteTarget(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">✕</button>
            <h2 className="text-xl font-bold text-red-600 mb-2">{isSuperAdmin ? "Delete Vehicle" : "Request Vehicle Deletion"}</h2>
            <p className="text-sm text-[var(--primary)]/60 mb-4">Vehicle: <strong>{deleteTarget.licensePlate}</strong> ({deleteTarget.organization})</p>
            {isSuperAdmin ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-red-50 border border-red-200"><p className="text-sm text-red-700">⚠️ This will permanently delete this vehicle and unassign any drivers.</p></div>
                {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
                <button onClick={handleDelete} disabled={submitting} className="w-full py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition disabled:opacity-50">{submitting ? "Deleting..." : "Confirm Delete"}</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200"><p className="text-sm text-amber-700">📋 This will send a deletion request to the Super Admin for approval.</p></div>
                <div><label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Reason for deletion *</label><textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={3} placeholder="Explain why this vehicle should be removed..." className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none" /></div>
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

export default Vehicles;
