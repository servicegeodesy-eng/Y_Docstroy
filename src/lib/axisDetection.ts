/**
 * Определение осей для масок на подложке.
 *
 * Логика:
 * 1. Найти оси, чьи отрезки пересекают область (полигон)
 * 2. Из пересекающих осей определить крайние: левую, правую, верхнюю, нижнюю
 * 3. К крайним +1 (правая, верхняя) и -1 (левая, нижняя). Если ±1 = "0" → текущая
 * 4. Если отрезки не пересекают → ближайшие оси на расстоянии ≤ maxGap/2
 *    → "возле оси ..." (может быть одна ось)
 * 5. Если ничего не найдено → "область вне осей"
 *
 * Несколько полигонов → через точку с запятой
 */

export interface CalibratedAxis {
  name: string;
  direction: 'vertical' | 'horizontal';
  sort_order: number;
  p1: { x: number; y: number } | null;
  p2: { x: number; y: number } | null;
}

export interface AxisRange {
  vertical: { from: string; to: string } | null;
  horizontal: { from: string; to: string } | null;
}

interface Pt { x: number; y: number }

/* ─── Геометрия ─── */

function segmentIntersection(a1: Pt, a2: Pt, b1: Pt, b2: Pt): boolean {
  const dx1 = a2.x - a1.x, dy1 = a2.y - a1.y;
  const dx2 = b2.x - b1.x, dy2 = b2.y - b1.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-12) return false;
  const t = ((b1.x - a1.x) * dy2 - (b1.y - a1.y) * dx2) / denom;
  const u = ((b1.x - a1.x) * dy1 - (b1.y - a1.y) * dx1) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function pointInPolygon(pt: Pt, polygon: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i].y, yj = polygon[j].y;
    const xi = polygon[i].x, xj = polygon[j].x;
    if ((yi > pt.y) !== (yj > pt.y) &&
        pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Проверяет, пересекает ли отрезок оси контур полигона или проходит внутри */
function axisCrossesPolygon(axis: CalibratedAxis, polygon: Pt[]): boolean {
  if (!axis.p1 || !axis.p2) return false;
  if (pointInPolygon(axis.p1, polygon)) return true;
  if (pointInPolygon(axis.p2, polygon)) return true;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (segmentIntersection(axis.p1, axis.p2, polygon[j], polygon[i])) return true;
  }
  return false;
}

