/**
 * ⚠️ **همه‌ی محاسبه اینجا انجام می‌شود** : هندسه‌ی محور، آمار بازه،
 * مسیرهای SVG، و **قالب‌بندی فارسی اعداد و ساعت**. لایه‌ی زنده رشته‌ی آماده
 * می‌گیرد و فقط می‌نشاندش. دو دلیل: HTML اولیه باید عدد واقعی داشته باشد
 * (سئو و «بدون جاوااسکریپت هم بخوان»)، و هر قالب‌بندی مستقلِ سمت کلاینت یک
 * منبع تازه‌ی hydration mismatch است.
 * ⚠️ ولی **«سمت سرور» به معنای «فقط سرور» نیست**: `HomePage` این تابع را در
 * بدنه‌ی رندر صدا می‌زند، پس موقع hydration روی مرورگر هم اجرا می‌شود. برای
 * همین هر چیزی که از اینجا بیرون می‌رود باید **قطعی** باشد — نه فقط خالص.
 * `Intl` (چه عدد چه تاریخ) قطعی نیست، چون به نسخه‌ی ICU محیط وابسته است؛
 * به همین دلیل هیچ فراخوانی `Intl` در این فایل نمانده.
 * ⚠️ **هیچ فرمول قیمتی اینجا نیست.** هر عدد قیمتی
 * همان است که گردآورنده ذخیره کرده. آنچه محاسبه می‌شود سه دسته است و هر سه
 * مجازند:
 * - **هندسه‌ی نمایش** (درصد موقعیت روی محور، مختصات SVG) — مقیاس است، نه قیمت.
 * - **کمینه/بیشینه/کسر تغییرِ یک سریِ تک‌سکویی** — همان الگوی مجازی که از
 * قبل در `PlatformRateCard::computeStats` هست.
 * - **فاصله‌ی دو سرِ همان محور** (`spreadDisplay`) — تفاضل دو قیمتِ
 * منتشرشده‌ی نام‌دار، نه قیمتی تازه. صریحاً می‌خواهدش
 * («بازه اختلاف {max-min} تومان») و هر دو سرش با نام صاحبشان روی همان
 * محور دیده می‌شوند. یک آماره‌ی پراکندگی است، نه ادعای قیمت —
 * مرزش هم روشن است: تفاضل مجاز، **میانگین ممنوع**.
 * ⚠️ **هیچ میانگین بین‌سکویی‌ای ساخته نمی‌شود** و هیچ درصد
 * اختلافی بین دو سکو حساب نمی‌شود. خلاصه بازار عدد
 * **سکوی مرجع** را نشان می‌دهد، با نام خودش.
 */
import { formatFaClock, formatFaNumber } from "./fa-number";
import { formatSignedPercentFa } from "./format";
import type { HistoryRange, PlatformHistory, PlatformHistoryByRange } from "./history";
import { priceToman, type Row } from "./rows";
import { seriesPaths } from "./spline";
import {
  HOME_INSTRUMENT,
  HOME_SUMMARY_RANGE_LABELS,
  RATE_CARD_RANGES,
  type ChartPlatformConfig,
} from "./site-content";

export const MIN_RAIL_SPREAD_TOMAN = 50_000;

const RAIL_START_PERCENT = 4;
const RAIL_USABLE_PERCENT = 92;

export interface RailSource {
  slug: string;
  name: string;
  color: string;
  isReference: boolean;
  priceToman: number | null;
  priceDisplay: string | null;
  railPercent: number | null;
  stemLong: boolean;
  href: string;
  ariaLabel: string;
  sparkline: { line: string | null; area: string | null };
  /**
   * ⚠️ سطح-صفحه کافی نیست: `updatedAt` کل داشبورد بیشینه‌ی همه‌ی سکوهاست، پس
   * یک سکوی مرده پشت تازگیِ بقیه پنهان می‌ماند. کهنگی را به
   * ازای **همان منبع** می‌خواهد، نه به ازای صفحه.
   */
  updatedAt: string | null;
  /**
   * ⚠️ این یعنی عدد **قدیمی** است. نمایشش مجاز است (: عدد قدیمی با
   * زمانش، نه پیام خطا) ولی **فقط در کنار برچسب کهنگی** — بدون آن، یک نقطه‌ی
   * تجمیع ساعتی بی‌سروصدا به‌جای «قیمت الان» جا می‌زند.
   */
  priceFromHistory: boolean;
}

export interface RailView {
  sources: RailSource[];
  maxDisplay: string | null;
  minDisplay: string | null;
  spreadDisplay: string | null;
  referencePercent: number | null;
  hasRail: boolean;
}

