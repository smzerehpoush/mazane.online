import { formatFaNumber } from "./fa-number";
import type { HistoryRange } from "./history";
import { TOOLS, TOOLS_HUB_PATH } from "./tools";

/**
 * ⚠️ `title` is the single source for the site's title tag; `__root.tsx`
 * imports it rather than keeping its own literal, so the site-wide default
 * and the home page's own title can never drift apart again.
 */
export const brand = {
  name: "تابلو",
  title: "تابلو — مقایسه‌ی قیمت اعلامی طلا",
  description:
    "تابلو قیمت لحظه‌ای طلا و سکه را کنار هم می‌گذارد؛ اختلاف قیمت، حباب، کارمزد و تازگی داده‌ها را یک‌جا نشان می‌دهد.",
} as const;

export const nav = [
  { label: "ابزارها", href: TOOLS_HUB_PATH },
  { label: "طلای ۱۸ عیار", href: "/tala-18" },
  { label: "قیمت سکه", href: "/sekeh" },
  { label: "بلاگ", href: "/blog" },
  { label: "مظنه چیست", href: "/mazane-chist" },
] as const;

/**
 * ⚠️ The skip-link and the `<main>` it targets are two different files
 * (`SiteHeader.tsx` and `PageShell.tsx`/`HomePage.tsx`). They only stay wired
 * together because both read this id from here; a hardcoded copy on either
 * side turns the skip-link into a link to nowhere, and nothing but a manual
 * keyboard test would catch it.
 */
export const MAIN_LANDMARK_ID = "main-content";

export const skipToContentLabel = "رفتن به محتوای اصلی";

export const footerLinks = [
  { label: "درباره تابلو", href: "/about" },
  { label: "روش محاسبه قیمت‌ها", href: "/methodology" },
] as const;

export const hero = {
  title: "قبل از خرید طلا تابلو رو چک کن",
  subtitle:
    "بابت طلای نو چقدر می‌دهید و بابت طلای دست‌دوم چقدر می‌گیرید، جزءبه‌جزء. تابلو نه طلا می‌فروشد و نه سیگنال خرید و فروش می‌دهد.",
} as const;

export interface HomeAction {
  href: string;
  title: string;
  question: string;
}

/**
 * ⚠️ The tool cards are derived from `TOOLS`, never written out here: a card
 * whose page hasn't shipped yet would be a link to a 404, and the home page
 * is the one place where nothing checks a hand-written href.
 * `kodam-saku` is deliberately left out of this list: the wizard is the whole
 * of the «از کجا بخرم؟» section right below, and a row here would render the
 * same destination twice in one viewport.
 */
export const homeActions: readonly HomeAction[] = [
  ...TOOLS.filter((tool) => tool.href !== "/kodam-saku").map((tool) => ({
    href: tool.href,
    title: tool.action,
    question: tool.question,
  })),
  {
    href: "/tala-18",
    title: "مقایسه‌ی سکوها",
    question: "نرخ اعلامی کدام سکو از همه پایین‌تر است؟",
  },
];

export const homeActionsLabel = "ابزارهای تابلو";

export const homeActionsHubLink = { href: TOOLS_HUB_PATH, label: "همه‌ی ابزارهای تابلو" } as const;

/**
 * ⚠️ Decision 2026-08-19: no comparison rows on the home page (the ef101f3
 * removal stands). The buy-path section is the wizard invitation plus a link
 * to the full table — title and body come from the `kodam-saku` entry in
 * `TOOLS` so the copy can't drift from the wizard page itself.
 */
const WIZARD_TOOL = TOOLS.find((tool) => tool.href === "/kodam-saku");

