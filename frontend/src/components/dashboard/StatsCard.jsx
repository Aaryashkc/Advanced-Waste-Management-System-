import React from "react";

const StatsCard = ({ title, value, label, icon, iconBg, valueColor }) => {
  return (
    <div className="bg-white rounded-2xl border border-primary/10 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-4">
        {icon && (
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg || "bg-primary/8"}`}>
            {typeof icon === "string" ? (
              <span className="text-xl">{icon}</span>
            ) : (
              icon
            )}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-primary/50">
            {title}
          </p>
          <h3 className={`mt-1 text-2xl font-bold leading-tight ${valueColor || "text-primary"}`}>
            {value}
          </h3>
          {label && <p className="mt-1 text-xs text-primary/40">{label}</p>}
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
