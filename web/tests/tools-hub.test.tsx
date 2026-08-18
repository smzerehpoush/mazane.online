import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { HomePage } from "../src/components/tablo/HomePage";
import { JEWELRY_TOOL_RELATED } from "../src/lib/jewelry-tool";
import { REGISTRY_INSTRUMENTS, REGISTRY_PLATFORMS } from "../src/lib/registry";
import { buildSitemapEntries } from "../src/lib/seo/sitemap";
import { SITE_URL } from "../src/lib/site";
import { nav } from "../src/lib/site-content";
import { isReservedSlug, STATIC_PAGE_SLUGS } from "../src/lib/slugs";
import { TOOLS, TOOLS_HUB_LINK, TOOLS_HUB_PATH } from "../src/lib/tools";
import { ToolsHubPage, toolsHubHead } from "../src/routes/abzarha";
import { healthyStore, homeData } from "./support/seed";

const KNOWN_ROUTES: ReadonlySet<string> = new Set(["/", "/blog", "/about"]);

function hubHtml(): string {
  return renderToStaticMarkup(<ToolsHubPage />);
}

async function homeHtml(): Promise<string> {
  return renderToStaticMarkup(<HomePage data={await homeData(healthyStore())} />);
}

function internalHrefs(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*\bhref="(\/[^"#]*)"/g)].map((match) => match[1] ?? "");
}

function resolvesToARoute(href: string): boolean {
  if (KNOWN_ROUTES.has(href)) return true;
  if (href.startsWith("/blog/") || href.startsWith("/go/")) return true;
  const slug = href.slice(1);
  if (STATIC_PAGE_SLUGS.has(slug)) return true;
  if (REGISTRY_INSTRUMENTS.some((item) => item.published && item.slug === slug)) return true;
  return REGISTRY_PLATFORMS.some((platform) => platform.slug === slug);
}

describe("tools hub — every tool is reachable from one page", () => {
  it("each tool in the registry gets a card that links to its own page", () => {
    const html = hubHtml();
    for (const tool of TOOLS) {
      expect(html, tool.href).toContain(`data-tool-link="${tool.href}"`);
      expect(html, tool.href).toContain(tool.action);
      expect(html, tool.href).toContain(tool.question);
    }
  });

  /**
   * ⚠️ The tool template's `related.hub` is the return leg of this link, and
   * nothing but this pair of assertions keeps the two ends on the same path.
   */
  it("the hub sits at the path the tool pages link back to", () => {
    expect(TOOLS_HUB_LINK.href).toBe(TOOLS_HUB_PATH);
    expect(JEWELRY_TOOL_RELATED.hub.href).toBe(TOOLS_HUB_PATH);
  });

  it("brings /methodology and /about up out of the footer", () => {
    const html = hubHtml();
    expect(html).toContain('href="/methodology"');
    expect(html).toContain('href="/about"');
  });

  it("names no reviewer, because there isn't one yet", () => {
    const html = hubHtml();
    expect(html).toContain("نام بازبین مستقلی هنوز روی صفحه‌ها نیست");
    expect(html).not.toContain("بازبینی محتوا:");
  });

  it("promises nothing that hasn't shipped", () => {
    expect(hubHtml()).not.toContain("به‌زودی");
  });

  it("has a canonical and a breadcrumb back to the home page", () => {
    const head = toolsHubHead();
    expect(head.links).toContainEqual({
      rel: "canonical",
      href: `${SITE_URL}${TOOLS_HUB_PATH}`,
    });
    const breadcrumb = head.scripts.find((script) => script.children.includes("BreadcrumbList"));
    expect(breadcrumb?.children).toContain(`${SITE_URL}${TOOLS_HUB_PATH}`);
    expect(breadcrumb?.children).toContain("خانه");
  });
});

describe("tools hub — slug reservation and sitemap", () => {
  /**
   * ⚠️ Platform pages live at the top level too, so an unreserved hub slug
   * could be handed to a future platform and silently shadow this page.
   */
  it("the slug is reserved on the web side, so no platform can claim it", () => {
    expect(STATIC_PAGE_SLUGS.has("abzarha")).toBe(true);
    expect(isReservedSlug("abzarha")).toBe(true);
  });

  it("the hub is in the sitemap", () => {
    const paths = buildSitemapEntries({ posts: [], instruments: [], platforms: [] }).map(
      (entry) => entry.path,
    );
    expect(paths).toContain(TOOLS_HUB_PATH);
  });
});

describe("header nav — the fifth item", () => {
  it("«ابزارها» is in the main nav and points at the hub", () => {
    expect(nav.map((item) => item.href)).toContain(TOOLS_HUB_PATH);
    expect(nav.find((item) => item.href === TOOLS_HUB_PATH)?.label).toBe("ابزارها");
  });

  it("the hub is reachable from the header of a tool page too, not only the home page", () => {
    expect(hubHtml()).toContain('aria-label="ناوبری اصلی"');
    for (const item of nav) {
      expect(hubHtml(), item.href).toContain(`href="${item.href}"`);
    }
  });
});

describe("no internal link goes to a page that doesn't exist", () => {
  it("the tools hub", () => {
    for (const href of internalHrefs(hubHtml())) {
      expect(resolvesToARoute(href), href).toBe(true);
    }
  });

  it("the home page", async () => {
    for (const href of internalHrefs(await homeHtml())) {
      expect(resolvesToARoute(href), href).toBe(true);
    }
  });
});
