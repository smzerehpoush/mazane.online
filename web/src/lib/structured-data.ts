import type { InstrumentListing, ListedPlatform } from "./prices";
import { isBuyOpen, priceToman, type Row } from "./rows";
import { SITE_URL } from "./site";

/**
 * ⚠️ پیش‌تر `alternateName` غلط املایی «مضنه آنلاین» بود تا جست‌وجوی آن املا
 * هم به برند برسد. با رفتن «مظنه» از نام برند، آن نگاشت موضوعش را از دست
 * داد — ولی صفحه‌ی `/mazane-chist` هنوز هر دو املا را هدف می‌گیرد، چون آنجا
 * «مظنه» واژه‌ی بازار است نه نام ما.
 */
export const BRAND_FA = "تابلو";
export const BRAND_ALTERNATE_FA = "تابلو گلد";

export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

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
  name: string;
  url: string;
}

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
 * ⚠️ `lowPrice`/`highPrice` از **قیمت** می‌آیند، نه از قیمت مؤثر (تصمیم
 * مالک ۲۰۲۶-۰۸-۱۰). دلیلش قاعده‌ی همخوانی گوگل است: داده‌ی ساخت‌یافته باید
 * نماینده‌ی محتوای **قابل مشاهده‌ی** صفحه باشد، و از وقتی قیمت مؤثر از
 * رابط کاربری حذف شد، فرستادنش به گوگل یعنی عددی که در HTML صفحه نیست.
 * پیامدش را بپذیرید: این بازه پیش-از-کارمزد است و از هزینه‌ی واقعی خرید
 * پایین‌تر — همان چیزی که ستون‌های کارمزدِ کنارش توضیح می‌دهند.
 * ⚠️ فقط سکوهایی که **خریدشان باز است** شمرده می‌شوند (`isBuyOpen`).
 * `AggregateOffer` ادعای «می‌توانی همین حالا بخری» است؛ سکوی خریدبسته روی
 * خودِ صفحه نشان «خرید بسته است» می‌گیرد و کارت «بهترین خرید» هم نامزدش
 * نمی‌کند، پس اگر در این بازه بماند، داده‌ی ساخت‌یافته پیشنهادی را به گوگل
 * تبلیغ می‌کند که در دسترس نیست و با متن همان صفحه در تناقض است.
 */
export function assetProductJsonLd(listing: InstrumentListing, knownRows: Row[]): string | null {
  if (listing.currency !== "TOMAN") return null;
  const buysToman = knownRows
    .filter(isBuyOpen)
    .map((row) => priceToman(row, listing.instrument))
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
      priceCurrency: "IRR",
      lowPrice: Math.min(...buysToman) * 10,
      highPrice: Math.max(...buysToman) * 10,
      offerCount: buysToman.length,
    },
  });
}
