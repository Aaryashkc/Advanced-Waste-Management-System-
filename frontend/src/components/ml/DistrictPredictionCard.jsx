import React, { useState } from "react";
import useMLScheduleStore from "../../stores/useMLScheduleStore";
import useAuthStore from "../../stores/useAuthStore";

const WASTE_COLORS = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
  none: "bg-gray-100 text-gray-600",
};

const DistrictPredictionCard = ({ district, scheduleId }) => {
  const user = useAuthStore((s) => s.user);
  const redispatchDistrict = useMLScheduleStore((s) => s.redispatchDistrict);
  const [redispatching, setRedispatching] = useState(false);
  const [redispatchError, setRedispatchError] = useState(null);

  const isSkipped = district.action === "skip";
  const isReduced = district.action === "reduced";
  const hasTrucks = district.assignedTrucks && district.assignedTrucks.length > 0;
  const canRedispatch = (isSkipped || (isReduced && !hasTrucks)) && scheduleId && (user?.role === "admin" || user?.role === "super_admin");

  const handleRedispatch = async () => {
    setRedispatching(true);
    setRedispatchError(null);
    const result = await redispatchDistrict(scheduleId, district.district);
    setRedispatching(false);
    if (!result) {
      setRedispatchError(useMLScheduleStore.getState().error || "Failed to redispatch");
    }
  };

  const wasteBadge = WASTE_COLORS[district.wasteCategory] || WASTE_COLORS.none;

  return (
    <div className={`rounded-2xl border p-4 transition-all hover:shadow-sm ${
      isSkipped ? "border-red-200 bg-red-50/40" :
      isReduced ? "border-amber-200 bg-amber-50/40" :
      "border-primary/10 bg-white"
    }`}>
      {/* Top Row: Name + Waste Level */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-primary text-base leading-tight">
            {district.district}
          </h3>
          <p className="text-[11px] text-primary/40 mt-0.5 capitalize">
            {district.districtType}{district.orgName ? ` · ${district.orgName}` : ""}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${wasteBadge}`}>
          {district.wasteCategory || "N/A"}
        </span>
      </div>

      {/* Predicted Waste */}
      <p className="text-2xl font-bold text-primary mb-3">
        {district.predictedWasteKg?.toLocaleString()}{" "}
        <span className="text-sm font-normal text-primary/40">kg</span>
      </p>

      {/* Holiday */}
      {district.isHoliday && (
        <p className="text-xs text-red-600 font-medium mb-2 px-2 py-1 bg-red-50 rounded-lg border border-red-100">
          Holiday: {district.holidayName || "Holiday"}
        </p>
      )}

      {/* Assigned Trucks */}
      {hasTrucks && (
        <div className="space-y-1.5 mb-3">
          {district.assignedTrucks.map((truck, idx) => {
            const noDriver = !truck.driverId || truck.driverName === "Unassigned";
            return (
              <div
                key={idx}
                className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${
                  noDriver ? "bg-red-50 border border-red-200" : "bg-primary/3"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🚛</span>
                  <span className="font-semibold text-primary">{truck.licensePlate}</span>
                  <span className="text-primary/40">{truck.capacity}kg</span>
                </div>
                <div className="text-right">
                  {noDriver ? (
                    <span className="text-red-600 font-semibold">No Driver</span>
                  ) : (
                    <span className="text-primary/70">{truck.driverName}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Skip Reason */}
      {isSkipped && (
        <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3 border border-red-100">
          {district.skipReason || "No truck/driver available"}
        </div>
      )}

      {/* No trucks message for non-skipped */}
      {!hasTrucks && !isSkipped && (
        <p className="text-xs text-primary/40 mb-3">No trucks assigned</p>
      )}

      {/* Recommendation */}
      {district.recommendation && (
        <p className="text-[11px] text-primary/50 leading-relaxed mb-3">
          {district.recommendation}
        </p>
      )}

      {/* Re-dispatch Button */}
      {canRedispatch && (
        <div className="pt-2 border-t border-primary/5">
          {redispatchError && (
            <p className="text-xs text-red-600 mb-2">{redispatchError}</p>
          )}
          <button
            onClick={handleRedispatch}
            disabled={redispatching}
            className="w-full py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition flex items-center justify-center gap-1.5"
          >
            {redispatching ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Re-dispatching...
              </>
            ) : (
              "Re-dispatch Truck"
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default DistrictPredictionCard;
