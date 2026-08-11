/**
 * نمای صفحه‌ی اصلی — داشبورد قیمت طلا (`docs/design-spec.md`).
 *
 * **بدون هیچ وابستگی به روتر**: مرز تست وب «استور seed شده ⟸ خروجی رندرشده»
 * است و مسیر تنکستک را نمی‌شود بدون بستر روتر رندر کرد. پس مسیر فقط سیم‌کشی
 * می‌ماند (لودر + `useLoaderData`) و همه‌ی تصمیم‌های نمایشی اینجاست.
 *
 * ⚠️ **جدول مقایسه‌ی قیمت حذف شد** (بند ۱.۱ سند طراحی: «جدول ممنوع»). جایش را
 * محور قیمت و کارت‌های نبض‌دار گرفتند. سه پیامدی که عمداً پذیرفته شدند:
 *   - کارمزد خرید/فروش از این صفحه رفت و در صفحه‌ی سکو ماند (تصمیم ۵).
 *   - فقط منابع انتخابی پنل دیده می‌شوند، نه هر ۱۳ سکو (تصمیم ۲) — فهرست
 *     پاصفحه (`AllPlatforms`) لینک داخلی بقیه را جبران می‌کند.
 *   - ترتیب و نشان «ارزان‌ترین» رفت؛ جایش موقعیت روی محور است.
 *
 * ⚠️ قاعده‌ی سخت ۱: هیچ فرمول قیمتی اینجا نیست. همه‌چیز در `lib/dashboard.ts`
 * سمت سرور حساب و **قالب‌بندی** شده؛ این فایل رشته‌های آماده را می‌چیند.
 *
 * ⚠️ قاعده‌ی سخت ۵: قطع هر منبع ⟸ کهنگی، نه خطا. صفحه همیشه ۲۰۰ می‌ماند.
 */
import { DashboardLive } from "@/components/dashboard-live";
import { AllPlatforms } from "@/components/tablo/AllPlatforms";
import { FeaturedPost } from "@/components/tablo/FeaturedPost";
import { JewelryCalculator } from "@/components/tablo/JewelryCalculator";
import { Madde5Bar } from "@/components/tablo/LegalNotice";
import { MarketSummary } from "@/components/tablo/MarketSummary";
import { PopularPosts } from "@/components/tablo/PopularPosts";
import { PriceRail } from "@/components/tablo/PriceRail";
import { BubbleGauge, PriceAlertCard } from "@/components/tablo/SidebarCards";
import { Sidebar } from "@/components/tablo/Sidebar";
import { SiteHeader } from "@/components/tablo/SiteHeader";
import { SourceCards } from "@/components/tablo/SourceCards";
import { bottomPosts, sidebarPosts } from "@/components/tablo/home-view";
import { buildDashboard } from "@/lib/dashboard";
import type { PublishedPost } from "@/lib/blog";
import type { PlatformHistory, PlatformHistoryByRange } from "@/lib/history";
import type { Row } from "@/lib/rows";
import { useLiveDashboard } from "@/lib/use-live-dashboard";
import { hasViewData, type ViewCounts } from "@/lib/views";
import { SITE_URL } from "@/lib/site";
import { brand, legalNote, type ChartPlatformConfig } from "@/lib/site-content";
import { organizationWebSiteJsonLd } from "@/lib/structured-data";

/**
 * شکل داده‌ای که این صفحه می‌خواهد. عمداً ساختاری است (نه import از
 * `lib/home-data`) تا این ماژول هیچ ارتباطی با لایه‌ی سروری نداشته باشد.
 */
export interface HomePageData {
  rows: Row[];
  history: PlatformHistory[];
  /**
   * سه بازه‌ی تاریخچه‌ی **سکوی مرجع** — ورودی خلاصه بازار (بند ۷).
   * هر سه با هم می‌آیند تا تعویض زبانه هیچ فچ تازه‌ای نزند.
   */
  referenceHistory: PlatformHistoryByRange;
  posts: PublishedPost[];
  /**
   * شمار بازدید هر اسلاگ پست — فقط برای *ترتیب* کارت‌های انتهای صفحه، نه
   * نمایش عدد. شیء تهی یعنی ترتیب تاریخ می‌ماند و ادعای «پرخواننده» گفته
   * نمی‌شود.
   */
  viewCounts: ViewCounts;
  /** منابع نمایشی صفحه‌ی اصلی با رنگ و ترتیبشان (`chartSeriesConfig`). */
  chartPlatforms: readonly ChartPlatformConfig[];
  generated_at: string;
}

