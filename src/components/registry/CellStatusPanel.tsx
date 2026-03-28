import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { shortName } from "@/lib/utils";

interface ProfileShort {
  last_name: string;
  first_name: string;
  middle_name: string | null;
}

interface SignatureRow {
  id: string;
  user_id: string;
  status: string;
  comment: string | null;
  signed_at: string | null;
  profiles: ProfileShort | null;
}

interface CellInfo {
  status: string;
  assigned_to: string | null;
  assigned_by: string | null;
  assignee: ProfileShort | null;
  assigner: ProfileShort | null;
  creator: ProfileShort | null;
}

interface Props {
  cellId: string;
  cell: CellInfo;
  signatures: SignatureRow[];
  hasSupervisionApproval?: boolean;
}

export default function CellStatusPanel({ cellId, cell, signatures, hasSupervisionApproval }: Props) {
  const [ackHolders, setAckHolders] = useState<ProfileShort[]>([]);

  // Загрузить профили тех, у кого ячейка на ознакомлении (pending acknowledge shares)
  useEffect(() => {
    if (!cellId) return;
    (async () => {
      // Все acknowledge shares для этой ячейки
      const { data: shares } = await supabase
        .from("cell_shares")
        .select("to_user_id")
        .eq("cell_id", cellId)
        .eq("share_type", "acknowledge");
      if (!shares || shares.length === 0) { setAckHolders([]); return; }

      // Кто уже ознакомился
      const { data: acked } = await supabase
        .from("cell_signatures")
        .select("user_id")
        .eq("cell_id", cellId)
        .eq("status", "Ознакомлен");
      const ackedSet = new Set((acked || []).map((a: { user_id: string }) => a.user_id));

      // Pending = отправлено, но ещё не ознакомился
      const pendingUserIds = [...new Set(shares.map((s: { to_user_id: string }) => s.to_user_id))]
        .filter((id) => !ackedSet.has(id));

      if (pendingUserIds.length === 0) { setAckHolders([]); return; }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("last_name, first_name, middle_name")
        .in("id", pendingUserIds);
      setAckHolders((profiles || []) as ProfileShort[]);
    })();
  }, [cellId]);

  // Последняя подпись каждого пользователя
  const byUser = new Map<string, SignatureRow>();
  for (const s of signatures) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, s);
  }
  const grouped = Array.from(byUser.values());

  // Список людей, у кого ячейка «в работе»
  const holders: ProfileShort[] = [];
  if (cell.assigned_to && cell.assignee) holders.push(cell.assignee);
  for (const p of ackHolders) {
    // Не дублировать assigned_to
    if (!holders.some((h) => h.last_name === p.last_name && h.first_name === p.first_name)) {
      holders.push(p);
    }
  }

  const isFinal = cell.status === "Окончательно утверждён";

  return (
    <div className="space-y-4">
      {/* В архиве */}
      {isFinal && (
        <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "color-mix(in srgb, #6b7280 10%, var(--ds-surface))", border: "1px solid color-mix(in srgb, #6b7280 25%, var(--ds-border))" }}>
          <svg className="w-4 h-4 shrink-0" style={{ color: "#6b7280" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
          </svg>
          <span className="text-sm font-medium" style={{ color: "#6b7280" }}>Находится в архиве</span>
        </div>
      )}

      {/* В работе у */}
      {holders.length > 0 && !isFinal && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-semibold" style={{ color: "var(--ds-text)" }}>В работе у:</h4>
          <div className="space-y-1">
            {holders.map((p, i) => (
              <div key={i} className="rounded-lg px-3 py-2" style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderLeft: "4px solid #3b82f6" }}>
                <div className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>{shortName(p)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Подписи */}
      {grouped.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--ds-text-muted)" }}>Подписи</div>
          {grouped.map((s) => (
            <div key={s.id} className="rounded-lg px-3 py-2" style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)" }}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={STATUS_STYLE[s.status] || { background: "var(--ds-surface-sunken)", color: "var(--ds-text-muted)" }}>
                  {s.status}
                </span>
              </div>
              <div className="text-sm font-medium mt-1" style={{ color: "var(--ds-text)" }}>{shortName(s.profiles)}</div>
              {s.comment && (
                <div className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--ds-text-muted)" }} title={s.comment}>{s.comment}</div>
              )}
              {s.signed_at && (
                <div className="text-[10px] mt-0.5" style={{ color: "var(--ds-text-faint)" }}>
                  {new Date(s.signed_at).toLocaleString("ru-RU")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Согласование АН (файл) */}
      {hasSupervisionApproval && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--ds-text-muted)" }}>Согласование АН</div>
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)" }}>
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: "color-mix(in srgb, #22c55e 15%, var(--ds-surface))", color: "#22c55e" }}>Согласовано</span>
            </div>
            <div className="text-sm font-medium mt-1" style={{ color: "var(--ds-text)" }}>Авторский надзор</div>
          </div>
        </div>
      )}

      {holders.length === 0 && grouped.length === 0 && !hasSupervisionApproval && (
        <div className="text-xs text-center py-4" style={{ color: "var(--ds-text-faint)" }}>Нет данных о согласовании</div>
      )}

    </div>
  );
}

const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  "Подписано": { background: "color-mix(in srgb, #14b8a6 15%, var(--ds-surface))", color: "#0d9488" },
  "Согласовано": { background: "color-mix(in srgb, #22c55e 15%, var(--ds-surface))", color: "#22c55e" },
  "Ознакомлен": { background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" },
  "Подписано с замечанием": { background: "color-mix(in srgb, #f59e0b 15%, var(--ds-surface))", color: "#f59e0b" },
  "Замечания": { background: "color-mix(in srgb, #ef4444 15%, var(--ds-surface))", color: "#ef4444" },
  "Отклонено": { background: "color-mix(in srgb, #ef4444 15%, var(--ds-surface))", color: "#ef4444" },
};
