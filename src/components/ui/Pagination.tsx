import { useMemo } from "react";
import { useMobile } from "@/lib/MobileContext";

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const STORAGE_KEY = "ds_page_size";

/** Читает сохранённый размер страницы */
export function getStoredPageSize(): number {
  const v = localStorage.getItem(STORAGE_KEY);
  const n = v ? parseInt(v, 10) : NaN;
  return PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE;
}

interface PaginationProps {
  totalItems: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

export function usePagination<T>(items: T[], currentPage: number, pageSize = DEFAULT_PAGE_SIZE) {
  return useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);
}

export default function Pagination({ totalItems, currentPage, onPageChange, pageSize = DEFAULT_PAGE_SIZE, onPageSizeChange }: PaginationProps) {
  const { isMobile } = useMobile();
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1 && !onPageSizeChange) return null;

  const pages: (number | "...")[] = [];
  if (isMobile) {
    // На мобильном: только текущая, первая и последняя
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || i === currentPage) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }
  } else {
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }
  }

  return (
    <div
      className={`flex items-center justify-between ${isMobile ? "px-3 py-2 gap-2" : "px-4 py-2"}`}
      style={{ borderTop: "1px solid var(--ds-border)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs whitespace-nowrap" style={{ color: "var(--ds-text-muted)" }}>
          {totalItems > 0
            ? isMobile
              ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalItems)} / ${totalItems}`
              : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalItems)} из ${totalItems}`
            : `0 из 0`}
        </span>
        {onPageSizeChange && !isMobile && (
          <select
            value={pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              localStorage.setItem(STORAGE_KEY, String(newSize));
              onPageSizeChange(newSize);
              onPageChange(1);
            }}
            className="text-xs rounded px-1.5 py-0.5 outline-none"
            style={{
              background: "var(--ds-surface-elevated)",
              color: "var(--ds-text-muted)",
              border: "1px solid var(--ds-border)",
            }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} строк
              </option>
            ))}
          </select>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="ds-icon-btn px-2 py-1 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
          >
            &laquo;
          </button>
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`dots-${i}`} className="px-1 text-xs" style={{ color: "var(--ds-text-faint)" }}>...</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`${isMobile ? "px-2 py-1" : "px-2.5 py-1"} text-xs rounded-xl font-medium transition-all duration-200 ${
                  p === currentPage
                    ? "text-white"
                    : ""
                }`}
                style={
                  p === currentPage
                    ? {
                        background: "linear-gradient(135deg, var(--ds-accent), var(--ds-accent-dark))",
                        boxShadow: "0 2px 8px color-mix(in srgb, var(--ds-accent) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.15)",
                      }
                    : { color: "var(--ds-text-muted)" }
                }
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="ds-icon-btn px-2 py-1 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
          >
            &raquo;
          </button>
        </div>
      )}
    </div>
  );
}
