/**
 * محتوای ثابت سایت — برند، ناوبری، یادداشت حقوقی و قالب‌بندی کوتاه.
 *
 * اینها **داده‌ی ساختگی نیستند**: ثابت‌های واقعی سایت‌اند و ماندنی. آخرین
 * جای‌نگه‌دار ساختگی (`src/data/mock.ts`) با بازطراحی داشبورد حذف شد.
 *
 * قاعده‌ی ۱ قراردادها اینجا هم برقرار است: هیچ فرمول قیمتی نیست، فقط قالب.
 */
import { formatFaNumber } from "./fa-number";
import type { HistoryRange } from "./history";

export const brand = {
  name: "تابلو",
  title: "تابلو — مقایسه‌ی قیمت واقعی طلا",
  description:
    "مقایسه‌ی لحظه‌ای قیمت خرید و فروش طلای آب‌شده در سکوهای معتبر ایرانی؛ شفاف، بی‌طرف و بدون کارمزد پنهان.",
} as const;

/**
 * ناوبری سرصفحه. مقصدها همان مسیرهای زنده‌ی سایت‌اند (اسلاگ‌ها لاتین‌اند،
 * قراردادها بخش استک): `tala-18` اسلاگ دارایی طلای ۱۸ عیار در جدول مرکزی
 * اسلاگ گردآورنده است (`collector/src/tablo_collector/instruments.py`).
 */
export const nav = [
  { label: "طلای ۱۸ عیار", href: "/tala-18" },
  { label: "بلاگ", href: "/blog" },
  { label: "مظنه چیست", href: "/mazane-chist" },
  { label: "درباره‌ی پیشنهاد سردبیر", href: "/darbare-pishnahad" },
] as const;

export const legalNote =
  "قیمت‌ها متعلق به سکوهای نام‌برده است و هر ۳۰ ثانیه به‌روزرسانی می‌شود. تابلو معامله‌گر یا مشاور سرمایه‌گذاری نیست.";

/** کد دارایی نمودار و جدول صفحه‌ی اصلی. */
export const HOME_INSTRUMENT = "GOLD_18K";

/** پنجره‌ی نمودار صفحه‌ی اصلی به ساعت (تصمیم مالک: ۲۴ ساعته). */
export const HOME_CHART_HOURS = 24;

/**
 * پنج سکوی ثابت نمودار (تصمیم مالک، ۲۰۲۶-۰۸-۰۶). اسلاگ‌ها همان‌هایی‌اند که
 * گردآورنده می‌شناسد (`collector/src/tablo_collector/platforms.py`) — پس
 * `slug` مستقیماً برای خواندن ردیس و `hourly_rollups` به کار می‌رود.
 *
 * `name_fa` فقط پشتیبان است: نام نمایشی درست از `tablo:listed` می‌آید.
 * `color` انتخاب طراحی است و هیچ معنایی درباره‌ی قیمت ندارد.
 */
export interface ChartPlatformConfig {
  slug: string;
  name_fa: string;
  color: string;
  /**
   * سکوی مرجع — لنگر محور قیمت و صاحب اعداد خلاصه بازار (بند ۱۵، تصمیم ۱).
   *
   * ⚠️ هرگز از payload پنل نمی‌آید و همیشه در `chartSeriesConfig` نشانده
   * می‌شود؛ توضیحش آنجاست.
   */
  is_reference?: boolean;
}

/**
 * اسلاگ سکوی مرجع — **تنها جایی که این انتخاب نوشته شده**.
 *
 * ⚠️ این باید یک تنظیم پنل مدیریت باشد (تصمیم مالک، ۲۰۲۶-۰۸-۱۱: «من در
 * ادمین پنل یک قیمت را به عنوان مرجع انتخاب می‌کنم»). امروز ثابتِ کد است چون
 * `platform_settings` ستون `is_reference` ندارد و بک‌اند در این مرحله دست
 * نمی‌خورد. شکاف در `docs/api-gaps.md` ثبت شده؛ روزی که ستون آمد، فقط همین
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

/** بازه‌ی مجاز شمار سکوی نمودار (بند ۵ طراحی بلیت ۲۱). */
export const MIN_CHART_PLATFORMS = 2;
export const MAX_CHART_PLATFORMS = 6;

const CHART_COLOR_RE = /^#[0-9a-f]{6}$/i;

/** رنگ نمودار معتبر است؟ (`#rrggbb`، بی‌حساسیت به حروف بزرگ/کوچک). */
export function isValidChartColor(color: string): boolean {
  return CHART_COLOR_RE.test(color);
}

/**
 * فهرستی از پیکربندی نمودار برای رندر واقعاً معتبر است؟ شمار در بازه‌ی
 * مجاز، هر عضو اسلاگ/رنگ درست‌شکل دارد و اسلاگ‌ها یکتا هستند. خالص و
 * بی‌وابستگی — هم در `chartSeriesConfig` (فرود امن) و هم در
 * `lib/server/chart-config-source.ts` (پارس payload ردیس) استفاده می‌شود.
 */
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

