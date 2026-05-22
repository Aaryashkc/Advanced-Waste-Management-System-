import React, { useEffect, useState } from "react";
import useAuthStore from "../stores/useAuthStore";
import { useDashboardTheme } from "../hooks/useDashboardTheme";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const fmt = (ms) => {
  if (!ms) return "--";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const PickupStats = () => {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { theme } = useDashboardTheme();
  const isSuperAdmin = user?.role === "super_admin";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("overview");
  const isDark = theme === "dark";
  const chartText = isDark ? "#dfe9e6" : "#354f52";
  const chartGrid = isDark ? "rgba(231,239,236,0.14)" : "rgba(0,0,0,0.05)";

  useEffect(() => {
    ChartJS.defaults.color = chartText;
    ChartJS.defaults.borderColor = chartGrid;
  }, [chartText, chartGrid]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/pickups/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-12 text-center text-primary/40">Failed to load pickup analytics.</div>;
  }

  const { summary, statusDistribution, categoryDistribution, levelDistribution, pickupTrend, topDrivers, hourlyDistribution, responseTimeTrend, areaBreakdown, orgBreakdown } = data;

  const baseSections = [
    { id: "overview", label: "Overview" },
    { id: "trends", label: "Trends" },
    { id: "performance", label: "Performance" },
    { id: "drivers", label: "Drivers" },
    { id: "areas", label: "Areas" },
  ];
  const sections = isSuperAdmin
    ? [...baseSections, { id: "organizations", label: "Organizations" }]
    : baseSections;

  // Chart colors
  const COLORS = ["#10b981", "#3b82f6", "#ef4444", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];
  const statusColorMap = { COMPLETED: "#10b981", ASSIGNED: "#3b82f6", EN_ROUTE: "#6366f1", ARRIVED: "#8b5cf6", COLLECTING: "#f59e0b", CANCELLED: "#ef4444", EXPIRED: "#9ca3af", PENDING: "#eab308" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">Pickup Analytics</h1>
        <p className="text-sm text-primary/60 mt-1">Comprehensive analytics across all pickup operations</p>
      </div>

      {/* Section Nav */}
      <div className="flex gap-1 bg-primary/4 rounded-2xl p-1.5 overflow-x-auto">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeSection === s.id ? "bg-white text-primary shadow-sm" : "text-primary/50 hover:text-primary/70"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ═══════ OVERVIEW ═══════ */}
      {activeSection === "overview" && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Total", value: summary.total, color: "text-primary", bg: "bg-white" },
              { label: "Completed", value: summary.completed, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Active", value: summary.active, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Cancelled", value: summary.cancelled, color: "text-red-500", bg: "bg-red-50" },
              { label: "Expired", value: summary.expired, color: "text-gray-500", bg: "bg-gray-50" },
              { label: "Success Rate", value: `${summary.completionRate}%`, color: "text-emerald-600", bg: "bg-emerald-50" },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-2xl border border-primary/10 p-5 text-center`}>
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-primary/50 font-medium mt-1 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Status + Category Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Status Distribution</h3>
              <div className="h-56">
                <Doughnut
                  data={{
                    labels: statusDistribution.map((s) => s.status),
                    datasets: [{
                      data: statusDistribution.map((s) => s.count),
                      backgroundColor: statusDistribution.map((s) => statusColorMap[s.status] || "#9ca3af"),
                      borderWidth: 0,
                    }],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, cutout: "65%", plugins: { legend: { position: "bottom", labels: { padding: 12, usePointStyle: true, font: { size: 11 } } } } }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Category Breakdown</h3>
              <div className="h-56">
                <Doughnut
                  data={{
                    labels: categoryDistribution.map((c) => c.category || "Unknown"),
                    datasets: [{
                      data: categoryDistribution.map((c) => c.count),
                      backgroundColor: ["#10b981", "#ef4444", "#8b5cf6", "#f59e0b"],
                      borderWidth: 0,
                    }],
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, cutout: "65%", plugins: { legend: { position: "bottom", labels: { padding: 12, usePointStyle: true, font: { size: 11 } } } } }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Difficulty Levels</h3>
              <div className="h-56">
                <Bar
                  data={{
                    labels: levelDistribution.map((l) => l.level || "Unknown"),
                    datasets: [{
                      label: "Pickups",
                      data: levelDistribution.map((l) => l.count),
                      backgroundColor: levelDistribution.map((_, i) => COLORS[i % COLORS.length]),
                      borderRadius: 8,
                    }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: chartGrid } } },
                  }}
                />
              </div>
            </div>
          </div>

          {/* Hourly Distribution */}
          {hourlyDistribution.length > 0 && (
            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Pickup Activity by Hour</h3>
              <div className="h-56">
                <Bar
                  data={{
                    labels: Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`),
                    datasets: [{
                      label: "Pickups",
                      data: Array.from({ length: 24 }, (_, i) => hourlyDistribution.find((d) => d.hour === i)?.count || 0),
                      backgroundColor: "#3b82f6",
                      borderRadius: 4,
                    }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
                      y: { beginAtZero: true, grid: { color: chartGrid } },
                    },
                  }}
                />
              </div>
              <p className="text-xs text-primary/40 mt-2 text-center">When pickups are most requested throughout the day</p>
            </div>
          )}
        </>
      )}

      {/* ═══════ TRENDS ═══════ */}
      {activeSection === "trends" && (
        <>
          {/* Daily Pickup Trend */}
          {pickupTrend.length > 0 && (
            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Daily Pickup Trend (30 Days)</h3>
              <div className="h-72">
                <Line
                  data={{
                    labels: pickupTrend.map((d) => d.date?.slice(5)),
                    datasets: [
                      {
                        label: "Created",
                        data: pickupTrend.map((d) => d.created),
                        borderColor: "#3b82f6",
                        backgroundColor: "rgba(59,130,246,0.08)",
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                      },
                      {
                        label: "Completed",
                        data: pickupTrend.map((d) => d.completed),
                        borderColor: "#10b981",
                        backgroundColor: "rgba(16,185,129,0.08)",
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                      },
                      {
                        label: "Cancelled",
                        data: pickupTrend.map((d) => d.cancelled),
                        borderColor: "#ef4444",
                        backgroundColor: "rgba(239,68,68,0.05)",
                        fill: true,
                        tension: 0.3,
                        pointRadius: 2,
                      },
                    ],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: "bottom", labels: { usePointStyle: true, padding: 16 } } },
                    scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: chartGrid } } },
                  }}
                />
              </div>
            </div>
          )}

          {/* Response Time & Task Duration Trend */}
          {responseTimeTrend.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-primary/10 p-6">
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-1">Avg Response Time (30 Days)</h3>
                <p className="text-xs text-primary/40 mb-4">Time from request creation to driver acceptance</p>
                <div className="h-56">
                  <Line
                    data={{
                      labels: responseTimeTrend.map((r) => r.date?.slice(5)),
                      datasets: [{
                        label: "Avg Response",
                        data: responseTimeTrend.map((r) => Math.round(r.avgResponseMs / 1000)),
                        borderColor: "#8b5cf6",
                        backgroundColor: "rgba(139,92,246,0.08)",
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                      }],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (ctx) => `${fmt(ctx.raw * 1000)}` } },
                      },
                      scales: {
                        x: { grid: { display: false } },
                        y: { beginAtZero: true, grid: { color: chartGrid }, ticks: { callback: (v) => `${v}s` } },
                      },
                    }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-primary/10 p-6">
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-1">Avg Task Duration (30 Days)</h3>
                <p className="text-xs text-primary/40 mb-4">Time from acceptance to completion</p>
                <div className="h-56">
                  <Line
                    data={{
                      labels: responseTimeTrend.map((r) => r.date?.slice(5)),
                      datasets: [{
                        label: "Avg Duration",
                        data: responseTimeTrend.map((r) => Math.round(r.avgTaskDurationMs / 60000)),
                        borderColor: "#f59e0b",
                        backgroundColor: "rgba(245,158,11,0.08)",
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                      }],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.raw}min` } },
                      },
                      scales: {
                        x: { grid: { display: false } },
                        y: { beginAtZero: true, grid: { color: chartGrid }, ticks: { callback: (v) => `${v}m` } },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Volume per day in response trend */}
          {responseTimeTrend.length > 0 && (
            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Completed Pickups Per Day</h3>
              <div className="h-48">
                <Bar
                  data={{
                    labels: responseTimeTrend.map((r) => r.date?.slice(5)),
                    datasets: [{
                      label: "Completed",
                      data: responseTimeTrend.map((r) => r.count),
                      backgroundColor: "#10b981",
                      borderRadius: 6,
                    }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: chartGrid } } },
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════ PERFORMANCE ═══════ */}
      {activeSection === "performance" && (
        <>
          {/* Key Performance Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-primary/50 font-medium uppercase tracking-wider">Completion Rate</span>
                <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-sm">%</span>
              </div>
              <p className="text-4xl font-bold text-emerald-600">{summary.completionRate}%</p>
              <p className="text-xs text-primary/40 mt-1">{summary.completed} of {summary.total} pickups</p>
            </div>
            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-primary/50 font-medium uppercase tracking-wider">Cancel Rate</span>
                <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-sm">X</span>
              </div>
              <p className="text-4xl font-bold text-red-500">{summary.total > 0 ? Math.round((summary.cancelled / summary.total) * 100) : 0}%</p>
              <p className="text-xs text-primary/40 mt-1">{summary.cancelled} cancelled</p>
            </div>
            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-primary/50 font-medium uppercase tracking-wider">Avg Response</span>
                <span className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm">R</span>
              </div>
              <p className="text-4xl font-bold text-purple-600">
                {responseTimeTrend.length > 0
                  ? fmt(responseTimeTrend.reduce((s, r) => s + r.avgResponseMs, 0) / responseTimeTrend.length)
                  : "--"}
              </p>
              <p className="text-xs text-primary/40 mt-1">Creation to acceptance</p>
            </div>
            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-primary/50 font-medium uppercase tracking-wider">Avg Task Time</span>
                <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-sm">T</span>
              </div>
              <p className="text-4xl font-bold text-amber-600">
                {responseTimeTrend.length > 0
                  ? fmt(responseTimeTrend.reduce((s, r) => s + r.avgTaskDurationMs, 0) / responseTimeTrend.length)
                  : "--"}
              </p>
              <p className="text-xs text-primary/40 mt-1">Acceptance to completion</p>
            </div>
          </div>

          {/* Status flow visualization */}
          <div className="bg-white rounded-2xl border border-primary/10 p-6">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Pickup Status Pipeline</h3>
            <div className="flex flex-wrap items-center gap-2">
              {["PENDING", "ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING", "COMPLETED"].map((status, i) => {
                const count = statusDistribution.find((s) => s.status === status)?.count || 0;
                const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                return (
                  <React.Fragment key={status}>
                    <div className="flex-1 min-w-28 bg-gray-50 rounded-xl p-4 text-center">
                      <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: statusColorMap[status] }} />
                      <p className="text-lg font-bold text-primary">{count}</p>
                      <p className="text-[10px] text-primary/50 font-medium uppercase">{status.replace("_", " ")}</p>
                      <p className="text-xs text-primary/30 mt-0.5">{pct}%</p>
                    </div>
                    {i < 5 && (
                      <svg className="w-5 h-5 text-primary/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            {/* Cancelled / Expired below */}
            <div className="flex gap-4 mt-4 pt-4 border-t border-primary/5">
              {["CANCELLED", "EXPIRED"].map((status) => {
                const count = statusDistribution.find((s) => s.status === status)?.count || 0;
                return (
                  <div key={status} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColorMap[status] }} />
                    <span className="text-sm text-primary/60">{status}: <strong>{count}</strong></span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category + Level side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">By Category</h3>
              <div className="space-y-3">
                {categoryDistribution.map((c) => {
                  const pct = summary.total > 0 ? Math.round((c.count / summary.total) * 100) : 0;
                  return (
                    <div key={c.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-primary font-medium capitalize">{c.category || "Unknown"}</span>
                        <span className="text-primary/60">{c.count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">By Difficulty Level</h3>
              <div className="space-y-3">
                {levelDistribution.map((l) => {
                  const pct = summary.total > 0 ? Math.round((l.count / summary.total) * 100) : 0;
                  const barColor = l.level === "hard" ? "bg-red-500" : l.level === "medium" ? "bg-amber-500" : "bg-green-500";
                  return (
                    <div key={l.level}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-primary font-medium capitalize">{l.level || "Unknown"}</span>
                        <span className="text-primary/60">{l.count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════ DRIVERS ═══════ */}
      {activeSection === "drivers" && (
        <>
          {/* Top Drivers Bar Chart */}
          {topDrivers.length > 0 && (
            <div className="bg-white rounded-2xl border border-primary/10 p-6">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Top Drivers by Completed Pickups</h3>
              <div className="h-64">
                <Bar
                  data={{
                    labels: topDrivers.map((d) => d.driverName || "Unknown"),
                    datasets: [{
                      label: "Completed",
                      data: topDrivers.map((d) => d.completed),
                      backgroundColor: "#10b981",
                      borderRadius: 8,
                    }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false, indexAxis: "y",
                    plugins: { legend: { display: false } },
                    scales: { x: { beginAtZero: true, grid: { color: chartGrid } }, y: { grid: { display: false } } },
                  }}
                />
              </div>
            </div>
          )}

          {/* Driver Leaderboard Table */}
          <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-primary/10 flex items-center justify-between">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Driver Performance Leaderboard</h3>
              <span className="text-xs text-primary/40">{topDrivers.length} drivers</span>
            </div>
            {topDrivers.length === 0 ? (
              <div className="p-12 text-center text-primary/40">No completed pickups yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-primary/3">
                      <th className="px-4 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Driver</th>
                      <th className="px-4 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center">Completed</th>
                      <th className="px-4 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center">Recyclable</th>
                      <th className="px-4 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center">Non-Rec.</th>
                      <th className="px-4 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center">Mixed</th>
                      <th className="px-4 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center">Avg Response</th>
                      <th className="px-4 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center">Avg Task</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {topDrivers.map((d, i) => (
                      <tr key={d.driverId} className="hover:bg-primary/2 transition">
                        <td className="px-4 py-3">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            i === 0 ? "bg-yellow-100 text-yellow-700" :
                            i === 1 ? "bg-gray-200 text-gray-700" :
                            i === 2 ? "bg-amber-100 text-amber-700" :
                            "bg-primary/5 text-primary/50"
                          }`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center text-xs font-bold text-primary">
                              {d.driverName?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <span className="font-semibold text-primary text-sm">{d.driverName || "Unknown"}</span>
                              {d.driverEmail && <p className="text-xs text-primary/40">{d.driverEmail}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-lg font-bold text-green-600">{d.completed}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-primary/70">{d.recyclable || 0}</td>
                        <td className="px-4 py-3 text-center text-sm text-primary/70">{d.nonRecyclable || 0}</td>
                        <td className="px-4 py-3 text-center text-sm text-primary/70">{d.mixed || 0}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-medium text-purple-600">{fmt(d.avgResponseMs)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-medium text-amber-600">{fmt(d.avgTaskDurationMs)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════ AREAS ═══════ */}
      {activeSection === "areas" && (
        <>
          {areaBreakdown && areaBreakdown.length > 0 ? (
            <>
              {/* Area Bar Chart */}
              <div className="bg-white rounded-2xl border border-primary/10 p-6">
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Pickups by Area</h3>
                <div className="h-72">
                  <Bar
                    data={{
                      labels: areaBreakdown.map((d) => d.area),
                      datasets: [
                        {
                          label: "Total",
                          data: areaBreakdown.map((d) => d.total),
                          backgroundColor: "rgba(59,130,246,0.7)",
                          borderRadius: 6,
                        },
                        {
                          label: "Completed",
                          data: areaBreakdown.map((d) => d.completed),
                          backgroundColor: "rgba(16,185,129,0.7)",
                          borderRadius: 6,
                        },
                      ],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { position: "bottom", labels: { usePointStyle: true, padding: 12 } } },
                      scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
                        y: { beginAtZero: true, grid: { color: chartGrid } },
                      },
                    }}
                  />
                </div>
              </div>

              {/* Area Table */}
              <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden">
                <div className="px-5 py-4 border-b border-primary/10">
                  <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Area Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-primary/3">
                        <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Area</th>
                        <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center">Total</th>
                        <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center">Completed</th>
                        <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center">Completion %</th>
                        <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/5">
                      {areaBreakdown.map((d) => {
                        const rate = d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0;
                        return (
                          <tr key={d.area} className="hover:bg-primary/2 transition">
                            <td className="px-5 py-3 font-medium text-primary text-sm">{d.area}</td>
                            <td className="px-5 py-3 text-center text-sm text-primary/70">{d.total}</td>
                            <td className="px-5 py-3 text-center text-sm font-semibold text-emerald-600">{d.completed}</td>
                            <td className="px-5 py-3 text-center text-sm text-primary/70">{rate}%</td>
                            <td className="px-5 py-3">
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-32">
                                <div className={`h-full rounded-full transition-all ${rate >= 75 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-500" : "bg-red-400"}`} style={{ width: `${rate}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-primary/10">
              <p className="text-4xl mb-3 opacity-40">&#x1F4CD;</p>
              <h3 className="text-lg font-semibold text-primary/70 mb-1">No Area Data</h3>
              <p className="text-sm text-primary/50">Area information will appear as pickups are created with location data.</p>
            </div>
          )}
        </>
      )}

      {/* ═══════ ORGANIZATIONS (Super Admin only) ═══════ */}
      {activeSection === "organizations" && isSuperAdmin && (
        <>
          {orgBreakdown && orgBreakdown.length > 0 ? (
            <>
              {/* Org Bar Chart */}
              <div className="bg-white rounded-2xl border border-primary/10 p-6">
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Pickups by Organization</h3>
                <div className="h-72">
                  <Bar
                    data={{
                      labels: orgBreakdown.map((o) => o.organization),
                      datasets: [
                        {
                          label: "Total",
                          data: orgBreakdown.map((o) => o.total),
                          backgroundColor: "rgba(99,102,241,0.7)",
                          borderRadius: 6,
                        },
                        {
                          label: "Completed",
                          data: orgBreakdown.map((o) => o.completed),
                          backgroundColor: "rgba(16,185,129,0.7)",
                          borderRadius: 6,
                        },
                      ],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { position: "bottom", labels: { usePointStyle: true, padding: 12 } } },
                      scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
                        y: { beginAtZero: true, grid: { color: chartGrid } },
                      },
                    }}
                  />
                </div>
              </div>

              {/* Org Table */}
              <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden">
                <div className="px-5 py-4 border-b border-primary/10">
                  <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Organization Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-primary/3">
                        <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Organization</th>
                        <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center">Total</th>
                        <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center">Completed</th>
                        <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider text-center">Completion %</th>
                        <th className="px-5 py-3 text-xs font-bold text-primary/60 uppercase tracking-wider">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/5">
                      {orgBreakdown.map((o) => {
                        const rate = o.total > 0 ? Math.round((o.completed / o.total) * 100) : 0;
                        return (
                          <tr key={o.organization} className="hover:bg-primary/2 transition">
                            <td className="px-5 py-3 font-medium text-primary text-sm">{o.organization}</td>
                            <td className="px-5 py-3 text-center text-sm text-primary/70">{o.total}</td>
                            <td className="px-5 py-3 text-center text-sm font-semibold text-emerald-600">{o.completed}</td>
                            <td className="px-5 py-3 text-center text-sm text-primary/70">{rate}%</td>
                            <td className="px-5 py-3">
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-32">
                                <div className={`h-full rounded-full transition-all ${rate >= 75 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-500" : "bg-red-400"}`} style={{ width: `${rate}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-primary/10">
              <p className="text-4xl mb-3 opacity-40">&#x1F3E2;</p>
              <h3 className="text-lg font-semibold text-primary/70 mb-1">No Organization Data</h3>
              <p className="text-sm text-primary/50">Organization-level analytics will appear as pickups are processed across organizations.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PickupStats;
