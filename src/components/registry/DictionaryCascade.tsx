import type { DictionaryItem } from "@/types";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import type { MaskWithCell } from "@/hooks/useCellMasks";
import type { Point } from "@/components/plan/SnapEngine";
import PolygonDrawer from "@/components/plan/PolygonDrawer";
import DictSelect from "@/components/registry/DictSelect";

interface OverlayItem {
  id: string;
  name: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  tab_type?: string | null;
}

interface Props {
  // Dictionary selections
  selBuilding: string;
  selWorkType: string;
  selFloor: string;
  setSelFloor: (v: string) => void;
  selConstruction: string;
  setSelConstruction: (v: string) => void;
  selSet: string;
  setSelSet: (v: string) => void;
  handleBuildingChange: (v: string) => void;
  handleWorkTypeChange: (v: string) => void;
  // Filtered dictionaries
  buildings: DictionaryItem[];
  filteredWorkTypes: DictionaryItem[];
  filteredFloors: DictionaryItem[];
  filteredConstructions: DictionaryItem[];
  filteredSets: DictionaryItem[];
  showFloors: boolean;
  showConstructions: boolean;
  showSets: boolean;
  workTypeDisabled: boolean;
  // Overlay
  matchedOverlays: OverlayItem[];
  selectedOverlayId: string | null;
  setSelectedOverlayId: (v: string | null) => void;
  linkedOverlay: OverlayItem | null;
  overlayImageUrl: string | null;
  overlayType: { label: string; color: string; style: { background: string; color: string; borderColor: string } } | null;
  drawnPolygons: Point[][];
  setDrawnPolygons: React.Dispatch<React.SetStateAction<Point[][]>>;
  removeDrawnPolygon: (index: number) => void;
  filteredExistingMasks: MaskWithCell[];
  showOverlayStep: boolean;
  setShowOverlayStep: (v: boolean) => void;
}

export default function DictionaryCascade({
  selBuilding, selWorkType, selFloor, setSelFloor,
  selConstruction, setSelConstruction, selSet, setSelSet,
  handleBuildingChange, handleWorkTypeChange,
  buildings, filteredWorkTypes, filteredFloors, filteredConstructions, filteredSets,
  showFloors, showConstructions, showSets,
  workTypeDisabled,
  matchedOverlays,
  selectedOverlayId, setSelectedOverlayId,
  linkedOverlay,
  overlayImageUrl,
  overlayType,
  drawnPolygons, setDrawnPolygons,
  removeDrawnPolygon,
  filteredExistingMasks,
  showOverlayStep, setShowOverlayStep,
}: Props) {
  const { getColorKey } = useProjectStatuses();

  // Модал рисования маски (полноэкранный)
  if (showOverlayStep && linkedOverlay && overlayImageUrl) {
    return (
      <div className="ds-overlay p-4">
        <div className="ds-overlay-bg" />
        <div
          className="ds-modal w-full max-w-5xl max-h-[95vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ds-modal-header">
            <div>
              <h2 className="ds-modal-title">Отметить области на подложке</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--ds-text-muted)" }}>
                {linkedOverlay.name}
                {drawnPolygons.length > 0 && (
                  <span className="ml-2 font-medium" style={{ color: "var(--ds-accent)" }}>
                    Нарисовано областей: {drawnPolygons.length}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOverlayStep(false)}
                className="ds-btn px-3 py-1.5 text-sm"
              >
                Готово
              </button>
              <button
                onClick={() => setShowOverlayStep(false)}
                className="ds-icon-btn"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="p-4">
            <PolygonDrawer
              imageUrl={overlayImageUrl}
              imageWidth={linkedOverlay.width || 1000}
              imageHeight={linkedOverlay.height || 750}
              existingMasks={filteredExistingMasks}
              newPolygons={drawnPolygons}
              onRemovePolygon={removeDrawnPolygon}
              getColorKey={getColorKey}
              onComplete={(points) => setDrawnPolygons((prev) => [...prev, points])}
              onCancel={() => setShowOverlayStep(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Справочники — каскадное появление */}
      <div className="grid grid-cols-2 gap-4">
        <DictSelect label="Место работ" name="building_id" items={buildings} required value={selBuilding} onChange={handleBuildingChange} />
        <DictSelect label="Вид работ" name="work_type_id" items={filteredWorkTypes} required value={selWorkType} onChange={handleWorkTypeChange} disabled={workTypeDisabled} />
        {selWorkType && showFloors && (
          <DictSelect label="Уровни/срезы" name="floor_id" items={filteredFloors} value={selFloor} onChange={setSelFloor} />
        )}
        {selWorkType && showConstructions && (
          <DictSelect label="Конструкция" name="construction_id" items={filteredConstructions} value={selConstruction} onChange={setSelConstruction} />
        )}
        {selWorkType && showSets && (
          <DictSelect label="Комплект" name="set_id" items={filteredSets} value={selSet} onChange={setSelSet} />
        )}
      </div>

      {/* Подложка — появляется когда есть совпадения */}
      {selWorkType && matchedOverlays.length > 1 && (
        <div className="ds-card p-3">
          <label className="ds-label">
            Подложка ({matchedOverlays.length} шт.)
          </label>
          <select
            value={selectedOverlayId || ""}
            onChange={(e) => { setSelectedOverlayId(e.target.value || null); setDrawnPolygons([]); }}
            className="ds-input"
          >
            <option value="">Выберите подложку...</option>
            {matchedOverlays.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}

      {selWorkType && linkedOverlay && overlayImageUrl && (
        <div className="border rounded-lg p-3" style={overlayType ? overlayType.style : { background: "color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface))", color: "var(--ds-accent)", borderColor: "var(--ds-border)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="text-sm font-medium">
                  {overlayType && (
                    <span className="inline-block px-1.5 py-0.5 text-xs rounded mr-1.5 border" style={overlayType.style}>
                      {overlayType.label}
                    </span>
                  )}
                  {linkedOverlay.name}
                </p>
                <p className="text-xs opacity-75 mt-0.5">
                  {drawnPolygons.length > 0
                    ? `Отмечено областей: ${drawnPolygons.length}`
                    : <>Необходимо отметить области на плане <span style={{ color: "#ef4444" }}>*</span></>}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowOverlayStep(true)}
              className="ds-btn px-3 py-1.5 text-xs whitespace-nowrap"
            >
              {drawnPolygons.length > 0 ? "Изменить области" : "Отметить области"}
            </button>
          </div>
          {drawnPolygons.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {drawnPolygons.map((poly, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs" style={{ background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }}>
                  Область {i + 1} ({poly.length} т.)
                  <button
                    type="button"
                    onClick={() => removeDrawnPolygon(i)}
                    style={{ color: "var(--ds-text-faint)" }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => setDrawnPolygons([])}
                className="text-xs"
                style={{ color: "#ef4444" }}
              >
                Удалить все
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
