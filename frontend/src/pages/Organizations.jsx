import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Edit3,
  MapPin,
  Plus,
  ShieldPlus,
  Truck,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import useOrganizationStore from "../stores/useOrganizationStore";
import LocationPickerMap from "../components/shared/LocationPickerMap";
import StatsCard from "../components/dashboard/StatsCard";

const ORG_COLORS = [
  {
    accent: "bg-blue-500",
    ring: "ring-blue-500/15",
    soft: "bg-blue-500/10",
    text: "text-blue-600",
    wash: "from-blue-500/16 via-transparent to-cyan-500/10",
  },
  {
    accent: "bg-emerald-500",
    ring: "ring-emerald-500/15",
    soft: "bg-emerald-500/10",
    text: "text-emerald-600",
    wash: "from-emerald-500/16 via-transparent to-teal-500/10",
  },
  {
    accent: "bg-violet-500",
    ring: "ring-violet-500/15",
    soft: "bg-violet-500/10",
    text: "text-violet-600",
    wash: "from-violet-500/16 via-transparent to-fuchsia-500/10",
  },
  {
    accent: "bg-amber-500",
    ring: "ring-amber-500/15",
    soft: "bg-amber-500/10",
    text: "text-amber-600",
    wash: "from-amber-500/16 via-transparent to-orange-500/10",
  },
  {
    accent: "bg-rose-500",
    ring: "ring-rose-500/15",
    soft: "bg-rose-500/10",
    text: "text-rose-600",
    wash: "from-rose-500/16 via-transparent to-red-500/10",
  },
  {
    accent: "bg-cyan-500",
    ring: "ring-cyan-500/15",
    soft: "bg-cyan-500/10",
    text: "text-cyan-600",
    wash: "from-cyan-500/16 via-transparent to-sky-500/10",
  },
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
  const totalDrivers = organizations.reduce((sum, o) => sum + (o.driverCount || 0), 0);
  const gpsReady = organizations.filter((o) => o.location?.latitude && o.location?.longitude).length;

  const openEditOrganization = (org) => {
    setEditOrg(org);
    setEditForm({
      name: org.name,
      latitude: org.location?.latitude || null,
      longitude: org.location?.longitude || null,
      address: org.location?.address || "",
    });
    setFormError("");
  };

  const openAddAdmin = (org) => {
    setAdminOrg(org);
    setFormError("");
    setAdminForm({ name: "", email: "", phone: "", password: "" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">Organizations</h1>
          <p className="text-sm text-primary/60 mt-1">Manage waste management organizations and their resources</p>
        </div>
        <button onClick={() => { setShowCreate(true); setFormError(""); }} className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl shadow-sm hover:shadow-md hover:bg-primary/90 transition-all flex items-center gap-2">
          <Plus className="h-5 w-5" />
          New Organization
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Organizations"
          value={organizations.length}
          label="Registered partners"
          icon={<Building2 className="w-5 h-5 text-primary" />}
          iconBg="bg-primary/8"
        />
        <StatsCard
          title="Admins"
          value={totalAdmins}
          label="Operational owners"
          icon={<UserRoundCog className="w-5 h-5 text-blue-600" />}
          iconBg="bg-blue-100"
          valueColor="text-blue-600"
        />
        <StatsCard
          title="Fleet"
          value={totalFleet}
          label={`${totalDrivers} driver${totalDrivers !== 1 ? "s" : ""} assigned`}
          icon={<Truck className="w-5 h-5 text-amber-600" />}
          iconBg="bg-amber-100"
          valueColor="text-amber-600"
        />
        <StatsCard
          title="GPS Ready"
          value={gpsReady}
          label="Depot locations set"
          icon={<MapPin className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-100"
          valueColor="text-emerald-600"
        />
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
          {organizations.map((org, i) => {
            const tone = ORG_COLORS[i % ORG_COLORS.length];
            const admins = org.admins || [];
            const trucks = org.fleet?.length || 0;
            const drivers = org.driverCount || 0;
            const isMapped = Boolean(org.location?.latitude && org.location?.longitude);
            const detailPath = `/admin-dashboard/organizations/${org._id}`;

            return (
              <article
                key={org._id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(detailPath)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(detailPath);
                  }
                }}
                className="dash-interactive-card group min-h-[230px] cursor-pointer rounded-2xl border bg-[var(--dash-card)] shadow-sm shadow-primary/5"
              >
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-br ${tone.wash}`} />
                <div className={`absolute left-0 top-0 h-full w-1 ${tone.accent} opacity-80 transition-all duration-200 group-hover:w-1.5`} />

                <div className="relative h-full min-h-[230px]">
                  <div className="flex h-full min-h-[230px] flex-col p-5 transition-all duration-200 group-hover:-translate-y-2 group-hover:opacity-0 group-focus-within:-translate-y-2 group-focus-within:opacity-0">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.soft} ${tone.text} ring-8 ${tone.ring} text-lg font-bold transition-transform duration-200 group-hover:scale-105`}>
                        {org.name?.charAt(0)?.toUpperCase() || "O"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-bold leading-tight text-primary">
                              {org.name}
                            </h3>
                            <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-medium text-primary/50">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{org.location?.address || "Depot address not set"}</span>
                            </p>
                          </div>
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-primary/30 transition-all duration-200 group-hover:translate-x-1 group-hover:text-primary/70" />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${isMapped ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                        {isMapped ? <CheckCircle2 className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                        {isMapped ? "GPS ready" : "Needs GPS"}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary/55">
                        <Building2 className="h-3.5 w-3.5" />
                        Partner organization
                      </span>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                      {admins.length > 0 ? (
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex -space-x-2">
                            {admins.slice(0, 4).map((admin) => (
                              <div key={admin._id} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--dash-card)] bg-blue-100 text-[10px] font-bold text-blue-700 shadow-sm" title={admin.name}>
                                {admin.name?.charAt(0)?.toUpperCase() || "A"}
                              </div>
                            ))}
                            {admins.length > 4 && (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--dash-card)] bg-primary/8 text-[10px] font-bold text-primary/60 shadow-sm">
                                +{admins.length - 4}
                              </div>
                            )}
                          </div>
                          <span className="truncate text-xs font-medium text-primary/45">
                            {admins.length} admin{admins.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-primary/40">No admins assigned</span>
                      )}
                      <span className="shrink-0 text-xs font-bold text-primary/40">
                        {trucks} truck{trucks !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="absolute inset-0 flex translate-y-2 flex-col justify-between rounded-2xl bg-[color-mix(in_srgb,var(--dash-card)_96%,transparent)] p-5 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                    <div>
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-primary/45">Organization Stats</p>
                          <h3 className="truncate text-base font-bold text-primary">{org.name}</h3>
                        </div>
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.soft} ${tone.text}`}>
                          <Building2 className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <OrgMetric icon={<UserRoundCog className="h-4 w-4" />} label="Admins" value={admins.length} />
                        <OrgMetric icon={<Truck className="h-4 w-4" />} label="Trucks" value={trucks} />
                        <OrgMetric icon={<UsersRound className="h-4 w-4" />} label="Drivers" value={drivers} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(detailPath); }}
                        className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm shadow-primary/15 transition hover:bg-primary/90"
                      >
                        Details
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        aria-label={`Edit ${org.name}`}
                        title="Edit organization"
                        onClick={(e) => { e.stopPropagation(); openEditOrganization(org); }}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/10 bg-primary/5 text-primary/65 transition hover:bg-primary/10 hover:text-primary"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        aria-label={`Add admin to ${org.name}`}
                        title="Add admin"
                        onClick={(e) => { e.stopPropagation(); openAddAdmin(org); }}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/15 bg-blue-500/10 text-blue-600 transition hover:bg-blue-500/15"
                      >
                        <ShieldPlus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
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

const OrgMetric = ({ icon, label, value }) => (
  <div className="rounded-xl border border-primary/8 bg-[color-mix(in_srgb,var(--dash-card-soft)_72%,transparent)] px-3 py-3 transition-colors group-hover:border-primary/14">
    <div className="mb-2 flex items-center justify-between gap-2 text-primary/45">
      {icon}
      <span className="text-lg font-bold leading-none text-primary">{value}</span>
    </div>
    <p className="truncate text-[11px] font-bold uppercase tracking-wide text-primary/45">{label}</p>
  </div>
);

export default Organizations;
