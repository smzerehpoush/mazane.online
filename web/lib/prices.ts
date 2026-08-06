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
export type FeeSource = "API" | "MANUAL";

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
  buy_fee_percent: string;
  sell_fee_percent: string;
  round_trip_percent: string;
  fee_source: FeeSource;
  buy_enabled: boolean;
  sell_enabled: boolean;
  observed_at: string;
}

export interface PlatformSnapshot {
  platform_slug: string;
  quotes: Quote[];
  terms: PlatformTerms;
  fetched_at: string;
}

export interface PriceSource {
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

export async function getPlatformSnapshot(
  platformSlug: string,
): Promise<PlatformSnapshot | null> {
  return (await source()).getSnapshot(platformSlug);
}

export async function getUpdatedAt(platformSlug: string): Promise<string | null> {
  return (await source()).getUpdatedAt(platformSlug);
}
