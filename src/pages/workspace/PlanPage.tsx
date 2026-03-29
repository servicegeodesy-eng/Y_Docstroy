import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DropdownPortal from "@/components/ui/DropdownPortal";
import { useMobile } from "@/lib/MobileContext";
import { useDictionaries } from "@/hooks/useDictionaries";
import { getOverlayUrl, preloadOverlayUrls } from "@/lib/overlayUrlCache";
import { useOverlays } from "@/hooks/useOverlays";
import { useCellMasks } from "@/hooks/useCellMasks";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { useDictLinks } from "@/hooks/useDictLinks";
import { useProject } from "@/lib/ProjectContext";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import PlanCanvas from "@/components/plan/PlanCanvas";
import type { WorkMaskData } from "@/components/plan/PlanCanvas";
import ChessboardReport from "@/pages/workspace/ChessboardReport";

import CellDetailModal from "@/components/registry/CellDetailModal";
import RequestDetailModal from "@/components/requests/RequestDetailModal";
import WorkDetailModal from "@/components/installation/WorkDetailModal";
import type { InstallationWork } from "@/components/installation/WorkCard";
import type { LinkMap } from "@/hooks/useDictLinks";
import type { Overlay } from "@/types";
import type { MaskWithCell } from "@/hooks/useCellMasks";

/**
 * Режим фильтрации подложек по типу связей:
 * - plan: только Место работ + Вид работ (без уровней и конструкций)
 * - facades: все 4 связи (Место работ + Вид работ + Уровни/срезы + Конструкция)
 * - landscaping: 3 связи (Место работ + Вид работ + Конструкция) без Уровней
 */
export type OverlayMode = "plan" | "facades" | "landscaping" | "roof" | "floors" | "walls" | "frame" | "territory" | "earthwork" | "foundation" | "shoring" | "piles";

const MODE_TITLES: Record<OverlayMode, string> = {
  plan: "План",
  facades: "Фасады",
  landscaping: "Благоустройство",
  roof: "Кровля",
  floors: "Полы и потолки",
  walls: "Стены",
  frame: "Каркас",
  territory: "Территория строительства",
  earthwork: "Объёмы земляных масс",
  foundation: "Основание",
  shoring: "Ограждение котлована",
  piles: "Сваи",
};

interface Props {
  mode?: OverlayMode;
}

/** Фильтрует подложки по tab_type (приоритет) или автоопределению по связям */
function filterOverlaysByMode(
  allOverlays: Overlay[],
  overlayBuildings: LinkMap,
  workTypeOverlays: LinkMap,
  overlayFloors: LinkMap,
  overlayConstructions: LinkMap,
  mode: OverlayMode,
): Set<string> {
  const overlaysWithWorkTypes = new Set<string>();
  for (const wtOverlays of Object.values(workTypeOverlays)) {
    for (const oId of wtOverlays) overlaysWithWorkTypes.add(oId);
  }

  const result = new Set<string>();

  for (const o of allOverlays) {
    // Если tab_type задан — показываем только на указанной вкладке
    if (o.tab_type) {
      if (o.tab_type === mode) result.add(o.id);
      continue;
    }

    // tab_type не задан — автоопределение по типам связей
    const hasFloor = (overlayFloors[o.id]?.length || 0) > 0;
    const hasConstruction = (overlayConstructions[o.id]?.length || 0) > 0;
    const hasBuilding = (overlayBuildings[o.id]?.length || 0) > 0;
    const hasWorkType = overlaysWithWorkTypes.has(o.id);
    if (!hasBuilding && !hasWorkType && !hasFloor && !hasConstruction) continue;

    let autoType: OverlayMode;
    if (hasFloor && hasConstruction) autoType = "facades";
    else if (hasConstruction) autoType = "landscaping";
    else autoType = "plan";

    if (autoType === mode) result.add(o.id);
  }
  return result;
}

const STORAGE_PREFIX = "plan_sel_";

interface SavedSelection {
  building: string; workType: string; floor: string; construction: string; overlay: string;
}

function loadSaved(mode: string): SavedSelection {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + mode);
    const parsed = raw ? JSON.parse(raw) : {};
    return { building: parsed.building || "", workType: parsed.workType || "", floor: parsed.floor || "", construction: parsed.construction || "", overlay: parsed.overlay || "" };
  } catch { return { building: "", workType: "", floor: "", construction: "", overlay: "" }; }
}

