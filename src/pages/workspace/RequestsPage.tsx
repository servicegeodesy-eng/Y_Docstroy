import { useMobile } from "@/lib/MobileContext";
import { isGeoMode, getGeoUrl } from "@/lib/geoMode";
import { shortName, formatDate, getExt, isPreviewable } from "@/lib/utils";
import { useRequestsData, STATUS_STYLES } from "@/hooks/useRequestsData";
import type { RequestRow, Tab } from "@/hooks/useRequestsData";
import CreateRequestModal from "@/components/requests/CreateRequestModal";
import ExecuteRequestModal from "@/components/requests/ExecuteRequestModal";
import RequestRemarksModal from "@/components/requests/RequestRemarksModal";
import RequestPermissionsPanel from "@/components/requests/RequestPermissionsPanel";
import RequestDetailModal from "@/components/requests/RequestDetailModal";
import RequestFilters from "@/components/requests/RequestFilters";
import RequestsTable from "@/components/requests/RequestsTable";
import Pagination from "@/components/ui/Pagination";
import RowScaleButton from "@/components/ui/RowScaleButton";
import FilePreviewModal from "@/components/ui/FilePreviewModal";


export default function RequestsPage() {
  const { isMobile } = useMobile();
  const d = useRequestsData();

  if (!d.loading && !d.canView && !d.isProjectAdmin && !d.isAdmin) {
    return (
      <div className="ds-card p-12 text-center">
        <svg className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h3 className="font-medium mb-1" style={{ color: "var(--ds-text)" }}>Доступ ограничен</h3>
        <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>У вас нет прав для просмотра вкладки «Заявки».</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count?: number; showBadge?: boolean }[] = [
    { key: "inwork", label: "В работе", count: d.inworkCells.length, showBadge: d.canExecute && d.inworkCells.length > 0 },
    { key: "done", label: "Выполнено", count: d.unacknowledgedCount, showBadge: d.unacknowledgedCount > 0 },
  ];

  return (
    <div>
      <div className={`flex items-center justify-between ${isMobile ? "mb-3" : "mb-4"}`}>
        <div className="flex items-center gap-2">
          <h2 className={`font-semibold ${isMobile ? "text-lg" : "text-xl"}`} style={{ color: "var(--ds-text)" }}>Заявки</h2>
          <button
            onClick={() => d.setShowFilters((v) => !v)}
            className="ds-icon-btn relative"
            style={d.showFilters || d.hasActiveFilters ? { color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))" } : undefined}
            title="Фильтры"
            data-print-hide
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {d.hasActiveFilters && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />}
          </button>
          {!isMobile && <RowScaleButton scale={d.scale} onCycle={d.cycleScale} />}
          {!isGeoMode() && getGeoUrl() && (
            <a
              href={getGeoUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="ds-btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
              title="Открыть сайт Службы Геодезии"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {!isMobile && "Служба Геодезии"}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2" data-print-hide>
          {d.canCreate && (
            <button
              onClick={() => d.setShowCreate(true)}
              className="ds-btn flex items-center gap-2 px-4 py-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {!isMobile && "Создать заявку"}
            </button>
          )}
          {d.hasPermission("can_print") && (
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
          {d.isProjectAdmin && (
            <button
              onClick={() => d.setShowPermissions((v) => !v)}
              className={`text-sm border rounded-lg transition-colors flex items-center gap-2 ${isMobile ? "p-2" : "px-4 py-2"}`}
              style={d.showPermissions
                ? { background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "var(--ds-accent)" }
                : { borderColor: "var(--ds-border)", color: "var(--ds-text-muted)" }}
              title="Разрешения"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              {!isMobile && "Разрешения"}
            </button>
          )}
        </div>
      </div>

      {d.showPermissions && d.isProjectAdmin && (
        <RequestPermissionsPanel onClose={() => d.setShowPermissions(false)} />
      )}

      {/* Вкладки */}
      <div className={`flex ${isMobile ? "mb-3" : "mb-4"}`} style={{ borderBottom: "1px solid var(--ds-border)" }} data-print-hide>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => d.setActiveTab(tab.key)}
            className="relative px-4 py-2.5 text-sm font-medium transition-colors border-b-2"
            style={d.activeTab === tab.key
              ? { color: "var(--ds-accent)", borderColor: "var(--ds-accent)" }
              : { color: "var(--ds-text-muted)", borderColor: "transparent" }}
          >
            {tab.label}
            {tab.showBadge && tab.count != null && tab.count > 0 && (
              <span className="ml-1.5 w-2 h-2 rounded-full bg-red-500 shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Фильтры */}
      {d.showFilters && (<div data-print-hide>
        <RequestFilters
          filters={d.filters} setFilters={d.setFilters} filterOptions={d.filterOptions}
          openFilter={d.openFilter} setOpenFilter={d.setOpenFilter} filterRef={d.filterRef}
          dateFrom={d.dateFrom} setDateFrom={d.setDateFrom} dateTo={d.dateTo} setDateTo={d.setDateTo}
          search={d.search} setSearch={d.setSearch} showSearch={d.showSearch} setShowSearch={d.setShowSearch}
          hasActiveFilters={d.hasActiveFilters} activeFilterCount={d.activeFilterCount}
          filteredCount={d.filteredCells.length} totalCount={d.tabCells.length}
          clearFilters={d.clearFilters} toggleFilterValue={d.toggleFilterValue}
          allRequests={d.allRequests} setAllRequests={d.setAllRequests}
          showAllRequests={d.activeTab === "done"}
        />
      </div>)}

      {d.loadError && (
        <div className="ds-card p-6 text-center">
          <p className="text-sm mb-3" style={{ color: "#ef4444" }}>{d.loadError}</p>
          <button onClick={() => d.loadCells()} className="ds-btn text-sm">Повторить</button>
        </div>
      )}

      {/* Мобильный карточный вид */}
      {isMobile && (
        <MobileCards
          cells={d.paginatedCells}
          allCells={d.filteredCells}
          loading={d.loading}
          activeTab={d.activeTab}
          userId={d.user?.id}
          canExecute={d.canExecute}
          acknowledgedIds={d.acknowledgedIds}
          getStatusUser={d.getStatusUser}
          onCardClick={(id) => d.setDetailCellId(id)}
          onExecute={(cell) => d.setExecuteCell(cell)}
          onReject={(cell) => d.setRejectCell(cell)}
          onAcknowledge={d.handleAcknowledge}
          onPreview={d.setPreviewFile}
          page={d.page}
          setPage={d.setPage}
          pageSize={d.pageSize}
          setPageSize={d.setPageSize}
        />
      )}

      {/* Таблица заявок (десктоп) */}
      {!isMobile && (
        <div data-row-scale={d.scale}>
          <RequestsTable
            cells={d.paginatedCells}
            loading={d.loading}
            activeTab={d.activeTab}
            userId={d.user?.id}
            canExecute={d.canExecute}
            isPortalAdmin={d.isPortalAdmin}
            isAdmin={d.isAdmin}
            acknowledgedIds={d.acknowledgedIds}
            getStatusUser={d.getStatusUser}
            onDoubleClick={(cellId) => d.setDetailCellId(cellId)}
            onExecute={(cell) => d.setExecuteCell(cell)}
            onReject={(cell) => d.setRejectCell(cell)}
            onAcknowledge={d.handleAcknowledge}
            onStatusChange={d.handleStatusChange}
            onPreview={d.setPreviewFile}
          />
          <Pagination totalItems={d.filteredCells.length} currentPage={d.page} onPageChange={d.setPage} pageSize={d.pageSize} onPageSizeChange={d.setPageSize} />
        </div>
      )}

      {/* Модалки */}
      {d.showCreate && (
        <CreateRequestModal
          onClose={() => d.setShowCreate(false)}
          onCreated={() => { d.setShowCreate(false); d.loadCells(); }}
        />
      )}
      {d.executeCell && (
        <ExecuteRequestModal
          cellId={d.executeCell.id}
          cellName={d.executeCell.name}
          onClose={() => d.setExecuteCell(null)}
          onExecuted={() => { d.setExecuteCell(null); d.loadCells(); d.loadCompletedDates(); }}
        />
      )}
      {d.rejectCell && (
        <RequestRemarksModal
          cellId={d.rejectCell.id}
          cellName={d.rejectCell.name}
          onClose={() => d.setRejectCell(null)}
          onSent={() => { d.setRejectCell(null); d.loadCells(); d.loadCompletedDates(); }}
        />
      )}
      {d.detailCellId && (
        <RequestDetailModal
          cellId={d.detailCellId}
          onClose={() => d.setDetailCellId(null)}
          onUpdated={() => { d.loadCells(); d.loadAcknowledged(); }}
          onAcknowledged={() => { d.loadAcknowledged(); }}
        />
      )}
      {d.previewFile && (
        <FilePreviewModal
          fileName={d.previewFile.fileName}
          storagePath={d.previewFile.storagePath}
          onClose={() => d.setPreviewFile(null)}
        />
      )}
    </div>
  );
}


/* ── Mobile card view ── */
interface MobileCardsProps {
  cells: RequestRow[];
  allCells: RequestRow[];
  loading: boolean;
  activeTab: Tab;
  userId: string | undefined;
  canExecute: boolean;
  acknowledgedIds: Set<string>;
  getStatusUser: (cell: RequestRow) => string;
  onCardClick: (id: string) => void;
  onExecute: (cell: { id: string; name: string }) => void;
  onReject: (cell: { id: string; name: string }) => void;
  onAcknowledge: (cellId: string) => void;
  onPreview: (file: { fileName: string; storagePath: string }) => void;
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (s: number) => void;
}

function MobileCards({
  cells, allCells, loading, activeTab, userId, canExecute, acknowledgedIds,
  getStatusUser, onCardClick, onExecute, onReject, onAcknowledge, onPreview,
  page, setPage, pageSize, setPageSize,
}: MobileCardsProps) {
  return (
    <div className="space-y-2">
      {loading ? (
        <div className="ds-card p-6 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
      ) : allCells.length === 0 ? (
        <div className="ds-card p-6 text-center">
          <p className="font-medium" style={{ color: "var(--ds-text-muted)" }}>
            {activeTab === "inwork" ? "Нет заявок в работе" : "Нет выполненных заявок"}
          </p>
        </div>
      ) : cells.map((cell) => {
        const isInWork = cell.status === "В работе";
        const isDone = cell.status === "Выполнено" || cell.status === "Отклонено";
        const isCreator = cell.created_by === userId;
        const isUnacknowledged = isDone && isCreator && !acknowledgedIds.has(cell.id);
        return (
          <div
            key={cell.id}
            className="ds-card p-3"
            onClick={() => onCardClick(cell.id)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {(isUnacknowledged || (isInWork && canExecute && cell.assigned_to === userId)) && (
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" title="Требует действия" />
                )}
                {cell.request_work_type && (
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium shrink-0" style={{ background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)" }}>
                    {cell.request_work_type}
                  </span>
                )}
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium shrink-0" style={STATUS_STYLES[cell.status] || STATUS_STYLES["Новый"]}>
                  {cell.status}
                </span>
              </div>
              <span className="text-xs shrink-0">{formatDate(cell.created_at)}</span>
            </div>
            <div className="text-sm mb-1" style={{ color: "var(--ds-text)" }}>
              {[cell.dict_buildings?.name, cell.dict_work_types?.name].filter(Boolean).join(" / ") || "\u2014"}
            </div>
            {cell.dict_floors?.name && <div className="text-xs" style={{ color: "var(--ds-text-muted)" }}>{cell.dict_floors.name}</div>}
            {cell.dict_constructions?.name && <div className="text-xs" style={{ color: "var(--ds-text-muted)" }}>{cell.dict_constructions.name}</div>}
            <div className="text-xs mt-0.5" style={{ color: "var(--ds-text-faint)" }}>
              Создатель: {isCreator ? <span style={{ color: "var(--ds-accent)" }}>Вы</span> : shortName(cell.creator)}
            </div>
            {cell.description && <div className="text-xs mt-1 line-clamp-2">{cell.description}</div>}
            {cell.cell_files.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
                {cell.cell_files.map((f) => {
                  const ext = getExt(f.file_name);
                  const canPreview = isPreviewable(f.file_name);
                  const nameWithoutExt = f.file_name.replace(/\.[^.]+$/, "");
                  return (
                    <span
                      key={f.id}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono border ${canPreview ? "cursor-pointer active:opacity-70" : ""}`}
                      style={{ background: "color-mix(in srgb, var(--ds-text-faint) 8%, var(--ds-surface))", color: canPreview ? "var(--ds-accent)" : "var(--ds-text-muted)", borderColor: "color-mix(in srgb, var(--ds-text-faint) 15%, transparent)" }}
                      onClick={() => { if (canPreview) onPreview({ fileName: f.file_name, storagePath: f.storage_path }); }}
                    >
                      <span className="max-w-[120px] truncate">{nameWithoutExt}</span>
                      <span className="opacity-60">.{ext.toLowerCase()}</span>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <div className="text-xs">
                {getStatusUser(cell) && <span>{getStatusUser(cell)}</span>}
              </div>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                {isInWork && canExecute && (
                  <>
                    <button
                      onClick={() => onExecute({ id: cell.id, name: cell.name })}
                      className="p-1.5 rounded"
                      style={{ color: "var(--ds-text-faint)" }}
                      title="Выполнить"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onReject({ id: cell.id, name: cell.name })}
                      className="p-1.5 rounded"
                      style={{ color: "var(--ds-text-faint)" }}
                      title="Отклонить"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                )}
                {isUnacknowledged && (
                  <button
                    onClick={() => onAcknowledge(cell.id)}
                    className="px-2 py-1 text-xs rounded"
                    style={{ color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))" }}
                    title="Ознакомлен"
                  >
                    Ознакомлен
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <Pagination totalItems={allCells.length} currentPage={page} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
    </div>
  );
}
