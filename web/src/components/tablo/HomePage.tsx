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

export interface HomePageData {
  rows: Row[];
  history: PlatformHistory[];
  referenceHistory: PlatformHistoryByRange;
  posts: PublishedPost[];
  viewCounts: ViewCounts;
  chartPlatforms: readonly ChartPlatformConfig[];
  generated_at: string;
}

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
  const dashboard = buildDashboard({
    rows: data.rows,
    platforms: data.chartPlatforms,
    history: data.history,
    referenceHistory: data.referenceHistory,
  });

  const live = useLiveDashboard(dashboard.updatedAt);

  // ⚠️ از `generated_at` سرور، نه `Date.now`: برچسب کهنگی باید در رندر سرور و
  // در hydration یک متن بدهد.
  const nowMs = Date.parse(data.generated_at);
  const reference = dashboard.rail.sources.find((source) => source.isReference) ?? null;
  const featuredPost = data.posts[0] ?? null;
  const latestPosts = sidebarPosts(featuredPost === null ? data.posts : data.posts.slice(1));
  const morePosts = bottomPosts(data.posts, data.viewCounts);
  const rankedByViews = hasViewData(data.posts, data.viewCounts);
  const hasPosts = data.posts.length > 0;

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1340px] px-4 pt-4.5 pb-8 sm:px-[22px]">
        <div className="grid items-start gap-4 min-[1081px]:grid-cols-[360px_minmax(0,1fr)]">
          <div className="order-2 flex flex-col gap-4 min-[1081px]:order-1">
            <BubbleGauge />
            <JewelryCalculator
              pricePerGram={reference?.priceToman ?? null}
              referenceName={dashboard.summary.referenceName}
            />
            <PriceAlertCard />
            {latestPosts.length > 0 && <Sidebar posts={latestPosts} />}
          </div>

          <div className="order-1 flex min-w-0 flex-col gap-4 min-[1081px]:order-2">
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

        <div className="mt-8">
          <Madde5Bar />
        </div>
      </main>

      <footer className="mt-8 border-t border-border">
        <div className="mx-auto w-full max-w-[1340px] px-4 py-6 sm:px-[22px]">
          <p className="text-[11px] leading-6 text-muted-foreground">{legalNote}</p>
          <AllPlatforms rows={data.rows} />
        </div>
      </footer>

      <DashboardLive data={live.data} />
    </div>
  );
}
