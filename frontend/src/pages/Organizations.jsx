import React, { useEffect, useState } from "react";
import useOrganizationStore from "../stores/useOrganizationStore";

const Organizations = () => {
  const { organizations, isLoading, error, fetchOrganizations, createOrganization, updateOrganization, addAdmin } = useOrganizationStore();

  const [showCreate, setShowCreate] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const [adminOrg, setAdminOrg] = useState(null);
  const [expandedOrg, setExpandedOrg] = useState(null);

  const [createForm, setCreateForm] = useState({ name: "", address: "" });
  const [editForm, setEditForm] = useState({ name: "", address: "" });
  const [adminForm, setAdminForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchOrganizations(); }, [fetchOrganizations]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!createForm.name || !createForm.address) { setFormError("Name and address are required"); return; }
    setSubmitting(true);
    const result = await createOrganization({ name: createForm.name, location: { address: createForm.address } });
    setSubmitting(false);
    if (result.success) { setShowCreate(false); setCreateForm({ name: "", address: "" }); }
    else setFormError(result.error);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    const result = await updateOrganization(editOrg._id, { name: editForm.name, location: { address: editForm.address } });
    setSubmitting(false);
    if (result.success) setEditOrg(null);
    else setFormError(result.error);
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!adminForm.name || !adminForm.email || !adminForm.password) { setFormError("Name, email, and password are required"); return; }
    setSubmitting(true);
    const result = await addAdmin(adminOrg._id, adminForm);
    setSubmitting(false);
    if (result.success) { setAdminOrg(null); setAdminForm({ name: "", email: "", phone: "", password: "" }); }
    else setFormError(result.error);
  };

  const openEdit = (org) => {
    setEditOrg(org);
    setEditForm({ name: org.name, address: org.location?.address || "" });
    setFormError("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--primary)]">🏢 Organizations</h1>
          <p className="text-sm text-[var(--primary)]/60 mt-1">Create and manage waste management organizations</p>
        </div>
        <button onClick={() => { setShowCreate(true); setFormError(""); }} className="px-5 py-2.5 bg-[var(--accent)] text-[var(--primary)] font-semibold rounded-xl shadow-sm hover:shadow-md hover:brightness-110 transition-all flex items-center gap-2">
          <span className="text-lg">+</span> New Organization
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-2xl">🏢</div>
          <div>
            <p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">Total Orgs</p>
            <p className="text-2xl font-bold text-[var(--primary)]">{organizations.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl">👤</div>
          <div>
            <p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">Total Admins</p>
            <p className="text-2xl font-bold text-green-600">{organizations.reduce((sum, o) => sum + (o.admins?.length || 0), 0)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--primary)]/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl">🚛</div>
          <div>
            <p className="text-xs text-[var(--primary)]/50 uppercase tracking-wider font-medium">Total Fleet</p>
            <p className="text-2xl font-bold text-amber-600">{organizations.reduce((sum, o) => sum + (o.fleet?.length || 0), 0)}</p>
          </div>
        </div>
      </div>

      {/* Org Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 bg-white/50 rounded-2xl border border-[var(--primary)]/10">
          <div className="w-8 h-8 border-4 border-[var(--primary)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 rounded-2xl border border-red-200 text-red-600 text-center font-medium">{error}</div>
      ) : organizations.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-[var(--primary)]/10 text-center text-[var(--primary)]/40">
          No organizations yet. Create your first one!
        </div>
      ) : (
        <div className="space-y-4">
          {organizations.map(org => (
            <div key={org._id} className="bg-white rounded-2xl border border-[var(--primary)]/10 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Org Header */}
              <div className="p-6 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent)]/30 to-[var(--accent)]/10 flex items-center justify-center text-2xl font-bold text-[var(--primary)]">
                    {org.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--primary)]">{org.name}</h3>
                    <p className="text-sm text-[var(--primary)]/50 flex items-center gap-1">📍 {org.location?.address || "No address"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(org)} className="px-3 py-1.5 text-xs font-semibold text-[var(--primary)] bg-[var(--primary)]/5 rounded-lg hover:bg-[var(--primary)]/10 transition">Edit</button>
                  <button onClick={() => { setAdminOrg(org); setFormError(""); setAdminForm({ name: "", email: "", phone: "", password: "" }); }} className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition">+ Admin</button>
                  <button onClick={() => setExpandedOrg(expandedOrg === org._id ? null : org._id)} className="px-3 py-1.5 text-xs font-semibold text-[var(--primary)]/60 bg-[var(--primary)]/5 rounded-lg hover:bg-[var(--primary)]/10 transition">
                    {expandedOrg === org._id ? "▲ Less" : "▼ Details"}
                  </button>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="px-6 pb-4 flex gap-6">
                <div className="flex items-center gap-2 text-sm text-[var(--primary)]/60">
                  <span className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center text-xs">👤</span>
                  <span><strong className="text-[var(--primary)]">{org.admins?.length || 0}</strong> Admins</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--primary)]/60">
                  <span className="w-6 h-6 rounded-md bg-green-50 flex items-center justify-center text-xs">🚛</span>
                  <span><strong className="text-[var(--primary)]">{org.fleet?.length || 0}</strong> Vehicles</span>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedOrg === org._id && (
                <div className="border-t border-[var(--primary)]/10 p-6 bg-[var(--primary)]/[0.015] space-y-4">
                  {/* Admins */}
                  <div>
                    <h4 className="text-sm font-bold text-[var(--primary)] mb-3 uppercase tracking-wider">Admins</h4>
                    {org.admins?.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {org.admins.map(admin => (
                          <div key={admin._id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[var(--primary)]/5">
                            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">
                              {admin.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[var(--primary)]">{admin.name}</p>
                              <p className="text-xs text-[var(--primary)]/50">{admin.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--primary)]/40">No admins assigned yet</p>
                    )}
                  </div>

                  {/* Fleet */}
                  <div>
                    <h4 className="text-sm font-bold text-[var(--primary)] mb-3 uppercase tracking-wider">Fleet</h4>
                    {org.fleet?.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {org.fleet.map(truck => (
                          <div key={truck._id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[var(--primary)]/5">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg ${truck.truckType === "BIO" ? "bg-green-100" : "bg-slate-100"}`}>
                              {truck.truckType === "BIO" ? "🌿" : "♻️"}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[var(--primary)]">{truck.licensePlate}</p>
                              <p className="text-xs text-[var(--primary)]/50">{truck.truckType} · {truck.capacity} kg</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--primary)]/40">No vehicles in fleet</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ===== Create Organization Modal ===== */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setShowCreate(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">✕</button>
            <h2 className="text-xl font-bold text-[var(--primary)] mb-6">Create Organization</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Organization Name</label>
                <input type="text" value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} placeholder="e.g. EcoWaste Logistics" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Address</label>
                <input type="text" value={createForm.address} onChange={e => setCreateForm({...createForm, address: e.target.value})} placeholder="e.g. Kathmandu, Nepal" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3 bg-[var(--accent)] text-[var(--primary)] font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
                {submitting ? "Creating..." : "Create Organization"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Edit Organization Modal ===== */}
      {editOrg && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setEditOrg(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">✕</button>
            <h2 className="text-xl font-bold text-[var(--primary)] mb-6">Edit Organization</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Organization Name</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Address</label>
                <input type="text" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3 bg-[var(--accent)] text-[var(--primary)] font-bold rounded-xl hover:brightness-110 transition disabled:opacity-50">
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Add Admin Modal ===== */}
      {adminOrg && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onClick={() => setAdminOrg(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)]/60 hover:bg-[var(--primary)]/10 transition">✕</button>
            <h2 className="text-xl font-bold text-[var(--primary)] mb-2">Add Admin</h2>
            <p className="text-sm text-[var(--primary)]/60 mb-6">Organization: <strong>{adminOrg.name}</strong></p>
            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Full Name</label>
                <input type="text" value={adminForm.name} onChange={e => setAdminForm({...adminForm, name: e.target.value})} placeholder="e.g. Sita Gurung" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Email</label>
                <input type="email" value={adminForm.email} onChange={e => setAdminForm({...adminForm, email: e.target.value})} placeholder="admin@example.com" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Phone</label>
                <input type="text" value={adminForm.phone} onChange={e => setAdminForm({...adminForm, phone: e.target.value})} placeholder="98XXXXXXXX" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--primary)]/70 mb-1">Password</label>
                <input type="password" value={adminForm.password} onChange={e => setAdminForm({...adminForm, password: e.target.value})} placeholder="Min 6 characters" className="w-full px-4 py-2.5 rounded-xl border border-[var(--primary)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition disabled:opacity-50">
                {submitting ? "Adding..." : "Add Admin"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Organizations;
