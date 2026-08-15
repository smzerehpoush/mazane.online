import type { HomePageData } from "@/components/tablo/HomePage";
import type { SlugPageData } from "@/components/content/SlugPageView";
import type { PublishedPost } from "./blog";
import { calculateBubble } from "./bubble";
import { buildCoinPrices } from "./coin-prices";
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
  RATE_CARD_RANGES,
  UNION_RATE_INSTRUMENT,
  UNION_RATE_REFERENCE_SLUG,
  UNION_RATE_SOURCE_NAME,
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
    summaryReferenceName: UNION_RATE_SOURCE_NAME,
    posts,
    viewCounts,
    chartPlatforms,
    bubble: calculateBubble({
      marketPriceToman: bubbleReferences[0]?.value ?? null,
      ounceUsd: bubbleReferences[1]?.value ?? null,
      usdToman: bubbleReferences[2]?.value ?? null,
    }),
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

export async function assembleSlugPage(
  slug: string,
  read: SlugReaders,
): Promise<SlugPageData | null> {
  const resolved = await read.resolveSlug(slug);
  if (resolved === null) return null;
  const generatedAt = new Date().toISOString();

  if (resolved.kind === "instrument") {
    const rows = await read.fetchRowsForPlatforms(resolved.listing.supporting_platform_slugs);
    return {
      kind: "instrument",
      listing: resolved.listing,
      rows: rows.map((row) => ({ ...row, platform: withoutReferral(row.platform) })),
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
