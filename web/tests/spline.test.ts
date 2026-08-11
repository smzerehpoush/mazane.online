/**
 * مسیرساز SVG — جانشین کتابخانه‌ی نمودار (بند ۰ و ۶ سند طراحی).
 *
 * مرز تست: آرایه‌ی عدد ⟸ رشته‌ی `d`. هیچ DOM ای در کار نیست چون خودِ ماژول
 * هم به DOM کاری ندارد؛ همین است که اجازه می‌دهد سمت سرور صدا زده شود.
 */
import { describe, expect, it } from "vitest";

import { seriesPaths, spline, type Point } from "../src/lib/spline";

describe("spline", () => {
  it("کم‌تر از دو نقطه مسیری ندارد", () => {
    expect(spline([])).toBe("");
    expect(spline([[0, 0]])).toBe("");
  });

  it("از اولین نقطه شروع می‌کند و به آخرین نقطه می‌رسد", () => {
    const path = spline([
      [0, 10],
      [50, 20],
      [100, 5],
    ]);
    expect(path.startsWith("M0.0,10.0")).toBe(true);
    expect(path.endsWith("100.0,5.0")).toBe(true);
  });

  it("برای هر فاصله یک قطعه‌ی بزیه می‌سازد، نه polyline", () => {
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
   * ⚠️ نگهبان hydration: مسیر سمت سرور تولید و در HTML نشانده می‌شود. اگر
   * خروجی رقم اعشار کنترل‌نشده داشته باشد، کوچک‌ترین اختلاف شناور بین دو
   * محیط، صفت `d` را ناهمخوان می‌کند.
   */
  it("همه‌ی مختصات دقیقاً یک رقم اعشار دارند", () => {
    const path = spline([
      [0, 0],
      [33.333333, 66.666666],
      [100, 1 / 3],
    ]);
    for (const number of path.match(/-?\d+\.?\d*/g) ?? []) {
      expect(number, `«${number}» یک رقم اعشار ندارد`).toMatch(/^-?\d+\.\d$/);
    }
  });

  it("قطعی است — همان ورودی، همان خروجی", () => {
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

  it("سری کوتاه‌تر از دو نقطه هیچ مسیری نمی‌دهد (جای خالی حفظ می‌شود)", () => {
    expect(seriesPaths([], box)).toEqual({ line: null, area: null });
    expect(seriesPaths([18_500_000], box)).toEqual({ line: null, area: null });
  });

  it("ناحیه همان خط است که تا کف بسته شده", () => {
    const { line, area } = seriesPaths([1, 2, 3], box);
    expect(line).not.toBeNull();
    expect(area).toBe(`${line} L100.0,32.0 L0,32.0 Z`);
  });

  /** محور y معکوس است: بیشترین قیمت باید **بالاترین** نقطه باشد (y کمینه). */
  it("بیشینه‌ی سری بالاتر از کمینه رسم می‌شود", () => {
    const path = seriesPaths([10, 20], box).line ?? "";
    const [, startY, , endY] = path.match(/M[\d.]+,([\d.]+)[\s\S]*?([\d.]+),([\d.]+)$/) ?? [];
    expect(Number(startY)).toBeGreaterThan(Number(endY));
  });

  it("درون viewBox می‌ماند و به لبه نمی‌چسبد", () => {
    const path = seriesPaths([5, 100, 50, 1], { ...box, padding: 2 }).line ?? "";
    const ys = [...path.matchAll(/,(\d+\.\d)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...ys)).toBeLessThanOrEqual(30);
  });

  /**
   * سکویی که قیمتش در کل بازه ثابت مانده — تقسیم بر صفر می‌داد. خط وسط
   * درست است، نه بالا و نه پایین.
   */
  it("سری تخت را وسط می‌کشد، نه با تقسیم بر صفر", () => {
    const path = seriesPaths([18_500_000, 18_500_000, 18_500_000], box).line ?? "";
    expect(path).not.toContain("NaN");
    for (const y of [...path.matchAll(/,(\d+\.\d)/g)].map((m) => Number(m[1]))) {
      expect(y).toBe(16);
    }
  });

  it("مقیاس هر سری مستقل است — دو سری با شکل یکسان، مسیر یکسان می‌دهند", () => {
    // همان شکل، سطح قیمت کاملاً متفاوت (بند ۶: هدف شکل روند است نه سطح).
    expect(seriesPaths([1, 2, 3, 2], box)).toEqual(
      seriesPaths([18_000_000, 19_000_000, 20_000_000, 19_000_000], box),
    );
  });
});
