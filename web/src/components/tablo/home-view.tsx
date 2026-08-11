/**
 * نمای صفحه‌ی اصلی — ترجمه‌ی موجودیت‌های دامنه به چیزی که اجزا رندر می‌کنند.
 *
 * ⚠️ قاعده‌ی ۱ قراردادها اینجا هم برقرار است: **هیچ فرمول قیمتی نیست.** هر
 * عددی که از این ماژول بیرون می‌رود، عددی است که گردآورنده از قبل حساب و
 * ذخیره کرده؛ اینجا فقط **انتخاب** (با کمک‌کارهای `lib/rows.ts`) و
 * **مرتب‌سازی** انجام می‌شود.
 *
 * ⚠️ قاعده‌ی ۴: هیچ میانگین بین‌سکویی ساخته نمی‌شود. هر عدد با نام سکوی
 * صاحبش منتشر می‌شود.
 *
 * ⚠️ بند ۶.۴: هیچ‌کدام از این توابع فیلدهای معرف سکو را نمی‌خوانند؛
 * مرتب‌سازی فقط از قیمت گردآورنده می‌آید.
 */
import type { PublishedPost } from "@/lib/blog";
import type { PlatformHistory } from "@/lib/history";
import type { PlatformTerms } from "@/lib/prices";
import {
  buyFeePercent,
  compareByPrice,
  isBuyOpen,
  priceToman,
  sellFeePercent,
  type Row,
} from "@/lib/rows";
import type { ChartPlatformConfig } from "@/lib/site-content";
import { HOME_INSTRUMENT } from "@/lib/site-content";
import { byPopularity, type ViewCounts } from "@/lib/views";

/* ---------------------------------------------------------------- نمودار */

/**
 * وضعیت نمایشی یک سکو در چیپ‌ها و نمودار.
 *
 * تفکیک «مؤثر / اسمی» حذف شد (سند تصمیم ۰۰۰۲): حالا عدد **همه‌ی** سکوها
 * پیش-از-کارمزد است، پس هیچ سکویی خط کم‌رنگ‌تر نمی‌گیرد.
 */
export type ChartPlatformState =
  /** قیمت دارد — خط پررنگ. */
  | "priced"
  /** هنوز هیچ داده‌ای از این سکو نداریم — محو، با برچسب «به‌زودی». */
  | "coming-soon";

export interface ChartPlatformView {
  slug: string;
  name: string;
  color: string;
  /** «قیمت» همان سکو (عدد آماده‌ی گردآورنده) — null یعنی هنوز داده‌ای نیست. */
  latestToman: number | null;
  state: ChartPlatformState;
  /** آیا در بازه‌ی نمودار سری تاریخی دارد. */
  hasSeries: boolean;
}

/**
 * یک ستون زمانی نمودار: کلید هر سکو اسلاگ خودش است تا `dataKey` ریچارتس
 * مستقیم همان اسلاگ باشد. سکوی بی‌داده در آن ساعت کلید ندارد ⟸ شکاف خط.
 */
export interface ChartPoint {
  /** آغاز ساعت — ISO-8601، ارقام لاتین (فقط کلید مرتب‌سازی؛ نمایش داده نمی‌شود). */
  hour: string;
  /** برچسب محور افقی، ارقام فارسی. */
  label: string;
  [platformSlug: string]: string | number | null | undefined;
}

export interface ChartView {
  platforms: ChartPlatformView[];
  series: ChartPoint[];
  /** بازه‌ی محور عمودی — «محور مطلق زوم‌شده» (تصمیم مالک). null یعنی سری خالی. */
  domain: [number, number] | null;
}

const hourFormatter = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Tehran",
});

function formatHourFa(iso: string): string {
  return hourFormatter.format(new Date(iso));
}

