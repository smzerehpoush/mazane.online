/**
 * ⚠️ The render-config test (`revalidate = 60`) was removed: ISR is a
 * Next.js concept and doesn't exist in TanStack Start. Its replacement is
 * the edge cache policy, measured in `tests/seo.test.ts` (s-maxage=60 +
 * stale-if-error).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { HomePage } from "../src/components/tablo/HomePage";
import {
  nextRateCardCountdown,
  nextRowDomState,
  RATE_CARD_POLL_SECONDS,
  STALE_SUFFIX_FA,
  type LiveRowDomState,
} from "../src/lib/live-update";
import { livePricesPayload } from "../src/lib/server/live-prices";
import { healthyStore, homeData, rowOf, storeWithUnknownFee } from "./support/seed";

const NOW = Date.parse("2026-08-06T12:00:00Z");

function isoSecondsAgo(seconds: number): string {
  return new Date(NOW - seconds * 1000).toISOString();
}

function domState(overrides: Partial<LiveRowDomState> = {}): LiveRowDomState {
  return {
    priceText: "۱۸٬۷۰۴٬۰۵۵",
    updatedAtIso: isoSecondsAgo(90),
    updatedText: "۱ دقیقه پیش",
    staleText: "",
    ...overrides,
  };
}

describe("swap logic — the pure function nextRowDomState", () => {
  it("a fresh payload ⟸ both the price and the time label change", () => {
    const next = nextRowDomState(
      domState(),
      {
        platform_slug: "wallgold",
        price_toman: 18720000,
        price_display: "۱۸٬۷۲۰٬۰۰۰",
        updated_at: isoSecondsAgo(5),
      },
      NOW,
    );
    expect(next).toEqual({
      priceText: "۱۸٬۷۲۰٬۰۰۰",
      updatedAtIso: isoSecondsAgo(5),
      updatedText: "لحظاتی پیش",
      staleText: "",
    });
  });

  it("a stale payload ⟸ the staleness suffix is added", () => {
    const next = nextRowDomState(
      domState(),
      {
        platform_slug: "wallgold",
        price_toman: 18720000,
        price_display: "۱۸٬۷۲۰٬۰۰۰",
        updated_at: isoSecondsAgo(10 * 60),
      },
      NOW,
    );
    expect(next.updatedText).toBe("۱۰ دقیقه پیش");
    expect(next.staleText).toBe(STALE_SUFFIX_FA);
  });

  it("with no row payload, the number stays but the time label ages from the DOM's own ISO", () => {
    const current = domState({ updatedAtIso: isoSecondsAgo(4 * 60) });
    const next = nextRowDomState(current, undefined, NOW);
    expect(next.priceText).toBe(current.priceText);
    expect(next.updatedAtIso).toBe(current.updatedAtIso);
    expect(next.updatedText).toBe("۴ دقیقه پیش");
    expect(next.staleText).toBe(STALE_SUFFIX_FA);
  });

  it("source outage (a priceless payload) ⟸ the previous number stays and only staleness is reported", () => {
    const next = nextRowDomState(
      domState(),
      {
        platform_slug: "wallgold",
        price_toman: null,
        price_display: null,
        updated_at: isoSecondsAgo(10 * 60),
      },
      NOW,
    );
    expect(next.priceText).toBe("۱۸٬۷۰۴٬۰۵۵");
    expect(next.updatedText).toBe("۱۰ دقیقه پیش");
    expect(next.staleText).toBe(STALE_SUFFIX_FA);
  });

  it("a payload with a price but no updated_at ⟸ the price changes, the time comes from the DOM's own ISO", () => {
    const next = nextRowDomState(
      domState(),
      {
        platform_slug: "wallgold",
        price_toman: 18720000,
        price_display: "۱۸٬۷۲۰٬۰۰۰",
        updated_at: null,
      },
      NOW,
    );
    expect(next.priceText).toBe("۱۸٬۷۲۰٬۰۰۰");
    expect(next.updatedAtIso).toBe(domState().updatedAtIso);
    expect(next.updatedText).toBe("۱ دقیقه پیش");
  });

  it("with no ISO at all (a platform with no history) nothing changes", () => {
    const current = domState({
      updatedAtIso: null,
      updatedText: "",
      staleText: "",
    });
    const next = nextRowDomState(current, undefined, NOW);
    expect(next).toEqual(current);
  });
});

describe("dashboard hooks in the server-rendered HTML", () => {
  /**
   * ⚠️ With the redesign, the table (and its `data-live` hooks) was
   * removed. The live swap now works on the axis markers and source cards.
   * The contract is the same — "the client only places pre-computed text
   * and position" — only the selectors changed.
   */
  it("every source has a tagged marker with a price node", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(healthyStore())} />);
    for (const [slug, price] of [
      ["wallgold", "۱۸٬۶۱۱٬۰۰۰"],
      ["talasea", "۱۸٬۵۳۰٬۰۰۰"],
      ["milli", "۱۸٬۵۳۸٬۰۰۰"],
    ] as const) {
      expect(html, slug).toContain(`data-rail-marker="${slug}"`);
      const marker = html.match(new RegExp(`<a[^>]*data-rail-marker="${slug}"[\\s\\S]*?</a>`));
      expect(marker?.[0], slug).toMatch(
        new RegExp(`data-rail-price[\\s\\S]*data-price-value[^>]*>${price}</span>`),
      );
      expect(marker?.[0], slug).toMatch(/data-price-unit[^>]*>تومان<\/span>/);
    }
  });

  it("every source has a tagged card with a price node", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(healthyStore())} />);
    for (const slug of ["wallgold", "talasea", "milli"]) {
      expect(html, slug).toContain(`data-source-card="${slug}"`);
    }
    expect(html).toContain("data-source-price");
  });

  it("the axis footer has update hooks", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(healthyStore())} />);
    expect(html).toContain("data-rail-max");
    expect(html).toContain("data-rail-min");
    expect(html).toContain("data-rail-spread");
  });
});

