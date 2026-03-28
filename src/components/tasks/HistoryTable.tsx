import { useEffect, useRef, useState } from "react";
import type { CellStatus, PermissionKey } from "@/types";
import { getStatusStyle } from "@/constants/statusColors";
import { shortName, getExt, formatDate, downloadStorage, downloadAsZip, isPreviewable } from "@/lib/utils";
import DropdownPortal from "@/components/ui/DropdownPortal";
import type { ProfileShort } from "@/lib/utils";

export interface ShareRow {
  id: string;
  created_at: string;
  message: string | null;
  cell_id: string;
  from_user_id: string;
  to_user_id: string;
  cells: {
    id: string;
    name: string;
    status: CellStatus;
    dict_work_types: { name: string } | null;
    cell_files: { id: string; file_name: string; storage_path: string }[];
  } | null;
  from_profile: ProfileShort | null;
  to_profile: ProfileShort | null;
}

export default function HistoryTable({ shares, loading, emptyMsg, onOpenCell, userId, getColorKey, hasPermission, onPreview }: {
  shares: ShareRow[]; loading: boolean; emptyMsg: string;
  onOpenCell: (id: string) => void; userId?: string;
  getColorKey: (name: string) => string;
  hasPermission: (key: PermissionKey) => boolean;
  onPreview: (file: { fileName: string; storagePath: string }) => void;
}) {
  const [formatDropdown, setFormatDropdown] = useState<{ shareId: string; ext: string } | null>(null);
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
          <th className="text-left px-2 py-1 text-[10px]">От кого</th>
          <th className="text-left px-2 py-1 text-[10px]">Кому</th>
          <th className="text-left px-2 py-1 text-[10px]">Файлы</th>
          <th className="text-left px-2 py-1 text-[10px]">Статус</th>
          <th className="text-left px-2 py-1 text-[10px]">Сообщение</th>
          <th className="text-left px-2 py-1 text-[10px] w-16">Действия</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr><td colSpan={8} className="px-4 py-12 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</td></tr>
        ) : shares.length === 0 ? (
          <tr>
            <td colSpan={8} className="px-4 py-12 text-center">
              <svg className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-medium" style={{ color: "var(--ds-text-muted)" }}>Нет записей</p>
              <p className="text-sm mt-1" style={{ color: "var(--ds-text-faint)" }}>{emptyMsg}</p>
            </td>
          </tr>
        ) : (
          shares.map((s) => {
            if (!s.cells) return null;
            const isMe = (id: string) => id === userId;
            return (
              <tr key={s.id} className="cursor-pointer" onDoubleClick={() => onOpenCell(s.cells!.id)}>
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--ds-text-muted)" }}>{formatDate(s.created_at)}</td>
                <td className="px-4 py-3 font-medium" style={{ color: "var(--ds-text)" }}>{s.cells.name}</td>
                <td className="px-2 py-0.5" style={{ color: "var(--ds-text-muted)" }}>
                  {isMe(s.from_user_id) ? <span className="text-xs font-medium" style={{ color: "var(--ds-accent)" }}>Вы</span> : shortName(s.from_profile)}
                </td>
                <td className="px-2 py-0.5" style={{ color: "var(--ds-text-muted)" }}>
                  {isMe(s.to_user_id) ? <span className="text-xs font-medium" style={{ color: "var(--ds-accent)" }}>Вы</span> : shortName(s.to_profile)}
                </td>
                <td className="px-2 py-0.5">
                  {s.cells.cell_files.length === 0 ? <span style={{ color: "var(--ds-text-faint)" }}>{"\u2014"}</span> : (
                    <div className="flex flex-wrap gap-1">
                      {[...new Set(s.cells.cell_files.map((f) => getExt(f.file_name)))].map((ext) => {
                        const filesOfExt = s.cells!.cell_files.filter((f) => getExt(f.file_name) === ext);
                        const previewableExt = isPreviewable(`file.${ext}`);
                        const isOpen = formatDropdown?.shareId === s.id && formatDropdown?.ext === ext;
                        return (
                          <div key={ext} className="relative">
                            <button
                              ref={isOpen ? formatBtnRef : undefined}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (previewableExt || filesOfExt.length > 1) {
                                  setFormatDropdown(isOpen ? null : { shareId: s.id, ext });
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
                  <span className="inline-block w-[130px] text-center px-1.5 py-px rounded-full text-[10px] font-medium whitespace-nowrap" style={getStatusStyle(getColorKey(s.cells.status), null)}>
                    {s.cells.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs max-w-[200px] truncate" style={{ color: "var(--ds-text-muted)" }}>
                  {s.message || "\u2014"}
                </td>
                <td className="px-2 py-0.5">
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onOpenCell(s.cells!.id); }}
                      className="ds-action-btn" title="Открыть">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                    {s.cells.cell_files.length > 0 && hasPermission("can_download_files") && (
                      <button onClick={(e) => { e.stopPropagation(); downloadAsZip(s.cells!.cell_files.map((f) => ({ storagePath: f.storage_path, fileName: f.file_name })), s.cells!.name || "файлы"); }}
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
          })
        )}
      </tbody>
    </table>
    </>
  );
}
