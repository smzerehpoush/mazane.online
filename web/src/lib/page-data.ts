/**
 * سرهم‌کردن payload صفحه‌ها — منطق خالصی که توابع سروری
 * (`home-data.ts` / `content-data.ts`) فقط سیم‌کشی‌اش می‌کنند.
 *
 * چرا جدا: بدنه‌ی `createServerFn` از داخل تست قابل فراخوانی نیست، و اگر
 * منطقش آنجا بماند تنها راه تست، **بازنویسی همان منطق در فایل تست** است —
 * یعنی تستی که نسخه‌ی دوم کد را می‌سنجد، نه کد را. پس خواننده‌های منبع
 * تزریق می‌شوند: در اجرا نسخه‌های `lib/server/*` (که منبع پیش‌فرض ردیس/پستگرس
 * را ثبت می‌کنند) و در تست همان توابع دامنه با منبع seed شده. کد یکی است.
 *
 * این فایل هیچ وابستگی نودی و هیچ وابستگی فریم‌ورکی ندارد، پس هم از گراف
 * کلاینت و هم از سرور import شدنش بی‌خطر است (قاعده‌ی سخت باندل).
 *
 * ⚠️ قاعده‌ی ۱ قراردادها: هیچ فرمول قیمتی اینجا نیست — فقط خواندن و بستن
 * payload. ⚠️ قاعده‌ی ۵: قطع منبع ⟸ ردیف بی‌اسنپ‌شات و فهرست خالی، نه خطا.
 */
import type { HomePageData } from "@/components/mazane/HomePage";
import type { SlugPageData } from "@/components/content/SlugPageView";
import type { PublishedPost } from "./blog";
import type { HistoryQuery, PlatformHistory } from "./history";
import type { InstrumentListing, ListedPlatform, PlatformSnapshot } from "./prices";
import type { Row } from "./rows";
import {
  chartSeriesConfig,
  HOME_CHART_HOURS,
  HOME_INSTRUMENT,
  type ChartPlatformConfig,
} from "./site-content";
import type { SlugResolution } from "./slugs";
import type { ViewCounts } from "./views";

/**
 * حذف نشانی معرف از payload کلاینت.
 *
 * خروجی تابع سروری داخل خودِ HTML صفحه serialize می‌شود، پس هر فیلدی که
 * اینجا بماند در source صفحه منتشر است. کلاینت هرگز به `referral_url` نیاز
 * ندارد: لینک درآمدزا همیشه به ‎/go/<slug>‎ می‌رود و مقصد واقعی فقط سمت سرور
 * حل می‌شود (تصمیم ۲۱). امروز این فیلدها null اند؛ همین حالا برداشته می‌شوند
 * تا روزی که کد معرف مالک آمد، بی‌سروصدا لو نروند.
 */
export function withoutReferral(platform: ListedPlatform): ListedPlatform {
  const { referral_url: _url, referral_param: _param, ...publicFields } = platform;
  return publicFields;
}

/* ------------------------------------------------------------ صفحه‌ی اصلی */

export interface HomeReaders {
  fetchRows(): Promise<Row[]>;
  getPlatformHistory(query: HistoryQuery): Promise<PlatformHistory[]>;
  listPublishedPosts(): Promise<PublishedPost[]>;
  /**
   * اختیاری: شمارنده‌ی بازدید. نبودش یعنی ترتیب تاریخ می‌ماند — نه خطا.
   * (فیک‌های قدیمی تست بدون این هم معتبرند.)
   */
  getViewCounts?(): Promise<ViewCounts>;
  /**
   * اختیاری: پیکربندی نمودار از تنظیمات پنل (بلیت ۲۱، `mazane:chart_config`
   * ردیس). `undefined` یا نبودِ این خواننده یعنی فهرست پیش‌فرض کد
   * (`chartSeriesConfig()` بدون آرگومان) — نه خطا؛ فرود امن در
   * `chartSeriesConfig` است.
   */
  getChartPlatforms?(): Promise<readonly ChartPlatformConfig[] | undefined>;
}

export async function assembleHomeData(read: HomeReaders): Promise<HomePageData> {
  const chartPlatforms = chartSeriesConfig(await read.getChartPlatforms?.());
  const [rows, history, posts, viewCounts] = await Promise.all([
    read.fetchRows(),
    read.getPlatformHistory({
      platformSlugs: chartPlatforms.map((platform) => platform.slug),
      instrument: HOME_INSTRUMENT,
      hours: HOME_CHART_HOURS,
    }),
    read.listPublishedPosts(),
    read.getViewCounts?.() ?? Promise.resolve<ViewCounts>({}),
  ]);
  return {
    rows: rows.map((row) => ({ ...row, platform: withoutReferral(row.platform) })),
    history,
    posts,
    viewCounts,
    chartPlatforms,
    generated_at: new Date().toISOString(),
  };
}

/* ------------------------------------------------- دارایی / سکو (اسلاگ تخت) */

export interface SlugReaders {
  resolveSlug(slug: string): Promise<SlugResolution | null>;
  fetchRowsForPlatforms(slugs: string[]): Promise<Row[]>;
  getPlatformSnapshot(platformSlug: string): Promise<PlatformSnapshot | null>;
  getUpdatedAt(platformSlug: string): Promise<string | null>;
  getInstruments(): Promise<InstrumentListing[]>;
}

/**
 * `null` یعنی ۴۰۴ (ناشناخته، رزروشده، یا دارایی با دروازه‌ی انتشار بسته؛
 * قاعده در `lib/slugs.ts`). قطع ردیس ⟸ کهنگی، نه خطا: ردیف بی‌اسنپ‌شات
 * برمی‌گردد و صفحه ۲۰۰ می‌ماند.
 */
export async function assembleSlugPage(
  slug: string,
  read: SlugReaders,
): Promise<SlugPageData | null> {
  const resolved = await read.resolveSlug(slug);
  if (resolved === null) return null;
  const generatedAt = new Date().toISOString();

  if (resolved.kind === "instrument") {
    const rows = await read.fetchRowsForPlatforms(resolved.listing.supporting_platform_slugs);
    return {
      kind: "instrument",
      listing: resolved.listing,
      rows: rows.map((row) => ({ ...row, platform: withoutReferral(row.platform) })),
      generated_at: generatedAt,
    };
  }

  const { platform } = resolved;
  const [snapshot, updatedAt, instruments] = await Promise.all([
    read.getPlatformSnapshot(platform.slug),
    read.getUpdatedAt(platform.slug),
    read.getInstruments(),
  ]);
  return {
    kind: "platform",
    platform: withoutReferral(platform),
    snapshot,
    updatedAt,
    hasOutbound: (platform.referral_url ?? platform.website_url) != null,
    instrumentNames: Object.fromEntries(instruments.map((item) => [item.instrument, item.name_fa])),
    generated_at: generatedAt,
  };
}
