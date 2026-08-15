import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { NotFoundPanel } from "../src/components/content/NotFoundPanel";
import { SlugPageView, slugHead } from "../src/components/content/SlugPageView";
import type { SlugPageData } from "../src/components/content/SlugPageView";
import type { PlatformHistory } from "../src/lib/history";
import { formatDateFa, formatDateTimeFa } from "../src/lib/format";
import type { InstrumentListing, ListedPlatform } from "../src/lib/prices";
import { buildSitemapEntries } from "../src/lib/seo/sitemap";
import { SITE_URL } from "../src/lib/site";
import { footerLinks } from "../src/lib/site-content";
import { isReservedSlug, resolveSlug } from "../src/lib/slugs";
import {
  freshIso,
  makeListing,
  makeSnapshot,
  rowOf,
  seed,
  seedHistory,
  seedHistoryByQuery,
  seedReferencePrice,
  slugPageData,
  staleIso,
  type SeededStore,
} from "./support/seed";

const PLATFORMS: ListedPlatform[] = [
  {
    slug: "wallgold",
    name_fa: "وال‌گلد",
    data_policy: "ALLOWED",
    name_en: "Wallgold",
    website_url: "https://wallgold.ir",
  },
  {
    slug: "talasea",
    name_fa: "طلاسی",
    data_policy: "ALLOWED",
    name_en: "Talasea",
    website_url: "https://talasea.ir",
    legal_entity: "شرکت توسعه راهکار الوند ارسباران",
    delivery_note_fa: "تحویل فیزیکی با اجرت ساخت (نرخ اعلام عمومی نشده)",
  },
  {
    slug: "daric",
    name_fa: "داریک",
    data_policy: "ALLOWED",
    market_model: "ORDER_BOOK",
    name_en: "Daric",
    website_url: "https://daric.gold",
  },
  {
    slug: "digikala",
    name_fa: "دیجی‌کالا",
    data_policy: "ALLOWED",
    name_en: "Digikala",
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

const NOGHRE_SINGLE: InstrumentListing = makeListing({
  slug: "noghre",
  instrument: "SILVER_990",
  name_fa: "نقره‌ی ۹۹۰",
  supporting: ["wallgold"],
  published: false,
  purity: "990",
});

function assetStore(): SeededStore {
  const now = freshIso();
  return {
    listed: PLATFORMS,
    instruments: [TALA18, NOGHRE_SINGLE],
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

async function pageOf(slug: string): Promise<SlugPageData> {
  const data = await slugPageData(slug);
  if (data === null) throw new Error(`page ${slug} returned 404`);
  return data;
}

async function renderSlug(slug: string): Promise<string> {
  return renderToStaticMarkup(<SlugPageView data={await pageOf(slug)} />);
}

describe("flat slug resolver", () => {
  it("rejects reserved words — even if the payload claims that slug", async () => {
    const store = assetStore();
    store.instruments = [
      ...(store.instruments ?? []),
      makeListing({
        slug: "blog",
        instrument: "XAU",
        name_fa: "انس جهانی طلا",
        supporting: ["wallgold", "talasea"],
        published: true,
      }),
    ];
    seed(store);
    for (const word of ["blog", "go", "api", "sitemap.xml", "robots.txt", "_next", "about"]) {
      expect(isReservedSlug(word)).toBe(true);
      expect(await resolveSlug(word)).toBeNull();
      expect(await slugPageData(word)).toBeNull();
    }
    expect(isReservedSlug("sekeh")).toBe(true);
    expect(await resolveSlug("sekeh")).toBeNull();
    expect(await slugPageData("sekeh")).toBeNull();
    expect(isReservedSlug("methodology")).toBe(true);
    expect(await resolveSlug("methodology")).toBeNull();
    expect(await slugPageData("methodology")).toBeNull();
  });

  it("asset slug ⟸ instrument, platform slug ⟸ platform, unknown ⟸ 404", async () => {
    seed(assetStore());
    expect((await pageOf("tala-18")).kind).toBe("instrument");
    expect((await pageOf("wallgold")).kind).toBe("platform");
    expect(await slugPageData("hich-vaght-nabude")).toBeNull();
  });

  it("the 404 head is explicitly noindex so a nonexistent page never gets indexed", () => {
    const head = slugHead(undefined);
    expect(head.meta).toContainEqual({ name: "robots", content: "noindex" });
    expect(head.links).toBeUndefined();
    const html = renderToStaticMarkup(<NotFoundPanel />);
    expect(html).toContain("۴۰۴");
    expect(html).toContain("صفحه پیدا نشد");
  });
});

describe("site trust links", () => {
  it("footer links expose trust pages as internal links", () => {
    expect(footerLinks).toEqual([
      { label: "درباره تابلو", href: "/about" },
      { label: "روش محاسبه قیمت‌ها", href: "/methodology" },
    ]);
  });
});

describe("publish gate — a single-platform asset gets no page", () => {
  it("asset with published=false ⟸ 404", async () => {
    seed(assetStore());
    expect(await slugPageData("noghre")).toBeNull();
  });

  it("once a second platform is enabled (the collector's flag), the page gets built — the web boundary", async () => {
    const store = assetStore();
    const now = freshIso();
    store.instruments = [
      TALA18,
      makeListing({
        slug: "noghre",
        instrument: "SILVER_990",
        name_fa: "نقره‌ی ۹۹۰",
        supporting: ["wallgold", "talasea"],
        published: true,
        purity: "990",
      }),
    ];
    store.snapshots["wallgold"] = makeSnapshot({
      slug: "wallgold",
      instrument: "SILVER_990",
      mid: 210000,
      fetchedAt: now,
    });
    store.snapshots["talasea"] = makeSnapshot({
      slug: "talasea",
      instrument: "SILVER_990",
      mid: 209000,
      fetchedAt: now,
    });
    seed(store);

    const html = await renderSlug("noghre");
    expect(html).toContain("قیمت نقره‌ی ۹۹۰");
    expect(html).toContain("۲۱۰٬۰۰۰");
    expect(html).toContain("۲۰۹٬۰۰۰");
  });

  it("sitemap only includes gate-passed assets + platforms", () => {
    const paths = buildSitemapEntries({
      posts: [],
      instruments: [TALA18, NOGHRE_SINGLE],
      platforms: PLATFORMS,
    }).map((entry) => entry.path);
    expect(paths).toContain("/tala-18");
    expect(paths).not.toContain("/noghre");
    expect(paths).toContain("/wallgold");
    expect(paths).toContain("/digikala");
  });
});

describe("asset page — /tala-18", () => {
  it('h1 is in Persian, and each platform shows its own "price" and both fees', async () => {
    seed(assetStore());
    const html = await renderSlug("tala-18");

    expect(html).toMatch(/<h1[^>]*>قیمت طلای ۱۸ عیار<\/h1>/);
    const wallgold = rowOf(html, "wallgold");
    expect(wallgold).toContain("۱۸٬۶۱۱٬۰۰۰");
    expect(wallgold).toMatch(/data-fee[^>]*>۰٫۵٪/);
    const talasea = rowOf(html, "talasea");
    expect(talasea).toContain("۱۸٬۵۳۰٬۰۰۰");
    expect(talasea).toMatch(/data-fee[^>]*>۰٫۵٪/);
    expect(html).not.toContain("۱۸٬۷۰۴٬۰۵۵");
    expect(html).not.toContain("مؤثر");
  });

  it('rows are sorted ascending by "price"', async () => {
    seed(assetStore());
    const html = await renderSlug("tala-18");
    expect(html.indexOf('data-platform="daric"')).toBeLessThan(
      html.indexOf('data-platform="talasea"'),
    );
    expect(html.indexOf('data-platform="talasea"')).toBeLessThan(
      html.indexOf('data-platform="wallgold"'),
    );
  });

  it("the unknown-fee platform no longer has a separate group — only its fee column is empty", async () => {
    seed(assetStore());
    const html = await renderSlug("tala-18");
    expect(html).not.toContain("کارمزد نامشخص — فقط قیمت میانی");
    expect(html.indexOf('data-platform="digikala"')).toBeLessThan(
      html.indexOf('data-platform="talasea"'),
    );
    const row = rowOf(html, "digikala");
    expect(row).toContain("۱۸٬۴۰۰٬۰۰۰");
    expect(row).not.toContain("قیمت میانی");
    expect(row).toMatch(/data-fee[^>]*>—/);
    expect(row).not.toMatch(/data-fee[^>]*>۰٪/);
  });

  it("the order book badge and the staleness label reuse the shared fragments", async () => {
    const store = assetStore();
    store.updatedAt["daric"] = staleIso();
    seed(store);
    const html = await renderSlug("tala-18");
    const daric = rowOf(html, "daric");
    expect(daric).toContain('data-badge="order-book"');
    expect(daric).toContain("کهنه");
  });

  it('the price column is explicitly explained as "belonging to that platform", and the head has a flat canonical', async () => {
    seed(assetStore());
    const html = await renderSlug("tala-18");
    expect(html).toContain("هیچ میانگین بین‌سکویی");

    const head = slugHead(await pageOf("tala-18"));
    expect(head.meta?.[0]).toMatchObject({ title: expect.stringContaining("طلای ۱۸ عیار") });
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: `${SITE_URL}/tala-18`,
    });
  });

  it("the table still returns 200 even with no supporting platform having data", async () => {
    const store = assetStore();
    for (const slug of ["wallgold", "talasea", "daric", "digikala"]) {
      store.snapshots[slug] = null;
      store.updatedAt[slug] = staleIso();
    }
    seed(store);
    const html = await renderSlug("tala-18");
    expect(html).toContain("قیمت در دسترس نیست");
    expect(html).toContain("کهنه");
  });
});

describe("platform page — /talasea and /wallgold", () => {
  it("has the name, website link (with the full rel), terms, legal entity, and physical delivery", async () => {
    seed(assetStore());
    const html = await renderSlug("talasea");

    expect(html).toContain("طلاسی");
    expect(html).toContain('href="/go/talasea"');
    expect(html).not.toContain('href="https://talasea.ir"');
    expect(html).toContain('rel="sponsored nofollow noopener"');
    expect(html).toContain("کارمزد خرید");
    expect(html).toContain("۰٫۵٪");
    expect(html).toContain("رفت‌وبرگشت");
    expect(html).toContain("از API سکو");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰");
    expect(html).toContain("شرکت توسعه راهکار الوند ارسباران");
    expect(html).toContain("تحویل فیزیکی با اجرت ساخت");
    expect(html).not.toContain("۱۸٬۷۱۵٬۳۰۰");
    expect(html).not.toContain("۱۸٬۳۴۴٬۷۰۰");
    expect(html).not.toContain("قیمت‌های این سکو");
  });

  it('undocumented metadata is honestly shown as "not recorded", not fabricated', async () => {
    seed(assetStore());
    const html = await renderSlug("wallgold");
    expect(html).toContain("ثبت نشده است");
  });

  it("open/closed and staleness badges are also on the platform page", async () => {
    const store = assetStore();
    const now = freshIso();
    store.snapshots["wallgold"] = makeSnapshot({
      slug: "wallgold",
      mid: 18611000,
      sellEnabled: false,
      fetchedAt: now,
    });
    store.updatedAt["wallgold"] = staleIso();
    seed(store);
    const html = await renderSlug("wallgold");
    expect(html).toContain("فروش بسته است");
    expect(html).toContain("کهنه");
  });

  it("the platform page's head has a flat canonical and doesn't build a Product", async () => {
    seed(assetStore());
    const head = slugHead(await pageOf("wallgold"));
    expect(head.meta?.[0]).toMatchObject({ title: expect.stringContaining("وال‌گلد") });
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: `${SITE_URL}/wallgold`,
    });
    expect(head.scripts).toHaveLength(2);
    const raw = head.scripts?.map((script) => script.children).join("\n") ?? "";
    expect(raw).toContain("BreadcrumbList");
    expect(raw).toContain('"@type":"WebPage"');
    expect(raw).not.toContain("Product");
    expect(raw).not.toContain("AggregateOffer");
  });

  it("complete source outage ⟸ the platform page stays 200 (staleness, not error)", async () => {
    const store = assetStore();
    store.snapshots["talasea"] = null;
    store.updatedAt["talasea"] = staleIso();
    seed(store);
    const html = await renderSlug("talasea");
    expect(html).toContain("طلاسی");
    expect(html).toContain("قیمت در دسترس نیست");
    expect(html).toContain("کهنه");
  });

  it("a platform with no outbound destination doesn't produce a dead button", async () => {
    const store = assetStore();
    store.listed = [{ slug: "wallgold", name_fa: "وال‌گلد", data_policy: "ALLOWED" }];
    seed(store);
    const data = await pageOf("wallgold");
    expect(data.kind === "platform" && data.hasOutbound).toBe(false);
    const html = renderToStaticMarkup(<SlugPageView data={data} />);
    expect(html).not.toContain('href="/go/wallgold"');
  });
});

