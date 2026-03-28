import { memo } from "react";
import { formatSize } from "@/lib/utils";
import { useCreateCellForm } from "@/hooks/useCreateCellForm";
import DictionaryCascade from "@/components/registry/DictionaryCascade";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

function CreateCellModal({ onClose, onCreated }: Props) {
  const form = useCreateCellForm(onCreated);

  // Модал рисования маски (полноэкранный) — рендерится внутри DictionaryCascade
  if (form.showOverlayStep && form.linkedOverlay && form.overlayImageUrl) {
    return (
      <DictionaryCascade
        selBuilding={form.selBuilding}
        selWorkType={form.selWorkType}
        selFloor={form.selFloor}
        setSelFloor={form.setSelFloor}
        selConstruction={form.selConstruction}
        setSelConstruction={form.setSelConstruction}
        selSet={form.selSet}
        setSelSet={form.setSelSet}
        handleBuildingChange={form.handleBuildingChange}
        handleWorkTypeChange={form.handleWorkTypeChange}
        buildings={form.buildings}
        filteredWorkTypes={form.filteredWorkTypes}
        filteredFloors={form.filteredFloors}
        filteredConstructions={form.filteredConstructions}
        filteredSets={form.filteredSets}
        showFloors={form.showFloors}
        showConstructions={form.showConstructions}
        showSets={form.showSets}
        workTypeDisabled={form.workTypeDisabled}
        matchedOverlays={form.matchedOverlays}
        selectedOverlayId={form.selectedOverlayId}
        setSelectedOverlayId={form.setSelectedOverlayId}
        linkedOverlay={form.linkedOverlay}
        overlayImageUrl={form.overlayImageUrl}
        overlayType={form.overlayType}
        drawnPolygons={form.drawnPolygons}
        setDrawnPolygons={form.setDrawnPolygons}
        removeDrawnPolygon={form.removeDrawnPolygon}
        filteredExistingMasks={form.filteredExistingMasks}
        showOverlayStep={form.showOverlayStep}
        setShowOverlayStep={form.setShowOverlayStep}
      />
    );
  }

  return (
    <div className="ds-overlay p-4" onClick={onClose}>
      <div className="ds-overlay-bg" />
      <div
        className="ds-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ds-modal-header">
          <h2 className="ds-modal-title">Добавить ячейку</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { const formEl = document.getElementById("create-cell-form") as HTMLFormElement; formEl?.requestSubmit(); }}
              disabled={form.loading || form.validationHints.length > 0}
              className="ds-btn px-4 py-1.5 text-sm"
            >
              {form.loading ? "Создание..." : "Добавить"}
            </button>
            <button onClick={onClose} className="ds-icon-btn">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {/* Подсказки валидации */}
        {form.validationHints.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-6 py-2" style={{ borderBottom: "1px solid var(--ds-border)", background: "color-mix(in srgb, #ef4444 5%, var(--ds-surface))" }}>
            <span className="text-xs" style={{ color: "#ef4444" }}>Укажите:</span>
            {form.validationHints.map((hint) => (
              <span key={hint} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "color-mix(in srgb, #ef4444 10%, var(--ds-surface))", color: "#ef4444", border: "1px solid color-mix(in srgb, #ef4444 25%, var(--ds-border))" }}>
                {hint}
              </span>
            ))}
          </div>
        )}

        <form id="create-cell-form" onSubmit={form.handleFormSubmit} className="p-6 space-y-4">
          {form.error && (
            <div className="ds-alert-error">{form.error}</div>
          )}

          {/* Наименование */}
          <div>
            <label className="ds-label">
              Наименование <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              name="name"
              type="text"
              value={form.cellName}
              onChange={(e) => form.setCellName(e.target.value)}
              className="ds-input"
              placeholder="Введите наименование ячейки"
            />
          </div>

          <DictionaryCascade
            selBuilding={form.selBuilding}
            selWorkType={form.selWorkType}
            selFloor={form.selFloor}
            setSelFloor={form.setSelFloor}
            selConstruction={form.selConstruction}
            setSelConstruction={form.setSelConstruction}
            selSet={form.selSet}
            setSelSet={form.setSelSet}
            handleBuildingChange={form.handleBuildingChange}
            handleWorkTypeChange={form.handleWorkTypeChange}
            buildings={form.buildings}
            filteredWorkTypes={form.filteredWorkTypes}
            filteredFloors={form.filteredFloors}
            filteredConstructions={form.filteredConstructions}
            filteredSets={form.filteredSets}
            showFloors={form.showFloors}
            showConstructions={form.showConstructions}
            showSets={form.showSets}
            workTypeDisabled={form.workTypeDisabled}
            matchedOverlays={form.matchedOverlays}
            selectedOverlayId={form.selectedOverlayId}
            setSelectedOverlayId={form.setSelectedOverlayId}
            linkedOverlay={form.linkedOverlay}
            overlayImageUrl={form.overlayImageUrl}
            overlayType={form.overlayType}
            drawnPolygons={form.drawnPolygons}
            setDrawnPolygons={form.setDrawnPolygons}
            removeDrawnPolygon={form.removeDrawnPolygon}
            filteredExistingMasks={form.filteredExistingMasks}
            showOverlayStep={form.showOverlayStep}
            setShowOverlayStep={form.setShowOverlayStep}
          />

          {/* Файлы */}
          <div>
            <label className="ds-label">Файлы</label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors w-full" style={{ borderColor: "var(--ds-border)", color: "var(--ds-text-muted)" }}>
              <svg className="w-5 h-5" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Выбрать файлы</span>
              <input type="file" multiple onChange={form.handleFileSelect} className="hidden" />
            </label>
            {form.files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {form.files.map((file, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm" style={{ background: "var(--ds-surface-sunken)" }}>
                    <span className="flex-1 truncate" style={{ color: "var(--ds-text-muted)" }}>{file.name}</span>
                    <span className="text-xs whitespace-nowrap" style={{ color: "var(--ds-text-faint)" }}>{formatSize(file.size)}</span>
                    <button type="button" onClick={() => form.removeFile(i)} className="ds-icon-btn p-0.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {form.showFileWarning && (
              <div className="mt-3 ds-alert-warning">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Загрузите файлы</p>
                    <p className="text-xs mt-0.5 opacity-75">Ячейка будет создана без файлов.</p>
                  </div>
                  <button type="button" onClick={form.handleSkipFiles} className="ds-btn-secondary px-3 py-1 text-xs whitespace-nowrap">Не хочу</button>
                </div>
              </div>
            )}
          </div>

          {/* Описание + Метка + Прогресс — в строку */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Описание — скрыто под значок */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => form.setShowDescription(!form.showDescription)}
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: form.showDescription || form.cellDescription ? "var(--ds-accent)" : "var(--ds-text-faint)" }}
                title="Добавить описание"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                {form.cellDescription ? "Описание \u2713" : "Описание"}
              </button>
            </div>

            {/* Метка — скрыто под значок */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => form.setShowTag(!form.showTag)}
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: form.showTag || form.cellTag ? "var(--ds-accent)" : "var(--ds-text-faint)" }}
                title="Добавить метку"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {form.cellTag ? form.cellTag : "Метка"}
              </button>
              {form.showTag && (
                <input
                  name="tag"
                  type="text"
                  value={form.cellTag}
                  onChange={(e) => form.setCellTag(e.target.value)}
                  className="ds-input !py-1 text-sm !w-36"
                  placeholder="Добавить метку"
                  autoFocus
                />
              )}
            </div>

            {/* Выполнено (%) — скрыто под кнопку */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => form.setShowProgress(!form.showProgress)}
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: form.showProgress || form.cellProgress ? "var(--ds-accent)" : "var(--ds-text-faint)" }}
                title="Прогресс выполнения"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {form.cellProgress ? `${form.cellProgress}%` : "Прогресс"}
              </button>
              {form.showProgress && (
                <input
                  name="progress_percent"
                  type="number"
                  min="0"
                  max="100"
                  value={form.cellProgress}
                  onChange={(e) => form.setCellProgress(e.target.value)}
                  className="ds-input !w-24 !py-1 text-sm"
                  placeholder="0–100"
                  autoFocus
                />
              )}
            </div>
          </div>

          {/* Описание — раскрывающееся поле */}
          {form.showDescription && (
            <textarea
              name="description"
              rows={3}
              value={form.cellDescription}
              onChange={(e) => form.setCellDescription(e.target.value)}
              className="ds-input resize-none text-sm"
              placeholder="Описание ячейки (необязательно)"
              autoFocus
            />
          )}

        </form>
      </div>
    </div>
  );
}

export default memo(CreateCellModal);
