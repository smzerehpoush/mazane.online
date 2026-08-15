import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SlugPageView } from "../src/components/content/SlugPageView";
import type { SlugPageData } from "../src/components/content/SlugPageView";
import { HomePage } from "../src/components/tablo/HomePage";
import type { InstrumentListing, ListedPlatform } from "../src/lib/prices";
import {
  freshIso,
  homeData,
  makeListing,
  makeSnapshot,
  seed,
  slugPageData,
  type SeededStore,
} from "./support/seed";

const NON_REVENUE_REFERENCE_HOSTS: ReadonlySet<string> = new Set(["tala.ir", "www.tala.ir"]);

function attrOf(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match === null ? null : (match[1] ?? null);
}

function relTokens(tag: string): Set<string> {
  return new Set((attrOf(tag, "rel") ?? "").split(/\s+/).filter(Boolean));
}

function assertOutboundLinkPolicy(
  html: string,
  platformHosts: ReadonlySet<string>,
  pageName: string,
): number {
  let goLinks = 0;
  for (const [tag] of html.matchAll(/<a\b[^>]*>/g)) {
    const href = attrOf(tag, "href");
    if (href === null) continue;
    if (/^https?:\/\//.test(href)) {
      const host = new URL(href).hostname;
      if (platformHosts.has(host)) {
        throw new Error(
          `Clause 6.4 violated: revenue link ${href} in "${pageName}" bypasses /go/`,
        );
      }
      const rel = relTokens(tag);
      if (!rel.has("nofollow") || !rel.has("noopener")) {
        throw new Error(
          `Clause 6.4 violated: outbound link ${href} in "${pageName}" doesn't have a complete rel (${tag})`,
        );
      }
      if (!NON_REVENUE_REFERENCE_HOSTS.has(host) && !rel.has("sponsored")) {
        throw new Error(
          `Clause 6.4 violated: outbound link ${href} in "${pageName}" is missing sponsored (${tag})`,
        );
      }
    } else if (href.startsWith("/go/")) {
      goLinks += 1;
      const rel = relTokens(tag);
      for (const token of ["sponsored", "nofollow", "noopener"]) {
        if (!rel.has(token)) {
          throw new Error(
            `Clause 6.4 violated: link ${href} in "${pageName}" is missing the ${token} token in rel (${tag})`,
          );
        }
      }
      if (attrOf(tag, "target") !== "_blank") {
        throw new Error(`Link ${href} in "${pageName}" must have target="_blank" (${tag})`);
      }
    }
  }
  return goLinks;
}

const REFERRAL_CODE = "MZN-OWNER-CODE";

const PLATFORMS: ListedPlatform[] = [
  {
    slug: "wallgold",
    name_fa: "وال‌گلد",
    data_policy: "ALLOWED",
    website_url: "https://wallgold.ir",
    referral_url: null,
    referral_param: null,
  },
  {
    slug: "talasea",
    name_fa: "طلاسی",
    data_policy: "ALLOWED",
    website_url: "https://talasea.ir",
    referral_url: null,
    referral_param: "r",
  },
  {
    slug: "milli",
    name_fa: "میلی",
    data_policy: "ALLOWED",
    website_url: "https://milli.gold",
    referral_url: `https://milli.gold/app/sign-up?referralCode=${REFERRAL_CODE}`,
    referral_param: "referralCode",
  },
];

const PLATFORM_HOSTS: ReadonlySet<string> = new Set(
  PLATFORMS.flatMap((platform) =>
    [platform.website_url, platform.referral_url]
      .filter((url): url is string => typeof url === "string")
      .map((url) => new URL(url).hostname),
  ),
);

const TALA18: InstrumentListing = makeListing({
  slug: "tala-18",
  instrument: "GOLD_18K",
  name_fa: "طلای ۱۸ عیار",
  supporting: ["wallgold", "talasea", "milli"],
  published: true,
  purity: "750",
});

