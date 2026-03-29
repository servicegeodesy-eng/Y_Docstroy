import { useRef, useEffect, useState } from "react";
import { getExt, formatDate, downloadStorage, downloadAsZip, isPreviewable, shortName } from "@/lib/utils";
import { useProject } from "@/lib/ProjectContext";
import DropdownPortal from "@/components/ui/DropdownPortal";
import type { ProfileShort } from "@/lib/utils";

interface RequestRow {
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

const STATUS_STYLES: Record<string, { background: string; color: string }> = {
  "В работе": { background: "color-mix(in srgb, #f59e0b 15%, var(--ds-surface))", color: "#f59e0b" },
  "Выполнено": { background: "color-mix(in srgb, #22c55e 15%, var(--ds-surface))", color: "#22c55e" },
  "Отклонено": { background: "color-mix(in srgb, #ef4444 15%, var(--ds-surface))", color: "#ef4444" },
};

interface Props {
  cells: RequestRow[];
  loading: boolean;
  activeTab: string;
  userId: string | undefined;
  canExecute: boolean;
  isPortalAdmin: boolean;
  isAdmin: boolean;
  acknowledgedIds: Set<string>;
  getStatusUser: (cell: RequestRow) => string;
  onDoubleClick: (cellId: string) => void;
  onExecute: (cell: { id: string; name: string }) => void;
  onReject: (cell: { id: string; name: string }) => void;
  onAcknowledge: (cellId: string) => void;
  onStatusChange: (cellId: string, currentStatus: string, newStatus: string) => void;
  onPreview: (file: { fileName: string; storagePath: string }) => void;
}

export default function RequestsTable({
  cells, loading, activeTab, userId, canExecute, isPortalAdmin, isAdmin, acknowledgedIds,
  getStatusUser, onDoubleClick, onExecute, onReject, onAcknowledge, onStatusChange, onPreview,
}: Props) {
  const { hasPermission, isProjectAdmin: isProjectAdminCtx } = useProject();
  // Файлы доступны только выполняющим или админам
  const canDownload = hasPermission("can_download_files") && (canExecute || isAdmin || isPortalAdmin || isProjectAdminCtx);
  const [statusDropdownCellId, setStatusDropdownCellId] = useState<string | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const [formatDropdown, setFormatDropdown] = useState<{ cellId: string; ext: string } | null>(null);
  const formatDropdownRef = useRef<HTMLDivElement>(null);
  const formatBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownCellId(null);
      }
    }
    if (statusDropdownCellId) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [statusDropdownCellId]);

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

  function getUniqueFormats(files: { file_name: string }[]) {
    const exts = new Set(files.map((f) => getExt(f.file_name)));
    return Array.from(exts);
  }

  async function downloadAllFiles(cell: RequestRow) {
    if (!canDownload) return;
    await downloadAsZip(
      cell.cell_files.map((f) => ({ storagePath: f.storage_path, fileName: f.file_name })),
      cell.name || "заявка",
    );
  }

  return (
    <div className="ds-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="ds-table w-full">
          <thead>
            <tr>
              <th className="text-left px-2 py-1 text-[10px] w-28">Дата</th>
              <th className="text-left px-2 py-1 text-[10px]">Создатель</th>
              <th className="text-left px-2 py-1 text-[10px]">Работа</th>
              <th className="text-left px-2 py-1 text-[10px]">Место работ</th>
              <th className="text-left px-2 py-1 text-[10px]">Вид работ</th>
              <th className="text-left px-2 py-1 text-[10px]">Уровни/срезы</th>
              <th className="text-left px-2 py-1 text-[10px]">Конструкция</th>
              <th className="text-left px-2 py-1 text-[10px]">Файлы</th>
              <th className="text-left px-2 py-1 text-[10px]">Описание</th>
              <th className="text-left px-2 py-1 text-[10px]">Статус</th>
              <th className="text-left px-2 py-1 text-[10px] w-32">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка заявок...</td>
              </tr>
            ) : cells.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center">
                  <p className="font-medium" style={{ color: "var(--ds-text-muted)" }}>
                    {activeTab === "inwork" ? "Нет заявок в работе" : "Нет выполненных заявок"}
                  </p>
                  {activeTab === "inwork" && <p className="text-sm mt-1" style={{ color: "var(--ds-text-faint)" }}>Нажмите «Создать заявку» для добавления.</p>}
                </td>
              </tr>
            ) : (
              cells.map((cell) => {
                const isInWork = cell.status === "В работе";
                const isDone = cell.status === "Выполнено" || cell.status === "Отклонено";
                const isCreator = cell.created_by === userId;
                const isUnacknowledged = isDone && isCreator && !acknowledgedIds.has(cell.id);

                return (
                  <tr key={cell.id} className="cursor-pointer" onDoubleClick={() => onDoubleClick(cell.id)}>
                    <td className="px-4 py-1.5 whitespace-nowrap text-sm" style={{ color: "var(--ds-text-muted)" }}>
                      <span className="inline-flex items-center gap-1.5">
                        {isUnacknowledged && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                        {formatDate(cell.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>
                      {cell.created_by === userId ? <span className="text-xs font-medium" style={{ color: "var(--ds-accent)" }}>Вы</span> : shortName(cell.creator)}
                    </td>
                    <td className="px-4 py-1.5 text-sm">
                      {cell.request_work_type ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "color-mix(in srgb, #6366f1 15%, var(--ds-surface))", color: "#6366f1" }}>
                          {cell.request_work_type}
                        </span>
                      ) : "\u2014"}
                    </td>
                    <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>{cell.dict_buildings?.name || "\u2014"}</td>
                    <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>{cell.dict_work_types?.name || "\u2014"}</td>
                    <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>{cell.dict_floors?.name || "\u2014"}</td>
                    <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>{cell.dict_constructions?.name || "\u2014"}</td>
                    <td className="px-4 py-1.5">
                      {cell.cell_files.length === 0 || !canDownload ? (
                        <span style={{ color: "var(--ds-text-faint)" }}>{cell.cell_files.length > 0 ? `${cell.cell_files.length} файл(ов)` : "\u2014"}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {getUniqueFormats(cell.cell_files).map((ext) => {
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
                                    } else if (canDownload) {
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
                                        {canDownload && (
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
                    <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>
                      {cell.description ? (
                        <div className="line-clamp-2">{cell.description}</div>
                      ) : "\u2014"}
                      {(cell.cell_public_comments?.[0]?.count || 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 mt-0.5" style={{ color: "var(--ds-text-faint)" }} title={`Комментариев: ${cell.cell_public_comments[0].count}`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span className="text-[10px]">{cell.cell_public_comments[0].count}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-1.5">
                      <div className="relative">
                        <button
                          ref={statusDropdownCellId === cell.id ? statusBtnRef : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isPortalAdmin || isAdmin) setStatusDropdownCellId(statusDropdownCellId === cell.id ? null : cell.id);
                          }}
                          className={`inline-block w-[120px] text-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${(isPortalAdmin || isAdmin) ? "cursor-pointer hover:opacity-80" : ""}`}
                          style={STATUS_STYLES[cell.status] || { background: "color-mix(in srgb, #6b7280 15%, var(--ds-surface))", color: "var(--ds-text-muted)" }}
                        >
                          {cell.status}
                          {(isPortalAdmin || isAdmin) && (
                            <svg className="w-3 h-3 inline ml-1 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </button>
                        <DropdownPortal anchorRef={statusBtnRef} open={statusDropdownCellId === cell.id} className="w-44">
                          <div ref={statusDropdownCellId === cell.id ? statusDropdownRef : undefined}>
                            {["В работе", "Выполнено", "Отклонено"]
                              .filter((s) => s !== cell.status)
                              .map((s) => (
                                <button
                                  key={s}
                                  onClick={(e) => { e.stopPropagation(); onStatusChange(cell.id, cell.status, s); setStatusDropdownCellId(null); }}
                                  className="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2"
                                >
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium" style={STATUS_STYLES[s]}>{s}</span>
                                </button>
                              ))}
                          </div>
                        </DropdownPortal>
                      </div>
                      {getStatusUser(cell) && (
                        <div className="text-[11px] mt-0.5 truncate max-w-[120px]" style={{ color: "var(--ds-text-faint)" }}>{getStatusUser(cell)}</div>
                      )}
                    </td>
                    <td className="px-4 py-1.5">
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onDoubleClick(cell.id); }}
                          className="ds-action-btn"
                          title="Открыть"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        {cell.cell_files.length > 0 && canDownload && (
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadAllFiles(cell); }}
                            className="ds-action-btn"
                            title="Скачать все файлы"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                        )}
                        {isInWork && canExecute && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); onExecute({ id: cell.id, name: cell.name }); }}
                              className="ds-action-btn"
                              title="Выполнить"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onReject({ id: cell.id, name: cell.name }); }}
                              className="ds-action-btn"
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
                            onClick={(e) => { e.stopPropagation(); onAcknowledge(cell.id); }}
                            className="px-2.5 py-1 text-xs rounded-lg transition-all duration-150 font-medium whitespace-nowrap border hover:shadow-sm hover:-translate-y-px active:translate-y-0"
                            style={{ color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", borderColor: "color-mix(in srgb, var(--ds-accent) 25%, transparent)" }}
                            title="Ознакомлен"
                          >
                            Ознакомлен
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
