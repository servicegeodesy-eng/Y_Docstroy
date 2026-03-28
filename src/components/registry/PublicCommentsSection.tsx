import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useProject } from "@/lib/ProjectContext";
import { shortName } from "@/lib/utils";

interface CommentRow {
  id: string;
  text: string;
  created_at: string;
  profiles: {
    last_name: string;
    first_name: string;
    middle_name: string | null;
  } | null;
}

interface Props {
  cellId: string;
  canAddComments?: boolean;
}

export default function PublicCommentsSection({ cellId, canAddComments }: Props) {
  const { user } = useAuth();
  const { hasPermission } = useProject();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const canComment = canAddComments !== undefined ? canAddComments : hasPermission("can_add_comments");

  useEffect(() => {
    loadComments();
  }, [cellId]);

  async function loadComments() {
    const { data } = await supabase
      .from("cell_public_comments")
      .select(
        "id, text, created_at, profiles:user_id(last_name, first_name, middle_name)"
      )
      .eq("cell_id", cellId)
      .order("created_at", { ascending: false });
    if (data) setComments(data as unknown as CommentRow[]);
    setLoading(false);
  }

  async function handleSend() {
    if (!user || !text.trim()) return;
    setSending(true);
    const { error } = await supabase.from("cell_public_comments").insert({
      cell_id: cellId,
      user_id: user.id,
      text: text.trim(),
    });
    if (error) {
      alert(error.message);
      setSending(false);
      return;
    }
    setText("");
    setSending(false);
    loadComments();
  }

  if (loading) return null;

  return (
    <div className="space-y-3">
      {/* Форма добавления */}
      {canComment && (
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) handleSend();
            }}
            placeholder="Написать комментарий..."
            rows={2}
            className="ds-input flex-1 resize-none"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="ds-btn self-end"
          >
            {sending ? "..." : "Отправить"}
          </button>
        </div>
      )}

      {/* Список комментариев */}
      {comments.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Нет комментариев</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="ds-alert-info">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{shortName(c.profiles)}</span>
              <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{new Date(c.created_at).toLocaleString("ru-RU")}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--ds-text-muted)" }}>{c.text}</p>
          </div>
        ))
      )}
    </div>
  );
}
