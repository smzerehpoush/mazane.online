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

import { formatToman } from "../format";
import type { LivePricesPayload } from "../live-update";
import { priceToman } from "../rows";
import { NO_STORE } from "../seo/cache-headers";
import { fetchRows } from "./price-source";

export async function livePricesPayload(): Promise<LivePricesPayload> {
  const rows = await fetchRows();
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
