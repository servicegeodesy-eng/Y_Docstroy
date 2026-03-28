import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getOverlayUrl } from "@/lib/overlayUrlCache";
import { useAuth } from "@/lib/AuthContext";
import { useProject } from "@/lib/ProjectContext";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { useOverlays } from "@/hooks/useOverlays";
import { useCellMasks } from "@/hooks/useCellMasks";
import { useDictLinks } from "@/hooks/useDictLinks";
import { getColorPreset } from "@/constants/colorPalette";
import StatusHatchPatterns from "@/components/plan/svgPatterns";
import PolygonDrawer from "@/components/plan/PolygonDrawer";
import type { Point } from "@/components/plan/SnapEngine";
import type { CellOverlayMask, Overlay } from "@/types";

interface Props {
  cellId: string;
  cellStatus: string;
  buildingId: string | null;
  workTypeId: string | null;
  floorId: string | null;
  constructionId: string | null;
  signatures: { status: string }[];
  isLocked: boolean;
  canModifyFiles?: boolean;
  canEditMaskProp?: boolean;
  miniature?: boolean;
  /** Принудительный цвет маски (для заявок и т.д.) */
  colorKeyOverride?: string;
  onUpdated: () => void;
}

const SIGNED_STATUSES = ["Подписано", "Подписано с замечанием", "Согласовано", "Ознакомлен"];

