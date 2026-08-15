/**
 * ⚠️ **All computation happens here**: axis geometry, range stats,
 * SVG paths, and **Persian formatting of numbers and time**. The live layer
 * receives a ready-made string and just drops it in place. Two reasons: the
 * initial HTML must carry the real number (SEO and "readable without
 * JavaScript too"), and any client-only formatting is a fresh source of
 * hydration mismatch.
 * ⚠️ But **"server-side" doesn't mean "server-only"**: `HomePage` calls this
 * function in its render body, so it also runs in the browser during
 * hydration. That's why anything that comes out of here must be
 * **deterministic** — not just pure. `Intl` (whether for numbers or dates)
 * is not deterministic, since it depends on the environment's ICU version;
 * that's why no `Intl` call remains in this file.
 * ⚠️ **There is no price formula here.** Every price number is
 * exactly what the collector stored. What gets computed falls into three
 * categories, and all three are allowed:
 * - **Display geometry** (position percentage on the axis, SVG coordinates)
 * — it's scale, not price.
 * - **Min/max/change-fraction of a single-platform series** — the same
 * already-allowed pattern that's already in `PlatformRateCard::computeStats`.
 * - **The distance between the two ends of the same axis** (`spreadDisplay`)
 * — the difference between two named, published prices, not a new price.
 * It's explicitly requested ("range difference {max-min} toman") and both
 * ends are shown with their owner's name on the same axis. It's a
 * dispersion statistic, not a price claim — and its boundary is clear too:
 * difference allowed, **average forbidden**.
 * ⚠️ **No cross-platform average is ever constructed** and no percentage
 * difference between two platforms is ever computed. The market summary
 * shows the **reference platform**'s number, under its own name.
 */
import { formatFaClock, formatFaNumber } from "./fa-number";
import { formatSignedPercentFa } from "./format";
import type { HistoryRange, PlatformHistory, PlatformHistoryByRange } from "./history";
import { priceToman, type Row } from "./rows";
import { seriesPaths } from "./spline";
import {
  HOME_INSTRUMENT,
  HOME_SUMMARY_RANGE_LABELS,
  RATE_CARD_RANGES,
  type ChartPlatformConfig,
} from "./site-content";

export const MIN_RAIL_SPREAD_TOMAN = 50_000;

const RAIL_START_PERCENT = 4;
const RAIL_USABLE_PERCENT = 92;

export interface RailSource {
  slug: string;
  name: string;
  color: string;
  isReference: boolean;
  priceToman: number | null;
  priceDisplay: string | null;
  railPercent: number | null;
  stemLong: boolean;
  href: string;
  ariaLabel: string;
  sparkline: { line: string | null; area: string | null };
  /**
   * ⚠️ Page-level isn't enough: the dashboard's overall `updatedAt` is the
   * max across all platforms, so a dead platform can hide behind the
   * freshness of the rest. Staleness needs to be tracked **per source**,
   * not per page.
   */
  updatedAt: string | null;
  /**
   * ⚠️ This means the number is **stale**. Showing it is allowed (an old
   * number with its timestamp, not an error message) but **only alongside
   * a staleness label** — without it, an hourly aggregate point quietly
   * passes itself off as the "current price".
   */
  priceFromHistory: boolean;
}

export interface RailView {
  sources: RailSource[];
  maxDisplay: string | null;
  minDisplay: string | null;
  spreadDisplay: string | null;
  referencePercent: number | null;
  hasRail: boolean;
}

/**
 * ⚠️ **This formula is deliberately the inverse of what's documented**,
 * and the reason is a mistake in the doc and example themselves:
 */
function railPercentOf(price: number, min: number, span: number): number {
  const ratio = span === 0 ? 0.5 : (price - min) / span;
  return Number((RAIL_START_PERCENT + ratio * RAIL_USABLE_PERCENT).toFixed(3));
}

