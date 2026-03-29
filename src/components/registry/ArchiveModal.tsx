import { memo, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadRawFile } from "@/lib/fileStorage";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { formatSize, getExt } from "@/lib/utils";
import { markCellNotificationsRead } from "@/lib/notificationUtils";

interface Props {
  cellId: string;
  cellName: string;
  onClose: () => void;
  onArchived: () => void;
}

function ArchiveModal({ cellId, cellName, onClose, onArchived }: Props) {
  const { project } = useProject();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingScanCount, setExistingScanCount] = useState(0);
  const [useExisting, setUseExisting] = useState(false);

  useEffect(() => {
    supabase
      .from("cell_files")
      .select("id", { count: "exact", head: true })
      .eq("cell_id", cellId)
      .eq("category", "archive_scan")
      .then(({ count }) => {
        const c = count || 0;
        setExistingScanCount(c);
        if (c > 0) setUseExisting(true);
      });
  }, [cellId]);

  async function doArchive() {
    if (!user || !project || (!file && !useExisting)) return;
    setLoading(true);
    setError(null);

    if (file) {
      let storagePath: string;
      try {
        storagePath = await uploadRawFile(`${project.id}/${cellId}`, file);
      } catch (uploadError) {
        setError("Ошибка загрузки файла: " + (uploadError instanceof Error ? uploadError.message : String(uploadError)));
        setLoading(false);
        return;
      }
      await supabase.from("cell_files").insert({
        cell_id: cellId, file_name: file.name, file_size: file.size,
        mime_type: file.type || "application/octet-stream", storage_path: storagePath,
        uploaded_by: user.id, category: "archive_scan",
      });
    }

    await supabase.from("cell_archives").insert({ cell_id: cellId, user_id: user.id });
    await supabase.from("cells").update({ status: "Окончательно утверждён", send_type: null }).eq("id", cellId);
    await supabase.from("cell_history").insert({
      cell_id: cellId, user_id: user.id, action: "archived",
      details: { scan_attached: !!file, existing_scan: useExisting && !file },
    });

    setLoading(false);
    markCellNotificationsRead(cellId);
    onArchived();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
    e.target.value = "";
  }

  return (
    <div className="ds-overlay p-4" onClick={onClose}>
      <div className="ds-overlay-bg" />
      <div className="ds-modal w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="ds-modal-header">
          <h2 className="ds-modal-title">Архивация</h2>
          <button onClick={onClose} className="ds-icon-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-sm" style={{ color: "var(--ds-text-muted)" }}>
            Ячейка: <span className="font-medium" style={{ color: "var(--ds-text)" }}>{cellName}</span>
          </div>

          {error && (
            <div className="ds-alert-error">{error}</div>
          )}

          {existingScanCount > 0 ? (
            <button
              onClick={doArchive}
              disabled={loading}
              className="ds-btn w-full flex items-center justify-center gap-2"
              style={{ background: "#22c55e", borderColor: "#22c55e" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {loading ? "Архивация..." : `Скан уже прикреплён (${existingScanCount}) — Архивировать`}
            </button>
          ) : (
            <div className="ds-alert-warning">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm font-medium">Прикрепите скан утвержденного документа</p>
                  <p className="text-xs mt-1 opacity-75">Без прикрепления скана отправить в архив невозможно. После архивации ячейка будет окончательно заблокирована.</p>
                </div>
              </div>
            </div>
          )}

          {file ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--ds-surface-sunken)", border: "1px solid var(--ds-border)" }}>
              <span className="inline-block px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }}>
                {getExt(file.name)}
              </span>
              <span className="flex-1 text-sm truncate" style={{ color: "var(--ds-text)" }}>{file.name}</span>
              <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatSize(file.size)}</span>
              <label className="ds-icon-btn cursor-pointer" title="Заменить файл">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                <input type="file" accept="image/*,.pdf" onChange={handleFileSelect} className="hidden" />
              </label>
              <button onClick={() => setFile(null)} className="ds-icon-btn" title="Убрать">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors" style={{ borderColor: "var(--ds-border)", color: "var(--ds-text-muted)" }}>
              <svg className="w-5 h-5" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm">Выбрать файл скана</span>
              <input type="file" accept="image/*,.pdf" onChange={handleFileSelect} className="hidden" />
            </label>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={doArchive}
              disabled={loading || (!file && !useExisting)}
              className={`ds-btn w-full ${!file && !useExisting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {loading ? "Архивация..." : file ? "Прикрепить и архивировать" : useExisting ? "Архивировать" : "Прикрепить и архивировать"}
            </button>
            <button onClick={onClose} className="w-full px-4 py-2 text-sm transition-colors" style={{ color: "var(--ds-text-muted)" }}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default memo(ArchiveModal);
