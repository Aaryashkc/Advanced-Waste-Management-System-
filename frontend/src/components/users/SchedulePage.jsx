import { useMemo, useState, useEffect, useRef } from "react";
import useMLScheduleStore from "../../stores/useMLScheduleStore";
import TruckLoader from "../shared/TruckLoader";
import ScheduleBg from "../../assets/schedule_truck.jpg";
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

/* ── Viewport observer (same pattern as OurTeam) ── */

function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

function FadeIn({ children, delay = 0, className = "" }) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ── Constants ── */

const ACTION_CONFIG = {
  dispatch: {
    color: "bg-emerald-500",
    text: "text-emerald-300",
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    label: "Dispatch",
    icon: Truck,
  },
  skip: {
    color: "bg-gray-400",
    text: "text-gray-300",
    bg: "bg-gray-500/15",
    border: "border-gray-500/30",
    label: "Skip",
    icon: SkipForward,
  },
  reduced: {
    color: "bg-amber-500",
    text: "text-amber-300",
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    label: "Reduced",
    icon: TrendingDown,
  },
};

const TYPE_CONFIG = {
  commercial: { icon: Building2, color: "text-blue-400", bg: "bg-blue-500/15" },
  residential: { icon: Home, color: "text-violet-400", bg: "bg-violet-500/15" },
  suburban: { icon: Trees, color: "text-teal-400", bg: "bg-teal-500/15" },
  rural: { icon: Mountain, color: "text-emerald-400", bg: "bg-emerald-500/15" },
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
  return (
    schedule?.totalPredictedWasteKg ||
    schedule?.data?.totalPredictedWasteKg ||
    publicSchedule?.totalPredictedWasteKg ||
    publicSchedule?.data?.totalPredictedWasteKg ||
    0
  );
}

/* ── Normalize area item fields ── */

function areaName(item) {
  return item.area || item.district || "Unknown";
}
function areaType(item) {
  return item.areaType || item.districtType || "residential";
}

/* ── Compact row for the list view ── */