/**
 * سرصفحه‌ی صفحه‌ی اصلی — متا، canonical و داده‌ی ساخت‌یافته.
 * خانه سرِ زنجیر است ⟸ `BreadcrumbList` نمی‌گیرد (بند ۶.۵ سند معماری).
 *
 * ⚠️ **`Product`/`AggregateOffer` اینجا نیست و نباید برگردد.** «طلای ۱۸ عیار»
 * یک موجودیت است و صفحه‌ی کانونی‌اش ‎/tala-18‎ است؛ انتشار همان موجودیت روی
 * ‎/‎ کنیبالیزیشن بی‌دلیل است.
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
  // ⚠️ کل نما یک بار سمت سرور ساخته می‌شود و در HTML اولیه می‌نشیند — قیمت،
  // هندسه‌ی محور، مسیرهای SVG و رشته‌های فارسی. با جاوااسکریپت خاموش، همین
  // خروجی کامل و خواناست (بند ۱۴).
  const dashboard = buildDashboard({
    rows: data.rows,
    platforms: data.chartPlatforms,
    history: data.history,
    referenceHistory: data.referenceHistory,
  });

  // مقدار اولیه از سرور می‌آید و این هوک موقع mount هیچ فچی نمی‌زند (بند ۱۴).
  // زمان داده را می‌گیرد تا اولین فچ روی چرخه‌ی گردآورنده بنشیند نه روی لحظه‌ی
  // hydration — وگرنه فتیله و دریافت داده هرگز هم‌فاز نمی‌شوند (بند ۱۳).
  const live = useLiveDashboard(dashboard.updatedAt);

  // ⚠️ از `generated_at` سرور، نه `Date.now()`: برچسب کهنگی باید در رندر
  // سرور و در hydration یک متن بدهد (بند ۱۴، مورد ۲).
  const nowMs = Date.parse(data.generated_at);
  const reference = dashboard.rail.sources.find((source) => source.isReference) ?? null;
  // بند ۳ و ۸: «مقاله ویژه» تازه‌ترین پست است (بک‌اند پرچم ندارد — بند ۴ سند
  // شکاف‌ها) و از فهرست ستون کناری کنار می‌رود تا یک نوشته دو بار نیاید.
  const featuredPost = data.posts[0] ?? null;
  const latestPosts = sidebarPosts(featuredPost === null ? data.posts : data.posts.slice(1));
  const morePosts = bottomPosts(data.posts, data.viewCounts);
  const rankedByViews = hasViewData(data.posts, data.viewCounts);
  const hasPosts = data.posts.length > 0;

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      {/* بند ۳: گرید دوستونه با ستون فرعی ۳۶۰px. در RTL ستون اول سمت راست
          می‌نشیند، پس ترتیب DOM همان ترتیب دیداری است — و در تک‌ستونه شدن
          (≤1080px) هم ترتیب درست از آب درمی‌آید بدون هیچ `order` ای. */}
      <main className="mx-auto w-full max-w-[1340px] px-4 pt-4.5 pb-8 sm:px-[22px]">
        {/* ⚠️ بریک‌پوینت ۱۰۸۱px است و نه `lg:` تیلویند (۱۰۲۴px): بند ۳ می‌گوید
            «≤1080px تک‌ستونه»، پس در خودِ ۱۰۸۰ باید تک‌ستونه باشد. با `lg:`
            در ۱۰۸۰ دوستونه می‌ماند و ستون اصلی به ۶۶۰px می‌رسد — جایی که
            کارت‌های منبع به دو ردیف می‌شکنند. */}
        <div className="grid items-start gap-4 min-[1081px]:grid-cols-[360px_minmax(0,1fr)]">
          {/* ستون فرعی — در تک‌ستونه بعد از ستون اصلی می‌آید (بند ۳). */}
          <div className="order-2 flex flex-col gap-4 min-[1081px]:order-1">
            <BubbleGauge />
            <JewelryCalculator
              pricePerGram={reference?.priceToman ?? null}
              referenceName={dashboard.summary.referenceName}
            />
            <PriceAlertCard />
            {/* ⚠️ شرط روی `latestPosts` است نه `hasPosts`: با یک پست، آن پست
                «مقاله ویژه» می‌شود و این فهرست خالی می‌ماند — جعبه‌ی خالی
                رندر نمی‌کنیم (تصمیم مالک). */}
            {latestPosts.length > 0 && <Sidebar posts={latestPosts} />}
          </div>

          {/* ستون اصلی */}
          <div className="order-1 flex min-w-0 flex-col gap-4 min-[1081px]:order-2">
            {/* ⚠️ زمان از داده‌ی زنده مقدم است: اگر نوبت گردآورنده بلغزد،
                فاز فتیله باید دنبال داده‌ی واقعی برود نه زمان رندر سرور که
                برای همیشه ثابت می‌ماند. تا اولین دریافت، همان سرور. */}
            <PriceRail
              rail={dashboard.rail}
              updatedAt={live.data?.updated_at ?? dashboard.updatedAt}
              updatedAtDisplay={live.data?.updated_at_display ?? dashboard.updatedAtDisplay}
              tick={live.tick}
              failed={live.failed}
              onRefresh={live.refreshNow}
            />
            <MarketSummary summary={dashboard.summary} />
            <SourceCards sources={dashboard.rail.sources} nowMs={nowMs} />
            {featuredPost !== null && <FeaturedPost post={featuredPost} />}
          </div>
        </div>

        {hasPosts && (
          <div className="mt-10">
            <PopularPosts posts={morePosts} rankedByViews={rankedByViews} />
          </div>
        )}

        {/* بند ۷.۲ سند معماری: این صفحه لینک ارجاع (/go/) دارد ⟸ نوار ماده ۵. */}
        <div className="mt-8">
          <Madde5Bar />
        </div>
      </main>

      <footer className="mt-8 border-t border-border">
        <div className="mx-auto w-full max-w-[1340px] px-4 py-6 sm:px-[22px]">
          <p className="text-[11px] leading-6 text-muted-foreground">{legalNote}</p>
          {/* لینک داخلی همه‌ی سکوها — جبران حذف جدول (بند ۳). */}
          <AllPlatforms rows={data.rows} />
        </div>
      </footer>

      {/* هیچ HTML ای ندارد — فقط نشاندن داده‌ی زنده روی گره‌های موجود. */}
      <DashboardLive data={live.data} />
    </div>
  );
}
