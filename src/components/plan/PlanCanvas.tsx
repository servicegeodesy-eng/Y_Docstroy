import { useRef, useState, useCallback, useMemo } from "react";
import StatusHatchPatterns from "./svgPatterns";
import { getColorPreset } from "@/constants/colorPalette";
import type { MaskWithCell } from "@/hooks/useCellMasks";

interface LegendItem {
  name: string;
  colorKey: string;
}

export interface WorkMaskData {
  id: string;
  work_id: string;
  polygon_points: { x: number; y: number }[];
  work_status: string;
  progress: number;
  planned_date: string | null;
  building_name: string | null;
  work_type_name: string | null;
}

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  masks: MaskWithCell[];
  requestMasks?: MaskWithCell[];
  workMasks?: WorkMaskData[];
  getColorKey: (status: string) => string;
  onMaskClick: (cellId: string) => void;
  onRequestMaskClick?: (cellId: string) => void;
  onWorkMaskClick?: (workId: string) => void;
  legend?: LegendItem[];
}

type Point = { x: number; y: number };

/** Bounding box полигона в нормализованных координатах */
function polyBBox(pts: Point[]): { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number } {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Центроид полигона */
function centroid(points: Point[]): Point {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0 };
  let cx = 0, cy = 0;
  for (const p of points) { cx += p.x; cy += p.y; }
  return { x: cx / n, y: cy / n };
}

/** DD.MM */
function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Приблизительная ширина символа в SVG-единицах */
const CHAR_WIDTH_NAME = 8;     // при fontSize=12, с запасом для кириллицы
const CHAR_WIDTH_DATE = 7;     // при fontSize=11
const LINE_GAP = 4;
const TOTAL_LINE_HEIGHT = 12 + LINE_GAP + 11;
const PADDING = 6;

/** Точка внутри полигона (ray casting) */
function pointInPolygon(px: number, py: number, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Проверка пересечения двух прямоугольников (по центру и размерам) */
function labelsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
}

interface PlacedLabel {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/**
 * Для каждой маски находит позицию подписи внутри своего полигона,
 * не перекрывающую подписи других масок и не попадающую внутрь других полигонов.
 * Перебирает сетку кандидатов 5×5 внутри bbox полигона.
 */
function findLabelPositions(
  masks: { poly: Point[]; bbox: { minX: number; minY: number; maxX: number; maxY: number }; cx: number; cy: number; textW: number; textH: number }[],
): { cx: number; cy: number }[] {
  const placed: PlacedLabel[] = [];

  // Сортируем: меньшие полигоны (вложенные) размещаем первыми — их позиция приоритетнее
  const indices = masks.map((_, i) => i);
  indices.sort((a, b) => {
    const areaA = masks[a].bbox.maxX - masks[a].bbox.minX;
    const areaB = masks[b].bbox.maxX - masks[b].bbox.minX;
    return areaA - areaB;
  });

  // Подготовим результат в порядке оригинальном
  const resultByIdx: { cx: number; cy: number }[] = new Array(masks.length);

  for (const idx of indices) {
    const m = masks[idx];
    const { bbox, poly, textW, textH } = m;
    const halfW = textW / 2;
    const halfH = textH / 2;

    // Генерируем кандидатов: сетка 5×5 внутри bbox + центроид
    const candidates: Point[] = [{ x: m.cx, y: m.cy }];
    const GRID = 5;
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const x = bbox.minX + (bbox.maxX - bbox.minX) * (gx + 0.5) / GRID;
        const y = bbox.minY + (bbox.maxY - bbox.minY) * (gy + 0.5) / GRID;
        candidates.push({ x, y });
      }
    }

    let bestPos = { cx: m.cx, cy: m.cy };
    let bestScore = -Infinity;

