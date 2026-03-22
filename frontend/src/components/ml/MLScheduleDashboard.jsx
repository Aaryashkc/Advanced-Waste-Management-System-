import React, { useState, useEffect } from "react";
import useMLScheduleStore from "../../stores/useMLScheduleStore";
import useAuthStore from "../../stores/useAuthStore";
import DistrictPredictionCard from "./DistrictPredictionCard";

const STATUS_BADGES = {
  draft: "bg-gray-100 text-gray-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
};

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

  useEffect(() => {
    checkMLHealth();
    // Try to load today's existing schedule
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
        fetchSchedules({ status: "confirmed", limit: 1 });
      }
    } catch {
      fetchSchedules({ status: "confirmed", limit: 1 });
    }
  };

  const handleGenerate = async () => {
    clearError();
    await generateSchedule(selectedDate);
  };

  const handleConfirm = async () => {
    if (!currentSchedule?._id) return;
    await confirmSchedule(currentSchedule._id);
  };

  const isOnline = mlHealth?.status === "ok";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">
            ML Smart Scheduling
          </h1>
          <p className="text-sm text-primary/60 mt-1">
            AI-powered waste collection scheduling for Kathmandu Valley
          </p>
        </div>

        {/* ML Service Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-primary/10 bg-white">
          <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-red-400"}`} />
          <span className="text-sm font-medium text-primary/70">
            ML Service: {isOnline ? "Online" : "Offline"}
          </span>
          {isOnline && mlHealth?.r2_score && (
            <span className="text-xs text-primary/40 ml-1">
              (R² {mlHealth.r2_score})
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-primary/10 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-sm font-semibold text-primary/70 mb-1.5">
              Schedule Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-primary/15 text-sm
                         focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
                         text-primary"
            />
          </div>

          {isSuperAdmin && (
            <button
              onClick={handleGenerate}
              disabled={loading || !isOnline}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white
                         bg-primary hover:bg-accent/90
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </span>
              ) : (
                currentSchedule && currentSchedule.date?.startsWith(selectedDate)
                  ? "Regenerate Schedule"
                  : "Generate Schedule"
              )}
            </button>
          )}

          {currentSchedule?.status === "draft" && (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white
                         bg-green-600 hover:bg-green-700
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all"
            >
              Confirm & Dispatch
            </button>
          )}

          {currentSchedule && (
            <button
              onClick={clearCurrentSchedule}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-primary/60
                         border border-primary/10 hover:bg-gray-50 transition-all"
            >
              Clear
            </button>
          )}
        </div>

        {!isOnline && (
          <p className="mt-3 text-sm text-red-600">
            ML service is offline. Start it with: <code className="bg-red-50 px-1.5 py-0.5 rounded text-xs">cd ml && python main.py</code>
          </p>
        )}
      </div>

      {/* Auto-generation Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
        <span className="text-blue-600">ℹ️</span>
        <p className="text-sm text-blue-700">
          Schedules are auto-generated daily at 12:00 AM (midnight) for the current day.
          You can also manually generate or regenerate using the button above.
        </p>
      </div>

      {/* Today's Auto-Generated Schedule */}
      {!currentSchedule && schedules.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-green-600">✅</span>
            <p className="text-sm font-semibold text-green-700">
              Latest confirmed schedule: {new Date(schedules[0].date).toLocaleDateString("en-NP", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <p className="text-xs text-green-600/70 ml-6">
            {schedules[0].districts?.length || 0} districts, {schedules[0].totalPredictedWasteKg?.toLocaleString() || 0} kg total predicted waste
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={clearError}
            className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Schedule Result */}
      {currentSchedule && (
        <>
          {/* Summary Bar */}
          <div className="bg-white rounded-2xl border border-primary/10 p-5">
            <div className="flex flex-wrap items-center gap-4 mb-3">
              <h2 className="text-lg font-bold text-primary">
                Schedule: {currentSchedule.dayName}, {new Date(currentSchedule.date).toLocaleDateString("en-NP", {
                  year: "numeric", month: "long", day: "numeric"
                })}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGES[currentSchedule.status]}`}>
                {currentSchedule.status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              <div className="text-center p-3 rounded-xl bg-gray-50">
                <p className="text-xl font-bold text-primary">
                  {currentSchedule.totalPredictedWasteKg?.toLocaleString()}
                </p>
                <p className="text-xs text-primary/50 mt-0.5">Total Waste (kg)</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-green-50">
                <p className="text-xl font-bold text-green-700">
                  {currentSchedule.summary?.dispatched || 0}
                </p>
                <p className="text-xs text-green-600/70 mt-0.5">Dispatched</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-gray-50">
                <p className="text-xl font-bold text-gray-500">
                  {currentSchedule.summary?.skipped || 0}
                </p>
                <p className="text-xs text-gray-500/70 mt-0.5">Skipped</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-amber-50">
                <p className="text-xl font-bold text-amber-700">
                  {currentSchedule.summary?.reduced || 0}
                </p>
                <p className="text-xs text-amber-600/70 mt-0.5">Reduced</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-blue-50">
                <p className="text-xl font-bold text-blue-700">
                  {currentSchedule.summary?.totalTrucksAssigned || 0}
                </p>
                <p className="text-xs text-blue-600/70 mt-0.5">Trucks Assigned</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-purple-50">
                <p className="text-xl font-bold text-purple-700">
                  {currentSchedule.summary?.totalTrucksAvailable || 0}
                </p>
                <p className="text-xs text-purple-600/70 mt-0.5">Trucks Available</p>
              </div>
              {currentSchedule.summary?.driverlessTrucks > 0 && (
                <div className="text-center p-3 rounded-xl bg-red-50">
                  <p className="text-xl font-bold text-red-700">
                    {currentSchedule.summary.driverlessTrucks}
                  </p>
                  <p className="text-xs text-red-600/70 mt-0.5">No Driver</p>
                </div>
              )}
            </div>
          </div>

          {/* Driverless Trucks Alert */}
          {currentSchedule.summary?.driverlessTrucks > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <span className="text-xl">🚨</span>
                <div>
                  <p className="text-sm font-bold text-red-700">
                    {currentSchedule.summary.driverlessTrucks} Truck(s) Without Drivers
                  </p>
                  <p className="text-xs text-red-600/80 mt-1">
                    These trucks were excluded from scheduling because they have no assigned driver.
                    Go to Drivers page to assign drivers, then use the Re-dispatch button on skipped districts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Skipped Districts Warning */}
          {currentSchedule.summary?.skipped > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="text-sm font-bold text-amber-700">
                    {currentSchedule.summary.skipped} District(s) Skipped
                  </p>
                  <p className="text-xs text-amber-600/80 mt-1">
                    Some districts were skipped due to insufficient trucks or drivers.
                    Assign drivers to trucks and use the Re-dispatch button below to send trucks to these areas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* District Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentSchedule.districts?.map((district) => (
              <DistrictPredictionCard
                key={district.district}
                district={district}
                scheduleId={currentSchedule._id}
              />
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {!currentSchedule && !loading && (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🤖</p>
          <h3 className="text-lg font-semibold text-primary/70 mb-2">
            No Schedule Generated
          </h3>
          <p className="text-sm text-primary/50 max-w-md mx-auto">
            Select a date and click "Generate Schedule" to get AI-powered waste predictions
            and truck assignments for all 10 Kathmandu Valley districts.
          </p>
        </div>
      )}
    </div>
  );
};

export default MLScheduleDashboard;
