import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { shortName } from "@/lib/utils";
import type { ProfileShort } from "@/lib/utils";
import type { RequestFilterKey } from "@/components/requests/RequestFilters";
import { getStoredPageSize } from "@/components/ui/Pagination";
import { usePagination } from "@/components/ui/Pagination";
import { useRowScale } from "@/components/ui/RowScaleButton";

export interface RequestRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  created_by: string;
  assigned_to: string | null;
  assigned_by: string | null;
  original_sender_id: string | null;
  send_type: string | null;
  request_work_type: string | null;
  dict_buildings: { name: string } | null;
  dict_floors: { name: string } | null;
  dict_work_types: { name: string } | null;
  dict_constructions: { name: string } | null;
  cell_files: { id: string; file_name: string; storage_path: string }[];
  cell_public_comments: { count: number }[];
  creator: ProfileShort | null;
  assignee: ProfileShort | null;
  assigner: ProfileShort | null;
}

export type Tab = "inwork" | "done";

export const STATUS_STYLES: Record<string, { background: string; color: string }> = {
  "В работе": { background: "color-mix(in srgb, #f59e0b 15%, var(--ds-surface))", color: "#f59e0b" },
  "Выполнено": { background: "color-mix(in srgb, #22c55e 15%, var(--ds-surface))", color: "#22c55e" },
  "Отклонено": { background: "color-mix(in srgb, #ef4444 15%, var(--ds-surface))", color: "#ef4444" },
};

