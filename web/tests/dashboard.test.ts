import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  buildDashboard,
  MIN_RAIL_SPREAD_TOMAN,
  railScale,
  type DashboardInput,
} from "../src/lib/dashboard";
import type { PlatformHistory, PlatformHistoryByRange } from "../src/lib/history";
import type { Row } from "../src/lib/rows";
import type { ChartPlatformConfig } from "../src/lib/site-content";

const EMPTY_RANGES: PlatformHistoryByRange = { DAILY: null, WEEKLY: null, MONTHLY: null };

function platform(slug: string, isReference = false): ChartPlatformConfig {
  return { slug, name_fa: slug, color: "#123456", is_reference: isReference };
}

function row(slug: string, price: number | null, updatedAt: string | null = null): Row {
  return {
    platform: { slug, name_fa: `نام ${slug}`, data_policy: "ALLOWED" },
    snapshot:
      price === null
        ? null
        : {
            platform_slug: slug,
            quotes: [
              {
                platform_slug: slug,
                instrument: "GOLD_18K",
                side: "PRICE",
                price_toman: price,
                raw_value: String(price),
                raw_scale: "1",
                fetched_at: "2026-08-11T09:00:00.000Z",
              },
            ],
            terms: {
              platform_slug: slug,
              buy_fee_percent: null,
              sell_fee_percent: null,
              round_trip_percent: null,
              fee_source: "UNKNOWN",
              buy_enabled: true,
              sell_enabled: true,
              observed_at: "2026-08-11T09:00:00.000Z",
            },
            fetched_at: "2026-08-11T09:00:00.000Z",
            suppressed: false,
          },
    updatedAt,
  };
}

function history(slug: string, values: number[]): PlatformHistory {
  return {
    platform_slug: slug,
    points: values.map((value, index) => ({
      hour: new Date(Date.UTC(2026, 7, 11, index)).toISOString(),
      value,
    })),
    latest: values[values.length - 1] ?? null,
    side_used: "PRICE",
  };
}

function input(overrides: Partial<DashboardInput> = {}): DashboardInput {
  return {
    rows: [row("milli", 18_600_000), row("wallgold", 18_500_000)],
    platforms: [platform("milli", true), platform("wallgold")],
    history: [],
    referenceHistory: EMPTY_RANGES,
    ...overrides,
  };
}

describe("axis geometry", () => {
  it("the cheapest is rightmost and the most expensive is leftmost (RTL)", () => {
    const { rail } = buildDashboard(
      input({
        rows: [row("a", 19_000_000), row("b", 18_000_000)],
        platforms: [platform("a", true), platform("b")],
      }),
    );
    const [expensive, cheap] = rail.sources;
    // ⚠️ `right` is the distance from the right edge: cheapest is 4% (flush against the right).
    expect(cheap?.railPercent).toBe(4);
    expect(expensive?.railPercent).toBe(96);
  });

  it("the marker never goes outside the 4%–96% range", () => {
    const { rail } = buildDashboard(
      input({
        rows: [row("a", 18_000_000), row("b", 18_400_000), row("c", 19_000_000)],
        platforms: [platform("a", true), platform("b"), platform("c")],
      }),
    );
    for (const source of rail.sources) {
      expect(source.railPercent).toBeGreaterThanOrEqual(4);
      expect(source.railPercent).toBeLessThanOrEqual(96);
    }
  });

  /**
   * ⚠️ The edge case that absolutely must be handled. Without a floor,
   * these two platforms — only 2,000 toman apart — would take the two
   * ends of the axis, making a tiny difference look enormous.
   */
  it("with a spread under 50,000, markers stay clustered around the center", () => {
    const { rail } = buildDashboard(
      input({
        rows: [row("a", 18_601_000), row("b", 18_599_000)],
        platforms: [platform("a", true), platform("b")],
      }),
    );
    for (const source of rail.sources) {
      expect(source.railPercent).toBeGreaterThan(45);
      expect(source.railPercent).toBeLessThan(55);
    }
  });

  it("the floor spread opens around the center, not from one end", () => {
    const { min, span } = railScale([18_599_000, 18_601_000]);
    expect(span).toBe(MIN_RAIL_SPREAD_TOMAN);
    expect(min + span / 2).toBe(18_600_000);
  });

  it("a spread larger than the floor keeps its own real scale", () => {
    expect(railScale([18_000_000, 18_900_000])).toEqual({ min: 18_000_000, span: 900_000 });
  });

  it("stems alternate long and short so labels don't overlap", () => {
    const { rail } = buildDashboard(
      input({
        rows: [row("a", 18_100_000), row("b", 18_200_000), row("c", 18_300_000)],
        platforms: [platform("a", true), platform("b"), platform("c")],
      }),
    );
    expect(rail.sources.map((s) => s.stemLong)).toEqual([false, true, false]);
  });

  it("the axis footer renders min, max, and spread pre-formatted in Persian", () => {
    const { rail } = buildDashboard(
      input({
        rows: [row("a", 18_600_000), row("b", 18_500_000)],
        platforms: [platform("a", true), platform("b")],
      }),
    );
    expect(rail.maxDisplay).toBe("۱۸٬۶۰۰٬۰۰۰");
    expect(rail.minDisplay).toBe("۱۸٬۵۰۰٬۰۰۰");
    expect(rail.spreadDisplay).toBe("۱۰۰٬۰۰۰");
  });
});