/**
 * سکوهای نمودار (پیکربندی `chartSeriesConfig` — امروز فهرست ثابت کد،
 * فردا تنظیمات سکو در پنل مدیریت) + سری ۲۴ ساعته‌شان.
 *
 * آخرین عدد هر سکو از **اسنپ‌شات جاری** می‌آید («قیمت» همان سکو) و اگر
 * اسنپ‌شات نبود، از آخرین نقطه‌ی تاریخچه — هر دو انتخاب‌اند، نه محاسبه.
 * سکوی بی‌هیچ داده (مثلاً سکویی که تازه باز شده) صفحه را نمی‌شکند: محو
 * می‌ماند با برچسب «به‌زودی».
 */
export function chartView(
  rows: Row[],
  history: PlatformHistory[],
  chartPlatforms: readonly ChartPlatformConfig[],
): ChartView {
  const rowBySlug = new Map(rows.map((row) => [row.platform.slug, row]));
  const historyBySlug = new Map(history.map((entry) => [entry.platform_slug, entry]));

  const platforms: ChartPlatformView[] = chartPlatforms.map((config) => {
    const row = rowBySlug.get(config.slug) ?? null;
    const entry = historyBySlug.get(config.slug) ?? null;
    const latestToman =
      (row === null ? null : priceToman(row, HOME_INSTRUMENT)) ?? entry?.latest ?? null;
    const hasSeries = (entry?.points.length ?? 0) > 0;
    const state: ChartPlatformState =
      latestToman === null && !hasSeries ? "coming-soon" : "priced";
    return {
      slug: config.slug,
      // نام درست از فهرست گردآورنده می‌آید؛ نام پیکربندی فقط پشتیبان است.
      name: row?.platform.name_fa ?? config.name_fa,
      color: config.color,
      latestToman,
      state,
      hasSeries,
    };
  });

  const series = buildSeries(history);
  return { platforms, series, domain: chartDomain(series, platforms) };
}

/** ادغام سری‌های هر سکو در یک آرایه‌ی ستونی — فقط بازآرایی داده. */
function buildSeries(history: PlatformHistory[]): ChartPoint[] {
  const byHour = new Map<string, ChartPoint>();
  for (const entry of history) {
    for (const point of entry.points) {
      let column = byHour.get(point.hour);
      if (column === undefined) {
        column = { hour: point.hour, label: formatHourFa(point.hour) };
        byHour.set(point.hour, column);
      }
      column[entry.platform_slug] = point.value;
    }
  }
  return [...byHour.values()].sort(
    (a, b) => Date.parse(a.hour) - Date.parse(b.hour),
  );
}

