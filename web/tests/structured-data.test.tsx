/**
 * مرز وب — بلیت ۱۰: استور seed شده ⟸ داده‌ی ساخت‌یافته، نوار ماده ۵،
 * صفحه‌ی «مظنه چیست» و انضباط lastmod.
 *
 * حکم‌های بند ۶.۵ که اینجا قفل می‌شوند:
 *   - Organization + WebSite (با «مضنه آنلاین» در alternateName) فقط صفحه‌ی
 *     اصلی — بدون SearchAction؛
 *   - BreadcrumbList روی دارایی/سکو/بلاگ/ایستا، نه ریشه؛
 *   - Product + AggregateOffer **فقط** صفحه‌ی دارایی (نه صفحه‌ی اصلی)، با
 *     IRR = تومان×۱۰ از **همان داده‌ای که رندر شده** (هر دو از یک payload
 *     می‌آیند، بدون هیچ fetch جدا)؛
 *   - AggregateOffer فقط سکوهای **خریدباز** را می‌شمرد — همان مجموعه‌ای که
 *     کارت/جدول از آن انتخاب می‌کند؛
 *   - هیچ Offer فروشنده، FAQPage، HowTo، SearchAction یا AggregateRating
 *     خودی — هیچ‌جا؛
 *   - بدون ردیف معلوم، AggregateOffer جعل نمی‌شود.
 * و بند ۷.۲: نوار ماده ۵ روی هر صفحه‌ی دارای لینک ارجاع (/go/).
 *
 * ⚠️ در تنکستک استارت اسکریپت‌های JSON-LD از `head` مسیر می‌آیند، نه از بدنه‌ی
 * جزء. پس اینجا سازنده‌های سرصفحه سنجیده می‌شوند — همان‌هایی که مسیر عیناً
 * صدایشان می‌زند — و برای هم‌ارزی عدد، از **همان** payload رندر هم گرفته
 * می‌شود.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { blogIndexHead, blogPostHead } from "../src/components/content/BlogViews";
import { SlugPageView, slugHead } from "../src/components/content/SlugPageView";
import { HomePage, homeHead } from "../src/components/mazane/HomePage";
import type { HomePageData } from "../src/components/mazane/HomePage";
import type { SlugPageData } from "../src/components/content/SlugPageView";
import { getPublishedPost, type BlogPost, type PublishedPost } from "../src/lib/blog";
import { formatToman } from "../src/lib/format";
import type { InstrumentListing, ListedPlatform } from "../src/lib/prices";
import { buildSitemapEntries } from "../src/lib/seo/sitemap";
import { SITE_URL } from "../src/lib/site";
import { isReservedSlug, resolveSlug } from "../src/lib/slugs";
import {
  DarbarePishnahad,
  darbarePishnahadHead,
} from "../src/routes/darbare-pishnahad";
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

/* ---------- ابزار خواندن JSON-LD از سرصفحه ---------- */

interface HeadLike {
  scripts?: { type: string; children: string }[];
  links?: { rel: string; href: string }[];
  meta?: Record<string, string>[];
}

/** JSON.parse شکست بخورد یعنی JSON-LD معتبر نیست. */
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

const MADDE5_TEXT =
  "معاملات طلای برخط صرفاً با پذیرش ریسک از سوی طرفین انجام می‌شود و مشمول ضمانت دولت و نظام بانکی نیست.";

/** داده‌ی صفحه را می‌خواند و اگر ۴۰۴ باشد تست را می‌شکند. */
async function pageOf(slug: string): Promise<SlugPageData> {
  const data = await slugPageData(slug);
  if (data === null) throw new Error(`صفحه‌ی ${slug} ۴۰۴ شد`);
  return data;
}

async function home(): Promise<HomePageData> {
  return homeData(assetStore());
}

/* ---------- Organization + WebSite — فقط صفحه‌ی اصلی ---------- */

