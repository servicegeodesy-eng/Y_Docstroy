import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DropdownPortal from "@/components/ui/DropdownPortal";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useMobile } from "@/lib/MobileContext";
import { getStatusBadgeClass, getStatusBgClass } from "@/constants/statusColors";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import CellDetailModal from "@/components/registry/CellDetailModal";


interface ChessCell {
  id: string;
  name: string;
  status: string;
  progress_percent: number | null;
  updated_at: string;
  building_id: string | null;
  building_name: string | null;
  floor_id: string | null;
  floor_name: string | null;
  floor_sort: number;
  work_type_id: string | null;
  work_type_name: string | null;
  construction_id: string | null;
  construction_name: string | null;
  construction_sort: number;
  set_id: string | null;
  set_name: string | null;
}

type FilterKey = "building" | "workType" | "construction" | "set";

export default function ChessboardReport() {
  const { project, hasPermission } = useProject();
  const { isMobile } = useMobile();
  const { statuses, getColorKey } = useProjectStatuses();
  const [cells, setCells] = useState<ChessCell[]>([]);
  const [allFloors, setAllFloors] = useState<{ id: string; name: string; sort: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailCellId, setDetailCellId] = useState<string | null>(null);

  const [filters, setFilters] = useState<Record<FilterKey, Set<string>>>(() => {
    try {
      const raw = sessionStorage.getItem("chess_filters");
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          building: new Set(parsed.building || []),
          workType: new Set(parsed.workType || []),
          construction: new Set(parsed.construction || []),
          set: new Set(parsed.set || []),
        };
      }
    } catch { /* ignore */ }
    return { building: new Set(), workType: new Set(), construction: new Set(), set: new Set() };
  });
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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

  // ID справочников, связанных с подложками фасадов/благоустройства (исключаются из шахматки)
  const [excludedWorkTypes, setExcludedWorkTypes] = useState<Set<string>>(new Set());
  const [excludedFloors, setExcludedFloors] = useState<Set<string>>(new Set());
  const [excludedConstructions, setExcludedConstructions] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!project) return;
    const { data } = await supabase
      .from("cells")
      .select(`
        id, name, status, progress_percent, updated_at,
        building_id, floor_id, work_type_id, construction_id, set_id,
        dict_buildings(id, name),
        dict_floors(id, name, sort_order),
        dict_work_types(id, name),
        dict_constructions(id, name, sort_order),
        dict_sets(id, name)
      `)
      .eq("project_id", project.id)
      .eq("cell_type", "registry");

    // Загрузить все этажи справочника
    const { data: floorsData } = await supabase
      .from("dict_floors")
      .select("id, name, sort_order")
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true });

    // Загрузить подложки и их связи для определения фасадов/благоустройства
    const { data: overlaysData } = await supabase
      .from("dict_overlays")
      .select("id, tab_type")
      .eq("project_id", project.id);

    const overlayIds = (overlaysData || []).map((o: { id: string; tab_type: string | null }) => o.id);
    const overlayTabTypes = new Map<string, string | null>(
      (overlaysData || []).map((o: { id: string; tab_type: string | null }) => [o.id, o.tab_type])
    );

    let olConstructions: { overlay_id: string; construction_id: string }[] = [];
    let olFloors: { overlay_id: string; floor_id: string }[] = [];
    let wtOverlays: { work_type_id: string; overlay_id: string }[] = [];

    if (overlayIds.length > 0) {
      const [cRes, fRes, wRes] = await Promise.all([
        supabase.from("dict_overlay_constructions").select("overlay_id, construction_id").in("overlay_id", overlayIds),
        supabase.from("dict_overlay_floors").select("overlay_id, floor_id").in("overlay_id", overlayIds),
        supabase.from("dict_work_type_overlays").select("work_type_id, overlay_id").in("overlay_id", overlayIds),
      ]);
      olConstructions = (cRes.data || []) as { overlay_id: string; construction_id: string }[];
      olFloors = (fRes.data || []) as { overlay_id: string; floor_id: string }[];
      wtOverlays = (wRes.data || []) as { work_type_id: string; overlay_id: string }[];
    }

    // Определить какие подложки — фасады или благоустройство
    const overlaysWithConstructions = new Set(olConstructions.map((r) => r.overlay_id));

    const facadeLandscapingOverlays = new Set<string>();
    for (const oId of overlayIds) {
      const tabType = overlayTabTypes.get(oId);
      if (tabType) {
        // tab_type задан вручную
        if (tabType === "facades" || tabType === "landscaping") {
          facadeLandscapingOverlays.add(oId);
        }
      } else {
        // Автоопределение: есть конструкции → фасад или благоустройство
        if (overlaysWithConstructions.has(oId)) {
          facadeLandscapingOverlays.add(oId);
        }
      }
    }

    // Собрать исключаемые ID справочников
    const exclWT = new Set<string>();
    const exclFL = new Set<string>();
    const exclCN = new Set<string>();
    for (const r of wtOverlays) {
      if (facadeLandscapingOverlays.has(r.overlay_id)) exclWT.add(r.work_type_id);
    }
    for (const r of olFloors) {
      if (facadeLandscapingOverlays.has(r.overlay_id)) exclFL.add(r.floor_id);
    }
    for (const r of olConstructions) {
      if (facadeLandscapingOverlays.has(r.overlay_id)) exclCN.add(r.construction_id);
    }
    setExcludedWorkTypes(exclWT);
    setExcludedFloors(exclFL);
    setExcludedConstructions(exclCN);

    if (floorsData) {
      setAllFloors(floorsData.map((f: { id: string; name: string; sort_order: number }) => ({ id: f.id, name: f.name, sort: f.sort_order })));
    }

    if (data) {
      const mapped: ChessCell[] = (data as unknown as { id: string; name: string; status: string; progress_percent: number | null; updated_at: string; building_id: string | null; floor_id: string | null; work_type_id: string | null; construction_id: string | null; set_id: string | null; dict_buildings: { id: string; name: string } | null; dict_floors: { id: string; name: string; sort_order: number } | null; dict_work_types: { id: string; name: string } | null; dict_constructions: { id: string; name: string; sort_order: number } | null; dict_sets: { id: string; name: string } | null }[]).map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        progress_percent: c.progress_percent,
        updated_at: c.updated_at,
        building_id: c.building_id,
        building_name: c.dict_buildings?.name || null,
        floor_id: c.floor_id,
        floor_name: c.dict_floors?.name || null,
        floor_sort: c.dict_floors?.sort_order ?? 0,
        work_type_id: c.work_type_id,
        work_type_name: c.dict_work_types?.name || null,
        construction_id: c.construction_id,
        construction_name: c.dict_constructions?.name || null,
        construction_sort: c.dict_constructions?.sort_order ?? 0,
        set_id: c.set_id,
        set_name: c.dict_sets?.name || null,
      }));
      setCells(mapped);

    }
    setLoading(false);
  }, [project]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Уникальные значения для фильтров (исключая связанные с фасадами/благоустройством)
  const filterOptions = useMemo(() => {
    const buildings = new Map<string, string>();
    const workTypes = new Map<string, string>();
    const constructions = new Map<string, string>();
    const sets = new Map<string, string>();
    for (const c of cells) {
      if (c.building_id && c.building_name) buildings.set(c.building_id, c.building_name);
      if (c.work_type_id && c.work_type_name && !excludedWorkTypes.has(c.work_type_id))
        workTypes.set(c.work_type_id, c.work_type_name);
      if (c.construction_id && c.construction_name && !excludedConstructions.has(c.construction_id))
        constructions.set(c.construction_id, c.construction_name);
      if (c.set_id && c.set_name) sets.set(c.set_id, c.set_name);
    }
    return {
      building: Array.from(buildings.entries()).sort((a, b) => a[1].localeCompare(b[1], "ru")),
      workType: Array.from(workTypes.entries()).sort((a, b) => a[1].localeCompare(b[1], "ru")),
      construction: Array.from(constructions.entries()).sort((a, b) => a[1].localeCompare(b[1], "ru")),
      set: Array.from(sets.entries()).sort((a, b) => a[1].localeCompare(b[1], "ru")),
    };
  }, [cells, excludedWorkTypes, excludedConstructions]);

  // Сохранение фильтров в sessionStorage
  useEffect(() => {
    sessionStorage.setItem("chess_filters", JSON.stringify({
      building: Array.from(filters.building),
      workType: Array.from(filters.workType),
      construction: Array.from(filters.construction),
      set: Array.from(filters.set),
    }));
  }, [filters]);

  function toggleFilter(key: FilterKey, value: string) {
    setFilters((prev) => {
      const next = new Set(prev[key]);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...prev, [key]: next };
    });
  }

  function selectAllFilter(key: FilterKey) {
    const allIds = filterOptions[key].map(([id]) => id);
    setFilters((prev) => ({ ...prev, [key]: new Set(allIds) }));
  }

  function deselectAllFilter(key: FilterKey) {
    setFilters((prev) => ({ ...prev, [key]: new Set() }));
  }

  function resetAllFilters() {
    setFilters({ building: new Set(), workType: new Set(), construction: new Set(), set: new Set() });
  }

  // Фильтрация ячеек — только с этажом, исключая связанные с фасадами/благоустройством
  const filtered = useMemo(() => {
    return cells.filter((c) => {
      if (!c.floor_id) return false;
      // Исключить виды работ, уровни и конструкции подложек фасадов/благоустройства
      if (c.work_type_id && excludedWorkTypes.has(c.work_type_id)) return false;
      if (c.floor_id && excludedFloors.has(c.floor_id)) return false;
      if (c.construction_id && excludedConstructions.has(c.construction_id)) return false;
      // Пользовательские фильтры
      if (filters.building.size > 0 && (!c.building_id || !filters.building.has(c.building_id))) return false;
      if (filters.workType.size > 0 && (!c.work_type_id || !filters.workType.has(c.work_type_id))) return false;
      if (filters.construction.size > 0 && (!c.construction_id || !filters.construction.has(c.construction_id))) return false;
      if (filters.set.size > 0 && (!c.set_id || !filters.set.has(c.set_id))) return false;
      return true;
    });
  }, [cells, filters, excludedWorkTypes, excludedFloors, excludedConstructions]);

  // Построение матрицы
  const matrix = useMemo(() => {
    // Определить диапазон этажей с ячейками
    const usedFloorSorts = new Set<number>();
    for (const c of filtered) {
      if (c.floor_id) usedFloorSorts.add(c.floor_sort);
    }

    let floors: { id: string; name: string; sort: number }[];
    if (usedFloorSorts.size === 0) {
      floors = [];
    } else {
      const maxSort = Math.max(...usedFloorSorts);
      // Все этажи справочника от самого нижнего до максимального заполненного
      // (исключая этажи подложек фасадов/благоустройства)
      floors = allFloors
        .filter((f) => f.sort <= maxSort && !excludedFloors.has(f.id))
        .sort((a, b) => b.sort - a.sort);
    }

    // Комбинации (building × work_type)
    const colSet = new Set<string>();
    const colMap = new Map<string, { buildingId: string; buildingName: string; workTypeId: string; workTypeName: string }>();
    for (const c of filtered) {
      const bId = c.building_id || "_none";
      const bName = c.building_name || "Без места";
      const wtId = c.work_type_id || "_none";
      const wtName = c.work_type_name || "Без вида";
      const key = `${bId}|${wtId}`;
      if (!colSet.has(key)) {
        colSet.add(key);
        colMap.set(key, { buildingId: bId, buildingName: bName, workTypeId: wtId, workTypeName: wtName });
      }
    }
    const columns = Array.from(colMap.entries())
      .sort((a, b) => {
        const cmp = a[1].buildingName.localeCompare(b[1].buildingName, "ru");
        if (cmp !== 0) return cmp;
        return a[1].workTypeName.localeCompare(b[1].workTypeName, "ru");
      });

    // Заполнение ячеек матрицы — при одинаковых (место, вид, уровень, конструкция) оставляем только с наибольшим прогрессом
    const grid = new Map<string, ChessCell[]>();
    const dedup = new Map<string, ChessCell>();
    for (const c of filtered) {
      const bId = c.building_id || "_none";
      const wtId = c.work_type_id || "_none";
      const conId = c.construction_id || "_none";
      const uniqueKey = `${c.floor_id}|${bId}|${wtId}|${conId}`;
      const existing = dedup.get(uniqueKey);
      if (!existing || (c.progress_percent ?? 0) > (existing.progress_percent ?? 0)) {
        dedup.set(uniqueKey, c);
      }
    }
    for (const c of dedup.values()) {
      const bId = c.building_id || "_none";
      const wtId = c.work_type_id || "_none";
      const colKey = `${bId}|${wtId}`;
      const cellKey = `${c.floor_id}|${colKey}`;
      if (!grid.has(cellKey)) grid.set(cellKey, []);
      grid.get(cellKey)!.push(c);
    }
    // Сортировка конструкций: снизу вверх (sort_order 1 внизу) → по убыванию для flex-col
    for (const items of grid.values()) {
      items.sort((a, b) => b.construction_sort - a.construction_sort);
    }

    return { floors, columns, grid };
  }, [filtered, allFloors, excludedFloors]);

  function handlePrint() {
    window.print();
  }

  function formatShortDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const FILTER_LABELS: Record<FilterKey, string> = {
    building: "Место работ",
    workType: "Вид работ",
    construction: "Конструкции и зоны",
    set: "Комплект",
  };

  if (!hasPermission("can_preview_files")) {
    return (
      <div className="ds-card p-8 text-center" style={{ color: "var(--ds-text-faint)" }}>
        У вас нет доступа к просмотру шахматки
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-16" style={{ color: "var(--ds-text-faint)" }}>Загрузка данных...</div>;
  }

  return (
    <div>
      {/* Фильтры */}
      <div className={`ds-card ${isMobile ? "p-2 mb-3" : "p-3 mb-4"} print:hidden`}>
        <div className={`flex items-center gap-2 flex-wrap ${isMobile ? "gap-1.5" : ""}`}>
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => {
            const opts = filterOptions[key];
            if (opts.length === 0) return null;
            const selected = filters[key];
            const isOpen = openFilter === key;
            return (
              <div key={key} className="relative" ref={isOpen ? filterRef : undefined}>
                <button
                  ref={(el) => { filterBtnRefs.current[key] = el; }}
                  onClick={() => setOpenFilter(isOpen ? null : key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                  style={selected.size > 0
                    ? { background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "var(--ds-accent)" }
                    : { borderColor: "var(--ds-border)", color: "var(--ds-text-muted)" }}
                >
                  {FILTER_LABELS[key]}
                  {selected.size > 0 && (
                    <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] bg-blue-600 text-white rounded-full">
                      {selected.size}
                    </span>
                  )}
                  <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <DropdownPortal anchorRef={{ current: filterBtnRefs.current[key] ?? null }} open={isOpen} className="min-w-[200px] max-w-[280px] max-h-64 overflow-y-auto">
                    <div className="flex items-center gap-1 px-3 py-1.5" style={{ borderBottom: "1px solid var(--ds-border)" }}>
                      <button
                        onClick={() => selectAllFilter(key)}
                        className="text-xs" style={{ color: "var(--ds-accent)" }}
                      >
                        Выбрать все
                      </button>
                      <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>|</span>
                      <button
                        onClick={() => deselectAllFilter(key)}
                        className="text-xs" style={{ color: "var(--ds-text-faint)" }}
                      >
                        Снять все
                      </button>
                    </div>
                    {opts.map(([id, name]) => (
                      <label
                        key={id}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer" style={{ color: "var(--ds-text)" }}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(id)}
                          onChange={() => toggleFilter(key, id)}
                          className="rounded text-blue-600 focus:ring-blue-500" style={{ borderColor: "var(--ds-border)" }}
                        />
                        <span className="truncate">{name}</span>
                      </label>
                    ))}
                </DropdownPortal>
              </div>
            );
          })}

          {(filters.building.size > 0 || filters.workType.size > 0 || filters.construction.size > 0 || filters.set.size > 0) && (
            <button
              onClick={resetAllFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg transition-colors"
              style={{ color: "#ef4444" }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Сбросить
            </button>
          )}

          <div className={`${isMobile ? "" : "ml-auto"} flex items-center gap-3`}>
            <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{filtered.length} ячеек</span>
            {matrix.floors.length > 0 && !isMobile && (
              <>
                {hasPermission("can_print") && (
                  <button
                    onClick={handlePrint}
                    className="ds-btn-secondary flex items-center gap-1.5 print:hidden"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Печать
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Шахматка */}
      {matrix.floors.length === 0 || matrix.columns.length === 0 ? (
        <div className="ds-card px-4 py-16 text-center">
          <svg className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <h3 className="font-medium mb-1" style={{ color: "var(--ds-text)" }}>Нет данных для отображения</h3>
          <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>
            {cells.length === 0
              ? "В проекте нет ячеек. Создайте их в реестре."
              : "Выберите фильтры или добавьте ячейкам уровни, места и виды работ."}
          </p>
        </div>
      ) : (
        <div className="ds-card overflow-hidden print:border-0 print:rounded-none">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="border-collapse">
              <thead>
                <tr style={{ background: "var(--ds-surface-sunken)" }}>
                  <th className="px-3 py-2 text-xs font-medium sticky left-0 z-10 min-w-[100px]" style={{ color: "var(--ds-text-muted)", border: "1px solid var(--ds-border)", background: "var(--ds-surface-sunken)" }}>
                    Уровень
                  </th>
                  {matrix.columns.map(([key, col]) => (
                    <th key={key} className="px-1 py-2 text-xs font-medium" style={{ color: "var(--ds-text-muted)", border: "1px solid var(--ds-border)" }}>
                      <div style={{ color: "var(--ds-text)" }}>{col.buildingName}</div>
                      <div className="font-normal" style={{ color: "var(--ds-text-faint)" }}>{col.workTypeName}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.floors.map((floor) => (
                  <tr key={floor.id}>
                    <td className="px-3 py-2 text-sm font-medium sticky left-0 z-10" style={{ color: "var(--ds-text)", border: "1px solid var(--ds-border)", background: "var(--ds-surface)" }}>
                      {floor.name}
                    </td>
                    {matrix.columns.map(([colKey]) => {
                      const cellKey = `${floor.id}|${colKey}`;
                      const items = matrix.grid.get(cellKey) || [];
                      return (
                        <td key={colKey} className="px-1 py-1 align-top" style={{ border: "1px solid var(--ds-border)" }}>
                          {items.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {items.map((item) => (
                                <div
                                  key={item.id}
                                  onClick={() => setDetailCellId(item.id)}
                                  className={`relative rounded px-1.5 py-0.5 cursor-pointer group hover:ring-2 hover:ring-blue-400 transition-shadow ${getStatusBgClass(getColorKey(item.status))}`}
                                  title={`${item.name}\n${item.status}${item.progress_percent != null ? ` (${item.progress_percent}%)` : ""}\n${new Date(item.updated_at).toLocaleString("ru-RU")}`}
                                >
                                  <div className="text-[10px] font-medium truncate leading-tight ds-chess-cell-text">
                                    {item.construction_name || item.name}
                                  </div>
                                  <div className="text-[9px] leading-tight ds-chess-cell-text">
                                    {formatShortDate(item.updated_at)}
                                  </div>
                                  {item.progress_percent != null && (
                                    <div className="h-1 bg-white/50 rounded-full mt-0.5 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          item.progress_percent <= 30 ? "bg-red-600" : item.progress_percent <= 70 ? "bg-yellow-600" : "bg-green-600"
                                        }`}
                                        style={{ width: `${item.progress_percent}%` }}
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Легенда */}
      <div className={`ds-card ${isMobile ? "mt-2 p-2" : "mt-4 p-3"} print:hidden`}>
        <div className={`${isMobile ? "text-[10px]" : "text-xs"} mb-2`} style={{ color: "var(--ds-text-muted)" }}>Легенда статусов:</div>
        <div className={`flex flex-wrap ${isMobile ? "gap-1" : "gap-2"}`}>
          {statuses.map((s) => (
            <span key={s.id} className={`inline-block ${isMobile ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"} rounded-full font-medium ${getStatusBadgeClass(s.color_key)}`}>
              {s.name}
            </span>
          ))}
        </div>
      </div>

      {detailCellId && (
        <CellDetailModal
          cellId={detailCellId}
          onClose={() => setDetailCellId(null)}
          onUpdated={loadData}
        />
      )}
    </div>
  );
}
