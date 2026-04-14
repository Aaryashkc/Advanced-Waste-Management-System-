import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

/* ── Color palettes (match the rest of the app) ── */

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

/* ── Shared chart options ── */

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        color: "#2d3748",
        font: { family: "'Inter', sans-serif", size: 12, weight: "500" },
        usePointStyle: true,
        padding: 16,
      },
    },
    tooltip: {
      backgroundColor: "rgba(25, 42, 28, 0.92)",
      titleFont: { family: "'Inter', sans-serif", size: 13 },
      bodyFont: { family: "'Inter', sans-serif", size: 12 },
      padding: 10,
      cornerRadius: 8,
    },
  },
};

const cartesianOptions = {
  ...baseOptions,
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { family: "'Inter', sans-serif" }, color: "#4a5568" },
    },
    y: {
      border: { dash: [4, 4] },
      grid: { color: "#e2e8f0" },
      ticks: { font: { family: "'Inter', sans-serif" }, color: "#4a5568" },
      beginAtZero: true,
    },
  },
};

const doughnutOptions = {
  ...baseOptions,
  cutout: "62%",
};

/* ── Card wrapper (same look as Dashboard.jsx cards) ── */

function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <div className={`bg-white rounded-3xl border border-primary/15 shadow-sm p-6 hover:shadow-md transition-shadow ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-primary">{title}</h3>
        {subtitle && <p className="text-sm text-primary/60">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center">
      <p className="text-sm text-primary/40">{message}</p>
    </div>
  );
}

/* ── Helpers ── */

function formatDuration(ms) {
  if (!ms || ms <= 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return `${hours}h ${remMin}m`;
}

function shortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ── Main component ──
 *
 * `mode` = "super_admin" | "admin"
 *   - super_admin: shows orgBreakdown bar chart
 *   - admin:       shows areaBreakdown bar chart
 *
 * Reads the unified analytics shape returned by buildPickupAnalytics():
 *   - statusDistribution, categoryDistribution, levelDistribution
 *   - dailyTrend, hourlyDistribution, topDrivers
 *   - orgBreakdown OR areaBreakdown
 */
function AnalyticsCharts({ analyticsData, mode = "super_admin" }) {
  const {
    statusDistribution = [],
    categoryDistribution = [],
    levelDistribution = [],
    dailyTrend = [],
    hourlyDistribution = [],
    topDrivers = [],
    orgBreakdown = [],
    areaBreakdown = [],
    ecosystemStats = {},
  } = analyticsData || {};

  const isSuperAdmin = mode === "super_admin";
  const breakdown = isSuperAdmin ? orgBreakdown : areaBreakdown;

  /* ── Daily trend (line) ── */
  const trendData = useMemo(() => ({
    labels: dailyTrend.map((d) => shortDate(d.date)),
    datasets: [
      {
        label: "Created",
        data: dailyTrend.map((d) => d.created),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.12)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
      },
      {
        label: "Completed",
        data: dailyTrend.map((d) => d.completed),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.12)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
      },
      {
        label: "Cancelled",
        data: dailyTrend.map((d) => d.cancelled),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.10)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
      },
    ],
  }), [dailyTrend]);

  /* ── Status doughnut ── */
  const statusData = useMemo(() => ({
    labels: statusDistribution.map((s) => s.status),
    datasets: [
      {
        data: statusDistribution.map((s) => s.count),
        backgroundColor: statusDistribution.map((s) => STATUS_COLORS[s.status] || "#9ca3af"),
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  }), [statusDistribution]);

  /* ── Category doughnut ── */
  const categoryData = useMemo(() => ({
    labels: categoryDistribution.map((c) =>
      c.category ? c.category.charAt(0).toUpperCase() + c.category.slice(1) : "Unknown"
    ),
    datasets: [
      {
        data: categoryDistribution.map((c) => c.count),
        backgroundColor: categoryDistribution.map((c) => CATEGORY_COLORS[c.category] || "#9ca3af"),
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  }), [categoryDistribution]);

  /* ── Level doughnut ── */
  const levelData = useMemo(() => ({
    labels: levelDistribution.map((l) =>
      l.level ? l.level.charAt(0).toUpperCase() + l.level.slice(1) : "Unknown"
    ),
    datasets: [
      {
        data: levelDistribution.map((l) => l.count),
        backgroundColor: levelDistribution.map((l) => LEVEL_COLORS[l.level] || "#9ca3af"),
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  }), [levelDistribution]);

  /* ── Hour-of-day bar ── */
  const hourlyData = useMemo(() => {
    const byHour = Array(24).fill(0);
    hourlyDistribution.forEach((h) => { byHour[h.hour] = h.count; });
    return {
      labels: byHour.map((_, i) => `${i.toString().padStart(2, "0")}:00`),
      datasets: [
        {
          label: "Pickups",
          data: byHour,
          backgroundColor: "#354f52",
          borderRadius: 4,
        },
      ],
    };
  }, [hourlyDistribution]);

  /* ── Breakdown bar (orgs OR areas) ── */
  const breakdownData = useMemo(() => ({
    labels: breakdown.map((b) => b.name || "Unknown"),
    datasets: [
      {
        label: "Total Pickups",
        data: breakdown.map((b) => b.total),
        backgroundColor: "#3b82f6",
        borderRadius: 6,
      },
      {
        label: "Completed",
        data: breakdown.map((b) => b.completed),
        backgroundColor: "#22c55e",
        borderRadius: 6,
      },
    ],
  }), [breakdown]);

  const horizontalBarOptions = {
    ...cartesianOptions,
    indexAxis: "y",
  };

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* Headline KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-primary/10 p-4">
          <p className="text-xs font-semibold text-primary/40 uppercase tracking-wider">Revenue (Completed)</p>
          <p className="text-2xl font-bold text-primary mt-1">
            NPR {(ecosystemStats.totalRevenue || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-4">
          <p className="text-xs font-semibold text-primary/40 uppercase tracking-wider">Completion Rate</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {ecosystemStats.completionRate || 0}%
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-4">
          <p className="text-xs font-semibold text-primary/40 uppercase tracking-wider">Avg Response</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {formatDuration(ecosystemStats.avgResponseMs)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-primary/10 p-4">
          <p className="text-xs font-semibold text-primary/40 uppercase tracking-wider">Avg Task Duration</p>
          <p className="text-2xl font-bold text-violet-600 mt-1">
            {formatDuration(ecosystemStats.avgTaskDurationMs)}
          </p>
        </div>
      </div>

      {/* Daily trend (full width) */}
      <ChartCard
        title="Daily Pickup Trend"
        subtitle="Created vs Completed vs Cancelled — last 30 days"
      >
        <div className="h-72 w-full">
          {dailyTrend.length > 0 ? (
            <Line data={trendData} options={cartesianOptions} />
          ) : (
            <EmptyState message="No pickup activity in the last 30 days" />
          )}
        </div>
      </ChartCard>

      {/* Status + Category + Level doughnuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ChartCard title="Status Breakdown" subtitle="Where pickups currently are">
          <div className="h-60">
            {statusDistribution.length > 0 ? (
              <Doughnut data={statusData} options={doughnutOptions} />
            ) : (
              <EmptyState message="No pickups yet" />
            )}
          </div>
        </ChartCard>

        <ChartCard title="By Category" subtitle="Recyclable vs non-recyclable">
          <div className="h-60">
            {categoryDistribution.length > 0 ? (
              <Doughnut data={categoryData} options={doughnutOptions} />
            ) : (
              <EmptyState message="No category data" />
            )}
          </div>
        </ChartCard>

        <ChartCard title="By Difficulty" subtitle="Easy / medium / hard">
          <div className="h-60">
            {levelDistribution.length > 0 ? (
              <Doughnut data={levelData} options={doughnutOptions} />
            ) : (
              <EmptyState message="No difficulty data" />
            )}
          </div>
        </ChartCard>
      </div>

      {/* Hourly distribution + breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Hourly Activity"
          subtitle="When customers request pickups (24h)"
        >
          <div className="h-72">
            {hourlyDistribution.length > 0 ? (
              <Bar data={hourlyData} options={cartesianOptions} />
            ) : (
              <EmptyState message="No hourly data" />
            )}
          </div>
        </ChartCard>

        <ChartCard
          title={isSuperAdmin ? "Top Organizations" : "Top Areas"}
          subtitle={isSuperAdmin ? "Pickup volume per org" : "Pickup volume per area"}
        >
          <div className="h-72">
            {breakdown.length > 0 ? (
              <Bar data={breakdownData} options={horizontalBarOptions} />
            ) : (
              <EmptyState message={isSuperAdmin ? "No organizations with pickups" : "No area data"} />
            )}
          </div>
        </ChartCard>
      </div>

      {/* Top drivers leaderboard */}
      <ChartCard title="Top Drivers" subtitle="By completed pickups">
        {topDrivers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-primary/40 uppercase tracking-wider border-b border-primary/10">
                  <th className="pb-3 pr-4">#</th>
                  <th className="pb-3 pr-4">Driver</th>
                  <th className="pb-3 pr-4 text-right">Completed</th>
                  <th className="pb-3 pr-4 text-right">Revenue</th>
                  <th className="pb-3 pr-4 text-right">Avg Response</th>
                  <th className="pb-3 text-right">Avg Duration</th>
                </tr>
              </thead>
              <tbody>
                {topDrivers.map((d, i) => (
                  <tr key={d.driverId || i} className="border-b border-primary/5 last:border-0">
                    <td className="py-3 pr-4 text-primary/40 font-medium">{i + 1}</td>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-primary">{d.name}</p>
                      {d.email && <p className="text-xs text-primary/40">{d.email}</p>}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-primary">{d.completed}</td>
                    <td className="py-3 pr-4 text-right text-primary/70">NPR {(d.revenue || 0).toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right text-primary/70">{formatDuration(d.avgResponseMs)}</td>
                    <td className="py-3 text-right text-primary/70">{formatDuration(d.avgTaskDurationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No driver activity yet" />
        )}
      </ChartCard>
    </div>
  );
}

export default AnalyticsCharts;
