/**
 * داده‌ی ساخت‌یافته — بلیت ۱۰ (بند ۶.۵ سند معماری).
 *
 * حکم‌های بند ۶.۵ که این ماژول اجرا می‌کند:
 *   - `Organization` + `WebSite` **بدون** `SearchAction` — فقط صفحه‌ی اصلی؛
 *     برند «مظنه آنلاین» با «مضنه آنلاین» در `alternateName` (بند ۱۱ + بند
 *     ۱۳، تصمیم ۱).
 *   - `BreadcrumbList` همه‌جا (جز خود ریشه).
 *   - `Product` + `AggregateOffer` فقط صفحات دارایی؛ **هیچ** `Offer`
 *     فروشنده‌ای (merchant listing) — ما فروشنده نیستیم.
 *   - `FAQPage` / `HowTo` / `SearchAction` حذف‌اند؛ `AggregateRating` برای
 *     خودمان هرگز (self-serving).
 *   - واحد پول `IRR` است: مدل داده تومان است، پس در همین لایه‌ی نمایش ×۱۰
 *     می‌شود. عدد JSON-LD باید همان عدد رندر سرور باشد — سازنده‌ها ورودی را
 *     از همان ردیف‌های رندرشده می‌گیرند، هرگز fetch جدا نمی‌کنند.
 *   - صفحه‌ی سکو `WebPage` می‌گیرد با `about` تو در توی `Organization` (نام
 *     سکو + website_url خودش، اگر داشت) — بلیت ۲۹. سکو **هیچ @id مستقل**
 *     نمی‌گیرد (فقط تو در توی about، نه یک موجودیت جدا در گراف) و **هیچ**
 *     Product/Offer: صفحه‌ی سکو معرفی شرایط است، نه فروشگاه — آن الگو فقط
 *     برای صفحه‌ی دارایی است (assetProductJsonLd پایین).
 *   - ارقام لاتین (JSON.stringify روی number همیشه لاتین می‌دهد).
 */
import type { InstrumentListing, ListedPlatform } from "./prices";
import { effectiveBuyFor, isBuyOpen, type Row } from "./rows";
import { SITE_URL } from "./site";

/** برند رسمی (بند ۱۳، تصمیم ۱) و غلط املایی رایج که فقط alternateName است. */
export const BRAND_FA = "مظنه آنلاین";
export const BRAND_ALTERNATE_FA = "مضنه آنلاین";

/**
 * سریال‌سازی JSON-LD: فقط داده‌ی JSON خودمان است (نه متن خام کاربر)؛
 * escape کردن < رسم ایمنی تزریق است تا "</script>" داخل رشته‌ها بی‌اثر شود
 * — همان قاعده‌ی BlogPosting بلیت ۱۲.
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * `Organization` + `WebSite` در یک `@graph` — فقط برای صفحه‌ی اصلی.
 * هیچ `potentialAction`/`SearchAction` و هیچ `AggregateRating` خودی ندارد.
 */
export function organizationWebSiteJsonLd(): string {
  const organizationId = `${SITE_URL}/#organization`;
  return jsonLdString({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: BRAND_FA,
        alternateName: BRAND_ALTERNATE_FA,
        url: SITE_URL,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: BRAND_FA,
        alternateName: BRAND_ALTERNATE_FA,
        url: SITE_URL,
        inLanguage: "fa",
        publisher: { "@id": organizationId },
      },
    ],
  });
}

export interface BreadcrumbItem {
  /** نام فارسی نمایشی همان صفحه. */
  name: string;
  /** URL مطلق لاتین (قراردادها: ارقام/حروف لاتین در URL). */
  url: string;
}

/** `BreadcrumbList` — روی هر صفحه جز ریشه (خانه خودش سرِ زنجیر است). */
export function breadcrumbJsonLd(items: BreadcrumbItem[]): string {
  return jsonLdString({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  });
}