describe('the "today\'s price" section of the platform page — known/unknown fee', () => {
  it('the "price" card has the Persian date in the title and an explicit note that the fee isn\'t included', async () => {
    const store = assetStore();
    seed(store);
    const html = await renderSlug("talasea");

    const expectedDate = formatDateFa(store.updatedAt["talasea"] as string);
    expect(html).toContain(expectedDate);

    expect(html).toContain("قیمت هر گرم (پیش از کارمزد)");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰");

    expect(html).toContain("پیش از کارمزد");
    expect(html).not.toContain("دوقیمتی");
    expect(html).not.toContain("تک‌قیمتی");
  });

  it('unknown fee ⟸ the section still appears, with the price and an "unknown" fee', async () => {
    seed(assetStore());
    const html = await renderSlug("digikala");

    expect(html).toContain("دیجی‌کالا");
    expect(html).toContain("قیمت هر گرم (پیش از کارمزد)");
    expect(html).toContain("۱۸٬۴۰۰٬۰۰۰");
    expect(html).toContain("کارمزد خرید");
    expect(html).toContain("نامشخص");
    expect(html).toContain("سکو کارمزدش را اعلام نکرده است");
  });

  it('the "this platform\'s prices" table (QuotesSection) no longer exists — neither for known nor unknown fee', async () => {
    seed(assetStore());
    const known = await renderSlug("talasea");
    const unknown = await renderSlug("digikala");
    expect(known).not.toContain("قیمت‌های این سکو");
    expect(unknown).not.toContain("قیمت‌های این سکو");
  });

  it("the Article 5 notice bar stays untouched", async () => {
    seed(assetStore());
    const html = await renderSlug("talasea");
    expect(html).toContain('data-legal-notice="madde-5"');
  });
});

