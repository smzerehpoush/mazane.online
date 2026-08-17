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
import { withoutReferral } from "../src/lib/page-data";
import type { InstrumentListing, ListedPlatform } from "../src/lib/prices";
import { compareByPrice, fetchRows, type Row } from "../src/lib/rows";
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
      SLUGS.map((slug) => [
        slug,
        makeSnapshot({ slug, mid: prices[slug], fetchedAt: FETCHED_AT }),
      ]),
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
    const cheaperMilli = axisOrder(
      await renderedHome([], { ...PRICES, milli: 18_000_000 }),
    );
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

    expect(orderBy(milliPays, byReferralFirst)).not.toEqual(
      orderBy(talaseaPays, byReferralFirst),
    );
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
