import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CALC_REQUIRED_INPUTS,
  CALC_TOOLS,
  CALC_TOOL_MAZANE,
  CALC_TOOL_NAMES_FA,
  asCalcTool,
  calcEventField,
} from "../src/lib/calc-events";
import { clusterForPath, relatedLinksForPath } from "../src/lib/clusters";
import {
  convertMazane,
  gramRateFromMazane,
  mazaneFromGramRate,
  MESGHAL_GRAMS,
  MESGHAL_IN_18K_GRAMS,
} from "../src/lib/mazane";
import { ogKeyForPath } from "../src/lib/og";
import { buildSitemapEntries, CONTENT_REVISED_ON } from "../src/lib/seo/sitemap";
import { SITE_URL } from "../src/lib/site";
import { isReservedSlug, STATIC_PAGE_SLUGS } from "../src/lib/slugs";
import { TOOLS } from "../src/lib/tools";
import { MazaneChist } from "../src/routes/mazane-chist";
import { MAZANE_TOOL_PATH, MazaneToolPage, mazaneToolHead } from "../src/routes/tabdil-mazane";

function render(): string {
  return renderToStaticMarkup(<MazaneToolPage />);
}

describe("مظنه converter — the pure arithmetic", () => {
  /**
   * ⚠️ The divisor is the mesghal scaled from عیار ۷۰۵ to عیار ۷۵۰, not the
   * raw mesghal. Dividing a مظنه by 4.6083 instead of 4.331802 understates the
   * gram rate by about 6 percent — a wrong number that still looks plausible.
   */
  it("the divisor is the mesghal restated on the 18-karat scale", () => {
    expect(MESGHAL_GRAMS).toBe(4.6083);
    expect(MESGHAL_IN_18K_GRAMS).toBeCloseTo(4.331802, 6);
  });

  it("a مظنه becomes the gram rate it implies", () => {
    expect(gramRateFromMazane(80_000_000)).toBe(18_468_065);
  });

  it("the inverse direction restates a gram rate as a مظنه", () => {
    expect(mazaneFromGramRate(18_468_065)).toBe(80_000_001);
  });

  it("a round trip lands within a toman of where it started", () => {
    for (const mazane of [12_000_000, 80_000_000, 341_000_000]) {
      const back = mazaneFromGramRate(gramRateFromMazane(mazane) as number) as number;
      expect(Math.abs(back - mazane)).toBeLessThanOrEqual(3);
    }
  });

  it("convertMazane routes each direction to its own function", () => {
    expect(convertMazane("mazane-to-gram", 80_000_000)).toBe(gramRateFromMazane(80_000_000));
    expect(convertMazane("gram-to-mazane", 18_468_065)).toBe(mazaneFromGramRate(18_468_065));
  });

  it("zero, negative and non-finite inputs yield null rather than a fake rate", () => {
    expect(gramRateFromMazane(0)).toBeNull();
    expect(gramRateFromMazane(-1)).toBeNull();
    expect(gramRateFromMazane(Number.NaN)).toBeNull();
    expect(mazaneFromGramRate(0)).toBeNull();
    expect(mazaneFromGramRate(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("مظنه converter — the question it answers", () => {
  it("the H1 is the visitor's own question, not the tool's name", () => {
    const h1 = render().match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    expect(h1?.[1]).toBe("مظنه‌ای که شنیده‌ام چند تومان در گرم می‌شود؟");
    expect(h1?.[1]).not.toContain("ماشین‌حساب");
  });

  it("takes one number and a direction, and asks for nothing else", () => {
    const html = render();
    expect(html).toContain('name="amount"');
    expect(html).toContain('name="direction"');
    expect(html).not.toContain('name="weight"');
    expect(html).not.toContain('name="wage"');
    expect(html).toContain('value="mazane-to-gram"');
    expect(html).toContain('value="gram-to-mazane"');
  });

  it("starts empty — no مظنه is pre-filled for the visitor", () => {
    const html = render();
    const input = html.match(/<input[^>]*name="amount"[^>]*>/)?.[0] ?? "";
    expect(input).toContain('value=""');
    expect(html).toContain("عدد را وارد کنید تا معادلش نوشته شود.");
  });
});

/**
 * ⚠️ The hard constraint of this page: Tablo has no مظنه feed of its own
 * (no `ReferenceInstrument` member, no scrape), so any number the page shows
 * must be visibly the visitor's own. A pre-filled or server-supplied مظنه here
 * would be Tablo publishing a market rate it does not collect.
 */
describe("مظنه converter — Tablo never presents a مظنه as its own figure", () => {
  it("says on the page that the number came from the visitor", () => {
    const html = render();
    expect(html).toContain("تابلو هیچ مظنه‌ای اعلام نمی‌کند");
    expect(html).toContain("نرخ بازار نیست");
  });

  it("the FAQ answers «تابلو مظنه‌ی امروز را اعلام می‌کند؟» with a no", () => {
    const html = render();
    expect(html).toContain("تابلو مظنه‌ی امروز را اعلام می‌کند؟");
    expect(html).toContain("هیچ نرخ مظنه‌ای جمع نمی‌کند و منتشر نمی‌کند");
  });

  it("calls the 705 fineness a market convention, not a decree", () => {
    const html = render();
    expect(html).toContain("قرارداد");
    expect(html).not.toContain("طبق قانون عیار ۷۰۵");
    expect(html).not.toContain("مصوب عیار");
  });

  it("no platform is named and no revenue link is offered", () => {
    const html = render();
    expect(html).not.toContain("/go/");
    expect(html).not.toContain("sponsored");
  });
});

describe("مظنه converter — the tool template", () => {
  it("uses the shared template's parts rather than a second page shell", () => {
    const html = render();
    for (const part of [
      "question",
      "tool",
      "breakdown",
      "interpretation",
      "bridge",
      "formula",
      "faq",
      "sources",
      "byline",
      "related",
    ]) {
      expect(html, part).toContain(`data-tool-part="${part}"`);
    }
  });

  it("the worked example is the same arithmetic the module performs", () => {
    expect(render()).toContain("۱۸٬۴۶۸٬۰۶۵");
    expect(gramRateFromMazane(80_000_000)).toBe(18_468_065);
  });

  it("cites its two conventions and the VAT article behind the gram-rate caveat", () => {
    const html = render();
    expect(html).toContain('data-tool-part="sources"');
    expect(html).toContain("قانون مالیات بر ارزش افزوده");
    expect(html).toContain("جست‌وجوی منابع رسمی");
  });

  it("hands off to the jewellery calculator so the gram rate goes somewhere", () => {
    expect(render()).toContain("/mohasebe-tala");
  });
});

describe("مظنه converter — head and structured data", () => {
  it("has a canonical URL on its own path", () => {
    expect(mazaneToolHead().links).toContainEqual({
      rel: "canonical",
      href: `${SITE_URL}${MAZANE_TOOL_PATH}`,
    });
  });

  it("ships breadcrumb, FAQ and WebPage JSON-LD with Latin digits inside", () => {
    const scripts = mazaneToolHead().scripts ?? [];
    const all = scripts.map((script) => String(script.children)).join("\n");
    expect(all).toContain("BreadcrumbList");
    expect(all).toContain("FAQPage");
    expect(all).toContain("WebPage");
    expect(all).toContain("4.6083");
    expect(all).not.toContain("۴٫۶۰۸۳");
  });

  it("its og image key follows the path, so the shared card is generated", () => {
    expect(ogKeyForPath(MAZANE_TOOL_PATH)).toBe("tabdil-mazane");
    const meta = mazaneToolHead().meta;
    expect(JSON.stringify(meta)).toContain("/og/tabdil-mazane.png");
  });
});

describe("مظنه converter — registration", () => {
  it("the slug is reserved on the web side, so no platform can claim it", () => {
    expect(STATIC_PAGE_SLUGS.has("tabdil-mazane")).toBe(true);
    expect(isReservedSlug("tabdil-mazane")).toBe(true);
  });

  it("the page is in the sitemap with a content revision date", () => {
    const paths = buildSitemapEntries({ posts: [], instruments: [], platforms: [] }).map(
      (entry) => entry.path,
    );
    expect(paths).toContain(MAZANE_TOOL_PATH);
    expect(CONTENT_REVISED_ON[MAZANE_TOOL_PATH]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is in the TOOLS registry, so the hub and the home cards pick it up", () => {
    expect(TOOLS.map((tool) => tool.href)).toContain(MAZANE_TOOL_PATH);
  });

  it("sits in the مظنه cluster and stops its heading from over-promising", () => {
    expect(clusterForPath(MAZANE_TOOL_PATH)).toBe("mazane");
    expect(relatedLinksForPath("/mazane-chist").cluster).toBe("mazane");

    const fromTool = relatedLinksForPath(MAZANE_TOOL_PATH);
    expect(fromTool.tools.map((link) => link.href)).not.toContain(MAZANE_TOOL_PATH);
    expect(fromTool.tools.map((link) => link.href)).toContain("/mazane-chist");
  });

  it("the explainer article links to the converter in its own prose", () => {
    expect(renderToStaticMarkup(<MazaneChist />)).toContain('href="/tabdil-mazane"');
  });
});

describe("مظنه converter — calculator beacons", () => {
  it("the tool slug is registered, so the write path accepts its events", () => {
    expect(CALC_TOOLS).toContain(CALC_TOOL_MAZANE);
    expect(asCalcTool("mazane")).toBe(CALC_TOOL_MAZANE);
    expect(calcEventField(CALC_TOOL_MAZANE, "calc_complete")).toBe("mazane:calc_complete");
  });

  it("a completion needs the amount, not the pre-selected direction", () => {
    expect(CALC_REQUIRED_INPUTS[CALC_TOOL_MAZANE]).toEqual(["amount"]);
  });

  it("the admin panel has a Persian name for the tool", () => {
    expect(CALC_TOOL_NAMES_FA[CALC_TOOL_MAZANE]).toContain("مظنه");
  });
});
