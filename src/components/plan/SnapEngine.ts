export interface Point {
  x: number;
  y: number;
}

export interface SnapResult {
  point: Point;
  snapped: boolean;
  type: "vertex" | "edge" | "none";
}

/** Расстояние между двумя точками */
function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Проекция точки на отрезок [a, b]. Возвращает ближайшую точку на отрезке и расстояние. */
function projectOntoSegment(p: Point, a: Point, b: Point): { point: Point; dist: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return { point: a, dist: dist(p, a) };
  }

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const proj: Point = { x: a.x + t * dx, y: a.y + t * dy };
  return { point: proj, dist: dist(p, proj) };
}

/**
 * Находит ближайшую точку привязки среди существующих полигонов.
 *
 * @param cursor - текущая позиция курсора (нормализованные координаты 0-1)
 * @param existingPolygons - массив полигонов (каждый — массив точек)
 * @param thresholdNorm - порог привязки в нормализованных единицах
 * @returns результат привязки
 */
export function findSnap(
  cursor: Point,
  existingPolygons: Point[][],
  thresholdNorm: number,
): SnapResult {
  let closestVertex: Point | null = null;
  let closestVertexDist = Infinity;

  let closestEdge: Point | null = null;
  let closestEdgeDist = Infinity;

  for (const polygon of existingPolygons) {
    // Привязка к вершинам
    for (const vertex of polygon) {
      const d = dist(cursor, vertex);
      if (d < thresholdNorm && d < closestVertexDist) {
        closestVertexDist = d;
        closestVertex = vertex;
      }
    }

    // Привязка к рёбрам
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const proj = projectOntoSegment(cursor, a, b);
      if (proj.dist < thresholdNorm && proj.dist < closestEdgeDist) {
        closestEdgeDist = proj.dist;
        closestEdge = proj.point;
      }
    }
  }

  // Приоритет: вершина > ребро > без привязки
  if (closestVertex) {
    return { point: closestVertex, snapped: true, type: "vertex" };
  }

  if (closestEdge) {
    return { point: closestEdge, snapped: true, type: "edge" };
  }

  return { point: cursor, snapped: false, type: "none" };
}

/**
 * Вычислить порог привязки в нормализованных координатах
 * на основе размера контейнера и желаемого порога в пикселях.
 */
export function calcThreshold(containerWidth: number, snapPx: number = 10): number {
  if (containerWidth <= 0) return 0.02;
  return snapPx / containerWidth;
}
