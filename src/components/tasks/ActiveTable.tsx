import { useEffect, useRef, useState } from "react";
import type { CellStatus, CellSendType } from "@/types";
import type { PermissionKey } from "@/types";
import { getStatusStyle } from "@/constants/statusColors";
import { shortName, getExt, formatDate, downloadStorage, downloadAsZip, isPreviewable } from "@/lib/utils";
import DropdownPortal from "@/components/ui/DropdownPortal";
import type { ProfileShort } from "@/lib/utils";

export interface TaskCell {
  id: string;
  name: string;
  status: CellStatus;
  progress_percent: number | null;
  created_at: string;
  created_by: string;
  assigned_to: string | null;
  assigned_by: string | null;
  original_sender_id: string | null;
  send_type: CellSendType | null;
  dict_work_types: { name: string } | null;
  cell_files: { id: string; file_name: string; storage_path: string; category?: string | null }[];
  creator: ProfileShort | null;
  assignee: ProfileShort | null;
  assigner: ProfileShort | null;
  lastMessage?: string | null;
}

interface ActiveTableProps {
  cells: TaskCell[]; loading: boolean; emptyMsg: string;
  canReview: (c: TaskCell) => boolean; canArchive: (c: TaskCell) => boolean; canSupervise: (c: TaskCell) => boolean;
  canAcknowledgeCell: (c: TaskCell) => boolean; canSendCells: (c: TaskCell) => boolean;
  onOpenCell: (id: string) => void;
  onRemarks: (c: TaskCell) => void; onSignWithRemarks: (c: TaskCell) => void; onSign: (c: TaskCell) => void; onArchive: (c: TaskCell) => void;
  onAcknowledge: (c: TaskCell) => void; onForward: (c: TaskCell) => void; onDelegate: (c: TaskCell) => void;
  onApproveSupervision: (c: TaskCell) => void; onCorrection: (c: TaskCell) => void; onSendToSupervision: (c: TaskCell) => void;
  onSendToReview: (c: TaskCell) => void; onSendToAcknowledge: (c: TaskCell) => void;
  hasPermission: (key: PermissionKey) => boolean;
  getColorKey: (name: string) => string;
  onPreview: (file: { fileName: string; storagePath: string }) => void;
}

const RETURN_STATUSES = new Set(["Замечания", "Подписано", "Подписано с замечанием", "Согласовано", "На исправление"]);

