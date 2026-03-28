import { useCallback, useEffect, useRef, useState } from "react";
import type { Point } from "./SnapEngine";
import { findSnap, calcThreshold } from "./SnapEngine";
import StatusHatchPatterns from "./svgPatterns";
import { getColorPreset } from "@/constants/colorPalette";
import type { MaskWithCell } from "@/hooks/useCellMasks";

interface Props {
  /** URL изображения подложки */
  imageUrl: string;
  /** Ширина/высота изображения для пропорций */
  imageWidth: number;
  imageHeight: number;
  /** Существующие маски для отображения и привязки */
  existingMasks: MaskWithCell[];
  /** Уже нарисованные новые полигоны (ещё не сохранены) */
  newPolygons?: Point[][];
  /** Колбэк удаления нарисованного полигона по индексу */
  onRemovePolygon?: (index: number) => void;
  /** Маппинг статус → цветовой ключ */
  getColorKey: (status: string) => string;
  /** Колбэк при завершении рисования одного полигона */
  onComplete: (points: Point[]) => void;
  /** Колбэк при отмене */
  onCancel: () => void;
  /** Полноэкранный режим: SVG вписывается в контейнер, кнопки снизу убраны */
  fullscreen?: boolean;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.2;

export default function PolygonDrawer({
  imageUrl,
  imageWidth,
  imageHeight,
  existingMasks,
  newPolygons = [],
  onRemovePolygon,
  getColorKey,
  onComplete,
  onCancel,
  fullscreen,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [cursorPos, setCursorPos] = useState<Point | null>(null);
  const [snappedPos, setSnappedPos] = useState<Point | null>(null);
  const [isSnapped, setIsSnapped] = useState(false);
  const [snapType, setSnapType] = useState<"vertex" | "edge" | "none">("none");

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const aspectW = 1000;
  const aspectH = imageHeight > 0 ? (1000 * imageHeight) / imageWidth : 750;

  const existingPolygons = [
    ...existingMasks.map((m) => m.polygon_points),
    ...newPolygons,
  ];

  /** Преобразовать координаты мыши → нормализованные 0-1 с учётом zoom/pan */
  const toNormalized = useCallback(
    (e: React.MouseEvent<SVGSVGElement>): Point | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      // Position relative to SVG element
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      // Account for viewBox transform (pan + zoom)
      const vbW = aspectW / zoom;
      const vbH = aspectH / zoom;
      const vbX = pan.x;
      const vbY = pan.y;
      const absX = vbX + relX * vbW;
      const absY = vbY + relY * vbH;
      const x = absX / aspectW;
      const y = absY / aspectH;
      return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    },
    [aspectW, aspectH, zoom, pan],
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
      if (!p) return;
      setCursorPos(p);

      const svg = svgRef.current;
      const containerWidth = svg?.getBoundingClientRect().width || 800;
      const threshold = calcThreshold(containerWidth) / zoom;

      const snap = findSnap(p, existingPolygons, threshold);
      setSnappedPos(snap.point);
      setIsSnapped(snap.snapped);
      setSnapType(snap.type);
    },
    [toNormalized, existingPolygons, isPanning, zoom, aspectW, aspectH],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0 || isPanning) return;
      const p = snappedPos || cursorPos;
      if (!p) return;

      if (points.length >= 3) {
        const first = points[0];
        const d = Math.sqrt((p.x - first.x) ** 2 + (p.y - first.y) ** 2);
        if (d < calcThreshold(svgRef.current?.getBoundingClientRect().width || 800) / zoom) {
          onComplete(points);
          setPoints([]);
          return;
        }
      }

