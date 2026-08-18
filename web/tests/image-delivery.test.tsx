import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { BlogIndexView, BlogPostView } from "../src/components/content/BlogViews";
import { HomePage } from "../src/components/tablo/HomePage";
import type { BlogPost, PublishedPost } from "../src/lib/blog";
import { imageOriginOf, imagePreconnectLinks } from "../src/lib/image-origin";
import { buildSrcset, postImageAsset } from "../src/lib/images";
import { healthyStore, homeData } from "./support/seed";

const BASE = "https://s3.tablo.test/tablo-media/posts/hazine";
const SRCSET =
  `${BASE}/h-160.webp 160w, ${BASE}/h-480.webp 480w, ` +
  `${BASE}/h-800.webp 800w, ${BASE}/h.webp 1600w`;

function post(overrides: Partial<BlogPost> = {}): PublishedPost {
  return {
    slug: "hazine-raft-o-bargasht",
    title_fa: "هزینه‌ی رفت‌وبرگشت چیست؟",
    body_md: "هزینه‌ی رفت‌وبرگشت یعنی مجموع اثر کارمزد خرید و فروش.",
    status: "published",
    published_at: "2026-08-01T09:00:00.000Z",
    updated_at: "2026-08-01T09:00:00.000Z",
    image_url: `${BASE}/h.webp`,
    image_alt: "هزینه‌ی رفت‌وبرگشت طلا",
    image_width: 1600,
    image_height: 900,
    ...overrides,
  } as PublishedPost;
}

/**
 * ⚠️ Case-insensitive on purpose: React 19 writes the attribute back out as
 * `srcSet`, and HTML attribute names are case-insensitive, so an exact-case
 * assertion tests React's spelling rather than this repo's behaviour.
 */
