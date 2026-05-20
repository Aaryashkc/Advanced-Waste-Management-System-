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
import { useDashboardTheme } from "../../hooks/useDashboardTheme";
import { CircleHelp } from "lucide-react";

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

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

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

function InfoHint({ text }) {
  if (!text) return null;
  return (
    <span className="group/help relative inline-flex">
      <CircleHelp className="h-4 w-4 text-primary/35 transition-colors hover:text-primary/65" aria-hidden />
      <span className="pointer-events-none absolute right-0 top-6 z-30 w-56 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 text-xs font-medium leading-relaxed text-primary/75 opacity-0 shadow-xl shadow-black/10 transition-opacity group-hover/help:opacity-100">
        {text}
      </span>
    </span>
  );
}

function ChartCard({ title, subtitle, hint, children, className = "" }) {
  return (
    <div className={`dash-interactive-card bg-[var(--dash-card)] rounded-2xl border shadow-sm shadow-primary/5 p-6 ${className}`}>
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-primary">{title}</h3>
            {subtitle && <p className="text-sm text-primary/60">{subtitle}</p>}
          </div>
          <InfoHint text={hint} />
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center">
      <p className="text-sm text-primary/50">{message}</p>
    </div>
  );
}

function KpiCard({ label, value, valueClass = "text-primary", hint }) {
  return (
    <div className="dash-interactive-card bg-[var(--dash-card)] rounded-2xl border p-4 shadow-sm shadow-primary/5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-primary/55 uppercase tracking-wider">{label}</p>
        <InfoHint text={hint} />
      </div>
      <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
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

function shortMonth(monthKey) {
  const d = new Date(`${monthKey}-01T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatBillingRole(role) {
  if (role === "customer_admin") return "Customers";
  if (role === "admin") return "Admins";
  return "Unknown";
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
function AnalyticsCharts({ analyticsData, billingSummary = EMPTY_OBJECT, mode = "super_admin" }) {
  const { theme } = useDashboardTheme();
  const isDark = theme === "dark";
  const chartText = isDark ? "#dfe9e6" : "#2d3748";
  const chartMuted = isDark ? "#b6c3bf" : "#4a5568";
  const chartGrid = isDark ? "rgba(231,239,236,0.12)" : "#e2e8f0";

  const {
    statusDistribution = EMPTY_ARRAY,
    categoryDistribution = EMPTY_ARRAY,
    levelDistribution = EMPTY_ARRAY,
    dailyTrend = EMPTY_ARRAY,
    monthlyRevenue = EMPTY_ARRAY,
    hourlyDistribution = EMPTY_ARRAY,
    topDrivers = EMPTY_ARRAY,
    orgBreakdown = EMPTY_ARRAY,
    areaBreakdown = EMPTY_ARRAY,
    ecosystemStats = EMPTY_OBJECT,
    scheduleAnalytics = EMPTY_OBJECT,
  } = analyticsData || EMPTY_OBJECT;

  const isSuperAdmin = mode === "super_admin";
  const breakdown = isSuperAdmin ? orgBreakdown : areaBreakdown;
  const monthlyBillRevenue = billingSummary?.monthlyRevenue || EMPTY_ARRAY;
  const billRoleRevenue = billingSummary?.roleRevenue || EMPTY_ARRAY;
  const scheduleSummary = scheduleAnalytics.summary || EMPTY_OBJECT;
  const scheduleTrend = scheduleAnalytics.dailyTrend || EMPTY_ARRAY;
  const scheduledAreas = scheduleAnalytics.areaBreakdown || EMPTY_ARRAY;
  const scheduledDrivers = scheduleAnalytics.topDrivers || EMPTY_ARRAY;
  const hasScheduleData = (scheduleSummary.totalAssignments || 0) > 0 || scheduleTrend.length > 0;

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

  const orgRevenueData = useMemo(() => ({
    labels: orgBreakdown.map((org) => org.name || "Unknown"),
    datasets: [
      {
        label: "Revenue",
        data: orgBreakdown.map((org) => org.revenue || 0),
        backgroundColor: "#10b981",
        borderRadius: 6,
      },
    ],
  }), [orgBreakdown]);

  const monthlyRevenueData = useMemo(() => ({
    labels: monthlyRevenue.map((row) => shortMonth(row.month)),
    datasets: [
      {
        label: "Revenue",
        data: monthlyRevenue.map((row) => row.revenue || 0),
        borderColor: "#10b981",
        backgroundColor: "rgba(16,185,129,0.14)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      },
    ],
  }), [monthlyRevenue]);

  const revenueComparisonData = useMemo(() => {
    const monthKeys = Array.from(
      new Set([
        ...monthlyRevenue.map((row) => row.month),
        ...monthlyBillRevenue.map((row) => row.month),
      ])
    ).sort();
    const pickupByMonth = new Map(monthlyRevenue.map((row) => [row.month, row.revenue || 0]));
    const billByMonth = new Map(monthlyBillRevenue.map((row) => [row.month, row.revenue || 0]));

    return {
      labels: monthKeys.map((month) => shortMonth(month)),
      datasets: [
        {
          label: "Pickup Revenue",
          data: monthKeys.map((month) => pickupByMonth.get(month) || 0),
          borderColor: "#10b981",
          backgroundColor: "rgba(16,185,129,0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 3,
        },
        {
          label: "Monthly Bills",
          data: monthKeys.map((month) => billByMonth.get(month) || 0),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.10)",
          fill: true,
          tension: 0.35,
          pointRadius: 3,
        },
      ],
    };
  }, [monthlyRevenue, monthlyBillRevenue]);

  const billRoleRevenueData = useMemo(() => ({
    labels: billRoleRevenue.map((row) => formatBillingRole(row.role)),
    datasets: [
      {
        label: "Monthly Bill Revenue",
        data: billRoleRevenue.map((row) => row.revenue || 0),
        backgroundColor: ["#3b82f6", "#8b5cf6", "#9ca3af"],
        borderRadius: 6,
      },
    ],
  }), [billRoleRevenue]);

  const revenueOptions = {
    ...cartesianOptions,
    plugins: {
      ...cartesianOptions.plugins,
      legend: {
        ...cartesianOptions.plugins.legend,
        labels: {
          ...cartesianOptions.plugins.legend.labels,
          color: chartText,
        },
      },
      tooltip: {
        ...cartesianOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => `Revenue: NPR ${Number(ctx.raw || 0).toLocaleString()}`,
        },
      },
    },
    scales: {
      x: {
        ...cartesianOptions.scales.x,
        ticks: { ...cartesianOptions.scales.x.ticks, color: chartMuted },
      },
      y: {
        ...cartesianOptions.scales.y,
        grid: { ...cartesianOptions.scales.y.grid, color: chartGrid },
        ticks: {
          ...cartesianOptions.scales.y.ticks,
          color: chartMuted,
          callback: (value) => `NPR ${Number(value).toLocaleString()}`,
        },
      },
    },
  };

  const orgRevenueOptions = {
    ...revenueOptions,
    indexAxis: "y",
    scales: {
      x: {
        ...revenueOptions.scales.x,
        grid: { ...cartesianOptions.scales.y.grid, color: chartGrid },
        ticks: {
          ...revenueOptions.scales.x.ticks,
          color: chartMuted,
          callback: (value) => `NPR ${Number(value).toLocaleString()}`,
        },
      },
      y: {
        ...revenueOptions.scales.y,
        grid: { display: false },
        ticks: { ...cartesianOptions.scales.y.ticks, color: chartMuted },
      },
    },
  };

  const billRoleRevenueOptions = {
    ...orgRevenueOptions,
    plugins: {
      ...orgRevenueOptions.plugins,
      tooltip: {
        ...orgRevenueOptions.plugins.tooltip,
        callbacks: {
          label: (ctx) => {
            const row = billRoleRevenue[ctx.dataIndex];
            const paidBills = row?.paidBills || 0;
            return `Revenue: NPR ${Number(ctx.raw || 0).toLocaleString()} (${paidBills} paid bills)`;
          },
        },
      },
    },
  };

  const horizontalBarOptions = {
    ...cartesianOptions,
    plugins: {
      ...cartesianOptions.plugins,
      legend: {
        ...cartesianOptions.plugins.legend,
        labels: {
          ...cartesianOptions.plugins.legend.labels,
          color: chartText,
        },
      },
    },
    scales: {
      x: {
        ...cartesianOptions.scales.x,
        ticks: { ...cartesianOptions.scales.x.ticks, color: chartMuted },
      },
      y: {
        ...cartesianOptions.scales.y,
        grid: { ...cartesianOptions.scales.y.grid, color: chartGrid },
        ticks: { ...cartesianOptions.scales.y.ticks, color: chartMuted },
      },
    },
    indexAxis: "y",
  };

  const themedCartesianOptions = {
    ...cartesianOptions,
    plugins: {
      ...cartesianOptions.plugins,
      legend: {
        ...cartesianOptions.plugins.legend,
        labels: {
          ...cartesianOptions.plugins.legend.labels,
          color: chartText,
        },
      },
    },
    scales: {
      x: {
        ...cartesianOptions.scales.x,
        ticks: { ...cartesianOptions.scales.x.ticks, color: chartMuted },
      },
      y: {
        ...cartesianOptions.scales.y,
        grid: { ...cartesianOptions.scales.y.grid, color: chartGrid },
        ticks: { ...cartesianOptions.scales.y.ticks, color: chartMuted },
      },
    },
  };

  const themedDoughnutOptions = {
    ...doughnutOptions,
    plugins: {
      ...doughnutOptions.plugins,
      legend: {
        ...doughnutOptions.plugins.legend,
        labels: {
          ...doughnutOptions.plugins.legend.labels,
          color: chartText,
        },
      },
    },
  };

  /* Scheduled collection trend from MLSchedule assignments */
  const scheduleTrendData = useMemo(() => ({
    labels: scheduleTrend.map((d) => shortDate(d.date)),
    datasets: [
      {
        label: "Assigned",
        data: scheduleTrend.map((d) => d.assigned || 0),
        backgroundColor: "#3b82f6",
        borderRadius: 6,
      },
      {
        label: "Completed",
        data: scheduleTrend.map((d) => d.completed || 0),
        backgroundColor: "#22c55e",
        borderRadius: 6,
      },
    ],
  }), [scheduleTrend]);

  const scheduledAreaData = useMemo(() => ({
    labels: scheduledAreas.map((a) => a.name || "Unknown"),
    datasets: [
      {
        label: "Assigned",
        data: scheduledAreas.map((a) => a.assigned || 0),
        backgroundColor: "#3b82f6",
        borderRadius: 6,
      },
      {
        label: "Completed",
        data: scheduledAreas.map((a) => a.completed || 0),
        backgroundColor: "#22c55e",
        borderRadius: 6,
      },
    ],
  }), [scheduledAreas]);

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* Headline KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Revenue (Completed)" value={`NPR ${(ecosystemStats.totalRevenue || 0).toLocaleString()}`} hint="Revenue counted only from pickups that were completed." />
        <KpiCard label="Monthly Bill Revenue" value={`NPR ${(billingSummary?.totalRevenue || 0).toLocaleString()}`} valueClass="text-blue-600" hint="Revenue collected from paid monthly bills." />
        <KpiCard label="Outstanding Bills" value={`NPR ${(billingSummary?.totalOutstanding || 0).toLocaleString()}`} valueClass="text-amber-600" hint="Total amount still open across unpaid, overdue, and cash-pending monthly bills." />
        <KpiCard label="Completion Rate" value={`${ecosystemStats.completionRate || 0}%`} valueClass="text-emerald-600" hint="Completed pickups divided by total created pickups." />
        <KpiCard label="Avg Response" value={formatDuration(ecosystemStats.avgResponseMs)} valueClass="text-violet-600" hint="Average time from pickup creation until a driver responds." />
        <KpiCard label="Avg Task Duration" value={formatDuration(ecosystemStats.avgTaskDurationMs)} valueClass="text-cyan-600" hint="Average time spent from accepted work to completion." />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)] gap-6">
        <ChartCard
          title="Revenue by Pickup and Monthly Bills"
          subtitle="Paid pickup revenue compared with paid monthly billing revenue"
          hint="Compares the two dashboard revenue streams by month."
        >
          <div className="h-72">
            {monthlyRevenue.length > 0 || monthlyBillRevenue.length > 0 ? (
              <Line data={revenueComparisonData} options={revenueOptions} />
            ) : (
              <EmptyState message="No pickup or monthly bill revenue yet" />
            )}
          </div>
        </ChartCard>

        <ChartCard
          title="Monthly Bill Revenue"
          subtitle="Paid bills by customer/admin role"
          hint="Shows where paid monthly billing revenue is coming from."
        >
          <div className="h-72">
            {billRoleRevenue.some((row) => (row.revenue || 0) > 0) ? (
              <Bar data={billRoleRevenueData} options={billRoleRevenueOptions} />
            ) : (
              <EmptyState message="No paid monthly bills yet" />
            )}
          </div>
        </ChartCard>
      </div>

      {/* Scheduled collection work from ML schedule assignments */}
      {hasScheduleData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Scheduled Jobs" value={(scheduleSummary.totalAssignments || 0).toLocaleString()} hint="Driver assignments created from the ML schedule." />
            <KpiCard label="Schedule Done" value={(scheduleSummary.completedAssignments || 0).toLocaleString()} valueClass="text-emerald-600" hint="Scheduled assignments marked completed." />
            <KpiCard label="Schedule Rate" value={`${scheduleSummary.completionRate || 0}%`} valueClass="text-blue-600" hint="Completed scheduled assignments compared with total scheduled assignments." />
            <KpiCard label="Predicted Waste" value={`${(scheduleSummary.predictedWasteKg || 0).toLocaleString()} kg`} valueClass="text-violet-600" hint="Total predicted waste from scheduled ML areas." />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Scheduled Collection Trend"
              subtitle="Assigned vs completed ML schedule work"
              hint="Compares work generated by ML scheduling with the amount finished each day."
            >
              <div className="h-72">
                {scheduleTrend.length > 0 ? (
                  <Bar data={scheduleTrendData} options={themedCartesianOptions} />
                ) : (
                  <EmptyState message="No scheduled work in the last 30 days" />
                )}
              </div>
            </ChartCard>

            <ChartCard
              title="Scheduled Areas"
              subtitle="Where assigned schedule work is getting completed"
              hint="Shows which areas receive scheduled work and how much of it is completed."
            >
              <div className="h-72">
                {scheduledAreas.length > 0 ? (
                  <Bar data={scheduledAreaData} options={horizontalBarOptions} />
                ) : (
                  <EmptyState message="No scheduled area completions yet" />
                )}
              </div>
            </ChartCard>
          </div>

          {scheduledDrivers.length > 0 && topDrivers.length === 0 && (
            <ChartCard title="Schedule Driver Completions" subtitle="By completed scheduled areas" hint="Ranks drivers by scheduled areas completed when pickup driver data is not available.">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-primary/50 uppercase tracking-wider border-b border-primary/10">
                      <th className="pb-3 pr-4">#</th>
                      <th className="pb-3 pr-4">Driver</th>
                      <th className="pb-3 pr-4 text-right">Assigned</th>
                      <th className="pb-3 text-right">Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduledDrivers.map((d, i) => (
                      <tr key={d.driverId || d.name || i} className="border-b border-primary/5 last:border-0">
                        <td className="py-3 pr-4 text-primary/50 font-medium">{i + 1}</td>
                        <td className="py-3 pr-4 font-semibold text-primary">{d.name}</td>
                        <td className="py-3 pr-4 text-right text-primary/70">{d.assigned || 0}</td>
                        <td className="py-3 text-right font-semibold text-primary">{d.completed || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}
        </div>
      )}

      {/* Daily trend (full width) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard
          title="Daily Pickup Trend"
          subtitle="Created vs Completed vs Cancelled - last 30 days"
          hint="Tracks daily pickup volume and outcomes so sudden dips or cancellations are easier to spot."
        >
          <div className="h-72 w-full">
            {dailyTrend.length > 0 ? (
              <Line data={trendData} options={themedCartesianOptions} />
            ) : (
              <EmptyState message="No pickup activity in the last 30 days" />
            )}
          </div>
        </ChartCard>

        {isSuperAdmin ? (
          <ChartCard
            title="Revenue by Organization"
            subtitle="Completed paid pickup revenue per organization"
            hint="Ranks organizations by revenue generated from completed paid pickups."
          >
            <div className="h-72">
              {orgBreakdown.some((org) => (org.revenue || 0) > 0) ? (
                <Bar data={orgRevenueData} options={orgRevenueOptions} />
              ) : (
                <EmptyState message="No organization revenue yet" />
              )}
            </div>
          </ChartCard>
        ) : (
          <ChartCard
            title="Monthly Revenue"
            subtitle="Your organization's completed paid pickup revenue"
            hint="Shows your organization's revenue generated month by month."
          >
            <div className="h-72">
              {monthlyRevenue.length > 0 ? (
                <Line data={monthlyRevenueData} options={revenueOptions} />
              ) : (
                <EmptyState message="No monthly revenue yet" />
              )}
            </div>
          </ChartCard>
        )}
      </div>

      {/* Status + Category + Level doughnuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ChartCard title="Status Breakdown" subtitle="Where pickups currently are" hint="Distribution of pickups by their current workflow status.">
          <div className="h-60">
            {statusDistribution.length > 0 ? (
              <Doughnut data={statusData} options={themedDoughnutOptions} />
            ) : (
              <EmptyState message="No pickups yet" />
            )}
          </div>
        </ChartCard>

        <ChartCard title="By Category" subtitle="Recyclable vs non-recyclable" hint="How customers classify waste during pickup requests.">
          <div className="h-60">
            {categoryDistribution.length > 0 ? (
              <Doughnut data={categoryData} options={themedDoughnutOptions} />
            ) : (
              <EmptyState message="No category data" />
            )}
          </div>
        </ChartCard>

        <ChartCard title="By Difficulty" subtitle="Easy / medium / hard" hint="Pickup difficulty mix, useful for workload and driver planning.">
          <div className="h-60">
            {levelDistribution.length > 0 ? (
              <Doughnut data={levelData} options={themedDoughnutOptions} />
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
          hint="Highlights the busiest request hours across the day."
        >
          <div className="h-72">
            {hourlyDistribution.length > 0 ? (
              <Bar data={hourlyData} options={themedCartesianOptions} />
            ) : (
              <EmptyState message="No hourly data" />
            )}
          </div>
        </ChartCard>

        <ChartCard
          title={isSuperAdmin ? "Top Organizations" : "Top Areas"}
          subtitle={isSuperAdmin ? "Pickup volume per org" : "Pickup volume per area"}
          hint={isSuperAdmin ? "Ranks organizations by pickup activity." : "Ranks service areas by pickup activity."}
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
      <ChartCard title="Top Drivers" subtitle="By completed pickups" hint="Drivers with the highest completed pickup counts, including revenue and timing averages.">
        {topDrivers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-primary/50 uppercase tracking-wider border-b border-primary/10">
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
                    <td className="py-3 pr-4 text-primary/50 font-medium">{i + 1}</td>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-primary">{d.name}</p>
                      {d.email && <p className="text-xs text-primary/50">{d.email}</p>}
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
