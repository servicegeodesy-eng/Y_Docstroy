import { useRef } from "react";
import DropdownPortal from "@/components/ui/DropdownPortal";
import { getStatusBadgeClass } from "@/constants/statusColors";

type FilterKey = "status" | "building" | "floor" | "workType" | "construction" | "set" | "manualTag";

const FILTER_LABELS: Record<FilterKey, string> = {
  building: "Место работ", workType: "Вид работ", floor: "Уровни и виды",
  construction: "Конструкции и зоны", set: "Комплект", status: "Статус", manualTag: "Метки",
};

export type { FilterKey };
export { FILTER_LABELS };

interface Props {
  filters: Record<FilterKey, Set<string>>;
  setFilters: React.Dispatch<React.SetStateAction<Record<FilterKey, Set<string>>>>;
  filterOptions: Record<FilterKey, string[]>;
  openFilter: FilterKey | null;
  setOpenFilter: (f: FilterKey | null) => void;
  filterRef: React.RefObject<HTMLDivElement | null>;
  dateFrom: string; setDateFrom: (v: string) => void;
  dateTo: string; setDateTo: (v: string) => void;
  search: string; setSearch: (v: string) => void;
  showSearch: boolean; setShowSearch: (fn: (v: boolean) => boolean) => void;
  hasActiveFilters: boolean; activeFilterCount: number;
  filteredCount: number; totalCount: number;
  clearFilters: () => void;
  toggleFilterValue: (key: FilterKey, value: string) => void;
  getColorKey: (name: string) => string;
}

export default function RegistryFilters({
  filters, setFilters, filterOptions, openFilter, setOpenFilter, filterRef,
  dateFrom, setDateFrom, dateTo, setDateTo,
  search, setSearch, showSearch, setShowSearch,
  hasActiveFilters, activeFilterCount, filteredCount, totalCount,
  clearFilters, toggleFilterValue, getColorKey,
}: Props) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filterBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  return (
    <div className="ds-card p-3 mb-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => {
          const opts = filterOptions[key];
          if (opts.length === 0) return null;
          const selected = filters[key];
          const isOpen = openFilter === key;
          return (
            <div key={key} className="relative" ref={isOpen ? filterRef as React.RefObject<HTMLDivElement> : undefined}>
              <button
                ref={(el) => { filterBtnRefs.current[key] = el; }}
                onClick={() => setOpenFilter(isOpen ? null : key)}
                className="ds-btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                style={selected.size > 0 ? { background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "var(--ds-border)" } : undefined}
              >
                {FILTER_LABELS[key]}
                {selected.size > 0 && (
                  <span className="ds-badge" style={{ minWidth: "16px", height: "16px", fontSize: "10px" }}>
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
                    <span className="text-xs" style={{ color: "var(--ds-border-strong)" }}>|</span>
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
                      className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer"
                      style={{ color: "var(--ds-text-muted)" }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(val)}
                        onChange={() => toggleFilterValue(key, val)}
                        className="rounded"
                        style={{ accentColor: "var(--ds-accent)", borderColor: "var(--ds-border-strong)" }}
                      />
                      <span className="truncate">
                        {key === "status" ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(getColorKey(val))}`}>{val}</span>
                        ) : val}
                      </span>
                    </label>
                  ))}
              </DropdownPortal>
            </div>
          );
        })}

        <div className="ds-divider w-px h-5 mx-0 my-0" style={{ borderTop: "none", borderLeft: "1px solid var(--ds-border)" }} />

        <div className="flex items-center gap-1.5">
          <span className="text-xs whitespace-nowrap" style={{ color: "var(--ds-text-muted)" }}>Период</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="ds-input px-2 py-1 text-xs !w-auto" />
          <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>&mdash;</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="ds-input px-2 py-1 text-xs !w-auto" />
        </div>

        <div className="ds-divider w-px h-5 mx-0 my-0" style={{ borderTop: "none", borderLeft: "1px solid var(--ds-border)" }} />

        <button
          onClick={() => { setShowSearch((v) => !v); if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50); }}
          className={`ds-icon-btn flex-shrink-0`}
          style={showSearch || search ? { color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))" } : undefined}
          title="Поиск"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        {hasActiveFilters && (
          <>
            <div className="ds-divider w-px h-5 mx-0 my-0" style={{ borderTop: "none", borderLeft: "1px solid var(--ds-border)" }} />
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
            placeholder="Поиск по наименованию, месту, виду работ, метке..."
            className="ds-input pl-10 pr-10" />
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
