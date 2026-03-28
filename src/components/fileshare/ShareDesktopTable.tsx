import { useEffect, useRef, useState } from "react";
import { formatDateTime, getExt, isPreviewable, downloadAsZip } from "@/lib/utils";
import type { ProfileShort } from "@/lib/utils";
import DropdownPortal from "@/components/ui/DropdownPortal";

interface ShareFile { id: string; file_name: string; file_size: number; storage_path: string }

interface ShareRow {
  id: string;
  comment: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
  created_by: string;
  building_id: string | null;
  floor_id: string | null;
  work_type_id: string | null;
  construction_id: string | null;
  work_id: string | null;
  tag: string | null;
  manual_tag: string | null;
  creator: ProfileShort | null;
  file_share_files: ShareFile[];
  file_share_recipients: {
    user_id: string;
    is_read: boolean;
    trashed_at: string | null;
    recipient: ProfileShort | null;
  }[];
}

type Tab = "incoming" | "outgoing" | "drafts" | "all" | "trash";
type SortDir = "asc" | "desc";

function getUniqueFormats(files: ShareFile[]) {
  const exts = new Set(files.map((f) => getExt(f.file_name)));
  return Array.from(exts);
}

interface ShareDesktopTableProps {
  shares: ShareRow[];
  loading: boolean;
  activeTab: Tab;
  isIncoming: boolean;
  senderLabel: string;
  sortDir: SortDir;
  onToggleSort: () => void;
  userId: string | undefined;
  isUnread: (s: ShareRow) => boolean;
  senderOrRecipient: (s: ShareRow) => string;
  markAsRead: (id: string) => void;
  downloadFile: (storagePath: string, fileName: string) => void;
  handleTrashDraft: (id: string) => void;
  handleTrashIncoming: (id: string) => void;
  onOpenDraft: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onPreview: (fileName: string, storagePath: string) => void;
}

export default function ShareDesktopTable({
  shares, loading, activeTab, isIncoming, senderLabel, sortDir, onToggleSort,
  userId, isUnread, senderOrRecipient, markAsRead, downloadFile,
  handleTrashDraft, handleTrashIncoming, onOpenDraft, onOpenDetail, onPreview,
}: ShareDesktopTableProps) {
  const [formatDropdown, setFormatDropdown] = useState<{ shareId: string; ext: string } | null>(null);
  const formatBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!formatDropdown) return;
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFormatDropdown(null);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [formatDropdown]);

  return (
    <div className="ds-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="ds-table w-full text-sm">
          <thead>
            <tr style={{ background: "var(--ds-surface-sunken)", borderBottom: "1px solid var(--ds-border)" }}>
              <th
                onClick={onToggleSort}
                className="text-left px-2 py-1 font-medium text-[10px] cursor-pointer select-none w-32"
                style={{ color: "var(--ds-text-muted)" }}
              >
                <span className="inline-flex items-center gap-1">
                  Дата
                  <svg className={`w-3 h-3 ${sortDir === "desc" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </span>
              </th>
              <th className="text-left px-2 py-1 font-medium text-[10px] w-28" style={{ color: "var(--ds-text-muted)" }}>{senderLabel}</th>
              <th className="text-left px-2 py-1 font-medium text-[10px]" style={{ color: "var(--ds-text-muted)", minWidth: "160px" }}>Комментарий</th>
              <th className="text-left px-2 py-1 font-medium text-[10px]" style={{ color: "var(--ds-text-muted)" }}>Метка</th>
              <th className="text-left px-2 py-1 font-medium text-[10px]" style={{ color: "var(--ds-text-muted)" }}>Файлы</th>
              <th className="text-left px-2 py-1 font-medium text-[10px] w-24" style={{ color: "var(--ds-text-muted)" }}>Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--ds-border)" }}>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</td></tr>
            ) : shares.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <p className="font-medium" style={{ color: "var(--ds-text-muted)" }}>
                    {activeTab === "incoming" && "Нет входящих файлов"}
                    {activeTab === "outgoing" && "Вы ещё ничего не отправляли"}
                    {activeTab === "drafts" && "Нет черновиков"}
                    {activeTab === "all" && "Пока пусто"}
                    {activeTab === "trash" && "Корзина пуста"}
                  </p>
                </td>
              </tr>
            ) : (
              shares.map((s) => {
                const unread = isIncoming && isUnread(s);
                return (
                  <tr
                    key={s.id}
                    className="cursor-pointer"
                    style={unread ? { background: "color-mix(in srgb, var(--ds-accent) 4%, var(--ds-surface))" } : undefined}
                    onDoubleClick={() => {
                      if (s.status === "draft") onOpenDraft(s.id);
                      else onOpenDetail(s.id);
                    }}
                  >
                    <td className="px-4 py-1.5 whitespace-nowrap text-sm" style={{ color: "var(--ds-text-muted)" }}>
                      <div className="flex items-center gap-1.5">
                        {unread && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                        {formatDateTime(s.sent_at || s.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-1.5 text-sm" style={{ color: "var(--ds-text)" }}>
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[120px]">{senderOrRecipient(s)}</span>
                        {s.status === "draft" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "color-mix(in srgb, #f59e0b 15%, var(--ds-surface))", color: "#f59e0b" }}>Черновик</span>
                        )}
                      </div>
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
                                    else { markAsRead(s.id); downloadFile(filesOfExt[0].storage_path, filesOfExt[0].file_name); }
                                  }}
                                  className="px-1.5 py-0.5 rounded text-xs font-mono transition-all duration-150 cursor-pointer border hover:shadow-sm hover:-translate-y-px active:translate-y-0"
                                  style={isOpen
                                    ? { background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "color-mix(in srgb, var(--ds-accent) 30%, transparent)" }
                                    : { background: "color-mix(in srgb, var(--ds-text-faint) 8%, var(--ds-surface))", color: "var(--ds-text-muted)", borderColor: "color-mix(in srgb, var(--ds-text-faint) 15%, transparent)" }}
                                  title={previewableExt ? `${ext} — нажмите для просмотра/скачивания` : filesOfExt.length === 1 ? `Скачать ${ext}` : `${filesOfExt.length} файл(ов) ${ext}`}
                                >
                                  {ext}
                                  {filesOfExt.length > 1 && <span className="ml-0.5 text-[10px] opacity-60">{filesOfExt.length}</span>}
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
                                          <button onClick={(e) => { e.stopPropagation(); markAsRead(s.id); onPreview(file.file_name, file.storage_path); setFormatDropdown(null); }}
                                            className="p-1 rounded transition-colors shrink-0" style={{ color: "var(--ds-text-faint)" }} title="Просмотр">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                          </button>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); markAsRead(s.id); downloadFile(file.storage_path, file.file_name); setFormatDropdown(null); }}
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
                        <button onClick={(e) => { e.stopPropagation(); markAsRead(s.id); if (s.status === "draft") onOpenDraft(s.id); else onOpenDetail(s.id); }}
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
                        {s.status === "draft" && (
                          <button onClick={(e) => { e.stopPropagation(); handleTrashDraft(s.id); }} className="ds-action-btn" title="В корзину">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                        {s.status === "sent" && s.created_by !== userId && (
                          <button onClick={(e) => { e.stopPropagation(); handleTrashIncoming(s.id); }} className="ds-action-btn" title="В корзину">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
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
