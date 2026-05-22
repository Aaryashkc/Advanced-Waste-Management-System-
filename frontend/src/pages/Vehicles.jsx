import React, { useEffect, useState } from "react";
import useVehicleStore from "../stores/useVehicleStore";
import useDriverStore from "../stores/useDriverStore";
import useAuthStore from "../stores/useAuthStore";
import { Truck, CheckCircle, Wrench, UserX } from "lucide-react";
import StatsCard from "../components/dashboard/StatsCard";
import api from "../utils/api";

const getDutyType = (capacity) => {
  const kg = Number(capacity);
  if (!kg || isNaN(kg)) return null;
  if (kg < 1000) return { label: "Light Duty", cls: "bg-blue-100 text-blue-700", desc: "< 1,000 kg" };
  if (kg <= 5000) return { label: "Medium Duty", cls: "bg-amber-100 text-amber-700", desc: "1,000 - 5,000 kg" };
  return { label: "Heavy Duty", cls: "bg-red-100 text-red-700", desc: "> 5,000 kg" };
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
  const [form, setForm] = useState({ capacity: "", licensePlate: "", orgId: "" });
  const [editForm, setEditForm] = useState({});
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchVehicles(); fetchDrivers(); }, [fetchVehicles, fetchDrivers]);

  useEffect(() => {
    if (isSuperAdmin) {
      api.get("/super-admin/organizations")
        .then(({ data }) => setOrgs(data.organizations || [])).catch(() => {});
    }
  }, [isSuperAdmin]);

  const handleAdd = async (e) => {
    e.preventDefault(); setFormError("");
    if (!form.capacity || !form.licensePlate || (isSuperAdmin && !form.orgId)) { setFormError("All fields are required"); return; }
    setSubmitting(true);
    const result = await addVehicle({ ...form, capacity: Number(form.capacity) });
    setSubmitting(false);
    if (result.success) { setShowAddModal(false); setForm({ capacity: "", licensePlate: "", orgId: "" }); }
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

  const openEdit = (v) => { setEditVehicle(v); setEditForm({ capacity: v.capacity, licensePlate: v.licensePlate, orgId: v.orgId || "", isAvailable: v.isAvailable }); setFormError(""); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Vehicle Management</h1>
          <p className="text-sm text-primary/50 mt-1">{isSuperAdmin ? "Manage vehicles across all organizations" : "Manage your organization's fleet"}</p>
        </div>
        <button onClick={() => { setShowAddModal(true); setFormError(""); }} className="px-5 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 self-start sm:self-auto">
          <span className="text-lg leading-none">+</span> Add Vehicle
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Total Vehicles" value={vehicles.length} label="Fleet size" icon={<Truck className="w-5 h-5 text-primary" />} iconBg="bg-primary/8" />
        <StatsCard title="Available" value={vehicles.filter(v => v.isAvailable).length} label="Ready to dispatch" icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-100" valueColor="text-emerald-600" />
        <StatsCard title="In Use" value={vehicles.filter(v => !v.isAvailable).length} label="Currently active" icon={<Wrench className="w-5 h-5 text-amber-600" />} iconBg="bg-amber-100" valueColor="text-amber-600" />
        <StatsCard title="No Driver" value={vehicles.filter(v => !v.assignedDriver).length} label="Needs assignment" icon={<UserX className="w-5 h-5 text-red-500" />} iconBg="bg-red-100" valueColor="text-red-500" />
      </div>

      {/* Table */}
      {isLoading ? (
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
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">License Plate</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Capacity</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Status</th>
                  {isSuperAdmin && <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Organization</th>}
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Assigned Driver</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 ? (
                  <tr><td colSpan={isSuperAdmin ? 6 : 5} className="px-6 py-12 text-center text-primary/30 text-sm">No vehicles found.</td></tr>
                ) : vehicles.map(v => {
                  const duty = getDutyType(v.capacity);
                  return (
                    <tr key={v.id} className="border-b border-primary/5 hover:bg-primary/2 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-primary">{v.licensePlate}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm text-primary/70">{v.capacity} kg</span>
                          {duty && <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit ${duty.cls}`}>{duty.label}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${v.isAvailable ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${v.isAvailable ? "bg-emerald-500" : "bg-amber-500"}`} />
                          {v.isAvailable ? "Available" : "In Use"}
                        </span>
                      </td>
                      {isSuperAdmin && <td className="px-5 py-3.5 text-sm text-primary/60">{v.organization}</td>}
                      <td className="px-5 py-3.5">
                        {v.assignedDriver ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center text-xs font-bold text-primary shrink-0">{v.assignedDriver.name?.charAt(0)?.toUpperCase()}</div>
                            <span className="text-sm text-primary">{v.assignedDriver.name}</span>
                            <button onClick={() => handleUnassign(v.id)} className="ml-1 text-red-400 hover:text-red-600 text-xs" title="Unassign">&times;</button>
                          </div>
                        ) : <span className="text-red-500 text-xs font-medium">No Driver</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button onClick={() => openEdit(v)} className="px-2.5 py-1.5 text-xs font-semibold text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition">Edit</button>
                          <button onClick={() => { setAssignVehicle(v); setSelectedDriverId(""); setFormError(""); }} className="px-2.5 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition">Assign</button>
                          <button onClick={() => { setDeleteTarget(v); setDeleteReason(""); setFormError(""); }} className="px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">
                            {isSuperAdmin ? "Delete" : "Request Delete"}
                          </button>
                        </div>
                      </td>
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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-7 relative mx-4">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition">
              <span className="text-lg leading-none">&times;</span>
            </button>
            <h2 className="text-lg font-bold text-primary mb-5">Add New Vehicle</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Capacity (kg)</label>
                <input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} placeholder="e.g. 5000" className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
                {form.capacity && getDutyType(form.capacity) && (
                  <div className={`mt-2 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${getDutyType(form.capacity).cls}`}>
                    <span>{getDutyType(form.capacity).label}</span>
                    <span className="opacity-60">({getDutyType(form.capacity).desc})</span>
                  </div>
                )}
              </div>
              <div><label className="block text-sm font-medium text-primary/60 mb-1">License Plate</label><input type="text" value={form.licensePlate} onChange={e => setForm({...form, licensePlate: e.target.value})} placeholder="e.g. BA 1 PA 4567" className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" /></div>
              {isSuperAdmin && <div><label className="block text-sm font-medium text-primary/60 mb-1">Organization</label><select value={form.orgId} onChange={e => setForm({...form, orgId: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-sm"><option value="">Select Organization...</option>{orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}</select></div>}
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition disabled:opacity-50">{submitting ? "Adding..." : "Add Vehicle"}</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editVehicle && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-7 relative mx-4">
            <button onClick={() => setEditVehicle(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition">
              <span className="text-lg leading-none">&times;</span>
            </button>
            <h2 className="text-lg font-bold text-primary mb-5">Edit Vehicle</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary/60 mb-1">Capacity (kg)</label>
                <input type="number" value={editForm.capacity} onChange={e => setEditForm({...editForm, capacity: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
                {editForm.capacity && getDutyType(editForm.capacity) && (
                  <div className={`mt-2 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${getDutyType(editForm.capacity).cls}`}>
                    <span>{getDutyType(editForm.capacity).label}</span>
                    <span className="opacity-60">({getDutyType(editForm.capacity).desc})</span>
                  </div>
                )}
              </div>
              <div><label className="block text-sm font-medium text-primary/60 mb-1">License Plate</label><input type="text" value={editForm.licensePlate} onChange={e => setEditForm({...editForm, licensePlate: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" /></div>
              {isSuperAdmin && <div><label className="block text-sm font-medium text-primary/60 mb-1">Organization</label><select value={editForm.orgId} onChange={e => setEditForm({...editForm, orgId: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-sm"><option value="">Select Organization...</option>{orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}</select></div>}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-primary/60">Available</label>
                <button type="button" onClick={() => setEditForm({...editForm, isAvailable: !editForm.isAvailable})} className={`w-12 h-6 rounded-full transition-colors ${editForm.isAvailable ? "bg-emerald-400" : "bg-gray-300"} relative`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editForm.isAvailable ? "left-6" : "left-0.5"}`} />
                </button>
              </div>
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary/90 transition disabled:opacity-50">{submitting ? "Saving..." : "Save Changes"}</button>
            </form>
          </div>
        </div>
      )}

      {/* Assign Driver Modal */}
      {assignVehicle && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-7 relative mx-4">
            <button onClick={() => setAssignVehicle(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition">
              <span className="text-lg leading-none">&times;</span>
            </button>
            <h2 className="text-lg font-bold text-primary mb-2">Assign Driver to Truck</h2>
            <p className="text-sm text-primary/50 mb-5">Truck: <strong>{assignVehicle.licensePlate}</strong></p>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-primary/60 mb-1">Select Driver</label><select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-sm"><option value="">Choose a driver...</option>{drivers.map(d => (<option key={d.id} value={d.id}>{d.name} - {d.organization} {d.truck !== "No Truck" ? `(${d.truck})` : ""}</option>))}</select></div>
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <button onClick={handleAssign} disabled={submitting} className="w-full py-2.5 bg-blue-500 text-white font-semibold text-sm rounded-xl hover:bg-blue-600 transition disabled:opacity-50">{submitting ? "Assigning..." : "Assign Driver"}</button>
            </div>
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
            <h2 className="text-lg font-bold text-red-600 mb-2">{isSuperAdmin ? "Delete Vehicle" : "Request Vehicle Deletion"}</h2>
            <p className="text-sm text-primary/50 mb-4">Vehicle: <strong>{deleteTarget.licensePlate}</strong></p>
            {isSuperAdmin ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-red-50 border border-red-200"><p className="text-sm text-red-700">This will permanently delete this vehicle and unassign any drivers.</p></div>
                {formError && <p className="text-red-500 text-sm">{formError}</p>}
                <button onClick={handleDelete} disabled={submitting} className="w-full py-2.5 bg-red-500 text-white font-semibold text-sm rounded-xl hover:bg-red-600 transition disabled:opacity-50">{submitting ? "Deleting..." : "Confirm Delete"}</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200"><p className="text-sm text-amber-700">This will send a deletion request to the Super Admin for approval.</p></div>
                <div><label className="block text-sm font-medium text-primary/60 mb-1">Reason for deletion *</label><textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={3} placeholder="Explain why this vehicle should be removed..." className="w-full px-4 py-2.5 rounded-xl border border-primary/12 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none text-sm" /></div>
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

export default Vehicles;