/** Минимальное расстояние от точки до отрезка */
function pointToSegmentDist(pt: Pt, s1: Pt, s2: Pt): number {
  const dx = s2.x - s1.x, dy = s2.y - s1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(pt.x - s1.x, pt.y - s1.y);
  let t = ((pt.x - s1.x) * dx + (pt.y - s1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = s1.x + t * dx, py = s1.y + t * dy;
  return Math.hypot(pt.x - px, pt.y - py);
}

/** Минимальное расстояние от отрезка оси до полигона */
function axisToPolygonDist(axis: CalibratedAxis, polygon: Pt[]): number {
  if (!axis.p1 || !axis.p2) return Infinity;
  let minDist = Infinity;
  // Расстояние от каждой вершины полигона до отрезка оси
  for (const v of polygon) {
    const d = pointToSegmentDist(v, axis.p1, axis.p2);
    if (d < minDist) minDist = d;
  }
  // Расстояние от концов оси до каждого ребра полигона
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const d1 = pointToSegmentDist(axis.p1, polygon[j], polygon[i]);
    const d2 = pointToSegmentDist(axis.p2, polygon[j], polygon[i]);
    if (d1 < minDist) minDist = d1;
    if (d2 < minDist) minDist = d2;
  }
  return minDist;
}

/** Максимальное расстояние между соседними осями (по средним координатам) */
function maxAxisGap(axes: CalibratedAxis[], coord: 'x' | 'y'): number {
  const positions = axes
    .filter((a) => a.name !== '0' && a.p1 && a.p2)
    .map((a) => coord === 'x'
      ? (a.p1!.x + a.p2!.x) / 2
      : (a.p1!.y + a.p2!.y) / 2)
    .sort((a, b) => a - b);
  let gap = 0;
  for (let i = 1; i < positions.length; i++) {
    const g = positions[i] - positions[i - 1];
    if (g > gap) gap = g;
  }
  return gap;
}

/* ─── ±1 расширение ─── */

/**
 * Найти ±1 соседа в полном массиве осей (включая "0").
 * Правила:
 * - Пропускаем неоткалиброванные
 * - Если сосед = "0" И за ним сразу откалиброванная ось (паттерн: current, 0, X) → стена → null
 * - Если "0" не непосредственный сосед → пропускаем "0"
 * - Проверяем пространственную близость
 */
function findNeighbor(
  allAxes: CalibratedAxis[], fromIdx: number, dir: -1 | 1,
  fromAxis: CalibratedAxis, coord: 'x' | 'y', gap: number,
): CalibratedAxis | null {
  if (!fromAxis.p1 || !fromAxis.p2) return null;
  const fromPos = coord === 'x'
    ? (fromAxis.p1.x + fromAxis.p2.x) / 2
    : (fromAxis.p1.y + fromAxis.p2.y) / 2;
  let hitZeroAtStep1 = false;
  for (let i = fromIdx + dir; i >= 0 && i < allAxes.length; i += dir) {
    if (allAxes[i].name === '0') {
      if (i === fromIdx + dir) hitZeroAtStep1 = true;
      continue;
    }
    if (!allAxes[i].p1 || !allAxes[i].p2) continue;
    // Паттерн: current, 0, X → стена
    if (hitZeroAtStep1 && i === fromIdx + dir * 2) return null;
    // Пространственная близость
    const pos = coord === 'x'
      ? (allAxes[i].p1!.x + allAxes[i].p2!.x) / 2
      : (allAxes[i].p1!.y + allAxes[i].p2!.y) / 2;
    if (Math.abs(pos - fromPos) <= gap) return allAxes[i];
    return null;
  }
  return null;
}

/* ─── Секции (между "0") ─── */

function splitSections(allAxes: CalibratedAxis[]): CalibratedAxis[][] {
  const sections: CalibratedAxis[][] = [];
  let current: CalibratedAxis[] = [];
  for (const a of allAxes) {
    if (a.name === '0') {
      if (current.length > 0) sections.push(current);
      current = [];
    } else {
      current.push(a);
    }
  }
  if (current.length > 0) sections.push(current);
  return sections;
}

function filterToMainSection(
  found: Set<CalibratedAxis>, allAxes: CalibratedAxis[],
): Set<CalibratedAxis> {
  if (found.size <= 1) return found;
  const sections = splitSections(allAxes);
  if (sections.length <= 1) return found;
  let bestSec: CalibratedAxis[] = [];
  let bestN = 0;
  for (const sec of sections) {
    const s = new Set(sec);
    let n = 0;
    for (const a of found) if (s.has(a)) n++;
    if (n > bestN) { bestN = n; bestSec = sec; }
  }
  const bs = new Set(bestSec);
  const result = new Set<CalibratedAxis>();
  for (const a of found) if (bs.has(a)) result.add(a);
  return result;
}

/* ─── Из набора осей → from/to ─── */

function rangeFromSet(axes: Set<CalibratedAxis>): { from: string; to: string } | null {
  if (axes.size === 0) return null;
  let minA: CalibratedAxis | null = null, maxA: CalibratedAxis | null = null;
  for (const a of axes) {
    if (!minA || a.sort_order < minA.sort_order) minA = a;
    if (!maxA || a.sort_order > maxA.sort_order) maxA = a;
  }
  return { from: minA!.name, to: maxA!.name };
}

function formatRange(range: AxisRange, order: 'vh' | 'hv'): string | null {
  const parts: string[] = [];
  const first = order === 'vh' ? range.vertical : range.horizontal;
  const second = order === 'vh' ? range.horizontal : range.vertical;
  if (first) parts.push(first.from === first.to ? first.from : `${first.from}-${first.to}`);
  if (second) parts.push(second.from === second.to ? second.from : `${second.from}-${second.to}`);
  return parts.length > 0 ? parts.join('/') : null;
}

/* ─── Основной алгоритм ─── */

export function detectAxesForPolygons(
  polygons: Pt[][],
  calibratedAxes: CalibratedAxis[],
  axisOrder: 'vh' | 'hv' = 'vh',
): string | null {
  if (calibratedAxes.length === 0 || polygons.length === 0) return null;

  // Все оси (включая неоткалиброванные "0" — для секций и ±1)
  const allVert = calibratedAxes.filter((a) => a.direction === 'vertical');
  const allHorz = calibratedAxes.filter((a) => a.direction === 'horizontal');
  if (allVert.length === 0 && allHorz.length === 0) return null;

  // Откалиброванные не-"0" оси (для определения пересечений с областью)
  const realVert = allVert.filter((a) => a.name !== '0' && a.p1 && a.p2);
  const realHorz = allHorz.filter((a) => a.name !== '0' && a.p1 && a.p2);

  const maxVGap = maxAxisGap(realVert, 'x');
  const maxHGap = maxAxisGap(realHorz, 'y');

  const results: string[] = [];

  for (const polygon of polygons) {
    if (polygon.length < 3) continue;

    // ─── Шаг 1: оси, чьи отрезки пересекают область ───
    const crossingV = realVert.filter((a) => axisCrossesPolygon(a, polygon));
    const crossingH = realHorz.filter((a) => axisCrossesPolygon(a, polygon));

    // ─── Каждое направление обрабатываем независимо ───
    // Если оси пересекают полигон → ±1 расширение
    // Если нет → ищем ближайшие оси (nearby)

    // --- Вертикальные ---
    let filtV = new Set<CalibratedAxis>();
    let vNearby = false;
    if (crossingV.length > 0) {
      const verts = new Set<CalibratedAxis>(crossingV);
      const minV = crossingV.reduce((a, b) => a.sort_order < b.sort_order ? a : b);
      const maxV = crossingV.reduce((a, b) => a.sort_order > b.sort_order ? a : b);
      const minVIdx = allVert.findIndex((a) => a.sort_order === minV.sort_order);
      const maxVIdx = allVert.findIndex((a) => a.sort_order === maxV.sort_order);
      const prevV = findNeighbor(allVert, minVIdx, -1, minV, 'x', maxVGap);
      const nextV = findNeighbor(allVert, maxVIdx, 1, maxV, 'x', maxVGap);
      if (prevV) verts.add(prevV);
      if (nextV) verts.add(nextV);
      filtV = filterToMainSection(verts, allVert);
    } else {
      const threshV = maxVGap / 2;
      const nearbyV: CalibratedAxis[] = [];
      for (const a of realVert) {
        if (axisToPolygonDist(a, polygon) <= threshV) nearbyV.push(a);
      }
      if (nearbyV.length > 0) {
        filtV = filterToMainSection(new Set(nearbyV), allVert);
        vNearby = true;
      }
    }

    // --- Горизонтальные ---
    let filtH = new Set<CalibratedAxis>();
    let hNearby = false;
    if (crossingH.length > 0) {
      const horzs = new Set<CalibratedAxis>(crossingH);
      const minH = crossingH.reduce((a, b) => a.sort_order < b.sort_order ? a : b);
      const maxH = crossingH.reduce((a, b) => a.sort_order > b.sort_order ? a : b);
      const minHIdx = allHorz.findIndex((a) => a.sort_order === minH.sort_order);
      const maxHIdx = allHorz.findIndex((a) => a.sort_order === maxH.sort_order);
      const prevH = findNeighbor(allHorz, minHIdx, -1, minH, 'y', maxHGap);
      const nextH = findNeighbor(allHorz, maxHIdx, 1, maxH, 'y', maxHGap);
      if (prevH) horzs.add(prevH);
      if (nextH) horzs.add(nextH);
      filtH = filterToMainSection(horzs, allHorz);
    } else {
      const threshH = maxHGap / 2;
      const nearbyH: CalibratedAxis[] = [];
      for (const a of realHorz) {
        if (axisToPolygonDist(a, polygon) <= threshH) nearbyH.push(a);
      }
      if (nearbyH.length > 0) {
        filtH = filterToMainSection(new Set(nearbyH), allHorz);
        hNearby = true;
      }
    }

    // ─── Формируем результат ───
    if (filtV.size === 0 && filtH.size === 0) {
      results.push('за пределами строительных осей');
      continue;
    }

    const range: AxisRange = {
      vertical: rangeFromSet(filtV),
      horizontal: rangeFromSet(filtH),
    };

    // Если оба направления — nearby, формируем "возле оси ..."
    if (vNearby && hNearby) {
      const parts: string[] = [];
      const first = axisOrder === 'vh' ? range.vertical : range.horizontal;
      const second = axisOrder === 'vh' ? range.horizontal : range.vertical;
      if (first) parts.push(first.from === first.to ? first.from : `${first.from}-${first.to}`);
      if (second) parts.push(second.from === second.to ? second.from : `${second.from}-${second.to}`);
      if (parts.length > 0) {
        results.push(`возле оси ${parts.join('/')}`);
      } else {
        results.push('за пределами строительных осей');
      }
    } else {
      const formatted = formatRange(range, axisOrder);
      if (formatted) results.push(formatted);
    }
  }

  if (results.length === 0) return null;

  const unique = [...new Set(results)];
  const allOutside = unique.every((r) => r === 'за пределами строительных осей');
  if (allOutside) return 'область находится за пределами строительных осей';

  // Разделяем "в осях" и "возле оси"
  const inAxes = unique.filter((r) => !r.startsWith('возле') && r !== 'за пределами строительных осей');
  const nearAxes = unique.filter((r) => r.startsWith('возле'));
  const parts: string[] = [];
  if (inAxes.length > 0) parts.push(`в осях ${inAxes.join('; ')}`);
  if (nearAxes.length > 0) parts.push(...nearAxes);
  return parts.join('; ');
}
