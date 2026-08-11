/**
 * لایه‌ی تطبیق داشبورد — موجودیت‌های دامنه ⟸ دقیقاً چیزی که بند ۹ سند طراحی
 * می‌خواهد.
 *
 * چرا این لایه وجود دارد: شکل بک‌اند (`Row`, `PlatformHistory`,
 * `ChartPlatformConfig`) با شکل مورد نیاز طراحی یکی نیست، و **بک‌اند دست
 * نمی‌خورد**. اختلاف‌ها و آنچه هنوز از بک‌اند نمی‌آید در `docs/api-gaps.md`
 * مستند است.
 *
 * ⚠️ **همه‌چیز اینجا سمت سرور اجرا می‌شود** (بند ۱۴): هندسه‌ی محور، آمار بازه،
 * مسیرهای SVG، و **قالب‌بندی فارسی اعداد**. کلاینت رشته‌ی آماده می‌گیرد و فقط
 * می‌نشاندش. دو دلیل: اول اینکه HTML اولیه باید عدد واقعی داشته باشد (سئو و
 * «بدون جاوااسکریپت هم بخوان»)، دوم اینکه هر قالب‌بندی سمت کلاینت یک منبع
 * تازه‌ی hydration mismatch است.
 *
 * ⚠️ قاعده‌ی سخت ۱ قراردادها: **هیچ فرمول قیمتی اینجا نیست.** هر عدد قیمتی
 * همان است که گردآورنده ذخیره کرده. آنچه محاسبه می‌شود دو دسته است و هر دو
 * مجازند:
 *   - **هندسه‌ی نمایش** (درصد موقعیت روی محور، مختصات SVG) — مقیاس است، نه قیمت.
 *   - **کمینه/بیشینه/کسر تغییرِ یک سریِ تک‌سکویی** — همان الگوی مجازی که از
 *     قبل در `PlatformRateCard::computeStats` هست.
 *
 * ⚠️ قاعده‌ی سخت ۴: **هیچ میانگین بین‌سکویی‌ای ساخته نمی‌شود** و هیچ درصد
 * اختلافی بین دو سکو حساب نمی‌شود (بند ۱۵، تصمیم ۳). خلاصه بازار عدد
 * **سکوی مرجع** را نشان می‌دهد، با نام خودش.
 */
import { formatFaNumber } from "./fa-number";
import { formatSignedPercentFa } from "./format";
import type { HistoryRange, PlatformHistory, PlatformHistoryByRange } from "./history";
import { priceToman, type Row } from "./rows";
import { seriesPaths } from "./spline";
import { HOME_INSTRUMENT, RATE_CARD_RANGES, type ChartPlatformConfig } from "./site-content";

/* ------------------------------------------------------------------ محور */

/**
 * حداقل بازه‌ی مقیاس محور، تومان (بند ۵، «مورد لبه‌ای که حتماً باید حل شود»).
 *
 * بدون این، وقتی همه‌ی سکوها تقریباً هم‌قیمت‌اند مقیاس کش می‌آید و اختلاف
 * ناچیز عظیم به نظر می‌رسد — محور دروغ بصری می‌گوید. با کف ۵۰٬۰۰۰، نشانگرها
 * حول مرکز جمع می‌مانند و **خودِ فشردگی اطلاعات است**.
 */
export const MIN_RAIL_SPREAD_TOMAN = 50_000;

/** لبه‌های محور بر حسب درصد — نشانگر هرگز روی خودِ لبه نمی‌نشیند. */
const RAIL_START_PERCENT = 4;
const RAIL_USABLE_PERCENT = 92;

export interface RailSource {
  slug: string;
  name: string;
  color: string;
  isReference: boolean;
  /** عدد خام — فقط برای مقایسه‌ی کلاینت؛ آنچه نمایش داده می‌شود `priceDisplay` است. */
  priceToman: number | null;
  /** رشته‌ی آماده‌ی فارسی، یا `null` وقتی این سکو در این نوبت قیمت ندارد. */
  priceDisplay: string | null;
  /**
   * درصد از **راست** (RTL: راست = ارزان‌تر). `null` یعنی بی‌قیمت ⟸ روی محور
   * نشانگر نمی‌گیرد ولی کارتش می‌ماند.
   */
  railPercent: number | null;
  /** رتبه‌های فرد ساقه‌ی بلند می‌گیرند تا برچسب‌ها روی هم نیفتند (بند ۵). */
  stemLong: boolean;
  /** مقصد لینک خروجی — همیشه ‎/go/<slug>‎ (قاعده‌ی سخت ۷). */
  href: string;
  /** متن جایگزین نشانگر برای صفحه‌خوان (بند ۱۲). */
  ariaLabel: string;
  sparkline: { line: string | null; area: string | null };
}

