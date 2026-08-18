/**
 * ⚠️ Companion gate to `sponsored-links.test.tsx`. That file guards the shape
 * of the outbound link; this one guards the **order** the links are shown in.
 * The claim on `/about` — «کمیسیون در ترتیب نمایش سکوها اثری ندارد» — is only
 * as true as this file. It is written as an invariance test: the same store is
 * assembled twice, differing in nothing but which platform carries a referral,
 * and every ordering the user can see must come out identical.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SlugPageView, type SlugPageData } from "../src/components/content/SlugPageView";
import { HomePage, type HomePageData } from "../src/components/tablo/HomePage";
import {
  buildComparisonModel,
  COMPARISON_FILTERS,
  COMPARISON_SORTS,
  type ComparisonFilter,
  type ComparisonView,
} from "../src/lib/comparison-table";
import { withoutReferral } from "../src/lib/page-data";
import { emptyProfile } from "../src/lib/platform-profile";
import type { InstrumentListing, ListedPlatform } from "../src/lib/prices";
import { compareByPrice, fetchRows, type Row } from "../src/lib/rows";
import { buildWizardResult, type WizardSearch } from "../src/lib/wizard";
import { WizardPage } from "../src/routes/kodam-saku";
import {
  homeData,
  makeListing,
  makeSnapshot,
  seed,
  slugPageData,
  type SeededStore,
} from "./support/seed";

const REFERRAL_CODE = "MZN-OWNER-CODE";
const FETCHED_AT = "2026-08-15T10:00:00.000Z";

const SLUGS = ["wallgold", "talasea", "milli"] as const;
type Slug = (typeof SLUGS)[number];

const PRICES: Readonly<Record<Slug, number>> = {
  wallgold: 18_611_000,
  talasea: 18_530_000,
  milli: 18_800_000,
};

const TALA18: InstrumentListing = makeListing({
  slug: "tala-18",
  instrument: "GOLD_18K",
  name_fa: "طلای ۱۸ عیار",
  supporting: [...SLUGS],
  published: true,
  purity: "750",
});

function listedPlatform(slug: Slug, hasReferral: boolean): ListedPlatform {
  return {
    slug,
    name_fa: slug,
    data_policy: "ALLOWED",
    website_url: `https://${slug}.example`,
    referral_url: hasReferral ? `https://${slug}.example/signup?ref=${REFERRAL_CODE}` : null,
    referral_param: hasReferral ? "ref" : null,
  };
}

/**
 * Two stores built from this function differ in exactly one thing: which
 * platforms carry a referral. Prices, fees, timestamps and names are equal.
 */
function storeWithReferralsOn(owners: readonly Slug[], prices = PRICES): SeededStore {
  return {
    listed: SLUGS.map((slug) => listedPlatform(slug, owners.includes(slug))),
    instruments: [TALA18],
    snapshots: Object.fromEntries(
      SLUGS.map((slug) => [slug, makeSnapshot({ slug, mid: prices[slug], fetchedAt: FETCHED_AT })]),
    ),
    updatedAt: Object.fromEntries(SLUGS.map((slug) => [slug, FETCHED_AT])),
  };
}

async function rowsWithReferralsOn(owners: readonly Slug[]): Promise<Row[]> {
  seed(storeWithReferralsOn(owners));
  return fetchRows();
}

function orderBy(rows: readonly Row[], compare: (a: Row, b: Row) => number): string[] {
  return [...rows].sort(compare).map((row) => row.platform.slug);
}

const byReferralFirst = (a: Row, b: Row): number =>
  Number(b.platform.referral_url != null) - Number(a.platform.referral_url != null);

/** Slugs ordered by their position on the price axis, read out of the rendered HTML. */
function axisOrder(html: string): string[] {
  const positions = [...html.matchAll(/data-rail-marker="([^"]+)"[^>]*style="right:\s*([\d.]+)%/g)];
  if (positions.length === 0) throw new Error("no axis marker in the rendered page");
  return positions
    .map((match) => ({ slug: match[1] as string, percent: Number(match[2]) }))
    .sort((a, b) => a.percent - b.percent)
    .map((entry) => entry.slug);
}

