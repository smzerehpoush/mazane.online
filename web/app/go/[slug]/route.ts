/**
 * ‎GET /go/<slug>‎ — ریدایرکت لینک معرف (بلیت ۹؛ بند ۱۳، تصمیم ۲۱).
 *
 * هر کلیک خروجی درآمدزا از همین‌جا می‌گذرد: مقصد، `referral_url` سکو (با
 * کد معرف مالک) است و تا وقتی کدی نرسیده — **کدها را صاحب کسب‌وکار بعداً
 * تحویل می‌دهد** — `website_url` یعنی لینک مستقیم. سکوی ناشناخته یا بدون
 * هیچ نشانی، 404.
 *
 * چرا **302 و نه 301**: مقصد موقتی است — با رسیدن هر کد معرف، مقصد همان
 * اسلاگ عوض می‌شود؛ 301 را مرورگر/کش میانی دائمی حفظ می‌کند و کلیک‌های
 * بعدی بی‌عبور از ما به لینک مستقیم قدیمی می‌روند — یعنی ثبت‌نام بدون نام
 * مالک. اعتبار سئو هم اینجا موضوع نیست: ‎/go/‎ در robots.txt بسته است
 * (بند ۶.۴) و پاسخ هم ‎X-Robots-Tag: noindex‎ دارد — دفاع در عمق برای
 * خزنده‌ای که robots را از کش قدیمی دارد.
 *
 * ⚠️ هیچ لاگی اینجا مجاز نیست که مقصد را چاپ کند: `referral_url` حامل کد
 * معرف است و کد نباید به لاگ (یا هر خروجی جز هدر Location) نشت کند —
 * تستش در tests/go-redirect.test.ts است.
 */
import { getListedPlatforms } from "../../../lib/prices";

/** هر درخواست تازه حل می‌شود — کد معرفِ تازه‌رسیده نباید پشت کش بماند. */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const platforms = await getListedPlatforms();
  const platform = platforms.find((item) => item.slug === slug) ?? null;
  const destination = platform?.referral_url ?? platform?.website_url ?? null;
  if (destination === null) {
    return new Response(null, {
      status: 404,
      headers: { "X-Robots-Tag": "noindex" },
    });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: destination, "X-Robots-Tag": "noindex" },
  });
}
