import { memo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { formatSize } from "@/lib/utils";

interface Props {
  cellId: string;
  cellName: string;
  onClose: () => void;
  onSent: () => void;
}

function RequestRemarksModal({ cellId, cellName, onClose, onSent }: Props) {
  const { project } = useProject();
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleReject() {
    if (!project || !user) return;
    setLoading(true);

    // Загрузить файлы
    for (const file of files) {
      const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
      const safeFileName = crypto.randomUUID() + ext;
      const storagePath = `${project.id}/${cellId}/${safeFileName}`;
      const { error: uploadError } = await supabase.storage
        .from("cell-files")
        .upload(storagePath, file);
      if (uploadError) { console.error("Upload error:", uploadError); continue; }
      await supabase.from("cell_files").insert({
        cell_id: cellId,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
        storage_path: storagePath,
        uploaded_by: user.id,
      });
    }

    // Добавить комментарий
    if (comment.trim()) {
      await supabase.from("cell_public_comments").insert({
        cell_id: cellId,
        user_id: user.id,
        text: comment.trim(),
      });
    }

    // Обновить статус на «Отклонено»
    await supabase.from("cells").update({
      status: "Отклонено",
    }).eq("id", cellId);

    // История
    await supabase.from("cell_history").insert({
      cell_id: cellId,
      user_id: user.id,
      action: "request_rejected",
      details: { status: "Отклонено", comment: comment.trim() || null, files_count: files.length },
    });

    setLoading(false);
    onSent();
  }

  return (
    <div className="ds-overlay" onClick={onClose}>
      <div className="ds-modal w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="ds-modal-header">
          <h2 className="ds-modal-title">Отклонить заявку</h2>
          <button onClick={onClose} className="ds-icon-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-sm" style={{ color: "var(--ds-text-muted)" }}>
            Заявка: <span className="font-medium" style={{ color: "var(--ds-text)" }}>{cellName}</span>
          </div>

          <div>
            <label className="ds-label">Файлы</label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors" style={{ borderColor: "var(--ds-border)" }}>
              <svg className="w-5 h-5" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Прикрепить файлы</span>
              <input type="file" multiple onChange={handleFileSelect} className="hidden" />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((file, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm" style={{ background: "var(--ds-surface-sunken)" }}>
                    <span className="flex-1 truncate" style={{ color: "var(--ds-text)" }}>{file.name}</span>
                    <span className="text-xs whitespace-nowrap" style={{ color: "var(--ds-text-faint)" }}>{formatSize(file.size)}</span>
                    <button type="button" onClick={() => removeFile(i)} className="ds-icon-btn p-0.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="ds-label">Комментарий</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="ds-input w-full resize-none"
              placeholder="Причина отклонения (необязательно)"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="ds-btn-secondary">Отмена</button>
            <button
              onClick={handleReject}
              disabled={loading}
              className="ds-btn-danger"
            >
              {loading ? "Отклонение..." : "Отклонить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default memo(RequestRemarksModal);
