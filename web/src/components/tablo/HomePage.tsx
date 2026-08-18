import { DashboardLive } from "@/components/dashboard-live";
import { AllPlatforms } from "@/components/tablo/AllPlatforms";
import { FeaturedPost } from "@/components/tablo/FeaturedPost";
import { JewelryCalculator } from "@/components/tablo/JewelryCalculator";
import { Madde5Bar } from "@/components/tablo/LegalNotice";
import { MarketSummary } from "@/components/tablo/MarketSummary";
import { PopularPosts } from "@/components/tablo/PopularPosts";
import { PriceRail } from "@/components/tablo/PriceRail";
import { BubbleGauge, CoinPriceCard } from "@/components/tablo/SidebarCards";
import { Sidebar } from "@/components/tablo/Sidebar";
import { SiteHeader } from "@/components/tablo/SiteHeader";
import { SourceCards } from "@/components/tablo/SourceCards";
import { bottomPosts, sidebarPosts } from "@/components/tablo/home-view";
import type { BubbleView } from "@/lib/bubble";
import type { CoinPricesView } from "@/lib/coin-prices";
import { buildDashboard, type DashboardReference } from "@/lib/dashboard";
import type { PublishedPost } from "@/lib/blog";
import type { PlatformHistory, PlatformHistoryByRange } from "@/lib/history";
import type { Row } from "@/lib/rows";
import { useLiveDashboard } from "@/lib/use-live-dashboard";
import { hasViewData, type ViewCounts } from "@/lib/views";
import { SITE_URL } from "@/lib/site";
import {
  brand,
  hero,
  homeActions,
  homeActionsLabel,
  legalNote,
  MAIN_LANDMARK_ID,
  trustHeading,
  trustItems,
  type ChartPlatformConfig,
} from "@/lib/site-content";
import { organizationWebSiteJsonLd } from "@/lib/structured-data";

export interface HomePageData {
  rows: Row[];
  history: PlatformHistory[];
  referenceHistory: PlatformHistoryByRange;
  reference: DashboardReference;
  posts: PublishedPost[];
  viewCounts: ViewCounts;
  chartPlatforms: readonly ChartPlatformConfig[];
  bubble: BubbleView | null;
  coinPrices: CoinPricesView;
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
      { name: "twitter:card", content: "summary" },
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
    reference: data.reference,
  });

  const live = useLiveDashboard(dashboard.updatedAt);

  // ⚠️ From the server's `generated_at`, not `Date.now`: the staleness label
  // must produce the same text on server render and on hydration.
  const nowMs = Date.parse(data.generated_at);
  const featuredPost = data.posts[0] ?? null;
  const latestPosts = sidebarPosts(featuredPost === null ? data.posts : data.posts.slice(1));
  const morePosts = bottomPosts(data.posts, data.viewCounts);
  const rankedByViews = hasViewData(data.posts, data.viewCounts);
  const hasPosts = data.posts.length > 0;
  const bubble = live.data === null ? data.bubble : live.data.bubble;
  const coinPrices = live.data === null ? data.coinPrices : live.data.coinPrices;

  return (
    <div className="relative min-h-screen bg-background">
      <SiteHeader />

      <main
        id={MAIN_LANDMARK_ID}
        tabIndex={-1}
        className="mx-auto w-full max-w-[1340px] px-4 pt-4.5 pb-8 outline-none sm:px-[22px]"
      >
        <h1 className="text-[26px] leading-[1.35] font-black tracking-[-0.4px] text-foreground sm:text-[36px]">
          {hero.title}
        </h1>
        <p className="mt-2.5 max-w-[68ch] text-[13.5px] leading-7 text-muted-foreground sm:text-[15px] sm:leading-8">
          {hero.subtitle}
        </p>

        <nav
          data-home-actions
          aria-label={homeActionsLabel}
          className="mt-4 mb-4 grid gap-3 sm:grid-cols-3"
        >
          {homeActions.map((action) => (
            <a
              key={action.href}
              href={action.href}
              data-home-action={action.href}
              className="transition-smooth flex min-h-11 flex-col rounded-[18px] border border-border bg-surface px-4 py-3.5 hover:border-primary/40"
            >
              <span className="text-[14px] font-bold text-foreground">{action.title}</span>
              <span className="mt-1.5 text-[12.5px] leading-6 text-muted-foreground">
                {action.body}
              </span>
            </a>
          ))}
        </nav>

        <div className="grid items-start gap-4 min-[1081px]:grid-cols-[360px_minmax(0,1fr)]">
          <div className="order-2 flex flex-col gap-4 min-[1081px]:order-1">
            <BubbleGauge bubble={bubble} />
            <CoinPriceCard coins={coinPrices} />
            <JewelryCalculator
              pricePerGram={data.reference.priceToman}
              referenceName={data.reference.name}
            />
            {latestPosts.length > 0 && <Sidebar posts={latestPosts} />}
          </div>

          <div className="order-1 flex min-w-0 flex-col gap-4 min-[1081px]:order-2">
            <MarketSummary summary={dashboard.summary} />
            <PriceRail
              rail={dashboard.rail}
              updatedAt={live.data?.updated_at ?? dashboard.updatedAt}
              updatedAtDisplay={live.data?.updated_at_display ?? dashboard.updatedAtDisplay}
              tick={live.tick}
              failed={live.failed}
            />
            <SourceCards sources={dashboard.rail.sources} nowMs={nowMs} />
            {featuredPost !== null && <FeaturedPost post={featuredPost} />}
          </div>
        </div>

        {hasPosts && (
          <div className="mt-10">
            <PopularPosts posts={morePosts} rankedByViews={rankedByViews} />
          </div>
        )}

        <section data-home-trust aria-labelledby="home-trust-heading" className="mt-10">
          <h2 id="home-trust-heading" className="text-lg font-semibold text-foreground">
            {trustHeading}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {trustItems.map((item) => (
              <div
                key={item.question}
                className="flex flex-col rounded-[18px] border border-border bg-surface p-4"
              >
                <h3 className="text-[14px] font-bold text-foreground">{item.question}</h3>
                <p className="mt-2 text-[12.5px] leading-7 text-foreground/78">{item.answer}</p>
                <a
                  href={item.href}
                  className="transition-smooth mt-3 text-[12.5px] text-primary hover:underline"
                >
                  {item.linkLabel}
                </a>
              </div>
            ))}
          </div>
        </section>

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
