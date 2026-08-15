/**
 * ⚠️ No referral field is ever a sort input, and it never reaches this
 * layer — `content-data.ts` strips it before serialize.
 */
import { AssetPage, groupRows } from "@/components/content/AssetPage";
import { Breadcrumbs } from "@/components/content/PageShell";
import { PlatformPage } from "@/components/content/PlatformPage";
import type { PlatformHistoryByRange } from "@/lib/history";
import type { InstrumentListing, ListedPlatform, PlatformSnapshot } from "@/lib/prices";
import type { ReferencePrice } from "@/lib/reference-price";
import type { Row } from "@/lib/rows";
import { SITE_URL } from "@/lib/site";
import { assetProductJsonLd, breadcrumbJsonLd, platformWebPageJsonLd } from "@/lib/structured-data";

export interface InstrumentPageData {
  kind: "instrument";
  listing: InstrumentListing;
  rows: Row[];
  generated_at: string;
}

export interface PlatformPageData {
  kind: "platform";
  platform: ListedPlatform;
  snapshot: PlatformSnapshot | null;
  updatedAt: string | null;
  hasOutbound: boolean;
  instrumentNames: Record<string, string>;
  history: PlatformHistoryByRange;
  referencePrice: ReferencePrice | null;
  generated_at: string;
}

export type SlugPageData = InstrumentPageData | PlatformPageData;

interface HeadTag {
  type: string;
  children: string;
}

export function slugJsonLdTags(data: SlugPageData): HeadTag[] {
  if (data.kind === "instrument") {
    const { priced } = groupRows(data.rows, data.listing.instrument);
    const product = assetProductJsonLd(data.listing, priced);
    const tags: HeadTag[] = [
      {
        type: "application/ld+json",
        children: breadcrumbJsonLd([
          { name: "خانه", url: `${SITE_URL}/` },
          { name: data.listing.name_fa, url: `${SITE_URL}/${data.listing.slug}` },
        ]),
      },
    ];
    if (product !== null) tags.push({ type: "application/ld+json", children: product });
    return tags;
  }
  return [
    {
      type: "application/ld+json",
      children: breadcrumbJsonLd([
        { name: "خانه", url: `${SITE_URL}/` },
        { name: data.platform.name_fa, url: `${SITE_URL}/${data.platform.slug}` },
      ]),
    },
    {
      type: "application/ld+json",
      children: platformWebPageJsonLd(data.platform),
    },
  ];
}

export function slugHead(data: SlugPageData | undefined) {
  if (data === undefined) {
    return {
      meta: [{ title: "صفحه یافت نشد" }, { name: "robots", content: "noindex" }],
    };
  }
  const [title, description, slug] =
    data.kind === "instrument"
      ? ([
          `قیمت ${data.listing.name_fa} در سکوهای آنلاین — تابلو`,
          `مقایسه‌ی قیمت مؤثر خرید و فروش ${data.listing.name_fa} (تومان بر ${data.listing.unit_fa}) در سکوهای آنلاین ایران — با احتساب کارمزد هر سکو.`,
          data.listing.slug,
        ] as const)
      : ([
          `${data.platform.name_fa} — شرایط، کارمزد و قیمت‌ها — تابلو`,
          `شرایط تجاری ${data.platform.name_fa}: کارمزد خرید و فروش با منبع، تحویل فیزیکی، هویت حقوقی و قیمت‌های مؤثر لحظه‌ای.`,
          data.platform.slug,
        ] as const);

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/${slug}` }],
    scripts: slugJsonLdTags(data),
  };
}

export function SlugPageView({ data }: { data: SlugPageData }) {
  const nowMs = Date.parse(data.generated_at);

  if (data.kind === "instrument") {
    return (
      <>
        <Breadcrumbs items={[{ label: "خانه", href: "/" }, { label: data.listing.name_fa }]} />
        <AssetPage listing={data.listing} rows={data.rows} nowMs={nowMs} />
      </>
    );
  }

  return (
    <>
      <Breadcrumbs items={[{ label: "خانه", href: "/" }, { label: data.platform.name_fa }]} />
      <PlatformPage
        platform={data.platform}
        snapshot={data.snapshot}
        updatedAt={data.updatedAt}
        hasOutbound={data.hasOutbound}
        instrumentNames={data.instrumentNames}
        history={data.history}
        referencePrice={data.referencePrice}
        nowMs={nowMs}
      />
    </>
  );
}
