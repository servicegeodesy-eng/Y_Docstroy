import { memo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

interface Props {
  cellId: string;
  cellName: string;
  onClose: () => void;
  onAcknowledged: () => void;
}

function AcknowledgeModal({ cellId, cellName, onClose, onAcknowledged }: Props) {
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAcknowledge() {
    if (!user) return;
    setLoading(true);
    setError(null);

    // Записываем подпись «Ознакомлен»
    const { error: sigError } = await supabase.from("cell_signatures").insert({
      cell_id: cellId,
      user_id: user.id,
      status: "Ознакомлен",
      comment: comment.trim() || null,
      signed_at: new Date().toISOString(),
    });

    if (sigError) {
      setError(sigError.message);
      setLoading(false);
      return;
    }

    // НЕ меняем assigned_to/send_type — ячейка остаётся у кого была

    // Записываем в историю
    await supabase.from("cell_history").insert({
      cell_id: cellId,
      user_id: user.id,
      action: "acknowledged",
      details: { comment: comment.trim() || null },
    });

    setLoading(false);
    onAcknowledged();
  }

  return (
    <div className="ds-overlay p-4" onClick={onClose}>
      <div className="ds-overlay-bg" />
      <div className="ds-modal w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="ds-modal-header">
          <h2 className="ds-modal-title">Ознакомлен</h2>
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
          <div className="ds-alert-info">
            Ваше ФИО будет отображаться в маршруте согласования.
          </div>

          {error && <div className="ds-alert-error">{error}</div>}

          <div>
            <label className="ds-label">
              Комментарий <span className="text-xs font-normal" style={{ color: "var(--ds-text-faint)" }}>(необязательно)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="ds-input resize-none"
              placeholder="Комментарий к ознакомлению..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="ds-btn-secondary"
            >
              Отмена
            </button>
            <button
              onClick={handleAcknowledge}
              disabled={loading}
              className="ds-btn"
            >
              {loading ? "Сохранение..." : "Ознакомлен"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default memo(AcknowledgeModal);
