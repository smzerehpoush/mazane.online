/**
 * ⚠️ در تنکستک استارت اسکریپت‌های JSON-LD از `head` مسیر می‌آیند، نه از بدنه‌ی
 * جزء. پس اینجا سازنده‌های سرصفحه سنجیده می‌شوند — همان‌هایی که مسیر عیناً
 * صدایشان می‌زند — و برای هم‌ارزی عدد، از **همان** payload رندر هم گرفته
 * می‌شود.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { blogIndexHead, blogPostHead } from "../src/components/content/BlogViews";
import { SlugPageView, slugHead } from "../src/components/content/SlugPageView";
import { HomePage, homeHead } from "../src/components/tablo/HomePage";
import type { HomePageData } from "../src/components/tablo/HomePage";
import type { SlugPageData } from "../src/components/content/SlugPageView";
import { getPublishedPost, type BlogPost, type PublishedPost } from "../src/lib/blog";
import { formatToman } from "../src/lib/format";
import type { InstrumentListing, ListedPlatform } from "../src/lib/prices";
import { buildSitemapEntries } from "../src/lib/seo/sitemap";
import { SITE_URL } from "../src/lib/site";
import { isReservedSlug, resolveSlug } from "../src/lib/slugs";
import { DarbarePishnahad, darbarePishnahadHead } from "../src/routes/darbare-pishnahad";
import { MazaneChist, mazaneChistHead } from "../src/routes/mazane-chist";
import {
  freshIso,
  homeData,
  makeListing,
  makeSnapshot,
  rowOf,
  seed,
  seedBlog,
  slugPageData,
  type SeededStore,
} from "./support/seed";

interface HeadLike {
  scripts?: { type: string; children: string }[];
  links?: { rel: string; href: string }[];
  meta?: Record<string, string>[];
}

function jsonLdBlocks(head: HeadLike): Record<string, unknown>[] {
  return (head.scripts ?? []).map(
    (script) => JSON.parse(script.children) as Record<string, unknown>,
  );
}

function rawJsonLd(head: HeadLike): string {
  return (head.scripts ?? []).map((script) => script.children).join("\n");
}

function findByType(
  blocks: Record<string, unknown>[],
  type: string,
): Record<string, unknown> | undefined {
  return blocks.find((block) => block["@type"] === type);
}

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

const PRICE_MIN_TOMAN = 18400000;
const PRICE_MAX_TOMAN = 18611000;

function assetStore(): SeededStore {
  const now = freshIso();
  return {
    listed: PLATFORMS,
    instruments: [TALA18],
    snapshots: {
      wallgold: makeSnapshot({
        slug: "wallgold",
        mid: 18611000,
        fetchedAt: now,
      }),
      talasea: makeSnapshot({
        slug: "talasea",
        mid: 18530000,
        fetchedAt: now,
      }),
      daric: makeSnapshot({
        slug: "daric",
        mid: 18501633,
        fetchedAt: now,
      }),
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

const PUBLISHED_POST_WITH_IMAGE: BlogPost = {
  ...PUBLISHED_POST,
  image_url: "https://s3.tablo.test/tablo-media/posts/moghayese-karmozd-sakooha/hash.webp",
  image_alt: "نمودار مقایسه‌ی کارمزد سکوهای طلای آنلاین",
  image_width: 1600,
  image_height: 900,
};

const MADDE5_TEXT =
  "معاملات طلای برخط صرفاً با پذیرش ریسک از سوی طرفین انجام می‌شود و مشمول ضمانت دولت و نظام بانکی نیست.";

async function pageOf(slug: string): Promise<SlugPageData> {
  const data = await slugPageData(slug);
  if (data === null) throw new Error(`صفحه‌ی ${slug} ۴۰۴ شد`);
  return data;
}

async function home(): Promise<HomePageData> {
  return homeData(assetStore());
}

describe("Organization + WebSite", () => {
  it("صفحه‌ی اصلی هر دو را با برند «تابلو» و alternateName «تابلو گلد» دارد", () => {
    const head = homeHead();
    const graphBlock = jsonLdBlocks(head).find((block) => "@graph" in block);
    expect(graphBlock).toBeDefined();
    const graph = (graphBlock as Record<string, unknown>)["@graph"] as Record<string, unknown>[];

    expect(graph.find((node) => node["@type"] === "Organization")).toMatchObject({
      name: "تابلو",
      alternateName: "تابلو گلد",
      url: SITE_URL,
    });
    expect(graph.find((node) => node["@type"] === "WebSite")).toMatchObject({
      name: "تابلو",
      alternateName: "تابلو گلد",
      url: SITE_URL,
      inLanguage: "fa",
    });
  });

  it("SearchAction/potentialAction ندارد و خانه BreadcrumbList نمی‌گیرد", () => {
    const head = homeHead();
    const raw = rawJsonLd(head);
    expect(raw).not.toContain("SearchAction");
    expect(raw).not.toContain("potentialAction");
    expect(raw).not.toContain("BreadcrumbList");
  });

  it("WebSite/Organization سراسری روی صفحات دیگر تکرار نمی‌شود", async () => {
    seed(assetStore());
    for (const slug of ["tala-18", "wallgold"]) {
      const raw = rawJsonLd(slugHead(await pageOf(slug)));
      expect(raw).not.toContain('"@type":"WebSite"');
      expect(raw).not.toContain(`${SITE_URL}/#organization`);
      expect(raw).not.toContain("تابلو گلد");
    }
    const assetRaw = rawJsonLd(slugHead(await pageOf("tala-18")));
    expect(assetRaw).not.toContain('"@type":"Organization"');
  });
});

describe("WebPage + about:Organization", () => {
  it("صفحه‌ی سکو WebPage با about از نوع Organization (نام سکو + website_url خودش) دارد", async () => {
    seed(assetStore());
    const webPage = findByType(
      jsonLdBlocks(slugHead(await pageOf("wallgold"))),
      "WebPage",
    ) as Record<string, unknown>;
    expect(webPage).toMatchObject({ url: `${SITE_URL}/wallgold`, name: "وال‌گلد" });
    expect(webPage["about"]).toMatchObject({
      "@type": "Organization",
      name: "وال‌گلد",
      url: "https://wallgold.ir",
    });
  });

  it("Organization تو در توی about هیچ @id مستقل نمی‌گیرد — موجودیت جدا نیست", async () => {
    seed(assetStore());
    const webPage = findByType(
      jsonLdBlocks(slugHead(await pageOf("wallgold"))),
      "WebPage",
    ) as Record<string, unknown>;
    const about = webPage["about"] as Record<string, unknown>;
    expect(about["@id"]).toBeUndefined();
  });

  it("صفحه‌ی دارایی WebPage/about نمی‌گیرد — این الگو فقط صفحه‌ی سکو است", async () => {
    seed(assetStore());
    const blocks = jsonLdBlocks(slugHead(await pageOf("tala-18")));
    expect(findByType(blocks, "WebPage")).toBeUndefined();
  });

  it("سکوی بدون website_url ⟸ about فقط name دارد، url جعل نمی‌شود", async () => {
    const now = freshIso();
    const store: SeededStore = {
      listed: [{ slug: "wallgold", name_fa: "وال‌گلد", data_policy: "ALLOWED" }],
      instruments: [TALA18],
      snapshots: {
        wallgold: makeSnapshot({
          slug: "wallgold",
          mid: 18611000,
          fetchedAt: now,
        }),
      },
      updatedAt: { wallgold: now },
    };
    seed(store);
    const webPage = findByType(
      jsonLdBlocks(slugHead(await pageOf("wallgold"))),
      "WebPage",
    ) as Record<string, unknown>;
    const about = webPage["about"] as Record<string, unknown>;
    expect(about).toMatchObject({ "@type": "Organization", name: "وال‌گلد" });
    expect(about["url"]).toBeUndefined();
  });

  it("BreadcrumbList هم کنار WebPage سر جایش می‌ماند", async () => {
    seed(assetStore());
    const blocks = jsonLdBlocks(slugHead(await pageOf("wallgold")));
    expect(findByType(blocks, "WebPage")).toBeDefined();
    expect(findByType(blocks, "BreadcrumbList")).toBeDefined();
  });
});

describe("Product + AggregateOffer", () => {
  it("صفحه‌ی دارایی: IRR دقیقاً ×۱۰ همان عدد تومانی قابل‌مشاهده‌ی همان payload است", async () => {
    seed(assetStore());
    const data = await pageOf("tala-18");
    const html = renderToStaticMarkup(<SlugPageView data={data} />);

    const product = findByType(jsonLdBlocks(slugHead(data)), "Product");
    expect(product).toMatchObject({
      name: "طلای ۱۸ عیار",
      url: `${SITE_URL}/tala-18`,
    });

    const offers = (product as Record<string, unknown>)["offers"] as Record<string, unknown>;
    expect(offers["@type"]).toBe("AggregateOffer");
    expect(offers["priceCurrency"]).toBe("IRR");
    expect(offers["lowPrice"]).toBe(PRICE_MIN_TOMAN * 10);
    expect(offers["highPrice"]).toBe(PRICE_MAX_TOMAN * 10);
    expect(html).toContain(formatToman((offers["lowPrice"] as number) / 10));
    expect(html).toContain(formatToman((offers["highPrice"] as number) / 10));
  });

  it("offerCount = هر سکوی قیمت‌دارِ بازِ خرید (کارمزد نامشخص هم می‌شمرد)", async () => {
    seed(assetStore());
    const product = findByType(jsonLdBlocks(slugHead(await pageOf("tala-18"))), "Product");
    const offers = (product as Record<string, unknown>)["offers"] as Record<string, unknown>;
    expect(offers["offerCount"]).toBe(4);
  });

  it("ارقام قیمت JSON-LD لاتین‌اند (متن فارسی مجاز، عدد فارسی نه)", async () => {
    seed(assetStore());
    const raw = rawJsonLd(slugHead(await pageOf("tala-18")));
    const offers = raw.match(/"offers":\{[^}]*\}/);
    expect(offers).not.toBeNull();
    expect((offers as RegExpMatchArray)[0]).toContain(`"lowPrice":${PRICE_MIN_TOMAN * 10}`);
    expect((offers as RegExpMatchArray)[0]).toContain(`"highPrice":${PRICE_MAX_TOMAN * 10}`);
    expect((offers as RegExpMatchArray)[0]).not.toMatch(/[۰-۹]/);
  });

  /**
   * ⚠️ رگرسیون: صفحه‌ی اصلی هم دقیقاً همان `Product` + `AggregateOffer`
   * ‎/tala-18‎ را منتشر می‌کرد (بایت‌به‌بایت جز `url`). یک موجودیت روی دو
   * نشانی یعنی گوگل باید یکی را کانونی کند — کنیبالیزیشن بی‌دلیل.
   * هم `Product` را «فقط صفحات دارایی» می‌داند.
   */
  it("صفحه‌ی اصلی Product/AggregateOffer نمی‌گیرد — موجودیت فقط روی صفحه‌ی دارایی است", async () => {
    seed(assetStore());
    const homeRaw = rawJsonLd(homeHead());
    expect(homeRaw).not.toContain('"@type":"Product"');
    expect(homeRaw).not.toContain("AggregateOffer");
    const assetRaw = rawJsonLd(slugHead(await pageOf("tala-18")));
    expect(assetRaw).toContain('"@type":"Product"');
    expect(assetRaw).toContain("AggregateOffer");
  });

  /** ⚠️ این تست در بازطراحی ۲۰۲۶-۰۸-۱۱ **دامنه‌اش عوض شد، نه سخت‌گیری‌اش**. */
  it("lowPrice همان عددی است که در متن صفحه‌ی دارایی دیده می‌شود", async () => {
    seed(assetStore());
    const data = await pageOf("tala-18");
    const html = renderToStaticMarkup(<SlugPageView data={data} />);
    const product = findByType(jsonLdBlocks(slugHead(data)), "Product");
    const offers = (product as Record<string, unknown>)["offers"] as Record<string, unknown>;

    expect(html).toContain(formatToman(PRICE_MIN_TOMAN));
    expect(offers["lowPrice"]).toBe(PRICE_MIN_TOMAN * 10);
  });

  /**
   * ⚠️ رگرسیون: `buy_enabled=false` کارت «کمترین قیمت» را درست جابه‌جا
   * می‌کرد ولی `lowPrice` همان قیمتِ سکوی **بسته** می‌ماند — یعنی به
   * گوگل پیشنهادی تبلیغ می‌شد که در دسترس نیست و با متن همان صفحه (نشان
   * «خرید بسته است») در تناقض بود. یک تعریف واحد از «سمت باز» برای هر سه
   * مصرف‌کننده: کارت، جدول، AggregateOffer.
   */
  it("سکوی خریدبسته در AggregateOffer نمی‌آید ولی ردیفش با نشان سر جایش می‌ماند", async () => {
    const store = assetStore();
    const now = freshIso();
    store.snapshots["digikala"] = makeSnapshot({
      slug: "digikala",
      mid: 18400000,
      feeSource: "UNKNOWN",
      buyEnabled: false,
      fetchedAt: now,
    });
    seed(store);
    const data = await pageOf("tala-18");

    const offers = (findByType(jsonLdBlocks(slugHead(data)), "Product") as Record<string, unknown>)[
      "offers"
    ] as Record<string, unknown>;
    expect(offers["lowPrice"]).toBe(18501633 * 10);
    expect(offers["highPrice"]).toBe(PRICE_MAX_TOMAN * 10);
    expect(offers["offerCount"]).toBe(3);
    expect(rawJsonLd(slugHead(data))).not.toContain(String(PRICE_MIN_TOMAN * 10));

    const html = renderToStaticMarkup(<SlugPageView data={data} />);
    expect(rowOf(html, "digikala")).toContain('data-badge="buy-closed"');
    expect(rowOf(html, "digikala")).toContain("خرید بسته است");
  });

  it("بدون حتی یک ردیف قیمت‌دار، AggregateOffer جعل نمی‌شود (اسکریپت غایب است)", async () => {
    const now = freshIso();
    const store: SeededStore = {
      listed: PLATFORMS,
      instruments: [TALA18],
      snapshots: { digikala: null, wallgold: null, talasea: null, daric: null },
      updatedAt: { digikala: null, wallgold: null, talasea: null, daric: null },
    };
    void now;
    seed(store);
    const head = slugHead(await pageOf("tala-18"));
    expect(rawJsonLd(head)).not.toContain("AggregateOffer");
    expect(rawJsonLd(head)).not.toContain('"@type":"Product"');
    expect(findByType(jsonLdBlocks(head), "BreadcrumbList")).toBeDefined();
  });

  it("صفحه‌ی سکو Product/Offer نمی‌گیرد — ما فروشنده نیستیم", async () => {
    seed(assetStore());
    const raw = rawJsonLd(slugHead(await pageOf("wallgold")));
    expect(raw).not.toContain('"@type":"Product"');
    expect(raw).not.toContain("AggregateOffer");
  });
});