/**
 * ⚠️ **این فرمول عمداً وارونه‌ی چیزی است که نوشته**، و دلیلش
 * یک اشتباه در خودِ سند و نمونه است:
 */
function railPercentOf(price: number, min: number, span: number): number {
  const ratio = span === 0 ? 0.5 : (price - min) / span;
  return Number((RAIL_START_PERCENT + ratio * RAIL_USABLE_PERCENT).toFixed(3));
}

export function railScale(prices: readonly number[]): { min: number; span: number } {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const actualSpan = max - min;
  if (actualSpan >= MIN_RAIL_SPREAD_TOMAN) return { min, span: actualSpan };

  const center = (min + max) / 2;
  return { min: center - MIN_RAIL_SPREAD_TOMAN / 2, span: MIN_RAIL_SPREAD_TOMAN };
}

export interface SummaryPoint {
  valueDisplay: string;
  atDisplay: string;
}

export interface SummaryRange {
  key: HistoryRange;
  label: string;
  currentDisplay: string | null;
  high: SummaryPoint | null;
  low: SummaryPoint | null;
  changeFraction: number | null;
  changeDisplay: string | null;
  area: { line: string | null; area: string | null };
  enabled: boolean;
}

export interface SummaryView {
  referenceName: string | null;
  ranges: SummaryRange[];
}

const SUMMARY_WIDTH = 320;
const SUMMARY_HEIGHT = 108;

/**
 * ⚠️ اینجا `Intl.DateTimeFormat` بود و **باگ بود**: این تابع رشته‌هایی می‌سازد
 * که رندر می‌شوند (ساعت وقوع کمینه/بیشینه و برچسب «آخرین به‌روزرسانی»)، و
 * `buildDashboard` در بدنه‌ی رندر `HomePage` صدا زده می‌شود — پس هم روی سرور
 * و هم موقع hydration اجرا می‌شود. یعنی همان واگرایی نسخه‌ی ICU که
 * `lib/fa-number.ts` برای عدد بسته بود، از در تاریخ برگشته بود.
 */

function summaryOf(
  range: { key: HistoryRange; label: string },
  history: PlatformHistory | null,
): SummaryRange {
  const points = history?.points ?? [];
  const empty: SummaryRange = {
    key: range.key,
    label: range.label,
    currentDisplay: null,
    high: null,
    low: null,
    changeFraction: null,
    changeDisplay: null,
    area: { line: null, area: null },
    enabled: false,
  };
  if (points.length === 0) return empty;

  let highPoint = points[0]!;
  let lowPoint = points[0]!;
  for (const point of points) {
    if (point.value > highPoint.value) highPoint = point;
    if (point.value < lowPoint.value) lowPoint = point;
  }
  const first = points[0]!.value;
  const last = points[points.length - 1]!.value;
  const changeFraction = first === 0 ? 0 : (last - first) / first;

  return {
    key: range.key,
    label: range.label,
    currentDisplay: formatFaNumber(last),
    high: {
      valueDisplay: formatFaNumber(highPoint.value),
      atDisplay: formatFaClock(highPoint.hour),
    },
    low: { valueDisplay: formatFaNumber(lowPoint.value), atDisplay: formatFaClock(lowPoint.hour) },
    changeFraction,
    changeDisplay: formatSignedPercentFa(changeFraction),
    area: seriesPaths(
      points.map((point) => point.value),
      { width: SUMMARY_WIDTH, height: SUMMARY_HEIGHT, padding: 6 },
    ),
    enabled: true,
  };
}

export interface DashboardView {
  rail: RailView;
  summary: SummaryView;
  updatedAt: string | null;
  /**
   * ⚠️ عمداً **مطلق** است و نه «۲ دقیقه پیش»: متن نسبی به `Date.now` نیاز
   * دارد و آن را در رندر سرور ممنوع کرده (منبع دوم واگرایی hydration).
   * حسِ تازگی را فتیله می‌دهد؛ این برچسب فقط سن داده را مستند می‌کند —
   * الزام که با حذف جدول نباید از بین می‌رفت.
   */
  updatedAtDisplay: string | null;
}

export interface DashboardInput {
  rows: readonly Row[];
  platforms: readonly ChartPlatformConfig[];
  history: readonly PlatformHistory[];
  referenceHistory: PlatformHistoryByRange;
}

const SPARK_WIDTH = 100;
const SPARK_HEIGHT = 32;