describe("reference platform", () => {
  it("the anchor sits at the reference platform's position", () => {
    const { rail } = buildDashboard(
      input({
        rows: [row("milli", 18_000_000), row("wallgold", 19_000_000)],
        platforms: [platform("milli", true), platform("wallgold")],
      }),
    );
    const reference = rail.sources.find((s) => s.slug === "milli");
    expect(reference?.isReference).toBe(true);
    expect(rail.referencePercent).toBe(reference?.railPercent);
  });

  it("only one source carries the reference flag", () => {
    const { rail } = buildDashboard(input());
    expect(rail.sources.filter((s) => s.isReference)).toHaveLength(1);
  });

  it("the market summary carries the reference platform's name", () => {
    const { summary } = buildDashboard(input());
    expect(summary.referenceName).toBe("نام milli");
  });
});

describe("no cross-platform number", () => {
  /**
   * ⚠️ Guards the legal red line. If someone ever brings back an
   * average or a diff percentage, this test must fail.
   */
  it("no number equal to the average of the prices is ever published", () => {
    const prices = [18_000_000, 19_000_000];
    const { rail, summary } = buildDashboard(
      input({
        rows: [row("milli", prices[0]!), row("wallgold", prices[1]!)],
        platforms: [platform("milli", true), platform("wallgold")],
        referenceHistory: { ...EMPTY_RANGES, DAILY: history("milli", prices) },
      }),
    );
    const average = "۱۸٬۵۰۰٬۰۰۰";
    const published = [
      rail.maxDisplay,
      rail.minDisplay,
      rail.spreadDisplay,
      ...rail.sources.map((s) => s.priceDisplay),
      ...summary.ranges.flatMap((r) => [
        r.currentDisplay,
        r.high?.valueDisplay,
        r.low?.valueDisplay,
      ]),
    ];
    expect(published).not.toContain(average);
  });

  it("no source has a diff-percentage field", () => {
    const { rail } = buildDashboard(input());
    for (const source of rail.sources) {
      expect(Object.keys(source)).not.toContain("diffPercent");
      expect(Object.keys(source)).not.toContain("diffDisplay");
    }
  });
});

