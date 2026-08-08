/**
 * مرجع قیمت — نوار «نرخ اتحادیه» صفحه‌ی سکو (تیکت ۳۳).
 *
 * آینه‌ی `lib/history.ts`: اینجا فقط قرارداد و تزریق منبع است؛ پیاده‌سازی
 * پستگرس در `server/reference-price-source.ts` خودش را با
 * `setDefaultReferencePriceSource` ثبت می‌کند، پس این فایل هیچ وابستگی نودی
 * ندارد و از هر دو سو import شدنش بی‌خطر است.
 *
 * قاعده‌ی ۱ قراردادها اینجا هم برقرار است: **هیچ فرمولی نیست.** عدد همان
 * چیزی است که گردآورنده در `hourly_rollups` (kind='REFERENCE') نوشته.
 *
 * ⚠️ این عدد **مرجع قیمت** است، نه قیمت هیچ سکویی — در هیچ محاسبه‌ای شرکت
 * نمی‌کند و به‌عنوان قیمت هیچ سکویی نمایش داده نمی‌شود (قاعده‌ی ۴ قراردادها:
 * بدون میانگین بین‌سکویی، هر عدد به یک منبع نام‌برده منتسب است). برچسب
 * نمایشی «نرخ اتحادیه» روی این عدد تصمیم ثبت‌شده‌ی مالک است — سند
 * `docs/adr/0001-etehadieh-label-on-talair-number.md`.
 */

export interface ReferencePriceQuery {
  /** اسلاگ منبع در `hourly_rollups`/`reference_quotes` — امروز فقط "talair". */
  referenceSlug: string;
  /** کد دارایی مرجع — واحدش با کد سکوها فرق دارد؛ امروز فقط "GOLD_18K_TOMAN" لازم است. */
  instrument: string;
}

export interface ReferencePrice {
  reference_slug: string;
  instrument: string;
  /** آخرین عدد ثبت‌شده — همان `close_value` همان ساعت، بدون هیچ محاسبه‌ای. */
  value: number;
  /** آغاز ساعتی که این عدد در آن بسته شده — مبنای «زمان خوانده‌شدن» نوار. */
  read_at: string;
}

export interface ReferencePriceSource {
  getReferencePrice(query: ReferencePriceQuery): Promise<ReferencePrice | null>;
}

export type ReferencePriceSourceFactory = () => ReferencePriceSource;

let activeSource: ReferencePriceSource | null = null;
let defaultFactory: ReferencePriceSourceFactory | null = null;

/** تزریق منبع — در تست‌ها فیک seed شده. */
export function setReferencePriceSource(source: ReferencePriceSource): void {
  activeSource = source;
}

/** ثبت سازنده‌ی منبع پیش‌فرض (پستگرس) — تنبل. */
export function setDefaultReferencePriceSource(factory: ReferencePriceSourceFactory): void {
  defaultFactory = factory;
}

/** پاک‌کردن تزریق — برای جداسازی تست‌ها. */
export function resetReferencePriceSource(): void {
  activeSource = null;
}

function source(): ReferencePriceSource {
  if (activeSource !== null) return activeSource;
  if (defaultFactory === null) {
    throw new Error(
      "هیچ ReferencePriceSource ثبت نشده — از «@/lib/server/reference-price-source» بخوان یا setReferencePriceSource صدا بزن",
    );
  }
  activeSource = defaultFactory();
  return activeSource;
}

/**
 * آخرین مقدار مرجع قیمت خواسته‌شده.
 *
 * قطع پستگرس ⟸ کهنگی، نه خطا (قاعده‌ی ۵): `null` برمی‌گردد و نوار «نرخ
 * اتحادیه» اصلاً رندر نمی‌شود؛ صفحه ۲۰۰ می‌ماند. build هم بیرون از سرور و
 * بدون پستگرس اجرا می‌شود، پس همین مسیرِ خالی است که بیلد را سبز نگه می‌دارد.
 */
export async function getReferencePrice(
  query: ReferencePriceQuery,
): Promise<ReferencePrice | null> {
  try {
    return await source().getReferencePrice(query);
  } catch (error) {
    console.error("reference price source unavailable; hiding union rate bar", error);
    return null;
  }
}
