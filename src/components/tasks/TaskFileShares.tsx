import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { useMobile } from "@/lib/MobileContext";
import { shortName, formatDateTime, getExt, downloadAsZip, isPreviewable } from "@/lib/utils";
import { downloadShareFile } from "@/lib/fileShareStorage";
import type { ProfileShort } from "@/lib/utils";
import Pagination, { usePagination, getStoredPageSize } from "@/components/ui/Pagination";
import DropdownPortal from "@/components/ui/DropdownPortal";
import FilePreviewModal from "@/components/ui/FilePreviewModal";
import ShareDetailModal from "@/components/fileshare/ShareDetailModal";

interface ShareFile { id: string; file_name: string; file_size: number; storage_path: string }

interface FileShareRow {
  id: string;
  comment: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
  created_by: string;
  tag: string | null;
  manual_tag: string | null;
  creator: ProfileShort | null;
  file_share_files: ShareFile[];
  file_share_recipients: { user_id: string; is_read: boolean; trashed_at: string | null }[];
}

function getUniqueFormats(files: ShareFile[]) {
  const exts = new Set(files.map((f) => getExt(f.file_name)));
  return Array.from(exts);
}

export default function TaskFileShares() {
  const { project } = useProject();
  const { user } = useAuth();
  const { isMobile } = useMobile();
  const [rows, setRows] = useState<FileShareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(getStoredPageSize);
  const [formatDropdown, setFormatDropdown] = useState<{ shareId: string; ext: string } | null>(null);
  const formatBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [previewFile, setPreviewFile] = useState<{ fileName: string; storagePath: string; shareId: string } | null>(null);
  const [detailShareId, setDetailShareId] = useState<string | null>(null);

  useEffect(() => {
    if (!formatDropdown) return;
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setFormatDropdown(null);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [formatDropdown]);

  const load = useCallback(async () => {
    if (!project || !user) return;
    setLoading(true);
    const { data } = await supabase
      .from("file_shares")
      .select(`
        id, comment, status, created_at, sent_at, created_by, tag, manual_tag,
        creator:profiles!created_by(last_name, first_name, middle_name),
        file_share_files(id, file_name, storage_path, file_size),
        file_share_recipients(user_id, is_read, trashed_at)
      `)
      .eq("project_id", project.id)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(200);
    if (data) setRows(data as unknown as FileShareRow[]);
    setLoading(false);
  }, [project, user]);

  useEffect(() => { load(); }, [load]);

  // Только непрочитанные входящие файлы
  const filtered = useMemo(() => {
    if (!user) return [];
    return rows.filter((r) =>
      r.created_by !== user.id &&
      r.file_share_recipients.some((rec) => rec.user_id === user.id && !rec.trashed_at && !rec.is_read)
    );
  }, [rows, user]);

  const paginated = usePagination(filtered, page, pageSize);

  const isUnread = (r: FileShareRow) => {
    if (!user) return false;
    const rec = r.file_share_recipients.find((x) => x.user_id === user.id);
    return rec ? !rec.is_read : false;
  };

  async function markAsRead(id: string) {
    if (!user) return;
    await supabase.from("file_share_recipients").update({ is_read: true }).eq("share_id", id).eq("user_id", user.id);
  }


  if (loading) {
    return <div className="ds-card p-6 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка файлов...</div>;
  }

  if (filtered.length === 0) {
    return (
      <div className="ds-card p-8 text-center">
        <p className="font-medium" style={{ color: "var(--ds-text-muted)" }}>Нет входящих файлов</p>
      </div>
    );
  }

  return (
    <div>
      {isMobile ? (
        <div className="space-y-2">
          {paginated.map((s) => {
            const unread = isUnread(s);
            return (
              <div key={s.id} className="ds-card p-3"
                style={unread ? { background: "color-mix(in srgb, var(--ds-accent) 4%, var(--ds-surface))" } : undefined}
                onClick={() => { markAsRead(s.id); setDetailShareId(s.id); }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {unread && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                    <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatDateTime(s.sent_at || s.created_at)}</span>
                  </div>
                </div>
                <div className="text-sm font-medium mb-1" style={{ color: "var(--ds-text)" }}>
                  От: {shortName(s.creator)}
                </div>
                {s.comment && <div className="text-xs line-clamp-2 mb-1" style={{ color: "var(--ds-text-muted)" }}>{s.comment}</div>}
                {s.tag && (
                  <div className="text-xs mb-1">
                    <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text-faint)" }}>{s.tag}</span>
                  </div>
                )}
                {s.file_share_files.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {getUniqueFormats(s.file_share_files).map((ext) => {
                      const filesOfExt = s.file_share_files.filter((f) => getExt(f.file_name) === ext);
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
                  {s.file_share_files.length > 0 && (
                    <button onClick={() => { markAsRead(s.id); downloadAsZip(s.file_share_files.map((f) => ({ storagePath: f.storage_path, fileName: f.file_name })), s.comment || "файлы", "fileshare-files"); }}
                      className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))" }}>
                      Скачать
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ds-table w-full text-sm">
              <thead>
                <tr style={{ background: "var(--ds-surface-sunken)", borderBottom: "1px solid var(--ds-border)" }}>
                  <th className="text-left px-2 py-1 font-medium text-[10px] w-32" style={{ color: "var(--ds-text-muted)" }}>Дата</th>
                  <th className="text-left px-2 py-1 font-medium text-[10px] w-28" style={{ color: "var(--ds-text-muted)" }}>Отправитель</th>
                  <th className="text-left px-2 py-1 font-medium text-[10px]" style={{ color: "var(--ds-text-muted)", minWidth: "160px" }}>Комментарий</th>
                  <th className="text-left px-2 py-1 font-medium text-[10px]" style={{ color: "var(--ds-text-muted)" }}>Метка</th>
                  <th className="text-left px-2 py-1 font-medium text-[10px]" style={{ color: "var(--ds-text-muted)" }}>Файлы</th>
                  <th className="text-left px-2 py-1 font-medium text-[10px] w-24" style={{ color: "var(--ds-text-muted)" }}>Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--ds-border)" }}>
                {paginated.map((s) => {
                  const unread = isUnread(s);
                  return (
                    <tr key={s.id} className="cursor-pointer" style={unread ? { background: "color-mix(in srgb, var(--ds-accent) 4%, var(--ds-surface))" } : undefined} onDoubleClick={() => { markAsRead(s.id); setDetailShareId(s.id); }}>
                      <td className="px-4 py-1.5 whitespace-nowrap text-sm" style={{ color: "var(--ds-text-muted)" }}>
                        <div className="flex items-center gap-1.5">
                          {unread && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                          {formatDateTime(s.sent_at || s.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text)" }}>
                        <span className="truncate max-w-[120px]">{shortName(s.creator)}</span>
                      </td>
                      <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text-muted)" }}>
                        <span className="truncate block max-w-[250px]">{s.comment || "—"}</span>
                      </td>
                      <td className="px-2 py-0.5 text-xs" style={{ color: "var(--ds-text-muted)" }}>
                        {s.tag ? <span className="truncate block max-w-[180px]" title={s.tag}>{s.tag}</span> : <span style={{ color: "var(--ds-text-faint)" }}>{"\u2014"}</span>}
                      </td>
                      <td className="px-2 py-0.5">
                        {s.file_share_files.length === 0 ? (
                          <span style={{ color: "var(--ds-text-faint)" }}>{"\u2014"}</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {getUniqueFormats(s.file_share_files).map((ext) => {
                              const filesOfExt = s.file_share_files.filter((f) => getExt(f.file_name) === ext);
                              const isOpen = formatDropdown?.shareId === s.id && formatDropdown?.ext === ext;
                              const previewableExt = isPreviewable(`file.${ext}`);
                              return (
                                <div key={ext} className="relative">
                                  <button
                                    ref={isOpen ? formatBtnRef : undefined}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (previewableExt || filesOfExt.length > 1) setFormatDropdown(isOpen ? null : { shareId: s.id, ext });
                                      else { markAsRead(s.id); downloadShareFile(filesOfExt[0].storage_path).then((blob) => { if (blob) { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = filesOfExt[0].file_name; a.click(); URL.revokeObjectURL(u); } }); }
                                    }}
                                    className="px-1.5 py-0.5 rounded text-xs font-mono transition-all duration-150 cursor-pointer border hover:shadow-sm hover:-translate-y-px active:translate-y-0"
                                    style={isOpen
                                      ? { background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "color-mix(in srgb, var(--ds-accent) 30%, transparent)" }
                                      : { background: "color-mix(in srgb, var(--ds-text-faint) 8%, var(--ds-surface))", color: "var(--ds-text-muted)", borderColor: "color-mix(in srgb, var(--ds-text-faint) 15%, transparent)" }}
                                  >
                                    {ext}{filesOfExt.length > 1 && <span className="ml-0.5 text-[10px] opacity-60">{filesOfExt.length}</span>}
                                  </button>
                                  <DropdownPortal anchorRef={formatBtnRef} open={isOpen} className="min-w-[220px] max-w-[320px]">
                                    <div ref={dropdownRef}>
                                      <div className="px-3 py-1.5 text-xs" style={{ color: "var(--ds-text-faint)", borderBottom: "1px solid var(--ds-border)" }}>
                                        {ext} — {filesOfExt.length} файл(ов)
                                      </div>
                                      {filesOfExt.map((file) => (
                                        <div key={file.id} className="flex items-center gap-1 px-2 py-1">
                                          <span className="flex-1 text-sm truncate px-1" style={{ color: "var(--ds-text-muted)" }} title={file.file_name}>{file.file_name}</span>
                                          {previewableExt && (
                                            <button onClick={(e) => { e.stopPropagation(); markAsRead(s.id); setPreviewFile({ fileName: file.file_name, storagePath: file.storage_path, shareId: s.id }); setFormatDropdown(null); }}
                                              className="p-1 rounded transition-colors shrink-0" style={{ color: "var(--ds-text-faint)" }} title="Просмотр">
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                              </svg>
                                            </button>
                                          )}
                                          <button onClick={(e) => { e.stopPropagation(); markAsRead(s.id); downloadShareFile(file.storage_path).then((blob) => { if (blob) { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = file.file_name; a.click(); URL.revokeObjectURL(u); } }); setFormatDropdown(null); }}
                                            className="p-1 rounded transition-colors shrink-0" style={{ color: "var(--ds-text-faint)" }} title="Скачать">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                          </button>
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
                        <div className="flex gap-1">
                          <button onClick={(e) => { e.stopPropagation(); markAsRead(s.id); setDetailShareId(s.id); }}
                            className="ds-action-btn" title="Открыть">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          {s.file_share_files.length > 0 && (
                            <button onClick={(e) => { e.stopPropagation(); markAsRead(s.id); downloadAsZip(s.file_share_files.map((f) => ({ storagePath: f.storage_path, fileName: f.file_name })), s.comment || "файлы", "fileshare-files"); }}
                              className="ds-action-btn" title="Скачать все файлы (ZIP)">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
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
      {previewFile && <FilePreviewModal fileName={previewFile.fileName} storagePath={previewFile.storagePath} bucket="fileshare-files" onClose={() => { setPreviewFile(null); load(); }} />}
      {detailShareId && <ShareDetailModal shareId={detailShareId} onClose={() => { setDetailShareId(null); load(); }} onUpdated={load} />}
    </div>
  );
}
