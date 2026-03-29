import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadCellFile, uploadRawFile, removeFiles, deleteCellFile } from "@/lib/fileStorage";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { formatSize, getExt, downloadStorage, isPreviewable } from "@/lib/utils";
import FilePreviewModal from "@/components/ui/FilePreviewModal";
import type { CellFile, CellFileVersion } from "@/types";

interface Props {
  cellId: string;
  files: CellFile[];
  isLocked: boolean;
  isSent?: boolean;
  canModifyFiles?: boolean;
  canAddFiles?: boolean;
  canDeleteFiles?: boolean;
  canUpdateFiles?: boolean;
  isAdmin?: boolean;
  onFilesChanged: () => void;
}

/** Извлекает базовое имя файла без суффикса версии и расширения */
function parseFileName(fileName: string): { base: string; ext: string } {
  const dotIndex = fileName.lastIndexOf(".");
  const nameWithoutExt = dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
  const ext = dotIndex > 0 ? fileName.substring(dotIndex) : "";
  const base = nameWithoutExt.replace(/ v\d+$/, "");
  return { base, ext };
}

export default function CellFileSection({ cellId, files, isLocked, isSent, canModifyFiles = true, canAddFiles, canDeleteFiles, canUpdateFiles, isAdmin, onFilesChanged }: Props) {
  const { project, hasPermission } = useProject();
  const { user } = useAuth();
  const [versionFileId, setVersionFileId] = useState<string | null>(null);
  const [fileVersions, setFileVersions] = useState<CellFileVersion[]>([]);
  const [versionCounts, setVersionCounts] = useState<Map<string, number>>(new Map());
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ fileName: string; storagePath: string } | null>(null);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function loadVersionCounts(fileIds: string[]) {
    if (fileIds.length === 0) return;
    const { data } = await supabase
      .from("cell_file_versions")
      .select("file_id")
      .in("file_id", fileIds);
    const counts = new Map<string, number>();
    if (data) {
      for (const row of data) {
        counts.set(row.file_id, (counts.get(row.file_id) || 0) + 1);
      }
    }
    setVersionCounts(counts);
  }

  // Загрузить счётчики версий при первом рендере
  useState(() => {
    loadVersionCounts(files.map((f) => f.id));
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    e.target.value = "";
    setPendingFiles((prev) => [...prev, ...selected]);
  }

  function handleReplacePending(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const replacement = e.target.files[0];
    setPendingFiles((prev) => prev.map((f, i) => (i === index ? replacement : f)));
    e.target.value = "";
  }

  function removePending(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadPendingFiles() {
    if (!user || !project || pendingFiles.length === 0) return;
    setUploading(true);
    await Promise.all(pendingFiles.map(async (file) => {
      try {
        await uploadCellFile(project.id, cellId, file, user.id);
      } catch (e) {
        console.error("Upload error:", e);
      }
    }));
    setPendingFiles([]);
    setUploading(false);
    onFilesChanged();
  }

  async function handleVersionUpload(fileToUpdate: CellFile, e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !user || !project) return;
    const newFile = e.target.files[0];
    setUploading(true);

    const { data: versions } = await supabase
      .from("cell_file_versions")
      .select("version_number")
      .eq("file_id", fileToUpdate.id)
      .order("version_number", { ascending: false })
      .limit(1);
    const maxExistingVersion = versions?.[0]?.version_number || 0;

    // Извлекаем базовое имя из оригинального файла
    const { base, ext: origExt } = parseFileName(fileToUpdate.file_name);

    // Версия для старого файла (в истории)
    const oldVersionNumber = maxExistingVersion === 0 ? 1 : maxExistingVersion + 1;
    // Имя старой версии: "Пилот v1.pdf"
    const oldVersionName = `${base} v${oldVersionNumber}${origExt}`;

    const { error: versionErr } = await supabase.from("cell_file_versions").insert({
      file_id: fileToUpdate.id, version_number: oldVersionNumber,
      file_name: oldVersionName, file_size: fileToUpdate.file_size,
      mime_type: fileToUpdate.mime_type, storage_path: fileToUpdate.storage_path, uploaded_by: user.id,
    });
    if (versionErr) { console.error("Version insert error:", versionErr); setUploading(false); return; }

    // Новая версия файла
    const newVersionNumber = oldVersionNumber + 1;
    let newPath: string;
    try {
      newPath = await uploadRawFile(`${project.id}/${cellId}`, newFile);
    } catch (uploadErr) {
      await supabase.from("cell_file_versions").delete()
        .eq("file_id", fileToUpdate.id).eq("version_number", oldVersionNumber);
      console.error("Upload error, version record removed:", uploadErr);
      setUploading(false);
      return;
    }

    // Имя новой версии: "Пилот v2.pdf"
    const newExt = newFile.name.includes(".") ? "." + newFile.name.split(".").pop() : "";
    const newDisplayName = `${base} v${newVersionNumber}${newExt}`;

    const { error: updateErr } = await supabase.from("cell_files").update({
      file_name: newDisplayName, file_size: newFile.size,
      mime_type: newFile.type || "application/octet-stream", storage_path: newPath,
    }).eq("id", fileToUpdate.id);

    if (updateErr) {
      await removeFiles([newPath]);
      await supabase.from("cell_file_versions").delete()
        .eq("file_id", fileToUpdate.id).eq("version_number", oldVersionNumber);
      console.error("Update error, upload and version removed:", updateErr);
      setUploading(false);
      return;
    }

    await supabase.from("cell_history").insert({
      cell_id: cellId, user_id: user.id, action: "file_version_added",
      details: { file_name: newDisplayName, version: newVersionNumber },
    });

    setUploading(false);
    onFilesChanged();
    if (versionFileId === fileToUpdate.id) loadFileVersions(fileToUpdate.id);
  }

  async function loadFileVersions(fileId: string) {
    const { data } = await supabase
      .from("cell_file_versions")
      .select("*")
      .eq("file_id", fileId)
      .order("version_number", { ascending: false });
    if (data) setFileVersions(data);
    setVersionFileId(fileId);
  }

  async function moveToScan(file: CellFile) {
    if (!user) return;
    if (!confirm(`Перенести файл "${file.file_name}" в скан?`)) return;
    await supabase.from("cell_files").update({ category: "archive_scan" }).eq("id", file.id);
    await supabase.from("cell_history").insert({
      cell_id: cellId, user_id: user.id, action: "scan_attached",
      details: { file_name: file.file_name, moved_from_files: true },
    });
    onFilesChanged();
  }

  async function deleteFile(file: CellFile) {
    if (!confirm(`Удалить файл "${file.file_name}"?`)) return;
    await deleteCellFile(file.id, file.storage_path);
    onFilesChanged();
  }

  function startRename(file: CellFile) {
    const { base } = parseFileName(file.file_name);
    setRenamingFileId(file.id);
    setRenameValue(base);
  }

  async function commitRename(file: CellFile) {
    const newBase = renameValue.trim();
    if (!newBase || !user) { setRenamingFileId(null); return; }
    const { ext } = parseFileName(file.file_name);
    // Сохраняем суффикс версии, если есть
    const versionMatch = file.file_name.match(/ (v\d+)\.[^.]+$/) || file.file_name.match(/ (v\d+)$/);
    const versionSuffix = versionMatch ? ` ${versionMatch[1]}` : "";
    const newName = `${newBase}${versionSuffix}${ext}`;
    if (newName === file.file_name) { setRenamingFileId(null); return; }
    const oldName = file.file_name;
    await supabase.from("cell_files").update({ file_name: newName }).eq("id", file.id);
    await supabase.from("cell_history").insert({
      cell_id: cellId, user_id: user.id, action: "file_renamed",
      details: { old_name: oldName, new_name: newName },
    });
    setRenamingFileId(null);
    onFilesChanged();
  }

  return (
    <div className="relative">
      {uploading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg" style={{ background: "color-mix(in srgb, var(--ds-surface) 80%, transparent)" }}>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: "var(--ds-surface-elevated)", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
            <div className="ds-spinner w-4 h-4" />
            <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>Загрузка файла...</span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium" style={{ color: "var(--ds-text-muted)" }}>Файлы ({files.length})</h4>
        {(canAddFiles !== undefined ? canAddFiles : (hasPermission("can_edit_cell") && canModifyFiles)) && (
          <label className="ds-btn-secondary px-3 py-1.5 text-sm cursor-pointer">
            + Добавить файл
            <input type="file" multiple onChange={handleFileSelect} className="hidden" />
          </label>
        )}
      </div>
      {pendingFiles.length > 0 && (
        <div className="mb-3 p-3 border-2 border-dashed rounded-lg" style={{ borderColor: "var(--ds-accent)", background: "var(--ds-surface-sunken)" }}>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--ds-accent)" }}>Выбранные файлы для загрузки:</p>
          <ul className="space-y-1 mb-2">
            {pendingFiles.map((f, i) => (
              <li key={i} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)" }}>
                <span className="inline-block px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-accent)" }}>{getExt(f.name)}</span>
                <span className="flex-1 text-sm truncate" style={{ color: "var(--ds-text-muted)" }}>{f.name}</span>
                <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatSize(f.size)}</span>
                <label className="ds-icon-btn cursor-pointer" title="Заменить файл">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  <input type="file" onChange={(e) => handleReplacePending(i, e)} className="hidden" />
                </label>
                <button onClick={() => removePending(i)} className="ds-icon-btn" title="Убрать">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={uploadPendingFiles}
              disabled={uploading}
              className="ds-btn px-3 py-1.5 text-sm"
            >
              {uploading ? "Загрузка..." : "Загрузить"}
            </button>
            <button
              onClick={() => setPendingFiles([])}
              disabled={uploading}
              className="ds-btn-secondary px-3 py-1.5 text-sm"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
      {files.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Нет загруженных файлов</p>
      ) : (
        <ul className="space-y-1">
          {files.map((f) => {
            const hasVersions = (versionCounts.get(f.id) || 0) > 0;
            return (
              <li key={f.id}>
                <div className="flex items-center gap-2 px-3 py-2 rounded group" style={{ background: "var(--ds-surface-sunken)" }}>
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono ${isPreviewable(f.file_name) ? "cursor-pointer active:opacity-70" : ""}`}
                    style={{ background: "var(--ds-border)", color: isPreviewable(f.file_name) ? "var(--ds-accent)" : "var(--ds-text-muted)" }}
                    onClick={() => { if (isPreviewable(f.file_name)) setPreviewFile({ fileName: f.file_name, storagePath: f.storage_path }); }}
                  >{getExt(f.file_name)}</span>
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
                      <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{parseFileName(f.file_name).ext}</span>
                    </form>
                  ) : (
                    <button
                      onClick={() => {
                        if (isPreviewable(f.file_name)) {
                          setPreviewFile({ fileName: f.file_name, storagePath: f.storage_path });
                        } else if (hasPermission("can_download_files")) {
                          downloadStorage(f.storage_path, f.file_name);
                        }
                      }}
                      className="flex-1 text-sm truncate text-left transition-colors"
                      style={{ color: "var(--ds-text-muted)" }}
                      title={isPreviewable(f.file_name) ? "Просмотр" : hasPermission("can_download_files") ? "Скачать" : "Скачивание запрещено"}
                    >
                      {f.file_name}
                    </button>
                  )}
                  <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatSize(f.file_size)}</span>
                  {renamingFileId !== f.id && (canUpdateFiles !== undefined ? canUpdateFiles : (hasPermission("can_edit_cell") && canModifyFiles)) && (
                    <button onClick={() => startRename(f)} className="ds-icon-btn opacity-0 group-hover:opacity-100 transition-opacity" title="Переименовать">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  )}
                  {hasVersions && (
                    <button onClick={() => loadFileVersions(f.id)} className="ds-icon-btn" title="История версий">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  )}
                  {!hasVersions && (
                    <button onClick={() => loadFileVersions(f.id)} className="ds-icon-btn" title="Версии">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  )}
                  {(canUpdateFiles !== undefined ? canUpdateFiles : (hasPermission("can_edit_cell") && canModifyFiles)) && (
                    <label className={`ds-btn-secondary px-2 py-0.5 text-xs ${uploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`} title="Загрузить новую версию">
                      {uploading ? "Загрузка..." : "Обновить"}
                      <input type="file" onChange={(e) => handleVersionUpload(f, e)} className="hidden" disabled={uploading} />
                    </label>
                  )}
                  {hasPermission("can_download_files") && (
                    <button onClick={() => downloadStorage(f.storage_path, f.file_name)} className="ds-icon-btn" title="Скачать">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => moveToScan(f)} className="ds-icon-btn opacity-0 group-hover:opacity-100 transition-opacity" title="Перенести в скан">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </button>
                  )}
                  {(canDeleteFiles !== undefined ? canDeleteFiles : (hasPermission("can_edit_cell") && !isLocked && !isSent)) && (
                    <button onClick={() => deleteFile(f)} className="ds-icon-btn opacity-0 group-hover:opacity-100 transition-opacity" title="Удалить">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
                {versionFileId === f.id && (
                  <div className="ml-8 mt-1 mb-2 space-y-1">
                    {fileVersions.length === 0 ? (
                      <p className="text-xs px-2 py-1" style={{ color: "var(--ds-text-faint)" }}>Нет предыдущих версий</p>
                    ) : (
                      fileVersions.map((v) => (
                        <div key={v.id} className="flex items-center gap-2 px-2 py-1 rounded text-xs" style={{ background: "var(--ds-surface-sunken)" }}>
                          <span className="font-medium" style={{ color: "var(--ds-accent)" }}>v{v.version_number}</span>
                          <span className="truncate flex-1" style={{ color: "var(--ds-text-muted)" }}>{v.file_name}</span>
                          <span style={{ color: "var(--ds-text-faint)" }}>{formatSize(v.file_size)}</span>
                          {hasPermission("can_download_files") && (
                            <button onClick={() => downloadStorage(v.storage_path, v.file_name)} style={{ color: "var(--ds-accent)" }}>
                              Скачать
                            </button>
                          )}
                        </div>
                      ))
                    )}
                    <button onClick={() => setVersionFileId(null)} className="text-xs px-2" style={{ color: "var(--ds-text-faint)" }}>Скрыть</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {previewFile && (
        <FilePreviewModal
          fileName={previewFile.fileName}
          storagePath={previewFile.storagePath}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
