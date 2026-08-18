import { beforeEach, describe, expect, it } from "vitest";

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import sharp from "sharp";

import { blogIndexHead } from "../src/components/content/BlogViews";
import { slugHead, type SlugPageData } from "../src/components/content/SlugPageView";
import { homeHead } from "../src/components/tablo/HomePage";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  ogImageAlt,
  ogImageMeta,
  ogImagePath,
  ogImageUrl,
  ogKeyForPath,
} from "../src/lib/og";
import {
  OG_CARD_NO_PRICE,
  clampOgTitle,
  ogFootnote,
  ogPriceLine,
  type OgCard,
} from "../src/lib/og-card";
import { setOgImageCache, type OgImageCache } from "../src/lib/server/og/cache";
import { ogCardFor } from "../src/lib/server/og/card-data";
import { ogFontFiles, resetOgFontFiles } from "../src/lib/server/og/fonts";
import {
  escapePangoMarkup,
  forceRtl,
  renderOgCard,
  renderOgFallbackCard,
} from "../src/lib/server/og/render";
import {
  OG_CACHE_CONTROL,
  ogImageMethodNotAllowed,
  ogImageResponse,
  ogKeyFromParam,
} from "../src/lib/server/og/response";
import { setReferencePriceSource } from "../src/lib/reference-price";
import { SITE_URL } from "../src/lib/site";
import { toolsHubHead } from "../src/routes/abzarha";
import { sekehHead } from "../src/routes/sekeh";
import { jewelryToolHead } from "../src/routes/mohasebe-tala";
import { sellBackHead } from "../src/routes/mohasebe-forush-tala";
import { makeSnapshot, seed, seedReferencePrice } from "./support/seed";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

interface MetaLike {
  meta?: Record<string, string>[];
}

function metaValue(head: MetaLike, key: string): string | undefined {
  const tag = (head.meta ?? []).find((item) => item["property"] === key || item["name"] === key);
  return tag === undefined ? undefined : tag["content"];
}

const INSTRUMENT_PAGE: SlugPageData = {
  kind: "instrument",
  listing: {
    slug: "tala-18",
    instrument: "GOLD_18K",
    name_fa: "طلای ۱۸ عیار",
    unit_fa: "گرم",
    purity: "750",
    currency: "IRT",
    supporting_platform_slugs: ["milli"],
    published: true,
  },
  rows: [],
  goldPrice: null,
  generated_at: "2026-08-18T10:00:00.000Z",
};

const PLATFORM_PAGE: SlugPageData = {
  kind: "platform",
  platform: {
    slug: "milli",
    name_fa: "میلی",
    data_policy: "ALLOWED",
    market_model: "OTC",
    name_en: "Milli",
    website_url: "https://milli.gold",
    legal_entity: null,
    delivery_note_fa: null,
  },
  snapshot: null,
  updatedAt: null,
  hasOutbound: false,
  instrumentNames: {},
  history: { DAILY: null, WEEKLY: null, MONTHLY: null },
  referencePrice: null,
  generated_at: "2026-08-18T10:00:00.000Z",
};

function seedStore(): void {
  seed({
    snapshots: { milli: makeSnapshot({ slug: "milli", mid: 9_876_543 }) },
    updatedAt: { milli: "2026-08-18T09:05:00.000Z" },
  });
}

beforeEach(() => {
  seedStore();
  seedReferencePrice({
    reference_slug: "talair",
    instrument: "GOLD_18K_TOMAN",
    value: 10_500_000,
    read_at: "2026-08-18T10:50:00.000Z",
  });
  setOgImageCache({ read: async () => null, write: async () => {} });
  delete process.env["TABLO_OG_FONT_DIR"];
  resetOgFontFiles();
});

describe("OG image addresses", () => {
  it("builds one path per page key", () => {
    expect(ogImagePath("home")).toBe("/og/home.png");
    expect(ogImageUrl("tala-18")).toBe(`${SITE_URL}/og/tala-18.png`);
  });

  it("derives the key from a page path", () => {
    expect(ogKeyForPath("/")).toBe("home");
    expect(ogKeyForPath("/mohasebe-tala")).toBe("mohasebe-tala");
    expect(ogKeyForPath("/mohasebe-forush-tala/")).toBe("mohasebe-forush-tala");
  });

  it("only accepts a «.png» request and a safe key", () => {
    expect(ogKeyFromParam("home.png")).toBe("home");
    expect(ogKeyFromParam("home")).toBeNull();
    expect(ogKeyFromParam("../secret.png")).toBeNull();
    expect(ogKeyFromParam("Home.png")).toBeNull();
    expect(ogKeyFromParam(`${"a".repeat(70)}.png`)).toBeNull();
  });
});

