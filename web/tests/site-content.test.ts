import { describe, expect, it } from "vitest";

import {
  chartSeriesConfig,
  isValidChartColor,
  isValidChartPlatformList,
  MAX_CHART_PLATFORMS,
  MIN_CHART_PLATFORMS,
  parseChartConfigPayload,
  type ChartPlatformConfig,
} from "../src/lib/site-content";

const DEFAULT_CONFIG = chartSeriesConfig();

const VALID_OVERRIDE: ChartPlatformConfig[] = [
  { slug: "wallgold", name_fa: "وال‌گلد", color: "#e0921d" },
  { slug: "talasea", name_fa: "طلاسی", color: "#9b8ce8" },
];

describe("chartSeriesConfig", () => {
  it("gives a non-empty list of platform configs with slug, name, and color", () => {
    const config = chartSeriesConfig();
    expect(config.length).toBeGreaterThanOrEqual(2);
    for (const platform of config) {
      expect(typeof platform.slug).toBe("string");
      expect(platform.slug.length).toBeGreaterThan(0);
      expect(typeof platform.name_fa).toBe("string");
      expect(platform.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("has no duplicate slugs", () => {
    const config = chartSeriesConfig();
    const slugs = config.map((platform) => platform.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("with no argument, gives the code's default list", () => {
    expect(chartSeriesConfig()).toEqual(DEFAULT_CONFIG);
  });

  it("a valid override (2 to 6 platforms, valid color, unique slugs) replaces it", () => {
    expect(chartSeriesConfig(VALID_OVERRIDE).map((p) => p.slug)).toEqual(
      VALID_OVERRIDE.map((p) => p.slug),
    );
  });

  it("an override below the minimum ⟸ the code's default list", () => {
    const tooFew = VALID_OVERRIDE.slice(0, MIN_CHART_PLATFORMS - 1);
    expect(chartSeriesConfig(tooFew)).toEqual(DEFAULT_CONFIG);
  });

  it("an override above the maximum ⟸ the code's default list", () => {
    const tooMany = Array.from({ length: MAX_CHART_PLATFORMS + 1 }, (_, i) => ({
      slug: `platform-${i}`,
      name_fa: `سکو ${i}`,
      color: "#123456",
    }));
    expect(chartSeriesConfig(tooMany)).toEqual(DEFAULT_CONFIG);
  });

  it("an override with a malformed color ⟸ the code's default list", () => {
    const bad: ChartPlatformConfig[] = [
      { slug: "wallgold", name_fa: "وال‌گلد", color: "not-a-color" },
      { slug: "talasea", name_fa: "طلاسی", color: "#9b8ce8" },
    ];
    expect(chartSeriesConfig(bad)).toEqual(DEFAULT_CONFIG);
  });

  it("an override with a duplicate slug ⟸ the code's default list", () => {
    const dup: ChartPlatformConfig[] = [
      { slug: "wallgold", name_fa: "وال‌گلد", color: "#e0921d" },
      { slug: "wallgold", name_fa: "وال‌گلد", color: "#9b8ce8" },
    ];
    expect(chartSeriesConfig(dup)).toEqual(DEFAULT_CONFIG);
  });

  it("an empty override ⟸ the code's default list", () => {
    expect(chartSeriesConfig([])).toEqual(DEFAULT_CONFIG);
  });
});

describe("isValidChartColor", () => {
  it("accepts #rrggbb in upper or lower case", () => {
    expect(isValidChartColor("#1d6fe0")).toBe(true);
    expect(isValidChartColor("#1D6FE0")).toBe(true);
  });

  it("rejects a malformed shape", () => {
    expect(isValidChartColor("1d6fe0")).toBe(false);
    expect(isValidChartColor("#1d6fe")).toBe(false);
    expect(isValidChartColor("#1d6fe0aa")).toBe(false);
    expect(isValidChartColor("red")).toBe(false);
  });
});

describe("isValidChartPlatformList", () => {
  it("accepts a valid list", () => {
    expect(isValidChartPlatformList(VALID_OVERRIDE)).toBe(true);
  });

  it("rejects a malformed member (not an object)", () => {
    expect(isValidChartPlatformList([null, undefined, 5] as unknown as ChartPlatformConfig[])).toBe(
      false,
    );
  });
});

describe("parseChartConfigPayload — the safe landing for reading Redis", () => {
  it("missing key (raw=null) ⟸ undefined", () => {
    expect(parseChartConfigPayload(null)).toBeUndefined();
  });

  it("malformed JSON ⟸ undefined", () => {
    expect(parseChartConfigPayload("{ نه JSON")).toBeUndefined();
  });

  it("not an array ⟸ undefined", () => {
    expect(parseChartConfigPayload(JSON.stringify({ not: "an array" }))).toBeUndefined();
  });

  it("below the minimum ⟸ undefined", () => {
    expect(parseChartConfigPayload(JSON.stringify(VALID_OVERRIDE.slice(0, 1)))).toBeUndefined();
  });

  it("above the maximum ⟸ undefined", () => {
    const tooMany = Array.from({ length: MAX_CHART_PLATFORMS + 1 }, (_, i) => ({
      slug: `platform-${i}`,
      name_fa: `سکو ${i}`,
      color: "#123456",
    }));
    expect(parseChartConfigPayload(JSON.stringify(tooMany))).toBeUndefined();
  });

  it("an invalid color on one member ⟸ the whole payload is rejected (undefined)", () => {
    const bad = [
      { slug: "wallgold", name_fa: "وال‌گلد", color: "not-a-color" },
      { slug: "talasea", name_fa: "طلاسی", color: "#9b8ce8" },
    ];
    expect(parseChartConfigPayload(JSON.stringify(bad))).toBeUndefined();
  });

  it("a valid payload ⟸ that same list", () => {
    expect(parseChartConfigPayload(JSON.stringify(VALID_OVERRIDE))).toEqual(VALID_OVERRIDE);
  });
});
