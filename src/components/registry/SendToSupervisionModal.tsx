import { memo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { fullName } from "@/lib/utils";
import { useEligibleMembers } from "@/hooks/useEligibleMembers";

interface Props {
  cellId: string;
  cellName: string;
  returnToUserId?: string;
  onClose: () => void;
  onSent: () => void;
}

function SendToSupervisionModal({ cellId, cellName, returnToUserId, onClose, onSent }: Props) {
  const { user } = useAuth();
  const { members, loading: loadingMembers } = useEligibleMembers("can_supervise");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!user || !selectedUserId) return;
    setLoading(true);

    const senderId = returnToUserId || user.id;
    await supabase.from("cells").update({
      status: "У авторского надзора",
      assigned_to: selectedUserId,
      assigned_by: user.id,
      original_sender_id: senderId,
      send_type: "supervision",
    }).eq("id", cellId);

    await supabase.from("cell_shares").insert({
      cell_id: cellId,
      from_user_id: user.id,
      to_user_id: selectedUserId,
      message: message || null,
    });

    await supabase.from("cell_history").insert({
      cell_id: cellId,
      user_id: user.id,
      action: "sent_to_supervision",
      details: { to_user_id: selectedUserId, status: "У авторского надзора" },
    });

    setLoading(false);
    onSent();
  }

  return (
    <div className="ds-overlay p-4" onClick={onClose}>
      <div className="ds-overlay-bg" />
      <div
        className="ds-modal w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ds-modal-header">
          <h2 className="ds-modal-title">Отправить на авторский надзор</h2>
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

          <div>
            <label className="ds-label">
              Получатель (Авт. надзор) <span style={{ color: "#ef4444" }}>*</span>
            </label>
            {loadingMembers ? (
              <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</p>
            ) : members.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Нет участников с ролью «Авторский надзор»</p>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="ds-input"
              >
                <option value="">Выберите участника</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {fullName(m.profiles)} ({m.profiles.organization})
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
              placeholder="Комментарий к отправке (необязательно)"
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
              onClick={handleSend}
              disabled={loading || !selectedUserId}
              className="ds-btn"
            >
              {loading ? "Отправка..." : "Отправить на АН"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default memo(SendToSupervisionModal);
