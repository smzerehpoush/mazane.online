import { afterEach, describe, expect, it, vi } from "vitest";

import type { HistoryPoint } from "../src/lib/history";
import { getPlatformHistory, resetHistorySource, setHistorySource } from "../src/lib/history";
import { assemble, resampleHourlyPoints } from "../src/lib/server/history-source";

function row(slug: string, side: "PRICE", hour: string, close: string) {
  return {
    source_slug: slug,
    side,
    hour_start: new Date(hour),
    close_value: close,
  };
}

afterEach(() => {
  resetHistorySource();
  vi.restoreAllMocks();
});

describe("assemble", () => {
  it("سری هر سکو را صعودی بر ساعت می‌سازد و آخرین عدد را می‌دهد", () => {
    const result = assemble(
      ["milli"],
      [
        row("milli", "PRICE", "2026-08-06T10:00:00Z", "18500000"),
        row("milli", "PRICE", "2026-08-06T11:00:00Z", "18610000"),
      ],
    );

    expect(result).toEqual([
      {
        platform_slug: "milli",
        points: [
          { hour: "2026-08-06T10:00:00.000Z", value: 18500000 },
          { hour: "2026-08-06T11:00:00.000Z", value: 18610000 },
        ],
        latest: 18610000,
        side_used: "PRICE",
      },
    ]);
  });

  it("تنها یک سمت وجود دارد — ترجیح بین سمت‌ها موضوعش را از دست داد", () => {
    const result = assemble(
      ["wallgold"],
      [row("wallgold", "PRICE", "2026-08-06T10:00:00Z", "18611000")],
    );
    expect(result[0]?.side_used).toBe("PRICE");
    expect(result[0]?.latest).toBe(18611000);
  });
  it("سکوی بی‌سابقه ردیف خالی می‌گیرد، نه حذف — ترتیب ورودی حفظ می‌شود", () => {
    const result = assemble(
      ["milli", "talasea", "tlyn"],
      [row("tlyn", "PRICE", "2026-08-06T10:00:00Z", "18400000")],
    );

    expect(result.map((entry) => entry.platform_slug)).toEqual(["milli", "talasea", "tlyn"]);
    expect(result[1]).toEqual({
      platform_slug: "talasea",
      points: [],
      latest: null,
      side_used: null,
    });
  });

  it("هیچ میانگین بین‌سکویی نمی‌سازد — هر عدد به سکوی خودش منتسب است", () => {
    const result = assemble(
      ["milli", "wallgold"],
      [
        row("milli", "PRICE", "2026-08-06T10:00:00Z", "18000000"),
        row("wallgold", "PRICE", "2026-08-06T10:00:00Z", "19000000"),
      ],
    );

    expect(result.map((entry) => entry.latest)).toEqual([18000000, 19000000]);
  });

  it("با سطرهای دقیقه‌ای شکل quotes هم درست کار می‌کند — گروه‌بندی به ساعت وابسته نیست", () => {
    const result = assemble(
      ["milli"],
      [
        row("milli", "PRICE", "2026-08-06T10:00:00Z", "18500000"),
        row("milli", "PRICE", "2026-08-06T10:15:00Z", "18510000"),
        row("milli", "PRICE", "2026-08-06T10:30:00Z", "18520000"),
      ],
    );

    expect(result[0]?.points).toHaveLength(3);
    expect(result[0]?.latest).toBe(18520000);
    expect(result[0]?.side_used).toBe("PRICE");
  });
});

describe("getPlatformHistory", () => {
  it("منبع تزریق‌شده را می‌خواند", async () => {
    setHistorySource({
      getPlatformHistory: async () => [
        {
          platform_slug: "milli",
          points: [{ hour: "2026-08-06T10:00:00.000Z", value: 18500000 }],
          latest: 18500000,
          side_used: "PRICE",
        },
      ],
    });

    const result = await getPlatformHistory({
      platformSlugs: ["milli"],
      instrument: "GOLD_18K",
      hours: 24,
    });

    expect(result[0]?.latest).toBe(18500000);
  });

  it("قطع منبع ⟸ نمودار خالی، نه خطا", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setHistorySource({
      getPlatformHistory: async () => {
        throw new Error("پستگرس در دسترس نیست");
      },
    });

    const result = await getPlatformHistory({
      platformSlugs: ["milli", "wallgold"],
      instrument: "GOLD_18K",
      hours: 24,
    });

    expect(result).toEqual([
      { platform_slug: "milli", points: [], latest: null, side_used: null },
      { platform_slug: "wallgold", points: [], latest: null, side_used: null },
    ]);
  });
});

function pointAt(since: Date, minutesFromSince: number, value: number): HistoryPoint {
  return { hour: new Date(since.getTime() + minutesFromSince * 60_000).toISOString(), value };
}