function seededStore(): SeededStore {
  const now = freshIso();
  return {
    listed: PLATFORMS,
    instruments: [TALA18],
    snapshots: {
      wallgold: makeSnapshot({
        slug: "wallgold",
        mid: 18611000,
        fetchedAt: now,
      }),
      talasea: makeSnapshot({
        slug: "talasea",
        mid: 18530000,
        fetchedAt: now,
      }),
      milli: makeSnapshot({
        slug: "milli",
        mid: 18538000,
        fetchedAt: now,
      }),
    },
    updatedAt: { wallgold: now, talasea: now, milli: now },
  };
}

async function renderSlug(slug: string): Promise<string> {
  const data = await slugPageData(slug);
  if (data === null) throw new Error(`Page ${slug} 404'd`);
  return renderToStaticMarkup(<SlugPageView data={data as SlugPageData} />);
}

describe("no revenue-generating outbound link is without sponsored, or outside /go/", () => {
  it("the home page passes the gate and has a /go/ link for every platform", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(seededStore())} />);
    const goLinks = assertOutboundLinkPolicy(html, PLATFORM_HOSTS, "صفحه‌ی اصلی");
    // ⚠️ The exact count is no longer asserted: with the redesign, each
    // source has **two** exit points (the axis marker and the source card),
    // and a priceless source only gets a card. What actually matters is
    // that every platform has at least one way out, and **all** links pass
    // the policy gate.
    expect(goLinks).toBeGreaterThanOrEqual(PLATFORMS.length);
    for (const platform of PLATFORMS) {
      expect(html, platform.slug).toContain(`href="/go/${platform.slug}"`);
    }
    expect(html).not.toContain(REFERRAL_CODE);
  });

  it("each platform's page passes the gate and its website link is /go/", async () => {
    for (const platform of PLATFORMS) {
      seed(seededStore());
      const html = await renderSlug(platform.slug);
      const goLinks = assertOutboundLinkPolicy(html, PLATFORM_HOSTS, `صفحه‌ی ${platform.slug}`);
      expect(goLinks).toBeGreaterThanOrEqual(1);
      expect(html).toContain(`href="/go/${platform.slug}"`);
      expect(html).not.toContain(REFERRAL_CODE);
    }
  });

  it("the asset page passes the gate", async () => {
    seed(seededStore());
    const html = await renderSlug("tala-18");
    assertOutboundLinkPolicy(html, PLATFORM_HOSTS, "صفحه‌ی دارایی");
    expect(html).not.toContain(REFERRAL_CODE);
  });

  it("referral fields never enter the client payload at all (not just hidden from display)", async () => {
    const data = await homeData(seededStore());
    for (const row of data.rows) {
      expect(row.platform).not.toHaveProperty("referral_url");
      expect(row.platform).not.toHaveProperty("referral_param");
    }
    seed(seededStore());
    const platformPage = await slugPageData("milli");
    expect(platformPage?.kind).toBe("platform");
    if (platformPage?.kind === "platform") {
      expect(platformPage.platform).not.toHaveProperty("referral_url");
      expect(platformPage.hasOutbound).toBe(true);
    }
    expect(JSON.stringify(data)).not.toContain(REFERRAL_CODE);
  });
});