function payloadWithoutTimestamp(data: HomePageData): string {
  const { generated_at: _generatedAt, ...rest } = data;
  return JSON.stringify(rest);
}

async function renderedHome(owners: readonly Slug[], prices = PRICES): Promise<string> {
  return renderToStaticMarkup(
    <HomePage data={await homeData(storeWithReferralsOn(owners, prices))} />,
  );
}

/** Slugs in the order the comparison table prints them. */
async function tableOrder(owners: readonly Slug[], prices = PRICES): Promise<string[]> {
  seed(storeWithReferralsOn(owners, prices));
  const data = await slugPageData("tala-18");
  if (data === null) throw new Error("the tala-18 page 404'd");
  const html = renderToStaticMarkup(<SlugPageView data={data as SlugPageData} />);
  return [...html.matchAll(/data-platform="([^"]+)"/g)].map((match) => match[1] as string);
}

/**
 * ⚠️ #62 gave the table four more orderings and four filters, so the
 * invariance above stopped covering most of what a reader can actually see.
 * The store below exists to make every one of them live at once: distinct
 * buy/sell/round-trip figures, one stale platform, one with a confirmed
 * delivery note, one with a collected minimum order. The sweep further down
 * then replays all 5 sorts × all 16 filter subsets against two stores that
 * differ in nothing but who carries a referral.
 */
const SWEEP_FRESH = new Date(Date.now() - 30_000).toISOString();
const SWEEP_STALE = new Date(Date.now() - 10 * 60_000).toISOString();

const SWEEP_TERMS: Readonly<Record<Slug, { buy: string; sell: string; roundTrip: string }>> = {
  wallgold: { buy: "0.3", sell: "0.9", roundTrip: "1.2" },
  talasea: { buy: "0.7", sell: "0.2", roundTrip: "0.9" },
  milli: { buy: "0.5", sell: "0.5", roundTrip: "1.6" },
};

function sweepPlatform(slug: Slug, hasReferral: boolean): ListedPlatform {
  return {
    ...listedPlatform(slug, hasReferral),
    ...(slug === "talasea" ? { delivery_note_fa: "تحویل فیزیکی با اجرت ساخت" } : {}),
    ...(slug === "milli"
      ? {
          profile: {
            payment_methods: [],
            kyc_level: null,
            mobile_app: null,
            delivery_cost_fa: null,
            min_buy_toman: 1_000_000,
            min_sell_toman: null,
            pros_fa: [],
            cons_fa: [],
            faq: [],
          },
        }
      : {}),
  };
}

function sweepStore(owners: readonly Slug[]): SeededStore {
  const stamps: Record<Slug, string> = {
    wallgold: SWEEP_FRESH,
    talasea: SWEEP_FRESH,
    milli: SWEEP_STALE,
  };
  return {
    listed: SLUGS.map((slug) => sweepPlatform(slug, owners.includes(slug))),
    instruments: [TALA18],
    snapshots: Object.fromEntries(
      SLUGS.map((slug) => [
        slug,
        makeSnapshot({
          slug,
          mid: PRICES[slug],
          fetchedAt: stamps[slug],
          buyFee: SWEEP_TERMS[slug].buy,
          sellFee: SWEEP_TERMS[slug].sell,
          roundTrip: SWEEP_TERMS[slug].roundTrip,
        }),
      ]),
    ),
    updatedAt: Object.fromEntries(SLUGS.map((slug) => [slug, stamps[slug]])),
  };
}

async function sweepRows(owners: readonly Slug[]): Promise<Row[]> {
  seed(sweepStore(owners));
  return fetchRows();
}

function filterSubsets(): ComparisonFilter[][] {
  const subsets: ComparisonFilter[][] = [];
  for (let mask = 0; mask < 1 << COMPARISON_FILTERS.length; mask++) {
    subsets.push(COMPARISON_FILTERS.filter((_, index) => (mask & (1 << index)) !== 0));
  }
  return subsets;
}

