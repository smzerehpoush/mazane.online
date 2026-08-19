import type { HomePageData } from "@/components/tablo/HomePage";
import type { SlugPageData } from "@/components/content/SlugPageView";
import type { PublishedPost } from "./blog";
import { calculateBubble, oldestReadAt } from "./bubble";
import { buildCoinPrices } from "./coin-prices";
import { buildGoldPriceView, GOLD_PRICE_INSTRUMENT, type GoldPriceView } from "./gold-price";
import type { HistoryQuery, PlatformHistory, PlatformHistoryByRange } from "./history";
import type { InstrumentListing, ListedPlatform, PlatformSnapshot } from "./prices";
import type { ReferencePrice, ReferencePriceQuery } from "./reference-price";
import type { Row } from "./rows";
import {
  chartSeriesConfig,
  COIN_PRICE_INSTRUMENTS,
  HOME_CHART_HOURS,
  OUNCE_REFERENCE_INSTRUMENT,
  HOME_INSTRUMENT,
  MARKET_REFERENCE_SOURCE_NAME,
  RATE_CARD_RANGES,
  UNION_RATE_INSTRUMENT,
  UNION_RATE_REFERENCE_SLUG,
  USD_REFERENCE_INSTRUMENT,
  type ChartPlatformConfig,
} from "./site-content";
import type { SlugResolution } from "./slugs";
import type { ViewCounts } from "./views";

export function withoutReferral(platform: ListedPlatform): ListedPlatform {
  const { referral_url: _url, referral_param: _param, ...publicFields } = platform;
  return publicFields;
}

export interface HomeReaders {
  fetchRows(): Promise<Row[]>;
  getPlatformHistory(query: HistoryQuery): Promise<PlatformHistory[]>;
  listPublishedPosts(): Promise<PublishedPost[]>;
  getViewCounts?(): Promise<ViewCounts>;
  getChartPlatforms?(): Promise<readonly ChartPlatformConfig[] | undefined>;
  getReferencePrice?(query: ReferencePriceQuery): Promise<ReferencePrice | null>;
}

export async function assembleHomeData(read: HomeReaders): Promise<HomePageData> {
  const chartPlatforms = chartSeriesConfig(await read.getChartPlatforms?.());
  const getReferencePrice = read.getReferencePrice;

  const [rows, history, posts, viewCounts, referenceRanges, bubbleReferences, coinReferences] =
    await Promise.all([
      read.fetchRows(),
      read.getPlatformHistory({
        platformSlugs: chartPlatforms.map((platform) => platform.slug),
        instrument: HOME_INSTRUMENT,
        hours: HOME_CHART_HOURS,
      }),
      read.listPublishedPosts(),
      read.getViewCounts?.() ?? Promise.resolve<ViewCounts>({}),
      Promise.all(
        RATE_CARD_RANGES.map((range) =>
          read.getPlatformHistory({
            platformSlugs: [UNION_RATE_REFERENCE_SLUG],
            instrument: UNION_RATE_INSTRUMENT,
            hours: range.hours,
            kind: "REFERENCE",
            ...(range.stepHours === undefined ? {} : { stepHours: range.stepHours }),
          }),
        ),
      ),
      getReferencePrice === undefined
        ? Promise.resolve<[ReferencePrice | null, ReferencePrice | null, ReferencePrice | null]>([
            null,
            null,
            null,
          ])
        : Promise.all([
            getReferencePrice({
              referenceSlug: UNION_RATE_REFERENCE_SLUG,
              instrument: UNION_RATE_INSTRUMENT,
            }),
            getReferencePrice({
              referenceSlug: UNION_RATE_REFERENCE_SLUG,
              instrument: OUNCE_REFERENCE_INSTRUMENT,
            }),
            getReferencePrice({
              referenceSlug: UNION_RATE_REFERENCE_SLUG,
              instrument: USD_REFERENCE_INSTRUMENT,
            }),
          ]),
      getReferencePrice === undefined
        ? Promise.resolve<Array<ReferencePrice | null>>([])
        : Promise.all(
            COIN_PRICE_INSTRUMENTS.map((coin) =>
              getReferencePrice({
                referenceSlug: UNION_RATE_REFERENCE_SLUG,
                instrument: coin.instrument,
              }),
            ),
          ),
    ]);

  const referenceHistory: PlatformHistoryByRange = { DAILY: null, WEEKLY: null, MONTHLY: null };
  RATE_CARD_RANGES.forEach((range, index) => {
    referenceHistory[range.key] = referenceRanges[index]?.[0] ?? null;
  });

  return {
    rows: rows.map((row) => ({ ...row, platform: withoutReferral(row.platform) })),
    history,
    referenceHistory,
    reference: {
      name: MARKET_REFERENCE_SOURCE_NAME,
      priceToman: bubbleReferences[0]?.value ?? null,
    },
    posts,
    viewCounts,
    chartPlatforms,
    bubble: calculateBubble({
      marketPriceToman: bubbleReferences[0]?.value ?? null,
      ounceUsd: bubbleReferences[1]?.value ?? null,
      usdToman: bubbleReferences[2]?.value ?? null,
    }),
    bubbleUpdatedAt: oldestReadAt(bubbleReferences.map((reference) => reference?.read_at)),
    coinPrices: buildCoinPrices(coinReferences),
    generated_at: new Date().toISOString(),
  };
}