describe("the rate card's live countdown — the pure function nextRateCardCountdown", () => {
  it("each tick, when data is fresh, decrements by one and requests no fetch", () => {
    expect(nextRateCardCountdown(30, false)).toEqual({ secondsRemaining: 29, shouldFetch: false });
    expect(nextRateCardCountdown(15, false)).toEqual({ secondsRemaining: 14, shouldFetch: false });
    expect(nextRateCardCountdown(1, false)).toEqual({ secondsRemaining: 0, shouldFetch: false });
  });

  it("at zero, one real fetch is required and the counter restarts from 30", () => {
    expect(nextRateCardCountdown(0, false)).toEqual({
      secondsRemaining: RATE_CARD_POLL_SECONDS,
      shouldFetch: true,
    });
  });

  it("staleness switches off the counter — it always jumps to 30 and never requests a fetch", () => {
    expect(nextRateCardCountdown(12, true)).toEqual({
      secondsRemaining: RATE_CARD_POLL_SECONDS,
      shouldFetch: false,
    });
    expect(nextRateCardCountdown(0, true)).toEqual({
      secondsRemaining: RATE_CARD_POLL_SECONDS,
      shouldFetch: false,
    });
  });
});

describe("payload equivalence with the server render", () => {
  /**
   * ⚠️ The heart of the live contract: the string that polling places must
   * be **bit-for-bit** identical to what the server render put there, or
   * the number "changes" for no reason on the first tick. Both come from
   * the same function (`lib/dashboard.ts`), and this test locks that in.
   */
  it("each platform's price_display is the same string rendered on the marker", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(healthyStore())} />);
    const payload = await livePricesPayload();
    expect(payload.dashboard?.sources).not.toHaveLength(0);
    for (const source of payload.dashboard?.sources ?? []) {
      if (source.price_display === null) continue;
      const marker = html.match(
        new RegExp(`<a[^>]*data-rail-marker="${source.slug}"[\\s\\S]*?</a>`),
      );
      if (marker === null) continue;
      expect(marker[0], source.slug).toContain(source.price_display);
    }
  });

  it("the rail_percent payload is the same percent the server rendered", async () => {
    const html = renderToStaticMarkup(<HomePage data={await homeData(healthyStore())} />);
    const payload = await livePricesPayload();
    for (const source of payload.dashboard?.sources ?? []) {
      if (source.rail_percent === null) continue;
      const marker = html.match(new RegExp(`<a[^>]*data-rail-marker="${source.slug}"[^>]*>`));
      if (marker === null) continue;
      expect(marker[0], source.slug).toContain(`right:${source.rail_percent}%`);
    }
  });
});
