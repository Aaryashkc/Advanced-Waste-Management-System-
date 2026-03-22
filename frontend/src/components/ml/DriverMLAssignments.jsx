import React, { useEffect, useState } from "react";
import useMLScheduleStore from "../../stores/useMLScheduleStore";

const WASTE_COLORS = {
  low: { bg: "bg-emerald-100", text: "text-emerald-700" },
  medium: { bg: "bg-amber-100", text: "text-amber-700" },
  high: { bg: "bg-orange-100", text: "text-orange-700" },
  critical: { bg: "bg-red-100", text: "text-red-700" },
  none: { bg: "bg-gray-100", text: "text-gray-600" },
};

const DriverMLAssignments = () => {
  const {
    driverScheduleData,
    loading,
    error,
    fetchDriverAssignments,
  } = useMLScheduleStore();

  const [activeDay, setActiveDay] = useState("today");

  useEffect(() => {
    fetchDriverAssignments();
  }, []);

  const todayData = driverScheduleData?.today;
  const tomorrowData = driverScheduleData?.tomorrow;
  const currentData = activeDay === "today" ? todayData : tomorrowData;
  const assignments = currentData?.assignments || [];

  const todayCount = todayData?.assignments?.length || 0;
  const tomorrowCount = tomorrowData?.assignments?.length || 0;

  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowLabel = tomorrowDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-5">
        <h1 className="text-xl font-bold text-[var(--primary)]">
          Scheduling (Daily)
        </h1>
        <p className="text-sm text-[var(--primary)]/60 mt-0.5">
          Your assigned waste collection areas
        </p>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Day Toggle */}
        <div className="flex gap-1 bg-white rounded-2xl border border-[var(--primary)]/10 p-1.5">
          <button
            onClick={() => setActiveDay("today")}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
              activeDay === "today"
                ? "bg-[var(--accent)] text-[var(--primary)] shadow-sm"
                : "text-[var(--primary)]/50 hover:text-[var(--primary)]/70"
            }`}
          >
            <span className="block text-xs font-normal opacity-70">Today</span>
            <span>{todayLabel}</span>
            {todayCount > 0 && (
              <span className={`ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                activeDay === "today" ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "bg-[var(--primary)]/10 text-[var(--primary)]/60"
              }`}>
                {todayCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveDay("tomorrow")}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
              activeDay === "tomorrow"
                ? "bg-[var(--accent)] text-[var(--primary)] shadow-sm"
                : "text-[var(--primary)]/50 hover:text-[var(--primary)]/70"
            }`}
          >
            <span className="block text-xs font-normal opacity-70">Tomorrow</span>
            <span>{tomorrowLabel}</span>
            {tomorrowCount > 0 && (
              <span className={`ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                activeDay === "tomorrow" ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "bg-[var(--primary)]/10 text-[var(--primary)]/60"
              }`}>
                {tomorrowCount}
              </span>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-[var(--primary)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
            <p className="text-sm text-[var(--primary)]/50 mt-3">Loading schedule...</p>
          </div>
        )}

        {/* Schedule Info Bar */}
        {!loading && currentData && (
          <div className={`rounded-xl p-4 border ${
            currentData.status === "confirmed"
              ? "bg-emerald-50 border-emerald-200"
              : currentData.status === "draft"
              ? "bg-amber-50 border-amber-200"
              : "bg-blue-50 border-blue-200"
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-semibold ${
                  currentData.status === "confirmed" ? "text-emerald-700" :
                  currentData.status === "draft" ? "text-amber-700" : "text-blue-700"
                }`}>
                  {currentData.dayName}'s Schedule
                </p>
                <p className={`text-xs mt-0.5 ${
                  currentData.status === "confirmed" ? "text-emerald-600/70" :
                  currentData.status === "draft" ? "text-amber-600/70" : "text-blue-600/70"
                }`}>
                  {assignments.length} area{assignments.length !== 1 ? "s" : ""} assigned to you
                  {currentData.totalPredictedWasteKg && (
                    <> &middot; {currentData.totalPredictedWasteKg.toLocaleString()} kg total city waste</>
                  )}
                </p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                currentData.status === "confirmed" ? "bg-emerald-200 text-emerald-800" :
                currentData.status === "draft" ? "bg-amber-200 text-amber-800" :
                "bg-blue-200 text-blue-800"
              }`}>
                {currentData.status}
              </span>
            </div>
          </div>
        )}

        {/* Assignment Cards */}
        {!loading && assignments.length > 0 && (
          <div className="space-y-4">
            {assignments.map((a, idx) => {
              const waste = WASTE_COLORS[a.wasteCategory] || WASTE_COLORS.none;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-[var(--primary)]/10 overflow-hidden shadow-sm"
                >
                  {/* Card Header - District */}
                  <div className="px-5 pt-5 pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📍</span>
                          <h3 className="text-lg font-bold text-[var(--primary)]">
                            {a.district}
                          </h3>
                        </div>
                        <p className="text-xs text-[var(--primary)]/40 mt-0.5 ml-7 capitalize">
                          {a.districtType} area{a.orgName ? ` · ${a.orgName}` : ""}
                        </p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${waste.bg} ${waste.text}`}>
                        {a.wasteCategory}
                      </span>
                    </div>

                    {/* Holiday */}
                    {a.isHoliday && (
                      <div className="mt-2 ml-7 px-2.5 py-1 rounded-lg bg-red-50 border border-red-100 inline-block">
                        <p className="text-xs text-red-600 font-medium">
                          Holiday: {a.holidayName || "Holiday"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Waste + Truck Info */}
                  <div className="px-5 pb-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[var(--primary)]/[0.03] p-3">
                      <p className="text-[10px] text-[var(--primary)]/50 uppercase tracking-wider font-medium mb-1">
                        Expected Waste
                      </p>
                      <p className="text-xl font-bold text-[var(--primary)]">
                        {a.predictedWasteKg?.toLocaleString()}
                        <span className="text-xs font-normal text-[var(--primary)]/40 ml-1">kg</span>
                      </p>
                    </div>
                    {a.truck && (
                      <div className="rounded-xl bg-blue-50 p-3">
                        <p className="text-[10px] text-blue-600/70 uppercase tracking-wider font-medium mb-1">
                          Your Truck
                        </p>
                        <p className="text-sm font-bold text-blue-700">
                          {a.truck.licensePlate}
                        </p>
                        <p className="text-[10px] text-blue-600/60 mt-0.5">
                          {a.truck.capacity}kg capacity
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Recommendation */}
                  {a.recommendation && (
                    <div className="px-5 pb-4">
                      <p className="text-xs text-[var(--primary)]/50 leading-relaxed">
                        {a.recommendation}
                      </p>
                    </div>
                  )}

                  {/* Status bar */}
                  <div className={`px-5 py-2.5 text-xs font-medium ${
                    a.action === "dispatch"
                      ? "bg-emerald-50 text-emerald-700 border-t border-emerald-100"
                      : a.action === "reduced"
                      ? "bg-amber-50 text-amber-700 border-t border-amber-100"
                      : "bg-gray-50 text-gray-600 border-t border-gray-100"
                  }`}>
                    {a.action === "dispatch" ? "Dispatched - You are assigned to this area" :
                     a.action === "reduced" ? "Reduced coverage - Limited trucks for this area" :
                     "Pending assignment"}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && assignments.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-[var(--primary)]/10">
            <div className="w-16 h-16 rounded-2xl bg-[var(--primary)]/5 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[var(--primary)]/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-[var(--primary)]/70 mb-1">
              {!currentData
                ? `No schedule for ${activeDay === "today" ? "today" : "tomorrow"} yet`
                : "You're not assigned to any areas"
              }
            </h3>
            <p className="text-sm text-[var(--primary)]/40 max-w-xs mx-auto">
              {!currentData
                ? "The admin hasn't generated a schedule yet. Check back later."
                : "No areas have been assigned to you for this day. Contact your admin if this seems wrong."
              }
            </p>
          </div>
        )}

        {/* Refresh */}
        <div className="text-center pt-2">
          <button
            onClick={fetchDriverAssignments}
            disabled={loading}
            className="px-5 py-2 rounded-xl text-sm font-medium text-[var(--primary)]/60 border border-[var(--primary)]/10 hover:bg-white disabled:opacity-40 transition"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriverMLAssignments;
