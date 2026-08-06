/**
 * مرز وب — بلیت ۱۰: استور seed شده ⟸ داده‌ی ساخت‌یافته، نوار ماده ۵،
 * صفحه‌ی «مظنه چیست» و انضباط lastmod.
 *
 * حکم‌های بند ۶.۵ که اینجا قفل می‌شوند:
 *   - Organization + WebSite (با «مضنه آنلاین» در alternateName) فقط صفحه‌ی
 *     اصلی — بدون SearchAction؛
 *   - BreadcrumbList روی دارایی/سکو/بلاگ/ایستا، نه ریشه؛
 *   - Product + AggregateOffer فقط صفحه‌ی دارایی، با IRR = تومان×۱۰ از
 *     **همان رندر** (هر دو عدد از یک رشته‌ی HTML استخراج می‌شوند)؛
 *   - هیچ Offer فروشنده، FAQPage، HowTo، SearchAction یا AggregateRating
 *     خودی — هیچ‌جا؛
 *   - بدون ردیف معلوم، AggregateOffer جعل نمی‌شود.
 * و بند ۷.۲: نوار ماده ۵ روی هر صفحه‌ی دارای لینک ارجاع (/go/).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import SlugPage from "../app/[slug]/page";
import BlogPostPage from "../app/blog/[slug]/page";
import BlogIndex from "../app/blog/page";
import DarbarePishnahad from "../app/darbare-pishnahad/page";
import { metadata as rootMetadata } from "../app/layout";
import MazaneChist, { metadata as mazaneChistMetadata } from "../app/mazane-chist/page";
import Home, { metadata as homeMetadata } from "../app/page";
import sitemap from "../app/sitemap";
import { setBlogSource, type BlogPost } from "../lib/blog";
import { formatToman } from "../lib/format";
import type { InstrumentListing, ListedPlatform } from "../lib/prices";
import { SITE_URL } from "../lib/site";
import { isReservedSlug, resolveSlug } from "../lib/slugs";
import {
  freshIso,
  makeListing,
  makeSnapshot,
  seed,
  type SeededStore,
} from "./support/seed";

/* ---------- ابزار استخراج JSON-LD از HTML رندرشده ---------- */

/** همه‌ی بلوک‌های ld+json — JSON.parse شکست بخورد یعنی JSON-LD معتبر نیست. */
function jsonLdBlocks(html: string): Record<string, unknown>[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (match) => JSON.parse(match[1]) as Record<string, unknown>,
  );
}

function findByType(
  blocks: Record<string, unknown>[],
  type: string,
): Record<string, unknown> | undefined {
  return blocks.find((block) => block["@type"] === type);
}

/** همه‌ی مقادیر ‎@type‎ به‌صورت بازگشتی (داخل ‎@graph‎ و آبجکت‌های تو در تو). */
function collectTypes(node: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, out);
  } else if (node !== null && typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "@type" && typeof value === "string") out.add(value);
      else collectTypes(value, out);
    }
  }
  return out;
}

/* ---------- seed — همان شکل JSON کانونی گردآورنده ---------- */

const PLATFORMS: ListedPlatform[] = [
  {
    slug: "wallgold",
    name_fa: "وال‌گلد",
    data_policy: "ALLOWED",
    website_url: "https://wallgold.ir",
  },
  {
    slug: "talasea",
    name_fa: "طلاسی",
    data_policy: "ALLOWED",
    website_url: "https://talasea.ir",
  },
  {
    slug: "daric",
    name_fa: "داریک",
    data_policy: "ALLOWED",
    market_model: "ORDER_BOOK",
    website_url: "https://daric.gold",
  },
  {
    slug: "digikala",
    name_fa: "دیجی‌کالا",
    data_policy: "ALLOWED",
    website_url: "https://www.digikala.com",
  },
];

const TALA18: InstrumentListing = makeListing({
  slug: "tala-18",
  instrument: "GOLD_18K",
  name_fa: "طلای ۱۸ عیار",
  supporting: ["wallgold", "talasea", "daric", "digikala"],
  published: true,
  purity: "750",
});