describe("market summary — stats from that single platform's own series", () => {
  const ranges: PlatformHistoryByRange = {
    DAILY: history("milli", [100, 130, 90, 120]),
    WEEKLY: null,
    MONTHLY: null,
  };

  it("min, max, and latest value all come from that same series", () => {
    const { summary } = buildDashboard(input({ referenceHistory: ranges }));
    const daily = summary.ranges.find((r) => r.key === "DAILY");
    expect(daily?.currentDisplay).toBe("۱۲۰");
    expect(daily?.high?.valueDisplay).toBe("۱۳۰");
    expect(daily?.low?.valueDisplay).toBe("۹۰");
  });

  it("change is relative to the start of that same range, not always yesterday", () => {
    const { summary } = buildDashboard(input({ referenceHistory: ranges }));
    const daily = summary.ranges.find((r) => r.key === "DAILY");
    expect(daily?.changeFraction).toBeCloseTo(0.2, 10);
  });

  it("the time of occurrence accompanies the high and low", () => {
    const { summary } = buildDashboard(input({ referenceHistory: ranges }));
    const daily = summary.ranges.find((r) => r.key === "DAILY");
    expect(daily?.high?.atDisplay).toMatch(/^[۰-۹]{2}:[۰-۹]{2}$/);
  });

  it("a range with no data is disabled, not filled with a fake number", () => {
    const { summary } = buildDashboard(input({ referenceHistory: ranges }));
    const weekly = summary.ranges.find((r) => r.key === "WEEKLY");
    expect(weekly?.enabled).toBe(false);
    expect(weekly?.currentDisplay).toBeNull();
    expect(weekly?.area.line).toBeNull();
  });

  it("all three ranges are in the output so switching tabs never triggers a fetch", () => {
    const { summary } = buildDashboard(input({ referenceHistory: ranges }));
    expect(summary.ranges.map((r) => r.key)).toEqual(["DAILY", "WEEKLY", "MONTHLY"]);
  });
});

describe("staleness and empty states", () => {
  it("a priceless platform isn't removed; it just gets no axis marker", () => {
    const { rail } = buildDashboard(
      input({
        rows: [row("milli", 18_600_000), row("wallgold", null)],
        platforms: [platform("milli", true), platform("wallgold")],
      }),
    );
    expect(rail.sources).toHaveLength(2);
    const missing = rail.sources.find((s) => s.slug === "wallgold");
    expect(missing?.railPercent).toBeNull();
    expect(missing?.priceDisplay).toBeNull();
  });

  it("when there's no snapshot, the last history point supplies the price", () => {
    const { rail } = buildDashboard(
      input({
        rows: [row("milli", 18_600_000), row("wallgold", null)],
        platforms: [platform("milli", true), platform("wallgold")],
        history: [history("wallgold", [18_400_000, 18_450_000])],
      }),
    );
    expect(rail.sources.find((s) => s.slug === "wallgold")?.priceDisplay).toBe("۱۸٬۴۵۰٬۰۰۰");
  });

  it("no price at all ⟸ no axis, but the output is still valid, not an error", () => {
    const { rail } = buildDashboard(
      input({
        rows: [row("milli", null), row("wallgold", null)],
        platforms: [platform("milli", true), platform("wallgold")],
      }),
    );
    expect(rail.hasRail).toBe(false);
    expect(rail.minDisplay).toBeNull();
    expect(rail.sources).toHaveLength(2);
  });

  it("with only one priced source, no axis is drawn", () => {
    const { rail } = buildDashboard(
      input({
        rows: [row("milli", 18_600_000), row("wallgold", null)],
        platforms: [platform("milli", true), platform("wallgold")],
      }),
    );
    expect(rail.hasRail).toBe(false);
  });

  it("without history, the sparkline holds its empty place", () => {
    const { rail } = buildDashboard(input());
    expect(rail.sources[0]?.sparkline).toEqual({ line: null, area: null });
  });
});

describe("page-level updatedAt — the basis for the wick", () => {
  it("returns the most recent time among the rows", () => {
    const { updatedAt } = buildDashboard(
      input({
        rows: [
          row("milli", 1, "2026-08-11T09:00:00.000Z"),
          row("wallgold", 2, "2026-08-11T09:00:30.000Z"),
        ],
      }),
    );
    expect(updatedAt).toBe("2026-08-11T09:00:30.000Z");
  });

  it("a timeless row is ignored rather than nulling the whole output", () => {
    const { updatedAt } = buildDashboard(
      input({ rows: [row("milli", 1, null), row("wallgold", 2, "2026-08-11T09:00:00.000Z")] }),
    );
    expect(updatedAt).toBe("2026-08-11T09:00:00.000Z");
  });

  it("no row has a time ⟸ null", () => {
    expect(buildDashboard(input({ rows: [row("milli", 1, null)] })).updatedAt).toBeNull();
  });
});

