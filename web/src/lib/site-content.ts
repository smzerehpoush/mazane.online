import { formatFaNumber } from "./fa-number";
import type { HistoryRange } from "./history";

export const brand = {
  name: "تابلو",
  title: "تابلو — مقایسه‌ی قیمت واقعی طلا",
  description:
    "مقایسه‌ی لحظه‌ای قیمت خرید و فروش طلای آب‌شده در سکوهای معتبر ایرانی؛ شفاف، بی‌طرف و بدون کارمزد پنهان.",
} as const;

export const nav = [
  { label: "طلای ۱۸ عیار", href: "/tala-18" },
  { label: "بلاگ", href: "/blog" },
  { label: "مظنه چیست", href: "/mazane-chist" },
  { label: "درباره‌ی پیشنهاد سردبیر", href: "/darbare-pishnahad" },
] as const;

export const legalNote =
  "قیمت‌ها متعلق به سکوهای نام‌برده است و هر ۳۰ ثانیه به‌روزرسانی می‌شود. تابلو معامله‌گر یا مشاور سرمایه‌گذاری نیست.";

export const HOME_INSTRUMENT = "GOLD_18K";

export const HOME_CHART_HOURS = 24;

export interface ChartPlatformConfig {
  slug: string;
  name_fa: string;
  color: string;
  /**
   * ⚠️ هرگز از payload پنل نمی‌آید و همیشه در `chartSeriesConfig` نشانده
   * می‌شود؛ توضیحش آنجاست.
   */
  is_reference?: boolean;
}

/**
 * ⚠️ این باید یک تنظیم پنل مدیریت باشد (تصمیم مالک، ۲۰۲۶-۰۸-۱۱: «من در
 * ادمین پنل یک قیمت را به عنوان مرجع انتخاب می‌کنم»). امروز ثابتِ کد است چون
 * `platform_settings` ستون `is_reference` ندارد و بک‌اند در این مرحله دست
 * نمی‌خورد. شکاف در `api-gaps.md` ثبت شده؛ روزی که ستون آمد، فقط همین
 * ثابت جایش را به مقدار خوانده‌شده می‌دهد و هیچ مصرف‌کننده‌ای عوض نمی‌شود.
 */
export const REFERENCE_PLATFORM_SLUG = "milli";

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
  const list =
    override !== undefined && isValidChartPlatformList(override) ? override : CHART_PLATFORMS;
  return withReference(list);
}

/**
 * ⚠️ چرا اینجا و نه در داده: payload پنل (`tablo:chart_config`) این فیلد را
 * ندارد. اگر پرچم را فقط روی `CHART_PLATFORMS` می‌گذاشتیم، به‌محض اینکه مالک
 * از پنل فهرست را تغییر می‌داد، سکوی مرجع بی‌سروصدا ناپدید می‌شد و محور
 * لنگرش را از دست می‌داد — دقیقاً همان نوع خرابی که فقط در تولید دیده می‌شود.
 */
function withReference(list: readonly ChartPlatformConfig[]): readonly ChartPlatformConfig[] {
  if (list.length === 0) return list;
  const hasReference = list.some((platform) => platform.slug === REFERENCE_PLATFORM_SLUG);
  if (!hasReference) {
    console.warn(
      `سکوی مرجع «${REFERENCE_PLATFORM_SLUG}» در فهرست نمایشی نیست — اولین عضو فهرست مرجع شد`,
    );
  }
  const referenceSlug = hasReference ? REFERENCE_PLATFORM_SLUG : list[0]?.slug;
  return list.map((platform) => ({
    ...platform,
    is_reference: platform.slug === referenceSlug,
  }));
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
 * ⚠️ عمداً جدا از `RATE_CARD_RANGES` است و نه import از آن: آن‌ها برچسب کارت
 * نرخِ **صفحه‌ی سکو**اند («روزانه/هفتگی/ماهانه») و آنجا کنار جدولی می‌نشینند
 * که واژگان خودش را دارد. یکی‌کردنشان یعنی هر تغییر در یک صفحه بی‌سروصدا
 * صفحه‌ی دیگر را هم عوض می‌کند. بازه‌ها (`hours`/`stepHours`) مشترک می‌مانند؛
 * فقط واژه فرق می‌کند.
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

export const UNION_RATE_REFERENCE_SLUG = "talair";
export const UNION_RATE_INSTRUMENT = "GOLD_18K_TOMAN";

/**
 * ⚠️ از `lib/fa-number.ts` می‌آید نه `Intl.NumberFormat` — خروجی یکسان است
 * ولی دیگر به نسخه‌ی ICU سرور/مرورگر گره نخورده.
 */
export const fa = (value: number): string => formatFaNumber(value);

export const toman = (value: number): string => `${formatFaNumber(value)} تومان`;