describe('the "union rate" bar on the platform page (ticket 33)', () => {
  it("with a seeded reference price, the bar renders with its label, the 18k number, and its read time", async () => {
    seed(assetStore());
    seedHistory([]);
    seedReferencePrice({
      reference_slug: "talair",
      instrument: "GOLD_18K_TOMAN",
      value: 18559700,
      read_at: "2026-08-07T10:00:00.000Z",
    });
    const html = await renderSlug("talasea");

    expect(html).toContain("data-union-rate");
    expect(html).toContain("نرخ اتحادیه");
    expect(html).toContain("۱۸٬۵۵۹٬۷۰۰");
    expect(html).toContain(formatDateTimeFa("2026-08-07T10:00:00.000Z"));
  });

  it("reference source outage (no history) ⟸ the bar doesn't render at all, the page stays 200", async () => {
    seed(assetStore());
    seedHistory([]);
    seedReferencePrice(null);
    const html = await renderSlug("talasea");

    expect(html).not.toContain("data-union-rate");
    expect(html).not.toContain("نرخ اتحادیه");
    expect(html).toContain("طلاسی");
  });

  it("the bar's number doesn't collide with the platform's own reference price — two separate strings in the HTML", async () => {
    seed(assetStore());
    seedHistory([]);
    seedReferencePrice({
      reference_slug: "talair",
      instrument: "GOLD_18K_TOMAN",
      value: 18559700,
      read_at: "2026-08-07T10:00:00.000Z",
    });
    const html = await renderSlug("talasea");

    expect(html).toContain("۱۸٬۵۵۹٬۷۰۰");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰");
  });
});

