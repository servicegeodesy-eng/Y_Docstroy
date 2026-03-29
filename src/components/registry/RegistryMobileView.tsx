import { formatDate } from "@/lib/utils";
import { getStatusStyle } from "@/constants/statusColors";
import type { CellRow } from "@/hooks/useRegistryCells";
import type { PermissionKey } from "@/types";

interface Props {
  cells: CellRow[];
  loading: boolean;
  loadError: string | null;
  sorted: CellRow[];
  paginatedRows: CellRow[];
  getColorKey: (status: string) => string;
  hasPermission: (p: PermissionKey) => boolean;
  isProjectAdmin: boolean;
  userId: string | undefined;
  onDetailOpen: (id: string) => void;
  onSendCell: (c: { id: string; name: string }) => void;
  onAcknowledgeCell: (c: { id: string; name: string }) => void;
  onSupervisionCell: (c: { id: string; name: string }) => void;
  onRemarksCell: (c: { id: string; name: string; sendBackTo: string }) => void;
  onDelegateCell: (c: { id: string; name: string; originalSenderId: string }) => void;
  onSign: (cell: CellRow) => void;
  onDownloadAll: (cell: CellRow) => void;
}

export default function RegistryMobileView({
  cells, loading, loadError, sorted, paginatedRows, getColorKey,
  hasPermission, isProjectAdmin, userId,
  onDetailOpen, onSendCell, onAcknowledgeCell, onSupervisionCell,
  onRemarksCell, onDelegateCell, onSign, onDownloadAll,
}: Props) {
  if (loading) {
    return <div className="px-4 py-12 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка реестра...</div>;
  }
  if (loadError) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="font-medium" style={{ color: "#ef4444" }}>{loadError}</p>
      </div>
    );
  }
  if (sorted.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="font-medium" style={{ color: "var(--ds-text-muted)" }}>{cells.length === 0 ? "Реестр пуст" : "Ничего не найдено"}</p>
        <p className="text-sm mt-1" style={{ color: "var(--ds-text-faint)" }}>
          {cells.length === 0 ? "Нажмите \"Добавить\" для создания первой ячейки." : "Попробуйте изменить параметры поиска или фильтры."}
        </p>
      </div>
    );
  }

  return (
    <>
      {paginatedRows.map((cell) => (
        <div
          key={cell.id}
          className="ds-card p-3 cursor-pointer"
          onClick={() => onDetailOpen(cell.id)}
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate flex items-center gap-1.5" style={{ color: "var(--ds-text)" }}>
                {cell.assigned_to === userId && cell.send_type && (
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Требует действия" />
                )}
                {cell.name}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--ds-text-faint)" }}>{formatDate(cell.created_at)}</div>
            </div>
            <span
              className="shrink-0 inline-block px-1.5 py-px rounded-full text-[10px] font-medium whitespace-nowrap"
              style={getStatusStyle(getColorKey(cell.status), cell.progress_percent)}
            >
              {cell.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: "var(--ds-text-muted)" }}>
            {cell.dict_buildings?.name && <span>{cell.dict_buildings.name}</span>}
            {cell.dict_work_types?.name && <span>{cell.dict_work_types.name}</span>}
            {cell.dict_floors?.name && <span>{cell.dict_floors.name}</span>}
            {cell.dict_constructions?.name && <span>{cell.dict_constructions.name}</span>}
          </div>
          {(cell.cell_files.length > 0 || cell.progress_percent != null) && (
            <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: "var(--ds-text-faint)" }}>
              {cell.progress_percent != null && (
                <span className="flex items-center gap-1">
                  {cell.progress_percent}%
                  <span className="inline-block w-8 h-1 rounded-full overflow-hidden" style={{ background: "var(--ds-surface-sunken)" }}>
                    <span className={`block h-full rounded-full ${
                      cell.progress_percent <= 30 ? "bg-red-500" : cell.progress_percent <= 70 ? "bg-yellow-500" : "bg-green-500"
                    }`} style={{ width: `${cell.progress_percent}%` }} />
                  </span>
                </span>
              )}
              {cell.cell_files.length > 0 && (
                <span className="flex items-center gap-0.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {cell.cell_files.length}
                </span>
              )}
            </div>
          )}
          {/* Мобильные действия */}
          <div className="flex gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
            {cell.cell_files.length > 0 && hasPermission("can_download_files") && (
              <button
                onClick={() => onDownloadAll(cell)}
                className="ds-action-btn"
                title="Скачать все файлы"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            )}
            {hasPermission("can_send_cells") && cell.status !== "Окончательно утверждён" && (isProjectAdmin || cell.created_by === userId) && (
              <>
                <button
                  onClick={() => onSendCell({ id: cell.id, name: cell.name })}
                  className="ds-action-btn"
                  title="Отправить на проверку"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </button>
                {(() => {
                  const isAcknowledged = cell.cell_signatures?.some((s) => s.status === "Ознакомлен");
                  return (
                    <button
                      onClick={() => onAcknowledgeCell({ id: cell.id, name: cell.name })}
                      className={`ds-action-btn ${isAcknowledged ? "ds-action-btn--active" : ""}`}
                      title={isAcknowledged ? "Ознакомлен производителем работ" : "Отправить на ознакомление"}
                    >
                      <svg className="w-4 h-4" fill={isAcknowledged ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  );
                })()}
                {(() => {
                  const isApprovedByAN = cell.cell_signatures?.some((s) => s.status === "Согласовано");
                  return (
                    <button
                      onClick={() => onSupervisionCell({ id: cell.id, name: cell.name })}
                      className={`ds-action-btn ${isApprovedByAN ? "ds-action-btn--active" : ""}`}
                      title={isApprovedByAN ? "Согласовано авторским надзором" : "Отправить на авторский надзор"}
                    >
                      <svg className="w-4 h-4" fill={isApprovedByAN ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </button>
                  );
                })()}
              </>
            )}
            {/* Действия проверяющего (мобайл) */}
            {cell.assigned_to === userId && cell.send_type === "review" && cell.status !== "Окончательно утверждён" && (
              <>
                {hasPermission("can_sign") && (
                  <button onClick={() => { if (confirm(`Подписать "${cell.name}"?`)) onSign(cell); }}
                    className="ds-action-btn" title="Подписать">
                    <svg className="w-4 h-4" fill="none" stroke="#0d9488" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                )}
                {hasPermission("can_remark") && (
                  <button onClick={() => onRemarksCell({ id: cell.id, name: cell.name, sendBackTo: cell.created_by! })}
                    className="ds-action-btn" title="Замечания">
                    <svg className="w-4 h-4" fill="none" stroke="#f97316" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </button>
                )}
                <button onClick={() => onDelegateCell({ id: cell.id, name: cell.name, originalSenderId: cell.created_by! })}
                  className="ds-action-btn" title="Делегировать">
                  <svg className="w-4 h-4" fill="none" stroke="#8b5cf6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