function everyView(): ComparisonView[] {
  return COMPARISON_SORTS.flatMap((sort) =>
    filterSubsets().map((filters) => ({ sort, filters }) satisfies ComparisonView),
  );
}

function viewName(view: ComparisonView): string {
  return `${view.sort}[${view.filters.join("+")}]`;
}

function modelOrder(rows: readonly Row[], view: ComparisonView, nowMs: number): string[] {
  return buildComparisonModel({ rows, instrument: "GOLD_18K", nowMs, view }).visible.map(
    (row) => row.platform.slug,
  );
}

function keysDeep(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) keysDeep(item, found);
    return found;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      found.add(key);
      keysDeep(item, found);
    }
  }
  return found;
}

describe("platform ordering is invariant under referral ownership", () => {
  it("the price axis puts the platforms in the same order whoever carries the referral", async () => {
    const milliPays = axisOrder(await renderedHome(["milli"]));
    const talaseaPays = axisOrder(await renderedHome(["talasea"]));
    const nobodyPays = axisOrder(await renderedHome([]));
    const everybodyPays = axisOrder(await renderedHome([...SLUGS]));

    expect(milliPays).toEqual(nobodyPays);
    expect(talaseaPays).toEqual(nobodyPays);
    expect(everybodyPays).toEqual(nobodyPays);
    // ⚠️ Right = pricier, and `right` is the distance from the right edge, so
    // the smallest percentage is the most expensive platform.
    expect(nobodyPays).toEqual(["milli", "wallgold", "talasea"]);
  });

  it("the asset comparison table prints the same rows in the same order", async () => {
    const nobodyPays = await tableOrder([]);
    expect(await tableOrder(["milli"])).toEqual(nobodyPays);
    expect(await tableOrder(["talasea"])).toEqual(nobodyPays);
    expect(await tableOrder([...SLUGS])).toEqual(nobodyPays);
    expect(nobodyPays).toEqual(["talasea", "wallgold", "milli"]);
  });

  it("the table order also reacts to price, so the equality above means something", async () => {
    expect(await tableOrder(["milli"], { ...PRICES, milli: 18_000_000 })).toEqual([
      "milli",
      "talasea",
      "wallgold",
    ]);
  });

  it("the whole home payload is byte-identical whoever carries the referral", async () => {
    const milliPays = payloadWithoutTimestamp(await homeData(storeWithReferralsOn(["milli"])));
    const nobodyPays = payloadWithoutTimestamp(await homeData(storeWithReferralsOn([])));
    expect(milliPays).toBe(nobodyPays);
  });

  it("the comparison used above is not blind: a price change does move the order", async () => {
    const cheaperMilli = axisOrder(await renderedHome([], { ...PRICES, milli: 18_000_000 }));
    expect(cheaperMilli).toEqual(["wallgold", "talasea", "milli"]);
    expect(cheaperMilli).not.toEqual(axisOrder(await renderedHome([])));
  });

  /**
   * ⚠️ The control that keeps the invariance tests above from being vacuous.
   * It sorts the very same rows with a comparator that *does* read the
   * referral field and shows that this changes the order — so if the real
   * sort ever grew such an input, the equality assertions would go red rather
   * than pass by accident.
   */
  it("control: a referral-aware comparator produces a different order on the same rows", async () => {
    const milliPays = await rowsWithReferralsOn(["milli"]);
    const talaseaPays = await rowsWithReferralsOn(["talasea"]);

    expect(orderBy(milliPays, byReferralFirst)).not.toEqual(orderBy(talaseaPays, byReferralFirst));
    expect(orderBy(milliPays, compareByPrice("GOLD_18K"))).toEqual(
      orderBy(talaseaPays, compareByPrice("GOLD_18K")),
    );
  });

  it("the real comparator ranks by the quoted price alone", async () => {
    const rows = await rowsWithReferralsOn(["milli"]);
    const byPrice = [...SLUGS].sort((a, b) => PRICES[a] - PRICES[b]);
    expect(orderBy(rows, compareByPrice("GOLD_18K"))).toEqual(byPrice);
  });
});

