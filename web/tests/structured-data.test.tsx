/**
 * ⚠️ In TanStack Start, JSON-LD scripts come from the route's `head`, not the
 * component body. So this tests the head builders themselves — the very
 * ones the route calls — and for numeric equivalence, the render also uses
 * the **same** payload.
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
import { MazaneChist, mazaneChistHead } from "../src/routes/mazane-chist";
import { sekehHead } from "../src/routes/sekeh";
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
  if (data === null) throw new Error(`Page ${slug} returned 404`);
  return data;
}

async function home(): Promise<HomePageData> {
  return homeData(assetStore());
}

describe("Organization + WebSite", () => {
  it("Home page has both, branded Tablo with alternateName Tablo Gold", () => {
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

  it("No SearchAction/potentialAction, and home page doesn't get a BreadcrumbList", () => {
    const head = homeHead();
    const raw = rawJsonLd(head);
    expect(raw).not.toContain("SearchAction");
    expect(raw).not.toContain("potentialAction");
    expect(raw).not.toContain("BreadcrumbList");
  });

  it("Site-wide WebSite/Organization isn't repeated on other pages", async () => {
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
  it("Platform page has a WebPage with an about of type Organization (platform name + its own website_url)", async () => {
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

  it("Nested Organization inside about gets no independent @id — it's not a separate entity", async () => {
    seed(assetStore());
    const webPage = findByType(
      jsonLdBlocks(slugHead(await pageOf("wallgold"))),
      "WebPage",
    ) as Record<string, unknown>;
    const about = webPage["about"] as Record<string, unknown>;
    expect(about["@id"]).toBeUndefined();
  });

  it("Asset page doesn't get WebPage/about — this pattern is platform-page only", async () => {
    seed(assetStore());
    const blocks = jsonLdBlocks(slugHead(await pageOf("tala-18")));
    expect(findByType(blocks, "WebPage")).toBeUndefined();
  });

  it("Platform without website_url ⟸ about only has name, url isn't fabricated", async () => {
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

  it("BreadcrumbList still holds its place alongside WebPage", async () => {
    seed(assetStore());
    const blocks = jsonLdBlocks(slugHead(await pageOf("wallgold")));
    expect(findByType(blocks, "WebPage")).toBeDefined();
    expect(findByType(blocks, "BreadcrumbList")).toBeDefined();
  });
});

describe("Product + AggregateOffer", () => {
  it("Asset page: IRR is exactly the visible toman figure from the same payload, ×10", async () => {
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

  it("offerCount = every priced, buy-open platform (unknown fee counts too)", async () => {
    seed(assetStore());
    const product = findByType(jsonLdBlocks(slugHead(await pageOf("tala-18"))), "Product");
    const offers = (product as Record<string, unknown>)["offers"] as Record<string, unknown>;
    expect(offers["offerCount"]).toBe(4);
  });

  it("JSON-LD price digits are Latin (Persian text is fine, Persian digits aren't)", async () => {
    seed(assetStore());
    const raw = rawJsonLd(slugHead(await pageOf("tala-18")));
    const offers = raw.match(/"offers":\{[^}]*\}/);
    expect(offers).not.toBeNull();
    expect((offers as RegExpMatchArray)[0]).toContain(`"lowPrice":${PRICE_MIN_TOMAN * 10}`);
    expect((offers as RegExpMatchArray)[0]).toContain(`"highPrice":${PRICE_MAX_TOMAN * 10}`);
    expect((offers as RegExpMatchArray)[0]).not.toMatch(/[۰-۹]/);
  });

  /**
   * ⚠️ Regression: the home page used to also publish the exact same
   * `Product` + `AggregateOffer` as /tala-18 (byte-for-byte except for
   * `url`). One entity at two addresses means Google has to canonicalize
   * one of them — pointless cannibalization. This also establishes
   * `Product` as "asset pages only".
   */
  it("Home page doesn't get Product/AggregateOffer — the entity lives only on the asset page", async () => {
    seed(assetStore());
    const homeRaw = rawJsonLd(homeHead());
    expect(homeRaw).not.toContain('"@type":"Product"');
    expect(homeRaw).not.toContain("AggregateOffer");
    const assetRaw = rawJsonLd(slugHead(await pageOf("tala-18")));
    expect(assetRaw).toContain('"@type":"Product"');
    expect(assetRaw).toContain("AggregateOffer");
  });

  /** ⚠️ In the 2026-08-11 redesign, this test's **scope changed, not its strictness**. */
  it("lowPrice matches the number visible in the asset page's own text", async () => {
    seed(assetStore());
    const data = await pageOf("tala-18");
    const html = renderToStaticMarkup(<SlugPageView data={data} />);
    const product = findByType(jsonLdBlocks(slugHead(data)), "Product");
    const offers = (product as Record<string, unknown>)["offers"] as Record<string, unknown>;

    expect(html).toContain(formatToman(PRICE_MIN_TOMAN));
    expect(offers["lowPrice"]).toBe(PRICE_MIN_TOMAN * 10);
  });

  /**
   * ⚠️ Regression: `buy_enabled=false` correctly moved the "lowest price"
   * card, but `lowPrice` stayed at the **closed** platform's price —
   * meaning Google was advertised an offer that isn't actually available,
   * contradicting the same page's own text (the "buy closed" badge). One
   * single definition of "open side" for all three consumers: card, table,
   * AggregateOffer.
   */
  it("Buy-closed platform doesn't enter AggregateOffer, but its row still keeps its badge", async () => {
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

  it("With not even one priced row, AggregateOffer isn't fabricated (the script is absent)", async () => {
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

  it("Platform page doesn't get Product/Offer — we aren't the seller", async () => {
    seed(assetStore());
    const raw = rawJsonLd(slugHead(await pageOf("wallgold")));
    expect(raw).not.toContain('"@type":"Product"');
    expect(raw).not.toContain("AggregateOffer");
  });
});

describe("BreadcrumbList", () => {
  it("Asset page: home ⟵ asset, with an absolute URL and Latin position", async () => {
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

  it("Platform page: home ⟵ platform", async () => {
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

  it("Blog post: home ⟵ blog ⟵ post (BlogPosting still holds its place too)", async () => {
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

  it("Static pages (blog index, sekeh, mazane-chist) have it too", () => {
    for (const head of [blogIndexHead(), sekehHead(), mazaneChistHead()]) {
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

describe("Removed types appear nowhere", () => {
  it("FAQPage / HowTo / SearchAction / AggregateRating / seller Offer — absolutely absent", async () => {
    seed(assetStore());
    seedBlog([PUBLISHED_POST]);
    const post = (await getPublishedPost(PUBLISHED_POST.slug)) as PublishedPost;
    const heads: HeadLike[] = [
      homeHead(),
      slugHead(await pageOf("tala-18")),
      slugHead(await pageOf("wallgold")),
      blogPostHead(post),
      blogIndexHead(),
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

describe("Madde-5 warning banner on referral pages", () => {
  it("Home page, asset page, and platform page — full text in server-rendered HTML", async () => {
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

describe("The mazane-chist page — /mazane-chist", () => {
  it("Covers both spellings and states the concept (price of one mithqal of melted gold)", () => {
    const html = renderToStaticMarkup(<MazaneChist />);
    expect(html).toContain("مظنه");
    expect(html).toContain("مضنه");
    expect(html).toContain("مثقال");
    expect(html).toContain("آب‌شده");
    expect(html).toContain('href="/"');
  });

  it("Has a flat Latin canonical, and its title is Persian", () => {
    const head = mazaneChistHead();
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: `${SITE_URL}/mazane-chist`,
    });
    expect(head.meta[0]?.title).toContain("مظنه چیست");
  });

  it("Its slug is reserved on the web side and never resolves through the dynamic route", async () => {
    seed(assetStore());
    expect(isReservedSlug("mazane-chist")).toBe(true);
    expect(await resolveSlug("mazane-chist")).toBeNull();
    expect(await slugPageData("mazane-chist")).toBeNull();
  });

  it("Is in the sitemap — without lastmod", () => {
    const entry = buildSitemapEntries({
      posts: [],
      instruments: [],
      platforms: [],
    }).find((item) => item.path === "/mazane-chist");
    expect(entry).toBeDefined();
    expect(entry?.lastModified).toBeUndefined();
  });
});

describe("Metadata and lastmod", () => {
  it("Home has a root canonical and og:locale=fa_IR", () => {
    const head = homeHead();
    expect(head.links).toContainEqual({ rel: "canonical", href: `${SITE_URL}/` });
    expect(head.meta).toContainEqual({ property: "og:locale", content: "fa_IR" });
  });

  it("Only blog posts have lastmod — price fluctuation is never lastmod", async () => {
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

describe("Post featured image — og:image/twitter and the image field in BlogPosting", () => {
  it("Post with an image: og:image/og:image:width/og:image:height/twitter:image/twitter:card", async () => {
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

  it("Post without an image: none of the image tags are in meta — not even with an empty value", async () => {
    seedBlog([PUBLISHED_POST]);
    const post = (await getPublishedPost(PUBLISHED_POST.slug)) as PublishedPost;
    const raw = JSON.stringify(blogPostHead(post).meta);
    expect(raw).not.toContain("og:image");
    expect(raw).not.toContain("twitter:image");
    expect(raw).not.toContain("twitter:card");
  });

  it("BlogPosting: the image field only exists when there's an image, equal to that same absolute URL", async () => {
    seedBlog([PUBLISHED_POST_WITH_IMAGE]);
    const post = (await getPublishedPost(PUBLISHED_POST_WITH_IMAGE.slug)) as PublishedPost;
    const [blogPosting] = jsonLdBlocks(blogPostHead(post));
    expect(blogPosting?.["image"]).toBe(PUBLISHED_POST_WITH_IMAGE.image_url);
  });

  it("Post without an image: the image field isn't in BlogPosting at all", async () => {
    seedBlog([PUBLISHED_POST]);
    const post = (await getPublishedPost(PUBLISHED_POST.slug)) as PublishedPost;
    const [blogPosting] = jsonLdBlocks(blogPostHead(post));
    expect(blogPosting).not.toHaveProperty("image");
  });
});
