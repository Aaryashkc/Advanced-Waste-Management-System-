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
import useAnalyticsStore from "../stores/useAnalyticsStore";
import useAuthStore from "../stores/useAuthStore";
import useMLScheduleStore from "../stores/useMLScheduleStore";
import AdminAnalyticsCharts from "../components/dashboard/AdminAnalyticsCharts";
import {
  Building2,
  Trash2,
  Truck,
  Route,
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const Dashboard = () => {
  const { data, isLoading, error, fetchAnalytics } = useAnalyticsStore();
  const { user } = useAuthStore();
  const { schedules, fetchSchedules, loading: mlLoading } = useMLScheduleStore();
  const role = user?.role;
  const isSuperAdmin = role === "super_admin";

  useEffect(() => {
    fetchAnalytics();
    fetchSchedules();
  }, [fetchAnalytics, fetchSchedules]);

  const todayStr = new Date().toISOString().split("T")[0];
  const todaySchedule = useMemo(() => {
    return schedules.find((s) => {
      const sDate = new Date(s.date).toISOString().split("T")[0];
      return sDate === todayStr;
    });
  }, [schedules, todayStr]);

  // Use correct backend field names: areas[], predictedWasteKg, totalPredictedWasteKg
  const top5Areas = useMemo(() => {
    if (!todaySchedule?.areas) return [];
    return [...todaySchedule.areas]
      .sort((a, b) => (b.predictedWasteKg || 0) - (a.predictedWasteKg || 0))
      .slice(0, 5);
  }, [todaySchedule]);

  const top5ChartData = useMemo(
    () => ({
      labels: top5Areas.map((d) => d.area || "Unknown"),
      datasets: [
        {
          label: "Predicted Waste (kg)",
          data: top5Areas.map((d) => d.predictedWasteKg || 0),
          backgroundColor: "#354f52",
          borderRadius: 6,
        },
      ],
    }),
    [top5Areas]
  );

  const top5ChartOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(53, 79, 82, 0.92)",
        titleFont: { family: "'Poppins', sans-serif", size: 13 },
        bodyFont: { family: "'Poppins', sans-serif", size: 12 },
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: "'Poppins', sans-serif", size: 11 },
          color: "#354f52",
        },
        beginAtZero: true,
      },
      y: {
        grid: { display: false },
        ticks: {
          font: { family: "'Poppins', sans-serif", size: 11 },
          color: "#354f52",
        },
      },
    },
  };

  const ecosystemStats = data?.ecosystemStats || {};

  const stats = useMemo(
    () => [
      {
        title: isSuperAdmin ? "Total Organizations" : "Total Drivers",
        value: ecosystemStats.totalOrganizations || 0,
        label: isSuperAdmin ? "Active Partners" : "In Organization",
        icon: <Building2 className="w-5 h-5 text-primary" />,
        iconBg: "bg-primary/8",
      },
      {
        title: "Total Waste Collected",
        value: `${(ecosystemStats.totalWasteCollected || 0).toLocaleString()} kg`,
        label: "All Time",
        icon: <Trash2 className="w-5 h-5 text-emerald-600" />,
        iconBg: "bg-emerald-100",
      },
      {
        title: "Active Vehicles",
        value: ecosystemStats.activeVehicles || 0,
        label: "Available Trucks",
        icon: <Truck className="w-5 h-5 text-blue-600" />,
        iconBg: "bg-blue-100",
      },
      {
        title: "Active Routes",
        value: ecosystemStats.activeRoutes || 0,
        label: "Tasks In Progress",
        icon: <Route className="w-5 h-5 text-amber-600" />,
        iconBg: "bg-amber-100",
      },
    ],
    [ecosystemStats, isSuperAdmin]
  );

  // ML Insights derived from today's schedule (using correct backend field names)
  const mlInsights = useMemo(() => {
    if (!todaySchedule) return null;
    const ds = todaySchedule.areas || [];
    const dispatched = ds.filter((d) => d.action === "dispatch");
    const skipped = ds.filter((d) => d.action === "skip");
    const reduced = ds.filter((d) => d.action === "reduced");
    const totalWaste = todaySchedule.totalPredictedWasteKg || 0;
    const highWaste = ds.filter((d) => (d.predictedWasteKg || 0) > 500);

    return {
      totalAreas: ds.length,
      dispatched: dispatched.length,
      skipped: skipped.length,
      reduced: reduced.length,
      totalWaste,
      highWasteAreas: highWaste.length,
      coverageRate: ds.length > 0 ? ((dispatched.length / ds.length) * 100).toFixed(0) : 0,
      avgWaste: ds.length > 0 ? Math.round(totalWaste / ds.length) : 0,
    };
  }, [todaySchedule]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-primary tracking-tight">
          {isSuperAdmin ? "Super Admin Analytics" : "Organization Analytics"}
        </h2>
        <p className="text-sm text-primary/50 mt-1">
          High-level overview of{" "}
          {isSuperAdmin ? "ecosystem" : "your organization's"} performance.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <StatsCard key={idx} {...stat} />
        ))}
      </div>

      {/* Single ML Schedule Card - merged insights + schedule */}
      <div className="bg-white rounded-2xl border border-primary/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <BrainCircuit className="w-4.5 h-4.5 text-violet-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary">ML Schedule - Today</h3>
              <p className="text-xs text-primary/40">AI-powered waste prediction & dispatch</p>
            </div>
          </div>
          {todaySchedule && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                todaySchedule.status === "confirmed"
                  ? "bg-green-50 text-green-700"
                  : todaySchedule.status === "completed"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {todaySchedule.status}
            </span>
          )}
        </div>

        {mlLoading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : !todaySchedule || !mlInsights ? (
          <p className="text-sm text-primary/40 text-center py-6">
            No ML schedule generated for today yet.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Insight metrics row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-emerald-50/60 border border-emerald-200/40 px-3.5 py-3 text-center">
                <p className="text-lg font-bold text-emerald-700">{mlInsights.coverageRate}%</p>
                <p className="text-[10px] font-medium text-primary/40 uppercase mt-0.5">Coverage Rate</p>
              </div>
              <div className="rounded-xl bg-blue-50/60 border border-blue-200/40 px-3.5 py-3 text-center">
                <p className="text-lg font-bold text-blue-700">{mlInsights.totalWaste.toLocaleString()}</p>
                <p className="text-[10px] font-medium text-primary/40 uppercase mt-0.5">Predicted kg</p>
              </div>
              <div className="rounded-xl bg-amber-50/60 border border-amber-200/40 px-3.5 py-3 text-center">
                <p className="text-lg font-bold text-amber-700">{mlInsights.avgWaste}</p>
                <p className="text-[10px] font-medium text-primary/40 uppercase mt-0.5">Avg kg/Area</p>
              </div>
              <div className="rounded-xl bg-red-50/60 border border-red-200/40 px-3.5 py-3 text-center">
                <p className="text-lg font-bold text-red-600">{mlInsights.highWasteAreas}</p>
                <p className="text-[10px] font-medium text-primary/40 uppercase mt-0.5">High Waste Areas</p>
              </div>
            </div>

            {/* Schedule details + chart side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-green-50/50 border border-green-200/40 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-green-700">{mlInsights.dispatched}</p>
                    <p className="text-[10px] font-medium text-primary/40 uppercase">Dispatched</p>
                  </div>
                  <div className="rounded-xl bg-amber-50/50 border border-amber-200/40 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-amber-600">{mlInsights.reduced}</p>
                    <p className="text-[10px] font-medium text-primary/40 uppercase">Reduced</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-200/40 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-gray-500">{mlInsights.skipped}</p>
                    <p className="text-[10px] font-medium text-primary/40 uppercase">Skipped</p>
                  </div>
                </div>
                {/* Quick insight badges */}
                <div className="flex flex-wrap gap-2">
                  {mlInsights.skipped > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200/60 text-xs font-medium text-amber-700">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {mlInsights.skipped} skipped
                    </span>
                  )}
                  {Number(mlInsights.coverageRate) >= 80 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/60 text-xs font-medium text-emerald-700">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Good coverage
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200/60 text-xs font-medium text-red-600">
                      <TrendingDown className="w-3.5 h-3.5" />
                      Low coverage
                    </span>
                  )}
                  {mlInsights.highWasteAreas > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200/60 text-xs font-medium text-violet-700">
                      <BrainCircuit className="w-3.5 h-3.5" />
                      {mlInsights.highWasteAreas} high-waste
                    </span>
                  )}
                </div>
              </div>
              {/* Top 5 areas chart */}
              <div>
                <p className="text-xs font-medium text-primary/50 uppercase tracking-wide mb-2">
                  Top 5 Areas by Predicted Waste
                </p>
                <div className="h-36">
                  {top5Areas.length > 0 ? (
                    <Bar data={top5ChartData} options={top5ChartOptions} />
                  ) : (
                    <p className="text-sm text-primary/40 text-center py-6">
                      No area data
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pickup Overview Card */}
      {data?.ecosystemStats && (data.ecosystemStats.totalPickups > 0 || data.ecosystemStats.activePickups > 0) && (
        <div className="bg-white rounded-2xl border border-primary/10 p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Trash2 className="w-4.5 h-4.5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-primary">Pickup Overview</h3>
              <p className="text-xs text-primary/40">Real-time pickup request statistics</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-blue-50/60 border border-blue-200/40 px-3.5 py-3 text-center">
              <p className="text-lg font-bold text-blue-700">{data.ecosystemStats.totalPickups || 0}</p>
              <p className="text-[10px] font-medium text-primary/40 uppercase mt-0.5">Total Pickups</p>
            </div>
            <div className="rounded-xl bg-green-50/60 border border-green-200/40 px-3.5 py-3 text-center">
              <p className="text-lg font-bold text-green-700">{data.ecosystemStats.completedPickups || 0}</p>
              <p className="text-[10px] font-medium text-primary/40 uppercase mt-0.5">Completed</p>
            </div>
            <div className="rounded-xl bg-amber-50/60 border border-amber-200/40 px-3.5 py-3 text-center">
              <p className="text-lg font-bold text-amber-700">{data.ecosystemStats.activePickups || 0}</p>
              <p className="text-[10px] font-medium text-primary/40 uppercase mt-0.5">Active Now</p>
            </div>
            <div className="rounded-xl bg-emerald-50/60 border border-emerald-200/40 px-3.5 py-3 text-center">
              <p className="text-lg font-bold text-emerald-700">
                {data.ecosystemStats.totalPickups > 0
                  ? Math.round((data.ecosystemStats.completedPickups / data.ecosystemStats.totalPickups) * 100)
                  : 0}%
              </p>
              <p className="text-[10px] font-medium text-primary/40 uppercase mt-0.5">Completion Rate</p>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Charts */}
      <section>
        {isLoading ? (
          <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-primary/10">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center p-8 bg-white rounded-2xl border border-primary/10">
            <p className="text-primary/50 text-sm text-center">
              Unable to load analytics data.
            </p>
          </div>
        ) : isSuperAdmin ? (
          <AnalyticsCharts analyticsData={data} />
        ) : (
          <AdminAnalyticsCharts analyticsData={data} />
        )}
      </section>
    </div>
  );
};

export default Dashboard;