/**
 * `WebPage` صفحه‌ی سکو، با `about` تو در توی `Organization` (بلیت ۲۹).
 *
 * سکو اینجا **@id مستقل نمی‌گیرد** — بر خلاف `organizationWebSiteJsonLd`
 * که برای «مظنه آنلاین» یک `Organization` با `@id` ثابت در گراف اصلی
 * می‌سازد، این `Organization` فقط شیء تو در توی `about` است، بدون `@id`،
 * پس هرگز موجودیت مستقلی در گراف دانش نمی‌شود که با برند خودمان اشتباه
 * گرفته شود. `website_url` هم فقط وقتی هست که ثبت شده باشد (فراداده‌ی
 * گردآورنده از سند تحقیق ۰۱) — جای نامستند حذف می‌شود، جعل نمی‌شود.
 *
 * هیچ `Product`/`Offer`ای اینجا نیست: صفحه‌ی سکو معرفی شرایط تجاری است،
 * نه فروشگاه (آن الگو فقط برای صفحه‌ی دارایی است — `assetProductJsonLd`).
 */
export function platformWebPageJsonLd(platform: ListedPlatform): string {
  const about: Record<string, unknown> = {
    "@type": "Organization",
    name: platform.name_fa,
  };
  if (platform.website_url) about["url"] = platform.website_url;
  return jsonLdString({
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: `${SITE_URL}/${platform.slug}`,
    name: platform.name_fa,
    about,
  });
}

/**
 * `Product` + `AggregateOffer` صفحه‌ی دارایی (بند ۱۳، تصمیم ۱۸: نگاشت
 * مستقیم نمای تک‌عددی به lowPrice/highPrice).
 *
 * ورودی همان گروه «معلوم‌ها»ی رندر است (ردیف‌های با مؤثر خرید معلوم، به
 * همان ترتیب صعودی صفحه) — نه هیچ fetch تازه‌ای؛ پس عدد JSON-LD با عدد
 * قابل‌مشاهده‌ی همان رندر ISR یکی است حتی وقتی هر دو ۶۰ ثانیه کهنه‌اند.
 *
 * بازه‌ی lowPrice/highPrice بیان ساخت‌یافته‌ی «هیچ میانگین بین‌سکویی
 * منتشر نمی‌شود» است (بند ۱۳، تصمیم ۱۹): بازه می‌دهیم، عدد سراسری نه.
 *
 * ⚠️ فقط سکوهایی که **خریدشان باز است** شمرده می‌شوند (`isBuyOpen`).
 * `AggregateOffer` ادعای «می‌توانی همین حالا بخری» است؛ سکوی خریدبسته روی
 * خودِ صفحه نشان «خرید بسته است» می‌گیرد و کارت «بهترین خرید» هم نامزدش
 * نمی‌کند، پس اگر در این بازه بماند، داده‌ی ساخت‌یافته پیشنهادی را به گوگل
 * تبلیغ می‌کند که در دسترس نیست و با متن همان صفحه در تناقض است.
 *
 * null ⟸ هیچ اسکریپتی رندر نشود: بدون حتی یک ردیف معلومِ بازِ خرید،
 * AggregateOffer جعل نمی‌شود؛ ارز غیرتومانی هم (تا وقتی قاعده‌ی تبدیلش
 * مستند شود) عمداً بی‌اسکیما می‌ماند — تبدیل ×۱۰ فقط برای تومان⟸ریال درست است.
 */
export function assetProductJsonLd(
  listing: InstrumentListing,
  knownRows: Row[],
): string | null {
  if (listing.currency !== "TOMAN") return null;
  const buysToman = knownRows
    .filter(isBuyOpen)
    .map((row) => effectiveBuyFor(row, listing.instrument))
    .filter((price): price is number => price !== null);
  if (buysToman.length === 0) return null;
  const url = `${SITE_URL}/${listing.slug}`;
  return jsonLdString({
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.name_fa,
    url,
    offers: {
      "@type": "AggregateOffer",
      // تومان کد ISO 4217 ندارد؛ ریال دارد: ×۱۰ در لایه‌ی نمایش (بند ۶.۵).
      priceCurrency: "IRR",
      lowPrice: Math.min(...buysToman) * 10,
      highPrice: Math.max(...buysToman) * 10,
      offerCount: buysToman.length,
    },
  });
}