    for (const cand of candidates) {
      // Все 4 угла текстового блока должны быть внутри своего полигона
      const corners = [
        { x: cand.x - halfW, y: cand.y - halfH },
        { x: cand.x + halfW, y: cand.y - halfH },
        { x: cand.x - halfW, y: cand.y + halfH },
        { x: cand.x + halfW, y: cand.y + halfH },
      ];
      const allInside = corners.every((c) => pointInPolygon(c.x, c.y, poly));
      if (!allInside) continue;

      // Центр текста не должен быть внутри чужого полигона
      const insideOther = masks.some((other, oi) => oi !== idx && pointInPolygon(cand.x, cand.y, other.poly));

      // Не перекрывать уже размещённые подписи
      const overlapsPlaced = placed.some((p) =>
        labelsOverlap(cand.x, cand.y, textW, textH, p.cx, p.cy, p.w, p.h)
      );

      // Оценка: предпочитаем позиции внутри полигона, без перекрытий, ближе к центроиду
      let score = 0;
      if (!insideOther) score += 1000;
      if (!overlapsPlaced) score += 500;
      // Ближе к центроиду — лучше
      const dist = Math.hypot(cand.x - m.cx, cand.y - m.cy);
      score -= dist * 10;

      if (score > bestScore) {
        bestScore = score;
        bestPos = { cx: cand.x, cy: cand.y };
      }
    }

    placed.push({ cx: bestPos.cx, cy: bestPos.cy, w: textW, h: textH });
    resultByIdx[idx] = bestPos;
  }

  return resultByIdx;
}

/** Расчёт легенды: горизонтальная раскладка элементов с переносом строк */
const LEGEND_FONT = 10;
const LEGEND_SWATCH = 12;
const LEGEND_GAP = 8;
const LEGEND_ITEM_GAP = 14;
const LEGEND_PAD_X = 10;
const LEGEND_PAD_Y = 6;
const LEGEND_ROW_H = 18;
const LEGEND_CHAR_W = 6;

function layoutLegend(items: LegendItem[], maxWidth: number) {
  const rows: { items: { item: LegendItem; x: number }[]; width: number }[] = [];
  let curRow: { item: LegendItem; x: number }[] = [];
  let curX = 0;

  for (const item of items) {
    const itemW = LEGEND_SWATCH + LEGEND_GAP + item.name.length * LEGEND_CHAR_W;
    if (curRow.length > 0 && curX + LEGEND_ITEM_GAP + itemW > maxWidth) {
      rows.push({ items: curRow, width: curX });
      curRow = [];
      curX = 0;
    }
    if (curRow.length > 0) curX += LEGEND_ITEM_GAP;
    curRow.push({ item, x: curX });
    curX += itemW;
  }
  if (curRow.length > 0) rows.push({ items: curRow, width: curX });

  const totalH = LEGEND_PAD_Y * 2 + rows.length * LEGEND_ROW_H;
  return { rows, totalH };
}

/** Заливка маски работы по прогрессу */
function workMaskFill(status: string, progress: number): string {
  if (status === "completed") return "rgba(34,197,94,0.3)";
  if (status === "planned") return "rgba(59,130,246,0.08)";
  const t = Math.max(0, Math.min(100, progress)) / 100;
  const r = Math.round(249 * (1 - t) + 34 * t);
  const g = Math.round(115 * (1 - t) + 197 * t);
  const b = Math.round(22 * (1 - t) + 94 * t);
  return `rgba(${r},${g},${b},${0.15 + t * 0.2})`;
}

function workMaskStroke(status: string, progress: number): string {
  if (status === "completed") return "#22c55e";
  if (status === "planned") return "#3b82f6";
  const t = Math.max(0, Math.min(100, progress)) / 100;
  const r = Math.round(249 * (1 - t) + 34 * t);
  const g = Math.round(115 * (1 - t) + 197 * t);
  const b = Math.round(22 * (1 - t) + 94 * t);
  return `rgb(${r},${g},${b})`;
}

const WORK_STATUS_LABELS: Record<string, string> = {
  planned: "Запланировано",
  in_progress: "В процессе",
  completed: "Завершено",
};

