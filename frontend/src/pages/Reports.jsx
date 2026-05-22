import React, { useEffect, useMemo, useState } from "react";
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
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import useMLScheduleStore from "../stores/useMLScheduleStore";
import useAuthStore from "../stores/useAuthStore";
import { BarChart3, AlertTriangle, Truck } from "lucide-react";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

const REASON_COLORS = {
  "No trucks with assigned drivers available": "#ef4444",
  "Insufficient truck capacity for this area": "#f97316",
  "No truck/driver available": "#dc2626",
  "Skipped by ML model": "#9ca3af",
};

const Reports = () => {
  const { mlAnalytics, loading, error, fetchMLAnalytics } = useMLScheduleStore();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => { fetchMLAnalytics(); }, [fetchMLAnalytics]);

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#354f52",
          font: { family: "'Inter', sans-serif", size: 12, weight: "500" },
          usePointStyle: true, padding: 20,
        },
      },
      tooltip: {
        backgroundColor: "rgba(53, 79, 82, 0.92)",
        titleFont: { family: "'Inter', sans-serif", size: 14 },
        bodyFont: { family: "'Inter', sans-serif", size: 13 },
        padding: 12, cornerRadius: 8, displayColors: true,
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: "'Inter', sans-serif" }, color: "#354f52" } },
      y: { border: { dash: [4, 4] }, grid: { color: "#e2e8f0" }, ticks: { font: { family: "'Inter', sans-serif" }, color: "#354f52" }, beginAtZero: true },
    },
  };

  const pieBaseOptions = { ...commonOptions, scales: { x: { display: false }, y: { display: false } } };
  const doughnutBaseOptions = { ...pieBaseOptions, cutout: "65%" };

  const analytics = useMemo(() => mlAnalytics || {}, [mlAnalytics]);
  const totalSchedules = analytics.totalSchedules || 0;
  const modelInfo = analytics.modelInfo || { model: "GradientBoosting", r2Score: 0.974 };

  const wc = analytics.weeklyComparison || {};
  const thisWeekWaste = wc.thisWeekWaste || 0;
  const lastWeekWaste = wc.lastWeekWaste || 0;
  const weeklyChange = wc.changePercent || 0;
  const weeklyChangeIsGood = Number(weeklyChange) <= 0;

  const wasteTrend = useMemo(() => analytics.wasteTrend || [], [analytics.wasteTrend]);
  const trendDates = wasteTrend.map((t) => t.date);
  const trendValues = wasteTrend.map((t) => t.totalWasteKg);

  const areaBreakdown = useMemo(() => analytics.areaBreakdown || [], [analytics.areaBreakdown]);
  const categoryDist = useMemo(() => analytics.categoryDistribution || [], [analytics.categoryDistribution]);
  const scheduleStats = useMemo(() => analytics.scheduleStats || [], [analytics.scheduleStats]);
  const actionDist = useMemo(() => analytics.actionDistribution || [], [analytics.actionDistribution]);

  const incompleteAreas = useMemo(() => analytics.incompleteAreas || [], [analytics.incompleteAreas]);
  const reasonBreakdown = useMemo(() => analytics.reasonBreakdown || [], [analytics.reasonBreakdown]);
  const driverlessTruckStats = useMemo(() => analytics.driverlessTruckStats || [], [analytics.driverlessTruckStats]);

  const avgDispatched = wasteTrend.length > 0
    ? (wasteTrend.reduce((sum, t) => sum + (t.dispatched || 0), 0) / wasteTrend.length).toFixed(1)
    : 0;

  const trendChartData = useMemo(() => ({
    labels: trendDates.map((d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })),
    datasets: [{
      label: "Predicted Waste (kg)",
      data: trendValues,
      borderColor: "#354f52", backgroundColor: "rgba(53, 79, 82, 0.1)",
      tension: 0.4, fill: true, pointBackgroundColor: "#354f52", pointRadius: 2, pointHoverRadius: 5,
    }],
  }), [trendDates, trendValues]);

  const areaChartData = useMemo(() => ({
    labels: areaBreakdown.map((d) => d.area),
    datasets: [{
      label: "Avg Waste (kg)", data: areaBreakdown.map((d) => d.avgWasteKg),
      backgroundColor: "rgba(53, 79, 82, 0.7)", borderRadius: 6,
    }],
  }), [areaBreakdown]);

  const categoryChartData = useMemo(() => ({
    labels: categoryDist.map((c) => c.category),
    datasets: [{
      data: categoryDist.map((c) => c.count),
      backgroundColor: categoryDist.map((c) => ({ none: "#9ca3af", low: "#4ade80", medium: "#f59e0b", high: "#f97316", critical: "#ef4444" })[c.category] || "#cbd5e1"),
      hoverOffset: 4,
    }],
  }), [categoryDist]);

  const statusChartData = useMemo(() => ({
    labels: scheduleStats.map((s) => s.status),
    datasets: [{
      data: scheduleStats.map((s) => s.count),
      backgroundColor: scheduleStats.map((s) => ({ draft: "#9ca3af", confirmed: "#4ade80", completed: "#3b82f6", cancelled: "#ef4444" })[s.status] || "#cbd5e1"),
      borderWidth: 0, hoverOffset: 4,
    }],
  }), [scheduleStats]);

  const actionChartData = useMemo(() => ({
    labels: actionDist.map((a) => a.action),
    datasets: [{
      data: actionDist.map((a) => a.count),
      backgroundColor: actionDist.map((a) => ({ dispatch: "#354f52", skip: "#ef4444", reduced: "#f59e0b" })[a.action] || "#cbd5e1"),
      borderWidth: 0, hoverOffset: 4,
    }],
  }), [actionDist]);

  const reasonChartData = useMemo(() => ({
    labels: reasonBreakdown.map((r) => r.reason.length > 30 ? r.reason.slice(0, 30) + "..." : r.reason),
    datasets: [{
      data: reasonBreakdown.map((r) => r.count),
      backgroundColor: reasonBreakdown.map((r) => REASON_COLORS[r.reason] || "#6b7280"),
      borderWidth: 0, hoverOffset: 4,
    }],
  }), [reasonBreakdown]);

  const driverlessChartData = useMemo(() => ({
    labels: driverlessTruckStats.map((d) => new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })),
    datasets: [
      {
        label: "Driverless Trucks",
        data: driverlessTruckStats.map((d) => d.driverlessTrucks),
        borderColor: "#ef4444", backgroundColor: "rgba(239, 68, 68, 0.15)",
        tension: 0.4, fill: true, pointBackgroundColor: "#ef4444", pointRadius: 3,
      },
      {
        label: "Total Trucks",
        data: driverlessTruckStats.map((d) => d.totalTrucks),
        borderColor: "#354f52", backgroundColor: "rgba(53, 79, 82, 0.05)",
        tension: 0.4, fill: false, pointBackgroundColor: "#354f52", pointRadius: 3, borderDash: [5, 5],
      },
    ],
  }), [driverlessTruckStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-primary/10">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-primary/50 text-sm">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-2xl border border-red-200">
        <p className="text-red-600 text-sm text-center">
          {user?.role !== "super_admin"
            ? "Reports are only accessible to Super Admins."
            : `Error loading reports: ${error}`
          }
        </p>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "incomplete", label: "Incomplete Areas", icon: <AlertTriangle className="w-4 h-4" />, count: incompleteAreas.length },
    { id: "resources", label: "Resource Issues", icon: <Truck className="w-4 h-4" />, count: driverlessTruckStats.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary tracking-tight">
            Super Admin Reports
          </h2>
          <p className="text-sm text-primary/50 mt-1">
            Analytics, insights, and action items for waste management operations
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/10 text-xs font-semibold text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          {modelInfo.model} &middot; R&sup2; {modelInfo.r2Score}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-primary/10 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-primary/40 hover:text-primary/70"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === tab.id ? "bg-primary text-white" : "bg-red-500 text-white"
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">Total Schedules</p>
              <h3 className="mt-1 text-2xl font-bold text-primary">{totalSchedules}</h3>
            </div>
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">This Week</p>
              <h3 className="mt-1 text-2xl font-bold text-primary">{thisWeekWaste.toLocaleString()} kg</h3>
              <span className={`text-xs font-semibold ${weeklyChangeIsGood ? "text-green-600" : "text-red-600"}`}>
                {weeklyChange > 0 ? "+" : ""}{weeklyChange}%
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">Avg Dispatched/Day</p>
              <h3 className="mt-1 text-2xl font-bold text-primary">{avgDispatched}</h3>
            </div>
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">Model Accuracy</p>
              <h3 className="mt-1 text-2xl font-bold text-primary">{(modelInfo.r2Score * 100).toFixed(1)}%</h3>
            </div>
            <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5 bg-red-50/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600/80">Incomplete Areas</p>
              <h3 className="mt-1 text-2xl font-bold text-red-600">{incompleteAreas.length}</h3>
              <span className="text-xs text-red-500">Needs attention</span>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-6">
              <h3 className="text-base font-bold text-primary mb-1">Waste Prediction Trend</h3>
              <p className="text-sm text-primary/50 mb-4">Last 30 days</p>
              <div className="h-72 w-full">
                {trendValues.length > 0 ? <Line data={trendChartData} options={{ ...commonOptions, interaction: { mode: "index", intersect: false } }} /> : <p className="text-primary/40 flex items-center justify-center h-full text-sm">No data</p>}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-6">
              <h3 className="text-base font-bold text-primary mb-1">Area Waste Comparison</h3>
              <p className="text-sm text-primary/50 mb-4">Average predicted waste by area</p>
              <div className="h-72 w-full">
                {areaBreakdown.length > 0 ? <Bar data={areaChartData} options={{ ...commonOptions, indexAxis: "y", plugins: { ...commonOptions.plugins, legend: { display: false } } }} /> : <p className="text-primary/40 flex items-center justify-center h-full text-sm">No data</p>}
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-6">
              <h3 className="text-base font-bold text-primary mb-1">Waste Categories</h3>
              <p className="text-sm text-primary/50 mb-4">Distribution by severity</p>
              <div className="h-64 w-full flex justify-center">
                {categoryDist.length > 0 ? <Pie data={categoryChartData} options={pieBaseOptions} /> : <p className="text-primary/40 flex items-center h-full text-sm">No data</p>}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-6">
              <h3 className="text-base font-bold text-primary mb-1">Schedule Status</h3>
              <p className="text-sm text-primary/50 mb-4">By schedule state</p>
              <div className="h-64 w-full flex justify-center">
                {scheduleStats.length > 0 ? <Doughnut data={statusChartData} options={doughnutBaseOptions} /> : <p className="text-primary/40 flex items-center h-full text-sm">No data</p>}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-6">
              <h3 className="text-base font-bold text-primary mb-1">Action Distribution</h3>
              <p className="text-sm text-primary/50 mb-4">Dispatch vs skip vs reduced</p>
              <div className="h-64 w-full flex justify-center">
                {actionDist.length > 0 ? <Doughnut data={actionChartData} options={doughnutBaseOptions} /> : <p className="text-primary/40 flex items-center h-full text-sm">No data</p>}
              </div>
            </div>
          </div>

          {/* Weekly Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-primary">This Week</h3>
                <span className="text-xs font-medium text-primary/40 uppercase">Current</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-sm text-primary/60">Predicted Waste</span><span className="font-bold text-primary">{thisWeekWaste.toLocaleString()} kg</span></div>
                <div className="flex justify-between"><span className="text-sm text-primary/60">Schedules</span><span className="font-bold text-primary">{wc.thisWeekSchedules || 0}</span></div>
                <div className="flex justify-between"><span className="text-sm text-primary/60">Change</span><span className={`font-bold ${weeklyChangeIsGood ? "text-green-600" : "text-red-600"}`}>{weeklyChange > 0 ? "+" : ""}{weeklyChange}%</span></div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-primary">Last Week</h3>
                <span className="text-xs font-medium text-primary/40 uppercase">Previous</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-sm text-primary/60">Predicted Waste</span><span className="font-bold text-primary">{lastWeekWaste.toLocaleString()} kg</span></div>
                <div className="flex justify-between"><span className="text-sm text-primary/60">Schedules</span><span className="font-bold text-primary">{wc.lastWeekSchedules || 0}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INCOMPLETE AREAS TAB */}
      {activeTab === "incomplete" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-6">
              <h3 className="text-base font-bold text-primary mb-1">Skip Reasons Breakdown</h3>
              <p className="text-sm text-primary/50 mb-4">Why areas were not served</p>
              <div className="h-64 w-full flex justify-center">
                {reasonBreakdown.length > 0 ? (
                  <Doughnut data={reasonChartData} options={doughnutBaseOptions} />
                ) : (
                  <p className="text-green-600 flex items-center h-full text-sm font-medium">All areas served!</p>
                )}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-6">
              <h3 className="text-base font-bold text-primary mb-1">Summary</h3>
              <div className="space-y-4 mt-4">
                <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-sm font-bold text-red-700">{incompleteAreas.length} Areas Not Served</p>
                  <p className="text-xs text-red-600/70 mt-1">These areas were skipped due to resource shortages.</p>
                </div>
                {reasonBreakdown.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-primary/2">
                    <span className="text-sm text-primary/70 max-w-[70%]">{r.reason}</span>
                    <span className="text-lg font-bold text-red-600">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Incomplete Areas Table */}
          <div className="bg-white rounded-2xl border border-primary/10 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-primary/10">
              <h3 className="text-base font-bold text-primary">Incomplete Areas Log</h3>
              <p className="text-sm text-primary/50">Areas that were not served and require action</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-primary/8 bg-primary/3">
                    <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Date</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Area</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Type</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Predicted Waste</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Category</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Action</th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-primary/50 uppercase">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {incompleteAreas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-green-600 text-sm font-medium">
                        All areas have been served.
                      </td>
                    </tr>
                  ) : (
                    incompleteAreas.map((d, i) => (
                      <tr key={i} className="border-b border-primary/5 hover:bg-primary/2 transition-colors">
                        <td className="px-5 py-3 text-sm text-primary/60">{d.date}</td>
                        <td className="px-5 py-3 font-semibold text-primary text-sm">{d.area}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            { commercial: "bg-blue-100 text-blue-700", residential: "bg-purple-100 text-purple-700", suburban: "bg-teal-100 text-teal-700", rural: "bg-emerald-100 text-emerald-700" }[d.areaType] || "bg-gray-100 text-gray-700"
                          }`}>{d.areaType}</span>
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-primary">{d.predictedWasteKg?.toLocaleString()} kg</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            { none: "bg-gray-100 text-gray-600", low: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700", high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700" }[d.wasteCategory] || "bg-gray-100 text-gray-600"
                          }`}>{d.wasteCategory}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            d.action === "skip" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                          }`}>{d.action}</span>
                        </td>
                        <td className="px-5 py-3 text-xs text-red-600 font-medium max-w-50">{d.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RESOURCE ISSUES TAB */}
      {activeTab === "resources" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-6">
            <h3 className="text-base font-bold text-primary mb-1">Driverless Trucks Over Time</h3>
            <p className="text-sm text-primary/50 mb-4">Trucks without assigned drivers per schedule</p>
            <div className="h-72 w-full">
              {driverlessTruckStats.length > 0 ? (
                <Line data={driverlessChartData} options={{ ...commonOptions, interaction: { mode: "index", intersect: false } }} />
              ) : (
                <p className="text-green-600 flex items-center justify-center h-full text-sm font-medium">All trucks have drivers assigned!</p>
              )}
            </div>
          </div>

          {/* Resource Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5 bg-red-50/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600/80">Driverless Truck Schedules</p>
              <h3 className="mt-2 text-3xl font-bold text-red-600">{driverlessTruckStats.length}</h3>
              <p className="text-xs text-red-500 mt-1">Out of {totalSchedules} total</p>
            </div>
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 bg-amber-50/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600/80">Skipped (No Resources)</p>
              <h3 className="mt-2 text-3xl font-bold text-amber-600">
                {incompleteAreas.filter(d => d.reason?.includes("No truck") || d.reason?.includes("driver")).length}
              </h3>
              <p className="text-xs text-amber-500 mt-1">Missing trucks or drivers</p>
            </div>
            <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-5 bg-blue-50/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600/80">Skipped (ML Decision)</p>
              <h3 className="mt-2 text-3xl font-bold text-blue-600">
                {incompleteAreas.filter(d => d.reason === "Skipped by ML model").length}
              </h3>
              <p className="text-xs text-blue-500 mt-1">Low waste predicted</p>
            </div>
          </div>

          {/* Action Items */}
          <div className="bg-white rounded-2xl border border-primary/10 shadow-sm p-6">
            <h3 className="text-base font-bold text-primary mb-4">Recommended Actions</h3>
            <div className="space-y-3">
              {driverlessTruckStats.length > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                  <Truck className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-700">Assign Drivers to Trucks</p>
                    <p className="text-xs text-red-600/70 mt-1">Go to Drivers page and assign available drivers to driverless trucks to increase coverage.</p>
                  </div>
                </div>
              )}
              {incompleteAreas.filter(d => d.reason?.includes("capacity")).length > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-700">Add More Trucks</p>
                    <p className="text-xs text-amber-600/70 mt-1">Some areas were skipped due to insufficient truck capacity.</p>
                  </div>
                </div>
              )}
              {incompleteAreas.length > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
                  <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-blue-700">Use Re-dispatch</p>
                    <p className="text-xs text-blue-600/70 mt-1">Go to ML Schedule page and use the Re-dispatch button after assigning resources.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
