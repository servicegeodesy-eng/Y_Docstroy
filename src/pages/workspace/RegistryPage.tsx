import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { useMobile } from "@/lib/MobileContext";
import { downloadAsZip } from "@/lib/utils";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import RegistryFilters from "@/components/registry/RegistryFilters";
import Pagination, { usePagination, getStoredPageSize } from "@/components/ui/Pagination";
import RowScaleButton, { useRowScale } from "@/components/ui/RowScaleButton";
import { useRegistryCells } from "@/hooks/useRegistryCells";
import type { CellRow } from "@/hooks/useRegistryCells";
import { useRegistryFilters } from "@/hooks/useRegistryFilters";
import RegistryModals, { useRegistryModals } from "@/components/registry/RegistryModals";
import RegistryMobileView from "@/components/registry/RegistryMobileView";
import RegistryDesktopTable from "@/components/registry/RegistryDesktopTable";

type SortColumn = "date" | "name" | "building" | "floor" | "workType" | "construction" | "set" | "progress" | "status";
type SortDir = "asc" | "desc";

export default function RegistryPage() {
  const { project, hasPermission, isProjectAdmin } = useProject();
  const { user } = useAuth();
  const { isMobile } = useMobile();
  const { statuses, getColorKey } = useProjectStatuses();
  const { scale, cycleScale } = useRowScale();
  const { cells, loading, loadError, dataScope, loadCells } = useRegistryCells();
  const [exporting, setExporting] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const {
    search, setSearch, showSearch, setShowSearch,
    showFilters, setShowFilters,
    dateFrom, setDateFrom, dateTo, setDateTo,
    filters, setFilters, openFilter, setOpenFilter, filterRef,
    formatDropdown, setFormatDropdown, dropdownRef, formatBtnRef,
    previewFile, setPreviewFile,
    activeFilterCount, hasActiveFilters,
    clearFilters, toggleFilterValue,
  } = useRegistryFilters();

  const modals = useRegistryModals();

  // Уникальные значения для каждого фильтра
  const filterOptions = useMemo(() => {
    const collect = (extractor: (c: CellRow) => string | null | undefined) => {
      const s = new Set<string>();
      for (const c of cells) { const v = extractor(c); if (v) s.add(v); }
      return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
    };
    return {
      status: statuses.map((s) => s.name),
      building: collect((c) => c.dict_buildings?.name),
      floor: collect((c) => c.dict_floors?.name),
      workType: collect((c) => c.dict_work_types?.name),
      construction: collect((c) => c.dict_constructions?.name),
      set: collect((c) => c.dict_sets?.name),
      manualTag: collect((c) => c.manual_tag),
    };
  }, [cells, statuses]);

  // Пагинация
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(getStoredPageSize);

  // Сортировка (клиентская)
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDir(col === "date" ? "desc" : "asc");
    }
  }

  // Фильтрация
  const filtered = cells.filter((cell) => {
    const f = filters;
    if (f.status.size > 0 && !f.status.has(cell.status)) return false;
    if (f.building.size > 0 && !f.building.has(cell.dict_buildings?.name || "")) return false;
    if (f.floor.size > 0 && !f.floor.has(cell.dict_floors?.name || "")) return false;
    if (f.workType.size > 0 && !f.workType.has(cell.dict_work_types?.name || "")) return false;
    if (f.construction.size > 0 && !f.construction.has(cell.dict_constructions?.name || "")) return false;
    if (f.set.size > 0 && !f.set.has(cell.dict_sets?.name || "")) return false;
    if (f.manualTag.size > 0 && !f.manualTag.has(cell.manual_tag || "")) return false;
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
      const fields = [cell.name, cell.dict_buildings?.name, cell.dict_work_types?.name, cell.tag];
      if (!fields.some((v) => v?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  // При активации фильтров — догружаем до 500 (один раз за сессию загрузки)
  useEffect(() => {
    if (hasActiveFilters && dataScope === 'initial') loadCells('filtered');
  }, [hasActiveFilters, dataScope, loadCells]);

  const userId = user?.id;

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    const str = (a: string | null | undefined, b: string | null | undefined) =>
      (a || "").localeCompare(b || "", "ru") * dir;
    const compare = (a: CellRow, b: CellRow) => {
      switch (sortColumn) {
        case "date": return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
        case "name": return str(a.name, b.name);
        case "building": return str(a.dict_buildings?.name, b.dict_buildings?.name);
        case "floor": return str(a.dict_floors?.name, b.dict_floors?.name);
        case "workType": return str(a.dict_work_types?.name, b.dict_work_types?.name);
        case "construction": return str(a.dict_constructions?.name, b.dict_constructions?.name);
        case "set": return str(a.dict_sets?.name, b.dict_sets?.name);
        case "progress": {
          const pa = a.progress_percent ?? (dir > 0 ? Infinity : -Infinity);
          const pb = b.progress_percent ?? (dir > 0 ? Infinity : -Infinity);
          return (pa - pb) * dir;
        }
        case "status": return str(a.status, b.status);
        default: return 0;
      }
    };
    // Разделяем: ячейки, требующие действия — наверху
    const actionRequired = arr.filter(c => c.assigned_to === userId && c.send_type);
    const rest = arr.filter(c => !(c.assigned_to === userId && c.send_type));
    actionRequired.sort(compare);
    rest.sort(compare);
    return [...actionRequired, ...rest];
  }, [filtered, sortColumn, sortDir, userId]);

  // Сброс страницы при изменении фильтров/сортировки
  useEffect(() => { setPage(1); }, [filters, dateFrom, dateTo, search, sortColumn, sortDir]);

  // Количество ячеек, требующих действия (для разделителя в таблице)
  const actionRequiredCount = useMemo(
    () => sorted.filter(c => c.assigned_to === userId && c.send_type).length,
    [sorted, userId]
  );

  const paginatedRows = usePagination(sorted, page, pageSize);

  async function handleSignFromRegistry(cell: CellRow) {
    if (!user || !cell.created_by) return;
    const returnTo = cell.created_by;
    await supabase.from("cell_signatures").insert({
      cell_id: cell.id, user_id: user.id, status: "Подписано", signed_at: new Date().toISOString(),
    });
    await supabase.from("cells").update({
      status: "Подписано", assigned_to: returnTo, assigned_by: user.id, send_type: null,
    }).eq("id", cell.id);
    await supabase.from("cell_shares").insert({
      cell_id: cell.id, from_user_id: user.id, to_user_id: returnTo, message: "Подписано",
    });
    await supabase.from("cell_history").insert({
      cell_id: cell.id, user_id: user.id, action: "signed", details: { status: "Подписано", to_user_id: returnTo },
    });
    loadCells();
  }

  async function downloadAllFiles(cell: CellRow) {
    await downloadAsZip(
      cell.cell_files.map((f) => ({ storagePath: f.storage_path, fileName: f.file_name })),
      cell.name || "файлы",
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold" style={{ color: "var(--ds-text)" }}>Реестр</h2>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="ds-icon-btn"
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
          {hasPermission("can_create_cells") && (
            <button
              onClick={() => modals.setShowCreate(true)}
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
          {hasPermission("can_print") && (
            <button
              onClick={() => window.print()}
              className="ds-btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              {!isMobile && "Печать"}
            </button>
          )}
          {hasPermission("can_print") && project && (
            <button
              onClick={() => setShowExport(true)}
              className="ds-btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {!isMobile && "Excel"}
            </button>
          )}
        </div>
      </div>

      {showFilters && <div data-print-hide>
        <RegistryFilters
          filters={filters} setFilters={setFilters} filterOptions={filterOptions}
          openFilter={openFilter} setOpenFilter={setOpenFilter} filterRef={filterRef}
          dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo}
          search={search} setSearch={setSearch} showSearch={showSearch} setShowSearch={setShowSearch}
          hasActiveFilters={hasActiveFilters} activeFilterCount={activeFilterCount}
          filteredCount={filtered.length} totalCount={cells.length}
          clearFilters={clearFilters} toggleFilterValue={toggleFilterValue} getColorKey={getColorKey}
        />
      </div>}

      {/* Баннер лимита загрузки */}
      {dataScope === 'filtered' && cells.length >= 500 && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs mb-2"
          style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text-muted)" }}>
          <span>Показаны первые 500 записей. Для точного поиска уточните фильтры или загрузите весь реестр.</span>
          <button
            onClick={() => loadCells('all')}
            className="shrink-0 font-medium underline underline-offset-2"
            style={{ color: "var(--ds-accent)" }}
          >
            Загрузить весь реестр
          </button>
        </div>
      )}
      {dataScope === 'all' && (
        <div className="px-3 py-2 rounded-lg text-xs mb-2"
          style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text-muted)" }}>
          Загружен весь реестр — {cells.length} записей.
        </div>
      )}

      {/* Мобильный карточный вид */}
      {isMobile ? (
        <div className="space-y-2">
          <RegistryMobileView
            cells={cells} loading={loading} loadError={loadError}
            sorted={sorted} paginatedRows={paginatedRows} getColorKey={getColorKey}
            hasPermission={hasPermission} isProjectAdmin={isProjectAdmin} userId={user?.id}
            actionRequiredCount={actionRequiredCount}
            onDetailOpen={modals.setDetailCellId}
            onSendCell={modals.setSendCell}
            onAcknowledgeCell={modals.setAcknowledgeCell}
            onSupervisionCell={modals.setSupervisionCell}
            onRemarksCell={modals.setRemarksCell}
            onDelegateCell={modals.setDelegateCell}
            onSign={handleSignFromRegistry}
            onDownloadAll={downloadAllFiles}
          />
          <Pagination totalItems={sorted.length} currentPage={page} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
        </div>
      ) : (
      /* Десктопная таблица */
      <div className="ds-card overflow-hidden" data-print-full data-row-scale={scale}>
        <RegistryDesktopTable
          cells={cells} loading={loading} loadError={loadError}
          sorted={sorted} paginatedRows={paginatedRows}
          sortColumn={sortColumn} sortDir={sortDir} onSort={handleSort} getColorKey={getColorKey}
          hasPermission={hasPermission} isProjectAdmin={isProjectAdmin} userId={user?.id}
          actionRequiredCount={actionRequiredCount}
          formatDropdown={formatDropdown} setFormatDropdown={setFormatDropdown}
          dropdownRef={dropdownRef} formatBtnRef={formatBtnRef}
          previewFile={previewFile} setPreviewFile={setPreviewFile}
          onDetailOpen={modals.setDetailCellId}
          onSendCell={modals.setSendCell}
          onAcknowledgeCell={modals.setAcknowledgeCell}
          onSupervisionCell={modals.setSupervisionCell}
          onRemarksCell={modals.setRemarksCell}
          onSignRemarksCell={modals.setSignRemarksCell}
          onForwardCell={modals.setForwardCell}
          onDelegateCell={modals.setDelegateCell}
          onSign={handleSignFromRegistry}
          onDownloadAll={downloadAllFiles}
        />
        <Pagination totalItems={sorted.length} currentPage={page} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
      </div>
      )}

      {/* Модалки (lazy-loaded) */}
      <RegistryModals
        cells={cells}
        loadCells={loadCells}
        handleSignFromRegistry={handleSignFromRegistry}
        downloadAllFiles={downloadAllFiles}
        projectId={project?.id}
        projectName={project?.name}
        previewFile={previewFile}
        setPreviewFile={setPreviewFile}
        showCreate={modals.showCreate}
        setShowCreate={modals.setShowCreate}
        detailCellId={modals.detailCellId}
        setDetailCellId={modals.setDetailCellId}
        sendCell={modals.sendCell}
        setSendCell={modals.setSendCell}
        supervisionCell={modals.supervisionCell}
        setSupervisionCell={modals.setSupervisionCell}
        acknowledgeCell={modals.acknowledgeCell}
        setAcknowledgeCell={modals.setAcknowledgeCell}
        remarksCell={modals.remarksCell}
        setRemarksCell={modals.setRemarksCell}
        signRemarksCell={modals.signRemarksCell}
        setSignRemarksCell={modals.setSignRemarksCell}
        forwardCell={modals.forwardCell}
        setForwardCell={modals.setForwardCell}
        delegateCell={modals.delegateCell}
        setDelegateCell={modals.setDelegateCell}
        exporting={exporting}
        setExporting={setExporting}
        showExport={showExport}
        setShowExport={setShowExport}
      />
    </div>
  );
}