export interface RailView {
  sources: RailSource[];
  /** «گران‌تر · {max}» و «{min} · ارزان‌تر» و «بازه اختلاف …» — همه آماده. */
  maxDisplay: string | null;
  minDisplay: string | null;
  spreadDisplay: string | null;
  /** موقعیت خط‌چین لنگر؛ `null` یعنی سکوی مرجع در این نوبت قیمت ندارد. */
  referencePercent: number | null;
  /** بند ۱۱: با یک منبعِ قیمت‌دار، محور معنا ندارد و فقط کارت‌ها می‌مانند. */
  hasRail: boolean;
}

/**
 * موقعیت یک قیمت روی محور — مقدار خصیصه‌ی CSS `right`، بر حسب درصد.
 *
 * ارزان‌ترین ⟸ `right: 4%` (چسبیده به لبه‌ی **راست**) و گران‌ترین ⟸
 * `right: 96%` (لبه‌ی چپ). `span` از پیش با کف ۵۰٬۰۰۰ تنظیم شده.
 *
 * ⚠️ **این فرمول عمداً وارونه‌ی چیزی است که بند ۵ سند طراحی نوشته**، و دلیلش
 * یک اشتباه در خودِ سند و نمونه است:
 *
 *   سند می‌گوید «موقعیت = 4 + (1 − ratio) × 92 … ارزان‌ترین در ۹۶٪
 *   (راست‌ترین)» و نمونه هم همان را روی `style.right` می‌نشاند. ولی `right`
 *   در CSS یعنی «فاصله از لبه‌ی راست»، پس `right: 96%` عنصر را به لبه‌ی
 *   **چپ** می‌برد، نه راست. یعنی آن فرمول ارزان‌ترین را چپ‌ترین می‌کند —
 *   دقیقاً برعکسِ سه جای دیگرِ همان سند:
 *     - بند ۱.۴: «روی محور قیمت، **راست = ارزان‌تر**»
 *     - زیرعنوان خودِ کارت: «هرچه راست‌تر، ارزان‌تر»
 *     - پاورقی محور: سمت راست «ارزان‌تر»
 *
 *   اصل سه‌بار-تکرارشده بر فرمول یک‌بار-نوشته‌شده مقدم است (و در RTL هم
 *   خواندن از راست شروع می‌شود، پس ارزان‌ترین باید اولین چیزی باشد که
 *   چشم می‌بیند). راستی‌آزمایی شد: با فرمول سند، ارزان‌ترین در مرورگر
 *   چپ‌ترین می‌افتاد در حالی که زیرعنوان کارت خلافش را می‌گفت.
 */
function railPercentOf(price: number, min: number, span: number): number {
  const ratio = span === 0 ? 0.5 : (price - min) / span;
  return Number((RAIL_START_PERCENT + ratio * RAIL_USABLE_PERCENT).toFixed(3));
}

/**
 * کمینه/بیشینه‌ی مقیاس با اعمال کف ۵۰٬۰۰۰.
 *
 * وقتی بازه‌ی واقعی کوچک‌تر از کف است، بازه **حول مرکز خودش** باز می‌شود، نه
 * از یک سر — وگرنه نشانگرها به یک طرف می‌چسبند و محور کج به نظر می‌رسد.
 */
export function railScale(prices: readonly number[]): { min: number; span: number } {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const actualSpan = max - min;
  if (actualSpan >= MIN_RAIL_SPREAD_TOMAN) return { min, span: actualSpan };

  const center = (min + max) / 2;
  return { min: center - MIN_RAIL_SPREAD_TOMAN / 2, span: MIN_RAIL_SPREAD_TOMAN };
}

/* --------------------------------------------------------- خلاصه‌ی بازار */

export interface SummaryPoint {
  valueDisplay: string;
  /** ساعت وقوع، فارسی — بند ۷: کنار بیشینه/کمینه بیاید تا با محور اشتباه نشود. */
  atDisplay: string;
}

export interface SummaryRange {
  key: HistoryRange;
  label: string;
  /** آخرین نقطه‌ی همان بازه. */
  currentDisplay: string | null;
  high: SummaryPoint | null;
  low: SummaryPoint | null;
  /** کسر تغییر سر تا ته بازه — علامتش جهت فلش را تعیین می‌کند. */
  changeFraction: number | null;
  changeDisplay: string | null;
  area: { line: string | null; area: string | null };
  /** زبانه‌ی بی‌داده غیرفعال می‌شود، نه اینکه عدد جعلی نشان دهد (بند ۱۱). */
  enabled: boolean;
}

export interface SummaryView {
  /** نام سکوی مرجع — بند ۷: هر عدد باید نام صاحبش را داشته باشد. */
  referenceName: string | null;
  ranges: SummaryRange[];
}

const SUMMARY_WIDTH = 320;
const SUMMARY_HEIGHT = 108;

const hourFormatter = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Tehran",
});

