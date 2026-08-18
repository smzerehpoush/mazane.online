import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SekehPage, sekehHead } from "../src/routes/sekeh";
import { calculateBubble, calculateCoinBubble } from "../src/lib/bubble";
import type { SekehPageData } from "../src/lib/sekeh-data";
import { SITE_URL } from "../src/lib/site";
import { EMAMI_COIN_PURE_GOLD_GRAMS, nav } from "../src/lib/site-content";

const DATA: SekehPageData = {
  generated_at: "2026-08-15T20:17:15.475Z",
  emamiBubble: null,
  coins: [
    {
      key: "emami",
      label: "سکه امامی",
      instrument: "SEKEH_EMAMI_TOMAN",
      priceToman: 189500000,
      priceDisplay: "۱۸۹٬۵۰۰٬۰۰۰",
      readAt: "2026-08-15T20:17:15.475Z",
    },
    {
      key: "half",
      label: "نیم سکه",
      instrument: "SEKEH_HALF_TOMAN",
      priceToman: 96000000,
      priceDisplay: "۹۶٬۰۰۰٬۰۰۰",
      readAt: "2026-08-15T20:17:15.475Z",
    },
    {
      key: "quarter",
      label: "ربع سکه",
      instrument: "SEKEH_QUARTER_TOMAN",
      priceToman: 52500000,
      priceDisplay: "۵۲٬۵۰۰٬۰۰۰",
      readAt: "2026-08-15T20:17:15.475Z",
    },
  ],
};

describe("coin price page", () => {
  it("renders all coin prices in the server-rendered HTML", () => {
    const html = renderToStaticMarkup(<SekehPage data={DATA} />);
    expect(html).toContain("قیمت سکه امامی، نیم سکه و ربع سکه");
    expect(html).toContain("سکه امامی");
    expect(html).toContain("نیم سکه");
    expect(html).toContain("ربع سکه");
    expect(html).toContain("۱۸۹٬۵۰۰٬۰۰۰");
    expect(html).toContain("۹۶٬۰۰۰٬۰۰۰");
    expect(html).toContain("۵۲٬۵۰۰٬۰۰۰");
    expect(html).toContain("تومان");
  });

  it("explains the coin types without naming the upstream source", () => {
    const html = renderToStaticMarkup(<SekehPage data={DATA} />);
    expect(html).toContain("حباب");
    expect(html).toContain("نقدشوندگی");
    expect(html).not.toContain("tala.ir");
    expect(html).not.toContain("طلا دات‌آی‌آر");
  });

  it("has a canonical URL and breadcrumb JSON-LD", () => {
    const head = sekehHead();
    expect(head.links).toContainEqual({ rel: "canonical", href: `${SITE_URL}/sekeh` });
    expect(head.scripts?.[0]?.children).toContain("BreadcrumbList");
    expect(head.scripts?.[0]?.children).toContain(`${SITE_URL}/sekeh`);
  });

  it("is reachable from the header nav", () => {
    expect(nav).toContainEqual({ label: "قیمت سکه", href: "/sekeh" });
  });
});

describe("coin price page — a missing coin price is honest, not a bare dash", () => {
  const MISSING: SekehPageData = {
    ...DATA,
    coins: DATA.coins.map((coin) =>
      coin.key === "emami"
        ? { ...coin, priceToman: null, priceDisplay: null, readAt: null }
        : coin,
    ),
  };

  it("never renders a bare em-dash for a coin price", () => {
    const html = renderToStaticMarkup(<SekehPage data={MISSING} />);
    expect(html).not.toContain(">—<");
  });

  it("the «قیمت زنده» badge only appears next to a coin that actually has a price", () => {
    const html = renderToStaticMarkup(<SekehPage data={MISSING} />);
    const cardStart = html.indexOf("معیار اصلی بازار سکه");
    const cardEnd = html.indexOf("واحد میانی برای خرید سبک‌تر");
    const emamiCard = html.slice(cardStart, cardEnd);
    expect(emamiCard).not.toContain("قیمت زنده");
    expect(emamiCard).toContain("هنوز داده‌ای ثبت نشده است");
  });

  it("the headline index never claims a displayable rate while showing none", () => {
    const allMissing: SekehPageData = {
      ...DATA,
      coins: DATA.coins.map((coin) => ({
        ...coin,
        priceToman: null,
        priceDisplay: null,
        readAt: null,
      })),
    };
    const html = renderToStaticMarkup(<SekehPage data={allMissing} />);
    expect(html).not.toContain("به‌عنوان اولین نرخ قابل نمایش");
    expect(html).toContain("هنوز نرخی برای نمایش نداریم");
  });
});

const OUNCE_USD = 3400;
const USD_TOMAN = 92000;

