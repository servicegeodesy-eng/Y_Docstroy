import { useEffect, useState } from "react";
import { useOverlays } from "@/hooks/useOverlays";
import { useCellMasks } from "@/hooks/useCellMasks";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { getOverlayUrl } from "@/lib/overlayUrlCache";
import PolygonDrawer from "@/components/plan/PolygonDrawer";
import type { Point } from "@/components/plan/SnapEngine";

interface Props {
  selBuilding: string;
  selFloor: string;
  selConstruction: string;
  drawnPolygons: Point[][];
  onPolygonsChange: (polygons: Point[][]) => void;
  selOverlayId: string;
  onOverlayChange: (id: string) => void;
}

export default function OverlayMaskStep({
  selBuilding, selFloor, selConstruction,
  drawnPolygons, onPolygonsChange,
  selOverlayId, onOverlayChange,
}: Props) {
  const { overlays, overlayBuildings, overlayFloors, overlayConstructions } = useOverlays();
  const { getColorKey } = useProjectStatuses();
  const { masks: existingCellMasks } = useCellMasks(selOverlayId || null);
  const [overlayImageUrl, setOverlayImageUrl] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  // Filter overlays by selected building
  const filteredOverlays = overlays.filter((o) => {
    const hasBld = (overlayBuildings[o.id]?.length || 0) > 0;
    const hasFlr = (overlayFloors[o.id]?.length || 0) > 0;
    const hasCon = (overlayConstructions[o.id]?.length || 0) > 0;
    if (!hasBld && !hasFlr && !hasCon) return true;
    if (hasBld && selBuilding && !overlayBuildings[o.id].includes(selBuilding)) return false;
    if (hasFlr && selFloor && !overlayFloors[o.id].includes(selFloor)) return false;
    if (hasCon && selConstruction && !overlayConstructions[o.id].includes(selConstruction)) return false;
    return true;
  });

  const selectedOverlay = overlays.find((o) => o.id === selOverlayId);

  // Load overlay image
  useEffect(() => {
    if (!selOverlayId) { setOverlayImageUrl(null); return; }
    const overlay = overlays.find((o) => o.id === selOverlayId);
    if (!overlay) return;
    let cancelled = false;
    getOverlayUrl(overlay.storage_path).then((url) => {
      if (!cancelled && url) setOverlayImageUrl(url);
    });
    return () => { cancelled = true; };
  }, [selOverlayId, overlays]);

  const aspectH = selectedOverlay?.height && selectedOverlay?.width
    ? (1000 * selectedOverlay.height) / selectedOverlay.width : 750;

  return (
    <>
      {/* Fullscreen polygon drawer */}
      {showDrawer && selectedOverlay && overlayImageUrl && (
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--ds-surface)" }}>
          <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ borderBottom: "1px solid var(--ds-border)" }}>
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-semibold truncate" style={{ color: "var(--ds-text)" }}>
                {selectedOverlay.name} — отметить область
              </h2>
              {drawnPolygons.length > 0 && (
                <span className="text-xs font-medium shrink-0" style={{ color: "var(--ds-accent)" }}>
                  Областей: {drawnPolygons.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setShowDrawer(false)} className="ds-btn px-3 py-1.5 text-sm">
                Готово
              </button>
              <button onClick={() => setShowDrawer(false)} className="ds-icon-btn">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <PolygonDrawer
              imageUrl={overlayImageUrl}
              imageWidth={selectedOverlay.width || 1000}
              imageHeight={selectedOverlay.height || 750}
              existingMasks={existingCellMasks}
              newPolygons={drawnPolygons}
              onRemovePolygon={(index) => onPolygonsChange(drawnPolygons.filter((_, i) => i !== index))}
              getColorKey={getColorKey}
              onComplete={(points) => onPolygonsChange([...drawnPolygons, points])}
              onCancel={() => setShowDrawer(false)}
              fullscreen
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <label className="block text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>
          Отметить область на подложке <span className="font-normal">(необязательно)</span>
        </label>

        {filteredOverlays.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: "var(--ds-text-faint)" }}>
            Нет доступных подложек для выбранного места
          </p>
        ) : (
          <>
            <select
              className="ds-input text-sm"
              value={selOverlayId}
              onChange={(e) => { onOverlayChange(e.target.value); onPolygonsChange([]); }}
            >
              <option value="">Выберите подложку...</option>
              {filteredOverlays.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>

            {selOverlayId && overlayImageUrl && selectedOverlay && (
              <div className="space-y-2">
                {/* Preview */}
                <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--ds-border)" }}>
                  <svg
                    viewBox={`0 0 1000 ${aspectH}`}
                    className="w-full h-auto"
                    style={{ background: "var(--ds-surface-sunken)", maxHeight: "300px" }}
                  >
                    <image href={overlayImageUrl} width={1000} height={aspectH} />
                    {/* Existing cell masks (gray) */}
                    {existingCellMasks.map((m) => (
                      <polygon
                        key={m.id}
                        points={m.polygon_points.map((p) => `${p.x * 1000},${p.y * aspectH}`).join(" ")}
                        fill="rgba(156,163,175,0.2)"
                        stroke="#9ca3af"
                        strokeWidth="1"
                      />
                    ))}
                    {/* Drawn polygons */}
                    {drawnPolygons.map((poly, i) => (
                      <polygon
                        key={`drawn-${i}`}
                        points={poly.map((p) => `${p.x * 1000},${p.y * aspectH}`).join(" ")}
                        fill="rgba(59,130,246,0.25)"
                        stroke="#3b82f6"
                        strokeWidth="2"
                      />
                    ))}
                  </svg>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="ds-btn text-xs px-3 py-1.5 flex items-center gap-1"
                    onClick={() => setShowDrawer(true)}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    {drawnPolygons.length > 0 ? "Редактировать области" : "Нарисовать область"}
                  </button>
                  {drawnPolygons.length > 0 && (
                    <>
                      <span className="text-xs" style={{ color: "var(--ds-accent)" }}>
                        Областей: {drawnPolygons.length}
                      </span>
                      <button
                        className="text-xs"
                        style={{ color: "#ef4444" }}
                        onClick={() => onPolygonsChange([])}
                      >
                        Очистить
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
