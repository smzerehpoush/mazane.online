/**
 * لایه‌ی تطبیق داشبورد — موجودیت دامنه ⟸ نمای بند ۹ سند طراحی.
 *
 * مرز تست: ورودی خالص، خروجی خالص. این همان کدی است که سرور اجرا می‌کند —
 * نه نسخه‌ی دومش.
 */
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

describe("هندسه‌ی محور", () => {
  it("ارزان‌ترین راست‌ترین است و گران‌ترین چپ‌ترین (RTL)", () => {
    const { rail } = buildDashboard(
      input({
        rows: [row("a", 19_000_000), row("b", 18_000_000)],
        platforms: [platform("a", true), platform("b")],
      }),
    );
    const [expensive, cheap] = rail.sources;
    // ⚠️ `right` فاصله از لبه‌ی راست است: ارزان‌ترین ۴٪ (چسبیده به راست).
    expect(cheap?.railPercent).toBe(4);
    expect(expensive?.railPercent).toBe(96);
  });

  it("نشانگر هرگز بیرون از بازه‌ی ۴٪ تا ۹۶٪ نمی‌رود", () => {
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
   * ⚠️ بند ۵، «مورد لبه‌ای که حتماً باید حل شود». بدون کف، این دو سکو که فقط
   * ۲٬۰۰۰ تومان فاصله دارند، دو سرِ محور را می‌گرفتند و اختلاف ناچیز عظیم
   * دیده می‌شد.
   */
  it("با اختلاف کم‌تر از ۵۰٬۰۰۰ نشانگرها حول مرکز جمع می‌مانند", () => {
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

  it("بازه‌ی کف حول مرکز باز می‌شود، نه از یک سر", () => {
    const { min, span } = railScale([18_599_000, 18_601_000]);
    expect(span).toBe(MIN_RAIL_SPREAD_TOMAN);
    expect(min + span / 2).toBe(18_600_000);
  });

  it("اختلاف بزرگ‌تر از کف، مقیاس واقعی خودش را نگه می‌دارد", () => {
    expect(railScale([18_000_000, 18_900_000])).toEqual({ min: 18_000_000, span: 900_000 });
  });

  it("ساقه‌ها یک‌درمیان بلند و کوتاه‌اند تا برچسب‌ها روی هم نیفتند", () => {
    const { rail } = buildDashboard(
      input({
        rows: [row("a", 18_100_000), row("b", 18_200_000), row("c", 18_300_000)],
        platforms: [platform("a", true), platform("b"), platform("c")],
      }),
    );
    expect(rail.sources.map((s) => s.stemLong)).toEqual([false, true, false]);
  });

  it("پاورقی محور کمینه، بیشینه و بازه را آماده و فارسی می‌دهد", () => {
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

describe("سکوی مرجع", () => {
  it("لنگر روی موقعیت سکوی مرجع می‌نشیند", () => {
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

  it("فقط یک منبع پرچم مرجع دارد", () => {
    const { rail } = buildDashboard(input());
    expect(rail.sources.filter((s) => s.isReference)).toHaveLength(1);
  });

  it("خلاصه بازار نام سکوی مرجع را می‌برد (قاعده‌ی سخت ۴)", () => {
    const { summary } = buildDashboard(input());
    expect(summary.referenceName).toBe("نام milli");
  });
});

describe("قاعده‌ی سخت ۴ — هیچ عدد بین‌سکویی", () => {
  /**
   * ⚠️ نگهبان خط قرمز حقوقی (بند ۷.۱ سند معماری). اگر روزی کسی میانگین یا
   * درصد اختلاف را برگرداند، این تست باید قرمز شود.
   */
  it("هیچ عددی برابر میانگین قیمت‌ها منتشر نمی‌شود", () => {
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

  it("هیچ منبعی فیلد درصد اختلاف ندارد (بند ۱۵، تصمیم ۳)", () => {
    const { rail } = buildDashboard(input());
    for (const source of rail.sources) {
      expect(Object.keys(source)).not.toContain("diffPercent");
      expect(Object.keys(source)).not.toContain("diffDisplay");
    }
  });
});

describe("خلاصه بازار — آمار همان سری تک‌سکویی", () => {
  const ranges: PlatformHistoryByRange = {
    DAILY: history("milli", [100, 130, 90, 120]),
    WEEKLY: null,
    MONTHLY: null,
  };

  it("کمینه، بیشینه و آخرین مقدار از همان سری بیرون می‌آیند", () => {
    const { summary } = buildDashboard(input({ referenceHistory: ranges }));
    const daily = summary.ranges.find((r) => r.key === "DAILY");
    expect(daily?.currentDisplay).toBe("۱۲۰");
    expect(daily?.high?.valueDisplay).toBe("۱۳۰");
    expect(daily?.low?.valueDisplay).toBe("۹۰");
  });

  it("تغییرات نسبت به ابتدای همان بازه است، نه همیشه دیروز", () => {
    const { summary } = buildDashboard(input({ referenceHistory: ranges }));
    const daily = summary.ranges.find((r) => r.key === "DAILY");
    expect(daily?.changeFraction).toBeCloseTo(0.2, 10);
  });

  it("کنار بیشینه و کمینه ساعت وقوع می‌آید (بند ۷)", () => {
    const { summary } = buildDashboard(input({ referenceHistory: ranges }));
    const daily = summary.ranges.find((r) => r.key === "DAILY");
    expect(daily?.high?.atDisplay).toMatch(/^[۰-۹]{2}:[۰-۹]{2}$/);
  });

  it("بازه‌ی بی‌داده غیرفعال است، نه عددِ جعلی (بند ۱۱)", () => {
    const { summary } = buildDashboard(input({ referenceHistory: ranges }));
    const weekly = summary.ranges.find((r) => r.key === "WEEKLY");
    expect(weekly?.enabled).toBe(false);
    expect(weekly?.currentDisplay).toBeNull();
    expect(weekly?.area.line).toBeNull();
  });

  it("هر سه بازه در خروجی هستند تا تعویض زبانه فچ نزند", () => {
    const { summary } = buildDashboard(input({ referenceHistory: ranges }));
    expect(summary.ranges.map((r) => r.key)).toEqual(["DAILY", "WEEKLY", "MONTHLY"]);
  });
});

describe("کهنگی و حالت‌های خالی — قاعده‌ی سخت ۵", () => {
  it("سکوی بی‌قیمت حذف نمی‌شود؛ فقط نشانگر محور نمی‌گیرد", () => {
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

  it("وقتی اسنپ‌شات نیست، آخرین نقطه‌ی تاریخچه قیمت را می‌دهد", () => {
    const { rail } = buildDashboard(
      input({
        rows: [row("milli", 18_600_000), row("wallgold", null)],
        platforms: [platform("milli", true), platform("wallgold")],
        history: [history("wallgold", [18_400_000, 18_450_000])],
      }),
    );
    expect(rail.sources.find((s) => s.slug === "wallgold")?.priceDisplay).toBe("۱۸٬۴۵۰٬۰۰۰");
  });

  it("هیچ قیمتی نداریم ⟸ محور نیست ولی خروجی معتبر است، نه خطا", () => {
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

  /** بند ۱۱: «یک منبع ⟸ محور معنا ندارد؛ فقط کارت آن منبع». */
  it("با یک منبعِ قیمت‌دار محور رسم نمی‌شود", () => {
    const { rail } = buildDashboard(
      input({
        rows: [row("milli", 18_600_000), row("wallgold", null)],
        platforms: [platform("milli", true), platform("wallgold")],
      }),
    );
    expect(rail.hasRail).toBe(false);
  });

  it("بدون تاریخچه، اسپارک‌لاین جای خالی‌اش را نگه می‌دارد", () => {
    const { rail } = buildDashboard(input());
    expect(rail.sources[0]?.sparkline).toEqual({ line: null, area: null });
  });
});

describe("updatedAt سطح صفحه — مبنای فتیله", () => {
  it("تازه‌ترین زمان میان ردیف‌ها را می‌دهد", () => {
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

  it("ردیف بی‌زمان نادیده گرفته می‌شود، نه اینکه خروجی را تهی کند", () => {
    const { updatedAt } = buildDashboard(
      input({ rows: [row("milli", 1, null), row("wallgold", 2, "2026-08-11T09:00:00.000Z")] }),
    );
    expect(updatedAt).toBe("2026-08-11T09:00:00.000Z");
  });

  it("هیچ ردیفی زمان ندارد ⟸ null", () => {
    expect(buildDashboard(input({ rows: [row("milli", 1, null)] })).updatedAt).toBeNull();
  });
});

describe("لینک خروجی — قاعده‌ی سخت ۷", () => {
  it("هر منبع به ‎/go/<slug>‎ می‌رود، نه به دامنه‌ی سکو", () => {
    const { rail } = buildDashboard(input());
    for (const source of rail.sources) {
      expect(source.href).toBe(`/go/${source.slug}`);
    }
  });
});

describe("دسترس‌پذیری — بند ۱۲", () => {
  it("هر نشانگر برچسب متنی با نام و قیمت دارد", () => {
    const { rail } = buildDashboard(input());
    expect(rail.sources[0]?.ariaLabel).toBe("نام milli — ۱۸٬۶۰۰٬۰۰۰ تومان");
  });

  it("سکوی بی‌قیمت برچسبش دروغ نمی‌گوید", () => {
    const { rail } = buildDashboard(
      input({ rows: [row("milli", null)], platforms: [platform("milli", true)] }),
    );
    expect(rail.sources[0]?.ariaLabel).toBe("نام milli — قیمتی ثبت نشده است");
  });
});

describe("قالب‌بندی سمت سرور — بند ۱۴", () => {
  it("همه‌ی اعداد نمایشی فارسی و آماده‌اند (کلاینت قالب نمی‌زند)", () => {
    const { rail } = buildDashboard(
      input({ referenceHistory: { ...EMPTY_RANGES, DAILY: history("milli", [1, 2]) } }),
    );
    for (const source of rail.sources) {
      if (source.priceDisplay !== null) expect(source.priceDisplay).toMatch(/^[۰-۹٬٫]+$/);
    }
  });

  it("خروجی قطعی است — همان ورودی، همان نما", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(JSON.stringify(buildDashboard(input()))).toBe(JSON.stringify(buildDashboard(input())));
    warn.mockRestore();
  });
});