describe("the platform page's rate card — PlatformRateCard", () => {
  it("the large number = the platform's \"price\", with a label stating it's before fees", async () => {
    seed(assetStore());
    seedHistory([]);
    const html = await renderSlug("talasea");
    expect(html).toContain("data-rate-price");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰");
    expect(html).toContain("قیمت اعلامی این سکو — پیش از کارمزد");
    expect(html).not.toContain("میانگین خرید و فروش این سکو");
  });

  it('unknown fee ⟸ the "this platform\'s quoted price" label, driven by hasUnknownFee, not a manual list', async () => {
    const store = assetStore();
    const now = freshIso();
    store.listed = [
      ...PLATFORMS,
      { slug: "melligold", name_fa: "ملی‌گلد", data_policy: "ALLOWED" },
    ];
    store.snapshots["melligold"] = makeSnapshot({
      slug: "melligold",
      mid: 18490000,
      feeSource: "UNKNOWN",
      fetchedAt: now,
    });
    store.updatedAt["melligold"] = now;
    seed(store);
    seedHistory([]);
    const html = await renderSlug("melligold");
    expect(html).toContain("قیمت اعلامی این سکو");
    expect(html).not.toContain("میانگین خرید و فروش این سکو");
  });

  it("the chart plots the same large-number series; the three stats (change up, max, min) come from that same series", async () => {
    seed(assetStore());
    const history: PlatformHistory[] = [
      {
        platform_slug: "talasea",
        points: [
          { hour: "2026-08-06T09:00:00.000Z", value: 18400000 },
          { hour: "2026-08-06T15:00:00.000Z", value: 18300000 },
          { hour: "2026-08-06T21:00:00.000Z", value: 18530000 },
        ],
        latest: 18530000,
        side_used: "PRICE",
      },
    ];
    seedHistory(history);
    const html = await renderSlug("talasea");
    expect(html).not.toContain("هنوز سابقه‌ی روند ۲۴ ساعته‌ای برای این سکو ثبت نشده است.");
    expect(html).toContain("۱۸٬۵۳۰٬۰۰۰");
    expect(html).toContain("۱۸٬۳۰۰٬۰۰۰");
    expect(html).toContain("+۰٫۷۱٪");
    expect(html).toContain("text-positive");
  });

  it("a downward change gets the text-negative color", async () => {
    seed(assetStore());
    seedHistory([
      {
        platform_slug: "wallgold",
        points: [
          { hour: "2026-08-06T09:00:00.000Z", value: 18700000 },
          { hour: "2026-08-06T15:00:00.000Z", value: 18820000 },
          { hour: "2026-08-06T18:00:00.000Z", value: 18590000 },
          { hour: "2026-08-06T21:00:00.000Z", value: 18611000 },
        ],
        latest: 18611000,
        side_used: "PRICE",
      },
    ]);
    const html = await renderSlug("wallgold");
    expect(html).toContain("text-negative");
    expect(html).toContain("−۰٫۴۸٪");
    expect(html).toContain("۱۸٬۸۲۰٬۰۰۰");
    expect(html).toContain("۱۸٬۵۹۰٬۰۰۰");
  });

  it("a platform with no history: the card renders without a chart, the page stays 200", async () => {
    seed(assetStore());
    seedHistory([]);
    const html = await renderSlug("talasea");
    expect(html).toContain("data-rate-price");
    expect(html).toContain("هنوز سابقه‌ی روند ۲۴ ساعته‌ای برای این سکو ثبت نشده است.");
  });

  it("a platform with no reference price (no snapshot) doesn't render the card at all", async () => {
    const store = assetStore();
    store.snapshots["talasea"] = null;
    store.updatedAt["talasea"] = staleIso();
    seed(store);
    seedHistory([]);
    const html = await renderSlug("talasea");
    expect(html).not.toContain("data-rate-price");
    expect(html).toContain("قیمت در دسترس نیست");
  });
});

