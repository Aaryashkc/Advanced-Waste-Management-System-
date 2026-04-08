import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Upload,
  CalendarDays,
  ArrowRight,

  Truck,
  AlertTriangle,
} from "lucide-react";
import api from "../../utils/api";
import useAuthStore from "../../stores/useAuthStore";
import TruckLoader from "../shared/TruckLoader";
import { getSocket } from "../../utils/socket";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

/* ── Viewport observer (same pattern as OurTeam / SchedulePage) ── */

function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

function FadeIn({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

/* ── Constants ── */

const DASHBOARD_BG = "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?q=80&w=1920&auto=format&fit=crop";

const STATUS_COLORS = {
  PENDING: "#f59e0b",
  ASSIGNED: "#3b82f6",
  EN_ROUTE: "#6366f1",
  ARRIVED: "#8b5cf6",
  COLLECTING: "#06b6d4",
  COMPLETED: "#22c55e",
  CANCELLED: "#ef4444",
  EXPIRED: "#9ca3af",
  REJECTED: "#dc2626",
};

const CATEGORY_COLORS = {
  recyclable: "#22c55e",
  "non-recyclable": "#f59e0b",
  both: "#6366f1",
};

const LEVEL_COLORS = {
  easy: "#22c55e",
  medium: "#f59e0b",
  hard: "#ef4444",
};

/* ── Stat card ── */

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div
      className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 text-center hover:bg-white/10 hover:border-white/20 transition-all duration-300"
    >
      <div
        className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center"
        style={{ backgroundColor: `${accent}20` }}
      >
        <Icon size={20} style={{ color: accent }} />
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-white">{value}</p>
      <p className="text-white/50 text-sm mt-1 font-medium">{label}</p>
    </div>
  );
}

/* ── Chart card (glassmorphism) ── */

