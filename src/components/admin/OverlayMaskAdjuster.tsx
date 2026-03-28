import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getOverlayUrl } from "@/lib/overlayUrlCache";
import type { Overlay } from "@/types";

interface MaskRow {
  id: string;
  cell_id: string;
  overlay_id: string;
  polygon_points: { x: number; y: number }[];
}

type Point = { x: number; y: number };

/** Аффинная матрица 2×3: newX = a*x + b*y + tx, newY = c*x + d*y + ty */
interface AffineMatrix { a: number; b: number; tx: number; c: number; d: number; ty: number }

/** 6 шагов: 3 пары (исходная → целевая) */
const TOTAL_STEPS = 6;

const STEP_LABELS: string[] = [
  "Кликните на точку-ориентир 1 на текущих областях",
  "Кликните куда переместить точку 1",
  "Кликните на точку-ориентир 2 на текущих областях",
  "Кликните куда переместить точку 2",
  "Кликните на точку-ориентир 3 на текущих областях",
  "Кликните куда переместить точку 3",
];

const STEP_COLORS = ["#ef4444", "#22c55e", "#f97316", "#3b82f6", "#a855f7", "#ec4899"];
const POINT_LABELS = ["S1", "D1", "S2", "D2", "S3", "D3"];

/** Решить систему 3×3 методом Крамера. Возвращает [x1, x2, x3] или null */
function solve3x3(
  a1: number, b1: number, c1: number, r1: number,
  a2: number, b2: number, c2: number, r2: number,
  a3: number, b3: number, c3: number, r3: number,
): [number, number, number] | null {
  const det = a1 * (b2 * c3 - b3 * c2) - b1 * (a2 * c3 - a3 * c2) + c1 * (a2 * b3 - a3 * b2);
  if (Math.abs(det) < 1e-10) return null;
  const x = (r1 * (b2 * c3 - b3 * c2) - b1 * (r2 * c3 - r3 * c2) + c1 * (r2 * b3 - r3 * b2)) / det;
  const y = (a1 * (r2 * c3 - r3 * c2) - r1 * (a2 * c3 - a3 * c2) + c1 * (a2 * r3 - a3 * r2)) / det;
  const z = (a1 * (b2 * r3 - b3 * r2) - b1 * (a2 * r3 - a3 * r2) + r1 * (a2 * b3 - a3 * b2)) / det;
  return [x, y, z];
}

/** Вычислить аффинную матрицу из 3 пар точек */
function computeAffine(src: Point[], dst: Point[]): AffineMatrix | null {
  if (src.length < 1 || dst.length < 1) return null;

  if (src.length === 1) {
    // 1 пара — только смещение
    return { a: 1, b: 0, tx: dst[0].x - src[0].x, c: 0, d: 1, ty: dst[0].y - src[0].y };
  }

  if (src.length === 2) {
    // 2 пары — равномерный масштаб + поворот + смещение (4 параметра из 4 уравнений)
    const [s1, s2] = src;
    const [d1, d2] = dst;
    const dxs = s2.x - s1.x, dys = s2.y - s1.y;
    const dxd = d2.x - d1.x, dyd = d2.y - d1.y;
    const denom = dxs * dxs + dys * dys;
    if (Math.abs(denom) < 1e-10) return null;
    const a = (dxs * dxd + dys * dyd) / denom;
    const b = (dxs * dyd - dys * dxd) / denom;
    return { a, b: -b, tx: d1.x - a * s1.x + b * s1.y, c: b, d: a, ty: d1.y - b * s1.x - a * s1.y };
  }

  // 3 пары — полная аффинная (6 параметров)
  const [s1, s2, s3] = src;
  const [d1, d2, d3] = dst;

  const xRow = solve3x3(
    s1.x, s1.y, 1, d1.x,
    s2.x, s2.y, 1, d2.x,
    s3.x, s3.y, 1, d3.x,
  );
  const yRow = solve3x3(
    s1.x, s1.y, 1, d1.y,
    s2.x, s2.y, 1, d2.y,
    s3.x, s3.y, 1, d3.y,
  );
  if (!xRow || !yRow) return null;
  return { a: xRow[0], b: xRow[1], tx: xRow[2], c: yRow[0], d: yRow[1], ty: yRow[2] };
}

function applyAffine(m: AffineMatrix, p: Point): Point {
  return {
    x: Math.max(0, Math.min(1, m.a * p.x + m.b * p.y + m.tx)),
    y: Math.max(0, Math.min(1, m.c * p.x + m.d * p.y + m.ty)),
  };
}

/** Извлечь угол поворота, масштаб X/Y из аффинной матрицы для отображения */
function decomposeAffine(m: AffineMatrix) {
  const rotation = Math.atan2(m.c, m.a) * (180 / Math.PI);
  const scaleX = Math.sqrt(m.a * m.a + m.c * m.c);
  const scaleY = Math.sqrt(m.b * m.b + m.d * m.d);
  return { rotation, scaleX, scaleY, tx: m.tx, ty: m.ty };
}

