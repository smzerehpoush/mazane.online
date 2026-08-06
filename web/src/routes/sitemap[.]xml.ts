/**
 * ‎GET /sitemap.xml‎ — تولید پویا از رجیستری صفحه‌ها.
 *
 * نام فایل به همان دلیل ‎robots[.]txt.ts‎ با ‎[.]‎ نوشته شده.
 *
 * قواعد انتخاب نشانی و `lastmod` در `lib/seo/sitemap.ts` است (خالص و
 * تست‌پذیر)؛ اینجا فقط سه خواندن و یک پاسخ.
 *
 * ## قطع ردیس ⟸ سایت‌مپ کامل می‌ماند
 *
 * صفحات سکو و دارایی از `lib/catalog.ts` می‌آیند: payload زنده مقدم است و
 * کفش رجیستری ایستای بیلد است. پیش از این، قطع ردیس سایت‌مپ را از ۲۱ نشانی
 * به ۷ می‌رساند — یعنی یک ۲۰۰ کش‌شدنی که به گوگل می‌گوید «۱۴ صفحه رفته‌اند».
 *
 * ## قطع پستگرس ⟸ ۵۰۳، نه سایت‌مپِ ناقصِ ۲۰۰
 *
 * **تصمیم:** بخش پست‌ها بی‌صدا حذف نمی‌شود. برخلاف سکو و دارایی، فهرست
 * پست‌ها رجیستری ایستا ندارد (محتوا در پستگرس زندگی می‌کند و بین دیپلوی‌ها
 * عوض می‌شود) و «آخرین حالت سالم» هم در حافظه‌ی یک پروسه‌ی بی‌حالت قابل
 * اتکا نیست — با چند نمونه‌ی سرور، هر نمونه حافظه‌ی خودش را دارد و پاسخ
 * قرعه‌کشی می‌شود. پس ۵۰۳ با ‎no-store‎ می‌دهیم: طبق RFC 5861 پوشش
 * ‎stale-if-error‎ دقیقاً همین ۵xx است، پس لبه‌ی آروان **نسخه‌ی سالم قبلی
 * سایت‌مپ** را (تا ۲۴ ساعت) سرو می‌کند — چیزی که یک ۲۰۰ ناقص هرگز اجازه‌اش
 * را نمی‌دهد، چون خودش جای نسخه‌ی سالم را می‌گیرد.
 *
 * ⚠️ فقط گزینه‌ی `server` — همان دلیل ‎go/$slug.ts‎ (هرس شدن از درخت کلاینت).
 */
import { createFileRoute } from "@tanstack/react-router";

import { HTML_EDGE_CACHE_CONTROL, NO_STORE } from "@/lib/seo/cache-headers";
import { buildSitemapEntries, renderSitemapXml } from "@/lib/seo/sitemap";
import { listPublishedPostsStrict } from "@/lib/server/blog-source";
import { getInstruments, getListedPlatforms } from "@/lib/server/price-source";

const XML_CONTENT_TYPE = "application/xml; charset=utf-8";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [instruments, platforms] = await Promise.all([
          getInstruments(),
          getListedPlatforms(),
        ]);
        let posts;
        try {
          posts = await listPublishedPostsStrict();
        } catch (error) {
          console.error("blog source unavailable; refusing a truncated sitemap", error);
          return new Response("", {
            status: 503,
            headers: { "Content-Type": XML_CONTENT_TYPE, "Cache-Control": NO_STORE },
          });
        }
        const xml = renderSitemapXml(buildSitemapEntries({ posts, instruments, platforms }));
        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": XML_CONTENT_TYPE,
            "Cache-Control": HTML_EDGE_CACHE_CONTROL,
          },
        });
      },
    },
  },
});
