/**
 * `lib/platform-settings.ts` — منطق خالص اعتبارسنجی/نرمال‌سازی تنظیمات نمودار
 * پنل (بلیت ۲۱)، بی‌نیاز از پستگرس/منبع تزریق‌شده.
 */
import { describe, expect, it } from "vitest";

import {
  MAX_CHART_PLATFORMS,
  MIN_CHART_PLATFORMS,
  isValidChartColor,
  normalizePlatformSettings,
  validatePlatformSettings,
  type PlatformSettingEntry,
} from "../src/lib/platform-settings";

const LISTED = new Set(["wallgold", "talasea", "milli", "tlyn"]);

function entry(
  slug: string,
  in_chart: boolean,
  chart_color: string | null = null,
  chart_order: number | null = null,
): PlatformSettingEntry {
  return { slug, in_chart, chart_color, chart_order };
}

describe("isValidChartColor", () => {
  it("#rrggbb با حروف بزرگ یا کوچک را می‌پذیرد", () => {
    expect(isValidChartColor("#1d6fe0")).toBe(true);
    expect(isValidChartColor("#1D6FE0")).toBe(true);
  });

  it("شکل نادرست را رد می‌کند", () => {
    expect(isValidChartColor("1d6fe0")).toBe(false);
    expect(isValidChartColor("#1d6f")).toBe(false);
    expect(isValidChartColor("red")).toBe(false);
  });
});

describe("validatePlatformSettings", () => {
  it("بین ۲ تا ۶ سکوی فعال با رنگ معتبر و اسلاگ مجاز را می‌پذیرد (null)", () => {
    const entries = [entry("wallgold", true, "#e0921d", 0), entry("talasea", true, "#9b8ce8", 1)];
    expect(validatePlatformSettings(entries, LISTED)).toBeNull();
  });

  it(`کمتر از ${MIN_CHART_PLATFORMS} سکوی فعال را رد می‌کند`, () => {
    const entries = [entry("wallgold", true, "#e0921d", 0)];
    expect(validatePlatformSettings(entries, LISTED)).not.toBeNull();
  });

  it(`بیش از ${MAX_CHART_PLATFORMS} سکوی فعال را رد می‌کند`, () => {
    const entries = Array.from({ length: MAX_CHART_PLATFORMS + 1 }, (_, i) =>
      entry(`p${i}`, true, "#123456", i),
    );
    const listed = new Set(entries.map((e) => e.slug));
    expect(validatePlatformSettings(entries, listed)).not.toBeNull();
  });

  it("رنگ null یا بدشکل روی سکوی فعال را رد می‌کند", () => {
    const withNull = [entry("wallgold", true, null, 0), entry("talasea", true, "#9b8ce8", 1)];
    expect(validatePlatformSettings(withNull, LISTED)).not.toBeNull();

    const withBad = [entry("wallgold", true, "bad", 0), entry("talasea", true, "#9b8ce8", 1)];
    expect(validatePlatformSettings(withBad, LISTED)).not.toBeNull();
  });

  it("رنگ نامعتبر روی سکوی غیرفعال مشکلی ندارد", () => {
    const entries = [
      entry("wallgold", true, "#e0921d", 0),
      entry("talasea", true, "#9b8ce8", 1),
      entry("milli", false, "not-a-color", null),
    ];
    expect(validatePlatformSettings(entries, LISTED)).toBeNull();
  });

  it("اسلاگ ناشناخته/غیرقابل‌نمایش را رد می‌کند — حتی وقتی خاموش است", () => {
    const entries = [
      entry("wallgold", true, "#e0921d", 0),
      entry("talasea", true, "#9b8ce8", 1),
      entry("goldika", false, null, null),
    ];
    expect(validatePlatformSettings(entries, LISTED)).not.toBeNull();
  });
});

describe("normalizePlatformSettings", () => {
  it("رنگ سکوی فعال را lower می‌کند", () => {
    const [result] = normalizePlatformSettings([entry("wallgold", true, "#E0921D", 0)]);
    expect(result!.chart_color).toBe("#e0921d");
  });

  it("رنگ/ترتیب سکوی غیرفعال را پاک می‌کند، حتی اگر مقداری داشته باشد", () => {
    const [result] = normalizePlatformSettings([entry("wallgold", false, "#e0921d", 3)]);
    expect(result).toEqual({
      slug: "wallgold",
      in_chart: false,
      chart_color: null,
      chart_order: null,
    });
  });
});
