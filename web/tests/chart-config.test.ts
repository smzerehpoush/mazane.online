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
    expect(data.chartPlatforms.map((platform) => platform.slug)).toEqual(
      OVERRIDE.map((platform) => platform.slug),
    );
  });

  it("خواننده‌ای که undefined می‌دهد (کلید نبود/نامعتبر) ⟸ فهرست پیش‌فرض کد", async () => {
    const data = await homeData(healthyStore(), { chartPlatforms: undefined });
    expect(data.chartPlatforms).toEqual(DEFAULT_CONFIG);
  });

  /**
   * ⚠️ پرچم سکوی مرجع روی **هر** فهرستی می‌نشیند، نه فقط پیش‌فرض کد. اگر
   * فقط روی `CHART_PLATFORMS` بود، اولین باری که مالک فهرست را از پنل عوض
   * می‌کرد، لنگر محور بی‌سروصدا ناپدید می‌شد (`docs/api-gaps.md` بند ۱).
   */
  it("سکوی مرجع روی override پنل هم نشانده می‌شود", async () => {
    const data = await homeData(healthyStore(), { chartPlatforms: OVERRIDE });
    const references = data.chartPlatforms.filter((platform) => platform.is_reference);
    expect(references).toHaveLength(1);
    expect(references[0]?.slug).toBe("milli");
  });

  it("پرس‌وجوی تاریخچه با اسلاگ‌های همان override ساخته می‌شود", async () => {
    const captured: string[][] = [];
    await assembleHomeData({
      fetchRows: async () => [],
      getPlatformHistory: async (query) => {
        captured.push(query.platformSlugs);
        return [];
      },
      listPublishedPosts: async () => [],
      getChartPlatforms: async () => OVERRIDE,
    });
    // نخستین پرس‌وجو سری ۲۴ ساعته‌ی همه‌ی منابع نمایشی است…
    expect(captured[0]).toEqual(["wallgold", "talasea", "milli"]);
    // …و سه پرس‌وجوی بعدی سه بازه‌ی خلاصه بازار، فقط برای سکوی مرجع (بند ۷).
    expect(captured.slice(1)).toEqual([["milli"], ["milli"], ["milli"]]);
  });
});
