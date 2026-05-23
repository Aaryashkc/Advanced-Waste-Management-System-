import { AlertTriangle, Inbox } from "lucide-react";

const baseLine = "h-3 rounded-full bg-primary/10";

export function TableSkeleton({ columns = 5, rows = 6 }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-primary/8 bg-primary/3">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-5 py-3.5">
                  <div className={`${baseLine} w-20 animate-pulse`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, row) => (
              <tr key={row} className="border-b border-primary/5">
                {Array.from({ length: columns }).map((_, col) => (
                  <td key={col} className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {col === 0 && <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-primary/8" />}
                      <div className={`${baseLine} animate-pulse ${col === columns - 1 ? "w-24" : col === 0 ? "w-36" : "w-28"}`} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CardGridSkeleton({ cards = 6 }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="min-h-[230px] rounded-2xl border border-primary/10 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 animate-pulse rounded-2xl bg-primary/8" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-primary/10" />
              <div className="h-3 w-4/5 animate-pulse rounded-full bg-primary/8" />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-16 animate-pulse rounded-xl bg-primary/5" />
            ))}
          </div>
          <div className="mt-8 h-3 w-3/4 animate-pulse rounded-full bg-primary/8" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm">
          <div className="flex gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-primary/8" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-1/3 animate-pulse rounded-full bg-primary/10" />
              <div className="h-3 w-4/5 animate-pulse rounded-full bg-primary/8" />
              <div className="h-16 animate-pulse rounded-xl bg-primary/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminEmptyState({ title = "Nothing here yet", message = "New records will appear here.", icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-primary/10 bg-white px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5">
        <Icon className="h-7 w-7 text-primary/25" />
      </div>
      <p className="text-base font-bold text-primary/70">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-primary/40">{message}</p>
    </div>
  );
}

export function AdminErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center">
      <AlertTriangle className="mb-3 h-10 w-10 text-red-400" />
      <p className="text-sm font-semibold text-red-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl bg-white px-4 py-2 text-xs font-bold text-red-700 shadow-sm transition hover:bg-red-100"
        >
          Try again
        </button>
      )}
    </div>
  );
}
