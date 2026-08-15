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
  it("builds each platform's series ascending by hour and gives the latest number", () => {
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

  it("only one side exists — choosing between sides is moot", () => {
    const result = assemble(
      ["wallgold"],
      [row("wallgold", "PRICE", "2026-08-06T10:00:00Z", "18611000")],
    );
    expect(result[0]?.side_used).toBe("PRICE");
    expect(result[0]?.latest).toBe(18611000);
  });
  it("a platform with no history gets an empty row, not removal — input order is preserved", () => {
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

  it("builds no cross-platform average — every number is attributed to its own platform", () => {
    const result = assemble(
      ["milli", "wallgold"],
      [
        row("milli", "PRICE", "2026-08-06T10:00:00Z", "18000000"),
        row("wallgold", "PRICE", "2026-08-06T10:00:00Z", "19000000"),
      ],
    );

    expect(result.map((entry) => entry.latest)).toEqual([18000000, 19000000]);
  });

  it("also works correctly with minute-level quotes-shaped rows — grouping doesn't depend on the hour", () => {
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
  it("reads the injected source", async () => {
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

  it("source outage ⟸ empty chart, not an error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setHistorySource({
      getPlatformHistory: async () => {
        throw new Error("Postgres is unavailable");
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

describe("resampleHourlyPoints — weekly/monthly step", () => {
  it("each bucket takes only its latest available sample, not an average", () => {
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

  it("a sample-less bucket in the middle continues the last known value (forward-fill)", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");
    const points = [pointAt(since, 30, 100), pointAt(since, 270, 300)];

    const result = resampleHourlyPoints(points, { since, windowHours: 6, stepHours: 2 });

    expect(result.points).toEqual([
      pointAt(since, 30, 100), // سطل ۰ — نمونه‌ی واقعی
      { hour: new Date(since.getTime() + 2 * 3_600_000).toISOString(), value: 100 }, // سطل ۱ — forward-fill از سطل ۰
      pointAt(since, 270, 300), // سطل ۲ — نمونه‌ی واقعی
    ]);
  });

  it("buckets before the first real sample never appear in the output at all — no backfill", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");
    const points = [pointAt(since, 255, 500)];

    const result = resampleHourlyPoints(points, { since, windowHours: 6, stepHours: 2 });

    expect(result.points).toEqual([pointAt(since, 255, 500)]);
    expect(result.hasEnoughCoverage).toBe(false);
  });

  it("with no samples at all ⟸ empty series, insufficient coverage", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");
    const result = resampleHourlyPoints([], { since, windowHours: 6, stepHours: 2 });
    expect(result.points).toEqual([]);
    expect(result.hasEnoughCoverage).toBe(false);
  });

  it("weekly: a 168-hour window with a 2-hour step means 84 buckets — the coverage threshold is exactly 42 buckets", () => {
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

  it("monthly: a 720-hour window with an 8-hour step means 90 buckets — the coverage threshold is exactly 45 buckets", () => {
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

describe("resampleHourlyPoints — daily 15-minute step from raw rows", () => {
  it("each bucket takes only its latest available sample, not an average", () => {
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

  it("a sample-less bucket in the middle continues the last known value (forward-fill)", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");
    const points = [pointAt(since, 5, 100), pointAt(since, 40, 300)];

    const result = resampleHourlyPoints(points, { since, windowHours: 0.75, stepHours: 15 / 60 });

    expect(result.points).toEqual([
      pointAt(since, 5, 100), // سطل ۰ — نمونه‌ی واقعی
      { hour: new Date(since.getTime() + 15 * 60_000).toISOString(), value: 100 }, // سطل ۱ — forward-fill
      pointAt(since, 40, 300), // سطل ۲ — نمونه‌ی واقعی
    ]);
  });

  it("daily: a 24-hour window with a 15-minute step means 96 buckets", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");
    const points: HistoryPoint[] = [pointAt(since, 0, 18_500_000)];

    const result = resampleHourlyPoints(points, { since, windowHours: 24, stepHours: 15 / 60 });

    expect(result.points).toHaveLength(96);
    expect(result.hasEnoughCoverage).toBe(false);
  });

  it("with no samples at all (a window outside coverage, or a platform with no history) ⟸ empty series, not a throw", () => {
    const since = new Date("2026-08-06T00:00:00.000Z");

    const result = resampleHourlyPoints([], { since, windowHours: 24, stepHours: 15 / 60 });

    expect(result.points).toEqual([]);
    expect(result.hasEnoughCoverage).toBe(false);
  });
});
