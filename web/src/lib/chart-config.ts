/**
 * ⚠️ چرا این لایه اضافه شد: تا پیش از بازطراحی، تنها مصرف‌کننده‌ی پیکربندی
 * `assembleHomeData` بود که خواننده‌اش تزریق می‌شد، پس تست‌ها هرگز به ردیس
 * نمی‌رسیدند. با بازطراحی، ‎/api/prices‎ هم به همین پیکربندی نیاز پیدا کرد
 * (هندسه‌ی محور به فهرست منابع وابسته است) و بدون این درز، تست‌های آن مسیر
 * به ردیس **واقعی** وصل می‌شدند — نقض «تست‌ها بدون سرویس زنده سبز می‌شوند».
 */
import type { ChartPlatformConfig } from "./site-content";

export interface ChartConfigSource {
  getChartPlatforms(): Promise<readonly ChartPlatformConfig[] | undefined>;
}

export type ChartConfigSourceFactory = () => ChartConfigSource;

let activeSource: ChartConfigSource | null = null;
let defaultFactory: ChartConfigSourceFactory | null = null;

export function setChartConfigSource(source: ChartConfigSource): void {
  activeSource = source;
}

export function setDefaultChartConfigSource(factory: ChartConfigSourceFactory): void {
  defaultFactory = factory;
}

export function resetChartConfigSource(): void {
  activeSource = null;
}

/**
 * ⚠️ بر خلاف `getPlatformSnapshot`، نبودِ منبع ثبت‌شده هم **خطا نیست**:
 * پیکربندی یک ترجیح است نه داده، و فهرست پیش‌فرض کد همیشه جواب معتبری است
 * . این با `lib/prices.ts` فرق دارد که عمداً بلند می‌شکند —
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
