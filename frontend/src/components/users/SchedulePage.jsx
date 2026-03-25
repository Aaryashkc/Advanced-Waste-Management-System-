import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useMLScheduleStore from "../../stores/useMLScheduleStore";

const CATEGORY_STYLES = {
  none: { bg: "bg-gray-100", text: "text-gray-600", label: "None" },
  low: { bg: "bg-green-100", text: "text-green-700", label: "Low" },
  medium: { bg: "bg-amber-100", text: "text-amber-700", label: "Medium" },
  high: { bg: "bg-orange-100", text: "text-orange-700", label: "High" },
  critical: { bg: "bg-red-100", text: "text-red-700", label: "Critical" },
};

const ACTION_STYLES = {
  dispatch: { bg: "bg-green-50", text: "text-green-700", icon: "🚛", label: "Dispatch" },
  skip: { bg: "bg-gray-50", text: "text-gray-500", icon: "⏭️", label: "Skip" },
  reduced: { bg: "bg-amber-50", text: "text-amber-700", icon: "📉", label: "Reduced" },
};

const TYPE_BADGES = {
  commercial: "bg-blue-100 text-blue-700",
  residential: "bg-purple-100 text-purple-700",
  suburban: "bg-teal-100 text-teal-700",
  rural: "bg-emerald-100 text-emerald-700",
};

