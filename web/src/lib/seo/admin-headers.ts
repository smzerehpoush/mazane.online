/**
 * هدرهای امنیتی مسیرهای پنل مدیریت (بلیت ۲۰؛ بند ۹ قراردادها): هر پاسخ زیر
 * ‎/admin‎ یا ‎/admin/*‎ نه کش می‌شود نه نمایه — چه صفحه باشد چه API.
 *
 * چرا میان‌افزار سراسری و نه هدر دستی هر مسیر: صفحات پنل (`route.tsx`،
 * `login.tsx`، `index.tsx`) کامپوننت‌محورند و در تنکستک استارت راهی برای
 * گذاشتن هدر واقعی HTTP روی خروجی یک page route پیدا نشد (فقط `<meta>` در
 * `head()` — که همه‌جا هم گذاشته شده، ولی `X-Robots-Tag`/`Cache-Control`ی
 * که خزنده و لبه‌ی کش واقعاً می‌بینند نیست). میان‌افزار سراسری
 * (`admin-security.ts`) تنها نقطه‌ای است که پاسخ نهاییِ یک صفحه را هم
 * می‌بیند — دقیقاً همان الگوی `edge-cache.ts` برای سیاست کش لبه.
 *
 * مسیرهای API مدیریتی (`admin-login`/`admin-logout`) پاسخشان کاملاً دست
 * خودشان است، پس مستقیم هم همین هدرها را می‌گذارند (دفاع در عمق، نه اتکا
 * به میان‌افزار).
 *
 * تابع خالص است — نه به فریم‌ورک وابسته نه به منبع داده — تا `admin-security.ts`
 * فقط پوسته‌ی نازکش باشد و همین قاعده مستقیماً تست شود (رسم `robots.ts`).
 */

/**
 * export شده تا `server/admin-http.ts` (هلپرهای مشترک پاسخ API پنل) همین
 * شیء را بازاستفاده کند، نه دوباره تعریف — تنها منبع حقیقت این هدرهاست.
 */
export const ADMIN_NO_INDEX_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

/** مسیر زیر پنل مدیریت است؟ (خودِ `/admin` هم حساب می‌شود.) */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** هدرهایی که باید روی پاسخ بنشیند — `null` یعنی مسیر پنل نیست، دست نزن. */
export function adminHeadersFor(pathname: string): Readonly<Record<string, string>> | null {
  return isAdminPath(pathname) ? ADMIN_NO_INDEX_HEADERS : null;
}

/**
 * نشاندن هدر روی پاسخ — **در جا**، بدون ساختن `Response` تازه (همان دلیل
 * `applyEdgeCacheControl`: پاسخ SSR استریم است). اگر هدرهای پاسخ قفل باشند
 * بی‌سروصدا رد می‌شویم — نبود هدر بهتر از ۵۰۰ است.
 */
export function applyAdminHeaders(response: Response, pathname: string): Response {
  const headers = adminHeadersFor(pathname);
  if (headers === null) return response;
  try {
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
  } catch {
    // هدر قفل — عمداً بی‌صدا.
  }
  return response;
}
