import React, { useMemo, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import StatsCard from "../components/dashboard/StatsCard";
import AnalyticsCharts from "../components/dashboard/AnalyticsCharts";
import Button from "../components/common/Button";
import useAnalyticsStore from "../stores/useAnalyticsStore";
import useAuthStore from "../stores/useAuthStore";
import useMLScheduleStore from "../stores/useMLScheduleStore";
import AdminAnalyticsCharts from "../components/dashboard/AdminAnalyticsCharts";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const Dashboard = () => {
  const { data, isLoading, error, fetchAnalytics } = useAnalyticsStore();
  const { user } = useAuthStore();
  const { schedules, fetchSchedules, loading: mlLoading } = useMLScheduleStore();
  const role = user?.role;
  const isSuperAdmin = role === 'super_admin';

  useEffect(() => {
    fetchAnalytics();
    fetchSchedules();
  }, [fetchAnalytics, fetchSchedules]);

  // Find today's schedule
  const todayStr = new Date().toISOString().split("T")[0];
  const todaySchedule = useMemo(() => {
    return schedules.find((s) => {
      const sDate = new Date(s.date).toISOString().split("T")[0];
      return sDate === todayStr;
    });
  }, [schedules, todayStr]);

  // Top 5 districts by predicted waste for today
  const top5Districts = useMemo(() => {
    if (!todaySchedule?.districtSchedules) return [];
    return [...todaySchedule.districtSchedules]
      .sort((a, b) => (b.predictedWaste || 0) - (a.predictedWaste || 0))
      .slice(0, 5);
  }, [todaySchedule]);

  const top5ChartData = useMemo(() => ({
    labels: top5Districts.map((d) => d.districtName || d.district?.name || "Unknown"),
    datasets: [
      {
        label: "Predicted Waste (kg)",
        data: top5Districts.map((d) => d.predictedWaste || 0),
        backgroundColor: ["#4ade80", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899"],
        borderRadius: 6,
      },
    ],
  }), [top5Districts]);

  const top5ChartOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(25, 42, 28, 0.9)",
        titleFont: { family: "'Inter', sans-serif", size: 13 },
        bodyFont: { family: "'Inter', sans-serif", size: 12 },
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: "'Inter', sans-serif", size: 11 }, color: "#4a5568" },
        beginAtZero: true,
      },
      y: {
        grid: { display: false },
        ticks: { font: { family: "'Inter', sans-serif", size: 11 }, color: "#4a5568" },
      },
    },
  };

  // Construct stats from backend data if available, else fallback to 0/empty
  const ecosystemStats = data?.ecosystemStats || {};

  const stats = useMemo(
    () => [
      {
        title: isSuperAdmin ? "Total Organizations" : "Total Drivers",
        value: ecosystemStats.totalOrganizations || 0,
        icon: isSuperAdmin ? "🏢" : "👥",
        label: isSuperAdmin ? "Active Partners" : "In Organization",
        trend: "up"
      },
      {
        title: "Total Waste Collected",
        value: `${(ecosystemStats.totalWasteCollected || 0).toLocaleString()} kg`,
        icon: "⚖️",
        label: "All Time",
        trend: "up"
      },
      {
        title: "Active Vehicles",
        value: ecosystemStats.activeVehicles || 0,
        icon: "🚛",
        label: "Available Trucks",
        trend: "up"
      },
      {
        title: "Active Routes",
        value: ecosystemStats.activeRoutes || 0,
        icon: "📍",
        label: "Tasks In Progress",
        trend: "up"
      },
    ],
    [ecosystemStats]
  );

  return (
    <div className="app-bg">
      <div className="app-container space-y-6">
        {/* Top Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--primary)] tracking-tight">
              {isSuperAdmin ? "Super Admin Analytics" : "Organization Analytics"}
            </h2>
            <p className="text-sm sm:text-base text-[var(--primary)]/70">
              High-level overview of {isSuperAdmin ? "ecosystem" : "your organization's"} performance.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <Button variant="outline">Download Report</Button>
            {isSuperAdmin && <Button variant="primary" onClick={() => window.location.href='/admin-dashboard/organizations'}>Manage Organizations</Button>}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="bg-white rounded-3xl border border-[var(--primary)]/15 shadow-sm p-5"
            >
              <StatsCard {...stat} />
            </div>
          ))}
        </div>

        {/* Today's ML Schedule Summary */}
        <div className="bg-white rounded-3xl border border-[var(--primary)]/15 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🤖</span>
            <h3 className="text-lg font-bold text-[var(--primary)]">Today's ML Schedule</h3>
          </div>
          {mlLoading ? (
            <div className="flex items-center justify-center h-20">
              <div className="w-6 h-6 border-3 border-[var(--primary)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
            </div>
          ) : !todaySchedule ? (
            <p className="text-sm text-[var(--primary)]/50 text-center py-4">No ML schedule for today</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Left: Summary stats */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[var(--primary)]/60 font-medium">Date:</span>
                  <span className="font-semibold text-[var(--primary)]">
                    {new Date(todaySchedule.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    todaySchedule.status === "confirmed" ? "bg-green-100 text-green-700" :
                    todaySchedule.status === "completed" ? "bg-blue-100 text-blue-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>
                    {todaySchedule.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/15 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-[var(--accent)]">
                      {todaySchedule.totalPredictedWaste ? `${todaySchedule.totalPredictedWaste.toLocaleString()}` : "--"}
                    </p>
                    <p className="text-[10px] font-medium text-[var(--primary)]/50 uppercase">Predicted kg</p>
                  </div>
                  <div className="rounded-xl bg-green-50 border border-green-200/50 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-green-600">
                      {todaySchedule.districtSchedules?.filter((d) => d.action === "dispatch").length || 0}
                    </p>
                    <p className="text-[10px] font-medium text-[var(--primary)]/50 uppercase">Dispatched</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200/50 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-gray-500">
                      {todaySchedule.districtSchedules?.filter((d) => d.action === "skip").length || 0}
                    </p>
                    <p className="text-[10px] font-medium text-[var(--primary)]/50 uppercase">Skipped</p>
                  </div>
                </div>
              </div>
              {/* Right: Top 5 districts mini bar chart */}
              <div>
                <p className="text-xs font-semibold text-[var(--primary)]/60 uppercase tracking-wide mb-2">Top 5 Districts by Predicted Waste</p>
                <div className="h-36">
                  {top5Districts.length > 0 ? (
                    <Bar data={top5ChartData} options={top5ChartOptions} />
                  ) : (
                    <p className="text-sm text-[var(--primary)]/50 text-center py-6">No district data</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Analytics Charts */}
        <section className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 bg-white/50 rounded-3xl border border-[var(--primary)]/10">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-[var(--primary)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
                <p className="text-[var(--primary)]/70 font-medium">Loading {isSuperAdmin ? "ecosystem" : "organization"} analytics...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center p-8 bg-red-50 rounded-3xl border border-red-200">
              <p className="text-red-600 font-medium text-center">
                Error loading analytics: <br />{error}
              </p>
            </div>
          ) : (
            isSuperAdmin ? <AnalyticsCharts analyticsData={data} /> : <AdminAnalyticsCharts analyticsData={data} />
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
