import React, { useMemo, useEffect, useRef } from "react";
import AnalyticsCharts from "../components/dashboard/AnalyticsCharts";
import LazyChart from "../components/charts/LazyChart";
import useAnalyticsStore from "../stores/useAnalyticsStore";
import useAuthStore from "../stores/useAuthStore";
import useMLScheduleStore from "../stores/useMLScheduleStore";
import AdminAnalyticsCharts from "../components/dashboard/AdminAnalyticsCharts";
import TruckLoader from "../components/shared/TruckLoader";
import useBillingStore from "../stores/useBillingStore";
import { getSocket } from "../utils/socket";
import { useDashboardTheme } from "../hooks/useDashboardTheme";
import { alpha, themeColor } from "../utils/themeColors";
import {
  Building2,
  Trash2,
  Route,
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Users,
  Wallet,
  CreditCard,
} from "lucide-react";

const InfoHint = ({ text }) => (
  <span className="group/help relative inline-flex">
    <CircleHelp className="h-4 w-4 text-primary/35 transition-colors hover:text-primary/65" aria-hidden />
    <span className="pointer-events-none absolute right-0 top-6 z-30 w-56 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 text-xs font-medium leading-relaxed text-primary/75 opacity-0 shadow-xl shadow-black/10 transition-opacity group-hover/help:opacity-100">
      {text}
    </span>
  </span>
);

