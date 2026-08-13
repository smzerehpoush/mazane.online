import "@tanstack/react-start/server-only";

import { buildDashboard } from "../dashboard";
import { formatToman } from "../format";
import type { LivePricesPayload } from "../live-update";
import { priceToman } from "../rows";
import { NO_STORE } from "../seo/cache-headers";
import { chartSeriesConfig } from "../site-content";
import { getChartPlatforms } from "./chart-config-source";
import { fetchRows } from "./price-source";

export async function livePricesPayload(): Promise<LivePricesPayload> {
  const [rows, chartOverride] = await Promise.all([fetchRows(), getChartPlatforms()]);
  const platforms = chartSeriesConfig(chartOverride);

  // ⚠️ هندسه‌ی محور با **همان تابعی** ساخته می‌شود که رندر سرور صفحه از آن
  // استفاده می‌کند. اگر اینجا نسخه‌ی دومی نوشته می‌شد، نشانگرها بعد از اولین
  // polling به موقعیتی می‌پریدند که با رندر اولیه نمی‌خواند.
  const dashboard = buildDashboard({
    rows,
    platforms,
    history: [],
    referenceHistory: { DAILY: null, WEEKLY: null, MONTHLY: null },
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
