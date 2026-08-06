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
  /**
   * فراداده‌ی صفحه‌ی سکو (بلیت ۷) — گردآورنده فقط از سند تحقیق ۰۱ پرشان
   * می‌کند؛ جای نامستند null است و وب همان «ثبت نشده» را می‌گوید، جعل نمی‌کند.
   * اختیاری تا payload قدیمی‌تر بدون این کلیدها هم رندر شود.
   */
  name_en?: string | null;
  website_url?: string | null;
  legal_entity?: string | null;
  delivery_note_fa?: string | null;
  /**
   * لینک معرف (بلیت ۹؛ بند ۱۳، تصمیم ۲۱) — مقصد ‎/go/<slug>‎ وقتی کد معرف
   * مالک رسیده باشد؛ تا آن روز null است و ‎/go/‎ به website_url می‌رود.
   * الگوی پارامتر هر سکو (referralCode / r / invitation؛ گلدیکا ندارد) در
   * referral_param مستند است — پارامترِ بی‌کد، برای ساختن referral_url بعدی.
   *
   * ⚠️ بند ۶.۴ (الزام غیرقابل‌مذاکره): این دو فیلد **هرگز** ورودی
   * مرتب‌سازی نیستند — groupRows/editorialPick فقط قیمت و کارمزد گردآورنده
   * را می‌خوانند؛ تستش در tests/sponsored-links.test.tsx است.
   */
  referral_url?: string | null;
  referral_param?: string | null;
}

/**
 * یک دارایی از payload ‏`mazane:instruments` — موجودیت کامل با وضعیت
 * دروازه‌ی انتشار (بند ۱۳، تصمیم ۱۰). `published` در گردآورنده محاسبه شده
 * (دست‌کم دو سکوی پشتیبانِ قابل نمایش)؛ وب فقط پرچم را می‌خواند:
 * published=false ⟸ 404 و غایب از سایت‌مپ.
 */
export interface InstrumentListing {
  /** لاتین و تخت — عضو جدول مرکزی اسلاگ (تصمیم ۱۱). */
  slug: string;
  /** کد دارایی — همان مقدار `instrument` سطرهای Quote (مثلاً "GOLD_18K"). */
  instrument: string;
  name_fa: string;
  unit_fa: string;
  purity: string | null;
  currency: string;
  supporting_platform_slugs: string[];
  published: boolean;
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
  /**
   * قیمت مرجع این سکو به‌ازای هر کد دارایی = میانگین مؤثر خرید و فروش
   * **خودِ همین سکو** (بند ۱۳، تصمیم ۱۹) — در گردآورنده محاسبه شده؛ اینجا
   * فقط انتخاب می‌شود. دارایی بدون هر دو سمت کلید ندارد (جعل نمی‌شود) و
   * هیچ میانگین بین‌سکویی‌ای در هیچ لایه‌ای وجود ندارد. اختیاری تا payload
   * قدیمی‌تر بدون این کلید هم رندر شود.
   */
  reference_prices_toman?: Record<string, number>;
}

export interface PriceSource {
  getListedPlatforms(): Promise<ListedPlatform[]>;
  getSnapshot(platformSlug: string): Promise<PlatformSnapshot | null>;
  getUpdatedAt(platformSlug: string): Promise<string | null>;
  /**
   * payload ‏`mazane:instruments`‏ — اختیاری تا فیک‌های قدیمی تست‌ها بدون
   * تغییر سبز بمانند؛ غیبت = فهرست خالی (هیچ صفحه‌ی دارایی‌ای).
   */
  getInstruments?(): Promise<InstrumentListing[]>;
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

export async function getInstruments(): Promise<InstrumentListing[]> {
  const active = await source();
  return active.getInstruments === undefined ? [] : active.getInstruments();
}
