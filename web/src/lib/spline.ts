/**
 * مسیر SVG منحنی — تنها تولیدکننده‌ی نمودار در کل سایت.
 *
 * جای کتابخانه‌ی نمودار را می‌گیرد (بند ۰ سند طراحی: «کتابخانه‌ی نمودار ندارد و
 * اضافه نمی‌شود»). دو مصرف‌کننده دارد و هر دو **سمت سرور** صدایش می‌زنند:
 * اسپارک‌لاین کارت منبع (بند ۶) و نمودار سطحی خلاصه بازار (بند ۷).
 *
 * چرا سمت سرور: مسیر باید در همان HTML اولیه باشد، وگرنه نمودار تا hydration
 * خالی است و با جاوااسکریپت خاموش هرگز نمی‌آید. این ماژول عمداً هیچ وابستگی
 * به ری‌اکت/DOM/نود ندارد تا از هر دو سو import شدنش بی‌خطر باشد.
 *
 * ⚠️ قاعده‌ی سخت ۱ قراردادها: اینجا هیچ فرمول قیمتی نیست. ورودی عددهای آماده‌ی
 * گردآورنده‌اند و خروجی مختصات پیکسلی — این نگاشت **مقیاس نمایش** است، نه
 * محاسبه‌ی قیمت. هیچ عددی از اینجا به کاربر نشان داده نمی‌شود؛ فقط شکل.
 */

/** یک نقطه‌ی مختصات در فضای `viewBox`. */
export type Point = readonly [x: number, y: number];

/**
 * ⚠️ گرد کردن به یک رقم اعشار عمدی است و دو دلیل دارد:
 *
 *   ۱. حجم — مسیر ۹۶ نقطه‌ای با اعشار کامل شناور به‌راحتی چند کیلوبایت
 *      می‌شود و این رشته داخل HTML سروررندر می‌نشیند.
 *   ۲. **قطعیت** — خروجی خام شناور می‌تواند بین معماری‌ها در رقم آخر فرق کند
 *      و آن یعنی hydration mismatch روی صفت `d`. یک رقم اعشار در فضای
 *      viewBox صد واحدی، زیر یک پیکسل است و هیچ اثر بصری ندارد.
 */
function round(value: number): string {
  return value.toFixed(1);
}

/**
 * نقاط ⟸ مسیر بزیه با اسپلاین Catmull-Rom (بند ۶ سند طراحی).
 *
 * چرا اسپلاین و نه `polyline`: سری قیمت با خط شکسته «دندانه‌دار» دیده می‌شود و
 * نوسان را بزرگ‌تر از چیزی که هست نشان می‌دهد. منحنی هموار همان داده را بدون
 * آن اغراق بصری می‌کشد.
 *
 * نقاط انتهایی خودشان را تکرار می‌کنند (`pts[i-1] || pts[i]`) — قرارداد
 * استاندارد Catmull-Rom برای دو سر باز، تا منحنی از اولین و آخرین نقطه
 * دقیقاً عبور کند.
 *
 * کم‌تر از دو نقطه ⟸ رشته‌ی تهی. مصرف‌کننده باید همین را «خطی نکش» بفهمد و
 * جای خالی نمودار را نگه دارد (بند ۱۱: «بدون داده‌ی تاریخچه»).
 */
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
  /** مسیر خط — `null` یعنی داده‌ای برای کشیدن نیست. */
  line: string | null;
  /** همان مسیر، بسته‌شده تا کف نمودار برای ناحیه‌ی رنگی. */
  area: string | null;
}

export interface SeriesShapeOptions {
  /** عرض `viewBox`. */
  width: number;
  /** ارتفاع `viewBox`. */
  height: number;
  /**
   * فاصله‌ی بالا و پایین منحنی از لبه‌ی `viewBox`. بدون آن، بیشینه و کمینه
   * دقیقاً روی لبه می‌افتند و ضخامت خط نصف می‌شود (بریدگی دیداری).
   */
  padding?: number;
}

/**
 * سری عددی ⟸ دو مسیر آماده‌ی SVG (خط و ناحیه).
 *
 * ⚠️ نرمال‌سازی محور عمودی **برای هر سری مستقل** است (کمینه/بیشینه‌ی خودِ همان
 * سری — بند ۶). هدف نشان‌دادن *شکل روند* است نه سطح قیمت، و اگر همه‌ی
 * اسپارک‌لاین‌ها یک مقیاس مشترک بگیرند، سکویی که نوسانش کم است خط صاف نشان
 * می‌دهد و اطلاعات از دست می‌رود.
 *
 * سری تخت (همه‌ی مقادیر برابر) ⟸ خط وسط، نه تقسیم بر صفر.
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
    // سری تخت: وسط. وگرنه بالاترین مقدار بالای نمودار می‌نشیند (y معکوس است).
    span === 0 ? height / 2 : padding + (1 - (value - min) / span) * usableHeight,
  ]);

  const line = spline(points);
  if (line === "") return { line: null, area: null };

  return { line, area: `${line} L${round(width)},${round(height)} L0,${round(height)} Z` };
}