function rateCardSection(html: string): string {
  const match = html.match(/<section[^>]*aria-labelledby="rate-card-heading"[\s\S]*?<\/section>/);
  if (!match) throw new Error("rate card not found in HTML");
  return match[0];
}

describe("the live countdown and staleness label on the rate card", () => {
  it('with fresh data, both the "last updated" label and the 30-second countdown render', async () => {
    seed(assetStore());
    seedHistory([]);
    const html = await renderSlug("talasea");
    const card = rateCardSection(html);
    expect(card).toContain("به‌روزرسانی:");
    expect(card).toContain("data-rate-countdown");
    expect(card).toContain("بروزرسانی بعدی در ۳۰ ثانیه");
    expect(card).not.toContain("کهنه");
  });

  it("with stale data, the countdown doesn't render but the staleness label stays", async () => {
    const store = assetStore();
    store.updatedAt["talasea"] = staleIso();
    seed(store);
    seedHistory([]);
    const html = await renderSlug("talasea");
    const card = rateCardSection(html);
    expect(card).toContain("به‌روزرسانی:");
    expect(card).toContain("کهنه");
    expect(card).not.toContain("data-rate-countdown");
    expect(card).not.toContain("بروزرسانی بعدی در");
  });

  it("source outage (no snapshot) doesn't render the card at all — no countdown, no fake timestamp label", async () => {
    const store = assetStore();
    store.snapshots["talasea"] = null;
    store.updatedAt["talasea"] = staleIso();
    seed(store);
    seedHistory([]);
    const html = await renderSlug("talasea");
    expect(html).not.toContain("data-rate-countdown");
    expect(html).toContain("قیمت در دسترس نیست");
  });
});

