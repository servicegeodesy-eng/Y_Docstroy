import { shortName, getExt, formatDate, downloadStorage, isPreviewable } from "@/lib/utils";
import DropdownPortal from "@/components/ui/DropdownPortal";
import { getStatusStyle } from "@/constants/statusColors";
import type { CellRow } from "@/hooks/useRegistryCells";
import type { PermissionKey } from "@/types";

type SortColumn = "date" | "name" | "building" | "floor" | "workType" | "construction" | "set" | "progress" | "status";
type SortDir = "asc" | "desc";

interface Props {
  cells: CellRow[];
  loading: boolean;
  loadError: string | null;
  sorted: CellRow[];
  paginatedRows: CellRow[];
  sortColumn: SortColumn;
  sortDir: SortDir;
  onSort: (col: SortColumn) => void;
  getColorKey: (status: string) => string;
  hasPermission: (p: PermissionKey) => boolean;
  isProjectAdmin: boolean;
  userId: string | undefined;
  formatDropdown: { cellId: string; ext: string } | null;
  setFormatDropdown: (v: { cellId: string; ext: string } | null) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  formatBtnRef: React.RefObject<HTMLButtonElement>;
  previewFile: { fileName: string; storagePath: string } | null;
  setPreviewFile: (f: { fileName: string; storagePath: string } | null) => void;
  onDetailOpen: (id: string) => void;
  onSendCell: (c: { id: string; name: string }) => void;
  onAcknowledgeCell: (c: { id: string; name: string }) => void;
  onSupervisionCell: (c: { id: string; name: string }) => void;
  onRemarksCell: (c: { id: string; name: string; sendBackTo: string }) => void;
  onSignRemarksCell: (c: { id: string; name: string; sendBackTo: string }) => void;
  onForwardCell: (c: { id: string; name: string; originalSenderId: string }) => void;
  onDelegateCell: (c: { id: string; name: string; originalSenderId: string }) => void;
  onSign: (cell: CellRow) => void;
  onDownloadAll: (cell: CellRow) => void;
}

function getUniqueFormats(files: { file_name: string }[]) {
  const exts = new Set(files.map((f) => getExt(f.file_name)));
  return Array.from(exts);
}

function getStatusUser(cell: CellRow): string {
  if (cell.status === "Новый") return shortName(cell.creator);
  if (cell.status === "На проверке" || cell.status === "У авторского надзора") return shortName(cell.assignee);
  if (cell.status === "Замечания" || cell.status === "Подписано" || cell.status === "Согласовано" || cell.status === "На исправление") return shortName(cell.assigner);
  return "";
}

