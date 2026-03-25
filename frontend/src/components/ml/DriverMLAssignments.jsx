import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, MapPin, Weight, Truck, Calendar, RefreshCw,
  CheckCircle, Clock, AlertTriangle, Loader2, Route,
} from "lucide-react";
import useMLScheduleStore from "../../stores/useMLScheduleStore";

const WASTE_COLORS = {
  low:      { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  medium:   { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500" },
  high:     { bg: "bg-orange-50",   text: "text-orange-700",  border: "border-orange-200",   dot: "bg-orange-500" },
  critical: { bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200",      dot: "bg-red-500" },
  none:     { bg: "bg-gray-50",     text: "text-gray-600",    border: "border-gray-200",     dot: "bg-gray-400" },
};

const STATUS_CONFIG = {
  confirmed: { bg: "bg-emerald-500", text: "text-white", Icon: CheckCircle, label: "Confirmed" },
  draft:     { bg: "bg-amber-500",   text: "text-white", Icon: Clock,       label: "Draft" },
  pending:   { bg: "bg-blue-500",    text: "text-white", Icon: Clock,       label: "Pending" },
};

const DriverMLAssignments = () => {
  const navigate = useNavigate();
  const { driverScheduleData, loading, error, fetchDriverAssignments } = useMLScheduleStore();
  const [activeDay, setActiveDay] = useState("today");

  useEffect(() => { fetchDriverAssignments(); }, []);

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

  const statusCfg = STATUS_CONFIG[currentData?.status] || STATUS_CONFIG.pending;

  return (
    <div className="min-h-screen bg-[#f5f3ee] pb-24">
      <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#354f52] to-[#2d4a4e] px-5 sm:px-8 pt-8 pb-10 sm:rounded-b-3xl">
        <button onClick={() => navigate("/driver-dashboard")} className="flex items-center gap-2 text-white/70 hover:text-white mb-4 transition">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Schedule</h1>
            <p className="text-sm text-white/50 mt-0.5">Your assigned collection areas</p>
          </div>
          <button
            onClick={fetchDriverAssignments}
            disabled={loading}
            className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-white/25 disabled:opacity-40 transition"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="px-5 sm:px-8 -mt-5 space-y-4 max-w-2xl">
        {/* Day Toggle */}
        <div className="flex gap-1 bg-white rounded-2xl shadow-sm border border-primary/8 p-1.5">
          {[
            { key: "today", label: todayLabel, count: todayCount, sub: "Today" },
            { key: "tomorrow", label: tomorrowLabel, count: tomorrowCount, sub: "Tomorrow" },
          ].map((d) => (
            <button
              key={d.key}
              onClick={() => setActiveDay(d.key)}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                activeDay === d.key
                  ? "bg-[#354f52] text-white shadow-md"
                  : "text-primary/50 hover:text-primary/70 hover:bg-primary/5"
              }`}
            >
              <span className="block text-[10px] font-medium opacity-70 uppercase tracking-wider mb-0.5">{d.sub}</span>
              <span className="text-xs">{d.label}</span>
              {d.count > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                  activeDay === d.key ? "bg-white/20 text-white" : "bg-primary/10 text-primary/60"
                }`}>
                  {d.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-sm">
            <Loader2 size={28} className="animate-spin text-primary/40" />
            <p className="text-sm text-primary/50 mt-3">Loading schedule...</p>
          </div>
        )}

        {/* Schedule Status Bar */}
        {!loading && currentData && (
          <div className="bg-white rounded-2xl shadow-sm border border-primary/8 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-primary">
                  {currentData.dayName}'s Schedule
                </p>
                <p className="text-xs text-primary/50 mt-0.5">
                  {assignments.length} area{assignments.length !== 1 ? "s" : ""} assigned
                  {currentData.totalPredictedWasteKg && (
                    <> -- {currentData.totalPredictedWasteKg.toLocaleString()} kg total</>
                  )}
                </p>
              </div>
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusCfg.bg} ${statusCfg.text}`}>
                <statusCfg.Icon size={12} />
                {statusCfg.label}
              </span>
            </div>
          </div>
        )}

        {/* Assignment Cards */}
        {!loading && assignments.length > 0 && (
          <div className="space-y-3">
            {assignments.map((a, idx) => {
              const waste = WASTE_COLORS[a.wasteCategory] || WASTE_COLORS.none;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl shadow-sm border border-primary/8 overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${waste.bg} flex items-center justify-center shrink-0`}>
                          <MapPin size={18} className={waste.text} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-primary">{a.area}</h3>
                          <p className="text-xs text-primary/40 capitalize">
                            {a.areaType} area{a.orgName ? ` -- ${a.orgName}` : ""}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${waste.bg} ${waste.text}`}>
                        {a.wasteCategory}
                      </span>
                    </div>

                    {a.isHoliday && (
                      <div className="mt-3 ml-13 px-3 py-1.5 rounded-lg bg-red-50 border border-red-100 inline-flex items-center gap-1.5">
                        <AlertTriangle size={12} className="text-red-500" />
                        <p className="text-xs text-red-600 font-medium">
                          Holiday: {a.holidayName || "Holiday"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="px-5 pb-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#f5f3ee] p-3.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center">
                        <Weight size={16} className="text-primary/50" />
                      </div>
                      <div>
                        <p className="text-[10px] text-primary/40 uppercase tracking-wider font-medium">Expected</p>
                        <p className="text-base font-bold text-primary">
                          {a.predictedWasteKg?.toLocaleString()}<span className="text-xs font-normal text-primary/40 ml-0.5">kg</span>
                        </p>
                      </div>
                    </div>
                    {a.truck && (
                      <div className="rounded-xl bg-blue-50 p-3.5 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Truck size={16} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-blue-600/60 uppercase tracking-wider font-medium">Truck</p>
                          <p className="text-sm font-bold text-blue-700">{a.truck.licensePlate}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recommendation */}
                  {a.recommendation && (
                    <div className="px-5 pb-3">
                      <p className="text-xs text-primary/45 leading-relaxed">{a.recommendation}</p>
                    </div>
                  )}

                  {/* Status Footer */}
                  <div className={`px-5 py-3 text-xs font-semibold flex items-center gap-2 ${
                    a.action === "dispatch"
                      ? "bg-emerald-50 text-emerald-700 border-t border-emerald-100"
                      : a.action === "reduced"
                      ? "bg-amber-50 text-amber-700 border-t border-amber-100"
                      : "bg-gray-50 text-gray-500 border-t border-gray-100"
                  }`}>
                    {a.action === "dispatch" ? <><Route size={12} /> Dispatched - You are assigned</> :
                     a.action === "reduced" ? <><AlertTriangle size={12} /> Reduced coverage</> :
                     <><Clock size={12} /> Pending assignment</>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && assignments.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-primary/8">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <Calendar size={28} className="text-blue-400" />
            </div>
            <h3 className="text-base font-semibold text-primary/70 mb-1">
              {!currentData
                ? `No schedule for ${activeDay === "today" ? "today" : "tomorrow"} yet`
                : "No areas assigned"
              }
            </h3>
            <p className="text-sm text-primary/40 max-w-xs mx-auto">
              {!currentData
                ? "The admin hasn't generated a schedule yet. Check back later."
                : "No areas have been assigned to you for this day."
              }
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default DriverMLAssignments;
