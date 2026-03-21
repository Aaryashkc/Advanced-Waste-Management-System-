import React, { useMemo } from "react";

const VehicleCard = ({ vehicle }) => {
  const statusTone = {
    Collected: {
      bg: "bg-[#f2f7ee]",
      border: "border-[var(--accent)]/25",
      text: "text-[var(--accent)]",
      dot: "bg-[var(--accent)]",
    },
    "In Transit": {
      bg: "bg-blue-50",
      border: "border-blue-200/70",
      text: "text-blue-700",
      dot: "bg-blue-500",
    },
    Idle: {
      bg: "bg-black/5",
      border: "border-black/10",
      text: "text-[var(--primary)]/70",
      dot: "bg-black/30",
    },
    Maintenance: {
      bg: "bg-orange-50",
      border: "border-orange-200/70",
      text: "text-orange-700",
      dot: "bg-orange-500",
    },
  };

  const tone = statusTone[vehicle.status] || statusTone.Idle;

  const fillPercentage = useMemo(() => {
    const cap = Number(vehicle.capacity) || 0;
    const load = Number(vehicle.currentLoad) || 0;
    if (cap <= 0) return 0;
    const pct = Math.round((load / cap) * 100);
    return Math.max(0, Math.min(100, pct));
  }, [vehicle.capacity, vehicle.currentLoad]);

  const loadBarClass =
    fillPercentage >= 90
      ? "bg-red-500"
      : fillPercentage >= 70
      ? "bg-orange-500"
      : "bg-[var(--accent)]";

  const typeLabel =
    vehicle.type === "NON_BIO" ? "Non-bio" : vehicle.type === "BIO" ? "Bio" : String(vehicle.type);

  const loadText = (() => {
    const load = Number(vehicle.currentLoad) || 0;
    const cap = Number(vehicle.capacity) || 0;
    if (cap <= 0) return "—";
    return `${load.toLocaleString()} / ${cap.toLocaleString()} kg`;
  })();

  return (
    <div className="bg-white rounded-3xl border border-[var(--primary)]/15 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="font-bold text-lg text-[var(--primary)] truncate">
              {vehicle.licensePlate}
            </h4>
            <p className="text-sm text-[var(--primary)]/65">
              {typeLabel} truck
            </p>
          </div>

          <span
            className={`shrink-0 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${tone.bg} ${tone.border} ${tone.text}`}
          >
            <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
            {vehicle.status}
          </span>
        </div>

        {/* Meta */}
        <div className="mt-4 space-y-2">
          <Row icon="👤" value={vehicle.driver} strong />
          <Row icon="📍" value={vehicle.route} />
        </div>

        {/* Load */}
        <div className="mt-5 pt-4 border-t border-[var(--primary)]/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--primary)]/60 font-semibold">
              Load
            </span>
            <span className="text-[var(--primary)] font-semibold">
              {fillPercentage}% • {loadText}
            </span>
          </div>

          <div className="mt-2 w-full bg-black/10 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${loadBarClass}`}
              style={{ width: `${fillPercentage}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-[var(--primary)]/60">
            {fillPercentage >= 90
              ? "Critical: near full capacity"
              : fillPercentage >= 70
              ? "Warning: getting high"
              : "Normal load"}
          </p>
        </div>
      </div>
    </div>
  );
};

function Row({ icon, value, strong }) {
  return (
    <div className="flex items-start gap-2 text-sm text-[var(--primary)]/70">
      <span className="mt-0.5">{icon}</span>
      <span className={`min-w-0 ${strong ? "font-semibold text-[var(--primary)]" : ""} truncate`}>
        {value || "—"}
      </span>
    </div>
  );
}

export default VehicleCard;
