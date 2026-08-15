import { describe, expect, it } from "vitest";

import type { PublishedPost } from "../src/lib/blog";
import type { InstrumentListing, ListedPlatform } from "../src/lib/prices";
import { adminHeadersFor, applyAdminHeaders } from "../src/lib/seo/admin-headers";
import {
  HTML_EDGE_CACHE_CONTROL,
  NO_STORE,
  edgeCacheControlFor,
} from "../src/lib/seo/cache-headers";
import { renderRobotsTxt } from "../src/lib/seo/robots";
import { buildSitemapEntries, renderSitemapXml } from "../src/lib/seo/sitemap";
import { SITE_URL } from "../src/lib/site";

const POSTS: PublishedPost[] = [
  {
    slug: "maliyat-tala-1405",
    title_fa: "مالیات طلا",
    body_md: "…",
    status: "published",
    published_at: "2026-08-01T09:00:00.000Z",
    updated_at: "2026-08-03T11:30:00.000Z",
  },
];

const INSTRUMENTS: InstrumentListing[] = [
  {
    slug: "tala-18",
    instrument: "GOLD_18K",
    name_fa: "طلای ۱۸ عیار",
    unit_fa: "گرم",
    purity: "750",
    currency: "IRT",
    supporting_platform_slugs: ["milli", "wallgold"],
    published: true,
  },
  {
    slug: "noghre-990",
    instrument: "SILVER_990",
    name_fa: "نقره‌ی ۹۹۰",
    unit_fa: "گرم",
    purity: "990",
    currency: "IRT",
    supporting_platform_slugs: ["milli"],
    published: false,
  },
];

const PLATFORMS: ListedPlatform[] = [
  { slug: "milli", name_fa: "میلی", data_policy: "ALLOWED" },
  { slug: "wallgold", name_fa: "وال‌گلد", data_policy: "ALLOWED" },
];

function entries() {
  return buildSitemapEntries({
    posts: POSTS,
    instruments: INSTRUMENTS,
    platforms: PLATFORMS,
  });
}

describe("robots.txt", () => {
  it("/go/ is closed to every crawler, everything else is open", () => {
    const text = renderRobotsTxt();
    expect(text).toContain("User-agent: *");
    expect(text).toContain("Allow: /");
    expect(text).toContain("Disallow: /go/");
  });

  it("/admin is closed to every crawler", () => {
    expect(renderRobotsTxt()).toContain("Disallow: /admin");
  });

  it("announces the sitemap with an absolute URL", () => {
    expect(renderRobotsTxt()).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });
});

describe("sitemap.xml", () => {
  it("has the home page, static pages, the published instrument, platforms, and posts", () => {
    const paths = entries().map((entry) => entry.path);
    expect(paths).toEqual([
      "/",
      "/blog",
      "/mazane-chist",
      "/tala-18",
      "/milli",
      "/wallgold",
      "/blog/maliyat-tala-1405",
    ]);
  });

  it("an instrument behind the publish gate doesn't appear", () => {
    expect(entries().map((entry) => entry.path)).not.toContain("/noghre-990");
  });

  it("/go/ never appears in the sitemap — it's closed in robots", () => {
    expect(renderSitemapXml(entries())).not.toContain("/go/");
  });

  it("lastmod only for blog posts, and from their own updated_at", () => {
    const withLastmod = entries().filter((entry) => entry.lastModified !== undefined);
    expect(withLastmod).toEqual([
      { path: "/blog/maliyat-tala-1405", lastModified: "2026-08-03T11:30:00.000Z" },
    ]);
  });

  it("the home page and price pages have no lastmod — a price fluctuating isn't a content change", () => {
    const xml = renderSitemapXml([{ path: "/" }, { path: "/milli" }]);
    expect(xml).not.toContain("<lastmod>");
  });

  it("produces valid XML with absolute URLs", () => {
    const xml = renderSitemapXml(entries());
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain(`<loc>${SITE_URL}/tala-18</loc>`);
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
    expect(xml.match(/<url>/g)?.length).toBe(entries().length);
  });

  it("escapes the URL in the XML", () => {
    const xml = renderSitemapXml([{ path: "/a&b" }]);
    expect(xml).toContain("<loc>https://tablo.gold/a&amp;b</loc>");
  });
});