interface Props {
  overlay: Overlay;
  oldWidth: number;
  oldHeight: number;
  onDone: () => void;
}

export default function OverlayMaskAdjuster({ overlay, oldWidth, oldHeight, onDone }: Props) {
  const [masks, setMasks] = useState<MaskRow[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const [step, setStep] = useState(0);
  const [pts, setPts] = useState<(Point | null)[]>(Array(TOTAL_STEPS).fill(null));

  useEffect(() => {
    loadMasks();
    loadImage();
  }, [overlay.id]);

  async function loadMasks() {
    const { data } = await supabase
      .from("cell_overlay_masks")
      .select("id, cell_id, overlay_id, polygon_points")
      .eq("overlay_id", overlay.id);
    if (data) setMasks(data as MaskRow[]);
  }

  async function loadImage() {
    const url = await getOverlayUrl(overlay.storage_path);
    setImageUrl(url);
  }

  const aspectW = 1000;
  const aspectH = overlay.height && overlay.width ? (1000 * overlay.height) / overlay.width : 750;

  // Собрать пары src/dst из расставленных точек
  const { srcPts, dstPts } = useMemo(() => {
    const s: Point[] = [], d: Point[] = [];
    for (let i = 0; i < TOTAL_STEPS; i += 2) {
      if (pts[i] && pts[i + 1]) { s.push(pts[i]!); d.push(pts[i + 1]!); }
    }
    return { srcPts: s, dstPts: d };
  }, [pts]);

  const affine = useMemo(() => computeAffine(srcPts, dstPts), [srcPts, dstPts]);

  const hasTransform = affine !== null && (
    Math.abs(affine.a - 1) > 1e-6 || Math.abs(affine.b) > 1e-6 ||
    Math.abs(affine.c) > 1e-6 || Math.abs(affine.d - 1) > 1e-6 ||
    Math.abs(affine.tx) > 1e-6 || Math.abs(affine.ty) > 1e-6
  );

  const transformedMasks = useMemo(() => {
    if (!affine || !hasTransform) return masks;
    return masks.map((m) => ({
      ...m,
      polygon_points: m.polygon_points.map((p) => applyAffine(affine, p)),
    }));
  }, [masks, affine, hasTransform]);

  const displayPoint = (p: Point) => `${p.x * aspectW},${p.y * aspectH}`;

  const placedCount = pts.filter(Boolean).length;

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || step >= TOTAL_STEPS) return;
    const rect = svg.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setPts((prev) => { const next = [...prev]; next[step] = { x, y }; return next; });
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  }, [step]);

  function undoLastPoint() {
    const prevStep = pts[step] ? step : Math.max(0, step - 1);
    setPts((prev) => {
      const next = [...prev];
      for (let i = prevStep; i < TOTAL_STEPS; i++) next[i] = null;
      return next;
    });
    setStep(prevStep);
  }

  function resetPoints() {
    setPts(Array(TOTAL_STEPS).fill(null));
    setStep(0);
  }

  async function applyTransformToDb() {
    if (!affine) return;
    setSaving(true);
    for (const tm of transformedMasks) {
      await supabase.from("cell_overlay_masks")
        .update({ polygon_points: tm.polygon_points })
        .eq("id", tm.id);
    }
    setSaving(false);
    onDone();
  }

  const decomposed = affine && hasTransform ? decomposeAffine(affine) : null;

  if (!imageUrl) {
    return (
      <div className="ds-overlay p-4"><div className="ds-overlay-bg" />
        <div className="ds-modal p-8"><div className="ds-spinner mx-auto" /></div>
      </div>
    );
  }

  return (
    <div className="ds-overlay p-4">
      <div className="ds-overlay-bg" />
      <div className="ds-modal w-full max-w-5xl max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="ds-modal-header">
          <div>
            <h2 className="ds-modal-title">Корректировка областей</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--ds-text-muted)" }}>
              {overlay.name} — {masks.length} обл.
              {oldWidth > 0 && overlay.width ? ` | ${oldWidth}×${oldHeight} → ${overlay.width}×${overlay.height}` : ""}
            </p>
          </div>
          <button onClick={onDone} className="ds-icon-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Инструкция */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{
            background: `color-mix(in srgb, ${STEP_COLORS[Math.min(step, TOTAL_STEPS - 1)]} 8%, var(--ds-surface))`,
            border: `1px solid color-mix(in srgb, ${STEP_COLORS[Math.min(step, TOTAL_STEPS - 1)]} 30%, var(--ds-border))`,
          }}>
            <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white shrink-0"
              style={{ background: STEP_COLORS[Math.min(step, TOTAL_STEPS - 1)] }}>
              {Math.min(step + 1, TOTAL_STEPS)}
            </div>
            <p className="text-sm flex-1" style={{ color: "var(--ds-text)" }}>
              {placedCount >= TOTAL_STEPS
                ? "Готово! Проверьте результат и нажмите «Применить»"
                : STEP_LABELS[step]}
            </p>
            <div className="flex items-center gap-1.5">
              {placedCount > 0 && (
                <>
                  <button onClick={undoLastPoint} className="ds-btn-secondary px-2 py-1 text-xs">Отменить</button>
                  <button onClick={resetPoints} className="ds-btn-secondary px-2 py-1 text-xs">Сбросить</button>
                </>
              )}
            </div>
          </div>

          {/* Статус точек */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--ds-text-muted)" }}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{
                  background: pts[i] ? STEP_COLORS[i] : "var(--ds-border)",
                  border: step === i && !pts[i] ? `2px solid ${STEP_COLORS[i]}` : "none",
                }} />
                {POINT_LABELS[i]}
                {pts[i] && (
                  <span style={{ color: "var(--ds-text-faint)" }}>
                    ({(pts[i]!.x * 100).toFixed(0)}%, {(pts[i]!.y * 100).toFixed(0)}%)
                  </span>
                )}
              </span>
            ))}
          </div>

          {/* SVG */}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${aspectW} ${aspectH}`}
            className="w-full h-auto rounded-lg"
            style={{ border: "1px solid var(--ds-border)", background: "var(--ds-surface-sunken)", cursor: placedCount < TOTAL_STEPS ? "crosshair" : "default" }}
            onClick={placedCount < TOTAL_STEPS ? handleSvgClick : undefined}
          >
            <image href={imageUrl} width={aspectW} height={aspectH} />

            {/* Исходные маски */}
            {masks.map((m) => (
              <polygon key={`o-${m.id}`} points={m.polygon_points.map(displayPoint).join(" ")}
                fill="rgba(239,68,68,0.1)" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.6" />
            ))}

            {/* Трансформированные маски */}
            {hasTransform && transformedMasks.map((m) => (
              <polygon key={`n-${m.id}`} points={m.polygon_points.map(displayPoint).join(" ")}
                fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth="2" opacity="0.8" />
            ))}

            {/* Точки и линии между парами */}
            {pts.map((p, i) => p && (
              <g key={`pt-${i}`}>
                <circle cx={p.x * aspectW} cy={p.y * aspectH} r="8" fill={STEP_COLORS[i]} opacity="0.3" />
                <circle cx={p.x * aspectW} cy={p.y * aspectH} r="4" fill={STEP_COLORS[i]} />
                <text x={p.x * aspectW + 12} y={p.y * aspectH + 4}
                  fontSize="12" fontWeight="700" fill={STEP_COLORS[i]}
                  className="select-none pointer-events-none">
                  {POINT_LABELS[i]}
                </text>
                {i % 2 === 1 && pts[i - 1] && (
                  <line
                    x1={pts[i - 1]!.x * aspectW} y1={pts[i - 1]!.y * aspectH}
                    x2={p.x * aspectW} y2={p.y * aspectH}
                    stroke={STEP_COLORS[i]} strokeWidth="1.5" strokeDasharray="4 2" opacity="0.6" />
                )}
              </g>
            ))}
          </svg>

          {/* Информация о трансформации */}
          {decomposed && (
            <div className="text-xs px-3 py-1.5 rounded" style={{ background: "var(--ds-surface-sunken)", color: "var(--ds-text-muted)" }}>
              Поворот: {decomposed.rotation > 0 ? "+" : ""}{decomposed.rotation.toFixed(1)}°
              {" | "}Масштаб: X={decomposed.scaleX.toFixed(3)}, Y={decomposed.scaleY.toFixed(3)}
              {" | "}Сдвиг: {(decomposed.tx * 100).toFixed(1)}%, {(decomposed.ty * 100).toFixed(1)}%
              {srcPts.length < 3 && <span className="ml-3 opacity-60">(точек: {srcPts.length}/3 — можно применить или добавить ещё)</span>}
            </div>
          )}

          {/* Кнопки */}
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
              <span style={{ color: "#ef4444" }}>- - -</span> Исходные
              {hasTransform && <><span className="mx-2">|</span><span style={{ color: "#3b82f6" }}>---</span> Результат</>}
            </p>
            <div className="flex gap-2">
              <button onClick={onDone} className="ds-btn-secondary px-3 py-1.5 text-sm">Пропустить</button>
              <button onClick={applyTransformToDb} disabled={saving || !hasTransform} className="ds-btn px-3 py-1.5 text-sm">
                {saving ? "Сохранение..." : "Применить"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
