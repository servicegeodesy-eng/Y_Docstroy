import type { Overlay } from "@/types";
import { overlayLinkConfigs, TAB_TYPE_INLINE, getAutoTabType } from "@/hooks/useOverlayAdmin";

interface OverlayEditorProps {
  overlays: Overlay[];
  loading: boolean;
  linkedOverlayIds: Record<number, Set<string>>;
  overlayAxisGridLinks: { id: string; overlay_id: string; grid_id: string }[];
  deleteMode: boolean;
  // Upload form
  newName: string;
  setNewName: (v: string) => void;
  selectedFile: File | null;
  setSelectedFile: (f: File | null) => void;
  uploading: boolean;
  onUpload: () => void;
  // Edit
  editingId: string | null;
  editName: string;
  setEditName: (v: string) => void;
  editFile: File | null;
  setEditFile: (f: File | null) => void;
  saving: boolean;
  onStartEdit: (overlay: Overlay) => void;
  onCancelEdit: () => void;
  onSaveEdit: (overlay: Overlay) => void;
  // Actions
  onDelete: (overlay: Overlay) => void;
  onPreview: (overlay: Overlay) => void;
  onUpdateTabType: (id: string, tabType: string | null) => void;
  onAdjustMasks: (overlay: Overlay) => void;
  onLinkDictionary: (overlay: Overlay, configIdx: number) => void;
  onAxisLink: (overlay: Overlay) => void;
}