export function railScale(prices: readonly number[]): { min: number; span: number } {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const actualSpan = max - min;
  if (actualSpan >= MIN_RAIL_SPREAD_TOMAN) return { min, span: actualSpan };

  const center = (min + max) / 2;
  return { min: center - MIN_RAIL_SPREAD_TOMAN / 2, span: MIN_RAIL_SPREAD_TOMAN };
}

export interface SummaryPoint {
  valueDisplay: string;
  atDisplay: string;
}

export interface SummaryRange {
  key: HistoryRange;
  label: string;
  currentDisplay: string | null;
  high: SummaryPoint | null;
  low: SummaryPoint | null;
  changeFraction: number | null;
  changeDisplay: string | null;
  area: { line: string | null; area: string | null };
  enabled: boolean;
}

export interface SummaryView {
  referenceName: string | null;
  ranges: SummaryRange[];
}

const SUMMARY_WIDTH = 320;
const SUMMARY_HEIGHT = 108;

/**
 * ⚠️ `Intl.DateTimeFormat` used to be here, and **it was a bug**: this
 * function builds strings that get rendered (the high/low timestamps and
 * the "last updated" label), and `buildDashboard` is called in
 * `HomePage`'s render body — so it runs both on the server and during
 * hydration. That means the same ICU-version divergence that
 * `lib/fa-number.ts` closed off for numbers had come back in through
 * dates.
 */

function summaryOf(
  range: { key: HistoryRange; label: string },
  history: PlatformHistory | null,
): SummaryRange {
  const points = history?.points ?? [];
  const empty: SummaryRange = {
    key: range.key,
    label: range.label,
    currentDisplay: null,
    high: null,
    low: null,
    changeFraction: null,
    changeDisplay: null,
    area: { line: null, area: null },
    enabled: false,
  };
  if (points.length === 0) return empty;

  let highPoint = points[0]!;
  let lowPoint = points[0]!;
  for (const point of points) {
    if (point.value > highPoint.value) highPoint = point;
    if (point.value < lowPoint.value) lowPoint = point;
  }
  const first = points[0]!.value;
  const last = points[points.length - 1]!.value;
  const changeFraction = first === 0 ? 0 : (last - first) / first;

  return {
    key: range.key,
    label: range.label,
    currentDisplay: formatFaNumber(last),
    high: {
      valueDisplay: formatFaNumber(highPoint.value),
      atDisplay: formatFaClock(highPoint.hour),
    },
    low: { valueDisplay: formatFaNumber(lowPoint.value), atDisplay: formatFaClock(lowPoint.hour) },
    changeFraction,
    changeDisplay: formatSignedPercentFa(changeFraction),
    area: seriesPaths(
      points.map((point) => point.value),
      { width: SUMMARY_WIDTH, height: SUMMARY_HEIGHT, padding: 6 },
    ),
    enabled: true,
  };
}

export interface DashboardView {
  rail: RailView;
  summary: SummaryView;
  updatedAt: string | null;
  /**
   * ⚠️ Deliberately **absolute**, not "2 minutes ago": relative text needs
   * `Date.now`, which is banned in server rendering (a second source of
   * hydration divergence). It would stoke the freshness wick artificially;
   * this label only documents the data's age — a requirement that must
   * not have been lost when the table was removed.
   */
  updatedAtDisplay: string | null;
}

export interface DashboardInput {
  rows: readonly Row[];
  platforms: readonly ChartPlatformConfig[];
  history: readonly PlatformHistory[];
  referenceHistory: PlatformHistoryByRange;
}

const SPARK_WIDTH = 100;
const SPARK_HEIGHT = 32;

