/**
 * ⚠️ The sort/filter model of the /tala-18 comparison table (#62). Two things
 * this file is responsible for and nothing else covers: an undisclosed value
 * must sink under **every** sort rather than read as a cheap one, and a
 * control that cannot change the table must be offered as disabled with the
 * reason instead of silently returning an empty list. Referral neutrality of
 * the same sorts lives in `ranking-neutrality.test.tsx`.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SlugPageView, type SlugPageData } from "../src/components/content/SlugPageView";
import {
  buildComparisonModel,
  comparisonHref,
  comparisonSearchOf,
  comparisonViewFromSearch,
  COMPARISON_FILTERS,
  COMPARISON_SORTS,
  FILTER_NO_EFFECT_FA,
  FILTER_NO_PRICES_FA,
  FILTER_UNAVAILABLE_FA,
  medianRoundTrip,
  SORT_NO_PRICES_FA,
  toggledFilters,
  type ComparisonFilter,
  type ComparisonSort,
  type ComparisonView,
} from "../src/lib/comparison-table";
import { emptyProfile } from "../src/lib/platform-profile";
import type { InstrumentListing, ListedPlatform } from "../src/lib/prices";
import { fetchRows, type Row } from "../src/lib/rows";
import {
  freshIso,
  makeListing,
  makeSnapshot,
  rowOf,
  seed,
  seedHistory,
  seedReferencePrice,
  slugPageData,
  staleIso,
  type SeededStore,
} from "./support/seed";

const SLUGS = ["alfa", "beta", "gamma", "delta", "epsilon"] as const;

const TALA18: InstrumentListing = makeListing({
  slug: "tala-18",
  instrument: "GOLD_18K",
  name_fa: "طلای ۱۸ عیار",
  supporting: [...SLUGS],
  published: true,
  purity: "750",
});

const PLATFORMS: ListedPlatform[] = [
  { slug: "alfa", name_fa: "آلفا", data_policy: "ALLOWED" },
  {
    slug: "beta",
    name_fa: "بتا",
    data_policy: "ALLOWED",
    delivery_note_fa: "تحویل فیزیکی از ۵ گرم",
  },
  {
    slug: "gamma",
    name_fa: "گاما",
    data_policy: "ALLOWED",
    delivery_note_fa: "تحویل فیزیکی با اجرت ساخت",
  },
  { slug: "delta", name_fa: "دلتا", data_policy: "ALLOWED" },
  {
    slug: "epsilon",
    name_fa: "اپسیلون",
    data_policy: "ALLOWED",
    profile: { ...emptyProfile(), min_buy_toman: 500_000 },
  },
];

function comparisonStore(): SeededStore {
  const now = freshIso();
  const old = staleIso();
  return {
    listed: PLATFORMS,
    instruments: [TALA18],
    snapshots: {
      alfa: makeSnapshot({
        slug: "alfa",
        mid: 18_600_000,
        buyFee: "0.3",
        sellFee: "0.9",
        roundTrip: "1.2",
        fetchedAt: now,
      }),
      beta: makeSnapshot({
        slug: "beta",
        mid: 18_500_000,
        buyFee: "0.7",
        sellFee: "0.2",
        roundTrip: "0.9",
        fetchedAt: now,
      }),
      gamma: makeSnapshot({
        slug: "gamma",
        mid: 18_550_000,
        buyFee: "0.5",
        sellFee: "0.5",
        roundTrip: "1.0",
        fetchedAt: old,
      }),
      delta: makeSnapshot({
        slug: "delta",
        mid: 18_700_000,
        feeSource: "UNKNOWN",
        fetchedAt: now,
      }),
      epsilon: makeSnapshot({
        slug: "epsilon",
        mid: 18_450_000,
        buyFee: "0.9",
        sellFee: "0.9",
        roundTrip: "1.8",
        fetchedAt: now,
      }),
    },
    updatedAt: { alfa: now, beta: now, gamma: old, delta: now, epsilon: now },
  };
}

async function rowsOf(store: SeededStore = comparisonStore()): Promise<Row[]> {
  seed(store);
  return fetchRows();
}

function orderUnder(rows: readonly Row[], view: ComparisonView, nowMs = Date.now()): string[] {
  return buildComparisonModel({
    rows,
    instrument: "GOLD_18K",
    nowMs,
    view,
  }).visible.map((row) => row.platform.slug);
}

function sortedBy(sort: ComparisonSort): ComparisonView {
  return { sort, filters: [] };
}

function filteredBy(...filters: ComparisonFilter[]): ComparisonView {
  return { sort: "price", filters };
}

async function renderTable(view?: ComparisonView, store: SeededStore = comparisonStore()) {
  seed(store);
  seedHistory([]);
  seedReferencePrice(null);
  const data = await slugPageData("tala-18");
  if (data === null) throw new Error("the tala-18 page 404'd");
  return renderToStaticMarkup(
    <SlugPageView data={data as SlugPageData} {...(view === undefined ? {} : { view })} />,
  );
}

function rowOrder(html: string): string[] {
  return [...html.matchAll(/data-platform="([^"]+)"/g)].map((match) => match[1] as string);
}

describe("comparison table — the five sorts", () => {
  it("price is the default and stays the cheapest-first order the page already had", async () => {
    const rows = await rowsOf();
    expect(orderUnder(rows, sortedBy("price"))).toEqual([
      "epsilon",
      "beta",
      "gamma",
      "alfa",
      "delta",
    ]);
  });

  it("buy fee, sell fee and round-trip each order ascending on their own column", async () => {
    const rows = await rowsOf();
    expect(orderUnder(rows, sortedBy("buy-fee"))).toEqual([
      "alfa",
      "gamma",
      "beta",
      "epsilon",
      "delta",
    ]);
    expect(orderUnder(rows, sortedBy("round-trip"))).toEqual([
      "beta",
      "gamma",
      "alfa",
      "epsilon",
      "delta",
    ]);
  });

  it("a tie on the sorted column is broken by the quoted price, never by anything else", async () => {
    const rows = await rowsOf();
    // alfa and epsilon both charge 0.9٪ to sell; epsilon is the cheaper quote.
    expect(orderUnder(rows, sortedBy("sell-fee"))).toEqual([
      "beta",
      "gamma",
      "epsilon",
      "alfa",
      "delta",
    ]);
  });

  it("an undisclosed value sinks to the bottom under every single sort", async () => {
    const rows = await rowsOf();
    for (const sort of COMPARISON_SORTS) {
      const order = orderUnder(rows, sortedBy(sort));
      // delta published no fee at all, so it may only lead when the column
      // it is being sorted by is the price it actually quotes.
      if (sort === "price") continue;
      expect(order.at(-1), sort).toBe("delta");
    }
  });

  it("minimum order sorts the one platform that declared it above the ones we have not collected", async () => {
    const rows = await rowsOf();
    expect(orderUnder(rows, sortedBy("min-order"))).toEqual([
      "epsilon",
      "beta",
      "gamma",
      "alfa",
      "delta",
    ]);
  });

  it("the order is stable: sorting the same rows twice gives the same list", async () => {
    const rows = await rowsOf();
    for (const sort of COMPARISON_SORTS) {
      expect(orderUnder(rows, sortedBy(sort))).toEqual(
        orderUnder([...rows].reverse(), sortedBy(sort)),
      );
    }
  });
});

describe("comparison table — the four filters", () => {
  it("«داده‌ی تازه» drops the platform whose snapshot went stale", async () => {
    const rows = await rowsOf();
    expect(orderUnder(rows, filteredBy("fresh"))).not.toContain("gamma");
    expect(orderUnder(rows, filteredBy("fresh"))).toContain("beta");
  });

  it("«کارمزد اعلام‌شده» drops only the platform that published nothing", async () => {
    const rows = await rowsOf();
    expect(orderUnder(rows, filteredBy("declared-fee"))).toEqual([
      "epsilon",
      "beta",
      "gamma",
      "alfa",
    ]);
  });

  it("«تحویل فیزیکی تأییدشده» keeps only the platforms whose delivery we checked", async () => {
    const rows = await rowsOf();
    expect(orderUnder(rows, filteredBy("delivery"))).toEqual(["beta", "gamma"]);
  });

  it("«رفت‌وبرگشت میانه یا کمتر» is measured against the median of the declared round-trips", async () => {
    const rows = await rowsOf();
    // declared: 0.9، 1.0، 1.2، 1.8 ⟸ median 1.1
    expect(medianRoundTrip(rows)).toBeCloseTo(1.1, 10);
    expect(orderUnder(rows, filteredBy("cheap-round-trip"))).toEqual(["beta", "gamma"]);
  });

  it("filters compose, and the threshold does not move when another filter is added", async () => {
    const rows = await rowsOf();
    expect(orderUnder(rows, filteredBy("cheap-round-trip", "fresh"))).toEqual(["beta"]);
    expect(orderUnder(rows, filteredBy("delivery", "declared-fee"))).toEqual(["beta", "gamma"]);
  });

  it("hiddenCount counts the priced rows the filters took away", async () => {
    const rows = await rowsOf();
    const model = buildComparisonModel({
      rows,
      instrument: "GOLD_18K",
      nowMs: Date.now(),
      view: filteredBy("delivery"),
    });
    expect(model.visible).toHaveLength(2);
    expect(model.hiddenCount).toBe(3);
  });
});

describe("comparison table — a control that cannot do anything is offered as disabled", () => {
  it("the minimum-order sort is available here because one platform declared it", async () => {
    const rows = await rowsOf();
    const model = buildComparisonModel({
      rows,
      instrument: "GOLD_18K",
      nowMs: Date.now(),
      view: sortedBy("min-order"),
    });
    const control = model.sorts.find((item) => item.key === "min-order");
    expect(control?.available).toBe(true);
    expect(control?.reasonFa).toBeNull();
    expect(model.sort).toBe("min-order");
  });

  it("with every profile empty — today's real state — that sort is disabled and says why, and the view falls back to price", async () => {
    const store = comparisonStore();
    store.listed = PLATFORMS.map(({ profile: _profile, ...rest }) => rest);
    const rows = await rowsOf(store);
    const model = buildComparisonModel({
      rows,
      instrument: "GOLD_18K",
      nowMs: Date.now(),
      view: sortedBy("min-order"),
    });
    const control = model.sorts.find((item) => item.key === "min-order");
    expect(control?.available).toBe(false);
    expect(control?.reasonFa).toBe("حداقل خرید هیچ‌کدام از سکوهای این جدول را هنوز جمع نکرده‌ایم");
    expect(model.sort).toBe("price");
  });

  it("a filter nothing matches is disabled and is dropped from the applied view instead of emptying the table", async () => {
    const store = comparisonStore();
    store.listed = PLATFORMS.map(({ delivery_note_fa: _note, ...rest }) => rest);
    const rows = await rowsOf(store);
    const model = buildComparisonModel({
      rows,
      instrument: "GOLD_18K",
      nowMs: Date.now(),
      view: filteredBy("delivery"),
    });
    const control = model.filterControls.find((item) => item.key === "delivery");
    expect(control?.available).toBe(false);
    expect(control?.active).toBe(false);
    expect(control?.reasonFa).toBe(FILTER_UNAVAILABLE_FA.delivery);
    expect(control?.reasonFa).toContain("میان سکوهایی که همین حالا قیمت دارند");
    expect(model.filters).toEqual([]);
    expect(model.visible).toHaveLength(5);
  });

  /**
   * ⚠️ The mirror of the case above and the one the live payload actually hits:
   * on `/tala-18` every platform publishes the same round-trip, so
   * «رفت‌وبرگشت میانه یا کمتر» excluded nobody and was still offered as a working
   * filter. A control that hides nobody is as dead as one that hides everybody,
   * and the reason it gives must not be the "nobody declared it" sentence.
   */
  it("a filter that excludes nobody is disabled too, and says the opposite reason", async () => {
    const store = comparisonStore();
    for (const slug of SLUGS) {
      store.snapshots[slug] = makeSnapshot({
        slug,
        mid: 18_500_000,
        buyFee: "0.5",
        sellFee: "0.5",
        roundTrip: "0.995",
        fetchedAt: freshIso(),
      });
      store.updatedAt[slug] = freshIso();
    }
    const rows = await rowsOf(store);
    const model = buildComparisonModel({
      rows,
      instrument: "GOLD_18K",
      nowMs: Date.now(),
      view: filteredBy("declared-fee", "cheap-round-trip"),
    });
    for (const key of ["declared-fee", "cheap-round-trip"] as const) {
      const control = model.filterControls.find((item) => item.key === key);
      expect(control?.available, key).toBe(false);
      expect(control?.reasonFa, key).toBe(FILTER_NO_EFFECT_FA);
      expect(control?.reasonFa, key).not.toContain("اعلام نکرده");
    }
    expect(model.filters).toEqual([]);
    expect(model.visible).toHaveLength(5);
    expect(model.hiddenCount).toBe(0);
  });

  /**
   * ⚠️ The Redis outage, in the shape it actually arrives in: fourteen rows
   * whose snapshots are gone and a registry that is compiled into the bundle
   * and therefore fully intact. Before this test the disabled chips said
   * «هیچ سکویی کارمزدش را عمومی اعلام نکرده است» while `/beta` — served by the
   * same process in the same second — printed beta's delivery note. That is a
   * false claim about a third party, not a stale label.
   */
  it("a price outage says we cannot read the prices, never that the platforms published nothing", async () => {
    const store = comparisonStore();
    for (const slug of SLUGS) store.snapshots[slug] = null;
    const rows = await rowsOf(store);
    const model = buildComparisonModel({
      rows,
      instrument: "GOLD_18K",
      nowMs: Date.now(),
      view: filteredBy("delivery"),
    });
    expect(model.visible).toEqual([]);
    expect(model.unpriced).toHaveLength(5);
    for (const control of [...model.sorts, ...model.filterControls]) {
      expect(control.available, control.key).toBe(false);
      expect(control.reasonFa, control.key).toContain("همین حالا قیمتی از سکوها در دست نداریم");
      expect(control.reasonFa, control.key).not.toContain("اعلام نکرده");
      expect(control.reasonFa, control.key).not.toContain("تأیید نکرده‌ایم");
    }
    expect(model.sorts.map((control) => control.reasonFa)).toContain(SORT_NO_PRICES_FA);
    expect(model.filterControls.map((control) => control.reasonFa)).toContain(FILTER_NO_PRICES_FA);
  });

  it("the disabled reason is printed as visible text, not only in a title attribute", async () => {
    const store = comparisonStore();
    store.listed = PLATFORMS.map(({ delivery_note_fa: _note, ...rest }) => rest);
    const html = await renderTable(undefined, store);
    const block = html.match(/<p data-comparison-disabled[^>]*>(.*?)<\/p>/s)?.[1] ?? "";
    expect(block).toContain(FILTER_UNAVAILABLE_FA.delivery);
    expect(block).not.toContain("sr-only");
    expect(html).not.toContain('sr-only"> — ');
  });

  it("the delivery terms ride along with the delivery filter instead of staying a tick mark", async () => {
    const off = await renderTable();
    expect(off).not.toContain("data-delivery-note");
    const on = await renderTable(filteredBy("delivery"));
    expect(rowOf(on, "beta")).toContain("تحویل فیزیکی از ۵ گرم");
    expect(rowOf(on, "gamma")).toContain("تحویل فیزیکی با اجرت ساخت");
  });

  it("two individually available filters may still intersect to nothing, and that is said out loud", async () => {
    const rows = await rowsOf();
    const store = comparisonStore();
    store.updatedAt["beta"] = staleIso();
    store.snapshots["beta"] = makeSnapshot({
      slug: "beta",
      mid: 18_500_000,
      buyFee: "0.7",
      sellFee: "0.2",
      roundTrip: "0.9",
      fetchedAt: staleIso(),
    });
    const staleDelivery = await rowsOf(store);
    expect(orderUnder(rows, filteredBy("delivery", "fresh"))).toEqual(["beta"]);
    expect(orderUnder(staleDelivery, filteredBy("delivery", "fresh"))).toEqual([]);

    const html = await renderTable(filteredBy("delivery", "fresh"), store);
    expect(html).toContain("data-empty-view");
    expect(html).toContain("با این فیلترها هیچ سکویی نمی‌ماند");
  });
});