describe("every sort and every filter of the interactive table is referral-blind (#62)", () => {
  it("all 5 sorts × all 16 filter subsets give the same rows in the same order whoever pays", async () => {
    const nowMs = Date.now();
    const nobodyPays = await sweepRows([]);
    const milliPays = await sweepRows(["milli"]);
    const talaseaPays = await sweepRows(["talasea"]);
    const everybodyPays = await sweepRows([...SLUGS]);

    const views = everyView();
    expect(views).toHaveLength(COMPARISON_SORTS.length * 16);

    for (const view of views) {
      const baseline = modelOrder(nobodyPays, view, nowMs);
      expect(modelOrder(milliPays, view, nowMs), viewName(view)).toEqual(baseline);
      expect(modelOrder(talaseaPays, view, nowMs), viewName(view)).toEqual(baseline);
      expect(modelOrder(everybodyPays, view, nowMs), viewName(view)).toEqual(baseline);
    }
  });

  /**
   * ⚠️ The control for the sweep above. Without it the equalities could pass
   * because every view happens to collapse to the same list; this shows that
   * the views really do disagree with one another, so an ordering that leaked
   * a referral would have somewhere to show up.
   */
  it("control: the sweep is not vacuous — the sorts genuinely disagree with each other", async () => {
    const nowMs = Date.now();
    const rows = await sweepRows([]);
    expect(modelOrder(rows, { sort: "price", filters: [] }, nowMs)).toEqual([
      "talasea",
      "wallgold",
      "milli",
    ]);
    expect(modelOrder(rows, { sort: "buy-fee", filters: [] }, nowMs)).toEqual([
      "wallgold",
      "milli",
      "talasea",
    ]);
    expect(modelOrder(rows, { sort: "sell-fee", filters: [] }, nowMs)).toEqual([
      "talasea",
      "milli",
      "wallgold",
    ]);
    expect(modelOrder(rows, { sort: "min-order", filters: [] }, nowMs)).toEqual([
      "milli",
      "talasea",
      "wallgold",
    ]);
    expect(modelOrder(rows, { sort: "price", filters: ["fresh"] }, nowMs)).toEqual([
      "talasea",
      "wallgold",
    ]);
    expect(modelOrder(rows, { sort: "price", filters: ["delivery"] }, nowMs)).toEqual(["talasea"]);
  });

  /**
   * ⚠️ A referral-aware sort would not have to be a new comparator: reordering
   * the *rows handed in* would be enough if the model were unstable. It is
   * not — the tie-break chain ends at the slug — so shuffling the input by
   * who pays changes nothing.
   */
  it("shuffling the input rows by referral ownership does not move the output", async () => {
    const nowMs = Date.now();
    const rows = await sweepRows(["milli"]);
    const referralFirst = [...rows].sort(byReferralFirst);
    const referralLast = [...rows].sort((a, b) => -byReferralFirst(a, b));
    for (const view of everyView()) {
      expect(modelOrder(referralFirst, view, nowMs), viewName(view)).toEqual(
        modelOrder(referralLast, view, nowMs),
      );
    }
  });

  it("the rendered table is identical for every view whoever carries the referral", async () => {
    for (const view of [
      { sort: "buy-fee", filters: [] },
      { sort: "round-trip", filters: ["fresh"] },
      { sort: "min-order", filters: ["declared-fee", "delivery"] },
    ] satisfies ComparisonView[]) {
      const rendered = async (owners: readonly Slug[]): Promise<string[]> => {
        seed(sweepStore(owners));
        const data = await slugPageData("tala-18");
        if (data === null) throw new Error("the tala-18 page 404'd");
        const html = renderToStaticMarkup(<SlugPageView data={data as SlugPageData} view={view} />);
        expect(html).not.toContain(REFERRAL_CODE);
        return [...html.matchAll(/data-platform="([^"]+)"/g)].map((match) => match[1] as string);
      };
      const baseline = await rendered([]);
      expect(await rendered(["milli"]), viewName(view)).toEqual(baseline);
      expect(await rendered([...SLUGS]), viewName(view)).toEqual(baseline);
    }
  });
});