describe("outbound link", () => {
  it("every source goes through /go/<slug>, never straight to the platform's domain", () => {
    const { rail } = buildDashboard(input());
    for (const source of rail.sources) {
      expect(source.href).toBe(`/go/${source.slug}`);
    }
  });
});

describe("accessibility", () => {
  it("every marker has a text label with name and price", () => {
    const { rail } = buildDashboard(input());
    expect(rail.sources[0]?.ariaLabel).toBe("نام milli — ۱۸٬۶۰۰٬۰۰۰ تومان");
  });

  it("a priceless platform's label doesn't lie", () => {
    const { rail } = buildDashboard(
      input({ rows: [row("milli", null)], platforms: [platform("milli", true)] }),
    );
    expect(rail.sources[0]?.ariaLabel).toBe("نام milli — قیمتی ثبت نشده است");
  });
});

describe("server-side formatting", () => {
  it("all displayed numbers are Persian and pre-formatted (the client does no formatting)", () => {
    const { rail } = buildDashboard(
      input({ referenceHistory: { ...EMPTY_RANGES, DAILY: history("milli", [1, 2]) } }),
    );
    for (const source of rail.sources) {
      if (source.priceDisplay !== null) expect(source.priceDisplay).toMatch(/^[۰-۹٬٫]+$/);
    }
  });

  it("output is deterministic — same input, same rendering", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(JSON.stringify(buildDashboard(input()))).toBe(JSON.stringify(buildDashboard(input())));
    warn.mockRestore();
  });
});

describe("determinism — no Intl in the dashboard render path", () => {
  function codeWithoutComments(relative: string): string {
    return readFileSync(join(__dirname, "..", relative), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  }

  it.each(["src/lib/dashboard.ts", "src/lib/spline.ts"])("%s has no Intl call", (file) => {
    const calls = codeWithoutComments(file)
      .split("\n")
      .filter((line) => /\bIntl\./.test(line));
    expect(calls, `Intl در ${file}: ${calls.join(" | ")}`).toEqual([]);
  });
});

/**
 * ⚠️ A real regression caught by code review. The old table had a
 * staleness label per row but **no fallback to history**: a dead
  * platform got "price unavailable". The dashboard's first version
 * lost both — it silently substituted the last hourly-aggregate point
  * for "current price" with no indication at all. This is exactly what's
 * forbidden: an old number is fine, an old number **with no timestamp**
 * is not.
 */
describe("per-platform staleness", () => {
  it("each platform's own time travels separately, not just the page's time", () => {
    const { rail, updatedAt } = buildDashboard(
      input({
        rows: [
          row("milli", 18_600_000, "2026-08-11T09:00:00.000Z"),
          row("wallgold", 18_500_000, "2026-08-11T06:00:00.000Z"),
        ],
      }),
    );
    expect(rail.sources.find((s) => s.slug === "milli")?.updatedAt).toBe(
      "2026-08-11T09:00:00.000Z",
    );
    expect(rail.sources.find((s) => s.slug === "wallgold")?.updatedAt).toBe(
      "2026-08-11T06:00:00.000Z",
    );
    expect(updatedAt).toBe("2026-08-11T09:00:00.000Z");
  });

  it("a price sourced from history gets flagged", () => {
    const { rail } = buildDashboard(
      input({
        rows: [row("milli", 18_600_000, "2026-08-11T09:00:00.000Z"), row("wallgold", null)],
        history: [history("wallgold", [18_400_000, 18_450_000])],
      }),
    );
    const fromHistory = rail.sources.find((s) => s.slug === "wallgold");
    expect(fromHistory?.priceDisplay).toBe("۱۸٬۴۵۰٬۰۰۰");
    expect(fromHistory?.priceFromHistory).toBe(true);
    expect(rail.sources.find((s) => s.slug === "milli")?.priceFromHistory).toBe(false);
  });

  it("a platform with no price and no history doesn't get the history flag either", () => {
    const { rail } = buildDashboard(
      input({ rows: [row("milli", 18_600_000), row("wallgold", null)] }),
    );
    expect(rail.sources.find((s) => s.slug === "wallgold")?.priceFromHistory).toBe(false);
  });
});
