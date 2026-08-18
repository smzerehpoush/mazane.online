/**
 * ⚠️ No number that gets rendered passes through `Intl`: `Intl`'s output is
 * tied to the ICU version, and the server's version doesn't match the
 * browser's; React silently patches the mismatch during hydration, and it
 * never shows up in any log.
 */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

const GROUP_SEPARATOR = "٬";
const DECIMAL_SEPARATOR = "٫";
const PERCENT_SIGN = "٪";
const MINUS_SIGN = "−";
const PLUS_SIGN = "+";
const LTR_MARK = "‎";

const MAX_SAFE_MAGNITUDE = 1e21;

const INVALID_PLACEHOLDER = "—";

export interface FaNumberOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  signDisplay?: "auto" | "exceptZero";
}

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const LATIN_NUMERAL_MAP: ReadonlyMap<string, string> = new Map<string, string>([
  ...[...PERSIAN_DIGITS].map((char, index): [string, string] => [char, String(index)]),
  ...[...ARABIC_INDIC_DIGITS].map((char, index): [string, string] => [char, String(index)]),
  [GROUP_SEPARATOR, ","],
  [DECIMAL_SEPARATOR, "."],
  [PERCENT_SIGN, "%"],
  [MINUS_SIGN, "-"],
  [LTR_MARK, ""],
]);

export function toLatinNumerals(text: string): string {
  let out = "";
  for (const char of text) out += LATIN_NUMERAL_MAP.get(char) ?? char;
  return out;
}

function toPersianDigits(latin: string): string {
  let out = "";
  for (const char of latin) {
    const digit = char.charCodeAt(0) - 48;
    out += digit >= 0 && digit <= 9 ? PERSIAN_DIGITS[digit] : char;
  }
  return out;
}

function groupThousands(digits: string): string {
  let out = "";
  for (let index = 0; index < digits.length; index++) {
    if (index > 0 && (digits.length - index) % 3 === 0) out += GROUP_SEPARATOR;
    out += digits[index];
  }
  return out;
}

function toPlainDecimal(value: number): string {
  const text = String(value);
  const exponentIndex = text.indexOf("e");
  if (exponentIndex === -1) return text;

  const mantissa = text.slice(0, exponentIndex);
  const exponent = Number(text.slice(exponentIndex + 1));
  const pointIndex = mantissa.indexOf(".");
  const digits =
    pointIndex === -1 ? mantissa : mantissa.slice(0, pointIndex) + mantissa.slice(pointIndex + 1);
  const pointPosition = (pointIndex === -1 ? mantissa.length : pointIndex) + exponent;

  if (pointPosition <= 0) return `0.${"0".repeat(-pointPosition)}${digits}`;
  if (pointPosition >= digits.length) return digits + "0".repeat(pointPosition - digits.length);
  return `${digits.slice(0, pointPosition)}.${digits.slice(pointPosition)}`;
}

function incrementDigits(digits: string): string {
  const chars = [...digits];
  for (let index = chars.length - 1; index >= 0; index--) {
    if (chars[index] === "9") {
      chars[index] = "0";
      continue;
    }
    chars[index] = String(Number(chars[index]) + 1);
    return chars.join("");
  }
  return `1${chars.join("")}`;
}

function roundAbsolute(
  value: number,
  fractionDigits: number,
): { integerPart: string; fractionPart: string } {
  const plain = toPlainDecimal(Math.abs(value));
  const pointIndex = plain.indexOf(".");
  const integerText = pointIndex === -1 ? plain : plain.slice(0, pointIndex);
  const fractionText = pointIndex === -1 ? "" : plain.slice(pointIndex + 1);

  if (fractionText.length <= fractionDigits) {
    return { integerPart: integerText, fractionPart: fractionText.padEnd(fractionDigits, "0") };
  }

  let combined = integerText + fractionText.slice(0, fractionDigits);
  if (fractionText.charCodeAt(fractionDigits) - 48 >= 5) combined = incrementDigits(combined);

  const cut = combined.length - fractionDigits;
  return { integerPart: combined.slice(0, cut) || "0", fractionPart: combined.slice(cut) };
}

export function formatFaNumber(value: number, options: FaNumberOptions = {}): string {
  const minimumFractionDigits = options.minimumFractionDigits ?? 0;
  const maximumFractionDigits = options.maximumFractionDigits ?? minimumFractionDigits;
  const signDisplay = options.signDisplay ?? "auto";

  if (!Number.isFinite(value) || Math.abs(value) >= MAX_SAFE_MAGNITUDE) {
    console.warn(`formatFaNumber: invalid display number — ${String(value)}`);
    return INVALID_PLACEHOLDER;
  }

  const { integerPart, fractionPart } = roundAbsolute(value, maximumFractionDigits);

  let fraction = fractionPart;
  while (fraction.length > minimumFractionDigits && fraction.endsWith("0")) {
    fraction = fraction.slice(0, -1);
  }

  const body = groupThousands(integerPart) + (fraction === "" ? "" : DECIMAL_SEPARATOR + fraction);

  const roundsToZero = !/[1-9]/.test(integerPart + fractionPart);
  let sign = "";
  if (signDisplay === "exceptZero") {
    if (!roundsToZero) sign = LTR_MARK + (value < 0 ? MINUS_SIGN : PLUS_SIGN);
  } else if (value < 0) {
    sign = LTR_MARK + MINUS_SIGN;
  }

  return sign + toPersianDigits(body);
}

export function formatFaYear(value: number): string {
  if (!Number.isFinite(value)) {
    console.warn(`formatFaYear: invalid year — ${String(value)}`);
    return INVALID_PLACEHOLDER;
  }
  return toPersianDigits(String(Math.trunc(value)));
}

export function formatFaPercentFromFraction(
  fraction: number,
  options: FaNumberOptions = {},
): string {
  if (!Number.isFinite(fraction)) {
    console.warn(`formatFaPercentFromFraction: invalid fraction — ${String(fraction)}`);
    return INVALID_PLACEHOLDER;
  }
  return formatFaNumber(fraction * 100, options) + PERCENT_SIGN;
}

export function formatFaPercentPoints(points: number, options: FaNumberOptions = {}): string {
  return formatFaNumber(points, options) + PERCENT_SIGN;
}

const TEHRAN_UTC_OFFSET_MINUTES = 210;

export function formatFaClock(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    console.warn(`formatFaClock: invalid time — ${iso}`);
    return INVALID_PLACEHOLDER;
  }
  const shifted = new Date(ms + TEHRAN_UTC_OFFSET_MINUTES * 60_000);
  const hours = String(shifted.getUTCHours()).padStart(2, "0");
  const minutes = String(shifted.getUTCMinutes()).padStart(2, "0");
  return toPersianDigits(`${hours}:${minutes}`);
}
