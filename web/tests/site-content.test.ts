/**
 * `chartSeriesConfig` — تک نقطه‌ی دسترسی به پیکربندی سری‌های نمودار.
 *
 * این تست فقط قرارداد را قفل می‌کند (فهرست ثابت با شکل درست)، نه محتوای
 * دلخواه رنگ‌ها. تیکت پیگیر (تنظیمات سکو، #21) بدنه‌ی این تابع را به یک
 * منبع تزریق‌پذیر وصل می‌کند؛ این تست باید همچنان با همان امضا سبز بماند.
 */
import { describe, expect, it } from "vitest";

import { chartSeriesConfig } from "../src/lib/site-content";

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
});
