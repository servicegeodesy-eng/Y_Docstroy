import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { shortName } from "@/lib/utils";

interface ProfileShort {
  last_name: string;
  first_name: string;
  middle_name: string | null;
}

interface HistoryRow {
  id: string;
  created_at: string;
  action: string;
  details: Record<string, any> | null;
  user_id: string;
  profiles: ProfileShort | null;
}

const ACTION_LABELS: Record<string, string> = {
  created: "Создание",
  edited: "Редактирование",
  status_changed: "Смена статуса",
  signed: "Подписание",
  signed_with_remark: "Подписание с замечанием",
  signed_with_remarks: "Подписание с замечаниями",
  signed_and_forwarded: "Подписание и пересылка",
  delegated: "Делегирование",
  rejected: "Возврат",
  remarks: "Замечания",
  sent: "Отправка на проверку",
  sent_to_supervision: "Отправка на АН",
  sent_to_acknowledge: "Отправка на ознакомление",
  acknowledged: "Ознакомление",
  approved_supervision: "Согласование АН",
  supervision_approved: "Согласование АН",
  correction_required: "На исправление (АН)",
  correction_requested: "На исправление",
  file_uploaded: "Загрузка файла",
  file_version_added: "Новая версия файла",
  final_signed: "Окончательное подписание",
  archived: "Архивация",
  scan_attached: "Прикрепление скана",
  mask_created: "Создание наложения",
  mask_edited: "Редактирование наложения",
  request_created: "Создание заявки",
  request_sent: "Отправка заявки",
  request_executed: "Выполнение заявки",
  request_remarks: "Замечание по заявке",
  request_forwarded: "Пересылка заявки",
  request_rejected: "Отклонение заявки",
  request_acknowledged: "Ознакомление с заявкой",
};

const ACTION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  created:              { bg: "#EFF6FF", border: "#93C5FD", text: "#1D4ED8" },
  sent:                 { bg: "#F0F9FF", border: "#7DD3FC", text: "#0369A1" },
  sent_to_supervision:  { bg: "#FFF7ED", border: "#FDBA74", text: "#C2410C" },
  sent_to_acknowledge:  { bg: "#F5F3FF", border: "#C4B5FD", text: "#6D28D9" },
  signed:               { bg: "#ECFDF5", border: "#6EE7B7", text: "#047857" },
  signed_with_remark:   { bg: "#FFFBEB", border: "#FCD34D", text: "#B45309" },
  signed_with_remarks:  { bg: "#FFFBEB", border: "#FCD34D", text: "#B45309" },
  signed_and_forwarded: { bg: "#ECFDF5", border: "#6EE7B7", text: "#047857" },
  delegated:            { bg: "#F5F3FF", border: "#C4B5FD", text: "#6D28D9" },
  approved_supervision: { bg: "#ECFDF5", border: "#6EE7B7", text: "#047857" },
  supervision_approved: { bg: "#ECFDF5", border: "#6EE7B7", text: "#047857" },
  rejected:             { bg: "#FEF2F2", border: "#FCA5A5", text: "#B91C1C" },
  remarks:              { bg: "#FEF2F2", border: "#FCA5A5", text: "#B91C1C" },
  correction_required:  { bg: "#FEF2F2", border: "#FCA5A5", text: "#B91C1C" },
  correction_requested: { bg: "#FEF2F2", border: "#FCA5A5", text: "#B91C1C" },
  status_changed:       { bg: "#F9FAFB", border: "#D1D5DB", text: "#374151" },
  acknowledged:         { bg: "#EFF6FF", border: "#93C5FD", text: "#1D4ED8" },
  final_signed:         { bg: "#D1FAE5", border: "#34D399", text: "#065F46" },
  archived:             { bg: "#F3F4F6", border: "#9CA3AF", text: "#4B5563" },
  scan_attached:        { bg: "#ECFDF5", border: "#6EE7B7", text: "#047857" },
  mask_created:         { bg: "#F5F3FF", border: "#C4B5FD", text: "#6D28D9" },
  mask_edited:          { bg: "#F5F3FF", border: "#C4B5FD", text: "#6D28D9" },
  file_uploaded:        { bg: "#F9FAFB", border: "#D1D5DB", text: "#374151" },
  file_version_added:   { bg: "#F9FAFB", border: "#D1D5DB", text: "#374151" },
  request_created:      { bg: "#EFF6FF", border: "#93C5FD", text: "#1D4ED8" },
  request_sent:         { bg: "#F0F9FF", border: "#7DD3FC", text: "#0369A1" },
  request_executed:     { bg: "#ECFDF5", border: "#6EE7B7", text: "#047857" },
  request_remarks:      { bg: "#FFFBEB", border: "#FCD34D", text: "#B45309" },
  request_forwarded:    { bg: "#F5F3FF", border: "#C4B5FD", text: "#6D28D9" },
  request_rejected:     { bg: "#FEF2F2", border: "#FCA5A5", text: "#B91C1C" },
  request_acknowledged: { bg: "#EFF6FF", border: "#93C5FD", text: "#1D4ED8" },
};