const CONSTRUCTION_MODES: Set<OverlayMode> = new Set(["facades", "landscaping", "roof", "floors", "walls", "frame", "territory", "earthwork", "foundation", "shoring", "piles"]);

export default function PlanPage({ mode = "plan" }: Props) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useProject();
  const { isMobile } = useMobile();
  const { buildings, workTypes, floors, constructions, works, loadDicts } = useDictionaries();
  const {
    overlays, workTypeOverlays,
    overlayBuildings, overlayFloors, overlayConstructions, overlayWorks,
    loading: overlaysLoading,
  } = useOverlays();
  const { statuses, getColorKey } = useProjectStatuses();
  const { buildingWorkTypes } = useDictLinks();

  const [selBuilding, setSelBuilding] = useState(() => loadSaved(mode).building);
  const [selWorkType, setSelWorkType] = useState(() => loadSaved(mode).workType);
  const [selFloor, setSelFloor] = useState(() => loadSaved(mode).floor);
  const [selConstruction, setSelConstruction] = useState(() => loadSaved(mode).construction);
  const [selOverlay, setSelOverlay] = useState(() => loadSaved(mode).overlay);
  const [selWork, setSelWork] = useState("");
  const [viewMode, setViewMode] = useState<"overlay" | "chessboard">("overlay");
  const [hasZoneWorkTypes, setHasZoneWorkTypes] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [detailCellId, setDetailCellId] = useState<string | null>(null);
  const [detailRequestId, setDetailRequestId] = useState<string | null>(null);
  const [detailWorkId, setDetailWorkId] = useState<string | null>(null);
  const [detailWork, setDetailWork] = useState<InstallationWork | null>(null);
  const prevMode = useRef(mode);

  const canViewRequests = hasPermission("can_view_requests");

  const { masks, loading: masksLoading, reload: reloadMasks } = useCellMasks(selOverlay || null);

  // Маски заявок (cell_type = 'request') — загружаются при выборе фильтра "Работы"
  const [requestMasks, setRequestMasks] = useState<MaskWithCell[]>([]);

  const loadRequestMasks = useCallback(async () => {
    if (!selOverlay || !selWork || !canViewRequests) {
      setRequestMasks([]);
      return;
    }
    const { data } = await supabase
      .from("cell_overlay_masks")
      .select(`
        *,
        cells!inner (
          name, status, updated_at, progress_percent,
          building_id, work_type_id, floor_id, construction_id, set_id,
          cell_type, work_id
        )
      `)
      .eq("overlay_id", selOverlay)
      .eq("cells.cell_type", "request")
      .eq("cells.work_id", selWork);

    if (data) {
      setRequestMasks(
        data.map((row: { id: string; cell_id: string; overlay_id: string; polygon_points: { x: number; y: number }[]; created_at: string; updated_at: string; cells: { name: string; status: string; updated_at: string; progress_percent: number | null; building_id: string | null; work_type_id: string | null; floor_id: string | null; construction_id: string | null; set_id: string | null } }) => ({
          id: row.id,
          cell_id: row.cell_id,
          overlay_id: row.overlay_id,
          polygon_points: row.polygon_points,
          created_at: row.created_at,
          updated_at: row.updated_at,
          cell_name: row.cells.name,
          cell_status: row.cells.status,
          cell_updated_at: row.cells.updated_at,
          cell_progress_percent: row.cells.progress_percent,
          cell_building_id: row.cells.building_id,
          cell_work_type_id: row.cells.work_type_id,
          cell_floor_id: row.cells.floor_id,
          cell_construction_id: row.cells.construction_id,
          cell_set_id: row.cells.set_id,
        }))
      );
    }
  }, [selOverlay, selWork, canViewRequests]);

  useEffect(() => {
    loadRequestMasks();
  }, [loadRequestMasks]);

  // Маски работ монтажа — загружаются для текущей подложки
  const [workMasks, setWorkMasks] = useState<WorkMaskData[]>([]);

  const loadWorkMasks = useCallback(async () => {
    if (!selOverlay) { setWorkMasks([]); return; }
    const res = await api.get<WorkMaskData[]>("/api/installation/masks", { overlay_id: selOverlay });
    if (res.data) setWorkMasks(res.data);
    else setWorkMasks([]);
  }, [selOverlay]);

  useEffect(() => {
    loadWorkMasks();
  }, [loadWorkMasks]);

  // Load work detail when clicking a work mask
  useEffect(() => {
    if (!detailWorkId) { setDetailWork(null); return; }
    api.get<InstallationWork>(`/api/installation/works/${detailWorkId}`).then((res) => {
      if (res.data) setDetailWork(res.data);
    });
  }, [detailWorkId]);

  useEffect(() => {
    loadDicts();
  }, [loadDicts]);

  // Проверить наличие связей зоны с видами работ (для переключателя шахматки)
  useEffect(() => {
    if (!CONSTRUCTION_MODES.has(mode)) return;
    supabase
      .from("dict_zone_work_types")
      .select("id")
      .eq("project_id", projectId!)
      .eq("zone_type", mode)
      .limit(1)
      .then(({ data }) => setHasZoneWorkTypes((data?.length || 0) > 0));
  }, [mode, projectId]);

  const showFloor = true;
  const showConstruction = true;

  // Сохранение выбора в sessionStorage
  useEffect(() => {
    sessionStorage.setItem(STORAGE_PREFIX + mode, JSON.stringify({
      building: selBuilding, workType: selWorkType, floor: selFloor, construction: selConstruction, overlay: selOverlay,
    }));
  }, [mode, selBuilding, selWorkType, selFloor, selConstruction, selOverlay]);

  // Подложки, подходящие под режим (по наличию связей)
  const allowedOverlayIds = useMemo(() => {
    return filterOverlaysByMode(
      overlays,
      overlayBuildings,
      workTypeOverlays,
      overlayFloors,
      overlayConstructions,
      mode,
    );
  }, [overlays, overlayBuildings, workTypeOverlays, overlayFloors, overlayConstructions, mode]);

  // ID видов работ, связанных с допустимыми подложками
  const overlayWorkTypeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [wtId, oIds] of Object.entries(workTypeOverlays)) {
      if (oIds.some((oId) => allowedOverlayIds.has(oId))) {
        ids.add(wtId);
      }
    }
    return ids;
  }, [workTypeOverlays, allowedOverlayIds]);

  // Места работ, напрямую связанные с допустимыми подложками
  const filteredBuildings = useMemo(() => {
    const validBuildingIds = new Set<string>();
    for (const oId of allowedOverlayIds) {
      const bIds = overlayBuildings[oId];
      if (bIds) bIds.forEach((id) => validBuildingIds.add(id));
    }
    return buildings.filter((b) => validBuildingIds.has(b.id));
  }, [buildings, allowedOverlayIds, overlayBuildings]);

  // Виды работ с допустимыми подложками, отфильтрованные по выбранному месту работ
  const filteredWorkTypes = useMemo(() => {
    const withOverlays = workTypes.filter((wt) => overlayWorkTypeIds.has(wt.id));
    if (!selBuilding) return withOverlays;
    const hasLinks = Object.keys(buildingWorkTypes).length > 0;
    if (!hasLinks) return withOverlays;
    const linkedWtIds = buildingWorkTypes[selBuilding] || [];
    return withOverlays.filter((wt) => linkedWtIds.includes(wt.id));
  }, [workTypes, overlayWorkTypeIds, selBuilding, buildingWorkTypes]);

  // Уровни, напрямую связанные с допустимыми подложками
  const filteredFloors = useMemo(() => {
    if (!showFloor) return [];
    const validIds = new Set<string>();
    for (const oId of allowedOverlayIds) {
      const fIds = overlayFloors[oId];
      if (fIds) fIds.forEach((id) => validIds.add(id));
    }
    return floors.filter((f) => validIds.has(f.id));
  }, [floors, allowedOverlayIds, overlayFloors, showFloor]);

  // Конструкции, напрямую связанные с допустимыми подложками
  const filteredConstructions = useMemo(() => {
    if (!showConstruction) return [];
    const validIds = new Set<string>();
    for (const oId of allowedOverlayIds) {
      const cIds = overlayConstructions[oId];
      if (cIds) cIds.forEach((id) => validIds.add(id));
    }
    return constructions.filter((c) => validIds.has(c.id));
  }, [constructions, allowedOverlayIds, overlayConstructions, showConstruction]);

  // Обратная карта: overlay_id → связан ли с видами работ
  const overlaysWithWorkTypes = useMemo(() => {
    const set = new Set<string>();
    for (const oIds of Object.values(workTypeOverlays)) {
      for (const oId of oIds) set.add(oId);
    }
    return set;
  }, [workTypeOverlays]);

  // Подложки, отфильтрованные по всем выбранным справочникам
  // Для каждого типа связи: если у подложки есть связь — выбранное значение должно совпадать;
  // если связи нет — не фильтруем по этому типу
  const filteredOverlays = useMemo(() => {
    return overlays.filter((o) => {
      if (!allowedOverlayIds.has(o.id)) return false;

      const hasWorkTypeLink = overlaysWithWorkTypes.has(o.id);
      const hasBuildingLink = (overlayBuildings[o.id]?.length || 0) > 0;
      const hasFloorLink = (overlayFloors[o.id]?.length || 0) > 0;
      const hasConstructionLink = (overlayConstructions[o.id]?.length || 0) > 0;

      if (!hasWorkTypeLink && !hasBuildingLink && !hasFloorLink && !hasConstructionLink) return false;

      if (hasWorkTypeLink) {
        if (!selWorkType) return false;
        const wtOverlays = workTypeOverlays[selWorkType] || [];
        if (!wtOverlays.includes(o.id)) return false;
      }
      if (hasBuildingLink) {
        if (!selBuilding || !overlayBuildings[o.id].includes(selBuilding)) return false;
      }
      if (hasFloorLink) {
        if (!selFloor || !overlayFloors[o.id].includes(selFloor)) return false;
      }
      if (hasConstructionLink) {
        if (!selConstruction || !overlayConstructions[o.id].includes(selConstruction)) return false;
      }
      return true;
    });
  }, [overlays, allowedOverlayIds, overlaysWithWorkTypes, selWorkType, workTypeOverlays, selBuilding, overlayBuildings, selFloor, overlayFloors, selConstruction, overlayConstructions]);

  // Маски, отфильтрованные по всем выбранным фильтрам
  const filteredMasks = useMemo(() => {
    return masks.filter((m) => {
      if (selBuilding && m.cell_building_id !== selBuilding) return false;
      if (selWorkType && m.cell_work_type_id !== selWorkType) return false;
      if (selFloor && m.cell_floor_id !== selFloor) return false;
      if (selConstruction && m.cell_construction_id !== selConstruction) return false;
      return true;
    });
  }, [masks, selBuilding, selWorkType, selFloor, selConstruction]);

  // Автоматический выбор подложки (всегда первая подходящая)
  useEffect(() => {
    if (filteredOverlays.length >= 1) {
      const currentStillValid = selOverlay && filteredOverlays.find((o) => o.id === selOverlay);
      if (!currentStillValid) {
        setSelOverlay(filteredOverlays[0].id);
      }
    } else {
      setSelOverlay("");
    }
  }, [filteredOverlays, selOverlay]);

  // Предзагрузка URL для всех отфильтрованных подложек
  useEffect(() => {
    if (filteredOverlays.length > 0) {
      preloadOverlayUrls(filteredOverlays.map((o) => o.storage_path));
    }
  }, [filteredOverlays]);

  // Загрузка URL изображения (из кеша или с генерацией signed URL)
  useEffect(() => {
    if (!selOverlay) {
      setImageUrl(null);
      return;
    }
    const overlay = overlays.find((o) => o.id === selOverlay);
    if (!overlay) return;
    let cancelled = false;
    getOverlayUrl(overlay.storage_path).then((url) => {
      if (!cancelled && url) setImageUrl(url);
    });
    return () => { cancelled = true; };
  }, [selOverlay, overlays]);

  function handleBuildingChange(v: string) {
    setSelBuilding(v);
    if (v && selWorkType) {
      const hasLinks = Object.keys(buildingWorkTypes).length > 0;
      if (hasLinks) {
        const linkedWtIds = buildingWorkTypes[v] || [];
        if (!linkedWtIds.includes(selWorkType)) {
          setSelWorkType("");
          setSelOverlay("");
        }
      }
    }
  }

  function handleWorkTypeChange(v: string) {
    setSelWorkType(v);
  }

  // Восстановление сохранённого выбора при смене режима
  useEffect(() => {
    if (prevMode.current === mode) return;
    prevMode.current = mode;
    const saved = loadSaved(mode);
    setSelBuilding(saved.building);
    setSelWorkType(saved.workType);
    setSelFloor(saved.floor);
    setSelConstruction(saved.construction);
    setSelOverlay(saved.overlay);
    setImageUrl(null);
  }, [mode]);

  const selectedOverlay = overlays.find((o) => o.id === selOverlay);
  const title = MODE_TITLES[mode];

  const [openFilter, setOpenFilter] = useState<string | null>(null);
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

  // Работы, привязанные к текущей подложке
  const filteredWorks = useMemo(() => {
    if (!canViewRequests || !selOverlay) return [];
    const workIds = overlayWorks[selOverlay] || [];
    if (workIds.length === 0) return works;
    return works.filter((w) => workIds.includes(w.id));
  }, [canViewRequests, selOverlay, overlayWorks, works]);

  const filterDefs = [
    { key: "building", label: "Место работ", value: selBuilding, items: filteredBuildings, onChange: handleBuildingChange },
    { key: "workType", label: "Вид работ", value: selWorkType, items: filteredWorkTypes, onChange: handleWorkTypeChange },
    { key: "floor", label: "Уровни/срезы", value: selFloor, items: filteredFloors, onChange: (v: string) => setSelFloor(v) },
    { key: "construction", label: "Конструкция", value: selConstruction, items: filteredConstructions, onChange: (v: string) => setSelConstruction(v) },
    ...(filteredOverlays.length > 1
      ? [{ key: "overlay", label: "Подложка", value: selOverlay, items: filteredOverlays, onChange: (v: string) => setSelOverlay(v) }]
      : []),
    ...(canViewRequests && filteredWorks.length > 0
      ? [{ key: "work", label: "Выполняемая работа", value: selWork, items: filteredWorks, onChange: (v: string) => setSelWork(v) }]
      : []),
  ];

  const hasActiveFilters = !!(selBuilding || selWorkType || selFloor || selConstruction || selWork);
  const activeFilterCount = [selBuilding, selWorkType, selFloor, selConstruction, selWork].filter(Boolean).length;

  function clearAllFilters() {
    setSelBuilding(""); setSelWorkType(""); setSelFloor(""); setSelConstruction(""); setSelOverlay(""); setSelWork("");
  }

  if (!hasPermission("can_preview_files")) {
    return (
      <div className="ds-card p-8 text-center" style={{ color: "var(--ds-text-faint)" }}>
        У вас нет доступа к просмотру подложек
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className={`flex items-center justify-between ${isMobile ? "mb-1" : "mb-2"}`}>
        <div className="flex items-center gap-2">
          {CONSTRUCTION_MODES.has(mode) && (
            <button
              onClick={() => navigate(`/projects/${projectId}/construction`)}
              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--ds-surface-raised)]"
              style={{ color: "var(--ds-text-muted)" }}
              title="Назад к процессу строительства"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h2 className={`font-semibold ${isMobile ? "text-lg" : "text-xl"}`} style={{ color: "var(--ds-text)" }}>{title}</h2>
        </div>
        <div className="flex items-center gap-2" data-print-hide>
          {CONSTRUCTION_MODES.has(mode) && hasZoneWorkTypes && (
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--ds-border)" }}>
              <button
                onClick={() => setViewMode("overlay")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
                style={viewMode === "overlay"
                  ? { background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }
                  : { color: "var(--ds-text-muted)" }}
                title="Подложка"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                {!isMobile && "Подложка"}
              </button>
              <div className="w-px" style={{ background: "var(--ds-border)" }} />
              <button
                onClick={() => setViewMode("chessboard")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
                style={viewMode === "chessboard"
                  ? { background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }
                  : { color: "var(--ds-text-muted)" }}
                title="Шахматка"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                {!isMobile && "Шахматка"}
              </button>
            </div>
          )}
          {hasPermission("can_print") && !isMobile && (
            <button
              onClick={() => window.print()}
              className="ds-btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Печать
            </button>
          )}
        </div>
      </div>

      {/* Шахматка — режим зоны */}
      {viewMode === "chessboard" && CONSTRUCTION_MODES.has(mode) ? (
        <ChessboardReport zoneMode={mode} />
      ) : (
      <>
      {/* Фильтры — стиль шахматки */}
      <div className={`ds-card ${isMobile ? "p-2" : "p-3"} space-y-2`} data-print-hide>
        <div className={`flex items-center gap-2 flex-wrap ${isMobile ? "gap-1.5" : ""}`} ref={filterRef}>
          {filterDefs.map(({ key, label, value, items, onChange }) => {
            if (items.length === 0 && !value) return null;
            const isOpen = openFilter === key;
            const selectedName = items.find((i) => i.id === value)?.name;
            return (
              <div key={key} className="relative">
                <button
                  ref={(el) => { filterBtnRefs.current[key] = el; }}
                  onClick={() => setOpenFilter(isOpen ? null : key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                  style={value
                    ? { background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "var(--ds-accent)" }
                    : { borderColor: "var(--ds-border)", color: "var(--ds-text-muted)" }}
                >
                  {label}
                  {selectedName && (
                    <span className="max-w-[120px] truncate font-normal" style={{ color: "var(--ds-accent)" }}>: {selectedName}</span>
                  )}
                  <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <DropdownPortal anchorRef={{ current: filterBtnRefs.current[key] ?? null }} open={isOpen} className="min-w-[200px] max-w-[280px] max-h-64 overflow-y-auto">
                    <button
                      onClick={() => { onChange(""); setOpenFilter(null); }}
                      className="w-full text-left px-3 py-1.5 text-sm"
                      style={!value ? { color: "var(--ds-accent)", fontWeight: 500 } : { color: "var(--ds-text-muted)" }}
                    >
                      Все
                    </button>
                    {items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { onChange(item.id); setOpenFilter(null); }}
                        className="w-full text-left px-3 py-1.5 text-sm truncate"
                        style={value === item.id
                          ? { color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", fontWeight: 500 }
                          : { color: "var(--ds-text)" }}
                      >
                        {item.name}
                      </button>
                    ))}
                </DropdownPortal>
              </div>
            );
          })}

          {/* Подложка — одна: просто бейдж */}
          {filteredOverlays.length === 1 && selectedOverlay && (
            <span className="px-3 py-1.5 text-xs font-medium rounded-lg" style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text-muted)", border: "1px solid var(--ds-border)" }}>
              {selectedOverlay.name}
            </span>
          )}

          {hasActiveFilters && (
            <>
              <div className="w-px h-5" style={{ background: "var(--ds-border)" }} />
              <button onClick={clearAllFilters} className="text-xs font-medium whitespace-nowrap" style={{ color: "#ef4444" }}>
                Сбросить ({activeFilterCount})
              </button>
            </>
          )}

          {selOverlay && !masksLoading && (
            <>
              <div className="w-px h-5" style={{ background: "var(--ds-border)" }} />
              <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Ячеек: {filteredMasks.length}</span>
            </>
          )}
        </div>
      </div>

      {/* Содержимое */}
      {!selOverlay && filteredOverlays.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-sm" style={{ color: "var(--ds-text-faint)" }}>
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p>Выберите фильтры, связанные с подложкой</p>
            {allowedOverlayIds.size === 0 && !overlaysLoading && (
              <p className="text-xs mt-1" style={{ color: "var(--ds-text-faint)" }}>
                Нет подложек для этой вкладки.
                <br />Добавьте подложки в разделе Админ.
              </p>
            )}
          </div>
        </div>
      ) : !selOverlay ? (
        <div className="flex items-center justify-center h-64 text-sm" style={{ color: "var(--ds-text-faint)" }}>
          <p>Для выбранных фильтров нет подложек</p>
        </div>
      ) : !imageUrl ? (
        <div className="flex items-center justify-center h-64">
          <div className="ds-spinner" />
        </div>
      ) : (
        <div data-print-fit>
          <PlanCanvas
            imageUrl={imageUrl}
            imageWidth={selectedOverlay?.width || 1000}
            imageHeight={selectedOverlay?.height || 750}
            masks={selWork ? [] : filteredMasks}
            requestMasks={selWork ? requestMasks : []}
            workMasks={workMasks}
            getColorKey={getColorKey}
            onMaskClick={(cellId) => setDetailCellId(cellId)}
            onRequestMaskClick={(cellId) => setDetailRequestId(cellId)}
            onWorkMaskClick={(workId) => setDetailWorkId(workId)}
            legend={selWork
              ? [{ name: "Заявки", colorKey: "orange" }]
              : statuses.map((s) => ({ name: s.name, colorKey: s.color_key }))}
          />
        </div>
      )}

      </>
      )}

      {/* Модал деталей ячейки */}
      {detailCellId && (
        <CellDetailModal
          cellId={detailCellId}
          onClose={() => setDetailCellId(null)}
          onUpdated={reloadMasks}
        />
      )}

      {/* Модал деталей заявки */}
      {detailRequestId && (
        <RequestDetailModal
          cellId={detailRequestId}
          onClose={() => setDetailRequestId(null)}
          onUpdated={() => loadRequestMasks()}
          onAcknowledged={() => {}}
        />
      )}

      {/* Модал деталей работы монтажа */}
      {detailWork && (
        <WorkDetailModal
          workId={detailWork.id}
          onClose={() => { setDetailWorkId(null); setDetailWork(null); }}
          onUpdated={() => { setDetailWorkId(null); setDetailWork(null); loadWorkMasks(); }}
        />
      )}
    </div>
  );
}
