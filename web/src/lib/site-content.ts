import { formatFaNumber } from "./fa-number";
import type { HistoryRange } from "./history";

export const brand = {
  name: "تابلو",
  title: "تابلو — مقایسه‌ی قیمت واقعی طلا",
  description:
    "قیمت لحظه‌ای طلا و سکه را در تابلو مقایسه کن؛ اختلاف قیمت، حباب، کارمزد و تازگی داده‌ها را یک‌جا ببین.",
} as const;

export const nav = [
  { label: "طلای ۱۸ عیار", href: "/tala-18" },
  { label: "قیمت سکه", href: "/sekeh" },
  { label: "بلاگ", href: "/blog" },
  { label: "مظنه چیست", href: "/mazane-chist" },
] as const;

export const footerLinks = [
  { label: "درباره تابلو", href: "/about" },
  { label: "روش محاسبه قیمت‌ها", href: "/methodology" },
] as const;

export const legalNote =
  "قیمت‌ها متعلق به سکوهای نام‌برده است و هر ۳۰ ثانیه به‌روزرسانی می‌شود. تابلو معامله‌گر یا مشاور سرمایه‌گذاری نیست.";

export const HOME_INSTRUMENT = "GOLD_18K";

export const HOME_CHART_HOURS = 24;

export interface ChartPlatformConfig {
  slug: string;
  name_fa: string;
  color: string;
}

const CHART_PLATFORMS: readonly ChartPlatformConfig[] = [
  { slug: "milli", name_fa: "میلی", color: "#1d6fe0" },
  { slug: "melligold", name_fa: "ملی‌گلد", color: "#0bb0d4" },
  { slug: "talasea", name_fa: "طلاسی", color: "#9b8ce8" },
  { slug: "tlyn", name_fa: "طلاین", color: "#12a06a" },
  { slug: "wallgold", name_fa: "وال‌گلد", color: "#e0921d" },
];

export const MIN_CHART_PLATFORMS = 2;
export const MAX_CHART_PLATFORMS = 6;

const CHART_COLOR_RE = /^#[0-9a-f]{6}$/i;

export function isValidChartColor(color: string): boolean {
  return CHART_COLOR_RE.test(color);
}

export function isValidChartPlatformList(list: readonly ChartPlatformConfig[]): boolean {
  if (list.length < MIN_CHART_PLATFORMS || list.length > MAX_CHART_PLATFORMS) return false;
  const seen = new Set<string>();
  for (const platform of list) {
    if (typeof platform !== "object" || platform === null) return false;
    if (typeof platform.slug !== "string" || platform.slug.length === 0) return false;
    if (typeof platform.name_fa !== "string") return false;
    if (typeof platform.color !== "string" || !isValidChartColor(platform.color)) return false;
    if (seen.has(platform.slug)) return false;
    seen.add(platform.slug);
  }
  return true;
}

export function chartSeriesConfig(
  override?: readonly ChartPlatformConfig[],
): readonly ChartPlatformConfig[] {
  return override !== undefined && isValidChartPlatformList(override) ? override : CHART_PLATFORMS;
}

export function parseChartConfigPayload(
  raw: string | null,
): readonly ChartPlatformConfig[] | undefined {
  if (raw === null) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  return isValidChartPlatformList(parsed as ChartPlatformConfig[])
    ? (parsed as ChartPlatformConfig[])
    : undefined;
}

export interface RateCardRangeConfig {
  key: HistoryRange;
  label: string;
  hours: number;
  stepHours?: number;
}

/**
 * ⚠️ Deliberately separate from `RATE_CARD_RANGES`, not imported from it:
 * those are the rate-card labels for the **platform page** ("Daily/Weekly/
 * Monthly") and sit there next to a table with its own vocabulary. Merging
 * them would mean any change on one page silently changes the other too.
 * The ranges (`hours`/`stepHours`) stay shared; only the wording differs.
 */
export const HOME_SUMMARY_RANGE_LABELS: Readonly<Record<HistoryRange, string>> = {
  DAILY: "۲۴ ساعت اخیر",
  WEEKLY: "هفته گذشته",
  MONTHLY: "ماه گذشته",
};

export const RATE_CARD_RANGES: readonly RateCardRangeConfig[] = [
  { key: "DAILY", label: "روزانه", hours: 24 },
  { key: "WEEKLY", label: "هفتگی", hours: 24 * 7, stepHours: 2 },
  { key: "MONTHLY", label: "ماهانه", hours: 24 * 31, stepHours: 8 },
];

/**
 * ⚠️ The market reference must stay a **non-platform** source. It anchors the
 * price axis and names the number in the market summary, so a slug that also
 * earns revenue (anything with a `referral_param`, i.e. any row of
 * `CHART_PLATFORMS`) would turn the yardstick into a seller. `talair` is a
 * reference feed: it never enters `tablo:listed`, never gets a `/go/` link,
 * and never votes in the median sanity check.
 */
export const UNION_RATE_REFERENCE_SLUG = "talair";
export const MARKET_REFERENCE_SOURCE_NAME = "tala.ir";
export const UNION_RATE_INSTRUMENT = "GOLD_18K_TOMAN";
export const OUNCE_REFERENCE_INSTRUMENT = "XAU";
export const USD_REFERENCE_INSTRUMENT = "USD_TOMAN";
export const COIN_PRICE_INSTRUMENTS = [
  { key: "emami", label: "سکه امامی", instrument: "SEKEH_EMAMI_TOMAN" },
  { key: "half", label: "نیم سکه", instrument: "SEKEH_HALF_TOMAN" },
  { key: "quarter", label: "ربع سکه", instrument: "SEKEH_QUARTER_TOMAN" },
] as const;

/**
 * ⚠️ Comes from `lib/fa-number.ts`, not `Intl.NumberFormat` — same output,
 * but no longer tied to the server/browser's ICU version.
 */
export const fa = (value: number): string => formatFaNumber(value);

export const toman = (value: number): string => `${formatFaNumber(value)} تومان`;