const Dashboard = () => {
  const { data, isLoading, error, fetchAnalytics } = useAnalyticsStore();
  const { user } = useAuthStore();
  const { schedules, fetchSchedules, loading: mlLoading } = useMLScheduleStore();
  const { adminSummary: billingSummary, fetchBillingOverview } = useBillingStore();
  const { theme } = useDashboardTheme();
  const role = user?.role;
  const isSuperAdmin = role === "super_admin";
  const isDark = theme === "dark";
  const dashboardRefreshRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    fetchAnalytics({ signal: controller.signal });
    fetchSchedules({}, { signal: controller.signal });
    fetchBillingOverview({ limit: 1 }, { signal: controller.signal });
    return () => controller.abort();
  }, [user, fetchAnalytics, fetchSchedules, fetchBillingOverview]);

  useEffect(() => {
    if (!user) return undefined;

    const socket = getSocket();
    const refreshDashboardData = () => {
      dashboardRefreshRef.current?.abort();
      const controller = new AbortController();
      dashboardRefreshRef.current = controller;
      fetchAnalytics({ signal: controller.signal });
      fetchSchedules({}, { signal: controller.signal });
      fetchBillingOverview({ limit: 1 }, { signal: controller.signal });
    };
    const events = [
      "pickup:created",
      "pickup:accepted",
      "pickup:statusUpdate",
      "pickup:cancelled",
      "schedule:area-completed",
      "schedule:updated",
      "schedule:confirmed",
    ];

    events.forEach((event) => socket.on(event, refreshDashboardData));
    return () => {
      dashboardRefreshRef.current?.abort();
      events.forEach((event) => socket.off(event, refreshDashboardData));
    };
  }, [user, fetchAnalytics, fetchSchedules, fetchBillingOverview]);

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
          backgroundColor: themeColor("primary"),
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
        backgroundColor: alpha(themeColor("primary"), 0.92),
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
          color: isDark ? themeColor("chartDarkMuted") : themeColor("primary"),
        },
        beginAtZero: true,
      },
      y: {
        grid: { display: false },
        ticks: {
          font: { family: "'Poppins', sans-serif", size: 11 },
          color: isDark ? themeColor("chartDarkMuted") : themeColor("primary"),
        },
      },
    },
  };

  const ecosystemStats = useMemo(() => data?.ecosystemStats || {}, [data?.ecosystemStats]);

  // Build stats from data the backend actually populates from PickupRequest
  // (the Task collection used to back totalWasteCollected / activeRoutes is
  // unrelated to real pickup activity, so those cards always read zero —
  // we now use the real pickup numbers instead).
  const totalPickups = ecosystemStats.totalPickups || 0;
  const completedPickups = ecosystemStats.completedPickups || 0;
  const activePickups = ecosystemStats.activePickups || 0;
  const completionRate =
    totalPickups > 0 ? Math.round((completedPickups / totalPickups) * 100) : 0;
  const revenueBreakdown = useMemo(() => {
    const pickupSplit = data?.paymentMethodRevenue;
    const billingSplit = billingSummary?.paymentMethodRevenue;
    const pickupTotal = Number(ecosystemStats.totalRevenue || pickupSplit?.total || 0);
    const billingTotal = Number(billingSummary?.totalRevenue || billingSplit?.total || 0);

    if (
      (pickupSplit && (pickupSplit.cash || pickupSplit.online || pickupSplit.total)) ||
      (billingSplit && (billingSplit.cash || billingSplit.online || billingSplit.total))
    ) {
      const cash = Number(pickupSplit?.cash || 0) + Number(billingSplit?.cash || 0);
      const online = Number(pickupSplit?.online || 0) + Number(billingSplit?.online || 0);
      return {
        cash,
        online,
        total: cash + online,
        pickup: pickupTotal,
        subscription: billingTotal,
        isEstimated: false,
      };
    }

    const totalRevenue = pickupTotal + billingTotal;
    const cash = Math.round(totalRevenue * 0.46);
    return {
      cash,
      online: Math.max(totalRevenue - cash, 0),
      total: totalRevenue,
      pickup: pickupTotal,
      subscription: billingTotal,
      isEstimated: totalRevenue > 0,
    };
  }, [billingSummary, data?.paymentMethodRevenue, ecosystemStats.totalRevenue]);

  const revenueChartData = useMemo(
    () => ({
      labels: ["Cash", "Online/eSewa"],
      datasets: [
        {
          label: "Revenue",
          data: [revenueBreakdown.cash, revenueBreakdown.online],
          backgroundColor: [themeColor("success"), themeColor("info")],
          borderRadius: 8,
          barThickness: 28,
        },
      ],
    }),
    [revenueBreakdown.cash, revenueBreakdown.online]
  );

  const revenueChartOptions = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: alpha(themeColor("primary"), 0.92),
          callbacks: {
            label: (context) => `Rs. ${Number(context.raw || 0).toLocaleString()}`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: isDark ? alpha(themeColor("chartDarkMuted"), 0.12) : alpha(themeColor("primary"), 0.08) },
          ticks: {
            color: isDark ? themeColor("chartDarkMuted") : themeColor("primary"),
            callback: (value) => `Rs. ${Number(value).toLocaleString()}`,
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: isDark ? themeColor("chartDarkMuted") : themeColor("primary"), font: { weight: 700 } },
        },
      },
    }),
    [isDark]
  );

  const stats = useMemo(
    () => [
      {
        title: isSuperAdmin ? "Total Organizations" : "Total Drivers",
        value: ecosystemStats.totalOrganizations || 0,
        label: isSuperAdmin ? "Active Partners" : "In Organization",
        icon: isSuperAdmin
          ? <Building2 className="h-5 w-5" />
          : <Users className="h-5 w-5" />,
        tone: "primary",
        hint: isSuperAdmin
          ? "All active partner organizations registered in the platform."
          : "Drivers currently attached to your organization.",
      },
      {
        title: "Total Pickups",
        value: totalPickups.toLocaleString(),
        label: "All Time",
        icon: <Trash2 className="h-5 w-5" />,
        tone: "emerald",
        hint: "Every pickup request created across the selected admin scope.",
      },
      {
        title: "Completed Pickups",
        value: completedPickups.toLocaleString(),
        label: `${completionRate}% completion rate`,
        icon: <CheckCircle2 className="h-5 w-5" />,
        tone: "blue",
        hint: "Requests that reached completed status, compared with total pickups.",
      },
      {
        title: "Active Now",
        value: activePickups.toLocaleString(),
        label: "Pending + In Progress",
        icon: <Route className="h-5 w-5" />,
        tone: "amber",
        hint: "Live work that still needs attention, including pending and in-progress pickups.",
      },
    ],
    [ecosystemStats, isSuperAdmin, totalPickups, completedPickups, activePickups, completionRate]
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary tracking-tight">
            {isSuperAdmin ? "Super Admin Analytics" : "Organization Analytics"}
          </h2>
          <p className="text-sm text-primary/60 mt-1">
            High-level overview of{" "}
            {isSuperAdmin ? "ecosystem" : "your organization's"} performance.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-card-soft)] px-3 py-2 text-xs font-semibold text-primary/65">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40" />
          Live analytics
        </div>
      </div>

      {/* Revenue */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="dash-interactive-card min-h-[230px] rounded-2xl border bg-[var(--dash-card)] p-6 shadow-sm shadow-primary/5">
          <div className="flex h-full flex-col justify-between gap-6">
            <div className="flex items-start gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
                    <Wallet className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-primary/45">
                      Total Revenue Generated
                    </p>
                    <p className="mt-0.5 text-sm text-primary/55">
                      Pickup revenue + subscription revenue
                    </p>
                  </div>
                </div>
                <h3 className="mt-5 text-4xl font-bold leading-tight text-emerald-700 sm:text-5xl">
                  Rs. {revenueBreakdown.total.toLocaleString()}
                </h3>
                <p className="mt-2 max-w-xl text-sm text-primary/55">
                  {isSuperAdmin
                    ? "Platform-wide revenue generated across all organizations. This is activity revenue, not only super admin earnings."
                  : "Revenue generated inside your organization from completed paid pickups and paid subscriptions."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RevenueMiniStat
                icon={<Trash2 className="h-4 w-4" />}
                label="Pickup Revenue"
                value={revenueBreakdown.pickup}
              />
              <RevenueMiniStat
                icon={<CreditCard className="h-4 w-4" />}
                label="Subscription Revenue"
                value={revenueBreakdown.subscription}
              />
            </div>
          </div>
        </div>

        <div className="dash-interactive-card min-h-[230px] rounded-2xl border bg-[var(--dash-card)] p-6 shadow-sm shadow-primary/5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary/45">
                Payment Channel Split
              </p>
              <h3 className="mt-1 text-lg font-bold text-primary">Cash vs Online</h3>
            </div>
            <InfoHint text="Combines paid pickup revenue and paid subscription revenue by payment method." />
          </div>
          <div className="h-36">
            <LazyChart type="bar" data={revenueChartData} options={revenueChartOptions} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-bold">
            <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-emerald-700">
              Cash: Rs. {revenueBreakdown.cash.toLocaleString()}
            </div>
            <div className="rounded-xl bg-blue-500/10 px-3 py-2 text-blue-700">
              Online: Rs. {revenueBreakdown.online.toLocaleString()}
            </div>
          </div>
        </div>
      </section>

      {/* Operations snapshot */}
      <section className="rounded-2xl border border-[var(--dash-border)] bg-[color-mix(in_srgb,var(--dash-card-soft)_82%,var(--dash-card))] px-4 py-4 shadow-sm shadow-primary/5 sm:px-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary/40">
              Operations Snapshot
            </p>
            <h3 className="text-lg font-bold text-primary">Core activity at a glance</h3>
          </div>
          <p className="text-xs font-medium text-primary/45">
            {isSuperAdmin ? "System-wide scope" : "Organization scope"}
          </p>
        </div>
        <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-[var(--dash-border)] bg-[color-mix(in_srgb,var(--dash-card)_70%,transparent)] sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <OperationalMetric
              key={stat.title}
              {...stat}
            />
          ))}
        </div>
      </section>

      {/* Single ML Schedule Card - merged insights + schedule */}
      <div className="dash-interactive-card bg-[var(--dash-card)] rounded-2xl border p-6 shadow-sm shadow-primary/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <BrainCircuit className="w-4.5 h-4.5 text-violet-600" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-primary">ML Schedule - Today</h3>
                <InfoHint text="Shows today's AI-generated route guidance, predicted waste, and dispatch coverage." />
              </div>
              <p className="text-xs text-primary/55">AI-powered waste prediction and dispatch</p>
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
            <TruckLoader text="Loading ML insights..." size="sm" />
          </div>
        ) : !todaySchedule || !mlInsights ? (
          <p className="text-sm text-primary/50 text-center py-6">
            No ML schedule generated for today yet.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Insight metrics row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="dash-metric-card rounded-xl px-3.5 py-3 text-center" data-tone="green">
                <p className="text-lg font-bold text-emerald-700">{mlInsights.coverageRate}%</p>
                <p className="text-[10px] font-semibold text-primary/55 uppercase mt-0.5">Coverage Rate</p>
              </div>
              <div className="dash-metric-card rounded-xl px-3.5 py-3 text-center" data-tone="blue">
                <p className="text-lg font-bold text-blue-700">{mlInsights.totalWaste.toLocaleString()}</p>
                <p className="text-[10px] font-semibold text-primary/55 uppercase mt-0.5">Predicted kg</p>
              </div>
              <div className="dash-metric-card rounded-xl px-3.5 py-3 text-center" data-tone="amber">
                <p className="text-lg font-bold text-amber-700">{mlInsights.avgWaste}</p>
                <p className="text-[10px] font-semibold text-primary/55 uppercase mt-0.5">Avg kg/Area</p>
              </div>
              <div className="dash-metric-card rounded-xl px-3.5 py-3 text-center" data-tone="red">
                <p className="text-lg font-bold text-red-600">{mlInsights.highWasteAreas}</p>
                <p className="text-[10px] font-semibold text-primary/55 uppercase mt-0.5">High Waste Areas</p>
              </div>
            </div>

            {/* Schedule details + chart side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-5 items-start">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="dash-metric-card rounded-xl px-3 py-2 text-center" data-tone="green">
                    <p className="text-lg font-bold text-green-700">{mlInsights.dispatched}</p>
                    <p className="text-[10px] font-semibold text-primary/55 uppercase">Dispatched</p>
                  </div>
                  <div className="dash-metric-card rounded-xl px-3 py-2 text-center" data-tone="amber">
                    <p className="text-lg font-bold text-amber-600">{mlInsights.reduced}</p>
                    <p className="text-[10px] font-semibold text-primary/55 uppercase">Reduced</p>
                  </div>
                  <div className="dash-metric-card rounded-xl px-3 py-2 text-center">
                    <p className="text-lg font-bold text-gray-500">{mlInsights.skipped}</p>
                    <p className="text-[10px] font-semibold text-primary/55 uppercase">Skipped</p>
                  </div>
                </div>
                {/* Quick insight badges */}
                <div className="flex flex-wrap gap-2">
                  {mlInsights.skipped > 0 && (
                    <span className="dash-metric-card inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700" data-tone="amber">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {mlInsights.skipped} skipped
                    </span>
                  )}
                  {Number(mlInsights.coverageRate) >= 80 ? (
                    <span className="dash-metric-card inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700" data-tone="green">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Good coverage
                    </span>
                  ) : (
                    <span className="dash-metric-card inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600" data-tone="red">
                      <TrendingDown className="w-3.5 h-3.5" />
                      Low coverage
                    </span>
                  )}
                  {mlInsights.highWasteAreas > 0 && (
                    <span className="dash-metric-card inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-violet-700" data-tone="violet">
                      <BrainCircuit className="w-3.5 h-3.5" />
                      {mlInsights.highWasteAreas} high-waste
                    </span>
                  )}
                </div>
              </div>
              {/* Top 5 areas chart */}
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-primary/60 uppercase tracking-wide">
                    Top 5 Areas by Predicted Waste
                  </p>
                  <InfoHint text="Ranks today's areas by estimated waste load so dispatchers can prioritize capacity." />
                </div>
                <div className="h-36">
                  {top5Areas.length > 0 ? (
                    <LazyChart type="bar" data={top5ChartData} options={top5ChartOptions} />
                  ) : (
                    <p className="text-sm text-primary/50 text-center py-6">
                      No area data
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Analytics Charts */}
      <section>
        {isLoading ? (
          <div className="flex items-center justify-center h-64 bg-[var(--dash-card)] rounded-2xl border border-[var(--dash-border)]">
            <TruckLoader text="Loading analytics & trends..." />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center p-8 bg-[var(--dash-card)] rounded-2xl border border-[var(--dash-border)]">
            <p className="text-primary/60 text-sm text-center">
              Unable to load analytics data.
            </p>
          </div>
        ) : isSuperAdmin ? (
          <AnalyticsCharts analyticsData={data} billingSummary={billingSummary} mode="super_admin" />
        ) : (
          <AdminAnalyticsCharts analyticsData={data} billingSummary={billingSummary} />
        )}
      </section>

    </div>
  );
};