export function useRequestsData() {
  const { project, isProjectAdmin, isAdmin, isPortalAdmin, hasPermission } = useProject();
  const { user } = useAuth();
  const [cells, setCells] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showPermissions, setShowPermissions] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("inwork");
  const [allRequests, setAllRequests] = useState(false);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [allAcknowledgedIds, setAllAcknowledgedIds] = useState<Set<string>>(new Set());
  const [completedAtMap, setCompletedAtMap] = useState<Record<string, string>>({});

  // Фильтры
  const emptyFilters: Record<RequestFilterKey, Set<string>> = { requestWorkType: new Set(), building: new Set(), workType: new Set(), floor: new Set(), construction: new Set() };
  const [filters, setFilters] = useState<Record<RequestFilterKey, Set<string>>>(emptyFilters);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [openFilter, setOpenFilter] = useState<RequestFilterKey | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  // Модалки
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(getStoredPageSize);
  const { scale, cycleScale } = useRowScale();
  const [showCreate, setShowCreate] = useState(false);
  const [detailCellId, setDetailCellId] = useState<string | null>(null);
  const [executeCell, setExecuteCell] = useState<{ id: string; name: string } | null>(null);
  const [rejectCell, setRejectCell] = useState<{ id: string; name: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<{ fileName: string; storagePath: string } | null>(null);

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

  async function handleStatusChange(cellId: string, currentStatus: string, newStatus: string) {
    if (!user || newStatus === currentStatus) return;
    const prev = [...cells];
    setCells((p) => p.map((c) => c.id === cellId ? { ...c, status: newStatus } : c));
    try {
      const { error } = await supabase.from("cells").update({ status: newStatus }).eq("id", cellId);
      if (error) throw error;
      await supabase.from("cell_history").insert({
        cell_id: cellId, user_id: user.id, action: "status_changed",
        details: { from: currentStatus, to: newStatus },
      });
    } catch {
      setCells(prev);
    }
  }

  const canView = hasPermission("can_view_requests");
  const canCreate = hasPermission("can_create_requests");
  const canExecute = hasPermission("can_execute_requests");

  const [allLoaded, setAllLoaded] = useState(false);

  const loadCells = useCallback(async (loadAll = false) => {
    if (!project) return;
    let query = supabase
      .from("cells")
      .select(`
        id, name, description, status, created_at, created_by, assigned_to, assigned_by, original_sender_id, send_type, request_work_type,
        dict_buildings(name),
        dict_floors(name),
        dict_work_types(name),
        dict_constructions(name),
        cell_files(id, file_name, storage_path),
        cell_public_comments(count),
        creator:profiles!created_by(last_name, first_name, middle_name),
        assignee:profiles!assigned_to(last_name, first_name, middle_name),
        assigner:profiles!assigned_by(last_name, first_name, middle_name)
      `)
      .eq("project_id", project.id)
      .eq("cell_type", "request")
      .order("created_at", { ascending: false });
    if (!loadAll) query = query.limit(100);
    const { data, error } = await query;
    if (error) { setLoadError("Не удалось загрузить заявки"); setLoading(false); return; }
    if (data) setCells(data as unknown as RequestRow[]);
    setLoadError("");
    if (loadAll) setAllLoaded(true);
    setLoading(false);
  }, [project]);

  const loadAcknowledged = useCallback(async () => {
    if (!project || !user) return;
    // Загружаем все ознакомления проекта
    const { data } = await supabase
      .from("cell_history")
      .select("cell_id, user_id, cells!inner(project_id)")
      .eq("action", "request_acknowledged")
      .eq("cells.project_id", project.id);
    if (data) {
      const all = new Set(data.map((d: { cell_id: string }) => d.cell_id));
      const my = new Set(data.filter((d: { user_id: string }) => d.user_id === user.id).map((d: { cell_id: string }) => d.cell_id));
      setAllAcknowledgedIds(all);
      setAcknowledgedIds(my);
    }
  }, [project, user]);

  const loadCompletedDates = useCallback(async () => {
    if (!project) return;
    // Загружаем даты выполнения/отклонения заявок
    const { data } = await supabase
      .from("cell_history")
      .select("cell_id, created_at, action, cells!inner(project_id)")
      .eq("cells.project_id", project.id)
      .in("action", ["request_executed", "request_rejected", "status_changed"])
      .order("created_at", { ascending: false });
    if (data) {
      const map: Record<string, string> = {};
      for (const d of data as { cell_id: string; created_at: string; action: string }[]) {
        if (!map[d.cell_id]) map[d.cell_id] = d.created_at;
      }
      setCompletedAtMap(map);
    }
  }, [project]);

  useEffect(() => {
    loadCells();
    loadAcknowledged();
    loadCompletedDates();
  }, [loadCells, loadAcknowledged, loadCompletedDates]);

  async function handleAcknowledge(cellId: string) {
    if (!user) return;
    try {
      const { error } = await supabase.from("cell_history").insert({
        cell_id: cellId,
        user_id: user.id,
        action: "request_acknowledged",
        details: { status: "Ознакомлен" },
      });
      if (error) throw error;
      setAcknowledgedIds((prev) => new Set(prev).add(cellId));
    } catch {
      // insert failed — don't update local state
    }
  }

  // Фильтрация по вкладкам
  // "В работе" — исполнители видят все, создатели только свои
  const inworkCells = cells.filter((c) => {
    if (c.status !== "В работе") return false;
    if (canExecute) return true;
    return c.created_by === user?.id;
  });
  // "Выполнено" — заявки создателя + для исполнителей неознакомленные чужие, при allRequests все
  const doneCells = cells
    .filter((c) => {
      if (c.status !== "Выполнено" && c.status !== "Отклонено") return false;
      // Свои заявки — всегда видны
      if (c.created_by === user?.id) return true;
      // Все заявки — фильтр
      if (allRequests) return true;
      // Исполнители видят чужие неознакомленные
      if (canExecute && !allAcknowledgedIds.has(c.id)) return true;
      return false;
    })
    .sort((a, b) => {
      const dateA = completedAtMap[a.id] || a.created_at;
      const dateB = completedAtMap[b.id] || b.created_at;
      return dateB.localeCompare(dateA);
    });
  // Счётчик неознакомленных (только свои заявки)
  const unacknowledgedCount = cells.filter((c) =>
    (c.status === "Выполнено" || c.status === "Отклонено") &&
    c.created_by === user?.id &&
    !acknowledgedIds.has(c.id)
  ).length;

  const tabCells = activeTab === "inwork" ? inworkCells : doneCells;

  // Опции для фильтров (собираем из текущей вкладки)
  const filterOptions = useMemo(() => {
    const collect = (extractor: (c: RequestRow) => string | null | undefined) => {
      const s = new Set<string>();
      for (const c of tabCells) { const v = extractor(c); if (v) s.add(v); }
      return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
    };
    return {
      requestWorkType: collect((c) => c.request_work_type),
      building: collect((c) => c.dict_buildings?.name),
      workType: collect((c) => c.dict_work_types?.name),
      floor: collect((c) => c.dict_floors?.name),
      construction: collect((c) => c.dict_constructions?.name),
    };
  }, [tabCells]);

  // Применяем фильтры
  const filteredCells = tabCells.filter((cell) => {
    // Фильтр allRequests уже применён при формировании doneCells
    const f = filters;
    if (f.requestWorkType.size > 0 && !f.requestWorkType.has(cell.request_work_type || "")) return false;
    if (f.building.size > 0 && !f.building.has(cell.dict_buildings?.name || "")) return false;
    if (f.workType.size > 0 && !f.workType.has(cell.dict_work_types?.name || "")) return false;
    if (f.floor.size > 0 && !f.floor.has(cell.dict_floors?.name || "")) return false;
    if (f.construction.size > 0 && !f.construction.has(cell.dict_constructions?.name || "")) return false;
    if (dateFrom) {
      const d = new Date(cell.created_at).toISOString().slice(0, 10);
      if (d < dateFrom) return false;
    }
    if (dateTo) {
      const d = new Date(cell.created_at).toISOString().slice(0, 10);
      if (d > dateTo) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const fields = [cell.name, cell.dict_buildings?.name, cell.dict_work_types?.name, cell.request_work_type];
      if (!fields.some((v) => v?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const activeFilterCount = Object.values(filters).reduce((n, s) => n + s.size, 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (allRequests ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0 || !!search;

  useEffect(() => {
    if (hasActiveFilters && !allLoaded) loadCells(true);
  }, [hasActiveFilters, allLoaded, loadCells]);

  // Сброс страницы при смене фильтров/вкладки
  useEffect(() => { setPage(1); }, [filters, dateFrom, dateTo, search, activeTab]);

  const paginatedCells = usePagination(filteredCells, page, pageSize);

  function clearFilters() {
    setFilters({ requestWorkType: new Set(), building: new Set(), workType: new Set(), floor: new Set(), construction: new Set() });
    setDateFrom(""); setDateTo(""); setSearch(""); setAllRequests(false);
  }

  function toggleFilterValue(key: RequestFilterKey, value: string) {
    setFilters((prev) => {
      const next = new Set(prev[key]);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...prev, [key]: next };
    });
  }

  function getStatusUser(cell: RequestRow): string {
    if (cell.status === "В работе") return cell.assigned_to ? shortName(cell.assignee) : "Служба геодезии";
    if (cell.status === "Выполнено") return shortName(cell.creator);
    if (cell.status === "Отклонено") return shortName(cell.creator);
    return "";
  }

  return {
    // Auth / permissions
    user,
    isProjectAdmin,
    isAdmin,
    isPortalAdmin,
    canView,
    canCreate,
    canExecute,
    hasPermission,

    // Data
    cells,
    loading,
    loadError,
    inworkCells,
    doneCells,
    tabCells,
    filteredCells,
    paginatedCells,
    unacknowledgedCount,
    acknowledgedIds,

    // Tab
    activeTab,
    setActiveTab,

    // Filters
    filters,
    setFilters,
    filterOptions,
    openFilter,
    setOpenFilter,
    filterRef,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    search,
    setSearch,
    showSearch,
    setShowSearch,
    showFilters,
    setShowFilters,
    hasActiveFilters,
    activeFilterCount,
    allRequests,
    setAllRequests,
    clearFilters,
    toggleFilterValue,

    // Pagination / scale
    page,
    setPage,
    pageSize,
    setPageSize,
    scale,
    cycleScale,

    // Permissions panel
    showPermissions,
    setShowPermissions,

    // Modals
    showCreate,
    setShowCreate,
    detailCellId,
    setDetailCellId,
    executeCell,
    setExecuteCell,
    rejectCell,
    setRejectCell,
    previewFile,
    setPreviewFile,

    // Actions
    loadCells,
    loadAcknowledged,
    loadCompletedDates,
    handleStatusChange,
    handleAcknowledge,
    getStatusUser,
  };
}
