import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PlatformCalculator } from "../src/components/content/PlatformCalculator";
import {
  amountFromWeight,
  jewelryTotal,
  parseCalculatorInput,
  weightFromAmount,
} from "../src/lib/calculator";
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
   * **the grand total**. Applying all three separately to the gold price
   * alone yields a smaller number.
   */
  it("wage on gold, profit on gold+wage, VAT on the total", () => {
    const total = jewelryTotal({
      weightGrams: 1,
      pricePerGram: 1_000_000,
      wagePercent: 10,
      profitPercent: 7,
      vatPercent: 10,
    });
    expect(total).toBe(1_294_700);
    expect(total).not.toBe(Math.round(1_000_000 * 1.27));
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