export default function ActiveTable({ cells, loading, emptyMsg,
  canReview, canArchive, canSupervise, canAcknowledgeCell, canSendCells, onOpenCell, onRemarks, onSignWithRemarks, onSign, onArchive,
  onAcknowledge, onForward, onDelegate, onApproveSupervision, onCorrection, onSendToSupervision,
  onSendToReview, onSendToAcknowledge,
  hasPermission, getColorKey, onPreview,
}: ActiveTableProps) {
  const [formatDropdown, setFormatDropdown] = useState<{ cellId: string; ext: string } | null>(null);
  const formatDropdownRef = useRef<HTMLDivElement>(null);
  const formatBtnRef = useRef<HTMLButtonElement>(null);

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

  return (
    <>
    <table className="ds-table w-full">
      <thead>
        <tr>
          <th className="text-left px-2 py-1 text-[10px] w-28">Дата</th>
          <th className="text-left px-2 py-1 text-[10px]">Наименование</th>
          <th className="text-left px-2 py-1 text-[10px]">Вид работ</th>
          <th className="text-left px-2 py-1 text-[10px]">Файлы</th>
          <th className="text-left px-2 py-1 text-[10px]">Статус</th>
          <th className="text-left px-2 py-1 text-[10px]">Сообщение</th>
          <th className="text-left px-2 py-1 text-[10px]">Действия</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr><td colSpan={7} className="px-4 py-12 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</td></tr>
        ) : cells.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-4 py-12 text-center">
              <svg className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="font-medium" style={{ color: "var(--ds-text-muted)" }}>Нет задач</p>
              <p className="text-sm mt-1" style={{ color: "var(--ds-text-faint)" }}>{emptyMsg}</p>
            </td>
          </tr>
        ) : (
          cells.map((cell) => (
            <tr key={cell.id} className="cursor-pointer" onDoubleClick={() => onOpenCell(cell.id)}>
              <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--ds-text-muted)" }}>{formatDate(cell.created_at)}</td>
              <td className="px-4 py-3 font-medium" style={{ color: "var(--ds-text)" }}>{cell.name}</td>
              <td className="px-2 py-0.5" style={{ color: "var(--ds-text-muted)" }}>{cell.dict_work_types?.name || "\u2014"}</td>
              <td className="px-2 py-0.5">
                {cell.cell_files.length === 0 ? <span style={{ color: "var(--ds-text-faint)" }}>{"\u2014"}</span> : (
                  <div className="flex flex-wrap gap-1">
                    {[...new Set(cell.cell_files.map((f) => getExt(f.file_name)))].map((ext) => {
                      const filesOfExt = cell.cell_files.filter((f) => getExt(f.file_name) === ext);
                      const previewableExt = isPreviewable(`file.${ext}`);
                      const isOpen = formatDropdown?.cellId === cell.id && formatDropdown?.ext === ext;
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
                              : { background: "color-mix(in srgb, var(--ds-text-faint) 8%, var(--ds-surface))", color: "var(--ds-text-muted)", borderColor: "color-mix(in srgb, var(--ds-text-faint) 15%, transparent)" }
                            }
                            title={previewableExt ? `${ext} — нажмите для просмотра/скачивания` : filesOfExt.length === 1 ? `Скачать ${ext}` : `${filesOfExt.length} файл(ов) ${ext}`}
                          >
                            {ext}
                            {filesOfExt.length > 1 && <span className="ml-0.5 text-[10px] opacity-60">{filesOfExt.length}</span>}
                          </button>
                          <DropdownPortal anchorRef={formatBtnRef} open={isOpen} className="min-w-[220px] max-w-[320px]">
                            <div ref={formatDropdownRef}>
                              <div className="px-3 py-1.5 text-xs" style={{ color: "var(--ds-text-faint)", borderBottom: "1px solid var(--ds-border)" }}>
                                {ext} — {filesOfExt.length} файл(ов)
                              </div>
                              {filesOfExt.map((file) => (
                                <div key={file.id} className="flex items-center gap-1 px-2 py-1">
                                  <span className="flex-1 text-sm truncate px-1" style={{ color: "var(--ds-text)" }} title={file.file_name}>{file.file_name}</span>
                                  {previewableExt && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onPreview({ fileName: file.file_name, storagePath: file.storage_path }); setFormatDropdown(null); }}
                                      className="ds-icon-btn p-1 shrink-0"
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
                            </div>
                          </DropdownPortal>
                        </div>
                      );
                    })}
                  </div>
                )}
              </td>
              <td className="px-2 py-0.5">
                <span className="inline-block w-[130px] text-center px-1.5 py-px rounded-full text-[10px] font-medium whitespace-nowrap" style={getStatusStyle(getColorKey(cell.status), cell.progress_percent)}>{cell.status}</span>
                {cell.status === "Новый" && cell.creator && <div className="text-[11px] mt-0.5" style={{ color: "var(--ds-text-faint)" }}>{shortName(cell.creator)}</div>}
                {cell.status === "На проверке" && cell.assignee && <div className="text-[11px] mt-0.5" style={{ color: "var(--ds-text-faint)" }}>{shortName(cell.assignee)}</div>}
                {RETURN_STATUSES.has(cell.status) && cell.assigner && (
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--ds-text-faint)" }}>{shortName(cell.assigner)}</div>
                )}
                {cell.status === "У авторского надзора" && cell.assignee && (
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--ds-text-faint)" }}>{shortName(cell.assignee)}</div>
                )}
              </td>
              <td className="px-4 py-3 text-xs max-w-[200px] truncate" style={{ color: "var(--ds-text-muted)" }} title={cell.lastMessage || ""}>
                {cell.lastMessage || "\u2014"}
              </td>
              <td className="px-2 py-0.5">
                <div className="flex gap-1 items-center">
                  <button onClick={(e) => { e.stopPropagation(); onOpenCell(cell.id); }}
                    className="ds-action-btn" title="Открыть">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  {cell.cell_files?.length > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); downloadAsZip(cell.cell_files.map((f) => ({ storagePath: f.storage_path, fileName: f.file_name })), cell.name || "файлы"); }}
                      className="ds-action-btn" title="Скачать все файлы (ZIP)">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  )}
                  {canReview(cell) && cell.send_type === "review" && (
                    <>
                      {hasPermission("can_remark") && (
                        <button onClick={(e) => { e.stopPropagation(); onRemarks(cell); }}
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
                          <button onClick={(e) => { e.stopPropagation(); onSignWithRemarks(cell); }}
                            className="ds-action-btn" title="Подписать с замечанием">
                            <svg className="w-4 h-4" fill="none" stroke="#f59e0b" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onForward(cell); }}
                            className="ds-action-btn" title="Подписать и переслать">
                            <svg className="w-4 h-4" fill="none" stroke="#6366f1" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </button>
                        </>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); onDelegate(cell); }}
                        className="ds-action-btn" title="Делегировать">
                        <svg className="w-4 h-4" fill="none" stroke="#8b5cf6" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    </>
                  )}
                  {canAcknowledgeCell(cell) && (
                    <button onClick={(e) => { e.stopPropagation(); onAcknowledge(cell); }}
                      className="ds-action-btn" title="Ознакомлен">
                      <svg className="w-4 h-4" fill="none" stroke="#2563eb" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  )}
                  {canSupervise(cell) && cell.send_type === "supervision" && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); if (confirm(`Согласовать "${cell.name}"?`)) onApproveSupervision(cell); }}
                        className="ds-action-btn" title="Согласовать">
                        <svg className="w-4 h-4" fill="none" stroke="#059669" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onCorrection(cell); }}
                        className="ds-action-btn" title="На исправление">
                        <svg className="w-4 h-4" fill="none" stroke="#e11d48" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h2" />
                        </svg>
                      </button>
                    </>
                  )}
                  {canSendCells(cell) && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); onSendToReview(cell); }}
                        className="ds-action-btn" title="На проверку">
                        <svg className="w-4 h-4" fill="none" stroke="#22c55e" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onSendToAcknowledge(cell); }}
                        className="ds-action-btn" title="На ознакомление">
                        <svg className="w-4 h-4" fill="none" stroke="#f59e0b" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onSendToSupervision(cell); }}
                        className="ds-action-btn" title="На АН">
                        <svg className="w-4 h-4" fill="none" stroke="#7c3aed" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </button>
                    </>
                  )}
                  {canArchive(cell) && (
                    <button onClick={(e) => { e.stopPropagation(); onArchive(cell); }}
                      className="ds-action-btn" title="В архив">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ stroke: "var(--ds-text-muted)" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
    </>
  );
}