export function buildDashboard(input: DashboardInput): DashboardView {
  const rowBySlug = new Map(input.rows.map((row) => [row.platform.slug, row]));
  const historyBySlug = new Map(input.history.map((entry) => [entry.platform_slug, entry]));

  const priced = input.platforms.map((platform) => {
    const row = rowBySlug.get(platform.slug) ?? null;
    const entry = historyBySlug.get(platform.slug) ?? null;
    const livePrice = row === null ? null : priceToman(row, HOME_INSTRUMENT);
    return {
      platform,
      row,
      price: livePrice ?? entry?.latest ?? null,
      // ⚠️ The old table didn't have this fallback and showed "price
      // unavailable" for a dead platform. The fallback is useful (an old
      // number beats nothing), but it must be **visibly marked** as old —
      // otherwise an hourly aggregate point sits in for "current price".
      priceFromHistory: livePrice === null && (entry?.latest ?? null) !== null,
      points: entry?.points ?? [],
      name: row?.platform.name_fa ?? platform.name_fa,
    };
  });

  const prices = priced
    .map((item) => item.price)
    .filter((price): price is number => price !== null);
  const { min, span } = prices.length > 0 ? railScale(prices) : { min: 0, span: 0 };

  const rankBySlug = new Map(
    priced
      .filter((item) => item.price !== null)
      .sort((a, b) => (a.price as number) - (b.price as number))
      .map((item, rank) => [item.platform.slug, rank]),
  );

  const sources: RailSource[] = priced.map((item) => {
    const priceDisplay = item.price === null ? null : formatFaNumber(item.price);
    return {
      slug: item.platform.slug,
      name: item.name,
      color: item.platform.color,
      isReference: item.platform.is_reference === true,
      priceToman: item.price,
      priceDisplay,
      railPercent: item.price === null ? null : railPercentOf(item.price, min, span),
      stemLong: (rankBySlug.get(item.platform.slug) ?? 0) % 2 === 1,
      href: `/go/${item.platform.slug}`,
      ariaLabel:
        priceDisplay === null
          ? `${item.name} — قیمتی ثبت نشده است`
          : `${item.name} — ${priceDisplay} تومان`,
      sparkline: seriesPaths(
        item.points.map((point) => point.value),
        { width: SPARK_WIDTH, height: SPARK_HEIGHT },
      ),
      updatedAt: item.row?.updatedAt ?? null,
      priceFromHistory: item.priceFromHistory,
    };
  });

  const referenceSource = sources.find((source) => source.isReference) ?? null;
  const updatedAt = latestUpdatedAt(input.rows);

  return {
    rail: {
      sources,
      maxDisplay: prices.length > 0 ? formatFaNumber(Math.max(...prices)) : null,
      minDisplay: prices.length > 0 ? formatFaNumber(Math.min(...prices)) : null,
      spreadDisplay:
        prices.length > 0 ? formatFaNumber(Math.max(...prices) - Math.min(...prices)) : null,
      referencePercent: referenceSource?.railPercent ?? null,
      hasRail: prices.length >= 2,
    },
    summary: {
      referenceName: referenceSource?.name ?? null,
      ranges: RATE_CARD_RANGES.map((range) =>
        summaryOf(
          { key: range.key, label: HOME_SUMMARY_RANGE_LABELS[range.key] },
          input.referenceHistory[range.key],
        ),
      ),
    },
    updatedAt,
    updatedAtDisplay: updatedAt === null ? null : formatFaClock(updatedAt),
  };
}

/**
 * ⚠️ The backend gives a time **per platform** and has no page-level time;
 * the wick needs a single one. Max was chosen over min: the wick counts
 * "how much time has passed since the freshest data", and one stale
 * platform shouldn't drag the whole page's wick backward.
 * ⚠️ This number is **not a substitute for per-platform staleness** and
 * must not become one: max specifically means a dead platform can hide
 * behind the freshness of the rest. Each platform's label comes from
 * `RailSource.updatedAt` and renders on its own card. (The first version
 * of this file claimed staleness "gets labeled elsewhere" when nowhere
 * does — code review caught it.md`.
 */
function latestUpdatedAt(rows: readonly Row[]): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    if (row.updatedAt === null) continue;
    const ms = Date.parse(row.updatedAt);
    if (Number.isNaN(ms) || ms <= latestMs) continue;
    latestMs = ms;
    latest = row.updatedAt;
  }
  return latest;
}
