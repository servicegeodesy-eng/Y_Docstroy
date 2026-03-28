import { memo, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadRawFile, removeFiles } from "@/lib/fileStorage";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { formatSize, getExt, formatDate, downloadStorage, isPreviewable } from "@/lib/utils";
import { useDictionaries } from "@/hooks/useDictionaries";
import FilePreviewModal from "@/components/ui/FilePreviewModal";

interface GroCellData {
  id: string;
  building_id: string | null;
  floor_id: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  dict_buildings: { name: string } | null;
  dict_floors: { name: string } | null;
}

interface GroFile {
  id: string;
  gro_cell_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  uploaded_by: string;
  uploaded_at: string;
}

interface GroFileVersion {
  id: string;
  file_id: string;
  version_number: number;
  file_name: string;
  file_size: number;
  storage_path: string;
  uploaded_at: string;
}

interface Props {
  groCellId: string;
  isPortalAdmin?: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

function parseFileName(fileName: string): { base: string; ext: string } {
  const dotIndex = fileName.lastIndexOf(".");
  const nameWithoutExt = dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
  const ext = dotIndex > 0 ? fileName.substring(dotIndex) : "";
  const base = nameWithoutExt.replace(/ v\d+$/, "");
  return { base, ext };
}

function GroCellDetailModal({ groCellId, isPortalAdmin, onClose, onUpdated }: Props) {
  const { project, hasPermission } = useProject();
  const { user } = useAuth();
  const [cell, setCell] = useState<GroCellData | null>(null);
  const [files, setFiles] = useState<GroFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [versionFileId, setVersionFileId] = useState<string | null>(null);
  const [fileVersions, setFileVersions] = useState<GroFileVersion[]>([]);
  const [previewFile, setPreviewFile] = useState<{ fileName: string; storagePath: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editBuilding, setEditBuilding] = useState("");
  const [editFloor, setEditFloor] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const { buildings, floors, loadDicts } = useDictionaries();

  const canEdit = hasPermission("can_edit_gro");

  const loadCell = useCallback(async () => {
    const { data } = await supabase
      .from("gro_cells")
      .select("id, building_id, floor_id, description, created_by, created_at, dict_buildings(name), dict_floors(name)")
      .eq("id", groCellId)
      .single();
    if (data) setCell(data as unknown as GroCellData);
  }, [groCellId]);

  const loadFiles = useCallback(async () => {
    const { data } = await supabase
      .from("gro_cell_files")
      .select("*")
      .eq("gro_cell_id", groCellId)
      .order("uploaded_at", { ascending: true });
    if (data) setFiles(data as GroFile[]);
  }, [groCellId]);

  useEffect(() => {
    Promise.all([loadCell(), loadFiles()]).then(() => setLoading(false));
  }, [loadCell, loadFiles]);

  useEffect(() => { if (canEdit) loadDicts(); }, [canEdit, loadDicts]);

  function startEditing() {
    if (!cell) return;
    setEditBuilding(cell.building_id || "");
    setEditFloor(cell.floor_id || "");
    setEditDescription(cell.description || "");
    setEditing(true);
  }

  async function saveEditing() {
    if (!cell || !user) return;
    setSaving(true);
    const updates: Record<string, unknown> = {
      building_id: editBuilding || null,
      floor_id: editFloor || null,
      description: editDescription.trim() || null,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("gro_cells").update(updates).eq("id", groCellId);
    setSaving(false);
    setEditing(false);
    await loadCell();
    onUpdated();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !user || !project) return;
    const uploads = await Promise.all(
      Array.from(e.target.files).map(async (file) => {
        try {
          const storagePath = await uploadRawFile(`${project.id}/gro/${groCellId}`, file);
          return {
            gro_cell_id: groCellId, file_name: file.name, file_size: file.size,
            mime_type: file.type || "application/octet-stream",
            storage_path: storagePath, uploaded_by: user.id,
          };
        } catch (err) { console.error("Upload error:", err); return null; }
      })
    );
    const rows = uploads.filter(Boolean);
    if (rows.length) await supabase.from("gro_cell_files").insert(rows);
    await loadFiles();
    onUpdated();
  }

  async function handleVersionUpload(fileToUpdate: GroFile, e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !user || !project) return;
    const newFile = e.target.files[0];

    const { data: versions } = await supabase
      .from("gro_cell_file_versions")
      .select("version_number")
      .eq("file_id", fileToUpdate.id)
      .order("version_number", { ascending: false })
      .limit(1);
    const maxVersion = versions?.[0]?.version_number || 0;

    const { base, ext: origExt } = parseFileName(fileToUpdate.file_name);
    const oldVersionNumber = maxVersion === 0 ? 1 : maxVersion + 1;
    const oldVersionName = `${base} v${oldVersionNumber}${origExt}`;

    await supabase.from("gro_cell_file_versions").insert({
      file_id: fileToUpdate.id,
      version_number: oldVersionNumber,
      file_name: oldVersionName,
      file_size: fileToUpdate.file_size,
      mime_type: fileToUpdate.mime_type,
      storage_path: fileToUpdate.storage_path,
      uploaded_by: user.id,
    });

    const newVersionNumber = oldVersionNumber + 1;
    const newExt = newFile.name.includes(".") ? "." + newFile.name.split(".").pop() : "";
    let newPath: string;
    try {
      newPath = await uploadRawFile(`${project.id}/gro/${groCellId}`, newFile);
    } catch (err) { console.error(err); return; }

    const newDisplayName = `${base} v${newVersionNumber}${newExt}`;
    await supabase.from("gro_cell_files").update({
      file_name: newDisplayName,
      file_size: newFile.size,
      mime_type: newFile.type || "application/octet-stream",
      storage_path: newPath,
    }).eq("id", fileToUpdate.id);

    await loadFiles();
    onUpdated();
    if (versionFileId === fileToUpdate.id) loadFileVersions(fileToUpdate.id);
  }

