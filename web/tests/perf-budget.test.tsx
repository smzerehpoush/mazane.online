/**
 * ⚠️ This is a *regression* budget, not a Core Web Vitals measurement. LCP,
 * INP and CLS for tablo.gold are read from Search Console field data (the
 * procedure is in `docs/01-overview.md` §1.10) — a number produced on a CI
 * runner would describe that runner's network, not an Iranian phone. What a
 * test can honestly guard is the one input the repository fully controls:
 * how many bytes the first response carries before anything can be painted.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { HomePage } from "../src/components/tablo/HomePage";
import { listPublishedPosts, type BlogPost } from "../src/lib/blog";
import { getPlatformHistory, type PlatformHistory } from "../src/lib/history";
import { assembleHomeData } from "../src/lib/page-data";
import type { HomePageData } from "../src/components/tablo/HomePage";
import type { ReferencePrice } from "../src/lib/reference-price";
import { fetchRows } from "../src/lib/rows";
import { healthyStore, seed, seedBlog, seedHistoryByQuery } from "./support/seed";

const MARKUP_BUDGET_BYTES = 68_000;
const LOADER_BUDGET_BYTES = 52_000;

const POST_COUNT = 8;

function series(slug: string, count: number, stepHours: number): PlatformHistory {
  return {
    platform_slug: slug,
    points: Array.from({ length: count }, (_, index) => ({
      hour: new Date(Date.UTC(2026, 7, 1, index * stepHours)).toISOString(),
      value: 18_500_000 + index * 1731,
    })),
    latest: 18_500_000 + count * 1731,
    side_used: "PRICE",
  };
}

function post(index: number): BlogPost {
  const day = (index % 9) + 1;
  return {
    slug: `post-shomare-${index}`,
    title_fa: `عنوان نوشته‌ی شماره ${index} درباره‌ی کارمزد سکوهای طلای آنلاین`,
    body_md: "هزینه‌ی رفت‌وبرگشت یعنی مجموع اثر کارمزد خرید و فروش. ".repeat(20),
    status: "published",
    published_at: `2026-08-0${day}T09:00:00.000Z`,
    updated_at: `2026-08-0${day}T09:00:00.000Z`,
    image_url: `https://s3.tablo.test/tablo-media/posts/post-shomare-${index}/hash.webp`,
    image_alt: "تصویر شاخص نوشته",
    image_width: 1600,
    image_height: 900,
    image_srcset: [160, 480, 800, 1200]
      .map(
        (width) =>
          `https://s3.tablo.test/tablo-media/posts/post-shomare-${index}/hash-${width}.webp ${width}w`,
      )
      .concat(`https://s3.tablo.test/tablo-media/posts/post-shomare-${index}/hash.webp 1600w`)
      .join(", "),
  };
}

/**
 * ⚠️ Deliberately the fullest home page the production readers can build,
 * not the small fixture the rest of the suite uses: five chart platforms at
 * 24 hourly points, all three reference ranges (24 + 84 + 93 points), the
 * bubble, the coin card and eight published posts. A budget measured on a
 * thin fixture would drift away from the page users actually download.
 */
async function fullHomeData(): Promise<HomePageData> {
  seed(healthyStore());
  seedBlog(Array.from({ length: POST_COUNT }, (_, index) => post(index)));
  seedHistoryByQuery((query) =>
    query.kind === "REFERENCE"
      ? [series("talair", Math.ceil(query.hours / (query.stepHours ?? 1)), query.stepHours ?? 1)]
      : query.platformSlugs.map((slug) => series(slug, query.hours, 1)),
  );
  const reference = (instrument: string): ReferencePrice => ({
    reference_slug: "talair",
    instrument,
    value: instrument === "XAU" ? 2431 : 18_600_000,
    read_at: "2026-08-18T09:00:00.000Z",
  });
  return assembleHomeData({
    fetchRows,
    getPlatformHistory,
    listPublishedPosts,
    getViewCounts: async () => ({ "post-shomare-1": 412, "post-shomare-2": 98 }),
    getReferencePrice: async (query) => reference(query.instrument),
  });
}

describe("home page payload budget", () => {
  it("the server-rendered markup stays inside its byte budget", async () => {
    const html = renderToStaticMarkup(<HomePage data={await fullHomeData()} />);
    const bytes = Buffer.byteLength(html, "utf8");
    expect(bytes, `markup is ${bytes} bytes`).toBeLessThan(MARKUP_BUDGET_BYTES);
  });

  /**
   * ⚠️ The loader payload is paid a *second* time: the router serializes it
   * into the same document so the client can hydrate without refetching. Any
   * field added to `HomePageData` therefore costs bytes twice — once as
   * markup, once as JSON.
   */
  it("the loader payload serialized into that same document stays inside its budget", async () => {
    const json = JSON.stringify(await fullHomeData());
    const bytes = Buffer.byteLength(json, "utf8");
    expect(bytes, `loader payload is ${bytes} bytes`).toBeLessThan(LOADER_BUDGET_BYTES);
  });

  /**
   * ⚠️ The point of the two numbers above is that they move for a *reason*.
   * This one names the reason that historically dominates: the inlined
   * history series. 24 hourly points per charted platform plus the three
   * reference ranges is the shape the budget was measured against.
   */
  it("the inlined history keeps its known shape", async () => {
    const data = await fullHomeData();
    const platformPoints = data.history.reduce((sum, item) => sum + item.points.length, 0);
    const referencePoints = Object.values(data.referenceHistory).reduce(
      (sum, item) => sum + (item?.points.length ?? 0),
      0,
    );
    expect(platformPoints).toBe(120);
    expect(referencePoints).toBe(201);
  });
});
