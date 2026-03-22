import React, { useState, useEffect } from "react";
import useMLScheduleStore from "../../stores/useMLScheduleStore";
import useAuthStore from "../../stores/useAuthStore";
import DistrictPredictionCard from "./DistrictPredictionCard";

const MLScheduleDashboard = () => {
  const {
    currentSchedule,
    schedules,
    mlHealth,
    loading,
    error,
    generateSchedule,
    fetchSchedules,
    confirmSchedule,
    checkMLHealth,
    clearCurrentSchedule,
    clearError,
  } = useMLScheduleStore();

  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "super_admin";

  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [showGenerator, setShowGenerator] = useState(false);
  const [previewSchedule, setPreviewSchedule] = useState(null);

  useEffect(() => {
    checkMLHealth();
    const today = new Date().toISOString().split("T")[0];
    loadTodaySchedule(today);
  }, []);

  const loadTodaySchedule = async (date) => {
    try {
      const response = await import("../../utils/api").then((m) => m.default);
      const res = await response.get(`/ml-schedule?date=${date}&limit=1`);
      const schedules = res.data.data || [];
      if (schedules.length > 0) {
        useMLScheduleStore.setState({ currentSchedule: schedules[0], schedules });
      } else {
        // No schedule for today — clear current so we don't show stale data
        useMLScheduleStore.setState({ currentSchedule: null, schedules: [] });
      }
    } catch {
      useMLScheduleStore.setState({ currentSchedule: null, schedules: [] });
    }
  };

  const handleGenerate = async () => {
    clearError();
    const result = await generateSchedule(selectedDate);
    if (result) {
      const today = new Date().toISOString().split("T")[0];
      if (selectedDate === today) {
        // Generated for today — show as main schedule
        setPreviewSchedule(null);
      } else {
        // Generated for future date — show as preview
        setPreviewSchedule(result);
        // Restore today's schedule as main
        loadTodaySchedule(today);
      }
    }
  };

  const handleConfirm = async () => {
    if (!currentSchedule?._id) return;
    await confirmSchedule(currentSchedule._id);
  };

  const isOnline = mlHealth?.status === "ok";

  // The schedule to display in main view (today's)
  const displaySchedule = currentSchedule;
  const s = displaySchedule?.summary;

  // Separate dispatched and skipped areas
  const dispatchedAreas = displaySchedule?.districts?.filter(d => d.action === "dispatch") || [];
  const skippedAreas = displaySchedule?.districts?.filter(d => d.action === "skip") || [];
  const reducedAreas = displaySchedule?.districts?.filter(d => d.action === "reduced") || [];

  // Preview schedule areas (for future date generation)
  const previewDispatched = previewSchedule?.districts?.filter(d => d.action === "dispatch") || [];
  const previewSkipped = previewSchedule?.districts?.filter(d => d.action === "skip") || [];
  const previewReduced = previewSchedule?.districts?.filter(d => d.action === "reduced") || [];
  const ps = previewSchedule?.summary;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">
            ML Schedule
          </h1>
          <p className="text-sm text-primary/60 mt-0.5">
            AI-powered waste collection scheduling
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
            isOnline
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-red-50 border border-red-200 text-red-600"
          }`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-400"}`} />
            {isOnline ? "ML Online" : "ML Offline"}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={clearError} className="text-xs text-red-500 hover:text-red-700 underline ml-3">
            Dismiss
          </button>
        </div>
      )}

      {/* ====== TODAY'S SCHEDULE (Main View) ====== */}
      {displaySchedule && (
        <>
          {/* Schedule Header + Key Stats */}
          <div className="bg-white rounded-2xl border border-primary/10 p-5">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h2 className="text-lg font-bold text-primary">
                {displaySchedule.dayName}, {new Date(displaySchedule.date).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric"
                })}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                displaySchedule.status === "draft" ? "bg-gray-100 text-gray-700" :
                displaySchedule.status === "confirmed" ? "bg-emerald-100 text-emerald-700" :
                displaySchedule.status === "completed" ? "bg-blue-100 text-blue-700" :
                "bg-red-100 text-red-700"
              }`}>
                {displaySchedule.status}
              </span>
              {displaySchedule.status === "draft" && (
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="ml-auto px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition"
                >
                  Confirm & Dispatch
                </button>
              )}
            </div>

            {/* Simple 4-stat row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-primary/4 p-3 text-center">
                <p className="text-2xl font-bold text-primary">
                  {displaySchedule.totalPredictedWasteKg?.toLocaleString()} <span className="text-xs font-normal text-primary/50">kg</span>
                </p>
                <p className="text-[11px] text-primary/50 font-medium mt-0.5">Total Predicted Waste</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{s?.dispatched || 0}</p>
                <p className="text-[11px] text-emerald-600/70 font-medium mt-0.5">Areas Covered</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">
                  {s?.totalTrucksAssigned || 0} <span className="text-xs font-normal text-blue-500">/ {(s?.totalTrucksAvailable || 0) + (s?.driverlessTrucks || 0)}</span>
                </p>
                <p className="text-[11px] text-blue-600/70 font-medium mt-0.5">Trucks Used</p>
              </div>
              <div className="rounded-xl bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{s?.skipped || 0}</p>
                <p className="text-[11px] text-red-500/70 font-medium mt-0.5">Areas Skipped</p>
              </div>
            </div>
          </div>

          {/* Resource Warning */}
          {(s?.driverlessTrucks > 0 || s?.skipped > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">Resource Alert</p>
              <div className="text-xs text-amber-700 space-y-1">
                {s?.driverlessTrucks > 0 && (
                  <p>
                    <span className="font-bold">{s.driverlessTrucks} truck(s)</span> have no driver assigned and were excluded.
                    You have {(s?.totalTrucksAvailable || 0) + (s?.driverlessTrucks || 0)} trucks total but only {s?.totalTrucksAvailable || 0} have drivers.
                  </p>
                )}
                {s?.skipped > 0 && (
                  <p>
                    <span className="font-bold">{s.skipped} area(s)</span> couldn't be covered due to insufficient trucks/drivers.
                    Assign more drivers to trucks, then use the Re-dispatch button on skipped areas.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Dispatched Areas */}
          {dispatchedAreas.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Dispatched ({dispatchedAreas.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dispatchedAreas.map((district) => (
                  <DistrictPredictionCard
                    key={district.district}
                    district={district}
                    scheduleId={displaySchedule._id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Reduced Areas */}
          {reducedAreas.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Reduced Coverage ({reducedAreas.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reducedAreas.map((district) => (
                  <DistrictPredictionCard
                    key={district.district}
                    district={district}
                    scheduleId={displaySchedule._id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Skipped Areas */}
          {skippedAreas.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Skipped - No Coverage ({skippedAreas.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {skippedAreas.map((district) => (
                  <DistrictPredictionCard
                    key={district.district}
                    district={district}
                    scheduleId={displaySchedule._id}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* No schedule loaded */}
      {!displaySchedule && !loading && schedules.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-sm text-emerald-700">
            <span className="font-semibold">Latest schedule:</span>{" "}
            {new Date(schedules[0].date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            {" — "}
            {schedules[0].districts?.length || 0} areas, {schedules[0].totalPredictedWasteKg?.toLocaleString() || 0} kg predicted
          </p>
        </div>
      )}

      {/* Empty State */}
      {!displaySchedule && !loading && schedules.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-primary/10">
          <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-primary/70 mb-1">No Schedule Yet</h3>
          <p className="text-sm text-primary/50 max-w-sm mx-auto">
            Generate a schedule to get AI-powered waste predictions and truck assignments.
          </p>
        </div>
      )}

      {/* ====== SCHEDULE GENERATOR (Collapsible Section) ====== */}
      {isSuperAdmin && (
        <div className="bg-white rounded-2xl border border-primary/10 overflow-hidden">
          <button
            onClick={() => setShowGenerator(!showGenerator)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition"
          >
            <div>
              <h3 className="text-sm font-bold text-primary">Schedule Generator</h3>
              <p className="text-xs text-primary/50 mt-0.5">
                Generate or regenerate schedules for any date
              </p>
            </div>
            <svg
              className={`w-5 h-5 text-primary/40 transition-transform ${showGenerator ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showGenerator && (
            <div className="px-5 pb-5 border-t border-primary/5 pt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                <div>
                  <label className="block text-xs font-semibold text-primary/60 uppercase tracking-wider mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-primary/15 text-sm focus:outline-none focus:ring-2 focus:ring-black/30 text-primary"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleGenerate}
                    disabled={loading || !isOnline}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
                  >
                    {loading && (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {loading ? "Generating..." : "Generate Schedule"}
                  </button>

                  {currentSchedule && (
                    <button
                      onClick={() => {
                        clearCurrentSchedule();
                        setPreviewSchedule(null);
                      }}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium text-primary/50 border border-primary/10 hover:bg-gray-50 transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {!isOnline && (
                <p className="mt-3 text-sm text-red-600">
                  Start ML service: <code className="bg-red-50 px-1.5 py-0.5 rounded text-xs">cd ml && python main.py</code>
                </p>
              )}

              {/* Preview Schedule (for future dates) */}
              {previewSchedule && (
                <div className="mt-5 pt-4 border-t border-primary/10">
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-sm font-bold text-primary">
                      Preview: {previewSchedule.dayName}, {new Date(previewSchedule.date).toLocaleDateString("en-US", {
                        year: "numeric", month: "long", day: "numeric"
                      })}
                    </h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      previewSchedule.status === "draft" ? "bg-gray-100 text-gray-700" :
                      "bg-emerald-100 text-emerald-700"
                    }`}>
                      {previewSchedule.status}
                    </span>
                    {previewSchedule.status === "draft" && (
                      <button
                        onClick={async () => {
                          await confirmSchedule(previewSchedule._id);
                          setPreviewSchedule(null);
                        }}
                        disabled={loading}
                        className="ml-auto px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition"
                      >
                        Confirm
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="rounded-lg bg-primary/4 p-2">
                      <p className="text-lg font-bold text-primary">{previewSchedule.totalPredictedWasteKg?.toLocaleString()} <span className="text-[10px] font-normal text-primary/50">kg</span></p>
                      <p className="text-[10px] text-primary/50">Predicted Waste</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-2">
                      <p className="text-lg font-bold text-emerald-700">{ps?.dispatched || 0}</p>
                      <p className="text-[10px] text-emerald-600/70">Areas Covered</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-2">
                      <p className="text-lg font-bold text-blue-700">{ps?.totalTrucksAssigned || 0}</p>
                      <p className="text-[10px] text-blue-600/70">Trucks Used</p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-2">
                      <p className="text-lg font-bold text-red-600">{ps?.skipped || 0}</p>
                      <p className="text-[10px] text-red-500/70">Skipped</p>
                    </div>
                  </div>

                  {/* Preview area cards */}
                  {previewDispatched.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-primary/60 mb-2">Dispatched ({previewDispatched.length})</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {previewDispatched.map((d) => (
                          <div key={d.district} className="rounded-xl border border-primary/10 p-3 text-xs">
                            <div className="flex justify-between">
                              <span className="font-semibold text-primary">{d.district}</span>
                              <span className="text-primary/50">{d.predictedWasteKg?.toLocaleString()} kg</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {previewSkipped.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-red-600/70 mb-2">Skipped ({previewSkipped.length})</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {previewSkipped.map((d) => (
                          <div key={d.district} className="rounded-xl border border-red-200 bg-red-50/50 p-3 text-xs">
                            <span className="font-semibold text-red-700">{d.district}</span>
                            <span className="text-red-500 ml-2">{d.predictedWasteKg?.toLocaleString()} kg</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setPreviewSchedule(null)}
                    className="mt-3 text-xs text-primary/40 hover:text-primary/60 underline"
                  >
                    Close preview
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MLScheduleDashboard;