/** مؤثرهای معلوم: داریک ۱۸٬۵۷۹٬۸۸۴ (کمینه) … طلاسی ۱۸٬۷۱۵٬۳۰۰ (بیشینه). */
const KNOWN_BUY_MIN_TOMAN = 18579884;
const KNOWN_BUY_MAX_TOMAN = 18715300;

function assetStore(): SeededStore {
  const now = freshIso();
  return {
    listed: PLATFORMS,
    instruments: [TALA18],
    snapshots: {
      wallgold: makeSnapshot({
        slug: "wallgold",
        mid: 18611000,
        buy: 18704055,
        sell: 18517945,
        reference: 18611000,
        fetchedAt: now,
      }),
      talasea: makeSnapshot({
        slug: "talasea",
        mid: 18530000,
        buy: KNOWN_BUY_MAX_TOMAN,
        sell: 18344700,
        reference: 18530000,
        fetchedAt: now,
      }),
      daric: makeSnapshot({
        slug: "daric",
        mid: 18501633,
        buy: KNOWN_BUY_MIN_TOMAN,
        sell: 18423383,
        reference: 18501634,
        fetchedAt: now,
      }),
      // کارمزد نامعلوم: فقط MID — هرگز وارد AggregateOffer نمی‌شود.
      digikala: makeSnapshot({
        slug: "digikala",
        mid: 18400000,
        feeSource: "UNKNOWN",
        fetchedAt: now,
      }),
    },
    updatedAt: { wallgold: now, talasea: now, daric: now, digikala: now },
  };
}

const PUBLISHED_POST: BlogPost = {
  slug: "moghayese-karmozd-sakooha",
  title_fa: "مقایسه‌ی کارمزد سکوهای طلای آنلاین",
  body_md: "قیمت پایه تقریباً یکسان است؛ **کارمزد** فرق می‌سازد.",
  status: "published",
  published_at: "2026-07-20T08:30:00.000Z",
  updated_at: "2026-07-22T10:00:00.000Z",
};

function seedBlog(posts: BlogPost[]): void {
  setBlogSource({
    listPosts: async () => posts,
    getPost: async (slug) => posts.find((p) => p.slug === slug) ?? null,
  });
}

function pageProps(slug: string): { params: Promise<{ slug: string }> } {
  return { params: Promise.resolve({ slug }) };
}

const MADDE5_TEXT =
  "معاملات طلای برخط صرفاً با پذیرش ریسک از سوی طرفین انجام می‌شود و مشمول ضمانت دولت و نظام بانکی نیست.";

/* ---------- Organization + WebSite — فقط صفحه‌ی اصلی ---------- */

describe("Organization + WebSite (بند ۶.۵ + بند ۱۱)", () => {
  it("صفحه‌ی اصلی هر دو را با برند «مظنه آنلاین» و alternateName «مضنه آنلاین» دارد", async () => {
    seed(assetStore());
    const html = renderToStaticMarkup(await Home());
    const graphBlock = jsonLdBlocks(html).find((block) => "@graph" in block);
    expect(graphBlock).toBeDefined();
    const graph = (graphBlock as Record<string, unknown>)["@graph"] as Record<
      string,
      unknown
    >[];

    const organization = graph.find((node) => node["@type"] === "Organization");
    expect(organization).toMatchObject({
      name: "مظنه آنلاین",
      alternateName: "مضنه آنلاین",
      url: SITE_URL,
    });

    const webSite = graph.find((node) => node["@type"] === "WebSite");
    expect(webSite).toMatchObject({
      name: "مظنه آنلاین",
      alternateName: "مضنه آنلاین",
      url: SITE_URL,
      inLanguage: "fa",
    });
  });

  it("SearchAction/potentialAction ندارد و خانه BreadcrumbList نمی‌گیرد", async () => {
    seed(assetStore());
    const html = renderToStaticMarkup(await Home());
    expect(html).not.toContain("SearchAction");
    expect(html).not.toContain("potentialAction");
    expect(html).not.toContain("BreadcrumbList");
  });

  it("WebSite/Organization سراسری روی صفحات دیگر تکرار نمی‌شود", async () => {
    seed(assetStore());
    for (const slug of ["tala-18", "wallgold"]) {
      const html = renderToStaticMarkup(await SlugPage(pageProps(slug)));
      expect(html).not.toContain('"@type":"WebSite"');
      expect(html).not.toContain('"@type":"Organization"');
    }
  });
});

