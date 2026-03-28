import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getOverlayUrl } from "@/lib/overlayUrlCache";
import type { Overlay, AxisGridAxis } from "@/types";

interface Props {
  overlay: Overlay;
  overlayGridId: string;
  axes: AxisGridAxis[];
  onDone: () => void;
}

interface AxisPoint {
  axis_id: string;
  point1_x: number;
  point1_y: number;
  point2_x: number;
  point2_y: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.2;

export default function AxisAlignmentWizard({ overlay, overlayGridId, axes, onDone }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [firstPoint, setFirstPoint] = useState<{ x: number; y: number } | null>(null);
  const [completedAxes, setCompletedAxes] = useState<AxisPoint[]>([]);
  const [saving, setSaving] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Zoom & pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const aspectW = 1000;
  const aspectH = overlay.height && overlay.width ? (1000 * overlay.height) / overlay.width : 750;

  // Сортируем: сначала вертикальные, потом горизонтальные
  const sortedAxes = [...axes].sort((a, b) => {
    if (a.direction !== b.direction) return a.direction === "vertical" ? -1 : 1;
    return a.sort_order - b.sort_order;
  });

  const currentAxis = sortedAxes[currentStep] || null;
  const isComplete = currentStep >= sortedAxes.length;

  // Загрузить существующие точки
  useEffect(() => {
    loadExistingPoints();
  }, [overlayGridId]);

  async function loadExistingPoints() {
    const { data } = await supabase
      .from("overlay_axis_points")
      .select("*")
      .eq("overlay_grid_id", overlayGridId);
    if (data && data.length > 0) {
      setCompletedAxes(data.map((p) => ({
        axis_id: p.axis_id,
        point1_x: p.point1_x,
        point1_y: p.point1_y,
        point2_x: p.point2_x,
        point2_y: p.point2_y,
      })));
    }
  }

  // Загрузить URL подложки
  useEffect(() => {
    let cancelled = false;
    getOverlayUrl(overlay.storage_path).then((url) => {
      if (!cancelled && url) setImageUrl(url);
    });
    return () => { cancelled = true; };
  }, [overlay.storage_path]);

  const toNormalized = useCallback(
    (e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      const vbW = aspectW / zoom;
      const vbH = aspectH / zoom;
      const absX = pan.x + relX * vbW;
      const absY = pan.y + relY * vbH;
      return {
        x: Math.max(0, Math.min(1, absX / aspectW)),
        y: Math.max(0, Math.min(1, absY / aspectH)),
      };
    },
    [aspectW, aspectH, zoom, pan],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0 || isPanning || isComplete || !currentAxis) return;
      const p = toNormalized(e);
      if (!p) return;

      if (!firstPoint) {
        setFirstPoint(p);
      } else {
        // Завершаем ось
        const existing = completedAxes.findIndex((a) => a.axis_id === currentAxis.id);
        const newPoint: AxisPoint = {
          axis_id: currentAxis.id,
          point1_x: firstPoint.x,
          point1_y: firstPoint.y,
          point2_x: p.x,
          point2_y: p.y,
        };
        if (existing >= 0) {
          setCompletedAxes((prev) => prev.map((a, i) => i === existing ? newPoint : a));
        } else {
          setCompletedAxes((prev) => [...prev, newPoint]);
        }
        setFirstPoint(null);
        setCurrentStep((s) => s + 1);
      }
    },
    [firstPoint, isPanning, isComplete, currentAxis, toNormalized, completedAxes],
  );

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
    },
    [pan],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isPanning && (e.button === 1 || e.button === 0)) setIsPanning(false);
    },
    [isPanning],
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      const oldZoom = zoom;
      const newZoom = e.deltaY < 0
        ? Math.min(MAX_ZOOM, oldZoom * ZOOM_STEP)
        : Math.max(MIN_ZOOM, oldZoom / ZOOM_STEP);
      if (newZoom === oldZoom) return;
      const oldVbW = aspectW / oldZoom;
      const oldVbH = aspectH / oldZoom;
      const newVbW = aspectW / newZoom;
      const newVbH = aspectH / newZoom;
      const cx = pan.x + relX * oldVbW;
      const cy = pan.y + relY * oldVbH;
      setZoom(newZoom);
      setPan({
        x: Math.max(0, Math.min(aspectW - newVbW, cx - relX * newVbW)),
        y: Math.max(0, Math.min(aspectH - newVbH, cy - relY * newVbH)),
      });
    },
    [zoom, pan, aspectW, aspectH],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Escape — отменить текущую точку
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (firstPoint) {
          setFirstPoint(null);
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [firstPoint]);

  async function saveAll() {
    setSaving(true);
    // Удаляем старые точки и вставляем новые
    await supabase.from("overlay_axis_points").delete().eq("overlay_grid_id", overlayGridId);
    if (completedAxes.length > 0) {
      const rows = completedAxes.map((a) => ({
        overlay_grid_id: overlayGridId,
        axis_id: a.axis_id,
        point1_x: a.point1_x,
        point1_y: a.point1_y,
        point2_x: a.point2_x,
        point2_y: a.point2_y,
      }));
      await supabase.from("overlay_axis_points").insert(rows);
    }
    setSaving(false);
    onDone();
  }

  function goToAxis(index: number) {
    setCurrentStep(index);
    setFirstPoint(null);
  }

  if (!imageUrl) {
    return <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка подложки...</div>;
  }

  const vbX = pan.x;
  const vbY = pan.y;
  const vbW = aspectW / zoom;
  const vbH = aspectH / zoom;

  const dirLabel = currentAxis?.direction === "vertical" ? "вертикальная" : "горизонтальная";

  return (
    <div className="ds-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <button onClick={onDone} className="ds-icon-btn">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h3 className="text-sm font-medium" style={{ color: "var(--ds-text)" }}>
            Выравнивание осей — {overlay.name}
          </h3>
          {!isComplete && currentAxis && (
            <p className="text-xs mt-0.5" style={{ color: "var(--ds-text-muted)" }}>
              Ось {currentStep + 1} / {sortedAxes.length}: <strong>{currentAxis.name}</strong> ({dirLabel})
              {firstPoint ? " — укажите 2-ю точку" : " — укажите 1-ю точку"}
            </p>
          )}
          {isComplete && (
            <p className="text-xs mt-0.5" style={{ color: "var(--ds-accent)" }}>
              Все оси выровнены ({completedAxes.length} шт.)
            </p>
          )}
        </div>
        <button
          onClick={saveAll}
          disabled={saving || completedAxes.length === 0}
          className="ds-btn px-3 py-1.5 text-sm"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>

      {/* Подсказка */}
      <div className="flex items-center gap-4 px-4 py-2 text-xs flex-wrap" style={{ color: "var(--ds-text-muted)", borderBottom: "1px solid var(--ds-border)" }}>
        <span><strong>ЛКМ</strong> — точка</span>
        <span><strong>Esc</strong> — отменить точку</span>
        <span><strong>Колёсико</strong> — масштаб</span>
        <span><strong>Shift+ЛКМ</strong> — перемещение</span>
      </div>

      {/* Список осей (навигация) */}
      <div className="flex flex-wrap gap-1 px-4 py-2" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        {sortedAxes.map((axis, i) => {
          const done = completedAxes.some((a) => a.axis_id === axis.id);
          const isCurrent = i === currentStep;
          return (
            <button
              key={axis.id}
              onClick={() => goToAxis(i)}
              className="px-2 py-0.5 rounded text-xs font-medium transition-colors"
              style={{
                background: isCurrent ? "var(--ds-accent)" : done ? "color-mix(in srgb, #22c55e 15%, var(--ds-surface))" : "var(--ds-surface-sunken)",
                color: isCurrent ? "white" : done ? "#22c55e" : "var(--ds-text-faint)",
                border: `1px solid ${isCurrent ? "var(--ds-accent)" : done ? "#22c55e" : "var(--ds-border)"}`,
              }}
              title={`${axis.name} (${axis.direction === "vertical" ? "верт." : "гориз."})${done ? " — выровнена" : ""}`}
            >
              {axis.name}
            </button>
          );
        })}
      </div>

      {/* SVG Canvas */}
      <div ref={containerRef} className="relative">
        {zoom > 1 && (
          <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", color: "var(--ds-text-muted)" }}>
            x{zoom.toFixed(1)}
          </div>
        )}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          <button type="button" onClick={() => {
            const nz = Math.min(MAX_ZOOM, zoom * ZOOM_STEP);
            setZoom(nz);
            setPan((p) => ({ x: Math.max(0, Math.min(aspectW - aspectW / nz, p.x)), y: Math.max(0, Math.min(aspectH - aspectH / nz, p.y)) }));
          }} className="ds-icon-btn w-7 h-7 text-base font-bold" style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)" }}>+</button>
          <button type="button" onClick={() => {
            const nz = Math.max(MIN_ZOOM, zoom / ZOOM_STEP);
            setZoom(nz);
            setPan((p) => ({ x: Math.max(0, Math.min(aspectW - aspectW / nz, p.x)), y: Math.max(0, Math.min(aspectH - aspectH / nz, p.y)) }));
          }} className="ds-icon-btn w-7 h-7 text-base font-bold" style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)" }}>-</button>
          {zoom > 1 && (
            <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="ds-icon-btn w-7 h-7 text-[10px] font-medium" style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)" }}>1:1</button>
          )}
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

          {/* Уже выровненные оси */}
          {completedAxes.map((ap) => {
            const axis = sortedAxes.find((a) => a.id === ap.axis_id);
            if (!axis) return null;
            const x1 = ap.point1_x * aspectW;
            const y1 = ap.point1_y * aspectH;
            const x2 = ap.point2_x * aspectW;
            const y2 = ap.point2_y * aspectH;
            const isCurrent = axis.id === currentAxis?.id;
            const color = axis.direction === "vertical" ? "#3b82f6" : "#f97316";
            return (
              <g key={ap.axis_id}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isCurrent ? "#ef4444" : color}
                  strokeWidth={2 / zoom}
                  opacity={isCurrent ? 1 : 0.7}
                />
                {/* Метка оси */}
                <circle cx={x1} cy={y1} r={4 / zoom} fill={color} stroke="white" strokeWidth={1.5 / zoom} />
                <circle cx={x2} cy={y2} r={4 / zoom} fill={color} stroke="white" strokeWidth={1.5 / zoom} />
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 8 / zoom}
                  textAnchor="middle"
                  fill={isCurrent ? "#ef4444" : color}
                  fontSize={12 / zoom}
                  fontWeight="bold"
                  stroke="white"
                  strokeWidth={3 / zoom}
                  paintOrder="stroke"
                >
                  {axis.name}
                </text>
              </g>
            );
          })}

          {/* Текущая первая точка */}
          {firstPoint && (
            <>
              <circle
                cx={firstPoint.x * aspectW}
                cy={firstPoint.y * aspectH}
                r={6 / zoom}
                fill="#ef4444"
                stroke="white"
                strokeWidth={2 / zoom}
              />
              {cursorPos && (
                <line
                  x1={firstPoint.x * aspectW}
                  y1={firstPoint.y * aspectH}
                  x2={cursorPos.x * aspectW}
                  y2={cursorPos.y * aspectH}
                  stroke="#ef4444"
                  strokeWidth={2 / zoom}
                  strokeDasharray={`${6 / zoom} ${3 / zoom}`}
                />
              )}
            </>
          )}

          {/* Курсор */}
          {cursorPos && !isPanning && (
            <circle
              cx={cursorPos.x * aspectW}
              cy={cursorPos.y * aspectH}
              r={4 / zoom}
              fill="#ef4444"
              stroke="white"
              strokeWidth={2 / zoom}
              opacity="0.8"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
