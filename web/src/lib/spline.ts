/**
 * ⚠️ اینجا هیچ فرمول قیمتی نیست. ورودی عددهای آماده‌ی
 * گردآورنده‌اند و خروجی مختصات پیکسلی — این نگاشت **مقیاس نمایش** است، نه
 * محاسبه‌ی قیمت. هیچ عددی از اینجا به کاربر نشان داده نمی‌شود؛ فقط شکل.
 */

export type Point = readonly [x: number, y: number];

/** ⚠️ گرد کردن به یک رقم اعشار عمدی است و دو دلیل دارد: */
function round(value: number): string {
  return value.toFixed(1);
}

export function spline(points: readonly Point[]): string {
  if (points.length < 2) return "";

  const first = points[0] as Point;
  let path = `M${round(first[0])},${round(first[1])}`;

  for (let index = 0; index < points.length - 1; index++) {
    const previous = points[index - 1] ?? (points[index] as Point);
    const start = points[index] as Point;
    const end = points[index + 1] as Point;
    const next = points[index + 2] ?? end;

    const c1x = start[0] + (end[0] - previous[0]) / 6;
    const c1y = start[1] + (end[1] - previous[1]) / 6;
    const c2x = end[0] - (next[0] - start[0]) / 6;
    const c2y = end[1] - (next[1] - start[1]) / 6;

    path += `C${round(c1x)},${round(c1y)} ${round(c2x)},${round(c2y)} ${round(end[0])},${round(end[1])}`;
  }

  return path;
}

export interface SeriesPaths {
  line: string | null;
  area: string | null;
}

export interface SeriesShapeOptions {
  width: number;
  height: number;
  padding?: number;
}

/**
 * ⚠️ نرمال‌سازی محور عمودی **برای هر سری مستقل** است (کمینه/بیشینه‌ی خودِ همان
 * سری — ). هدف نشان‌دادن *شکل روند* است نه سطح قیمت، و اگر همه‌ی
 * اسپارک‌لاین‌ها یک مقیاس مشترک بگیرند، سکویی که نوسانش کم است خط صاف نشان
 * می‌دهد و اطلاعات از دست می‌رود.
 */
export function seriesPaths(values: readonly number[], options: SeriesShapeOptions): SeriesPaths {
  const { width, height, padding = 2 } = options;
  if (values.length < 2) return { line: null, area: null };

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const usableHeight = height - padding * 2;
  const span = max - min;
  const stepX = width / (values.length - 1);

  const points: Point[] = values.map((value, index) => [
    index * stepX,
    span === 0 ? height / 2 : padding + (1 - (value - min) / span) * usableHeight,
  ]);

  const line = spline(points);
  if (line === "") return { line: null, area: null };

  return { line, area: `${line} L${round(width)},${round(height)} L0,${round(height)} Z` };
}