/* ---------- Product + AggregateOffer — فقط صفحه‌ی دارایی ---------- */

describe("Product + AggregateOffer صفحه‌ی دارایی (بند ۶.۵ + تصمیم ۱۸)", () => {
  it("IRR دقیقاً ×۱۰ همان عدد تومانی قابل‌مشاهده‌ی همان رندر است", async () => {
    seed(assetStore());
    // یک رشته‌ی HTML از یک رندر: هم عدد نمایش و هم JSON-LD از همین می‌آیند.
    const html = renderToStaticMarkup(await SlugPage(pageProps("tala-18")));

    const product = findByType(jsonLdBlocks(html), "Product");
    expect(product).toBeDefined();
    expect(product).toMatchObject({
      name: "طلای ۱۸ عیار",
      url: `${SITE_URL}/tala-18`,
    });

    const offers = (product as Record<string, unknown>).offers as Record<string, unknown>;
    expect(offers["@type"]).toBe("AggregateOffer");
    expect(offers.priceCurrency).toBe("IRR");
    // عدد JSON (نه رشته) — و دقیقاً ×۱۰ تومانِ گردآورنده.
    expect(offers.lowPrice).toBe(KNOWN_BUY_MIN_TOMAN * 10);
    expect(offers.highPrice).toBe(KNOWN_BUY_MAX_TOMAN * 10);
    // هم‌ارزی با عدد قابل‌مشاهده‌ی همان رندر: ÷۱۰ همان قالب فارسی صفحه است.
    expect(html).toContain(formatToman((offers.lowPrice as number) / 10));
    expect(html).toContain(formatToman((offers.highPrice as number) / 10));
  });

  it("offerCount = فقط سکوهای با مؤثر خرید معلوم (کارمزد نامشخص نمی‌شمرد)", async () => {
    seed(assetStore());
    const html = renderToStaticMarkup(await SlugPage(pageProps("tala-18")));
    const product = findByType(jsonLdBlocks(html), "Product");
    const offers = (product as Record<string, unknown>).offers as Record<string, unknown>;
    // چهار سکوی پشتیبان، ولی دیجی‌کالا (UNKNOWN) مؤثر ندارد ⟸ ۳.
    expect(offers.offerCount).toBe(3);
  });

  it("ارقام قیمت JSON-LD لاتین‌اند (بند ۶.۶ — متن فارسی مجاز، عدد فارسی نه)", async () => {
    seed(assetStore());
    const html = renderToStaticMarkup(await SlugPage(pageProps("tala-18")));
    const raw = html.match(
      /<script type="application\/ld\+json">([^<]*"@type":"Product"[^<]*)<\/script>/,
    );
    expect(raw).not.toBeNull();
    // عدد به‌صورت JSON number با ارقام لاتین سریال شده — نه رشته‌ی فارسی.
    const offers = (raw as RegExpMatchArray)[1].match(/"offers":\{[^}]*\}/);
    expect(offers).not.toBeNull();
    expect((offers as RegExpMatchArray)[0]).toContain(
      `"lowPrice":${KNOWN_BUY_MIN_TOMAN * 10}`,
    );
    expect((offers as RegExpMatchArray)[0]).toContain(
      `"highPrice":${KNOWN_BUY_MAX_TOMAN * 10}`,
    );
    expect((offers as RegExpMatchArray)[0]).not.toMatch(/[۰-۹]/);
  });

  it("بدون حتی یک ردیف معلوم، AggregateOffer جعل نمی‌شود (اسکریپت غایب است)", async () => {
    const now = freshIso();
    seed({
      listed: PLATFORMS,
      instruments: [TALA18],
      snapshots: {
        // فقط کارمزد نامشخص (MID) و منبع قطع — هیچ مؤثر معلومی نیست.
        digikala: makeSnapshot({
          slug: "digikala",
          mid: 18400000,
          feeSource: "UNKNOWN",
          fetchedAt: now,
        }),
        wallgold: null,
        talasea: null,
        daric: null,
      },
      updatedAt: { digikala: now, wallgold: null, talasea: null, daric: null },
    });
    const html = renderToStaticMarkup(await SlugPage(pageProps("tala-18")));
    expect(html).not.toContain("AggregateOffer");
    expect(html).not.toContain('"@type":"Product"');
    // ولی BreadcrumbList سر جایش است.
    expect(findByType(jsonLdBlocks(html), "BreadcrumbList")).toBeDefined();
  });

  it("صفحه‌ی سکو Product/Offer نمی‌گیرد — ما فروشنده نیستیم", async () => {
    seed(assetStore());
    const html = renderToStaticMarkup(await SlugPage(pageProps("wallgold")));
    expect(html).not.toContain('"@type":"Product"');
    expect(html).not.toContain("AggregateOffer");
  });
});

