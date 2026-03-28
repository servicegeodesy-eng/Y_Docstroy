import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadRawFile, removeFiles } from "@/lib/fileStorage";
import { useAuth } from "@/lib/AuthContext";
import { useProject } from "@/lib/ProjectContext";
import { formatSize, downloadStorage, getExt, isPreviewable } from "@/lib/utils";
import type { CellFile } from "@/types";

function parseBaseName(fileName: string): { base: string; ext: string } {
  const dotIndex = fileName.lastIndexOf(".");
  const nameWithoutExt = dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
  const ext = dotIndex > 0 ? fileName.substring(dotIndex) : "";
  return { base: nameWithoutExt, ext };
}

interface Props {
  cellId: string;
  projectId: string;
  archiveScans: CellFile[];
  canAttachScan: boolean;
  isFinalApproved: boolean;
  canArchive: boolean;
  isAdmin?: boolean;
  onFilesChanged: () => void;
  onArchived: () => void;
  onPreview: (fileName: string, storagePath: string) => void;
}

export default function ArchiveScansSection({
  cellId,
  projectId,
  archiveScans,
  canAttachScan,
  isFinalApproved,
  canArchive,
  isAdmin,
  onFilesChanged,
  onArchived,
  onPreview,
}: Props) {
  const { user } = useAuth();
  const { hasPermission } = useProject();
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function startRename(f: CellFile) {
    const { base } = parseBaseName(f.file_name);
    setRenamingFileId(f.id);
    setRenameValue(base);
  }

  async function commitRename(f: CellFile) {
    const newBase = renameValue.trim();
    if (!newBase || !user) { setRenamingFileId(null); return; }
    const { ext } = parseBaseName(f.file_name);
    const newName = `${newBase}${ext}`;
    if (newName === f.file_name) { setRenamingFileId(null); return; }
    const oldName = f.file_name;
    await supabase.from("cell_files").update({ file_name: newName }).eq("id", f.id);
    await supabase.from("cell_history").insert({
      cell_id: cellId, user_id: user.id, action: "file_renamed",
      details: { old_name: oldName, new_name: newName },
    });
    setRenamingFileId(null);
    onFilesChanged();
  }

  async function deleteScan(f: CellFile) {
    if (!user) return;
    if (!confirm(`Удалить скан "${f.file_name}"?`)) return;
    await removeFiles([f.storage_path]);
    await supabase.from("cell_files").delete().eq("id", f.id);
    await supabase.from("cell_history").insert({
      cell_id: cellId, user_id: user.id, action: "scan_deleted",
      details: { file_name: f.file_name },
    });
    onFilesChanged();
  }

  async function moveToFiles(f: CellFile) {
    if (!user) return;
    if (!confirm(`Перенести "${f.file_name}" в файлы?`)) return;
    const { error } = await supabase.from("cell_files").update({ category: "general" }).eq("id", f.id);
    if (error) { console.error("moveToFiles error:", error); alert("Ошибка при переносе: " + error.message); return; }
    await supabase.from("cell_history").insert({
      cell_id: cellId, user_id: user.id, action: "file_uploaded",
      details: { file_name: f.file_name, moved_from_scan: true },
    });
    onFilesChanged();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium" style={{ color: "var(--ds-text-muted)" }}>
          Подписано на бумаге {archiveScans.length > 0 && `(${archiveScans.length})`}
        </h4>
        {(isAdmin || (canAttachScan && !isFinalApproved)) && (
          <label className="ds-btn-secondary px-3 py-1.5 text-sm cursor-pointer">
            + Прикрепить скан
            <input type="file" accept="image/*,.pdf" onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file || !user) return;
              let storagePath: string;
              try {
                storagePath = await uploadRawFile(`${projectId}/${cellId}`, file);
              } catch (err) { console.error(err); return; }
              await supabase.from("cell_files").insert({
                cell_id: cellId, file_name: file.name, file_size: file.size,
                mime_type: file.type || "application/octet-stream",
                storage_path: storagePath, uploaded_by: user.id, category: "archive_scan",
              });
              await supabase.from("cell_history").insert({
                cell_id: cellId, user_id: user.id, action: "scan_attached",
                details: { file_name: file.name },
              });
              onFilesChanged();
            }} className="hidden" />
          </label>
        )}
      </div>
      {archiveScans.length > 0 && (
        <div className="space-y-1.5">
          {archiveScans.map((f) => (
            <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg group" style={{ background: "color-mix(in srgb, #22c55e 8%, var(--ds-surface))", border: "1px solid color-mix(in srgb, #22c55e 20%, var(--ds-border))" }}>
              <span className="inline-block px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "color-mix(in srgb, #22c55e 20%, var(--ds-surface))", color: "#22c55e" }}>{getExt(f.file_name)}</span>
              {renamingFileId === f.id ? (
                <form
                  className="flex-1 flex items-center gap-1"
                  onSubmit={(e) => { e.preventDefault(); commitRename(f); }}
                >
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(f)}
                    onKeyDown={(e) => { if (e.key === "Escape") setRenamingFileId(null); }}
                    className="ds-input py-0.5 px-1.5 text-sm flex-1"
                  />
                  <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{parseBaseName(f.file_name).ext}</span>
                </form>
              ) : (
                <button
                  onClick={() => {
                    if (isPreviewable(f.file_name)) {
                      onPreview(f.file_name, f.storage_path);
                    } else if (hasPermission("can_download_files")) {
                      downloadStorage(f.storage_path, f.file_name);
                    }
                  }}
                  className="flex-1 text-sm truncate text-left" style={{ color: "var(--ds-text)" }}
                  title={isPreviewable(f.file_name) ? "Просмотр" : hasPermission("can_download_files") ? "Скачать" : "Скачивание запрещено"}
                >
                  {f.file_name}
                </button>
              )}
              <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatSize(f.file_size)}</span>
              {renamingFileId !== f.id && canAttachScan && (
                <button onClick={() => startRename(f)} className="ds-icon-btn" title="Переименовать">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              )}
              {isAdmin && (
                <button onClick={() => moveToFiles(f)} className="ds-icon-btn" title="Перенести в файлы">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                </button>
              )}
              {hasPermission("can_download_files") && (
                <button onClick={() => downloadStorage(f.storage_path, f.file_name)} className="ds-icon-btn" title="Скачать">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </button>
              )}
              {isAdmin && (
                <button onClick={() => deleteScan(f)} className="ds-icon-btn opacity-0 group-hover:opacity-100 transition-opacity" title="Удалить скан">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {archiveScans.length > 0 && !isFinalApproved && canArchive && (
        <button
          onClick={async () => {
            if (!user || !confirm("Отправить ячейку в архив? Статус изменится на «Окончательно утверждён».")) return;
            await supabase.from("cell_archives").insert({ cell_id: cellId, user_id: user.id });
            await supabase.from("cells").update({ status: "Окончательно утверждён" }).eq("id", cellId);
            await supabase.from("cell_history").insert({
              cell_id: cellId, user_id: user.id, action: "archived",
              details: { scans: archiveScans.length },
            });
            onArchived();
          }}
          className="mt-3 ds-btn flex items-center gap-2"
          style={{ background: "#22c55e", borderColor: "#22c55e" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
          </svg>
          В архив
        </button>
      )}
    </div>
  );
}
