/**
 * نمای صفحه‌ی اصلی و سرصفحه‌ی آن — **بدون هیچ وابستگی به روتر**.
 *
 * چرا اینجا و نه در `routes/index.tsx`: مرز تست وب «استور seed شده ⟸ خروجی
 * رندرشده» است، و مسیر تنکستک را نمی‌شود بدون بستر روتر رندر کرد. پس مسیر
 * فقط سیم‌کشی می‌ماند (لودر + `useLoaderData`) و همه‌ی تصمیم‌های نمایشی و
 * داده‌ی ساخت‌یافته اینجاست؛ تست همین دو تابع را با ردیف‌های seed شده صدا
 * می‌زند و هیچ‌وقت `ioredis`/`pg` را وارد گراف تست نمی‌کند.
 *
 * ⚠️ قاعده‌ی ۱ قراردادها: هیچ فرمول قیمتی اینجا نیست. همه‌ی اعداد در
 * گردآورنده حساب و ذخیره شده‌اند؛ اینجا فقط انتخاب و مرتب‌سازی است (در
 * `home-view`) و بعد قالب‌بندی.
 *
 * ⚠️ قاعده‌ی ۵: قطع هر منبع ⟸ کهنگی، نه خطا. لایه‌ی داده «داده‌ای نیست»
 * برمی‌گرداند و این صفحه همیشه ۲۰۰ می‌ماند: جدول برچسب «آخرین به‌روزرسانی»
 * می‌گیرد، نمودار پیام کهنگی، و بخش‌های بلاگ پنهان می‌شوند.
 */
import { LivePricesUpdater } from "@/components/live-prices-updater";
import { ComparisonTable } from "@/components/tablo/ComparisonTable";
import {
  bottomPosts,
  chartView,
  sidebarPosts,
  tableView,
} from "@/components/tablo/home-view";
import { Madde5Bar } from "@/components/tablo/LegalNotice";
import { PopularPosts } from "@/components/tablo/PopularPosts";
import { PriceChart } from "@/components/tablo/PriceChart";
import { PriceChips } from "@/components/tablo/PriceChips";
import { Sidebar } from "@/components/tablo/Sidebar";
import { SiteHeader } from "@/components/tablo/SiteHeader";
import type { PublishedPost } from "@/lib/blog";
import type { PlatformHistory } from "@/lib/history";
import type { Row } from "@/lib/rows";
import { hasViewData, type ViewCounts } from "@/lib/views";
import { SITE_URL } from "@/lib/site";
import { brand, legalNote, type ChartPlatformConfig } from "@/lib/site-content";
import { organizationWebSiteJsonLd } from "@/lib/structured-data";

/**
 * شکل داده‌ای که این صفحه می‌خواهد. عمداً ساختاری است (نه import از
 * `lib/home-data`) تا این ماژول هیچ ارتباطی با لایه‌ی سروری نداشته باشد؛
 * `HomeData` دقیقاً همین شکل را دارد.
 */
export interface HomePageData {
  rows: Row[];
  history: PlatformHistory[];
  posts: PublishedPost[];
  /**
   * شمار بازدید هر اسلاگ پست — فقط برای *ترتیب* کارت‌های انتهای صفحه، نه
   * نمایش عدد. اسلاگ غایب یعنی صفر. شیء تهی (منبع قطع یا هنوز بی‌داده)
   * یعنی ترتیب تاریخ می‌ماند و ادعای «پرخواننده» گفته نمی‌شود.
   */
  viewCounts: ViewCounts;
  /** سکوهای نمودار بالای صفحه با رنگ و ترتیبشان (`chartSeriesConfig`). */
  chartPlatforms: readonly ChartPlatformConfig[];
  generated_at: string;
}

/**
 * سرصفحه‌ی صفحه‌ی اصلی — متا، canonical و اسکریپت‌های داده‌ی ساخت‌یافته.
 * خانه سرِ زنجیر است ⟸ `BreadcrumbList` نمی‌گیرد (بند ۶.۵).
 *
 * ⚠️ **`Product`/`AggregateOffer` اینجا نیست و نباید برگردد.** «طلای ۱۸ عیار»
 * یک موجودیت است و صفحه‌ی کانونی‌اش ‎/tala-18‎ است؛ اگر همان موجودیت (تا سطح
 * بایت، جز `url`) روی ‎/‎ هم منتشر شود، گوگل باید بین دو نشانی یکی را انتخاب
 * کند و این کنیبالیزیشن بی‌دلیل است. بند ۶.۵ هم `Product` را «فقط صفحات
 * دارایی» می‌داند. صفحه‌ی اصلی `Organization` + `WebSite` می‌ماند.
 * `FAQPage` / `HowTo` / `SearchAction` / `AggregateRating` عمداً نیستند.
 */
export function homeHead() {
  const scripts: Array<{ type: string; children: string }> = [
    { type: "application/ld+json", children: organizationWebSiteJsonLd() },
  ];
  return {
    meta: [
      { title: brand.title },
      { name: "description", content: brand.description },
      { property: "og:title", content: brand.title },
      { property: "og:description", content: brand.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:locale", content: "fa_IR" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts,
  };
}

export function HomePage({ data }: { data: HomePageData }) {
  const chart = chartView(data.rows, data.history, data.chartPlatforms);
  const rows = tableView(data.rows);
  // زمان مرجع برچسب کهنگی. رندر سرور و hydration یکی نیستند؛ گره‌های متنی
  // مربوطه `suppressHydrationWarning` دارند و به‌روزرسان زنده تازه‌شان می‌کند.
  const nowMs = Date.now();

  const latestPosts = sidebarPosts(data.posts);
  const morePosts = bottomPosts(data.posts, data.viewCounts);
  const rankedByViews = hasViewData(data.posts, data.viewCounts);
  // تصمیم مالک: پستی نیست ⟸ هر دو بخش بلاگ کاملاً پنهان و جدول تمام‌عرض.
  const hasPosts = data.posts.length > 0;

  return (
    <div className="relative min-h-screen bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, color-mix(in oklab, var(--color-primary) 12%, transparent), transparent 70%)",
        }}
      />
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">
        <div className="min-w-0 space-y-6">
          <PriceChips platforms={chart.platforms} />
          <PriceChart
            platforms={chart.platforms}
            series={chart.series}
            domain={chart.domain}
          />
          {hasPosts ? (
            /* ستون کناری ۳۵٪ سمت راست (تصمیم مالک) — در RTL اولین ستون گرید. */
            <div className="grid gap-6 lg:grid-cols-[35fr_65fr] lg:items-start">
              <div className="min-w-0">
                <Sidebar posts={latestPosts} />
              </div>
              <div className="min-w-0">
                <ComparisonTable rows={rows} nowMs={nowMs} />
              </div>
            </div>
          ) : (
            <ComparisonTable rows={rows} nowMs={nowMs} />
          )}
        </div>

        {hasPosts && (
          <div className="mt-10 sm:mt-14">
            <PopularPosts posts={morePosts} rankedByViews={rankedByViews} />
          </div>
        )}

        {/* بند ۷.۲: این صفحه لینک ارجاع (/go/) دارد ⟸ نوار ماده ۵ الزامی است. */}
        <div className="mt-10">
          <Madde5Bar />
        </div>
      </main>

      <footer className="mt-10 border-t border-border">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 text-[11px] leading-6 text-muted-foreground sm:px-8">
          {legalNote}
        </div>
      </footer>

      {/* هیچ HTML ای ندارد — polling سی‌ثانیه‌ای بعد از hydration (بلیت ۸). */}
      <LivePricesUpdater />
    </div>
  );
}
