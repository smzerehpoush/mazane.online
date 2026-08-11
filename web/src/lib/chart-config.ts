/**
 * پیکربندی منابع نمایشی صفحه‌ی اصلی — قرارداد و تزریق منبع.
 *
 * آینه‌ی `lib/prices.ts`, `lib/history.ts`, `lib/blog.ts` و
 * `lib/reference-price.ts`: اینجا فقط قرارداد است؛ پیاده‌سازی ردیس در
 * `server/chart-config-source.ts` خودش را با `setDefaultChartConfigSource`
 * ثبت می‌کند. پس این فایل هیچ وابستگی نودی ندارد و از هر دو سو import شدنش
 * بی‌خطر است.
 *
 * ⚠️ چرا این لایه اضافه شد: تا پیش از بازطراحی، تنها مصرف‌کننده‌ی پیکربندی
 * `assembleHomeData` بود که خواننده‌اش تزریق می‌شد، پس تست‌ها هرگز به ردیس
 * نمی‌رسیدند. با بازطراحی، ‎/api/prices‎ هم به همین پیکربندی نیاز پیدا کرد
 * (هندسه‌ی محور به فهرست منابع وابسته است) و بدون این درز، تست‌های آن مسیر
 * به ردیس **واقعی** وصل می‌شدند — نقض «تست‌ها بدون سرویس زنده سبز می‌شوند».
 */
import type { ChartPlatformConfig } from "./site-content";

export interface ChartConfigSource {
  /** `undefined` یعنی «تنظیمی نیست» ⟸ فهرست پیش‌فرض کد. هرگز خطا. */
  getChartPlatforms(): Promise<readonly ChartPlatformConfig[] | undefined>;
}

export type ChartConfigSourceFactory = () => ChartConfigSource;

let activeSource: ChartConfigSource | null = null;
let defaultFactory: ChartConfigSourceFactory | null = null;

/** تزریق منبع — در تست‌ها فیک seed شده. */
export function setChartConfigSource(source: ChartConfigSource): void {
  activeSource = source;
}

/** ثبت سازنده‌ی منبع پیش‌فرض (ردیس) — تنبل. */
export function setDefaultChartConfigSource(factory: ChartConfigSourceFactory): void {
  defaultFactory = factory;
}

/** پاک‌کردن تزریق — برای جداسازی تست‌ها. */
export function resetChartConfigSource(): void {
  activeSource = null;
}

/**
 * پیکربندی منابع نمایشی.
 *
 * ⚠️ بر خلاف `getPlatformSnapshot`، نبودِ منبع ثبت‌شده هم **خطا نیست**:
 * پیکربندی یک ترجیح است نه داده، و فهرست پیش‌فرض کد همیشه جواب معتبری است
 * (قاعده‌ی سخت ۵). این با `lib/prices.ts` فرق دارد که عمداً بلند می‌شکند —
 * آنجا نبودِ منبع یعنی صفحه‌ی خالیِ ۲۰۰ که گوگل ایندکسش می‌کند.
 */
export async function getChartPlatforms(): Promise<readonly ChartPlatformConfig[] | undefined> {
  const source =
    activeSource ?? (defaultFactory === null ? null : (activeSource = defaultFactory()));
  if (source === null) return undefined;
  try {
    return await source.getChartPlatforms();
  } catch {
    return undefined;
  }
}
