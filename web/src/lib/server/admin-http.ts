/**
 * هلپرهای مشترک پاسخ HTTP مسیرهای API پنل مدیریت (بلیت ۲۰-۲۴) — استخراج از
 * تکرار عینی در admin-login.ts/admin-logout.ts/admin-platform-settings.ts/
 * admin-posts-requests.ts/admin-post-image.ts (بازبینی کد تکراری).
 *
 * `ADMIN_NO_INDEX_HEADERS` را از `seo/admin-headers.ts` می‌گیرد و دوباره
 * تعریف نمی‌کند — آن فایل تنها منبع حقیقت هدرهای no-store/noindex است؛ این
 * فایل فقط آن را به شکل `json()`/`unauthorized()`/`notFound()` برای مسیرهای
 * API قابل استفاده می‌کند.
 *
 * این پنج مسیر زیر `/admin/*` نیستند، پس میان‌افزار سراسری
 * `adminSecurityMiddleware` آن‌ها را نمی‌پوشاند و هرکدام مستقیم این هلپرها
 * را صدا می‌زنند (دفاع در عمق، نه اتکا به میان‌افزار) — همان دلیلی که خودِ
 * این پنج فایل در کامنت‌هایشان توضیح داده‌اند.
 *
 * پیام‌های خطای `unauthorized()`/`notFound()` در همه‌ی پنج فایل عیناً یکسان
 * بودند؛ اینجا ثابت مانده‌اند (بدون پارامتر) تا رفتار HTTP بایت‌به‌بایت عوض
 * نشود.
 */
import "@tanstack/react-start/server-only";

import { ADMIN_NO_INDEX_HEADERS } from "../seo/admin-headers";

export { ADMIN_NO_INDEX_HEADERS };

/** پاسخ JSON با هدرهای no-store/noindex همیشه‌حاضر روی همه‌ی مسیرهای API پنل. */
export function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...ADMIN_NO_INDEX_HEADERS,
      ...extra,
    },
  });
}

/** نشست معتبر نیست — پیام و کد در همه‌ی مسیرهای پنل عیناً یکسان است. */
export function unauthorized(): Response {
  return json({ error: "نشست معتبر نیست" }, 401);
}

/** پست پیدا نشد — پیام و کد در همه‌ی مسیرهای پست عیناً یکسان است. */
export function notFound(): Response {
  return json({ error: "پست پیدا نشد" }, 404);
}
