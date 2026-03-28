import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getOverlayUrl } from "@/lib/overlayUrlCache";
import { computeAffine, applyAffine } from "@/lib/affineTransform";
import type { Overlay } from "@/types";

interface SourceAxisPoint {
  axis_id: string;
  axis_name: string;
  direction: string;
  point1_x: number;
  point1_y: number;
  point2_x: number;
  point2_y: number;
}

interface Props {
  sourceOverlay: Overlay;
  targetOverlay: Overlay;
  targetOverlayGridId: string;
  sourceOverlayGridId: string;
  onDone: () => void;
}

type Phase = 'source' | 'target';

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.2;

export default function AxisTransferWizard({
  sourceOverlay,
  targetOverlay,
  targetOverlayGridId,
  sourceOverlayGridId,
  onDone,
}: Props) {
  const [sourceAxes, setSourceAxes] = useState<SourceAxisPoint[]>([]);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [targetImageUrl, setTargetImageUrl] = useState<string | null>(null);

  // Фаза: сначала 3 клика на источнике, потом 3 на целевой
  const [phase, setPhase] = useState<Phase>('source');
  const [sourcePoints, setSourcePoints] = useState<{ x: number; y: number }[]>([]);
  const [targetPoints, setTargetPoints] = useState<{ x: number; y: number }[]>([]);

  const [saving, setSaving] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [previewAxes, setPreviewAxes] = useState<SourceAxisPoint[] | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOverlay = phase === 'source' ? sourceOverlay : targetOverlay;
  const aspectW = 1000;
  const aspectH = currentOverlay.height && currentOverlay.width
    ? (1000 * currentOverlay.height) / currentOverlay.width : 750;

  useEffect(() => { loadSourceData(); }, [sourceOverlayGridId]);

  async function loadSourceData() {
    const { data: points } = await supabase
      .from("overlay_axis_points")
      .select("axis_id, point1_x, point1_y, point2_x, point2_y, dict_axis_grid_axes(name, direction)")
      .eq("overlay_grid_id", sourceOverlayGridId);
    if (!points || points.length === 0) return;
    setSourceAxes((points as unknown as { axis_id: string; point1_x: number; point1_y: number; point2_x: number; point2_y: number; dict_axis_grid_axes: { name: string; direction: string } | null }[]).map((p) => ({
      axis_id: p.axis_id,
      axis_name: p.dict_axis_grid_axes?.name || "?",
      direction: p.dict_axis_grid_axes?.direction || "vertical",
      point1_x: p.point1_x, point1_y: p.point1_y,
      point2_x: p.point2_x, point2_y: p.point2_y,
    })));
  }

  useEffect(() => {
    let cancelled = false;
    getOverlayUrl(sourceOverlay.storage_path).then((url) => { if (!cancelled && url) setSourceImageUrl(url); });
    getOverlayUrl(targetOverlay.storage_path).then((url) => { if (!cancelled && url) setTargetImageUrl(url); });
    return () => { cancelled = true; };
  }, [sourceOverlay.storage_path, targetOverlay.storage_path]);

  const imageUrl = phase === 'source' ? sourceImageUrl : targetImageUrl;
  const currentPoints = phase === 'source' ? sourcePoints : targetPoints;
  const currentCount = currentPoints.length;

  const toNormalized = useCallback(
    (e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      const vbW = aspectW / zoom;
      const vbH = aspectH / zoom;
      return {
        x: Math.max(0, Math.min(1, (pan.x + relX * vbW) / aspectW)),
        y: Math.max(0, Math.min(1, (pan.y + relY * vbH) / aspectH)),
      };
    },
    [aspectW, aspectH, zoom, pan],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0 || isPanning || currentCount >= 3) return;
      const p = toNormalized(e);
      if (!p) return;

      if (phase === 'source') {
        const newPts = [...sourcePoints, p];
        setSourcePoints(newPts);
        if (newPts.length === 3) {
          // Переход к фазе target
          setPhase('target');
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }
      } else {
        const newPts = [...targetPoints, p];
        setTargetPoints(newPts);
        if (newPts.length === 3) {
          computePreview(sourcePoints, newPts);
        }
      }
    },
    [isPanning, currentCount, toNormalized, phase, sourcePoints, targetPoints],
  );

  function computePreview(srcPts: { x: number; y: number }[], tgtPts: { x: number; y: number }[]) {
    const matrix = computeAffine(
      [srcPts[0], srcPts[1], srcPts[2]] as [any, any, any],
      [tgtPts[0], tgtPts[1], tgtPts[2]] as [any, any, any],
    );
    setPreviewAxes(sourceAxes.map((axis) => ({
      ...axis,
      point1_x: applyAffine(matrix, { x: axis.point1_x, y: axis.point1_y }).x,
      point1_y: applyAffine(matrix, { x: axis.point1_x, y: axis.point1_y }).y,
      point2_x: applyAffine(matrix, { x: axis.point2_x, y: axis.point2_y }).x,
      point2_y: applyAffine(matrix, { x: axis.point2_x, y: axis.point2_y }).y,
    })));
  }

  async function saveTransfer() {
    if (!previewAxes) return;
    setSaving(true);
    await supabase.from("overlay_axis_points").delete().eq("overlay_grid_id", targetOverlayGridId);
    await supabase.from("overlay_axis_points").insert(previewAxes.map((a) => ({
      overlay_grid_id: targetOverlayGridId,
      axis_id: a.axis_id,
      point1_x: a.point1_x, point1_y: a.point1_y,
      point2_x: a.point2_x, point2_y: a.point2_y,
    })));
    setSaving(false);
    onDone();
  }

  function reset() {
    setSourcePoints([]);
    setTargetPoints([]);
    setPhase('source');
    setPreviewAxes(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isPanning) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const scaleX = (aspectW / zoom) / rect.width;
        const scaleY = (aspectH / zoom) / rect.height;
        setPan({
          x: Math.max(0, Math.min(aspectW - aspectW / zoom, panStart.current.panX - dx * scaleX)),
          y: Math.max(0, Math.min(aspectH - aspectH / zoom, panStart.current.panY - dy * scaleY)),
        });
        return;
      }
      const p = toNormalized(e);
      if (p) setCursorPos(p);
    },
    [toNormalized, isPanning, zoom, aspectW, aspectH],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        e.preventDefault();
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      }
    }, [pan]);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isPanning && (e.button === 1 || e.button === 0)) setIsPanning(false);
    }, [isPanning]);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      const oldZoom = zoom;
      const newZoom = e.deltaY < 0 ? Math.min(MAX_ZOOM, oldZoom * ZOOM_STEP) : Math.max(MIN_ZOOM, oldZoom / ZOOM_STEP);
      if (newZoom === oldZoom) return;
      const cx = pan.x + relX * (aspectW / oldZoom);
      const cy = pan.y + relY * (aspectH / oldZoom);
      setZoom(newZoom);
      setPan({
        x: Math.max(0, Math.min(aspectW - aspectW / newZoom, cx - relX * (aspectW / newZoom))),
        y: Math.max(0, Math.min(aspectH - aspectH / newZoom, cy - relY * (aspectH / newZoom))),
      });
    }, [zoom, pan, aspectW, aspectH]);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    c.addEventListener("wheel", handleWheel, { passive: false });
    return () => c.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") reset();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (!imageUrl) {
    return <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</div>;
  }

  const vbX = pan.x, vbY = pan.y, vbW = aspectW / zoom, vbH = aspectH / zoom;
  const REF_COLORS = ["#ef4444", "#22c55e", "#3b82f6"];

  const phaseLabel = phase === 'source'
    ? `Шаг 1/2: Укажите 3 реперные точки на подложке-источнике (${sourceOverlay.name}) — точка ${currentCount + 1}/3`
    : previewAxes
      ? "Превью готово — проверьте и сохраните"
      : `Шаг 2/2: Укажите те же 3 точки на целевой подложке (${targetOverlay.name}) — точка ${currentCount + 1}/3`;

  return (
    <div className="ds-card">
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <button onClick={onDone} className="ds-icon-btn">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h3 className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>
            Перенос сетки: {sourceOverlay.name} → {targetOverlay.name}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--ds-text-muted)" }}>{phaseLabel}</p>
        </div>
        <div className="flex gap-2">
          {(sourcePoints.length > 0 || targetPoints.length > 0) && (
            <button onClick={reset} className="ds-btn-secondary px-3 py-1.5 text-sm">Сбросить</button>
          )}
          <button onClick={saveTransfer} disabled={saving || !previewAxes} className="ds-btn px-3 py-1.5 text-sm">
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>

      {/* Индикатор точек */}
      <div className="px-4 py-2 flex items-center gap-4 text-xs" style={{ borderBottom: "1px solid var(--ds-border)", color: "var(--ds-text-muted)" }}>
        {[0, 1, 2].map((i) => {
          const srcDone = sourcePoints.length > i;
          const tgtDone = targetPoints.length > i;
          return (
            <span key={i} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full border-2"
                style={{ background: (srcDone || tgtDone) ? REF_COLORS[i] : "transparent", borderColor: REF_COLORS[i] }} />
              <strong style={{ color: REF_COLORS[i] }}>Т{i + 1}</strong>
              {srcDone && <span style={{ color: "#22c55e" }}>src✓</span>}
              {tgtDone && <span style={{ color: "#22c55e" }}>tgt✓</span>}
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-4 px-4 py-1.5 text-xs flex-wrap" style={{ color: "var(--ds-text-muted)", borderBottom: "1px solid var(--ds-border)" }}>
        <span><strong>ЛКМ</strong> — точка (на пересечении осей)</span>
        <span><strong>Esc</strong> — сбросить</span>
        <span><strong>Колёсико</strong> — масштаб</span>
        <span><strong>Shift+ЛКМ</strong> — перемещение</span>
      </div>

      <div ref={containerRef} className="relative">
        {zoom > 1 && (
          <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", color: "var(--ds-text-muted)" }}>
            x{zoom.toFixed(1)}
          </div>
        )}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          <ZoomBtn label="+" onClick={() => { const nz = Math.min(MAX_ZOOM, zoom * ZOOM_STEP); setZoom(nz); setPan((p) => ({ x: Math.max(0, Math.min(aspectW - aspectW / nz, p.x)), y: Math.max(0, Math.min(aspectH - aspectH / nz, p.y)) })); }} />
          <ZoomBtn label="-" onClick={() => { const nz = Math.max(MIN_ZOOM, zoom / ZOOM_STEP); setZoom(nz); setPan((p) => ({ x: Math.max(0, Math.min(aspectW - aspectW / nz, p.x)), y: Math.max(0, Math.min(aspectH - aspectH / nz, p.y)) })); }} />
          {zoom > 1 && <ZoomBtn label="1:1" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} small />}
        </div>

        <svg
          ref={svgRef}
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          className={`w-full h-auto ${isPanning ? "cursor-grabbing" : "cursor-crosshair"}`}
          style={{ border: "1px solid var(--ds-border)", background: "var(--ds-surface-sunken)" }}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { if (isPanning) setIsPanning(false); setCursorPos(null); }}
        >
          <image href={imageUrl} width={aspectW} height={aspectH} />

          {/* Оси-источники (только на фазе source) */}
          {phase === 'source' && sourceAxes.map((a) => {
            const color = a.direction === "vertical" ? "#3b82f6" : "#f97316";
            return (
              <g key={a.axis_id}>
                <line x1={a.point1_x * aspectW} y1={a.point1_y * aspectH}
                  x2={a.point2_x * aspectW} y2={a.point2_y * aspectH}
                  stroke={color} strokeWidth={2 / zoom} opacity={0.6} />
                <text x={(a.point1_x + a.point2_x) / 2 * aspectW}
                  y={(a.point1_y + a.point2_y) / 2 * aspectH - 8 / zoom}
                  textAnchor="middle" fill={color} fontSize={11 / zoom} fontWeight="bold"
                  stroke="white" strokeWidth={3 / zoom} paintOrder="stroke">
                  {a.axis_name}
                </text>
              </g>
            );
          })}

          {/* Превью перенесённых осей (фаза target, после 3 точек) */}
          {phase === 'target' && previewAxes?.map((a) => {
            const color = a.direction === "vertical" ? "#3b82f6" : "#f97316";
            return (
              <g key={a.axis_id}>
                <line x1={a.point1_x * aspectW} y1={a.point1_y * aspectH}
                  x2={a.point2_x * aspectW} y2={a.point2_y * aspectH}
                  stroke={color} strokeWidth={2 / zoom} opacity={0.8} />
                <text x={(a.point1_x + a.point2_x) / 2 * aspectW}
                  y={(a.point1_y + a.point2_y) / 2 * aspectH - 8 / zoom}
                  textAnchor="middle" fill={color} fontSize={12 / zoom} fontWeight="bold"
                  stroke="white" strokeWidth={3 / zoom} paintOrder="stroke">
                  {a.axis_name}
                </text>
              </g>
            );
          })}

          {/* Указанные точки */}
          {currentPoints.map((p, i) => (
            <g key={i}>
              <circle cx={p.x * aspectW} cy={p.y * aspectH} r={8 / zoom}
                fill={REF_COLORS[i]} stroke="white" strokeWidth={2 / zoom} />
              <text x={p.x * aspectW} y={p.y * aspectH} textAnchor="middle" dominantBaseline="central"
                fill="white" fontSize={10 / zoom} fontWeight="bold">{i + 1}</text>
            </g>
          ))}

          {/* Курсор */}
          {cursorPos && !isPanning && currentCount < 3 && (
            <circle cx={cursorPos.x * aspectW} cy={cursorPos.y * aspectH}
              r={5 / zoom} fill={REF_COLORS[currentCount]} stroke="white" strokeWidth={2 / zoom} opacity={0.8} />
          )}
        </svg>
      </div>
    </div>
  );
}

function ZoomBtn({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`ds-icon-btn w-7 h-7 ${small ? "text-[10px]" : "text-base"} font-bold`}
      style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)" }}>
      {label}
    </button>
  );
}
