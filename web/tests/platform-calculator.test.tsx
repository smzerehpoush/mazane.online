import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PlatformCalculator } from "../src/components/content/PlatformCalculator";
import { JewelryCalculator, JewelryResult } from "../src/components/tablo/JewelryCalculator";
import {
  amountFromWeight,
  currentJalaliYear,
  currentVatPercent,
  jewelryBreakdown,
  jewelryTotal,
  parseCalculatorInput,
  vatPercentForJalaliYear,
  weightFromAmount,
} from "../src/lib/calculator";
import { formatFaPercentPoints } from "../src/lib/fa-number";
import type { ListedPlatform } from "../src/lib/prices";
import type { Row } from "../src/lib/rows";
import { SlugPageView } from "../src/components/content/SlugPageView";
import type { SlugPageData } from "../src/components/content/SlugPageView";
import { freshIso, makeSnapshot, seed, slugPageData, type SeededStore } from "./support/seed";

describe("parseCalculatorInput — user string input ⟸ number or null", () => {
  it("accepts plain Latin digits", () => {
    expect(parseCalculatorInput("1.5")).toBe(1.5);
    expect(parseCalculatorInput("18704055")).toBe(18704055);
  });

  it("accepts Persian digits and the Persian decimal separator", () => {
    expect(parseCalculatorInput("۱٫۵")).toBe(1.5);
    expect(parseCalculatorInput("۱۸۷۰۴۰۵۵")).toBe(18704055);
  });

  it("ignores Persian and Latin thousands separators", () => {
    expect(parseCalculatorInput("۱۸٬۷۰۴٬۰۵۵")).toBe(18704055);
    expect(parseCalculatorInput("18,704,055")).toBe(18704055);
  });

  it("empty/whitespace-only ⟸ null, not zero", () => {
    expect(parseCalculatorInput("")).toBeNull();
    expect(parseCalculatorInput("   ")).toBeNull();
  });

  it("invalid input (letters, multiple dots, negative) ⟸ null, not NaN", () => {
    expect(parseCalculatorInput("abc")).toBeNull();
    expect(parseCalculatorInput("۱.۲.۳")).toBeNull();
    expect(parseCalculatorInput("-5")).toBeNull();
    expect(Number.isNaN(parseCalculatorInput("abc"))).toBe(false);
  });

  it("zero ⟸ null (a zero weight/amount is nothing to display)", () => {
    expect(parseCalculatorInput("0")).toBeNull();
    expect(parseCalculatorInput("۰")).toBeNull();
  });
});

describe("amountFromWeight / weightFromAmount — bidirectional conversion at a single unit price", () => {
  it("weight ⟸ amount, rounded to the nearest toman", () => {
    expect(amountFromWeight(1, 18704055)).toBe(18704055);
    expect(amountFromWeight(0.5, 18704055)).toBe(9352028);
  });

  it("amount ⟸ weight, to four decimal places", () => {
    expect(weightFromAmount(18704055, 18704055)).toBe(1);
    expect(weightFromAmount(9352027.5, 18704055)).toBeCloseTo(0.5, 4);
  });

  it("a round trip is equivalent: weight ⟸ amount ⟸ the same weight", () => {
    const weight = 2.25;
    const unitPrice = 18530000;
    const amount = amountFromWeight(weight, unitPrice);
    expect(weightFromAmount(amount, unitPrice)).toBeCloseTo(weight, 3);
  });

  it("invalid unit price (zero/negative) ⟸ null, not Infinity/NaN", () => {
    expect(weightFromAmount(1000, 0)).toBeNull();
    expect(weightFromAmount(1000, -5)).toBeNull();
  });
});

const PLATFORM: ListedPlatform = {
  slug: "talasea",
  name_fa: "طلاسی",
  data_policy: "ALLOWED",
  website_url: "https://talasea.ir",
};