describe("comparison table — the URL is the state, so it works without JavaScript", () => {
  it("the default view serializes to no query string at all", () => {
    expect(comparisonSearchOf({ sort: "price", filters: [] })).toEqual({});
    expect(comparisonHref({ sort: "price", filters: [] }, "/tala-18")).toBe("/tala-18");
    expect(comparisonHref({ sort: "buy-fee", filters: ["fresh"] }, "/tala-18")).toBe(
      "/tala-18?sort=buy-fee&filter=fresh",
    );
  });

  it("a non-default view round-trips through the query string", () => {
    const view: ComparisonView = { sort: "round-trip", filters: ["fresh", "delivery"] };
    const search = comparisonSearchOf(view);
    expect(search).toEqual({ sort: "round-trip", filter: "fresh,delivery" });
    expect(comparisonViewFromSearch(search)).toEqual({
      sort: "round-trip",
      filters: ["delivery", "fresh"],
    });
  });

  it("junk in the query string degrades to the default instead of throwing", () => {
    expect(comparisonViewFromSearch({ sort: "cheapest-for-us", filter: "paid,fresh" })).toEqual({
      sort: "price",
      filters: ["fresh"],
    });
    expect(comparisonViewFromSearch({})).toEqual({ sort: "price", filters: [] });
  });

  it("toggling a filter keeps the canonical order so the same view always has the same URL", () => {
    expect(toggledFilters(["fresh"], "delivery")).toEqual(["delivery", "fresh"]);
    expect(toggledFilters(["delivery", "fresh"], "fresh")).toEqual(["delivery"]);
    expect(toggledFilters([], "declared-fee")).toEqual(["declared-fee"]);
  });

  it("every control renders as a real link, so a click works with scripting off", async () => {
    const html = await renderTable();
    for (const sort of COMPARISON_SORTS) {
      expect(html, sort).toMatch(new RegExp(`<a[^>]*data-sort="${sort}"[^>]*href="/tala-18`));
    }
    for (const filter of COMPARISON_FILTERS) {
      expect(html, filter).toMatch(
        new RegExp(`<a[^>]*data-filter="${filter}"[^>]*href="/tala-18\\?filter=${filter}"`),
      );
    }
  });

  it("the server renders the requested view: the sorted order is in the HTML, not applied later by a script", async () => {
    expect(rowOrder(await renderTable())).toEqual(["epsilon", "beta", "gamma", "alfa", "delta"]);
    expect(rowOrder(await renderTable(sortedBy("buy-fee")))).toEqual([
      "alfa",
      "gamma",
      "beta",
      "epsilon",
      "delta",
    ]);
    expect(rowOrder(await renderTable(filteredBy("delivery")))).toEqual(["beta", "gamma"]);
  });

  it("the control links are nofollow and the canonical still points at the bare slug", async () => {
    const html = await renderTable(sortedBy("buy-fee"));
    const controls = [...html.matchAll(/<a\b[^>]*data-(?:sort|filter)="[^"]*"[^>]*>/g)];
    expect(controls.length).toBeGreaterThanOrEqual(
      COMPARISON_SORTS.length + COMPARISON_FILTERS.length,
    );
    for (const [tag] of controls) {
      expect(tag).toContain('rel="nofollow"');
      expect(tag).toMatch(/href="\/tala-18(\?|")/);
    }
  });

  it("the active sort is marked on its column for assistive tech, and the count of hidden rows is spelled out", async () => {
    const html = await renderTable({ sort: "round-trip", filters: ["delivery"] });
    expect(html).toMatch(/<th[^>]*aria-sort="ascending"[^>]*>هزینه‌ی رفت‌وبرگشت<\/th>/);
    expect(html).toContain("data-hidden-count");
    expect(html).toContain("۳ سکو با فیلترهای فعلی نمایش داده نمی‌شود");
  });
});

