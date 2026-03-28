import type { TaskCell } from "@/components/tasks/ActiveTable";
import type { ShareRow } from "@/components/tasks/HistoryTable";
import type { PermissionKey } from "@/types";
import { getStatusStyle } from "@/constants/statusColors";
import { shortName, formatDate, getExt, isPreviewable } from "@/lib/utils";

interface Props {
  isHistory: boolean;
  loading: boolean;
  emptyMsg: string;
  activeCards: TaskCell[];
  historyCards: ShareRow[];
  userId: string | undefined;
  getColorKey: (status: string) => string;
  hasPermission: (perm: PermissionKey) => boolean;
  canReview: (cell: TaskCell) => boolean;
  canSupervise: (cell: TaskCell) => boolean;
  canArchive: (cell: TaskCell) => boolean;
  canAcknowledgeCell: (cell: TaskCell) => boolean;
  canSendCells: (cell: TaskCell) => boolean;
  getReturnTo: (cell: TaskCell) => string;
  onOpenCell: (id: string) => void;
  onRemarks: (cell: { id: string; name: string; sendBackTo: string }) => void;
  onSignWithRemarks: (cell: { id: string; name: string; sendBackTo: string }) => void;
  onSign: (cell: TaskCell) => void;
  onForward: (cell: { id: string; name: string; originalSenderId: string }) => void;
  onDelegate: (cell: { id: string; name: string; originalSenderId: string }) => void;
  onAcknowledge: (cell: { id: string; name: string }) => void;
  onApproveSupervision: (cell: TaskCell) => void;
  onCorrection: (cell: { id: string; name: string; sendBackTo: string }) => void;
  onArchive: (cell: { id: string; name: string }) => void;
  onSendToReview: (cell: { id: string; name: string; createdBy: string }) => void;
  onSendToAcknowledge: (cell: { id: string; name: string }) => void;
  onSendToSupervision: (cell: { id: string; name: string; createdBy: string }) => void;
  onPreview: (file: { fileName: string; storagePath: string }) => void;
}