/**
 * ⚠️ #63 put a component on the site that answers «کدام سکو؟» with a platform
 * name, which is the strongest possible form of a ranking. The sweep below is
 * the same technique as the one above, applied to the wizard: every answer a
 * visitor can give, replayed against four stores that differ in nothing but
 * who carries a referral, compared as the **whole serialized result** — the
 * winner, the runners-up, the numbers and every honesty note — not just the
 * leading slug. Sabotaging `buildWizardResult` with a referral-aware
 * tie-break turns this red (verified by doing it).
 */
const WIZARD_AMOUNTS = [500_000, 1_000_000, 50_000_000] as const;

function everyAnswer(): WizardSearch[] {
  return WIZARD_AMOUNTS.flatMap((amount) =>
    (["yes", "no"] as const).flatMap((delivery) =>
      (["yes", "no"] as const).map((resale) => ({ amount, delivery, resale })),
    ),
  );
}

function answerName(search: WizardSearch): string {
  return `${search.amount}/${search.delivery}/${search.resale}`;
}

function wizardOf(rows: readonly Row[], search: WizardSearch, nowMs: number): string {
  return JSON.stringify(
    buildWizardResult({ rows, instrument: "GOLD_18K", nowMs, search, tablePath: "/tala-18" }),
  );
}

function wizardLeader(rows: readonly Row[], search: WizardSearch, nowMs: number): string | null {
  const result = buildWizardResult({
    rows,
    instrument: "GOLD_18K",
    nowMs,
    search,
    tablePath: "/tala-18",
  });
  if (result.kind !== "answered" || result.outcome.kind !== "match") return null;
  return result.outcome.leaders[0]?.slug ?? null;
}

describe("the «کدام سکو؟» wizard recommends the same platform whoever pays us (#63)", () => {
  it("all 12 answer combinations produce byte-identical results under four referral layouts", async () => {
    const nowMs = Date.now();
    const nobodyPays = await sweepRows([]);
    const milliPays = await sweepRows(["milli"]);
    const talaseaPays = await sweepRows(["talasea"]);
    const everybodyPays = await sweepRows([...SLUGS]);

    const answers = everyAnswer();
    expect(answers).toHaveLength(12);

    for (const search of answers) {
      const baseline = wizardOf(nobodyPays, search, nowMs);
      expect(wizardOf(milliPays, search, nowMs), answerName(search)).toBe(baseline);
      expect(wizardOf(talaseaPays, search, nowMs), answerName(search)).toBe(baseline);
      expect(wizardOf(everybodyPays, search, nowMs), answerName(search)).toBe(baseline);
    }
  });

  /**
   * ⚠️ The control for the sweep. It shows two things at once: the answers
   * really do disagree with each other (so the equalities above are not
   * vacuous), and a referral-aware pick on the very same rows would name a
   * different platform — which is the failure mode the sweep exists to catch.
   */
  it("control: the answers disagree, and a referral-aware pick would name someone else", async () => {
    const nowMs = Date.now();
    const rows = await sweepRows(["milli"]);

    expect(wizardLeader(rows, { amount: 50_000_000, delivery: "no", resale: "yes" }, nowMs)).toBe(
      "talasea",
    );
    expect(wizardLeader(rows, { amount: 50_000_000, delivery: "no", resale: "no" }, nowMs)).toBe(
      "wallgold",
    );
    expect(wizardLeader(rows, { amount: 50_000_000, delivery: "yes", resale: "no" }, nowMs)).toBe(
      "talasea",
    );
    expect(wizardLeader(rows, { amount: 500_000, delivery: "no", resale: "no" }, nowMs)).toBe(
      "wallgold",
    );

    const paidFirst = [...rows].sort(byReferralFirst)[0]?.platform.slug;
    expect(paidFirst).toBe("milli");
    expect(paidFirst).not.toBe(
      wizardLeader(rows, { amount: 50_000_000, delivery: "no", resale: "no" }, nowMs),
    );
  });

  it("shuffling the input rows by who pays does not move a single answer", async () => {
    const nowMs = Date.now();
    const rows = await sweepRows(["milli"]);
    const referralFirst = [...rows].sort(byReferralFirst);
    const referralLast = [...rows].sort((a, b) => -byReferralFirst(a, b));
    for (const search of everyAnswer()) {
      expect(wizardOf(referralFirst, search, nowMs), answerName(search)).toBe(
        wizardOf(referralLast, search, nowMs),
      );
    }
  });

  it("the rendered wizard page is identical too, and never carries the referral code", async () => {
    const generatedAt = new Date().toISOString();
    const rendered = async (owners: readonly Slug[], search: WizardSearch): Promise<string> => {
      const html = renderToStaticMarkup(
        <WizardPage
          data={{ listing: TALA18, rows: await sweepRows(owners), generated_at: generatedAt }}
          search={search}
        />,
      );
      expect(html).not.toContain(REFERRAL_CODE);
      return html;
    };
    for (const search of [
      { amount: 50_000_000, delivery: "no", resale: "yes" },
      { amount: 50_000_000, delivery: "yes", resale: "no" },
      { amount: 500_000, delivery: "no", resale: "no" },
    ] satisfies WizardSearch[]) {
      const baseline = await rendered([], search);
      expect(await rendered(["milli"], search), answerName(search)).toBe(baseline);
      expect(await rendered([...SLUGS], search), answerName(search)).toBe(baseline);
    }
  });
});

