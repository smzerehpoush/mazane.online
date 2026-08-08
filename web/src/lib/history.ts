/**
 * تاریخچه‌ی قیمت مرجع سکوها — داده‌ی نمودار بالای صفحه‌ی اصلی.
 *
 * آینه‌ی `lib/prices.ts` و `lib/blog.ts`: اینجا فقط قرارداد و قاعده‌ی نمایش
 * است؛ پیاده‌سازی پستگرس در `server/history-source.ts` خودش را با
 * `setDefaultHistorySource` ثبت می‌کند، پس این فایل هیچ وابستگی نودی ندارد و
 * از هر دو سو import شدنش بی‌خطر است.
 *
 * قاعده‌ی ۱ قراردادها اینجا هم برقرار است: **هیچ فرمولی نیست.** هر نقطه‌ی
 * سری همان عددی است که گردآورنده در `hourly_rollups` نوشته و به یک سکوی
 * نام‌برده منتسب است؛ هیچ میانگین بین‌سکویی‌ای ساخته نمی‌شود (قاعده‌ی ۴).
 */

/**
 * کدام سطر تجمیع خوانده شد.
 *
 * `MEAN` قیمت مرجع سکوست (تصمیم مالک ۲۰۲۶-۰۸-۰۶). تا وقتی گردآورنده آن را
 * ننوشته، `MID` جای آن می‌نشیند — fallback صادقانه، چون برای سکوی تک‌قیمتی
 * مرجع دقیقاً همان تک‌عدد است. برای سکوی دوقیمتی این تقریب است و باید با
 * نوشته‌شدن MEAN جایش را بدهد.
 */
export type ReferenceSide = "MEAN" | "MID";

export interface HistoryPoint {
  /** آغاز ساعت — ISO-8601 با منطقه‌ی زمانی، ارقام لاتین (قالب‌بندی با لایه‌ی نمایش). */
  hour: string;
  /** قیمت مرجع همان سکو در بسته‌شدن آن ساعت، تومان. */
  value: number;
}

export interface PlatformHistory {
  platform_slug: string;
  /** صعودی بر حسب ساعت. خالی = این سکو در بازه سابقه‌ای ندارد. */
  points: HistoryPoint[];
  /** مقدار آخرین نقطه — null یعنی هیچ نقطه‌ای نیست. */
  latest: number | null;
  /** سطری که واقعاً خوانده شد؛ null یعنی هیچ سطری نبود. */
  side_used: ReferenceSide | null;
  /**
   * برای هر سری‌ای که از تجمیع ساعتی یا از سطرهای خام نمونه‌برداری شده پر
   * می‌شود (هفتگی/ماهانه گام ۲/۸ ساعته — بلیت ۳۰؛ روزانه گام ۱۵دقیقه‌ای از
   * `quotes` — بلیت ۳۴) — آیا دست‌کم نیمی از سطل‌های کل پنجره نمونه‌ی واقعی
   * داشتند (نه forward-fill)؟ دروازه‌ی «به‌زودی» زبانه‌ی هفتگی/ماهانه‌ی کارت
   * نرخ همین را می‌خواند؛ زبانه‌ی روزانه همیشه فعال است و این مقدار را
   * نادیده می‌گیرد، هرچند پر باشد.
   */
  has_enough_coverage?: boolean;
}

export interface HistoryQuery {
  /** ترتیب خروجی دقیقاً همین ترتیب است — سکوی بی‌داده هم ردیف خالی می‌گیرد. */
  platformSlugs: string[];
  /** کد دارایی — مثلاً "GOLD_18K". */
  instrument: string;
  /** پنجره‌ی زمانی به ساعت (نمودار صفحه‌ی اصلی: ۲۴). */
  hours: number;
  /**
   * گام نمونه‌برداری به ساعت روی تجمیع ساعتیِ `hourly_rollups` (بلیت ۳۰:
   * هفتگی ۲، ماهانه ۸) — هر سطل فقط آخرین نمونه‌اش را نگه می‌دارد (قاعده‌ی
   * ۱: بدون میانگین). **نبودش یعنی «روزانه» (بلیت ۳۴)**: پرس‌وجوی جداگانه
   * از سطرهای خام `quotes` با گام ۱۵ دقیقه — همان قاعده‌ی «آخرین نمونه‌ی هر
   * سطل»، فقط دانه‌بندی ریزتر و از جدول دیگر (`server/history-source.ts`
   * تصمیم می‌گیرد کدام مسیر برود؛ این فایل فقط قرارداد را می‌دهد).
   */
  stepHours?: number;
}

/** سه بازه‌ی نمودار کارت نرخ صفحه‌ی سکو (بلیت ۳۰) — همیشه همین سه‌تا، همین ترتیب. */
export type HistoryRange = "DAILY" | "WEEKLY" | "MONTHLY";

export const HISTORY_RANGES: readonly HistoryRange[] = ["DAILY", "WEEKLY", "MONTHLY"];

/** تاریخچه‌ی هر سه بازه برای یک سکو — ورودی کارت نرخ صفحه‌ی سکو (بلیت ۳۰). */
export type PlatformHistoryByRange = Record<HistoryRange, PlatformHistory | null>;

export interface HistorySource {
  getPlatformHistory(query: HistoryQuery): Promise<PlatformHistory[]>;
}

export type HistorySourceFactory = () => HistorySource;

let activeSource: HistorySource | null = null;
let defaultFactory: HistorySourceFactory | null = null;

/** تزریق منبع — در تست‌ها فیک seed شده. */
export function setHistorySource(source: HistorySource): void {
  activeSource = source;
}

/** ثبت سازنده‌ی منبع پیش‌فرض (پستگرس) — تنبل. */
export function setDefaultHistorySource(factory: HistorySourceFactory): void {
  defaultFactory = factory;
}

/** پاک‌کردن تزریق — برای جداسازی تست‌ها. */
export function resetHistorySource(): void {
  activeSource = null;
}

function source(): HistorySource {
  if (activeSource !== null) return activeSource;
  if (defaultFactory === null) {
    throw new Error(
      "هیچ HistorySource ثبت نشده — از «@/lib/server/history-source» بخوان یا setHistorySource صدا بزن",
    );
  }
  activeSource = defaultFactory();
  return activeSource;
}

/** ردیف تهی یک سکو — نمودار خط ندارد ولی صفحه ۲۰۰ می‌ماند. */
function emptyHistory(platformSlug: string): PlatformHistory {
  return { platform_slug: platformSlug, points: [], latest: null, side_used: null };
}

/**
 * سری زمانی قیمت مرجع سکوهای خواسته‌شده.
 *
 * قطع پستگرس ⟸ کهنگی، نه خطا (قاعده‌ی ۵): نمودار خالی رندر می‌شود و صفحه
 * ۲۰۰ می‌ماند. build هم بیرون از سرور و بدون پستگرس اجرا می‌شود (تصمیم ۵)،
 * پس همین مسیرِ خالی است که بیلد را سبز نگه می‌دارد.
 */
export async function getPlatformHistory(query: HistoryQuery): Promise<PlatformHistory[]> {
  try {
    return await source().getPlatformHistory(query);
  } catch (error) {
    console.error("history source unavailable; rendering empty chart", error);
    return query.platformSlugs.map(emptyHistory);
  }
}
