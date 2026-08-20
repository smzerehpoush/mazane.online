import { DashboardLive } from "@/components/dashboard-live";
import { AllPlatforms } from "@/components/tablo/AllPlatforms";
import { FeaturedPost } from "@/components/tablo/FeaturedPost";
import { JewelryCalculator } from "@/components/tablo/JewelryCalculator";
import { Madde5Bar } from "@/components/tablo/LegalNotice";
import { MarketSummary } from "@/components/tablo/MarketSummary";
import { MobilePriceBar, PriceBarAnchor } from "@/components/tablo/MobilePriceBar";
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
import { OG_HOME_KEY, ogImageAlt, ogImageMeta } from "@/lib/og";
import { SITE_URL } from "@/lib/site";
import { TomanPrice } from "@/components/tablo/TomanPrice";
import { formatToman } from "@/lib/format";
import {
  brand,
  footerLinks,
  hero,
  homeActions,
  homeActionsHubLink,
  homeActionsLabel,
  homeBuyPath,
  legalNote,
  MAIN_LANDMARK_ID,
  trustHeading,
  trustItems,
  type ChartPlatformConfig,
} from "@/lib/site-content";
import { organizationWebSiteJsonLd } from "@/lib/structured-data";
import { ArrowLeftRight, Calculator, HandCoins, Scale } from "lucide-react";

/**
 * ⚠️ Keyed by href, with a fallback: `homeActions` is derived from `TOOLS`,
 * so a tool that ships tomorrow gets a row here whether or not anyone
 * remembers this map. An icon is decoration — the row's own words carry the
 * meaning — which is why every icon is `aria-hidden` and none of them is
 * allowed to be the only label.
 */
const ACTION_ICONS: Record<string, typeof Calculator> = {
  "/mohasebe-tala": Calculator,
  "/mohasebe-forush-tala": HandCoins,
  "/tabdil-mazane": ArrowLeftRight,
  "/tala-18": Scale,
};

export interface HomePageData {
  rows: Row[];
  history: PlatformHistory[];
  referenceHistory: PlatformHistoryByRange;
  reference: DashboardReference;
  posts: PublishedPost[];
  viewCounts: ViewCounts;
  chartPlatforms: readonly ChartPlatformConfig[];
  bubble: BubbleView | null;
  bubbleUpdatedAt: string | null;
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
      ...ogImageMeta({
        key: OG_HOME_KEY,
        alt: ogImageAlt("نرخ مرجع هر گرم طلای ۱۸ عیار"),
      }),
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
    <div className="safe-bottom-gap relative min-h-screen bg-background min-[1081px]:pb-0">
      <SiteHeader />

      <main
        id={MAIN_LANDMARK_ID}
        tabIndex={-1}
        className="mx-auto w-full max-w-[1340px] px-4 pt-4.5 pb-8 outline-none sm:px-[22px]"
      >
        {/*
         * ⚠️ Three grid children, not two, and the order is the mobile
         * order: heading → price → path. Below 1081px the grid is a single
         * column, so the DOM order *is* the reading order, and the price
         * card lands in the first screen instead of a screen and a half
         * down. On desktop the summary is pinned to the second column
         * across both rows, which puts the heading and the path back in one
         * uninterrupted left column — `gap-y-0` there so the spacing inside
         * that column stays the flex-column spacing it was.
         */}
        <div className="grid items-start gap-4 min-[1081px]:gap-y-0 min-[1081px]:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="flex min-w-0 flex-col">
            <h1 className="text-headline font-black tracking-[-0.4px] text-foreground sm:text-display">
              {hero.title}
            </h1>
            <p className="mt-2.5 max-w-[68ch] text-body text-muted-foreground ">{hero.subtitle}</p>

            {/*
             * ⚠️ Desktop only, and deliberately so: on one column the strip
             * would print the same number, from the same source, immediately
             * above the card that prints it big. It survives on desktop
             * because there the two sit in different columns.
             */}
            <a
              href="/tala-18"
              data-home-reference-strip
              className="transition-smooth mt-3 hidden min-h-11 flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-border bg-card px-4 py-2 text-meta text-muted-foreground hover:border-primary/40 min-[1081px]:inline-flex"
            >
              <span>نرخ مرجع هر گرم طلای ۱۸ عیار:</span>
              {data.reference.priceToman === null ? (
                <span>فعلاً در دسترس نیست</span>
              ) : (
                <TomanPrice
                  value={formatToman(data.reference.priceToman)}
                  className="num inline-flex items-baseline gap-1 font-semibold text-foreground"
                />
              )}
              <span className="text-meta">مرجع: {data.reference.name}</span>
            </a>
          </div>

          <div className="min-w-0 min-[1081px]:col-start-2 min-[1081px]:row-span-2 min-[1081px]:row-start-1">
            <MarketSummary summary={dashboard.summary} />
          </div>