export default function RegistryDesktopTable({
  cells, loading, loadError, sorted, paginatedRows,
  sortColumn, sortDir, onSort, getColorKey,
  hasPermission, isProjectAdmin, userId,
  formatDropdown, setFormatDropdown, dropdownRef, formatBtnRef,
  setPreviewFile,
  onDetailOpen, onSendCell, onAcknowledgeCell, onSupervisionCell,
  onRemarksCell, onSignRemarksCell, onForwardCell, onDelegateCell,
  onSign, onDownloadAll,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="ds-table w-full text-sm">
        <thead>
          <tr style={{ background: "var(--ds-surface-sunken)", borderBottom: "1px solid var(--ds-border)" }}>
            {([
              { col: "date" as SortColumn, label: "Дата", cls: "w-28" },
              { col: "name" as SortColumn, label: "Наименование", cls: "" },
              { col: "building" as SortColumn, label: "Место работ", cls: "" },
              { col: "workType" as SortColumn, label: "Вид работ", cls: "" },
              { col: "floor" as SortColumn, label: "Уровни/срезы", cls: "" },
              { col: "construction" as SortColumn, label: "Конструкция", cls: "" },
              { col: "set" as SortColumn, label: "Комплект", cls: "" },
            ] as { col: SortColumn; label: string; cls: string }[]).map(({ col, label, cls }) => (
              <th
                key={col}
                onClick={() => onSort(col)}
                className={`text-left px-2 py-1 font-medium text-[10px] cursor-pointer select-none transition-colors ${cls}`}
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
            <th className="text-left px-2 py-1 font-medium text-[10px]" style={{ color: "var(--ds-text-muted)" }}>Файлы</th>
            <th
              onClick={() => onSort("status")}
              className="text-left px-2 py-1 font-medium text-[10px] cursor-pointer select-none transition-colors"
              style={{ color: "var(--ds-text-muted)" }}
            >
              <span className="inline-flex items-center gap-1">
                Статус
                {sortColumn === "status" && (
                  <svg className={`w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                )}
              </span>
            </th>
            <th className="text-left px-2 py-1 font-medium text-[10px] w-24" style={{ color: "var(--ds-text-muted)" }} data-print-hide>Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "var(--ds-border)" }}>
          {loading ? (
            <tr>
              <td colSpan={10} className="px-4 py-12 text-center" style={{ color: "var(--ds-text-faint)" }}>
                Загрузка реестра...
              </td>
            </tr>
          ) : loadError ? (
            <tr>
              <td colSpan={10} className="px-4 py-12 text-center">
                <p className="font-medium" style={{ color: "#ef4444" }}>{loadError}</p>
              </td>
            </tr>
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-12 text-center">
                <p className="font-medium" style={{ color: "var(--ds-text-muted)" }}>{cells.length === 0 ? "Реестр пуст" : "Ничего не найдено"}</p>
                <p className="text-sm mt-1" style={{ color: "var(--ds-text-faint)" }}>
                  {cells.length === 0 ? "Нажмите \"Добавить\" для создания первой ячейки." : "Попробуйте изменить параметры поиска или фильтры."}
                </p>
              </td>
            </tr>
          ) : (
            paginatedRows.map((cell) => (
              <tr
                key={cell.id}
                className="cursor-pointer"
                onDoubleClick={() => onDetailOpen(cell.id)}
              >
                <td className="px-4 py-1.5 whitespace-nowrap text-sm" style={{ color: "var(--ds-text-muted)" }}>
                  {formatDate(cell.created_at)}
                </td>
                <td className="px-4 py-1.5 font-medium text-sm" style={{ color: "var(--ds-text)" }}>
                  <div className="flex items-center gap-1.5">
                    {cell.assigned_to === userId && cell.send_type && (
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Требует действия" />
                    )}
                    {cell.name}
                  </div>
                  {cell.manual_tag && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      <span className="inline-block px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text-muted)" }}>
                        {cell.manual_tag}
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>
                  {cell.dict_buildings?.name || "\u2014"}
                </td>
                <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>
                  {cell.dict_work_types?.name || "\u2014"}
                </td>
                <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>
                  {cell.dict_floors?.name || "\u2014"}
                </td>
                <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>
                  {cell.dict_constructions?.name || "\u2014"}
                </td>
                <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>
                  {cell.dict_sets?.name || "\u2014"}
                </td>
                <td className="px-2 py-0.5">
                  {cell.cell_files.length === 0 ? (
                    <span style={{ color: "var(--ds-text-faint)" }}>{"\u2014"}</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {getUniqueFormats(cell.cell_files).map((ext) => {
                        const filesOfExt = cell.cell_files.filter(
                          (f) => getExt(f.file_name) === ext
                        );
                        const isOpen = formatDropdown?.cellId === cell.id && formatDropdown?.ext === ext;
                        const previewableExt = isPreviewable(`file.${ext}`);
                        return (
                          <div key={ext} className="relative">
                            <button
                              ref={isOpen ? formatBtnRef : undefined}
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
                                ? { background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "color-mix(in srgb, var(--ds-accent) 30%, transparent)" }
                                : { background: "color-mix(in srgb, var(--ds-text-faint) 8%, var(--ds-surface))", color: "var(--ds-text-muted)", borderColor: "color-mix(in srgb, var(--ds-text-faint) 15%, transparent)" }}
                              title={previewableExt ? `${ext} — нажмите для просмотра/скачивания` : filesOfExt.length === 1 ? `Скачать ${ext}` : `${filesOfExt.length} файл(ов) ${ext}`}
                            >
                              {ext}
                              {filesOfExt.length > 1 && (
                                <span className="ml-0.5 text-[10px] opacity-60">{filesOfExt.length}</span>
                              )}
                            </button>
                            <DropdownPortal anchorRef={formatBtnRef} open={isOpen} className="min-w-[220px] max-w-[320px]">
                              <div ref={dropdownRef}>
                                <div className="px-3 py-1.5 text-xs" style={{ color: "var(--ds-text-faint)", borderBottom: "1px solid var(--ds-border)" }}>
                                  {ext} — {filesOfExt.length} файл(ов)
                                </div>
                                {filesOfExt.map((file) => (
                                  <div key={file.id} className="flex items-center gap-1 px-2 py-1">
                                    <span className="flex-1 text-sm truncate px-1" style={{ color: "var(--ds-text-muted)" }} title={file.file_name}>
                                      {file.file_name}
                                    </span>
                                    {previewableExt && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPreviewFile({ fileName: file.file_name, storagePath: file.storage_path });
                                          setFormatDropdown(null);
                                        }}
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
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          downloadStorage(file.storage_path, file.file_name);
                                          setFormatDropdown(null);
                                        }}
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
                              </div>
                            </DropdownPortal>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td className="px-2 py-0.5">
                  <span
                    className="inline-block w-[130px] text-center px-1.5 py-px rounded-full text-[10px] font-medium whitespace-nowrap"
                    style={getStatusStyle(getColorKey(cell.status), cell.progress_percent)}
                  >
                    {cell.status}
                  </span>
                  {getStatusUser(cell) && (
                    <div className="text-[11px] mt-0.5 truncate max-w-[140px]" style={{ color: "var(--ds-text-faint)" }}>
                      {getStatusUser(cell)}
                    </div>
                  )}
                </td>
                <td className="px-2 py-0.5" data-print-hide>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDetailOpen(cell.id); }}
                      className="ds-action-btn"
                      title="Открыть"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                    {cell.cell_files.length > 0 && hasPermission("can_download_files") && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDownloadAll(cell); }}
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
                          onClick={(e) => { e.stopPropagation(); onSendCell({ id: cell.id, name: cell.name }); }}
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
                              onClick={(e) => { e.stopPropagation(); onAcknowledgeCell({ id: cell.id, name: cell.name }); }}
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
                              onClick={(e) => { e.stopPropagation(); onSupervisionCell({ id: cell.id, name: cell.name }); }}
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
                    {/* Действия проверяющего */}
                    {cell.assigned_to === userId && cell.send_type === "review" && cell.status !== "Окончательно утверждён" && (
                      <>
                        {hasPermission("can_remark") && (
                          <button onClick={(e) => { e.stopPropagation(); onRemarksCell({ id: cell.id, name: cell.name, sendBackTo: cell.created_by! }); }}
                            className="ds-action-btn" title="Замечания">
                            <svg className="w-4 h-4" fill="none" stroke="#f97316" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </button>
                        )}
                        {hasPermission("can_sign") && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); if (confirm(`Подписать "${cell.name}"?`)) onSign(cell); }}
                              className="ds-action-btn" title="Подписать">
                              <svg className="w-4 h-4" fill="none" stroke="#0d9488" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onSignRemarksCell({ id: cell.id, name: cell.name, sendBackTo: cell.created_by! }); }}
                              className="ds-action-btn" title="Подписать с замечанием">
                              <svg className="w-4 h-4" fill="none" stroke="#f59e0b" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onForwardCell({ id: cell.id, name: cell.name, originalSenderId: cell.created_by! }); }}
                              className="ds-action-btn" title="Подписать и переслать">
                              <svg className="w-4 h-4" fill="none" stroke="#6366f1" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </button>
                          </>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); onDelegateCell({ id: cell.id, name: cell.name, originalSenderId: cell.created_by! }); }}
                          className="ds-action-btn" title="Делегировать">
                          <svg className="w-4 h-4" fill="none" stroke="#8b5cf6" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
