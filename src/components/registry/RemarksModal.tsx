import { memo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import { useAuth } from "@/lib/AuthContext";
import { formatSize } from "@/lib/utils";

interface Props {
  cellId: string;
  cellName: string;
  sendBackToUserId: string;
  onClose: () => void;
  onSent: () => void;
}

function RemarksModal({ cellId, cellName, sendBackToUserId, onClose, onSent }: Props) {
  const { project } = useProject();
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!user || !project) return;
    if (!comment.trim() && files.length === 0) {
      setError("Введите замечание или прикрепите файлы");
      return;
    }
    setLoading(true);
    setError(null);

    // Создать запись замечания
    const { data: commentData, error: commentError } = await supabase
      .from("cell_comments")
      .insert({
        cell_id: cellId,
        user_id: user.id,
        text: comment.trim() || null,
      })
      .select("id")
      .single();

    if (commentError || !commentData) {
      setError(commentError?.message || "Ошибка создания замечания");
      setLoading(false);
      return;
    }

    // Загрузить файлы замечания
    for (const file of files) {
      const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
      const safeFileName = crypto.randomUUID() + ext;
      const storagePath = `${project.id}/remarks/${commentData.id}/${safeFileName}`;
      const { error: uploadError } = await supabase.storage
        .from("cell-files")
        .upload(storagePath, file);
      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }
      await supabase.from("cell_comment_files").insert({
        comment_id: commentData.id,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
        storage_path: storagePath,
        uploaded_by: user.id,
      });
    }

    // Обновить статус ячейки на "Замечания" и вернуть отправителю
    await supabase.from("cells").update({
      status: "Замечания",
      assigned_to: sendBackToUserId,
      assigned_by: user.id,
      send_type: null,
    }).eq("id", cellId);

    // Уведомить отправителя через cell_shares
    await supabase.from("cell_shares").insert({
      cell_id: cellId, from_user_id: user.id, to_user_id: sendBackToUserId,
      message: "Замечания",
    });

    // Записать в историю
    await supabase.from("cell_history").insert({
      cell_id: cellId,
      user_id: user.id,
      action: "remarks",
      details: { to_user_id: sendBackToUserId, comment: comment.trim() || null },
    });

    setLoading(false);
    onSent();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }


  return (
    <div className="ds-overlay p-4" onClick={onClose}>
      <div className="ds-overlay-bg" />
      <div className="ds-modal w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="ds-modal-header">
          <h2 className="ds-modal-title">Замечания</h2>
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

          <div>
            <label className="ds-label">Замечание</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="ds-input resize-none"
              placeholder="Опишите замечания..."
            />
          </div>

          <div>
            <label className="ds-label">Файлы</label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors" style={{ borderColor: "var(--ds-border)", color: "var(--ds-text-muted)" }}>
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
                    <span className="flex-1 truncate" style={{ color: "var(--ds-text-muted)" }}>{file.name}</span>
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

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="ds-btn-secondary"
            >
              Отмена
            </button>
            <button
              onClick={handleSend}
              disabled={loading}
              className="ds-btn-danger"
            >
              {loading ? "Отправка..." : "Отправить замечания"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default memo(RemarksModal);
