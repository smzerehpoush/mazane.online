/**
 * تابع سروری صفحه‌ی اصلی — تنها جایی که رندر صفحه‌ی اصلی داده می‌گیرد.
 *
 * چرا `createServerFn` و نه `loader` ساده: لودر مسیر در ناوبری سمت کلاینت
 * دوباره روی **مرورگر** اجرا می‌شود و آن‌جا نه ردیس هست نه پستگرس. تابع
 * سروری همیشه روی سرور اجرا می‌شود و کلاینت فقط یک RPC می‌بیند — پس
 * `ioredis` و `pg` هرگز به باندل مرورگر نمی‌روند.
 *
 * ⚠️ چرا این فایل بیرون از `src/lib/server/` است: پلاگین import-protection
 * تنکستک هر مسیری با پوشه‌ی `server/` را از گراف کلاینت **رد** می‌کند، و این
 * فایل باید از `routes/index.tsx` (که در گراف کلاینت است) import شود.
 * همین‌جا مرز است: بدنه‌ی `handler` را کامپایلر Start به ماژول سمت‌سروری جدا
 * می‌برد و کلاینت فقط خرد RPC را می‌گیرد؛ importهای زیر با آن بدنه می‌روند.
 * الگوی درست برای هر تابع سروری تازه: فایل نازک اینجا، منطق در `server/`.
 *
 * این فایل عمداً فقط **سیم‌کشی** است: منطق سرهم‌کردن payload در
 * `lib/page-data.ts` است (بی‌فریم‌ورک و بی‌وابستگی نودی) تا مرز تست وب همان
 * کد را بسنجد، نه نسخه‌ی دومش.
 *
 * قرارداد خروجی عمداً «خام» است: همان موجودیت‌های دامنه، بدون هیچ شکل‌دهی
 * نمایشی. انتخاب ستون‌ها، مرتب‌سازی و قالب‌بندی کارِ اجزای صفحه است. اینجا
 * هیچ فرمول قیمتی نیست (قاعده‌ی ۱ قراردادها) و هیچ میانگین بین‌سکویی ساخته
 * نمی‌شود (قاعده‌ی ۴).
 *
 * قطع هر سه منبع ⟸ کهنگی، نه خطا (قاعده‌ی ۵): ردیف بی‌اسنپ‌شات، نمودار خالی
 * و فهرست پست خالی برمی‌گردد و صفحه ۲۰۰ می‌ماند.
 */
import { createServerFn } from "@tanstack/react-start";

import type { HomePageData } from "@/components/tablo/HomePage";
import { assembleHomeData } from "./page-data";
import { getChartPlatforms } from "./server/chart-config-source";
import { listPublishedPosts } from "./server/blog-source";
import { getPlatformHistory } from "./server/history-source";
import { fetchRows } from "./server/price-source";
import { getViewCounts } from "./server/view-counter";

/** نام قدیمی همان قرارداد — مالک شکل، نماست (`components/tablo/HomePage`). */
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