/**
 * ⚠️ The fixtures above give every platform a distinct number in every column,
 * so they only ever exercise the **first** comparison in `compareByMetric` and
 * the first branch of the wizard. That is not the live payload: on `/tala-18`
 * all thirteen platforms publish the identical `round_trip_percent`, so the
 * production path is the tail — the price tie-break, then the slug tie-break,
 * then the wizard's all-tie refusal. A referral preference planted anywhere in
 * that tail used to pass the whole suite. This store is the tail: every number
 * identical, differing only in who pays us.
 *
 * ⚠️ The input order below is deliberately **not** the slug order. The slug
 * tie-break has to actually reorder these rows, so replacing it with `return 0`
 * (V8's sort is stable, so the input order would survive) turns this red.
 */
const FLAT_SLUGS = ["zeta", "alpha", "mid"] as const;
type FlatSlug = (typeof FLAT_SLUGS)[number];
const FLAT_BY_SLUG: readonly string[] = ["alpha", "mid", "zeta"];

const FLAT_PRICE = 18_500_000;
const FLAT_FEE = { buy: "0.5", sell: "0.5", roundTrip: "0.995" } as const;

const FLAT_LISTING: InstrumentListing = makeListing({
  slug: "tala-18",
  instrument: "GOLD_18K",
  name_fa: "طلای ۱۸ عیار",
  supporting: [...FLAT_SLUGS],
  published: true,
  purity: "750",
});

interface FlatOptions {
  prices?: Partial<Record<FlatSlug, number>>;
  roundTrip?: Partial<Record<FlatSlug, string>>;
  minimums?: Partial<Record<FlatSlug, number>>;
  unpriced?: readonly FlatSlug[];
}

function flatPlatform(slug: FlatSlug, hasReferral: boolean, options: FlatOptions): ListedPlatform {
  const minimum = options.minimums?.[slug];
  return {
    slug,
    name_fa: slug,
    data_policy: "ALLOWED",
    website_url: `https://${slug}.example`,
    delivery_note_fa: "تحویل فیزیکی با هماهنگی قبلی",
    referral_url: hasReferral ? `https://${slug}.example/signup?ref=${REFERRAL_CODE}` : null,
    referral_param: hasReferral ? "ref" : null,
    ...(minimum === undefined ? {} : { profile: { ...emptyProfile(), min_buy_toman: minimum } }),
  };
}

