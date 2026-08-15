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

describe("assembleHomeData — chartPlatforms from panel settings", () => {
  it("without a getChartPlatforms reader, uses the same code default list", async () => {
    const data = await homeData(healthyStore());
    expect(data.chartPlatforms).toEqual(DEFAULT_CONFIG);
  });

  it("a reader that returns a valid override replaces the list with it", async () => {
    const data = await homeData(healthyStore(), { chartPlatforms: OVERRIDE });
    expect(data.chartPlatforms.map((platform) => platform.slug)).toEqual(
      OVERRIDE.map((platform) => platform.slug),
    );
  });

  it("a reader that returns undefined (missing/invalid key) ⟸ code default list", async () => {
    const data = await homeData(healthyStore(), { chartPlatforms: undefined });
    expect(data.chartPlatforms).toEqual(DEFAULT_CONFIG);
  });

  /**
   * ⚠️ The reference-platform flag lands on **any** list, not just the code
   * default. If it only applied to `CHART_PLATFORMS`, the first time the
   * list owner changed it from the panel, the axis anchor would silently
   * vanish.
   */
  it("the reference platform is flagged on the panel override too", async () => {
    const data = await homeData(healthyStore(), { chartPlatforms: OVERRIDE });
    const references = data.chartPlatforms.filter((platform) => platform.is_reference);
    expect(references).toHaveLength(1);
    expect(references[0]?.slug).toBe("milli");
  });

  it("the history query is built with the same override's slugs", async () => {
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
    expect(captured[0]).toEqual(["wallgold", "talasea", "milli"]);
    expect(captured.slice(1)).toEqual([["milli"], ["milli"], ["milli"]]);
  });
});
