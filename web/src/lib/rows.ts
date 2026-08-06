/**
 * ردیف نمایش و خواندنش از منبع داده — لایه‌ی مشترک صفحه‌ی اصلی و
 * ‎GET /api/prices‎ (بلیت ۸).
 *
 * هر دو مصرف‌کننده باید عین هم بخوانند و عین هم «عدد نمایشی» را انتخاب
 * کنند (مؤثر خرید؛ برای کارمزد نامشخص فقط میانی) تا به‌روزرسان کلاینت
 * دقیقاً همان عددی را جایگزین کند که رندر ISR گذاشته. هیچ فرمول قیمتی
 * اینجا نیست — فقط انتخاب از میان اعداد آماده‌ی گردآورنده (قاعده‌ی ۱
 * قراردادها).
 */
import { listPlatforms } from "./catalog";
import {
  getPlatformSnapshot,
  getUpdatedAt,
  type ListedPlatform,
  type PlatformSnapshot,
  type Quote,
} from "./prices";

export interface Row {
  platform: ListedPlatform;
  snapshot: PlatformSnapshot | null;
  updatedAt: string | null;
}

/**
 * انتخاب سطر یک سمت برای یک دارایی. پیش‌فرض GOLD_18K — قرارداد صفحه‌ی
 * اصلی/‏api؛ صفحه‌ی دارایی (بلیت ۷) کد دارایی خودش را می‌دهد.
 */
export function findQuote(
  quotes: Quote[],
  side: Quote["side"],
  instrument: string = "GOLD_18K",
): Quote | null {
  return quotes.find((q) => q.side === side && q.instrument === instrument) ?? null;
}

export function effectiveBuy(row: Row): number | null {
  if (row.snapshot === null) return null;
  return findQuote(row.snapshot.quotes, "BUY")?.price_toman ?? null;
}

export function midPrice(row: Row): number | null {
  if (row.snapshot === null) return null;
  return findQuote(row.snapshot.quotes, "MID")?.price_toman ?? null;
}

export function hasUnknownFee(row: Row): boolean {
  return row.snapshot !== null && row.snapshot.terms.fee_source === "UNKNOWN";
}

/**
 * «سمت باز» — تنها مفهومِ در-دسترس-بودن یک معامله (بند ۹.۲): سکویی که
 * `buy_enabled`/`sell_enabled` اش false است، آن سمت را نمی‌پذیرد.
 *
 * یک تعریف واحد برای هر سه مصرف‌کننده: کارت «بهترین»، نشان‌های جدول، و
 * `AggregateOffer`. اگر این‌ها از هم جدا شوند، صفحه یک چیز می‌گوید و
 * داده‌ی ساخت‌یافته چیز دیگری — همان اختلافی که یک بار پیش آمد و
 * `lowPrice` قیمتِ سکوی خریدبسته را به گوگل می‌داد.
 *
 * اسنپ‌شات نداریم ⟸ چیزی برای معامله هم نداریم ⟸ بسته.
 */
export function isBuyOpen(row: Row): boolean {
  return row.snapshot !== null && row.snapshot.terms.buy_enabled;
}

export function isSellOpen(row: Row): boolean {
  return row.snapshot !== null && row.snapshot.terms.sell_enabled;
}

/**
 * عدد نمایشی ستون «برای یک گرم می‌پردازید» — همان قاعده‌ی تصمیم ۱۸:
 * مؤثر خرید؛ برای سکوی «کارمزد نامشخص» قیمت میانی (تنها عددی که دارد).
 */
export function displayPriceToman(row: Row): number | null {
  return hasUnknownFee(row) ? midPrice(row) : effectiveBuy(row);
}

/**
 * قرینه‌ی بالا برای ستون «قیمت فروش» جدول چهارستونی صفحه‌ی اصلی: مؤثر فروش؛
 * برای سکوی «کارمزد نامشخص» همان قیمت میانی (تنها عددی که دارد) — پس ستون
 * خرید و فروشش یک عدد یکسان نشان می‌دهند، بدون برچسب. باز هم فقط انتخاب از
 * اعداد آماده‌ی گردآورنده است، نه محاسبه.
 */
