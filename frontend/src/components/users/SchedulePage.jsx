import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useMLScheduleStore from "../../stores/useMLScheduleStore";
import {
  ArrowLeft,
  Search,
  Truck,
  SkipForward,
  TrendingDown,
  MapPin,
  Scale,
  CalendarCheck,
  Clock,
  Building2,
  Home,
  Trees,
  Mountain,
  AlertTriangle,
  Info,
  RefreshCw,
  Route,
  User,
  X,
  Filter,
  Leaf,
  FileWarning,
} from "lucide-react";

/* ── Constants ── */

const ACTION_CONFIG = {
  dispatch: { color: "bg-emerald-600", text: "text-emerald-700", bg: "bg-emerald-50", label: "Dispatch", icon: Truck },
  skip: { color: "bg-gray-400", text: "text-gray-500", bg: "bg-gray-50", label: "Skip", icon: SkipForward },
  reduced: { color: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", label: "Reduced", icon: TrendingDown },
};

const TYPE_CONFIG = {
  commercial: { icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
  residential: { icon: Home, color: "text-violet-600", bg: "bg-violet-50" },
  suburban: { icon: Trees, color: "text-teal-600", bg: "bg-teal-50" },
  rural: { icon: Mountain, color: "text-emerald-600", bg: "bg-emerald-50" },
};

const WASTE_LEVEL = (kg) => {
  if (kg >= 500) return { label: "Critical", dot: "bg-red-500" };
  if (kg >= 300) return { label: "High", dot: "bg-orange-500" };
  if (kg >= 100) return { label: "Medium", dot: "bg-amber-500" };
  return { label: "Low", dot: "bg-emerald-500" };
};

/* ── Extract areas from flexible data shapes ── */

function resolveAreas(schedule, publicSchedule) {
  if (schedule?.areas) return schedule.areas;
  if (schedule?.data?.areas) return schedule.data.areas;
  if (schedule?.districts) return schedule.districts;
  if (schedule?.data?.districts) return schedule.data.districts;
  if (Array.isArray(schedule)) return schedule;
  if (publicSchedule?.areas) return publicSchedule.areas;
  if (publicSchedule?.data?.areas) return publicSchedule.data.areas;
  if (publicSchedule?.districts) return publicSchedule.districts;
  if (publicSchedule?.data?.districts) return publicSchedule.data.districts;
  return [];
}

function resolveTotalWaste(schedule, publicSchedule) {
  return schedule?.totalPredictedWasteKg
    || schedule?.data?.totalPredictedWasteKg
    || publicSchedule?.totalPredictedWasteKg
    || publicSchedule?.data?.totalPredictedWasteKg
    || 0;
}

/* ── Truck loader (same as login page) ── */

function TruckLoader() {
  return (
    <div className="flex items-center justify-center py-1">
      <div className="relative w-40 h-6 overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-primary/20" />
        <svg
          className="absolute bottom-0.5 animate-[truckMove_2s_ease-in-out_infinite] w-7 h-4"
          viewBox="0 0 32 20"
          fill="none"
        >
          <rect x="8" y="4" width="16" height="10" rx="2" fill="#354f52" />
          <rect x="24" y="6" width="7" height="8" rx="1.5" fill="#354f52" />
          <rect x="25.5" y="7.5" width="4" height="3.5" rx="0.75" fill="#f5f1e8" />
          <circle cx="13" cy="16" r="2.5" fill="#354f52" />
          <circle cx="13" cy="16" r="1" fill="#f5f1e8" />
          <circle cx="27" cy="16" r="2.5" fill="#354f52" />
          <circle cx="27" cy="16" r="1" fill="#f5f1e8" />
        </svg>
      </div>
    </div>
  );
}

/* ── Normalize area item fields (API uses area/areaType, fallback to district/districtType) ── */

function areaName(item) { return item.area || item.district || "Unknown"; }
function areaType(item) { return item.areaType || item.districtType || "residential"; }

/* ── Compact row for the list view ── */

function ScheduleRow({ item, isSelected, onClick }) {
  const action = ACTION_CONFIG[item.action] || ACTION_CONFIG.skip;
  const typeConf = TYPE_CONFIG[areaType(item)] || TYPE_CONFIG.residential;
  const TypeIcon = typeConf.icon;
  const level = WASTE_LEVEL(item.predictedWasteKg || 0);
  const isSkipped = item.action === "skip";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 sm:px-6 py-3.5 flex items-center gap-3 transition-colors duration-150 ${
        isSelected
          ? "bg-primary/8"
          : isSkipped
          ? "opacity-50 hover:bg-primary/4"
          : "hover:bg-primary/4"
      }`}
    >
      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${action.color}`} />

      {/* Area type icon */}
      <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${typeConf.bg}`}>
        <TypeIcon className={`w-4 h-4 ${typeConf.color}`} />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate font-['Outfit',sans-serif]">
          {areaName(item)}
        </p>
        <p className="text-xs text-primary/45 mt-0.5 font-['Outfit',sans-serif]">
          {areaType(item)}
        </p>
      </div>

      {/* Waste amount */}
      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${level.dot}`} />
        <span className="text-sm font-semibold text-primary tabular-nums">
          {item.predictedWasteKg?.toLocaleString()}
        </span>
        <span className="text-xs text-primary/40">kg</span>
      </div>

      {/* Action badge */}
      <span
        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ${action.bg} ${action.text}`}
      >
        {action.label}
      </span>
    </button>
  );
}

/* ── Detail panel (slides in from right) ── */

function DetailPanel({ item, onClose }) {
  if (!item) return null;

  const action = ACTION_CONFIG[item.action] || ACTION_CONFIG.skip;
  const ActionIcon = action.icon;
  const typeConf = TYPE_CONFIG[areaType(item)] || TYPE_CONFIG.residential;
  const TypeIcon = typeConf.icon;
  const level = WASTE_LEVEL(item.predictedWasteKg || 0);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-primary/8">
        <h3 className="font-['Outfit',sans-serif] font-semibold text-primary text-base truncate pr-2">
          {areaName(item)}
        </h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/5 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4 text-primary/50" />
        </button>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Status + Type */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${action.bg} ${action.text}`}>
            <ActionIcon className="w-3.5 h-3.5" />
            {action.label}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${typeConf.bg} ${typeConf.color}`}>
            <TypeIcon className="w-3.5 h-3.5" />
            {areaType(item)}
          </span>
        </div>

        {/* Predicted waste */}
        <div className="bg-secondary rounded-xl p-4">
          <p className="text-xs text-primary/40 font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5" />
            Predicted Waste
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-primary tabular-nums">
              {item.predictedWasteKg?.toLocaleString()}
            </span>
            <span className="text-sm text-primary/50">kg</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`w-2 h-2 rounded-full ${level.dot}`} />
            <span className="text-xs text-primary/55 font-medium">{level.label} volume</span>
          </div>
        </div>

        {/* Assigned trucks */}
        {item.assignedTrucks?.length > 0 && (
          <div>
            <p className="text-xs text-primary/40 font-medium uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Route className="w-3.5 h-3.5" />
              Assigned Vehicles ({item.assignedTrucks.length})
            </p>
            <div className="space-y-2">
              {item.assignedTrucks.map((truck, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <Truck className="w-4 h-4 text-primary/40" />
                    <div>
                      <p className="text-sm font-medium text-primary">
                        {truck.licensePlate || truck.truckId}
                      </p>
                      <p className="text-xs text-primary/45 flex items-center gap-1 mt-0.5">
                        <User className="w-3 h-3" />
                        {truck.driverName}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-primary/40 font-medium">
                    {truck.capacity}kg cap.
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation */}
        {item.recommendation && (
          <div className="bg-blue-50/60 rounded-xl p-4">
            <p className="text-xs text-blue-600/60 font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              ML Recommendation
            </p>
            <p className="text-sm text-blue-800/70 leading-relaxed">
              {item.recommendation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Mobile detail modal (bottom sheet) ── */

function MobileDetailModal({ item, onClose }) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] bg-white rounded-t-2xl overflow-hidden animate-[modalIn_200ms_ease-out]">
        <div className="w-10 h-1 bg-primary/15 rounded-full mx-auto mt-3" />
        <DetailPanel item={item} onClose={onClose} />
      </div>
    </div>
  );
}

/* ── Main page ── */

function SchedulePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

  const { publicSchedule, loading, error, fetchPublicSchedule } = useMLScheduleStore();

  useEffect(() => {
    fetchPublicSchedule();
  }, [fetchPublicSchedule]);

  const schedule = publicSchedule;

  // Close panel on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setSelectedItem(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const allAreas = useMemo(
    () => resolveAreas(schedule, publicSchedule),
    [schedule, publicSchedule]
  );

  const filteredAreas = useMemo(() => {
    let items = allAreas;

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (d) =>
          areaName(d).toLowerCase().includes(q) ||
          areaType(d).toLowerCase().includes(q)
      );
    }

    if (actionFilter !== "all") {
      items = items.filter((d) => d.action === actionFilter);
    }

    if (typeFilter !== "all") {
      items = items.filter((d) => areaType(d) === typeFilter);
    }

    return items;
  }, [allAreas, searchQuery, actionFilter, typeFilter]);

  const areaTypes = useMemo(() => {
    return [...new Set(allAreas.map((d) => areaType(d)).filter(Boolean))];
  }, [allAreas]);

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const totalWaste = resolveTotalWaste(schedule, publicSchedule);
  const dispatchedCount = allAreas.filter((d) => d.action === "dispatch").length;
  const skippedCount = allAreas.filter((d) => d.action === "skip").length;
  const totalAreas = allAreas.length;

  const handleSelectItem = useCallback((item) => {
    setSelectedItem((prev) => (areaName(prev) === areaName(item) ? null : item));
  }, []);

  const hasActiveFilters = actionFilter !== "all" || typeFilter !== "all";

  const clearFilters = () => {
    setActionFilter("all");
    setTypeFilter("all");
    setSearchQuery("");
  };

  /* Loading */
  if (loading) {
    return (
      <div className="bg-secondary min-h-screen pt-18 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <TruckLoader />
          <p className="text-primary/60 text-sm font-medium font-['Outfit',sans-serif]">
            Loading collection schedule...
          </p>
        </div>
      </div>
    );
  }

  /* Error */
  if (error) {
    return (
      <div className="bg-secondary min-h-screen pt-18 flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-red-700 text-lg font-semibold font-['Outfit',sans-serif] mb-1">
            Something went wrong
          </p>
          <p className="text-red-500/70 text-sm max-w-sm">{error}</p>
        </div>
        <button
          onClick={fetchPublicSchedule}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  /* Empty */
  if (!schedule) {
    return (
      <div className="bg-secondary min-h-screen pt-18 flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center">
          <CalendarCheck className="w-8 h-8 text-primary/40" />
        </div>
        <div className="text-center">
          <h3 className="font-['Outfit',sans-serif] font-bold text-xl text-primary mb-1">
            No Schedule Available
          </h3>
          <p className="text-primary/50 text-sm max-w-md">
            No collection schedule has been generated for today yet.
          </p>
        </div>
        <button
          onClick={fetchPublicSchedule}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Check Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-secondary min-h-screen font-['Outfit',sans-serif] pt-18">
      {/* ── Header + Stats (single primary block, no white gap) ── */}
      <div className="bg-primary text-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Nav row */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/customer-dashboard")}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-white/60" />
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white leading-tight">
                  Collection Schedule
                </h1>
                <div className="flex items-center gap-1.5 text-xs text-white/45 mt-0.5">
                  <Clock className="w-3 h-3" />
                  <span>{todayStr}</span>
                  {schedule?.status === "draft" && (
                    <span className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10px] font-semibold">
                      <FileWarning className="w-2.5 h-2.5" />
                      Draft
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 text-white/50 text-xs">
                <Leaf className="w-3 h-3" />
                ML-Powered
              </div>
              <button
                onClick={fetchPublicSchedule}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center pb-6">
            <div>
              <MapPin className="w-5 h-5 text-white/40 mx-auto mb-2" />
              <p className="text-2xl sm:text-3xl font-bold">{totalAreas}</p>
              <p className="text-white/50 text-sm mt-1 font-medium">Total Areas</p>
            </div>
            <div>
              <Truck className="w-5 h-5 text-white/40 mx-auto mb-2" />
              <p className="text-2xl sm:text-3xl font-bold">{dispatchedCount}</p>
              <p className="text-white/50 text-sm mt-1 font-medium">Dispatched</p>
            </div>
            <div>
              <SkipForward className="w-5 h-5 text-white/40 mx-auto mb-2" />
              <p className="text-2xl sm:text-3xl font-bold">{skippedCount}</p>
              <p className="text-white/50 text-sm mt-1 font-medium">Skipped</p>
            </div>
            <div>
              <Scale className="w-5 h-5 text-white/40 mx-auto mb-2" />
              <p className="text-2xl sm:text-3xl font-bold">
                {totalWaste.toLocaleString()}
                <span className="text-lg font-normal ml-1">kg</span>
              </p>
              <p className="text-white/50 text-sm mt-1 font-medium">Predicted Waste</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search + Filters bar ── */}
      <div className="bg-white border-b border-primary/6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/35" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search areas..."
                className="w-full pl-9 pr-3 py-2 bg-secondary rounded-lg text-sm text-primary placeholder:text-primary/35 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary/60"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter toggle (mobile) */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`sm:hidden w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                hasActiveFilters ? "bg-primary text-white" : "bg-secondary text-primary/50"
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>

            {/* Desktop filters */}
            <div className="hidden sm:flex items-center gap-2">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="px-3 py-2 bg-secondary rounded-lg text-sm text-primary appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/15 pr-8"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23354f52' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
              >
                <option value="all">All Status</option>
                <option value="dispatch">Dispatched</option>
                <option value="skip">Skipped</option>
                <option value="reduced">Reduced</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 bg-secondary rounded-lg text-sm text-primary appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/15 pr-8"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23354f52' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
              >
                <option value="all">All Types</option>
                {areaTypes.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary/50 hover:text-primary transition-colors px-2"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Mobile filter dropdowns */}
          {showFilters && (
            <div className="sm:hidden flex items-center gap-2 mt-2 pt-2 border-t border-primary/6">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="flex-1 px-3 py-2 bg-secondary rounded-lg text-sm text-primary appearance-none cursor-pointer focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="dispatch">Dispatched</option>
                <option value="skip">Skipped</option>
                <option value="reduced">Reduced</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="flex-1 px-3 py-2 bg-secondary rounded-lg text-sm text-primary appearance-none cursor-pointer focus:outline-none"
              >
                <option value="all">All Types</option>
                {areaTypes.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-primary/50 px-1">
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Main content: List + Detail panel ── */}
      <div className="max-w-7xl mx-auto flex" style={{ minHeight: "calc(100vh - 260px)" }}>
        {/* List */}
        <div className={`flex-1 min-w-0 ${selectedItem ? "hidden lg:block" : ""}`}>
          {/* Results count */}
          <div className="px-4 sm:px-6 lg:px-8 py-3 text-xs text-primary/40 font-medium">
            {filteredAreas.length === totalAreas
              ? `${totalAreas} areas`
              : `${filteredAreas.length} of ${totalAreas} areas`}
          </div>

          {filteredAreas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 px-4">
              <MapPin className="w-10 h-10 text-primary/20" />
              <p className="text-primary/50 text-sm text-center">
                {searchQuery || hasActiveFilters
                  ? "No areas match your filters."
                  : "No areas in today's schedule."}
              </p>
              {(searchQuery || hasActiveFilters) && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-primary/60 hover:text-primary transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-primary/6">
              {filteredAreas.map((item) => (
                <ScheduleRow
                  key={areaName(item)}
                  item={item}
                  isSelected={selectedItem && areaName(selectedItem) === areaName(item)}
                  onClick={() => handleSelectItem(item)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Desktop detail panel */}
        {selectedItem && (
          <div className="hidden lg:block w-[380px] flex-shrink-0 border-l border-primary/8">
            <DetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
          </div>
        )}

        {/* Mobile detail modal */}
        <MobileDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      </div>
    </div>
  );
}

export default SchedulePage;
