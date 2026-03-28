import useOverlayAdmin, { overlayLinkConfigs } from "@/hooks/useOverlayAdmin";
import DictionaryLinkEditor from "./DictionaryLinkEditor";
import OverlayMaskAdjuster from "./OverlayMaskAdjuster";
import OverlayAxisLinker from "./OverlayAxisLinker";
import OverlayEditor from "./OverlayEditor";

interface Props {
  onBack: () => void;
}

export default function OverlayManager({ onBack }: Props) {
  const d = useOverlayAdmin();

  // Экран привязки сеток осей к подложке
  if (d.axisLinkingOverlay) {
    return (
      <OverlayAxisLinker
        overlay={d.axisLinkingOverlay}
        onBack={() => { d.setAxisLinkingOverlay(null); d.loadAxisGridData(); }}
      />
    );
  }

  // Экран корректировки масок
  if (d.adjustingOverlay) {
    return (
      <OverlayMaskAdjuster
        overlay={d.adjustingOverlay}
        oldWidth={d.adjustOldDims.w}
        oldHeight={d.adjustOldDims.h}
        onDone={() => { d.setAdjustingOverlay(null); d.loadOverlays(); }}
      />
    );
  }

  // Экран связей подложки со справочником
  if (d.linkingOverlay && d.linkingConfig) {
    return (
      <DictionaryLinkEditor
        parentItem={{
          id: d.linkingOverlay.id,
          project_id: d.linkingOverlay.project_id,
          name: d.linkingOverlay.name,
          sort_order: d.linkingOverlay.sort_order,
          created_at: d.linkingOverlay.created_at,
        }}
        linkConfig={d.linkingConfig}
        onBack={() => { d.setLinkingOverlay(null); d.setLinkingConfig(null); d.loadLinkStatus(); }}
      />
    );
  }

  return (
    <>
    <div className="ds-card">
      {/* Шапка */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <button onClick={onBack} className="ds-icon-btn">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-medium" style={{ color: "var(--ds-text-muted)" }}>Подложки</h3>
        <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>({d.overlays.length})</span>
        <div className="ml-auto">
          {d.deleteMode ? (
            <button
              onClick={() => d.setDeleteMode(false)}
              className="ds-btn-secondary !px-3 !py-1 text-xs"
            >
              Готово
            </button>
          ) : (
            <button
              onClick={() => d.setDeleteMode(true)}
              className="ds-icon-btn !p-1.5 transition-colors hover:!text-red-500"
              style={{ color: "var(--ds-text-muted)" }}
              title="Режим удаления"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <OverlayEditor
        overlays={d.overlays}
        loading={d.loading}
        linkedOverlayIds={d.linkedOverlayIds}
        overlayAxisGridLinks={d.overlayAxisGridLinks}
        deleteMode={d.deleteMode}
        newName={d.newName}
        setNewName={d.setNewName}
        selectedFile={d.selectedFile}
        setSelectedFile={d.setSelectedFile}
        uploading={d.uploading}
        onUpload={d.uploadOverlay}
        editingId={d.editingId}
        editName={d.editName}
        setEditName={d.setEditName}
        editFile={d.editFile}
        setEditFile={d.setEditFile}
        saving={d.saving}
        onStartEdit={(overlay) => { d.setEditingId(overlay.id); d.setEditName(overlay.name); d.setEditFile(null); }}
        onCancelEdit={() => { d.setEditingId(null); d.setEditFile(null); }}
        onSaveEdit={d.saveEdit}
        onDelete={d.deleteOverlay}
        onPreview={d.showPreview}
        onUpdateTabType={d.updateTabType}
        onAdjustMasks={(overlay) => { d.setAdjustOldDims({ w: overlay.width || 0, h: overlay.height || 0 }); d.setAdjustingOverlay(overlay); }}
        onLinkDictionary={(overlay, configIdx) => { d.setLinkingOverlay(overlay); d.setLinkingConfig(overlayLinkConfigs[configIdx]); }}
        onAxisLink={d.setAxisLinkingOverlay}
      />

    </div>

      {/* Модал предпросмотра — вынесен из ds-card, чтобы transform:hover карточки не ломал position:fixed */}
      {d.previewUrl && (
        <div
          className="ds-overlay"
          onClick={() => { d.setPreviewUrl(null); d.setPreviewName(""); }}
        >
          <div className="ds-overlay-bg" />
          <div
            className="ds-modal max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ds-modal-header">
              <h3 className="ds-modal-title text-sm">{d.previewName}</h3>
              <button
                onClick={() => { d.setPreviewUrl(null); d.setPreviewName(""); }}
                className="ds-icon-btn"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <img src={d.previewUrl} alt={d.previewName} className="max-w-full h-auto rounded" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