export function displaySellPriceToman(row: Row): number | null {
  if (row.snapshot === null) return null;
  return hasUnknownFee(row)
    ? midPrice(row)
    : (findQuote(row.snapshot.quotes, "SELL")?.price_toman ?? null);
}

/**
 * کمک‌کارهای دارایی‌محور صفحه‌ی دارایی (بلیت ۷) — همان الگوی بالا با کد
 * دارایی صریح. مثل همیشه فقط انتخاب از اعداد آماده‌ی گردآورنده است.
 */
export function effectiveBuyFor(row: Row, instrument: string): number | null {
  if (row.snapshot === null) return null;
  return findQuote(row.snapshot.quotes, "BUY", instrument)?.price_toman ?? null;
}

export function effectiveSellFor(row: Row, instrument: string): number | null {
  if (row.snapshot === null) return null;
  return findQuote(row.snapshot.quotes, "SELL", instrument)?.price_toman ?? null;
}

export function midFor(row: Row, instrument: string): number | null {
  if (row.snapshot === null) return null;
  return findQuote(row.snapshot.quotes, "MID", instrument)?.price_toman ?? null;
}

/**
 * قیمت مرجع سکو برای یک دارایی — عدد آماده‌ی گردآورنده. قاعده‌ی قطعی مالک
 * (۲۰۲۶-۰۸-۰۶): سکوی تک‌قیمتی همان تک‌عددش، سکوی دوقیمتی میانگین دو عدد
 * **خودش**. همیشه به یک سکوی نام‌برده منتسب است؛ هیچ میانگین بین‌سکویی‌ای
 * در هیچ لایه‌ای وجود ندارد (قاعده‌ی ۴).
 *
 * ترتیب خواندن — هر دو فقط انتخاب‌اند، نه محاسبه:
 *   ۱. سطر `MEAN` همین دارایی در quotes (شکل تازه).
 *   ۲. کلید `reference_prices_toman[instrument]` (payload قدیمی‌تر).
 * هیچ‌کدام نبود ⟸ null، و صفحه «ثبت نشده» می‌گوید، نه عدد جعلی.
 */
export function referencePriceFor(row: Row, instrument: string = "GOLD_18K"): number | null {
  if (row.snapshot === null) return null;
  const mean = findQuote(row.snapshot.quotes, "MEAN", instrument);
  if (mean !== null) return mean.price_toman;
  return row.snapshot.reference_prices_toman?.[instrument] ?? null;
}

/**
 * خواندن همه‌ی ردیف‌ها — فهرست از قبل فیلترشده‌ی گردآورنده است و اینجا
 * هیچ فیلتری اعمال نمی‌شود (گلدیکا و هر PERMISSION_PENDING دیگر اصلاً به
 * این لایه نمی‌رسند).
 *
 * فهرست از `lib/catalog.ts` می‌آید: قطع ردیس یعنی ردیف‌های سکوهای رجیستری
 * با «قیمت در دسترس نیست»، نه جدول خالی (قاعده‌ی ۵ — کهنگی، نه خطا).
 */
export async function fetchRows(): Promise<Row[]> {
  return rowsOf(await listPlatforms());
}

/**
 * ردیف‌های زیرمجموعه‌ای از فهرست عمومی — صفحه‌ی دارایی فقط سکوهای پشتیبان
 * همان دارایی را می‌خواند (به همان ترتیب فهرست عمومی).
 */
export async function fetchRowsForPlatforms(slugs: string[]): Promise<Row[]> {
  const wanted = new Set(slugs);
  const platforms = (await listPlatforms()).filter((p) => wanted.has(p.slug));
  return rowsOf(platforms);
}

async function rowsOf(platforms: ListedPlatform[]): Promise<Row[]> {
  return Promise.all(
    platforms.map(async (platform) => {
      const [snapshot, updatedAt] = await Promise.all([
        getPlatformSnapshot(platform.slug),
        getUpdatedAt(platform.slug),
      ]);
      return { platform, snapshot, updatedAt };
    }),
  );
}
