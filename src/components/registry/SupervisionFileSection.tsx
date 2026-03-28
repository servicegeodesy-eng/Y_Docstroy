import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadRawFile } from "@/lib/fileStorage";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { formatSize, getExt, downloadStorage, isPreviewable, shortName } from "@/lib/utils";
import FilePreviewModal from "@/components/ui/FilePreviewModal";
import type { CellFile, CellFileVersion } from "@/types";

interface Props {
  cellId: string;
  projectId: string;
  supervisionFile: CellFile | null;
  isLocked: boolean;
  canAttach?: boolean;
  canUpdate?: boolean;
  /** Текущий send_type ячейки (для авто-согласования при загрузке файла АН) */
  cellSendType?: string | null;
  /** Текущий статус ячейки */
  cellStatus?: string | null;
  /** ID создателя ячейки */
  cellCreatedBy?: string | null;
  onFilesChanged: () => void;
}

function parseBaseName(fileName: string): { base: string; ext: string } {
  const dotIndex = fileName.lastIndexOf(".");
  const nameWithoutExt = dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
  const ext = dotIndex > 0 ? fileName.substring(dotIndex) : "";
  const base = nameWithoutExt.replace(/ v\d+$/, "");
  return { base, ext };
}

interface HistoryEntry {
  id: string;
  action: string;
  created_at: string;
  details: Record<string, unknown> | null;
  profiles: { last_name: string; first_name: string; middle_name: string | null } | null;
  comment_text: string | null;
  comment_files: { id: string; file_name: string; file_size: number; storage_path: string }[];
}

const AN_ACTIONS = ["sent_to_supervision", "supervision_approved", "correction_requested", "correction_required"];
const AN_ACTION_LABELS: Record<string, string> = {
  sent_to_supervision: "Отправлено на АН",
  supervision_approved: "Согласовано",
  correction_requested: "На исправление",
  correction_required: "На исправление (АН)",
};