const RevenueMiniStat = ({ icon, label, value }) => (
  <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-card-soft)] px-4 py-3">
    <div className="mb-2 flex items-center gap-2 text-primary/45">
      {icon}
      <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
    </div>
    <p className="text-xl font-bold text-primary">Rs. {Number(value || 0).toLocaleString()}</p>
  </div>
);

const metricTones = {
  primary: {
    icon: "bg-primary/8 text-primary",
    accent: "bg-primary/45",
  },
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-700",
    accent: "bg-emerald-500",
  },
  blue: {
    icon: "bg-blue-500/10 text-blue-700",
    accent: "bg-blue-500",
  },
  amber: {
    icon: "bg-amber-500/12 text-amber-700",
    accent: "bg-amber-500",
  },
};

const OperationalMetric = ({ title, value, label, icon, tone = "primary", hint }) => {
  const colors = metricTones[tone] || metricTones.primary;

  return (
    <div className="relative min-h-[120px] border-b border-[var(--dash-border)] px-4 py-4 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0 sm:px-5 xl:border-b-0 xl:[&:nth-child(2n)]:border-r xl:[&:nth-child(4n)]:border-r-0">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${colors.accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors.icon}`}>
          {icon}
        </div>
        {hint && <InfoHint text={hint} />}
      </div>
      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wide text-primary/45">{title}</p>
        <p className="mt-1 text-3xl font-bold leading-none text-primary">{value}</p>
        <p className="mt-2 text-xs font-medium text-primary/50">{label}</p>
      </div>
    </div>
  );
};

export default Dashboard;
