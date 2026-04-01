import { useEffect, useState, useMemo } from "react";
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
  Loader2,
  Truck,
  AlertTriangle,
} from "lucide-react";
import api from "../../utils/api";
import useAuthStore from "../../stores/useAuthStore";

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

function StatCard({ icon: Icon, label, value, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 rounded-2xl border bg-white p-5 text-left transition-all hover:shadow-md ${
        onClick ? "cursor-pointer hover:-translate-y-0.5" : "cursor-default"
      }`}
      style={{ borderColor: `${accent}25` }}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${accent}15` }}
      >
        <Icon size={22} style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 truncate">{label}</p>
      </div>
    </button>
  );
}

function ChartCard({ title, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  );
}

function RecentPickupRow({ pickup }) {
  const statusColor = STATUS_COLORS[pickup.status] || "#9ca3af";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-50 bg-gray-50/50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800 truncate">
          {pickup.location?.address || pickup.area || "Pickup Request"}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {new Date(pickup.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {" \u00B7 "}
          {pickup.category}
        </p>
      </div>
      <span
        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{
          color: statusColor,
          backgroundColor: `${statusColor}15`,
        }}
      >
        {pickup.status}
      </span>
    </div>
  );
}

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
        labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } },
      },
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 12 } } },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 12 } },
        grid: { color: "rgba(0,0,0,0.04)" },
      },
    },
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/60 flex items-center justify-center pt-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50/60 flex items-center justify-center pt-20">
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <p className="text-gray-700 font-medium">Could not load dashboard</p>
          <p className="text-sm text-gray-500">{error}</p>
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
    <div className="min-h-screen bg-gray-50/60 pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(" ")[0] || "there"}
          </h1>
          <p className="mt-1 text-gray-500">
            Here's an overview of your waste collection activity.
          </p>
        </div>

        {/* Quick actions */}
        <div className="mb-8 flex flex-wrap gap-3">
          <button
            onClick={() => navigate("/upload-waste")}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 cursor-pointer"
          >
            <Upload size={16} />
            Request Pickup
          </button>
          <button
            onClick={() => navigate("/schedule")}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 cursor-pointer"
          >
            <CalendarDays size={16} />
            View Schedule
          </button>
        </div>

        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={Package} label="Total Requests" value={stats?.total || 0} accent="#3b82f6" />
          <StatCard icon={CheckCircle2} label="Completed" value={completed} accent="#22c55e" />
          <StatCard icon={Truck} label="Active" value={active} accent="#6366f1" />
          <StatCard icon={Clock} label="Pending" value={pending} accent="#f59e0b" />
          <StatCard icon={XCircle} label="Cancelled" value={cancelled} accent="#ef4444" />
        </div>

        {/* Charts row 1: Monthly trend + Status */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartCard title="Monthly Trend" className="lg:col-span-2">
            {monthlyChartData ? (
              <div className="h-64">
                <Line data={monthlyChartData} options={lineOptions} />
              </div>
            ) : (
              <EmptyChart message="No monthly data yet" />
            )}
          </ChartCard>

          <ChartCard title="Status Breakdown">
            {statusChartData ? (
              <div className="h-64 flex items-center justify-center">
                <Doughnut data={statusChartData} options={doughnutOptions} />
              </div>
            ) : (
              <EmptyChart message="No pickups yet" />
            )}
          </ChartCard>
        </div>

        {/* Charts row 2: Category + Level + Spending */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <ChartCard title="By Category">
            {categoryChartData ? (
              <div className="h-52 flex items-center justify-center">
                <Doughnut data={categoryChartData} options={doughnutOptions} />
              </div>
            ) : (
              <EmptyChart message="No data" />
            )}
          </ChartCard>

          <ChartCard title="By Difficulty">
            {levelChartData ? (
              <div className="h-52 flex items-center justify-center">
                <Doughnut data={levelChartData} options={doughnutOptions} />
              </div>
            ) : (
              <EmptyChart message="No data" />
            )}
          </ChartCard>

          <ChartCard title="Total Spent">
            <div className="flex h-52 flex-col items-center justify-center">
              <TrendingUp size={32} className="text-primary/30 mb-3" />
              <p className="text-3xl font-bold text-gray-900">
                NPR {(stats?.totalSpent || 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-400 mt-1">on completed pickups</p>
            </div>
          </ChartCard>
        </div>

        {/* Recent pickups */}
        <ChartCard title="Recent Pickups">
          {pickups.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pickups.map((p) => (
                <RecentPickupRow key={p.id} pickup={p} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package size={40} className="text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">No pickups yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Request your first pickup to see activity here.
              </p>
              <button
                onClick={() => navigate("/upload-waste")}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 cursor-pointer"
              >
                Get Started <ArrowRight size={14} />
              </button>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="flex h-52 items-center justify-center">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

export default CustomerDashboard;