/* ---------- BreadcrumbList — همه‌جا جز ریشه ---------- */

describe("BreadcrumbList (بند ۶.۵)", () => {
  it("صفحه‌ی دارایی: خانه ⟵ دارایی، با URL مطلق و position لاتین", async () => {
    seed(assetStore());
    const html = renderToStaticMarkup(await SlugPage(pageProps("tala-18")));
    const breadcrumb = findByType(jsonLdBlocks(html), "BreadcrumbList");
    expect(breadcrumb).toBeDefined();
    expect((breadcrumb as Record<string, unknown>).itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "خانه", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "طلای ۱۸ عیار", item: `${SITE_URL}/tala-18` },
    ]);
  });

  it("صفحه‌ی سکو: خانه ⟵ سکو", async () => {
    seed(assetStore());
    const html = renderToStaticMarkup(await SlugPage(pageProps("wallgold")));
    const breadcrumb = findByType(jsonLdBlocks(html), "BreadcrumbList");
    expect((breadcrumb as Record<string, unknown>).itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "خانه", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "وال‌گلد", item: `${SITE_URL}/wallgold` },
    ]);
  });

  it("پست بلاگ: خانه ⟵ بلاگ ⟵ پست (BlogPosting هم سر جایش می‌ماند)", async () => {
    seedBlog([PUBLISHED_POST]);
    const html = renderToStaticMarkup(
      await BlogPostPage(pageProps(PUBLISHED_POST.slug)),
    );
    const blocks = jsonLdBlocks(html);
    expect(findByType(blocks, "BlogPosting")).toBeDefined();
    const breadcrumb = findByType(blocks, "BreadcrumbList");
    expect((breadcrumb as Record<string, unknown>).itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "خانه", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "بلاگ", item: `${SITE_URL}/blog` },
      {
        "@type": "ListItem",
        position: 3,
        name: PUBLISHED_POST.title_fa,
        item: `${SITE_URL}/blog/${PUBLISHED_POST.slug}`,
      },
    ]);
  });

  it("صفحات ایستا (فهرست بلاگ، درباره‌ی پیشنهاد، مظنه چیست) هم دارند", async () => {
    seedBlog([]);
    for (const html of [
      renderToStaticMarkup(await BlogIndex()),
      renderToStaticMarkup(<DarbarePishnahad />),
      renderToStaticMarkup(<MazaneChist />),
    ]) {
      const breadcrumb = findByType(jsonLdBlocks(html), "BreadcrumbList");
      expect(breadcrumb).toBeDefined();
      const items = (breadcrumb as Record<string, unknown>).itemListElement as Record<
        string,
        unknown
      >[];
      expect(items[0]).toMatchObject({ position: 1, item: `${SITE_URL}/` });
    }
  });
});

/* ---------- انواع ممنوع — هیچ‌جا (بند ۶.۵) ---------- */

