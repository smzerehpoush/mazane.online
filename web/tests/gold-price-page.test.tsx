import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SlugPageView, slugHead } from "../src/components/content/SlugPageView";
import type { SlugPageData } from "../src/components/content/SlugPageView";
import {
  buildGoldPriceView,
  GOLD_PRICE_FAQ,
  GOLD_PRICE_TITLE,
  REFERENCE_POLL_INTERVAL_SECONDS,
} from "../src/lib/gold-price";
import type { HistoryPoint, HistoryQuery, PlatformHistory } from "../src/lib/history";
import { assembleSlugPage } from "../src/lib/page-data";
import { listInstruments } from "../src/lib/catalog";
import type { InstrumentListing, ListedPlatform } from "../src/lib/prices";
import { getPlatformSnapshot, getUpdatedAt, setPriceSource } from "../src/lib/prices";
import { getReferencePrice, setReferencePriceSource } from "../src/lib/reference-price";
import { fetchRowsForPlatforms } from "../src/lib/rows";
import { SITE_URL } from "../src/lib/site";
import {
  MARKET_REFERENCE_SOURCE_NAME,
  UNION_RATE_INSTRUMENT,
  UNION_RATE_REFERENCE_SLUG,
} from "../src/lib/site-content";
import { resolveSlug } from "../src/lib/slugs";
import {
  freshIso,
  makeListing,
  makeSnapshot,
  seed,
  seedHistoryByQuery,
  seedReferencePrice,
  slugPageData,
  type SeededStore,
} from "./support/seed";

const PLATFORMS: ListedPlatform[] = [
  { slug: "wallgold", name_fa: "وال‌گلد", data_policy: "ALLOWED" },
  { slug: "talasea", name_fa: "طلاسی", data_policy: "ALLOWED" },
];

const TALA18: InstrumentListing = makeListing({
  slug: "tala-18",
  instrument: "GOLD_18K",
  name_fa: "طلای ۱۸ عیار",
  supporting: ["wallgold", "talasea"],
  published: true,
  purity: "750",
});

const NOGHRE: InstrumentListing = makeListing({
  slug: "noghre",
  instrument: "SILVER_990",
  name_fa: "نقره‌ی ۹۹۰",
  supporting: ["wallgold"],
  published: true,
  purity: "990",
});

function store(): SeededStore {
  const now = freshIso();
  return {
    listed: PLATFORMS,
    instruments: [TALA18, NOGHRE],
    snapshots: {
      wallgold: makeSnapshot({ slug: "wallgold", mid: 18_611_000, fetchedAt: now }),
      talasea: makeSnapshot({ slug: "talasea", mid: 18_530_000, fetchedAt: now }),
    },
    updatedAt: { wallgold: now, talasea: now },
  };
}

function points(values: readonly number[], stepHours: number): HistoryPoint[] {
  const end = Date.parse("2026-08-18T00:00:00.000Z");
  return values.map((value, index) => ({
    hour: new Date(end - (values.length - 1 - index) * stepHours * 3_600_000).toISOString(),
    value,
  }));
}

function referenceSeries(
  values: readonly number[],
  stepHours: number,
  hasEnoughCoverage: boolean,
): PlatformHistory {
  return {
    platform_slug: UNION_RATE_REFERENCE_SLUG,
    points: points(values, stepHours),
    latest: values[values.length - 1] ?? null,
    side_used: "PRICE",
    has_enough_coverage: hasEnoughCoverage,
  };
}

const DAILY_VALUES = [18_000_000, 18_200_000, 18_100_000, 18_360_000];
const WEEKLY_VALUES = [17_500_000, 17_900_000, 18_360_000];
const MONTHLY_VALUES = [16_800_000, 17_600_000, 18_360_000];

function seedFullHistory(options: { monthlyCoverage?: boolean } = {}): HistoryQuery[] {
  const seen: HistoryQuery[] = [];
  seedHistoryByQuery((query) => {
    seen.push(query);
    if (query.hours <= 24) return [referenceSeries(DAILY_VALUES, 1, true)];
    if (query.hours <= 24 * 7) return [referenceSeries(WEEKLY_VALUES, 24, true)];
    return [referenceSeries(MONTHLY_VALUES, 72, options.monthlyCoverage ?? true)];
  });
  return seen;
}