function tabButton(html: string, label: string): string {
  const match = html.match(new RegExp(`<button[^>]*>${label}</button>`));
  if (!match) throw new Error(`tab "${label}" not found in HTML`);
  return match[0];
}

describe("the rate card's period tab bar — daily/weekly/monthly", () => {
  it("has role=tablist and daily is the default active tab (aria-selected)", async () => {
    seed(assetStore());
    seedHistory([]);
    const html = await renderSlug("talasea");

    expect(html).toContain('role="tablist"');
    const dailyTab = tabButton(html, "روزانه");
    expect(dailyTab).toContain('aria-selected="true"');
    expect(dailyTab).not.toContain('disabled=""');
  });

  it('sufficient weekly coverage ⟸ the weekly tab is active and clickable; insufficient monthly coverage ⟸ "coming soon" and disabled', async () => {
    seed(assetStore());
    seedHistoryByQuery((query) => {
      if (query.stepHours === 2) {
        return [
          {
            platform_slug: "talasea",
            points: [{ hour: "2026-08-06T09:00:00.000Z", value: 18400000 }],
            latest: 18400000,
            side_used: "PRICE",
            has_enough_coverage: true,
          },
        ];
      }
      if (query.stepHours === 8) {
        return [
          {
            platform_slug: "talasea",
            points: [{ hour: "2026-08-06T09:00:00.000Z", value: 18400000 }],
            latest: 18400000,
            side_used: "PRICE",
            has_enough_coverage: false, // کمتر از نیم پنجره — «به‌زودی»
          },
        ];
      }
      return [];
    });
    const html = await renderSlug("talasea");

    const weeklyTab = tabButton(html, "هفتگی");
    expect(weeklyTab).not.toContain('disabled=""');
    expect(weeklyTab).toContain('aria-selected="false"');

    const comingSoonTab = tabButton(html, "به‌زودی");
    expect(comingSoonTab).toContain('disabled=""');
    expect(comingSoonTab).toContain('aria-disabled="true"');
    expect(html).not.toContain(">ماهانه<");
  });

  it("the three-stat region has aria-live — switching tabs announces the number to screen readers", async () => {
    seed(assetStore());
    seedHistory([
      {
        platform_slug: "talasea",
        points: [{ hour: "2026-08-06T09:00:00.000Z", value: 18400000 }],
        latest: 18400000,
        side_used: "PRICE",
      },
    ]);
    const html = await renderSlug("talasea");
    expect(html).toContain('aria-live="polite"');
  });
});

describe("sitemap — only gate-passed pages", () => {
  it("includes the published asset and platforms; the single-platform asset is absent; no lastmod", () => {
    const entries = buildSitemapEntries({
      posts: [],
      instruments: [TALA18, NOGHRE_SINGLE],
      platforms: PLATFORMS,
    });
    const paths = entries.map((entry) => entry.path);

    expect(paths).toContain("/tala-18");
    expect(paths).not.toContain("/noghre");
    expect(paths).toContain("/wallgold");
    expect(paths).toContain("/talasea");

    for (const path of ["/tala-18", "/wallgold"]) {
      expect(entries.find((entry) => entry.path === path)?.lastModified).toBeUndefined();
    }
  });
});