describe("انواع حذف‌شده‌ی بند ۶.۵ هیچ‌جا نیستند", () => {
  it("FAQPage / HowTo / SearchAction / AggregateRating / Offer فروشنده — غایب مطلق", async () => {
    seed(assetStore());
    seedBlog([PUBLISHED_POST]);
    const pages = [
      renderToStaticMarkup(await Home()),
      renderToStaticMarkup(await SlugPage(pageProps("tala-18"))),
      renderToStaticMarkup(await SlugPage(pageProps("wallgold"))),
      renderToStaticMarkup(await BlogPostPage(pageProps(PUBLISHED_POST.slug))),
      renderToStaticMarkup(await BlogIndex()),
      renderToStaticMarkup(<DarbarePishnahad />),
      renderToStaticMarkup(<MazaneChist />),
    ];
    for (const html of pages) {
      for (const forbidden of ["FAQPage", "HowTo", "SearchAction", "AggregateRating"]) {
        expect(html).not.toContain(forbidden);
      }
      // AggregateOffer مجاز است ولی Offer تکی (merchant listing) نه:
      const types = collectTypes(jsonLdBlocks(html));
      expect(types.has("Offer")).toBe(false);
    }
  });
});

/* ---------- نوار ماده ۵ (بند ۷.۲) ---------- */

describe("نوار هشدار ماده ۵ روی صفحات ارجاع", () => {
  it("صفحه‌ی اصلی، صفحه‌ی دارایی و صفحه‌ی سکو — متن کامل در HTML سرور", async () => {
    seed(assetStore());
    const pages = [
      renderToStaticMarkup(await Home()),
      renderToStaticMarkup(await SlugPage(pageProps("tala-18"))),
      renderToStaticMarkup(await SlugPage(pageProps("talasea"))),
    ];
    for (const html of pages) {
      expect(html).toContain(MADDE5_TEXT);
      // جای ثابت و متمایز — نوار پایانی نشانه‌گذاری‌شده.
      expect(html).toContain('data-legal-notice="madde-5"');
    }
  });
});

/* ---------- صفحه‌ی «مظنه چیست» (بند ۱۱ + تصمیم ۱) ---------- */

describe("صفحه‌ی مظنه چیست — /mazane-chist", () => {
  it("هر دو املا را پوشش می‌دهد و مفهوم (قیمت یک مثقال طلای آب‌شده) را می‌گوید", () => {
    const html = renderToStaticMarkup(<MazaneChist />);
    expect(html).toContain("مظنه");
    expect(html).toContain("مضنه");
    expect(html).toContain("مثقال");
    expect(html).toContain("آب‌شده");
    // به جدول اصلی لینک می‌دهد:
    expect(html).toContain('href="/"');
  });

  it("canonical تخت لاتین دارد و عنوانش فارسی است", () => {
    expect(mazaneChistMetadata.alternates?.canonical).toBe(`${SITE_URL}/mazane-chist`);
    expect(mazaneChistMetadata.title).toContain("مظنه چیست");
  });

  it("اسلاگش سمت وب رزرو است و هرگز از مسیر داینامیک حل نمی‌شود", async () => {
    seed(assetStore());
    expect(isReservedSlug("mazane-chist")).toBe(true);
    expect(await resolveSlug("mazane-chist")).toBeNull();
  });

  it("در سایت‌مپ هست — بدون lastmod (بند ۶.۷)", async () => {
    seed(assetStore());
    seedBlog([]);
    const entries = await sitemap();
    const entry = entries.find((e) => e.url === `${SITE_URL}/mazane-chist`);
    expect(entry).toBeDefined();
    expect(entry?.lastModified).toBeUndefined();
  });
});

/* ---------- متادیتا و انضباط lastmod ---------- */

describe("متادیتا (بند ۶.۶) و lastmod (بند ۶.۷)", () => {
  it("خانه canonical ریشه دارد و لایه‌ی ریشه og:locale=fa_IR", () => {
    expect(homeMetadata.alternates?.canonical).toBe(`${SITE_URL}/`);
    expect(rootMetadata.openGraph?.locale).toBe("fa_IR");
  });

  it("فقط پست‌های بلاگ lastmod دارند — نوسان قیمت هرگز lastmod نیست", async () => {
    seed(assetStore());
    seedBlog([PUBLISHED_POST]);
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(4);
    for (const entry of entries) {
      if (entry.url.startsWith(`${SITE_URL}/blog/`)) {
        expect(entry.lastModified).toBe(PUBLISHED_POST.updated_at);
      } else {
        expect(entry.lastModified, `${entry.url} نباید lastmod داشته باشد`).toBeUndefined();
      }
    }
  });
});
