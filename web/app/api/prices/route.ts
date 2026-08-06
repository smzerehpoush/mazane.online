/**
 * ‎GET /api/prices‎ — نقطه‌ی JSON زنده (بلیت ۸؛ بند ۶.۲ و تصمیم ۱۳).
 *
 * فقط برای مصرف به‌روزرسان کلاینت‌ساید ۳۰ ثانیه‌ای است — API عمومی نیست؛
 * shape آن قرارداد داخلی با ‎live-prices-updater.tsx‎ است و ممکن است بدون
 * اطلاع عوض شود.
 *
 * دقیقاً همان لایه‌ی دسترسی صفحه (fetchRows) و همان قاعده‌ی انتخاب عدد
 * (displayPriceToman: مؤثر خرید؛ برای کارمزد نامشخص میانی) — هیچ فرمولی
 * اینجا نیست و price_display عین رشته‌ی fa-IR سلول قیمت صفحه است، تا سوآپ
 * کلاینت هیچ قالب‌بندی مستقلی نسازد.
 *
 * ‎Cache-Control: no-store‎ الزامی است: صفحه ISR شصت‌ثانیه‌ای است و polling
 * سی‌ثانیه‌ای؛ هر کشی بین این دو، این endpoint را بی‌معنا می‌کند.
 *
 * قطع منبع ⟸ کهنگی، نه خطا (قاعده‌ی ۵): ردیف با قیمت تهی و updated_at
 * قدیمی برمی‌گردد و پاسخ همیشه ۲۰۰ است.
 */
import { formatToman } from "../../../lib/format";
import type { LivePricesPayload } from "../../../lib/live-update";
import { displayPriceToman, fetchRows } from "../../../lib/rows";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const rows = await fetchRows();
  const payload: LivePricesPayload = {
    generated_at: new Date().toISOString(),
    rows: rows.map((row) => {
      const priceToman = displayPriceToman(row);
      return {
        platform_slug: row.platform.slug,
        price_toman: priceToman,
        price_display: priceToman === null ? null : formatToman(priceToman),
        updated_at: row.updatedAt,
      };
    }),
  };
  return Response.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
