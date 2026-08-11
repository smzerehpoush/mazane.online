/**
 * payload ‎GET /api/prices‎ (بند ۶.۲ و تصمیم ۱۳) — جدا از مسیر، تا مرز وب
 * بتواند shape را با استور seed شده بسنجد.
 *
 * فقط برای مصرف به‌روزرسان کلاینت‌ساید ۳۰ ثانیه‌ای است — API عمومی نیست؛
 * shape آن قرارداد داخلی با `lib/live-update.ts` است.
 *
 * دقیقاً همان لایه‌ی دسترسی صفحه (`fetchRows`) و همان عدد (`priceToman`:
 * «قیمت» سکو، پیش از کارمزد — یکی برای همه‌ی سکوها) — هیچ فرمولی اینجا
 * نیست (قاعده‌ی ۱ قراردادها) و `price_display` عین رشته‌ی fa-IR سلول قیمت
 * صفحه است، تا سوآپ کلاینت هیچ قالب‌بندی مستقلی نسازد.
 *
 * قطع منبع ⟸ کهنگی، نه خطا (قاعده‌ی ۵): ردیف با قیمت تهی و `updated_at`
 * قدیمی برمی‌گردد و پاسخ همیشه ۲۰۰ است.
 */
import "@tanstack/react-start/server-only";

import { buildDashboard } from "../dashboard";
import { formatToman } from "../format";
import type { LivePricesPayload } from "../live-update";
import { priceToman } from "../rows";
import { NO_STORE } from "../seo/cache-headers";
import { chartSeriesConfig } from "../site-content";
import { getChartPlatforms } from "./chart-config-source";
import { fetchRows } from "./price-source";

export async function livePricesPayload(): Promise<LivePricesPayload> {
  const [rows, chartOverride] = await Promise.all([fetchRows(), getChartPlatforms()]);
  const platforms = chartSeriesConfig(chartOverride);

  // ⚠️ هندسه‌ی محور با **همان تابعی** ساخته می‌شود که رندر سرور صفحه از آن
  // استفاده می‌کند. اگر اینجا نسخه‌ی دومی نوشته می‌شد، نشانگرها بعد از اولین
  // polling به موقعیتی می‌پریدند که با رندر اولیه نمی‌خواند.
  //
  // تاریخچه عمداً خالی است: این اندپوینت فقط قیمت جاری را تازه می‌کند و
  // اسپارک‌لاین/خلاصه بازار در همان رندر سرور می‌مانند تا پاسخ سبک بماند.
  const dashboard = buildDashboard({
    rows,
    platforms,
    history: [],
    referenceHistory: { DAILY: null, WEEKLY: null, MONTHLY: null },
  });

  return {
    generated_at: new Date().toISOString(),
    rows: rows.map((row) => {
      const price = priceToman(row);
      return {
        platform_slug: row.platform.slug,
        price_toman: price,
        price_display: price === null ? null : formatToman(price),
        updated_at: row.updatedAt,
      };
    }),
    dashboard: {
      sources: dashboard.rail.sources.map((source) => ({
        slug: source.slug,
        price_toman: source.priceToman,
        price_display: source.priceDisplay,
        rail_percent: source.railPercent,
        stem_long: source.stemLong,
        updated_at: source.updatedAt,
      })),
      max_display: dashboard.rail.maxDisplay,
      min_display: dashboard.rail.minDisplay,
      spread_display: dashboard.rail.spreadDisplay,
      reference_percent: dashboard.rail.referencePercent,
      updated_at: dashboard.updatedAt,
    },
  };
}

/**
 * ‎Cache-Control: no-store‎ الزامی است: صفحه پشت کش ۶۰ ثانیه‌ای لبه است و
 * polling سی‌ثانیه‌ای؛ هر کشی بین این دو، این endpoint را بی‌معنا می‌کند.
 */
export async function livePricesResponse(): Promise<Response> {
  return new Response(JSON.stringify(await livePricesPayload()), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": NO_STORE,
    },
  });
}

/** فقط خواندنی — هیچ متد دیگری نباید پوسته‌ی صفحه بگیرد. */
export function livePricesMethodNotAllowed(): Response {
  return new Response(null, {
    status: 405,
    headers: { Allow: "GET, HEAD", "Cache-Control": NO_STORE },
  });
}
