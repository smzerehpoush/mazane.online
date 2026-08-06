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
import {
  getListedPlatforms,
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

export function findQuote(quotes: Quote[], side: Quote["side"]): Quote | null {
  return quotes.find((q) => q.side === side && q.instrument === "GOLD_18K") ?? null;
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
 * عدد نمایشی ستون «برای یک گرم می‌پردازید» — همان قاعده‌ی تصمیم ۱۸:
 * مؤثر خرید؛ برای سکوی «کارمزد نامشخص» قیمت میانی (تنها عددی که دارد).
 */
export function displayPriceToman(row: Row): number | null {
  return hasUnknownFee(row) ? midPrice(row) : effectiveBuy(row);
}

/**
 * خواندن همه‌ی ردیف‌ها — فهرست از قبل فیلترشده‌ی گردآورنده است و اینجا
 * هیچ فیلتری اعمال نمی‌شود (گلدیکا و هر PERMISSION_PENDING دیگر اصلاً به
 * این لایه نمی‌رسند).
 */
export async function fetchRows(): Promise<Row[]> {
  const platforms = await getListedPlatforms();
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
