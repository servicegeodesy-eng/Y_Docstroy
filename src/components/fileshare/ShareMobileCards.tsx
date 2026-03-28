import { formatDateTime, getExt, downloadAsZip, isPreviewable } from "@/lib/utils";
import type { ProfileShort } from "@/lib/utils";

interface ShareFile { id: string; file_name: string; file_size: number; storage_path: string }

interface ShareRow {
  id: string;
  comment: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
  created_by: string;
  building_id: string | null;
  floor_id: string | null;
  work_type_id: string | null;
  construction_id: string | null;
  work_id: string | null;
  tag: string | null;
  manual_tag: string | null;
  creator: ProfileShort | null;
  file_share_files: ShareFile[];
  file_share_recipients: {
    user_id: string;
    is_read: boolean;
    trashed_at: string | null;
    recipient: ProfileShort | null;
  }[];
}

type Tab = "incoming" | "outgoing" | "drafts" | "all" | "trash";

interface ShareMobileCardsProps {
  shares: ShareRow[];
  loading: boolean;
  activeTab: Tab;
  isIncoming: boolean;
  userId: string | undefined;
  isUnread: (s: ShareRow) => boolean;
  senderOrRecipient: (s: ShareRow) => string;
  markAsRead: (id: string) => void;
  downloadFile: (storagePath: string, fileName: string) => void;
  handleTrashDraft: (id: string) => void;
  handleTrashIncoming: (id: string) => void;
  onOpenDraft: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onPreview?: (fileName: string, storagePath: string) => void;
}

export default function ShareMobileCards({
  shares, loading, activeTab, isIncoming, userId,
  isUnread, senderOrRecipient, markAsRead,
  handleTrashDraft, handleTrashIncoming, onOpenDraft, onOpenDetail, onPreview,
}: ShareMobileCardsProps) {
  if (loading) {
    return <div className="ds-card p-6 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>;
  }

  if (shares.length === 0) {
    return (
      <div className="ds-card p-6 text-center">
        <p className="font-medium" style={{ color: "var(--ds-text-muted)" }}>
          {activeTab === "incoming" && "Нет входящих файлов"}
          {activeTab === "outgoing" && "Вы ещё ничего не отправляли"}
          {activeTab === "drafts" && "Нет черновиков"}
          {activeTab === "all" && "Пока пусто"}
          {activeTab === "trash" && "Корзина пуста"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {shares.map((s) => {
        const unread = isIncoming && isUnread(s);
        return (
          <div
            key={s.id}
            className="ds-card p-3"
            style={unread ? { background: "color-mix(in srgb, var(--ds-accent) 4%, var(--ds-surface))" } : undefined}
            onClick={() => {
              markAsRead(s.id);
              if (s.status === "draft") onOpenDraft(s.id);
              else onOpenDetail(s.id);
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                {unread && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>{formatDateTime(s.sent_at || s.created_at)}</span>
              </div>
              {s.status === "draft" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, #f59e0b 15%, var(--ds-surface))", color: "#f59e0b" }}>
                  Черновик
                </span>
              )}
            </div>

            <div className="text-sm font-medium mb-1" style={{ color: "var(--ds-text)" }}>
              {isIncoming || activeTab === "all" || activeTab === "trash" ? "От: " : "Кому: "}
              {senderOrRecipient(s)}
            </div>

            {s.comment && (
              <div className="text-xs line-clamp-2 mb-1" style={{ color: "var(--ds-text-muted)" }}>{s.comment}</div>
            )}

            {s.tag && (
              <div className="text-xs mb-1" style={{ color: "var(--ds-text-faint)" }}>
                <span className="px-1.5 py-0.5 rounded" style={{ background: "var(--ds-surface-sunken)" }}>{s.tag}</span>
              </div>
            )}

            {s.file_share_files.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5" onClick={(e) => e.stopPropagation()}>
                {s.file_share_files.map((f) => {
                  const ext = getExt(f.file_name);
                  const canPreview = isPreviewable(f.file_name);
                  const nameWithoutExt = f.file_name.replace(/\.[^.]+$/, "");
                  return (
                    <span
                      key={f.id}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono border ${canPreview && onPreview ? "cursor-pointer active:opacity-70" : ""}`}
                      style={{ background: "color-mix(in srgb, var(--ds-text-faint) 8%, var(--ds-surface))", color: canPreview && onPreview ? "var(--ds-accent)" : "var(--ds-text-muted)", borderColor: "color-mix(in srgb, var(--ds-text-faint) 15%, transparent)" }}
                      onClick={() => { if (canPreview && onPreview) onPreview(f.file_name, f.storage_path); }}
                    >
                      <span className="max-w-[120px] truncate">{nameWithoutExt}</span>
                      <span className="opacity-60">.{ext.toLowerCase()}</span>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
              {s.file_share_files.length > 0 && (
                <button
                  onClick={() => { markAsRead(s.id); downloadAsZip(s.file_share_files.map((f) => ({ storagePath: f.storage_path, fileName: f.file_name })), s.comment || "файлы", "fileshare-files"); }}
                  className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))" }}>
                  Скачать
                </button>
              )}
              {s.status === "draft" && (
                <button onClick={() => handleTrashDraft(s.id)}
                  className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "#ef4444", background: "color-mix(in srgb, #ef4444 10%, var(--ds-surface))" }}>
                  В корзину
                </button>
              )}
              {s.status === "sent" && s.created_by !== userId && (
                <button onClick={() => handleTrashIncoming(s.id)}
                  className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "#ef4444", background: "color-mix(in srgb, #ef4444 10%, var(--ds-surface))" }}>
                  В корзину
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
