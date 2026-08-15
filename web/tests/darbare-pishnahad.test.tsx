/**
 * ⚠️ Today there is no "editor's pick" component on the home page (the ad
 * slot has no place in the new design), but the criteria page isn't removed
 * on that account and is still in the header nav — so its copy and its
 * presence in the sitemap are still gated here.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DarbarePishnahad, darbarePishnahadHead } from "../src/routes/darbare-pishnahad";
import { buildSitemapEntries } from "../src/lib/seo/sitemap";
import { SITE_URL } from "../src/lib/site";
import { nav } from "../src/lib/site-content";

describe("editor's pick criteria page", () => {
  it("explicitly states the selection criteria", () => {
    const html = renderToStaticMarkup(<DarbarePishnahad />);
    expect(html).toContain("پیشنهاد سردبیر");
    expect(html).toContain("کمترین هزینه‌ی رفت‌وبرگشت");
    expect(html).toContain("API");
    expect(html).toContain("باز");
  });

  it("states the ad/editorial separation: the pick is not sold", () => {
    const html = renderToStaticMarkup(<DarbarePishnahad />);
    expect(html).toContain("فروخته نمی‌شود");
    expect(html).toContain("تبلیغ");
  });

  it("has a flat Latin canonical and a BreadcrumbList", () => {
    const head = darbarePishnahadHead();
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: `${SITE_URL}/darbare-pishnahad`,
    });
    expect(head.scripts?.[0]?.children).toContain("BreadcrumbList");
  });

  it("is in the sitemap (static content, no price-based lastmod)", () => {
    const entries = buildSitemapEntries({ posts: [], instruments: [], platforms: [] });
    const entry = entries.find((item) => item.path === "/darbare-pishnahad");
    expect(entry).toBeDefined();
    expect(entry?.lastModified).toBeUndefined();
  });

  it("is reachable from the header nav — the page is never orphaned", () => {
    expect(nav.map((item) => item.href)).toContain("/darbare-pishnahad");
  });
});
