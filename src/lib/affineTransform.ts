/**
 * Аффинное преобразование по 3 парам точек.
 * x' = a*x + b*y + c
 * y' = d*x + e*y + f
 */

interface Point {
  x: number;
  y: number;
}

interface AffineMatrix {
  a: number; b: number; c: number;
  d: number; e: number; f: number;
}

/**
 * Вычисляет аффинную матрицу по 3 парам соответствующих точек.
 * src[i] → dst[i]
 */
export function computeAffine(src: [Point, Point, Point], dst: [Point, Point, Point]): AffineMatrix {
  // Решаем систему:
  // [x1 y1 1]   [a]   [x1']
  // [x2 y2 1] * [b] = [x2']
  // [x3 y3 1]   [c]   [x3']
  // и аналогично для d,e,f с y'

  const { x: x1, y: y1 } = src[0];
  const { x: x2, y: y2 } = src[1];
  const { x: x3, y: y3 } = src[2];

  // Определитель матрицы
  const det = x1 * (y2 - y3) - y1 * (x2 - x3) + (x2 * y3 - x3 * y2);

  if (Math.abs(det) < 1e-12) {
    // Вырожденный случай — точки коллинеарны, возвращаем единичную матрицу
    return { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 };
  }

  // Обратная матрица (правило Крамера / адъюнкт)
  const invDet = 1 / det;

  // Коэффициенты обратной матрицы
  const m00 = (y2 - y3) * invDet;
  const m01 = (y3 - y1) * invDet;
  const m02 = (y1 - y2) * invDet;
  const m10 = (x3 - x2) * invDet;
  const m11 = (x1 - x3) * invDet;
  const m12 = (x2 - x1) * invDet;
  const m20 = (x2 * y3 - x3 * y2) * invDet;
  const m21 = (x3 * y1 - x1 * y3) * invDet;
  const m22 = (x1 * y2 - x2 * y1) * invDet;

  // Для X-координат
  const a = m00 * dst[0].x + m01 * dst[1].x + m02 * dst[2].x;
  const b = m10 * dst[0].x + m11 * dst[1].x + m12 * dst[2].x;
  const c = m20 * dst[0].x + m21 * dst[1].x + m22 * dst[2].x;

  // Для Y-координат
  const d = m00 * dst[0].y + m01 * dst[1].y + m02 * dst[2].y;
  const e = m10 * dst[0].y + m11 * dst[1].y + m12 * dst[2].y;
  const f = m20 * dst[0].y + m21 * dst[1].y + m22 * dst[2].y;

  return { a, b, c, d, e, f };
}

/** Применить аффинное преобразование к точке */
export function applyAffine(m: AffineMatrix, p: Point): Point {
  return {
    x: m.a * p.x + m.b * p.y + m.c,
    y: m.d * p.x + m.e * p.y + m.f,
  };
}
