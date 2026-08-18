/**
 * ⚠️ **The formula lives here, not in the calculator's `.tsx`**, for the same
 * reason `lib/calculator.ts` gives: this file is the only gate for the
 * arithmetic of a sell-back and it has its own test. Arithmetic written inside
 * a component is arithmetic nobody runs a test against, and this particular
 * result is the number a visitor takes to a shop counter.
 *
 * ⚠️ **A sell-back is not a purchase with a minus sign.** Wage, seller profit
 * and VAT are absent from this file on purpose: none of them is paid back to
 * the seller, so none of them may appear as a term. Adding one here would turn
 * the page's whole answer upside down.
 *
 * ⚠️ **The site's reference rate is one gram of 18k gold**, so every other
 * karat is converted explicitly through `purityPerMille / GOLD_18K_PURITY`.
 * Multiplying a 21k weight by the 18k rate under-values the piece by 14%.
 *
 * ⚠️ `deduction` is taken from the **already rounded** `goldValue`, so
 * `goldValue - deduction` is exactly `payout` and the three displayed lines
 * always add up. `payoutSharePercent` and `pureGoldGrams` stay unrounded — the
 * display layer rounds them, the same split `jewelryBreakdown` uses.
 */

export const GOLD_18K_PURITY = 750;

/**
 * ⚠️ Jewellery karats only. Coins, bullion and آب‌شده are quoted on their own
 * market rates and do not track a linear conversion from the 18k gram price,
 * so offering them here would produce a confident number that the market does
 * not honour.
 */
export const SELL_BACK_KARATS = [
  { karat: 18, purityPerMille: 750 },
  { karat: 21, purityPerMille: 875 },
  { karat: 22, purityPerMille: 916 },
  { karat: 24, purityPerMille: 999 },
] as const;

export const DEFAULT_SELL_BACK_PURITY = GOLD_18K_PURITY;

export function isSellBackPurity(value: number): boolean {
  return SELL_BACK_KARATS.some((option) => option.purityPerMille === value);
}

export interface SellBackInput {
  weightGrams: number;
  pricePerGram18k: number;
  purityPerMille: number;
  deductionPercent: number;
}

export interface SellBackBreakdown {
  pureGoldGrams: number;
  goldValue: number;
  deduction: number;
  payout: number;
  payoutSharePercent: number | null;
}

/**
 * ⚠️ The deduction is clamped to 0–100 before it touches the money: a typo of
 * `150` would otherwise print a negative payout, which reads as "you owe the
 * shop" and is never a real offer.
 */
export function sellBackBreakdown(options: SellBackInput): SellBackBreakdown {
  const { weightGrams, pricePerGram18k, purityPerMille, deductionPercent } = options;

  const pureGoldGrams = weightGrams * (purityPerMille / 1000);
  const goldValue = Math.round(weightGrams * pricePerGram18k * (purityPerMille / GOLD_18K_PURITY));

  const percent = Math.min(Math.max(deductionPercent, 0), 100);
  const deduction = Math.round(goldValue * (percent / 100));
  const payout = goldValue - deduction;

  return {
    pureGoldGrams,
    goldValue,
    deduction,
    payout,
    payoutSharePercent: goldValue > 0 ? (payout / goldValue) * 100 : null,
  };
}

export function sellBackPayout(options: SellBackInput): number {
  return sellBackBreakdown(options).payout;
}