const DEFAULT_COLOR = { bg: "#F9FAFB", border: "#D1D5DB", text: "#374151" };

// Ширина/высота узлов
const NODE_W = 280;
const NODE_H = 68;
const GAP_Y = 24;
const ARROW_SIZE = 6;
const PAD_X = 32;
const PAD_TOP = 24;
const PAD_BOTTOM = 24;

interface Props {
  cellId: string;
  onClose: () => void;
}

export default function ProcessFlowModal({ cellId, onClose }: Props) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [recipientProfiles, setRecipientProfiles] = useState<Map<string, ProfileShort>>(new Map());
  const [loading, setLoading] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    loadHistory();
  }, [cellId]);

  async function loadHistory() {
    const { data } = await supabase
      .from("cell_history")
      .select(`id, created_at, action, details, user_id, profiles:user_id(last_name, first_name, middle_name)`)
      .eq("cell_id", cellId)
      .order("created_at", { ascending: true });
    if (data) {
      let historyRows = data as unknown as HistoryRow[];

      // Если нет записи "created" — создать синтетическую из данных ячейки
      if (!historyRows.some((r) => r.action === "created")) {
        const { data: cellData } = await supabase
          .from("cells")
          .select("created_at, created_by, name, profiles:created_by(last_name, first_name, middle_name)")
          .eq("id", cellId)
          .single();
        if (cellData) {
          const synthetic: HistoryRow = {
            id: "synthetic-created",
            created_at: cellData.created_at,
            action: "created",
            details: { name: cellData.name },
            user_id: cellData.created_by || "",
            profiles: (cellData as any).profiles || null,
          };
          historyRows = [synthetic, ...historyRows];
        }
      }

      setRows(historyRows);

      // Собираем уникальные to_user_id для загрузки профилей получателей
      const toUserIds = new Set<string>();
      for (const r of historyRows) {
        if (r.details?.to_user_id) toUserIds.add(r.details.to_user_id);
      }
      if (toUserIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, last_name, first_name, middle_name")
          .in("id", Array.from(toUserIds));
        if (profiles) {
          const map = new Map<string, ProfileShort>();
          for (const p of profiles as any[]) {
            map.set(p.id, { last_name: p.last_name, first_name: p.first_name, middle_name: p.middle_name });
          }
          setRecipientProfiles(map);
        }
      }
    }
    setLoading(false);
  }

  // Фильтруем «edited» и «file_uploaded» для чистоты схемы
  const significant = rows.filter(
    (r) => !["edited", "file_uploaded", "file_version_added"].includes(r.action),
  );

  const svgW = NODE_W + PAD_X * 2;
  const svgH = significant.length > 0
    ? PAD_TOP + significant.length * (NODE_H + GAP_Y) - GAP_Y + PAD_BOTTOM
    : 200;

  function nodeY(idx: number) {
    return PAD_TOP + idx * (NODE_H + GAP_Y);
  }
  const nodeX = PAD_X;

  // Действия, связанные с отправкой кому-то
  const SEND_ACTIONS = new Set(["sent", "sent_to_supervision", "sent_to_acknowledge", "signed_and_forwarded"]);
  // Действия подписания (возврат отправителю)
  const SIGN_ACTIONS = new Set(["signed", "signed_with_remark", "signed_with_remarks", "approved_supervision", "supervision_approved", "acknowledged", "final_signed"]);
  // Действия возврата
  const RETURN_ACTIONS = new Set(["rejected", "correction_required", "correction_requested", "remarks"]);

  function personLine(r: HistoryRow): string {
    const toUserId = r.details?.to_user_id;
    const recipientProfile = toUserId ? recipientProfiles.get(toUserId) : null;
    const senderName = shortName(r.profiles);

    if (SEND_ACTIONS.has(r.action)) {
      return recipientProfile ? `→ ${shortName(recipientProfile)}` : senderName;
    }
    if (SIGN_ACTIONS.has(r.action)) {
      if (recipientProfile) {
        return `${senderName} → ${shortName(recipientProfile)}`;
      }
      return `${senderName} — возвращено отправителю`;
    }
    if (RETURN_ACTIONS.has(r.action)) {
      return recipientProfile ? `→ ${shortName(recipientProfile)}` : senderName;
    }
    return senderName;
  }

  function detailLine(r: HistoryRow): string {
    const d = r.details;
    if (!d) return "";
    if (d.from && d.to) return `${d.from} \u2192 ${d.to}`;
    if (d.status) return d.status;
    if (d.comment) return d.comment.slice(0, 40);
    return "";
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="ds-overlay p-4" style={{ zIndex: 60 }} onClick={onClose}>
      <div className="ds-overlay-bg" />
      <div
        className="ds-modal w-full max-w-lg max-h-[90vh] sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ds-modal-header px-5 py-3">
          <h3 className="text-base font-semibold" style={{ color: "var(--ds-text)" }}>Процесс ячейки</h3>
          <button onClick={onClose} className="ds-icon-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-center py-8" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
          ) : significant.length === 0 ? (
            <div className="text-center py-8" style={{ color: "var(--ds-text-faint)" }}>Нет данных о процессе</div>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="mx-auto w-full"
              style={{ maxWidth: svgW, height: "auto" }}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth={ARROW_SIZE}
                  markerHeight={ARROW_SIZE}
                  refX={ARROW_SIZE}
                  refY={ARROW_SIZE / 2}
                  orient="auto"
                >
                  <polygon
                    points={`0 0, ${ARROW_SIZE} ${ARROW_SIZE / 2}, 0 ${ARROW_SIZE}`}
                    fill="#9CA3AF"
                  />
                </marker>
                <filter id="shadow" x="-4%" y="-4%" width="108%" height="112%">
                  <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
                </filter>
              </defs>

              {/* Arrows */}
              {significant.map((_, i) => {
                if (i === 0) return null;
                const y1 = nodeY(i - 1) + NODE_H;
                const y2 = nodeY(i);
                const cx = nodeX + NODE_W / 2;
                return (
                  <line
                    key={`arrow-${i}`}
                    x1={cx}
                    y1={y1}
                    x2={cx}
                    y2={y2}
                    stroke="#D1D5DB"
                    strokeWidth={2}
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}

              {/* Nodes */}
              {significant.map((r, i) => {
                const y = nodeY(i);
                const colors = ACTION_COLORS[r.action] || DEFAULT_COLOR;
                const label = ACTION_LABELS[r.action] || r.action;
                const person = personLine(r);
                const detail = detailLine(r);
                const time = formatTime(r.created_at);

                return (
                  <g key={r.id}>
                    <rect
                      x={nodeX}
                      y={y}
                      width={NODE_W}
                      height={NODE_H}
                      rx={10}
                      ry={10}
                      fill={colors.bg}
                      stroke={colors.border}
                      strokeWidth={1.5}
                      filter="url(#shadow)"
                    />
                    {/* Action label */}
                    <text
                      x={nodeX + 12}
                      y={y + 18}
                      fontSize={12}
                      fontWeight={600}
                      fill={colors.text}
                    >
                      {label}
                    </text>
                    {/* Time */}
                    <text
                      x={nodeX + NODE_W - 12}
                      y={y + 18}
                      fontSize={10}
                      fill="#9CA3AF"
                      textAnchor="end"
                    >
                      {time}
                    </text>
                    {/* Person */}
                    <text
                      x={nodeX + 12}
                      y={y + 36}
                      fontSize={11}
                      fill="#374151"
                    >
                      {person.length > 38 ? person.slice(0, 38) + "..." : person}
                    </text>
                    {/* Detail */}
                    {detail && (
                      <text
                        x={nodeX + 12}
                        y={y + 54}
                        fontSize={10}
                        fill="#6B7280"
                      >
                        {detail.length > 32 ? detail.slice(0, 32) + "..." : detail}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Footer: legend */}
        <div className="px-5 py-3 flex flex-wrap gap-2" style={{ borderTop: "1px solid var(--ds-border)" }}>
          <span className="text-[10px]" style={{ color: "var(--ds-text-faint)" }}>Всего шагов: {significant.length}</span>
          <span className="text-[10px] ml-auto" style={{ color: "var(--ds-text-faint)" }}>
            (скрыты: редактирование, загрузка файлов)
          </span>
        </div>
      </div>
    </div>
  );
}
