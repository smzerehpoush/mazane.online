import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CALC_REQUIRED_INPUTS,
  CALC_TOOLS,
  CALC_TOOL_NAMES_FA,
  CALC_TOOL_SELLBACK,
  asCalcTool,
  calcEventField,
} from "../src/lib/calc-events";
import { formatFaNumber } from "../src/lib/fa-number";
import { buildSitemapEntries } from "../src/lib/seo/sitemap";
import { sellBackBreakdown } from "../src/lib/sell-back";
import type { SellBackPageData } from "../src/lib/sell-back-page-data";
import { SITE_URL } from "../src/lib/site";
import { isReservedSlug, STATIC_PAGE_SLUGS } from "../src/lib/slugs";
import { SELL_BACK_PATH, SellBackPage, sellBackHead } from "../src/routes/mohasebe-forush-tala";

const DATA: SellBackPageData = {
  pricePerGram: 10_000_000,
  referenceName: "tala.ir",
  readAt: "2026-08-18T09:30:00.000Z",
  generated_at: "2026-08-18T09:31:00.000Z",
};

function render(data: SellBackPageData = DATA): string {
  return renderToStaticMarkup(<SellBackPage data={data} />);
}

describe("sell-back page — the question it answers", () => {
  it("the H1 is the seller's own question, not the tool's name", () => {
    const h1 = render().match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    expect(h1?.[1]).toBe("طلای دست‌دومم را بفروشم، چقدر به من می‌دهند؟");
    expect(h1?.[1]).not.toContain("ماشین‌حساب");
  });

  it("says in one line why the offer is lower than the purchase price", () => {
    const html = render();
    expect(html).toContain('data-tool-part="interpretation"');
    expect(html).toContain("اجرت ساخت، سود فروشنده و مالیاتی که هنگام خرید پرداخت کرده‌اید");
  });

  it("answers «طلافروش هنگام خرید چقدر کم می‌کند و چرا؟» in the FAQ", () => {
    expect(render()).toContain("طلافروش هنگام خرید چقدر کم می‌کند و چرا؟");
  });
});

