/**
 * منطق ریدایرکت ‎/go/<slug>‎ (بند ۱۳، تصمیم ۲۱) — جدا از مسیر، تا مرز وب
 * بتواند رفتارش را با استور seed شده بسنجد بدون بالا آوردن سرور.
 *
 * مقصد: `referral_url` سکو (با کد معرف مالک)؛ نبودش ⟸ `website_url` یعنی
 * لینک مستقیم — **کدها را صاحب کسب‌وکار بعداً تحویل می‌دهد**. سکوی ناشناخته
 * یا بدون هیچ نشانی ⟸ ۴۰۴.
 *
 * چرا **۳۰۲ و نه ۳۰۱**: مقصد موقتی است — با رسیدن هر کد معرف، مقصد همان
 * اسلاگ عوض می‌شود؛ ۳۰۱ را مرورگر و کش میانی دائمی نگه می‌دارند و کلیک‌های
 * بعدی بی‌عبور از ما به لینک مستقیم قدیمی می‌روند، یعنی ثبت‌نام بدون نام
 * مالک. اعتبار سئو هم موضوع نیست: ‎/go/‎ در robots.txt بسته است (بند ۶.۴)
 * و پاسخ ‎X-Robots-Tag: noindex‎ دارد — دفاع در عمق برای خزنده‌ای که robots
 * را از کش قدیمی دارد.
 *
 * ⚠️ هیچ لاگی اینجا مجاز نیست که مقصد را چاپ کند: `referral_url` حامل کد
 * معرف است و کد نباید به لاگ (یا هر خروجی جز هدر ‎Location‎) نشت کند.
 */
import "@tanstack/react-start/server-only";

import { NO_STORE } from "../seo/cache-headers";
import { getListedPlatforms } from "./price-source";

const NOINDEX_HEADERS = {
  "X-Robots-Tag": "noindex",
  "Cache-Control": NO_STORE,
} as const;

export async function goRedirectResponse(slug: string): Promise<Response> {
  const platforms = await getListedPlatforms();
  const platform = platforms.find((item) => item.slug === slug) ?? null;
  const destination = platform?.referral_url ?? platform?.website_url ?? null;
  if (destination === null) {
    return new Response(null, { status: 404, headers: { ...NOINDEX_HEADERS } });
  }
  return new Response(null, {
    status: 302,
    headers: { ...NOINDEX_HEADERS, Location: destination },
  });
}

/** ‎/go/‎ فقط ریدایرکت است — هیچ متد دیگری نباید پوسته‌ی صفحه بگیرد. */
export function goMethodNotAllowed(): Response {
  return new Response(null, {
    status: 405,
    headers: { ...NOINDEX_HEADERS, Allow: "GET, HEAD" },
  });
}
