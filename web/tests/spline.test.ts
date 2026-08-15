import { describe, expect, it } from "vitest";

import { seriesPaths, spline, type Point } from "../src/lib/spline";

describe("spline", () => {
  it("fewer than two points gives no path", () => {
    expect(spline([])).toBe("");
    expect(spline([[0, 0]])).toBe("");
  });

  it("starts at the first point and ends at the last point", () => {
    const path = spline([
      [0, 10],
      [50, 20],
      [100, 5],
    ]);
    expect(path.startsWith("M0.0,10.0")).toBe(true);
    expect(path.endsWith("100.0,5.0")).toBe(true);
  });

  it("builds one bezier segment per gap, not a polyline", () => {
    const path = spline([
      [0, 0],
      [10, 10],
      [20, 0],
      [30, 10],
    ]);
    expect(path.match(/C/g)).toHaveLength(3);
    expect(path).not.toContain("L");
  });

  /**
   * ⚠️ Hydration guard: the path is generated server-side and embedded in the
   * HTML. If the output has uncontrolled decimal digits, the smallest
   * floating-point difference between the two environments will make the
   * `d` attribute mismatch.
   */
  it("every coordinate has exactly one decimal digit", () => {
    const path = spline([
      [0, 0],
      [33.333333, 66.666666],
      [100, 1 / 3],
    ]);
    for (const number of path.match(/-?\d+\.?\d*/g) ?? []) {
      expect(number, `«${number}» یک رقم اعشار ندارد`).toMatch(/^-?\d+\.\d$/);
    }
  });

  it("is deterministic — same input, same output", () => {
    const points: Point[] = [
      [0, 4],
      [25, 9],
      [50, 2],
    ];
    expect(spline(points)).toBe(spline([...points]));
  });
});

describe("seriesPaths", () => {
  const box = { width: 100, height: 32 };

  it("a series shorter than two points gives no path (the placeholder is preserved)", () => {
    expect(seriesPaths([], box)).toEqual({ line: null, area: null });
    expect(seriesPaths([18_500_000], box)).toEqual({ line: null, area: null });
  });

  it("the area is the same line closed down to the floor", () => {
    const { line, area } = seriesPaths([1, 2, 3], box);
    expect(line).not.toBeNull();
    expect(area).toBe(`${line} L100.0,32.0 L0,32.0 Z`);
  });

  it("the series maximum is drawn above the minimum", () => {
    const path = seriesPaths([10, 20], box).line ?? "";
    const [, startY, , endY] = path.match(/M[\d.]+,([\d.]+)[\s\S]*?([\d.]+),([\d.]+)$/) ?? [];
    expect(Number(startY)).toBeGreaterThan(Number(endY));
  });

  it("stays inside the viewBox and doesn't touch the edge", () => {
    const path = seriesPaths([5, 100, 50, 1], { ...box, padding: 2 }).line ?? "";
    const ys = [...path.matchAll(/,(\d+\.\d)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...ys)).toBeLessThanOrEqual(30);
  });

  it("draws a flat series through the middle, not via division by zero", () => {
    const path = seriesPaths([18_500_000, 18_500_000, 18_500_000], box).line ?? "";
    expect(path).not.toContain("NaN");
    for (const y of [...path.matchAll(/,(\d+\.\d)/g)].map((m) => Number(m[1]))) {
      expect(y).toBe(16);
    }
  });

  it("each series scales independently — two series with the same shape give the same path", () => {
    expect(seriesPaths([1, 2, 3, 2], box)).toEqual(
      seriesPaths([18_000_000, 19_000_000, 20_000_000, 19_000_000], box),
    );
  });
});