describe("BreadcrumbList", () => {
  it("صفحه‌ی دارایی: خانه ⟵ دارایی، با URL مطلق و position لاتین", async () => {
    seed(assetStore());
    const breadcrumb = findByType(
      jsonLdBlocks(slugHead(await pageOf("tala-18"))),
      "BreadcrumbList",
    );
    expect((breadcrumb as Record<string, unknown>)["itemListElement"]).toEqual([
      { "@type": "ListItem", position: 1, name: "خانه", item: `${SITE_URL}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "طلای ۱۸ عیار",
        item: `${SITE_URL}/tala-18`,
      },
    ]);
  });

  it("صفحه‌ی سکو: خانه ⟵ سکو", async () => {
    seed(assetStore());
    const breadcrumb = findByType(
      jsonLdBlocks(slugHead(await pageOf("wallgold"))),
      "BreadcrumbList",
    );
    expect((breadcrumb as Record<string, unknown>)["itemListElement"]).toEqual([
      { "@type": "ListItem", position: 1, name: "خانه", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "وال‌گلد", item: `${SITE_URL}/wallgold` },
    ]);
  });

  it("پست بلاگ: خانه ⟵ بلاگ ⟵ پست (BlogPosting هم سر جایش می‌ماند)", async () => {
    seedBlog([PUBLISHED_POST]);
    const post = (await getPublishedPost(PUBLISHED_POST.slug)) as PublishedPost;
    const blocks = jsonLdBlocks(blogPostHead(post));
    expect(findByType(blocks, "BlogPosting")).toBeDefined();
    const breadcrumb = findByType(blocks, "BreadcrumbList");
    expect((breadcrumb as Record<string, unknown>)["itemListElement"]).toEqual([
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

  it("صفحات ایستا (فهرست بلاگ، درباره‌ی پیشنهاد، مظنه چیست) هم دارند", () => {
    for (const head of [blogIndexHead(), darbarePishnahadHead(), mazaneChistHead()]) {
      const breadcrumb = findByType(jsonLdBlocks(head), "BreadcrumbList");
      expect(breadcrumb).toBeDefined();
      const items = (breadcrumb as Record<string, unknown>)["itemListElement"] as Record<
        string,
        unknown
      >[];
      expect(items[0]).toMatchObject({ position: 1, item: `${SITE_URL}/` });
    }
  });
});

describe("انواع حذف‌شده‌ی هیچ‌جا نیستند", () => {
  it("FAQPage / HowTo / SearchAction / AggregateRating / Offer فروشنده — غایب مطلق", async () => {
    seed(assetStore());
    seedBlog([PUBLISHED_POST]);
    const post = (await getPublishedPost(PUBLISHED_POST.slug)) as PublishedPost;
    const heads: HeadLike[] = [
      homeHead(),
      slugHead(await pageOf("tala-18")),
      slugHead(await pageOf("wallgold")),
      blogPostHead(post),
      blogIndexHead(),
      darbarePishnahadHead(),
      mazaneChistHead(),
    ];
    for (const head of heads) {
      const raw = rawJsonLd(head);
      for (const forbidden of ["FAQPage", "HowTo", "SearchAction", "AggregateRating"]) {
        expect(raw).not.toContain(forbidden);
      }
      expect(collectTypes(jsonLdBlocks(head)).has("Offer")).toBe(false);
    }
  });
});

describe("نوار هشدار ماده ۵ روی صفحات ارجاع", () => {
  it("صفحه‌ی اصلی، صفحه‌ی دارایی و صفحه‌ی سکو — متن کامل در HTML سرور", async () => {
    const homePayload = await home();
    seed(assetStore());
    const pages = [
      renderToStaticMarkup(<HomePage data={homePayload} />),
      renderToStaticMarkup(<SlugPageView data={await pageOf("tala-18")} />),
      renderToStaticMarkup(<SlugPageView data={await pageOf("talasea")} />),
    ];
    for (const html of pages) {
      expect(html).toContain(MADDE5_TEXT);
      expect(html).toContain('data-legal-notice="madde-5"');
    }
  });
});

describe("صفحه‌ی مظنه چیست — /mazane-chist", () => {
  it("هر دو املا را پوشش می‌دهد و مفهوم (قیمت یک مثقال طلای آب‌شده) را می‌گوید", () => {
    const html = renderToStaticMarkup(<MazaneChist />);
    expect(html).toContain("مظنه");
    expect(html).toContain("مضنه");
    expect(html).toContain("مثقال");
    expect(html).toContain("آب‌شده");
    expect(html).toContain('href="/"');
  });

  it("canonical تخت لاتین دارد و عنوانش فارسی است", () => {
    const head = mazaneChistHead();
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: `${SITE_URL}/mazane-chist`,
    });
    expect(head.meta[0]?.title).toContain("مظنه چیست");
  });

  it("اسلاگش سمت وب رزرو است و هرگز از مسیر داینامیک حل نمی‌شود", async () => {
    seed(assetStore());
    expect(isReservedSlug("mazane-chist")).toBe(true);
    expect(await resolveSlug("mazane-chist")).toBeNull();
    expect(await slugPageData("mazane-chist")).toBeNull();
  });

  it("در سایت‌مپ هست — بدون lastmod", () => {
    const entry = buildSitemapEntries({
      posts: [],
      instruments: [],
      platforms: [],
    }).find((item) => item.path === "/mazane-chist");
    expect(entry).toBeDefined();
    expect(entry?.lastModified).toBeUndefined();
  });
});

describe("متادیتا و lastmod", () => {
  it("خانه canonical ریشه و og:locale=fa_IR دارد", () => {
    const head = homeHead();
    expect(head.links).toContainEqual({ rel: "canonical", href: `${SITE_URL}/` });
    expect(head.meta).toContainEqual({ property: "og:locale", content: "fa_IR" });
  });

  it("فقط پست‌های بلاگ lastmod دارند — نوسان قیمت هرگز lastmod نیست", async () => {
    seedBlog([PUBLISHED_POST]);
    const post = (await getPublishedPost(PUBLISHED_POST.slug)) as PublishedPost;
    const entries = buildSitemapEntries({
      posts: [post],
      instruments: [TALA18],
      platforms: PLATFORMS,
    });
    expect(entries.length).toBeGreaterThan(4);
    for (const entry of entries) {
      if (entry.path.startsWith("/blog/")) {
        expect(entry.lastModified).toBe(PUBLISHED_POST.updated_at);
      } else {
        expect(entry.lastModified, `${entry.path} نباید lastmod داشته باشد`).toBeUndefined();
      }
    }
  });
});

describe("عکس شاخص پست — og:image/twitter و فیلد image در BlogPosting", () => {
  it("پست با عکس: og:image/og:image:width/og:image:height/twitter:image/twitter:card", async () => {
    seedBlog([PUBLISHED_POST_WITH_IMAGE]);
    const post = (await getPublishedPost(PUBLISHED_POST_WITH_IMAGE.slug)) as PublishedPost;
    const head = blogPostHead(post);
    expect(head.meta).toContainEqual({
      property: "og:image",
      content: PUBLISHED_POST_WITH_IMAGE.image_url,
    });
    expect(head.meta).toContainEqual({ property: "og:image:width", content: "1600" });
    expect(head.meta).toContainEqual({ property: "og:image:height", content: "900" });
    expect(head.meta).toContainEqual({
      name: "twitter:image",
      content: PUBLISHED_POST_WITH_IMAGE.image_url,
    });
    expect(head.meta).toContainEqual({ name: "twitter:card", content: "summary_large_image" });
  });

  it("پست بدون عکس: هیچ‌کدام از تگ‌های تصویر در متا نیست — نه با مقدار خالی", async () => {
    seedBlog([PUBLISHED_POST]);
    const post = (await getPublishedPost(PUBLISHED_POST.slug)) as PublishedPost;
    const raw = JSON.stringify(blogPostHead(post).meta);
    expect(raw).not.toContain("og:image");
    expect(raw).not.toContain("twitter:image");
    expect(raw).not.toContain("twitter:card");
  });

  it("BlogPosting: فیلد image فقط وقتی عکس هست، برابر همان نشانی مطلق", async () => {
    seedBlog([PUBLISHED_POST_WITH_IMAGE]);
    const post = (await getPublishedPost(PUBLISHED_POST_WITH_IMAGE.slug)) as PublishedPost;
    const [blogPosting] = jsonLdBlocks(blogPostHead(post));
    expect(blogPosting?.["image"]).toBe(PUBLISHED_POST_WITH_IMAGE.image_url);
  });

  it("پست بدون عکس: فیلد image اصلاً در BlogPosting نیست", async () => {
    seedBlog([PUBLISHED_POST]);
    const post = (await getPublishedPost(PUBLISHED_POST.slug)) as PublishedPost;
    const [blogPosting] = jsonLdBlocks(blogPostHead(post));
    expect(blogPosting).not.toHaveProperty("image");
  });
});