describe("link policy gate — violations actually fail", () => {
  it("a direct link to the platform's host (bypassing /go/) ⟸ fails", () => {
    const bad = '<a href="https://wallgold.ir" rel="sponsored nofollow noopener">و</a>';
    expect(() => assertOutboundLinkPolicy(bad, PLATFORM_HOSTS, "آزمایشی")).toThrow(/bypasses/);
  });

  it("an outbound link without sponsored ⟸ fails", () => {
    const bad = '<a href="https://tabligh.example" rel="nofollow noopener">آ</a>';
    expect(() => assertOutboundLinkPolicy(bad, PLATFORM_HOSTS, "آزمایشی")).toThrow(/sponsored/);
  });

  it("a /go/ link without a complete rel or without target=_blank ⟸ fails", () => {
    const noRel = '<a href="/go/milli" rel="nofollow noopener" target="_blank">م</a>';
    expect(() => assertOutboundLinkPolicy(noRel, PLATFORM_HOSTS, "آزمایشی")).toThrow(/sponsored/);
    const noTarget = '<a href="/go/milli" rel="sponsored nofollow noopener">م</a>';
    expect(() => assertOutboundLinkPolicy(noTarget, PLATFORM_HOSTS, "آزمایشی")).toThrow(/_blank/);
  });

  it("a non-revenue reference to the price source: plain, but must be nofollow", () => {
    const ok = '<a href="https://www.tala.ir/price" rel="nofollow noopener">طلا</a>';
    expect(assertOutboundLinkPolicy(ok, PLATFORM_HOSTS, "آزمایشی")).toBe(0);
    const bare = '<a href="https://www.tala.ir/price">طلا</a>';
    expect(() => assertOutboundLinkPolicy(bare, PLATFORM_HOSTS, "آزمایشی")).toThrow(/complete rel/);
  });
});

describe("sorting takes no input from referral fields", () => {
  it("the pricier platform with a referral code doesn't rank higher for having a referral_url", async () => {
    const store = seededStore();
    const now = freshIso();
    store.snapshots["milli"] = makeSnapshot({
      slug: "milli",
      mid: 18800000,
      fetchedAt: now,
    });
    const html = renderToStaticMarkup(<HomePage data={await homeData(store)} />);

    // ⚠️ "Order" in the new layout means **position on the axis** (right =
    // pricier, and `right` is the distance from the right edge). Milli has
    // a referral code and is the most expensive here — it must sit
    // furthest right, i.e. the **smallest** percentage. If commission ever
    // enters the geometry, this is where it turns red.
    const percentOf = (slug: string): number => {
      const marker = html.match(
        new RegExp(`data-rail-marker="${slug}"[^>]*style="right:\\s*([\\d.]+)%`),
      );
      if (marker === null) throw new Error(`Marker ${slug} is not in the HTML`);
      return Number(marker[1]);
    };
    expect(percentOf("milli")).toBeLessThan(percentOf("wallgold"));
    expect(percentOf("wallgold")).toBeLessThan(percentOf("talasea"));
  });

  it("the asset page has the same order too — the referral code has no effect on grouping", async () => {
    const store = seededStore();
    const now = freshIso();
    store.snapshots["milli"] = makeSnapshot({
      slug: "milli",
      mid: 18800000,
      fetchedAt: now,
    });
    seed(store);
    const html = await renderSlug("tala-18");
    expect(html.indexOf('data-platform="wallgold"')).toBeLessThan(
      html.indexOf('data-platform="milli"'),
    );
  });

  it("the sorting functions don't even know the referral fields' names (a code-level guard)", () => {
    // "referral_url must not feed into any sorting logic." This is an
    // existence guard: if referral ever enters tableView/bestView/groupRows
    // or the row layer, this test turns red here.
    // ⚠️ Paths were updated with the TanStack rewrite; if a file moves, put
    // its new path here — this list must not be deleted.
    for (const file of [
      // ⚠️ With the dashboard redesign, `ComparisonTable`/`home-view` gave
      // way to `lib/dashboard.ts` — that's where ordering and axis geometry
      // are now built. The path changed, the coverage didn't. This list
      // must not be deleted.
      "src/lib/dashboard.ts",
      "src/components/tablo/PriceRail.tsx",
      "src/components/tablo/SourceCards.tsx",
      "src/components/content/AssetPage.tsx",
      "src/lib/rows.ts",
    ]) {
      const source = readFileSync(join(__dirname, "..", file), "utf8");
      expect(source, `${file} نباید فیلد معرف بخواند`).not.toMatch(/referral/);
    }
  });
});
