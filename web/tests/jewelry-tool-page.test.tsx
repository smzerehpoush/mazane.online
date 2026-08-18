import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { JewelryToolPage } from "../src/components/content/JewelryToolPage";
import { JewelryCalculator } from "../src/components/tablo/JewelryCalculator";
import { jewelryToolHead } from "../src/routes/mohasebe-tala";
import { CALC_TOOLS, CALC_TOOL_JEWELRY } from "../src/lib/calc-events";
import {
  JEWELRY_TOOL_FAQ,
  JEWELRY_TOOL_IDENTITY,
  JEWELRY_TOOL_PATH,
  JEWELRY_TOOL_RELATED,
  JEWELRY_TOOL_SOURCES,
  jewelryInterpretation,
} from "../src/lib/jewelry-tool";
import { buildSitemapEntries } from "../src/lib/seo/sitemap";
import { SITE_URL } from "../src/lib/site";
import { isReservedSlug } from "../src/lib/slugs";
import { TOOL_FAQ_MAX, TOOL_FAQ_MIN } from "../src/lib/tool-page";
import type { JewelryToolData } from "../src/lib/jewelry-tool";

const DATA: JewelryToolData = {
  pricePerGram: 10_000_000,
  referenceName: "tala.ir",
  readAt: "2026-08-18T09:12:00.000Z",
  generated_at: "2026-08-18T09:12:30.000Z",
};

function render(data: JewelryToolData = DATA): string {
  return renderToStaticMarkup(<JewelryToolPage data={data} />);
}

describe("/mohasebe-tala — the page exists as its own URL", () => {
  it("the canonical is the flat tool path", () => {
    expect(jewelryToolHead().links).toContainEqual({
      rel: "canonical",
      href: `${SITE_URL}${JEWELRY_TOOL_PATH}`,
    });
  });

  it("the slug is reserved, so no platform or instrument can ever claim it", () => {
    expect(isReservedSlug("mohasebe-tala")).toBe(true);
  });

  it("is announced in the sitemap", () => {
    const paths = buildSitemapEntries({ posts: [], instruments: [], platforms: [] }).map(
      (entry) => entry.path,
    );
    expect(paths).toContain(JEWELRY_TOOL_PATH);
  });

  it("the H1 is the visitor's question, not the tool's name", () => {
    const h1 = render().match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    expect(h1?.[1]).toBe(JEWELRY_TOOL_IDENTITY.question);
    expect(h1?.[1]).not.toContain("ماشین‌حساب");
  });
});

describe("/mohasebe-tala — the ten template parts are all filled", () => {
  it("renders every part the template promises", () => {
    const html = render();
    for (const part of [
      "question",
      "tool",
      "breakdown",
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

  it("links the sell calculator, the hub and the gold price page", () => {
    const html = render();
    for (const href of [
      JEWELRY_TOOL_RELATED.tools[0].href,
      JEWELRY_TOOL_RELATED.tools[1].href,
      JEWELRY_TOOL_RELATED.hub.href,
      "/tala-18",
    ]) {
      expect(html, href).toContain(`href="${href}"`);
    }
  });

  it("prints the worked example down to the final number", () => {
    expect(render()).toContain("۶۵٬۶۲۰٬۰۰۰ تومان");
  });

  it("keeps the FAQ inside the template's five-to-eight window", () => {
    expect(JEWELRY_TOOL_FAQ.length).toBeGreaterThanOrEqual(TOOL_FAQ_MIN);
    expect(JEWELRY_TOOL_FAQ.length).toBeLessThanOrEqual(TOOL_FAQ_MAX);
  });

  it("every sourced claim prints its citation", () => {
    const html = render();
    for (const source of JEWELRY_TOOL_SOURCES) {
      expect(html).toContain(source.claim);
      expect(html).toContain(source.citation);
    }
  });
});

describe("/mohasebe-tala — Persian digits visible, Latin digits in the schema", () => {
  it("the visible answers keep Persian digits", () => {
    expect(render()).toContain("ماده (۲۶)");
  });

  it("no JSON-LD script carries a Persian or Arabic-Indic digit", () => {
    for (const script of jewelryToolHead().scripts) {
      expect(script.children, script.children.slice(0, 60)).not.toMatch(/[۰-۹٠-٩]/);
    }
  });

  it("the FAQPage schema carries every question with Latin digits", () => {
    const faq = jewelryToolHead().scripts.find((script) =>
      script.children.includes("FAQPage"),
    )?.children;
    expect(faq).toBeDefined();
    expect(JSON.parse(faq ?? "{}").mainEntity).toHaveLength(JEWELRY_TOOL_FAQ.length);
    expect(faq).toContain("ماده (26)");
  });

  it("the breadcrumb walks back to the home page", () => {
    const breadcrumb = jewelryToolHead().scripts.find((script) =>
      script.children.includes("BreadcrumbList"),
    )?.children;
    expect(breadcrumb).toContain(`${SITE_URL}${JEWELRY_TOOL_PATH}`);
    expect(breadcrumb).toContain("خانه");
  });
});

describe("/mohasebe-tala — neutrality on the numbers", () => {
  it("the seller's profit is never called an official rate", () => {
    const html = render();
    expect(html).toContain("هفت درصد عرف بازار است، نه نرخ رسمی");
    expect(html).not.toMatch(/سود[^<]{0,40}(رسمی است|قانونی است|مصوب است)/);
  });

  it("says plainly that no citable market range for the wage exists", () => {
    expect(render()).toContain("منبع رسمی و قابل استنادی برای این محدوده وجود ندارد");
  });

  it("the interpretation restates the breakdown and invents no market comparison", () => {
    const line = jewelryInterpretation({
      gold: 50_000_000,
      wage: 10_000_000,
      profit: 4_200_000,
      vat: 1_420_000,
      total: 65_620_000,
      extraCostPercent: 31.24,
    });
    expect(line).toContain("۱۵٬۶۲۰٬۰۰۰");
    expect(line).toContain("۳۱٫۲٪");
    expect(line).not.toContain("معمول");
  });

  it("says nothing at all when there is no calculation yet", () => {
    expect(jewelryInterpretation(null)).toBeNull();
    expect(render()).not.toContain('data-tool-part="interpretation"');
  });
});

describe("/mohasebe-tala — staleness, not error", () => {
  it("renders the live gram rate when the reference answered", () => {
    const html = render();
    expect(html).toContain('data-tool-rate="live"');
    expect(html).toContain("۱۰٬۰۰۰٬۰۰۰");
    expect(html).toContain("tala.ir");
  });

  it("still renders the page when the reference price is missing", () => {
    const html = render({ ...DATA, pricePerGram: null, readAt: null });
    expect(html).toContain('data-tool-rate="missing"');
    expect(html).toContain("data-calculator-total");
    expect(html).toContain("—");
  });
});

describe("the jewelry calculator's beacon and its two homes", () => {
  it("the tool slug the beacon writes is a registered one", () => {
    expect(CALC_TOOLS).toContain(CALC_TOOL_JEWELRY);
  });

  it("the home page card now points at the full page", () => {
    const html = renderToStaticMarkup(
      <JewelryCalculator pricePerGram={18_500_000} referenceName="میلی" />,
    );
    expect(html).toContain("data-calculator-full-page");
    expect(html).toContain(`href="${JEWELRY_TOOL_PATH}"`);
  });

  it("server rendering the tool page sends no beacon", () => {
    const html = render();
    expect(html).not.toContain("calc_start");
    expect(html).not.toContain("calc_complete");
  });
});