describe("the coin bubble — the pure function calculateCoinBubble", () => {
  it("intrinsic value is the coin's pure gold at the ounce and dollar of the moment", () => {
    const bubble = calculateCoinBubble({
      coinPriceToman: 95_000_000,
      pureGoldGrams: EMAMI_COIN_PURE_GOLD_GRAMS,
      ounceUsd: OUNCE_USD,
      usdToman: USD_TOMAN,
    });
    expect(bubble?.intrinsicToman).toBe(73_639_391);
    expect(bubble?.bubbleToman).toBe(21_360_609);
    expect(bubble?.bubblePercentDisplay).toContain("+۲۹٫۰۱٪");
    expect(bubble?.riskLevel).toBe("HIGH");
  });

  /**
   * ⚠️ The coin bubble and the 18-karat gram bubble must stay one piece of
   * arithmetic: the coin's intrinsic value is the gram figure scaled by the
   * coin's pure grams over 0.75. A second formula here would let the homepage
   * gauge and this page disagree about the same ounce.
   */
  it("is the same arithmetic as the 18-karat gram bubble, only scaled by weight", () => {
    const gram = calculateBubble({
      marketPriceToman: 1,
      ounceUsd: OUNCE_USD,
      usdToman: USD_TOMAN,
    });
    const coin = calculateCoinBubble({
      coinPriceToman: 1,
      pureGoldGrams: EMAMI_COIN_PURE_GOLD_GRAMS,
      ounceUsd: OUNCE_USD,
      usdToman: USD_TOMAN,
    });
    const scaled =
      (gram as { intrinsicToman: number }).intrinsicToman * (EMAMI_COIN_PURE_GOLD_GRAMS / 0.75);
    expect(coin?.intrinsicToman).toBeCloseTo(scaled, -1);
  });

  it("a coin priced under its own gold reads as a negative bubble, not an error", () => {
    const bubble = calculateCoinBubble({
      coinPriceToman: 70_000_000,
      pureGoldGrams: EMAMI_COIN_PURE_GOLD_GRAMS,
      ounceUsd: OUNCE_USD,
      usdToman: USD_TOMAN,
    });
    expect(bubble?.bubbleToman).toBeLessThan(0);
    expect(bubble?.riskLevel).toBe("LOW");
  });

  it("any missing input yields null — staleness, not an invented number", () => {
    const complete = {
      coinPriceToman: 95_000_000,
      pureGoldGrams: EMAMI_COIN_PURE_GOLD_GRAMS,
      ounceUsd: OUNCE_USD,
      usdToman: USD_TOMAN,
    };
    expect(calculateCoinBubble({ ...complete, coinPriceToman: null })).toBeNull();
    expect(calculateCoinBubble({ ...complete, ounceUsd: null })).toBeNull();
    expect(calculateCoinBubble({ ...complete, usdToman: null })).toBeNull();
    expect(calculateCoinBubble({ ...complete, pureGoldGrams: null })).toBeNull();
    expect(calculateCoinBubble({ ...complete, ounceUsd: 0 })).toBeNull();
  });
});

describe("the coin bubble block on /sekeh", () => {
  const bubbled: SekehPageData = {
    ...DATA,
    emamiBubble: calculateCoinBubble({
      coinPriceToman: 95_000_000,
      pureGoldGrams: EMAMI_COIN_PURE_GOLD_GRAMS,
      ounceUsd: OUNCE_USD,
      usdToman: USD_TOMAN,
    }),
  };

  it("renders the intrinsic value, the bubble and the percent", () => {
    const html = renderToStaticMarkup(<SekehPage data={bubbled} />);
    expect(html).toContain("data-coin-bubble");
    expect(html).toContain("حباب سکه امامی");
    expect(html).toContain("۷۳٬۶۳۹٬۳۹۱");
    expect(html).toContain("+۲۱٬۳۶۰٬۶۰۹");
    expect(html).toContain("+۲۹٫۰۱٪");
  });

  it("cites the minting spec it used, with the weight and the fineness", () => {
    const html = renderToStaticMarkup(<SekehPage data={bubbled} />);
    expect(html).toContain("۸٫۱۳۵۹۸");
    expect(html).toContain("۹۰۰");
    expect(html).toContain("قانون اصلاح قانون ضرب مسکوک طلا");
    expect(html).toContain("۱۳۷۰/۰۳/۱۹");
  });

  /**
   * ⚠️ No نیم/ربع bubble may ever appear here without a citable mint spec —
   * the same rule that keeps the unsourced سود فروشنده figure off the site.
   */
  it("says out loud that نیم سکه and ربع سکه get no bubble", () => {
    const html = renderToStaticMarkup(<SekehPage data={bubbled} />);
    const block = html.match(/<section[^>]*data-coin-bubble[\s\S]*?<\/section>/)?.[0] ?? "";
    expect(block).toContain("برای نیم سکه و ربع سکه عددی نمی‌نویسیم");
    expect(block).not.toContain("۴٫۰۶۶");
    expect(block).not.toContain("۲٫۰۳۳");
  });

  it("no ounce or dollar ⟸ the block simply does not render and the page stays whole", () => {
    const html = renderToStaticMarkup(<SekehPage data={DATA} />);
    expect(html).not.toContain("data-coin-bubble");
    expect(html).toContain("۱۸۹٬۵۰۰٬۰۰۰");
    expect(html).toContain("قیمت سکه امامی، نیم سکه و ربع سکه");
  });

  it("carries no buy or sell instruction", () => {
    const html = renderToStaticMarkup(<SekehPage data={bubbled} />);
    const block = html.match(/<section[^>]*data-coin-bubble[\s\S]*?<\/section>/)?.[0] ?? "";
    for (const advice of ["بخرید", "نخرید", "بفروشید", "نفروشید", "توصیه می‌کنیم"]) {
      expect(block, advice).not.toContain(advice);
    }
  });
});
