import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DropdownPortal from "@/components/ui/DropdownPortal";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useMobile } from "@/lib/MobileContext";
import { formatDate, getExt, downloadStorage, isPreviewable } from "@/lib/utils";
import FilePreviewModal from "@/components/ui/FilePreviewModal";
import CreateGroCellModal from "@/components/gro/CreateGroCellModal";
import GroCellDetailModal from "@/components/gro/GroCellDetailModal";
import Pagination, { usePagination, getStoredPageSize } from "@/components/ui/Pagination";
import RowScaleButton, { useRowScale } from "@/components/ui/RowScaleButton";

type SortColumn = "date" | "building" | "description" | "floor" | "format";
type SortDir = "asc" | "desc";

interface GroCellRow {
  id: string;
  building_id: string | null;
  floor_id: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  dict_buildings: { name: string } | null;
  dict_floors: { name: string } | null;
  gro_cell_files: { id: string; file_name: string; storage_path: string }[];
}

export default function GroPage() {
  const { project, hasPermission, isPortalAdmin } = useProject();
  const { isMobile } = useMobile();
  const [cells, setCells] = useState<GroCellRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detailCellId, setDetailCellId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Фильтры
  const [filterBuilding, setFilterBuilding] = useState<Set<string>>(() => {
    try { const r = sessionStorage.getItem("gro_filters"); if (r) { const p = JSON.parse(r); return new Set(p.building || []); } } catch {} return new Set();
  });
  const [filterFloor, setFilterFloor] = useState<Set<string>>(() => {
    try { const r = sessionStorage.getItem("gro_filters"); if (r) { const p = JSON.parse(r); return new Set(p.floor || []); } } catch {} return new Set();
  });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [openFilter, setOpenFilter] = useState<"building" | "floor" | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(getStoredPageSize);
  const { scale, cycleScale } = useRowScale();

  const filterBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Дропдаун форматов файлов
  const [formatDropdown, setFormatDropdown] = useState<{ cellId: string; ext: string } | null>(null);
  const formatDropdownRef = useRef<HTMLDivElement>(null);
  const formatBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [previewFile, setPreviewFile] = useState<{ fileName: string; storagePath: string } | null>(null);

  useEffect(() => {
    if (!formatDropdown) return;
    function handleClick(e: MouseEvent) {
      if (formatDropdownRef.current && !formatDropdownRef.current.contains(e.target as Node)) {
        setFormatDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [formatDropdown]);

  useEffect(() => {
    if (!openFilter) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (filterRef.current && !filterRef.current.contains(target) &&
          !(target instanceof Element && target.closest("[data-dropdown-portal]"))) {
        setOpenFilter(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openFilter]);

  const loadCells = useCallback(async () => {
    if (!project) return;
    const { data } = await supabase
      .from("gro_cells")
      .select(`
        id, building_id, floor_id, description, created_by, created_at,
        dict_buildings(name),
        dict_floors(name),
        gro_cell_files(id, file_name, storage_path)
      `)
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });
    if (data) setCells(data as unknown as GroCellRow[]);
    setLoading(false);
  }, [project]);

  useEffect(() => { loadCells(); }, [loadCells]);

  function handleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDir(col === "date" ? "desc" : "asc");
    }
  }

  // Сохранение фильтров в sessionStorage
  useEffect(() => {
    sessionStorage.setItem("gro_filters", JSON.stringify({
      building: Array.from(filterBuilding),
      floor: Array.from(filterFloor),
    }));
  }, [filterBuilding, filterFloor]);

  // Уникальные значения для фильтров
  const filterOptions = useMemo(() => {
    const collect = (extractor: (c: GroCellRow) => string | null | undefined) => {
      const s = new Set<string>();
      for (const c of cells) { const v = extractor(c); if (v) s.add(v); }
      return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
    };
    return {
      building: collect((c) => c.dict_buildings?.name),
      floor: collect((c) => c.dict_floors?.name),
    };
  }, [cells]);

  const filtered = useMemo(() => {
    return cells.filter((c) => {
      if (filterBuilding.size > 0 && !filterBuilding.has(c.dict_buildings?.name || "")) return false;
      if (filterFloor.size > 0 && !filterFloor.has(c.dict_floors?.name || "")) return false;
      if (dateFrom) {
        const d = new Date(c.created_at).toISOString().slice(0, 10);
        if (d < dateFrom) return false;
      }
      if (dateTo) {
        const d = new Date(c.created_at).toISOString().slice(0, 10);
        if (d > dateTo) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const fields = [c.dict_buildings?.name, c.dict_floors?.name, c.description];
        if (!fields.some((v) => v?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [cells, filterBuilding, filterFloor, dateFrom, dateTo, search]);

  const activeFilterCount = filterBuilding.size + filterFloor.size + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  function clearFilters() {
    setFilterBuilding(new Set());
    setFilterFloor(new Set());
    setDateFrom(""); setDateTo(""); setSearch("");
  }

  function toggleFilterValue(key: "building" | "floor", value: string) {
    const setter = key === "building" ? setFilterBuilding : setFilterFloor;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  }

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    const str = (a: string | null | undefined, b: string | null | undefined) =>
      (a || "").localeCompare(b || "", "ru") * dir;
    arr.sort((a, b) => {
      switch (sortColumn) {
        case "date": return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
        case "building": return str(a.dict_buildings?.name, b.dict_buildings?.name);
        case "description": return str(a.description, b.description);
        case "floor": return str(a.dict_floors?.name, b.dict_floors?.name);
        case "format": {
          const fa = a.gro_cell_files[0]?.file_name ? getExt(a.gro_cell_files[0].file_name) : "";
          const fb = b.gro_cell_files[0]?.file_name ? getExt(b.gro_cell_files[0].file_name) : "";
          return str(fa, fb);
        }
        default: return 0;
      }
    });
    return arr;
  }, [filtered, sortColumn, sortDir]);

  useEffect(() => { setPage(1); }, [filterBuilding, filterFloor, dateFrom, dateTo, search, sortColumn, sortDir]);

  const paginatedRows = usePagination(sorted, page, pageSize);

  // При создании дубликата — открыть существующую ячейку
  function handleDuplicateFound(existingId: string) {
    setShowCreate(false);
    setDetailCellId(existingId);
  }


  return (
    <div>
      <div className={`flex items-center justify-between ${isMobile ? "mb-3" : "mb-6"}`}>
        <div className="flex items-center gap-2">
          <h2 className={`font-semibold ${isMobile ? "text-lg" : "text-xl"}`} style={{ color: "var(--ds-text)" }}>ГРО</h2>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="ds-icon-btn relative"
            style={showFilters || hasActiveFilters ? { color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))" } : undefined}
            title="Фильтры"
            data-print-hide
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {hasActiveFilters && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />}
          </button>
          {!isMobile && <RowScaleButton scale={scale} onCycle={cycleScale} />}
        </div>
        <div className="flex items-center gap-2" data-print-hide>
          {hasPermission("can_create_gro") && (
            <button
              onClick={() => setShowCreate(true)}
              className={`ds-btn ${isMobile ? "p-2" : ""}`}
              title="Добавить"
            >
              {isMobile ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              ) : "+ Добавить"}
            </button>
          )}
        </div>
      </div>

      {/* Фильтры */}
      {showFilters && <div className="ds-card p-3 mb-4 space-y-2" data-print-hide>
        <div className="flex items-center gap-2 flex-wrap">
          {(["building", "floor"] as const).map((key) => {
            const opts = filterOptions[key];
            if (opts.length === 0) return null;
            const selected = key === "building" ? filterBuilding : filterFloor;
            const isOpen = openFilter === key;
            const label = key === "building" ? "Место работ" : "Уровень";
            return (
              <div key={key} className="relative" ref={isOpen ? filterRef as React.RefObject<HTMLDivElement> : undefined}>
                <button
                  ref={(el) => { filterBtnRefs.current[key] = el; }}
                  onClick={() => setOpenFilter(isOpen ? null : key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    selected.size > 0
                      ? ""
                      : ""
                  }`}
                  style={selected.size > 0
                    ? { background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "var(--ds-accent)" }
                    : { borderColor: "var(--ds-border)", color: "var(--ds-text-muted)" }}
                >
                  {label}
                  {selected.size > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] bg-blue-600 text-white rounded-full">
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
                        onClick={() => (key === "building" ? setFilterBuilding : setFilterFloor)(new Set(opts))}
                        className="text-xs" style={{ color: "var(--ds-accent)" }}
                      >
                        Выбрать все
                      </button>
                      <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>|</span>
                      <button
                        onClick={() => (key === "building" ? setFilterBuilding : setFilterFloor)(new Set())}
                        className="text-xs" style={{ color: "var(--ds-text-faint)" }}
                      >
                        Снять все
                      </button>
                    </div>
                    {opts.map((val) => (
                      <label
                        key={val}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer" style={{ color: "var(--ds-text)" }}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(val)}
                          onChange={() => toggleFilterValue(key, val)}
                          className="rounded text-blue-600 focus:ring-blue-500" style={{ borderColor: "var(--ds-border)" }}
                        />
                        <span className="truncate">{val}</span>
                      </label>
                    ))}
                </DropdownPortal>
              </div>
            );
          })}

          <div className="w-px h-5" style={{ background: "var(--ds-border)" }} />

          <div className="flex items-center gap-1.5">
            <span className="text-xs whitespace-nowrap" style={{ color: "var(--ds-text-muted)" }}>Период</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="ds-input px-2 py-1 text-xs" />
            <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>&mdash;</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="ds-input px-2 py-1 text-xs" />
          </div>

          <div className="w-px h-5" style={{ background: "var(--ds-border)" }} />

          <button
            onClick={() => { setShowSearch((v) => !v); if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50); }}
            className="flex-shrink-0 p-1.5 rounded-lg border transition-colors"
            style={showSearch || search
              ? { background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "var(--ds-accent)" }
              : { color: "var(--ds-text-faint)", borderColor: "var(--ds-border)" }}
            title="Поиск"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {hasActiveFilters && (
            <>
              <div className="w-px h-5" style={{ background: "var(--ds-border)" }} />
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
              placeholder="Поиск по месту работ, уровню, описанию..."
              className="ds-input w-full pl-10 pr-10 py-2 text-sm" />
            {search && (
              <button onClick={() => { setSearch(""); searchInputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5" style={{ color: "var(--ds-text-faint)" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {hasActiveFilters && (
          <div className="text-xs pt-1" style={{ color: "var(--ds-text-faint)", borderTop: "1px solid var(--ds-border)" }}>
            Найдено: {filtered.length} из {cells.length}
          </div>
        )}
      </div>}

      {/* Мобильные карточки */}
      {isMobile ? (
        <div className="space-y-2">
          {loading ? (
            <div className="ds-card p-6 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
          ) : sorted.length === 0 ? (
            <div className="ds-card p-6 text-center">
              <p className="font-medium" style={{ color: "var(--ds-text-muted)" }}>{cells.length === 0 ? "Реестр ГРО пуст" : "Ничего не найдено"}</p>
            </div>
          ) : paginatedRows.map((cell) => {
            const formats = [...new Set(cell.gro_cell_files.map((f) => getExt(f.file_name)))];
            return (
              <div key={cell.id} className="ds-card p-3" onClick={() => setDetailCellId(cell.id)}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate" style={{ color: "var(--ds-text)" }}>{cell.dict_buildings?.name || "\u2014"}</span>
                  <span className="text-xs shrink-0 ml-2" style={{ color: "var(--ds-text-faint)" }}>{formatDate(cell.created_at)}</span>
                </div>
                {cell.dict_floors?.name && <div className="text-xs mb-1" style={{ color: "var(--ds-text-muted)" }}>{cell.dict_floors.name}</div>}
                {cell.description && <div className="text-xs line-clamp-2 mb-1" style={{ color: "var(--ds-text-muted)" }}>{cell.description}</div>}
                {formats.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formats.map((ext) => (
                      <span key={ext} className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "color-mix(in srgb, var(--ds-text-faint) 8%, var(--ds-surface))", color: "var(--ds-text-muted)", borderColor: "color-mix(in srgb, var(--ds-text-faint) 15%, transparent)" }}>
                        {ext}
                        {cell.gro_cell_files.filter((f) => getExt(f.file_name) === ext).length > 1 && (
                          <span className="ml-0.5 text-[10px] opacity-60">{cell.gro_cell_files.filter((f) => getExt(f.file_name) === ext).length}</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <Pagination totalItems={sorted.length} currentPage={page} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
        </div>
      ) : (
      /* Таблица (десктоп) */
      <div className="ds-card overflow-hidden" data-row-scale={scale}>
        <div className="overflow-x-auto">
          <table className="ds-table w-full text-sm">
            <thead>
              <tr style={{ background: "var(--ds-surface-sunken)", borderBottom: "1px solid var(--ds-border)" }}>
                {([
                  { col: "date" as SortColumn, label: "Дата", cls: "w-28" },
                  { col: "building" as SortColumn, label: "Место работ", cls: "" },
                  { col: "description" as SortColumn, label: "Описание", cls: "" },
                  { col: "floor" as SortColumn, label: "Уровень", cls: "" },
                  { col: "format" as SortColumn, label: "Формат файла", cls: "w-32" },
                ] as { col: SortColumn; label: string; cls: string }[]).map(({ col, label, cls }) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={`text-left px-4 py-2 font-medium text-xs cursor-pointer select-none transition-colors ${cls}`}
                    style={{ color: "var(--ds-text-muted)" }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortColumn === col && (
                        <svg className={`w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--ds-border)" }}>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <p className="font-medium" style={{ color: "var(--ds-text-muted)" }}>{cells.length === 0 ? "Реестр ГРО пуст" : "Ничего не найдено"}</p>
                    <p className="text-sm mt-1" style={{ color: "var(--ds-text-faint)" }}>
                      {cells.length === 0 ? "Нажмите \"Добавить\" для создания первой записи ГРО." : "Попробуйте изменить параметры поиска или фильтры."}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((cell) => {
                  const formats = [...new Set(cell.gro_cell_files.map((f) => getExt(f.file_name)))];
                  return (
                    <tr
                      key={cell.id}
                      className="cursor-pointer"
                      onDoubleClick={() => setDetailCellId(cell.id)}
                      onClick={() => setDetailCellId(cell.id)}
                    >
                      <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--ds-text-muted)" }}>{formatDate(cell.created_at)}</td>
                      <td className="px-4 py-2" style={{ color: "var(--ds-text)" }}>{cell.dict_buildings?.name || "\u2014"}</td>
                      <td className="px-4 py-2 max-w-[300px] truncate" style={{ color: "var(--ds-text-muted)" }} title={cell.description || ""}>{cell.description || "\u2014"}</td>
                      <td className="px-4 py-2" style={{ color: "var(--ds-text-muted)" }}>{cell.dict_floors?.name || "\u2014"}</td>
                      <td className="px-4 py-2">
                        {formats.length === 0 ? (
                          <span style={{ color: "var(--ds-text-faint)" }}>{"\u2014"}</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {formats.map((ext) => {
                              const filesOfExt = cell.gro_cell_files.filter((f) => getExt(f.file_name) === ext);
                              const previewableExt = isPreviewable(`file.${ext}`);
                              const isOpen = formatDropdown?.cellId === cell.id && formatDropdown?.ext === ext;
                              return (
                                <div key={ext} className="relative">
                                  <button
                                    ref={(el) => { formatBtnRefs.current[`${cell.id}_${ext}`] = el; }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (previewableExt || filesOfExt.length > 1) {
                                        setFormatDropdown(isOpen ? null : { cellId: cell.id, ext });
                                      } else if (hasPermission("can_download_files")) {
                                        downloadStorage(filesOfExt[0].storage_path, filesOfExt[0].file_name);
                                      }
                                    }}
                                    className="px-1.5 py-0.5 rounded text-xs font-mono transition-all duration-150 cursor-pointer border hover:shadow-sm hover:-translate-y-px active:translate-y-0"
                                    style={isOpen
                                      ? { background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }
                                      : { background: "color-mix(in srgb, var(--ds-text-faint) 8%, var(--ds-surface))", color: "var(--ds-text-muted)", borderColor: "color-mix(in srgb, var(--ds-text-faint) 15%, transparent)" }}
                                    title={previewableExt ? `${ext} — нажмите для просмотра/скачивания` : filesOfExt.length === 1 ? `Скачать ${ext}` : `${filesOfExt.length} файл(ов) ${ext}`}
                                  >
                                    {ext}
                                    {filesOfExt.length > 1 && <span className="ml-0.5 text-[10px] opacity-60">{filesOfExt.length}</span>}
                                  </button>
                                  <DropdownPortal anchorRef={{ current: formatBtnRefs.current[`${cell.id}_${ext}`] ?? null }} open={isOpen} className="min-w-[220px] max-w-[320px]">
                                      <div className="px-3 py-1.5 text-xs" style={{ color: "var(--ds-text-faint)", borderBottom: "1px solid var(--ds-border)" }}>
                                        {ext} — {filesOfExt.length} файл(ов)
                                      </div>
                                      {filesOfExt.map((file) => (
                                        <div key={file.id} className="flex items-center gap-1 px-2 py-1">
                                          <span className="flex-1 text-sm truncate px-1" style={{ color: "var(--ds-text-muted)" }} title={file.file_name}>{file.file_name}</span>
                                          {previewableExt && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setPreviewFile({ fileName: file.file_name, storagePath: file.storage_path }); setFormatDropdown(null); }}
                                              className="p-1 rounded transition-colors shrink-0"
                                              style={{ color: "var(--ds-text-faint)" }}
                                              title="Просмотр"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                              </svg>
                                            </button>
                                          )}
                                          {hasPermission("can_download_files") && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); downloadStorage(file.storage_path, file.file_name); setFormatDropdown(null); }}
                                              className="p-1 rounded transition-colors shrink-0"
                                              style={{ color: "var(--ds-text-faint)" }}
                                              title="Скачать"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                              </svg>
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                  </DropdownPortal>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination totalItems={sorted.length} currentPage={page} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
      </div>
      )}

      {/* Модалки */}
      {showCreate && (
        <CreateGroCellModal
          existingCells={cells}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadCells(); }}
          onDuplicateFound={handleDuplicateFound}
        />
      )}

      {detailCellId && (
        <GroCellDetailModal
          groCellId={detailCellId}
          isPortalAdmin={isPortalAdmin}
          onClose={() => setDetailCellId(null)}
          onUpdated={loadCells}
        />
      )}

      {previewFile && (
        <FilePreviewModal
          fileName={previewFile.fileName}
          storagePath={previewFile.storagePath}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