describe("og:image meta", () => {
  it("carries the dimensions Telegram and WhatsApp need", () => {
    const meta = { meta: ogImageMeta({ key: "home", alt: "الف" }) };
    expect(metaValue(meta, "og:image")).toBe(`${SITE_URL}/og/home.png`);
    expect(metaValue(meta, "og:image:width")).toBe(String(OG_IMAGE_WIDTH));
    expect(metaValue(meta, "og:image:height")).toBe(String(OG_IMAGE_HEIGHT));
    expect(metaValue(meta, "og:image:type")).toBe("image/png");
    expect(metaValue(meta, "twitter:image")).toBe(`${SITE_URL}/og/home.png`);
    expect(metaValue(meta, "og:image:alt")).toBe("الف");
  });

  it("restores «summary_large_image» in the same place the image is declared", () => {
    expect(metaValue({ meta: ogImageMeta({ key: "home", alt: "الف" }) }, "twitter:card")).toBe(
      "summary_large_image",
    );
  });

  it("writes the alt text in Persian", () => {
    expect(ogImageAlt("قیمت سکه امامی")).toContain("تابلو");
    expect(ogImageAlt("قیمت سکه امامی")).toContain("قیمت سکه امامی");
  });
});

describe("which pages declare an image", () => {
  const cases: [string, MetaLike, string][] = [
    ["home", homeHead(), "home"],
    ["instrument page", slugHead(INSTRUMENT_PAGE), "tala-18"],
    ["platform page", slugHead(PLATFORM_PAGE), "milli"],
    ["/sekeh", sekehHead(), "sekeh"],
    ["/mohasebe-tala", jewelryToolHead(), "mohasebe-tala"],
    ["/mohasebe-forush-tala", sellBackHead(), "mohasebe-forush-tala"],
    ["/abzarha", toolsHubHead(), "abzarha"],
  ];

  for (const [name, head, key] of cases) {
    it(`${name} points at its own card and claims a large card`, () => {
      expect(metaValue(head, "og:image")).toBe(`${SITE_URL}/og/${key}.png`);
      expect(metaValue(head, "twitter:image")).toBe(`${SITE_URL}/og/${key}.png`);
      expect(metaValue(head, "twitter:card")).toBe("summary_large_image");
    });
  }

  it("pages without a rendered card stay on the small card", () => {
    expect(metaValue(blogIndexHead(), "og:image")).toBeUndefined();
  });

  it("a missing slug page declares no image", () => {
    expect(metaValue(slugHead(undefined), "og:image")).toBeUndefined();
  });
});

describe("card copy", () => {
  it("clamps a title that would not fit on two lines", () => {
    expect(clampOgTitle("قیمت طلا")).toBe("قیمت طلا");
    expect(clampOgTitle("الف ".repeat(40)).length).toBeLessThanOrEqual(58);
    expect(clampOgTitle("الف ".repeat(40)).endsWith("…")).toBe(true);
  });

  it("names the source and the reading time when there is a price", () => {
    expect(ogFootnote({ sourceName: "tala.ir", clock: "۱۴:۲۰", hasPrice: true })).toBe(
      "منبع نرخ: tala.ir · آخرین ثبت ۱۴:۲۰",
    );
    expect(ogFootnote({ sourceName: "tala.ir", clock: null, hasPrice: true })).toBe(
      "منبع نرخ: tala.ir",
    );
  });

  it("says the rate is unavailable instead of naming a source for a number it has not got", () => {
    expect(ogFootnote({ sourceName: "tala.ir", clock: "۱۴:۲۰", hasPrice: false })).toBe(
      OG_CARD_NO_PRICE,
    );
    expect(ogPriceLine(null)).toBeNull();
    expect(ogPriceLine("۱۰٬۵۰۰٬۰۰۰")).toBe("۱۰٬۵۰۰٬۰۰۰ تومان");
  });

  it("escapes pango markup so a platform name can never open a span", () => {
    expect(escapePangoMarkup('<b>&"x"</b>')).toBe("&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;");
  });
});

/**
 * ⚠️ These are the tests that make the OG card worth shipping. A renderer that
 * lays Persian out left-to-right, or breaks the letter joining, produces a card
 * that is worse than no card — and a 200 response proves nothing about either.
 */