function knownFeeRow(opts: { sellEnabled?: boolean } = {}): Row {
  return {
    platform: PLATFORM,
    updatedAt: freshIso(),
    snapshot: makeSnapshot({
      slug: "talasea",
      mid: 18530000,
      fetchedAt: freshIso(),
      sellEnabled: opts.sellEnabled ?? true,
    }),
  };
}

function unknownFeeRow(): Row {
  return {
    platform: { ...PLATFORM, slug: "digikala", name_fa: "دیجی‌کالا" },
    updatedAt: freshIso(),
    snapshot: makeSnapshot({
      slug: "digikala",
      mid: 18400000,
      feeSource: "UNKNOWN",
      fetchedAt: freshIso(),
    }),
  };
}

describe("PlatformCalculator — one shape for every platform", () => {
  it("two bidirectional inputs (weight, amount) on the platform's 'price', no tabs", () => {
    const html = renderToStaticMarkup(
      <PlatformCalculator row={knownFeeRow()} hasOutbound={true} />,
    );
    expect(html).toContain("ماشین‌حساب معامله");
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain("data-calc-weight");
    expect(html).toContain("data-calc-amount");
    expect(html).toContain("بدون احتساب کارمزد");
  });

  it("disabling one side doesn't change the calculator's shape — the number is the same", () => {
    const html = renderToStaticMarkup(
      <PlatformCalculator row={knownFeeRow({ sellEnabled: false })} hasOutbound={true} />,
    );
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain("data-calc-weight");
  });

  it("the 'start trade' button goes to /go/<slug> with full rel and target", () => {
    const html = renderToStaticMarkup(
      <PlatformCalculator row={knownFeeRow()} hasOutbound={true} />,
    );
    expect(html).toContain('href="/go/talasea"');
    expect(html).toContain('rel="sponsored nofollow noopener"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("شروع معامله در طلاسی");
  });

  it("without an outbound destination, it doesn't render a dead button", () => {
    const html = renderToStaticMarkup(
      <PlatformCalculator row={knownFeeRow()} hasOutbound={false} />,
    );
    expect(html).not.toContain("/go/talasea");
    expect(html).not.toContain("شروع معامله");
  });
});

describe("PlatformCalculator — unknown-fee platform (same shape)", () => {
  it("exactly the same shape as a known-fee platform — no longer a special case", () => {
    const html = renderToStaticMarkup(
      <PlatformCalculator row={unknownFeeRow()} hasOutbound={true} />,
    );
    expect(html).toContain("ماشین‌حساب معامله");
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain("data-calc-weight");
    expect(html).toContain("data-calc-amount");
    expect(html).toContain("بدون احتساب کارمزد");
    expect(html).toMatch(/data-calc-amount[^>]*value=""/);
  });

  it("the start-trade button appears here too", () => {
    const html = renderToStaticMarkup(
      <PlatformCalculator row={unknownFeeRow()} hasOutbound={true} />,
    );
    expect(html).toContain('href="/go/digikala"');
    expect(html).toContain('rel="sponsored nofollow noopener"');
  });
});

describe("PlatformCalculator — source outage", () => {
  it("renders nothing without a snapshot", () => {
    const row: Row = { platform: PLATFORM, snapshot: null, updatedAt: null };
    const html = renderToStaticMarkup(<PlatformCalculator row={row} hasOutbound={true} />);
    expect(html).toBe("");
  });
});

describe("PlatformPage — the calculator is mounted below 'today's price'", () => {
  function store(): SeededStore {
    const now = freshIso();
    return {
      listed: [
        {
          slug: "talasea",
          name_fa: "طلاسی",
          data_policy: "ALLOWED",
          website_url: "https://talasea.ir",
        },
        {
          slug: "digikala",
          name_fa: "دیجی‌کالا",
          data_policy: "ALLOWED",
          website_url: "https://www.digikala.com",
        },
      ],
      snapshots: {
        talasea: makeSnapshot({
          slug: "talasea",
          mid: 18530000,
          fetchedAt: now,
        }),
        digikala: makeSnapshot({
          slug: "digikala",
          mid: 18400000,
          feeSource: "UNKNOWN",
          fetchedAt: now,
        }),
      },
      updatedAt: { talasea: now, digikala: now },
    };
  }

  async function renderSlug(slug: string): Promise<string> {
    const data = await slugPageData(slug);
    if (data === null) throw new Error(`Page ${slug} 404'd`);
    return renderToStaticMarkup(<SlugPageView data={data as SlugPageData} />);
  }

  it("known-fee platform: the calculator comes after 'today's price'", async () => {
    seed(store());
    const html = await renderSlug("talasea");
    const termsIndex = html.indexOf('aria-labelledby="terms-heading"');
    const calcIndex = html.indexOf("data-platform-calculator");
    expect(termsIndex).toBeGreaterThan(-1);
    expect(calcIndex).toBeGreaterThan(termsIndex);
  });

  it("unknown-fee platform gets both 'today's price' and the calculator", async () => {
    seed(store());
    const html = await renderSlug("digikala");
    expect(html).toContain('aria-labelledby="terms-heading"');
    expect(html).toContain("data-platform-calculator");
    expect(html).toContain("بدون احتساب کارمزد");
  });
});

/**
 * ⚠️ This function was first written inside `JewelryCalculator.tsx` and went
 * untested. Its place is `lib/calculator.ts`, alongside `amountFromWeight` —
 * the same file that calls itself the "sole gateway".
 */
describe("jewelryTotal — jewelry gold amount", () => {
  const PRICE = 18_500_000;

  it("with no percentages at all, it's just weight × price", () => {
    expect(
      jewelryTotal({
        weightGrams: 2,
        pricePerGram: PRICE,
        wagePercent: 0,
        profitPercent: 0,
        vatPercent: 0,
      }),
    ).toBe(37_000_000);
  });

  /**
   * ⚠️ The order of operations matters, and mixing it up fails silently:
   * wage on the gold price, profit on **the gold+wage total**, and VAT on
   * **wage + profit only** — Article 26(b) of the VAT Act exempts the gold
   * principal. Applying all three separately to the gold price alone, or
   * running VAT over the grand total, both yield a different number.
   */
  it("wage on gold, profit on gold+wage, VAT on wage+profit only", () => {
    const total = jewelryTotal({
      weightGrams: 1,
      pricePerGram: 1_000_000,
      wagePercent: 10,
      profitPercent: 7,
      vatPercent: 10,
    });
    expect(total).toBe(1_194_700);
    expect(total).not.toBe(Math.round(1_000_000 * 1.27));
    expect(total).not.toBe(Math.round(1_000_000 * 1.1 * 1.07 * 1.1));
  });

  it("the worked example from the issue: 5g, 20% wage, 7% profit, 10% VAT ⟸ ×1.3124", () => {
    const total = jewelryTotal({
      weightGrams: 5,
      pricePerGram: 10_000_000,
      wagePercent: 20,
      profitPercent: 7,
      vatPercent: 10,
    });
    const gold = 5 * 10_000_000;
    const wage = gold * 0.2;
    const profit = (gold + wage) * 0.07;
    const vat = (wage + profit) * 0.1;

    expect(gold + wage + profit + vat).toBe(65_620_000);
    expect(total).toBe(65_620_000);
    expect(total).toBe(Math.round(gold * 1.3124));
    expect(total).not.toBe(Math.round(gold * 1.4124));
  });

  it("VAT never touches the gold principal: with no wage and no profit there is no VAT", () => {
    expect(
      jewelryTotal({
        weightGrams: 4,
        pricePerGram: PRICE,
        wagePercent: 0,
        profitPercent: 0,
        vatPercent: 10,
      }),
    ).toBe(4 * PRICE);
  });

  it("raising VAT moves the total by the VAT of wage+profit, not of the whole invoice", () => {
    const base = {
      weightGrams: 1,
      pricePerGram: 1_000_000,
      wagePercent: 10,
      profitPercent: 7,
    };
    const withoutVat = jewelryTotal({ ...base, vatPercent: 0 });
    const withVat = jewelryTotal({ ...base, vatPercent: 10 });

    expect(withoutVat).toBe(1_177_000);
    expect(withVat - withoutVat).toBe(17_700);
  });

  it("rounds to the nearest toman", () => {
    expect(
      Number.isInteger(
        jewelryTotal({
          weightGrams: 1.337,
          pricePerGram: PRICE,
          wagePercent: 8.5,
          profitPercent: 7,
          vatPercent: 10,
        }),
      ),
    ).toBe(true);
  });

  it("zero percent has no effect (a user who only entered weight sees the raw price)", () => {
    const bare = jewelryTotal({
      weightGrams: 3,
      pricePerGram: PRICE,
      wagePercent: 0,
      profitPercent: 0,
      vatPercent: 0,
    });
    expect(bare).toBe(amountFromWeight(3, PRICE));
  });
});

describe("jewelryBreakdown — the four lines behind the total", () => {
  it("the worked example, verifiable with a pencil: 5g × 10,000,000 at 20% / 7% / 10%", () => {
    const breakdown = jewelryBreakdown({
      weightGrams: 5,
      pricePerGram: 10_000_000,
      wagePercent: 20,
      profitPercent: 7,
      vatPercent: 10,
    });

    expect(breakdown.gold).toBe(50_000_000);
    expect(breakdown.wage).toBe(10_000_000);
    expect(breakdown.profit).toBe(4_200_000);
    expect(breakdown.vat).toBe(1_420_000);
    expect(breakdown.total).toBe(65_620_000);
    expect(breakdown.extraCostPercent).toBeCloseTo(31.24, 10);
  });

  const SUMMABLE = [
    { weightGrams: 5, pricePerGram: 10_000_000, wagePercent: 20, profitPercent: 7, vatPercent: 10 },
    {
      weightGrams: 1,
      pricePerGram: 18_530_000,
      wagePercent: 12.5,
      profitPercent: 7,
      vatPercent: 10,
    },
    {
      weightGrams: 1.337,
      pricePerGram: 18_500_000,
      wagePercent: 8.5,
      profitPercent: 7,
      vatPercent: 10,
    },
    {
      weightGrams: 0.0031,
      pricePerGram: 18_704_055,
      wagePercent: 17.5,
      profitPercent: 3,
      vatPercent: 9,
    },
    { weightGrams: 3, pricePerGram: 18_500_000, wagePercent: 0, profitPercent: 0, vatPercent: 0 },
  ];

  it("the four lines always add up to the total, exactly", () => {
    for (const input of SUMMABLE) {
      const { gold, wage, profit, vat, total } = jewelryBreakdown(input);
      expect(gold + wage + profit + vat).toBe(total);
    }
  });

  it("every line is a whole toman, so nothing is rounded twice on screen", () => {
    for (const input of SUMMABLE) {
      const { gold, wage, profit, vat, total } = jewelryBreakdown(input);
      for (const line of [gold, wage, profit, vat, total])
        expect(Number.isInteger(line)).toBe(true);
    }
  });

  it("the total is the sum of the rounded lines, not the rounding of the exact sum", () => {
    const input = {
      weightGrams: 1,
      pricePerGram: 18_530_000,
      wagePercent: 12.5,
      profitPercent: 7,
      vatPercent: 10,
    };
    const { gold, wage, profit, vat, total } = jewelryBreakdown(input);

    expect([gold, wage, profit, vat]).toEqual([18_530_000, 2_316_250, 1_459_238, 377_549]);
    expect(total).toBe(22_683_037);
    expect(Math.round(18_530_000 + 2_316_250 + 1_459_237.5 + 377_548.75)).toBe(22_683_036);
    expect(total).not.toBe(22_683_036);
  });

  it("the headline percent is derived from the lines on screen, not from a parallel sum", () => {
    for (const input of SUMMABLE) {
      const { gold, total, extraCostPercent } = jewelryBreakdown(input);
      expect(extraCostPercent).toBeCloseTo(((total - gold) / gold) * 100, 10);
    }
  });

  it("VAT never touches the gold principal: no wage and no profit means a zero VAT line", () => {
    const breakdown = jewelryBreakdown({
      weightGrams: 4,
      pricePerGram: 18_500_000,
      wagePercent: 0,
      profitPercent: 0,
      vatPercent: 10,
    });
    expect(breakdown.vat).toBe(0);
    expect(breakdown.total).toBe(breakdown.gold);
    expect(breakdown.extraCostPercent).toBe(0);
  });

  it("without a gold value there is nothing to be a percentage of ⟸ null, not Infinity", () => {
    const breakdown = jewelryBreakdown({
      weightGrams: 2,
      pricePerGram: 0,
      wagePercent: 20,
      profitPercent: 7,
      vatPercent: 10,
    });
    expect(breakdown.extraCostPercent).toBeNull();
  });

  it("jewelryTotal keeps its signature and stays the breakdown's total", () => {
    for (const input of SUMMABLE) {
      expect(jewelryTotal(input)).toBe(jewelryBreakdown(input).total);
    }
  });
});

/**
 * ⚠️ One decimal, and the rounding is done by `formatFaNumber` on the decimal
 * string. `Math.round(percent * 10) / 10` inside the module would be wrong on
 * the half-cases — `31.15 * 10` is `311.49999999999994` in binary floating
 * point and would round down to 31.1.
 */
describe("the headline percent — how it is rounded for display", () => {
  function headline(input: Parameters<typeof jewelryBreakdown>[0]): string {
    const { extraCostPercent } = jewelryBreakdown(input);
    if (extraCostPercent === null) throw new Error("no headline percent for this input");
    return formatFaPercentPoints(extraCostPercent, { maximumFractionDigits: 1 });
  }

  it("one decimal place, in Persian digits", () => {
    expect(
      headline({
        weightGrams: 5,
        pricePerGram: 10_000_000,
        wagePercent: 20,
        profitPercent: 7,
        vatPercent: 10,
      }),
    ).toBe("۳۱٫۲٪");
  });

  it("a trailing zero is dropped rather than shown as ۳۱٫۰٪", () => {
    expect(
      headline({
        weightGrams: 5,
        pricePerGram: 10_000_000,
        wagePercent: 20,
        profitPercent: 7,
        vatPercent: 9,
      }),
    ).toBe("۳۱٪");
  });

  it("a whole percentage stays whole", () => {
    expect(
      headline({
        weightGrams: 2,
        pricePerGram: 18_500_000,
        wagePercent: 10,
        profitPercent: 0,
        vatPercent: 0,
      }),
    ).toBe("۱۰٪");
  });

  it("binary floating point never leaks a long tail into the label", () => {
    expect(
      headline({
        weightGrams: 1,
        pricePerGram: 18_530_000,
        wagePercent: 12.5,
        profitPercent: 7,
        vatPercent: 10,
      }),
    ).toBe("۲۲٫۴٪");
  });
});

describe("JewelryResult — the breakdown a visitor actually reads", () => {
  const BREAKDOWN = jewelryBreakdown({
    weightGrams: 5,
    pricePerGram: 10_000_000,
    wagePercent: 20,
    profitPercent: 7,
    vatPercent: 10,
  });

  it("names all four lines in Persian", () => {
    const html = renderToStaticMarkup(<JewelryResult breakdown={BREAKDOWN} />);
    expect(html).toContain("ارزش طلای خام");
    expect(html).toContain("اجرت ساخت");
    expect(html).toContain("سود فروشنده");
    expect(html).toContain("مالیات بر ارزش افزوده");
  });

  it("prints each line's amount in Persian digits, and the total below them", () => {
    const html = renderToStaticMarkup(<JewelryResult breakdown={BREAKDOWN} />);
    expect(html).toContain("۵۰٬۰۰۰٬۰۰۰");
    expect(html).toContain("۱۰٬۰۰۰٬۰۰۰");
    expect(html).toContain("۴٬۲۰۰٬۰۰۰");
    expect(html).toContain("۱٬۴۲۰٬۰۰۰");
    expect(html).toContain("۶۵٬۶۲۰٬۰۰۰");
  });

  it("the headline is the extra cost against the raw gold", () => {
    const html = renderToStaticMarkup(<JewelryResult breakdown={BREAKDOWN} />);
    expect(html).toContain("هزینه‌ی اضافه نسبت به طلای خام");
    expect(html).toContain("۳۱٫۲٪");
  });

  it("no inputs yet means one dash, not a column of them", () => {
    const html = renderToStaticMarkup(<JewelryResult breakdown={null} />);
    expect(html).toContain("data-calculator-total");
    expect(html).toContain("—");
    expect(html).not.toContain("data-calculator-breakdown");
    expect(html).not.toContain("data-calculator-extra-cost");
    expect(html).not.toContain("ارزش طلای خام");
  });
});

/**
 * ⚠️ Research on the wage/profit question (#90) found no published rate for
 * the seller's profit — the 7% figure is press attribution to a former head of
 * the Tehran gold union, and a board member of another branch is on record
 * that it is custom and not law. Only VAT may carry a legal citation here.
 */
describe("JewelryCalculator — what the page is allowed to claim about each percentage", () => {
  it("VAT keeps its statutory citation", () => {
    const html = renderToStaticMarkup(
      <JewelryCalculator pricePerGram={18_500_000} referenceName="میلی" />,
    );
    expect(html).toContain("بند (ب) ماده (۲۶) قانون مالیات بر ارزش افزوده");
  });

  it("the seller's profit is presented as market custom, with no rate behind it", () => {
    const html = renderToStaticMarkup(
      <JewelryCalculator pricePerGram={18_500_000} referenceName="میلی" />,
    );
    expect(html).toContain("data-calculator-profit-note");
    expect(html).toContain("برای سود فروشنده نرخ‌نامه‌ای اعلام نشده است");
    expect(html).toContain("عرف بازار است");
  });

  it("no percentage is prefilled for wage or profit, and none is called official", () => {
    const html = renderToStaticMarkup(
      <JewelryCalculator pricePerGram={18_500_000} referenceName="میلی" />,
    );
    expect(html).not.toContain("۷٪");
    expect(html).not.toContain("اتحادیه");
    expect(html).not.toMatch(/سود[^<]{0,40}(رسمی|قانونی|مصوب)/);
  });
});

describe("VAT rate — a statutory rate that changes by Jalali year", () => {
  it("9% for 1400–1403, 10% from 1404 onwards", () => {
    expect(vatPercentForJalaliYear(1400)).toBe(9);
    expect(vatPercentForJalaliYear(1403)).toBe(9);
    expect(vatPercentForJalaliYear(1404)).toBe(10);
    expect(vatPercentForJalaliYear(1405)).toBe(10);
  });

  it("a year past the table keeps the last known rate rather than falling to zero", () => {
    expect(vatPercentForJalaliYear(1410)).toBe(10);
  });

  it("a year before the act keeps the earliest known rate", () => {
    expect(vatPercentForJalaliYear(1399)).toBe(9);
  });

  it("the Jalali year is read from an injected instant, not from the wall clock", () => {
    expect(currentJalaliYear(Date.parse("2023-06-15T00:00:00Z"))).toBe(1402);
    expect(currentJalaliYear(Date.parse("2025-01-15T00:00:00Z"))).toBe(1403);
    expect(currentJalaliYear(Date.parse("2025-06-15T00:00:00Z"))).toBe(1404);
    expect(currentJalaliYear(Date.parse("2026-08-18T00:00:00Z"))).toBe(1405);
  });

  it("the default rate follows that year across the 1403 ⟸ 1404 change", () => {
    expect(currentVatPercent(Date.parse("2025-01-15T00:00:00Z"))).toBe(9);
    expect(currentVatPercent(Date.parse("2025-06-15T00:00:00Z"))).toBe(10);
    expect(currentVatPercent(Date.parse("2026-08-18T00:00:00Z"))).toBe(10);
  });
});
