/**
 * `chartSeriesConfig` — تک نقطه‌ی دسترسی به پیکربندی سری‌های نمودار.
 *
 * این تست دو چیز را قفل می‌کند:
 * ۱. رفتار پیشین بدون آرگومان (فهرست ثابت کد) دست‌نخورده می‌ماند.
 * ۲. رفتار تازه‌ی بلیت ۲۱ («تنظیمات سکو، از پنل تا نمودار زنده»): override
 *    معتبر جایگزین می‌شود، override نامعتبر/نبودش به فهرست پیش‌فرض کد
 *    برمی‌گردد — نه خطا (قاعده‌ی ۵ قراردادها).
 *
 * `parseChartConfigPayload` هم همین‌جا سنجیده می‌شود: فرود امنِ خواندن
 * کلید ردیس `tablo:chart_config` (`lib/server/chart-config-source.ts`)،
 * بدون نیاز به ردیس واقعی.
 */
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
  it("فهرستی غیرخالی از پیکربندی سکو با اسلاگ، نام و رنگ می‌دهد", () => {
    const config = chartSeriesConfig();
    expect(config.length).toBeGreaterThanOrEqual(2);
    for (const platform of config) {
      expect(typeof platform.slug).toBe("string");
      expect(platform.slug.length).toBeGreaterThan(0);
      expect(typeof platform.name_fa).toBe("string");
      expect(platform.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("اسلاگ‌ها تکراری ندارند", () => {
    const config = chartSeriesConfig();
    const slugs = config.map((platform) => platform.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("بدون آرگومان همان فهرست پیش‌فرض کد را می‌دهد", () => {
    expect(chartSeriesConfig()).toBe(DEFAULT_CONFIG);
  });

  it("override معتبر (۲ تا ۶ سکو، رنگ درست، اسلاگ یکتا) جایگزین می‌شود", () => {
    expect(chartSeriesConfig(VALID_OVERRIDE)).toBe(VALID_OVERRIDE);
  });

  it("override با کمتر از حداقل ⟸ فهرست پیش‌فرض کد", () => {
    const tooFew = VALID_OVERRIDE.slice(0, MIN_CHART_PLATFORMS - 1);
    expect(chartSeriesConfig(tooFew)).toBe(DEFAULT_CONFIG);
  });

  it("override با بیش از حداکثر ⟸ فهرست پیش‌فرض کد", () => {
    const tooMany = Array.from({ length: MAX_CHART_PLATFORMS + 1 }, (_, i) => ({
      slug: `platform-${i}`,
      name_fa: `سکو ${i}`,
      color: "#123456",
    }));
    expect(chartSeriesConfig(tooMany)).toBe(DEFAULT_CONFIG);
  });

  it("override با رنگ بدشکل ⟸ فهرست پیش‌فرض کد", () => {
    const bad: ChartPlatformConfig[] = [
      { slug: "wallgold", name_fa: "وال‌گلد", color: "not-a-color" },
      { slug: "talasea", name_fa: "طلاسی", color: "#9b8ce8" },
    ];
    expect(chartSeriesConfig(bad)).toBe(DEFAULT_CONFIG);
  });

  it("override با اسلاگ تکراری ⟸ فهرست پیش‌فرض کد", () => {
    const dup: ChartPlatformConfig[] = [
      { slug: "wallgold", name_fa: "وال‌گلد", color: "#e0921d" },
      { slug: "wallgold", name_fa: "وال‌گلد", color: "#9b8ce8" },
    ];
    expect(chartSeriesConfig(dup)).toBe(DEFAULT_CONFIG);
  });

  it("override تهی ⟸ فهرست پیش‌فرض کد", () => {
    expect(chartSeriesConfig([])).toBe(DEFAULT_CONFIG);
  });
});

describe("isValidChartColor", () => {
  it("#rrggbb با حروف بزرگ یا کوچک را می‌پذیرد", () => {
    expect(isValidChartColor("#1d6fe0")).toBe(true);
    expect(isValidChartColor("#1D6FE0")).toBe(true);
  });

  it("شکل نادرست را رد می‌کند", () => {
    expect(isValidChartColor("1d6fe0")).toBe(false);
    expect(isValidChartColor("#1d6fe")).toBe(false);
    expect(isValidChartColor("#1d6fe0aa")).toBe(false);
    expect(isValidChartColor("red")).toBe(false);
  });
});

describe("isValidChartPlatformList", () => {
  it("فهرست معتبر را می‌پذیرد", () => {
    expect(isValidChartPlatformList(VALID_OVERRIDE)).toBe(true);
  });

  it("عضو بدشکل (نه شیء) را رد می‌کند", () => {
    expect(isValidChartPlatformList([null, undefined, 5] as unknown as ChartPlatformConfig[])).toBe(
      false,
    );
  });
});

describe("parseChartConfigPayload — فرود امن خواندن ردیس", () => {
  it("کلید نبود (raw=null) ⟸ undefined", () => {
    expect(parseChartConfigPayload(null)).toBeUndefined();
  });

  it("JSON بدشکل ⟸ undefined", () => {
    expect(parseChartConfigPayload("{ نه JSON")).toBeUndefined();
  });

  it("آرایه نیست ⟸ undefined", () => {
    expect(parseChartConfigPayload(JSON.stringify({ not: "an array" }))).toBeUndefined();
  });

  it("کمتر از حداقل ⟸ undefined", () => {
    expect(parseChartConfigPayload(JSON.stringify(VALID_OVERRIDE.slice(0, 1)))).toBeUndefined();
  });

  it("بیش از حداکثر ⟸ undefined", () => {
    const tooMany = Array.from({ length: MAX_CHART_PLATFORMS + 1 }, (_, i) => ({
      slug: `platform-${i}`,
      name_fa: `سکو ${i}`,
      color: "#123456",
    }));
    expect(parseChartConfigPayload(JSON.stringify(tooMany))).toBeUndefined();
  });

  it("رنگ نامعتبر در یک عضو ⟸ کل payload رد می‌شود (undefined)", () => {
    const bad = [
      { slug: "wallgold", name_fa: "وال‌گلد", color: "not-a-color" },
      { slug: "talasea", name_fa: "طلاسی", color: "#9b8ce8" },
    ];
    expect(parseChartConfigPayload(JSON.stringify(bad))).toBeUndefined();
  });

  it("payload معتبر ⟸ همان فهرست", () => {
    expect(parseChartConfigPayload(JSON.stringify(VALID_OVERRIDE))).toEqual(VALID_OVERRIDE);
  });
});
