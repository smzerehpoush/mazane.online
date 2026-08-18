/**
 * ⚠️ The list comes from `lib/catalog.ts`, not straight from the store:
 * **page identity must never be tied to live Redis.** A Redis outage means
 * staleness, so a valid slug with no data must get a 200 and just show
 * "unavailable" in place of its price — not a 404 that Arvan's edge would
 * even cache.
 */
import { listInstruments, listPlatforms } from "./catalog";
import type { InstrumentListing, ListedPlatform } from "./prices";

export const RESERVED_WORDS: ReadonlySet<string> = new Set([
  "blog",
  "go",
  "api",
  "sitemap.xml",
  "robots.txt",
  "_next",
  "about",
]);

export const STATIC_PAGE_SLUGS: ReadonlySet<string> = new Set([
  "mazane-chist",
  "sekeh",
  "methodology",
  "mohasebe-tala",
  "mohasebe-forush-tala",
  "abzarha",
  "kodam-saku",
  "tabdil-mazane",
]);

export type SlugResolution =
  | { kind: "instrument"; listing: InstrumentListing }
  | { kind: "platform"; platform: ListedPlatform };

export function isReservedSlug(slug: string): boolean {
  return RESERVED_WORDS.has(slug) || STATIC_PAGE_SLUGS.has(slug);
}

export async function resolveSlug(slug: string): Promise<SlugResolution | null> {
  if (isReservedSlug(slug)) return null;
  const [instruments, platforms] = await Promise.all([listInstruments(), listPlatforms()]);
  const listing = instruments.find((item) => item.slug === slug);
  if (listing !== undefined) {
    return listing.published ? { kind: "instrument", listing } : null;
  }
  const platform = platforms.find((item) => item.slug === slug);
  if (platform !== undefined) return { kind: "platform", platform };
  return null;
}
