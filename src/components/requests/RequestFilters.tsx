import { useRef } from "react";
import DropdownPortal from "@/components/ui/DropdownPortal";

export type RequestFilterKey = "requestWorkType" | "building" | "workType" | "floor" | "construction";

const FILTER_LABELS: Record<RequestFilterKey, string> = {
  requestWorkType: "Работа",
  building: "Место работ",
  workType: "Вид работ",
  floor: "Уровни и виды",
  construction: "Конструкции и зоны",
};


interface Props {
  filters: Record<RequestFilterKey, Set<string>>;
  setFilters: React.Dispatch<React.SetStateAction<Record<RequestFilterKey, Set<string>>>>;
  filterOptions: Record<RequestFilterKey, string[]>;
  openFilter: RequestFilterKey | null;
  setOpenFilter: (f: RequestFilterKey | null) => void;
  filterRef: React.RefObject<HTMLDivElement | null>;
  dateFrom: string; setDateFrom: (v: string) => void;
  dateTo: string; setDateTo: (v: string) => void;
  search: string; setSearch: (v: string) => void;
  showSearch: boolean; setShowSearch: (fn: (v: boolean) => boolean) => void;
  hasActiveFilters: boolean; activeFilterCount: number;
  filteredCount: number; totalCount: number;
  clearFilters: () => void;
  toggleFilterValue: (key: RequestFilterKey, value: string) => void;
  allRequests?: boolean;
  setAllRequests?: (v: boolean) => void;
  showAllRequests?: boolean;
}

export default function RequestFilters({
  filters, setFilters, filterOptions, openFilter, setOpenFilter, filterRef,
  dateFrom, setDateFrom, dateTo, setDateTo,
  search, setSearch, showSearch, setShowSearch,
  hasActiveFilters, activeFilterCount, filteredCount, totalCount,
  clearFilters, toggleFilterValue,
  allRequests, setAllRequests, showAllRequests,
}: Props) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filterBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  return (
    <div className="ds-card p-3 mb-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {showAllRequests && setAllRequests && (
          <>
            <button
              onClick={() => setAllRequests(!allRequests)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
              style={allRequests
                ? { background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "color-mix(in srgb, var(--ds-accent) 30%, var(--ds-border))" }
                : { background: "var(--ds-surface)", color: "var(--ds-text-muted)", borderColor: "var(--ds-border)" }
              }
            >
              Все заявки
            </button>
            <div className="ds-divider w-px h-5" />
          </>
        )}
        {(Object.keys(FILTER_LABELS) as RequestFilterKey[]).map((key) => {
          const opts = filterOptions[key];
          if (opts.length === 0) return null;
          const selected = filters[key];
          const isOpen = openFilter === key;
          return (
            <div key={key} className="relative" ref={isOpen ? filterRef as React.RefObject<HTMLDivElement> : undefined}>
              <button
                ref={(el) => { filterBtnRefs.current[key] = el; }}
                onClick={() => setOpenFilter(isOpen ? null : key)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                style={selected.size > 0
                  ? { background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "color-mix(in srgb, var(--ds-accent) 30%, var(--ds-border))" }
                  : { background: "var(--ds-surface)", color: "var(--ds-text-muted)", borderColor: "var(--ds-border)" }
                }
              >
                {FILTER_LABELS[key]}
                {selected.size > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full" style={{ background: "var(--ds-accent)", color: "white" }}>
                    {selected.size}
                  </span>
                )}
                <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <DropdownPortal anchorRef={{ current: filterBtnRefs.current[key] ?? null }} open={isOpen} className="min-w-[200px] max-w-[260px] max-h-64 overflow-y-auto">
                  <div className="flex items-center gap-1 px-3 py-1.5" style={{ borderBottom: "1px solid var(--ds-border)" }}>
                    <button
                      onClick={() => setFilters((p) => ({ ...p, [key]: new Set(opts) }))}
                      className="text-xs" style={{ color: "var(--ds-accent)" }}
                    >
                      Выбрать все
                    </button>
                    <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>|</span>
                    <button
                      onClick={() => setFilters((p) => ({ ...p, [key]: new Set() }))}
                      className="text-xs" style={{ color: "var(--ds-text-faint)" }}
                    >
                      Снять все
                    </button>
                  </div>
                  {opts.map((val) => (
                    <label
                      key={val}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors" style={{ color: "var(--ds-text)" }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(val)}
                        onChange={() => toggleFilterValue(key, val)}
                        className="rounded"
                        style={{ borderColor: "var(--ds-border)" }}
                      />
                      <span className="truncate">{val}</span>
                    </label>
                  ))}
              </DropdownPortal>
            </div>
          );
        })}

        <div className="ds-divider w-px h-5" />

        <div className="flex items-center gap-1.5">
          <span className="text-xs whitespace-nowrap" style={{ color: "var(--ds-text-muted)" }}>Период</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="ds-input px-2 py-1 text-xs" />
          <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>&mdash;</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="ds-input px-2 py-1 text-xs" />
        </div>

        <div className="ds-divider w-px h-5" />

        <button
          onClick={() => { setShowSearch((v) => !v); if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50); }}
          className="flex-shrink-0 p-1.5 rounded-lg border transition-colors"
          style={showSearch || search
            ? { background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "color-mix(in srgb, var(--ds-accent) 30%, var(--ds-border))" }
            : { color: "var(--ds-text-faint)", borderColor: "var(--ds-border)" }
          }
          title="Поиск"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        {hasActiveFilters && (
          <>
            <div className="ds-divider w-px h-5" />
            <button onClick={clearFilters} className="text-xs font-medium whitespace-nowrap" style={{ color: "#ef4444" }}>
              Сбросить ({activeFilterCount})
            </button>
          </>
        )}
      </div>

      {showSearch && (
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input ref={searchInputRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по наименованию, месту, виду работ..."
            className="ds-input w-full pl-10 pr-10" />
          {search && (
            <button onClick={() => { setSearch(""); searchInputRef.current?.focus(); }}
              className="ds-icon-btn absolute right-3 top-1/2 -translate-y-1/2 p-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {hasActiveFilters && (
        <div className="text-xs pt-1" style={{ color: "var(--ds-text-faint)", borderTop: "1px solid var(--ds-border)" }}>
          Найдено: {filteredCount} из {totalCount}
        </div>
      )}
    </div>
  );
}
