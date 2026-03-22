import React, { useEffect } from "react";
import useMLScheduleStore from "../../stores/useMLScheduleStore";

const CATEGORY_STYLES = {
  none: "bg-gray-100 text-gray-600",
  low: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const DriverMLAssignments = () => {
  const {
    driverAssignments,
    loading,
    error,
    fetchDriverAssignments,
  } = useMLScheduleStore();

  useEffect(() => {
    fetchDriverAssignments();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-5">
        <h1 className="text-xl font-bold text-primary">
          Today's ML Assignments
        </h1>
        <p className="text-sm text-primary/60 mt-0.5">
          AI-scheduled waste collection routes for today
        </p>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <svg className="animate-spin h-8 w-8 mx-auto text-accent" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-primary/50 mt-3">Loading assignments...</p>
          </div>
        )}

        {/* Assignments */}
        {!loading && driverAssignments.length > 0 && (
          <>
            <div className="bg-accent/10 rounded-xl p-4 mb-2">
              <p className="text-sm font-semibold text-accent">
                {driverAssignments.length} district{driverAssignments.length > 1 ? "s" : ""} assigned to you today
              </p>
            </div>

            {driverAssignments.map((assignment, idx) => {
              const catStyle = CATEGORY_STYLES[assignment.wasteCategory] || CATEGORY_STYLES.none;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-primary/10 p-5 space-y-3"
                >
                  {/* District header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-primary">
                        {assignment.district}
                      </h3>
                      <span className="text-xs text-primary/50">
                        {assignment.districtType}
                      </span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${catStyle}`}>
                      {assignment.wasteCategory}
                    </span>
                  </div>

                  {/* Predicted waste */}
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-primary/50 uppercase tracking-wide mb-1">
                      Predicted Waste
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {assignment.predictedWasteKg?.toLocaleString()} <span className="text-sm font-normal text-primary/50">kg</span>
                    </p>
                  </div>

                  {/* Truck info */}
                  {assignment.truck && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-lg">🚛</span>
                      <div>
                        <p className="font-medium text-primary">
                          {assignment.truck.licensePlate || assignment.truck.truckId}
                        </p>
                        <p className="text-xs text-primary/50">
                          {assignment.truck.truckType} — {assignment.truck.capacity}kg capacity
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Empty state */}
        {!loading && driverAssignments.length === 0 && !error && (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">📭</p>
            <h3 className="text-lg font-semibold text-primary/70 mb-2">
              No ML Assignments Today
            </h3>
            <p className="text-sm text-primary/50 max-w-xs mx-auto">
              No AI-scheduled collection routes have been assigned to you for today.
              Check back later or contact your admin.
            </p>
          </div>
        )}

        {/* Refresh button */}
        <div className="text-center pt-4">
          <button
            onClick={fetchDriverAssignments}
            disabled={loading}
            className="px-5 py-2 rounded-xl text-sm font-medium text-accent
                       border border-accent/20 hover:bg-accent/5
                       disabled:opacity-50 transition-all"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriverMLAssignments;