describe("resampleHourlyPoints — گام هفتگی/ماهانه", () => {
  it("هر سطل فقط آخرین نمونه‌ی موجودش را می‌گیرد، نه میانگین", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");
    const points = [
      pointAt(since, 30, 100), // سطل ۰
      pointAt(since, 90, 200), // سطل ۰ — این آخرین نمونه‌ی سطل ۰ است، نه میانگینش با ۱۰۰
      pointAt(since, 135, 300), // سطل ۱
    ];

    const result = resampleHourlyPoints(points, { since, windowHours: 4, stepHours: 2 });

    expect(result.points).toEqual([pointAt(since, 90, 200), pointAt(since, 135, 300)]);
    expect(result.hasEnoughCoverage).toBe(true);
  });

  it("سطل بی‌نمونه‌ی میانی، آخرین مقدار شناخته‌شده را ادامه می‌دهد (forward-fill)", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");
    const points = [pointAt(since, 30, 100), pointAt(since, 270, 300)];

    const result = resampleHourlyPoints(points, { since, windowHours: 6, stepHours: 2 });

    expect(result.points).toEqual([
      pointAt(since, 30, 100), // سطل ۰ — نمونه‌ی واقعی
      { hour: new Date(since.getTime() + 2 * 3_600_000).toISOString(), value: 100 }, // سطل ۱ — forward-fill از سطل ۰
      pointAt(since, 270, 300), // سطل ۲ — نمونه‌ی واقعی
    ]);
  });

  it("سطل‌های پیش از اولین نمونه‌ی واقعی اصلاً در خروجی نمی‌آیند — نه backfill", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");
    const points = [pointAt(since, 255, 500)];

    const result = resampleHourlyPoints(points, { since, windowHours: 6, stepHours: 2 });

    expect(result.points).toEqual([pointAt(since, 255, 500)]);
    expect(result.hasEnoughCoverage).toBe(false);
  });

  it("بدون هیچ نمونه‌ای ⟸ سری خالی، پوشش ناکافی", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");
    const result = resampleHourlyPoints([], { since, windowHours: 6, stepHours: 2 });
    expect(result.points).toEqual([]);
    expect(result.hasEnoughCoverage).toBe(false);
  });

  it("هفتگی: پنجره‌ی ۱۶۸ ساعته با گام ۲ یعنی ۸۴ سطل — آستانه‌ی پوشش دقیقاً ۴۲ سطل", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");
    const enoughPoints: HistoryPoint[] = Array.from({ length: 42 }, (_, i) =>
      pointAt(since, i * 120, 18_000_000 + i),
    );
    const enough = resampleHourlyPoints(enoughPoints, { since, windowHours: 168, stepHours: 2 });
    expect(enough.hasEnoughCoverage).toBe(true);
    expect(enough.points).toHaveLength(84);
    const notEnoughPoints = enoughPoints.slice(0, 41);
    const notEnough = resampleHourlyPoints(notEnoughPoints, {
      since,
      windowHours: 168,
      stepHours: 2,
    });
    expect(notEnough.hasEnoughCoverage).toBe(false);
  });

  it("ماهانه: پنجره‌ی ۷۲۰ ساعته با گام ۸ یعنی ۹۰ سطل — آستانه‌ی پوشش دقیقاً ۴۵ سطل", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");
    const enoughPoints: HistoryPoint[] = Array.from({ length: 45 }, (_, i) =>
      pointAt(since, i * 480, 18_000_000 + i),
    );
    const enough = resampleHourlyPoints(enoughPoints, { since, windowHours: 720, stepHours: 8 });
    expect(enough.hasEnoughCoverage).toBe(true);

    const notEnough = resampleHourlyPoints(enoughPoints.slice(0, 44), {
      since,
      windowHours: 720,
      stepHours: 8,
    });
    expect(notEnough.hasEnoughCoverage).toBe(false);
  });
});

describe("resampleHourlyPoints — گام ۱۵ دقیقه‌ای روزانه از سطرهای خام", () => {
  it("هر سطل فقط آخرین نمونه‌ی موجودش را می‌گیرد، نه میانگین", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");
    const points = [
      pointAt(since, 3, 100), // سطل ۰
      pointAt(since, 12, 200), // سطل ۰ — این آخرین نمونه‌ی سطل ۰ است، نه میانگینش با ۱۰۰
      pointAt(since, 20, 300), // سطل ۱
    ];

    const result = resampleHourlyPoints(points, { since, windowHours: 0.5, stepHours: 15 / 60 });

    expect(result.points).toEqual([pointAt(since, 12, 200), pointAt(since, 20, 300)]);
    expect(result.hasEnoughCoverage).toBe(true);
  });

  it("سطل بی‌نمونه‌ی میانی، آخرین مقدار شناخته‌شده را ادامه می‌دهد (forward-fill)", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");
    const points = [pointAt(since, 5, 100), pointAt(since, 40, 300)];

    const result = resampleHourlyPoints(points, { since, windowHours: 0.75, stepHours: 15 / 60 });

    expect(result.points).toEqual([
      pointAt(since, 5, 100), // سطل ۰ — نمونه‌ی واقعی
      { hour: new Date(since.getTime() + 15 * 60_000).toISOString(), value: 100 }, // سطل ۱ — forward-fill
      pointAt(since, 40, 300), // سطل ۲ — نمونه‌ی واقعی
    ]);
  });

  it("روزانه: پنجره‌ی ۲۴ساعته با گام ۱۵ دقیقه یعنی ۹۶ سطل", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");
    const points: HistoryPoint[] = [pointAt(since, 0, 18_500_000)];

    const result = resampleHourlyPoints(points, { since, windowHours: 24, stepHours: 15 / 60 });

    expect(result.points).toHaveLength(96);
    expect(result.hasEnoughCoverage).toBe(false);
  });

  it("بدون هیچ نمونه‌ای (پنجره‌ی بیرون از پوشش، یا سکوی بی‌سابقه) ⟸ سری خالی، نه throw", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");

    const result = resampleHourlyPoints([], { since, windowHours: 24, stepHours: 15 / 60 });

    expect(result.points).toEqual([]);
    expect(result.hasEnoughCoverage).toBe(false);
  });
});
