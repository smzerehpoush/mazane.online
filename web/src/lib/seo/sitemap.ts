import type { PublishedPost } from "../blog";
import type { InstrumentListing, ListedPlatform } from "../prices";
import { SITE_URL } from "../site";

export interface SitemapEntry {
  path: string;
  lastModified?: string;
}

const BLOG_INDEX_PATH = "/blog";

const STATIC_PATHS: readonly string[] = [
  "/",
  BLOG_INDEX_PATH,
  "/sekeh",
  "/mazane-chist",
  "/about",
  "/methodology",
  "/abzarha",
  "/mohasebe-tala",
  "/mohasebe-forush-tala",
  "/kodam-saku",
  "/tabdil-mazane",
];

/**
 * ⚠️ `lastmod` tracks **content**, never the price. Every value below is the
 * day a human last changed that page's copy — bump it by hand here when you
 * edit the page, and never derive it from anything the collector writes
 * (`tablo:updated_at:*`, `platform_terms.observed_at`, a quote's
 * `fetched_at`): those move every ~30 seconds and a `lastmod` that moves
 * with them teaches Google that ours means nothing. The values are
 * deliberately date-only — a non-blog `lastmod` carrying a time of day is a
 * price tick that leaked in. A page missing from this table simply gets no
 * `lastmod`, which is a valid sitemap; a wrong date is not.
 */
export const CONTENT_REVISED_ON: Readonly<Record<string, string>> = {
  "/": "2026-08-18",
  "/blog": "2026-08-18",
  "/sekeh": "2026-08-18",
  "/mazane-chist": "2026-08-18",
  "/about": "2026-08-18",
  "/methodology": "2026-08-18",
  "/abzarha": "2026-08-18",
  "/mohasebe-tala": "2026-08-18",
  "/mohasebe-forush-tala": "2026-08-18",
  "/kodam-saku": "2026-08-18",
  "/tabdil-mazane": "2026-08-18",

  "/tala-18": "2026-08-18",

  "/wallgold": "2026-08-18",
  "/talasea": "2026-08-18",
  "/milli": "2026-08-18",
  "/goldika": "2026-08-18",
  "/technogold": "2026-08-18",
  "/tlyn": "2026-08-18",
  "/ecogold": "2026-08-18",
  "/zarafza": "2026-08-18",
  "/baazar": "2026-08-18",
  "/daric": "2026-08-18",
  "/melligold": "2026-08-18",
  "/digikala": "2026-08-18",
  "/hamrahgold": "2026-08-18",
  "/invi": "2026-08-18",
};

export interface SitemapInput {
  posts: readonly PublishedPost[];
  instruments: readonly InstrumentListing[];
  platforms: readonly ListedPlatform[];
}

function contentRevisionOf(path: string): string | undefined {
  return CONTENT_REVISED_ON[path];
}

function dayOf(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function laterOf(a: string | undefined, b: string | undefined): string | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return a > b ? a : b;
}

function newestPostDay(posts: readonly PublishedPost[]): string | undefined {
  let newest: string | undefined;
  for (const post of posts) {
    newest = laterOf(newest, dayOf(post.updated_at));
  }
  return newest;
}

export function buildSitemapEntries(input: SitemapInput): SitemapEntry[] {
  const blogIndexRevision = laterOf(contentRevisionOf(BLOG_INDEX_PATH), newestPostDay(input.posts));

  const entryFor = (path: string): SitemapEntry => {
    const lastModified = path === BLOG_INDEX_PATH ? blogIndexRevision : contentRevisionOf(path);
    return lastModified === undefined ? { path } : { path, lastModified };
  };

  return [
    ...STATIC_PATHS.map(entryFor),
    ...input.instruments.filter((item) => item.published).map((item) => entryFor(`/${item.slug}`)),
    ...input.platforms.map((platform) => entryFor(`/${platform.slug}`)),
    ...input.posts.map((post) => ({
      path: `/blog/${post.slug}`,
      lastModified: post.updated_at,
    })),
  ];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderSitemapXml(
  entries: readonly SitemapEntry[],
  siteUrl: string = SITE_URL,
): string {
  const urls = entries.map((entry) => {
    const loc = `    <loc>${escapeXml(`${siteUrl}${entry.path}`)}</loc>`;
    const lastmod =
      entry.lastModified === undefined
        ? ""
        : `\n    <lastmod>${escapeXml(entry.lastModified)}</lastmod>`;
    return `  <url>\n${loc}${lastmod}\n  </url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}
