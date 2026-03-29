import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { useMobile } from "@/lib/MobileContext";
import { shortName, formatDate, getExt, downloadStorage, downloadAsZip, isPreviewable } from "@/lib/utils";
import type { ProfileShort } from "@/lib/utils";
import Pagination, { usePagination, getStoredPageSize } from "@/components/ui/Pagination";
import DropdownPortal from "@/components/ui/DropdownPortal";
import FilePreviewModal from "@/components/ui/FilePreviewModal";
import ExecuteRequestModal from "@/components/requests/ExecuteRequestModal";
import RequestRemarksModal from "@/components/requests/RequestRemarksModal";
import RequestDetailModal from "@/components/requests/RequestDetailModal";

interface RequestRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  created_by: string;
  assigned_to: string | null;
  request_work_type: string | null;
  dict_buildings: { name: string } | null;
  dict_work_types: { name: string } | null;
  dict_floors: { name: string } | null;
  dict_constructions: { name: string } | null;
  cell_files: { id: string; file_name: string; storage_path: string }[];
  cell_comments: { count: number }[];
  creator: ProfileShort | null;
  assignee: ProfileShort | null;
}

const STATUS_STYLES: Record<string, { background: string; color: string }> = {
  "В работе": { background: "color-mix(in srgb, #f59e0b 15%, var(--ds-surface))", color: "#f59e0b" },
  "Выполнено": { background: "color-mix(in srgb, #22c55e 15%, var(--ds-surface))", color: "#22c55e" },
  "Отклонено": { background: "color-mix(in srgb, #ef4444 15%, var(--ds-surface))", color: "#ef4444" },
};

