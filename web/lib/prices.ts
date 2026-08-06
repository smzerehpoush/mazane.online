/**
 * ماژول دسترسی به داده — تنها راه لایه‌ی وب برای خواندن قیمت.
 *
 * وب هیچ فرمولی ندارد: هرچه اینجا برمی‌گردد همان است که گردآورنده ذخیره
 * کرده (قیمت‌های مؤثر از قبل محاسبه‌شده‌اند). شکل داده آینه‌ی JSON کانونی
 * `PlatformSnapshot` در گردآورنده است (Decimal ها رشته‌اند).
 *
 * مرز تست وب همین‌جاست: تست‌ها با `setPriceSource` منبع seed شده تزریق
 * می‌کنند؛ در اجرا، پیش‌فرضِ تنبل ردیس است (`redis-source.ts`).
 */

export type Side = "BUY" | "SELL" | "MID";
/**
 * `UNKNOWN` یعنی سکو کارمزدش را نه در API می‌دهد و نه جایی منتشر کرده
 * (ملی‌گلد، دیجی‌کالا، همراه‌گلد): گردآورنده فقط MID می‌نویسد و قیمت مؤثر
 * جعل نمی‌شود — «یک ردیف صادقانه با نامشخص بهتر از عدد ساختگی».
 */
export type FeeSource = "API" | "MANUAL" | "UNKNOWN";
export type DataPolicy = "ALLOWED" | "RESTRICTED" | "PERMISSION_PENDING" | "BLOCKED";
/**
 * مدل معاملاتی سکو (بند ۹.۲): داریک دفتر سفارش است، بقیه فروشنده (OTC).
 * قیمت دفتر سفارش از سفارش کاربران می‌آید و اسپردش با بقیه هم‌جنس نیست —
 * باید در جدول برچسب صریح بخورد.
 */
export type MarketModel = "OTC" | "ORDER_BOOK";

/**
 * یک سکوی قابل نمایش عمومی — عضو فهرستی که گردآورنده می‌نویسد.
 * فیلتر نمایش (گلدیکا و هر PERMISSION_PENDING دیگر) سمت گردآورنده/استور
 * اعمال شده؛ وب هرچه در فهرست است را رندر می‌کند و بس.
 */
export interface ListedPlatform {
  slug: string;
  name_fa: string;
  data_policy: DataPolicy;
  /** غیبت = OTC — پیش از مهاجرت ۰۰۴ این فیلد در payload نبود. */
  market_model?: MarketModel;
}

export interface Quote {
  platform_slug: string;
  instrument: string;
  side: Side;
  price_toman: number;
  raw_value: string;
  raw_scale: string;
  fetched_at: string;
}

export interface PlatformTerms {
  platform_slug: string;
  /** فقط با `fee_source = "UNKNOWN"` تهی‌اند؛ در آن حالت هر سه تهی‌اند. */
  buy_fee_percent: string | null;
  sell_fee_percent: string | null;
  round_trip_percent: string | null;
  fee_source: FeeSource;
  buy_enabled: boolean;
  sell_enabled: boolean;
  observed_at: string;
  /**
   * حدنصاب سفارش به تومان — گردآورنده هنوز نمی‌فرستد؛ اختیاری تا وقتی
   * به payload اضافه شد، بدون تغییر این لایه رندر شود (غیبتش تحمل می‌شود).
   */
  min_order_toman?: string | number | null;
}

export interface PlatformSnapshot {
  platform_slug: string;
  quotes: Quote[];
  terms: PlatformTerms;
  fetched_at: string;
  /**
   * رد چک میانه‌ی گردآورنده. اسنپ‌شات سرکوب‌شده هرگز به استور جاری (و در
   * نتیجه به این لایه) نمی‌رسد؛ فیلد فقط برای آینگی کامل با JSON کانونی است.
   */
  suppressed: boolean;
}

export interface PriceSource {
  getListedPlatforms(): Promise<ListedPlatform[]>;
  getSnapshot(platformSlug: string): Promise<PlatformSnapshot | null>;
  getUpdatedAt(platformSlug: string): Promise<string | null>;
}

let activeSource: PriceSource | null = null;

/** تزریق منبع داده — در تست‌ها فیک seed شده، در صورت نیاز در اجرا هم. */
export function setPriceSource(source: PriceSource): void {
  activeSource = source;
}

async function source(): Promise<PriceSource> {
  if (activeSource === null) {
    // import پویا تا در تست‌ها (که منبع تزریق می‌شود) ioredis اصلاً load نشود.
    const { createRedisSource } = await import("./redis-source");
    activeSource = createRedisSource();
  }
  return activeSource;
}

export async function getListedPlatforms(): Promise<ListedPlatform[]> {
  return (await source()).getListedPlatforms();
}

export async function getPlatformSnapshot(
  platformSlug: string,
): Promise<PlatformSnapshot | null> {
  return (await source()).getSnapshot(platformSlug);
}

export async function getUpdatedAt(platformSlug: string): Promise<string | null> {
  return (await source()).getUpdatedAt(platformSlug);
}