          <div className="flex min-w-0 flex-col min-[1081px]:col-start-1">
            <nav
              data-home-actions
              aria-label={homeActionsLabel}
              className="mb-4 flex flex-col gap-2 sm:grid sm:grid-cols-2 min-[1081px]:mt-4"
            >
              {homeActions.map((action) => {
                const Icon = ACTION_ICONS[action.href] ?? Scale;
                return (
                  <a
                    key={action.href}
                    href={action.href}
                    data-home-action={action.href}
                    className="transition-smooth flex min-h-11 items-center gap-3 rounded-[18px] border border-border bg-card px-3.5 py-2.5 hover:border-primary/40 sm:px-4 sm:py-3"
                  >
                    <span
                      aria-hidden
                      className="grid size-9 shrink-0 place-items-center rounded-[12px] border border-border/70 bg-surface text-primary"
                    >
                      <Icon className="size-[18px]" strokeWidth={1.75} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body leading-snug font-bold text-foreground">
                        {action.question}
                      </span>
                      <span className="mt-1 text-meta leading-snug text-muted-foreground">
                        {action.title}
                      </span>
                    </span>
                    <span aria-hidden className="shrink-0 text-muted-foreground">
                      ←
                    </span>
                  </a>
                );
              })}
              <a
                href={homeActionsHubLink.href}
                data-home-actions-hub
                className="transition-smooth flex min-h-11 items-center px-4 text-body text-primary hover:underline sm:col-span-2"
              >
                {homeActionsHubLink.label} ←
              </a>
            </nav>

            <section
              data-home-buy-path
              aria-labelledby="home-buy-path-heading"
              className="mb-4 rounded-[18px] border border-gold/35 bg-gold-soft/40 px-4 py-4 sm:px-5"
            >
              <h2 id="home-buy-path-heading" className="text-title font-semibold text-foreground">
                {homeBuyPath.heading}
              </h2>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-body font-bold text-foreground">{homeBuyPath.wizardTitle}</p>
                  <p className="mt-1 max-w-[62ch] text-body text-muted-foreground">
                    {homeBuyPath.wizardBody}
                  </p>
                </div>
                <a
                  href={homeBuyPath.wizardHref}
                  data-home-wizard-cta
                  className="transition-smooth inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-primary px-5 py-2 text-body font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {homeBuyPath.wizardCta}
                </a>
              </div>
              <a
                href={homeBuyPath.tableHref}
                className="transition-smooth mt-3 inline-flex min-h-11 items-center text-body text-primary hover:underline"
              >
                {homeBuyPath.tableLabel} ←
              </a>
              <p className="mt-2 border-t border-gold/25 pt-2.5 text-meta text-muted-foreground">
                {homeBuyPath.disclosure}{" "}
                <a href={homeBuyPath.disclosureHref} className="text-primary hover:underline">
                  {homeBuyPath.disclosureLinkLabel}
                </a>
              </p>
            </section>

            <PriceBarAnchor />
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 min-[1081px]:mt-16">
          <div className="hidden sm:block">
            <PriceRail
              rail={dashboard.rail}
              updatedAt={live.data?.updated_at ?? dashboard.updatedAt}
              updatedAtDisplay={live.data?.updated_at_display ?? dashboard.updatedAtDisplay}
              tick={live.tick}
              failed={live.failed}
            />
          </div>
          <SourceCards sources={dashboard.rail.sources} nowMs={nowMs} />

          <div className="grid items-start gap-4 sm:grid-cols-2 min-[1081px]:grid-cols-3">
            <BubbleGauge
              bubble={bubble}
              updatedAt={live.data?.bubble_updated_at ?? data.bubbleUpdatedAt}
              nowMs={nowMs}
            />
            <CoinPriceCard coins={coinPrices} />
            {/*
             * ⚠️ Hidden with CSS, not a conditional render: the inputs must
             * be in the server HTML on every viewport so hydration sees one
             * DOM. Decision 2026-08-19: the inline calculator is
             * desktop-only; on mobile the «محاسبه‌ی طلای نو» row is the way in.
             */}
            <div className="hidden min-[1081px]:block">
              <JewelryCalculator
                pricePerGram={data.reference.priceToman}
                referenceName={data.reference.name}
              />
            </div>
          </div>

          <div className="grid items-start gap-4 min-[1081px]:grid-cols-2">
            {featuredPost !== null && <FeaturedPost post={featuredPost} />}
            {latestPosts.length > 0 && <Sidebar posts={latestPosts} />}
          </div>
        </div>

        {hasPosts && (
          <div className="mt-12 min-[1081px]:mt-16">
            <PopularPosts posts={morePosts} rankedByViews={rankedByViews} />
          </div>
        )}

        <section
          data-home-trust
          aria-labelledby="home-trust-heading"
          className="mt-12 min-[1081px]:mt-16"
        >
          <h2 id="home-trust-heading" className="text-title font-semibold text-foreground">
            {trustHeading}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {trustItems.map((item) => (
              <div
                key={item.question}
                className="flex flex-col rounded-[18px] border border-border bg-card p-4"
              >
                <h3 className="text-body font-bold text-foreground">{item.question}</h3>
                <p className="mt-2 text-body text-foreground/78">{item.answer}</p>
                <a
                  href={item.href}
                  className="transition-smooth mt-3 text-meta text-primary hover:underline"
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
          <p className="text-meta text-muted-foreground">{legalNote}</p>
          <nav aria-label="پیوندهای تابلو" className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {footerLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-smooth text-meta text-muted-foreground hover:text-primary"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <AllPlatforms rows={data.rows} />
        </div>
      </footer>

      <MobilePriceBar priceToman={data.reference.priceToman} referenceName={data.reference.name} />

      <DashboardLive data={live.data} />
    </div>
  );
}