/**
 * تک نقطه‌ی دسترسی به پیکربندی سری‌های نمودار — **هر دو** مصرف‌کننده
 * (ساخت نمای خط‌ها در `home-view.tsx` و ساخت پرس‌وجوی تاریخچه در
 * `page-data.ts`) فقط از اینجا می‌خوانند، نه مستقیم از ثابت کد.
 *
 * `override` پیکربندی زنده‌ای است که `page-data.ts::assembleHomeData` از
 * تنظیمات پنل (`HomeReaders.getChartPlatforms?`) می‌گیرد. فرود امن اینجاست:
 * نبودِ override یا نامعتبر بودنش (شمار خارج از بازه، رنگ بدشکل، اسلاگ
 * تکراری) ⟸ همان فهرست ثابت کد، **نه خطا** (قاعده‌ی ۵ قراردادها — تنظیمات
 * هم مثل قیمت، قطع/کهنگی یعنی برگشت به پیش‌فرض). صدا زدن بدون آرگومان
 * همیشه همان فهرست ثابت پیشین را می‌دهد.
 */
export function chartSeriesConfig(
  override?: readonly ChartPlatformConfig[],
): readonly ChartPlatformConfig[] {
  const list =
    override !== undefined && isValidChartPlatformList(override) ? override : CHART_PLATFORMS;
  return withReference(list);
}

/**
 * نشاندن پرچم سکوی مرجع روی فهرست — **هر مسیری** که به فهرست منابع نمایشی
 * برسد از همین‌جا رد می‌شود، چه پیش‌فرض کد باشد چه override پنل.
 *
 * ⚠️ چرا اینجا و نه در داده: payload پنل (`tablo:chart_config`) این فیلد را
 * ندارد. اگر پرچم را فقط روی `CHART_PLATFORMS` می‌گذاشتیم، به‌محض اینکه مالک
 * از پنل فهرست را تغییر می‌داد، سکوی مرجع بی‌سروصدا ناپدید می‌شد و محور
 * لنگرش را از دست می‌داد — دقیقاً همان نوع خرابی که فقط در تولید دیده می‌شود.
 *
 * اگر اسلاگ مرجع در فهرست نباشد (مالک آن سکو را از نمایش برداشته)، **اولین
 * عضو فهرست** مرجع می‌شود و هشدار می‌دهد — فرود امن، نه خطا (قاعده‌ی سخت ۵).
 * بند ۹ سند طراحی همین رفتار را می‌خواهد.
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

/**
 * پارس payload خام کلید ردیس `tablo:chart_config` (گردآورنده هر ~۲۰ ثانیه
 * از تنظیمات پنل می‌نویسد — `collector/src/tablo_collector/settings.py`).
 *
 * خالص و بی‌وابستگی به `ioredis` تا فرود امن («کلید نبود، JSON بدشکل، یا
 * کمتر از ۲/بیش از ۶ ورودی معتبر ⟸ `undefined`») بدون ردیس واقعی تست شود.
 * مصرف‌کننده: `lib/server/chart-config-source.ts`.
 */
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
  // ۳۱ روز (نه ۳۰) عمداً: با گام ۸ ساعته دقیقاً ۹۳ سطل می‌دهد
  // (۷۴۴/۸=۹۳) — همان عدد سند مادر، نه تقریب ماه ۳۰روزه.
  { key: "MONTHLY", label: "ماهانه", hours: 24 * 31, stepHours: 8 },
];

/**
 * منبع نوار «نرخ اتحادیه» صفحه‌ی سکو (تیکت ۳۳) — فقط طلای ۱۸ عیار؛ بند ۲۴
 * عیار گردآوری نمی‌شود. اسلاگ منبع همان چیزی است که گردآورنده در
 * `hourly_rollups`/`reference_quotes` ذخیره می‌کند (`references/talair.py`).
 * برچسب نمایشی «اتحادیه» روی این عدد تصمیم ثبت‌شده‌ی مالک است — سند
 * `docs/adr/0001-etehadieh-label-on-talair-number.md`.
 */
export const UNION_RATE_REFERENCE_SLUG = "talair";
export const UNION_RATE_INSTRUMENT = "GOLD_18K_TOMAN";

/**
 * ارقام فارسی نمایش (قراردادها، بخش استک). ارقام داخل JSON-LD و URL لاتین
 * می‌مانند و از این توابع رد نمی‌شوند.
 *
 * ⚠️ از `lib/fa-number.ts` می‌آید نه `Intl.NumberFormat` — خروجی یکسان است
 * ولی دیگر به نسخه‌ی ICU سرور/مرورگر گره نخورده (بند ۱۴ سند طراحی).
 */
export const fa = (value: number): string => formatFaNumber(value);

export const toman = (value: number): string => `${formatFaNumber(value)} تومان`;
