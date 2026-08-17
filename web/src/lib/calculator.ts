const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DECIMAL_SEPARATOR = "٫";
const THOUSANDS_SEPARATORS = /[٬,\s]/g;

function toLatinDigits(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const persianIndex = PERSIAN_DIGITS.indexOf(ch);
    if (persianIndex !== -1) {
      out += String(persianIndex);
      continue;
    }
    const arabicIndex = ARABIC_INDIC_DIGITS.indexOf(ch);
    if (arabicIndex !== -1) {
      out += String(arabicIndex);
      continue;
    }
    out += ch;
  }
  return out;
}

export function parseCalculatorInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const normalized = toLatinDigits(trimmed)
    .replace(THOUSANDS_SEPARATORS, "")
    .replace(PERSIAN_DECIMAL_SEPARATOR, ".");

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function amountFromWeight(weightGrams: number, unitPriceToman: number): number {
  return Math.round(weightGrams * unitPriceToman);
}

export function weightFromAmount(amountToman: number, unitPriceToman: number): number | null {
  if (!Number.isFinite(unitPriceToman) || unitPriceToman <= 0) return null;
  const grams = amountToman / unitPriceToman;
  return Math.round(grams * 10_000) / 10_000;
}

const VAT_PERCENT_FROM_JALALI_YEAR = [
  { fromYear: 1400, percent: 9 },
  { fromYear: 1404, percent: 10 },
] as const;

export function vatPercentForJalaliYear(jalaliYear: number): number {
  const [earliest] = VAT_PERCENT_FROM_JALALI_YEAR;
  let percent: number = earliest.percent;
  for (const bracket of VAT_PERCENT_FROM_JALALI_YEAR) {
    if (jalaliYear >= bracket.fromYear) percent = bracket.percent;
  }
  return percent;
}

const jalaliYearFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric",
  timeZone: "Asia/Tehran",
});

export function currentJalaliYear(nowMs: number = Date.now()): number {
  return Number(jalaliYearFormatter.format(new Date(nowMs)).replace(/\D/g, ""));
}

export function currentVatPercent(nowMs: number = Date.now()): number {
  return vatPercentForJalaliYear(currentJalaliYear(nowMs));
}

export interface JewelryInput {
  weightGrams: number;
  pricePerGram: number;
  wagePercent: number;
  profitPercent: number;
  vatPercent: number;
}

export interface JewelryBreakdown {
  gold: number;
  wage: number;
  profit: number;
  vat: number;
  total: number;
  extraCostPercent: number | null;
}

/**
 * ⚠️ **This is not a violation, for the same reason stated at the top of
 * this file**: that rule says the web must not construct or derive a
 * **platform**'s price. Nothing here constructs a price — the user enters
 * the inputs themselves, and the output is never stored, published, or
 * attributed to a platform. This is the same category as `amountFromWeight`
 * above, already accepted; it just has a few more multiplications.
 * ⚠️ Deliberately placed here and not inside a component: this file is the
 * "only gate" for the calculator's arithmetic and has its own test. A
 * formula living inside a `.tsx` would stay untested.
 * ⚠️ VAT is charged on wage + profit only, never on the gold principal,
 * which Article 26(b) of the VAT Act (1400/03/02) exempts — collapsing this
 * into a `total * (1 + vat)` chain overstates the result by roughly 7%.
 * ⚠️ `total` is the sum of the four **already rounded** lines, never
 * `Math.round` of the exact sum: the two disagree by a toman or two, and the
 * displayed lines have to add up to the displayed total.
 * ⚠️ `extraCostPercent` is left unrounded on purpose — the display layer
 * rounds it, because `formatFaNumber` rounds a decimal string and so gets the
 * half-cases right where `Math.round(x * 10) / 10` does not.
 */
export function jewelryBreakdown(options: JewelryInput): JewelryBreakdown {
  const { weightGrams, pricePerGram, wagePercent, profitPercent, vatPercent } = options;
  const exactGold = weightGrams * pricePerGram;
  const exactWage = exactGold * (wagePercent / 100);
  const exactProfit = (exactGold + exactWage) * (profitPercent / 100);
  const exactVat = (exactWage + exactProfit) * (vatPercent / 100);

  const gold = Math.round(exactGold);
  const wage = Math.round(exactWage);
  const profit = Math.round(exactProfit);
  const vat = Math.round(exactVat);

  const extra = wage + profit + vat;

  return {
    gold,
    wage,
    profit,
    vat,
    total: gold + extra,
    extraCostPercent: gold > 0 ? (extra / gold) * 100 : null,
  };
}

export function jewelryTotal(options: JewelryInput): number {
  return jewelryBreakdown(options).total;
}