export const homeBuyPath = {
  heading: "از کجا بخرم؟",
  wizardTitle: WIZARD_TOOL?.question ?? "کدام سکو برای من؟",
  wizardBody: WIZARD_TOOL?.summary ?? "",
  wizardHref: "/kodam-saku",
  wizardCta: "شروع: سه سؤال",
  tableHref: "/tala-18",
  tableLabel: "مقایسه‌ی کامل سکوها در یک جدول",
  disclosure:
    "تابلو از لینک معرفی بعضی سکوها کمیسیون می‌گیرد؛ این کمیسیون در ترتیب نمایش سکوها اثری ندارد.",
  disclosureHref: "/about",
  disclosureLinkLabel: "توضیح کامل درآمد تابلو",
} as const;

/**
 * ⚠️ The bar's action must stay an **internal** destination. It is a second
 * showing of the same «از کجا بخرم؟» invitation, and the 2026-08-19 decision
 * that keeps `/go/` links out of the buy-path section covers this copy of it
 * too — a sponsored link that follows the reader down the page is a different
 * promise from a card that sits still.
 */
export const homePriceBar = {
  label: "نرخ مرجع هر گرم ۱۸ عیار",
  unavailable: "فعلاً در دسترس نیست",
  priceHref: "/tala-18",
  cta: homeBuyPath.heading,
  ctaHref: homeBuyPath.wizardHref,
  ariaLabel: "نرخ مرجع و مسیر خرید",
} as const;

export interface TrustItem {
  question: string;
  answer: string;
  href: string;
  linkLabel: string;
}

export const trustHeading = "منبع داده، مسئولیت محتوا و درآمد تابلو";

export const trustItems: readonly TrustItem[] = [
  {
    question: "داده از کجا می‌آید؟",
    answer:
      "نرخ مرجع از tala.ir خوانده می‌شود که خودش سکوی خرید و فروش نیست. نرخ هر سکو هم به نام خودش و با زمان ثبت همان عدد نوشته می‌شود.",
    href: "/methodology",
    linkLabel: "روش محاسبه و بروزرسانی قیمت‌ها",
  },
  {
    question: "چه کسی بررسی می‌کند؟",
    answer:
      "فعلاً هیچ بازبین مستقلی. مسئولیت فرمول‌ها و منبع‌های هر صفحه با تابلو است و تا وقتی کسی این بازبینی را نپذیرد، اسمی هم روی صفحه‌ها نوشته نمی‌شود.",
    href: "/about",
    linkLabel: "درباره تابلو",
  },
  {
    question: "تابلو چطور درآمد دارد؟",
    answer:
      "از لینک‌های معرفی. اگر از مسیر خروجی تابلو وارد سایت یک سکو شوید و آنجا ثبت‌نام یا خرید کنید، برای بخشی از سکوها کمیسیون پرداخت می‌شود. این کمیسیون در ترتیب نمایش سکوها اثری ندارد.",
    href: "/about",
    linkLabel: "توضیح کامل درآمد تابلو",
  },
];

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
 * ⚠️ Only سکه امامی gets a bubble. The ۱۳۷۰/۰۳/۱۹ cabinet decree that fixes a
 * weight and a fineness covers یک بهار آزادی alone; published نیم/ربع weights
 * disagree at the decimal with no citable decree behind any of them, and an
 * uncited mint spec is the same class of claim as the unsourced سود فروشنده
 * figure this site refuses to print. Do not add the other two from memory.
 */
export const EMAMI_COIN_WEIGHT_GRAMS = 8.13598;
export const EMAMI_COIN_FINENESS = 0.9;
export const EMAMI_COIN_PURE_GOLD_GRAMS = EMAMI_COIN_WEIGHT_GRAMS * EMAMI_COIN_FINENESS;
export const EMAMI_COIN_SPEC_CITATION =
  "تصویب‌نامه‌ی هیئت وزیران مورخ ۱۳۷۰/۰۳/۱۹، به استناد بند ۲ قانون اصلاح قانون ضرب مسکوک طلا (مصوب ۱۳۳۷)";

/**
 * ⚠️ Comes from `lib/fa-number.ts`, not `Intl.NumberFormat` — same output,
 * but no longer tied to the server/browser's ICU version.
 */
export const fa = (value: number): string => formatFaNumber(value);

export const toman = (value: number): string => `${formatFaNumber(value)} تومان`;
