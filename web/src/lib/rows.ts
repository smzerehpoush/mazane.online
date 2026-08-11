/**
 * ردیف نمایش و خواندنش از منبع داده — لایه‌ی مشترک صفحه‌ی اصلی و
 * ‎GET /api/prices‎ (بلیت ۸).
 *
 * هر دو مصرف‌کننده باید عین هم بخوانند تا به‌روزرسان کلاینت دقیقاً همان
 * عددی را جایگزین کند که رندر ISR گذاشته. هیچ فرمول قیمتی اینجا نیست —
 * فقط انتخاب از میان اعداد آماده‌ی گردآورنده (قاعده‌ی ۱ قراردادها).
 *
 * ⚠️ از سند تصمیم ۰۰۰۲ به بعد هر سکو **یک** عدد دارد: «قیمت»، پیش از هر
 * کارمزد. قیمت مؤثر خرید/فروش دیگر نه ذخیره می‌شود، نه محاسبه، نه نمایش
 * داده — کارمزد جدا در `terms` می‌آید و هیچ لایه‌ای آن را در قیمت ضرب
 * نمی‌کند. اگر روزی دوباره لازم شد، اول `CONTEXT.md` را عوض کنید.
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
 * سطر قیمت یک دارایی. پیش‌فرض GOLD_18K — قرارداد صفحه‌ی اصلی/‏api؛ صفحه‌ی
 * دارایی (بلیت ۷) کد دارایی خودش را می‌دهد.
 */
export function findQuote(quotes: Quote[], instrument: string = "GOLD_18K"): Quote | null {
  return quotes.find((q) => q.side === "PRICE" && q.instrument === instrument) ?? null;
}

/**
 * **عدد نمایشی ستون اول** — «قیمت» همان سکو برای آن دارایی، پیش از کارمزد.
 *
 * یک تابع برای همه‌ی سکوها: سکوی کارمزدنامعلوم دیگر حالت ویژه نیست، چون
 * عددش با بقیه هم‌جنس است (همه پیش-از-کارمزدند). این تفاوت مهمی با مدل
 * قبلی است، جایی که آن چهار سکو عددی داشتند که با مؤثرها هم‌مقایسه نبود و
 * ته جدول تبعید می‌شدند.
 */
export function priceToman(row: Row, instrument: string = "GOLD_18K"): number | null {
  if (row.snapshot === null) return null;
  return findQuote(row.snapshot.quotes, instrument)?.price_toman ?? null;
}

export function hasUnknownFee(row: Row): boolean {
  return row.snapshot !== null && row.snapshot.terms.fee_source === "UNKNOWN";
}

/** درصد کارمزد، یا `null` وقتی سکو اعلامش نکرده — جدول «—» می‌گذارد. */
function feeNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function buyFeePercent(row: Row): number | null {
  return row.snapshot === null ? null : feeNumber(row.snapshot.terms.buy_fee_percent);
}

export function sellFeePercent(row: Row): number | null {
  return row.snapshot === null ? null : feeNumber(row.snapshot.terms.sell_fee_percent);
}

/**
 * هزینه‌ی رفت‌وبرگشت — تنها عددی که هزینه‌ی **کل** را میان سکوها مقایسه
 * می‌کند (CONTEXT.md). از دو کارمزد گردآورنده می‌آید، نه از قیمت.
 */
export function roundTripPercent(row: Row): number | null {
  return row.snapshot === null ? null : feeNumber(row.snapshot.terms.round_trip_percent);
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
 * ترتیب ردیف‌های هر جدول مقایسه‌ای — **فقط قیمت** (تصمیم مالک ۲۰۲۶-۰۸-۱۰).
 *
 * ⚠️ بند ۶.۴: هیچ فیلد درآمدزایی ورودی ترتیب نیست — نگهبان سطح کد در
 * `tests/sponsored-links.test.tsx` حتی نامشان را در این فایل قرمز می‌کند.
 *
 * سکوی بی‌قیمت (قطع منبع، یا دفتر سفارشِ یک‌سمته) ته فهرست می‌رود — نه چون
 * گران است، بلکه چون عددی برای مقایسه ندارد.
 */
export function compareByPrice(instrument: string = "GOLD_18K") {
  return (a: Row, b: Row): number =>
    (priceToman(a, instrument) ?? Number.POSITIVE_INFINITY) -
    (priceToman(b, instrument) ?? Number.POSITIVE_INFINITY);
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