export default function OverlayEditor({
  overlays, loading, linkedOverlayIds, overlayAxisGridLinks, deleteMode,
  newName, setNewName, selectedFile, setSelectedFile, uploading, onUpload,
  editingId, editName, setEditName, editFile, setEditFile, saving,
  onStartEdit, onCancelEdit, onSaveEdit,
  onDelete, onPreview, onUpdateTabType, onAdjustMasks, onLinkDictionary, onAxisLink,
}: OverlayEditorProps) {
  return (
    <>
      {/* Загрузка новой подложки */}
      <div className="px-4 py-3 space-y-2" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название подложки..."
            className="ds-input flex-1"
          />
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex-1 flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors" style={{ borderColor: "var(--ds-border-strong)" }}>
            <svg className="w-4 h-4" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm truncate" style={{ color: "var(--ds-text-faint)" }}>
              {selectedFile ? selectedFile.name : "Выбрать изображение"}
            </span>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
          <button
            onClick={onUpload}
            disabled={!newName.trim() || !selectedFile || uploading}
            className="ds-btn whitespace-nowrap"
          >
            {uploading ? "Загрузка..." : "Добавить"}
          </button>
        </div>
      </div>

      {/* Список подложек */}
      {loading ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>
      ) : overlays.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>
          Подложки не добавлены. Загрузите первое изображение.
        </div>
      ) : (
        <ul>
          {overlays.map((overlay) => (
            <li key={overlay.id} className="flex items-center gap-2 px-4 py-2.5 group" style={{ borderBottom: "1px solid var(--ds-border)" }}>
              {editingId === overlay.id ? (
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && onSaveEdit(overlay)}
                      className="ds-input flex-1 text-sm"
                      autoFocus
                    />
                    <button
                      onClick={() => onSaveEdit(overlay)}
                      disabled={saving}
                      className="ds-btn px-2 py-1 text-xs"
                    >
                      {saving ? "..." : "OK"}
                    </button>
                    <button
                      onClick={onCancelEdit}
                      disabled={saving}
                      className="ds-btn-secondary px-2 py-1 text-xs"
                    >
                      Отмена
                    </button>
                  </div>
                  <label className="flex items-center gap-2 px-2 py-1 border border-dashed rounded cursor-pointer transition-colors" style={{ borderColor: "var(--ds-border-strong)" }}>
                    <svg className="w-3.5 h-3.5" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="text-xs truncate" style={{ color: "var(--ds-text-faint)" }}>
                      {editFile ? editFile.name : "Заменить файл..."}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div
                    className="flex-1 min-w-0 cursor-pointer select-none rounded px-1 -mx-1"
                    onDoubleClick={() => onStartEdit(overlay)}
                    title="Двойной клик для редактирования"
                  >
                    <span className="text-sm block truncate" style={{ color: "var(--ds-text)" }}>{overlay.name}</span>
                    <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
                      {overlay.file_name}
                      {overlay.width && overlay.height ? ` (${overlay.width}×${overlay.height})` : ""}
                    </span>
                  </div>
                  {/* Предпросмотр */}
                  <button
                    onClick={() => onPreview(overlay)}
                    className="ds-icon-btn !p-1 transition-colors"
                    style={{ color: "var(--ds-text-muted)" }}
                    title="Предпросмотр"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  {/* Корректировка масок */}
                  {!deleteMode && (
                    <button
                      onClick={() => onAdjustMasks(overlay)}
                      className="ds-icon-btn !p-1 transition-colors"
                      style={{ color: "var(--ds-text-muted)" }}
                      title="Корректировать области"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </button>
                  )}
                  {/* Тип подложки (вкладка) */}
                  <select
                    value={overlay.tab_type || getAutoTabType(overlay.id, linkedOverlayIds) || ""}
                    onChange={(e) => onUpdateTabType(overlay.id, e.target.value || null)}
                    className="px-1.5 py-0.5 rounded text-[11px] font-medium border cursor-pointer"
                    style={(() => {
                      const tabKey = overlay.tab_type || getAutoTabType(overlay.id, linkedOverlayIds);
                      if (!tabKey) return { borderColor: "var(--ds-border)", color: "var(--ds-text-faint)" };
                      const s = TAB_TYPE_INLINE[tabKey];
                      return s ? { ...s, opacity: overlay.tab_type ? 1 : 0.6 } : { borderColor: "var(--ds-border)", color: "var(--ds-text-faint)" };
                    })()}
                    title={overlay.tab_type ? "Задано вручную" : "Авто (по связям)"}
                  >
                    <option value="">— вкладка —</option>
                    <option value="plan">План</option>
                    <option value="facades">Фасады</option>
                    <option value="landscaping">Благоустройство</option>
                    <option value="roof">Кровля</option>
                    <option value="floors">Полы и потолки</option>
                    <option value="walls">Стены</option>
                    <option value="frame">Каркас</option>
                    <option value="territory">Территория строительства</option>
                    <option value="earthwork">Объёмы земляных масс</option>
                    <option value="foundation">Основание</option>
                    <option value="shoring">Ограждение котлована</option>
                    <option value="piles">Сваи</option>
                  </select>
                  {/* Сетки осей */}
                  {!deleteMode && (() => {
                    const hasAxisLinks = overlayAxisGridLinks.some((l) => l.overlay_id === overlay.id);
                    return (
                      <button
                        onClick={() => onAxisLink(overlay)}
                        className="relative p-1 transition-colors"
                        style={{ color: hasAxisLinks ? "var(--ds-text-muted)" : "var(--ds-text-faint)" }}
                        title={`Сетки осей${hasAxisLinks ? " (привязана)" : ""}`}
                      >
                        {hasAxisLinks && (
                          <span className="absolute inset-[-2px] rounded-full pointer-events-none" style={{ border: "2px solid #22c55e" }} />
                        )}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16M4 12h16M4 19h16M8 1v22M16 1v22" />
                        </svg>
                      </button>
                    );
                  })()}
                  {/* Связи со справочниками */}
                  {overlayLinkConfigs.map((lc, lcIdx) => {
                    const hasLinks = linkedOverlayIds[lcIdx]?.has(overlay.id) || false;
                    return (
                      <button
                        key={lcIdx}
                        onClick={() => onLinkDictionary(overlay, lcIdx)}
                        className="relative p-1 transition-colors"
                        style={{ color: hasLinks ? "var(--ds-text-muted)" : "var(--ds-text-faint)" }}
                        title={`Связи: ${lc.childLabel}${hasLinks ? " (установлена)" : ""}`}
                      >
                        {hasLinks && (
                          <span className="absolute inset-[-2px] rounded-full pointer-events-none" style={{ border: "2px solid #22c55e" }} />
                        )}
                        <OverlayLinkIcon childTable={lc.childTable} />
                      </button>
                    );
                  })}
                  {deleteMode && (
                    <button
                      onClick={() => onDelete(overlay)}
                      className="ds-icon-btn !p-1 transition-colors hover:!text-red-500"
                      style={{ color: "#ef4444" }}
                      title="Удалить"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}


function OverlayLinkIcon({ childTable }: { childTable: string }) {
  const cls = "w-4 h-4";
  switch (childTable) {
    case "dict_work_types":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "dict_buildings":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "dict_floors":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case "dict_constructions":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
    case "dict_works":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      );
    default:
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
  }
}