export default function SupervisionFileSection({ cellId, projectId, supervisionFile, canAttach, canUpdate, cellSendType, cellStatus, cellCreatedBy, onFilesChanged }: Props) {
  const { hasPermission } = useProject();
  const canDownload = hasPermission("can_download_files");
  const canPreview = hasPermission("can_preview_files");
  const { user } = useAuth();
  const [versions, setVersions] = useState<CellFileVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFileState] = useState<{ fileName: string; storagePath: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => { loadHistory(); }, [cellId]);

  async function loadHistory() {
    // Загрузить историю действий АН
    const { data: histData } = await supabase
      .from("cell_history")
      .select("id, action, created_at, details, profiles:user_id(last_name, first_name, middle_name)")
      .eq("cell_id", cellId)
      .in("action", AN_ACTIONS)
      .order("created_at", { ascending: false });

    if (!histData) { setHistory([]); return; }

    // Загрузить связанные комментарии (correction_requested сохраняет в cell_comments)
    const { data: comments } = await supabase
      .from("cell_comments")
      .select("id, text, created_at, user_id, cell_comment_files(id, file_name, file_size, storage_path)")
      .eq("cell_id", cellId)
      .order("created_at", { ascending: false });

    type HistoryRaw = { id: string; action: string; created_at: string; details: Record<string, unknown> | null; profiles: { last_name: string; first_name: string; middle_name: string | null } | null };
    type CommentRaw = { id: string; text: string | null; created_at: string; user_id: string; cell_comment_files: { id: string; file_name: string; file_size: number; storage_path: string }[] };

    const entries: HistoryEntry[] = (histData as unknown as HistoryRaw[]).map((h) => {
      // Попробовать найти комментарий от того же пользователя примерно в то же время (±5 сек)
      const hTime = new Date(h.created_at).getTime();
      const relatedComment = (comments || []).find((c: CommentRaw) => {
        const cTime = new Date(c.created_at).getTime();
        return c.user_id === (h.details as Record<string, unknown> | null)?.to_user_id || (Math.abs(hTime - cTime) < 5000 && h.action === "correction_requested");
      });
      return {
        id: h.id,
        action: h.action,
        created_at: h.created_at,
        details: h.details,
        profiles: h.profiles,
        comment_text: h.action === "correction_requested" ? relatedComment?.text || (h.details as Record<string, unknown> | null)?.comment as string || null : null,
        comment_files: h.action === "correction_requested" ? relatedComment?.cell_comment_files || [] : [],
      };
    });

    setHistory(entries);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const selected = e.target.files[0];
    e.target.value = "";
    setPendingFile(selected);
  }

  function handleReplacePending(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const replacement = e.target.files[0];
    e.target.value = "";
    setPendingFile(replacement);
  }

  async function uploadPendingFile() {
    if (!pendingFile || !user) return;
    setUploading(true);
    const file = pendingFile;
    const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
    let storagePath: string;
    try {
      storagePath = await uploadRawFile(`${projectId}/${cellId}`, file);
    } catch (err) { console.error(err); setUploading(false); return; }

    if (supervisionFile) {
      const { data: vers } = await supabase
        .from("cell_file_versions").select("version_number")
        .eq("file_id", supervisionFile.id).order("version_number", { ascending: false }).limit(1);
      const maxV = vers?.[0]?.version_number || 0;
      const oldVNum = maxV === 0 ? 1 : maxV + 1;
      const { base, ext: oldExt } = parseBaseName(supervisionFile.file_name);
      await supabase.from("cell_file_versions").insert({
        file_id: supervisionFile.id, version_number: oldVNum,
        file_name: `${base} v${oldVNum}${oldExt}`, file_size: supervisionFile.file_size,
        mime_type: supervisionFile.mime_type, storage_path: supervisionFile.storage_path, uploaded_by: user.id,
      });
      const newVNum = oldVNum + 1;
      await supabase.from("cell_files").update({
        file_name: `${base} v${newVNum}${ext}`, file_size: file.size,
        mime_type: file.type || "application/octet-stream", storage_path: storagePath,
      }).eq("id", supervisionFile.id);
    } else {
      await supabase.from("cell_files").insert({
        cell_id: cellId, file_name: file.name, file_size: file.size,
        mime_type: file.type || "application/octet-stream", storage_path: storagePath,
        uploaded_by: user.id, category: "supervision_approval",
      });
    }
    await supabase.from("cell_history").insert({
      cell_id: cellId, user_id: user.id, action: "file_uploaded",
      details: { type: "supervision_approval" },
    });

    // Если ячейка на согласовании у АН или со статусом «На исправление» от АН — автоматически согласовать
    if (cellSendType === "supervision" || cellStatus === "На исправление") {
      const returnTo = cellCreatedBy || user.id;
      await supabase.from("cell_signatures").insert({
        cell_id: cellId, user_id: user.id, status: "Согласовано",
        comment: "Согласовано прикреплением файла АН",
        signed_at: new Date().toISOString(),
      });
      await supabase.from("cells").update({
        status: "Согласовано", assigned_to: returnTo, assigned_by: user.id, send_type: null,
      }).eq("id", cellId);
      await supabase.from("cell_shares").insert({
        cell_id: cellId, from_user_id: user.id, to_user_id: returnTo,
        message: "Согласовано авторским надзором",
      });
      await supabase.from("cell_history").insert({
        cell_id: cellId, user_id: user.id, action: "supervision_approved",
        details: { status: "Согласовано", method: "file_upload", to_user_id: returnTo },
      });
    }

    setPendingFile(null);
    setUploading(false);
    onFilesChanged();
  }

  function startRename() {
    if (!supervisionFile) return;
    const { base } = parseBaseName(supervisionFile.file_name);
    setRenaming(true);
    setRenameValue(base);
  }

  async function commitRename() {
    if (!supervisionFile || !user) { setRenaming(false); return; }
    const newBase = renameValue.trim();
    if (!newBase) { setRenaming(false); return; }
    const { ext } = parseBaseName(supervisionFile.file_name);
    const versionMatch = supervisionFile.file_name.match(/ (v\d+)\.[^.]+$/) || supervisionFile.file_name.match(/ (v\d+)$/);
    const versionSuffix = versionMatch ? ` ${versionMatch[1]}` : "";
    const newName = `${newBase}${versionSuffix}${ext}`;
    if (newName === supervisionFile.file_name) { setRenaming(false); return; }
    const oldName = supervisionFile.file_name;
    await supabase.from("cell_files").update({ file_name: newName }).eq("id", supervisionFile.id);
    await supabase.from("cell_history").insert({
      cell_id: cellId, user_id: user.id, action: "file_renamed",
      details: { old_name: oldName, new_name: newName },
    });
    setRenaming(false);
    onFilesChanged();
  }

  async function loadVersions() {
    if (!supervisionFile) return;
    const { data } = await supabase.from("cell_file_versions").select("*")
      .eq("file_id", supervisionFile.id).order("version_number", { ascending: false });
    if (data) setVersions(data);
    setShowVersions(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium" style={{ color: "var(--ds-text-muted)" }}>Согласование АН</h4>
        {(supervisionFile ? canUpdate : canAttach) && (
          <label className="ds-btn-secondary px-3 py-1.5 text-sm cursor-pointer">
            {supervisionFile ? "Обновить версию" : "+ Прикрепить"}
            <input type="file" onChange={handleFileSelect} className="hidden" />
          </label>
        )}
      </div>
      {pendingFile && (
        <div className="mb-3 p-3 border-2 border-dashed rounded-lg" style={{ borderColor: "var(--ds-accent)", background: "var(--ds-surface-sunken)" }}>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--ds-accent)" }}>Выбранный файл для загрузки:</p>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded mb-2" style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)" }}>
            <span className="inline-block px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-accent)" }}>{getExt(pendingFile.name)}</span>
            <span className="flex-1 text-sm truncate" style={{ color: "var(--ds-text-muted)" }}>{pendingFile.name}</span>
            <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatSize(pendingFile.size)}</span>
            <label className="ds-icon-btn cursor-pointer" title="Заменить файл">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <input type="file" onChange={handleReplacePending} className="hidden" />
            </label>
            <button onClick={() => setPendingFile(null)} className="ds-icon-btn" title="Убрать">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={uploadPendingFile} disabled={uploading} className="ds-btn px-3 py-1.5 text-sm">
              {uploading ? "Загрузка..." : "Загрузить"}
            </button>
            <button onClick={() => setPendingFile(null)} disabled={uploading} className="ds-btn-secondary px-3 py-1.5 text-sm">
              Отмена
            </button>
          </div>
        </div>
      )}
      {supervisionFile ? (
        <div className="rounded-lg p-3 space-y-2" style={{ background: "var(--ds-surface-sunken)", border: "1px solid var(--ds-border)" }}>
          <div className="flex items-center gap-2">
            <span className="inline-block px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "color-mix(in srgb, #22c55e 20%, var(--ds-surface))", color: "#22c55e" }}>{getExt(supervisionFile.file_name)}</span>
            {renaming ? (
              <form
                className="flex-1 flex items-center gap-1"
                onSubmit={(e) => { e.preventDefault(); commitRename(); }}
              >
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename()}
                  onKeyDown={(e) => { if (e.key === "Escape") setRenaming(false); }}
                  className="ds-input py-0.5 px-1.5 text-sm flex-1"
                />
                <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{parseBaseName(supervisionFile.file_name).ext}</span>
              </form>
            ) : (
              <button
                onClick={() => {
                  if (isPreviewable(supervisionFile.file_name)) {
                    setPreviewFileState({ fileName: supervisionFile.file_name, storagePath: supervisionFile.storage_path });
                  } else if (canDownload) {
                    downloadStorage(supervisionFile.storage_path, supervisionFile.file_name);
                  }
                }}
                className="flex-1 text-sm truncate text-left transition-colors"
                style={{ color: "var(--ds-text-muted)" }}
                title={isPreviewable(supervisionFile.file_name) ? "Просмотр" : canDownload ? "Скачать" : "Нет доступа к скачиванию"}
              >
                {supervisionFile.file_name}
              </button>
            )}
            <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatSize(supervisionFile.file_size)}</span>
            {!renaming && canUpdate && (
              <button onClick={startRename} className="ds-icon-btn" title="Переименовать">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
            )}
            <button onClick={loadVersions} className="ds-icon-btn" title="История версий">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            {canDownload && (
              <button onClick={() => downloadStorage(supervisionFile.storage_path, supervisionFile.file_name)} className="ds-icon-btn" title="Скачать">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: "color-mix(in srgb, #22c55e 15%, var(--ds-surface))", color: "#22c55e" }}>Согласовано</span>
            <span className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Авторский надзор</span>
          </div>
          {showVersions && (
            <div className="ml-4 mt-1 space-y-1">
              {versions.length === 0 ? (
                <p className="text-xs px-2 py-1" style={{ color: "var(--ds-text-faint)" }}>Нет предыдущих версий</p>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="flex items-center gap-2 px-2 py-1 rounded text-xs" style={{ background: "var(--ds-surface-sunken)" }}>
                    <span className="font-medium" style={{ color: "var(--ds-accent)" }}>v{v.version_number}</span>
                    <span className="truncate flex-1" style={{ color: "var(--ds-text-muted)" }}>{v.file_name}</span>
                    <span style={{ color: "var(--ds-text-faint)" }}>{formatSize(v.file_size)}</span>
                    {canDownload && <button onClick={() => downloadStorage(v.storage_path, v.file_name)} style={{ color: "var(--ds-accent)" }}>Скачать</button>}
                  </div>
                ))
              )}
              <button onClick={() => setShowVersions(false)} className="text-xs px-2" style={{ color: "var(--ds-text-faint)" }}>Скрыть</button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Файл согласования не прикреплён</p>
      )}
      {/* История взаимодействия с АН */}
      {history.length > 0 && (
        <div className="mt-3 space-y-2">
          <h5 className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--ds-text-muted)" }}>История АН</h5>
          {history.map((h) => (
            <div key={h.id} className="rounded-lg px-3 py-2 text-sm" style={{
              background: h.action === "correction_requested" || h.action === "correction_required"
                ? "color-mix(in srgb, #ef4444 8%, var(--ds-surface))"
                : h.action === "supervision_approved"
                ? "color-mix(in srgb, #22c55e 8%, var(--ds-surface))"
                : "var(--ds-surface-sunken)",
              border: `1px solid ${h.action === "correction_requested" || h.action === "correction_required" ? "color-mix(in srgb, #ef4444 20%, var(--ds-border))" : h.action === "supervision_approved" ? "color-mix(in srgb, #22c55e 20%, var(--ds-border))" : "var(--ds-border)"}`,
            }}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-medium text-xs" style={{ color: h.action.includes("correction") ? "#ef4444" : h.action === "supervision_approved" ? "#22c55e" : "var(--ds-text-muted)" }}>
                  {AN_ACTION_LABELS[h.action] || h.action}
                </span>
                <span className="text-[10px]" style={{ color: "var(--ds-text-faint)" }}>{new Date(h.created_at).toLocaleString("ru-RU")}</span>
              </div>
              <div className="text-xs" style={{ color: "var(--ds-text-muted)" }}>{shortName(h.profiles)}</div>
              {h.comment_text && (
                <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: "var(--ds-text)" }}>{h.comment_text}</p>
              )}
              {h.comment_files.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {h.comment_files.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        if (canPreview && isPreviewable(f.file_name)) {
                          setPreviewFileState({ fileName: f.file_name, storagePath: f.storage_path });
                        } else if (canDownload) {
                          downloadStorage(f.storage_path, f.file_name);
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: "var(--ds-accent)" }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {f.file_name} <span style={{ color: "var(--ds-text-faint)" }}>({formatSize(f.file_size)})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {previewFile && (
        <FilePreviewModal
          fileName={previewFile.fileName}
          storagePath={previewFile.storagePath}
          onClose={() => setPreviewFileState(null)}
        />
      )}
    </div>
  );
}