describe("Persian is actually shaped and laid out right-to-left", () => {
  const fonts = ogFontFiles();

  async function draw(text: string): Promise<{ data: Buffer; width: number; height: number }> {
    const result = await sharp({
      text: {
        text,
        font: "Vazirmatn 64",
        ...(fonts === null ? {} : { fontfile: fonts.regular }),
        rgba: true,
        dpi: 72,
      },
    })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data: result.data, width: result.info.width, height: result.info.height };
  }

  function markupOf(text: string): string {
    return `<span foreground="#ffffff">${forceRtl(escapePangoMarkup(text))}</span>`;
  }

  async function probe(text: string): Promise<{ data: Buffer; width: number; height: number }> {
    return draw(markupOf(text));
  }

  async function inkWidth(text: string): Promise<number> {
    return (await probe(text)).width;
  }

  async function inkHalves(text: string): Promise<{ left: number; right: number }> {
    const { data, width, height } = await probe(text);
    const channels = data.length / (width * height);
    const middle = Math.floor(width / 2);
    let left = 0;
    let right = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(y * width + x) * channels + channels - 1] ?? 0;
        if (x < middle) left += alpha;
        else right += alpha;
      }
    }
    return { left, right };
  }

  async function inkCentroid(text: string): Promise<number> {
    const { data, width, height } = await probe(text);
    const channels = data.length / (width * height);
    let ink = 0;
    let weighted = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(y * width + x) * channels + channels - 1] ?? 0;
        ink += alpha;
        weighted += alpha * x;
      }
    }
    return weighted / ink / width;
  }

  it("applies the mandatory lam-alef ligature", async () => {
    const ligature = await inkWidth("لا");
    const apart = (await inkWidth("ل")) + (await inkWidth("ا"));
    expect(ligature).toBeLessThan(apart);
  });

  it("joins the letters of a word instead of setting them in isolated forms", async () => {
    const joined = await inkWidth("سلام");
    const isolated =
      (await inkWidth("س")) + (await inkWidth("ل")) + (await inkWidth("ا")) + (await inkWidth("م"));
    expect(joined).toBeLessThan(isolated);
  });

  /**
   * ⚠️ «ا» never joins to the letter after it, so «ححح» is shaped identically
   * in both strings and the two renders contain exactly the same glyphs. Only
   * their order differs, which makes the ink centroid a direct read-out of the
   * writing direction: laid out right-to-left the heavy «ححح» sits on the left
   * of «ا ححح» and on the right of «ححح ا». A left-to-right renderer inverts
   * the sign of this comparison.
   */
  it("puts the first word on the right, not on the left", async () => {
    const thinFirst = await inkCentroid("ا ححح");
    const heavyFirst = await inkCentroid("ححح ا");
    expect(thinFirst).toBeLessThan(heavyFirst - 0.02);

    const halves = await inkHalves("ا ححح");
    expect(halves.left).toBeGreaterThan(halves.right * 1.15);
  });

  it("forces an RTL base direction even when the line opens on a Latin word", async () => {
    const guarded = await probe("iPhone و قیمت طلا");
    const unguarded = await draw("iPhone و قیمت طلا");
    expect(guarded.data.equals(unguarded.data)).toBe(false);
    expect(await probe("قیمت طلا")).toBeDefined();
  });
});

describe("the font files the renderer depends on", () => {
  it("ships both weights in public/, the only directory nitro copies into .output", () => {
    expect(existsSync(resolve("public/fonts/vazirmatn-regular-33.0.3.ttf"))).toBe(true);
    expect(existsSync(resolve("public/fonts/vazirmatn-bold-33.0.3.ttf"))).toBe(true);
  });

  it("is found without an override", () => {
    expect(ogFontFiles()).not.toBeNull();
  });
});

describe("renderOgCard", () => {
  const CARD: OgCard = {
    eyebrow: "نرخ مرجع هر گرم طلای ۱۸ عیار",
    title: "طلا می‌خرید یا می‌فروشید؟ اول حساب کنید",
    price: "۱۰٬۵۰۰٬۰۰۰ تومان",
    footnote: "منبع نرخ: tala.ir · آخرین ثبت ۱۴:۲۰",
  };

  async function inkPixels(png: Buffer): Promise<number> {
    const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
    let lit = 0;
    for (let index = 0; index < info.width * info.height; index += 1) {
      if ((data[index] ?? 0) > 60) lit += 1;
    }
    return lit;
  }

  it("produces a PNG at the size the meta tags promise", async () => {
    const png = await renderOgCard(CARD);
    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(OG_IMAGE_WIDTH);
    expect(meta.height).toBe(OG_IMAGE_HEIGHT);
  });

  it("draws the price when there is one and drops the line when there is not", async () => {
    const withPrice = await inkPixels(await renderOgCard(CARD));
    const withoutPrice = await inkPixels(
      await renderOgCard({ ...CARD, price: null, footnote: OG_CARD_NO_PRICE }),
    );
    expect(withPrice).toBeGreaterThan(withoutPrice);
  });

  it("keeps a nine-digit price inside the card", async () => {
    const png = await renderOgCard({ ...CARD, price: "۱٬۲۳۴٬۵۶۷٬۸۹۰ تومان" });
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(OG_IMAGE_WIDTH);
    expect(meta.height).toBe(OG_IMAGE_HEIGHT);
  });

  it("refuses to draw text without a font file, but the fallback card still renders", async () => {
    process.env["TABLO_OG_FONT_DIR"] = "/nonexistent/og-fonts";
    resetOgFontFiles();
    await expect(renderOgCard(CARD)).rejects.toThrow(/font/i);
    const fallback = await renderOgFallbackCard();
    const meta = await sharp(fallback).metadata();
    expect(meta.width).toBe(OG_IMAGE_WIDTH);
    expect(meta.height).toBe(OG_IMAGE_HEIGHT);
  });
});

