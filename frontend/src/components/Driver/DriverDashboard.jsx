import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Truck, MapPin, Package, Calendar, Bell, ChevronRight,
  Wifi, WifiOff, Clock, Route, AlertTriangle, User,
} from "lucide-react";
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
  const [socketConnected, setSocketConnected] = useState(false);
  const [newPickupFlash, setNewPickupFlash] = useState(false);
  const flashTimeoutRef = useRef(null);

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

  const fetchPendingPickups = useCallback(async () => {
    try {
      const res = await api.get("/pickups/pending");
      if (res.data.pickups) setPendingPickups(res.data.pickups);
    } catch (_) {}
  }, []);

  useEffect(() => { fetchPendingPickups(); }, [fetchPendingPickups]);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => { setSocketConnected(true); fetchPendingPickups(); };
    const onDisconnect = () => setSocketConnected(false);

    const onCreated = (pickup) => {
      if (!profile || !profile.truck) return;
      setPendingPickups((prev) => {
        if (prev.some((p) => p.id === pickup.id || p._id === pickup._id)) return prev;
        return [pickup, ...prev];
      });
      setNewPickupFlash(true);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setNewPickupFlash(false), 3000);
    };

    const onAccepted = ({ id, _id }) => {
      const pickupId = id || _id;
      setPendingPickups((prev) => prev.filter((p) => (p.id || p._id) !== pickupId));
    };

    const onCancelled = ({ id, _id }) => {
      const pickupId = id || _id;
      setPendingPickups((prev) => prev.filter((p) => (p.id || p._id) !== pickupId));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setSocketConnected(socket.connected);
    socket.on("pickup:created", onCreated);
    socket.on("pickup:accepted", onAccepted);
    socket.on("pickup:cancelled", onCancelled);

    const onScheduleConfirmed = () => fetchDriverAssignments();
    socket.on("schedule:confirmed", onScheduleConfirmed);
    socket.on("schedule:updated", onScheduleConfirmed);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("pickup:created", onCreated);
      socket.off("pickup:accepted", onAccepted);
      socket.off("pickup:cancelled", onCancelled);
      socket.off("schedule:confirmed", onScheduleConfirmed);
      socket.off("schedule:updated", onScheduleConfirmed);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, [profile, fetchPendingPickups, fetchDriverAssignments]);

  const handleViewRequest = (pickupId) => {
    navigate("/accept-task", { state: { pickupId } });
  };

  const truck = profile?.truck;
  const greeting = getGreeting();
  const firstName = (user?.name || "Driver").split(" ")[0];

  return (
    <div className="min-h-screen bg-[#f5f3ee] pb-24">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="bg-gradient-to-br from-[#354f52] to-[#2d4a4e] px-5 sm:px-8 pt-8 pb-10 sm:rounded-b-3xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm font-medium">{greeting}</p>
              <h1 className="text-2xl font-bold text-white mt-0.5">{firstName}</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                socketConnected
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-red-500/20 text-red-300"
              }`}>
                {socketConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                {socketConnected ? "Live" : "Offline"}
              </div>
              <Link
                to="/profile"
                className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/25 transition"
              >
                <User size={18} />
              </Link>
            </div>
          </div>

          {/* Stat Cards - inside header */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <StatCard
              icon={<Package size={16} />}
              value={pendingPickups.length}
              label="Requests"
              color="amber"
              pulse={newPickupFlash}
            />
            <StatCard
              icon={<Calendar size={16} />}
              value={driverAssignments.length}
              label="Areas Today"
              color="blue"
            />
            <StatCard
              icon={<Truck size={16} />}
              value={truck ? truck.licensePlate : "--"}
              label={truck ? `${truck.capacity}kg` : "No Truck"}
              color="teal"
              small={!!truck}
            />
          </div>
        </div>

        {/* Connection Lost Warning */}
        {!socketConnected && (
          <div className="mx-5 sm:mx-8 mt-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">Connection Lost</p>
              <p className="text-xs text-red-500/70">New pickup requests may be delayed.</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="px-5 sm:px-8 pt-6 space-y-6">

          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-3">
            <ActionTile
              to="/accept-task"
              icon={<Package size={20} />}
              label="Requests"
              color="bg-amber-50 text-amber-600"
              iconBg="bg-amber-100"
              badge={pendingPickups.length}
            />
            <ActionTile
              to="/driver-ml-assignments"
              icon={<Calendar size={20} />}
              label="Schedule"
              color="bg-blue-50 text-blue-600"
              iconBg="bg-blue-100"
              badge={driverAssignments.length}
            />
            <ActionTile
              to="/driver-notifications"
              icon={<Bell size={20} />}
              label="Alerts"
              color="bg-violet-50 text-violet-600"
              iconBg="bg-violet-100"
            />
            <ActionTile
              to="/profile"
              icon={<User size={20} />}
              label="Profile"
              color="bg-teal-50 text-teal-600"
              iconBg="bg-teal-100"
            />
          </div>

          {/* Live Pickup Requests */}
          {pendingPickups.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                  </span>
                  <h2 className="text-sm font-bold text-primary uppercase tracking-wider">
                    Pending Requests
                  </h2>
                </div>
                <Link to="/accept-task" className="text-xs font-semibold text-primary/50 flex items-center gap-1 hover:text-primary transition">
                  View All <ChevronRight size={14} />
                </Link>
              </div>
              <div className="space-y-2.5">
                {pendingPickups.slice(0, 3).map((pickup) => (
                  <button
                    key={pickup.id || pickup._id}
                    onClick={() => handleViewRequest(pickup.id || pickup._id)}
                    className={`w-full text-left bg-white rounded-2xl border-l-4 shadow-sm p-4 flex items-center gap-4 hover:shadow-md active:scale-[0.98] transition-all ${
                      newPickupFlash ? "border-l-red-500" : "border-l-amber-500"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                      <MapPin size={18} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary truncate">
                        {pickup.location?.address || `${pickup.location?.latitude?.toFixed(3)}, ${pickup.location?.longitude?.toFixed(3)}`}
                      </p>
                      <p className="text-xs text-primary/50 mt-0.5">
                        {pickup.category} -- {pickup.level} -- {pickup.customerName || "Customer"}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-primary/30 shrink-0" />
                  </button>
                ))}
                {pendingPickups.length > 3 && (
                  <p className="text-center text-xs text-primary/40 pt-1">
                    +{pendingPickups.length - 3} more
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Today's Schedule Summary */}
          {driverAssignments.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-primary uppercase tracking-wider">
                  Today's Assignments
                </h2>
                <Link to="/driver-ml-assignments" className="text-xs font-semibold text-primary/50 flex items-center gap-1 hover:text-primary transition">
                  Full Schedule <ChevronRight size={14} />
                </Link>
              </div>
              <div className="space-y-2.5">
                {driverAssignments.slice(0, 3).map((a, i) => {
                  const waste = getWasteStyle(a.wasteCategory);
                  return (
                    <Link
                      key={i}
                      to="/driver-ml-assignments"
                      className="flex items-center gap-4 bg-white rounded-2xl shadow-sm p-4 hover:shadow-md active:scale-[0.98] transition-all"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${waste.bg}`}>
                        <Route size={18} className={waste.icon} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-primary truncate">{a.area}</p>
                          {a.wasteCategory && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${waste.badge}`}>
                              {a.wasteCategory}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-primary/50 mt-0.5">
                          {a.areaType} -- {a.predictedWasteKg?.toLocaleString()} kg expected
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-primary">{a.predictedWasteKg?.toLocaleString()}</p>
                        <p className="text-[10px] text-primary/40">kg</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Empty State */}
          {pendingPickups.length === 0 && driverAssignments.length === 0 && !profileLoading && (
            <div className="bg-white rounded-2xl border border-primary/8 p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-4">
                <Clock size={24} className="text-primary/30" />
              </div>
              <h3 className="text-base font-semibold text-primary/70 mb-1">All clear</h3>
              <p className="text-sm text-primary/40 max-w-xs mx-auto">
                No pending requests or schedules right now. New pickups will appear here in real-time.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -- Stat Card ------------------------------------------------------------ */
function StatCard({ icon, value, label, color, pulse = false, small = false }) {
  const colors = {
    amber: "bg-amber-500/20 border-amber-400/20",
    blue:  "bg-blue-500/20 border-blue-400/20",
    teal:  "bg-teal-500/20 border-teal-400/20",
  };
  const textColors = {
    amber: "text-amber-200",
    blue:  "text-blue-200",
    teal:  "text-teal-200",
  };

  return (
    <div className={`rounded-2xl border p-3.5 ${colors[color]} ${pulse ? "ring-2 ring-white/30 animate-pulse" : ""}`}>
      <div className={`mb-1.5 ${textColors[color]}`}>{icon}</div>
      <p className={`font-bold text-white ${small ? "text-xs" : "text-lg"}`}>{value}</p>
      <p className="text-[10px] text-white/50 font-medium uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

/* -- Action Tile ---------------------------------------------------------- */
function ActionTile({ to, icon, label, color, iconBg, badge = 0 }) {
  return (
    <Link
      to={to}
      className={`relative flex flex-col items-center gap-2 py-4 px-2 rounded-2xl bg-white shadow-sm border border-primary/6 hover:shadow-md active:scale-[0.96] transition-all`}
    >
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <span className="text-[11px] font-semibold text-primary/70">{label}</span>
      {badge > 0 && (
        <span className="absolute top-2 right-2 min-w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center text-white text-[9px] font-bold px-1">
          {badge}
        </span>
      )}
    </Link>
  );
}

function getWasteStyle(category) {
  const map = {
    critical: { bg: "bg-red-50",     icon: "text-red-600",     badge: "bg-red-100 text-red-700" },
    high:     { bg: "bg-orange-50",   icon: "text-orange-600",  badge: "bg-orange-100 text-orange-700" },
    medium:   { bg: "bg-amber-50",    icon: "text-amber-600",   badge: "bg-amber-100 text-amber-700" },
    low:      { bg: "bg-emerald-50",  icon: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
  };
  return map[category] || { bg: "bg-gray-50", icon: "text-gray-500", badge: "bg-gray-100 text-gray-600" };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