function flatStore(owners: readonly FlatSlug[], options: FlatOptions = {}): SeededStore {
  const snapshots: SeededStore["snapshots"] = {};
  for (const slug of FLAT_SLUGS) {
    snapshots[slug] = (options.unpriced ?? []).includes(slug)
      ? null
      : makeSnapshot({
          slug,
          mid: options.prices?.[slug] ?? FLAT_PRICE,
          fetchedAt: FETCHED_AT,
          buyFee: FLAT_FEE.buy,
          sellFee: FLAT_FEE.sell,
          roundTrip: options.roundTrip?.[slug] ?? FLAT_FEE.roundTrip,
        });
  }
  return {
    listed: FLAT_SLUGS.map((slug) => flatPlatform(slug, owners.includes(slug), options)),
    instruments: [FLAT_LISTING],
    snapshots,
    updatedAt: Object.fromEntries(FLAT_SLUGS.map((slug) => [slug, FETCHED_AT])),
  };
}

async function flatRows(owners: readonly FlatSlug[], options: FlatOptions = {}): Promise<Row[]> {
  seed(flatStore(owners, options));
  return fetchRows();
}

const FLAT_LAYOUTS: readonly (readonly FlatSlug[])[] = [
  [],
  ["zeta"],
  ["alpha"],
  ["mid"],
  [...FLAT_SLUGS],
];

function layoutName(owners: readonly FlatSlug[]): string {
  return owners.length === 0 ? "nobody pays" : `${owners.join("+")} pays`;
}

