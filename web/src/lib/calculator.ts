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
 */
export function jewelryTotal(options: {
  weightGrams: number;
  pricePerGram: number;
  wagePercent: number;
  profitPercent: number;
  vatPercent: number;
}): number {
  const { weightGrams, pricePerGram, wagePercent, profitPercent, vatPercent } = options;
  const gold = weightGrams * pricePerGram;
  const withWage = gold * (1 + wagePercent / 100);
  const withProfit = withWage * (1 + profitPercent / 100);
  return Math.round(withProfit * (1 + vatPercent / 100));
}
