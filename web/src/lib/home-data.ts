/**
 * ⚠️ چرا این فایل بیرون از `src/lib/server/` است: پلاگین import-protection
 * تنکستک هر مسیری با پوشه‌ی `server/` را از گراف کلاینت **رد** می‌کند، و این
 * فایل باید از `routes/index.tsx` (که در گراف کلاینت است) import شود.
 * همین‌جا مرز است: بدنه‌ی `handler` را کامپایلر Start به ماژول سمت‌سروری جدا
 * می‌برد و کلاینت فقط خرد RPC را می‌گیرد؛ importهای زیر با آن بدنه می‌روند.
 * الگوی درست برای هر تابع سروری تازه: فایل نازک اینجا، منطق در `server/`.
 */
import { createServerFn } from "@tanstack/react-start";

import type { HomePageData } from "@/components/tablo/HomePage";
import { assembleHomeData } from "./page-data";
import { getChartPlatforms } from "./server/chart-config-source";
import { listPublishedPosts } from "./server/blog-source";
import { getPlatformHistory } from "./server/history-source";
import { fetchRows } from "./server/price-source";
import { getViewCounts } from "./server/view-counter";

export type HomeData = HomePageData;

export const loadHomeData = createServerFn({ method: "GET" }).handler(async (): Promise<HomeData> =>
  assembleHomeData({
    fetchRows,
    getPlatformHistory,
    listPublishedPosts,
    getViewCounts,
    getChartPlatforms,
  }),
);
