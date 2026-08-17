import "@tanstack/react-start/server-only";

import { calculateBubble } from "../bubble";
import { buildCoinPrices } from "../coin-prices";
import { buildDashboard } from "../dashboard";
import { formatToman } from "../format";
import type { LivePricesPayload } from "../live-update";
import { priceToman } from "../rows";
import { NO_STORE } from "../seo/cache-headers";
import {
  chartSeriesConfig,
  COIN_PRICE_INSTRUMENTS,
  MARKET_REFERENCE_SOURCE_NAME,
  OUNCE_REFERENCE_INSTRUMENT,
  UNION_RATE_INSTRUMENT,
  UNION_RATE_REFERENCE_SLUG,
  USD_REFERENCE_INSTRUMENT,
} from "../site-content";
import { getChartPlatforms } from "./chart-config-source";
import { fetchRows } from "./price-source";
import { getReferencePrice } from "./reference-price-source";

export async function livePricesPayload(): Promise<LivePricesPayload> {
  const [rows, chartOverride, marketReference, ounceReference, usdReference, coinReferences] =
    await Promise.all([
      fetchRows(),
      getChartPlatforms(),
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
      Promise.all(
        COIN_PRICE_INSTRUMENTS.map((coin) =>
          getReferencePrice({
            referenceSlug: UNION_RATE_REFERENCE_SLUG,
            instrument: coin.instrument,
          }),
        ),
      ),
    ]);
  const platforms = chartSeriesConfig(chartOverride);

  // ⚠️ The axis geometry is built with the **same function** the page's
  // server render uses. If a second version were written here, the markers
  // would jump after the first poll to a position that doesn't match the
  // initial render.
  const dashboard = buildDashboard({
    rows,
    platforms,
    history: [],
    referenceHistory: { DAILY: null, WEEKLY: null, MONTHLY: null },
    reference: {
      name: MARKET_REFERENCE_SOURCE_NAME,
      priceToman: marketReference?.value ?? null,
    },
  });

  return {
    generated_at: new Date().toISOString(),
    rows: rows.map((row) => {
      const price = priceToman(row);
      return {
        platform_slug: row.platform.slug,
        price_toman: price,
        price_display: price === null ? null : formatToman(price),
        updated_at: row.updatedAt,
      };
    }),
    dashboard: {
      sources: dashboard.rail.sources.map((source) => ({
        slug: source.slug,
        price_toman: source.priceToman,
        price_display: source.priceDisplay,
        rail_percent: source.railPercent,
        stem_long: source.stemLong,
        updated_at: source.updatedAt,
      })),
      max_display: dashboard.rail.maxDisplay,
      min_display: dashboard.rail.minDisplay,
      spread_display: dashboard.rail.spreadDisplay,
      bubble: calculateBubble({
        marketPriceToman: marketReference?.value ?? null,
        ounceUsd: ounceReference?.value ?? null,
        usdToman: usdReference?.value ?? null,
      }),
      coinPrices: buildCoinPrices(coinReferences),
      reference_percent: dashboard.rail.referencePercent,
      updated_at: dashboard.updatedAt,
      updated_at_display: dashboard.updatedAtDisplay,
    },
  };
}

export async function livePricesResponse(): Promise<Response> {
  return new Response(JSON.stringify(await livePricesPayload()), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": NO_STORE,
    },
  });
}

export function livePricesMethodNotAllowed(): Response {
  return new Response(null, {
    status: 405,
    headers: { Allow: "GET, HEAD", "Cache-Control": NO_STORE },
  });
}
