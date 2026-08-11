/**
 * مرز وب — سطح سئوی سروری: ‎robots.txt‎، ‎sitemap.xml‎ و سیاست کش لبه.
 *
 * این سه قاعده مستقیماً روی اولویت شماره‌ی یک کسب‌وکار (ایندکس گوگل) می‌نشینند
 * و همه خالص‌اند: ورودی داده‌ی seed شده، خروجی رشته یا هدر. مسیرهای
 * ‎src/routes/robots[.]txt.ts‎ و ‎src/routes/sitemap[.]xml.ts‎ فقط پوسته‌ی
 * نازک همین توابع‌اند و خودشان منطقی ندارند.
 */
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
    // دارایی تک‌سکویی — دروازه‌ی انتشار بسته (تصمیم ۱۰): ۴۰۴ است، پس در
    // سایت‌مپ هم نباید باشد.
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

describe("robots.txt (بند ۶.۴)", () => {
  it("‎/go/‎ برای همه‌ی خزنده‌ها بسته است و بقیه باز", () => {
    const text = renderRobotsTxt();
    expect(text).toContain("User-agent: *");
    expect(text).toContain("Allow: /");
    expect(text).toContain("Disallow: /go/");
  });

  it("‎/admin‎ برای همه‌ی خزنده‌ها بسته است (بلیت ۲۰، بند ۹ قراردادها)", () => {
    expect(renderRobotsTxt()).toContain("Disallow: /admin");
  });

  it("سایت‌مپ را با نشانی مطلق معرفی می‌کند", () => {
    expect(renderRobotsTxt()).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });
});

describe("sitemap.xml", () => {
  it("صفحه‌ی اصلی، صفحات ثابت، دارایی منتشرشده، سکوها و پست‌ها را دارد", () => {
    const paths = entries().map((entry) => entry.path);
    expect(paths).toEqual([
      "/",
      "/blog",
      "/mazane-chist",
      "/darbare-pishnahad",
      "/tala-18",
      "/milli",
      "/wallgold",
      "/blog/maliyat-tala-1405",
    ]);
  });

  it("دارایی با دروازه‌ی انتشار بسته نمی‌آید (تصمیم ۱۰)", () => {
    expect(entries().map((entry) => entry.path)).not.toContain("/noghre-990");
  });

  it("‎/go/‎ هرگز در سایت‌مپ نمی‌آید — در robots بسته است (بند ۶.۴)", () => {
    expect(renderSitemapXml(entries())).not.toContain("/go/");
  });

  it("lastmod فقط برای پست بلاگ و از updated_at خودش (بند ۶.۷)", () => {
    const withLastmod = entries().filter((entry) => entry.lastModified !== undefined);
    expect(withLastmod).toEqual([
      { path: "/blog/maliyat-tala-1405", lastModified: "2026-08-03T11:30:00.000Z" },
    ]);
  });

  it("صفحه‌ی اصلی و صفحات قیمتی lastmod ندارند — نوسان قیمت تغییر محتوا نیست", () => {
    const xml = renderSitemapXml([{ path: "/" }, { path: "/milli" }]);
    expect(xml).not.toContain("<lastmod>");
  });

  it("XML معتبر با نشانی‌های مطلق تولید می‌کند", () => {
    const xml = renderSitemapXml(entries());
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain(`<loc>${SITE_URL}/tala-18</loc>`);
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
    // به‌ازای هر ورودی دقیقاً یک <url>.
    expect(xml.match(/<url>/g)?.length).toBe(entries().length);
  });

  it("نشانی را در XML فرار می‌دهد", () => {
    const xml = renderSitemapXml([{ path: "/a&b" }]);
    expect(xml).toContain("<loc>https://tablo.gold/a&amp;b</loc>");
  });
});