/**
 * فقط انتخاب و یک تقسیم روی همان سری — کمینه، بیشینه، و کسر تفاضل سر و ته.
 * همان الگوی مجاز `PlatformRateCard::computeStats` (بند ۷).
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
    high: { valueDisplay: formatFaNumber(highPoint.value), atDisplay: formatHour(highPoint.hour) },
    low: { valueDisplay: formatFaNumber(lowPoint.value), atDisplay: formatHour(lowPoint.hour) },
    changeFraction,
    changeDisplay: formatSignedPercentFa(changeFraction),
    area: seriesPaths(
      points.map((point) => point.value),
      { width: SUMMARY_WIDTH, height: SUMMARY_HEIGHT, padding: 6 },
    ),
    enabled: true,
  };
}

function formatHour(iso: string): string {
  return hourFormatter.format(new Date(iso));
}

/* ------------------------------------------------------------- کل داشبورد */

export interface DashboardView {
  rail: RailView;
  summary: SummaryView;
  /**
   * زمان تازه‌ترین داده روی صفحه — مبنای همگام‌سازی فتیله (بند ۱۴).
   * `null` یعنی هیچ سکویی هرگز داده نداده.
   */
  updatedAt: string | null;
  /**
   * همان زمان، ساعت تهران و فارسی — برای برچسب «آخرین به‌روزرسانی».
   *
   * ⚠️ عمداً **مطلق** است و نه «۲ دقیقه پیش»: متن نسبی به `Date.now()` نیاز
   * دارد و بند ۱۴ آن را در رندر سرور ممنوع کرده (منبع دوم واگرایی hydration).
   * حسِ تازگی را فتیله می‌دهد؛ این برچسب فقط سن داده را مستند می‌کند —
   * الزام بند ۶.۲ سند معماری که با حذف جدول نباید از بین می‌رفت.
   */
  updatedAtDisplay: string | null;
}

export interface DashboardInput {
  rows: readonly Row[];
  /** سکوهای نمایشی صفحه‌ی اصلی، به ترتیب پنل (بند ۱۵، تصمیم ۲). */
  platforms: readonly ChartPlatformConfig[];
  /** تاریخچه‌ی ۲۴ ساعته‌ی همان سکوها — ورودی اسپارک‌لاین کارت‌ها. */
  history: readonly PlatformHistory[];
  /** سه بازه‌ی سکوی مرجع — ورودی خلاصه بازار. */
  referenceHistory: PlatformHistoryByRange;
}

const SPARK_WIDTH = 100;
const SPARK_HEIGHT = 32;

/**
 * تنها جایی که نمای داشبورد ساخته می‌شود. خالص و بی‌وابستگی، پس مرز تست وب
 * همین را می‌سنجد نه نسخه‌ی دومش.
 */
export function buildDashboard(input: DashboardInput): DashboardView {
  const rowBySlug = new Map(input.rows.map((row) => [row.platform.slug, row]));
  const historyBySlug = new Map(input.history.map((entry) => [entry.platform_slug, entry]));

  // مرحله‌ی یک: قیمت هر سکوی نمایشی. هنوز بدون هندسه — مقیاس به کل مجموعه
  // وابسته است و تا همه‌ی قیمت‌ها معلوم نشوند نمی‌شود حسابش کرد.
  const priced = input.platforms.map((platform) => {
    const row = rowBySlug.get(platform.slug) ?? null;
    const entry = historyBySlug.get(platform.slug) ?? null;
    return {
      platform,
      row,
      // اسنپ‌شات جاری مقدم است؛ نبودش ⟸ آخرین نقطه‌ی تاریخچه (هر دو انتخاب‌اند،
      // نه محاسبه). هیچ‌کدام ⟸ سکو در این نوبت قیمت ندارد.
      price: (row === null ? null : priceToman(row, HOME_INSTRUMENT)) ?? entry?.latest ?? null,
      points: entry?.points ?? [],
      name: row?.platform.name_fa ?? platform.name_fa,
    };
  });

  const prices = priced
    .map((item) => item.price)
    .filter((price): price is number => price !== null);
  const { min, span } = prices.length > 0 ? railScale(prices) : { min: 0, span: 0 };

  // رتبه‌بندی بر اساس قیمت — فقط برای دو-طولی‌کردن ساقه‌ها (بند ۵).
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
      // بند ۱۱: «یک منبع ⟸ محور معنا ندارد».
      hasRail: prices.length >= 2,
    },
    summary: {
      referenceName: referenceSource?.name ?? null,
      ranges: RATE_CARD_RANGES.map((range) => summaryOf(range, input.referenceHistory[range.key])),
    },
    updatedAt,
    updatedAtDisplay: updatedAt === null ? null : formatHour(updatedAt),
  };
}

/**
 * تازه‌ترین `updatedAt` میان همه‌ی ردیف‌ها.
 *
 * ⚠️ بک‌اند زمان **به‌ازای هر سکو** می‌دهد و هیچ زمان سطح-صفحه‌ای ندارد؛ فتیله
 * یکی می‌خواهد (بند ۱۴). بیشینه انتخاب شد نه کمینه: فتیله «چقدر از تازه‌ترین
 * داده گذشته» را می‌شمارد، و یک سکوی کهنه نباید فتیله‌ی کل صفحه را عقب بکشد —
 * کهنگی خودِ آن سکو جای دیگری برچسب می‌خورد. مستند در `docs/api-gaps.md`.
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