function seedReference(value: number): void {
  seedReferencePrice({
    reference_slug: UNION_RATE_REFERENCE_SLUG,
    instrument: UNION_RATE_INSTRUMENT,
    value,
    read_at: freshIso(),
  });
}

async function pageOf(slug: string): Promise<SlugPageData> {
  const data = await slugPageData(slug);
  if (data === null) throw new Error(`page ${slug} returned 404`);
  return data;
}

async function renderSlug(slug: string): Promise<string> {
  return renderToStaticMarkup(<SlugPageView data={await pageOf(slug)} />);
}

function jsonLd(head: ReturnType<typeof slugHead>): string {
  return (head.scripts ?? []).map((script) => script.children).join("\n");
}

describe("/tala-18 — the headline gold price", () => {
  it("has the question H1, the reference number, and names tala.ir as its owner", async () => {
    seed(store());
    seedFullHistory();
    seedReference(18_360_000);
    const html = await renderSlug("tala-18");

    expect(html).toMatch(/<h1[^>]*>قیمت طلا امروز چقدر است؟<\/h1>/);
    expect(html).toMatch(/data-gold-price[^>]*>۱۸٬۳۶۰٬۰۰۰/);
    expect(html).toContain(`مرجع: ${MARKET_REFERENCE_SOURCE_NAME}`);
    expect(html).toContain("نرخ هر گرم طلای ۱۸ عیار");
  });

  it("reads its series from the neutral reference feed, never from a platform", async () => {
    seed(store());
    const queries = seedFullHistory();
    seedReference(18_360_000);
    await pageOf("tala-18");

    const referenceQueries = queries.filter((query) => query.kind === "REFERENCE");
    expect(referenceQueries).toHaveLength(3);
    for (const query of referenceQueries) {
      expect(query.platformSlugs).toEqual([UNION_RATE_REFERENCE_SLUG]);
      expect(query.instrument).toBe(UNION_RATE_INSTRUMENT);
    }
    expect(referenceQueries.map((query) => query.hours)).toEqual([24, 24 * 7, 24 * 31]);
  });

  it("keeps the platform table below the headline card and keeps the SEO body under the table", async () => {
    seed(store());
    seedFullHistory();
    seedReference(18_360_000);
    const html = await renderSlug("tala-18");

    const headline = html.indexOf("data-gold-price");
    const table = html.indexOf('id="asset-table-heading"');
    const body = html.indexOf('data-gold-section="gold-price-source"');
    expect(headline).toBeGreaterThan(-1);
    expect(headline).toBeLessThan(table);
    expect(table).toBeLessThan(body);
  });

  it("reuses the shared range tab strip — same component the platform page uses", async () => {
    seed(store());
    seedFullHistory();
    seedReference(18_360_000);
    const asset = await renderSlug("tala-18");
    const platform = await renderSlug("wallgold");

    for (const html of [asset, platform]) {
      expect(html).toContain('role="tablist"');
      for (const key of ["DAILY", "WEEKLY", "MONTHLY"]) {
        expect(html).toContain(`data-range-tab="${key}"`);
      }
    }
  });
});

