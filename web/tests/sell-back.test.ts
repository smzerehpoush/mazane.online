import { describe, expect, it } from "vitest";

import {
  DEFAULT_SELL_BACK_PURITY,
  GOLD_18K_PURITY,
  isSellBackPurity,
  SELL_BACK_KARATS,
  sellBackBreakdown,
  sellBackPayout,
} from "../src/lib/sell-back";

const TEN_MILLION = 10_000_000;

describe("sell-back — the worked example on the page, by hand", () => {
  it("5 g of 18k at 10,000,000 per gram, minus a 10% buy-back cut, is 45,000,000", () => {
    const breakdown = sellBackBreakdown({
      weightGrams: 5,
      pricePerGram18k: TEN_MILLION,
      purityPerMille: 750,
      deductionPercent: 10,
    });
    expect(breakdown.pureGoldGrams).toBe(3.75);
    expect(breakdown.goldValue).toBe(50_000_000);
    expect(breakdown.deduction).toBe(5_000_000);
    expect(breakdown.payout).toBe(45_000_000);
    expect(breakdown.payoutSharePercent).toBe(90);
  });

  it("the three money lines always add up to the payout", () => {
    const breakdown = sellBackBreakdown({
      weightGrams: 3.33,
      pricePerGram18k: 9_876_543,
      purityPerMille: 916,
      deductionPercent: 8.5,
    });
    expect(breakdown.goldValue - breakdown.deduction).toBe(breakdown.payout);
  });
});

describe("sell-back — karat conversion", () => {
  /**
   * ⚠️ The reference rate is one gram of **18k**. A 21k gram carries 875/750
   * of the gold an 18k gram does, so 4 g of 21k at a 9,000,000 18k rate is
   * 4 × 10,500,000 = 42,000,000 — not 36,000,000.
   */
  it("4 g of 21k at a 9,000,000 18k rate is worth 42,000,000, not 36,000,000", () => {
    const breakdown = sellBackBreakdown({
      weightGrams: 4,
      pricePerGram18k: 9_000_000,
      purityPerMille: 875,
      deductionPercent: 10,
    });
    expect(breakdown.pureGoldGrams).toBe(3.5);
    expect(breakdown.goldValue).toBe(42_000_000);
    expect(breakdown.deduction).toBe(4_200_000);
    expect(breakdown.payout).toBe(37_800_000);
  });

  it("18k is the identity conversion", () => {
    expect(
      sellBackPayout({
        weightGrams: 2,
        pricePerGram18k: TEN_MILLION,
        purityPerMille: GOLD_18K_PURITY,
        deductionPercent: 0,
      }),
    ).toBe(20_000_000);
  });

  it("a higher karat is never worth less than a lower one at the same weight", () => {
    const values = SELL_BACK_KARATS.map(
      (option) =>
        sellBackBreakdown({
          weightGrams: 1,
          pricePerGram18k: TEN_MILLION,
          purityPerMille: option.purityPerMille,
          deductionPercent: 0,
        }).goldValue,
    );
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it("offers jewellery karats only, with 18k the default", () => {
    expect(SELL_BACK_KARATS.map((option) => option.karat)).toEqual([18, 21, 22, 24]);
    expect(DEFAULT_SELL_BACK_PURITY).toBe(750);
    expect(isSellBackPurity(750)).toBe(true);
    expect(isSellBackPurity(705)).toBe(false);
  });
});

describe("sell-back — what the formula deliberately leaves out", () => {
  /**
   * ⚠️ The whole point of the page: with no buy-back cut the seller receives
   * the gold value and nothing more. If a wage, a profit or a VAT term ever
   * crept into the module, this number would stop matching the gold value.
   */
  it("with no cut entered, the payout is exactly the gold value — no wage, no profit, no VAT", () => {
    const breakdown = sellBackBreakdown({
      weightGrams: 5,
      pricePerGram18k: TEN_MILLION,
      purityPerMille: 750,
      deductionPercent: 0,
    });
    expect(breakdown.payout).toBe(breakdown.goldValue);
    expect(breakdown.payout).toBe(50_000_000);
    expect(breakdown.payoutSharePercent).toBe(100);
  });
});

describe("sell-back — the payout never goes negative", () => {
  it("a cut above 100% is clamped, so the worst case is zero", () => {
    const breakdown = sellBackBreakdown({
      weightGrams: 5,
      pricePerGram18k: TEN_MILLION,
      purityPerMille: 750,
      deductionPercent: 150,
    });
    expect(breakdown.deduction).toBe(50_000_000);
    expect(breakdown.payout).toBe(0);
    expect(breakdown.payoutSharePercent).toBe(0);
  });

  it("a negative cut is clamped too, so the tool never invents a bonus", () => {
    const breakdown = sellBackBreakdown({
      weightGrams: 5,
      pricePerGram18k: TEN_MILLION,
      purityPerMille: 750,
      deductionPercent: -20,
    });
    expect(breakdown.deduction).toBe(0);
    expect(breakdown.payout).toBe(50_000_000);
  });

  it("a zero-value piece reports no share instead of dividing by zero", () => {
    expect(
      sellBackBreakdown({
        weightGrams: 5,
        pricePerGram18k: 0,
        purityPerMille: 750,
        deductionPercent: 10,
      }).payoutSharePercent,
    ).toBeNull();
  });
});