describe("comparison table — honest cells and internal links", () => {
  it("every platform name in the table is an internal link to its own page", async () => {
    const html = await renderTable();
    for (const platform of PLATFORMS) {
      expect(rowOf(html, platform.slug)).toContain(`href="/${platform.slug}"`);
    }
  });

  it("an undisclosed fee is a sentence, never a dash and never «نامشخص»", async () => {
    const html = await renderTable();
    const delta = rowOf(html, "delta");
    expect(delta).toContain("این سکو کارمزدش را عمومی اعلام نکرده است");
    expect(html).not.toContain("نامشخص");
    for (const platform of PLATFORMS) {
      expect(rowOf(html, platform.slug), platform.slug).not.toMatch(/data-fee[^>]*>—/);
    }
  });

  it("a minimum order we have not collected admits that it is our gap, and one we have prints the number", async () => {
    const html = await renderTable();
    expect(rowOf(html, "epsilon")).toContain("۵۰۰٬۰۰۰ تومان");
    expect(rowOf(html, "alfa")).toContain("هنوز بررسی نکرده‌ایم");
    for (const platform of PLATFORMS) {
      expect(rowOf(html, platform.slug), platform.slug).not.toContain("ثبت نشده است");
    }
  });

  it("a platform that declared some fees but not all keeps its own cells and says so only where it is true", async () => {
    const store = comparisonStore();
    store.snapshots["alfa"] = makeSnapshot({
      slug: "alfa",
      mid: 18_600_000,
      buyFee: "0.3",
      fetchedAt: freshIso(),
    });
    const withoutRoundTrip = store.snapshots["alfa"];
    if (withoutRoundTrip !== null && withoutRoundTrip !== undefined) {
      withoutRoundTrip.terms.round_trip_percent = null;
    }
    const html = await renderTable(undefined, store);
    const alfa = rowOf(html, "alfa");
    expect(alfa).toContain("۰٫۳٪");
    expect(alfa).toContain("این سکو اعلام نکرده است");
    expect(alfa).not.toContain("data-fee-undisclosed");
  });

  /**
   * ⚠️ «قرارداد تبلیغاتی» is a narrower denial than the commercial relationship
   * Tablo actually has, and the row this footnote sits under links out through
   * `/go/`. The word must stay «کمیسیون», the same one `/about` uses.
   */
  it("the footnote states the neutrality claim and explains the median rule the filter uses", async () => {
    const html = await renderTable();
    expect(html).toContain("کمیسیون در آن اثری ندارد");
    expect(html).not.toContain("قرارداد تبلیغاتی");
    expect(html).toContain("از میانه‌ی همین جدول کمتر یا برابر است");
    expect(html).toContain("هنوز آن را بررسی نکرده‌ایم، نه اینکه سکو تحویل فیزیکی ندارد");
  });
});