export interface SlugReaders {
  resolveSlug(slug: string): Promise<SlugResolution | null>;
  fetchRowsForPlatforms(slugs: string[]): Promise<Row[]>;
  getPlatformSnapshot(platformSlug: string): Promise<PlatformSnapshot | null>;
  getUpdatedAt(platformSlug: string): Promise<string | null>;
  getInstruments(): Promise<InstrumentListing[]>;
  getPlatformHistory(query: HistoryQuery): Promise<PlatformHistory[]>;
  getReferencePrice(query: ReferencePriceQuery): Promise<ReferencePrice | null>;
}

/**
 * ⚠️ The try/catch is the page's 5xx guard, not decoration. `/tala-18` is the
 * site's main price URL, and both reads behind this function hit Postgres; a
 * throw here would turn a database outage into a 500 on the one page that
 * must stay up. Null means "the headline block hides itself", never an error.
 */
async function readGoldPrice(
  instrument: string,
  read: Pick<SlugReaders, "getPlatformHistory" | "getReferencePrice">,
): Promise<GoldPriceView | null> {
  if (instrument !== GOLD_PRICE_INSTRUMENT) return null;
  try {
    const [referenceRanges, reference] = await Promise.all([
      Promise.all(
        RATE_CARD_RANGES.map((range) =>
          read.getPlatformHistory({
            platformSlugs: [UNION_RATE_REFERENCE_SLUG],
            instrument: UNION_RATE_INSTRUMENT,
            hours: range.hours,
            kind: "REFERENCE",
            ...(range.stepHours === undefined ? {} : { stepHours: range.stepHours }),
          }),
        ),
      ),
      read.getReferencePrice({
        referenceSlug: UNION_RATE_REFERENCE_SLUG,
        instrument: UNION_RATE_INSTRUMENT,
      }),
    ]);
    const history: PlatformHistoryByRange = { DAILY: null, WEEKLY: null, MONTHLY: null };
    RATE_CARD_RANGES.forEach((range, index) => {
      history[range.key] = referenceRanges[index]?.[0] ?? null;
    });
    return buildGoldPriceView({ reference, history });
  } catch (error) {
    console.error("gold price readers unavailable; rendering the page without the headline", error);
    return buildGoldPriceView({
      reference: null,
      history: { DAILY: null, WEEKLY: null, MONTHLY: null },
    });
  }
}

export async function assembleSlugPage(
  slug: string,
  read: SlugReaders,
): Promise<SlugPageData | null> {
  const resolved = await read.resolveSlug(slug);
  if (resolved === null) return null;
  const generatedAt = new Date().toISOString();

  if (resolved.kind === "instrument") {
    const [rows, goldPrice] = await Promise.all([
      read.fetchRowsForPlatforms(resolved.listing.supporting_platform_slugs),
      readGoldPrice(resolved.listing.instrument, read),
    ]);
    return {
      kind: "instrument",
      listing: resolved.listing,
      rows: rows.map((row) => ({ ...row, platform: withoutReferral(row.platform) })),
      goldPrice,
      generated_at: generatedAt,
    };
  }

  const { platform } = resolved;
  const [snapshot, updatedAt, instruments, historyByRange, referencePrice] = await Promise.all([
    read.getPlatformSnapshot(platform.slug),
    read.getUpdatedAt(platform.slug),
    read.getInstruments(),
    Promise.all(
      RATE_CARD_RANGES.map((range) =>
        read.getPlatformHistory({
          platformSlugs: [platform.slug],
          instrument: "GOLD_18K",
          hours: range.hours,
          ...(range.stepHours === undefined ? {} : { stepHours: range.stepHours }),
        }),
      ),
    ),
    read.getReferencePrice({
      referenceSlug: UNION_RATE_REFERENCE_SLUG,
      instrument: UNION_RATE_INSTRUMENT,
    }),
  ]);
  const history: PlatformHistoryByRange = { DAILY: null, WEEKLY: null, MONTHLY: null };
  RATE_CARD_RANGES.forEach((range, index) => {
    history[range.key] = historyByRange[index]?.[0] ?? null;
  });
  return {
    kind: "platform",
    platform: withoutReferral(platform),
    snapshot,
    updatedAt,
    hasOutbound: (platform.referral_url ?? platform.website_url) != null,
    instrumentNames: Object.fromEntries(instruments.map((item) => [item.instrument, item.name_fa])),
    history,
    referencePrice,
    generated_at: generatedAt,
  };
}