  async function loadFileVersions(fileId: string) {
    const { data } = await supabase
      .from("gro_cell_file_versions")
      .select("*")
      .eq("file_id", fileId)
      .order("version_number", { ascending: false });
    if (data) setFileVersions(data as GroFileVersion[]);
    setVersionFileId(fileId);
  }

  async function handleDelete() {
    if (!confirm("Удалить эту запись ГРО и все её файлы?")) return;
    // Удаляем файлы из storage
    await removeFiles(files.map((f) => f.storage_path));
    await supabase.from("gro_cells").delete().eq("id", groCellId);
    onUpdated();
    onClose();
  }

  if (loading || !cell) {
    return (
      <div className="ds-overlay">
        <div className="ds-modal p-8">
          <div className="ds-spinner mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="ds-overlay" onClick={onClose}>
      <div
        className="ds-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="ds-modal-header">
          <div>
            <h2 className="ds-modal-title">Запись ГРО</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--ds-text-muted)" }}>{formatDate(cell.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            {isPortalAdmin && (
              <button
                onClick={handleDelete}
                className="p-1.5 rounded transition-colors"
                style={{ color: "var(--ds-text-faint)" }}
                title="Удалить запись"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button onClick={onClose} className="ds-icon-btn">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Информация */}
          {editing ? (
            <div className="space-y-3 p-3 rounded-lg" style={{ background: "var(--ds-surface-sunken)", border: "1px solid var(--ds-border)" }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ds-label">Место работ <span style={{ color: "#ef4444" }}>*</span></label>
                  <select value={editBuilding} onChange={(e) => setEditBuilding(e.target.value)} className="ds-input w-full" required>
                    <option value="">Выберите...</option>
                    {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="ds-label">Уровень</label>
                  <select value={editFloor} onChange={(e) => setEditFloor(e.target.value)} className="ds-input w-full">
                    <option value="">Не указан</option>
                    {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="ds-label">Описание</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="ds-input w-full resize-none"
                  placeholder="Необязательное описание..."
                />
              </div>
              <div className="flex gap-2">
                <button onClick={saveEditing} disabled={saving || !editBuilding} className="ds-btn px-3 py-1.5 text-sm">
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
                <button onClick={() => setEditing(false)} disabled={saving} className="ds-btn-secondary px-3 py-1.5 text-sm">
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs" style={{ color: "var(--ds-text-muted)" }}>Место работ</span>
                  <p className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{cell.dict_buildings?.name || "\u2014"}</p>
                </div>
                <div>
                  <span className="text-xs" style={{ color: "var(--ds-text-muted)" }}>Уровень</span>
                  <p className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{cell.dict_floors?.name || "\u2014"}</p>
                </div>
              </div>

              {cell.description && (
                <div>
                  <span className="text-xs" style={{ color: "var(--ds-text-muted)" }}>Описание</span>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap" style={{ color: "var(--ds-text)" }}>{cell.description}</p>
                </div>
              )}

              {canEdit && (
                <button onClick={startEditing} className="ds-btn-secondary px-3 py-1.5 text-sm flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Редактировать
                </button>
              )}
            </>
          )}

          {/* Файлы */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>Файлы ({files.length})</h4>
              {hasPermission("can_edit_gro") && (
                <label className="px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors" style={{ color: "var(--ds-accent)" }}>
                  + Добавить файл
                  <input type="file" multiple onChange={handleFileUpload} className="hidden" />
                </label>
              )}
            </div>
            {files.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Нет загруженных файлов</p>
            ) : (
              <ul className="space-y-1">
                {files.map((f) => (
                  <li key={f.id}>
                    <div className="flex items-center gap-2 px-3 py-2 rounded group" style={{ background: "var(--ds-surface-sunken)" }}>
                      <span className="inline-block px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "var(--ds-border)", color: "var(--ds-text-muted)" }}>
                        {getExt(f.file_name)}
                      </span>
                      <button
                        onClick={() => {
                          if (isPreviewable(f.file_name)) {
                            setPreviewFile({ fileName: f.file_name, storagePath: f.storage_path });
                          } else if (hasPermission("can_download_files")) {
                            downloadStorage(f.storage_path, f.file_name);
                          }
                        }}
                        className="flex-1 text-sm truncate text-left transition-colors"
                        style={{ color: "var(--ds-text)" }}
                        title={isPreviewable(f.file_name) ? "Просмотр" : hasPermission("can_download_files") ? "Скачать" : "Скачивание запрещено"}
                      >
                        {f.file_name}
                      </button>
                      <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatSize(f.file_size)}</span>
                      <button
                        onClick={() => loadFileVersions(f.id)}
                        className="ds-icon-btn p-1"
                        title="Версии"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      {hasPermission("can_edit_gro") && (
                        <label className="ds-btn-secondary px-2 py-0.5 text-xs cursor-pointer" title="Загрузить новую версию">
                          Обновить
                          <input type="file" onChange={(e) => handleVersionUpload(f, e)} className="hidden" />
                        </label>
                      )}
                      {hasPermission("can_download_files") && (
                        <button
                          onClick={() => downloadStorage(f.storage_path, f.file_name)}
                          className="ds-icon-btn p-1"
                          title="Скачать"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {versionFileId === f.id && (
                      <div className="ml-8 mt-1 mb-2 space-y-1">
                        {fileVersions.length === 0 ? (
                          <p className="text-xs px-2 py-1" style={{ color: "var(--ds-text-faint)" }}>Нет предыдущих версий</p>
                        ) : (
                          fileVersions.map((v) => (
                            <div key={v.id} className="flex items-center gap-2 px-2 py-1 rounded text-xs" style={{ background: "color-mix(in srgb, #a855f7 10%, var(--ds-surface))" }}>
                              <span className="font-medium" style={{ color: "#a855f7" }}>v{v.version_number}</span>
                              <span className="truncate flex-1" style={{ color: "var(--ds-text-muted)" }}>{v.file_name}</span>
                              <span style={{ color: "var(--ds-text-faint)" }}>{formatSize(v.file_size)}</span>
                              {hasPermission("can_download_files") && (
                                <button
                                  onClick={() => downloadStorage(v.storage_path, v.file_name)}
                                  style={{ color: "var(--ds-accent)" }}
                                >
                                  Скачать
                                </button>
                              )}
                            </div>
                          ))
                        )}
                        <button onClick={() => setVersionFileId(null)} className="text-xs px-2" style={{ color: "var(--ds-text-faint)" }}>
                          Скрыть
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

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


export default memo(GroCellDetailModal);
