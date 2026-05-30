import React from "react";
import { CircleHelp } from "lucide-react";

const StatsCard = ({ title, value, label, icon, iconBg, valueColor, hint, action }) => {
  return (
    <div className="dash-interactive-card group bg-[var(--dash-card)] rounded-2xl border p-5 shadow-sm shadow-primary/5">
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
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary/60">
              {title}
            </p>
            {hint && (
              <span className="group/help relative inline-flex">
                <CircleHelp className="h-3.5 w-3.5 text-primary/35 transition-colors group-hover/help:text-primary/60" aria-hidden />
                <span className="pointer-events-none absolute left-1/2 top-5 z-20 w-48 -translate-x-1/2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 text-[11px] font-medium leading-relaxed text-primary/75 opacity-0 shadow-lg shadow-black/10 transition-opacity group-hover/help:opacity-100">
                  {hint}
                </span>
              </span>
            )}
          </div>
          <h3 className={`mt-1 text-2xl font-bold leading-tight ${valueColor || "text-primary"}`}>
            {value}
          </h3>
          {label && <p className="mt-1 text-xs text-primary/50">{label}</p>}
          {action && (
            <button
              type="button"
              onClick={action}
              className="mt-3 inline-flex min-h-8 items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-primary/10 transition hover:bg-primary/90"
            >
              View Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
