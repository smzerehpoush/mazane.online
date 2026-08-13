import type { PublishedPost } from "../blog";
import type { InstrumentListing, ListedPlatform } from "../prices";
import { SITE_URL } from "../site";

export interface SitemapEntry {
  path: string;
  lastModified?: string;
}

const STATIC_PATHS: readonly string[] = [
  "/",
  "/blog",
  "/mazane-chist",
  "/darbare-pishnahad",
];

export interface SitemapInput {
  posts: readonly PublishedPost[];
  instruments: readonly InstrumentListing[];
  platforms: readonly ListedPlatform[];
}

export function buildSitemapEntries(input: SitemapInput): SitemapEntry[] {
  return [
    ...STATIC_PATHS.map((path) => ({ path })),
    ...input.instruments
      .filter((item) => item.published)
      .map((item) => ({ path: `/${item.slug}` })),
    ...input.platforms.map((platform) => ({ path: `/${platform.slug}` })),
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
