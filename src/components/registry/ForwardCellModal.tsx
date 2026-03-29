import { memo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { shortName } from "@/lib/utils";
import { useEligibleMembers } from "@/hooks/useEligibleMembers";
import { markCellNotificationsRead } from "@/lib/notificationUtils";
import type { Profile } from "@/types";

interface Props {
  cellId: string;
  cellName: string;
  originalSenderId: string;
  onClose: () => void;
  onForwarded: () => void;
}

function ForwardCellModal({ cellId, cellName, originalSenderId, onClose, onForwarded }: Props) {
  const { user } = useAuth();
  const { members, loading: loadingMembers } = useEligibleMembers("can_sign");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleForward() {
    if (!user || !selectedUserId) return;
    setLoading(true);

    // 1. Подписать ячейку (запись подписи текущего проверяющего)
    await supabase.from("cell_signatures").insert({
      cell_id: cellId,
      user_id: user.id,
      status: "Подписано",
      signed_at: new Date().toISOString(),
    });

    // 2. Переслать другому проверяющему, сохраняя original_sender_id и send_type
    await supabase.from("cells").update({
      status: "На проверке",
      assigned_to: selectedUserId,
      assigned_by: user.id,
      original_sender_id: originalSenderId,
      send_type: "review",
    }).eq("id", cellId);

    // 3. Запись в cell_shares
    await supabase.from("cell_shares").insert({
      cell_id: cellId,
      from_user_id: user.id,
      to_user_id: selectedUserId,
      message: message || "Подписано и переслано на проверку",
    });

    // 4. Запись в историю
    await supabase.from("cell_history").insert({
      cell_id: cellId,
      user_id: user.id,
      action: "signed_and_forwarded",
      details: {
        to_user_id: selectedUserId,
        original_sender_id: originalSenderId,
        status: "Подписано",
      },
    });

    setLoading(false);
    markCellNotificationsRead(cellId);
    onForwarded();
  }

  function fullName(p: Profile) {
    return shortName(p);
  }

  return (
    <div className="ds-overlay p-4" onClick={onClose}>
      <div className="ds-overlay-bg" />
      <div className="ds-modal w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="ds-modal-header">
          <h2 className="ds-modal-title">Подписать и переслать</h2>
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
            Ячейка будет подписана от вашего имени и переслана выбранному проверяющему. При его действии ячейка вернётся исходному отправителю.
          </div>

          <div>
            <label className="ds-label">
              Следующий проверяющий <span style={{ color: "#ef4444" }}>*</span>
            </label>
            {loadingMembers ? (
              <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</p>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="ds-input"
              >
                <option value="">Выберите проверяющего</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {fullName(m.profiles)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="ds-label">Сообщение</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="ds-input resize-none"
              placeholder="Комментарий к пересылке (необязательно)"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="ds-btn-secondary"
            >
              Отмена
            </button>
            <button
              onClick={handleForward}
              disabled={loading || !selectedUserId}
              className="ds-btn"
            >
              {loading ? "Отправка..." : "Подписать и переслать"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default memo(ForwardCellModal);
