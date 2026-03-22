import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSocket } from "../../utils/socket";
import useAuthStore from "../../stores/useAuthStore";
import useMLScheduleStore from "../../stores/useMLScheduleStore";
import api from "../../utils/api";

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { driverAssignments, fetchDriverAssignments } = useMLScheduleStore();

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [pendingPickups, setPendingPickups] = useState([]);
  const [showScheduleToast, setShowScheduleToast] = useState(true);

  // ── Fetch driver profile with truck + org ─────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/driver/me");
        setProfile(res.data.driver);
      } catch (err) {
        console.error("Failed to load driver profile:", err);
      } finally {
        setProfileLoading(false);
      }
    })();
    fetchDriverAssignments();
  }, []);

  // ── Socket: listen for pickup events ──────────────────────────────────
  useEffect(() => {
    const socket = getSocket();

    const onCreated = (pickup) => {
      // If we don't have a profile yet or no truck, we shouldn't show requests
      if (!profile || !profile.truck) return;

      setPendingPickups((prev) => {
        if (prev.some((p) => p.id === pickup.id)) return prev;
        return [pickup, ...prev];
      });
    };
    const onAccepted = ({ id }) =>
      setPendingPickups((prev) => prev.filter((p) => p.id !== id));
    const onCancelled = ({ id }) =>
      setPendingPickups((prev) => prev.filter((p) => p.id !== id));

    socket.on("pickup:created", onCreated);
    socket.on("pickup:accepted", onAccepted);
    socket.on("pickup:cancelled", onCancelled);

    return () => {
      socket.off("pickup:created", onCreated);
      socket.off("pickup:accepted", onAccepted);
      socket.off("pickup:cancelled", onCancelled);
    };
  }, []);

  const handleViewRequest = (pickupId) => {
    navigate("/accept-task", { state: { pickupId } });
  };

  const truck = profile?.truck;
  const org = profile?.organization;

  // ── Helpers ────────────────────────────────────────────────────────────
  const dutyBadge = (duty) => {
    if (duty === "light duty") return { label: "Light Duty", cls: "bg-blue-100 text-blue-700" };
    if (duty === "medium duty") return { label: "Medium Duty", cls: "bg-amber-100 text-amber-700" };
    if (duty === "heavy duty") return { label: "Heavy Duty", cls: "bg-red-100 text-red-700" };
    return { label: duty || "—", cls: "bg-gray-100 text-gray-600" };
  };

  const typeBadge = (type) => {
    if (type === "BIO") return { icon: "🌿", cls: "bg-green-100 text-green-700" };
    if (type === "MIXED") return { icon: "🔀", cls: "bg-purple-100 text-purple-700" };
    return { icon: "♻️", cls: "bg-slate-100 text-slate-700" };
  };

  return (
    <div className="app-bg min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {/* ─── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-8 sm:mb-10">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--primary)]">
              Driver Dashboard
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--primary)]/70">
              <span className="inline-flex items-center gap-2">
                <TruckIcon />
                <span className="font-semibold text-[var(--primary)]">
                  {user?.name || "Driver"}
                </span>
              </span>
              {org && (
                <>
                  <span className="text-[var(--primary)]/25">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-base">🏢</span>
                    <span>{org.name}</span>
                  </span>
                </>
              )}
              <span className="text-[var(--primary)]/25">•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Online
              </span>
            </div>
          </div>

          <Link
            to="/profile"
            className="w-11 h-11 rounded-full border border-[var(--primary)]/30 bg-white flex items-center justify-center hover:shadow-sm active:scale-95 transition"
            aria-label="Profile"
          >
            <UserIcon />
          </Link>
        </div>

        {/* ─── Live Pickup Requests Banner ─────────────────────────────── */}
        {pendingPickups.length > 0 && (
          <div className="mb-8 bg-amber-50 border border-amber-200 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-amber-800 flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                </span>
                {pendingPickups.length} New Pickup Request{pendingPickups.length > 1 ? "s" : ""}
              </p>
              <span className="text-xs text-amber-600 font-medium uppercase tracking-wide">Live</span>
            </div>

            <div className="space-y-2.5">
              {pendingPickups.map((pickup) => (
                <div
                  key={pickup.id}
                  className="flex items-center justify-between bg-white rounded-xl border border-amber-200 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--primary)] truncate">
                      {pickup.location?.address || `${pickup.location?.latitude?.toFixed(3)}, ${pickup.location?.longitude?.toFixed(3)}`}
                    </p>
                    <p className="text-xs text-[var(--primary)]/55 mt-1">
                      {pickup.category} · {pickup.level} · {pickup.customerName || "Customer"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleViewRequest(pickup.id)}
                    className="ml-4 flex-shrink-0 bg-[var(--primary)] text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── ML Schedule Assignment Toast ──────────────────────────── */}
        {showScheduleToast && driverAssignments.length > 0 && (
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-2xl p-5 sm:p-6 relative">
            <button
              onClick={() => setShowScheduleToast(false)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 hover:bg-blue-200 transition text-sm"
            >
              &#x2715;
            </button>
            <div className="flex items-center gap-3 mb-4">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
              </span>
              <p className="font-bold text-blue-800 text-lg">Today's Schedule</p>
              <span className="text-xs text-blue-600 font-medium uppercase tracking-wide bg-blue-100 px-2 py-0.5 rounded-full">Active</span>
            </div>
            <p className="text-sm text-blue-700 mb-4">You have been assigned to the following areas for waste collection today.</p>

            <div className="space-y-2.5">
              {driverAssignments.map((assignment, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-white rounded-xl border border-blue-200 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--primary)]">{assignment.district}</p>
                    <p className="text-xs text-[var(--primary)]/55 mt-1">
                      {assignment.districtType} &middot; {assignment.predictedWasteKg?.toLocaleString()} kg predicted
                      {assignment.wasteCategory && <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        assignment.wasteCategory === "critical" ? "bg-red-100 text-red-700" :
                        assignment.wasteCategory === "high" ? "bg-orange-100 text-orange-700" :
                        assignment.wasteCategory === "medium" ? "bg-amber-100 text-amber-700" :
                        "bg-green-100 text-green-700"
                      }`}>{assignment.wasteCategory}</span>}
                    </p>
                  </div>
                  <Link
                    to="/driver-ml-assignments"
                    className="ml-4 flex-shrink-0 bg-blue-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 active:scale-95 transition"
                  >
                    View Route
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Main Grid ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

          {/* Left column — 2/3 width */}
          <div className="lg:col-span-2 space-y-6 lg:space-y-8">

            {/* ── Driver Profile Card ─────────────────────────────────── */}
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]/50">Driver Profile</p>
                  <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-[var(--primary)]">
                    {profile?.name || user?.name || "Driver"}
                  </h2>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-xs font-semibold text-green-700">Available</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MiniStat icon="📧" label="Email" value={profile?.email || user?.email || "—"} />
                <MiniStat icon="📞" label="Phone" value={profile?.phone || user?.phone || "—"} />
                <MiniStat icon="🏢" label="Organization" value={org?.name || "Unassigned"} />
              </div>
            </Card>

            {/* ── Assigned Truck Card ─────────────────────────────────── */}
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]/50">Assigned Truck</p>
                  <h3 className="mt-2 text-xl sm:text-2xl font-bold text-[var(--primary)]">
                    {truck ? truck.licensePlate : "No Truck Assigned"}
                  </h3>
                </div>
                {truck && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${truck.isAvailable ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-amber-50 border border-amber-200 text-amber-700"}`}>
                    <span className={`w-2 h-2 rounded-full ${truck.isAvailable ? "bg-emerald-500" : "bg-amber-500"}`} />
                    {truck.isAvailable ? "Available" : "In Use"}
                  </div>
                )}
              </div>

              {profileLoading ? (
                <div className="mt-6 flex items-center justify-center py-8">
                  <div className="w-7 h-7 border-3 border-[var(--primary)]/15 border-t-[var(--accent)] rounded-full animate-spin" />
                </div>
              ) : truck ? (
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-[var(--primary)]/10 bg-[#f5f1e8] p-4">
                    <p className="text-xs text-[var(--primary)]/55 mb-1.5">Capacity</p>
                    <p className="text-lg font-bold text-[var(--primary)]">
                      {truck.capacity?.toLocaleString()}<span className="text-xs font-medium text-[var(--primary)]/60 ml-0.5">kg</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--primary)]/10 bg-[#f5f1e8] p-4">
                    <p className="text-xs text-[var(--primary)]/55 mb-1.5">Duty Class</p>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${dutyBadge(truck.dutyType).cls}`}>
                      {dutyBadge(truck.dutyType).label}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-[var(--primary)]/10 bg-[#f5f1e8] p-4">
                    <p className="text-xs text-[var(--primary)]/55 mb-1.5">License Plate</p>
                    <p className="font-bold text-[var(--primary)] tracking-wide">{truck.licensePlate}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border-2 border-dashed border-[var(--primary)]/15 bg-[#f5f1e8]/50 px-6 py-10 text-center">
                  <p className="text-3xl mb-2">🚛</p>
                  <p className="text-sm font-medium text-[var(--primary)]/60">No truck assigned yet</p>
                  <p className="text-xs text-[var(--primary)]/40 mt-1">Contact your admin to get assigned</p>
                </div>
              )}
            </Card>

            {/* ── Live Status Card ────────────────────────────────────── */}
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]/50">Real-time Requests</p>
                  <h3 className="mt-2 text-xl font-bold text-[var(--primary)]">
                    {pendingPickups.length > 0
                      ? `${pendingPickups.length} pending`
                      : "No pending requests"}
                  </h3>
                </div>
                <span
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${pendingPickups.length > 0
                      ? "bg-amber-100 text-amber-700"
                      : "bg-[var(--primary)]/8 text-[var(--primary)]/70"
                    }`}
                >
                  {pendingPickups.length > 0 ? "Active" : "Quiet"}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <InfoTile label="Live requests" value={`${pendingPickups.length}`} />
                <InfoTile label="Socket" value="Connected" />
                <InfoTile label="Status" value="Active" />
                <InfoTile label="Priority" value="Normal" />
              </div>
            </Card>
          </div>

          {/* Right column — 1/3 width */}
          <div className="space-y-6 lg:space-y-8">

            {/* ── Actions Card ────────────────────────────────────────── */}
            <Card>
              <h3 className="text-lg font-bold text-[var(--primary)] mb-5">Quick Actions</h3>
              <div className="space-y-3">
                <Link
                  to="/accept-task"
                  className="w-full relative bg-[#213a3d] text-white py-4 px-6 rounded-2xl font-semibold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-md border-2 border-[var(--primary)]/20 flex items-center justify-center gap-2"
                >
                  <span>View Requests</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {pendingPickups.length > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[1.25rem] h-5 rounded-full bg-red-500 ring-4 ring-white animate-pulse flex items-center justify-center text-white text-[10px] font-bold px-1">
                      {pendingPickups.length}
                    </span>
                  )}
                </Link>
                <Link
                  to="/driver-ml-assignments"
                  className="w-full relative bg-blue-600 text-white py-4 px-6 rounded-2xl font-semibold hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-md flex items-center justify-center gap-2"
                >
                  <span>Scheduling (Daily)</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {driverAssignments.length > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[1.25rem] h-5 rounded-full bg-blue-800 ring-4 ring-white flex items-center justify-center text-white text-[10px] font-bold px-1">
                      {driverAssignments.length}
                    </span>
                  )}
                </Link>
              </div>
            </Card>

            {/* ── System Status Card ──────────────────────────────────── */}
            <Card>
              <h3 className="text-lg font-bold text-[var(--primary)] mb-5">System Status</h3>
              <div className="space-y-3">
                <StatusRow label="GPS" value="Connected" />
                <StatusRow label="Network" value="Good" />
                <StatusRow label="Socket" value="Live" />
                <StatusRow label="Shift" value="Active" />
              </div>
              <button className="mt-6 w-full py-3.5 rounded-2xl bg-[var(--accent)] text-white font-semibold hover:opacity-95 active:scale-[0.99] transition text-sm">
                Start Shift
              </button>
            </Card>

            {/* ── Organization Card ───────────────────────────────────── */}
            {org && (
              <Card>
                <h3 className="text-lg font-bold text-[var(--primary)] mb-5">Organization</h3>
                <div className="rounded-2xl border border-[var(--primary)]/10 bg-[#f5f1e8] p-5 text-center">
                  <span className="text-3xl mb-3 block">🏢</span>
                  <p className="text-lg font-bold text-[var(--primary)]">{org.name}</p>
                  <p className="text-xs text-[var(--primary)]/50 mt-1 uppercase tracking-wider font-medium">Active Member</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── UI helpers ────────────────────────────────────────────────────────────── */

function Card({ children }) {
  return (
    <div className="bg-white rounded-3xl border border-[var(--primary)]/12 shadow-sm p-6 sm:p-8">
      {children}
    </div>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-[var(--primary)]/10 bg-[#f5f1e8] p-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm">{icon}</span>
        <p className="text-xs text-[var(--primary)]/55 font-medium">{label}</p>
      </div>
      <p className="font-semibold text-[var(--primary)] truncate text-sm">{value}</p>
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-[var(--primary)]/10 bg-white p-4">
      <p className="text-xs text-[var(--primary)]/55 mb-1.5">{label}</p>
      <p className="font-semibold text-[var(--primary)] text-sm">{value}</p>
    </div>
  );
}

function StatusRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[var(--primary)]/10 bg-[#f5f1e8] px-4 py-3.5">
      <span className="text-sm text-[var(--primary)]/65">{label}</span>
      <span className="text-sm font-semibold text-[var(--primary)]">{value}</span>
    </div>
  );
}

function TruckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 7h11v10H3V7Zm11 4h4l3 3v3h-7v-6Z" stroke="currentColor" strokeWidth="2" className="text-red-400" />
      <circle cx="7" cy="19" r="2" fill="currentColor" className="text-[var(--primary)]" />
      <circle cx="18" cy="19" r="2" fill="currentColor" className="text-[var(--primary)]" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" strokeWidth="2" className="text-[var(--primary)]" />
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="2" className="text-[var(--primary)]" />
    </svg>
  );
}