export default function PlanCanvas({
  imageUrl,
  imageWidth,
  imageHeight,
  masks,
  requestMasks = [],
  workMasks = [],
  getColorKey,
  onMaskClick,
  onRequestMaskClick,
  onWorkMaskClick,
  legend,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredMask, setHoveredMask] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; mask: MaskWithCell } | null>(null);
  const [workTooltip, setWorkTooltip] = useState<{ x: number; y: number; mask: WorkMaskData } | null>(null);

  const aspectW = 1000;
  const imageAspectH = imageHeight > 0 ? (1000 * imageHeight) / imageWidth : 750;

  // Легенда: раскладка и доп. высота
  const legendLayout = useMemo(() => {
    if (!legend || legend.length === 0) return null;
    return layoutLegend(legend, aspectW - LEGEND_PAD_X * 2);
  }, [legend, aspectW]);

  const legendH = legendLayout ? legendLayout.totalH : 0;
  const aspectH = imageAspectH + legendH;

  const displayPoint = (p: Point) => `${p.x * aspectW},${p.y * imageAspectH}`;

  /** Вычислить масштаб и позиции текста с разрешением коллизий */
  const maskTextData = useMemo(() => {
    // Шаг 1: вычислить масштаб и начальные позиции
    const items = masks.map((mask) => {
      const bbox = polyBBox(mask.polygon_points);
      const center = centroid(mask.polygon_points);
      const bboxWPx = bbox.w * aspectW - PADDING * 2;
      const bboxHPx = bbox.h * imageAspectH - PADDING * 2;

      const nameText = mask.cell_name;
      const dateText = shortDate(mask.cell_updated_at);

      const nameWidthPx = nameText.length * CHAR_WIDTH_NAME;
      const dateWidthPx = dateText.length * CHAR_WIDTH_DATE;
      const maxTextWidth = Math.max(nameWidthPx, dateWidthPx);

      const scaleW = bboxWPx > 0 ? Math.min(1, bboxWPx / maxTextWidth) : 1;
      const scaleH = bboxHPx > 0 ? Math.min(1, bboxHPx / TOTAL_LINE_HEIGHT) : 1;
      const finalScale = Math.max(0.3, Math.min(scaleW, scaleH));

      const textW = maxTextWidth * finalScale;
      const textH = TOTAL_LINE_HEIGHT * finalScale;

      return {
        mask, nameText, dateText, finalScale,
        cx: center.x * aspectW,
        cy: center.y * imageAspectH,
        // Нормализованные размеры текста для point-in-polygon
        textWNorm: textW / aspectW,
        textHNorm: textH / imageAspectH,
        bbox,
      };
    });

    // Шаг 2: найти позиции внутри полигонов без коллизий
    if (items.length > 0) {
      const posInputs = items.map((it) => ({
        poly: it.mask.polygon_points,
        bbox: it.bbox,
        cx: it.cx / aspectW,       // в нормализованных координатах
        cy: it.cy / imageAspectH,
        textW: it.textWNorm,
        textH: it.textHNorm,
      }));
      const positions = findLabelPositions(posInputs);
      for (let i = 0; i < items.length; i++) {
        items[i].cx = positions[i].cx * aspectW;
        items[i].cy = positions[i].cy * imageAspectH;
      }
    }

    // Шаг 3: финальные позиции строк (в масштабированных единицах, без SVG-трансформа)
    return items.map((it) => {
      const nameFontSize = 12 * it.finalScale;
      const dateFontSize = 11 * it.finalScale;
      const gap = LINE_GAP * it.finalScale;
      const blockH = nameFontSize + gap + dateFontSize;
      const nameY = it.cy - blockH / 2 + nameFontSize / 2;
      const dateY = it.cy + blockH / 2 - dateFontSize / 2;
      return { mask: it.mask, nameText: it.nameText, dateText: it.dateText, cx: it.cx, cy: it.cy, finalScale: it.finalScale, nameY, dateY, nameFontSize, dateFontSize };
    });
  }, [masks, aspectW, imageAspectH]);

  const handleMouseEnter = useCallback(
    (mask: MaskWithCell, e: React.MouseEvent) => {
      setHoveredMask(mask.id);
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        mask,
      });
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredMask(null);
    setTooltip(null);
    setWorkTooltip(null);
  }, []);

  const handleWorkMouseEnter = useCallback(
    (mask: WorkMaskData, e: React.MouseEvent) => {
      setHoveredMask(`work-${mask.id}`);
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      setWorkTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, mask });
    },
    [],
  );

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${aspectW} ${aspectH}`}
        className="w-full h-auto rounded-lg" style={{ border: "1px solid var(--ds-border)", background: "var(--ds-surface-sunken)" }}
      >
        <StatusHatchPatterns />

        {/* Подложка */}
        <image href={imageUrl} width={aspectW} height={imageAspectH} />

        {/* Маски ячеек */}
        {maskTextData.map(({ mask, nameText, dateText, cx, nameY, dateY, nameFontSize, dateFontSize }) => {
          const colorKey = getColorKey(mask.cell_status);
          const preset = getColorPreset(colorKey);
          const isHovered = hoveredMask === mask.id;

          return (
            <g key={mask.id}>
              <polygon
                points={mask.polygon_points.map(displayPoint).join(" ")}
                fill={`url(#hatch-${colorKey})`}
                stroke={preset.bg}
                strokeWidth={isHovered ? "3" : "2"}
                opacity={isHovered ? 0.85 : 0.65}
                className="cursor-pointer transition-opacity"
                onClick={() => onMaskClick(mask.cell_id)}
                onMouseEnter={(e) => handleMouseEnter(mask, e)}
                onMouseLeave={handleMouseLeave}
              />
              <text
                x={cx} y={nameY}
                textAnchor="middle" dominantBaseline="central"
                fontSize={nameFontSize} fontWeight="600" fill={preset.text}
                className="pointer-events-none select-none"
              >
                {nameText}
              </text>
              <text
                x={cx} y={dateY}
                textAnchor="middle" dominantBaseline="central"
                fontSize={dateFontSize} fontWeight="500" fill={preset.text} opacity="0.8"
                className="pointer-events-none select-none"
              >
                {dateText}
              </text>
            </g>
          );
        })}

        {/* Маски заявок (оранжевые) */}
        {requestMasks.map((mask) => {
          const isHovered = hoveredMask === mask.id;
          return (
            <g key={`req-${mask.id}`}>
              <polygon
                points={mask.polygon_points.map(displayPoint).join(" ")}
                fill="rgba(249,115,22,0.3)"
                stroke="#f97316"
                strokeWidth={isHovered ? "3" : "2"}
                strokeDasharray="6 3"
                opacity={isHovered ? 0.9 : 0.7}
                className="cursor-pointer transition-opacity"
                onClick={() => onRequestMaskClick?.(mask.cell_id)}
                onMouseEnter={(e) => handleMouseEnter(mask, e)}
                onMouseLeave={handleMouseLeave}
              />
              <text
                x={centroid(mask.polygon_points).x * aspectW}
                y={centroid(mask.polygon_points).y * imageAspectH}
                textAnchor="middle" dominantBaseline="central"
                fontSize={10} fontWeight="600" fill="#c2410c"
                className="pointer-events-none select-none"
              >
                {mask.cell_name}
              </text>
            </g>
          );
        })}

        {/* Маски работ монтажа */}
        {workMasks.map((mask) => {
          const isHovered = hoveredMask === `work-${mask.id}`;
          const fill = workMaskFill(mask.work_status, mask.progress);
          const stroke = workMaskStroke(mask.work_status, mask.progress);
          const isDashed = mask.work_status === "planned";
          const center = centroid(mask.polygon_points);

          return (
            <g key={`work-${mask.id}`}>
              <polygon
                points={mask.polygon_points.map(displayPoint).join(" ")}
                fill={fill}
                stroke={stroke}
                strokeWidth={isHovered ? "3" : "2"}
                strokeDasharray={isDashed ? "8 4" : undefined}
                opacity={isHovered ? 0.95 : 0.8}
                className="cursor-pointer transition-opacity"
                onClick={() => onWorkMaskClick?.(mask.work_id)}
                onMouseEnter={(e) => handleWorkMouseEnter(mask, e)}
                onMouseLeave={handleMouseLeave}
              />
              <text
                x={center.x * aspectW}
                y={center.y * imageAspectH}
                textAnchor="middle" dominantBaseline="central"
                fontSize={11} fontWeight="700" fill={stroke}
                className="pointer-events-none select-none"
              >
                {mask.progress}%
              </text>
            </g>
          );
        })}

        {/* Легенда статусов (внутри SVG — видна при печати) */}
        {legendLayout && legend && (
          <g className="pointer-events-none select-none">
            <rect x="0" y={imageAspectH} width={aspectW} height={legendH} fill="white" />
            {legendLayout.rows.map((row, ri) => {
              const rowY = imageAspectH + LEGEND_PAD_Y + ri * LEGEND_ROW_H;
              // Центрируем строку
              const rowOffsetX = (aspectW - row.width) / 2;
              return row.items.map(({ item, x }, ii) => {
                const preset = getColorPreset(item.colorKey);
                const ix = rowOffsetX + x;
                return (
                  <g key={`${ri}-${ii}`}>
                    <rect x={ix} y={rowY + 2} width={LEGEND_SWATCH} height={LEGEND_SWATCH} rx="2" fill={preset.bg} />
                    <text x={ix + LEGEND_SWATCH + LEGEND_GAP} y={rowY + LEGEND_SWATCH / 2 + 2}
                      fontSize={LEGEND_FONT} fill="#374151" dominantBaseline="central">
                      {item.name}
                    </text>
                  </g>
                );
              });
            })}
          </g>
        )}
      </svg>

      {/* Тултип */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 rounded-lg shadow-lg px-3 py-2 text-xs max-w-[200px]"
          style={{
            background: "var(--ds-surface)",
            border: "1px solid var(--ds-border)",
            left: Math.min(tooltip.x + 12, (svgRef.current?.getBoundingClientRect().width || 600) - 210),
            top: tooltip.y + 12,
          }}
        >
          <p className="font-medium truncate" style={{ color: "var(--ds-text)" }}>{tooltip.mask.cell_name}</p>
          <p className="mt-0.5" style={{ color: "var(--ds-text-muted)" }}>Статус: {tooltip.mask.cell_status}</p>
          {tooltip.mask.cell_progress_percent != null && (
            <p className="" style={{ color: "var(--ds-text-muted)" }}>Прогресс: {tooltip.mask.cell_progress_percent}%</p>
          )}
          <p className="mt-0.5" style={{ color: "var(--ds-text-faint)" }}>{shortDate(tooltip.mask.cell_updated_at)}</p>
        </div>
      )}

      {/* Тултип работы монтажа */}
      {workTooltip && (
        <div
          className="absolute pointer-events-none z-10 rounded-lg shadow-lg px-3 py-2 text-xs max-w-[240px]"
          style={{
            background: "var(--ds-surface)",
            border: "1px solid var(--ds-border)",
            left: Math.min(workTooltip.x + 12, (svgRef.current?.getBoundingClientRect().width || 600) - 250),
            top: workTooltip.y + 12,
          }}
        >
          <p className="font-medium" style={{ color: "var(--ds-text)" }}>
            {[workTooltip.mask.building_name, workTooltip.mask.work_type_name].filter(Boolean).join(" / ") || "Монтаж"}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] font-medium" style={{ color: workMaskStroke(workTooltip.mask.work_status, workTooltip.mask.progress) }}>
              {WORK_STATUS_LABELS[workTooltip.mask.work_status] || workTooltip.mask.work_status}
            </span>
            <span style={{ color: "var(--ds-text)" }}>Прогресс: {workTooltip.mask.progress}%</span>
          </div>
          {workTooltip.mask.planned_date && (
            <p className="mt-0.5" style={{ color: "var(--ds-text-faint)" }}>
              План: {shortDate(workTooltip.mask.planned_date)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
