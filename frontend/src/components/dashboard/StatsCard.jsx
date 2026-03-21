import React from "react";

const StatsCard = ({ title, value, label, icon, trend }) => {
  const trendStyles =
    trend === "up"
      ? "text-[var(--accent)] bg-[var(--accent)]/10 border-[var(--accent)]/20"
      : trend === "down"
      ? "text-red-600 bg-red-50 border-red-200/70"
      : "text-[var(--primary)]/70 bg-black/5 border-black/10";

  return (
    <div className="bg-white rounded-3xl border border-[var(--primary)]/15 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]/60">
              {title}
            </p>
            <h3 className="mt-2 text-3xl font-bold text-[var(--primary)] leading-tight">
              {value}
            </h3>
          </div>

          <div className="shrink-0 w-12 h-12 rounded-2xl border border-[var(--primary)]/12 bg-[#f5f1e8] flex items-center justify-center text-2xl">
            {icon}
          </div>
        </div>

        <div className="mt-5">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold ${trendStyles}`}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
