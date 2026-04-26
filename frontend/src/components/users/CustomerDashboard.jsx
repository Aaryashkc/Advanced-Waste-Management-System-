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
  Receipt,
  Truck,
  AlertTriangle,
} from "lucide-react";
import api from "../../utils/api";
import useAuthStore from "../../stores/useAuthStore";
import useBillingStore from "../../stores/useBillingStore";
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
  PAYMENT_REQUIRED: "#f97316",
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

function RecentPickupRow({ pickup, onCancel, onCompletePayment }) {
  const statusColor = STATUS_COLORS[pickup.status] || "#9ca3af";
  const [cancelling, setCancelling] = useState(false);
  const pickupId = pickup.id || pickup._id;
  const needsPayment = pickup.status === "PAYMENT_REQUIRED";
  const canCancel = needsPayment || pickup.status === "PENDING" || pickup.status === "ASSIGNED";

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
        {needsPayment && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCompletePayment?.(pickupId);
            }}
            className="rounded-lg px-2.5 py-1 text-[11px] font-semibold border border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 transition"
          >
            Complete Payment
          </button>
        )}
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
  const { bills, summary: billingSummary, fetchMyBills, payBill } = useBillingStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [billingPayingId, setBillingPayingId] = useState(null);

  // Single source of truth for fetching dashboard data.
  // Stable across renders so socket / focus listeners can call it without
  // re-registering, and so that we never patch stats locally and drift out
  // of sync with the server (which caused "stats reset after payment" since
  // the old socket handler only updated statusCounts and not totalSpent /
  // monthly / category / level / total).
  const fetchDashboard = useRef(null);
  fetchDashboard.current = async ({ showLoader = false } = {}) => {
    try {
      if (showLoader) setLoading(true);
      const res = await api.get("/pickups/my-pickups");
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dashboard");
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDashboard.current({ showLoader: true });
    fetchMyBills();
  }, [fetchMyBills]);

  // ── Realtime: keep dashboard in sync via WebSocket ───────────────────────
  // Any pickup event that could affect this customer's stats triggers a full
  // refetch. This is cheaper than reasoning about partial patches and
  // guarantees totalSpent / monthly / category / level / status counts all
  // stay consistent with the server (especially after payment completion).
  useEffect(() => {
    const socket = getSocket();
    const refetch = () => fetchDashboard.current();

    socket.on("pickup:statusUpdate", refetch);
    socket.on("pickup:accepted", refetch);
    socket.on("pickup:created", refetch);
    socket.on("pickup:cancelled", refetch);
    socket.on("payment:updated", refetch);

    return () => {
      socket.off("pickup:statusUpdate", refetch);
      socket.off("pickup:accepted", refetch);
      socket.off("pickup:created", refetch);
      socket.off("pickup:cancelled", refetch);
      socket.off("payment:updated", refetch);
    };
  }, []);

  // Refetch when the tab regains focus / becomes visible.
  // This catches the eSewa redirect flow: customer leaves the SPA for the
  // hosted checkout, comes back to /payment-success, then to the dashboard.
  // Without this, any cached dashboard state would look stale ("reset").
  useEffect(() => {
    const onFocus = () => {
      fetchDashboard.current();
      fetchMyBills();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchDashboard.current();
        fetchMyBills();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchMyBills]);

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
              <button
                onClick={() => navigate("/billing")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white font-semibold rounded-xl hover:bg-white/20 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
              >
                <Receipt size={16} />
                Pay Bills
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

        {/* ── Billing Summary ── */}
        {billingSummary && billingSummary.unpaid > 0 && (
          <section className="pb-6 px-6 md:px-16 lg:px-24">
            <div className="max-w-5xl mx-auto">
              <FadeIn delay={450}>
                <div className="bg-white/5 backdrop-blur-md border border-amber-500/20 rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
                      <Receipt size={14} /> Pending Bills
                    </h3>
                    <button
                      onClick={() => navigate("/billing")}
                      className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition flex items-center gap-1"
                    >
                      View All <ArrowRight size={12} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-amber-400">{billingSummary.unpaid}</p>
                      <p className="text-xs text-white/40 mt-0.5">Unpaid Bills</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-red-400">NPR {(billingSummary.totalDue || 0).toLocaleString()}</p>
                      <p className="text-xs text-white/40 mt-0.5">Total Due</p>
                    </div>
                  </div>

                  {/* Show up to 3 unpaid bills with quick-pay */}
                  <div className="space-y-2">
                    {bills
                      .filter((b) => b.status === "UNPAID" || b.status === "OVERDUE")
                      .slice(0, 3)
                      .map((bill) => {
                        const isOverdue = bill.status === "OVERDUE";
                        const isPaying = billingPayingId === bill._id;
                        return (
                          <div
                            key={bill._id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition-all"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-white">
                                {new Date(bill.billingYear, bill.billingMonth - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                              </p>
                              <p className="text-xs text-white/40 mt-0.5">
                                Due: {new Date(bill.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                {isOverdue && <span className="text-red-400 ml-2 font-semibold">OVERDUE</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-white font-bold text-sm">NPR {bill.amount.toLocaleString()}</span>
                              <button
                                onClick={async () => {
                                  setBillingPayingId(bill._id);
                                  const result = await payBill(bill._id, "esewa");
                                  if (result.redirecting) return;
                                  setBillingPayingId(null);
                                  if (!result.success) alert(result.error || "Payment failed");
                                  else fetchMyBills();
                                }}
                                disabled={isPaying}
                                className="rounded-lg px-3 py-1.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isPaying ? "Processing..." : "Pay eSewa"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </FadeIn>
            </div>
          </section>
        )}

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
                        onCancel={() => fetchDashboard.current()}
                        onCompletePayment={(id) => navigate(`/searching?pickupId=${encodeURIComponent(id)}`)}
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
