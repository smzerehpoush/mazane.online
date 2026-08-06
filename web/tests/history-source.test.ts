/**
 * مرز وب برای تاریخچه‌ی نمودار (لایه‌ی داده‌ی تازه).
 *
 * هیچ پستگرسی در کار نیست: `assemble` تابع خالص است و برای مسیر دامنه
 * `setHistorySource` فیک درون‌حافظه‌ای تزریق می‌کند — همان الگوی
 * `setPriceSource` در بقیه‌ی تست‌های مرز وب.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getPlatformHistory,
  resetHistorySource,
  setHistorySource,
} from "../src/lib/history";
import { assemble } from "../src/lib/server/history-source";

function row(slug: string, side: "MEAN" | "MID", hour: string, close: string) {
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
        row("milli", "MEAN", "2026-08-06T10:00:00Z", "18500000"),
        row("milli", "MEAN", "2026-08-06T11:00:00Z", "18610000"),
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
        side_used: "MEAN",
      },
    ]);
  });

  it("MEAN بر MID مقدم است وقتی هر دو هستند", () => {
    const result = assemble(
      ["wallgold"],
      [
        row("wallgold", "MEAN", "2026-08-06T10:00:00Z", "18611000"),
        row("wallgold", "MID", "2026-08-06T10:00:00Z", "18500000"),
      ],
    );

    expect(result[0]?.side_used).toBe("MEAN");
    expect(result[0]?.latest).toBe(18611000);
  });

  it("بدون سطر MEAN به MID برمی‌گردد تا نمودار خالی نماند", () => {
    const result = assemble(
      ["melligold"],
      [row("melligold", "MID", "2026-08-06T10:00:00Z", "18470000")],
    );

    expect(result[0]?.side_used).toBe("MID");
    expect(result[0]?.latest).toBe(18470000);
  });

  it("سکوی بی‌سابقه ردیف خالی می‌گیرد، نه حذف — ترتیب ورودی حفظ می‌شود", () => {
    const result = assemble(
      ["milli", "talasea", "tlyn"],
      [row("tlyn", "MID", "2026-08-06T10:00:00Z", "18400000")],
    );

    expect(result.map((entry) => entry.platform_slug)).toEqual([
      "milli",
      "talasea",
      "tlyn",
    ]);
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
        row("milli", "MID", "2026-08-06T10:00:00Z", "18000000"),
        row("wallgold", "MID", "2026-08-06T10:00:00Z", "19000000"),
      ],
    );

    expect(result.map((entry) => entry.latest)).toEqual([18000000, 19000000]);
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
          side_used: "MEAN",
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

  it("قطع منبع ⟸ نمودار خالی، نه خطا (قاعده‌ی ۵)", async () => {
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
