import React, { useState } from "react";
import useMLScheduleStore from "../../stores/useMLScheduleStore";
import useAuthStore from "../../stores/useAuthStore";

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

const DistrictPredictionCard = ({ district, scheduleId }) => {
  const category = CATEGORY_STYLES[district.wasteCategory] || CATEGORY_STYLES.none;
  const action = ACTION_STYLES[district.action] || ACTION_STYLES.skip;
  const typeBadge = TYPE_BADGES[district.districtType] || "bg-gray-100 text-gray-700";

  const user = useAuthStore((s) => s.user);
  const redispatchDistrict = useMLScheduleStore((s) => s.redispatchDistrict);
  const [redispatching, setRedispatching] = useState(false);
  const [redispatchError, setRedispatchError] = useState(null);

  const hasNoTrucks = !district.assignedTrucks || district.assignedTrucks.length === 0;
  const hasNoDriver = district.assignedTrucks?.some(t => !t.driverId || t.driverName === "Unassigned");
  const isSkipped = district.action === "skip";
  const showAlert = (isSkipped && hasNoTrucks) || hasNoDriver || district.skipReason;
  const canRedispatch = (isSkipped || (district.action === "reduced" && hasNoTrucks)) && scheduleId && (user?.role === "admin" || user?.role === "super_admin");

  const handleRedispatch = async () => {
    setRedispatching(true);
    setRedispatchError(null);
    const result = await redispatchDistrict(scheduleId, district.district);
    setRedispatching(false);
    if (!result) {
      setRedispatchError(useMLScheduleStore.getState().error || "Failed to redispatch");
    }
  };

  return (
    <div className={`rounded-2xl border p-5 transition-all hover:shadow-md ${
      district.action === "skip"
        ? "border-red-200 bg-red-50/30"
        : hasNoDriver
          ? "border-amber-200 bg-amber-50/30"
          : "border-primary/15"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-primary text-base">
            {district.district}
          </h3>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${typeBadge}`}>
            {district.districtType}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${action.bg} ${action.text}`}>
          <span>{action.icon}</span>
          <span>{action.label}</span>
        </div>
      </div>

      {/* Alert Banner - No Truck / No Driver */}
      {showAlert && (
        <div className={`mb-3 px-3 py-2.5 rounded-xl border ${
          isSkipped ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
        }`}>
          <div className="flex items-start gap-2">
            <span className="text-base mt-0.5">{isSkipped ? "🚨" : "⚠️"}</span>
            <div>
              <p className={`text-xs font-bold ${isSkipped ? "text-red-700" : "text-amber-700"}`}>
                {district.skipReason || (hasNoTrucks ? "No truck available for this district" : "Driver not assigned to truck")}
              </p>
              <p className={`text-[11px] mt-0.5 ${isSkipped ? "text-red-600/70" : "text-amber-600/70"}`}>
                {isSkipped
                  ? "This location will NOT receive waste collection. Assign a driver to a truck and re-dispatch."
                  : "Truck assigned but driver may be missing. Check driver assignments."
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Predicted Waste */}
      <div className="mb-3">
        <p className="text-2xl font-bold text-(--primary)">
          {district.predictedWasteKg?.toLocaleString()} <span className="text-sm font-normal text-(--primary)/60">kg</span>
        </p>
        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${category.bg} ${category.text}`}>
          {category.label}
        </span>
      </div>

      {/* Holiday indicator */}
      {district.isHoliday && (
        <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200">
          <p className="text-xs font-medium text-red-700">
            🎉 {district.holidayName || "Holiday"}
          </p>
        </div>
      )}

      {/* Assigned Trucks */}
      {district.assignedTrucks && district.assignedTrucks.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-primary/50 uppercase tracking-wide mb-1.5">
            Assigned Trucks
          </p>
          <div className="space-y-1.5">
            {district.assignedTrucks.map((truck, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 ${
                  !truck.driverId || truck.driverName === "Unassigned"
                    ? "bg-amber-50 border border-amber-200"
                    : "bg-gray-50"
                }`}
              >
                <div>
                  <span className="font-medium text-primary">{truck.licensePlate || truck.truckId}</span>
                  <span className="text-primary/50 ml-2">{truck.truckType}</span>
                </div>
                <div className="text-right">
                  {!truck.driverId || truck.driverName === "Unassigned" ? (
                    <span className="text-red-600 font-semibold">No Driver</span>
                  ) : (
                    <span className="text-primary/70">{truck.driverName}</span>
                  )}
                  <span className="text-primary/40 ml-1.5">{truck.capacity}kg</span>
                  {truck.orgName && (
                    <span className="block text-[10px] text-primary/40">{truck.orgName}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No trucks at all */}
      {hasNoTrucks && district.action !== "skip" && (
        <div className="mb-3 p-3 rounded-xl bg-gray-50 border border-gray-200 text-center">
          <p className="text-xs text-gray-500 font-medium">No trucks assigned to this district</p>
        </div>
      )}

      {/* Recommendation */}
      <p className="text-xs text-primary/60 leading-relaxed mb-3">
        {district.recommendation}
      </p>

      {/* Re-dispatch Button */}
      {canRedispatch && (
        <div className="pt-2 border-t border-primary/10">
          {redispatchError && (
            <p className="text-xs text-red-600 mb-2">{redispatchError}</p>
          )}
          <button
            onClick={handleRedispatch}
            disabled={redispatching}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white
                       bg-blue-600 hover:bg-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all flex items-center justify-center gap-2"
          >
            {redispatching ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Re-dispatching...
              </>
            ) : (
              <>
                🔄 Re-dispatch
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default DistrictPredictionCard;