describe("the tie-break tail is referral-blind too — the branch the live payload hits", () => {
  it("with every declared number and every price identical, the order is the slug order for every payer", async () => {
    const nowMs = Date.now();
    for (const view of everyView()) {
      for (const owners of FLAT_LAYOUTS) {
        const order = modelOrder(await flatRows(owners), view, nowMs);
        expect(order, `${viewName(view)} / ${layoutName(owners)}`).toEqual(FLAT_BY_SLUG);
      }
    }
    // The seeded order is not the slug order, so the tie-break really did work.
    expect([...FLAT_SLUGS]).not.toEqual(FLAT_BY_SLUG);
  });

  it("with the fees identical but the prices apart, the price tie-break decides and the payer never does", async () => {
    const nowMs = Date.now();
    const prices = { zeta: 18_400_000, alpha: 18_600_000, mid: 18_500_000 } as const;
    for (const view of everyView()) {
      for (const owners of FLAT_LAYOUTS) {
        const order = modelOrder(await flatRows(owners, { prices }), view, nowMs);
        expect(order, `${viewName(view)} / ${layoutName(owners)}`).toEqual([
          "zeta",
          "mid",
          "alpha",
        ]);
      }
    }
  });

  it("the unpriced block is ordered by slug as well, not by who pays", async () => {
    const nowMs = Date.now();
    for (const owners of FLAT_LAYOUTS) {
      const model = buildComparisonModel({
        rows: await flatRows(owners, { unpriced: [...FLAT_SLUGS] }),
        instrument: "GOLD_18K",
        nowMs,
        view: { sort: "price", filters: [] },
      });
      expect(model.visible).toEqual([]);
      expect(
        model.unpriced.map((row) => row.platform.slug),
        layoutName(owners),
      ).toEqual(FLAT_BY_SLUG);
    }
  });

  it("the whole wizard result is byte-identical when the only difference is who pays", async () => {
    const nowMs = Date.now();
    for (const search of everyAnswer()) {
      const baseline = wizardOf(await flatRows([]), search, nowMs);
      for (const owners of FLAT_LAYOUTS) {
        expect(wizardOf(await flatRows(owners), search, nowMs), layoutName(owners)).toBe(baseline);
      }
      // Every platform declared the same number, so the honest answer is that
      // this criterion separates nobody — never a winner picked by a tie-break.
      expect(baseline, answerName(search)).toContain("هیچ‌کدام را جلوی بقیه نمی‌گذاریم");
    }
  });

  /**
   * ⚠️ The all-tie case above ends in a refusal, so it cannot prove the order
   * *inside* a recommendation is blind. Here two platforms share the winning
   * number and a third is worse, which is the shape that produces a `match`
   * with more than one leader — the one place a referral preference would put
   * the paying platform's name and `/go/` button first.
   */
  it("the order inside a shared lead is the slug order, whoever pays", async () => {
    const nowMs = Date.now();
    const roundTrip = { zeta: "0.9", alpha: "0.9", mid: "1.5" } as const;
    const search: WizardSearch = { amount: 50_000_000, delivery: "no", resale: "yes" };
    const baseline = wizardOf(await flatRows([], { roundTrip }), search, nowMs);
    for (const owners of FLAT_LAYOUTS) {
      expect(
        wizardOf(await flatRows(owners, { roundTrip }), search, nowMs),
        layoutName(owners),
      ).toBe(baseline);
    }
    const result = buildWizardResult({
      rows: await flatRows(["zeta"], { roundTrip }),
      instrument: "GOLD_18K",
      nowMs,
      search,
      tablePath: "/tala-18",
    });
    if (result.kind !== "answered" || result.outcome.kind !== "match") {
      throw new Error("the shared-lead fixture stopped producing a recommendation");
    }
    expect(result.outcome.leaders.map((candidate) => candidate.slug)).toEqual(["alpha", "zeta"]);
  });

  /**
   * ⚠️ `min_buy_toman` is the one hand-typed profile field that #62/#63 turned
   * into an ordering input and a wizard exclusion, so an operator with admin
   * access is now a second way to move the table. It is covered here alongside
   * the referral fields for exactly that reason — see the ⚠️ at the top of
   * `lib/platform-profile.ts`.
   */
  it("the hand-typed minimum orders the table the same way whoever carries the referral", async () => {
    const nowMs = Date.now();
    const minimums = { zeta: 1_000_000, alpha: 5_000_000, mid: 2_000_000 } as const;
    const view: ComparisonView = { sort: "min-order", filters: [] };
    for (const owners of FLAT_LAYOUTS) {
      expect(
        modelOrder(await flatRows(owners, { minimums }), view, nowMs),
        layoutName(owners),
      ).toEqual(["zeta", "mid", "alpha"]);
    }
    const search: WizardSearch = { amount: 3_000_000, delivery: "no", resale: "no" };
    const baseline = wizardOf(await flatRows([], { minimums }), search, nowMs);
    for (const owners of FLAT_LAYOUTS) {
      expect(
        wizardOf(await flatRows(owners, { minimums }), search, nowMs),
        layoutName(owners),
      ).toBe(baseline);
    }
    expect(baseline).toContain("حداقل خرید اعلامی‌شان از مبلغ شما بیشتر است");
  });
});

describe("referral fields are stripped before serialization", () => {
  it("withoutReferral removes both fields and keeps every other one", () => {
    const platform = listedPlatform("milli", true);
    const stripped = withoutReferral(platform);
    expect(stripped).not.toHaveProperty("referral_url");
    expect(stripped).not.toHaveProperty("referral_param");
    expect(stripped).toEqual({
      slug: "milli",
      name_fa: "milli",
      data_policy: "ALLOWED",
      website_url: "https://milli.example",
    });
  });

  it("no key anywhere in the home payload is referral-related", async () => {
    const data = await homeData(storeWithReferralsOn([...SLUGS]));
    const referralKeys = [...keysDeep(data)].filter((key) => /referral/i.test(key));
    expect(referralKeys).toEqual([]);
    expect(JSON.stringify(data)).not.toContain(REFERRAL_CODE);
  });

  it("the key scan is sensitive: the unstripped platform does carry those keys", () => {
    const referralKeys = [...keysDeep(listedPlatform("milli", true))].filter((key) =>
      /referral/i.test(key),
    );
    expect(referralKeys.sort()).toEqual(["referral_param", "referral_url"]);
  });
});
