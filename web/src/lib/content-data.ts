/**
 * توابع سروری صفحات محتوا — بلاگ، صفحه‌ی دارایی و صفحه‌ی سکو.
 *
 * آینه‌ی `home-data.ts` و به همان دلیل بیرون از `src/lib/server/` است:
 * پلاگین import-protection تنکستک هر مسیری با پوشه‌ی `server/` را از گراف
 * کلاینت رد می‌کند، و این فایل باید از مسیرهای زیر `src/routes/` (که در
 * گراف کلاینت‌اند) import شود. بدنه‌ی `handler` را کامپایلر Start به ماژول
 * سمت‌سروری جدا می‌برد؛ importهای زیر با همان بدنه می‌روند و `ioredis`/`pg`
 * هرگز به باندل مرورگر نمی‌رسند.
 *
 * این فایل عمداً فقط **سیم‌کشی** است: منطق سرهم‌کردن payload در
 * `lib/page-data.ts` است (بی‌فریم‌ورک و بی‌وابستگی نودی) تا مرز تست وب همان
 * کد را بسنجد، نه نسخه‌ی دومش. خواننده‌های منبع همان‌هایی‌اند که
 * `server/price-source` صادر می‌کند — پس import همین فایل، منبع پیش‌فرض ردیس
 * را هم ثبت می‌کند.
 *
 * قرارداد خروجی عمداً خام است: همان موجودیت‌های دامنه، بدون شکل‌دهی نمایشی.
 * هیچ فرمول قیمتی اینجا نیست (قاعده‌ی ۱ قراردادها) و هیچ عدد بین‌سکویی
 * ساخته نمی‌شود (قاعده‌ی ۴).
 */
import { createServerFn } from "@tanstack/react-start";

import type {
  InstrumentPageData,
  PlatformPageData,
  SlugPageData,
} from "@/components/content/SlugPageView";
import type { PublishedPost } from "./blog";
import { assembleSlugPage } from "./page-data";
import { getPublishedPost, listPublishedPosts } from "./server/blog-source";
import { getPlatformHistory } from "./server/history-source";
import {
  fetchRowsForPlatforms,
  getInstruments,
  getPlatformSnapshot,
  getUpdatedAt,
  resolveSlug,
} from "./server/price-source";

/** فهرست بلاگ — پست‌های منتشرشده، نو به کهنه (ترتیب از `lib/blog.ts`). */
export const loadBlogIndex = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ posts: PublishedPost[] }> => ({
    posts: await listPublishedPosts(),
  }),
);

/**
 * یک پست منتشرشده — `null` یعنی ۴۰۴ (پیش‌نویس، پس‌گرفته یا ناموجود).
 *
 * ⚠️ برخلاف فهرست، خطای پستگرس اینجا قورت داده **نمی‌شود** (قاعده‌ی مستند
 * `lib/blog.ts`): خطای گذرا نباید ۴۰۴ جا بزند، وگرنه گوگل صفحه را از ایندکس
 * می‌اندازد. خطا بالا می‌رود و مرز خطای مسیر ۵۰۰ می‌دهد.
 */
export const loadBlogPost = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) => input)
  .handler(
    async ({ data }): Promise<PublishedPost | null> => getPublishedPost(data.slug),
  );

/**
 * قرارداد داده‌ی این صفحات را **نما** تعریف می‌کند
 * (`components/content/SlugPageView.tsx`) و این لایه فقط برآورده‌اش می‌کند —
 * پس نما هیچ ارجاعی به سرور ندارد و در تست بدون `ioredis`/`pg` رندر می‌شود.
 * برای مصرف‌کننده‌های قدیمی از همین‌جا هم بازصادر می‌شوند.
 */
export type { InstrumentPageData, PlatformPageData, SlugPageData };

/**
 * حل اسلاگ تخت و خواندن داده‌ی همان صفحه — `null` یعنی ۴۰۴ (ناشناخته،
 * رزروشده، یا دارایی با دروازه‌ی انتشار بسته؛ قاعده در `lib/slugs.ts`).
 *
 * قطع ردیس ⟸ کهنگی، نه خطا (قاعده‌ی ۵): ردیف بی‌اسنپ‌شات برمی‌گردد و صفحه
 * ۲۰۰ می‌ماند.
 */
export const loadSlugPage = createServerFn({ method: "GET" })
  .validator((input: { slug: string }) => input)
  .handler(async ({ data }): Promise<SlugPageData | null> =>
    assembleSlugPage(data.slug, {
      resolveSlug,
      fetchRowsForPlatforms,
      getPlatformSnapshot,
      getUpdatedAt,
      getInstruments,
      getPlatformHistory,
    }),
  );
