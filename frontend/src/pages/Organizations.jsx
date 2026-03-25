import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useOrganizationStore from "../stores/useOrganizationStore";
import LocationPickerMap from "../components/shared/LocationPickerMap";

const ORG_COLORS = [
  "from-blue-500/20 to-blue-600/5",
  "from-emerald-500/20 to-emerald-600/5",
  "from-purple-500/20 to-purple-600/5",
  "from-amber-500/20 to-amber-600/5",
  "from-rose-500/20 to-rose-600/5",
  "from-cyan-500/20 to-cyan-600/5",
];

const Organizations = () => {
  const { organizations, isLoading, error, fetchOrganizations, createOrganization, updateOrganization, addAdmin } = useOrganizationStore();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const [adminOrg, setAdminOrg] = useState(null);

  const [createForm, setCreateForm] = useState({ name: "", latitude: null, longitude: null, address: "" });
  const [editForm, setEditForm] = useState({ name: "", latitude: null, longitude: null, address: "" });
  const [adminForm, setAdminForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchOrganizations(); }, [fetchOrganizations]);

  const handleCreate = async (e) => {
    e.preventDefault(); setFormError("");
    if (!createForm.name || !createForm.address) { setFormError("Name and location are required"); return; }
    setSubmitting(true);
    const result = await createOrganization({
      name: createForm.name,
      location: {
        address: createForm.address,
        ...(createForm.latitude && createForm.longitude ? { latitude: createForm.latitude, longitude: createForm.longitude } : {}),
      },
    });
    setSubmitting(false);
    if (result.success) { setShowCreate(false); setCreateForm({ name: "", latitude: null, longitude: null, address: "" }); }
    else setFormError(result.error);
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setFormError(""); setSubmitting(true);
    const result = await updateOrganization(editOrg._id, {
      name: editForm.name,
      location: {
        address: editForm.address,
        ...(editForm.latitude && editForm.longitude ? { latitude: editForm.latitude, longitude: editForm.longitude } : {}),
      },
    });
    setSubmitting(false);
    if (result.success) setEditOrg(null);
    else setFormError(result.error);
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault(); setFormError("");
    if (!adminForm.name || !adminForm.email || !adminForm.password) { setFormError("Name, email, and password are required"); return; }
    setSubmitting(true);
    const result = await addAdmin(adminOrg._id, adminForm);
    setSubmitting(false);
    if (result.success) { setAdminOrg(null); setAdminForm({ name: "", email: "", phone: "", password: "" }); }
    else setFormError(result.error);
  };

  const totalAdmins = organizations.reduce((sum, o) => sum + (o.admins?.length || 0), 0);
  const totalFleet = organizations.reduce((sum, o) => sum + (o.fleet?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">Organizations</h1>
          <p className="text-sm text-primary/60 mt-1">Manage waste management organizations and their resources</p>
        </div>
        <button onClick={() => { setShowCreate(true); setFormError(""); }} className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl shadow-sm hover:shadow-md hover:bg-primary/90 transition-all flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Organization
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-primary/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <div>
            <p className="text-xs text-primary/50 uppercase tracking-wider font-medium">Organizations</p>
            <p className="text-2xl font-bold text-primary">{organizations.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <div>
            <p className="text-xs text-primary/50 uppercase tracking-wider font-medium">Total Admins</p>
            <p className="text-2xl font-bold text-blue-600">{totalAdmins}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h8m-8 4h8m-6 4h4M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" /></svg>
          </div>
          <div>
            <p className="text-xs text-primary/50 uppercase tracking-wider font-medium">Total Fleet</p>
            <p className="text-2xl font-bold text-amber-600">{totalFleet}</p>
          </div>
        </div>
      </div>

      {/* Org Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 bg-white/50 rounded-2xl border border-primary/10">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-accent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 rounded-2xl border border-red-200 text-red-600 text-center font-medium">{error}</div>
      ) : organizations.length === 0 ? (
        <div className="p-16 bg-white rounded-2xl border border-primary/10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/5 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <p className="text-primary/40 font-medium">No organizations yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {organizations.map((org, i) => (
            <div
              key={org._id}
              onClick={() => navigate(`/admin-dashboard/organizations/${org._id}`)}
              className="bg-white rounded-2xl border border-primary/10 shadow-sm overflow-hidden hover:shadow-lg hover:border-accent/30 transition-all cursor-pointer group"
            >
              {/* Color Top Band */}
              <div className={`h-2 bg-linear-to-r ${ORG_COLORS[i % ORG_COLORS.length]}`} />

              <div className="p-5">
                {/* Org Name & Location */}
                <div className="flex items-start gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-linear-to-br ${ORG_COLORS[i % ORG_COLORS.length]} flex items-center justify-center text-xl font-bold text-primary shrink-0`}>
                    {org.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-primary truncate group-hover:text-accent transition-colors">
                      {org.name}
                    </h3>
                    <p className="text-xs text-primary/50 truncate">
                      {org.location?.address || "No address"}
                    </p>
                    {org.location?.latitude && org.location?.longitude && (
                      <p className="text-[10px] text-emerald-500 flex items-center gap-1 mt-0.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        GPS location set
                      </p>
                    )}
                  </div>
                </div>

                {/* Resource Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-primary/3 text-center">
                    <p className="text-xl font-bold text-primary">{org.admins?.length || 0}</p>
                    <p className="text-[11px] text-primary/50 font-medium uppercase tracking-wide">Admins</p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/3 text-center">
                    <p className="text-xl font-bold text-primary">{org.fleet?.length || 0}</p>
                    <p className="text-[11px] text-primary/50 font-medium uppercase tracking-wide">Trucks</p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/3 text-center">
                    <p className="text-xl font-bold text-purple-600">{org.driverCount || 0}</p>
                    <p className="text-[11px] text-primary/50 font-medium uppercase tracking-wide">Drivers</p>
                  </div>
                </div>

                {/* Admin Avatars */}
                {org.admins?.length > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex -space-x-2">
                      {org.admins.slice(0, 4).map(admin => (
                        <div key={admin._id} className="w-7 h-7 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-blue-700" title={admin.name}>
                          {admin.name?.charAt(0)?.toUpperCase()}
                        </div>
                      ))}
                      {org.admins.length > 4 && (
                        <div className="w-7 h-7 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-500">
                          +{org.admins.length - 4}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-primary/40">{org.admins.length} admin{org.admins.length !== 1 ? "s" : ""}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-primary/5">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/admin-dashboard/organizations/${org._id}`); }}
                    className="flex-1 py-2 text-xs font-semibold text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition text-center"
                  >
                    View Details
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditOrg(org);
                      setEditForm({
                        name: org.name,
                        latitude: org.location?.latitude || null,
                        longitude: org.location?.longitude || null,
                        address: org.location?.address || "",
                      });
                      setFormError("");
                    }}
                    className="py-2 px-3 text-xs font-semibold text-primary/60 bg-primary/5 rounded-lg hover:bg-primary/10 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAdminOrg(org); setFormError(""); setAdminForm({ name: "", email: "", phone: "", password: "" }); }}
                    className="py-2 px-3 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                  >
                    + Admin
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Create Organization Modal ===== */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-8 relative">
            <button onClick={() => setShowCreate(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition">&#x2715;</button>
            <h2 className="text-xl font-bold text-primary mb-6">Create Organization</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary/70 mb-1">Organization Name</label>
                <input type="text" value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} placeholder="e.g. EcoWaste Logistics" className="w-full px-4 py-2.5 rounded-xl border border-primary/15 focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <LocationPickerMap
                label="Depot / Office Location"
                required
                placeholder="Search for office location..."
                height="250px"
                value={{ latitude: createForm.latitude, longitude: createForm.longitude, address: createForm.address }}
                onChange={({ latitude, longitude, address }) => setCreateForm({ ...createForm, latitude, longitude, address })}
              />
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition disabled:opacity-50">
                {submitting ? "Creating..." : "Create Organization"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Edit Organization Modal ===== */}
      {editOrg && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-8 relative">
            <button onClick={() => setEditOrg(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition">&#x2715;</button>
            <h2 className="text-xl font-bold text-primary mb-6">Edit Organization</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary/70 mb-1">Organization Name</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-primary/15 focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <LocationPickerMap
                label="Depot / Office Location"
                required
                placeholder="Search for office location..."
                height="250px"
                value={{ latitude: editForm.latitude, longitude: editForm.longitude, address: editForm.address }}
                onChange={({ latitude, longitude, address }) => setEditForm({ ...editForm, latitude, longitude, address })}
              />
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition disabled:opacity-50">
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
            <button onClick={() => setAdminOrg(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/60 hover:bg-primary/10 transition">&#x2715;</button>
            <h2 className="text-xl font-bold text-primary mb-2">Add Admin</h2>
            <p className="text-sm text-primary/60 mb-6">Organization: <strong>{adminOrg.name}</strong></p>
            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary/70 mb-1">Full Name</label>
                <input type="text" value={adminForm.name} onChange={e => setAdminForm({...adminForm, name: e.target.value})} placeholder="e.g. Sita Gurung" className="w-full px-4 py-2.5 rounded-xl border border-primary/15 focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary/70 mb-1">Email</label>
                <input type="email" value={adminForm.email} onChange={e => setAdminForm({...adminForm, email: e.target.value})} placeholder="admin@example.com" className="w-full px-4 py-2.5 rounded-xl border border-primary/15 focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary/70 mb-1">Phone</label>
                <input type="text" value={adminForm.phone} onChange={e => setAdminForm({...adminForm, phone: e.target.value})} placeholder="98XXXXXXXX" className="w-full px-4 py-2.5 rounded-xl border border-primary/15 focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary/70 mb-1">Password</label>
                <input type="password" value={adminForm.password} onChange={e => setAdminForm({...adminForm, password: e.target.value})} placeholder="Min 6 characters" className="w-full px-4 py-2.5 rounded-xl border border-primary/15 focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              {formError && <p className="text-red-500 text-sm font-medium">{formError}</p>}
              <button type="submit" disabled={submitting} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
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