describe("سیاست کش لبه (بند ۱۰ — قطعی مبدأ)", () => {
  const base = {
    pathname: "/",
    status: 200,
    contentType: "text/html; charset=utf-8",
    hasCacheControl: false,
    isServerFn: false,
  };

  it("HTML سالم هدر لبه با stale-if-error می‌گیرد", () => {
    expect(edgeCacheControlFor(base)).toBe(HTML_EDGE_CACHE_CONTROL);
    expect(HTML_EDGE_CACHE_CONTROL).toContain("stale-if-error=86400");
  });

  it("پاسخ ۵xx هرگز کش نمی‌شود — وگرنه لبه خطا را تکرار می‌کند", () => {
    expect(edgeCacheControlFor({ ...base, status: 500 })).toBe(NO_STORE);
    expect(edgeCacheControlFor({ ...base, status: 503 })).toBe(NO_STORE);
  });

  /**
   * رگرسیون: پیش از این ۴۰۴ سیاست کش HTML می‌گرفت. با `s-maxage=60` و
   * `stale-while-revalidate=600`، یک ۴۰۴ گذرا (مثلاً در قطعی ردیس) تا ده
   * دقیقه پس از سالم شدن مبدأ هم از لبه سرو می‌شد و به گوگل‌بات می‌گفت
   * «این صفحه رفته». `stale-if-error` هم نجات نمی‌داد: RFC 5861 فقط ۵xx
   * را پوشش می‌دهد. «صفحه‌ی نبوده» هرگز کش‌شدنی نیست.
   */
  it("۴۰۴ هرگز s-maxage نمی‌گیرد — no-store می‌گیرد", () => {
    const value = edgeCacheControlFor({ ...base, status: 404 });
    expect(value).toBe(NO_STORE);
    expect(value).not.toContain("s-maxage");
    expect(value).not.toContain("stale-while-revalidate");
  });

  it("هیچ پاسخ غیر-۲۰۰ ی سیاست کش HTML نمی‌گیرد", () => {
    for (const status of [301, 302, 400, 403, 404, 410, 429, 500, 502, 503]) {
      const value = edgeCacheControlFor({ ...base, status });
      expect(value, `status ${status}`).toBe(NO_STORE);
      expect(value, `status ${status}`).not.toBe(HTML_EDGE_CACHE_CONTROL);
    }
  });

  /**
   * ۳۰۴ تنها استثناست: بدنه ندارد و هدرهایش روی نسخه‌ی ذخیره‌شده‌ی لبه
   * می‌نشیند، پس `no-store` روی آن یعنی دور انداختن دارایی سالمِ کش‌شده.
   */
  it("۳۰۴ دست‌نخورده می‌ماند", () => {
    expect(edgeCacheControlFor({ ...base, status: 304 })).toBeNull();
  });

  it("‎/api/‎ و ‎/go/‎ هرگز کش نمی‌شوند", () => {
    for (const pathname of ["/api/prices", "/api/revalidate-blog", "/go/milli"]) {
      expect(edgeCacheControlFor({ ...base, pathname, contentType: null })).toBe(NO_STORE);
    }
  });

  it("فراخوان تابع سروری هرگز کش نمی‌شود", () => {
    expect(edgeCacheControlFor({ ...base, isServerFn: true })).toBe(NO_STORE);
  });

  it("پاسخی که خودش Cache-Control دارد دست‌نخورده می‌ماند", () => {
    expect(edgeCacheControlFor({ ...base, hasCacheControl: true })).toBeNull();
  });

  it("پاسخ غیر-HTML بدون تصمیم رها می‌شود (دارایی ایستا هدر خودش را دارد)", () => {
    expect(
      edgeCacheControlFor({ ...base, pathname: "/x.png", contentType: "image/png" }),
    ).toBeNull();
  });
});

describe("هدرهای پنل مدیریت (بلیت ۲۰، بند ۹ قراردادها)", () => {
  it("‎/admin‎ و هر زیرمسیرش هدر بی‌کش و بدون‌نمایه می‌گیرند", () => {
    for (const pathname of ["/admin", "/admin/", "/admin/login", "/admin/foo/bar"]) {
      const headers = adminHeadersFor(pathname);
      expect(headers, pathname).not.toBeNull();
      expect(headers?.["Cache-Control"]).toBe("no-store");
      expect(headers?.["X-Robots-Tag"]).toBe("noindex, nofollow");
    }
  });

  it("مسیرهای غیرپنل دست‌نخورده می‌مانند", () => {
    for (const pathname of ["/", "/blog", "/adminfoo", "/api/prices"]) {
      expect(adminHeadersFor(pathname), pathname).toBeNull();
    }
  });

  it("applyAdminHeaders هدرها را روی پاسخ /admin می‌نشاند", () => {
    const response = new Response("<html></html>", {
      headers: { "content-type": "text/html" },
    });
    applyAdminHeaders(response, "/admin/login");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("applyAdminHeaders برای مسیر غیرپنل دست نمی‌زند", () => {
    const response = new Response("ok");
    applyAdminHeaders(response, "/blog");
    expect(response.headers.get("cache-control")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });
});