function ScheduleRow({ item, index }) {
  const action = ACTION_CONFIG[item.action] || ACTION_CONFIG.skip;
  const typeConf = TYPE_CONFIG[areaType(item)] || TYPE_CONFIG.residential;
  const TypeIcon = typeConf.icon;
  const level = WASTE_LEVEL(item.predictedWasteKg || 0);

  return (
    <FadeIn delay={index * 40}>
      <article className="mb-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition-all duration-300 sm:px-5">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${typeConf.bg} border border-white/10`}
          >
            <TypeIcon className={`w-5 h-5 ${typeConf.color}`} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white font-['Outfit',sans-serif]">
                  {areaName(item)}
                </p>
                <p className="mt-0.5 text-xs capitalize text-white/40 font-['Outfit',sans-serif]">
                  {areaType(item)}
                </p>
              </div>

              <span
                className={`flex-shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${action.bg} ${action.text} ${action.border}`}
              >
                {action.label}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <p className="text-white/35">Waste</p>
                <p className="mt-0.5 font-semibold text-white">
                  {(item.predictedWasteKg || 0).toLocaleString()} <span className="text-white/35">kg</span>
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <p className="text-white/35">Level</p>
                <p className="mt-0.5 flex items-center gap-1.5 font-semibold text-white">
                  <span className={`w-1.5 h-1.5 rounded-full ${level.dot}`} />
                  {level.label}
                </p>
              </div>
              <div className="col-span-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 sm:col-span-1">
                <p className="text-white/35">Vehicle</p>
                <p className="mt-0.5 truncate font-semibold text-white">
                  {item.assignedTrucks?.[0]?.licensePlate || "Not assigned"}
                </p>
              </div>
            </div>

            {item.recommendation && (
              <p className="mt-3 text-xs leading-relaxed text-white/45">
                {item.recommendation}
              </p>
            )}
          </div>
        </div>
      </article>
    </FadeIn>
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
    <div className="h-full flex flex-col bg-black/90 backdrop-blur-xl">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <h3 className="font-['Outfit',sans-serif] font-semibold text-white text-base truncate pr-2">
          {areaName(item)}
        </h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4 text-white/50" />
        </button>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Status + Type */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${action.bg} ${action.text} ${action.border}`}
          >
            <ActionIcon className="w-3.5 h-3.5" />
            {action.label}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-white/10 ${typeConf.bg} ${typeConf.color}`}
          >
            <TypeIcon className="w-3.5 h-3.5" />
            {areaType(item)}
          </span>
        </div>

        {/* Predicted waste */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5" />
            Predicted Waste
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tabular-nums">
              {item.predictedWasteKg?.toLocaleString()}
            </span>
            <span className="text-sm text-white/50">kg</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`w-2 h-2 rounded-full ${level.dot}`} />
            <span className="text-xs text-white/55 font-medium">
              {level.label} volume
            </span>
          </div>
        </div>

        {/* Assigned trucks */}
        {item.assignedTrucks?.length > 0 && (
          <div>
            <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Route className="w-3.5 h-3.5" />
              Assigned Vehicles ({item.assignedTrucks.length})
            </p>
            <div className="space-y-2">
              {item.assignedTrucks.map((truck, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <Truck className="w-4 h-4 text-white/40" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {truck.licensePlate || truck.truckId}
                      </p>
                      <p className="text-xs text-white/45 flex items-center gap-1 mt-0.5">
                        <User className="w-3 h-3" />
                        {truck.driverName}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-white/40 font-medium">
                    {truck.capacity}kg cap.
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation */}
        {item.recommendation && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-xs text-blue-400/60 font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              ML Recommendation
            </p>
            <p className="text-sm text-blue-200/70 leading-relaxed">
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
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] bg-black/80 backdrop-blur-xl border-t border-white/10 rounded-t-2xl overflow-hidden animate-[modalIn_200ms_ease-out]">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3" />
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
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const { publicSchedule, loading, error, fetchPublicSchedule } =
    useMLScheduleStore();

  useEffect(() => {
    fetchPublicSchedule();
  }, [fetchPublicSchedule]);

  const schedule = publicSchedule;

  const allAreas = useMemo(
    () => resolveAreas(schedule, publicSchedule),
    [schedule, publicSchedule],
  );

  const filteredAreas = useMemo(() => {
    let items = allAreas;

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (d) =>
          areaName(d).toLowerCase().includes(q) ||
          areaType(d).toLowerCase().includes(q),
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

  const totalPages = Math.max(1, Math.ceil(filteredAreas.length / 10));
  const currentPage = Math.min(page, totalPages);
  const pagedAreas = useMemo(
    () => filteredAreas.slice((currentPage - 1) * 10, currentPage * 10),
    [filteredAreas, currentPage],
  );

  const areaTypes = useMemo(() => {
    return [...new Set(allAreas.map((d) => areaType(d)).filter(Boolean))];
  }, [allAreas]);

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const totalWaste = resolveTotalWaste(schedule, publicSchedule);
  const dispatchedCount = allAreas.filter(
    (d) => d.action === "dispatch",
  ).length;
  const skippedCount = allAreas.filter((d) => d.action === "skip").length;
  const totalAreas = allAreas.length;

  const handleSearchChange = (nextQuery) => {
    setSearchQuery(nextQuery);
    setPage(1);
  };

  const handleActionFilterChange = (nextAction) => {
    setActionFilter(nextAction);
    setPage(1);
  };

  const handleTypeFilterChange = (nextType) => {
    setTypeFilter(nextType);
    setPage(1);
  };

  const hasActiveFilters = actionFilter !== "all" || typeFilter !== "all";

  const clearFilters = () => {
    setActionFilter("all");
    setTypeFilter("all");
    setSearchQuery("");
    setPage(1);
  };

  /* Loading */
  if (loading) {
    return (
      <div className="relative min-h-screen font-['Outfit',sans-serif] bg-black">
        <div
          className="fixed inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${ScheduleBg})` }}
        />
        <div className="fixed inset-0 z-0 bg-black/70 backdrop-blur-xs" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
            <TruckLoader />
            <p className="text-white/60 text-sm font-medium font-['Outfit',sans-serif]">
              Loading collection schedule...
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* Error */
  if (error) {
    return (
      <div className="relative min-h-screen font-['Outfit',sans-serif] bg-black">
        <div
          className="fixed inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${ScheduleBg})` }}
        />
        <div className="fixed inset-0 z-0 bg-black/90 backdrop-blur-xs" />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen gap-4 px-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-red-300 text-lg font-semibold font-['Outfit',sans-serif] mb-1">
              Something went wrong
            </p>
            <p className="text-red-400/60 text-sm max-w-sm">{error}</p>
          </div>
          <button
            onClick={fetchPublicSchedule}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl text-sm font-medium hover:bg-gray-100 hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* Empty */
  if (!schedule) {
    return (
      <div className="relative min-h-screen font-['Outfit',sans-serif] bg-black">
        <div
          className="fixed inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${ScheduleBg})` }}
        />
        <div className="fixed inset-0 z-0 bg-black/90 backdrop-blur-xs" />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen gap-4 px-4">
          <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
            <CalendarCheck className="w-8 h-8 text-white/40" />
          </div>
          <div className="text-center">
            <h3 className="font-['Outfit',sans-serif] font-bold text-xl text-white mb-1">
              No Schedule Available
            </h3>
            <p className="text-white/50 text-sm max-w-md">
              No collection schedule has been generated for today yet.
            </p>
          </div>
          <button
            onClick={fetchPublicSchedule}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl text-sm font-medium hover:bg-gray-100 hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Check Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen font-['Outfit',sans-serif] bg-black">
      {/* ── Dynamic Background (same as OurTeam) ── */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${ScheduleBg})` }}
      />
      <div className="fixed inset-0 z-0 bg-black/90 backdrop-blur-xs" />

      {/* ── Content ── */}
      <div className="relative z-10 pt-24">
        {/* ── Hero header ── */}
        <section className="pb-8 sm:pb-12 px-6 md:px-16 lg:px-24 text-center">
          <FadeIn>
            <span className="inline-block text-white/50 text-xs font-semibold tracking-widest uppercase mb-4">
              Collection Schedule
            </span>
          </FadeIn>

          <FadeIn delay={100}>
            <h1 className="font-bold text-white text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.1] tracking-tight mb-6 drop-shadow-md">
              Today's Collection Plan
            </h1>
          </FadeIn>

          <FadeIn delay={200}>
            <p className="text-white/70 text-lg max-w-2xl mx-auto leading-relaxed mb-4">
              AI-optimized waste collection routes and dispatch decisions for
              your city.
            </p>
            <div className="flex items-center justify-center gap-2 text-white/45 text-sm">
              <Clock className="w-4 h-4" />
              <span>{todayStr}</span>
              {schedule?.status === "draft" && (
                <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[10px] font-semibold">
                  <FileWarning className="w-2.5 h-2.5" />
                  Draft
                </span>
              )}
              <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-white/45 text-[10px] font-semibold">
                <Leaf className="w-2.5 h-2.5" />
                ML-Powered
              </span>
            </div>
          </FadeIn>
        </section>

        {/* ── Stats grid ── */}
        <section className="pb-8 px-6 md:px-16 lg:px-24">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: MapPin, value: totalAreas, label: "Total Areas" },
              { icon: Truck, value: dispatchedCount, label: "Dispatched" },
              { icon: SkipForward, value: skippedCount, label: "Skipped" },
              {
                icon: Scale,
                value: totalWaste.toLocaleString(),
                label: "Predicted Waste",
                suffix: "kg",
              },
            ].map((stat, i) => (
              <FadeIn key={stat.label} delay={300 + i * 80}>
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 text-center hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                  <stat.icon className="w-5 h-5 text-white/40 mx-auto mb-2" />
                  <p className="text-2xl sm:text-3xl font-bold text-white">
                    {stat.value}
                    {stat.suffix && (
                      <span className="text-lg font-normal ml-1 text-white/50">
                        {stat.suffix}
                      </span>
                    )}
                  </p>
                  <p className="text-white/50 text-sm mt-1 font-medium">
                    {stat.label}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* ── Search + Filters bar ── */}
        <section className="px-6 md:px-16 lg:px-24 pb-4">
          <FadeIn delay={500}>
            <div className="max-w-7xl mx-auto bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-4 sm:px-6 py-3">
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search areas..."
                    className="w-full pl-9 pr-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => handleSearchChange("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter toggle (mobile) */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`sm:hidden w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-300 border ${
                    hasActiveFilters
                      ? "bg-white/20 border-white/30 text-white"
                      : "bg-white/10 border-white/10 text-white/50"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                </button>

                {/* Desktop filters */}
                <div className="hidden sm:flex items-center gap-2">
                  <select
                    value={actionFilter}
                    onChange={(e) => handleActionFilterChange(e.target.value)}
                    className="px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/20 pr-8"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 8px center",
                    }}
                  >
                    <option value="all" className="bg-[#1a1a1a] text-white">
                      All Status
                    </option>
                    <option
                      value="dispatch"
                      className="bg-[#1a1a1a] text-white"
                    >
                      Dispatched
                    </option>
                    <option value="skip" className="bg-[#1a1a1a] text-white">
                      Skipped
                    </option>
                    <option value="reduced" className="bg-[#1a1a1a] text-white">
                      Reduced
                    </option>
                  </select>

                  <select
                    value={typeFilter}
                    onChange={(e) => handleTypeFilterChange(e.target.value)}
                    className="px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/20 pr-8"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 8px center",
                    }}
                  >
                    <option value="all" className="bg-[#1a1a1a] text-white">
                      All Types
                    </option>
                    {areaTypes.map((t) => (
                      <option
                        key={t}
                        value={t}
                        className="bg-[#1a1a1a] text-white"
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>

                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-white/50 hover:text-white transition-colors px-2"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile filter dropdowns */}
              {showFilters && (
                <div className="sm:hidden flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                  <select
                    value={actionFilter}
                    onChange={(e) => handleActionFilterChange(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm text-white appearance-none cursor-pointer focus:outline-none"
                  >
                    <option value="all" className="bg-[#1a1a1a] text-white">
                      All Status
                    </option>
                    <option
                      value="dispatch"
                      className="bg-[#1a1a1a] text-white"
                    >
                      Dispatched
                    </option>
                    <option value="skip" className="bg-[#1a1a1a] text-white">
                      Skipped
                    </option>
                    <option value="reduced" className="bg-[#1a1a1a] text-white">
                      Reduced
                    </option>
                  </select>
                  <select
                    value={typeFilter}
                    onChange={(e) => handleTypeFilterChange(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-sm text-white appearance-none cursor-pointer focus:outline-none"
                  >
                    <option value="all" className="bg-[#1a1a1a] text-white">
                      All Types
                    </option>
                    {areaTypes.map((t) => (
                      <option
                        key={t}
                        value={t}
                        className="bg-[#1a1a1a] text-white"
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-white/50 px-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          </FadeIn>
        </section>

        {/* ── Main content: List + Detail panel ── */}
        <section className="px-6 md:px-16 lg:px-24 pb-20">
          <div
            className="max-w-5xl mx-auto"
            style={{ minHeight: "calc(100vh - 500px)" }}
          >
            {/* List */}
            <div className="min-w-0">
              {/* Results count */}
              <div className="py-3 text-xs text-white/40 font-medium">
                {filteredAreas.length === totalAreas
                  ? `${totalAreas} areas`
                  : `${filteredAreas.length} of ${totalAreas} areas`}
                {filteredAreas.length > 10 && (
                  <span className="ml-2 text-white/30">Page {currentPage} of {totalPages}</span>
                )}
              </div>

              {filteredAreas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 px-4">
                  <MapPin className="w-10 h-10 text-white/20" />
                  <p className="text-white/50 text-sm text-center">
                    {searchQuery || hasActiveFilters
                      ? "No areas match your filters."
                      : "No areas in today's schedule."}
                  </p>
                  {(searchQuery || hasActiveFilters) && (
                    <button
                      onClick={clearFilters}
                      className="text-sm text-white/60 hover:text-white transition-colors"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-0">
                  {pagedAreas.map((item, index) => (
                    <ScheduleRow
                      key={areaName(item)}
                      item={item}
                      index={index}
                    />
                  ))}
                  {filteredAreas.length > 10 && (
                    <div className="flex items-center justify-between pt-4">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-white/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-white/35">
                        Showing {(currentPage - 1) * 10 + 1}-{Math.min(currentPage * 10, filteredAreas.length)} of {filteredAreas.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-white/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default SchedulePage;