export function buildDashboard(input: DashboardInput): DashboardView {
  const rowBySlug = new Map(input.rows.map((row) => [row.platform.slug, row]));
  const historyBySlug = new Map(input.history.map((entry) => [entry.platform_slug, entry]));

  const priced = input.platforms.map((platform) => {
    const row = rowBySlug.get(platform.slug) ?? null;
    const entry = historyBySlug.get(platform.slug) ?? null;
    const livePrice = row === null ? null : priceToman(row, HOME_INSTRUMENT);
    return {
      platform,
      row,
      price: livePrice ?? entry?.latest ?? null,
      // ⚠️ جدول قدیمی این فرود را نداشت و برای سکوی مرده «قیمت در دسترس نیست»
      // می‌گذاشت. فرود مفید است (عدد قدیمی بهتر از هیچ)، ولی باید **دیده شود**
      // که قدیمی است — وگرنه نقطه‌ی تجمیع ساعتی جای «قیمت الان» می‌نشیند.
      priceFromHistory: livePrice === null && (entry?.latest ?? null) !== null,
      points: entry?.points ?? [],
      name: row?.platform.name_fa ?? platform.name_fa,
    };
  });

  const prices = priced
    .map((item) => item.price)
    .filter((price): price is number => price !== null);
  const { min, span } = prices.length > 0 ? railScale(prices) : { min: 0, span: 0 };

  const rankBySlug = new Map(
    priced
      .filter((item) => item.price !== null)
      .sort((a, b) => (a.price as number) - (b.price as number))
      .map((item, rank) => [item.platform.slug, rank]),
  );

  const sources: RailSource[] = priced.map((item) => {
    const priceDisplay = item.price === null ? null : formatFaNumber(item.price);
    return {
      slug: item.platform.slug,
      name: item.name,
      color: item.platform.color,
      isReference: item.platform.is_reference === true,
      priceToman: item.price,
      priceDisplay,
      railPercent: item.price === null ? null : railPercentOf(item.price, min, span),
      stemLong: (rankBySlug.get(item.platform.slug) ?? 0) % 2 === 1,
      href: `/go/${item.platform.slug}`,
      ariaLabel:
        priceDisplay === null
          ? `${item.name} — قیمتی ثبت نشده است`
          : `${item.name} — ${priceDisplay} تومان`,
      sparkline: seriesPaths(
        item.points.map((point) => point.value),
        { width: SPARK_WIDTH, height: SPARK_HEIGHT },
      ),
      updatedAt: item.row?.updatedAt ?? null,
      priceFromHistory: item.priceFromHistory,
    };
  });

  const referenceSource = sources.find((source) => source.isReference) ?? null;
  const updatedAt = latestUpdatedAt(input.rows);

  return {
    rail: {
      sources,
      maxDisplay: prices.length > 0 ? formatFaNumber(Math.max(...prices)) : null,
      minDisplay: prices.length > 0 ? formatFaNumber(Math.min(...prices)) : null,
      spreadDisplay:
        prices.length > 0 ? formatFaNumber(Math.max(...prices) - Math.min(...prices)) : null,
      referencePercent: referenceSource?.railPercent ?? null,
      hasRail: prices.length >= 2,
    },
    summary: {
      referenceName: referenceSource?.name ?? null,
      ranges: RATE_CARD_RANGES.map((range) =>
        summaryOf(
          { key: range.key, label: HOME_SUMMARY_RANGE_LABELS[range.key] },
          input.referenceHistory[range.key],
        ),
      ),
    },
    updatedAt,
    updatedAtDisplay: updatedAt === null ? null : formatFaClock(updatedAt),
  };
}

/**
 * ⚠️ بک‌اند زمان **به‌ازای هر سکو** می‌دهد و هیچ زمان سطح-صفحه‌ای ندارد؛ فتیله
 * یکی می‌خواهد. بیشینه انتخاب شد نه کمینه: فتیله «چقدر از تازه‌ترین
 * داده گذشته» را می‌شمارد، و یک سکوی کهنه نباید فتیله‌ی کل صفحه را عقب بکشد.
 * ⚠️ این عدد **جانشین کهنگیِ هر سکو نیست** و نباید بشود: بیشینه دقیقاً یعنی
 * یک سکوی مرده پشت تازگیِ بقیه پنهان می‌ماند. برچسب هر سکو از
 * `RailSource.updatedAt` می‌آید و روی کارت خودش رندر می‌شود. (نسخه‌ی اول این
 * فایل ادعا می‌کرد کهنگی «جای دیگری برچسب می‌خورد» در حالی که هیچ‌جا نمی‌خورد —
 * بازبینی کد گرفتش.md`.
 */
function latestUpdatedAt(rows: readonly Row[]): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    if (row.updatedAt === null) continue;
    const ms = Date.parse(row.updatedAt);
    if (Number.isNaN(ms) || ms <= latestMs) continue;
    latestMs = ms;
    latest = row.updatedAt;
  }
  return latest;
}