describe("/tala-18 — change deltas", () => {
  it("ships 24h, week and month deltas in both toman and percent", async () => {
    seed(store());
    seedFullHistory();
    seedReference(18_360_000);
    const html = await renderSlug("tala-18");

    expect(html).toContain("۲۴ ساعت گذشته");
    expect(html).toContain("هفته‌ی گذشته");
    expect(html).toContain("ماه گذشته");
    for (const key of ["DAILY", "WEEKLY", "MONTHLY"]) {
      expect(html).toContain(`data-gold-delta="${key}"`);
    }
    expect(html).toContain("۳۶۰٬۰۰۰");
    expect(html).toContain("۱٬۵۶۰٬۰۰۰");
    expect(html).toContain("۲٪");
  });

  it("a range the resampler calls thin gets no number at all", async () => {
    seed(store());
    seedFullHistory({ monthlyCoverage: false });
    seedReference(18_360_000);
    const data = await pageOf("tala-18");
    if (data.kind !== "instrument" || data.goldPrice === null) throw new Error("no gold price");

    const monthly = data.goldPrice.ranges.find((range) => range.key === "MONTHLY");
    expect(monthly?.hasEnoughCoverage).toBe(false);
    expect(monthly?.enabled).toBe(false);

    const html = renderToStaticMarkup(<SlugPageView data={data} />);
    const block = html.match(/<div data-gold-delta="MONTHLY"[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(block).toContain("داده‌ی کافی ثبت نشده");
    expect(block).not.toContain("۱٬۵۶۰٬۰۰۰");
    expect(html).toContain('data-range-tab="MONTHLY"');
  });

  /**
   * ⚠️ The point of this test is the absence of a number, not the presence of
   * a sentence: migration 017 means there is no one-year archive, so a
   * yearly delta could only ever be invented.
   */
  it("never prints a yearly delta — it states the archive limit instead", async () => {
    seed(store());
    seedFullHistory();
    seedReference(18_360_000);
    const html = await renderSlug("tala-18");

    expect(html).toContain("نسبت به سال گذشته");
    expect(html).toContain("آرشیو قیمت تابلو به یک سال پیش نمی‌رسد");
    expect(html.match(/data-gold-delta="/g)).toHaveLength(3);
    expect(html).not.toContain('data-gold-delta="YEARLY"');
    const yearly = html.match(/<p data-gold-yearly[\s\S]*?<\/p>/)?.[0] ?? "";
    expect(yearly).not.toMatch(/[۰-۹]+٪/);
  });
});

describe("/tala-18 — staleness, never an error", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a dead history and reference source still render the page, the table and the body copy", async () => {
    seed(store());
    seedHistoryByQuery(() => {
      throw new Error("postgres down");
    });
    setReferencePriceSource({
      getReferencePrice: async () => {
        throw new Error("postgres down");
      },
    });

    const html = await renderSlug("tala-18");
    expect(html).toContain("نرخ مرجع در دسترس نیست");
    expect(html).toContain("خواندن نرخ مرجع همین حالا ممکن نشد");
    expect(html).toContain("داده‌ی کافی ثبت نشده");
    expect(html).toContain('data-platform="wallgold"');
    expect(html).toContain("چرا قیمت طلا تغییر می‌کند؟");
    expect(html).toMatch(/<h1[^>]*>قیمت طلا امروز چقدر است؟<\/h1>/);
  });

  it("a reader that throws is caught inside the page assembler, not by the route", async () => {
    seed(store());
    const data = await assembleSlugPage("tala-18", {
      resolveSlug,
      fetchRowsForPlatforms,
      getPlatformSnapshot,
      getUpdatedAt,
      getInstruments: listInstruments,
      getPlatformHistory: async () => {
        throw new Error("postgres down");
      },
      getReferencePrice: async () => {
        throw new Error("postgres down");
      },
    });
    expect(data?.kind).toBe("instrument");
    if (data?.kind !== "instrument") return;
    expect(data.goldPrice?.priceDisplay).toBeNull();
    expect(data.goldPrice?.ranges.every((range) => range.enabled === false)).toBe(true);
  });

  it("with the whole store empty the page still renders every SEO section", async () => {
    setPriceSource({
      getListedPlatforms: async () => [],
      getSnapshot: async () => null,
      getUpdatedAt: async () => null,
      getInstruments: async () => [],
    });
    seedHistoryByQuery(() => {
      throw new Error("postgres down");
    });
    setReferencePriceSource({
      getReferencePrice: async () => {
        throw new Error("postgres down");
      },
    });

    const html = await renderSlug("tala-18");
    for (const heading of [
      "قیمت طلا امروز از کجا می‌آید؟",
      "چرا قیمت طلا تغییر می‌کند؟",
      "قیمت طلای ۱۸ عیار چگونه محاسبه می‌شود؟",
      "پرسش‌های پرتکرار درباره‌ی قیمت طلا",
    ]) {
      expect(html).toContain(heading);
    }
  });

  it("falls back to the last archived point only when it can label it as archived", () => {
    const view = buildGoldPriceView({
      reference: null,
      history: {
        DAILY: referenceSeries(DAILY_VALUES, 1, true),
        WEEKLY: null,
        MONTHLY: null,
      },
    });
    expect(view.priceDisplay).toBe("۱۸٬۳۶۰٬۰۰۰");
    expect(view.fromArchive).toBe(true);
    expect(view.readAt).not.toBeNull();
  });
});

describe("/tala-18 — SEO body, FAQ and head", () => {
  it("answers the three target questions and links to the tool and the methodology page", async () => {
    seed(store());
    seedFullHistory();
    seedReference(18_360_000);
    const html = await renderSlug("tala-18");

    expect(html).toContain("قیمت طلا امروز از کجا می‌آید؟");
    expect(html).toContain("چرا قیمت طلا تغییر می‌کند؟");
    expect(html).toContain("قیمت طلای ۱۸ عیار چگونه محاسبه می‌شود؟");
    expect(html).toContain('href="/methodology"');
    expect(html).toContain('href="/mohasebe-tala"');
    expect(html).toContain("انس جهانی (دلار) × نرخ دلار (تومان) × ۰٫۷۵ ÷ ۳۱٫۱۰۳");
  });

  it("every visible FAQ question also reaches the FAQPage schema, with Latin digits only", async () => {
    seed(store());
    seedFullHistory();
    seedReference(18_360_000);
    const html = await renderSlug("tala-18");
    const head = slugHead(await pageOf("tala-18"));
    const faqScript = (head.scripts ?? []).find((script) => script.children.includes("FAQPage"));
    expect(faqScript).toBeDefined();
    const schema = faqScript?.children ?? "";

    expect(GOLD_PRICE_FAQ.length).toBeGreaterThanOrEqual(5);
    expect(GOLD_PRICE_FAQ.length).toBeLessThanOrEqual(8);
    for (const item of GOLD_PRICE_FAQ) {
      expect(html).toContain(item.question);
      expect(html).toContain(item.answer);
    }
    expect(schema).not.toMatch(/[۰-۹٬٫٪]/);
    expect(schema).toContain("18 عیار");
  });

  it("the head targets «قیمت طلا امروز» and keeps the flat canonical", async () => {
    seed(store());
    seedFullHistory();
    seedReference(18_360_000);
    const head = slugHead(await pageOf("tala-18"));

    expect(head.meta?.[0]).toEqual({ title: GOLD_PRICE_TITLE });
    expect(head.meta?.[0]?.title).toContain("قیمت طلا امروز");
    expect(head.meta?.[0]?.title).toContain("طلای ۱۸ عیار");
    expect(head.links).toContainEqual({ rel: "canonical", href: `${SITE_URL}/tala-18` });
    expect(jsonLd(head)).toContain("BreadcrumbList");
  });

  it("another instrument keeps the generic asset page — no gold headline, no FAQ schema", async () => {
    seed(store());
    seedFullHistory();
    seedReference(18_360_000);
    const data = await pageOf("noghre");
    if (data.kind !== "instrument") throw new Error("expected an instrument page");
    expect(data.goldPrice).toBeNull();

    const html = renderToStaticMarkup(<SlugPageView data={data} />);
    expect(html).toMatch(/<h1[^>]*>قیمت نقره‌ی ۹۹۰<\/h1>/);
    expect(html).not.toContain("data-gold-price");
    expect(jsonLd(slugHead(data))).not.toContain("FAQPage");
  });
});

describe("the cadence FAQ answer names the reference interval, not the platform one", () => {
  it("REFERENCE_POLL_INTERVAL_SECONDS matches the collector's own constant, so the two cannot drift", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const mainPy = readFileSync(
      fileURLToPath(
        new URL("../../collector/src/tablo_collector/main.py", import.meta.url),
      ),
      "utf8",
    );
    const match = mainPy.match(/REFERENCE_POLL_INTERVAL_SECONDS\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(REFERENCE_POLL_INTERVAL_SECONDS).toBe(Number(match?.[1]));
  });

  it("the FAQ answer quotes minutes derived from that constant, never the 30-second platform cadence", () => {
    const answer = GOLD_PRICE_FAQ.find((item) =>
      item.question.includes("هر چند وقت"),
    )?.answer;
    expect(answer).toContain(`${REFERENCE_POLL_INTERVAL_SECONDS / 60}`.replace(/\d/g, (d) =>
      "۰۱۲۳۴۵۶۷۸۹"[Number(d)] as string,
    ));
    expect(answer).not.toContain("۳۰ ثانیه");
  });
});