describe("Organization + WebSite (بند ۶.۵ + بند ۱۱)", () => {
  it("صفحه‌ی اصلی هر دو را با برند «مظنه آنلاین» و alternateName «مضنه آنلاین» دارد", () => {
    const head = homeHead();
    const graphBlock = jsonLdBlocks(head).find((block) => "@graph" in block);
    expect(graphBlock).toBeDefined();
    const graph = (graphBlock as Record<string, unknown>)["@graph"] as Record<
      string,
      unknown
    >[];

    expect(graph.find((node) => node["@type"] === "Organization")).toMatchObject({
      name: "مظنه آنلاین",
      alternateName: "مضنه آنلاین",
      url: SITE_URL,
    });
    expect(graph.find((node) => node["@type"] === "WebSite")).toMatchObject({
      name: "مظنه آنلاین",
      alternateName: "مضنه آنلاین",
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
      expect(raw).not.toContain('"@type":"Organization"');
    }
  });
});

/* ---------- Product + AggregateOffer ---------- */

describe("Product + AggregateOffer (بند ۶.۵ + تصمیم ۱۸)", () => {
  it("صفحه‌ی دارایی: IRR دقیقاً ×۱۰ همان عدد تومانی قابل‌مشاهده‌ی همان payload است", async () => {
    seed(assetStore());
    // یک payload: هم HTML و هم JSON-LD از همین ساخته می‌شوند.
    const data = await pageOf("tala-18");
    const html = renderToStaticMarkup(<SlugPageView data={data} />);

    const product = findByType(jsonLdBlocks(slugHead(data)), "Product");
    expect(product).toMatchObject({
      name: "طلای ۱۸ عیار",
      url: `${SITE_URL}/tala-18`,
    });

    const offers = (product as Record<string, unknown>)["offers"] as Record<
      string,
      unknown
    >;
    expect(offers["@type"]).toBe("AggregateOffer");
    expect(offers["priceCurrency"]).toBe("IRR");
    // عدد JSON (نه رشته) — و دقیقاً ×۱۰ تومانِ گردآورنده.
    expect(offers["lowPrice"]).toBe(KNOWN_BUY_MIN_TOMAN * 10);
    expect(offers["highPrice"]).toBe(KNOWN_BUY_MAX_TOMAN * 10);
    // هم‌ارزی با عدد قابل‌مشاهده‌ی همان رندر: ÷۱۰ همان قالب فارسی صفحه است.
    expect(html).toContain(formatToman((offers["lowPrice"] as number) / 10));
    expect(html).toContain(formatToman((offers["highPrice"] as number) / 10));
  });

  it("offerCount = فقط سکوهای با مؤثر خرید معلوم (کارمزد نامشخص نمی‌شمرد)", async () => {
    seed(assetStore());
    const product = findByType(jsonLdBlocks(slugHead(await pageOf("tala-18"))), "Product");
    const offers = (product as Record<string, unknown>)["offers"] as Record<
      string,
      unknown
    >;
    // چهار سکوی پشتیبان، ولی دیجی‌کالا (UNKNOWN) مؤثر ندارد ⟸ ۳.
    expect(offers["offerCount"]).toBe(3);
  });

  it("ارقام قیمت JSON-LD لاتین‌اند (بند ۶.۶ — متن فارسی مجاز، عدد فارسی نه)", async () => {
    seed(assetStore());
    const raw = rawJsonLd(slugHead(await pageOf("tala-18")));
    const offers = raw.match(/"offers":\{[^}]*\}/);
    expect(offers).not.toBeNull();
    expect((offers as RegExpMatchArray)[0]).toContain(
      `"lowPrice":${KNOWN_BUY_MIN_TOMAN * 10}`,
    );
    expect((offers as RegExpMatchArray)[0]).toContain(
      `"highPrice":${KNOWN_BUY_MAX_TOMAN * 10}`,
    );
    expect((offers as RegExpMatchArray)[0]).not.toMatch(/[۰-۹]/);
  });

  /**
   * ⚠️ رگرسیون: صفحه‌ی اصلی هم دقیقاً همان `Product` + `AggregateOffer`
   * ‎/tala-18‎ را منتشر می‌کرد (بایت‌به‌بایت جز `url`). یک موجودیت روی دو
   * نشانی یعنی گوگل باید یکی را کانونی کند — کنیبالیزیشن بی‌دلیل. بند ۶.۵
   * هم `Product` را «فقط صفحات دارایی» می‌داند.
   */
  it("صفحه‌ی اصلی Product/AggregateOffer نمی‌گیرد — موجودیت فقط روی صفحه‌ی دارایی است", async () => {
    seed(assetStore());
    const homeRaw = rawJsonLd(homeHead());
    expect(homeRaw).not.toContain('"@type":"Product"');
    expect(homeRaw).not.toContain("AggregateOffer");
    // و همان موجودیت روی صفحه‌ی کانونی خودش هست — نه غایب، فقط یکتا.
    const assetRaw = rawJsonLd(slugHead(await pageOf("tala-18")));
    expect(assetRaw).toContain('"@type":"Product"');
    expect(assetRaw).toContain("AggregateOffer");
  });

  it("عدد کارت «بهترین خرید» صفحه‌ی اصلی همان lowPrice صفحه‌ی دارایی است", async () => {
    const html = renderToStaticMarkup(<HomePage data={await home()} />);
    seed(assetStore());
    const product = findByType(jsonLdBlocks(slugHead(await pageOf("tala-18"))), "Product");
    const offers = (product as Record<string, unknown>)["offers"] as Record<
      string,
      unknown
    >;
    // یک عدد، سه جا: کارت صفحه‌ی اصلی، جدول صفحه‌ی دارایی، و JSON-LD دارایی.
    expect(html).toContain('data-best="buy" data-platform-best="daric"');
    expect(html).toContain(formatToman(KNOWN_BUY_MIN_TOMAN));
    expect(offers["lowPrice"]).toBe(KNOWN_BUY_MIN_TOMAN * 10);
  });

  /**
   * ⚠️ رگرسیون: `buy_enabled=false` وال‌گلد کارت «بهترین خرید» را درست به
   * طلاسی می‌برد ولی `lowPrice` همان قیمتِ سکوی **بسته** می‌ماند — یعنی به
   * گوگل پیشنهادی تبلیغ می‌شد که در دسترس نیست و با متن همان صفحه (نشان
   * «خرید بسته است») در تناقض بود. یک تعریف واحد از «سمت باز» برای هر سه
   * مصرف‌کننده: کارت، جدول، AggregateOffer.
   */
  it("سکوی خریدبسته در AggregateOffer نمی‌آید ولی ردیفش با نشان سر جایش می‌ماند", async () => {
    const store = assetStore();
    const now = freshIso();
    // داریک کمینه‌ی مطلق است؛ خریدش را می‌بندیم ⟸ lowPrice باید بالا برود.
    store.snapshots["daric"] = makeSnapshot({
      slug: "daric",
      mid: 18501633,
      buy: KNOWN_BUY_MIN_TOMAN,
      sell: 18423383,
      reference: 18501634,
      buyEnabled: false,
      fetchedAt: now,
    });
    seed(store);
    const data = await pageOf("tala-18");

    const offers = (
      findByType(jsonLdBlocks(slugHead(data)), "Product") as Record<string, unknown>
    )["offers"] as Record<string, unknown>;
    // کمینه‌ی سکوهای **باز**: وال‌گلد ۱۸٬۷۰۴٬۰۵۵ — نه عدد داریکِ بسته.
    expect(offers["lowPrice"]).toBe(18704055 * 10);
    expect(offers["highPrice"]).toBe(KNOWN_BUY_MAX_TOMAN * 10);
    // سه سکوی معلوم بودند؛ یکی بسته شد ⟸ ۲.
    expect(offers["offerCount"]).toBe(2);
    expect(rawJsonLd(slugHead(data))).not.toContain(String(KNOWN_BUY_MIN_TOMAN * 10));

    // ولی ردیف داریک حذف نمی‌شود — با نشان «خرید بسته است» می‌ماند.
    const html = renderToStaticMarkup(<SlugPageView data={data} />);
    expect(rowOf(html, "daric")).toContain('data-badge="buy-closed"');
    expect(rowOf(html, "daric")).toContain("خرید بسته است");
  });

  it("بدون حتی یک ردیف معلوم، AggregateOffer جعل نمی‌شود (اسکریپت غایب است)", async () => {
    const now = freshIso();
    const store: SeededStore = {
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
    };
    seed(store);
    const head = slugHead(await pageOf("tala-18"));
    expect(rawJsonLd(head)).not.toContain("AggregateOffer");
    expect(rawJsonLd(head)).not.toContain('"@type":"Product"');
    // ولی BreadcrumbList سر جایش است.
    expect(findByType(jsonLdBlocks(head), "BreadcrumbList")).toBeDefined();
  });

  it("صفحه‌ی سکو Product/Offer نمی‌گیرد — ما فروشنده نیستیم", async () => {
    seed(assetStore());
    const raw = rawJsonLd(slugHead(await pageOf("wallgold")));
    expect(raw).not.toContain('"@type":"Product"');
    expect(raw).not.toContain("AggregateOffer");
  });
});

/* ---------- BreadcrumbList — همه‌جا جز ریشه ---------- */

describe("BreadcrumbList (بند ۶.۵)", () => {
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

/* ---------- انواع ممنوع — هیچ‌جا (بند ۶.۵) ---------- */

describe("انواع حذف‌شده‌ی بند ۶.۵ هیچ‌جا نیستند", () => {
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
      // AggregateOffer مجاز است ولی Offer تکی (merchant listing) نه:
      expect(collectTypes(jsonLdBlocks(head)).has("Offer")).toBe(false);
    }
  });
});

/* ---------- نوار ماده ۵ (بند ۷.۲) ---------- */

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

  it("در سایت‌مپ هست — بدون lastmod (بند ۶.۷)", () => {
    const entry = buildSitemapEntries({
      posts: [],
      instruments: [],
      platforms: [],
    }).find((item) => item.path === "/mazane-chist");
    expect(entry).toBeDefined();
    expect(entry?.lastModified).toBeUndefined();
  });
});

/* ---------- متادیتا و انضباط lastmod ---------- */

describe("متادیتا (بند ۶.۶) و lastmod (بند ۶.۷)", () => {
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