function srcsetPattern(): RegExp {
  return new RegExp(`srcset="${SRCSET.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "i");
}

function rootSource(): string {
  return readFileSync(join(__dirname, "..", "src/routes/__root.tsx"), "utf8");
}

describe("image origin — where the preconnect target comes from", () => {
  it("the S3 endpoint becomes a bare origin: no path, no bucket, no trailing slash", () => {
    expect(imageOriginOf("https://s3.ir-thr.example.test/")).toBe("https://s3.ir-thr.example.test");
    expect(imageOriginOf("https://s3.ir-thr.example.test/tablo-media")).toBe(
      "https://s3.ir-thr.example.test",
    );
    expect(imageOriginOf("  https://s3.ir-thr.example.test  ")).toBe(
      "https://s3.ir-thr.example.test",
    );
  });

  it("an endpoint written without a scheme is read as https, never as a relative path", () => {
    expect(imageOriginOf("s3.ir-thr.example.test")).toBe("https://s3.ir-thr.example.test");
  });

  it("a non-http scheme, an unparseable value, or an unset variable is simply no origin", () => {
    expect(imageOriginOf("ftp://s3.example.test")).toBeNull();
    expect(imageOriginOf("http://")).toBeNull();
    expect(imageOriginOf("")).toBeNull();
    expect(imageOriginOf("   ")).toBeNull();
    expect(imageOriginOf(null)).toBeNull();
    expect(imageOriginOf(undefined)).toBeNull();
  });

  it("no configured origin ⟸ no link at all, rather than a broken one", () => {
    expect(imagePreconnectLinks(null)).toEqual([]);
  });

  /**
   * ⚠️ No `crossOrigin` here on purpose. A `<img>` with no `crossorigin`
   * attribute is fetched in no-CORS mode; a preconnect that carries
   * `crossorigin` warms a *different* connection, which the image fetch then
   * cannot reuse — the handshake would be paid twice instead of zero times.
   */
  it("a configured origin ⟸ preconnect first, dns-prefetch as the fallback, no crossorigin", () => {
    expect(imagePreconnectLinks("https://s3.example.test")).toEqual([
      { rel: "preconnect", href: "https://s3.example.test" },
      { rel: "dns-prefetch", href: "https://s3.example.test" },
    ]);
  });
});

/**
 * ⚠️ A source-level guard: `vitest.config.ts` deliberately leaves the
 * TanStack Start plugins out, so the root route cannot be rendered here.
 * What must not silently regress is the wiring — the origin travelling
 * through the loader instead of being read inside `head()`.
 */
describe("root route — the preconnect wiring", () => {
  it("the origin is produced by the root loader", () => {
    expect(rootSource()).toMatch(
      /loader:\s*\(\)\s*=>\s*\(\{\s*imageOrigin:\s*configuredImageOrigin\(\)/,
    );
  });

  it("head() reads that loader data and never the environment", () => {
    const source = rootSource();
    expect(source).toContain("imagePreconnectLinks(loaderData?.imageOrigin ?? null)");
    expect(source).not.toContain("process.env");
  });
});

describe("srcset assembly", () => {
  it("widths are sorted ascending and each one appears once", () => {
    expect(
      buildSrcset([
        { url: "b.webp", width: 800 },
        { url: "a.webp", width: 160 },
        { url: "duplicate.webp", width: 160 },
      ]),
    ).toBe("a.webp 160w, b.webp 800w");
  });

  it("a single width is not a srcset — it is the src, so the result is null", () => {
    expect(buildSrcset([{ url: "a.webp", width: 1600 }])).toBeNull();
    expect(buildSrcset([])).toBeNull();
  });

  it("entries with no url or a nonsense width are dropped, not rendered", () => {
    expect(
      buildSrcset([
        { url: "", width: 160 },
        { url: "a.webp", width: 0 },
        { url: "b.webp", width: 480 },
        { url: "c.webp", width: 1600 },
      ]),
    ).toBe("b.webp 480w, c.webp 1600w");
  });
});

describe("postImageAsset — images uploaded before variants existed", () => {
  it("no image_srcset column value ⟸ the asset carries no srcset", () => {
    expect(postImageAsset(post())?.srcset).toBeNull();
  });

  it("an empty or blank srcset is treated as absent", () => {
    expect(postImageAsset(post({ image_srcset: "" }))?.srcset).toBeNull();
    expect(postImageAsset(post({ image_srcset: "   " }))?.srcset).toBeNull();
  });

  it("a stored srcset reaches the asset unchanged", () => {
    expect(postImageAsset(post({ image_srcset: SRCSET }))?.srcset).toBe(SRCSET);
  });
});

describe("rendered post images", () => {
  it("the post hero gets srcset, sizes and a high fetch priority", () => {
    const html = renderToStaticMarkup(<BlogPostView post={post({ image_srcset: SRCSET })} />);
    expect(html).toMatch(srcsetPattern());
    expect(html).toContain('sizes="(min-width: 820px) 692px, 100vw"');
    expect(html).toMatch(/fetchpriority="high"/i);
    expect(html).toContain('loading="eager"');
  });

  /**
   * ⚠️ The whole point of the fallback: those narrow objects were never
   * uploaded for older posts. A srcset here would be a list of 404s and the
   * browser would show nothing.
   */
  it("a post from before the variants: plain src, no srcset and no sizes", () => {
    const html = renderToStaticMarkup(<BlogPostView post={post()} />);
    expect(html).toContain(`src="${BASE}/h.webp"`);
    expect(html).not.toMatch(/srcset=/i);
    expect(html).not.toMatch(/sizes=/i);
    expect(html).toContain('width="1600"');
    expect(html).toContain('height="900"');
  });

  it("blog-index thumbnails ask for a thumbnail-sized candidate, not the 1600px one", () => {
    const html = renderToStaticMarkup(<BlogIndexView posts={[post({ image_srcset: SRCSET })]} />);
    expect(html).toMatch(srcsetPattern());
    expect(html).toContain('sizes="(min-width: 640px) 80px, 64px"');
  });

  it("the home page's featured card and sidebar thumbnails carry their own sizes", async () => {
    const data = await homeData(healthyStore(), {
      posts: [post({ image_srcset: SRCSET }), post({ slug: "dovom", image_srcset: SRCSET })],
    });
    const html = renderToStaticMarkup(<HomePage data={data} />);
    expect(html).toContain('sizes="(min-width: 1081px) 920px, 100vw"');
    expect(html).toContain('sizes="(min-width: 640px) 80px, 64px"');
    expect(html).toMatch(srcsetPattern());
  });

  it("a home page whose posts predate the variants renders no srcset anywhere", async () => {
    const data = await homeData(healthyStore(), { posts: [post()] });
    const html = renderToStaticMarkup(<HomePage data={data} />);
    expect(html).toContain(`src="${BASE}/h.webp"`);
    expect(html).not.toMatch(/srcset=/i);
  });
});
