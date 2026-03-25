import { useMemo, useState, useEffect } from "react";
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
  CheckCircle2,
  Info,
  RefreshCw,
  BarChart3,
  Route,
  User,
  Weight,
  Leaf,
  Calendar,
  FileWarning,
} from "lucide-react";

const CATEGORY_STYLES = {
  none: { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200", label: "None" },
  low: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Low" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Medium" },
  high: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", label: "High" },
  critical: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "Critical" },
};

const ACTION_CONFIG = {
  dispatch: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: Truck,
    label: "Dispatch",
  },
  skip: {
    bg: "bg-slate-50",
    text: "text-slate-400",
    border: "border-slate-200",
    icon: SkipForward,
    label: "Skip",
  },
  reduced: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: TrendingDown,
    label: "Reduced",
  },
};

const TYPE_CONFIG = {
  commercial: { icon: Building2, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  residential: { icon: Home, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  suburban: { icon: Trees, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200" },
  rural: { icon: Mountain, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
};

function AreaCard({ area }) {
  const category = CATEGORY_STYLES[area.wasteCategory] || CATEGORY_STYLES.none;
  const action = ACTION_CONFIG[area.action] || ACTION_CONFIG.skip;
  const typeConf = TYPE_CONFIG[area.areaType] || TYPE_CONFIG.residential;
  const ActionIcon = action.icon;
  const TypeIcon = typeConf.icon;

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
        area.action === "skip"
          ? "border-slate-200 opacity-55"
          : "border-[#354f52]/10 shadow-sm"
      }`}
    >
      {/* Card Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <MapPin className="w-4 h-4 text-[#354f52]/50 flex-shrink-0" />
              <h3 className="font-semibold text-[#354f52] font-['Outfit',sans-serif] text-[15px] truncate">
                {area.area}
              </h3>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${typeConf.bg} ${typeConf.color} ${typeConf.border}`}
            >
              <TypeIcon className="w-3 h-3" />
              {area.areaType}
            </span>
          </div>
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${action.bg} ${action.text} ${action.border}`}
          >
            <ActionIcon className="w-3.5 h-3.5" />
            <span>{action.label}</span>
          </div>
        </div>
      </div>

      {/* Waste Amount */}
      <div className="px-5 pb-3">
        <div className={`flex items-center gap-3 p-3 rounded-xl ${category.bg} border ${category.border}`}>
          <Scale className={`w-5 h-5 ${category.text} flex-shrink-0`} />
          <div>
            <p className="text-xl font-bold text-[#354f52] leading-none">
              {area.predictedWasteKg?.toLocaleString()}
              <span className="text-xs font-normal text-[#354f52]/50 ml-1">kg</span>
            </p>
            <p className={`text-[11px] font-semibold mt-0.5 ${category.text}`}>
              {category.label} volume
            </p>
          </div>
        </div>
      </div>

      {/* Assigned Trucks */}
      {area.assignedTrucks && area.assignedTrucks.length > 0 && (
        <div className="px-5 pb-3">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-[#354f52]/40 mb-2">
            <Route className="w-3 h-3" />
            Assigned Vehicles
          </p>
          <div className="space-y-1.5">
            {area.assignedTrucks.map((truck, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2 border border-slate-100"
              >
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-[#354f52]/50" />
                  <span className="font-medium text-[#354f52]">
                    {truck.licensePlate || truck.truckId}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="flex items-center gap-1 text-[#354f52]/60">
                    <User className="w-3 h-3" />
                    {truck.driverName}
                  </span>
                  <span className="text-[#354f52]/40 font-medium">
                    {truck.capacity}kg
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      {area.recommendation && (
        <div className="px-5 pb-4">
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50/60 border border-blue-100">
            <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700/80 font-['Poppins',sans-serif] leading-relaxed">
              {area.recommendation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, value, label, accent }) {
  return (
    <div className="bg-white rounded-2xl border border-[#354f52]/10 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold text-[#354f52] leading-none">{value}</p>
      <p className="text-xs text-[#354f52]/50 mt-1.5 font-['Poppins',sans-serif] uppercase tracking-wider font-medium">
        {label}
      </p>
    </div>
  );
}

function SchedulePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const { publicSchedule, loading, error, fetchPublicSchedule } =
    useMLScheduleStore();

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
  const dispatchedCount =
    schedule?.areas?.filter((d) => d.action === "dispatch").length || 0;
  const skippedCount =
    schedule?.areas?.filter((d) => d.action === "skip").length || 0;
  const totalAreas = schedule?.areas?.length || 0;

  const handleBack = () => navigate("/customer-dashboard");

  if (loading) {
    return (
      <div className="bg-[#f5f1e8] min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-[3px] border-[#354f52]/15 border-t-[#354f52] rounded-full animate-spin" />
          <p className="text-[#354f52]/70 font-['Poppins',sans-serif] text-sm font-medium">
            Loading collection schedule...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#f5f1e8] min-h-screen flex flex-col items-center justify-center gap-5 px-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-red-700 text-lg font-semibold font-['Outfit',sans-serif] mb-1">
            Something went wrong
          </p>
          <p className="text-red-500/70 text-sm font-['Poppins',sans-serif] max-w-sm">
            {error}
          </p>
        </div>
        <button
          onClick={fetchPublicSchedule}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#354f52] text-white rounded-xl font-['Inter',sans-serif] text-sm font-medium hover:bg-[#2a3f41] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#f5f1e8] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-10">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#354f52]/10 text-[#354f52] hover:bg-[#354f52] hover:text-white transition-all duration-200 shadow-sm text-sm font-medium font-['Inter',sans-serif]"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <button
            onClick={fetchPublicSchedule}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#354f52]/10 text-[#354f52]/70 hover:text-[#354f52] hover:border-[#354f52]/25 transition-all duration-200 shadow-sm text-sm font-medium"
            title="Refresh schedule"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Page Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#354f52]/8 text-[#354f52]/70 text-xs font-medium font-['Poppins',sans-serif] mb-4">
            <Leaf className="w-3.5 h-3.5" />
            ML-Powered Predictions
          </div>
          <h2 className="font-['Outfit',sans-serif] font-bold text-3xl sm:text-4xl lg:text-5xl text-[#354f52] mb-2">
            Waste Collection Schedule
          </h2>
          <div className="flex items-center justify-center gap-2 text-[#354f52]/60 font-['Poppins',sans-serif] text-sm sm:text-base">
            <Calendar className="w-4 h-4" />
            <span>{todayStr}</span>
          </div>
          {schedule?.status === "draft" && (
            <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
              <FileWarning className="w-3.5 h-3.5" />
              Draft schedule - pending confirmation
            </div>
          )}
          {schedule?.createdAt && (
            <p className="text-[#354f52]/35 font-['Poppins',sans-serif] text-xs mt-2">
              <Clock className="w-3 h-3 inline-block mr-1 -mt-0.5" />
              Updated{" "}
              {new Date(schedule.createdAt).toLocaleString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
                month: "short",
                day: "numeric",
              })}
            </p>
          )}
        </div>

        {!schedule ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20 gap-5">
            <div className="w-20 h-20 rounded-2xl bg-[#354f52]/8 flex items-center justify-center">
              <CalendarCheck className="w-10 h-10 text-[#354f52]/40" />
            </div>
            <div className="text-center">
              <h3 className="font-['Outfit',sans-serif] font-bold text-xl text-[#354f52] mb-1">
                No Schedule Available
              </h3>
              <p className="text-[#354f52]/50 font-['Poppins',sans-serif] text-sm max-w-md">
                No collection schedule has been generated for today yet. Check
                back later or contact your administrator.
              </p>
            </div>
            <button
              onClick={fetchPublicSchedule}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#354f52] text-white rounded-xl text-sm font-medium hover:bg-[#2a3f41] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Check Again
            </button>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="max-w-4xl mx-auto mb-10">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard
                  icon={Weight}
                  value={totalWaste.toLocaleString() + " kg"}
                  label="Predicted Waste"
                  accent="bg-[#354f52]"
                />
                <StatCard
                  icon={BarChart3}
                  value={totalAreas}
                  label="Total Areas"
                  accent="bg-slate-500"
                />
                <StatCard
                  icon={CheckCircle2}
                  value={dispatchedCount}
                  label="Areas Dispatched"
                  accent="bg-emerald-600"
                />
                <StatCard
                  icon={SkipForward}
                  value={skippedCount}
                  label="Areas Skipped"
                  accent="bg-amber-500"
                />
              </div>
            </div>

            {/* Search */}
            <div className="max-w-2xl mx-auto mb-10">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#354f52]/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by area name or type..."
                  className="w-full pl-12 pr-5 py-3.5 bg-white rounded-xl border border-[#354f52]/10 text-[#354f52] placeholder:text-[#354f52]/35 font-['Poppins',sans-serif] text-sm focus:outline-none focus:ring-2 focus:ring-[#354f52]/20 focus:border-[#354f52]/30 transition-all shadow-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#354f52]/30 hover:text-[#354f52]/60 transition-colors"
                  >
                    <span className="sr-only">Clear</span>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {searchQuery && filteredAreas.length === 0 && (
                <p className="text-center text-[#354f52]/50 font-['Poppins',sans-serif] text-sm mt-3">
                  No areas match "{searchQuery}"
                </p>
              )}
            </div>

            {/* Collection Areas */}
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-['Outfit',sans-serif] font-semibold text-xl sm:text-2xl text-[#354f52]">
                  Collection Areas
                </h3>
                <span className="text-xs text-[#354f52]/50 font-['Poppins',sans-serif] font-medium bg-white px-3 py-1.5 rounded-lg border border-[#354f52]/10">
                  {filteredAreas.length} area
                  {filteredAreas.length !== 1 ? "s" : ""}
                </span>
              </div>

              {filteredAreas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#354f52]/8 flex items-center justify-center">
                    <MapPin className="w-8 h-8 text-[#354f52]/30" />
                  </div>
                  <p className="text-[#354f52]/60 font-['Poppins',sans-serif] text-sm">
                    No areas found. Try a different search.
                  </p>
                </div>
              ) : (
                <div className="space-y-10">
                  {Object.entries(groupedAreas).map(([type, typeAreas]) => {
                    const conf =
                      TYPE_CONFIG[type.toLowerCase()] || TYPE_CONFIG.residential;
                    const GroupIcon = conf.icon;
                    return (
                      <div key={type}>
                        {/* Type heading */}
                        <div className="flex items-center gap-3 mb-5">
                          <div className="h-px flex-1 bg-[#354f52]/8" />
                          <div
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${conf.bg} ${conf.border}`}
                          >
                            <GroupIcon className={`w-4 h-4 ${conf.color}`} />
                            <span
                              className={`text-xs font-bold uppercase tracking-wider ${conf.color}`}
                            >
                              {type}
                            </span>
                            <span className="text-xs text-[#354f52]/40 ml-1">
                              {typeAreas.length}
                            </span>
                          </div>
                          <div className="h-px flex-1 bg-[#354f52]/8" />
                        </div>

                        {/* Area cards grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {typeAreas.map((areaItem) => (
                            <AreaCard key={areaItem.area} area={areaItem} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
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
