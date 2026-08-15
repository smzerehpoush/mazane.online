/**
 * ⚠️ Why this file lives outside `src/lib/server/`: TanStack's
 * import-protection plugin **excludes** any path with a `server/` folder
 * from the client graph, and this file must be imported from
 * `routes/index.tsx` (which is in the client graph). This is exactly the
 * boundary: the Start compiler splits the `handler` body off into a
 * server-side module and the client only gets an RPC stub; the imports
 * below travel with that body.
 * The right pattern for any new server function: a thin file here, logic
 * in `server/`.
 */
import { createServerFn } from "@tanstack/react-start";

import type { HomePageData } from "@/components/tablo/HomePage";
import { assembleHomeData } from "./page-data";
import { getChartPlatforms } from "./server/chart-config-source";
import { listPublishedPosts } from "./server/blog-source";
import { getPlatformHistory } from "./server/history-source";
import { fetchRows } from "./server/price-source";
import { getReferencePrice } from "./server/reference-price-source";
import { getViewCounts } from "./server/view-counter";

export type HomeData = HomePageData;

export const loadHomeData = createServerFn({ method: "GET" }).handler(async (): Promise<HomeData> =>
  assembleHomeData({
    fetchRows,
    getPlatformHistory,
    listPublishedPosts,
    getViewCounts,
    getChartPlatforms,
    getReferencePrice,
  }),
);
