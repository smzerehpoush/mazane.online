import { describe, expect, it } from "vitest";

import type { HistoryQuery } from "../src/lib/history";
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
   * ⚠️ The chart list used to be rewritten on the way out so that one of its
   * platforms carried a reference flag. The anchor now comes from the neutral
   * `talair` feed, so no platform in the list — from the code default or from
   * the panel — may carry any reference marking of its own.
   */
  it("no platform in the list is marked as the reference, whatever the list's origin", async () => {
    for (const override of [undefined, OVERRIDE]) {
      const data = await homeData(healthyStore(), { chartPlatforms: override });
      for (const platform of data.chartPlatforms) {
        expect(Object.keys(platform)).toEqual(["slug", "name_fa", "color"]);
      }
    }
  });

  it("the chart's reference series is the talair feed, not a platform", async () => {
    const data = await homeData(healthyStore(), { chartPlatforms: OVERRIDE });
    expect(data.reference.name).toBe("tala.ir");
    expect(data.chartPlatforms.map((platform) => platform.slug)).not.toContain("talair");
  });

  it("the platform axis and the market summary use separate history sources", async () => {
    const captured: Array<{
      platformSlugs: string[];
      instrument: string;
      kind: HistoryQuery["kind"] | undefined;
    }> = [];
    await assembleHomeData({
      fetchRows: async () => [],
      getPlatformHistory: async (query) => {
        captured.push({
          platformSlugs: query.platformSlugs,
          instrument: query.instrument,
          kind: query.kind,
        });
        return [];
      },
      listPublishedPosts: async () => [],
      getChartPlatforms: async () => OVERRIDE,
    });
    expect(captured[0]).toEqual({
      platformSlugs: ["wallgold", "talasea", "milli"],
      instrument: "GOLD_18K",
      kind: undefined,
    });
    expect(captured.slice(1)).toEqual([
      { platformSlugs: ["talair"], instrument: "GOLD_18K_TOMAN", kind: "REFERENCE" },
      { platformSlugs: ["talair"], instrument: "GOLD_18K_TOMAN", kind: "REFERENCE" },
      { platformSlugs: ["talair"], instrument: "GOLD_18K_TOMAN", kind: "REFERENCE" },
    ]);
  });
});
