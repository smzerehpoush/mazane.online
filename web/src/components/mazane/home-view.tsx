/**
 * نمای صفحه‌ی اصلی — ترجمه‌ی موجودیت‌های دامنه به چیزی که اجزا رندر می‌کنند.
 *
 * ⚠️ قاعده‌ی ۱ قراردادها اینجا هم برقرار است: **هیچ فرمول قیمتی نیست.** هر
 * عددی که از این ماژول بیرون می‌رود، عددی است که گردآورنده از قبل حساب و
 * ذخیره کرده؛ اینجا فقط **انتخاب** (با کمک‌کارهای `lib/rows.ts`) و
 * **مرتب‌سازی** انجام می‌شود.
 *
 * ⚠️ قاعده‌ی ۴: هیچ میانگین بین‌سکویی ساخته نمی‌شود. «بهترین خرید» و
 * «بهترین فروش» کمینه/بیشینه‌گیری‌اند، نه میانگین — و هر عدد با نام سکوی
 * صاحبش منتشر می‌شود.
 *
 * ⚠️ بند ۶.۴: هیچ‌کدام از این توابع فیلدهای معرف سکو را نمی‌خوانند؛
 * مرتب‌سازی فقط از قیمت گردآورنده می‌آید.
 */
import type { PublishedPost } from "@/lib/blog";
import type { PlatformHistory } from "@/lib/history";
import type { PlatformTerms } from "@/lib/prices";
import {
  displayPriceToman,
  displaySellPriceToman,
  effectiveBuyFor,
  effectiveSellFor,
  hasUnknownFee,
  isBuyOpen,
  isSellOpen,
  referencePriceFor,
  type Row,
} from "@/lib/rows";
import { CHART_PLATFORMS, HOME_INSTRUMENT } from "@/lib/site-content";

/* ---------------------------------------------------------------- نمودار */

/** وضعیت نمایشی یک سکو در چیپ‌ها و نمودار. */
export type ChartPlatformState =
  /** قیمت مؤثر دارد — خط پررنگ. */
  | "effective"
  /** فقط قیمت اسمی دارد (کارمزد نامعلوم) — برچسب «اسمی». */
  | "nominal"
  /** هنوز هیچ داده‌ای از این سکو نداریم — محو، با برچسب «به‌زودی». */
  | "coming-soon";

