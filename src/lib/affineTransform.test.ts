import { describe, it, expect } from "vitest";
import { computeAffine, applyAffine } from "./affineTransform";

describe("computeAffine", () => {
  it("единичное преобразование — src === dst", () => {
    const pts: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    const m = computeAffine(pts, pts);
    expect(m.a).toBeCloseTo(1);
    expect(m.b).toBeCloseTo(0);
    expect(m.c).toBeCloseTo(0);
    expect(m.d).toBeCloseTo(0);
    expect(m.e).toBeCloseTo(1);
    expect(m.f).toBeCloseTo(0);
  });

  it("сдвиг на (10, 20)", () => {
    const src: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    const dst: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
      { x: 10, y: 20 },
      { x: 11, y: 20 },
      { x: 10, y: 21 },
    ];
    const m = computeAffine(src, dst);
    expect(m.c).toBeCloseTo(10);
    expect(m.f).toBeCloseTo(20);
  });

  it("масштабирование x2", () => {
    const src: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    const dst: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
    ];
    const m = computeAffine(src, dst);
    expect(m.a).toBeCloseTo(2);
    expect(m.e).toBeCloseTo(2);
  });

  it("коллинеарные точки → единичная матрица", () => {
    const src: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];
    const dst: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];
    const m = computeAffine(src, dst);
    expect(m.a).toBe(1);
    expect(m.e).toBe(1);
  });
});

describe("applyAffine", () => {
  it("применяет единичное преобразование", () => {
    const m = { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 };
    const result = applyAffine(m, { x: 5, y: 7 });
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(7);
  });

  it("применяет сдвиг", () => {
    const m = { a: 1, b: 0, c: 10, d: 0, e: 1, f: -5 };
    const result = applyAffine(m, { x: 3, y: 4 });
    expect(result.x).toBeCloseTo(13);
    expect(result.y).toBeCloseTo(-1);
  });

  it("round-trip: compute → apply даёт dst-точки", () => {
    const src: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
      { x: 100, y: 200 },
      { x: 300, y: 200 },
      { x: 100, y: 400 },
    ];
    const dst: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [
      { x: 0, y: 0 },
      { x: 50, y: 10 },
      { x: -10, y: 50 },
    ];
    const m = computeAffine(src, dst);

    for (let i = 0; i < 3; i++) {
      const result = applyAffine(m, src[i]);
      expect(result.x).toBeCloseTo(dst[i].x, 5);
      expect(result.y).toBeCloseTo(dst[i].y, 5);
    }
  });
});