export default function TasksMobileCards({
  isHistory,
  loading,
  emptyMsg,
  activeCards,
  historyCards,
  userId,
  getColorKey,
  hasPermission,
  canReview,
  canSupervise,
  canArchive,
  canAcknowledgeCell,
  canSendCells,
  getReturnTo,
  onOpenCell,
  onRemarks,
  onSignWithRemarks,
  onSign,
  onForward,
  onDelegate,
  onAcknowledge,
  onApproveSupervision,
  onCorrection,
  onArchive,
  onSendToReview,
  onSendToAcknowledge,
  onSendToSupervision,
  onPreview,
}: Props) {
  if (loading) {
    return <div className="ds-card p-6 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>;
  }

  if (isHistory) {
    if (historyCards.length === 0) {
      return (
        <div className="ds-card p-6 text-center">
          <p className="font-medium" style={{ color: "var(--ds-text-muted)" }}>{emptyMsg}</p>
        </div>
      );
    }
    return (
      <>
        {historyCards.map((s) => {
          if (!s.cells) return null;
          const isMe = (id: string) => id === userId;
          return (
            <div key={s.id} className="ds-card p-3" onClick={() => onOpenCell(s.cells!.id)}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium truncate" style={{ color: "var(--ds-text)" }}>{s.cells.name}</span>
                <span className="text-xs shrink-0 ml-2" style={{ color: "var(--ds-text-faint)" }}>{formatDate(s.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block px-1.5 py-px rounded-full text-[10px] font-medium whitespace-nowrap" style={getStatusStyle(getColorKey(s.cells.status), null)}>
                  {s.cells.status}
                </span>
                {s.cells.dict_work_types?.name && (
                  <span className="text-xs truncate" style={{ color: "var(--ds-text-muted)" }}>{s.cells.dict_work_types.name}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--ds-text-muted)" }}>
                <span>От: {isMe(s.from_user_id) ? "Вы" : shortName(s.from_profile)}</span>
                <span>Кому: {isMe(s.to_user_id) ? "Вы" : shortName(s.to_profile)}</span>
              </div>
              {s.message && <div className="text-xs mt-1 line-clamp-2" style={{ color: "var(--ds-text-faint)" }}>{s.message}</div>}
              {s.cells.cell_files && s.cells.cell_files.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
                  {s.cells.cell_files.map((f) => {
                    const ext = getExt(f.file_name);
                    const canPreviewFile = isPreviewable(f.file_name);
                    const nameWithoutExt = f.file_name.replace(/\.[^.]+$/, "");
                    return (
                      <span
                        key={f.id}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono border ${canPreviewFile ? "cursor-pointer active:opacity-70" : ""}`}
                        style={{ background: "color-mix(in srgb, var(--ds-text-faint) 8%, var(--ds-surface))", color: canPreviewFile ? "var(--ds-accent)" : "var(--ds-text-muted)", borderColor: "color-mix(in srgb, var(--ds-text-faint) 15%, transparent)" }}
                        onClick={() => { if (canPreviewFile) onPreview({ fileName: f.file_name, storagePath: f.storage_path }); }}
                      >
                        <span className="max-w-[120px] truncate">{nameWithoutExt}</span>
                        <span className="opacity-60">.{ext.toLowerCase()}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  }

  // Active cards
  if (activeCards.length === 0) {
    return (
      <div className="ds-card p-6 text-center">
        <p className="font-medium" style={{ color: "var(--ds-text-muted)" }}>{emptyMsg}</p>
      </div>
    );
  }

  return (
    <>
      {activeCards.map((cell) => (
        <div key={cell.id} className="ds-card p-3" onClick={() => onOpenCell(cell.id)}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium truncate" style={{ color: "var(--ds-text)" }}>{cell.name}</span>
            <span className="text-xs shrink-0 ml-2" style={{ color: "var(--ds-text-faint)" }}>{formatDate(cell.created_at)}</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block px-1.5 py-px rounded-full text-[10px] font-medium whitespace-nowrap" style={getStatusStyle(getColorKey(cell.status), cell.progress_percent)}>
              {cell.status}
            </span>
            {cell.dict_work_types?.name && (
              <span className="text-xs truncate" style={{ color: "var(--ds-text-muted)" }}>{cell.dict_work_types.name}</span>
            )}
          </div>
          {cell.lastMessage && <div className="text-xs mt-1 line-clamp-2" style={{ color: "var(--ds-text-faint)" }}>{cell.lastMessage}</div>}
          {cell.cell_files.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
              {cell.cell_files.map((f) => {
                const ext = getExt(f.file_name);
                const canPreviewFile = isPreviewable(f.file_name);
                const nameWithoutExt = f.file_name.replace(/\.[^.]+$/, "");
                return (
                  <span
                    key={f.id}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono border ${canPreviewFile ? "cursor-pointer active:opacity-70" : ""}`}
                    style={{ background: "color-mix(in srgb, var(--ds-text-faint) 8%, var(--ds-surface))", color: canPreviewFile ? "var(--ds-accent)" : "var(--ds-text-muted)", borderColor: "color-mix(in srgb, var(--ds-text-faint) 15%, transparent)" }}
                    onClick={() => { if (canPreviewFile) onPreview({ fileName: f.file_name, storagePath: f.storage_path }); }}
                  >
                    <span className="max-w-[120px] truncate">{nameWithoutExt}</span>
                    <span className="opacity-60">.{ext.toLowerCase()}</span>
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex gap-1 flex-wrap mt-2" onClick={(e) => e.stopPropagation()}>
            {canReview(cell) && cell.send_type === "review" && (
              <>
                {hasPermission("can_remark") && (
                  <button onClick={() => onRemarks({ id: cell.id, name: cell.name, sendBackTo: getReturnTo(cell) })}
                    className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "#f97316", background: "color-mix(in srgb, #f97316 10%, var(--ds-surface))" }}>Замечания</button>
                )}
                {hasPermission("can_sign") && (
                  <>
                    <button onClick={() => { if (confirm(`Подписать "${cell.name}"?`)) onSign(cell); }}
                      className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "#0d9488", background: "color-mix(in srgb, #0d9488 10%, var(--ds-surface))" }}>Подписать</button>
                    <button onClick={() => onSignWithRemarks({ id: cell.id, name: cell.name, sendBackTo: getReturnTo(cell) })}
                      className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "#f59e0b", background: "color-mix(in srgb, #f59e0b 10%, var(--ds-surface))" }}>С замечанием</button>
                    <button onClick={() => onForward({ id: cell.id, name: cell.name, originalSenderId: cell.created_by })}
                      className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "#6366f1", background: "color-mix(in srgb, #6366f1 10%, var(--ds-surface))" }}>Переслать</button>
                  </>
                )}
                <button onClick={() => onDelegate({ id: cell.id, name: cell.name, originalSenderId: cell.created_by })}
                  className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "#8b5cf6", background: "color-mix(in srgb, #8b5cf6 10%, var(--ds-surface))" }}>Делегировать</button>
              </>
            )}
            {canAcknowledgeCell(cell) && (
              <button onClick={() => onAcknowledge({ id: cell.id, name: cell.name })}
                className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "var(--ds-accent)", background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))" }}>Ознакомлен</button>
            )}
            {canSupervise(cell) && cell.send_type === "supervision" && (
              <>
                <button onClick={() => { if (confirm(`Согласовать "${cell.name}"?`)) onApproveSupervision(cell); }}
                  className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "#059669", background: "color-mix(in srgb, #059669 10%, var(--ds-surface))" }}>Согласовать</button>
                <button onClick={() => onCorrection({ id: cell.id, name: cell.name, sendBackTo: getReturnTo(cell) })}
                  className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "#e11d48", background: "color-mix(in srgb, #e11d48 10%, var(--ds-surface))" }}>На исправление</button>
              </>
            )}
            {canArchive(cell) && (
              <button onClick={() => onArchive({ id: cell.id, name: cell.name })}
                className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "var(--ds-text-muted)", background: "var(--ds-surface-sunken)" }}>В архив</button>
            )}
            {canSendCells(cell) && (
              <>
                <button onClick={() => onSendToReview({ id: cell.id, name: cell.name, createdBy: cell.created_by })}
                  className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "#22c55e", background: "color-mix(in srgb, #22c55e 10%, var(--ds-surface))" }}>На проверку</button>
                <button onClick={() => onSendToAcknowledge({ id: cell.id, name: cell.name })}
                  className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "#f59e0b", background: "color-mix(in srgb, #f59e0b 10%, var(--ds-surface))" }}>На ознакомление</button>
                <button onClick={() => onSendToSupervision({ id: cell.id, name: cell.name, createdBy: cell.created_by })}
                  className="px-2 py-1 text-xs rounded-lg font-medium" style={{ color: "#7c3aed", background: "color-mix(in srgb, #7c3aed 10%, var(--ds-surface))" }}>На АН</button>
              </>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
