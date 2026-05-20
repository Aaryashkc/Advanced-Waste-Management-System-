import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleOff,
  HelpCircle,
  RefreshCcw,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import useAuthStore from "../../stores/useAuthStore";
import useMLScheduleStore from "../../stores/useMLScheduleStore";
import AreaPredictionCard from "./AreaPredictionCard";

const STATUS_STYLES = {
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-sky-200 bg-sky-50 text-sky-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

const PLAN_LEGEND = [
  { label: "Ready", dot: "bg-emerald-500", text: "Area has assigned collection coverage." },
  { label: "Reduced", dot: "bg-amber-500", text: "Area has partial or limited coverage." },
  { label: "Needs action", dot: "bg-rose-500", text: "Area needs resources or redispatch." },
];

const WASTE_LEGEND = [
  { label: "Low", dot: "bg-emerald-500" },
  { label: "Medium", dot: "bg-sky-500" },
  { label: "High", dot: "bg-amber-500" },
  { label: "Critical", dot: "bg-rose-500" },
];

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "No date";

const formatNumber = (value) =>
  Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

const StatCard = ({ label, value, detail, tone = "default" }) => (
  <div className="rounded-lg border border-primary/10 bg-white p-4">
    <p className="text-xs font-medium uppercase tracking-wide text-primary/45">{label}</p>
    <p className={`mt-2 text-2xl font-bold text-primary ${tone !== "default" ? tone : ""}`}>{value}</p>
    {detail && <p className="mt-2 text-xs text-primary/50">{detail}</p>}
  </div>
);

const Guide = () => {
  const [open, setOpen] = useState(false);

  return (
    <section className="relative rounded-lg border border-primary/10 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-primary">Schedule guide</h2>
          <p className="mt-1 text-sm text-primary/50">Use the Help button to see what the dots and card colors mean.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-primary/10 bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
          aria-expanded={open}
        >
          <HelpCircle className="h-4 w-4" />
          Help
        </button>
      </div>

      {open && (
        <div className="absolute right-4 top-[calc(100%-0.5rem)] z-30 w-[min(42rem,calc(100vw-3rem))] rounded-lg border border-primary/12 bg-white p-4 shadow-2xl dark:bg-[var(--dash-card-soft)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-primary">How to read this schedule</h3>
              <p className="mt-1 text-sm leading-relaxed text-primary/55">
                Each card is one pickup area. The main dot shows dispatch status, the level dot shows predicted waste level, and each card Help button explains what action is needed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-primary/45 transition hover:bg-primary/8 hover:text-primary"
              aria-label="Close schedule guide"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-primary/8 bg-primary/[0.025] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/45">Status colors</p>
              <div className="mt-2 space-y-2">
                {PLAN_LEGEND.map((item) => (
                  <div key={item.label} className="flex items-start gap-2 text-sm text-primary/60">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.dot}`} />
                    <span>
                      <span className="font-semibold text-primary">{item.label}</span>: {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-primary/8 bg-primary/[0.025] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/45">Waste level colors</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {WASTE_LEGEND.map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-white px-3 py-1.5 text-xs font-semibold text-primary/65 dark:bg-primary/5">
                    <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const MLScheduleDashboard = () => {
  const {
    currentSchedule,
    schedules,
    mlHealth,
    loading,
    error,
    generateSchedule,
    confirmSchedule,
    checkMLHealth,
    clearCurrentSchedule,
    clearError,
  } = useMLScheduleStore();

  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [showGenerator, setShowGenerator] = useState(false);
  const [previewSchedule, setPreviewSchedule] = useState(null);

  const loadTodaySchedule = useCallback(async (date) => {
    try {
      const response = await import("../../utils/api").then((m) => m.default);
      const res = await response.get(`/ml-schedule?date=${date}&limit=1`);
      const todaySchedules = res.data.data || [];
      if (todaySchedules.length > 0) {
        useMLScheduleStore.setState({ currentSchedule: todaySchedules[0], schedules: todaySchedules });
      } else {
        useMLScheduleStore.setState({ currentSchedule: null, schedules: [] });
      }
    } catch {
      useMLScheduleStore.setState({ currentSchedule: null, schedules: [] });
    }
  }, []);

  useEffect(() => {
    checkMLHealth();
    loadTodaySchedule(new Date().toISOString().split("T")[0]);
  }, [checkMLHealth, loadTodaySchedule]);

  const displaySchedule = currentSchedule;
  const summary = displaySchedule?.summary || {};
  const areas = useMemo(() => displaySchedule?.areas || [], [displaySchedule]);
  const isOnline = mlHealth?.status === "ok";

  const groupedAreas = useMemo(
    () => ({
      dispatch: areas.filter((area) => area.action === "dispatch"),
      reduced: areas.filter((area) => area.action === "reduced"),
      skip: areas.filter((area) => area.action === "skip"),
    }),
    [areas]
  );

  const totalAreas = summary.totalAreas || areas.length;
  const coveredAreas = (summary.dispatched || groupedAreas.dispatch.length) + (summary.reduced || groupedAreas.reduced.length);
  const coveragePercent = totalAreas ? Math.round((coveredAreas / totalAreas) * 100) : 0;

  const handleGenerate = async () => {
    clearError();
    const result = await generateSchedule(selectedDate);
    if (!result) return;

    const today = new Date().toISOString().split("T")[0];
    if (selectedDate === today) {
      setPreviewSchedule(null);
    } else {
      setPreviewSchedule(result);
      loadTodaySchedule(today);
    }
  };

  const handleConfirmCurrent = async () => {
    if (!displaySchedule?._id) return;
    await confirmSchedule(displaySchedule._id);
  };

  const handleConfirmPreview = async () => {
    if (!previewSchedule?._id) return;
    await confirmSchedule(previewSchedule._id);
    setPreviewSchedule(null);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-primary/10 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/8 text-primary">
                <BrainCircuit className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-primary">ML Schedule</h1>
                <p className="text-sm text-primary/55">Simple daily pickup cards generated from predicted waste and fleet availability.</p>
              </div>
            </div>

            {displaySchedule && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-lg border border-primary/10 bg-primary/[0.03] px-3 py-1.5 text-sm font-medium text-primary/70">
                  <CalendarDays className="h-4 w-4" />
                  {displaySchedule.dayName}, {formatDate(displaySchedule.date)}
                </span>
                <span className={`inline-flex rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize ${STATUS_STYLES[displaySchedule.status] || STATUS_STYLES.draft}`}>
                  {displaySchedule.status || "draft"}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                isOnline
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-rose-500"}`} />
              {isOnline ? "ML online" : "Fallback mode"}
            </span>

            <button
              type="button"
              onClick={() => checkMLHealth()}
              className="grid h-9 w-9 place-items-center rounded-lg border border-primary/10 text-primary/60 transition hover:bg-primary/5 hover:text-primary"
              aria-label="Refresh ML health"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>

            {displaySchedule?.status === "draft" && (
              <button
                type="button"
                onClick={handleConfirmCurrent}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirm
              </button>
            )}
          </div>
        </div>
      </section>

      <Guide />

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-sm text-rose-700">{error}</p>
          <button type="button" onClick={clearError} className="text-xs font-semibold text-rose-700 underline">
            Dismiss
          </button>
        </div>
      )}

      {displaySchedule && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Predicted waste" value={`${formatNumber(displaySchedule.totalPredictedWasteKg)} kg`} detail={`${totalAreas} pickup areas`} />
            <StatCard label="Coverage" value={`${coveragePercent}%`} detail={`${coveredAreas} of ${totalAreas} areas covered`} tone={coveragePercent < 80 ? "text-amber-700" : "text-emerald-700"} />
            <StatCard label="Trucks assigned" value={summary.totalTrucksAssigned || 0} detail={`${summary.totalTrucksAvailable || 0} trucks available`} />
            <StatCard label="Needs action" value={(summary.skipped || groupedAreas.skip.length) + Number(summary.driverlessTrucks || 0)} detail={`${summary.driverlessTrucks || 0} trucks without drivers`} tone="text-rose-700" />
          </div>

          {(summary.skipped > 0 || summary.driverlessTrucks > 0) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <p className="text-sm text-amber-700">
                  {summary.skipped || groupedAreas.skip.length} area(s) need attention.
                  {summary.driverlessTrucks > 0 ? ` ${summary.driverlessTrucks} truck(s) have no driver assigned.` : ""}
                </p>
              </div>
            </div>
          )}

          <section className="space-y-5">
            {[
              { title: "Ready", icon: CheckCircle2, areas: groupedAreas.dispatch },
              { title: "Reduced", icon: AlertCircle, areas: groupedAreas.reduced },
              { title: "Needs action", icon: CircleOff, areas: groupedAreas.skip },
            ].map(({ title, icon, areas: sectionAreas }) => (
              sectionAreas.length > 0 && (
                <div key={title}>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary/65">
                    {React.createElement(icon, { className: "h-4 w-4" })}
                    {title} ({sectionAreas.length})
                  </h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {sectionAreas.map((areaItem) => (
                      <AreaPredictionCard key={`${areaItem.area}-${areaItem.action}`} area={areaItem} scheduleId={displaySchedule._id} />
                    ))}
                  </div>
                </div>
              )
            ))}
          </section>
        </>
      )}

      {!displaySchedule && !loading && schedules.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm text-emerald-700">
            Latest schedule: {formatDate(schedules[0].date)} / {schedules[0].areas?.length || 0} areas /{" "}
            {formatNumber(schedules[0].totalPredictedWasteKg)} kg predicted.
          </p>
        </div>
      )}

      {!displaySchedule && !loading && schedules.length === 0 && (
        <section className="rounded-lg border border-primary/10 bg-white py-14 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-primary/8 text-primary/50">
            <BrainCircuit className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-primary">No schedule for today</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-primary/50">Generate a schedule to create simple pickup cards.</p>
        </section>
      )}

      {isSuperAdmin && (
        <section className="rounded-lg border border-primary/10 bg-white">
          <button
            type="button"
            onClick={() => setShowGenerator((value) => !value)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-primary/[0.03]"
          >
            <div>
              <h3 className="text-sm font-semibold text-primary">Schedule generator</h3>
              <p className="mt-0.5 text-sm text-primary/50">Create or regenerate a plan for any date.</p>
            </div>
            <ChevronDown className={`h-5 w-5 text-primary/45 transition-transform ${showGenerator ? "rotate-180" : ""}`} />
          </button>

          {showGenerator && (
            <div className="space-y-4 border-t border-primary/8 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-primary/45">Date</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-10 rounded-lg border border-primary/10 bg-white px-3 text-sm text-primary outline-none transition focus:border-primary/30"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {loading ? "Generating..." : "Generate schedule"}
                </button>

                {displaySchedule && (
                  <button
                    type="button"
                    onClick={() => {
                      clearCurrentSchedule();
                      setPreviewSchedule(null);
                    }}
                    className="h-10 rounded-lg border border-primary/10 px-4 text-sm font-medium text-primary/60 transition hover:bg-primary/5 hover:text-primary"
                  >
                    Clear view
                  </button>
                )}
              </div>

              {!isOnline && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  ML service is offline, so the backend fallback will generate the plan.
                </p>
              )}

              {previewSchedule && (
                <div className="rounded-lg border border-primary/10 bg-primary/[0.025] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary/45">Preview</p>
                      <h3 className="mt-1 text-base font-semibold text-primary">
                        {previewSchedule.dayName}, {formatDate(previewSchedule.date)}
                      </h3>
                      <p className="mt-1 text-sm text-primary/55">
                        {previewSchedule.areas?.length || 0} areas / {formatNumber(previewSchedule.totalPredictedWasteKg)} kg predicted.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {previewSchedule.status === "draft" && (
                        <button
                          type="button"
                          onClick={handleConfirmPreview}
                          disabled={loading}
                          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPreviewSchedule(null)}
                        className="rounded-lg border border-primary/10 px-3 py-2 text-sm font-medium text-primary/60 transition hover:bg-white"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default MLScheduleDashboard;
