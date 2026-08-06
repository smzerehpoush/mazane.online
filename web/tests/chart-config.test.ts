/**
 * مرز وب — پیکربندی نمودار صفحه‌ی اصلی از تنظیمات پنل (بلیت ۲۱).
 *
 * سنجیده می‌شود: `assembleHomeData` نتیجه‌ی `getChartPlatforms` تزریق‌شده را
 * از `chartSeriesConfig` عبور می‌دهد — override معتبر جایگزین می‌شود،
 * override غایب/نامعتبر به فهرست پیش‌فرض کد برمی‌گردد (قاعده‌ی ۵ قراردادها:
 * نبودِ تنظیمات، خطا نیست).
 */
import { describe, expect, it } from "vitest";

import { assembleHomeData } from "../src/lib/page-data";
import { chartSeriesConfig, type ChartPlatformConfig } from "../src/lib/site-content";
import { healthyStore, homeData } from "./support/seed";

const DEFAULT_CONFIG = chartSeriesConfig();

const OVERRIDE: ChartPlatformConfig[] = [
  { slug: "wallgold", name_fa: "وال‌گلد", color: "#e0921d" },
  { slug: "talasea", name_fa: "طلاسی", color: "#9b8ce8" },
  { slug: "milli", name_fa: "میلی", color: "#1d6fe0" },
];

describe("assembleHomeData — chartPlatforms از تنظیمات پنل", () => {
  it("بدون خواننده‌ی getChartPlatforms، همان فهرست پیش‌فرض کد است", async () => {
    const data = await homeData(healthyStore());
    expect(data.chartPlatforms).toEqual(DEFAULT_CONFIG);
  });

  it("خواننده‌ای که override معتبر می‌دهد، همان را جایگزین می‌کند", async () => {
    const data = await homeData(healthyStore(), { chartPlatforms: OVERRIDE });
    expect(data.chartPlatforms).toEqual(OVERRIDE);
  });

  it("خواننده‌ای که undefined می‌دهد (کلید نبود/نامعتبر) ⟸ فهرست پیش‌فرض کد", async () => {
    const data = await homeData(healthyStore(), { chartPlatforms: undefined });
    expect(data.chartPlatforms).toEqual(DEFAULT_CONFIG);
  });

  it("پرس‌وجوی تاریخچه با اسلاگ‌های همان override ساخته می‌شود", async () => {
    let capturedSlugs: string[] | null = null;
    await assembleHomeData({
      fetchRows: async () => [],
      getPlatformHistory: async (query) => {
        capturedSlugs = query.platformSlugs;
        return [];
      },
      listPublishedPosts: async () => [],
      getChartPlatforms: async () => OVERRIDE,
    });
    expect(capturedSlugs).toEqual(["wallgold", "talasea", "milli"]);
  });
});
