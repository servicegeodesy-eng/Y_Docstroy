import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/lib/ProjectContext";
import type { Overlay, AxisGrid, AxisGridAxis } from "@/types";
import AxisAlignmentWizard from "./AxisAlignmentWizard";
import AxisTransferWizard from "./AxisTransferWizard";

interface Props {
  overlay: Overlay;
  onBack: () => void;
}

/** Связь overlay↔grid с любой подложки */
interface OverlayGridLink {
  id: string;
  overlay_id: string;
  grid_id: string;
}

export default function OverlayAxisLinker({ overlay, onBack }: Props) {
  const { project } = useProject();
  const [axisGrids, setAxisGrids] = useState<AxisGrid[]>([]);
  const [axisGridAxes, setAxisGridAxes] = useState<AxisGridAxis[]>([]);
  const [links, setLinks] = useState<OverlayGridLink[]>([]);
  /** Все связи overlay↔grid в проекте (для поиска калиброванных подложек) */
  const [allLinks, setAllLinks] = useState<OverlayGridLink[]>([]);
  /** overlay_grid_id, у которых есть калибровочные точки */
  const [calibratedOverlayGridIds, setCalibratedOverlayGridIds] = useState<Set<string>>(new Set());
  /** Подложки проекта (для отображения имени источника) */
  const [allOverlays, setAllOverlays] = useState<Overlay[]>([]);

  const [calibratingGridId, setCalibratingGridId] = useState<string | null>(null);
  const [calibratingOverlayGridId, setCalibratingOverlayGridId] = useState<string | null>(null);

  // Перенос с другой подложки
  const [transferSourceOverlay, setTransferSourceOverlay] = useState<Overlay | null>(null);
  const [transferSourceOGId, setTransferSourceOGId] = useState<string | null>(null);
  const [transferTargetOGId, setTransferTargetOGId] = useState<string | null>(null);
  const [showSourcePicker, setShowSourcePicker] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [project, overlay.id]);

  async function loadData() {
    if (!project) return;
    const [gRes, aRes, lRes, allLRes, oRes] = await Promise.all([
      supabase.from("dict_axis_grids").select("*").eq("project_id", project.id).order("sort_order"),
      supabase.from("dict_axis_grid_axes").select("*").order("sort_order"),
      supabase.from("dict_overlay_axis_grids").select("id, overlay_id, grid_id").eq("overlay_id", overlay.id),
      supabase.from("dict_overlay_axis_grids").select("id, overlay_id, grid_id"),
      supabase.from("dict_overlays").select("*").eq("project_id", project.id).order("sort_order"),
    ]);
    setAxisGrids(gRes.data || []);
    setAxisGridAxes(aRes.data || []);
    setLinks(lRes.data || []);
    setAllLinks(allLRes.data || []);
    setAllOverlays(oRes.data || []);

    // Проверить какие overlay_grid имеют калибровочные точки
    if (allLRes.data && allLRes.data.length > 0) {
      const ids = allLRes.data.map((l: { id: string }) => l.id);
      const { data: pts } = await supabase
        .from("overlay_axis_points")
        .select("overlay_grid_id")
        .in("overlay_grid_id", ids);
      const calibrated = new Set<string>();
      if (pts) pts.forEach((p: { overlay_grid_id: string }) => calibrated.add(p.overlay_grid_id));
      setCalibratedOverlayGridIds(calibrated);
    }
  }

  async function toggleLink(gridId: string) {
    const existing = links.find((l) => l.grid_id === gridId);
    if (existing) {
      await supabase.from("dict_overlay_axis_grids").delete().eq("id", existing.id);
    } else {
      await supabase.from("dict_overlay_axis_grids").insert({ overlay_id: overlay.id, grid_id: gridId });
    }
    loadData();
  }

  function startCalibration(gridId: string) {
    const link = links.find((l) => l.grid_id === gridId);
    if (!link) return;
    setCalibratingGridId(gridId);
    setCalibratingOverlayGridId(link.id);
  }

  /** Подложки, на которых эта сетка уже откалибрована (кроме текущей) */
  function getCalibratedSources(gridId: string): { overlay: Overlay; overlayGridId: string }[] {
    return allLinks
      .filter((l) => l.grid_id === gridId && l.overlay_id !== overlay.id && calibratedOverlayGridIds.has(l.id))
      .map((l) => ({
        overlay: allOverlays.find((o) => o.id === l.overlay_id)!,
        overlayGridId: l.id,
      }))
      .filter((s) => s.overlay);
  }

  function startTransfer(gridId: string, sourceOverlay: Overlay, sourceOGId: string) {
    const targetLink = links.find((l) => l.grid_id === gridId);
    if (!targetLink) return;
    setTransferSourceOverlay(sourceOverlay);
    setTransferSourceOGId(sourceOGId);
    setTransferTargetOGId(targetLink.id);
    setShowSourcePicker(null);
  }

  // Мастер поосного выравнивания
  if (calibratingGridId && calibratingOverlayGridId) {
    const gridAxes = axisGridAxes.filter((a) => a.grid_id === calibratingGridId);
    return (
      <AxisAlignmentWizard
        overlay={overlay}
        overlayGridId={calibratingOverlayGridId}
        axes={gridAxes}
        onDone={() => { setCalibratingGridId(null); setCalibratingOverlayGridId(null); loadData(); }}
      />
    );
  }

  // Мастер переноса по 3 точкам
  if (transferSourceOverlay && transferSourceOGId && transferTargetOGId) {
    return (
      <AxisTransferWizard
        sourceOverlay={transferSourceOverlay}
        targetOverlay={overlay}
        targetOverlayGridId={transferTargetOGId}
        sourceOverlayGridId={transferSourceOGId}
        onDone={() => {
          setTransferSourceOverlay(null);
          setTransferSourceOGId(null); setTransferTargetOGId(null);
          loadData();
        }}
      />
    );
  }

  const linkedGridIds = new Set(links.map((l) => l.grid_id));

  return (
    <div className="ds-card">
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <button onClick={onBack} className="ds-icon-btn">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h3 className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>Сетки осей — {overlay.name}</h3>
          <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>Выберите сетки и настройте выравнивание</p>
        </div>
      </div>
      {axisGrids.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>
          Сетки осей не созданы. Создайте их в справочнике «Сетки осей».
        </div>
      ) : (
        <ul>
          {axisGrids.map((grid, idx) => {
            const linked = linkedGridIds.has(grid.id);
            const gridAxesCount = axisGridAxes.filter((a) => a.grid_id === grid.id).length;
            const sources = linked ? getCalibratedSources(grid.id) : [];
            return (
              <li
                key={grid.id}
                className="px-4 py-2.5"
                style={{ borderBottom: idx < axisGrids.length - 1 ? "1px solid var(--ds-border)" : "none" }}
              >
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={linked}
                      onChange={() => toggleLink(grid.id)}
                      className="rounded"
                    />
                    <span className="text-sm" style={{ color: "var(--ds-text)" }}>{grid.name}</span>
                    <span className="text-xs" style={{ color: "var(--ds-text-faint)" }}>({gridAxesCount} осей)</span>
                  </label>
                  {linked && gridAxesCount > 0 && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => startCalibration(grid.id)}
                        className="ds-btn !px-3 !py-1 text-xs"
                      >
                        Выровнять
                      </button>
                      {sources.length > 0 && (
                        <button
                          onClick={() => setShowSourcePicker(showSourcePicker === grid.id ? null : grid.id)}
                          className="ds-btn-secondary !px-3 !py-1 text-xs"
                          title="Перенести с другой подложки по 3 точкам"
                        >
                          Перенести
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {/* Выбор подложки-источника */}
                {showSourcePicker === grid.id && sources.length > 0 && (
                  <div className="mt-2 ml-6 p-2 rounded" style={{ background: "var(--ds-surface-sunken)", border: "1px solid var(--ds-border)" }}>
                    <p className="text-xs mb-1.5" style={{ color: "var(--ds-text-muted)" }}>Перенести оси с подложки:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sources.map((s) => (
                        <button
                          key={s.overlayGridId}
                          onClick={() => startTransfer(grid.id, s.overlay, s.overlayGridId)}
                          className="ds-btn-secondary !px-2 !py-0.5 text-xs"
                        >
                          {s.overlay.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