      setPoints((prev) => [...prev, { x: p.x, y: p.y }]);
    },
    [snappedPos, cursorPos, points, onComplete, isPanning, zoom],
  );

  const handleDoubleClick = useCallback(() => {
    if (points.length >= 3) {
      onComplete(points);
      setPoints([]);
    }
  }, [points, onComplete]);

  const handleRightClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (points.length > 0) {
        setPoints((prev) => prev.slice(0, -1));
      } else {
        onCancel();
      }
    },
    [points.length, onCancel],
  );

  // Middle mouse button panning
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
      if (isPanning && (e.button === 1 || e.button === 0)) {
        setIsPanning(false);
      }
    },
    [isPanning],
  );

  // Zoom with wheel
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();

      // Mouse position relative to SVG
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;

      const oldZoom = zoom;
      const newZoom = e.deltaY < 0
        ? Math.min(MAX_ZOOM, oldZoom * ZOOM_STEP)
        : Math.max(MIN_ZOOM, oldZoom / ZOOM_STEP);

      if (newZoom === oldZoom) return;

      // Zoom towards cursor position
      const oldVbW = aspectW / oldZoom;
      const oldVbH = aspectH / oldZoom;
      const newVbW = aspectW / newZoom;
      const newVbH = aspectH / newZoom;

      const cursorAbsX = pan.x + relX * oldVbW;
      const cursorAbsY = pan.y + relY * oldVbH;

      const newPanX = cursorAbsX - relX * newVbW;
      const newPanY = cursorAbsY - relY * newVbH;

      setZoom(newZoom);
      setPan({
        x: Math.max(0, Math.min(aspectW - newVbW, newPanX)),
        y: Math.max(0, Math.min(aspectH - newVbH, newPanY)),
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

  // Escape для отмены
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (points.length > 0) {
          setPoints([]);
        } else {
          onCancel();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [points.length, onCancel]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => {
      const nz = Math.min(MAX_ZOOM, z * ZOOM_STEP);
      const vbW = aspectW / nz;
      const vbH = aspectH / nz;
      setPan((p) => ({
        x: Math.max(0, Math.min(aspectW - vbW, p.x + (aspectW / z - vbW) / 2)),
        y: Math.max(0, Math.min(aspectH - vbH, p.y + (aspectH / z - vbH) / 2)),
      }));
      return nz;
    });
  }, [aspectW, aspectH]);

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const nz = Math.max(MIN_ZOOM, z / ZOOM_STEP);
      const vbW = aspectW / nz;
      const vbH = aspectH / nz;
      setPan((p) => ({
        x: Math.max(0, Math.min(aspectW - vbW, p.x + (aspectW / z - vbW) / 2)),
        y: Math.max(0, Math.min(aspectH - vbH, p.y + (aspectH / z - vbH) / 2)),
      }));
      return nz;
    });
  }, [aspectW, aspectH]);

  const displayPoint = (p: Point) => `${p.x * aspectW},${p.y * aspectH}`;
  const activePos = snappedPos || cursorPos;

  const vbX = pan.x;
  const vbY = pan.y;
  const vbW = aspectW / zoom;
  const vbH = aspectH / zoom;

  return (
    <div className={fullscreen ? "flex flex-col h-full" : ""}>
      {/* Подсказка — над подложкой */}
      {!fullscreen && (
        <div className="flex items-center gap-4 mb-2 px-1 text-xs flex-wrap" style={{ color: "var(--ds-text-muted)" }}>
          <span><strong>ЛКМ</strong> — точка</span>
          <span><strong>Двойной клик</strong> / клик на 1-ю точку — замкнуть</span>
          <span><strong>ПКМ</strong> — удалить точку</span>
          <span><strong>Esc</strong> — сбросить</span>
          <span><strong>Колёсико</strong> — масштаб</span>
          <span><strong>Shift+ЛКМ</strong> — перемещение</span>
          {points.length > 0 && (
            <span className="font-medium" style={{ color: "var(--ds-accent)" }}>Точек: {points.length}</span>
          )}
        </div>
      )}

      <div ref={containerRef} className={`relative ${fullscreen ? "flex-1 min-h-0" : ""}`}>
        {/* Кнопки зума */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          <button
            type="button"
            onClick={zoomIn}
            className="ds-icon-btn w-7 h-7 text-base font-bold"
            style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)" }}
            title="Увеличить"
          >+</button>
          <button
            type="button"
            onClick={zoomOut}
            className="ds-icon-btn w-7 h-7 text-base font-bold"
            style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)" }}
            title="Уменьшить"
          >−</button>
          {zoom > 1 && (
            <button
              type="button"
              onClick={resetZoom}
              className="ds-icon-btn w-7 h-7 text-[10px] font-medium"
              style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)" }}
              title="Сбросить масштаб"
            >1:1</button>
          )}
        </div>

        {/* Индикатор масштаба */}
        {zoom > 1 && (
          <div
            className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", color: "var(--ds-text-muted)" }}
          >
            ×{zoom.toFixed(1)}
          </div>
        )}

        {/* Кнопки завершения — поверх SVG слева внизу (fullscreen) */}
        {fullscreen && (
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2">
            {points.length > 0 && (
              <span className="px-2 py-1 rounded text-xs font-medium" style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", color: "var(--ds-accent)" }}>
                Точек: {points.length}
              </span>
            )}
            {points.length >= 3 && (
              <button
                type="button"
                onClick={() => { onComplete(points); setPoints([]); }}
                className="ds-btn px-3 py-1.5 text-sm"
              >
                Завершить область
              </button>
            )}
          </div>
        )}

        {/* Нарисованные области — оверлей (fullscreen) */}
        {fullscreen && newPolygons.length > 0 && onRemovePolygon && (
          <div className="absolute bottom-2 right-2 z-10 flex flex-wrap gap-1 max-w-[50%]">
            {newPolygons.map((poly, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs" style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", color: "var(--ds-accent)" }}>
                {i + 1} ({poly.length} т.)
                <button type="button" onClick={() => onRemovePolygon(i)} style={{ color: "var(--ds-text-faint)" }}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          className={`${fullscreen ? "w-full h-full" : "w-full h-auto rounded-lg"} ${isPanning ? "cursor-grabbing" : "cursor-crosshair"}`}
          style={fullscreen
            ? { background: "var(--ds-surface-sunken)" }
            : { border: "1px solid var(--ds-border)", background: "var(--ds-surface-sunken)" }
          }
          preserveAspectRatio={fullscreen ? "xMidYMid meet" : undefined}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleRightClick}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { if (isPanning) setIsPanning(false); setCursorPos(null); }}
        >
          <StatusHatchPatterns />

          {/* Подложка */}
          <image href={imageUrl} width={aspectW} height={aspectH} />

          {/* Существующие маски */}
          {existingMasks.map((mask) => {
            const colorKey = getColorKey(mask.cell_status);
            const preset = getColorPreset(colorKey);
            return (
              <polygon
                key={mask.id}
                points={mask.polygon_points.map(displayPoint).join(" ")}
                fill={`url(#hatch-${colorKey})`}
                stroke={preset.bg}
                strokeWidth={2 / zoom}
                opacity="0.6"
              />
            );
          })}

          {/* Уже нарисованные новые полигоны */}
          {newPolygons.map((poly, i) => {
            const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length * aspectW;
            const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length * aspectH;
            return (
              <g key={`new-${i}`}>
                <polygon
                  points={poly.map(displayPoint).join(" ")}
                  fill="rgba(59, 130, 246, 0.2)"
                  stroke="#3b82f6"
                  strokeWidth={2 / zoom}
                />
                <circle cx={cx} cy={cy} r={12 / zoom} fill="rgba(59, 130, 246, 0.85)" />
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={11 / zoom} fontWeight="bold">
                  {i + 1}
                </text>
              </g>
            );
          })}

          {/* Текущий рисуемый полигон */}
          {points.length >= 2 && (
            <polygon
              points={points.map(displayPoint).join(" ")}
              fill="rgba(59, 130, 246, 0.15)"
              stroke="#3b82f6"
              strokeWidth={2 / zoom}
              strokeDasharray={`${6 / zoom} ${3 / zoom}`}
            />
          )}

          {/* Линия от последней точки до курсора */}
          {points.length > 0 && activePos && (
            <line
              x1={points[points.length - 1].x * aspectW}
              y1={points[points.length - 1].y * aspectH}
              x2={activePos.x * aspectW}
              y2={activePos.y * aspectH}
              stroke="#3b82f6"
              strokeWidth={1.5 / zoom}
              strokeDasharray={`${4 / zoom} ${2 / zoom}`}
              opacity="0.8"
            />
          )}

          {/* Линия от курсора до первой точки (если >= 3 точки) */}
          {points.length >= 3 && activePos && (
            <line
              x1={activePos.x * aspectW}
              y1={activePos.y * aspectH}
              x2={points[0].x * aspectW}
              y2={points[0].y * aspectH}
              stroke="#3b82f6"
              strokeWidth={1 / zoom}
              strokeDasharray={`${3 / zoom} ${3 / zoom}`}
              opacity="0.4"
            />
          )}

          {/* Точки-вершины */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x * aspectW}
              cy={p.y * aspectH}
              r={5 / zoom}
              fill={i === 0 ? "#22c55e" : "#3b82f6"}
              stroke="white"
              strokeWidth={2 / zoom}
            />
          ))}

          {/* Курсор с индикатором привязки */}
          {activePos && !isPanning && (
            <circle
              cx={activePos.x * aspectW}
              cy={activePos.y * aspectH}
              r={(isSnapped ? 7 : 4) / zoom}
              fill={isSnapped ? (snapType === "vertex" ? "#f59e0b" : "#8b5cf6") : "#6b7280"}
              stroke="white"
              strokeWidth={2 / zoom}
              opacity="0.8"
            />
          )}
        </svg>
      </div>

      {/* Нарисованные области (обычный режим) */}
      {!fullscreen && newPolygons.length > 0 && onRemovePolygon && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {newPolygons.map((poly, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs" style={{ background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }}>
              Область {i + 1} ({poly.length} т.)
              <button
                type="button"
                onClick={() => onRemovePolygon(i)}
                style={{ color: "var(--ds-text-faint)" }}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Кнопки (обычный режим) */}
      {!fullscreen && (
        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onCancel}
            className="ds-btn-secondary px-3 py-1.5 text-sm"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => { if (points.length >= 3) { onComplete(points); setPoints([]); } }}
            disabled={points.length < 3}
            className="ds-btn px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Завершить ({points.length} точек)
          </button>
        </div>
      )}
    </div>
  );
}
