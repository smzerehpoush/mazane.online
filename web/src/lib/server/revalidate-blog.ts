/**
 * قلاب انتشار محتوا ‎POST /api/revalidate-blog‎ — مصرف‌کننده: صف انتشار.
 *
 * قرارداد فراخوانی (پس از هر انتشار، ویرایش یا پس‌گیری) دست‌نخورده مانده:
 *
 *     POST /api/revalidate-blog
 *     Authorization: Bearer $TABLO_REVALIDATE_TOKEN
 *     Content-Type: application/json
 *     {"slug": "<post-slug>"}        // اختیاری؛ بدون آن فقط فهرست و سایت‌مپ
 *
 * ⚠️ **آنچه با مهاجرت از نکست عوض شد.** در نکست این مسیر `revalidatePath` را
 * صدا می‌زد و صفحه‌ی ایستای ISR را دور می‌ریخت. در تنکستک استارت هیچ کش
 * صفحه‌ای سمت مبدأ وجود ندارد: ‎/blog‎، ‎/blog/<slug>‎ و ‎/sitemap.xml‎ هر
 * درخواست را مستقیم از پستگرس می‌سازند. پس «بازتولید» در مبدأ **بی‌موضوع**
 * است و تنها کهنگی باقی‌مانده، پنجره‌ی ۶۰ ثانیه‌ای کش لبه است
 * (`s-maxage=60` در `lib/seo/cache-headers.ts`) که خودش منقضی می‌شود.
 *
 * پس این endpoint عمداً حفظ شده ولی صادقانه کوچک شده: احراز هویت می‌کند،
 * اسلاگ را اعتبارسنجی می‌کند، و در پاسخ صریح می‌گوید که در مبدأ چیزی برای
 * دور ریختن نبود (`origin_cache: "none"`). صف انتشار می‌تواند بدون تغییر
 * همان را صدا بزند و ۲۰۰/۴۰۱/۴۰۰ آشنا بگیرد. اگر روزی کش صفحه‌ای در مبدأ
 * اضافه شد یا کلید پاک‌سازی آروان در دسترس آمد، جای درستِ پیاده‌سازی
 * همین‌جاست.
 *
 * احراز: توکن مشترک در env — بدون آن endpoint عمومی می‌شد و هر کسی می‌توانست
 * هزینه تحمیل کند. توکن تنظیم‌نشده ⟸ همیشه ۴۰۱ (fail closed).
 */
import "@tanstack/react-start/server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { NO_STORE } from "../seo/cache-headers";

/** همان قاعده‌ی اسلاگ لاتین تخت (تصمیم ۱۱ + مهاجرت 010_blog.sql). */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * مقایسه‌ی زمان‌ثابت. اول SHA-256 می‌گیریم تا هر دو طرف طول ثابت داشته
 * باشند: `timingSafeEqual` روی طول نابرابر استثنا می‌دهد و همان استثنا خودش
 * طول توکن درست را لو می‌دهد.
 */
export function secretEquals(a: string, b: string): boolean {
  const digest = (value: string): Buffer => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": NO_STORE,
    },
  });
}

export async function revalidateBlogResponse(request: Request): Promise<Response> {
  const token = process.env["TABLO_REVALIDATE_TOKEN"];
  const authorization = request.headers.get("authorization") ?? "";
  if (
    token === undefined ||
    token === "" ||
    !secretEquals(authorization, `Bearer ${token}`)
  ) {
    return json({ revalidated: false }, 401);
  }

  let slug: string | null = null;
  try {
    const body = (await request.json()) as { slug?: unknown };
    if (typeof body.slug === "string") {
      if (!SLUG_PATTERN.test(body.slug)) {
        return json({ revalidated: false, error: "bad slug" }, 400);
      }
      slug = body.slug;
    }
  } catch {
    // بدنه‌ی خالی یا غیر-JSON مجاز است — یعنی «فقط فهرست و سایت‌مپ».
  }

  // مسیرهایی که با درخواست بعدی قطعاً تازه از پستگرس ساخته می‌شوند.
  const paths = [
    "/blog",
    ...(slug === null ? [] : [`/blog/${slug}`]),
    "/sitemap.xml",
  ];
  return json(
    {
      revalidated: true,
      slug,
      paths,
      // صادقانه: در مبدأ کشی نبود که پاک شود؛ تنها تأخیر، کش لبه است.
      origin_cache: "none",
      edge_max_age_seconds: 60,
    },
    200,
  );
}

export function revalidateBlogMethodNotAllowed(): Response {
  return json({ revalidated: false, error: "method not allowed" }, 405);
}