describe("ogCardFor", () => {
  it("names the reference and the price on the home card", async () => {
    const card = await ogCardFor("home");
    expect(card?.price).toBe("۱۰٬۵۰۰٬۰۰۰ تومان");
    expect(card?.footnote).toContain("tala.ir");
  });

  it("shows a platform's own announced price on its own card", async () => {
    const card = await ogCardFor("milli");
    expect(card?.title).toBe("میلی");
    expect(card?.price).toBe("۹٬۸۷۶٬۵۴۳ تومان");
    expect(card?.footnote).toContain("میلی");
  });

  it("has a card for both tool pages", async () => {
    expect((await ogCardFor("mohasebe-tala"))?.title).toContain("اجرت");
    expect((await ogCardFor("mohasebe-forush-tala"))?.title).toContain("دست‌دوم");
  });

  it("has a card for the tools hub", async () => {
    const card = await ogCardFor("abzarha");
    expect(card?.title).toContain("ابزارهای تابلو");
    expect(card?.footnote).toContain("tala.ir");
  });

  it("has no card for an unknown key", async () => {
    expect(await ogCardFor("nothing-here")).toBeNull();
  });

  it("degrades to a card without a price when the source is down", async () => {
    setReferencePriceSource({
      getReferencePrice: async () => {
        throw new Error("redis down");
      },
    });
    const card = await ogCardFor("home");
    expect(card?.price).toBeNull();
    expect(card?.footnote).toBe(OG_CARD_NO_PRICE);
  });
});

describe("GET /og/{key}.png", () => {
  it("answers with a cacheable PNG", async () => {
    const response = await ogImageResponse("home.png");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe(OG_CACHE_CONTROL);
    expect(OG_CACHE_CONTROL).toContain("max-age=900");
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.subarray(0, 4)).toEqual(PNG_MAGIC);
  });

  it("404s an unknown key and a request without the extension — never a 5xx", async () => {
    expect((await ogImageResponse("nothing-here.png")).status).toBe(404);
    expect((await ogImageResponse("home")).status).toBe(404);
    expect(ogImageMethodNotAllowed().status).toBe(405);
  });

  it("still answers 200 when the price source is down", async () => {
    setReferencePriceSource({
      getReferencePrice: async () => {
        throw new Error("redis down");
      },
    });
    const response = await ogImageResponse("home.png");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("still answers 200 with the text-free card when rendering fails", async () => {
    process.env["TABLO_OG_FONT_DIR"] = "/nonexistent/og-fonts";
    resetOgFontFiles();
    const response = await ogImageResponse("home.png");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).not.toBe(OG_CACHE_CONTROL);
  });

  it("serves the cached bytes without rendering again", async () => {
    const stored = await renderOgCard({
      eyebrow: "الف",
      title: "ب",
      price: null,
      footnote: "ج",
    });
    setOgImageCache({ read: async () => stored, write: async () => {} });
    const response = await ogImageResponse("home.png");
    expect(Buffer.from(await response.arrayBuffer()).equals(stored)).toBe(true);
  });

  it("writes the freshly rendered card into the cache for fifteen minutes", async () => {
    const writes: { key: string; ttl: number }[] = [];
    const cache: OgImageCache = {
      read: async () => null,
      write: async (key, _image, ttl) => {
        writes.push({ key, ttl });
      },
    };
    setOgImageCache(cache);
    await ogImageResponse("home.png");
    expect(writes).toEqual([{ key: "home", ttl: 900 }]);
  });

  it("keeps answering when the cache itself is down", async () => {
    setOgImageCache({
      read: async () => {
        throw new Error("redis down");
      },
      write: async () => {
        throw new Error("redis down");
      },
    });
    const response = await ogImageResponse("home.png");
    expect(response.status).toBe(200);
  });
});