export default function CellMaskSection({
  cellId, cellStatus, buildingId, workTypeId, floorId, constructionId,
  signatures, isLocked, canModifyFiles = true, canEditMaskProp, miniature, colorKeyOverride, onUpdated,
}: Props) {
  const { user } = useAuth();
  const { hasPermission } = useProject();
  const { getColorKey } = useProjectStatuses();

  const [cellMasks, setCellMasks] = useState<CellOverlayMask[]>([]);
  const [maskOverlayId, setMaskOverlayId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editedPolygons, setEditedPolygons] = useState<Point[][]>([]);

  // Загрузка существующих масок ячейки
  useEffect(() => {
    loadCellMasks();
  }, [cellId]);

  async function loadCellMasks() {
    const { data } = await supabase
      .from("cell_overlay_masks")
      .select("*")
      .eq("cell_id", cellId);
    if (data && data.length > 0) {
      setCellMasks(data as CellOverlayMask[]);
      setMaskOverlayId(data[0].overlay_id);
    } else {
      setCellMasks([]);
      setMaskOverlayId(null);
    }
  }

  // Поиск подложки по справочникам (если масок нет)
  const {
    overlays: allOverlays,
    overlayBuildings, overlayFloors: overlayFloorLinks,
    overlayConstructions: overlayConstructionLinks,
  } = useOverlays();
  const { workTypeOverlays } = useDictLinks();

  const overlayWorkTypeMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [wtId, oIds] of Object.entries(workTypeOverlays)) {
      for (const oId of oIds) {
        if (!map[oId]) map[oId] = [];
        map[oId].push(wtId);
      }
    }
    return map;
  }, [workTypeOverlays]);

  const matchedOverlay = useMemo((): Overlay | null => {
    if (maskOverlayId) {
      return allOverlays.find((o) => o.id === maskOverlayId) || null;
    }
    // Подбор по справочникам ячейки
    for (const overlay of allOverlays) {
      const hasWt = (overlayWorkTypeMap[overlay.id]?.length || 0) > 0;
      const hasBld = (overlayBuildings[overlay.id]?.length || 0) > 0;
      const hasFlr = (overlayFloorLinks[overlay.id]?.length || 0) > 0;
      const hasCon = (overlayConstructionLinks[overlay.id]?.length || 0) > 0;
      if (!hasWt && !hasBld && !hasFlr && !hasCon) continue;
      if (hasWt && (!workTypeId || !overlayWorkTypeMap[overlay.id].includes(workTypeId))) continue;
      if (hasBld && (!buildingId || !overlayBuildings[overlay.id].includes(buildingId))) continue;
      if (hasFlr && (!floorId || !overlayFloorLinks[overlay.id].includes(floorId))) continue;
      if (hasCon && (!constructionId || !overlayConstructionLinks[overlay.id].includes(constructionId))) continue;
      return overlay;
    }
    return null;
  }, [maskOverlayId, allOverlays, buildingId, workTypeId, floorId, constructionId,
    overlayWorkTypeMap, overlayBuildings, overlayFloorLinks, overlayConstructionLinks]);

  // URL изображения подложки
  const [overlayImageUrl, setOverlayImageUrl] = useState<string | null>(null);
  const [prevOverlayId, setPrevOverlayId] = useState<string | null>(null);

  useEffect(() => {
    if (!matchedOverlay) {
      setOverlayImageUrl(null);
      setPrevOverlayId(null);
      return;
    }
    if (matchedOverlay.id === prevOverlayId) return;
    setPrevOverlayId(matchedOverlay.id);
    getOverlayUrl(matchedOverlay.storage_path).then((url) => {
      if (url) setOverlayImageUrl(url);
    });
  }, [matchedOverlay]);

  // Все маски на подложке (соседние ячейки — для редактора)
  const { masks: allOverlayMasks } = useCellMasks(matchedOverlay?.id || null);
  const otherMasks = useMemo(
    () => allOverlayMasks.filter((m) => m.cell_id !== cellId),
    [allOverlayMasks, cellId],
  );

  const hasSigned = signatures.some((s) => SIGNED_STATUSES.includes(s.status));
  const canEditMask = canEditMaskProp !== undefined ? canEditMaskProp : (!hasSigned && !isLocked && canModifyFiles && hasPermission("can_edit_cell"));

  function openEditor() {
    setEditedPolygons(cellMasks.map((m) => m.polygon_points));
    setShowEditor(true);
  }

  async function saveMaskChanges() {
    if (!matchedOverlay) return;
    await supabase.from("cell_overlay_masks").delete().eq("cell_id", cellId);
    if (editedPolygons.length > 0) {
      const rows = editedPolygons.map((polygon) => ({
        cell_id: cellId,
        overlay_id: matchedOverlay.id,
        polygon_points: polygon,
      }));
      await supabase.from("cell_overlay_masks").insert(rows);
    }
    if (user) {
      await supabase.from("cell_history").insert({
        cell_id: cellId, user_id: user.id,
        action: cellMasks.length > 0 ? "mask_edited" : "mask_created",
      });
    }
    setShowEditor(false);
    loadCellMasks();
    onUpdated();
  }

  if (!matchedOverlay || !overlayImageUrl) return null;

  const aspectW = 1000;
  const aspectH = matchedOverlay.height && matchedOverlay.width
    ? (1000 * matchedOverlay.height) / matchedOverlay.width : 750;
  const colorKey = colorKeyOverride || getColorKey(cellStatus);
  const preset = getColorPreset(colorKey);
  const hasMasks = cellMasks.length > 0;

  return (
    <>
      <div>
        <div className="flex items-center flex-wrap gap-3 mb-2">
          <h4 className="text-sm font-medium flex items-center gap-1.5" style={{ color: "var(--ds-text-muted)" }}>
            <svg className="w-4 h-4" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Подложка: {matchedOverlay.name}
          </h4>
          {canEditMask && (
            <button
              onClick={openEditor}
              className="ds-btn-secondary px-2.5 py-1 text-xs flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              {hasMasks ? "Редактировать область" : "Отметить области"}
            </button>
          )}
          {hasSigned && hasMasks && (
            <span className="text-xs flex items-center gap-1" style={{ color: "var(--ds-text-faint)" }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Маска заблокирована (есть подписи)
            </span>
          )}
        </div>
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--ds-border)", maxWidth: miniature ? "83%" : undefined }}>
          <svg viewBox={`0 0 ${aspectW} ${aspectH}`} className="w-full h-auto" style={{ background: "var(--ds-surface-sunken)" }}>
            <StatusHatchPatterns />
            <image href={overlayImageUrl} width={aspectW} height={aspectH} />
            {cellMasks.map((mask) => (
              <polygon
                key={mask.id}
                points={mask.polygon_points.map((p) => `${p.x * aspectW},${p.y * aspectH}`).join(" ")}
                fill={`url(#hatch-${colorKey})`}
                stroke={preset.bg}
                strokeWidth="2"
                opacity="0.7"
              />
            ))}
          </svg>
        </div>
        {!hasMasks && canEditMask && (
          <p className="text-xs mt-1.5" style={{ color: "var(--ds-text-faint)" }}>
            Области на подложке не отмечены. Нажмите «Отметить области», чтобы добавить маску.
          </p>
        )}
      </div>

      {/* Редактор маски — полноэкранный */}
      {showEditor && (
        <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--ds-surface)" }} onClick={(e) => e.stopPropagation()}>
          {/* Хедер с кнопками */}
          <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ borderBottom: "1px solid var(--ds-border)" }}>
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-semibold truncate" style={{ color: "var(--ds-text)" }}>
                {matchedOverlay.name}
              </h2>
              {editedPolygons.length > 0 && (
                <span className="text-xs font-medium shrink-0" style={{ color: "var(--ds-accent)" }}>
                  Областей: {editedPolygons.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={saveMaskChanges}
                className="ds-btn px-3 py-1.5 text-sm"
              >
                Сохранить
              </button>
              <button
                onClick={() => setShowEditor(false)}
                className="ds-icon-btn"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          {/* Подложка на весь оставшийся экран */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <PolygonDrawer
              imageUrl={overlayImageUrl}
              imageWidth={matchedOverlay.width || 1000}
              imageHeight={matchedOverlay.height || 750}
              existingMasks={otherMasks}
              newPolygons={editedPolygons}
              onRemovePolygon={(index) => setEditedPolygons((prev) => prev.filter((_, i) => i !== index))}
              getColorKey={getColorKey}
              onComplete={(points) => setEditedPolygons((prev) => [...prev, points])}
              onCancel={() => setShowEditor(false)}
              fullscreen
            />
          </div>
        </div>
      )}
    </>
  );
}
