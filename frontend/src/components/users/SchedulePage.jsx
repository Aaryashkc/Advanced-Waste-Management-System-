import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useScheduleStore from "../../stores/useScheduleStore";

const DAY_COLORS = {
  Monday:    { strip: '#3b82f6', badge: 'bg-blue-100 text-blue-700',    icon: '🟦' },
  Tuesday:   { strip: '#a855f7', badge: 'bg-purple-100 text-purple-700', icon: '🟣' },
  Wednesday: { strip: '#22c55e', badge: 'bg-green-100 text-green-700',   icon: '🟩' },
  Thursday:  { strip: '#f59e0b', badge: 'bg-amber-100 text-amber-700',   icon: '🟨' },
  Friday:    { strip: '#ef4444', badge: 'bg-red-100 text-red-700',       icon: '🟥' },
  Saturday:  { strip: '#14b8a6', badge: 'bg-teal-100 text-teal-700',    icon: '🩵' },
  Sunday:    { strip: '#f97316', badge: 'bg-orange-100 text-orange-700', icon: '🟧' },
};

const TRUCK_TYPE_ICON = {
  'light duty': '🚐',
  'medium duty': '🚛',
  'heavy duty': '🏗️',
};

function ZoneCard({ schedule }) {
  const dayStyle = DAY_COLORS[schedule.day] || DAY_COLORS.Monday;

  return (
    <div
      className="bg-white rounded-xl shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] hover:shadow-md transition-shadow duration-300 flex flex-col sm:flex-row sm:items-center py-3 px-4 sm:px-6 gap-4 border border-[var(--primary)]/10"
      style={{ borderLeft: `6px solid ${dayStyle.strip}` }}
    >
      {/* Time & Day - fixed width for consistent alignment */}
      <div className="shrink-0 flex items-center sm:flex-col sm:items-start gap-3 sm:gap-1 sm:w-32">
        <div className="flex items-center gap-1.5 bg-[#f5f1e8] px-3 py-1.5 rounded-lg border border-[var(--primary)]/5">
           <svg className="w-4 h-4 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-bold text-[var(--primary)] tracking-tight">{schedule.time}</span>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${dayStyle.badge}`}>
          {dayStyle.icon} {schedule.day}
        </span>
      </div>

      {/* Main Info (Location) */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-1">
           <svg className="w-4 h-4 text-[var(--primary)]/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--primary)]/50">Location</span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-base font-semibold text-[var(--primary)]">{schedule.city}</span>
          <span className="text-[var(--primary)]/40 hidden sm:inline">•</span>
          <span className="text-sm text-[var(--primary)]/80 truncate">{schedule.area}</span>
        </div>
      </div>

      {/* Details (Driver & Vehicle) - Aligned to right */}
      <div className="shrink-0 flex gap-4 sm:gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-[var(--primary)]/5">
        <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--primary)]/50 mb-0.5">Driver</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-[var(--primary)]/70">👤</span>
              <span className="text-sm font-medium text-[var(--primary)] max-w-[100px] truncate">{schedule.driver}</span>
            </div>
        </div>
        <div className="flex flex-col">
           <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--primary)]/50 mb-0.5">Vehicle</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{TRUCK_TYPE_ICON[schedule.truckType] || '🚛'}</span>
               <span className="text-sm font-medium text-[var(--primary)] max-w-[100px] truncate">{schedule.truckName}</span>
            </div>
        </div>
      </div>
    </div>
  );
}

function SchedulePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedDay, setSelectedDay] = useState("all");
  const navigate = useNavigate();
  const pageRef = useRef(null);

  const { schedules, loading, error, fetchAllData } = useScheduleStore();

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (loading) return;
    const container = pageRef.current;
    if (!container) return;
    const revealItems = container.querySelectorAll(".lp-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("lp-in-view");
          else entry.target.classList.remove("lp-in-view");
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -5% 0px" }
    );
    revealItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [loading]);

  const allSchedules = useMemo(
    () => schedules.map((s) => ({ ...s, label: `${s.city} — ${s.area}` })),
    [schedules]
  );

  const uniqueLocations = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const s of allSchedules) {
      const key = `${s.city}||${s.area}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ city: s.city, area: s.area, label: s.label });
      }
    }
    return list;
  }, [allSchedules]);

  const filteredBySearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allSchedules.filter(
      (s) =>
        s.city.toLowerCase().includes(q) ||
        s.area.toLowerCase().includes(q) ||
        s.label.toLowerCase().includes(q)
    );
  }, [searchQuery, allSchedules]);

  const displaySchedules = useMemo(() => {
    let result = allSchedules;
    if (selectedLocation) {
      result = allSchedules.filter(
        (s) => s.city === selectedLocation.city && s.area === selectedLocation.area
      );
    } else if (searchQuery.trim()) {
      result = filteredBySearch;
    } else {
      result = allSchedules;
    }
    if (selectedDay !== "all") {
      result = result.filter((s) => s.day === selectedDay);
    }
    return result;
  }, [selectedLocation, searchQuery, filteredBySearch, allSchedules, selectedDay]);

  // Group zones by city → area
  const groupedZones = useMemo(() => {
    const groups = {};
    displaySchedules.forEach((s) => {
      const key = `${s.city}||${s.area}`;
      if (!groups[key]) groups[key] = { city: s.city, area: s.area, schedules: [] };
      groups[key].schedules.push(s);
    });
    return Object.values(groups);
  }, [displaySchedules]);

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleSearch = () => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const match = uniqueLocations.find(
      (loc) =>
        loc.city.toLowerCase().includes(q) ||
        loc.area.toLowerCase().includes(q) ||
        loc.label.toLowerCase().includes(q)
    );
    if (match) setSelectedLocation(match);
  };

  const handleBack = () => navigate("/customer-dashboard");
  const handleKeyPress = (e) => { if (e.key === "Enter") handleSearch(); };

  if (loading) {
    return (
      <div className="bg-[#f5f1e8] min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#354f52]/20 border-t-[#354f52] rounded-full animate-spin" />
          <p className="text-[#354f52] font-['Poppins',sans-serif]">Loading pickup zones...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#f5f1e8] min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 text-xl font-['Poppins',sans-serif]">{error}</p>
        <button onClick={fetchAllData} className="px-4 py-2 bg-[#354f52] text-white rounded-lg">Retry</button>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="bg-[#f5f1e8] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {/* Back Button */}
        <button
          onClick={handleBack}
          className="lp-reveal lp-in-view lp-delay-0 bg-[#354f52] w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center hover:bg-[#2a3f41] transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:ring-offset-2 active:scale-95 transform mb-8 sm:mb-10"
          aria-label="Go back"
        >
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="#f5f1e8" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        {/* Page Title */}
        <h2 className="lp-reveal lp-in-view lp-delay-1 font-['Outfit',sans-serif] font-bold text-3xl sm:text-4xl lg:text-5xl text-[#354f52] text-center mb-3">
          Pickup Zone Schedule
        </h2>
        <p className="text-center text-[#354f52]/70 font-['Poppins',sans-serif] text-base sm:text-lg mb-8 sm:mb-10">
          Find out when the waste truck comes to your area
        </p>

        {/* Search + Day Filter */}
        <div className="lp-reveal lp-delay-2 max-w-3xl mx-auto mb-8 sm:mb-10 space-y-3">
          <div className="flex gap-0 shadow-lg rounded-full overflow-hidden">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedLocation(null);
              }}
              onKeyPress={handleKeyPress}
              placeholder="Search by city or area (e.g. Kathmandu, Thamel)"
              className="flex-1 px-6 sm:px-8 py-4 sm:py-5 bg-[#84a98c] text-white placeholder:text-white/80 font-['Poppins',sans-serif] text-base sm:text-lg focus:outline-none"
            />
            <button
              onClick={handleSearch}
              className="bg-[#354f52] px-6 sm:px-10 py-4 sm:py-5 font-['Inter',sans-serif] font-medium text-white text-base sm:text-lg hover:bg-[#2a3f41] transition-colors focus:outline-none focus:ring-2 focus:ring-[#354f52] focus:ring-inset flex items-center gap-2"
            >
              Search
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>

          {/* Day filter pills */}
          <div className="flex gap-2 flex-wrap justify-center pt-1">
            <button
              onClick={() => setSelectedDay("all")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedDay === "all" ? "bg-[#354f52] text-white shadow" : "bg-white text-[#354f52] border border-[#354f52]/20 hover:border-[#354f52]/40"}`}
            >
              All Days
            </button>
            {DAYS.map(day => {
              const col = DAY_COLORS[day];
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(selectedDay === day ? "all" : day)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${selectedDay === day ? "text-white shadow border-transparent" : "bg-white border-gray-200 text-[#354f52]/70 hover:border-[#354f52]/30"}`}
                  style={selectedDay === day ? { background: col.strip, borderColor: col.strip } : {}}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>

          {/* No results hint */}
          {searchQuery && filteredBySearch.length === 0 && (
            <p className="text-center text-[#354f52] font-['Poppins',sans-serif] text-sm">
              No zones found. Try: {uniqueLocations.slice(0, 3).map((l) => l.label).join(", ")}
            </p>
          )}
        </div>

        {/* Active location breadcrumb */}
        {selectedLocation && (
          <div className="max-w-5xl mx-auto mb-6 flex items-center gap-2">
            <h3 className="font-['Outfit',sans-serif] font-bold text-2xl sm:text-3xl text-[#354f52]">
              {selectedLocation.city} — {selectedLocation.area}
            </h3>
            <button
              onClick={() => { setSelectedLocation(null); setSearchQuery(""); }}
              className="ml-2 text-sm text-[#354f52]/60 hover:text-[#354f52] underline"
            >
              Clear
            </button>
          </div>
        )}

        {/* ── Zones Section ── */}
        <div className="lp-reveal lp-delay-3 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-['Poppins',sans-serif] font-semibold text-xl sm:text-2xl text-[#354f52]">
              {selectedLocation
                ? `Zones in ${selectedLocation.city}, ${selectedLocation.area}`
                : "Pickup Zones Near You"}
            </h3>
            <span className="text-sm text-[#354f52]/60 font-['Poppins',sans-serif]">
              {displaySchedules.length} zone{displaySchedules.length !== 1 ? "s" : ""}
            </span>
          </div>

          {displaySchedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="text-6xl">📍</div>
              <p className="text-[#354f52] font-['Poppins',sans-serif] text-lg font-medium">No zones found</p>
              <p className="text-[#354f52]/60 text-sm">Try searching for a different area or clearing the day filter</p>
            </div>
          ) : (
            <div className="space-y-10">
              {groupedZones.map(({ city, area, schedules: areaSchedules }) => (
                <div key={`${city}||${area}`}>
                  {/* Area heading */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px flex-1 bg-[#354f52]/10" />
                    <button
                      onClick={() => setSelectedLocation({ city, area, label: `${city} — ${area}` })}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#354f52]/10 hover:bg-[#354f52]/20 transition-colors"
                    >
                      <span className="text-xs font-bold text-[#354f52] uppercase tracking-wider">{city}</span>
                      <span className="text-[#354f52]/50">·</span>
                      <span className="text-xs text-[#354f52]/70">{area}</span>
                    </button>
                    <div className="h-px flex-1 bg-[#354f52]/10" />
                  </div>

                  {/* Zone cards list */}
                  <div className="flex flex-col gap-3">
                    {areaSchedules.map(schedule => (
                      <ZoneCard key={schedule.id} schedule={schedule} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SchedulePage;