export interface ChartPlatformView {
  slug: string;
  name: string;
  color: string;
  /** قیمت مرجع همان سکو (عدد آماده‌ی گردآورنده) — null یعنی هنوز داده‌ای نیست. */
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
 * پنج سکوی ثابت نمودار (تصمیم مالک) + سری ۲۴ ساعته‌شان.
 *
 * آخرین عدد هر سکو از **اسنپ‌شات جاری** می‌آید (قیمت مرجع همان سکو) و اگر
 * اسنپ‌شات نبود، از آخرین نقطه‌ی تاریخچه — هر دو انتخاب‌اند، نه محاسبه.
 * سکوی بی‌هیچ داده (مثلاً سکویی که تازه باز شده) صفحه را نمی‌شکند: محو
 * می‌ماند با برچسب «به‌زودی».
 */
export function chartView(rows: Row[], history: PlatformHistory[]): ChartView {
  const rowBySlug = new Map(rows.map((row) => [row.platform.slug, row]));
  const historyBySlug = new Map(history.map((entry) => [entry.platform_slug, entry]));

  const platforms: ChartPlatformView[] = CHART_PLATFORMS.map((config) => {
    const row = rowBySlug.get(config.slug) ?? null;
    const entry = historyBySlug.get(config.slug) ?? null;
    const latestToman =
      (row === null ? null : referencePriceFor(row, HOME_INSTRUMENT)) ??
      entry?.latest ??
      null;
    const hasSeries = (entry?.points.length ?? 0) > 0;
    const state: ChartPlatformState =
      latestToman === null && !hasSeries
        ? "coming-soon"
        : row !== null && hasUnknownFee(row)
          ? "nominal"
          : "effective";
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
  /** قیمت مؤثر خرید؛ برای سکوی با کارمزد نامعلوم همان تک‌عدد اسمی‌اش. */
  buyToman: number | null;
  /** قیمت مؤثر فروش؛ برای سکوی با کارمزد نامعلوم همان تک‌عدد اسمی‌اش. */
  sellToman: number | null;
  updatedAt: string | null;
  /** داریک: قیمتش از دفتر سفارش کاربران می‌آید، نه قیمت‌گذاری فروشنده (بند ۹.۲). */
  isOrderBook: boolean;
  /** برنده‌ی کارت «بهترین خرید» — همان ردیف نشان «ارزان‌ترین» می‌گیرد. */
  isBestBuy: boolean;
  /**
   * شرایط تجاری همان سکو — فقط برای نشان‌های «خرید/فروش بسته است» (بند ۹.۲،
   * بند ۱۳ تصمیم ۱۹: وضعیت باز/بسته مزیت رقابتی صریح این تک‌صفحه است).
   * منبع قطع ⟸ null و هیچ نشانی ادعا نمی‌شود.
   */
  terms: PlatformTerms | null;
}

const LAST = Number.POSITIVE_INFINITY;

/**
 * همه‌ی سکوهای فهرست گردآورنده، صعودی بر اساس ستون خرید؛ ردیف بی‌قیمت
 * (منبع قطع) آخر می‌ماند ولی **حذف نمی‌شود** — قاعده‌ی ۵: کهنگی، نه خطا.
 */
export function tableView(rows: Row[], bestBuySlug: string | null): TableRowView[] {
  return rows
    .map((row) => ({
      slug: row.platform.slug,
      name: row.platform.name_fa,
      buyToman: displayPriceToman(row),
      sellToman: displaySellPriceToman(row),
      updatedAt: row.updatedAt,
      isOrderBook: row.platform.market_model === "ORDER_BOOK",
      isBestBuy: row.platform.slug === bestBuySlug,
      terms: row.snapshot?.terms ?? null,
    }))
    .sort((a, b) => (a.buyToman ?? LAST) - (b.buyToman ?? LAST));
}

/* ------------------------------------------------------------- کارت‌ها */

export interface BestView {
  slug: string;
  name: string;
  priceToman: number;
}

export interface BestPair {
  buy: BestView | null;
  sell: BestView | null;
}

/**
 * «بهترین خرید» = کمترین **قیمت مؤثر** خرید، «بهترین فروش» = بیشترین قیمت
 * مؤثر فروش. هر دو انتخاب‌اند، نه میانگین (قاعده‌ی ۴)، و همیشه با نام سکو.
 *
 * سکوی با کارمزد نامعلوم عمداً نامزد نمی‌شود: تنها عددش اسمی است و با
 * قیمت‌های مؤثر هم‌مقایسه نیست — «بهترین» خواندنش یعنی جعل مقایسه.
 * سکویی که همان سمت معامله‌اش بسته است هم نامزد نمی‌شود.
 */
export function bestView(rows: Row[]): BestPair {
  let buy: BestView | null = null;
  let sell: BestView | null = null;
  for (const row of rows) {
    if (row.snapshot === null || hasUnknownFee(row)) continue;
    const buyToman = effectiveBuyFor(row, HOME_INSTRUMENT);
    if (buyToman !== null && isBuyOpen(row) && (buy === null || buyToman < buy.priceToman)) {
      buy = { slug: row.platform.slug, name: row.platform.name_fa, priceToman: buyToman };
    }
    const sellToman = effectiveSellFor(row, HOME_INSTRUMENT);
    if (
      sellToman !== null &&
      isSellOpen(row) &&
      (sell === null || sellToman > sell.priceToman)
    ) {
      sell = { slug: row.platform.slug, name: row.platform.name_fa, priceToman: sellToman };
    }
  }
  return { buy, sell };
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

/** کارت‌های انتهای صفحه. شمارنده‌ی بازدید نداریم ⟸ ترتیب تاریخ، بدون عدد جعلی. */
export function bottomPosts(posts: PublishedPost[]): PublishedPost[] {
  return posts.slice(0, 3);
}