function AreaCard({ area }) {
  const category = CATEGORY_STYLES[area.wasteCategory] || CATEGORY_STYLES.none;
  const action = ACTION_STYLES[area.action] || ACTION_STYLES.skip;
  const typeBadge = TYPE_BADGES[area.areaType] || "bg-gray-100 text-gray-700";

  return (
    <div className={`bg-white rounded-xl shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] hover:shadow-md transition-shadow duration-300 p-5 border border-[#354f52]/10 ${
      area.action === "skip" ? "opacity-60" : ""
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-[#354f52] font-['Outfit',sans-serif] text-base">
            {area.area}
          </h3>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${typeBadge}`}>
            {area.areaType}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${action.bg} ${action.text}`}>
          <span>{action.icon}</span>
          <span>{action.label}</span>
        </div>
      </div>

      {/* Predicted Waste */}
      <div className="mb-3">
        <p className="text-2xl font-bold text-[#354f52]">
          {area.predictedWasteKg?.toLocaleString()} <span className="text-sm font-normal text-[#354f52]/60">kg</span>
        </p>
        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${category.bg} ${category.text}`}>
          {category.label}
        </span>
      </div>

      {/* Assigned Trucks */}
      {area.assignedTrucks && area.assignedTrucks.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-[#354f52]/50 mb-1.5">
            Assigned Trucks
          </p>
          <div className="space-y-1.5">
            {area.assignedTrucks.map((truck, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs bg-[#f5f1e8] rounded-lg px-2.5 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🚛</span>
                  <span className="font-medium text-[#354f52]">{truck.licensePlate || truck.truckId}</span>
                </div>
                <div className="text-right">
                  <span className="text-[#354f52]/70">{truck.driverName}</span>
                  <span className="text-[#354f52]/40 ml-1.5">{truck.capacity}kg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      {area.recommendation && (
        <p className="text-xs text-[#354f52]/60 font-['Poppins',sans-serif] leading-relaxed">
          {area.recommendation}
        </p>
      )}
    </div>
  );
}

function SchedulePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const { publicSchedule, loading, error, fetchPublicSchedule } = useMLScheduleStore();

  useEffect(() => {
    fetchPublicSchedule();
  }, [fetchPublicSchedule]);

  const schedule = publicSchedule;

  const filteredAreas = useMemo(() => {
    if (!schedule?.areas) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return schedule.areas;
    return schedule.areas.filter(
      (d) =>
        d.area?.toLowerCase().includes(q) ||
        d.areaType?.toLowerCase().includes(q)
    );
  }, [schedule, searchQuery]);

  // Group areas by type (commercial, residential, suburban, rural)
  const groupedAreas = useMemo(() => {
    const groups = {};
    filteredAreas.forEach((d) => {
      const type = d.areaType || "Other";
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      if (!groups[label]) groups[label] = [];
      groups[label].push(d);
    });
    return groups;
  }, [filteredAreas]);

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalWaste = schedule?.totalPredictedWasteKg || 0;
  const dispatchedCount = schedule?.areas?.filter(d => d.action === "dispatch").length || 0;

  const handleBack = () => navigate("/customer-dashboard");

  if (loading) {
    return (
      <div className="bg-[#f5f1e8] min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#354f52]/20 border-t-[#354f52] rounded-full animate-spin" />
          <p className="text-[#354f52] font-['Poppins',sans-serif]">Loading collection schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#f5f1e8] min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 text-xl font-['Poppins',sans-serif]">{error}</p>
        <button onClick={fetchPublicSchedule} className="px-4 py-2 bg-[#354f52] text-white rounded-lg font-['Inter',sans-serif]">Retry</button>
      </div>
    );
  }

  return (
    <div className="bg-[#f5f1e8] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {/* Back Button */}
        <button
          onClick={handleBack}
          className="bg-[#354f52] w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center hover:bg-[#2a3f41] transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:ring-offset-2 active:scale-95 transform mb-8 sm:mb-10"
          aria-label="Go back"
        >
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="#f5f1e8" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        {/* Page Title */}
        <h2 className="font-['Outfit',sans-serif] font-bold text-3xl sm:text-4xl lg:text-5xl text-[#354f52] text-center mb-3">
          Today's Waste Collection
        </h2>
        <p className="text-center text-[#354f52]/70 font-['Poppins',sans-serif] text-base sm:text-lg mb-1">
          {todayStr}
        </p>
        {schedule?.createdAt && (
          <p className="text-center text-[#354f52]/40 font-['Poppins',sans-serif] text-xs mb-8 sm:mb-10">
            Last updated: {new Date(schedule.createdAt).toLocaleString("en-US", {
              hour: "numeric", minute: "2-digit", hour12: true,
              month: "short", day: "numeric", year: "numeric"
            })}
          </p>
        )}
        {!schedule?.createdAt && <div className="mb-8 sm:mb-10" />}

        {!schedule ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="text-6xl">📅</div>
            <h3 className="font-['Outfit',sans-serif] font-bold text-xl text-[#354f52]">No Schedule Available</h3>
            <p className="text-[#354f52]/60 font-['Poppins',sans-serif] text-sm max-w-md text-center">
              No schedule generated for today yet. Check back later!
            </p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="max-w-3xl mx-auto mb-8 sm:mb-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-[#354f52]/10 p-5 text-center">
                  <p className="text-3xl font-bold text-[#354f52]">{totalWaste.toLocaleString()}</p>
                  <p className="text-xs text-[#354f52]/50 mt-1 font-['Poppins',sans-serif] uppercase tracking-wider">Total Predicted Waste (kg)</p>
                </div>
                <div className="bg-white rounded-xl border border-[#354f52]/10 p-5 text-center">
                  <p className="text-3xl font-bold text-[#296200]">{dispatchedCount}</p>
                  <p className="text-xs text-[#354f52]/50 mt-1 font-['Poppins',sans-serif] uppercase tracking-wider">Areas Dispatched</p>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="max-w-3xl mx-auto mb-8 sm:mb-10">
              <div className="flex gap-0 shadow-lg rounded-full overflow-hidden">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by area name or type..."
                  className="flex-1 px-6 sm:px-8 py-4 sm:py-5 bg-[#84a98c] text-white placeholder:text-white/80 font-['Poppins',sans-serif] text-base sm:text-lg focus:outline-none"
                />
                <div className="bg-[#354f52] px-6 sm:px-10 py-4 sm:py-5 flex items-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {searchQuery && filteredAreas.length === 0 && (
                <p className="text-center text-[#354f52] font-['Poppins',sans-serif] text-sm mt-3">
                  No areas match your search. Try a different name.
                </p>
              )}
            </div>

            {/* Collection Areas */}
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-['Poppins',sans-serif] font-semibold text-xl sm:text-2xl text-[#354f52]">
                  Collection Areas
                </h3>
                <span className="text-sm text-[#354f52]/60 font-['Poppins',sans-serif]">
                  {filteredAreas.length} area{filteredAreas.length !== 1 ? "s" : ""}
                </span>
              </div>

              {filteredAreas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="text-6xl">📍</div>
                  <p className="text-[#354f52] font-['Poppins',sans-serif] text-lg font-medium">No areas found</p>
                  <p className="text-[#354f52]/60 text-sm">Try searching for a different area</p>
                </div>
              ) : (
                <div className="space-y-10">
                  {Object.entries(groupedAreas).map(([type, typeAreas]) => (
                    <div key={type}>
                      {/* Type heading */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-px flex-1 bg-[#354f52]/10" />
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#354f52]/10">
                          <span className="text-xs font-bold text-[#354f52] uppercase tracking-wider">{type}</span>
                          <span className="text-xs text-[#354f52]/50">{typeAreas.length} area{typeAreas.length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="h-px flex-1 bg-[#354f52]/10" />
                      </div>

                      {/* Area cards grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {typeAreas.map((areaItem) => (
                          <AreaCard key={areaItem.area} area={areaItem} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default SchedulePage;
