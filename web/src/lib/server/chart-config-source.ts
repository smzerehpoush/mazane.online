/**
 * منبع واقعی پیکربندی نمودار: ردیس، کلید `mazane:chart_config` —
 * گردآورنده هر ~۲۰ ثانیه از تنظیمات پنل (`platform_settings` پستگرس)
 * همگام می‌کند (`collector/src/mazane_collector/settings.py` +
 * `main.py::settings_sync_loop`).
 *
 * **فقط سمت سرور** — همان دلیل `price-source.ts`: `ioredis` نباید به
 * باندل مرورگر برود.
 *
 * فرود امن (بند ۵ طراحی بلیت ۲۱): کلید نبود، JSON بدشکل، یا کمتر از ۲/بیش
 * از ۶ ورودی معتبر ⟸ `undefined` — `page-data.ts::assembleHomeData` این را
 * به `chartSeriesConfig()` می‌دهد که در این حالت فهرست پیش‌فرض کد را
 * برمی‌گرداند. پارس/اعتبارسنجی خودش در `parseChartConfigPayload`
 * (`../site-content`) است — خالص و بی‌وابستگی به ردیس، تا بدون سرویس زنده
 * تست شود؛ این فایل فقط اتصال ردیس را فراهم می‌کند.
 */
import "@tanstack/react-start/server-only";

import Redis from "ioredis";

import { parseChartConfigPayload, type ChartPlatformConfig } from "../site-content";

const CHART_CONFIG_KEY = "mazane:chart_config";

let client: Redis | null = null;

function redisClient(): Redis {
  if (client === null) {
    client = new Redis(process.env["MAZANE_REDIS_URL"] ?? "redis://127.0.0.1:6379/0", {
      // فرمان معطل نماند: یک تلاش اتصال، بعد رد — لایه‌ی بالا فهرست پیش‌فرض می‌دهد.
      maxRetriesPerRequest: 1,
    });
  }
  return client;
}

export async function getChartPlatforms(): Promise<readonly ChartPlatformConfig[] | undefined> {
  try {
    const raw = await redisClient().get(CHART_CONFIG_KEY);
    return parseChartConfigPayload(raw);
  } catch {
    return undefined;
  }
}
