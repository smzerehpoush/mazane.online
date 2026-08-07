/**
 * محتوای ثابت سایت — برند، ناوبری، یادداشت حقوقی و قالب‌بندی کوتاه.
 *
 * اینها **داده‌ی ساختگی نیستند**: ثابت‌های واقعی سایت‌اند و ماندنی. آنچه هنوز
 * ساختگی است در `src/data/mock.ts` مانده و با داده‌ی واقعی جایگزین می‌شود.
 *
 * قاعده‌ی ۱ قراردادها اینجا هم برقرار است: هیچ فرمول قیمتی نیست، فقط قالب.
 */
import type { HistoryRange } from "./history";

export const brand = {
  name: "مظنه آنلاین",
  title: "مظنه آنلاین — مقایسه‌ی قیمت واقعی طلا",
  description:
    "مقایسه‌ی لحظه‌ای قیمت خرید و فروش طلای آب‌شده در سکوهای معتبر ایرانی؛ شفاف، بی‌طرف و بدون کارمزد پنهان.",
} as const;

/**
 * ناوبری سرصفحه. مقصدها همان مسیرهای زنده‌ی سایت‌اند (اسلاگ‌ها لاتین‌اند،
 * قراردادها بخش استک): `tala-18` اسلاگ دارایی طلای ۱۸ عیار در جدول مرکزی
 * اسلاگ گردآورنده است (`collector/src/mazane_collector/instruments.py`).
 */
export const nav = [
  { label: "طلای ۱۸ عیار", href: "/tala-18" },
  { label: "بلاگ", href: "/blog" },
  { label: "مظنه چیست", href: "/mazane-chist" },
  { label: "درباره‌ی پیشنهاد سردبیر", href: "/darbare-pishnahad" },
] as const;

export const legalNote =
  "قیمت‌ها متعلق به سکوهای نام‌برده است و هر ۳۰ ثانیه به‌روزرسانی می‌شود. مظنه آنلاین معامله‌گر یا مشاور سرمایه‌گذاری نیست.";

/** کد دارایی نمودار و جدول صفحه‌ی اصلی. */
export const HOME_INSTRUMENT = "GOLD_18K";

/** پنجره‌ی نمودار صفحه‌ی اصلی به ساعت (تصمیم مالک: ۲۴ ساعته). */
export const HOME_CHART_HOURS = 24;

/**
 * پنج سکوی ثابت نمودار (تصمیم مالک، ۲۰۲۶-۰۸-۰۶). اسلاگ‌ها همان‌هایی‌اند که
 * گردآورنده می‌شناسد (`collector/src/mazane_collector/platforms.py`) — پس
 * `slug` مستقیماً برای خواندن ردیس و `hourly_rollups` به کار می‌رود.
 *
 * `name_fa` فقط پشتیبان است: نام نمایشی درست از `mazane:listed` می‌آید.
 * `color` انتخاب طراحی است و هیچ معنایی درباره‌ی قیمت ندارد.
 */
export interface ChartPlatformConfig {
  slug: string;
  name_fa: string;
  color: string;
}

export const CHART_PLATFORMS: readonly ChartPlatformConfig[] = [
  { slug: "milli", name_fa: "میلی", color: "#1d6fe0" },
  { slug: "melligold", name_fa: "ملی‌گلد", color: "#0bb0d4" },
  { slug: "talasea", name_fa: "طلاسی", color: "#9b8ce8" },
  { slug: "tlyn", name_fa: "طلاین", color: "#12a06a" },
  { slug: "wallgold", name_fa: "وال‌گلد", color: "#e0921d" },
];

export const CHART_PLATFORM_SLUGS: readonly string[] = CHART_PLATFORMS.map(
  (platform) => platform.slug,
);

/**
 * سه بازه‌ی نوار زبانه‌ی کارت نرخ صفحه‌ی سکو (بلیت ۳۰). هفتگی/ماهانه روی
 * تجمیع ساعتی گام‌دار می‌خوانند (قاعده‌ی ۱: بدون میانگین، فقط آخرین نمونه‌ی
 * هر سطل — `lib/server/history-source.ts::resampleHourlyPoints`). `hours`
 * طول کل پنجره‌ی پرس‌وجو؛ نبودِ `stepHours` یعنی بدون نمونه‌برداری (روزانه —
 * همان رفتار بلیت ۲۷).
 */
export interface RateCardRangeConfig {
  key: HistoryRange;
  label: string;
  hours: number;
  stepHours?: number;
}

export const RATE_CARD_RANGES: readonly RateCardRangeConfig[] = [
  { key: "DAILY", label: "روزانه", hours: 24 },
  { key: "WEEKLY", label: "هفتگی", hours: 24 * 7, stepHours: 2 },
  { key: "MONTHLY", label: "ماهانه", hours: 24 * 30, stepHours: 8 },
];

/**
 * ارقام فارسی نمایش (قراردادها، بخش استک). ارقام داخل JSON-LD و URL لاتین
 * می‌مانند و از این توابع رد نمی‌شوند.
 */
const faNumber = new Intl.NumberFormat("fa-IR");

export const fa = (value: number): string => faNumber.format(value);

export const toman = (value: number): string => `${faNumber.format(value)} تومان`;
