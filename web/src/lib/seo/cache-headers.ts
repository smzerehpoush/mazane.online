/**
 * سیاست کش لبه (آروان‌کلود) — پیش‌شرط سختِ بند ۱۰ سند معماری.
 *
 * سایت پشت آروان است و **در قطعی مبدأ، لبه باید نسخه‌ی کش‌شده را با کد ۲۰۰
 * سرو کند**. اگر آروان به گوگل‌بات ۵xx بدهد، سایت در چند روز از ایندکس
 * می‌افتد؛ این تنها جایی است که یک هدر اشتباه، کل اولویت شماره‌ی یک
 * کسب‌وکار را می‌سوزاند.
 *
 * قاعده‌های زیر عمداً کوچک و خالص‌اند تا تست‌پذیر باشند. ترتیبشان معنادار است:
 *
 *   ۱. پاسخی که خودش ‎Cache-Control‎ گذاشته دست‌نخورده می‌ماند — مسیر خودش
 *      بهتر می‌داند (‎/api/prices‎ و ‎/go/‎ صریحاً ‎no-store‎ می‌گذارند).
 *   ۲. فراخوان تابع سروری (RPC ناوبری کلاینت) هرگز کش نمی‌شود.
 *   ۳. ‎/api/‎ و ‎/go/‎ هرگز کش نمی‌شوند — اولی داده‌ی زنده است و دومی
 *      ریدایرکت درآمدزا با مقصد متغیر (تصمیم ۲۱).
 *   ۴. **فقط ۲۰۰ سیاست کش HTML می‌گیرد؛ هر چیز دیگری ‎no-store‎.** این
 *      نقطه‌ی ظریف ماجراست و دو نیمه دارد:
 *        - ۵xx: چیزی که در قطعی مبدأ سرو می‌شود **پاسخ سالم قبلی** است که
 *          ‎stale-if-error‎ دارد؛ اگر خودِ خطا کش شود، لبه خطا را تکرار می‌کند.
 *        - ۴۰۴ و بقیه: ‎stale-if-error‎ اینجا هیچ کمکی نمی‌کند — طبق RFC 5861
 *          فقط ۵xx را پوشش می‌دهد. یک ۴۰۴ گذرا با ‎s-maxage=60‎ و
 *          ‎stale-while-revalidate=600‎ یعنی لبه تا ده دقیقه پس از سالم شدن
 *          مبدأ هم به گوگل‌بات «این صفحه رفته» می‌گوید. «صفحه‌ی نبوده» هرگز
 *          کش‌شدنی نیست.
 *      ۳۰۴ استثناست و اصلاً دست نمی‌خورد: بدنه ندارد و هدرهایش روی نسخه‌ی
 *      ذخیره‌شده‌ی لبه می‌نشیند، پس ‎no-store‎ روی آن یعنی دور انداختن یک
 *      دارایی سالمِ کش‌شده.
 *   ۵. هر HTML دیگری (یعنی ۲۰۰) هدر لبه می‌گیرد.
 *
 * چرا کهنگی داده مشکلی نمی‌سازد: قطع منبع در لایه‌ی داده به «داده‌ای نیست»
 * ترجمه شده و صفحه با «آخرین به‌روزرسانی: N دقیقه پیش» باز هم ۲۰۰ است
 * (قاعده‌ی ۵ قراردادها) — پس نسخه‌ی کش‌شده هیچ‌وقت دروغ نمی‌گوید.
 */

/**
 * ‎s-maxage=60‎ همان پنجره‌ی تازگی است که بند ۶.۲ می‌خواهد (polling کلاینت
 * ۳۰ ثانیه است و فاصله را پر می‌کند). ‎stale-while-revalidate=600‎ یعنی هیچ
 * کاربر و هیچ خزنده‌ای منتظر مبدأ نمی‌ماند. ‎stale-if-error=86400‎ همان بند
 * سختِ قطعی مبدأ است: تا یک شبانه‌روز، ۲۰۰ کهنه به‌جای ۵xx.
 */
export const HTML_EDGE_CACHE_CONTROL =
  "public, s-maxage=60, stale-while-revalidate=600, stale-if-error=86400";

/** داده‌ی زنده و ریدایرکت درآمدزا — هیچ لایه‌ی کشی، در هیچ نقطه‌ای. */
export const NO_STORE = "no-store";

export interface CachePolicyInput {
  /** مسیر درخواست، بدون query. */
  pathname: string;
  status: number;
  /** مقدار هدر ‎Content-Type‎ پاسخ (یا null). */
  contentType: string | null;
  /** پاسخ خودش ‎Cache-Control‎ دارد؟ */
  hasCacheControl: boolean;
  /** درخواست، فراخوان تابع سروری است نه صفحه؟ */
  isServerFn: boolean;
}

/** مسیرهایی که هرگز کش نمی‌شوند. */
function isNeverCached(pathname: string): boolean {
  return (
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/go" ||
    pathname.startsWith("/go/")
  );
}

/**
 * مقدار ‎Cache-Control‎ی که باید روی پاسخ نشست — `null` یعنی «دست نزن»
 * (دارایی ایستا با هدر خودش، یا پاسخی که قبلاً تصمیم گرفته).
 */
export function edgeCacheControlFor(input: CachePolicyInput): string | null {
  if (input.hasCacheControl) return null;
  if (input.isServerFn) return NO_STORE;
  if (isNeverCached(input.pathname)) return NO_STORE;
  // ۳۰۴ بدنه ندارد و هدرش نسخه‌ی کش‌شده را به‌روز می‌کند — دست نمی‌زنیم.
  if (input.status === 304) return null;
  if (input.status !== 200) return NO_STORE;
  if ((input.contentType ?? "").includes("text/html")) return HTML_EDGE_CACHE_CONTROL;
  return null;
}

/**
 * نشاندن هدر روی پاسخ — **در جا**، بدون ساختن ‎Response‎ تازه: پاسخ SSR
 * استریم است و بازبسته‌بندی‌اش زنجیره‌ی پاک‌سازی استریم را در تنکستک می‌شکند.
 *
 * اگر هدرهای پاسخ قفل باشند (پاسخ‌های آمده از ‎fetch‎ حالت immutable دارند)
 * بی‌سروصدا رد می‌شویم: نبود هدر بهتر از ۵۰۰ است.
 */
export function applyEdgeCacheControl(
  response: Response,
  input: Omit<CachePolicyInput, "status" | "contentType" | "hasCacheControl">,
): Response {
  const value = edgeCacheControlFor({
    ...input,
    status: response.status,
    contentType: response.headers.get("content-type"),
    hasCacheControl: response.headers.has("cache-control"),
  });
  if (value === null) return response;
  try {
    response.headers.set("cache-control", value);
  } catch {
    // هدر قفل — عمداً بی‌صدا.
  }
  return response;
}
