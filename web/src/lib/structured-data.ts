import type { InstrumentListing, ListedPlatform } from "./prices";
import { isBuyOpen, priceToman, type Row } from "./rows";
import { SITE_URL } from "./site";

/**
 * ⚠️ `alternateName` used to be the misspelling «مضنه آنلاین», so a search
 * for that spelling would also reach the brand. Once «مظنه» left the brand
 * name, that mapping lost its purpose — but the `/mazane-chist` page still
 * targets both spellings, because there «مظنه» is a market term, not our
 * name.
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
        logo: `${SITE_URL}/tablo-logo-mark.png`,
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

export interface FaqItem {
  question: string;
  answer: string;
}

export function faqPageJsonLd(items: readonly FaqItem[]): string {
  return jsonLdString({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
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
 * ⚠️ `lowPrice`/`highPrice` come from **price**, not the effective price
 * (owner's decision, 2026-08-10). The reason is Google's consistency rule:
 * structured data must represent the page's **visible** content, and since
 * the effective price was removed from the UI, sending it to Google would
 * mean a number that isn't in the page's HTML. Accept the consequence: this
 * range is pre-fee and lower than the real cost of buying — exactly what
 * the fee columns beside it explain.
 * ⚠️ Only platforms whose **buy is open** are counted (`isBuyOpen`).
 * `AggregateOffer` is a claim that "you can buy right now"; a buy-closed
 * platform shows "buy is closed" on its own page and isn't a candidate for
 * the "best buy" card either, so if it stayed in this range, the structured
 * data would be advertising an offer to Google that isn't available and
 * contradicts that very page's own text.
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
