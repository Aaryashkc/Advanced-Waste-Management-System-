import React, { useMemo, useEffect } from "react";
import StatsCard from "../components/dashboard/StatsCard";
import AnalyticsCharts from "../components/dashboard/AnalyticsCharts";
import Button from "../components/common/Button";
import useAnalyticsStore from "../stores/useAnalyticsStore";
import useAuthStore from "../stores/useAuthStore";
import AdminAnalyticsCharts from "../components/dashboard/AdminAnalyticsCharts";

const Dashboard = () => {
  const { data, isLoading, error, fetchAnalytics } = useAnalyticsStore();
  const { user } = useAuthStore();
  const role = user?.role;
  const isSuperAdmin = role === 'super_admin';

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

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
