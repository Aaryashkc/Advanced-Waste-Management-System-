import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PaginationControls = ({ pagination, onPageChange, itemLabel = "items" }) => {
  if (!pagination || pagination.pages <= 1) return null;

  const currentPage = pagination.page || 1;
  const pages = pagination.pages || 1;
  const limit = pagination.limit || 10;
  const total = pagination.total || 0;
  const start = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const end = Math.min(currentPage * limit, total);

  return (
    <div className="px-5 py-3 border-t border-primary/8 bg-primary/2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <span className="text-xs text-primary/40">
        Showing {start}-{end} of {total} {itemLabel}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg hover:bg-primary/5 transition disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4 text-primary/60" />
        </button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
          let pageNum;
          if (pages <= 5) pageNum = i + 1;
          else if (currentPage <= 3) pageNum = i + 1;
          else if (currentPage >= pages - 2) pageNum = pages - 4 + i;
          else pageNum = currentPage - 2 + i;

          return (
            <button
              type="button"
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                currentPage === pageNum
                  ? "bg-primary text-white"
                  : "text-primary/60 hover:bg-primary/5"
              }`}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pages, currentPage + 1))}
          disabled={currentPage >= pages}
          className="p-1.5 rounded-lg hover:bg-primary/5 transition disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4 text-primary/60" />
        </button>
      </div>
    </div>
  );
};

export default PaginationControls;