describe("edge cache policy (origin outage)", () => {
  const base = {
    pathname: "/",
    status: 200,
    contentType: "text/html; charset=utf-8",
    hasCacheControl: false,
    isServerFn: false,
  };

  it("healthy HTML gets an edge header with stale-if-error", () => {
    expect(edgeCacheControlFor(base)).toBe(HTML_EDGE_CACHE_CONTROL);
    expect(HTML_EDGE_CACHE_CONTROL).toContain("stale-if-error=86400");
  });

  it("a 5xx response is never cached — otherwise the edge would repeat the error", () => {
    expect(edgeCacheControlFor({ ...base, status: 500 })).toBe(NO_STORE);
    expect(edgeCacheControlFor({ ...base, status: 503 })).toBe(NO_STORE);
  });

  it("404 never gets s-maxage — it gets no-store", () => {
    const value = edgeCacheControlFor({ ...base, status: 404 });
    expect(value).toBe(NO_STORE);
    expect(value).not.toContain("s-maxage");
    expect(value).not.toContain("stale-while-revalidate");
  });

  it("no non-200 response gets the HTML cache policy", () => {
    for (const status of [301, 302, 400, 403, 404, 410, 429, 500, 502, 503]) {
      const value = edgeCacheControlFor({ ...base, status });
      expect(value, `status ${status}`).toBe(NO_STORE);
      expect(value, `status ${status}`).not.toBe(HTML_EDGE_CACHE_CONTROL);
    }
  });

  it("304 is left untouched", () => {
    expect(edgeCacheControlFor({ ...base, status: 304 })).toBeNull();
  });

  it("/api/ and /go/ are never cached", () => {
    for (const pathname of ["/api/prices", "/api/revalidate-blog", "/go/milli"]) {
      expect(edgeCacheControlFor({ ...base, pathname, contentType: null })).toBe(NO_STORE);
    }
  });

  it("a server function call is never cached", () => {
    expect(edgeCacheControlFor({ ...base, isServerFn: true })).toBe(NO_STORE);
  });

  it("a response that already sets its own Cache-Control is left untouched", () => {
    expect(edgeCacheControlFor({ ...base, hasCacheControl: true })).toBeNull();
  });

  it("a non-HTML response is left with no decision (a static asset has its own header)", () => {
    expect(
      edgeCacheControlFor({ ...base, pathname: "/x.png", contentType: "image/png" }),
    ).toBeNull();
  });
});

describe("admin panel headers", () => {
  it("/admin and every subpath get no-cache, no-index headers", () => {
    for (const pathname of ["/admin", "/admin/", "/admin/login", "/admin/foo/bar"]) {
      const headers = adminHeadersFor(pathname);
      expect(headers, pathname).not.toBeNull();
      expect(headers?.["Cache-Control"]).toBe("no-store");
      expect(headers?.["X-Robots-Tag"]).toBe("noindex, nofollow");
    }
  });

  it("non-admin paths are left untouched", () => {
    for (const pathname of ["/", "/blog", "/adminfoo", "/api/prices"]) {
      expect(adminHeadersFor(pathname), pathname).toBeNull();
    }
  });

  it("applyAdminHeaders sets the headers on an /admin response", () => {
    const response = new Response("<html></html>", {
      headers: { "content-type": "text/html" },
    });
    applyAdminHeaders(response, "/admin/login");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("applyAdminHeaders doesn't touch a non-admin path", () => {
    const response = new Response("ok");
    applyAdminHeaders(response, "/blog");
    expect(response.headers.get("cache-control")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });
});