describe("sell-back page — the calculator itself", () => {
  it("takes weight, karat and the buy-back cut, and nothing else", () => {
    const html = render();
    expect(html).toContain('name="weight"');
    expect(html).toContain('name="purity"');
    expect(html).toContain('name="deduction"');
    expect(html).not.toContain('name="wage"');
    expect(html).not.toContain('name="profit"');
    expect(html).not.toContain('name="vat"');
  });

  it("offers the four jewellery karats with 18 preselected", () => {
    const html = render();
    for (const label of ["۱۸ عیار (۷۵۰)", "۲۱ عیار (۸۷۵)", "۲۲ عیار (۹۱۶)", "۲۴ عیار (۹۹۹)"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('value="750" selected');
  });

  it("shows the reference rate it works from, with Persian digits", () => {
    const html = render();
    expect(html).toContain("نرخ هر گرم طلای ۱۸ عیار");
    expect(html).toContain("۱۰٬۰۰۰٬۰۰۰");
    expect(html).toContain("tala.ir");
  });

  /**
   * ⚠️ "Staleness, not error": a missing reference price must leave a rendered
   * page with an empty result, never a throw that turns the route into a 5xx.
   */
  it("renders a whole page with no result when the reference rate is unavailable", () => {
    const html = render({ ...DATA, pricePerGram: null, readAt: null });
    expect(html).toContain("نرخ مرجع هر گرم طلای ۱۸ عیار در این لحظه در دسترس نیست");
    expect(html).toContain("data-calculator-total");
    expect(html).toContain("—");
    expect(html).toContain('data-tool-part="faq"');
  });

  it("pre-fills no buy-back percentage, because no published rate exists", () => {
    const html = render();
    expect(html).toMatch(/name="deduction"[^>]*value=""/);
    expect(html).toContain("نرخ‌نامه‌ای اعلام نشده است");
  });
});

describe("sell-back page — formula and worked example", () => {
  it("prints the karat conversion and the subtraction as the two load-bearing lines", () => {
    const html = render();
    expect(html).toContain("ارزش طلا = وزن به گرم × نرخ هر گرم طلای ۱۸ عیار × عیار ÷ ۷۵۰");
    expect(html).toContain("مبلغ دریافتی = ارزش طلا − کسر خریدار");
  });

  it("states that wage, seller profit and VAT are not terms of this formula", () => {
    expect(render()).toContain(
      "اجرت ساخت، سود فروشنده و مالیات بر ارزش افزوده در این فرمول جایی ندارند",
    );
  });

  /**
   * ⚠️ The worked example is hand-written prose and the module is code; this
   * test is the only thing keeping the two honest with each other.
   */
  it("the worked example matches what the module actually computes", () => {
    const breakdown = sellBackBreakdown({
      weightGrams: 5,
      pricePerGram18k: 10_000_000,
      purityPerMille: 750,
      deductionPercent: 10,
    });
    const html = render();
    expect(html).toContain(`${formatFaNumber(breakdown.goldValue)} تومان`);
    expect(html).toContain(`${formatFaNumber(breakdown.deduction)} تومان`);
    expect(html).toContain(`${formatFaNumber(breakdown.payout)} تومان`);
    expect(html).toContain(
      `${formatFaNumber(breakdown.pureGoldGrams, { maximumFractionDigits: 3 })} گرم`,
    );
  });
});

describe("sell-back page — sources and honesty about the cut", () => {
  it("cites the union archive for the absence of a published buy-back rate", () => {
    const html = render();
    expect(html).toContain("هیچ نرخ‌نامه یا مصوبه‌ی منتشرشده‌ای وجود ندارد");
    expect(html).toContain("آرشیو اطلاعیه‌ها و بخشنامه‌های اتحادیه طلا و جواهر تهران");
    expect(html).toContain('href="https://www.estjt.ir/category/notices-and-circulars/"');
  });

  it("cites the VAT article for the claim about the tax paid at purchase", () => {
    expect(render()).toContain("بند (ب) ماده (۲۶) قانون مالیات بر ارزش افزوده، مصوب ۱۴۰۰/۰۳/۰۲");
  });

  it("never claims a usual market range for the buy-back cut", () => {
    const html = render();
    expect(html).not.toContain("محدوده‌ی معمول");
    expect(html).not.toContain("معمولاً بین");
    expect(html).not.toContain("عرف بازار");
  });

  it("carries no outbound link to a platform that pays us", () => {
    const external = [...render().matchAll(/href="(https?:\/\/[^"]+)"/g)].map(
      ([, href]) => new URL(href ?? "").hostname,
    );
    expect(external.length).toBeGreaterThan(0);
    expect(new Set(external)).toEqual(new Set(["www.estjt.ir"]));
    expect(render()).not.toContain("/go/");
  });
});

describe("sell-back page — head, schema and digits", () => {
  it("has a flat canonical on the reserved slug", () => {
    expect(sellBackHead().links).toContainEqual({
      rel: "canonical",
      href: `${SITE_URL}${SELL_BACK_PATH}`,
    });
    expect(SELL_BACK_PATH).toBe("/mohasebe-forush-tala");
  });

  it("ships eight FAQ entries into the FAQPage schema with Latin digits only", () => {
    const faqScript = sellBackHead().scripts.find((script) => script.children.includes("FAQPage"));
    const json = faqScript?.children ?? "";
    expect(JSON.parse(json).mainEntity).toHaveLength(8);
    expect(json).not.toMatch(/[۰-۹٠-٩]/);
    expect(json).toContain("ماده (26)");
    expect(json).toContain("750");
  });

  it("keeps Persian digits in the visible answers", () => {
    const html = render();
    expect(html).toContain("۱۸ عیار یعنی ۷۵۰ هزارم");
    expect(html).not.toContain("ماده (26)");
  });

  it("the WebPage node carries both dates and invents no author", () => {
    const script = sellBackHead().scripts.find((item) => item.children.includes('"WebPage"'));
    const node = JSON.parse(script?.children ?? "{}");
    expect(node.url).toBe(`${SITE_URL}${SELL_BACK_PATH}`);
    expect(node.datePublished).toBe("2026-08-18");
    expect(node.dateModified).toBe("2026-08-18");
    expect(node.author).toBeUndefined();
  });
});

describe("sell-back page — internal links", () => {
  it("links two related tools, the tools hub and the gold price page", () => {
    const related = render().slice(render().indexOf('data-tool-part="related"'));
    for (const href of ["/mohasebe-tala", "/mazane-chist", "/abzarha", "/tala-18"]) {
      expect(related).toContain(`href="${href}"`);
    }
  });
});

describe("sell-back page — slug reservation and sitemap", () => {
  /**
   * ⚠️ Platform pages live at the top level too, so an unreserved tool slug
   * could be handed to a future platform and silently shadow this page.
   */
  it("the slug is reserved on the web side, so no platform can claim it", () => {
    expect(STATIC_PAGE_SLUGS.has("mohasebe-forush-tala")).toBe(true);
    expect(isReservedSlug("mohasebe-forush-tala")).toBe(true);
  });

  it("the page is in the sitemap", () => {
    const paths = buildSitemapEntries({ posts: [], instruments: [], platforms: [] }).map(
      (entry) => entry.path,
    );
    expect(paths).toContain(SELL_BACK_PATH);
  });
});

describe("sell-back page — calculator beacons", () => {
  it("the tool slug is registered, so the write path accepts its events", () => {
    expect(CALC_TOOLS).toContain(CALC_TOOL_SELLBACK);
    expect(asCalcTool("sellback")).toBe(CALC_TOOL_SELLBACK);
    expect(calcEventField(CALC_TOOL_SELLBACK, "calc_complete")).toBe("sellback:calc_complete");
  });

  it("a completion needs the weight and the buy-back cut, not the pre-filled karat", () => {
    expect(CALC_REQUIRED_INPUTS[CALC_TOOL_SELLBACK]).toEqual(["weight", "deduction"]);
  });

  it("the admin panel has a Persian name for the tool", () => {
    expect(CALC_TOOL_NAMES_FA[CALC_TOOL_SELLBACK]).toContain("دست‌دوم");
  });
});
