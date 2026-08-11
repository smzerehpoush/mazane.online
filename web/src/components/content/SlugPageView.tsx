/**
 * نمای مسیر تخت ‎/<slug>‎ — صفحه‌ی دارایی یا صفحه‌ی سکو — و سرصفحه‌ی آن.
 *
 * **بدون هیچ وابستگی به روتر** (همان دلیل `tablo/HomePage.tsx`): مرز تست وب
 * «استور seed شده ⟸ خروجی رندرشده» است و مسیر تنکستک بدون بستر روتر رندر
 * نمی‌شود. مسیر فقط سیم‌کشی می‌ماند.
 *
 * قرارداد props همین‌جا تعریف شده و `lib/content-data.ts` از اینجا می‌خواندش —
 * پس این ماژول هیچ ارجاعی به لایه‌ی سروری ندارد و `ioredis`/`pg` هرگز به گراف
 * تست نمی‌آیند.
 *
 * ⚠️ بند ۶.۴: هیچ فیلد معرفی (referral) ورودی مرتب‌سازی نیست و اصلاً به این
 * لایه نمی‌رسد — `content-data.ts` پیش از serialize حذفش می‌کند.
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

/** صفحه‌ی دارایی — جدول همه‌ی سکوهای پشتیبان همین دارایی. */
export interface InstrumentPageData {
  kind: "instrument";
  listing: InstrumentListing;
  /** ردیف‌های سکوهای پشتیبان، به ترتیب فهرست عمومی گردآورنده. */
  rows: Row[];
  /** زمان تولید payload — مبنای «چند دقیقه پیش»، یکی در سرور و کلاینت. */
  generated_at: string;
}

/** صفحه‌ی سکو — فراداده، شرایط تجاری و قیمت‌های جاری همان سکو. */
export interface PlatformPageData {
  kind: "platform";
  platform: ListedPlatform;
  snapshot: PlatformSnapshot | null;
  updatedAt: string | null;
  /**
   * آیا ‎/go/<slug>‎ مقصدی دارد (نشانی معرف یا وب‌سایت)؟ روی سرور حساب
   * می‌شود چون `referral_url` عمداً از payload حذف شده است. بدون مقصد،
   * ریدایرکت ۴۰۴ می‌شد و لینک مرده می‌ماند.
   */
  hasOutbound: boolean;
  /** نام فارسی هر کد دارایی — برای ستون «دارایی» جدول قیمت‌ها. */
  instrumentNames: Record<string, string>;
  /**
   * تاریخچه‌ی قیمت مرجع همین سکو (طلای ۱۸ عیار)، هر سه بازه — کارت نرخ بالای
   * صفحه با نوار زبانه‌ی روزانه/هفتگی/ماهانه (بلیت ۲۷ + بلیت ۳۰). هر بازه
   * `null` یعنی منبع قطع بود یا سکو هنوز سابقه‌ای ندارد؛ کارت/زبانه بدون
   * نمودار رندر می‌شود، نه throw (قاعده‌ی ۵).
   */
  history: PlatformHistoryByRange;
  /**
   * نوار «نرخ اتحادیه» (تیکت ۳۳) — مرجع قیمت مستقل (نه سکو، نه محاسبه‌شده).
   * `null` یعنی منبع مرجع قطع بود یا سابقه‌ای نبود؛ نوار اصلاً رندر نمی‌شود
   * (قاعده‌ی ۵) — صفحه همچنان ۲۰۰ می‌ماند.
   */
  referencePrice: ReferencePrice | null;
  generated_at: string;
}

export type SlugPageData = InstrumentPageData | PlatformPageData;

interface HeadTag {
  type: string;
  children: string;
}

/**
 * اسکریپت‌های داده‌ی ساخت‌یافته‌ی همین صفحه (بند ۶.۵).
 *
 * `Product` + `AggregateOffer` فقط صفحه‌ی دارایی، و از **همان** ردیف‌های
 * قیمت‌داری که جدول رندر می‌کند (`groupRows` مشترک است) — پس عدد JSON-LD
 * با عدد قابل‌مشاهده یکی است، بدون هیچ fetch جدا. این همخوانی از وقتی
 * `lowPrice` به «قیمت» سوئیچ شد (سند تصمیم ۰۰۰۲) الزام سخت‌تری است. برای سکو هیچ Product/Offer
 * ساخته نمی‌شود: ما فروشنده نیستیم؛ به‌جایش `WebPage` با `about` از نوع
 * `Organization` (نام سکو + website_url خودش) — بلیت ۲۹، بدون @id مستقل.
 */
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

/** سرصفحه — متا، canonical تخت لاتین و اسکریپت‌های بالا. */
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
          `مقایسه‌ی قیمت مؤثر خرید و فروش ${data.listing.name_fa} (تومان بر ${data.listing.unit_fa}) در سکوهای آنلاین ایران — با احتساب کارمزد و قیمت مرجع هر سکو.`,
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
  // مبنای «چند دقیقه پیش» از payload سرور می‌آید، نه ساعت مرورگر — پس متن
  // سرور و کلاینت یکی است.
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