export default function TaskRequests() {
  const { project, hasPermission, isProjectAdmin } = useProject();
  const { user, isPortalAdmin } = useAuth();
  const { isMobile } = useMobile();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(getStoredPageSize);
  const [formatDropdown, setFormatDropdown] = useState<{ cellId: string; ext: string } | null>(null);
  const formatBtnRef = useRef<HTMLButtonElement>(null);
  const formatDropdownRef = useRef<HTMLDivElement>(null);
  const [previewFile, setPreviewFile] = useState<{ fileName: string; storagePath: string } | null>(null);
  const [detailCellId, setDetailCellId] = useState<string | null>(null);
  const [executeCell, setExecuteCell] = useState<{ id: string; name: string } | null>(null);
  const [rejectCell, setRejectCell] = useState<{ id: string; name: string } | null>(null);

  const canDownload = hasPermission("can_download_files") || isProjectAdmin || isPortalAdmin;
  const canExecute = hasPermission("can_execute_requests");

  useEffect(() => {
    if (!formatDropdown) return;
    function handleClick(e: MouseEvent) {
      if (formatDropdownRef.current && !formatDropdownRef.current.contains(e.target as Node)) setFormatDropdown(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [formatDropdown]);

  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!project || !user) return;
    setLoading(true);
    const [cellsRes, ackRes] = await Promise.all([
      supabase
        .from("cells")
        .select(`
          id, name, description, status, created_at, created_by, assigned_to, request_work_type,
          dict_buildings(name), dict_work_types(name), dict_floors(name), dict_constructions(name),
          cell_files(id, file_name, storage_path),
          cell_comments(count),
          creator:profiles!created_by(last_name, first_name, middle_name),
          assignee:profiles!assigned_to(last_name, first_name, middle_name)
        `)
        .eq("project_id", project.id)
        .eq("cell_type", "request")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("cell_history")
        .select("cell_id")
        .eq("user_id", user.id)
        .eq("action", "request_acknowledged"),
    ]);
    if (cellsRes.data) setRows(cellsRes.data as unknown as RequestRow[]);
    if (ackRes.data) setAcknowledgedIds(new Set(ackRes.data.map((a: { cell_id: string }) => a.cell_id)));
    setLoading(false);
  }, [project, user]);

  useEffect(() => { load(); }, [load]);

  // Только заявки, требующие действия от пользователя
  const filtered = useMemo(() => {
    if (!user) return [];
    return rows.filter((r) => {
      // «В работе»: только пользователи с can_execute_requests
      if (r.status === "В работе" && canExecute && (r.assigned_to === user.id || !r.assigned_to)) return true;
      // Создатель видит выполненные/отклонённые (пока не ознакомился)
      if (r.created_by === user.id && (r.status === "Выполнено" || r.status === "Отклонено") && !acknowledgedIds.has(r.id)) return true;
      return false;
    });
  }, [rows, user, acknowledgedIds, canExecute]);

  const paginated = usePagination(filtered, page, pageSize);

  function getUniqueFormats(files: { file_name: string }[]) {
    const exts = new Set(files.map((f) => getExt(f.file_name)));
    return Array.from(exts);
  }

  if (loading) {
    return <div className="ds-card p-6 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка заявок...</div>;
  }

  if (filtered.length === 0) {
    return (
      <div className="ds-card p-8 text-center">
        <p className="font-medium" style={{ color: "var(--ds-text-muted)" }}>Нет заявок</p>
      </div>
    );
  }

  return (
    <div>
      {isMobile ? (
        <div className="space-y-2">
          {paginated.map((r) => {
            const isInWork = r.status === "В работе";
            const isDone = r.status === "Выполнено" || r.status === "Отклонено";
            const isCreator = r.created_by === user?.id;
            const isExecutor = r.assigned_to === user?.id || !r.assigned_to;
            return (
            <div key={r.id} className="ds-card p-3" onClick={() => setDetailCellId(r.id)}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatDate(r.created_at)}</span>
                <span className="inline-block px-1.5 py-px rounded-full text-[10px] font-medium whitespace-nowrap"
                  style={STATUS_STYLES[r.status] || { background: "var(--ds-surface-sunken)", color: "var(--ds-text-muted)" }}>
                  {r.status}
                </span>
              </div>
              {r.request_work_type && (
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mb-1" style={{ background: "color-mix(in srgb, #6366f1 15%, var(--ds-surface))", color: "#6366f1" }}>
                  {r.request_work_type}
                </span>
              )}
              <div className="flex items-center gap-3 text-xs mb-1" style={{ color: "var(--ds-text-muted)" }}>
                <span>От: {r.created_by === user?.id ? "Вы" : shortName(r.creator)}</span>
                {r.assignee && <span>Исп: {r.assigned_to === user?.id ? "Вы" : shortName(r.assignee)}</span>}
              </div>
              {r.description && <div className="text-xs line-clamp-2 mb-1" style={{ color: "var(--ds-text-muted)" }}>{r.description}</div>}
              {r.cell_files.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {getUniqueFormats(r.cell_files).map((ext) => {
                    const filesOfExt = r.cell_files.filter((f) => getExt(f.file_name) === ext);
                    return (
                      <span key={ext} className="px-1.5 py-0.5 rounded text-xs font-mono border"
                        style={{ background: "color-mix(in srgb, var(--ds-text-faint) 8%, var(--ds-surface))", color: "var(--ds-text-muted)", borderColor: "color-mix(in srgb, var(--ds-text-faint) 15%, transparent)" }}>
                        {ext}{filesOfExt.length > 1 && <span className="ml-0.5 text-[10px] opacity-60">{filesOfExt.length}</span>}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                {isInWork && isExecutor && canExecute && (
                  <>
                    <button onClick={() => setExecuteCell({ id: r.id, name: r.name })}
                      className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "#059669", background: "color-mix(in srgb, #22c55e 10%, var(--ds-surface))" }}>Выполнить</button>
                    <button onClick={() => setRejectCell({ id: r.id, name: r.name })}
                      className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "#ef4444", background: "color-mix(in srgb, #ef4444 10%, var(--ds-surface))" }}>Отклонить</button>
                  </>
                )}
                {isDone && isCreator && (
                  <button onClick={() => supabase.from("cell_history").insert({ cell_id: r.id, user_id: user!.id, action: "request_acknowledged", details: {} }).then(() => load())}
                    className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))" }}>Ознакомлен</button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      ) : (
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
                {paginated.map((r) => {
                  const isInWork = r.status === "В работе";
                  const isDone = r.status === "Выполнено" || r.status === "Отклонено";
                  const isCreator = r.created_by === user?.id;
                  const isExecutor = r.assigned_to === user?.id || !r.assigned_to;
                  return (
                  <tr key={r.id} className="cursor-pointer" onDoubleClick={() => setDetailCellId(r.id)}>
                    <td className="px-4 py-1.5 whitespace-nowrap text-sm" style={{ color: "var(--ds-text-muted)" }}>{formatDate(r.created_at)}</td>
                    <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>
                      {r.created_by === user?.id ? <span className="text-xs font-medium" style={{ color: "var(--ds-accent)" }}>Вы</span> : shortName(r.creator)}
                    </td>
                    <td className="px-4 py-1.5 text-sm">
                      {r.request_work_type ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "color-mix(in srgb, #6366f1 15%, var(--ds-surface))", color: "#6366f1" }}>
                          {r.request_work_type}
                        </span>
                      ) : "\u2014"}
                    </td>
                    <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>{r.dict_buildings?.name || "\u2014"}</td>
                    <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>{r.dict_work_types?.name || "\u2014"}</td>
                    <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>{r.dict_floors?.name || "\u2014"}</td>
                    <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>{r.dict_constructions?.name || "\u2014"}</td>
                    <td className="px-4 py-1.5">
                      {r.cell_files.length === 0 || !canDownload ? (
                        <span style={{ color: "var(--ds-text-faint)" }}>{r.cell_files.length > 0 ? `${r.cell_files.length} файл(ов)` : "\u2014"}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {getUniqueFormats(r.cell_files).map((ext) => {
                            const filesOfExt = r.cell_files.filter((f) => getExt(f.file_name) === ext);
                            const previewableExt = isPreviewable(`file.${ext}`);
                            const isOpen = formatDropdown?.cellId === r.id && formatDropdown?.ext === ext;
                            return (
                              <div key={ext} className="relative">
                                <button
                                  ref={isOpen ? formatBtnRef : undefined}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (previewableExt || filesOfExt.length > 1) setFormatDropdown(isOpen ? null : { cellId: r.id, ext });
                                    else if (canDownload) downloadStorage(filesOfExt[0].storage_path, filesOfExt[0].file_name);
                                  }}
                                  className="px-1.5 py-0.5 rounded text-xs font-mono transition-all duration-150 cursor-pointer border hover:shadow-sm hover:-translate-y-px active:translate-y-0"
                                  style={isOpen
                                    ? { background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "color-mix(in srgb, var(--ds-accent) 30%, transparent)" }
                                    : { background: "color-mix(in srgb, var(--ds-text-faint) 8%, var(--ds-surface))", color: "var(--ds-text-muted)", borderColor: "color-mix(in srgb, var(--ds-text-faint) 15%, transparent)" }}
                                >
                                  {ext}{filesOfExt.length > 1 && <span className="ml-0.5 text-[10px] opacity-60">{filesOfExt.length}</span>}
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
                                          <button onClick={(e) => { e.stopPropagation(); setPreviewFile({ fileName: file.file_name, storagePath: file.storage_path }); setFormatDropdown(null); }}
                                            className="ds-icon-btn p-1 shrink-0" title="Просмотр">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                          </button>
                                        )}
                                        {canDownload && (
                                          <button onClick={(e) => { e.stopPropagation(); downloadStorage(file.storage_path, file.file_name); setFormatDropdown(null); }}
                                            className="p-1 rounded transition-colors shrink-0" style={{ color: "var(--ds-text-faint)" }} title="Скачать">
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
                      {r.description ? <div className="line-clamp-2">{r.description}</div> : "\u2014"}
                      {(r.cell_comments?.[0]?.count || 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 mt-0.5" style={{ color: "var(--ds-text-faint)" }} title={`Комментариев: ${r.cell_comments[0].count}`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span className="text-[10px]">{r.cell_comments[0].count}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-1.5">
                      <span className="inline-block w-[120px] text-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
                        style={STATUS_STYLES[r.status] || { background: "color-mix(in srgb, #6b7280 15%, var(--ds-surface))", color: "var(--ds-text-muted)" }}>
                        {r.status}
                      </span>
                      <div className="text-[11px] mt-0.5 truncate max-w-[120px]" style={{ color: "var(--ds-text-faint)" }}>
                        {r.status === "В работе" ? (r.assigned_to ? shortName(r.assignee) : "Служба геодезии") : shortName(r.creator)}
                      </div>
                    </td>
                    <td className="px-4 py-1.5">
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setDetailCellId(r.id); }} className="ds-action-btn" title="Открыть">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        {r.cell_files.length > 0 && canDownload && (
                          <button onClick={(e) => { e.stopPropagation(); downloadAsZip(r.cell_files.map((f) => ({ storagePath: f.storage_path, fileName: f.file_name })), r.name || "заявка"); }}
                            className="ds-action-btn" title="Скачать все файлы (ZIP)">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                        )}
                        {isInWork && isExecutor && canExecute && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); setExecuteCell({ id: r.id, name: r.name }); }} className="ds-action-btn" title="Выполнить">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setRejectCell({ id: r.id, name: r.name }); }} className="ds-action-btn" title="Отклонить">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        )}
                        {isDone && isCreator && (
                          <button onClick={(e) => {
                            e.stopPropagation();
                            supabase.from("cell_history").insert({ cell_id: r.id, user_id: user!.id, action: "request_acknowledged", details: {} }).then(() => load());
                          }}
                            className="px-2.5 py-1 text-xs rounded-lg transition-all duration-150 font-medium whitespace-nowrap border hover:shadow-sm hover:-translate-y-px active:translate-y-0"
                            style={{ color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", borderColor: "color-mix(in srgb, var(--ds-accent) 25%, transparent)" }}
                            title="Ознакомлен">
                            Ознакомлен
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Pagination totalItems={filtered.length} currentPage={page} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
      {previewFile && <FilePreviewModal fileName={previewFile.fileName} storagePath={previewFile.storagePath} onClose={() => setPreviewFile(null)} />}
      {detailCellId && (
        <RequestDetailModal cellId={detailCellId} onClose={() => setDetailCellId(null)} onUpdated={load} onAcknowledged={load} />
      )}
      {executeCell && (
        <ExecuteRequestModal cellId={executeCell.id} cellName={executeCell.name} onClose={() => setExecuteCell(null)} onExecuted={() => { setExecuteCell(null); load(); }} />
      )}
      {rejectCell && (
        <RequestRemarksModal cellId={rejectCell.id} cellName={rejectCell.name} onClose={() => setRejectCell(null)} onSent={() => { setRejectCell(null); load(); }} />
      )}
    </div>
  );
}
