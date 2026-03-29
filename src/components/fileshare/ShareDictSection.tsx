import { useEffect, useMemo, useState } from "react";
import { getOverlayUrl } from "@/lib/overlayUrlCache";
import { useDictionaries } from "@/hooks/useDictionaries";
import { useDictLinks, filterChildren, isChildLocked, hasLinkedChildren, compositeKey } from "@/hooks/useDictLinks";
import { useOverlays } from "@/hooks/useOverlays";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { MONTHS_RU } from "@/lib/utils";
import DictSelect from "@/components/registry/DictSelect";
import PolygonDrawer from "@/components/plan/PolygonDrawer";
import type { Point } from "@/components/plan/SnapEngine";

export interface ShareDictData {
  building_id: string | null;
  floor_id: string | null;
  work_type_id: string | null;
  construction_id: string | null;
  work_id: string | null;
  manual_tag: string;
  tag: string;
  overlay_id: string | null;
  polygons: Point[][];
}

interface Props {
  onChange: (data: ShareDictData) => void;
  initialData?: Partial<ShareDictData>;
}

export default function ShareDictSection({ onChange, initialData }: Props) {
  const { buildings, floors, workTypes, constructions, works, loadDicts } = useDictionaries();
  const { getColorKey } = useProjectStatuses();
  const { buildingWorkTypes, workTypeConstructions, buildingWorkTypeFloors, workTypeOverlays } = useDictLinks();
  const { overlays: allOverlays, overlayBuildings, overlayFloors: overlayFloorLinks, overlayConstructions: overlayConstructionLinks } = useOverlays();

  const [selBuilding, setSelBuilding] = useState(initialData?.building_id || "");
  const [selWorkType, setSelWorkType] = useState(initialData?.work_type_id || "");
  const [selFloor, setSelFloor] = useState(initialData?.floor_id || "");
  const [selConstruction, setSelConstruction] = useState(initialData?.construction_id || "");
  const [selWork, setSelWork] = useState(initialData?.work_id || "");
  const [manualTag, setManualTag] = useState(initialData?.manual_tag || "");
  const [showTag, setShowTag] = useState(!!initialData?.manual_tag);

  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayImageUrl, setOverlayImageUrl] = useState<string | null>(null);
  const [drawnPolygons, setDrawnPolygons] = useState<Point[][]>(initialData?.polygons || []);

  useEffect(() => { loadDicts(); }, [loadDicts]);

  // Каскадная фильтрация (паттерн из CreateCellModal)
  const filteredWorkTypes = filterChildren(workTypes, buildingWorkTypes, selBuilding || null);
  const floorKey = compositeKey(selBuilding, selWorkType);
  const filteredFloors = filterChildren(floors, buildingWorkTypeFloors, floorKey);
  const filteredConstructions = filterChildren(constructions, workTypeConstructions, selWorkType || null);

  const showFloors = hasLinkedChildren(buildingWorkTypeFloors, floorKey);
  const workTypeDisabled = !selBuilding || isChildLocked(buildingWorkTypes, selBuilding || null);

  // Подложки
  const overlayWorkTypeMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [wtId, oIds] of Object.entries(workTypeOverlays)) {
      for (const oId of oIds) { if (!map[oId]) map[oId] = []; map[oId].push(wtId); }
    }
    return map;
  }, [workTypeOverlays]);

  const matchedOverlays = useMemo(() => {
    const result: typeof allOverlays = [];
    for (const overlay of allOverlays) {
      const hasWT = (overlayWorkTypeMap[overlay.id]?.length || 0) > 0;
      const hasB = (overlayBuildings[overlay.id]?.length || 0) > 0;
      const hasF = (overlayFloorLinks[overlay.id]?.length || 0) > 0;
      const hasC = (overlayConstructionLinks[overlay.id]?.length || 0) > 0;
      if (!hasWT && !hasB && !hasF && !hasC) continue;
      if (hasWT && (!selWorkType || !overlayWorkTypeMap[overlay.id].includes(selWorkType))) continue;
      if (hasB && (!selBuilding || !overlayBuildings[overlay.id].includes(selBuilding))) continue;
      if (hasF && (!selFloor || !overlayFloorLinks[overlay.id].includes(selFloor))) continue;
      if (hasC && (!selConstruction || !overlayConstructionLinks[overlay.id].includes(selConstruction))) continue;
      result.push(overlay);
    }
    return result;
  }, [allOverlays, selBuilding, selWorkType, selFloor, selConstruction, overlayWorkTypeMap, overlayBuildings, overlayFloorLinks, overlayConstructionLinks]);

  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(initialData?.overlay_id || null);

  useEffect(() => {
    if (matchedOverlays.length === 1) setSelectedOverlayId(matchedOverlays[0].id);
    else if (matchedOverlays.length === 0) setSelectedOverlayId(null);
    else if (selectedOverlayId && !matchedOverlays.find((o) => o.id === selectedOverlayId)) setSelectedOverlayId(null);
  }, [matchedOverlays]);

  const linkedOverlay = useMemo(() => {
    if (!selectedOverlayId) return null;
    return matchedOverlays.find((o) => o.id === selectedOverlayId) || null;
  }, [selectedOverlayId, matchedOverlays]);

  useEffect(() => {
    if (!linkedOverlay) { setOverlayImageUrl(null); return; }
    let cancelled = false;
    getOverlayUrl(linkedOverlay.storage_path).then((url) => { if (!cancelled && url) setOverlayImageUrl(url); });
    return () => { cancelled = true; };
  }, [linkedOverlay]);

  // Автометки
  useEffect(() => {
    const autoTags: string[] = [];
    const bName = buildings.find((b) => b.id === selBuilding)?.name;
    const wtName = workTypes.find((w) => w.id === selWorkType)?.name;
    const fName = floors.find((f) => f.id === selFloor)?.name;
    const cName = constructions.find((c) => c.id === selConstruction)?.name;
    const wName = works.find((w) => w.id === selWork)?.name;
    if (bName) autoTags.push(bName);
    if (wtName) autoTags.push(wtName);
    if (fName) autoTags.push(fName);
    if (cName) autoTags.push(cName);
    if (wName) autoTags.push(wName);
    const now = new Date();
    autoTags.push(MONTHS_RU[now.getMonth()]);
    autoTags.push(String(now.getFullYear()));
    if (manualTag.trim()) autoTags.push(manualTag.trim());
    const tag = autoTags.join(", ");

    onChange({
      building_id: selBuilding || null,
      floor_id: (showFloors ? selFloor : "") || null,
      work_type_id: selWorkType || null,
      construction_id: selConstruction || null,
      work_id: selWork || null,
      manual_tag: manualTag.trim(),
      tag,
      overlay_id: selectedOverlayId,
      polygons: drawnPolygons,
    });
  }, [selBuilding, selWorkType, selFloor, selConstruction, selWork, manualTag, drawnPolygons, selectedOverlayId, buildings, workTypes, floors, constructions, works, showFloors]);

  function handleBuildingChange(v: string) {
    setSelBuilding(v);
    setSelWorkType(""); setSelFloor(""); setSelConstruction(""); setDrawnPolygons([]);
  }
  function handleWorkTypeChange(v: string) {
    setSelWorkType(v); setSelFloor(""); setSelConstruction(""); setDrawnPolygons([]);
  }

  // Полноэкранный рисователь
  if (showOverlay && linkedOverlay && overlayImageUrl) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--ds-surface)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--ds-text)" }}>Отметить области</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--ds-text-muted)" }}>
              {linkedOverlay.name}
              {drawnPolygons.length > 0 && (
                <span className="ml-2 font-medium" style={{ color: "var(--ds-accent)" }}>
                  Областей: {drawnPolygons.length}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowOverlay(false)} className="ds-btn px-3 py-1.5 text-sm">Готово</button>
            <button onClick={() => setShowOverlay(false)} className="ds-icon-btn">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <PolygonDrawer
            imageUrl={overlayImageUrl}
            imageWidth={linkedOverlay.width || 1000}
            imageHeight={linkedOverlay.height || 750}
            existingMasks={[]}
            newPolygons={drawnPolygons}
            onRemovePolygon={(i) => setDrawnPolygons((p) => p.filter((_, idx) => idx !== i))}
            getColorKey={getColorKey}
            onComplete={(points) => setDrawnPolygons((p) => [...p, points])}
            onCancel={() => setShowOverlay(false)}
            fullscreen
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 rounded-lg" style={{ background: "var(--ds-surface-sunken)", border: "1px solid var(--ds-border)" }}>
      <div className="text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>Привязка к конструкциям</div>

      <div className="grid grid-cols-2 gap-3">
        <DictSelect label="Место работ" name="building" items={buildings} value={selBuilding} onChange={handleBuildingChange} />
        <DictSelect label="Вид работ" name="workType" items={filteredWorkTypes} value={selWorkType} onChange={handleWorkTypeChange} disabled={workTypeDisabled} />
        {showFloors && (
          <DictSelect label="Уровни/срезы" name="floor" items={filteredFloors} value={selFloor} onChange={setSelFloor} />
        )}
        <DictSelect label="Конструкция" name="construction" items={filteredConstructions} value={selConstruction} onChange={setSelConstruction} />
        <DictSelect label="Выполняемая работа" name="work" items={works} value={selWork} onChange={setSelWork} />
      </div>

      {/* Метка */}
      {!showTag ? (
        <button type="button" onClick={() => setShowTag(true)} className="text-xs" style={{ color: "var(--ds-accent)" }}>
          + Метка
        </button>
      ) : (
        <div>
          <label className="ds-label">Метка</label>
          <input type="text" className="ds-input text-sm" placeholder="Ручная метка..." value={manualTag} onChange={(e) => setManualTag(e.target.value)} />
        </div>
      )}

      {/* Подложка */}
      {linkedOverlay && overlayImageUrl && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowOverlay(true)}
            className="ds-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            {drawnPolygons.length > 0 ? `Области (${drawnPolygons.length})` : "Отметить область"}
          </button>
          <span className="text-xs truncate" style={{ color: "var(--ds-text-faint)" }}>{linkedOverlay.name}</span>
        </div>
      )}

      {/* Автометки */}
      {(selBuilding || selWorkType) && (
        <div className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
          Метки: {[
            buildings.find((b) => b.id === selBuilding)?.name,
            workTypes.find((w) => w.id === selWorkType)?.name,
            floors.find((f) => f.id === selFloor)?.name,
            constructions.find((c) => c.id === selConstruction)?.name,
            works.find((w) => w.id === selWork)?.name,
          ].filter(Boolean).join(", ")}
        </div>
      )}
    </div>
  );
}