function ChartCard({ title, children, className = "" }) {
  return (
    <div className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 hover:border-white/15 transition-all duration-300 ${className}`}>
      <h3 className="mb-4 text-xs font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

/* ── Recent pickup row ── */

function RecentPickupRow({ pickup, onCancel }) {
  const statusColor = STATUS_COLORS[pickup.status] || "#9ca3af";
  const [cancelling, setCancelling] = useState(false);
  const canCancel = pickup.status === "PENDING" || pickup.status === "ASSIGNED";

  const handleCancel = async (e) => {
    e.stopPropagation();
    if (!window.confirm("Cancel this pickup request?")) return;
    setCancelling(true);
    try {
      await api.post(`/pickups/${pickup.id}/cancel`);
      onCancel?.(pickup.id);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to cancel pickup");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate font-['Outfit',sans-serif]">
          {pickup.location?.address || pickup.area || "Pickup Request"}
        </p>
        <p className="text-xs text-white/40 mt-0.5 font-['Outfit',sans-serif]">
          {new Date(pickup.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {" · "}
          {pickup.category}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="rounded-lg px-2.5 py-1 text-[11px] font-semibold border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelling ? "Cancelling..." : "Cancel"}
          </button>
        )}
        <span
          className="rounded-lg px-2.5 py-1 text-[11px] font-semibold border"
          style={{
            color: statusColor,
            backgroundColor: `${statusColor}15`,
            borderColor: `${statusColor}30`,
          }}
        >
          {pickup.status}
        </span>
      </div>
    </div>
  );
}

/* ── Empty chart placeholder ── */

function EmptyChart({ message }) {
  return (
    <div className="flex h-52 items-center justify-center">
      <p className="text-sm text-white/30 font-['Outfit',sans-serif]">{message}</p>
    </div>
  );
}

/* ── Main component ── */

function CustomerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await api.get("/pickups/my-pickups");
        if (!cancelled) setData(res.data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  // ── Realtime: keep dashboard in sync via WebSocket ───────────────────────
  useEffect(() => {
    const socket = getSocket();

    const applyStatusChange = (id, nextStatus, extra = {}) => {
      setData((prev) => {
        if (!prev) return prev;
        const target = prev.pickups.find((p) => p.id?.toString() === id?.toString());
        if (!target) return prev;
        const prevStatus = target.status;
        if (prevStatus === nextStatus) return prev;

        const nextPickups = prev.pickups.map((p) =>
          p.id?.toString() === id?.toString() ? { ...p, status: nextStatus, ...extra } : p
        );
        const counts = { ...(prev.stats?.statusCounts || {}) };
        counts[prevStatus] = Math.max(0, (counts[prevStatus] || 0) - 1);
        counts[nextStatus] = (counts[nextStatus] || 0) + 1;
        return { ...prev, pickups: nextPickups, stats: { ...prev.stats, statusCounts: counts } };
      });
    };

    const onStatusUpdate = (data) => applyStatusChange(data.id, data.status);
    const onAccepted = (data) => applyStatusChange(data.id, "ASSIGNED", { driverId: data.driverId });
    const onCreated = () => {
      // A new pickup belongs to us — refetch to pick it up with full payload
      api.get("/pickups/my-pickups").then((res) => setData(res.data)).catch(() => {});
    };

    socket.on("pickup:statusUpdate", onStatusUpdate);
    socket.on("pickup:accepted", onAccepted);
    socket.on("pickup:created", onCreated);

    return () => {
      socket.off("pickup:statusUpdate", onStatusUpdate);
      socket.off("pickup:accepted", onAccepted);
      socket.off("pickup:created", onCreated);
    };
  }, []);

  const stats = data?.stats;
  const pickups = data?.pickups || [];

  // Chart data
  const statusChartData = useMemo(() => {
    if (!stats?.statusCounts) return null;
    const entries = Object.entries(stats.statusCounts);
    return {
      labels: entries.map(([k]) => k),
      datasets: [
        {
          data: entries.map(([, v]) => v),
          backgroundColor: entries.map(([k]) => STATUS_COLORS[k] || "#9ca3af"),
          borderWidth: 0,
          spacing: 3,
        },
      ],
    };
  }, [stats]);

  const categoryChartData = useMemo(() => {
    if (!stats?.categoryCounts) return null;
    const entries = Object.entries(stats.categoryCounts);
    return {
      labels: entries.map(([k]) => k.charAt(0).toUpperCase() + k.slice(1)),
      datasets: [
        {
          data: entries.map(([, v]) => v),
          backgroundColor: entries.map(([k]) => CATEGORY_COLORS[k] || "#9ca3af"),
          borderWidth: 0,
          spacing: 3,
        },
      ],
    };
  }, [stats]);

  const levelChartData = useMemo(() => {
    if (!stats?.levelCounts) return null;
    const entries = Object.entries(stats.levelCounts);
    return {
      labels: entries.map(([k]) => k.charAt(0).toUpperCase() + k.slice(1)),
      datasets: [
        {
          data: entries.map(([, v]) => v),
          backgroundColor: entries.map(([k]) => LEVEL_COLORS[k] || "#9ca3af"),
          borderWidth: 0,
          spacing: 3,
        },
      ],
    };
  }, [stats]);

  const monthlyChartData = useMemo(() => {
    if (!stats?.monthly?.length) return null;
    const months = stats.monthly.map((m) => {
      const [y, mo] = m.month.split("-");
      return new Date(y, mo - 1).toLocaleDateString("en-US", { month: "short" });
    });
    return {
      labels: months,
      datasets: [
        {
          label: "Created",
          data: stats.monthly.map((m) => m.created),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "#3b82f6",
        },
        {
          label: "Completed",
          data: stats.monthly.map((m) => m.completed),
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,0.1)",
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "#22c55e",
        },
        {
          label: "Cancelled",
          data: stats.monthly.map((m) => m.cancelled),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.08)",
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "#ef4444",
        },
      ],
    };
  }, [stats]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 10,
          font: { size: 12, family: "'Outfit', sans-serif" },
          color: "rgba(255,255,255,0.5)",
        },
      },
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 10,
          font: { size: 12, family: "'Outfit', sans-serif" },
          color: "rgba(255,255,255,0.5)",
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 12, family: "'Outfit', sans-serif" }, color: "rgba(255,255,255,0.35)" },
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 12, family: "'Outfit', sans-serif" }, color: "rgba(255,255,255,0.35)" },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
    },
  };

  // Loading state
  if (loading) {
    return (
      <div className="relative min-h-screen font-['Outfit',sans-serif] bg-black">
        <div
          className="fixed inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${DASHBOARD_BG})` }}
        />
        <div className="fixed inset-0 z-0 bg-black/90 backdrop-blur-xs" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
            <TruckLoader />
            <p className="text-sm text-white/50 font-medium">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="relative min-h-screen font-['Outfit',sans-serif] bg-black">
        <div
          className="fixed inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${DASHBOARD_BG})` }}
        />
        <div className="fixed inset-0 z-0 bg-black/90 backdrop-blur-xs" />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen gap-4 px-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-red-300 text-lg font-semibold mb-1">Could not load dashboard</p>
            <p className="text-red-400/60 text-sm max-w-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const completed = stats?.statusCounts?.COMPLETED || 0;
  const cancelled = stats?.statusCounts?.CANCELLED || 0;
  const pending = stats?.statusCounts?.PENDING || 0;
  const active =
    (stats?.statusCounts?.ASSIGNED || 0) +
    (stats?.statusCounts?.EN_ROUTE || 0) +
    (stats?.statusCounts?.ARRIVED || 0) +
    (stats?.statusCounts?.COLLECTING || 0);

  return (
    <div className="relative min-h-screen font-['Outfit',sans-serif] bg-black">
      {/* ── Dynamic Background ── */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${DASHBOARD_BG})` }}
      />
      <div className="fixed inset-0 z-0 bg-black/90 backdrop-blur-xs" />

      {/* ── Content ── */}
      <div className="relative z-10 pt-24">
        {/* ── Hero header ── */}
        <section className="pb-8 sm:pb-12 px-6 md:px-16 lg:px-24 text-center">
          <FadeIn>
            <span className="inline-block text-white/50 text-xs font-semibold tracking-widest uppercase mb-4">
              Dashboard
            </span>
          </FadeIn>

          <FadeIn delay={100}>
            <h1 className="font-bold text-white text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.1] tracking-tight mb-6 drop-shadow-md">
              Welcome back, {user?.name?.split(" ")[0] || "there"}
            </h1>
          </FadeIn>

          <FadeIn delay={200}>
            <p className="text-white/60 text-lg max-w-2xl mx-auto leading-relaxed mb-6">
              Here's an overview of your waste collection activity.
            </p>
          </FadeIn>

          {/* Quick actions */}
          <FadeIn delay={250}>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => navigate("/upload-waste")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg cursor-pointer"
              >
                <Upload size={16} />
                Request Pickup
              </button>
              <button
                onClick={() => navigate("/schedule")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white font-semibold rounded-xl hover:bg-white/20 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
              >
                <CalendarDays size={16} />
                View Schedule
              </button>
            </div>
          </FadeIn>
        </section>

        {/* ── Stat cards ── */}
        <section className="pb-8 px-6 md:px-16 lg:px-24">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { icon: Package, value: stats?.total || 0, label: "Total Requests", accent: "#3b82f6" },
              { icon: CheckCircle2, value: completed, label: "Completed", accent: "#22c55e" },
              { icon: Truck, value: active, label: "Active", accent: "#6366f1" },
              { icon: Clock, value: pending, label: "Pending", accent: "#f59e0b" },
              { icon: XCircle, value: cancelled, label: "Cancelled", accent: "#ef4444" },
            ].map((stat, i) => (
              <FadeIn key={stat.label} delay={300 + i * 80}>
                <StatCard {...stat} />
              </FadeIn>
            ))}
          </div>
        </section>

        {/* ── Charts row 1: Monthly trend + Status ── */}
        <section className="pb-6 px-6 md:px-16 lg:px-24">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            <FadeIn delay={500} className="lg:col-span-2">
              <ChartCard title="Monthly Trend">
                {monthlyChartData ? (
                  <div className="h-64">
                    <Line data={monthlyChartData} options={lineOptions} />
                  </div>
                ) : (
                  <EmptyChart message="No monthly data yet" />
                )}
              </ChartCard>
            </FadeIn>

            <FadeIn delay={580}>
              <ChartCard title="Status Breakdown">
                {statusChartData ? (
                  <div className="h-64 flex items-center justify-center">
                    <Doughnut data={statusChartData} options={doughnutOptions} />
                  </div>
                ) : (
                  <EmptyChart message="No pickups yet" />
                )}
              </ChartCard>
            </FadeIn>
          </div>
        </section>

        {/* ── Charts row 2: Category + Level + Spending ── */}
        <section className="pb-6 px-6 md:px-16 lg:px-24">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            <FadeIn delay={620}>
              <ChartCard title="By Category">
                {categoryChartData ? (
                  <div className="h-52 flex items-center justify-center">
                    <Doughnut data={categoryChartData} options={doughnutOptions} />
                  </div>
                ) : (
                  <EmptyChart message="No data" />
                )}
              </ChartCard>
            </FadeIn>

            <FadeIn delay={660}>
              <ChartCard title="By Difficulty">
                {levelChartData ? (
                  <div className="h-52 flex items-center justify-center">
                    <Doughnut data={levelChartData} options={doughnutOptions} />
                  </div>
                ) : (
                  <EmptyChart message="No data" />
                )}
              </ChartCard>
            </FadeIn>

            <FadeIn delay={700}>
              <ChartCard title="Total Spent">
                <div className="flex h-52 flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                    <TrendingUp size={28} className="text-emerald-400/60" />
                  </div>
                  <p className="text-3xl font-bold text-white">
                    NPR {(stats?.totalSpent || 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-white/40 mt-1">on completed pickups</p>
                </div>
              </ChartCard>
            </FadeIn>
          </div>
        </section>

        {/* ── Recent pickups ── */}
        <section className="px-6 md:px-16 lg:px-24 pb-20">
          <div className="max-w-7xl mx-auto">
            <FadeIn delay={750}>
              <ChartCard title="Recent Pickups">
                {pickups.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {pickups.map((p) => (
                      <RecentPickupRow
                        key={p.id}
                        pickup={p}
                        onCancel={(id) =>
                          setData((prev) => {
                            if (!prev) return prev;
                            const prevStatus = prev.pickups.find((x) => x.id === id)?.status;
                            const nextPickups = prev.pickups.map((x) =>
                              x.id === id ? { ...x, status: "CANCELLED" } : x
                            );
                            const nextStatusCounts = { ...(prev.stats?.statusCounts || {}) };
                            if (prevStatus) {
                              nextStatusCounts[prevStatus] = Math.max(0, (nextStatusCounts[prevStatus] || 0) - 1);
                            }
                            nextStatusCounts.CANCELLED = (nextStatusCounts.CANCELLED || 0) + 1;
                            return {
                              ...prev,
                              pickups: nextPickups,
                              stats: { ...prev.stats, statusCounts: nextStatusCounts },
                            };
                          })
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-4">
                      <Package size={32} className="text-white/30" />
                    </div>
                    <p className="text-white/60 font-semibold text-lg mb-1">No pickups yet</p>
                    <p className="text-sm text-white/40 mb-6 max-w-md">
                      Request your first pickup to see activity here.
                    </p>
                    <button
                      onClick={() => navigate("/upload-waste")}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg cursor-pointer"
                    >
                      Get Started <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </ChartCard>
            </FadeIn>
          </div>
        </section>
      </div>
    </div>
  );
}

export default CustomerDashboard;