/** کمینه/بیشینه‌ی خودِ سری با کمی حاشیه — مقیاس محور است، نه قیمت. */
function chartDomain(
  series: ChartPoint[],
  platforms: ChartPlatformView[],
): [number, number] | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const column of series) {
    for (const platform of platforms) {
      const value = column[platform.slug];
      if (typeof value !== "number") continue;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  if (min === Number.POSITIVE_INFINITY) return null;
  const pad = (max - min) * 0.08 || Math.max(1, max * 0.001);
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

/* ------------------------------------------------------------------ جدول */

export interface TableRowView {
  slug: string;
  name: string;
  /** «قیمت» سکو، پیش از کارمزد — همان عدد برای همه‌ی سکوها. */
  priceToman: number | null;
  /** درصد کارمزد خرید؛ `null` یعنی سکو اعلامش نکرده، **نه** اینکه صفر است. */
  buyFeePercent: number | null;
  /** درصد کارمزد فروش؛ همان قاعده‌ی بالا. */
  sellFeePercent: number | null;
  updatedAt: string | null;
  /** داریک: قیمتش از دفتر سفارش کاربران می‌آید، نه قیمت‌گذاری فروشنده (بند ۹.۲). */
  isOrderBook: boolean;
  /** ارزان‌ترین ردیفِ قابل‌خرید — نشان «ارزان‌ترین» می‌گیرد. */
  isCheapest: boolean;
  /**
   * شرایط تجاری همان سکو — فقط برای نشان‌های «خرید/فروش بسته است» (بند ۹.۲،
   * بند ۱۳ تصمیم ۱۹: وضعیت باز/بسته مزیت رقابتی صریح این تک‌صفحه است).
   * منبع قطع ⟸ null و هیچ نشانی ادعا نمی‌شود.
   */
  terms: PlatformTerms | null;
}

const LAST = Number.POSITIVE_INFINITY;

/**
 * همه‌ی سکوهای فهرست گردآورنده، صعودی بر اساس **قیمت**؛ ردیف بی‌قیمت
 * (منبع قطع، یا دفتر سفارشِ یک‌سمته) آخر می‌ماند ولی **حذف نمی‌شود** —
 * قاعده‌ی ۵: کهنگی، نه خطا.
 *
 * ⚠️ ترتیب روی عدد **پیش از کارمزد** است (تصمیم مالک ۲۰۲۶-۰۸-۱۰؛ سند
 * تصمیم ۰۰۰۲): سکویی با قیمت پایین و کارمزد بالا ممکن است بالاتر از رقیبی
 * بنشیند که خرید از آن عملاً ارزان‌تر است. ستون‌های کارمزد کنارِ همان ردیف
 * تنها چیزی‌اند که این را برای کاربر آشکار می‌کنند.
 *
 * سکوی کارمزدنامعلوم دیگر جدا نمی‌افتد: عددش با بقیه هم‌جنس است.
 */
export function tableView(rows: Row[]): TableRowView[] {
  // ارزان‌ترینِ **قابل‌خرید**: سکویی که خریدش بسته است نشان نمی‌گیرد — بردن
  // نام «ارزان‌ترین» روی چیزی که نمی‌شود خرید، همان تناقضی است که یک بار در
  // `AggregateOffer` پیش آمد.
  const cheapest = rows
    .filter((row) => isBuyOpen(row) && priceToman(row, HOME_INSTRUMENT) !== null)
    .sort(compareByPrice(HOME_INSTRUMENT))[0];

  return rows
    .map((row) => ({
      slug: row.platform.slug,
      name: row.platform.name_fa,
      priceToman: priceToman(row, HOME_INSTRUMENT),
      buyFeePercent: buyFeePercent(row),
      sellFeePercent: sellFeePercent(row),
      updatedAt: row.updatedAt,
      isOrderBook: row.platform.market_model === "ORDER_BOOK",
      isCheapest: row.platform.slug === cheapest?.platform.slug,
      terms: row.snapshot?.terms ?? null,
    }))
    .sort((a, b) => (a.priceToman ?? LAST) - (b.priceToman ?? LAST));
}

/* ------------------------------------------------------------------ بلاگ */

/**
 * چکیده‌ی نمایشی پست — نخستین پاراگرافِ متنیِ بدنه‌ی مارک‌داون، بدون نشانه‌های
 * نحوی. هیچ متنی ساخته نمی‌شود؛ فقط برش همان بدنه است.
 */
export function postExcerpt(bodyMd: string, maxChars = 130): string {
  const paragraph =
    bodyMd
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .find((block) => block !== "" && !block.startsWith("#") && !block.startsWith("-")) ??
    "";
  const plain = paragraph
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length <= maxChars ? plain : `${plain.slice(0, maxChars).trimEnd()}…`;
}

/** تازه‌ترین پست‌ها برای ستون کناری — `posts` از قبل نو به کهنه مرتب است. */
export function sidebarPosts(posts: PublishedPost[]): PublishedPost[] {
  return posts.slice(0, 4);
}

/**
 * کارت‌های انتهای صفحه — پرخواننده‌ترین‌ها، وقتی داده‌ای هست.
 *
 * `byPopularity` تا وقتی هیچ پستی بازدید ثبت‌شده ندارد ترتیب ورودی (تاریخ)
 * را دست‌نخورده برمی‌گرداند، پس روز اول هیچ ادعای جعلی «پرخواننده» گفته
 * نمی‌شود و عدد بازدید هم هرگز نمایش داده نمی‌شود — فقط ترتیب.
 */
export function bottomPosts(posts: PublishedPost[], counts: ViewCounts = {}): PublishedPost[] {
  return byPopularity(posts, counts).slice(0, 3);
}
